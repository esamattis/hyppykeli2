// @ts-check
import { effect, signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { html } from "htm/preact";
import { clearOMCache, OpenMeteoTool, OpenMeteoRaw } from "./om.js";
import {
    FORECASTS,
    OBSERVATIONS,
    NAME,
    STATION_COORDINATES,
    FORECAST_COORDINATES,
    METARS,
    STATION_NAME,
    ERRORS,
    HOVERED_OBSERVATION,
    updateWeatherData,
    LOADING,
    addError,
    RAW_DATA,
    FORECAST_DAY,
    FORECAST_DATE,
    STALE_FORECASTS,
    GUST_TREND,
    FORECAST_LOCATION_NAME,
    QUERY_PARAMS,
    navigateQs,
    getQs,
} from "./data.js";

import { Graph } from "./graph.js";
import { Compass, FullScreenCompass } from "./compass.js";
import {
    dateOffset,
    ErrorBoundary,
    formatClock,
    formatDate,
    FromNow,
    Help,
    humanDayText,
    saveTextToFile,
} from "./utils.js";

effect(() => {
    document.title = NAME.value + " – Hyppykeli";
});

/**
 * @param {number} gust
 * @returns {"ok" | "warning" | "danger"}
 */
function getWarningLevel(gust) {
    /** @type {"ok" | "warning" | "danger"} */
    let className = "ok";

    if (gust >= 8) {
        className = "warning";
    }

    if (gust >= 11) {
        className = "danger";
    }

    return className;
}

function ObservationTHead() {
    return html`
        <tr>
            <th>Kello</th>
            <th>Puuska</th>
            <th>Tuuli</th>
            <th>Suunta</th>
            <th>Lämpötila</th>
        </tr>
    `;
}

/**
 * @param {Object} props
 * @param {WeatherData[]} props.data
 */
function ObservationRows(props) {
    return props.data.map((point) => {
        return html`
            <tr>
                <td title=${point.time.toString()}>
                    ${formatClock(point.time)}
                </td>
                <td class=${getWarningLevel(point.gust)}>${point.gust} m/s</td>
                <td>${point.speed} m/s</td>
                <td>
                    <${WindDirection} direction=${point.direction} />
                </td>
                <td>${point.temperature.toFixed(1)} °C</td>
            </tr>
        `;
    });
}

function ForecastTHead() {
    return html`<tr>
        <th>Kello</th>
        <th>Puuska</th>
        <th>Tuuli</th>
        <th>Suunta</th>
        <th>
            Pilvet
            <${Help} label="(L)">
                <p>
                    Matalakerroksen (Low) pilvet jotka sijaitsevat yleensä alle 2 kilometrin (noin 6 500 jalan) korkeudella merenpinnasta.
                </p>
            </${Help}>
        </th>
        <th>
            Pilvet
            <${Help} label="(ML)">
                <p>
                    Matalan ja keskikerroksen (MiddleAndLow) pilvet jotka sijaitsevat yleensä 2-7 kilometrin (noin 6 500-23 000 jalan) korkeudella merenpinnasta.
                </p>
            </${Help}>
        </th>
        <th>
            Sade t.
            <${Help} label="?">
            Sateen todenäköisyys prosentteina.
            </${Help}>
        </th>
        <th>Lämpötila</th>

    </tr>`;
}

/**
 * @param {Object} props
 * @param {WeatherData[]} props.data
 */
function ForecastRows(props) {
    return props.data.map((point) => {
        return html`<tr class="forecast-row">
            <td title=${point.time.toString()}>${formatClock(point.time)}</td>
            <td class=${getWarningLevel(point.gust)}>${point.gust} m/s</td>
            <td>${point.speed} m/s</td>
            <td>
                <${WindDirection} direction=${point.direction} />
            </td>
            <td>
                <${PieChart} percentage=${point.lowCloudCover ?? 0} />
                ${point.lowCloudCover?.toFixed(0) ?? "-1"}%
            </td>
            <td>
                <${PieChart} percentage=${point.middleCloudCover ?? 0} />
                ${point.middleCloudCover?.toFixed(0) ?? "-1"}%
            </td>
            <td>${point.rain?.toFixed(0)}%</td>
            <td>${point.temperature?.toFixed(1)} °C</td>
        </tr> `;
    });
}

/**
 * @param {Object} props
 * @param {number} props.percentage
 */
function PieChart({ percentage }) {
    const adjustedPercentage = Math.min(100, Math.max(0, percentage));
    const angle = (adjustedPercentage / 100) * 360;
    const largeArcFlag = angle > 180 ? 1 : 0;
    const endX = 50 + 50 * Math.cos(((angle - 90) * Math.PI) / 180);
    const endY = 50 + 50 * Math.sin(((angle - 90) * Math.PI) / 180);

    return html`
        <svg class="pie" width="20" height="20" viewBox="0 0 100 100">
            <circle
                cx="50"
                cy="50"
                r="50"
                fill=${percentage >= 100 ? "black" : "white"}
                stroke="black"
                stroke-width="1"
            />
            <path
                d=${`M 50 50 L 50 0 A 50 50 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                fill="black"
            />
        </svg>
    `;
}

/**
 *
 * @param {Object} props
 * @param {number} props.direction
 * @param {boolean} props.value
 */
function WindDirection(props) {
    return html`
        <span>
            ${props.value !== false
                ? html`<span class="direction-value">
                      ${props.direction.toFixed(0)}°
                  </span>`
                : null}
            <span
                class="direction"
                style=${{ "--direction": props.direction - 180 + "deg" }}
                >↑</span
            >
        </span>
    `;
}

/**
 * @param {Object} props
 * @param {Signal<unknown[]>} props.data
 * @param {any} props.Rows
 * @param {any} props.thead
 */
function DataTable(props) {
    const [showAll, setShowAll] = useState(false);
    const data = showAll ? props.data.value : props.data.value.slice(0, 50);
    const showLoadMore = !showAll && props.data.value.length > data.length;

    return html`
        <table class="weather-table">
            <thead>
                ${props.thead}
            </thead>
            <tbody>
                <${props.Rows} data=${data} />
            </tbody>
        </table>
        ${showLoadMore
            ? html`
                  <div class="show-more">
                      <button type="button" onClick=${() => setShowAll(true)}>
                          Näytä kaikki (${props.data.value.length})
                      </button>
                  </div>
              `
            : null}
    `;
}

function LatestWind() {
    const history = !!HOVERED_OBSERVATION.value;
    const latest = HOVERED_OBSERVATION.value || OBSERVATIONS.value[0];
    if (!latest) {
        return html`<p>Ladataan tuulitietoja...</p>`;
    }

    return html`
        <p class=${history ? "historic" : ""}>
            Puuska
            <span
                class=${"latest-value latest-gust " +
                getWarningLevel(latest.gust)}
            >
                ${" "}${latest.gust} m/s${" "}
            </span>
            Tuuli
            <span class="latest-value latest-wind">
                ${" "}${latest.speed} m/s${" "}
            </span>

            Suunta${" "}
            <span class="latest-value latest-wind">
                ${" "}${latest.direction}°${" "}
            </span>
            ${" "}

            <br />
            <${FromNow} date=${latest.time} />

            <br />
            <${GustTrend} />
        </p>
    `;
}

function GustTrend() {
    const trend = GUST_TREND.value;
    if (Math.abs(trend) < 1) {
        return;
    }

    const help = html`<${Help} label="?">Seuraavan tunnin ennustuksien keskiarvon erotuksesta päätelty (${trend.toFixed(1)} m/s).</${Help}>`;

    return html`
        <div title=${`Ero ${trend.toFixed(1)}m/s`}>
            ${trend > 0
                ? html`Mahdollisesti voimistuva ↗ ${help}`
                : html`Mahdollisesti heikkenevä ↘ ${help}`}
        </div>
    `;
}

/**
 * @param {number} hectoMeters
 * @returns {number}
 */
function hectoFeetToMeters(hectoMeters) {
    return hectoMeters * 30.48;
}

// const CLOUDS = {
//     NCD: "Ei pilviä",
//     VV: "SUMUA PERKELE",
//     NSC: "Yksittäisiä",
//     FEW: "Muutamia",
//     SCT: "Hajanaisia",
//     BKN: "Rakoileva",
//     OVC: "Täysi pilvikatto",
// };

/**
 * @type {Record<string, string>}
 */
const CLOUD_TYPES = {
    1: "Muutamia", // Few
    2: "Hajanaisia", // Scattered
    3: "Rikkonainen", // Broken
    4: "Täysi pilvikatto", // Overcast
};

function LatestMetar() {
    const latest = METARS.value?.at(-1);

    if (!latest) {
        return html`<p>Ladataan METAR-sanomaa...</p>`;
    }

    let msg = "";

    if (latest?.clouds.length === 0) {
        if (latest.metar.includes("CAVOK")) {
            msg = "Ei pilviä alle 1500M (CAVOK)";
        } else {
            msg = "Ei tietoa pilvistä";
        }
    }

    return html`
        <ul>
            ${msg
                ? html`<p>${msg}</p>`
                : latest.clouds.map(
                      (cloud, i) =>
                          html`<li>
                              <a href=${cloud.href}
                                  >${CLOUD_TYPES[cloud.amount] ??
                                  cloud.amount}</a
                              >${" "}
                              ${hectoFeetToMeters(cloud.base).toFixed(0)}M
                              ${" "}
                          </li>`,
                  )}
        </ul>

        <p>
            <${FromNow} date=${latest.time} />

            <br />
            <em class="metar">${latest.metar}</em>
        </p>
    `;
}

function UpdateButton() {
    return html`
        <button
            disabled=${LOADING.value > 0}
            onClick=${() => {
                MENU_OPEN.value = false;
                clearOMCache();
                updateWeatherData();
            }}
        >
            Päivitä
        </button>
        <br />
        <small> Tiedot päivitetään automaattisesti minuutin välein. </small>
    `;
}

/**
 * @type {Signal<boolean>}
 */
export const MENU_OPEN = signal(false);

// Close menu when clicking outside of it
document.addEventListener("click", (e) => {
    if (!MENU_OPEN.value) {
        return;
    }

    if (
        e.target instanceof HTMLElement &&
        e.target.closest(".side-menu,.sticky-footer")
    ) {
        return;
    }

    MENU_OPEN.value = false;
});

/**
 * @type {Signal<{title: string, href: string}[]>}
 */
export const OTHER_DZs = signal([]);

// Load DZ list when the menu is opened
effect(() => {
    if (!MENU_OPEN.value) {
        return;
    }

    // load only once
    if (OTHER_DZs.value.length > 0) {
        return;
    }

    fetch("/").then(async (res) => {
        if (!res.ok || res.status !== 200) {
            addError("Virhe haettaessa muita DZ:ta");
            return;
        }

        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const dzs = Array.from(doc.querySelectorAll(".dz-list a")).flatMap(
            (a) => {
                if (!(a instanceof HTMLAnchorElement)) {
                    return [];
                }

                const title = a.textContent;
                const href = a.href;

                if (!title || !href) {
                    return [];
                }

                const url = new URL(href);

                return { title, href: `${url.pathname}${url.search}` };
            },
        );

        OTHER_DZs.value = dzs;
    });
});

/**
 * @param {SubmitEvent} e
 */
function downloadDataDump(e) {
    e.preventDefault();
    let mode = "download";
    if (e.submitter instanceof HTMLButtonElement) {
        mode = e.submitter.value;
    }

    if (!(e.target instanceof HTMLFormElement)) {
        return;
    }

    const formData = new FormData(e.target);

    const storedQuery = /** @type {StoredQuery | null} */ (
        formData.get("storedQuery")?.toString() ?? null
    );

    if (!storedQuery) {
        return;
    }

    const raw = RAW_DATA.value[storedQuery];

    if (!raw) {
        return;
    }

    const date = new Date().toISOString().split("T")[0]?.replaceAll("-", "");
    const clock = formatClock(new Date()).replace(":", "");

    const name = storedQuery.replaceAll("::", "_");
    const filename = `hyppykeli_${date}-${clock}_${name}.xml`;

    if (mode === "download") {
        saveTextToFile(filename, raw);
    } else {
        const file = new File([raw], filename, {
            type: "application/xml",
        });

        /**
         * @type {ShareData}
         */
        const share = {
            title: "Hyppykeli datadump " + storedQuery,
            text: `Hyppykeli datadump ${storedQuery} ${date} ${clock}`,
            files: [file],
        };

        if (navigator.canShare(share)) {
            alert("Jakaminen ei ole tuettu tässä selaimessa.");
        } else {
            navigator.share(share);
        }
    }
}

/**
 * Navigate to a link without reloading the while updating the QUERY_PARAMS signal
 *
 * @param {MouseEvent} e
 */
function asInPageNavigation(e) {
    if (!(e.target instanceof HTMLAnchorElement)) {
        return;
    }

    if (e.target.target === "_blank") {
        return;
    }

    if (e.metaKey || e.ctrlKey) {
        return;
    }

    if (e.button !== 0) {
        return;
    }

    e.preventDefault();

    const target = new URL(e.target.href);
    const foo = Object.fromEntries(target.searchParams);
    navigateQs(foo, "replace");
}

/**
 * @param {Event} e
 */
function handleForecastDayChange(e) {
    if (!(e.target instanceof HTMLInputElement)) {
        return;
    }

    const value = new Date(e.target.value);
    const dayDiff =
        Math.floor(
            (value.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

    navigateQs({ forecast_day: dayDiff.toString() }, "merge");
}

export function SideMenu() {
    /**
     * @param {MouseEvent} e
     */
    const closeMenuOnLinkClick = (e) => {
        if (!(e.target instanceof HTMLElement)) {
            return;
        }

        if (e.target instanceof HTMLAnchorElement || e.target?.closest("a")) {
            MENU_OPEN.value = false;
        }
    };

    return html`
        <div
            class="${MENU_OPEN.value ? "side-menu open" : "side-menu"}"
            onClick=${closeMenuOnLinkClick}
        >
            <h1>${NAME.value}</h1>
            <h2>Ennuste</h2>

            <p>
                ${FORECAST_DAY.value === 0
                    ? html`<a
                          onClick=${asInPageNavigation}
                          href="${getQs({ forecast_day: "1" })}"
                          >Näytä huomisen ennuste</a
                      >`
                    : html`<a
                          onClick=${asInPageNavigation}
                          href="${getQs({ forecast_day: undefined })}"
                          >Näytä tämän päivän ennuste</a
                      >`}
            </p>

            <form>
                Hae ennuste päivälle:${" "}
                <input
                    type="date"
                    name="forecast_date"
                    min=${new Date().toISOString().split("T")[0]}
                    max=${dateOffset(9).toISOString().split("T")[0]}
                    onInput=${handleForecastDayChange}
                    value=${FORECAST_DATE.value.toISOString().split("T")[0]}
                />
            </form>

            <h2>Päivitä sisältö</h2>

            <p>
                <${UpdateButton} />
            </p>

            <h2>Osiot</h2>

            <p><a href="#observations-graph">Havainnot 📈</a></p>
            <p><a href="#forecasts-graph">Ennusteet 📈</a></p>
            <p><a href="#observations-table">Havainnot 🧾</a></p>
            <p><a href="#forecasts-table">Ennusteet 🧾</a></p>
            <p><a href="#high-winds">Ylätuuliennusteet</a></p>

            <h2>DZs</h2>
            ${OTHER_DZs.value.map(
                (dz) => html`<p><a href=${dz.href}>${dz.title}</a></p>`,
            )}

            <h2>Ongelmia?</h2>

            <p>
                Näkyykö tiedot jotenkin väärin? Lataa alla olevasta napista
                datadumpit ja lähetä ne Esalle hyppykeli@esamatti.fi ja kerro
                millä tavalla ne näkyi väärin. Laita kuvakaappaus mukaan myös.
            </p>

            <form onSubmit=${downloadDataDump}>
                <select name="storedQuery">
                    ${Object.keys(RAW_DATA.value).map(
                        (key) => html` <option value=${key}>${key}</option> `,
                    )}
                </select>
                <button type="submit" name="mode" value="download">
                    Lataa
                </button>
                <button
                    class=${
                        // @ts-ignore
                        navigator.share ? "" : "hide"
                    }
                    type="submit"
                    name="mode"
                    value="share"
                >
                    Jaa
                </button>
            </form>

            <h2>Muokkaa näkymää</h2>
            <p class="disclaimer">
                Lisää omaa CSS:ää sivulle. Tämä on kokeellinen ominaisuus ja
                saattaa rikkoa sivun ulkoasun.
            </p>
            <${CSSEditor} />
        </div>
    `;
}

function CSSEditor() {
    return html`<form class="css-editor">
        ${Object.entries(QUERY_PARAMS.value).map(
            ([key, value]) => html`
                <input type="hidden" name=${key} value=${value} />
            `,
        )}

        <textarea name="css">
            ${QUERY_PARAMS.value.css || ""}
        </textarea
        >

        <button type="submit">Submit</button>
    </form>`;
}

export function StickyFooter() {
    return html`
        <div class="sticky-footer">
            <a class="item" href="#top">
                <div class="wrap">
                    <div class="icon">⬆️</div>
                </div>
            </a>

            <a class="item" href="#observations-graph">
                <div class="wrap">
                    <div class="icon">📈</div>
                    <div class="text">Kaaviot</div>
                </div>
            </a>

            <a class="item" href="#observations-table">
                <div class="wrap">
                    <div class="icon">🧾</div>
                    <div class="text">Taulukot</div>
                </div>
            </a>

            <a
                class="item"
                href="${QUERY_PARAMS.value.high_winds_details
                    ? "#high-winds-details"
                    : "#high-winds-today"}"
            >
                <div class="wrap">
                    <div class="icon">💨</div>
                    <div class="text">Ylätuulet</div>
                </div>
            </a>

            <button
                class="menu-burger"
                type="button"
                onClick=${() => {
                    MENU_OPEN.value = !MENU_OPEN.value;
                }}
            >
                ☰
            </button>
        </div>
    `;
}

function Anvil() {
    const cb = METARS.value?.at(-1)?.metar?.includes("//////CB");
    if (!cb) {
        return;
    }

    return html`
        <img
            class="anvil"
            alt="Ukkospilvi"
            title="Ukkospilvi"
            src="/assets/anvil.svg"
        />
    `;
}

function Parachute() {
    const latestGust = OBSERVATIONS.value?.[0]?.gust ?? 0;
    const level = getWarningLevel(latestGust);

    let animation = "";
    if (level === "warning") {
        animation = "swing";
    } else if (level === "danger") {
        animation = "rotate";
    }

    return html`
        <span class="scale">
            <img
                src="/assets/parachute.svg"
                class="icon-parachute ${animation}"
            />
        </span>
    `;
}

function ForecastLocationInfo() {
    return html`
        Ennuste on tehty alueelle${" "}
        <a
            href="https://www.google.fi/maps/place/${FORECAST_COORDINATES.value ||
            STATION_COORDINATES.value}"
            >${FORECAST_LOCATION_NAME.value}</a
        >.
    `;
}

function HighWinds() {
    const showDetails = Boolean(QUERY_PARAMS.value.high_winds_details);

    if (showDetails) {
        return html`
            <div id="high-winds-details" class="side-scroll">
                <h2>ECMWF Ylätuuliennusteet</h2>

                <p>
                    <a
                        onClick=${asInPageNavigation}
                        href="${getQs({ high_winds_details: undefined })}"
                    >
                        Näytä kooste
                    </a>
                </p>

                <${OpenMeteoRaw} />
            </div>
        `;
    }

    return html`
        <div id="high-winds-today" class="side-scroll">
            <h2>ECMWF Ylätuuliennusteet</h2>

            <p>
                Lähde <a href="https://open-meteo.com/">Open-Meteo</a> API.${" "}
                <a
                    onClick=${asInPageNavigation}
                    href="${getQs({ high_winds_details: "1" })}"
                >
                    Näytä tarkat tiedot
                </a>
            </p>

            <${ErrorBoundary}>
                <${OpenMeteoTool} />
            </${ErrorBoundary}>
        </div>

        <div id="high-winds-tomorrow" class="side-scroll">
                <${ErrorBoundary}>
                    <${OpenMeteoTool} tomorrow />
                </${ErrorBoundary}>
        </div>
    `;
}

export function Root() {
    const latestMetar = METARS.value?.[0];
    const isCompassView = window.location.hash === "#compass";

    if (isCompassView) {
        return html`<${FullScreenCompass} />`;
    }

    return html`
        <div class="content grid">
            ${ERRORS.value.length > 0
                ? html`
                      <div class="errors">
                          ${ERRORS.value.map((error) => {
                              return html` <p>${error}</p> `;
                          })}
                      </div>
                  `
                : null}

            <h1 id="title">
                <span id="title">${NAME}</span>
            </h1>

            <div id="info">
                ${STATION_NAME.value
                    ? html`
                          Tiedot haettu havaintoasemalta${" "}
                          <a
                              href="https://www.google.fi/maps/place/${STATION_COORDINATES.value}"
                              >${STATION_NAME}</a
                          >.${" "}

                          <${ForecastLocationInfo} />
                      `
                    : "Ladataan..."}
                ${latestMetar
                    ? html`
                          ${" "}Lentokentän korkeus meren pinnasta${" "}
                          ${latestMetar.elevation.toFixed(0)}M. ${" "}
                      `
                    : null}
                <span class="disclaimer">
                    Tietojen käyttö omalla vastuulla. Ei takeita että tiedot
                    ovat oikein.
                </span>
            </div>

            <div class="clouds" id="clouds">
                <h2 class="h2-with-icon">
                    Pilvet
                    <${Anvil} />
                </h2>

                <${LatestMetar} />
            </div>

            <div id="winds">
                <h2 class="h2-with-icon">
                    Tuulet
                    <div style="width: 1ch"></div>
                    <${Parachute} />
                </h2>
                <${LatestWind} />
            </div>

            <${Compass} />

            <${Graph} />

            <div id="observations-table" class="observations">
                <h2 class="sticky">
                    Havainnot
                    <span class="date"> ${formatDate(new Date())} </span>
                </h2>
                <div class="side-scroll">
                    <${DataTable}
                        data=${OBSERVATIONS}
                        thead=${html`<${ObservationTHead} />`}
                        Rows=${ObservationRows}
                    />
                </div>
            </div>

            <div
                id="forecasts-table"
                class=${STALE_FORECASTS.value ? "stale" : "fresh"}
            >
                <div class="anchor" id="forecasts"></div>
                <h2 class="sticky">
                    Ennuste
                    <span class="date">
                        ${formatDate(FORECAST_DATE.value)} ${" "}
                        ${humanDayText(FORECAST_DATE.value)}
                    </span>
                </h2>

                <p>
                    <${ForecastLocationInfo} />
                </p>

                <div class="side-scroll">
                    <${DataTable}
                        data=${FORECASTS}
                        thead=${html`<${ForecastTHead} />`}
                        Rows=${ForecastRows}
                    />
                </div>
            </div>

            <${HighWinds} />
        </div>
        <${SideMenu} />
        <${StickyFooter} />

        ${QUERY_PARAMS.value.css
            ? html`<style
                  dangerouslySetInnerHTML=${{
                      __html: QUERY_PARAMS.value.css,
                  }}
              ></style>`
            : null}
    `;
}
