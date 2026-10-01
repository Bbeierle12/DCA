/**
 * Feature flags. Defaults come from PLAN.md decisions; `?flag=1` / `?flag=0` in the URL
 * overrides one for a session (handy for testing a parked feature).
 */
function flag(name: string, fallback: boolean): boolean {
    try {
        const value = new URLSearchParams(window.location.search).get(name);
        if (value === '1' || value === 'true') return true;
        if (value === '0' || value === 'false') return false;
    } catch {
        // no window (tests, workers)
    }
    return fallback;
}

export const FEATURES = {
    /** D4: combat is parked; code and tests stay, the game hides it. */
    combat: flag('combat', false),
};
