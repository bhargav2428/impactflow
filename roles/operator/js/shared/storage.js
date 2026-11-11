export const STORAGE_KEY = "nims-state-v2";

export const loadState = (seed) => JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || seed();
export const saveState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
