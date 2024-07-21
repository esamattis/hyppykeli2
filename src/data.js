// @ts-check
// docs https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=describeStoredQueries&
import { computed, effect, signal } from "@preact/signals";
import {
    calculateDirectionDifference,
    filterNullish,
    isNullish,
    isValidObservation,
    knotsToMs,
    removeNullish,
    safeParseNumber,
} from "./utils.js";
import { fetchHighWinds } from "./om.js";
// just exposes the parseMETAR global
import "metar";

/** @type {Signal<QueryParams[]>} */
export const SAVED_DZs = signal(
    (() => {
        try {
            return JSON.parse(window.localStorage.getItem("saved_dzs") ?? "[]");
        } catch {
            return [];
        }
    })(),
);

/**
 * @param {string|null|undefined} name
 */
export function saveCurrentDz(name) {
    name = name ?? undefined;
    let qp = QUERY_PARAMS.value;
    const index = SAVED_DZs.value.findIndex((dz) => dz.name == name);

    qp = { ...qp, name, save: undefined };

    if (index === -1) {
        SAVED_DZs.value = [...SAVED_DZs.value, qp];
    } else {
        SAVED_DZs.value = SAVED_DZs.value.with(index, qp);
    }

    window.localStorage.setItem("saved_dzs", JSON.stringify(SAVED_DZs));
}

/**
 * @param {string} name
 */
export function removeSavedDz(name) {
    const filtered = SAVED_DZs.value.filter((dz) => dz.name !== name);
    window.localStorage.setItem("saved_dzs", JSON.stringify(filtered));
    SAVED_DZs.value = filtered;
}

/**
 * Current URLSearchParams (query string) in the location bar
 *
 * @type {Signal<QueryParams>}
 */
export const QUERY_PARAMS = signal(
    Object.fromEntries(new URLSearchParams(location.search)),
);

/**
 * @type {Signal<string|undefined>}
 */
export const NAME = signal(QUERY_PARAMS.value.name);

/**
 * @type {Signal<number>}
 */
export const LOADING = signal(0);

/**
 * @type {Signal<boolean>}
 */
export const STALE_FORECASTS = signal(true);

/**
 * @type {Signal<string | undefined>}
 */
export const STATION_NAME = signal(undefined);

/**
 * @type {Signal<WeatherData[]>}
 */
export const OBSERVATIONS = signal([]);

export const HAS_WIND_OBSERVATIONS = computed(() => {
    for (const obs of OBSERVATIONS.value) {
        // at least one
        if (isValidObservation(obs)) {
            return true;
        }
    }

    return false;
});

/**
 * @type {Signal<WeatherData|undefined>}
 */
export const HOVERED_OBSERVATION = signal(undefined);

/**
 * @type {Signal<WeatherData|undefined>}
 */
export const LATEST_OBSERVATION = computed(() => {
    if (OBSERVATIONS.value[0] && isValidObservation(OBSERVATIONS.value[0])) {
        return OBSERVATIONS.value[0];
    }

    const metar = METARS.value?.[0];
    if (!metar) {
        return;
    }

    const speed = metar.wind.speed;
    const gust = metar.wind.gust;

    /** @type {WeatherData} */
    const metarObs = {
        source: "metar",
        lowCloudCover: undefined,
        middleCloudCover: undefined,
        time: metar.time,
        gust: isNullish(gust) ? undefined : knotsToMs(gust),
        speed: isNullish(speed) ? undefined : knotsToMs(speed),
        direction:
            typeof metar.wind.direction === "number"
                ? metar.wind.direction
                : undefined,
        temperature: metar.temperature,
    };

    if (isValidObservation(metarObs)) {
        console.log("Latest observation from METAR", metarObs);
        return metarObs;
    }
});

/**
 * @type {Signal<WeatherData[]>}
 */
export const FORECASTS = signal([]);

/**
 * @param {WeatherData | undefined} original
 * @returns {WeatherData|undefined}
 */
function mockLatestObservation(original) {
    const url = new URL(location.href);
    // Allow testing only on dev sites
    if (url.hostname.endsWith("hyppykeli.fi")) {
        return;
    }

    const customGust = url.searchParams.get("gust");
    const customSpeed = url.searchParams.get("speed");
    const customDirection = url.searchParams.get("direction");

    let mock = original;

    mock = {
        source: "fmi",
        lowCloudCover: undefined,
        middleCloudCover: undefined,
        time: new Date(),
        ...mock,
        gust: Number(customGust) || mock?.gust || 0,
        speed: Number(customSpeed) || mock?.speed || 0,
        direction: Number(customDirection) || mock?.direction || 0,
        temperature: mock?.temperature || 0,
    };

    return mock;
}

/**
 * @typedef {Object} WindVariations
 * @property {number} variationRange
 * @property {number} averageDirection
 * @property {string} color
 * @property {number} extraWidth
 */

/**
 * @type {Signal<WindVariations | undefined>}
 */
export const WIND_VARIATIONS = computed(() => {
    const observations = OBSERVATIONS.value;

    // Calculate wind variations for the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentObservations = observations.filter(
        (obs) => obs.time >= thirtyMinutesAgo && obs.direction !== -1,
    );

    if (recentObservations.length === 0) {
        return;
    }

    const directions = filterNullish(
        recentObservations.map((obs) => obs.direction),
    );
    const speeds = filterNullish(recentObservations.map((obs) => obs.speed));
    const gusts = filterNullish(recentObservations.map((obs) => obs.gust));

    // Calculate the average direction
    const sumSin = directions.reduce(
        (sum, dir) => sum + Math.sin((dir * Math.PI) / 180),
        0,
    );
    const sumCos = directions.reduce(
        (sum, dir) => sum + Math.cos((dir * Math.PI) / 180),
        0,
    );
    const averageDirection =
        ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;

    // Calculate the variation range
    let maxDiff = 0;
    for (let i = 0; i < directions.length; i++) {
        for (let j = i + 1; j < directions.length; j++) {
            const dir1 = directions[i];
            const dir2 = directions[j];
            if (typeof dir1 === "number" && typeof dir2 === "number") {
                const diff = calculateDirectionDifference(dir1, dir2);
                if (diff > maxDiff) {
                    maxDiff = diff;
                }
            }
        }
    }

    const variationRange = maxDiff;

    // Calculate speed variation
    const averageSpeed =
        speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;

    const maxGust = Math.max(...filterNullish(gusts));
    const gustSpeedRatio = maxGust / averageSpeed;

    // Determine color and width based on criteria
    let color = "green";
    let extraWidth = 0;

    if (maxGust > 4) {
        if (gustSpeedRatio >= 2) {
            color = "red";
            extraWidth = 20;
        } else if (gustSpeedRatio >= 1.5) {
            color = "orange";
            extraWidth = 10;
        }
    }

    if (variationRange > 90) {
        color = "red";
    } else if (variationRange >= 45 && color !== "red") {
        color = "orange";
    }

    return {
        variationRange,
        averageDirection,
        color,
        extraWidth,
    };
});

/**
 * @type {Signal<number>}
 */
export const GUST_TREND = computed(() => {
    const maxAge = Date.now() + 1000 * 60 * 60;
    const latestGust = OBSERVATIONS.value[0]?.gust ?? 0;

    const recentGusts = FORECASTS.value.flatMap((point) => {
        if (point.time.getTime() <= maxAge) {
            return point.gust;
        }

        return [];
    });

    if (recentGusts.length === 0) {
        return 0;
    }

    const avg =
        filterNullish(recentGusts).reduce((sum, gust) => sum + gust, 0) /
        recentGusts.length;

    return -latestGust + avg;
});

/**
 * @type {Signal<MetarData[] | undefined>}
 */
export const METARS = signal(undefined);

/**
 * @type {Signal<string|null>}
 */
export const STATION_COORDINATES = signal(null);

/**
 * @type {Signal<string|null>}
 */
export const FORECAST_COORDINATES = signal(null);

/**
 * @type {Signal<string|null>}
 */
export const FORECAST_LOCATION_NAME = signal(null);

/**
 * @type {Signal<string[]>}
 */
export const ERRORS = signal([]);

/**
 *  How many days in the future the forecast is for.
 *  0 = today, 1 = tomorrow, 2 = day after tomorrow, etc.
 *
 * @type {Signal<number>}
 */
export const FORECAST_DAY = computed(() => {
    const day = QUERY_PARAMS.value.forecast_day;
    return day ? Number(day) : 0;
});

if (QUERY_PARAMS.value.lat && QUERY_PARAMS.value.lon) {
    FORECAST_COORDINATES.value = `${QUERY_PARAMS.value.lat},${QUERY_PARAMS.value.lon}`;
}

if (QUERY_PARAMS.value.save) {
    const unsub = effect(() => {
        const name =
            NAME.value ??
            QUERY_PARAMS.value.name ??
            QUERY_PARAMS.value.icaocode;
        if (!name) {
            return;
        }
        unsub();
        saveCurrentDz(name);
        navigateQs({ save: undefined }, { replace: true });
    });
}

/**
 * @type {Signal<Date>}
 */
export const FORECAST_DATE = computed(() => {
    const day = FORECAST_DAY.value;

    STALE_FORECASTS.value = true;

    if (day === 0) {
        return new Date();
    }

    const date = new Date();
    date.setDate(date.getDate() + day);
    return date;
});

/**
 * @type {Signal<{ [K in StoredQuery]?: string}>}
 */
export const RAW_DATA = signal({});

/** @type {ReturnType<typeof setTimeout>} */
let timer;

HOVERED_OBSERVATION.subscribe(() => {
    clearTimeout(timer);

    timer = setTimeout(() => {
        HOVERED_OBSERVATION.value = undefined;
    }, 5_000);
});

document.addEventListener("click", (e) => {
    if (e.target instanceof Element && !e.target.closest(".chart")) {
        HOVERED_OBSERVATION.value = undefined;
    }
});

/**
 * Makes a request to the FMI API with the given options.
 * @param {StoredQuery} storedQuery - The stored query ID for the request.
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

    LOADING.value += 1;
    try {
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
            RAW_DATA.value = {
                ...RAW_DATA.value,
                [storedQuery]: text,
            };
            const parser = new DOMParser();
            data = parser.parseFromString(text, "application/xml");
        } catch (error) {
            console.error("ERROR", url.toString(), error);
            return "error";
        }

        return data;
    } finally {
        LOADING.value -= 1;
    }
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
 * @param {number} fallback
 */
function pointsToTimeSeries(node, fallback) {
    return Array.from(node.querySelectorAll("point")).map((point) => {
        const value = Number(point.querySelector("value")?.innerHTML);
        return {
            value: isNaN(value) ? fallback : value,
            time: new Date(
                point.querySelector("time")?.innerHTML ?? new Date(),
            ),
        };
    });
}

/**
 * @param {Document} doc
 * @param {string} id
 * @param {number} fallback
 */
function parseTimeSeries(doc, id, fallback) {
    const node = xpath(doc, `//wml2:MeasurementTimeseries[@gml:id="${id}"]`);
    if (!node) {
        return [];
    }

    return pointsToTimeSeries(node, fallback);
}

/**
 * @param {Document} xml
 * @returns {MetarData[]}
 */
function parseCloudsXml(xml) {
    const members = Array.from(xml.querySelectorAll("member"));

    return members.flatMap((member) => {
        const time = new Date(
            member.querySelector("timePosition")?.innerHTML ?? new Date(),
        );

        const elevation = Number(
            member.querySelector("fieldElevation")?.innerHTML ?? -1,
        );

        const windSpeed = Number(
            member.querySelector("meanWindSpeed")?.innerHTML ?? -1,
        );

        const temperature =
            safeParseNumber(member.querySelector("airTemperature")?.innerHTML)
                .value ?? -200;

        const windGust =
            safeParseNumber(
                //  TODO: XXX not correct!
                member.querySelector("windGust")?.innerHTML,
            ).value ?? -1;

        const windDirection = Number(
            member.querySelector("meanWindDirection")?.innerHTML ?? -1,
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

            /** @type {Record<string, string>} */
            const cloudAmounts = {
                1: "FEW", // Few, FEW
                2: "SCT", // Scattered, SCT
                3: "BKN", // Broken, BKN
                4: "OVC", // Overcast, OVC
                // TODO: There are more types of clouds. Where to get the full list?
            };

            if (!amount) {
                return [];
            }

            return {
                amount: cloudAmounts[amount] ?? amount,
                base: Number(base?.innerHTML),
                unit: base?.getAttribute("uom") ?? "?",
                href: amountHref,
            };
        });

        return {
            wind: {
                gust: windGust,
                speed: windSpeed,
                direction: windDirection,
                unit: "kt",
            },
            temperature,
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
export function addError(msg) {
    ERRORS.value = [...ERRORS.value, msg];
}

async function fetchFmiForecasts() {
    if (!FORECAST_COORDINATES.value) {
        throw new Error("No coordinates, cannot fetch fmi forecasts");
    }

    const forecastRange = Number(QUERY_PARAMS.value.forecast_range) || 12;

    const forecastStartTime = new Date();
    const forecastEndTime = new Date();
    forecastEndTime.setHours(
        forecastEndTime.getHours() + forecastRange,
        0,
        0,
        0,
    );

    const day = FORECAST_DAY.value;
    if (day > 0) {
        forecastStartTime.setHours(7, 0, 0, 0);
        forecastStartTime.setDate(forecastStartTime.getDate() + day);
        forecastEndTime.setHours(21, 0, 0, 0);
        forecastEndTime.setDate(forecastEndTime.getDate() + day);
    }

    const cacheBust = Math.floor(Date.now() / 30_000);

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
            // LowCloudCover, MiddleCloudCover, HighCloudCover, MiddleAndLowCloudCover
            parameters: [
                "HourlyMaximumGust",
                "WindDirection",
                "WindSpeedMS",
                "LowCloudCover",
                "MiddleAndLowCloudCover",
                "Temperature",
                "PoP", // precipitation probability
            ].join(","),
            // place: "Utti",
            latlon: FORECAST_COORDINATES.value,
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

    // const allFeatures = Array.from(
    //     forecastXml.querySelectorAll("SF_SpatialSamplingFeature"),
    // ).map((el) => el.getAttribute("gml:id"));
    // console.log(allFeatures);

    const gustForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-HourlyMaximumGust",
        -1,
    );

    const speedForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-WindSpeedMS",
        -1,
    );

    const popForecasts = parseTimeSeries(forecastXml, "mts-1-1-PoP", 0);

    const temperatureForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-Temperature",
        -100,
    );

    const directionForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-WindDirection",
        -1,
    );

    const cloudCoverForecasts = parseTimeSeries(
        forecastXml,
        // "mts-1-1-MiddleAndLowCloudCover",
        "mts-1-1-LowCloudCover",
        -1,
    );

    const middleCloudCoverForecasts = parseTimeSeries(
        forecastXml,
        // "mts-1-1-MiddleCloudCover",
        "mts-1-1-MiddleAndLowCloudCover",
        -1,
    );

    const locationCollection = forecastXml.querySelector("LocationCollection");
    const locationName = locationCollection?.querySelector("name")?.innerHTML;
    const regionName = locationCollection?.querySelector("region")?.innerHTML;
    FORECAST_LOCATION_NAME.value = `${locationName}, ${regionName}`;
    if (!NAME.value) {
        NAME.value = locationName;
    }

    /** @type {WeatherData[]} */
    const combinedForecasts = gustForecasts.map((gust, i) => {
        return {
            source: "forecast",
            gust: gust.value,
            direction: directionForecasts[i]?.value ?? -1,
            speed: speedForecasts[i]?.value ?? -1,
            time: gust.time,
            lowCloudCover: cloudCoverForecasts[i]?.value,
            middleCloudCover: middleCloudCoverForecasts[i]?.value,
            rain: popForecasts[i]?.value,
            temperature: temperatureForecasts[i]?.value,
        };
    });

    FORECASTS.value = combinedForecasts;
    STALE_FORECASTS.value = false;
}

/**
 * @param {string} icaocode
 * @param {Date} startTime
 * @param {number} cacheBust
 */
async function fetchFmiMetar(icaocode, startTime, cacheBust) {
    const xml = await fmiRequest(
        "fmi::avi::observations::iwxxm",
        {
            cch: cacheBust,
            starttime: startTime.toISOString(),
            icaocode,
        },
        "/example_data/metar.xml",
    );

    if (xml === "error") {
        addError(`Virhe METAR-sanomaa hakiessa kentälle ${icaocode}.`);
        return;
    }

    if (!xml || !xml.querySelector("member")) {
        addError(`Tuntematon lentokentän tunnus ${icaocode}.`);
        return;
    }

    const clouds = parseCloudsXml(xml);
    METARS.value = clouds;
}

/**
 * Fetches METAR data from the Flyk API for a given ICAO code.
 *
 * @param {string} icaocode - The ICAO code of the airport.
 */
async function fetchFlykMetar(icaocode) {
    const res = await fetch("https://flyk.com/api/metars.geojson");
    /** @type {FlykMetar} */
    const json = await res.json();

    const re = new RegExp(`^(METAR|SPECI) ${icaocode} `);
    const features = json.features.find((f) => {
        return re.test(f.properties.text);
    });
    return features?.properties.text;
}

/**
 * @param {string[]} metars
 */
function setMETARSfromMetarMessage(metars) {
    const parsed = metars.map((metar) => {
        const m = parseMETAR(metar);

        /** @type MetarData */
        const metarData = {
            time: new Date(m.time),
            metar,
            wind: {
                gust: m.wind.gust ?? undefined,
                speed: m.wind.speed ?? undefined,
                direction: m.wind.direction,
                unit: m.wind.unit.toLowerCase(),
            },
            temperature: m.temperature,
            clouds:
                m.clouds?.map((cloud) => {
                    return {
                        amount: cloud.abbreviation,
                        base: cloud.altitude,
                        unit: "ft",
                    };
                }) ?? [],
        };

        return metarData;
    });

    METARS.value = parsed;
}

export async function fetchObservations() {
    const fmisid = QUERY_PARAMS.value.fmisid;
    const icaocode = QUERY_PARAMS.value.icaocode;
    const customName = QUERY_PARAMS.value.name;
    const obsRange = Number(QUERY_PARAMS.value.observation_range) || 12;

    if (!fmisid) {
        return;
    }

    NAME.value = customName || icaocode || undefined;
    if (NAME.value) {
        localStorage.setItem("previous_dz", NAME.value);
    }

    const obsStartTime = new Date();
    obsStartTime.setHours(obsStartTime.getHours() - obsRange, 0, 0, 0);

    const cacheBust = Math.floor(Date.now() / 30_000);

    if (icaocode) {
        // intentionally not awaiting, it can be updated on the background
        if (QUERY_PARAMS.value.flyk_metar) {
            fetchFlykMetar(icaocode).then((metar) => {
                if (metar) {
                    setMETARSfromMetarMessage([metar]);
                } else {
                    addError(`Ei METAR-sanomaa kentälle ${icaocode}.`);
                }
            });
        } else {
            fetchFmiMetar(icaocode, obsStartTime, cacheBust);
        }
    } else {
        addError("Ei METAR tietoja.");
    }

    const doc = await fmiRequest(
        "fmi::observations::weather::timevaluepair",
        {
            cch: cacheBust,
            starttime: obsStartTime.toISOString(),
            // endtime:
            parameters: ["winddirection", "windspeedms", "windgust", "t2m"],
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

    // const allFeatures = Array.from(
    //     doc.querySelectorAll("SF_SpatialSamplingFeature"),
    // ).map((el) => el.getAttribute("gml:id"));
    // console.log(allFeatures.join(", "));

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

    STATION_COORDINATES.value =
        doc.querySelector("pos")?.innerHTML.trim().split(/\s+/).join(",") ??
        null;

    if (!FORECAST_COORDINATES.value) {
        FORECAST_COORDINATES.value = STATION_COORDINATES.value;
    }

    const gusts = parseTimeSeries(doc, "obs-obs-1-1-windgust", -1).reverse();
    const windSpeed = parseTimeSeries(
        doc,
        "obs-obs-1-1-windspeedms",
        -1,
    ).reverse();
    const directions = parseTimeSeries(
        doc,
        "obs-obs-1-1-winddirection",
        -1,
    ).reverse();

    const temperatures = parseTimeSeries(doc, "obs-obs-1-1-t2m", -99).reverse();

    /** @type {WeatherData[]} */
    const combined = gusts.map((gust, i) => {
        return {
            source: "fmi",
            gust: gust.value,
            speed: windSpeed[i]?.value,
            direction: directions[i]?.value,
            time: gust.time,
            middleCloudCover: undefined,
            lowCloudCover: undefined,
            temperature: temperatures[i]?.value,
        };
    });

    const mock = mockLatestObservation(combined[0]);
    if (mock) {
        combined[0] = mock;
    }

    OBSERVATIONS.value = combined;
}

export async function updateWeatherData() {
    ERRORS.value = [];
    if (FORECAST_COORDINATES.value) {
        // we can fetch everyting in parallel if we have manually provided coordinates
        await Promise.all([
            fetchObservations(),
            fetchFmiForecasts(),
            fetchHighWinds(),
        ]);
    } else {
        // otherwise we need to fetch the stationdata first to get the station coordinates
        await fetchObservations();
        await Promise.all([fetchFmiForecasts(), fetchHighWinds()]);
    }
}

/**
 * Update the query string in the url bar and update the global QUERY_PARAMS signal.
 *
 * @param {QueryParams} params
 * @param {Object} [options]
 * @param {"merge" | "replace"} [options.mode] defaults to "merge"
 * @param {boolean} [options.replace]
 */
export function navigateQs(params, options) {
    if (!options?.mode || options?.mode === "merge") {
        QUERY_PARAMS.value = {
            ...QUERY_PARAMS.value,
            ...params,
        };
    } else {
        QUERY_PARAMS.value = params;
    }

    const qs = new URLSearchParams(removeNullish(QUERY_PARAMS.value));

    if (options?.replace) {
        history.replaceState(null, "", `?${qs}`);
    } else {
        history.pushState(null, "", `?${qs}`);
    }
}

/**
 * Get query string for for <a href> rendering
 *
 * @param {QueryParams} [params]
 * @param {"merge" | "replace"} [mode]
 */
export function getQs(params, mode) {
    let query;

    if (!mode || mode === "merge") {
        query = {
            ...QUERY_PARAMS.value,
            ...params,
        };
    } else {
        query = params;
    }

    return "?" + new URLSearchParams(removeNullish(query)).toString();
}

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

let initial = true;

// listen to query string changes and refretch the data on changes
QUERY_PARAMS.subscribe(() => {
    updateWeatherData().then(() => {
        if (!initial) {
            return;
        }

        initial = false;

        // Scroll to url fragment after the intial data is loaded
        // since anchor positions change after the data load
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
});
