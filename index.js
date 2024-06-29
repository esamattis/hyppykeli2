import { render, html } from "preact";

const url = new URL(location.href);
const title = url.searchParams.get("title");
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
    date.setHours(date.getHours() - 7, 0, 0, 0);
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

const doc = await fmiRequest({
    storedQuery: "fmi::observations::weather::timevaluepair",
    params: {
        starttime: getStartTime(),
        // endtime: moment().toISOString(),
        parameters: OBSERVATION_PARAMETERS,
        fmisid,
    },
});

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

const gusts = parseTimeSeries(doc, "obs-obs-1-1-windgust");

Object.assign(window, { data: doc });

function Rows(props) {
    return props.data.map((point) => {
        let className = "ok";

        if (point.value >= 8) {
            className = "warning";
        }

        if (point.value >= 11) {
            className = "danger";
        }

        return html`<tr>
            <td class=${className}>${point.value}</td>
            <td>${point.time.toLocaleString()}</td>
        </tr> `;
    });
}

function DataTable(props) {
    return html`
        <table>
            <thead>
                <tr>
                    <th>m/s</th>
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
            <h1>Hyppykeli - <span id="title">${title}</span></h1>
            <h2>Puuskat</h2>
            <p>
                Tietojen käyttö omalla vastuulla. Ei takeita että tiedot ovat
                oikein.
            </p>
            <${DataTable} data=${gusts} />
        </div>
    `;
}

const root = document.getElementById("root");
render(html`<${Root} />`, root);

console.log("ver 2");
