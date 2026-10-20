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
const sharp = require('sharp');
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
      } else if (!state.creds.me) {
        // Pairing QR expired without being scanned; wait for the user to try again.
        // (creds.registered is only set by pairing-code logins, so check creds.me,
        // which is filled in once a QR scan succeeds.)
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
app.use(express.json({ limit: '100kb' }));
app.use(express.static(PUBLIC_DIR));

// The API sends from your WhatsApp account, so refuse requests made by other websites.
// Checking Host blocks DNS rebinding: a page on attacker.example that re-points its
// name to 127.0.0.1 still sends "Host: attacker.example", and same-origin GETs carry
// no Origin header at all.
const LOCAL_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
const LOCAL_ORIGINS = LOCAL_HOSTS.map((h) => `http://${h}`);

app.use('/api', (req, res, next) => {
  if (!LOCAL_HOSTS.includes(req.get('host'))) {
    return res.status(403).json({ error: 'Request refused: unexpected Host header' });
  }
  const origin = req.get('origin');
  if (origin && !LOCAL_ORIGINS.includes(origin)) {
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

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

// Frame on a dark backing with a small border, so WhatsApp's re-encoding
// doesn't fill the transparent centre with an arbitrary colour.
async function frameImage(daily) {
  const file = path.join(PUBLIC_DIR, daily.frameImage);
  if (!fs.existsSync(file)) return null;
  const { width } = await sharp(file).metadata();
  const pad = Math.round(width * 0.06);
  return sharp(file)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#15171c' })
    .flatten({ background: '#15171c' })
    .png()
    .toBuffer();
}

/**
 * Sends the daily message to each number and group.
 * @returns {Promise<Array<{target: string, kind: string, ok: boolean, error?: string}>>}
 */
async function sendDaily({ daily, text, includeImage, numbers, groups }) {
  if (wa.state !== 'open' || !wa.sock) throw new Error('WhatsApp is not connected');
  const image = includeImage ? await frameImage(daily) : null;
  const content = image ? { image, caption: text } : { text };

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
  return results;
}

/*
 * body: {
 *   date: "YYYY-MM-DD",
 *   message?: string,          // edited text; defaults to the formatted message
 *   includeImage?: boolean,    // send the frame image with the message as caption
 *   numbers?: string[],        // individual phone numbers (international format)
 *   groups?: string[],         // group JIDs from /api/wa/groups
 * }
 */
app.post('/api/wa/send', async (req, res) => {
  if (!requireOpen(res)) return;
  const { date, message, includeImage = true, numbers = [], groups = [] } = req.body || {};

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
  try {
    const results = await sendDaily({ daily, text, includeImage, numbers, groups });
    res.json({ date: daily.date, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Scheduled sends
// ---------------------------------------------------------------------------
//
// A schedule sends the titles and frame for the day it fires on, so a daily
// schedule always posts that day's titles. Schedules only run while this
// server is running; one that is more than GRACE_MS late (server or WhatsApp
// was off) is recorded as missed instead of being sent late.

const SCHEDULES_FILE = path.join(__dirname, 'schedules.json');
const GRACE_MS = 15 * 60 * 1000;
const MAX_SCHEDULES = 50;
const startedAt = new Date();

function loadSchedules() {
  let raw;
  try {
    raw = fs.readFileSync(SCHEDULES_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('expected an array');
    return list;
  } catch (err) {
    // Keep the unreadable file rather than overwriting it on the next save.
    const backup = SCHEDULES_FILE + '.corrupt-' + Date.now();
    fs.copyFileSync(SCHEDULES_FILE, backup);
    console.error('[schedule] could not read %s (%s); saved a copy as %s and starting with no schedules',
      SCHEDULES_FILE, err.message, backup);
    return [];
  }
}

let schedules = loadSchedules();

// Write to a temp file and rename it into place, so a crash mid-write can't
// leave a truncated schedules.json behind.
function saveSchedules() {
  const tmp = SCHEDULES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(schedules, null, 2));
  fs.renameSync(tmp, SCHEDULES_FILE);
}

function atTime(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

// The earliest slot of this schedule that hasn't been sent or marked missed yet
// (null once a one-off has finished). Daily schedules also look back to
// yesterday, so a slot just before midnight keeps its full grace period and a
// slot that went unhandled is still recorded as missed.
function nextRun(s, now = new Date()) {
  if (s.repeat === 'once') return s.done ? null : atTime(Daily.fromISODate(s.date), s.time);
  const created = s.createdAt ? new Date(s.createdAt) : null;
  for (const offset of [-1, 0]) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const slot = atTime(day, s.time);
    const handled = (s.lastRunDate || '') >= Daily.toISODate(day);
    if (!handled && !(created && slot < created)) return slot;
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return atTime(tomorrow, s.time);
}

function scheduleView(s) {
  const next = nextRun(s);
  return { ...s, nextRun: next ? next.toISOString() : null };
}

function markMissed(s, due, now, reason) {
  s.lastRunDate = Daily.toISODate(due);
  if (s.repeat === 'once') s.done = true;
  s.lastRun = { at: now.toISOString(), error: 'Missed — ' + reason };
  saveSchedules();
  console.log('[schedule] %s missed: %s', s.id, reason);
}

const running = new Set();

async function runSchedule(s, due, now) {
  running.add(s.id);
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  s.lastRunDate = Daily.toISODate(day);
  if (s.repeat === 'once') s.done = true;
  try {
    // Save before sending, so a crash part-way through can't resend after a restart.
    saveSchedules();
    const daily = Daily.getDaily(day, TITLES);
    const text = Daily.formatMessage(daily, { japanese: s.japanese });
    const results = await sendDaily({
      daily,
      text,
      includeImage: s.includeImage,
      numbers: s.numbers.map((n) => n.number),
      groups: s.groups.map((g) => g.id),
    });
    s.lastRun = { at: now.toISOString(), results };
    console.log('[schedule] %s sent: %d/%d ok', s.id, results.filter((r) => r.ok).length, results.length);
  } catch (err) {
    s.lastRun = { at: now.toISOString(), error: err.message };
    console.log('[schedule] %s failed: %s', s.id, err.message);
  } finally {
    running.delete(s.id);
    saveSchedules();
  }
}

function checkSchedules() {
  const now = new Date();
  for (const s of schedules) {
    if (running.has(s.id)) continue;
    const due = nextRun(s, now);
    if (!due || now < due) continue;

    if (now - due > GRACE_MS) {
      // If the server was up at the scheduled time it kept retrying, but
      // WhatsApp stayed disconnected for the whole grace period.
      markMissed(s, due, now, due < startedAt
        ? 'the server was not running at the scheduled time'
        : 'WhatsApp was not connected');
    } else if (wa.state === 'open') {
      runSchedule(s, due, now);
    }
  }
}

function parseSchedule(body) {
  const { repeat, time, date, numbers = [], groups = [], includeImage = true, japanese = false } = body || {};
  if (repeat !== 'daily' && repeat !== 'once') throw new Error('Choose "Every day" or "Once"');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Pick a time');
  const s = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    repeat,
    time,
    numbers: (Array.isArray(numbers) ? numbers : [])
      .filter((n) => n && String(n.number).replace(/\D/g, '').length >= 7)
      .map((n) => ({ number: String(n.number), name: String(n.name || '') })),
    groups: (Array.isArray(groups) ? groups : [])
      .filter((g) => g && /@g\.us$/.test(g.id))
      .map((g) => ({ id: String(g.id), name: String(g.name || g.id) })),
    includeImage: !!includeImage,
    japanese: !!japanese,
    createdAt: new Date().toISOString(),
    lastRunDate: null,
    lastRun: null,
  };
  if (!s.numbers.length && !s.groups.length) throw new Error('Tick at least one number or group');
  if (repeat === 'once') {
    let when;
    try {
      when = atTime(Daily.fromISODate(date), time);
    } catch {
      throw new Error('Pick a date');
    }
    if (when < new Date()) throw new Error('That time has already passed');
    s.date = date;
    s.done = false;
  } else if (atTime(new Date(), time) <= new Date()) {
    // Created after today's time: start tomorrow instead of firing straight away.
    s.lastRunDate = Daily.toISODate(new Date());
  }
  return s;
}

app.get('/api/schedules', (req, res) => {
  res.json(schedules.map(scheduleView));
});

app.post('/api/schedules', (req, res) => {
  if (schedules.length >= MAX_SCHEDULES) return res.status(400).json({ error: 'Too many schedules' });
  try {
    const s = parseSchedule(req.body);
    schedules.push(s);
    saveSchedules();
    res.json(scheduleView(s));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', (req, res) => {
  const before = schedules.length;
  schedules = schedules.filter((s) => s.id !== req.params.id);
  if (schedules.length === before) return res.status(404).json({ error: 'Schedule not found' });
  saveSchedules();
  res.json({ ok: true });
});

setInterval(checkSchedules, 20 * 1000);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`WMMT Daily running at http://localhost:${PORT}`);
  // Reconnect automatically if a WhatsApp session was saved previously.
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    connectWhatsApp().catch(onConnectError);
  }
});
