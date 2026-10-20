# WMMT Daily

Shows the **overseas daily titles** and the **6RR bingo frame** for today (from your device's clock) or any date you pick, and shares them to WhatsApp.

- Titles: the overseas (外) rows of <https://w.atwiki.jp/wmmt_title/>. They repeat on a two-year cycle (even and odd years).
- Frames: the day-of-year rotation from <https://www.dragapult.xyz/wmmt-frame-viewer/> by SirScrubbington. Leap years add `studs2` on 29 Feb.

## Hosting on GitHub Pages (no server)

Everything in `public/` is a static site, and `.github/workflows/pages.yml` publishes it on every push to `main`.
In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.

On the static site you get:

- Today's titles, the bingo title and the frame. Use ‹ / › / Today or the date picker to change dates. Each date has its own link (e.g. `#2026-12-25`).
- **Share text in WhatsApp…** opens WhatsApp with the message filled in. You then pick any contact or group.
- **Share with image…** sends the frame image and the text together through your device's share menu. It shows on phones and in Chrome/Edge on Windows and macOS.
- **Copy frame image** lets you paste the image into WhatsApp Web or the desktop app.
- **Show Japanese titles** adds the Japanese name under each title, on the page and in the WhatsApp message.
- **Search titles** looks through every date's English and Japanese titles. Results are grouped into even and odd years, then by date. Click a date to open its next occurrence.

## Updating the title data

`public/data/titles.js` is generated from the wiki. To rebuild it, run `node tools/build-titles.js`. This downloads the 24 month pages, about 30 seconds.

## Optional: push directly from your PC

A static page can't log in to WhatsApp, so sending straight to saved numbers and groups needs the small local server:

```bash
npm ci
npm start
```

Open <http://localhost:3000>. A **Push directly** panel appears there. Link WhatsApp by scanning the QR code (Settings → Linked devices), then tick the numbers or groups and press **Send**. Each message goes out as the frame image with the titles as its caption.

**Scheduled sends:** under **Scheduled sends**, choose *Every day* or *Once*, set a time, and click **Add schedule**. Each send goes to the numbers and groups ticked at the time you add it. It includes the frame image and that day's titles, plus the Japanese titles if that option is on.

- Schedules are saved in `schedules.json`, which is git-ignored. They only go out while `npm start` is running and WhatsApp is linked.
- If WhatsApp is disconnected at the scheduled time, the server keeps retrying for 15 minutes. After that, the send is marked as missed rather than sent late.

- This uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. WhatsApp may restrict accounts that use unofficial clients, so keep it to small personal sends.
- The linked session is saved in `.wa-auth/`, which is git-ignored and, on macOS and Linux, readable only by your user account. Anyone with a copy of it can use your WhatsApp account, so don't share or sync the project folder while it holds one. The server only listens on `127.0.0.1`.
