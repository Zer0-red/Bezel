// Screenshots in the web version. A page can't read what other sites show in
// its frames, so the browser records this tab instead (Chrome and Edge ask
// first), cropped to the desk, and one frame is cut to the devices.
// The Windows app captures its own window directly (electron/main.cjs).

/** Chrome and Edge can record this tab and crop it to an element (Region Capture). */
export const canCaptureTab = () => typeof window.CropTarget !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/**
 * One picture of `area()` (viewport CSS pixels, inside `stage`) as a PNG blob.
 * Rejects with a NotAllowedError when the person doesn't share the tab.
 */
export async function captureTab(stage, area) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  });
  const [track] = stream.getVideoTracks();
  try {
    // Only the desk is recorded; this fails if another tab or window was chosen.
    await track.cropTo(await window.CropTarget.fromElement(stage));
    const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: stream });
    const stopPainting = keepPainting(stage);
    try {
      await withTimeout(video.play(), 5000);
      await settle(video, stage);
    } finally {
      stopPainting();
    }

    const box = stage.getBoundingClientRect();
    const a = area();
    const sx = video.videoWidth / box.width;
    const sy = video.videoHeight / box.height;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(a.width * sx);
    canvas.height = Math.round(a.height * sy);
    canvas.getContext('2d').drawImage(video, (a.x - box.left) * sx, (a.y - box.top) * sy, a.width * sx, a.height * sy, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png'));
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('The tab recording sent no picture')), ms))]);

// Chrome only sends a new picture when something on the page changes. An
// invisible dot in the desk's corner changes every frame while we wait.
function keepPainting(stage) {
  const box = stage.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:2px;height:2px;background:#808080;opacity:0.01;pointer-events:none`;
  document.body.append(dot);
  let frame = 0;
  let odd = false;
  const tick = () => {
    odd = !odd;
    dot.style.opacity = odd ? '0.02' : '0.01';
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    dot.remove();
  };
}

// Wait until the recording shows the cropped desk: Chrome's "sharing this tab"
// bar can resize the page first, and frames only arrive when something changes.
async function settle(video, stage) {
  const deadline = performance.now() + 2500;
  await sleep(250);
  while (performance.now() < deadline) {
    const box = stage.getBoundingClientRect();
    if (video.videoWidth && Math.abs(video.videoWidth / video.videoHeight - box.width / box.height) < 0.02) break;
    await sleep(60);
  }
  await nextPaint();
}

/** Saves a blob as a file, when the clipboard is not available. */
export function download(blob, name) {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
