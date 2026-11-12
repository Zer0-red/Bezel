# Working on Bezel

Bezel is one interface (Vite, plain JavaScript) shipped two ways: the web version on GitHub Pages and a Windows app built with Electron.

## Run it

Requirements: Node.js 20 or later.

```bash
git clone https://github.com/Zer0-red/Bezel.git
cd Bezel
npm install
npm run dev        # web version at http://localhost:5173
npm run app        # Windows app from the same code
```

## Build

```bash
npm run build      # web version → dist/
npm run dist:win   # Windows installer → release/ (run on Windows)
```

## Branches and versions

Work happens on `staging`; `main` is what people get. Every push to `main` publishes the web version (the `Deploy to GitHub Pages` workflow, with Pages set to **Source: GitHub Actions**).

Every update adds 0.0.1 to the version with `npm run version:bump`, and each digit rolls over at 9 (`0.1.9 → 0.2.0`). The version shows next to the name, top left.

## Try a test build of the app

Every push to `staging` builds the installer without publishing it (about 5 minutes). On GitHub, open **Actions → Test build (Windows)**, pick the latest run and download `Bezel-Setup-test-…` under **Artifacts** (it's a zip). A test build installs like the real app and updates to the next real release.

## Release the app

1. Run `npm run version:bump` and write what changed in `build/release-notes.md`.
2. Merge to `main`.
3. On GitHub, open **Actions → Release Windows app → Run workflow** on `main`.

The workflow creates the `vX.Y.Z` release, builds the installer on Windows, attaches it (also as `Bezel-Setup.exe`, which the README's download link points to) and publishes it. Installed apps pick it up by themselves.

## Where things are

```
index.html                 Toolbar, device bar, desk, menus and the device library
src/main.js                State, devices on the desk, shortcuts, updates, screenshots
src/picker.js              Device bar, setups menu and device library
src/swap-menu.js           The menu under a device's name, to swap it for another
src/address-list.js        Favorites and recent sites under the address bar
src/screenshot.js          Screenshots in the web version
src/devices.js             Device sizes, popular sizes (StatCounter) and setups
src/frames.js              The drawing of each device (bezels, notch, stand)
src/emulation.js           Phone and tablet emulation in the app
src/sync.js                Synced scrolling in the app
public/sync.js             Synced scrolling helper for sites in the web version
src/styles.css             All styles, with the dark and light colours at the top
electron/main.cjs          The app: window, device views, emulation, updates
electron/preload.cjs       The small bridge between the interface and the app
build/icon.svg             The app icon (build/icon.png is rendered from it)
```

## Device sizes

Sizes are CSS pixels at each device's default display setting, the numbers your media queries see. On phones the page is that size minus the status bar. Popular sizes come from [StatCounter](https://gs.statcounter.com/screen-resolution-stats); refresh them by editing the `POPULAR` lists in `src/devices.js`.
