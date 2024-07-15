// @ts-check

import { Component, html } from "htm/preact";
import { Fragment } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

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
                this.props.fallback ?? html`<div>Tässä tapahtui virhe :(</div>`
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

    return html`<span class="from-now">${fromNow}</span>
        <small> (klo ${formatClock(props.date)}) </small> `;
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
                console.log("Resizing");
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
    body {
        display: grid;
        justify-content: center;
        align-items: center;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto;
        height: 100vh;
        margin: 0;
        padding: 20px;
        box-sizing: border-box;
        gap: 20px;
        overflow-y: hidden;
    }

    .side-scroll {
        overflow-x: unset !important;
        overflow-y: unset !important;
    }

    #high-winds-today {
        grid-column: 1/2;
        grid-row: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .compass {
        grid-column: 2/3;
        grid-row: 1;
        width: 100%;
        max-width: 450px;
        margin: auto;
        box-shadow: unset !important;
        top: unset !important;
    }

    #observations-graph {
        grid-column: 1/3;
        grid-row: 2;
        overflow: auto;
    }

    .chart {
        height: clamp(200px, 40vh, 300px);
    }

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
    h2 {
        display: none;
    }

    .compass-observations-gust,
    .compass-observations-speed {
        display: inline;
    }

    `;
