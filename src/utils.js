// @ts-check

import { html } from "htm/preact";
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
