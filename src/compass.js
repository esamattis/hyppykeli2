// @ts-check
import { html } from "htm/preact";
import { HOVERED_OBSERVATION, OBSERVATIONS, WIND_VARIATIONS } from "./data.js";
import { Help } from "./utils.js";

/**
 * Linearly converts a value from one range to another range in a reversed manner.
 *
 * @param {number} value - The value to be converted, originally in the input range.
 * @param {number} inMin - The minimum value of the input range.
 * @param {number} inMax - The maximum value of the input range.
 * @param {number} outMin - The minimum value of the output range.
 * @param {number} outMax - The maximum value of the output range.
 * @returns {number} The converted value in the reversed output range.
 */
function convertRangeReversed(value, inMin, inMax, outMin, outMax) {
    return ((inMax - value) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

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

export function Compass() {
    const circle = 150;
    const studentCirle = convertRange(8, 0, 11, 0, circle);
    // prettier-ignore
    return html`
        <div class="compass">
            <svg
                width="200"
                height="200"
                viewBox="0 0 400 400"
                xmlns="http://www.w3.org/2000/svg">

              <!-- Circle for compass outline -->
              <circle cx="200" cy="200" r=${circle} stroke="black" stroke-width="2" fill="none" />
              <circle cx="200" cy="200" r=${studentCirle} stroke="orange" stroke-width="2" fill="none" />

              <!-- Directions Text -->
              <text x="200" y="40" font-size="40" text-anchor="middle" fill="black">N</text>
              <text x="20" y="210" font-size="40" text-anchor="middle" fill="black">W</text>
              <text x="200" y="390" font-size="40" text-anchor="middle" fill="black">S</text>
              <text x="380" y="210" font-size="40" text-anchor="middle" fill="black">E</text>
              <${Needle} />
              <${WindVariations} />


            </svg>

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

export function FullScreenCompass() {
    return html`
        <div class="fullscreen-compass">
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 400"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
            >
                <!-- Circle for compass outline -->
                <circle
                    cx="200"
                    cy="200"
                    r="150"
                    stroke="black"
                    stroke-width="2"
                    fill="none"
                />
                <circle
                    cx="200"
                    cy="200"
                    r="109.09"
                    stroke="orange"
                    stroke-width="2"
                    fill="none"
                />

                <!-- Directions Text -->
                <text
                    x="200"
                    y="40"
                    font-size="40"
                    text-anchor="middle"
                    fill="black"
                >
                    N
                </text>
                <text
                    x="20"
                    y="210"
                    font-size="40"
                    text-anchor="middle"
                    fill="black"
                >
                    W
                </text>
                <text
                    x="200"
                    y="390"
                    font-size="40"
                    text-anchor="middle"
                    fill="black"
                >
                    S
                </text>
                <text
                    x="380"
                    y="210"
                    font-size="40"
                    text-anchor="middle"
                    fill="black"
                >
                    E
                </text>
                <${Needle} />
                <${WindVariations} />
            </svg>
        </div>
    `;
}

function Needle() {
    const history = !!HOVERED_OBSERVATION.value;
    const point = HOVERED_OBSERVATION.value ?? OBSERVATIONS.value[0];

    if (!point) {
        return null;
    }

    const needleLength = convertRangeReversed(point.gust, 0, 11, 50, 170);

    return html`
        <g className="${history ? "historic" : ""}">
            <polygon
                points=${`200,${needleLength} 190,200 210,200`}
                fill="red"
                transform=${`rotate(${point.direction - 180}, 200, 200)`}
            />
            <!-- Center Point -->
            <circle cx="200" cy="200" r="10" fill="black" />
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
    const radius = 150; // Radius of the compass circle
    const arcWidth = BASE_ARC_WIDTH + (extraWidth || 0);
    const outerRadius = radius + arcWidth / 2;
    const innerRadius = radius - arcWidth / 2;

    // Calculate the start and end angles for the arc
    const startAngle = (averageDirection - variationRange / 2 + 360) % 360;
    const endAngle = (averageDirection + variationRange / 2) % 360;

    // Convert angles to radians
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

    // Determine if the arc should be drawn the long way around
    const longArc = variationRange > 180 ? 1 : 0;

    return html`
        <g>
            <path
                d=${`M ${startOuterX} ${startOuterY}
                    A ${outerRadius} ${outerRadius} 0 ${longArc} 1 ${endOuterX} ${endOuterY}
                    L ${startInnerX} ${startInnerY}
                    A ${innerRadius} ${innerRadius} 0 ${longArc} 0 ${endInnerX} ${endInnerY} Z`}
                fill=${color}
                fill-opacity="0.2"
                stroke=${color}
                stroke-width="1"
            />
        </g>
    `;
}
