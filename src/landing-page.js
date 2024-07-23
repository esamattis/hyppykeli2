// @ts-check

import { coordinateDistance, fetchJSON } from "./utils.js";

/**
 * @param {[number, number]} coordinates
 */
export async function findClosestRoadStation(coordinates) {
    /** @type {RoadStations|undefined} */
    const stations = await fetchJSON(
        "https://tie.digitraffic.fi/api/weather/v1/stations",
        {
            headers: {
                "Digitraffic-User": "hyppykeli.fi",
            },
        },
    );

    const closest = stations?.features.reduce((prev, curr) => {
        if (!prev) {
            return curr;
        }

        const prevDistance = coordinateDistance(coordinates, [
            prev.geometry.coordinates[1],
            prev.geometry.coordinates[0],
        ]);

        const currDistance = coordinateDistance(coordinates, [
            curr.geometry.coordinates[1],
            curr.geometry.coordinates[0],
        ]);

        return prevDistance < currDistance ? prev : curr;
    }, stations.features[0]);

    return closest;
}

export function redirectToDz() {
    const params = new URLSearchParams(window.location.search);
    const redirectName =
        new URLSearchParams(window.location.search).get("dz") ??
        localStorage.getItem("previous_dz");

    if (params.has("no_redirect")) {
        localStorage.removeItem("previous_dz");
        params.delete("no_redirect");
        history.replaceState(null, "", "?" + params.toString());
        return;
    }

    const usingBackButton =
        window.performance?.navigation.type ===
        window.performance.navigation.TYPE_BACK_FORWARD;

    if (usingBackButton || !redirectName) {
        return;
    }

    /** @type {QueryParams[]} */
    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem("saved_dzs") ?? "[]");
    } catch {}

    const savedDz = saved.find((s) => s.name === redirectName);

    if (savedDz) {
        const qs = new URLSearchParams(
            // @ts-ignore
            savedDz,
        );
        window.location.href = `/dz/?${qs.toString()}`;
        return;
    }

    const dz = Array.from(document.querySelectorAll(".dz-list a")).find(
        (a) => a.textContent?.trim() === redirectName,
    );

    if (dz instanceof HTMLAnchorElement) {
        window.location.href = dz.href;
        return;
    }
}

/**
 * @param {string} name
 * @param {string|number} value
 */
function fillInputByName(name, value) {
    const input = document.querySelector(`input[name="${name}"]`);
    if (input instanceof HTMLInputElement) {
        input.value = value.toString();
    }
}

document.getElementById("get-location")?.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLButtonElement)) {
        return;
    }

    el.disabled = true;
    navigator.geolocation.getCurrentPosition((position) => {
        el.disabled = false;

        fillInputByName("lat", position.coords.latitude);
        fillInputByName("lon", position.coords.longitude);

        findClosestRoadStation([
            position.coords.latitude,
            position.coords.longitude,
        ]).then((station) => {
            if (!station) {
                return;
            }
            fillInputByName("name", station.properties.name);
            fillInputByName("roadsid", station.id);
        });
    });
});
