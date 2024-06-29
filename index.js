import { render } from "preact";

console.log(render);
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
    const url = new URL(`http://opendata.fmi.fi/wfs?request=getFeature`);
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

console.log("FMI module loaded");

const data = await fmiRequest({
    storedQuery: "fmi::observations::weather::timevaluepair",
    params: {
        starttime: getStartTime(),
        // endtime: moment().toISOString(),
        parameters: OBSERVATION_PARAMETERS,
        fmisid: 101191,
    },
});

console.log(data);

function xpath(doc, path) {
    return doc.evaluate(
        path,
        data,
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

function parseTimeSeries(id) {
    const node = xpath(data, `//wml2:MeasurementTimeseries[@gml:id="${id}"]`);
    return pointsToTimeSeries(node);
}

const res = parseTimeSeries("obs-obs-1-1-winddirection");
console.log(res);

// console.log(2, windDirections.querySelectorAll("wml2\\:point"));
Object.assign(window, { data });
