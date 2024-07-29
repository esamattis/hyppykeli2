// @ts-check

import { Component, html } from "htm/preact";
import { Fragment } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { formatClock } from "./utils.js";

/**
 * @param {Object} props
 * @param {any} [props.children]
 * @param {any} props.label
 * @param {string} [props.id]
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
        <button class="help" type="button" onClick=${open} id=${props.id}>
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
