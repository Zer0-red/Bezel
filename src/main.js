import { DEVICES, DEFAULT_DEVICE_IDS } from './devices.js';

// Placeholder entry point. The real UI (address bar, device bar, grid and focus views)
// will be built here in the next step.
const app = document.querySelector('#app');
app.textContent = `Bezel is set up — ${DEVICES.length} device presets loaded, ${DEFAULT_DEVICE_IDS.length} shown by default.`;
