<p align="center"><img src="docs/logo.png" alt="Bezel" width="420"></p>

<p align="center"><strong>See your website on every screen at once.</strong></p>

<p align="center">
  <a href="https://github.com/Zer0-red/Bezel/releases/latest/download/Bezel-Setup.exe"><strong>⬇ Download for Windows</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://zer0-red.github.io/Bezel/"><strong>Open in your browser</strong></a>
</p>

![Bezel showing a website on a phone, a tablet and a laptop](docs/screenshot.png)

Bezel puts your site on a phone, a tablet and a laptop side by side, drawn like the real thing. Point it at your dev server, keep coding, and every screen updates when you save. No more dragging the browser window around to check breakpoints.

## What it does

- **Real devices.** The latest iPhones, Pixels and Galaxys, iPads, MacBooks, Windows laptops and monitors, each at its real screen size. You can also add the most-used screen sizes or your own.
- **One-click setups.** *Phone, tablet, laptop*, *Three phones*, *Apple* and more. Save your own.
- **Swap a device fast.** Click the name under a device and pick another from the menu.
- **Scroll once, see it everywhere.** Scroll one device and the others follow to the same spot.
- **Screenshots.** The camera button copies all the devices to your clipboard, ready to paste.
- **The little things.** Rotate phones and tablets, open one device full size, star your favorite sites, switch between a dark and a light desk.

## Windows app or browser?

Both look and work the same. The app can do more, because a browser tab has limits:

| | Windows app | In the browser |
|---|---|---|
| Sites it can show | Any site | Sites that allow being shown in a frame (most local projects do) |
| Phones and tablets | Real behaviour: mobile browser, pixel density and touch support | The right screen size |
| Synced scrolling | Works everywhere | Needs [one line in your site](#synced-scrolling-in-the-browser) |
| Screenshots | One click | Chrome and Edge ask to share the tab first |
| Updates | Downloads them by itself | Always the latest |

**Installing the app:** run `Bezel-Setup.exe`. The app isn't code-signed yet, so Windows may show "Windows protected your PC" the first time: click **More info**, then **Run anyway**. After that you never need the installer again. When a new version is ready, the button at the top right says **Install**.

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
| `Alt+S` | Turn synced scrolling on or off |
| `Alt+C` | Copy a screenshot |

### Synced scrolling in the browser

A web page can't scroll other sites, so in the browser version your site has to join in. Add this line while you develop (the app doesn't need it):

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
- **Sizes** are in CSS pixels, the numbers your media queries see. Phones show a status bar, and your page starts below it, as on a real phone.

## Development

```bash
npm install
npm run dev   # browser version
npm run app   # Windows app
```

Building, releasing and how the code is organised: [docs/development.md](docs/development.md).

## License

[MIT](LICENSE)
