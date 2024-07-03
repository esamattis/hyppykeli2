// @ts-check
import { html } from "htm/preact";
import { HOVERED_OBSERVATION, OBSERVATIONS } from "./data.js";
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


            </svg>

            <${Help}>
                Kompassin nuoli kertoo tuulen suunnan ja pituus tuulen puuskan. Oranssi
                ympyrä on oppilasraja (8 m/s) ja musta ympyrä on kelppariraja (11 m/s).
            </${Help}>
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
                transform=${`rotate(${point.direction}, 200, 200)`}
            />
            <!-- Center Point -->
            <circle cx="200" cy="200" r="10" fill="black" />
        </g>
    `;
}
