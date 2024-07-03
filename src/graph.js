// @ts-check
import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import { html } from "htm/preact";
import { Chart } from "chart.js";

import {
    FORECASTS,
    OBSERVATIONS,
    NAME,
    LATLONG,
    HOVERED_OBSERVATION,
} from "./data.js";

/**
 * @param {Chart} obs
 * @param {Chart} fore
 */
function updateCharts(obs, fore) {
    obs.data.labels = OBSERVATIONS.value
        .map((point) => point.time.toLocaleTimeString())
        .reverse();
    fore.data.labels = FORECASTS.value.map((point) =>
        point.time.toLocaleTimeString(),
    );

    const shared = {
        spanGaps: true,
        borderJoinStyle: "round",
        pointRadius: 0,
        borderWidth: 2,
        pointHoverRadius: 10,
    };

    /**
     * @param {import("./data.js").WeatherData[]} data
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

    obs.update();
    fore.update();
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

    return html`<div class="graphs">
        <h2 id="observation-graph">Havainnot</h2>
        <div class="chart" onMouseLeave=${onMouseLeaveObs}>
            <canvas ref=${obsChartRef}></canvas>
        </div>
        <h2 id="forecast-graph">Ennusteet</h2>
        <div class="chart" onMouseLeave=${onMouseLeaveObs}>
            <canvas ref=${foreChartRef}></canvas>
        </div>
    </div>`;
}

/**
 * @typedef {import('@preact/signals').Signal<T>} Signal<T>
 * @template {any} T
 */

/**
 * @param {Signal<import("./data.js").WeatherData[]>} signal
 * @param {boolean} reverse
 */
function createHoverHandler(signal, reverse) {
    /** @type {ReturnType<typeof setTimeout>} */
    // let timer;

    /**
     * @param {import("chart.js").ChartEvent} event
     * @param {import("chart.js").ActiveElement[]} elements
     * @param {Chart} chart
     */
    const onHover = (event, elements, chart) => {
        // clearTimeout(timer);

        // // Automatically clear hover after a timeout. On mobile devices the state can get stuck
        // timer = setTimeout(() => {
        //     HOVERED_OBSERVATION.value = undefined;
        // }, 10_000);

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
                console.log("value", obs.gust);
                HOVERED_OBSERVATION.value = obs;
            }
        }
    };

    return onHover;
}
