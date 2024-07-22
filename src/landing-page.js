// @ts-check
const usingBackButton =
    window.performance?.navigation.type ===
    window.performance.navigation.TYPE_BACK_FORWARD;

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
