# Working on Bezel

Bezel is one interface (Vite, plain JavaScript) shipped two ways: the web version on GitHub Pages and a desktop app for Windows and Linux built with Electron.

## Run it

Requirements: Node.js 20 or later.

```bash
git clone https://github.com/Zer0-red/Bezel.git
cd Bezel
npm install
npm run dev        # web version at http://localhost:5173
npm run app        # desktop app from the same code
```

## Build

```bash
npm run build      # web version → dist/
npm run dist:win   # Windows installer → release/ (run on Windows)
npm run dist:linux # AppImage and .deb → release/ (run on Linux)
```

## Tests

```bash
npm test           # builds, then unit tests, the web version in Chrome and the app in Electron
npm run test:web   # just the web version
npm run test:app   # just the app
```

On Linux without a screen, run them under a virtual display: `xvfb-run -a npm test`. To run the app tests against a packaged build instead of the source, point them at it: `BEZEL_APP=release/linux-unpacked/bezel npx playwright test --project=app` (after `npm run dist:linux`). The browser tests open the small site in `tests/fixtures` (a fixed header, a grid that stacks on phones, a menu far down the page, a form, a link and a single-page-app route) and check what Bezel promises: device sizes and emulation, synced scrolling by content, clicks, followed pages, screenshots, and that the app can't open local files. They need Google Chrome installed.

GitHub runs the same tests (`.github/workflows/tests.yml`) before every staging test build, Pages deploy and release; if one fails, nothing is built or published, and the failed tests' traces are attached to the run.

## Branches and versions

Work happens on `staging`; `main` is what people get. Every push to `main` publishes the web version (the `Deploy to GitHub Pages` workflow, with Pages set to **Source: GitHub Actions**).

Every update adds 0.0.1 to the version with `npm run version:bump`, and each digit rolls over at 9 (`0.1.9 → 0.2.0`). The version shows next to the name, top left.

## Try a test build of the app

Every push to `staging` builds the app without publishing it (about 5 minutes). On GitHub, open **Actions → Test build**, pick the latest run and download it under **Artifacts** (each is a zip): `Bezel-Setup-test-…` for Windows, `Bezel-Linux-test-…` for the AppImage and the .deb. Zips lose the AppImage's executable bit, so run `chmod +x` on it after unzipping. A test build installs like the real app and updates to the next real release.

## Release the app

1. Run `npm run version:bump` and write what changed in `build/release-notes.md`.
2. Merge to `main`.
3. On GitHub, open **Actions → Release app → Run workflow** on `main`.

The workflow runs the tests first, then creates the `vX.Y.Z` release as a draft, then builds the installer on Windows and the AppImage and .deb on Linux at the same time. Each attaches its files, plus copies under names that never change for the README's download links (`Bezel-Setup.exe`, `Bezel.AppImage`, `Bezel.deb`). Once both are attached, the release is published and installed apps pick it up by themselves.

## Linux

- **Formats:** an AppImage (one file, runs on any distribution) and a .deb (Ubuntu, Debian, Mint; installs to `/opt/Bezel` with a menu entry). electron-builder settings are under `linux:` in `electron-builder.yml`.
- **Updates:** the AppImage downloads the new version and replaces itself when Bezel closes, like Windows. The .deb downloads it too, but only installs when the user clicks **Install**, because `dpkg` asks for the password (through `pkexec`) and that shouldn't pop up on quit. A cancelled password prompt shows *Couldn't install* and the button goes back to **Install**.
- **No libfuse2 needed:** the AppImage uses the static AppImage runtime (`toolsets.appimage: "1.0.3"`), so it opens on current Ubuntu and Fedora without installing FUSE 2.
- **Sandbox:** Ubuntu 24.04 and later block unprivileged user namespaces for apps without an AppArmor profile, which Chromium's sandbox needs. The .deb installs a profile (`/etc/apparmor.d/bezel`). The AppImage can't, so its launcher detects this and starts with `--no-sandbox`; that's why the README points Ubuntu users to the .deb.
- **Icons:** `build/icons/*.png` (16–512 px) are rendered from `build/icon.svg`: `for s in 16 24 32 48 64 128 256 512; do rsvg-convert -w $s -h $s build/icon.svg -o build/icons/${s}x${s}.png; done`. The 256 px one is also the window icon.
- **Window and menu entry:** `desktopName` in package.json (`bezel.desktop`) gives the window the app id `bezel`, which matches the menu entry, so the taskbar shows Bezel's icon.

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
src/sync.js                Synced scrolling and clicks in the app
public/sync.js             Sync helper (scrolling, clicks, pages) for sites in the web version
src/styles.css             All styles, with the dark and light colours at the top
electron/main.cjs          The app: window, device views, emulation, updates
electron/preload.cjs       The small bridge between the interface and the app
build/icon.svg             The app icon (build/icon.png and build/icons/ are rendered from it)
```

## Device sizes

Sizes are CSS pixels at each device's default display setting, the numbers your media queries see. On phones the page is that size minus the status bar, and on MacBooks minus the menu bar beside the camera housing (the screen below it is 16:10). Windows laptops use the panel divided by Windows' recommended scaling. Popular sizes come from [StatCounter](https://gs.statcounter.com/screen-resolution-stats); refresh them by editing the `POPULAR` lists in `src/devices.js`.
