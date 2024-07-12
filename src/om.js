// @ts-check
import { html } from "htm/preact";
import { FORECAST_COORDINATES, STATION_COORDINATES } from "./data.js";
import { effect, signal } from "@preact/signals";

/**
 * @type {Signal<OpenMeteoWeatherData | null>}
 */
const OM_DATA = signal(null);

// Refetch data on coordinates changes
effect(() => {
    fetchDataWithCache();
});

function getTimeRange() {
    const now = new Date();
    const start = now.toISOString();
    const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        23,
        59,
        59,
    ).toISOString();
    return { start, end };
}

/**
 * @param {string} coordinates
 * @returns {Promise<OpenMeteoWeatherData | null>}
 */
async function fetchDataWithCoordinates(coordinates) {
    const { start, end } = getTimeRange();
    const [latitude, longitude] = coordinates.split(",").map(Number);

    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=windspeed_1000hPa,windspeed_925hPa,windspeed_850hPa,windspeed_700hPa,windspeed_600hPa,winddirection_1000hPa,winddirection_925hPa,winddirection_850hPa,winddirection_700hPa,winddirection_600hPa&start=${start}&end=${end}`,
    );

    console.log(`Alkupäivämäärä: ${start}`);
    console.log(`Loppupäivämäärä: ${end}`);
    console.log(`Leveysaste: ${latitude}, Pituusaste: ${longitude}`);

    return await response.json();
}

/**
 * @returns {Promise<void>}
 */
async function fetchDataWithCache() {
    const coordinates = FORECAST_COORDINATES.value ?? STATION_COORDINATES.value;
    if (!coordinates) {
        return;
    }

    const cachedData = localStorage.getItem("ECMWFWindAloft");
    const cachedTime = localStorage.getItem("ECMWFWindAloftTime");
    const cachedCoordinates = localStorage.getItem("ECMWFWindAloftCoordinates");

    const now = new Date();
    const currentHour = now.getHours();

    if (cachedData && cachedTime && cachedCoordinates) {
        const cachedHour = new Date(Number(cachedTime)).getHours();

        if (cachedCoordinates === coordinates && cachedHour === currentHour) {
            console.log("Käytetään välimuistissa olevaa dataa");
            OM_DATA.value = JSON.parse(cachedData);
            return;
        }
    }

    // Jos välimuistissa ei ole dataa tai se on vanhentunutta, haetaan uutta
    const newData = await fetchDataWithCoordinates(coordinates);

    if (newData) {
        localStorage.setItem("ECMWFWindAloft", JSON.stringify(newData));
        localStorage.setItem("ECMWFWindAloftTime", now.getTime().toString());
        localStorage.setItem("ECMWFWindAloftCoordinates", coordinates);
    }

    OM_DATA.value = newData;
}

/**
 * @param {OpenMeteoHourlyData} hourly
 * @return {FormattedTableData}
 */
function formatTableData(hourly) {
    const pressureLevels = [
        { pressure: "600 hPa", height: "4200 m" },
        { pressure: "700 hPa", height: "3000 m" },
        { pressure: "850 hPa", height: "1500 m" },
        { pressure: "925 hPa", height: "800 m" },
        { pressure: "1000 hPa", height: "110 m" },
    ];

    /** @type {number[]} */
    const timeSlots = [6, 9, 12, 15, 18, 21];

    /** @type {Record<string, AverageWindSpeeds>} */
    const todayData = {};
    /** @type {Record<string, AverageWindSpeeds>} */
    const tomorrowData = {};

    timeSlots.forEach((slot) => {
        todayData[slot] = getAverageData(hourly, slot, 0);
        tomorrowData[slot] = getAverageData(hourly, slot, 1);
    });

    return { pressureLevels, todayData, tomorrowData };
}

/**
 * @param {OpenMeteoHourlyData} hourly
 * @param {number} targetHour
 * @param {number} dayOffset
 * @returns {AverageWindSpeeds}
 */
function getAverageData(hourly, targetHour, dayOffset) {
    const relevantIndices = [0, 1, 2]
        .map((i) => {
            const hour = (targetHour + i * 3) % 24;
            return hourly.time.findIndex((time) => {
                const date = new Date(time);
                return (
                    date.getHours() === hour &&
                    date.getDate() === new Date().getDate() + dayOffset
                );
            });
        })
        .filter((index) => index !== -1);

    /**
     * @type {OpenMeteoPressureLevel[]}
     */
    const pressureLevels = ["1000", "925", "850", "700", "600"];

    /**
     * @type {AverageWindSpeeds}
     */
    const result = {};

    pressureLevels.forEach((level) => {
        const speeds = relevantIndices.map(
            (i) => hourly[`windspeed_${level}hPa`]?.[i] ?? 0,
        );
        const directions = relevantIndices.map(
            (i) => hourly[`winddirection_${level}hPa`]?.[i] ?? 0,
        );

        result[level] = {
            speed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
            direction:
                directions.reduce((a, b) => a + b, 0) / directions.length,
        };
    });

    return result;
}

export function OpenMeteoTool() {
    const data = OM_DATA.value ? formatTableData(OM_DATA.value.hourly) : null;

    /**
     * @param {number} speed
     */
    const getWindSpeedClass = (speed) => {
        if (speed < 8) return "wind-low";
        if (speed <= 11) return "wind-medium";
        return "wind-high";
    };

    /**
     * @param {number|string} num
     */
    function roundToNearestFive(num) {
        return Math.round(Number(num) / 5) * 5;
    }

    /**
     * @param {number} direction
     */
    function getWindArrow(direction) {
        const arrow = "➤";
        const rotationDegree = direction + 90; // Lisätään 90 astetta, jotta nuoli osoittaa oikeaan suuntaan
        return html`<span
            style="display: inline-block; transform: rotate(${rotationDegree}deg);"
            >${arrow}</span
        >`;
    }

    /**
     * @param {string} title
     * @param {Record<string, AverageWindSpeeds>} tableData
     */
    const renderTable = (title, tableData) => {
        if (!tableData) return null;

        const now = new Date();
        const currentHour = now.getHours();

        return html`
            <table class="wind-table">
                <thead>
                    <tr>
                        <th colspan="${Object.keys(tableData).length + 1}">
                            ${title}
                        </th>
                    </tr>
                    <tr>
                        <th>Korkeus</th>
                        ${Object.keys(tableData).map(
                            (hour) =>
                                html`<th class="time-header">${hour}:00</th>`,
                        )}
                    </tr>
                </thead>
                <tbody>
                    ${data?.pressureLevels.map(({ pressure, height }) => {
                        const level = pressure.split(" ")[0] ?? "6";
                        return html`
                            <tr>
                                <td class="pressure-cell">${height}</td>
                                ${Object.entries(tableData).map(
                                    ([hour, hourData]) => {
                                        const isPast =
                                            title === "Tänään" &&
                                            parseInt(hour) <= currentHour;
                                        const cellClass = isPast
                                            ? "past-cell"
                                            : "";
                                        return hourData[level]
                                            ? html` <td
                                                  class="wind-cell ${cellClass} ${getWindSpeedClass(
                                                      hourData[level].speed /
                                                          3.6,
                                                  )}"
                                              >
                                                  <div class="wind-speed">
                                                      ${Math.round(
                                                          hourData[level]
                                                              .speed / 3.6,
                                                      )}
                                                      m/s
                                                  </div>
                                                  <div class="wind-direction">
                                                      ${roundToNearestFive(
                                                          hourData[
                                                              level
                                                          ].direction.toFixed(
                                                              0,
                                                          ),
                                                      )}°
                                                      ${getWindArrow(
                                                          roundToNearestFive(
                                                              hourData[level]
                                                                  .direction,
                                                          ),
                                                      )}
                                                  </div>
                                              </td>`
                                            : html`<td class="${cellClass}">
                                                  -
                                              </td>`;
                                    },
                                )}
                            </tr>
                        `;
                    })}
                </tbody>
            </table>
        `;
    };

    if (!data) {
        return html`<div>Loading...</div>`;
    }

    return html`
        <div>
            <style>
                .wind-table {
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .wind-table th,
                .wind-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: center;
                }
                .wind-table th {
                    background-color: #f2f2f2;
                }
                .time-header {
                    min-width: 80px;
                }
                .pressure-cell {
                    text-align: left;
                    font-weight: bold;
                }
                .wind-cell {
                    padding: 4px;
                }
                .wind-speed {
                    font-weight: bold;
                }
                .wind-direction {
                    color: #666;
                }
                .wind-low {
                    background-color: #90ee90;
                }
                .wind-medium {
                    background-color: #ffa500;
                }
                .wind-high {
                    background-color: #ff6347;
                }
                .past-cell {
                    opacity: 0.5;
                }
                .wind-direction {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .wind-direction span {
                    margin-left: 4px;
                    font-size: 14px;
                }
            </style>
            ${renderTable("Tänään", data.todayData)}
            ${renderTable("Huomenna", data.tomorrowData)}
        </div>
    `;
}
