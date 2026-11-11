// Small wrapper around localStorage. Storage can be unavailable (privacy modes,
// blocked cookies), so every call fails quietly and the app keeps working in memory.

const KEY = 'bezel:v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}
