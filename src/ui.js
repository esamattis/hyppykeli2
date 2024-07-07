// @ts-check
import { effect, signal } from "@preact/signals";
import { useCallback, useEffect, useState } from "preact/hooks";
import { html } from "htm/preact";
import {
    FORECASTS,
    OBSERVATIONS,
    NAME,
    LATLONG,
    METARS,
    STATION_NAME,
    ERRORS,
    HOVERED_OBSERVATION,
    updateWeatherData,
    LOADING,
    addError,
    RAW_DATA,
} from "./data.js";

import { Graph } from "./graph.js";
import { Compass } from "./compass.js";
import { formatClock, saveTextToFile } from "./utils.js";

effect(() => {
    document.title = NAME.value + " – Hyppykeli";
});

/**
 * @typedef {import('./data.js').WeatherData} WeatherData
 */

/**
 * @typedef {import('@preact/signals').Signal<T>} Signal<T>
 * @template {any} T
 */

/**
 * @param {number} gust
 */
function getWarningLevel(gust) {
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
        <th>Pilvikatto</th>
    </tr>`;
}

/**
 * @param {Object} props
 * @param {WeatherData[]} props.data
 */
function ForecastRows(props) {
    return props.data.map((point) => {
        return html`<tr>
            <td title=${point.time.toString()}>${formatClock(point.time)}</td>
            <td class=${getWarningLevel(point.gust)}>${point.gust} m/s</td>
            <td>${point.speed} m/s</td>
            <td>
                <${WindDirection} direction=${point.direction} />
            </td>
            <td>${point.cloudCover?.toFixed(0) ?? "-1"}%</td>
        </tr> `;
    });
}

/**
 *
 * @param {Object} props
 * @param {number} props.direction
 */
function WindDirection(props) {
    return html`
        <span>
            <span class="direction-value">${props.direction.toFixed(0)}°</span>
            <span
                class="direction"
                style=${{ "--direction": props.direction + "deg" }}
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

/**
 * Set value returned by the setter function to the state every second.
 *
 * @param {() => T} setter
 * @template {any} T
 * @returns {T}
 */
function useInterval(setter) {
    const [state, setState] = useState(/** @type {T} */ (setter()));
    useEffect(() => {
        setState(setter());
        const interval = setInterval(() => {
            setState(setter());
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [setter]);

    return state;
}

/**
 * @param {Object} props
 * @param {Date} [props.date]
 */
function FromNow(props) {
    const createFromNow = useCallback(() => {
        if (!props.date) {
            return "";
        }

        return new Intl.RelativeTimeFormat("fi").format(
            Math.round(-(Date.now() - props.date.getTime()) / 1000 / 60),
            "minutes",
        );
    }, [props.date]);

    const fromNow = useInterval(createFromNow);

    return html`<span class="from-now">${fromNow}</span> `;
}

function LatestGust() {
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
            <span class="latest-value latest-wind"
                >${" "}${latest.speed} m/s${" "}</span
            >
            <${FromNow} date=${latest.time} />
        </p>
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
        if (latest.metar.includes("METAR")) {
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
                updateWeatherData();
            }}
        >
            ♻
        </button>
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

// Load DZ lis when the menu is opened
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

    const storedQuery = /** @type {import("./data.js").StoredQuery | null} */ (
        formData.get("storedQuery")?.toString() ?? null
    );

    if (!storedQuery) {
        return;
    }

    const raw = RAW_DATA.value[storedQuery];

    if (!raw) {
        return;
    }

    if (mode === "download") {
        const name = storedQuery.replaceAll("::", "_");
        const date = new Date()
            .toISOString()
            .split("T")[0]
            ?.replaceAll("-", "");
        const clock = formatClock(new Date()).replace(":", "");
        saveTextToFile(`hyppykeli_${date}-${clock}_${name}.xml`, raw);
    } else {
        navigator.share({
            title: "Hyppykeli",
            text: "Hyppykeli",
            url: `data:text/xml,${encodeURIComponent(raw)}`,
        });
    }
}

export function SideMenu() {
    return html`
        <div class="${MENU_OPEN.value ? "side-menu open" : "side-menu"}">
            <${UpdateButton} />

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
        </div>
    `;
}

export function StickyFooter() {
    return html`
        <div class="sticky-footer">
            <a class="item" href="#top">
                <div class="wrap">
                    <div class="icon">⬆️</div>
                </div>
            </a>

            <a class="item" href="#observation-graph">
                <div class="wrap">
                    <div class="icon">📈</div>
                    <div class="text">Havainnot</div>
                </div>
            </a>

            <a class="item" href="#forecast-graph">
                <div class="wrap">
                    <div class="icon">📈</div>
                    <div class="text">Ennuste</div>
                </div>
            </a>

            <a class="item" href="#observations">
                <div class="wrap">
                    <div class="icon">🧾</div>
                    <div class="text">Havainnot</div>
                </div>
            </a>

            <a class="item" href="#forecasts">
                <div class="wrap">
                    <div class="icon">🧾</div>
                    <div class="text">Ennuste</div>
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

export function Root() {
    const history = !!HOVERED_OBSERVATION.value;
    const latestMetar = METARS.value?.[0];
    return html`
        <div>
            <div class="content">
                ${ERRORS.value.length > 0
                    ? html`
                          <div class="errors">
                              ${ERRORS.value.map((error) => {
                                  return html` <p>${error}</p> `;
                              })}
                          </div>
                      `
                    : null}

                <h1 id="#top">
                    <a class="logo" href="/"> Hyppykeli</a> –${" "}
                    <span id="title">${NAME}</span>
                </h1>

                <p>
                    ${STATION_NAME.value
                        ? html`
                              Katso havaintoaseman${" "}
                              <a
                                  href="https://www.google.fi/maps/place/${LATLONG}"
                                  >${STATION_NAME} sijainti</a
                              >.
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
                </p>

                <div class="as-rows-on-big-screen">
                    <div>
                        <h2>Pilvet</h2>
                        <${LatestMetar} />
                    </div>
                    <div>
                        <div class="anchor" id="latest"></div>
                        <h2>Tuulet</h2>

                        <${Compass} />

                        <${LatestGust} />
                    </div>
                </div>

                <${Graph} />

                <div class="as-rows-on-big-screen">
                    <div>
                        <div class="anchor" id="observations"></div>
                        <h2 class="sticky">Havainnot</h2>
                        <${DataTable}
                            data=${OBSERVATIONS}
                            thead=${html`<${ObservationTHead} />`}
                            Rows=${ObservationRows}
                        />
                    </div>

                    <div>
                        <div class="anchor" id="forecasts"></div>
                        <h2 class="sticky">Ennuste</h2>
                        <${DataTable}
                            data=${FORECASTS}
                            thead=${html`<${ForecastTHead} />`}
                            Rows=${ForecastRows}
                        />
                    </div>
                </div>
            </div>

            <${SideMenu} />
            <${StickyFooter} />
        </div>
    `;
}
