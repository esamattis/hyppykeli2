// @ts-check
import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import { html } from "htm/preact";
import { Chart } from "chart.js";

import {
    FORECASTS,
    OBSERVATIONS,
    HOVERED_OBSERVATION,
    FORECAST_DATE,
    STALE_FORECASTS,
} from "./data.js";
import { formatClock, formatDate, humanDayText } from "./utils.js";

/**
 * @param {Chart} obs
 * @param {Chart} fore
 */
function updateCharts(obs, fore) {
    obs.data.labels = OBSERVATIONS.value
        .map((point) => formatClock(point.time))
        .reverse();
    fore.data.labels = FORECASTS.value.map((point) => formatClock(point.time));

    const shared = {
        spanGaps: true,
        borderJoinStyle: "round",
        pointRadius: 0,
        borderWidth: 2,
        pointHoverRadius: 10,
    };

    /**
     * @param {WeatherData[]} data
     */
    const createWarningLines = (data) => [
        {
            label: "B+ Kelpparit",
            data: data.map(() => 11),
            borderColor: "red",
            pointRadius: 0,
        },
        {
            label: "Oppilaat",
            data: data.map(() => 8),
            borderColor: "orange",
            pointRadius: 0,
        },
    ];

    obs.data.datasets = [
        {
            ...shared,
            label: "Puuska (m/s)",
            data: OBSERVATIONS.value.map((obs) => obs.gust).reverse(),
            borderColor: "blue",
        },
        {
            ...shared,
            label: "Tuuli (m/s)",
            data: OBSERVATIONS.value.map((obs) => obs.speed).reverse(),
            borderColor: "lightblue",
        },
        ...createWarningLines(OBSERVATIONS.value),
    ];

    fore.data.datasets = [
        {
            ...shared,
            label: "Puuskaennuste (m/s)",
            data: FORECASTS.value.map((obs) => obs.gust),
            borderColor: "blue",
            cubicInterpolationMode: "monotone",
            borderDash: [5, 5],
            borderWidth: 5,
        },
        {
            ...shared,
            label: "Tuuli (m/s)",
            data: FORECASTS.value.map((obs) => obs.speed),
            borderColor: "lightblue",
            cubicInterpolationMode: "monotone",
            borderDash: [5, 5],
            borderWidth: 5,
        },
        ...createWarningLines(FORECASTS.value),
    ];

    // "none" disables the update animation.
    // It is too flashy when the array is fully replaced.
    obs.update("none");
    fore.update("none");
}

export function Graph() {
    const obsChartRef = useRef(null);
    const foreChartRef = useRef(null);

    useEffect(() => {
        /**
         * @type {any}
         */
        const options = {
            type: "line",
            data: {
                labels: [],
                datasets: [],
            },
            options: {
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    axis: "x",
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        };

        if (!obsChartRef.current || !foreChartRef.current) {
            console.error("Chart references are not initialized.");
            return;
        }

        const obsOptions = structuredClone(options);
        const foreOptions = structuredClone(options);

        const obsChart = new Chart(obsChartRef.current, obsOptions);
        const foreChart = new Chart(foreChartRef.current, foreOptions);

        obsChart.options.onHover = createHoverHandler(OBSERVATIONS, true);
        foreChart.options.onHover = createHoverHandler(FORECASTS, false);

        effect(() => {
            updateCharts(obsChart, foreChart);
        });

        return () => {
            obsChart.destroy();
            foreChart.destroy();
        };
    }, []);

    const onMouseLeaveObs = () => {
        HOVERED_OBSERVATION.value = undefined;
    };

    return html`
        <div id="observations-graph">
            <h2>
                Havainnot
                <span class="date"> ${formatDate(new Date())} </span>
            </h2>
            <div class="chart" onMouseLeave=${onMouseLeaveObs}>
                <canvas ref=${obsChartRef}></canvas>
            </div>
        </div>

        <div id="forecasts-graph">
            <h2>
                Ennusteet
                <span class="date">
                    ${formatDate(FORECAST_DATE.value)} ${" "}
                    ${humanDayText(FORECAST_DATE.value)}
                </span>
            </h2>

            <div
                class=${STALE_FORECASTS.value ? "chart stale" : "chart fresh"}
                onMouseLeave=${onMouseLeaveObs}
            >
                <canvas ref=${foreChartRef}></canvas>
            </div>
        </div>
    `;
}

/**
 * @param {Signal<WeatherData[]>} signal
 * @param {boolean} reverse
 */
function createHoverHandler(signal, reverse) {
    /**
     * @param {import("chart.js").ChartEvent} event
     * @param {import("chart.js").ActiveElement[]} elements
     * @param {Chart} chart
     */
    const onHover = (event, elements, chart) => {
        const points = chart.getElementsAtEventForMode(
            // @ts-ignore
            event,
            "index",
            {
                axis: "x",
                intersect: false,
            },
            false,
        );

        let index = points[0]?.index;
        if (index !== undefined) {
            if (reverse) {
                index = signal.value.length - index - 1;
            }

            const obs = signal.value[index];
            if (obs) {
                HOVERED_OBSERVATION.value = obs;
            }
        }
    };

    return onHover;
}
