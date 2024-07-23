// @ts-check
// docs https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=describeStoredQueries&
import { computed, effect, signal } from "@preact/signals";
import {
    calculateDirectionDifference,
    debug,
    filterNullish,
    isNullish,
    hasValidWindData,
    knotsToMs,
    removeNullish,
    safeParseNumber,
    fetchJSON,
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
    let count = 0;

    for (const obs of OBSERVATIONS.value) {
        if (hasValidWindData(obs)) {
            count++;
        }

        // At least two observations with wind data
        if (count > 1) {
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
    const obs = OBSERVATIONS.value[0];

    if (obs && hasValidWindData(obs)) {
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
        temperature: obs?.temperature ?? metar.temperature,
        dewPoint: obs?.dewPoint ?? metar.dewpoint,
        time: metar.time,
        gust: isNullish(gust) ? undefined : knotsToMs(gust),
        speed: isNullish(speed) ? undefined : knotsToMs(speed),
        direction:
            typeof metar.wind.direction === "number"
                ? metar.wind.direction
                : undefined,
    };

    if (hasValidWindData(metarObs)) {
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

if (QUERY_PARAMS.value.lat && QUERY_PARAMS.value.lon) {
    FORECAST_COORDINATES.value = `${QUERY_PARAMS.value.lat},${QUERY_PARAMS.value.lon}`;
}

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

effect(() => {
    if (!QUERY_PARAMS.value.save) {
        return;
    }

    const name =
        NAME.value ?? QUERY_PARAMS.value.name ?? QUERY_PARAMS.value.icaocode;

    if (!name) {
        return;
    }

    saveCurrentDz(name);
    navigateQs({ save: undefined }, { replace: true });
});

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

/**
 * @param {string} coordinates
 */
async function fetchFmiForecasts(coordinates) {
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
                "DewPoint",
                "PoP", // precipitation probability
            ].join(","),
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

    const dewPointForecasts = parseTimeSeries(
        forecastXml,
        "mts-1-1-DewPoint",
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
            dewPoint: dewPointForecasts[i]?.value,
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
    /** @type {FlykMetar} */
    const data = await fetchJSON("https://flyk.com/api/metars.geojson");
    const re = new RegExp(`^(METAR|SPECI) ${icaocode} `);
    const features = data.features.find((f) => {
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

function getObservationStartTime() {
    const obsRange = Number(QUERY_PARAMS.value.observation_range) || 12;
    const obsStartTime = new Date();
    obsStartTime.setHours(obsStartTime.getHours() - obsRange, 0, 0, 0);
    return obsStartTime;
}

/**
 * @param {string} fmisid
 */
export async function fetchFmiObservations(fmisid) {
    const icaocode = QUERY_PARAMS.value.icaocode;
    const customName = QUERY_PARAMS.value.name;

    NAME.value = customName || icaocode || undefined;
    if (NAME.value) {
        localStorage.setItem("previous_dz", NAME.value);
    }

    const obsStartTime = getObservationStartTime();

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
            parameters: [
                "winddirection",
                "windspeedms",
                "windgust",
                "t2m",
                "td",
            ],
            fmisid,
        },
        "/example_data/observations.xml",
    );

    if (!doc) {
        addError(`Havaintoasemaa ${fmisid} ei löytynyt.`);
        return;
    }

    if (doc === "error") {
        addError(
            `Virhe Ilmatieteenlaitoksen havaintoaseman ${fmisid} tietojen hakemisessa.`,
        );
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

    STATION_NAME.value = name + " (FMI)";

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
    const dewPoints = parseTimeSeries(doc, "obs-obs-1-1-td", -99).reverse();

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
            dewPoint: dewPoints[i]?.value,
        };
    });

    const mock = mockLatestObservation(combined[0]);
    if (mock) {
        combined[0] = mock;
    }

    OBSERVATIONS.value = combined;
}

/**
 * @param {string} roadsid
 */
async function fetchRoadStationInfo(roadsid) {
    const res = await fetch(
        `https://tie.digitraffic.fi/api/weather/v1/stations/${roadsid}`,
        {
            headers: {
                "Digitraffic-User": "hyppykeli.fi",
            },
        },
    );

    if (!res.ok) {
        addError(`Virhe Digitraffic API:ssa: ${res.status}`);
        return;
    }

    /** @type {RoadStationInfoDetailed} */
    const data = await res.json();

    STATION_COORDINATES.value = `${data.geometry.coordinates[1]},${data.geometry.coordinates[0]}`;
    if (!FORECAST_COORDINATES.value) {
        FORECAST_COORDINATES.value = STATION_COORDINATES.value;
    }
    STATION_NAME.value = data.properties.names.fi + " (Digitraffic)";
}

/**
 * @param {string} roadsid
 */
async function fetchRoadObservations(roadsid) {
    const obsStartTime = getObservationStartTime();

    // load in background as not so important
    /** @type {Promise<RoadStationHistoryValue[]|undefined>} */
    const historyPromise = fetchJSON(
        `https://tie.digitraffic.fi/api/beta/weather-history-data/${roadsid}?` +
            new URLSearchParams({
                from: obsStartTime.toISOString(),
            }),
        {
            headers: {
                "Digitraffic-User": "hyppykeli.fi",
            },
        },
    );

    /** @type {RoadStationObservations|undefined} */
    const data = await fetchJSON(
        `https://tie.digitraffic.fi/api/weather/v1/stations/${roadsid}/data`,
        {
            headers: {
                "Digitraffic-User": "hyppykeli.fi",
            },
        },
    );

    if (!data) {
        return;
    }

    const gust = data.sensorValues.find((v) => v.name === "MAKSIMITUULI");
    const wind = data.sensorValues.find((v) => v.name === "KESKITUULI");
    const windDirection = data.sensorValues.find(
        (v) => v.name === "TUULENSUUNTA",
    );
    const temperature = data.sensorValues.find((v) => v.name === "ILMA");
    const dewPoint = data.sensorValues.find((v) => v.name === "KASTEPISTE");

    /** @type {WeatherData} */
    const obs = {
        source: "roads",
        speed: wind?.value,
        gust: gust?.value,
        direction: windDirection?.value,
        temperature: temperature?.value,
        dewPoint: dewPoint?.value,
        time: new Date(data.dataUpdatedTime),
    };

    OBSERVATIONS.value = [obs];

    const history = await historyPromise;
    if (!history) {
        return;
    }

    if (!gust) {
        return;
    }

    const gusts = history.filter((v) => v.sensorId === gust.id);

    /** @type {WeatherData[]} */
    const combined = gusts.flatMap((roadObservation) => {
        // just pick gusts to get an single array of observations
        if (roadObservation.sensorId !== gust.id) {
            return [];
        }

        const otherObservations = history.filter(
            (h) => h.measuredTime === roadObservation.measuredTime,
        );

        // find matching history for other values than the gust
        const windHistory = otherObservations.find(
            (ob) => ob.sensorId === wind?.id,
        )?.sensorValue;

        const directionHistory = otherObservations.find(
            (ob) => ob.sensorId === windDirection?.id,
        )?.sensorValue;

        const temperatureHistory = otherObservations.find(
            (ob) => ob.sensorId === temperature?.id,
        )?.sensorValue;

        const dewPointHistory = otherObservations.find(
            (ob) => ob.sensorId === dewPoint?.id,
        )?.sensorValue;

        return {
            source: "roads",
            time: new Date(roadObservation.measuredTime),
            gust: roadObservation.sensorValue,
            speed: windHistory,
            direction: directionHistory,
            temperature: temperatureHistory,
            dewPoint: dewPointHistory,
        };
    });

    combined.reverse();

    OBSERVATIONS.value = [obs, ...combined];
}

async function fetchObservations() {
    if (QUERY_PARAMS.value.fmisid) {
        await fetchFmiObservations(QUERY_PARAMS.value.fmisid);
    } else if (QUERY_PARAMS.value.roadsid) {
        await Promise.all([
            fetchRoadObservations(QUERY_PARAMS.value.roadsid),
            fetchRoadStationInfo(QUERY_PARAMS.value.roadsid),
        ]);
    } else {
        addError(
            "Ilmatieteenlaitoksen eikä tiehallinnon havaintoasemaa ole määritetty.",
        );
    }
}

export async function updateWeatherData() {
    ERRORS.value = [];
    if (FORECAST_COORDINATES.value) {
        // we can fetch everyting in parallel if we have manually provided coordinates
        await Promise.all([
            fetchObservations(),
            fetchFmiForecasts(FORECAST_COORDINATES.value),
            fetchHighWinds(FORECAST_COORDINATES.value),
        ]);
    } else {
        // otherwise we need to fetch the stationdata first to get the station coordinates
        await fetchObservations();
        if (FORECAST_COORDINATES.value) {
            await Promise.all([
                fetchFmiForecasts(FORECAST_COORDINATES.value),
                fetchHighWinds(FORECAST_COORDINATES.value),
            ]);
        } else {
            addError("Koordinaattien haku epännistui havaintoasemalta.");
        }
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

// Constants for WIND_VARIATIONS
const DEBUG_SPEEDS = [1];
const DEBUG_GUSTS = [6];
const DEBUG_DIRECTIONS = [270, 270, 270, 270, 200, 200];

const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;
const MAX_EXTRA_WIDTH = 30;
const EXTRA_WIDTH_MULTIPLIER = 3;

/** @type {Record<string, string>} */
const COLOR_MAPPINGS = {
    0: "#E6DB00",
    1: "#2CF000",
    2: "orange",
    3: "red",
    4: "#AC0000",
};

const SPEED_THRESHOLDS = {
    LOW: 2,
    MEDIUM: 6,
    HIGH: 8,
};

const GUST_THRESHOLDS = {
    LOW: 3,
    MEDIUM: 4,
    HIGH: 7,
    VERY_HIGH: 11,
};

const GUST_DIFF_THRESHOLDS = {
    MEDIUM: 4,
    HIGH: 5.5,
    VERY_HIGH: 7,
};

const WIND_REF_BASE_TABLE = [
    { gustSpeed: GUST_THRESHOLDS.VERY_HIGH, avgSpeed: 0, windRef: 4 },
    {
        gustSpeed: GUST_THRESHOLDS.HIGH,
        avgSpeed: SPEED_THRESHOLDS.HIGH,
        windRef: 3,
    },
    {
        gustSpeed: GUST_THRESHOLDS.MEDIUM,
        avgSpeed: SPEED_THRESHOLDS.MEDIUM,
        windRef: 2,
    },
    { gustSpeed: GUST_THRESHOLDS.MEDIUM, avgSpeed: 0, windRef: 2 },
    { gustSpeed: GUST_THRESHOLDS.LOW, avgSpeed: 0, windRef: 1 },
    { gustSpeed: 0, avgSpeed: 0, windRef: 0 },
];

const GUST_DIFF_TABLE = [
    { diff: GUST_DIFF_THRESHOLDS.VERY_HIGH, increment: 1 },
    { diff: GUST_DIFF_THRESHOLDS.HIGH, increment: 0.5 },
    { diff: GUST_DIFF_THRESHOLDS.MEDIUM, increment: 0.25 },
    { diff: 0, increment: 0 },
];

const DIRECTION_VARIATION_TABLE = [
    { gustSpeed: GUST_THRESHOLDS.VERY_HIGH, direction: 180, increment: 1 },
    { gustSpeed: GUST_THRESHOLDS.HIGH, direction: 90, increment: 1 },
    { gustSpeed: GUST_THRESHOLDS.HIGH, direction: 45, increment: 0.5 },
    { gustSpeed: GUST_THRESHOLDS.MEDIUM, direction: 90, increment: 0.5 },
    { gustSpeed: GUST_THRESHOLDS.MEDIUM, direction: 45, increment: 0.25 },
    { gustSpeed: GUST_THRESHOLDS.LOW, direction: 90, increment: 0.25 },
    { gustSpeed: 0, direction: 0, increment: 0 },
];

// Helper functions for WIND_VARIATIONS

/**
 * @param {number[]} directions
 */
function calculateAverageDirection(directions) {
    debug(`calculateAverageDirection: directions = ${directions}`);
    const sumSin = directions.reduce(
        (sum, dir) => sum + Math.sin((dir * Math.PI) / 180),
        0,
    );
    const sumCos = directions.reduce(
        (sum, dir) => sum + Math.cos((dir * Math.PI) / 180),
        0,
    );
    const result = ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;
    debug(`calculateAverageDirection: result = ${result}`);
    return result;
}

/**
 * @param {number[]} directions
 */
export function calculateVariationRange(directions) {
    debug(`calculateVariationRange: directions = ${directions}`);
    let maxDiff = 0;
    for (let i = 0; i < directions.length; i++) {
        for (let j = i + 1; j < directions.length; j++) {
            const diff = Math.abs((directions[i] ?? 0) - (directions[j] ?? 0));
            const adjustedDiff = Math.min(diff, 360 - diff);
            maxDiff = Math.max(maxDiff, adjustedDiff);
        }
    }
    return maxDiff;
}

/**
 * @param {number} avgSpeed
 * @param {number} gustSpeed
 */
function findBaseWindRef(avgSpeed, gustSpeed) {
    for (const entry of WIND_REF_BASE_TABLE) {
        if (gustSpeed >= entry.gustSpeed && avgSpeed >= entry.avgSpeed) {
            debug("BASE WINDREF: " + entry.windRef);
            return entry.windRef;
        }
    }
    return 0;
}

/**
 * @param {number} gustDiff
 */
function findGustDiffIncrement(gustDiff) {
    for (const entry of GUST_DIFF_TABLE) {
        if (gustDiff >= entry.diff) {
            return entry.increment;
        }
    }
    return 0;
}

/**
 * @param {number} directionVariation
 * @param {number} gustSpeed
 */
function findDirectionVariationIncrement(directionVariation, gustSpeed) {
    for (const entry of DIRECTION_VARIATION_TABLE) {
        if (
            gustSpeed >= entry.gustSpeed &&
            directionVariation >= entry.direction
        ) {
            return entry.increment;
        }
    }
    return 0;
}

/**
 * @param {number} avgSpeed
 * @param {number} gustSpeed
 * @param {number} directionVariation
 */
function calculateWindRef(avgSpeed, gustSpeed, directionVariation) {
    debug(
        `calculateWindRef: avgSpeed = ${avgSpeed}, gustSpeed = ${gustSpeed}, directionVariation = ${directionVariation}`,
    );

    let windRef = findBaseWindRef(avgSpeed, gustSpeed);
    const gustDiff = gustSpeed - avgSpeed;
    const gustDiffIncrement = findGustDiffIncrement(gustDiff);
    windRef += gustDiffIncrement;

    const directionVariationIncrement = findDirectionVariationIncrement(
        directionVariation,
        gustSpeed,
    );
    windRef += directionVariationIncrement;

    const result = Math.min(Math.max(Math.round(windRef), 0), 4);
    debug(`calculateWindRef: result = ${result}`);
    return result;
}

/**
 * @param {WeatherData[]} observations
 */
function filterRecentObservations(observations) {
    if (QUERY_PARAMS.value.debug) return observations;
    const thirtyMinutesAgo = new Date(Date.now() - THIRTY_MINUTES_IN_MS);
    return observations.filter(
        (obs) => obs.time >= thirtyMinutesAgo && obs.direction !== -1,
    );
}

/**
 * @param {WeatherData[]} observations
 */
function extractAndFilterData(observations) {
    const directions = observations
        .map((obs) => obs.direction)
        .filter((dir) => dir != null);
    const speeds = observations
        .map((obs) => obs.speed)
        .filter((speed) => speed != null);
    const gusts = observations
        .map((obs) => obs.gust)
        .filter((gust) => gust != null);
    return { directions, speeds, gusts };
}

/**
 * @param {number[]} directions
 * @param {number[]} speeds
 * @param {number[]} gusts
 */
function calculateWindData(directions, speeds, gusts) {
    const averageDirection = calculateAverageDirection(directions);
    const variationRange = calculateVariationRange(directions);
    const averageSpeed =
        speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const maxGust = Math.max(...gusts);
    return { averageDirection, variationRange, averageSpeed, maxGust };
}

/**
 * @param {number} maxGust
 * @param {number} averageSpeed
 */
function calculateExtraWidth(maxGust, averageSpeed) {
    return Math.min(
        Math.max(
            Math.round((maxGust - averageSpeed) * EXTRA_WIDTH_MULTIPLIER),
            0,
        ),
        MAX_EXTRA_WIDTH,
    );
}

export const WIND_VARIATIONS = computed(() => {
    debug("WIND_VARIATIONS: Calculating...");

    /** @type {WeatherData[]} */
    const observations =
        QUERY_PARAMS.value.mock === "wind-variations"
            ? DEBUG_DIRECTIONS.map((dir, idx) => ({
                  source: "mock",
                  direction: dir,
                  speed: DEBUG_SPEEDS[idx % DEBUG_SPEEDS.length],
                  gust: DEBUG_GUSTS[idx % DEBUG_GUSTS.length],
                  time: new Date(),
              }))
            : OBSERVATIONS.value;

    debug("WIND_VARIATIONS: observations = ", observations);

    const recentObservations = filterRecentObservations(observations);

    if (recentObservations.length === 0) {
        console.warn("WIND_VARIATIONS: No recent observations available");
        return undefined;
    }

    const { directions, speeds, gusts } =
        extractAndFilterData(recentObservations);

    if (directions.length === 0 || speeds.length === 0 || gusts.length === 0) {
        console.warn("WIND_VARIATIONS: Insufficient data after filtering");
        return undefined;
    }

    const { averageDirection, variationRange, averageSpeed, maxGust } =
        calculateWindData(directions, speeds, gusts);

    const windRefValue = calculateWindRef(
        averageSpeed,
        maxGust,
        variationRange,
    );
    const windRef = ["0", "1", "2", "3", "4"][windRefValue];

    if (windRef === undefined) {
        console.error(
            "WIND_VARIATIONS: Invalid wind reference value calculated",
        );
        return undefined;
    }

    const result = {
        variationRange,
        averageDirection,
        color: COLOR_MAPPINGS[windRef] || "green",
        extraWidth: calculateExtraWidth(maxGust, averageSpeed),
    };

    debug("WIND_VARIATIONS: result = ", result);
    return result;
});

document.addEventListener("fetchjsonerror", (event) => {
    if (event instanceof CustomEvent && event.detail.message) {
        addError(event.detail.message);
    }
});
