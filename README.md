<p align="center"><img src="docs/logo.png" alt="" width="96"></p>

<h1 align="center">Bezel</h1>

<p align="center"><strong>See your website on every screen at once.</strong></p>

<p align="center">
  <a href="https://github.com/Zer0-red/Bezel/releases/latest/download/Bezel-Setup.exe"><strong>⬇ Windows</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://github.com/Zer0-red/Bezel/releases/latest/download/Bezel.AppImage"><strong>⬇ Linux (AppImage)</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://github.com/Zer0-red/Bezel/releases/latest/download/Bezel.deb"><strong>⬇ Linux (.deb)</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://zer0-red.github.io/Bezel/"><strong>Open in your browser</strong></a>
</p>

![Bezel showing a website on a phone, a tablet and a laptop](docs/screenshot.png)

Bezel puts your site on a phone, a tablet and a laptop side by side, drawn like the real thing. Point it at your dev server, keep coding, and every screen updates when you save. No more dragging the browser window around to check breakpoints.

## What it does

- **Real devices.** The latest iPhones, Pixels and Galaxys, iPads, MacBook Air and Pro, ThinkPad, Surface and other Windows laptops, and monitors, each at its real screen size. You can also add the most-used screen sizes or your own.
- **One-click setups.** *Phone, tablet, laptop*, *Three phones*, *Apple* and more. Save your own.
- **Swap a device fast.** Click the name under a device and pick another from the menu.
- **Scroll or click once, see it everywhere.** Scroll one device and the others follow to the same spot. Open a menu or a tab and it opens in all of them, even where it's scrolled out of view; follow a link and they all go to that page.
- **Screenshots.** The camera button copies all the devices to your clipboard, ready to paste.
- **Zoom like on a phone.** Pinch on the trackpad, or hold `Ctrl` and turn the mouse wheel.
- **The little things.** Rotate phones and tablets, open one device full size, star your favorite sites, switch between a dark and a light desk.

## App or browser?

Both look and work the same. The app can do more, because a browser tab has limits:

| | App (Windows, Linux) | In the browser |
|---|---|---|
| Sites it can show | Any site | Sites that allow being shown in a frame (most local projects do) |
| Phones and tablets | Real behaviour: mobile browser, pixel density and touch support | The right screen size |
| Synced scrolling and clicks | Works everywhere | Needs [one line in your site](#syncing-in-the-browser) |
| Pinch to zoom | Anywhere | Around the devices, or on them with the same line in your site |
| Screenshots | One click | Chrome and Edge ask to share the tab first |
| Updates | Downloads them by itself | Always the latest |

### Installing the app

- **Windows:** run `Bezel-Setup.exe`. The app isn't code-signed yet, so Windows may show "Windows protected your PC" the first time: click **More info**, then **Run anyway**.
- **Ubuntu, Debian, Mint:** install `Bezel.deb`, for example with `sudo apt install ./Bezel.deb` in the folder you saved it to. Bezel appears in your app menu.
- **Any other Linux:** `Bezel.AppImage` is the whole app in one file. Make it executable (right-click → Properties → *Allow executing as program*, or `chmod +x Bezel.AppImage`) and open it.

After that you never need to download it again. When a new version is ready, the button at the top right says **Install** (the .deb asks for your password, like any system update).

## Using it

1. Start your project as usual (`npm run dev` or similar).
2. Type its address in Bezel, like `localhost:3000` (or just `3000`), and press **Open**.
3. Choose your devices with the setup menu or **Add device**.

Click the star in the address bar to keep a site in your favorites. Next time, click the address bar and pick it.

| Shortcut | What it does |
|---|---|
| `/` | Jump to the address bar |
| `Alt+1` – `Alt+5` | Show one phone, tablet, laptop, desktop or large screen |
| `Alt+0` or `Esc` | Back to all devices |
| `Alt+R` | Rotate |
| `Alt+Shift+R` | Reload all devices |
| `Alt+S` | Turn synced scrolling and clicks on or off |
| `Alt+C` | Copy a screenshot |
| Pinch, or `Ctrl` + wheel | Zoom the devices in and out (pick **Fit** in the zoom menu to reset) |

### Syncing in the browser

A web page can't scroll or click other sites, so in the browser version your site has to join in. The same line lets you pinch to zoom with the pointer on a device. Add this line while you develop (the app doesn't need it):

```html
<script src="https://zer0-red.github.io/Bezel/sync.js" defer></script>
```

It does nothing unless the page is inside Bezel. To keep it out of production in Next.js, for example:

```tsx
import Script from 'next/script';

{process.env.NODE_ENV === 'development' && <Script src="https://zer0-red.github.io/Bezel/sync.js" />}
```

## Good to know

- **A site stays blank in the browser version?** It probably forbids being shown in a frame (`X-Frame-Options` or `frame-ancestors`). Use the app, or allow Bezel's address in your site's headers.
- **Chrome asks to "access devices on your local network"?** Choose **Allow**. Bezel needs it to show `localhost` from its web address.
- **Clicks happen in every device.** Buttons that send a form are the exception: they only work in the device you clicked, so nothing is sent twice. For something like *Delete* in an admin panel, turn sync off first (`Alt+S`).
- **On Ubuntu 24.04 or later, use the .deb.** Ubuntu blocks Chromium's sandbox (which keeps the sites you open walled off) for apps without a security profile, so the AppImage runs without it there. The .deb installs that profile.
- **Sizes** are in CSS pixels, the numbers your media queries see. Phones show a status bar and MacBooks the menu bar beside the camera, and your page starts below it, as on the real thing.

## Development

```bash
npm install
npm run dev   # browser version
npm run app   # desktop app
```

Building, releasing and how the code is organised: [docs/development.md](docs/development.md).

## License

[MIT](LICENSE)
