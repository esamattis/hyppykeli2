export const getStartTime = () => {
    const date = new Date();
    date.setHours(date.getHours() - 7, 0, 0, 0);
    return date.toISOString();
};

export const FmiHelpers = {
    getFeatures: (data) =>
        data.querySelectorAll("wfs\\:FeatureCollection wfs\\:member"),

    OBSERVATION_PARAMETERS: [
        "winddirection",
        "windspeedms",
        "windgust",
        "n_man",
    ],

    FORECAST_PAREMETERS: [
        "winddirection",
        "windspeedms",
        "windgust",
        "maximumwind",
    ],

    getFeatureDescriptionHref: (data) =>
        data
            .querySelector(
                "omso\\:PointTimeSeriesObservation om\\:observedProperty",
            )
            .getAttribute("xlink:href"),

    getFeatureId: (data) =>
        data
            .querySelector(
                "omso\\:PointTimeSeriesObservation om\\:featureOfInterest sams\\:SF_SpatialSamplingFeature",
            )
            .getAttribute("gml:id"),

    getDescription: (data) =>
        data.querySelector("ObservableProperty label").textContent,

    getFeatureStationName: (data) =>
        data.querySelector(
            "omso\\:PointTimeSeriesObservation om\\:featureOfInterest sams\\:SF_SpatialSamplingFeature sams\\:shape gml\\:Point gml\\:name",
        ).textContent,

    getFeatureStationCoordinates: (data) =>
        data.querySelector(
            "omso\\:PointTimeSeriesObservation om\\:featureOfInterest sams\\:SF_SpatialSamplingFeature sams\\:shape gml\\:Point gml\\:pos",
        ).textContent,

    getPoints: (data) =>
        data.querySelectorAll(
            "omso\\:PointTimeSeriesObservation om\\:result wml2\\:MeasurementTimeseries wml2\\:point",
        ),

    getTime: (point) =>
        point.querySelector("wml2\\:MeasurementTVP wml2\\:time").textContent,

    getValue: (point) =>
        point.querySelector("wml2\\:MeasurementTVP wml2\\:value").textContent,

    getForecastLocationName: (data) =>
        data.querySelector(
            "omso\\:PointTimeSeriesObservation om\\:featureOfInterest sams\\:SF_SpatialSamplingFeature sams\\:shape gml\\:MultiPoint gml\\:pointMembers gml\\:Point gml\\:name",
        ).textContent,

    getForecastLocationCoordinates: (data) =>
        data.querySelector(
            "omso\\:PointTimeSeriesObservation om\\:featureOfInterest sams\\:SF_SpatialSamplingFeature sams\\:shape gml\\:MultiPoint gml\\:pointMembers gml\\:Point gml\\:pos",
        ).textContent,
};

async function xml2js(xml) {
    const parser = new DOMParser();
    return parser.parseFromString(xml, "application/xml");
}

export async function fmiRawRequest(url) {
    console.log("FMI request", url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const data = await xml2js(text);
        console.log("FMI request completed", url);
        return data;
    } catch (error) {
        console.error("FMI request failed", error);
        throw error;
    }
}

export function fmiRequest(options) {
    const metarURL = new URL(`http://opendata.fmi.fi/wfs?request=getFeature`);
    metarURL.searchParams.set("storedquery_id", options.storedQuery);
    for (const [k, v] of Object.entries(options.params)) {
        metarURL.searchParams.set(k, v);
    }

    return fmiRawRequest(metarURL.toString());
}

console.log("FMI module loaded");

const data = await fmiRequest({
    storedQuery: "fmi::observations::weather::timevaluepair",
    params: {
        starttime: getStartTime(),
        // endtime: moment().toISOString(),
        parameters: FmiHelpers.OBSERVATION_PARAMETERS,
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
