// @ts-check

/**
 * Logs the provided arguments to the console when the query string contains debug=1
 * @param {...any} args - The arguments to log.
 */
export function debug(...args) {
    if (/debug/.test(location.search)) {
        console.log(...args);
    }
}

/**
 * @param {Date} date
 */
export function formatClock(date) {
    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

/**
 * @param {Date} date
 */
export function formatDate(date) {
    return date.toLocaleDateString("fi-FI");
}

/**
 * Save a text string to a file on the user's computer.
 *
 * @param {string} filename - The name of the file to be saved.
 * @param {string} text - The text content to be saved in the file.
 */
export function saveTextToFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * @param {number} offset
 */
export function dateOffset(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
}

/**
 * @param {Date} date
 */
export function humanDayText(date) {
    const day = date.getDate();
    const today = new Date().getDate();

    if (day === today) {
        return "tänään";
    }

    if (day === today + 1) {
        return "huomenna";
    }

    if (day === today + 2) {
        return "ylihuomenna";
    }

    return "";
}

/**
 * Calculates the difference between two wind directions considering the circular nature of directions.
 * @param {number} dir1 - First wind direction.
 * @param {number} dir2 - Second wind direction.
 * @returns {number} The minimum difference between the two directions.
 */
export function calculateDirectionDifference(dir1, dir2) {
    const diff = Math.abs(dir1 - dir2);
    return Math.min(diff, 360 - diff);
}

/**
 * @param {Object | undefined} ob
 */
export function removeNullish(ob) {
    if (!ob) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(ob).filter(
            ([_, value]) => value !== null && value !== undefined,
        ),
    );
}

/**
 * @param {string|undefined} value
 * @returns {{ value: number | null }}
 */
export function safeParseNumber(value) {
    if (value === undefined) {
        return { value: null };
    }

    if (/^\d*\.?\d+$/.test(value.trim())) {
        return { value: parseInt(value.trim(), 10) };
    }

    return { value: null };
}

export const EXAMPLE_CSS = `
    #clouds,
    #forecasts-graph,
    #forecasts-table,
    #high-winds p,
    #high-winds-today h2 + p,
    #high-winds-tomorrow,
    #info,
    #observations-table,
    #title,
    #winds,
    button.help,
    .content h2 {
        display: none;
    }
    .content.grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }
    #observations-graph {
        grid-column: 1;
        grid-row: 1;
        width: 100%;
        overflow-y: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    #observations-graph .chart {
        height: clamp(200px, 50vh, 400px) !important;
        width: clamp(200px, 100vw, 480px) !important;
    }
    #high-winds-today.side-scroll {
        grid-column: 1;
        grid-row: 2;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .time-header {
        min-width: 50px;
    }
    #compass.compass {
        grid-column: 2;
        grid-row: 1/3;
        width: clamp(200px, 50vw, 600px) !important;
        position: relative !important;
        top: unset !important;
        right: unset !important;
        box-shadow: none !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
    }
    .compass-observations-gust,
    .compass-observations-speed {
        display: block;
    }
    @media (max-width: 900px) {
        .content.grid {
            display: block;
            gap: 0;
        }
        #compass.compass {
            width: clamp(200px, 70vw, 900px) !important;
            margin: 0 auto;
        }
    }
`;

/**
 * @param {WeatherData|undefined} obs
 */
export function hasValidWindData(obs) {
    if (!obs) {
        return false;
    }

    if (obs.direction === -1 || obs.gust === -1 || obs.speed === -1) {
        return false;
    }

    return true;
}

/**
 * Zero is falsy in JavaScript, so we need to check for it explicitly
 *
 * @param {any} value
 * @returns {value is null | undefined}
 */
export function isNullish(value) {
    return value === null || value === undefined;
}

/**
 * @template T
 * @param {T[]} array
 * @returns {NonNullable<T>[]}
 */
export function filterNullish(array) {
    // @ts-ignore
    return array.filter((item) => !isNullish(item));
}

/**
 * Execute the given callback and return value only if all values are non-nullish (not null or undefined).
 *
 * @template T
 * @template R
 * @param {T[]} values
 * @param {(...values: NonNullable<T>[]) => R} cb
 * @returns {R | null}
 */
export function whenAll(values, cb) {
    const ok = values.every((value) => value !== null && value !== undefined);
    return ok
        ? cb(
              // @ts-ignore
              ...values,
          )
        : null;
}

/**
 * @param {number} num
 */
export function knotsToMs(num) {
    return num * 0.514444;
}

/**
 * Calculate the cloud base altitude in meters from the surface temperature and dew point temperature.
 * https://en.wikipedia.org/wiki/Cloud_base
 *
 * @param {number} temp - The surface temperature in Celsius.
 * @param {number} dewPoint - The dew point temperature in Celsius.
 * @return {number} - The estimated cloud base altitude in meters.
 */
export function calculateCloudBase(temp, dewPoint) {
    // Calculate the difference between the surface temperature and the dew point temperature
    const deltaT = temp - dewPoint;

    // Estimate the cloud base altitude in meters
    const cloudBaseAltitude = 125 * deltaT;

    // Round to the nearest 100 meters
    return Math.round(cloudBaseAltitude / 100) * 100;
}

/**
 * @param {number} value
 * @param {string} unit
 * @returns {number}
 */
export function toMeters(value, unit) {
    if (unit === "hft") {
        return value * 30.48;
    }

    if (unit === "ft") {
        return value * 0.3048;
    }

    return value;
}

/**
 * @param {string} url
 * @param {Object} [options]
 * @param {Record<string, string>} [options.headers]
 */
export async function fetchJSON(url, options) {
    const { hostname, pathname, search } = new URL(url);
    const res = await fetch(url, {
        headers: options?.headers,
    });

    if (!res.ok) {
        const errorEvent = new CustomEvent("fetchjsonerror", {
            detail: {
                message: `Virhe ${hostname} API:ssa: ${res.status}, parametrit: ${pathname}?${search}`,
            },
        });
        document.dispatchEvent(errorEvent);
        return;
    }

    return await res.json();
}

/**
 * @param {number} degrees
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * @param {[number,number]|string} coord1
 * @param {[number,number]|string} coord2
 */
export function coordinateDistance(coord1, coord2) {
    const R = 6371000; // Earth's radius in meters

    if (typeof coord1 === "string") {
        coord1 = /** @type {[number, number]} */ (
            coord1.split(",").map(Number)
        );
    }

    if (typeof coord2 === "string") {
        coord2 = /** @type {[number, number]} */ (
            coord2.split(",").map(Number)
        );
    }

    const lat1 = toRadians(coord1[0]);
    const lon1 = toRadians(coord1[1]);
    const lat2 = toRadians(coord2[0]);
    const lon2 = toRadians(coord2[1]);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}
