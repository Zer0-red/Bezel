# Bezel

**See your website on every screen at once.**

**▶ Open Bezel: [zer0-red.github.io/Bezel](https://zer0-red.github.io/Bezel/)**. It runs in your browser, with nothing to install.

Bezel is a browser-based tool for responsive web development. Point it at your local dev server and preview your site on phones, tablets, laptops, desktops and large screens side by side. Each one is drawn as real hardware, and you can switch devices with one click while you work.

![Runs in](https://img.shields.io/badge/runs%20in-Chrome%20%7C%20Edge%20%7C%20Firefox-0078D6)
![License](https://img.shields.io/badge/license-MIT-green)

![Bezel screenshot](docs/screenshot.png)

---

## Features

- **Side-by-side preview**: mobile, tablet, laptop, desktop and large-screen views appear together, scaled to fit your window.
- **Real device frames**: phones with a Dynamic Island, punch-hole camera or home button; tablets; laptops with their keyboard base; monitors on a stand.
- **One-click device switching**: use the device bar or a keyboard shortcut to jump between devices without losing your place.
- **Focus mode**: open any device on its own at full size, then go back to the full row.
- **Device library**: includes presets for popular phones, tablets and monitors. You can add custom sizes and they're saved in your browser.
- **Rotate**: switch phones, tablets and monitors between portrait and landscape.
- **Built for localhost**: works with `http://localhost:3000` or any local dev server. Type just `3000` and Bezel fills in the rest. If your server has hot reload (Next.js, Vite, etc.), every frame updates when you save.
- **Live dimensions**: each device shows its width × height and current zoom, so you always know which breakpoint you're looking at.
- **Shareable links**: the address you're testing is kept in the page URL (`?url=…`), so you can bookmark a setup.

## How it works

Each device is an `<iframe>` set to that device's exact viewport size, then scaled down with CSS to fit on screen. Your site sees the real viewport width, so media queries, container queries and breakpoints behave as they would on the actual device.

## Device presets

| Category | Device | Viewport (CSS px) |
|---|---|---|
| Mobile | iPhone SE | 375 × 667 |
| Mobile | iPhone 15 | 393 × 852 |
| Mobile | Galaxy S24 | 360 × 780 |
| Mobile | Pixel 8 | 412 × 915 |
| Tablet | iPad (10th gen) | 820 × 1180 |
| Tablet | iPad Pro 12.9" | 1024 × 1366 |
| Laptop | Small laptop | 1366 × 768 |
| Laptop | MacBook Air 13" | 1440 × 900 |
| Desktop | Full HD | 1920 × 1080 |
| Large screen | QHD | 2560 × 1440 |
| Large screen | 4K | 3840 × 2160 |

To add your own, use **Custom size** at the end of the device bar.

## Getting started

Requirements: **Node.js 20+** and a modern browser (Chrome, Edge or Firefox)

```bash
git clone https://github.com/Zer0-red/bezel.git
cd bezel
npm install
npm run dev
```

Bezel opens at **http://localhost:5173**. Enter your dev server's address, such as `localhost:3000`, and press **Open**.

### Build

```bash
npm run build
```

This writes static files to `dist/`. Bezel has no server side, so you can host those files anywhere.

### Hosting on GitHub Pages

The repo includes a workflow that publishes Bezel to GitHub Pages on every push to `main`. To turn it on once, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

Running Bezel locally is still the smoothest option for localhost testing. When it's served from a public site like GitHub Pages, Chrome (142 and later) asks once for permission to connect to devices on your local network before it can load `localhost` pages. Choose **Allow**.

## Usage

1. Start your project's dev server as usual.
2. Type its address in Bezel's address bar and press **Open**.
3. Choose which devices to show from the device bar.
4. Click a device's name to open it on its own. Press `Esc` or `Alt+0` to go back to all devices.
5. Use the rotate button under a device, or `Alt+R`, to switch between portrait and landscape.

### Keyboard shortcuts

Shortcuts work while Bezel's own UI has focus. Clicking inside a device sends your keystrokes to that website, so click the toolbar or the space around the devices first.

| Shortcut | Action |
|---|---|
| `/` | Focus the address bar |
| `Alt+1` – `Alt+5` | Open a Mobile / Tablet / Laptop / Desktop / Large screen device on its own |
| `Alt+0` or `Esc` | Show all devices |
| `Alt+R` | Rotate the device on screen (in the all-devices view, all phones and tablets) |
| `Alt+Shift+R` | Reload all devices |

## Limitations

Bezel is built for testing your own sites during development. Because it uses iframes:

- **Sites that block framing won't load.** Many production sites send `X-Frame-Options` or a `frame-ancestors` CSP header that stops them from showing inside other pages. Your local projects usually don't, unless you've added those headers yourself.
- **Only the viewport size is emulated.** The user agent, pixel density and touch input stay those of your desktop browser. CSS breakpoints are accurate, but code that detects mobile from the user agent will still see a desktop.
- **Logins on other domains may not persist.** Browsers often withhold cookies from cross-site iframes.

For pixel-density or touch checks, use your browser's DevTools device mode on a single device.

## Project structure

```
index.html          App shell: toolbar, device bar, stage, custom-size dialog
src/main.js         State, rendering, shortcuts
src/frames.js       Geometry of each device frame (bezels, notch, stand…)
src/devices.js      Device presets
src/url.js          Turns "3000" or "localhost:5173" into a full address
src/storage.js      Saves settings in localStorage
src/styles.css      All styles
```

## Roadmap

- [ ] Synced scrolling across all devices (via an optional helper script you add to your dev site)
- [ ] Synced clicks and navigation
- [ ] Screenshots for each device
- [ ] Save device sets per project
- [ ] Light theme for the app UI
- [ ] Optional desktop build (Electron) for sites that block framing

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first so we can discuss the approach.

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes
4. Open a pull request

## License

MIT. See [LICENSE](LICENSE) for details.
