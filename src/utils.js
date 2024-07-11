// @ts-check

import { Component, html } from "htm/preact";
import { useRef, useState } from "preact/hooks";

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
