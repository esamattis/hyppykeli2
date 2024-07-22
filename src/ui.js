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
    LATEST_OBSERVATION,
    SAVED_DZs,
    saveCurrentDz,
    removeSavedDz,
} from "./data.js";

import { Graph } from "./graph.js";
import { Compass } from "./compass.js";
import {
    calculateCloudBase,
    dateOffset,
    ErrorBoundary,
    EXAMPLE_CSS,
    formatClock,
    formatDate,
    FromNow,
    Help,
    humanDayText,
    isNullish,
    hasValidWindData,
    removeNullish,
    ResizeRecreate,
    saveTextToFile,
    toMeters,
    whenAll,
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
            <th style="width: 8ch">
            KPK
            <${Help} label="?">
                <p>
                Kastepisteen korkeus.${" "}
                <a href="#" onClick=${(/** @type {any} */ e) => {
                    e.preventDefault();
                    document.getElementById("dewpoint")?.click();
                }}>Lue lisää</a>
                </p>
            </${Help}>
            </th>
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
                <td class=${getWarningLevel(point.gust ?? 0)}>
                    ${point.gust?.toFixed(1) ?? -1} m/s
                </td>
                <td>${point.speed} m/s</td>
                <td>
                    <${WindDirection} direction=${point.direction} />
                </td>

                <td>
                    ${whenAll(
                        [point.temperature, point.dewPoint],
                        (temp, dew) => html`
                            ${calculateCloudBase(temp, dew)}${" "}M
                        `,
                    )}
                </td>

                <td>${point.temperature?.toFixed(1)} °C</td>
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
        <th style="width: 10ch">
            Pilvet L
            <${Help} label="?">
                <p>
                    Matalakerroksen (Low) pilvet jotka sijaitsevat yleensä alle 2 kilometrin (noin 6 500 jalan) korkeudella merenpinnasta.
                </p>
            </${Help}>
        </th>
        <th style="width: 11ch">
            Pilvet ML
            <${Help} label="?">
                <p>
                    Matalan ja keskikerroksen (MiddleAndLow) pilvet jotka sijaitsevat yleensä 2-7 kilometrin (noin 6 500-23 000 jalan) korkeudella merenpinnasta.
                </p>
            </${Help}>
        </th>

        <th style="width: 8ch">
            KPK
            <${Help} label="?">
                <p>
                Kastepisteen korkeus.${" "}
                <a href="#" onClick=${(/** @type {any} */ e) => {
                    e.preventDefault();
                    document.getElementById("dewpoint")?.click();
                }}>Lue lisää</a>
                </p>
            </${Help}>
        </th>

        <th>
            Sade
            <${Help} label="?">
                <p>Sateen todenäköisyys prosentteina.</p>
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
        return html`
            <tr class="forecast-row">
                <td title=${point.time.toString()}>
                    ${formatClock(point.time)}
                </td>
                <td class=${getWarningLevel(point.gust ?? 0)}>
                    ${point.gust} m/s
                </td>
                <td>${point.speed} m/s</td>
                <td>
                    <${WindDirection} direction=${point.direction} />
                </td>
                <td>
                    <${CloudCover} percentage=${point.lowCloudCover} />
                </td>

                <td>
                    <${CloudCover} percentage=${point.middleCloudCover} />
                </td>

                <td>
                    ${whenAll(
                        [point.temperature, point.dewPoint],
                        (temp, dew) => html`
                            ${calculateCloudBase(temp, dew)}${" "}M
                        `,
                    )}
                </td>

                <td>${point.rain?.toFixed(0)}%</td>
                <td>${point.temperature?.toFixed(1)} °C</td>
            </tr>
        `;
    });
}

/**
 * @param {Object} props
 * @param {number} [props.percentage]
 */
function CloudCover(props) {
    if (isNullish(props.percentage)) {
        return null;
    }

    return html`
        <span class="cloud-cover">
            <${PieChart} percentage=${props.percentage} />
            ${props.percentage} %
        </span>
    `;
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
 * @param {number|undefined} props.direction
 * @param {boolean} props.value
 */
function WindDirection(props) {
    if (isNullish(props.direction)) {
        return null;
    }

    return html`
        <span>
            ${props.value !== false
                ? html`
                      <span class="direction-value">
                          ${props.direction.toFixed(0)}°
                      </span>
                  `
                : null}
            <span
                class="direction"
                style=${{
                    "--direction": props.direction - 180 - 90 + "deg",
                    visibility: props.direction !== -1 ? "visible" : "hidden",
                }}
            >
                ➤
            </span>
        </span>
    `;
}

/**
 * @param {Object} props
 * @param {Signal<WeatherData[]>} props.data
 * @param {any} props.Rows
 * @param {any} props.thead
 */
function DataTable(props) {
    const [showAll, setShowAll] = useState(false);
    const data = showAll ? props.data.value : props.data.value.slice(0, 50);
    const showLoadMore = !showAll && props.data.value.length > data.length;

    return html`
        <table class="weather-table">
            <thead>${props.thead}</thead>
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
    const obs = HOVERED_OBSERVATION.value || LATEST_OBSERVATION.value;

    if (!obs) {
        return null;
    }

    if (!hasValidWindData(obs)) {
        return html`
            <p>Ei havaintoja :(</p>
        `;
    }

    return html`
        <p class=${history ? "historic" : ""}>
            Puuska
            <span
                class=${"latest-value latest-gust " +
                getWarningLevel(obs.gust ?? 0)}
            >
                ${" "}${obs.gust?.toFixed(1) ?? "?"} m/s${" "}
            </span>
            Tuuli
            <span class="latest-value latest-wind">
                ${" "}${obs.speed?.toFixed(1) ?? "?"} m/s${" "}
            </span>

            Suunta${" "}
            <span class="latest-value latest-wind">
                ${" "}${obs.direction?.toFixed(0)}°${" "}
            </span>
            ${" "}

            <br />
            <${FromNow} date=${obs.time} />

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
                ? html`
                      Mahdollisesti voimistuva ↗ ${help}
                  `
                : html`
                      Mahdollisesti heikkenevä ↘ ${help}
                  `}
        </div>
    `;
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
    NCD: "Ei pilviä",
    VV: "SUMUA PERKELE",
    NSC: "Yksittäisiä",
    FEW: "Muutamia",
    SCT: "Hajanaisia",
    BKN: "Rakoileva",
    OVC: "Täysi pilvikatto",
};

function LatestClouds() {
    const metar = METARS.value?.at(-1);
    const latest = LATEST_OBSERVATION.value;
    const time = metar?.time ?? latest?.time;

    let msg = "";

    if (metar?.clouds.length === 0) {
        if (metar.metar.includes("CAVOK")) {
            msg = "Ei pilviä alle 1500M (CAVOK)";
        } else {
            msg = "Ei tietoa pilvistä";
        }
    }

    return html`
        <ul>
            ${msg
                ? html`
                      <li>${msg}</li>
                  `
                : metar?.clouds.map(
                      (cloud, i) => html`
                          <li>
                              <a href=${cloud.href}>
                                  ${CLOUD_TYPES[cloud.amount] ?? cloud.amount}
                              </a>
                              ${" "}
                              ${Math.round(
                                  toMeters(cloud.base, cloud.unit) / 10,
                              ) * 10}M
                          </li>
                      `,
                  )}
            ${whenAll(
                [latest?.temperature, latest?.dewPoint],
                (temp, dew) =>
                    html`
                      <li>
                          <span style="margin-top: 5px; font-style: italic; font-size: 90%">
                          Kastepisteen korkeus ${calculateCloudBase(temp, dew)}M
                          </span>

                          <${Help} label="?" id="dewpoint">
                            <p>
                                Arvio mahdollisten pilvien korkeudesta kastepisteen perusteella.
                                Laskettu lämpötilasta ${temp.toFixed(1)}°C ja kastepisteestä ${dew.toFixed(1)}°C
                                pyöristäen lähimpään 100 metriin.
                            </p>

                            <p>
                                Kastepiste on lämpötila jonka alapuolella vesihöyry tiivistyy pisaroiksi muodostaen pilviä.
                                Eli arvio kertoo missä korkeudessa lämpötila laskee kastepisteeseen.
                            </p>

                          </${Help}>
                      </li>
                  `,
            )}
        </ul>

        <p>
            <${FromNow} date=${time} />

            <br />
            ${metar?.metar
                ? html`
                      <em class="metar">${metar.metar}</em>
                  `
                : null}
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
        <small>Tiedot päivitetään automaattisesti minuutin välein.</small>
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

        dzs.sort((a, b) => a.title.localeCompare(b.title));

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
    navigateQs(foo, { replace: true });
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

    navigateQs({ forecast_day: dayDiff.toString() });
}

/**
 * @param {MouseEvent} e
 */
function savePreviousDz(e) {
    if (e.target instanceof HTMLAnchorElement) {
        localStorage.setItem("previous_dz", e.target.textContent?.trim() ?? "");
    }
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

            <a href="/?no_redirect">Etusivulle</a>

            <h2>Ennuste</h2>

            <p>
                ${FORECAST_DAY.value === 0
                    ? html`
                          <a
                              onClick=${asInPageNavigation}
                              href="${getQs({ forecast_day: "1" })}"
                          >
                              Näytä huomisen ennuste
                          </a>
                      `
                    : html`
                          <a
                              onClick=${asInPageNavigation}
                              href="${getQs({ forecast_day: undefined })}"
                          >
                              Näytä tämän päivän ennuste
                          </a>
                      `}
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
            <p>
                <a
                    href="${QUERY_PARAMS.value.high_winds_details
                        ? "#high-winds-details"
                        : "#high-winds-today"}"
                >
                    Ylätuuliennusteet
                </a>
            </p>

            <h2>DZs</h2>

            <h3>Tallennetut</h3>

            <div class="dzs" onClick=${savePreviousDz}>
                ${SAVED_DZs.value.flatMap((dz) => {
                    const name = dz.name;
                    if (!name) {
                        return [];
                    }

                    const qs =
                        "?" + new URLSearchParams(removeNullish(dz)).toString();

                    return html`
                        <p>
                            <a href=${qs}>${name}</a>
                            <button
                                type="button"
                                style="margin-left: 1ch; font-size: 50%"
                                onClick=${() => {
                                    if (
                                        confirm(
                                            "Haluatko varmasti poistaa tallennetun DZ:n?",
                                        )
                                    ) {
                                        // Remove after timeout so the button is still present
                                        // whent the outside click detection is triggered
                                        // or otherwise the menu is unintentionally closed
                                        setTimeout(() => {
                                            removeSavedDz(name);
                                        });
                                    }
                                }}
                            >
                                ╳
                            </button>
                        </p>
                    `;
                })}
            </div>

            <button
                type="button"
                onClick=${() => {
                    saveCurrentDz(prompt("Nimi", NAME.value));
                }}
            >
                Tallenna nykyinen
            </button>

            <h3>Muut</h3>
            <div class="dzs" onClick=${savePreviousDz}>
                ${OTHER_DZs.value.map(
                    (dz) => html`
                        <p><a href=${dz.href}>${dz.title}</a></p>
                    `,
                )}
            </div>

            <h2>Ongelmia?</h2>

            <p>
                Näkyykö tiedot jotenkin väärin? Lataa alla olevasta napista
                datadumpit ja lähetä ne Esalle hyppykeli@esamatti.fi ja kerro
                millä tavalla ne näkyi väärin. Laita kuvakaappaus mukaan myös.
            </p>

            <form onSubmit=${downloadDataDump}>
                <select name="storedQuery">
                    ${Object.keys(RAW_DATA.value).map(
                        (key) => html`
                            <option value=${key}>${key}</option>
                        `,
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
            <p>
                Tee mukautettu näkymä lisäämällä omaa CSS-koodia. Katso
                esimerkki${" "}
                <a
                    onClick=${asInPageNavigation}
                    href=${getQs({ css: btoa(EXAMPLE_CSS) })}
                >
                    tästä
                </a>
            </p>
            <${CSSEditor} />

            <!-- prettier-ignore -->
            <p>
                Tietoja palvelusta: Katso <a href="/?no_redirect=1">etusivu</a>.
            </p>
        </div>
    `;
}

/**
 * @param {Object} e
 * @param {HTMLFormElement} e.target
 * @param {()=>void} e.preventDefault
 */
function handleCSSEditorSubmit(e) {
    e.preventDefault();
    const css = new FormData(e.target).get("css")?.toString() ?? "";
    navigateQs({ css: btoa(css) });
}

function CSSEditor() {
    // prettier-ignore
    return html`
        <form class="css-editor" onSubmit=${handleCSSEditorSubmit}>
            <textarea name="css">${atob(QUERY_PARAMS.value.css || "")}</textarea>
            <button type="submit">Submit</button>
        </form>
    `;
}

function RenderInjectedCSS() {
    const css = QUERY_PARAMS.value.css;

    if (!css) {
        return null;
    }

    return html`
        <style dangerouslySetInnerHTML=${{ __html: atob(css) }}></style>
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
    const latestGust = LATEST_OBSERVATION.value?.gust ?? 0;
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
        >
            ${FORECAST_LOCATION_NAME.value}
        </a>
        . ${" "}
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

function Info() {
    const metar = METARS.value?.[0];

    return html`
        <div id="info">
            ${STATION_NAME.value
                ? html`
                      Havaintotiedot haettu havaintoasemalta${" "}
                      <a
                          href="https://www.google.fi/maps/place/${STATION_COORDINATES.value}"
                      >
                          ${STATION_NAME}
                      </a>
                      .${" "}
                  `
                : null}
            <${ForecastLocationInfo} />
            ${metar?.elevation !== undefined
                ? html`
                      ${" "}Lentokentän korkeus meren pinnasta${" "}
                      ${metar.elevation.toFixed(0)}M. ${" "}
                  `
                : null}
            ${QUERY_PARAMS.value.flyk_metar
                ? html`
                      METAR-sanomat tarjoaa ${" "}
                      <a href="https://flyk.com">flyk.com</a>
                      ${" "}
                  `
                : null}

            <div class="disclaimer">
                ${" "}Tietojen käyttö omalla vastuulla. Ei takeita että tiedot
                ovat oikein.
            </div>
        </div>
    `;
}

export function Root() {
    return html`
        <div class="content grid">
            ${
                ERRORS.value.length > 0
                    ? html`
                          <div id="errors" class="errors">
                              ${ERRORS.value.map((error) => {
                                  return html`
                                      <p>${error}</p>
                                  `;
                              })}
                          </div>
                      `
                    : null
            }

            <h1 id="title">
                <span id="title">${NAME}</span>
            </h1>


            <${Info}/>

            <div class="clouds" id="clouds">
                <h2 class="h2-with-icon">
                    Pilvet
                    <${Anvil} />
                </h2>

                <${LatestClouds} />
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

            <${ResizeRecreate}>
                ${
                    /* Graph.js does not resize correctly when the window is resized.
                    Force full recreation of the component when the window is resized. */ null
                }
                <${Graph} />
            </${ResizeRecreate}>

            <div id="observations-table" class="observations">
                <h2 class="sticky">
                    Havainnot
                    <span class="date"> ${formatDate(new Date())} </span>
                </h2>
                <div class="side-scroll">
                    <${DataTable}
                        data=${OBSERVATIONS}
                        thead=${html`
                            <${ObservationTHead} />
                        `}
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
                        thead=${html`
                            <${ForecastTHead} />
                        `}
                        Rows=${ForecastRows}
                    />
                </div>
            </div>

            <${HighWinds} />
        </div>
        <${SideMenu} />
        <${StickyFooter} />

        <${RenderInjectedCSS} />

    `;
}
