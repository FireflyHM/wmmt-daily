/*
 * WMMT Daily — local web server.
 *  - serves the site in ./public
 *  - links a WhatsApp account (via Baileys, WhatsApp Web protocol) so the
 *    daily titles + frame can be pushed to individual numbers and groups.
 *
 * Run: npm start  ->  http://localhost:3000
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} = require('@whiskeysockets/baileys');

const Daily = require('./public/js/daily.js');
const TITLES = require('./public/data/titles.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUTH_DIR = path.join(__dirname, '.wa-auth');

// ---------------------------------------------------------------------------
// WhatsApp connection
// ---------------------------------------------------------------------------

const wa = {
  sock: null,
  state: 'disconnected', // disconnected | connecting | qr | open
  qr: null, // data URL of the current pairing QR
  me: null,
  error: null,
};

async function connectWhatsApp() {
  if (wa.sock && wa.state !== 'disconnected') return;
  wa.state = 'connecting';
  wa.error = null;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    // fall back to the version bundled with Baileys
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.appropriate('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  wa.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (sock !== wa.sock) return; // stale socket

    if (qr) {
      wa.state = 'qr';
      wa.qr = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
    }

    if (connection === 'open') {
      wa.state = 'open';
      wa.qr = null;
      wa.me = sock.user ? { id: sock.user.id, name: sock.user.name || sock.user.verifiedName || '' } : null;
      console.log('[wa] connected as', wa.me && wa.me.id);
    }

    if (connection === 'close') {
      const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode
        : undefined;
      wa.sock = null;
      wa.state = 'disconnected';
      wa.qr = null;

      if (code === DisconnectReason.loggedOut) {
        console.log('[wa] logged out — clearing saved session');
        wa.me = null;
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } else if (!state.creds.registered) {
        // Pairing QR expired without being scanned; wait for the user to try again.
        console.log('[wa] pairing QR expired');
        wa.error = 'QR code expired — click Link WhatsApp to try again';
      } else {
        console.log('[wa] connection closed (code %s), reconnecting…', code);
        setTimeout(() => connectWhatsApp().catch(onConnectError), 1500);
      }
    }
  });
}

function onConnectError(err) {
  console.error('[wa] connect failed:', err);
  wa.state = 'disconnected';
  wa.sock = null;
  wa.error = String(err && err.message ? err.message : err);
}

function requireOpen(res) {
  if (wa.state === 'open' && wa.sock) return true;
  res.status(409).json({ error: 'WhatsApp is not connected. Link your account first.' });
  return false;
}

// Turn "+60 12-345 6789" into a JID, confirming the number is on WhatsApp.
async function numberToJid(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 7) throw new Error('Invalid number: ' + raw);
  const [result] = await wa.sock.onWhatsApp(digits);
  if (!result || !result.exists) throw new Error(raw + ' is not on WhatsApp');
  return result.jid;
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(PUBLIC_DIR));

// The WhatsApp endpoints act on your account, so refuse requests made by other websites.
app.use('/api/wa', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://127.0.0.1:${PORT}`) {
    return res.status(403).json({ error: 'Cross-origin request refused' });
  }
  next();
});

app.get('/api/daily', (req, res) => {
  try {
    const date = req.query.date ? Daily.fromISODate(req.query.date) : new Date();
    const daily = Daily.getDaily(date, TITLES);
    res.json({ ...daily, message: Daily.formatMessage(daily) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/wa/status', (req, res) => {
  res.json({ state: wa.state, qr: wa.qr, me: wa.me, error: wa.error });
});

app.post('/api/wa/connect', async (req, res) => {
  try {
    await connectWhatsApp();
  } catch (err) {
    onConnectError(err);
  }
  res.json({ state: wa.state, error: wa.error });
});

app.post('/api/wa/logout', async (req, res) => {
  const sock = wa.sock;
  wa.sock = null;
  wa.state = 'disconnected';
  wa.qr = null;
  wa.me = null;
  try {
    if (sock) await sock.logout();
  } catch {
    // already closed
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  res.json({ ok: true });
});

app.get('/api/wa/groups', async (req, res) => {
  if (!requireOpen(res)) return;
  try {
    const groups = await wa.sock.groupFetchAllParticipating();
    const list = Object.values(groups)
      .map((g) => ({ id: g.id, name: g.subject, size: (g.participants || []).length }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
 * body: {
 *   date: "YYYY-MM-DD",
 *   message?: string,          // edited text; defaults to the formatted message
 *   includeImage?: boolean,    // send the frame image with the message as caption
 *   image?: string,            // optional PNG/JPEG data URL to send instead of the raw frame file
 *   numbers?: string[],        // individual phone numbers (international format)
 *   groups?: string[],         // group JIDs from /api/wa/groups
 * }
 */
app.post('/api/wa/send', async (req, res) => {
  if (!requireOpen(res)) return;
  const { date, message, includeImage = true, image, numbers = [], groups = [] } = req.body || {};

  let daily;
  try {
    daily = Daily.getDaily(date ? Daily.fromISODate(date) : new Date(), TITLES);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!numbers.length && !groups.length) {
    return res.status(400).json({ error: 'Pick at least one number or group.' });
  }

  const text = (typeof message === 'string' && message.trim()) || Daily.formatMessage(daily);
  // Prefer the image the page rendered (frame on a dark backing); fall back to the raw frame file.
  let imageBuffer = null;
  if (includeImage) {
    const m = typeof image === 'string' && /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(image);
    const imagePath = path.join(PUBLIC_DIR, daily.frameImage);
    if (m) imageBuffer = Buffer.from(m[2], 'base64');
    else if (fs.existsSync(imagePath)) imageBuffer = fs.readFileSync(imagePath);
  }
  const content = imageBuffer ? { image: imageBuffer, caption: text } : { text };

  const targets = [
    ...numbers.map((n) => ({ kind: 'number', label: n, resolve: () => numberToJid(n) })),
    ...groups.map((g) => ({ kind: 'group', label: g, resolve: async () => g })),
  ];

  const results = [];
  for (const t of targets) {
    try {
      const jid = await t.resolve();
      if (t.kind === 'group' && !jid.endsWith('@g.us')) throw new Error('Not a group id');
      await wa.sock.sendMessage(jid, content);
      results.push({ target: t.label, kind: t.kind, ok: true });
    } catch (err) {
      results.push({ target: t.label, kind: t.kind, ok: false, error: err.message });
    }
  }
  res.json({ date: daily.date, results });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`WMMT Daily running at http://localhost:${PORT}`);
  // Reconnect automatically if a WhatsApp session was saved previously.
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    connectWhatsApp().catch(onConnectError);
  }
});
