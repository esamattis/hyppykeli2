// @ts-check
import { render } from "preact";
import { html, useCallback, useEffect, useState } from "htm/preact";
import { FORECASTS, OBSERVATIONS, NAME, LATLONG } from "./data.js";

import { Graph } from "./graph.js";

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

/**
 * @param {Object} props
 * @param {Signal<WeatherData[]>} props.data
 */
function Rows(props) {
    return props.data.value.map((point) => {
        // const clock24 = point.time.toLocaleTimeString([], {
        //     hour: "2-digit",
        //     minute: "2-digit",
        //     hour12: false,
        // });

        return html`<tr>
            <td class=${getWarningLevel(point.gust)}>${point.gust} m/s</td>
            <td>${point.speed} m/s</td>
            <td>
                <span class="direction-value">${point.direction}°</span>
                <span
                    class="direction"
                    style=${{ "--direction": point.direction + "deg" }}
                    >↑</span
                >
            </td>
            <td title=${point.time.toString()}>
                ${point.time.toLocaleTimeString()}
            </td>
        </tr> `;
    });
}

/**
 * @param {Object} props
 * @param {Signal<WeatherData[]>} props.data
 */
function DataTable(props) {
    return html`
        <table class="weather-table">
            <thead>
                <tr>
                    <th>Puuska</th>
                    <th>Tuuli</th>
                    <th>Suunta</th>
                    <th>Aika</th>
                </tr>
            </thead>
            <tbody>
                <${Rows} data=${props.data} />
            </tbody>
        </table>
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
        const interval = setInterval(() => {
            setState(setter());
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [setter]);

    return state;
}

function Latest() {
    const latest = OBSERVATIONS.value[0];
    const createFromNow = useCallback(() => {
        if (!latest) {
            return "";
        }

        return new Intl.RelativeTimeFormat("fi").format(
            Math.round(-(Date.now() - latest.time.getTime()) / 1000 / 60),
            "minutes",
        );
    }, [latest]);

    const fromNow = useInterval(createFromNow);

    if (!latest) {
        return html`<p>Ladataan...</p>`;
    }

    return html`
        <p>
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
            ${fromNow}
        </p>
    `;
}

function Root() {
    return html`
        <div>
            <div class="content">
                <h1 id="#top">
                    <a class="logo" href="/"> Hyppykeli</a> –${" "}
                    <span id="title">${NAME}</span>
                </h1>

                <a href="https://www.google.fi/maps/place/${LATLONG}"
                    >Katso havaintoaseman sijainti</a
                >

                <p>
                    Tietojen käyttö omalla vastuulla. Ei takeita että tiedot
                    ovat oikein.
                </p>

                <h2 id="latest">Viimeisimmät havainnot</h2>

                <${Latest} />

                <${Graph} />

                <h2 id="observations">Havainnot</h2>
                <${DataTable} data=${OBSERVATIONS} />

                <h2 id="forecasts">Ennuste</h2>
                <${DataTable} data=${FORECASTS} />
            </div>

            <div class="sticky-footer">
                <a href="#top">⬆️</a>
                <span class="ball">ᐧ</span>
                <a href="#observation-graph">Havainnot 📈</a>
                <span class="ball">ᐧ</span>
                <a href="#forecast-graph">Ennuste 📈</a>
                <span class="ball">ᐧ</span>
                <a href="#observations">Havainnot 🧾</a>
                <span class="ball">ᐧ</span>
                <a href="#forecasts">Ennuste 🧾</a>
            </div>
        </div>
    `;
}

const root = document.getElementById("root");
if (!root) {
    throw new Error("Root element not found");
}
render(html`<${Root} />`, root);
