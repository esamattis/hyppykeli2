import { render, html, signal } from "preact";

const NAME = signal("Loading...");
const OBSERVATIONS = signal([]);
const FORECASTS = signal([]);
const LATLONG = signal(null);

const url = new URL(location.href);
const fmisid = url.searchParams.get("fmisid");

const OBSERVATION_PARAMETERS = [
    "winddirection",
    "windspeedms",
    "windgust",
    "n_man",
];

const FORECAST_PAREMETERS = [
    "winddirection",
    "windspeedms",
    "windgust",
    "maximumwind",
];

export const getStartTime = () => {
    const date = new Date();
    date.setHours(date.getHours() - 4, 0, 0, 0);
    return date.toISOString();
};

export async function fmiRequest(options) {
    const url = new URL(`https://opendata.fmi.fi/wfs?request=getFeature`);
    url.searchParams.set("storedquery_id", options.storedQuery);
    for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, v);
    }

    console.log("FMI request", url.toString());

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const parser = new DOMParser();
        const data = parser.parseFromString(text, "application/xml");
        console.log("FMI request completed", url);
        return data;
    } catch (error) {
        console.error("FMI request failed", error);
        throw error;
    }
}

function xpath(doc, path) {
    return doc.evaluate(
        path,
        doc,
        function (prefix) {
            switch (prefix) {
                case "wml2":
                    return "http://www.opengis.net/waterml/2.0";
                case "gml":
                    return "http://www.opengis.net/gml/3.2";
                default:
                    return null;
            }
        },
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
    ).singleNodeValue;
}

function pointsToTimeSeries(node) {
    console.log("pointsToTimeSeries", node);
    return Array.from(node.querySelectorAll("point")).map((point) => {
        return {
            value: Number(point.querySelector("value").innerHTML),
            time: new Date(point.querySelector("time").innerHTML),
        };
    });
}

function parseTimeSeries(doc, id) {
    const node = xpath(doc, `//wml2:MeasurementTimeseries[@gml:id="${id}"]`);
    return pointsToTimeSeries(node).reverse();
}

function Rows(props) {
    return props.data.value.map((point) => {
        let className = "ok";

        if (point.gust >= 8) {
            className = "warning";
        }

        if (point.gust >= 11) {
            className = "danger";
        }

        // const clock24 = point.time.toLocaleTimeString([], {
        //     hour: "2-digit",
        //     minute: "2-digit",
        //     hour12: false,
        // });

        return html`<tr>
            <td class=${className}>${point.gust} m/s</td>
            <td>${point.direction}°</td>
            <td>
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

function DataTable(props) {
    return html`
        <table>
            <thead>
                <tr>
                    <th>Puuska</th>
                    <th>Suunta</th>
                    <th></th>
                    <th>time</th>
                </tr>
            </thead>
            <tbody>
                <${Rows} data=${props.data} />
            </tbody>
        </table>
    `;
}

function Root() {
    return html`
        <div>
            <h1>
                <a class="logo" href="/"> Hyppykeli</a> –${" "}
                <span id="title">${NAME}</span>
            </h1>

            <a href="https://www.google.fi/maps/place/${LATLONG}"
                >Sääaseman sijainti</a
            >

            <p>
                Tietojen käyttö omalla vastuulla. Ei takeita että tiedot ovat
                oikein.
            </p>

            <h2 id="observations">Havainnot</h2>
            <${DataTable} data=${OBSERVATIONS} />

            <h2 id="forecasts">Ennuste</h2>
            <${DataTable} data=${FORECASTS} />

            <div class="sticky-footer">
                <a href="#observations">Havainnot</a>
                ᐧ
                <a href="#forecasts">Ennuste</a>
            </div>
        </div>
    `;
}

const root = document.getElementById("root");
render(html`<${Root} />`, root);

async function updateWeatherData() {
    const doc = await fmiRequest({
        storedQuery: "fmi::observations::weather::timevaluepair",
        params: {
            starttime: getStartTime(),
            // endtime: moment().toISOString(),
            parameters: OBSERVATION_PARAMETERS.join(","),
            fmisid,
        },
    });

    // <gml:name codeSpace="http://xml.fmi.fi/namespace/locationcode/name">Kouvola Utti lentoasema</gml:name>
    const name = xpath(
        doc,
        "//gml:name[@codeSpace='http://xml.fmi.fi/namespace/locationcode/name']",
    )?.innerHTML;

    if (!name) {
        NAME.value = "Bad station?";
        return;
    }

    NAME.value = name;

    const coordinates = doc
        .querySelector("pos")
        .innerHTML.trim()
        .split(/\s+/)
        .join(",");

    LATLONG.value = coordinates;

    const gusts = parseTimeSeries(doc, "obs-obs-1-1-windgust");
    const directions = parseTimeSeries(doc, "obs-obs-1-1-winddirection");
    const combined = gusts.map((gust, i) => {
        return {
            gust: gust.value,
            direction: directions[i]?.value ?? "N/A",
            time: gust.time,
        };
    });

    OBSERVATIONS.value = combined;

    const forecastXml = await fmiRequest({
        storedQuery: "fmi::observations::weather::timevaluepair",
        params: {
            // storedquery_id: "fmi::forecast::hirlam::surface::point::timevaluepair",
            // storedquery_id: "ecmwf::forecast::surface::point::simple",
            storedquery_id:
                "fmi::forecast::edited::weather::scandinavia::point::timevaluepair",
            // storedquery_id: "ecmwf::forecast::surface::point::timevaluepair",
            // fmisid,
            // parameters: FORECAST_PAREMETERS.join(","),
            // parameters: "WindGust",
            parameters: "HourlyMaximumGust,WindDirection",
            // place: "Utti",
            latlon: coordinates,
        },
    });

    const gustForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-HourlyMaximumGust",
    );
    const directionForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-WindDirection",
    );

    const combinedForecasts = gustForecasts.map((gust, i) => {
        return {
            gust: gust.value,
            direction: directionForecasts[i]?.value ?? "N/A",
            time: gust.time,
        };
    });

    FORECASTS.value = combinedForecasts;
}

await updateWeatherData();

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        updateWeatherData();
    }
});

window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        updateWeatherData();
    }
});

setInterval(updateWeatherData, 60000);
