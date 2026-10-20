# WMMT Daily

Shows the **overseas daily titles** and the **6RR bingo frame** for today (from your device's clock) or any date you pick, and shares them to WhatsApp.

- Titles: the overseas (外) rows of <https://w.atwiki.jp/wmmt_title/>. They repeat on a two-year cycle (even and odd years).
- Frames: the day-of-year rotation from <https://www.dragapult.xyz/wmmt-frame-viewer/> by SirScrubbington. Leap years add `studs2` on 29 Feb.

## Hosting on GitHub Pages (no server)

Everything in `public/` is a static site, and `.github/workflows/pages.yml` publishes it on every push to `main`.
In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.

On the static site you get:

- Today's titles, the bingo title and the frame, plus the next 7 days. Use ‹ / › / Today or the date picker to change dates. Each date has its own link (e.g. `#2026-12-25`).
- **Share text in WhatsApp…** opens WhatsApp with the message filled in. You then pick any contact or group.
- **Share with image…** sends the frame image and the text together through your device's share menu. It shows on phones and in Chrome/Edge on Windows and macOS.
- **Copy frame image** lets you paste the image into WhatsApp Web or the desktop app.

## Optional: push directly from your PC

A static page can't log in to WhatsApp, so sending straight to saved numbers and groups needs the small local server:

```bash
npm install
npm start
```

Open <http://localhost:3000>. A **Push directly** panel appears there. Link WhatsApp by scanning the QR code (Settings → Linked devices), then tick the numbers or groups and press **Send**. Each message goes out as the frame image with the titles as its caption.

- This uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. WhatsApp may restrict accounts that use unofficial clients, so keep it to small personal sends.
- The linked session is saved in `.wa-auth/`, which is git-ignored. The server only listens on `127.0.0.1`.
