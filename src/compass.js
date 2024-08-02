// @ts-check
import { html } from "htm/preact";
import { h } from "preact";
import {
    HOVERED_OBSERVATION,
    LATEST_OBSERVATION,
    OBSERVATIONS,
    QUERY_PARAMS,
    WIND_VARIATIONS,
} from "./data.js";
import { isNullish, hasValidWindData } from "./utils.js";
import { FromNow, Help } from "./components.js";

// Constants for needle length calculation
const MIN_NEEDLE_LENGTH = 30;
const MAX_NEEDLE_LENGTH = 170;
const STUDENT_LIMIT_LENGTH = 110;
const INSTRUCTOR_LIMIT_LENGTH = 150;
const STUDENT_WIND_SPEED = 8;
const INSTRUCTOR_WIND_SPEED = 11;
const MAX_WIND_SPEED = 11.9;

/**
 * Linearly converts a value from one range to another range.
 *
 * @param {number} value - The value to be converted, originally in the input range.
 * @param {number} inMin - The minimum value of the input range.
 * @param {number} inMax - The maximum value of the input range.
 * @param {number} outMin - The minimum value of the output range.
 * @param {number} outMax - The maximum value of the output range.
 * @returns {number} The converted value in the output range.
 */
function convertRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Calculates the needle length based on wind gust speed
 * @param {number} gust - Wind gust speed in m/s
 * @returns {number} Needle length in pixels
 */
function calculateNeedleLength(gust) {
    if (gust == 0) {
        return MIN_NEEDLE_LENGTH;
    } else if (gust <= STUDENT_WIND_SPEED) {
        return Math.max(
            MIN_NEEDLE_LENGTH,
            convertRange(
                gust,
                0,
                STUDENT_WIND_SPEED,
                MIN_NEEDLE_LENGTH,
                STUDENT_LIMIT_LENGTH,
            ),
        );
    } else if (gust <= INSTRUCTOR_WIND_SPEED) {
        return convertRange(
            gust,
            STUDENT_WIND_SPEED,
            INSTRUCTOR_WIND_SPEED,
            STUDENT_LIMIT_LENGTH,
            INSTRUCTOR_LIMIT_LENGTH,
        );
    } else if (gust <= MAX_WIND_SPEED) {
        return convertRange(
            gust,
            INSTRUCTOR_WIND_SPEED,
            MAX_WIND_SPEED,
            INSTRUCTOR_LIMIT_LENGTH,
            MAX_NEEDLE_LENGTH,
        );
    } else {
        return MAX_NEEDLE_LENGTH;
    }
}

export function Compass() {
    const rc = parseInt(QUERY_PARAMS.value.rc ?? "0", 10);
    const rotation = isNaN(rc) ? 0 : rc; // Default to 0 degrees if invalid
    const circle = INSTRUCTOR_LIMIT_LENGTH;
    const studentCircle = STUDENT_LIMIT_LENGTH;
    const latestObservation = OBSERVATIONS.value[0];

    // prettier-ignore
    return html`
        <div class="compass">
            <svg
                style="transform: rotate(${rotation}deg); transform-origin: center;"
                viewBox="0 0 400 400"
                xmlns="http://www.w3.org/2000/svg">

              <!-- Circle for compass outline -->
              <circle cx="200" cy="200" r=${circle} stroke="black" stroke-width="2" fill="none" />
              <circle cx="200" cy="200" r=${studentCircle} stroke="orange" stroke-width="2" fill="none" />

              <!-- Directions Text -->
              <text x="200" y="40" font-weight="bold" font-family="monospace" font-size="40" text-anchor="middle" fill="black">N</text>
              <text x="20" y="210" font-weight="bold" font-family="monospace" font-size="40" text-anchor="middle" fill="black">W</text>
              <text x="200" y="390" font-weight="bold" font-family="monospace" font-size="40" text-anchor="middle" fill="black">S</text>
              <text x="380" y="210" font-weight="bold" font-family="monospace" font-size="40" text-anchor="middle" fill="black">E</text>
              <${HistoryNeedles} />
              <${GustNeedle} />
              <${WindVariations} />
              <text
                    x="200"
                    y="170"
                    font-size="24"
                    text-anchor="middle"
                    fill="black"
                    font-weight="bold"
                    class="compass-observations-gust"
                    style="transform: rotate(-${rotation}deg); transform-origin: center;"
                >
                    ${latestObservation ? latestObservation.gust + " m/s" : ""}
                </text>
                <text
                    x="200"
                    y="240"
                    font-size="20"
                    text-anchor="middle"
                    fill="black"
                    class="compass-observations-speed"
                    style="transform: rotate(-${rotation}deg); transform-origin: center;"
                >
                    ${latestObservation ? latestObservation.speed + " m/s" : ""}
                </text>

            </svg>

            <p class="compass-time">
                <${FromNow} date=${HOVERED_OBSERVATION.value?.time} />
            </p>

            <${Help}>
                <p>
                    Kompassin nuoli kertoo tuulen suunnan ja pituus tuulen puuskan. Oranssi
                    ympyrä on oppilasraja (8 m/s) ja musta ympyrä on kelppariraja (11 m/s).
                </p>

                <p>
                    Värillinen kaari osoittaa tuulen vaihtelun 30 minuutin aikana:
                </p>

                <ul>
                    <li>Vihreä: Oletusväri, kun vaihtelu on alle 45 astetta ja puuska on alle 50 % suurempi kuin keskimääräinen tuuli.</li>
                    <li>Oranssi: Kun vaihtelu on 45-90 astetta tai puuska on 50-100 % suurempi kuin keskimääräinen tuuli. Kaari on tässä tapauksessa 10px leveämpi.</li>
                    <li>Punainen: Kun vaihtelu on yli 90 astetta tai puuska on 100 % tai enemmän suurempi kuin keskimääräinen tuuli. Kaari on tässä tapauksessa 20px leveämpi.</li>
                </ul>
            </${Help}>
        </div>
    `;
}

/**
 * @param {object} props
 * @param {number} props.direction
 * @param {number} props.gust
 * @param {string} props.color
 */
function NeedlePolygon(props) {
    const needleLength = calculateNeedleLength(props.gust);
    return html`
        <polygon
            points=${`190,${200 - needleLength} 210,${200 - needleLength} 220,200 180,200`}
            fill=${props.color}
            transform=${`rotate(${props.direction - 180}, 200, 200)`}
        />
    `;
}

function GustNeedle() {
    const history = !!HOVERED_OBSERVATION.value;
    const obs = HOVERED_OBSERVATION.value ?? LATEST_OBSERVATION.value;

    // When using metar based observations, gust might not be available.
    // Fall back to speed in that case.
    const gust = obs?.gust ?? obs?.speed;

    if (isNullish(gust) || isNullish(obs?.direction)) {
        return null;
    }

    if (!hasValidWindData(obs)) {
        return null;
    }

    const needleColor = gust > MAX_WIND_SPEED ? "black" : "red";

    return html`
        <g className="${history ? "historic" : ""}">
            ${h(NeedlePolygon, {
                gust,
                direction: obs.direction,
                color: needleColor,
            })}
            <!-- Center Point -->
            <circle cx="200" cy="200" r="10" fill="black" />
        </g>
    `;
}

function HistoryNeedles() {
    const observations = OBSERVATIONS.value.flatMap((obs) => {
        if (isNullish(obs.gust) || isNullish(obs.direction)) {
            return [];
        }

        if (!hasValidWindData(obs)) {
            return [];
        }

        const age = Date.now() - obs.time.getTime();
        if (age > 3600000) {
            return [];
        }

        return {
            gust: obs.gust,
            direction: obs.direction,
        };
    });

    return html`
        <g>
            ${observations.map((obs) =>
                h(NeedlePolygon, {
                    direction: obs.direction,
                    gust: obs.gust,
                    color: "rgba(0, 0, 0, 0.01)",
                }),
            )}
        </g>
    `;
}

const BASE_ARC_WIDTH = 20; // Base width of the variation arc in pixels

function WindVariations() {
    const variations = WIND_VARIATIONS.value;

    if (!variations) {
        return null;
    }

    const { variationRange, averageDirection, color, extraWidth } = variations;
    const radius = INSTRUCTOR_LIMIT_LENGTH; // Radius of the compass circle
    const arcWidth = BASE_ARC_WIDTH + (extraWidth || 0);
    const outerRadius = radius; // Always use the compass radius as the outer radius
    const innerRadius = radius - arcWidth;

    // Calculate the start and end angles for the arc
    let startAngle = (averageDirection + 180 - variationRange / 2 + 360) % 360;
    let endAngle = (averageDirection + 180 + variationRange / 2 + 360) % 360;

    // Adjust for crossing the 0-degree mark
    if (startAngle > endAngle) {
        endAngle += 360; // Extend endAngle for correct arc drawing
    }

    // Convert angles to radians for SVG coordinates
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    // Calculate the coordinates for the arc path
    const startOuterX = 200 + outerRadius * Math.cos(startRad);
    const startOuterY = 200 + outerRadius * Math.sin(startRad);
    const endOuterX = 200 + outerRadius * Math.cos(endRad);
    const endOuterY = 200 + outerRadius * Math.sin(endRad);
    const startInnerX = 200 + innerRadius * Math.cos(endRad);
    const startInnerY = 200 + innerRadius * Math.sin(endRad);
    const endInnerX = 200 + innerRadius * Math.cos(startRad);
    const endInnerY = 200 + innerRadius * Math.sin(startRad);

    return html`
        <g>
            <path
                d=${`M ${startOuterX} ${startOuterY}
                    A ${outerRadius} ${outerRadius} 0 0 1 ${endOuterX} ${endOuterY}
                    L ${startInnerX} ${startInnerY}
                    A ${innerRadius} ${innerRadius} 0 0 0 ${endInnerX} ${endInnerY} Z`}
                fill=${color}
                fill-opacity="0.2"
                stroke=${color}
                stroke-width="1"
            />
        </g>
    `;
}
