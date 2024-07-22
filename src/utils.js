// @ts-check

import { Component, html } from "htm/preact";
import { Fragment } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { QUERY_PARAMS } from "./data.js";

/**
 * Logs the provided arguments to the console when the query string contains debug=1
 * @param {...any} args - The arguments to log.
 */
export function debug(...args) {
    if (QUERY_PARAMS.value.debug) {
        console.log(...args);
    }
}

/**
 * @param {Object} props
 * @param {any} props.children
 * @param {any} props.label
 */
export function Help(props) {
    /** @type {import('preact').RefObject<HTMLDialogElement>} */
    const ref = useRef(null);

    const open = () => {
        ref.current?.showModal();
    };

    const close = () => {
        ref.current?.close();
    };

    return html`
        <button class="help" type="button" onClick=${open}>
            ${props.label ?? "Ohje"}
        </button>
        <dialog ref=${ref}>
            <div class="help-content">${props.children}</div>
            <div>
                <button type="button" onClick=${close}>Sulje</button>
            </div>
        </dialog>
    `;
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

export class ErrorBoundary extends Component {
    /**
     * @param {Object} props
     * @param {any} props.children
     * @param {any} props.fallback
     */
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    /**
     * @param {Error} error
     * @param {import('preact').ErrorInfo} errorInfo
     */
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ??
                html`
                    <div>Tässä tapahtui virhe :(</div>
                `
            );
        }

        return this.props.children;
    }
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
        setState(setter());
        const interval = setInterval(() => {
            setState(setter());
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [setter]);

    return state;
}

/**
 * @param {Object} props
 * @param {Date} [props.date]
 */
export function FromNow(props) {
    const createFromNow = useCallback(() => {
        if (!props.date) {
            return "";
        }

        const diffInMinutes = Math.round(
            -(Date.now() - props.date.getTime()) / 1000 / 60,
        );

        if (Math.abs(diffInMinutes) > 120) {
            const diffInHours = Math.round(diffInMinutes / 60);
            return new Intl.RelativeTimeFormat("fi").format(
                diffInHours,
                "hours",
            );
        }

        return new Intl.RelativeTimeFormat("fi").format(
            diffInMinutes,
            "minutes",
        );
    }, [props.date]);

    if (!props.date) {
        return null;
    }

    const fromNow = useInterval(createFromNow);

    return html`
        <span class="from-now">${fromNow}</span>
        ${" "}
        <small>(klo ${formatClock(props.date)})</small>
    `;
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

/**
 * @param {Object} props
 * @param {any} props.children
 */
export function ResizeRecreate({ children }) {
    const [key, setKey] = useState(0);

    useEffect(() => {
        /** @type {ReturnType<typeof setTimeout> | null} */
        let timer = null;

        const handleResize = () => {
            if (timer) {
                clearTimeout(timer);
            }

            timer = setTimeout(() => {
                setKey((prevKey) => prevKey + 1);
            }, 1000);
        };

        window.addEventListener("resize", handleResize, {
            passive: true,
        });

        return () => {
            if (timer) {
                clearTimeout(timer);
            }
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    return html`<${Fragment} key=${key}>${children}</${Fragment}>`;
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
export function isValidObservation(obs) {
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

    return cloudBaseAltitude;
}
