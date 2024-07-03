// @ts-check
// docs https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=describeStoredQueries&
import { signal } from "@preact/signals";

/**
 * @typedef {import('@preact/signals').Signal<T>} Signal<T>
 * @template {any} T
 */

/**
 * @typedef {Object} WeatherData
 * @property {number} gust
 * @property {number} speed
 * @property {number} direction
 * @property {Date} time
 */

/**
 * @typedef {Object} CloudLayer
 * @property {number} base
 * @property {string} amount
 * @property {string} unit
 * @property {string} href
 */

/**
 * @typedef {Object} MetarData
 * @property {CloudLayer[]} clouds
 * @property {string} metar
 * @property {Date} time
 * @property {number} elevation
 */

/**
 * @type {Signal<string|undefined>}
 */
export const NAME = signal(undefined);

/**
 * @type {Signal<string | undefined>}
 */
export const STATION_NAME = signal(undefined);

/**
 * @type {Signal<WeatherData[]>}
 */
export const OBSERVATIONS = signal([]);

/**
 * @type {Signal<WeatherData|undefined>}
 */
export const HOVERED_OBSERVATION = signal(undefined);

/**
 * @type {Signal<WeatherData[]>}
 */
export const FORECASTS = signal([]);

/**
 * @type {Signal<MetarData[] | undefined>}
 */
export const METARS = signal(undefined);

/**
 * @type {Signal<string|null>}
 */
export const LATLONG = signal(null);

/**
 * @type {Signal<string[]>}
 */
export const ERRORS = signal([]);

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

/**
 * Makes a request to the FMI API with the given options.
 * @param {string} storedQuery - The stored query ID for the request.
 * @param {Object} params - The parameters for the request.
 * @param {string} [mock]
 * @returns {Promise<Document|undefined|"error">} The parsed XML document from the response.
 * @throws Will throw an error if the request fails.
 */
export async function fmiRequest(storedQuery, params, mock) {
    const allowMock = new URL(location.href).searchParams.has("mock");
    if (!allowMock) {
        mock = undefined;
    }

    const url = new URL(`https://opendata.fmi.fi/wfs?request=getFeature`);
    url.searchParams.set("storedquery_id", storedQuery);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    const response = await fetch(mock ?? url);
    if (response.status === 404) {
        return;
    }

    if (!response.ok) {
        return "error";
    }

    let data;
    try {
        const text = await response.text();
        const parser = new DOMParser();
        data = parser.parseFromString(text, "application/xml");
    } catch (error) {
        console.error("ERROR", url.toString(), error);
        return "error";
    }

    return data;
}

/**
 * @param {Document} doc
 * @param {string} path
 * @returns {Element|null}
 */
function xpath(doc, path) {
    const node = doc.evaluate(
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

    if (node instanceof Element) {
        return node;
    }

    return null;
}

/**
 * @param {Element} node
 */
function pointsToTimeSeries(node) {
    return Array.from(node.querySelectorAll("point")).map((point) => {
        return {
            value: Number(point.querySelector("value")?.innerHTML ?? 0),
            time: new Date(
                point.querySelector("time")?.innerHTML ?? new Date(),
            ),
        };
    });
}

/**
 * @param {Document} doc
 * @param {string} id
 */
function parseTimeSeries(doc, id) {
    const node = xpath(doc, `//wml2:MeasurementTimeseries[@gml:id="${id}"]`);
    if (!node) {
        return [];
    }

    return pointsToTimeSeries(node);
}

/**
 * @param {Document} xml
 * @returns {MetarData[]}
 */
function parseClouds(xml) {
    const members = Array.from(xml.querySelectorAll("member"));

    return members.flatMap((member) => {
        const time = new Date(
            member.querySelector("timePosition")?.innerHTML ?? new Date(),
        );

        const elevation = Number(
            member.querySelector("fieldElevation")?.innerHTML ?? -1,
        );

        const metar = member.querySelector("source input")?.innerHTML;

        if (!metar) {
            return [];
        }

        const cloudNodes = member
            .querySelector("MeteorologicalAerodromeObservationRecord cloud")
            ?.querySelectorAll("CloudLayer");

        const clouds = Array.from(cloudNodes ?? []).flatMap((xml) => {
            const base = xml.querySelector("base");
            if (!base) {
                return [];
            }

            const amountHref = xml
                .querySelector("amount")
                ?.getAttribute("xlink:href");

            if (!amountHref) {
                return [];
            }

            // https://codes.wmo.int/bufr4/codeflag/0-20-008/1
            const amount = new URL(amountHref).pathname.split("/").pop();

            if (!amount) {
                return [];
            }

            return {
                amount,
                base: Number(base?.innerHTML),
                unit: base?.getAttribute("uom") ?? "?",
                href: amountHref,
            };
        });

        return {
            time,
            elevation,
            clouds,
            metar,
        };
    });
}

/**
 * @param {string} msg
 */
function addError(msg) {
    ERRORS.value = [...ERRORS.value, msg];
}

async function updateWeatherData() {
    ERRORS.value = [];
    const url = new URL(location.href);
    const fmisid = url.searchParams.get("fmisid");
    const icaocode = url.searchParams.get("icaocode");
    const obsRange = Number(url.searchParams.get("observation_range")) || 12;
    const forecastRange = Number(url.searchParams.get("forecast_range")) || 8;

    NAME.value = icaocode ?? undefined;

    const obsStartTime = new Date();
    obsStartTime.setHours(obsStartTime.getHours() - obsRange, 0, 0, 0);

    const cacheBust = Math.floor(Date.now() / 30_000);

    if (icaocode) {
        fmiRequest(
            "fmi::avi::observations::iwxxm",
            {
                cch: cacheBust,
                starttime: obsStartTime.toISOString(),
                icaocode,
            },
            "/example_data/metar.xml",
        ).then((xml) => {
            if (!xml) {
                addError(`Tuntematon lentokenttä tunnus ${icaocode}.`);
                return;
            }

            if (xml === "error") {
                addError(`Virhe METAR-sanomaa hakiessa kentälle ${icaocode}.`);
                return;
            }

            const clouds = parseClouds(xml);
            METARS.value = clouds;
        });
    } else {
        addError("Lentokenttä tunnus (ICAO) puuttuu.");
    }

    const doc = await fmiRequest(
        "fmi::observations::weather::timevaluepair",
        {
            cch: cacheBust,
            starttime: obsStartTime.toISOString(),
            // endtime:
            parameters: OBSERVATION_PARAMETERS.join(","),
            fmisid,
        },
        "/example_data/observations.xml",
    );

    if (!doc) {
        addError(`Havaintoasemaa ${fmisid} ei löytynyt.`);
        return;
    }

    if (doc === "error") {
        addError(`Virhe havaintoaseman ${fmisid} tietojen hakemisessa.`);
        return;
    }

    // <gml:name codeSpace="http://xml.fmi.fi/namespace/locationcode/name">Kouvola Utti lentoasema</gml:name>
    const name = xpath(
        doc,
        "//gml:name[@codeSpace='http://xml.fmi.fi/namespace/locationcode/name']",
    )?.innerHTML;

    if (!name) {
        addError(`Havaintoasema ${fmisid} ei taida toimia tässä.`);
        return;
    }

    STATION_NAME.value = name;
    if (!NAME.value) {
        NAME.value = name;
    }

    const coordinates = doc
        .querySelector("pos")
        ?.innerHTML.trim()
        .split(/\s+/)
        .join(",");

    LATLONG.value = coordinates ?? null;

    const gusts = parseTimeSeries(doc, "obs-obs-1-1-windgust").reverse();
    const windSpeed = parseTimeSeries(doc, "obs-obs-1-1-windspeedms").reverse();
    const directions = parseTimeSeries(
        doc,
        "obs-obs-1-1-winddirection",
    ).reverse();

    /** @type {WeatherData[]} */
    const combined = gusts.map((gust, i) => {
        return {
            gust: gust.value,
            speed: windSpeed[i]?.value ?? -1,
            direction: directions[i]?.value ?? -1,
            time: gust.time,
        };
    });

    OBSERVATIONS.value = combined;

    const forecastStartTime = new Date();
    const forecastEndTime = new Date();
    forecastEndTime.setHours(
        forecastEndTime.getHours() + forecastRange,
        0,
        0,
        0,
    );

    const forecastXml = await fmiRequest(
        // "fmi::forecast::hirlam::surface::point::timevaluepair",
        // "ecmwf::forecast::surface::point::simple",
        // "ecmwf::forecast::surface::point::timevaluepair",
        "fmi::forecast::edited::weather::scandinavia::point::timevaluepair",
        {
            cch: cacheBust,

            starttime: forecastStartTime.toISOString(),
            endtime: forecastEndTime.toISOString(),

            timestep: 10,
            // parameters: FORECAST_PAREMETERS.join(","),
            // parameters: "WindGust",
            parameters: "HourlyMaximumGust,WindDirection,WindSpeedMS",
            // place: "Utti",
            latlon: coordinates,
        },
        "/example_data/forecast.xml",
    );

    if (forecastXml === "error") {
        addError("Virhe ennusteiden hakemisessa.");
        return;
    }

    if (!forecastXml) {
        addError("Ennusteita ei löytynyt");
        return;
    }

    const gustForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-HourlyMaximumGust",
    );

    const speedForecasts = parseTimeSeries(forecastXml, "mts-1-1-WindSpeedMS");

    const directionForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-WindDirection",
    );

    /** @type {WeatherData[]} */
    const combinedForecasts = gustForecasts.map((gust, i) => {
        return {
            gust: gust.value,
            direction: directionForecasts[i]?.value ?? -1,
            speed: speedForecasts[i]?.value ?? -1,
            time: gust.time,
        };
    });

    FORECASTS.value = combinedForecasts;
}

updateWeatherData().then(() => {
    const fragment = location.hash;
    if (!fragment) {
        return;
    }

    let element;

    try {
        element = document.querySelector(fragment);
    } catch (error) {}

    if (element) {
        element.scrollIntoView();
    }
});

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
