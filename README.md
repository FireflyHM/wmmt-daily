# WMMT Daily

Shows the **overseas daily titles**, the **6RR bingo frame** and the matching **number plate** for today (from your device's clock) or any date you pick. Run locally, it also shares them to WhatsApp.

- Titles: the game's own title list and English text, cross-checked with <https://w.atwiki.jp/wmmt_title/>. They repeat on a two-year cycle (even and odd years); the bingo title is the same every year.
- Frames: the day-of-year rotation from <https://www.dragapult.xyz/wmmt-frame-viewer/> by SirScrubbington. Leap years add `studs2` on 29 Feb.
- Number plate: the plate image (`public/img/plate-blank.png`) is sourced from the Wangan Navigator app. The date digits are drawn over it in [Barlow Condensed](https://github.com/jpt/barlow) SemiBold, licensed under the SIL Open Font License (`public/fonts/OFL-BarlowCondensed.txt`).
- Header: key art from the [WANGAN MIDNIGHT MAXIMUM TUNE 6RR official site](https://wanganmaxi-official.com/wanganmaxi6rr/en/) (Asia/Oceania), © Bandai Namco.

## Hosting on GitHub Pages (no server)

Everything in `public/` is a static site, and `.github/workflows/pages.yml` publishes it on every push to `main`.
In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.

On the static site you get:

- Today's titles, the bingo title, the frame and the number plate. Use ‹ / › / Today or the date picker to change dates. Each date has its own link (e.g. `#2026-12-25`).
- **Show Japanese titles** adds the Japanese name under each title.
- **Dark theme** switches between light and dark. Until you use it, the page follows your device's setting.
- **Search titles** looks through every date's English and Japanese titles. Results are grouped into even and odd years, then by date. Click a date to open its next occurrence.

The **Send to WhatsApp** panel is left out of the static site on purpose. It only appears when the page is served by the local server (below).

## Linting

Run `npm ci`, then `npm run lint` (ESLint, configured in `eslint.config.js`). Every pull request runs the same check.

## Updating the title data

`public/data/titles.js` holds every title and is no longer downloaded. It was made in October 2026 from the game's own data (`honor.bin` and `msgdb.lua`); two titles with no English in the game data keep the wiki's. To fix a title, edit that file: each date is `"MM-DD": [titles 1-6, bingo title]` under `en`/`ja` and `even`/`odd`.

## Optional: send to WhatsApp from your PC

Sending needs the small local server:

```bash
npm ci
npm start
```

Open <http://localhost:3000>. The **Send to WhatsApp** panel appears there, with:

- **Share text in WhatsApp…** opens WhatsApp with the message filled in. You then pick any contact or group.
- **Share with image…** sends one image of the frame and number plate, and the text, together through your device's share menu. It shows in Chrome/Edge on Windows and macOS.
- **Copy image** copies that same image, so you can paste it into WhatsApp Web or the desktop app.
- **Push directly**, described below.

For **Push directly**, link WhatsApp by scanning the QR code (Settings → Linked devices), then tick the numbers or groups and press **Send**. Each message goes out as the frame and plate image with the titles as its caption.

**Scheduled sends:** under **Scheduled sends**, choose *Every day* or *Once*, set a time, and click **Add schedule**. Each send goes to the numbers and groups ticked at the time you add it. It includes the frame and plate image and that day's titles, plus the Japanese titles if that option is on.

- Schedules are saved in `schedules.json`, which is git-ignored. They only go out while `npm start` is running and WhatsApp is linked.
- If WhatsApp is disconnected at the scheduled time, the server keeps retrying for 15 minutes. After that, the send is marked as missed rather than sent late.

- The server also answers `GET /api/daily?date=YYYY-MM-DD` (date optional, default today) with that day's titles, frame and formatted message as JSON, for use from scripts on this PC. `GET /api/daily/image?date=YYYY-MM-DD` returns the frame and plate image that sends attach.

- This uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. WhatsApp may restrict accounts that use unofficial clients, so keep it to small personal sends.
- The linked session is saved in `.wa-auth/`, which is git-ignored and, on macOS and Linux, readable only by your user account. Anyone with a copy of it can use your WhatsApp account, so don't share or sync the project folder while it holds one. The server only listens on `127.0.0.1`.
