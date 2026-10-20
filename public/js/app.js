(function () {
  'use strict';

  var D = window.WMMTDaily;
  var TITLES = window.WMMT_TITLES;
  var $ = function (id) { return document.getElementById(id); };

  var NUMBERS_KEY = 'wmmt-daily.numbers';
  var SELECTED_GROUPS_KEY = 'wmmt-daily.groups';

  var state = {
    date: null, // Date being shown
    followToday: true, // keep tracking the system date across midnight
    daily: null,
    groups: [],
  };

  // -------------------------------------------------------------------------
  // Storage helpers (localStorage can be unavailable; the page still works)
  // -------------------------------------------------------------------------
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  // -------------------------------------------------------------------------
  // Date view
  // -------------------------------------------------------------------------
  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function sameDay(a, b) { return D.toISODate(a) === D.toISODate(b); }

  function jaSpan(text) {
    var span = document.createElement('span');
    span.className = 'ja';
    span.lang = 'ja';
    span.textContent = text;
    return span;
  }

  // -------------------------------------------------------------------------
  // Japanese titles toggle
  // -------------------------------------------------------------------------
  var SHOW_JA_KEY = 'wmmt-daily.showJa';

  function showJapanese() { return $('show-ja').checked; }

  function applyJapanese() {
    document.body.classList.toggle('show-ja', showJapanese());
  }

  // -------------------------------------------------------------------------
  // Title search
  // -------------------------------------------------------------------------
  var SLOT_LABELS = ['#1', '#2', '#3', '#4', '#5', '#6', 'Bingo'];
  var MAX_DATES_PER_PARITY = 150;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Case/width-insensitive form: "ＴＯＦＵ" and "tofu" match, as do full/half-width kana.
  function norm(s) { return String(s).normalize('NFKC').toLowerCase(); }

  // Next date (from today) on this month-day in a year of the given parity.
  function nextOccurrence(parity, key) {
    var mm = Number(key.slice(0, 2));
    var dd = Number(key.slice(3));
    var t = today();
    for (var y = t.getFullYear(); y < t.getFullYear() + 12; y++) {
      if ((y % 2 === 0) !== (parity === 'even')) continue;
      var d = new Date(y, mm - 1, dd);
      if (d.getMonth() !== mm - 1) continue; // 29 Feb in a non-leap year
      if (d >= t) return d;
    }
    return null;
  }

  // Wrap each case-insensitive occurrence of the query in <mark>.
  function highlight(el, text, q) {
    var lower = norm(text);
    // NFKC can change length (e.g. half-width kana), so only highlight when it's 1:1.
    if (lower.length !== text.length || !q) {
      el.textContent = text;
      return;
    }
    var i = 0;
    var at;
    while ((at = lower.indexOf(q, i)) !== -1) {
      el.appendChild(document.createTextNode(text.slice(i, at)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + q.length);
      el.appendChild(mark);
      i = at + q.length;
    }
    el.appendChild(document.createTextNode(text.slice(i)));
  }

  function search(query) {
    var q = norm(query.trim());
    var box = $('search-results');
    if (!q) {
      box.hidden = true;
      $('search-summary').textContent =
        'Searches every date in the even-year and odd-year title tables. Click a date to open it.';
      return;
    }

    var total = 0;
    ['even', 'odd'].forEach(function (parity) {
      var en = TITLES.en[parity];
      var ja = TITLES.ja[parity];
      var list = $('results-' + parity);
      list.innerHTML = '';
      var dates = 0;
      var titles = 0;

      Object.keys(en).forEach(function (key) {
        var rowEn = en[key] || [];
        var rowJa = ja[key] || [];
        var hits = [];
        for (var i = 0; i < Math.max(rowEn.length, rowJa.length); i++) {
          var e = rowEn[i] || '';
          var j = rowJa[i] || '';
          var hitEn = e && norm(e).indexOf(q) !== -1;
          var hitJa = j && norm(j).indexOf(q) !== -1;
          if (hitEn || hitJa) hits.push({ slot: i, en: e, ja: j, hitJa: hitJa });
        }
        if (!hits.length) return;
        dates++;
        titles += hits.length;
        if (dates > MAX_DATES_PER_PARITY) return;

        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'result-date';
        var mm = Number(key.slice(0, 2));
        btn.textContent = Number(key.slice(3)) + ' ' + MONTHS[mm - 1];
        var next = nextOccurrence(parity, key);
        if (next) {
          btn.title = 'Open ' + D.longDate(next);
          btn.addEventListener('click', function () {
            setDate(next);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        } else {
          btn.disabled = true;
        }
        li.appendChild(btn);

        var ul = document.createElement('ul');
        hits.forEach(function (h) {
          var row = document.createElement('li');
          var slot = document.createElement('span');
          slot.className = 'slot' + (h.slot === 6 ? ' bingo' : '');
          slot.textContent = SLOT_LABELS[h.slot] || '#' + (h.slot + 1);
          var text = document.createElement('span');
          if (h.en) highlight(text, h.en, q);
          if (h.ja) {
            var jaEl = jaSpan('');
            // Always show the Japanese text when that's where the match is.
            if (h.hitJa) jaEl.classList.add('hit');
            highlight(jaEl, h.ja, q);
            text.appendChild(jaEl);
          }
          row.appendChild(slot);
          row.appendChild(text);
          ul.appendChild(row);
        });
        li.appendChild(ul);
        list.appendChild(li);
      });

      $('count-' + parity).textContent = dates
        ? dates + ' date' + (dates === 1 ? '' : 's') + ', ' + titles + ' title' + (titles === 1 ? '' : 's') +
          (dates > MAX_DATES_PER_PARITY ? ' (first ' + MAX_DATES_PER_PARITY + ' shown)' : '')
        : '';
      total += titles;
    });

    box.hidden = false;
    $('search-summary').textContent = total
      ? total + ' matching title' + (total === 1 ? '' : 's') + ' for “' + query.trim() + '”. Click a date to open its next occurrence.'
      : 'No titles match “' + query.trim() + '”.';
  }

  function setDate(date, opts) {
    state.date = date;
    state.followToday = sameDay(date, today());
    var iso = D.toISODate(date);
    if (!(opts && opts.fromHash)) {
      history.replaceState(null, '', state.followToday ? location.pathname : '#' + iso);
    }
    render();
  }

  function render() {
    var date = state.date;
    var daily = D.getDaily(date, TITLES);
    state.daily = daily;

    $('date-input').value = daily.date;
    $('day-title').textContent = D.longDate(date);
    $('today-pill').hidden = !sameDay(date, today());

    var img = $('frame-img');
    img.src = daily.frameImage;
    img.alt = daily.frameLabel + ' frame';
    $('frame-name').textContent = daily.frameLabel;

    var list = $('title-list');
    list.innerHTML = '';
    if (daily.titles.length) {
      daily.titles.forEach(function (t, i) {
        var li = document.createElement('li');
        li.appendChild(document.createTextNode(t));
        if (daily.titlesJa[i]) li.appendChild(jaSpan(daily.titlesJa[i]));
        list.appendChild(li);
      });
    } else {
      var li = document.createElement('li');
      li.textContent = 'No title data for this date';
      list.appendChild(li);
    }

    // Some dates only list a bingo title on the Japanese side.
    $('bingo-box').hidden = !daily.bingo && !(showJapanese() && daily.bingoJa);
    $('bingo-title').textContent = daily.bingo || '';
    $('bingo-title-ja').textContent = daily.bingoJa || '';

    setMessage(D.formatMessage(daily, { japanese: showJapanese() }));
    document.title = 'WMMT Daily — ' + daily.date;
  }

  // -------------------------------------------------------------------------
  // Message + share link
  // -------------------------------------------------------------------------
  function setMessage(text) {
    $('message').value = text;
    updateShareLink();
  }

  function updateShareLink() {
    $('share-link').href = 'https://wa.me/?text=' + encodeURIComponent($('message').value);
  }

  // Frame image as a PNG on a dark backing, so the transparent centre
  // doesn't turn into a random colour when WhatsApp re-encodes it.
  function frameImageBlob(daily) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var pad = Math.round(img.naturalWidth * 0.06);
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth + pad * 2;
        canvas.height = img.naturalHeight + pad * 2;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#15171c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, pad, pad);
        canvas.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error('Could not create image'));
        }, 'image/png');
      };
      img.onerror = function () { reject(new Error('Could not load frame image')); };
      img.src = daily.frameImage;
    });
  }

  function frameFile(daily) {
    return frameImageBlob(daily).then(function (blob) {
      return new File([blob], 'wmmt-frame-' + daily.date + '-' + daily.frame + '.png', { type: 'image/png' });
    });
  }

  function flash(btn, text) {
    var original = btn.dataset.label || (btn.dataset.label = btn.textContent);
    btn.textContent = text;
    setTimeout(function () { btn.textContent = original; }, 1800);
  }

  function initImageSharing() {
    // Native share sheet with the image attached (phones, and Windows/macOS Chrome/Edge).
    var probe = typeof File === 'function' && new File([''], 'x.png', { type: 'image/png' });
    if (navigator.canShare && probe && navigator.canShare({ files: [probe] })) {
      $('share-files').hidden = false;
      $('share-files-hint').hidden = false;
      $('share-files').addEventListener('click', function () {
        var btn = this;
        frameFile(state.daily).then(function (file) {
          return navigator.share({ files: [file], text: $('message').value });
        }).catch(function (err) {
          if (err && err.name !== 'AbortError') flash(btn, 'Share failed');
        });
      });
    }

    $('copy-img').addEventListener('click', function () {
      var btn = this;
      if (!navigator.clipboard || typeof ClipboardItem !== 'function') {
        flash(btn, 'Not supported here');
        return;
      }
      // Pass the promise straight in so Safari keeps the user-gesture permission.
      navigator.clipboard.write([new ClipboardItem({ 'image/png': frameImageBlob(state.daily) })])
        .then(function () { flash(btn, 'Image copied — paste in WhatsApp'); })
        .catch(function () { flash(btn, 'Copy failed'); });
    });
  }

  // -------------------------------------------------------------------------
  // Direct push through the local server
  // -------------------------------------------------------------------------
  function api(path, options) {
    return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.error || r.statusText);
          return body;
        });
      });
  }

  var pollTimer = null;
  var lastWaState = null;

  function pollStatus() {
    api('/api/wa/status').then(function (s) {
      renderStatus(s);
      var delay = s.state === 'open' || s.state === 'disconnected' ? 10000 : 2000;
      clearTimeout(pollTimer);
      pollTimer = setTimeout(pollStatus, delay);
    }).catch(function () {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(pollStatus, 10000);
    });
  }

  function renderStatus(s) {
    var text = {
      disconnected: 'Not linked',
      connecting: 'Connecting…',
      qr: 'Scan the QR code with WhatsApp',
      open: 'Linked' + (s.me ? ' as ' + (s.me.name || s.me.id.split(':')[0].split('@')[0]) : ''),
    }[s.state] || s.state;
    if (s.error) text += ' — ' + s.error;

    $('wa-dot').className = 'dot ' + s.state;
    $('wa-status-text').textContent = text;
    $('wa-connect').hidden = s.state !== 'disconnected';
    $('wa-logout').hidden = s.state === 'disconnected';
    $('wa-qr').hidden = s.state !== 'qr' || !s.qr;
    if (s.qr) $('wa-qr-img').src = s.qr;
    $('wa-targets').hidden = s.state !== 'open';
    $('sched-form-wrap').hidden = s.state !== 'open';
    $('sched-need-link').hidden = s.state === 'open';

    if (s.state === 'open' && lastWaState !== 'open') loadGroups();
    lastWaState = s.state;
  }

  function loadGroups() {
    var list = $('group-list');
    list.setAttribute('data-empty', 'Loading groups…');
    list.innerHTML = '';
    api('/api/wa/groups').then(function (groups) {
      state.groups = groups;
      list.setAttribute('data-empty', 'No groups found');
      renderGroups();
    }).catch(function (err) {
      list.setAttribute('data-empty', 'Could not load groups: ' + err.message);
    });
  }

  function renderGroups() {
    var selected = load(SELECTED_GROUPS_KEY, []);
    var filter = $('group-filter').value.trim().toLowerCase();
    var list = $('group-list');
    list.innerHTML = '';
    state.groups
      .filter(function (g) { return !filter || g.name.toLowerCase().indexOf(filter) !== -1; })
      .forEach(function (g) {
        var li = document.createElement('li');
        li.innerHTML = '<label><input type="checkbox"><span class="name"></span></label><span class="meta"></span>';
        var cb = li.querySelector('input');
        cb.value = g.id;
        cb.checked = selected.indexOf(g.id) !== -1;
        cb.addEventListener('change', function () {
          var sel = load(SELECTED_GROUPS_KEY, []).filter(function (id) { return id !== g.id; });
          if (cb.checked) sel.push(g.id);
          save(SELECTED_GROUPS_KEY, sel);
        });
        li.querySelector('.name').textContent = g.name;
        li.querySelector('.meta').textContent = g.size + ' members';
        list.appendChild(li);
      });
  }

  function renderNumbers() {
    var numbers = load(NUMBERS_KEY, []);
    var list = $('number-list');
    list.innerHTML = '';
    numbers.forEach(function (n, i) {
      var li = document.createElement('li');
      li.innerHTML =
        '<label><input type="checkbox"><span class="name"></span></label>' +
        '<span class="meta"></span><button type="button" class="remove" aria-label="Remove">×</button>';
      var cb = li.querySelector('input');
      cb.checked = n.selected !== false;
      cb.addEventListener('change', function () {
        var all = load(NUMBERS_KEY, []);
        all[i].selected = cb.checked;
        save(NUMBERS_KEY, all);
      });
      li.querySelector('.name').textContent = n.name || n.number;
      li.querySelector('.meta').textContent = n.name ? n.number : '';
      li.querySelector('.remove').addEventListener('click', function () {
        var all = load(NUMBERS_KEY, []);
        all.splice(i, 1);
        save(NUMBERS_KEY, all);
        renderNumbers();
      });
      list.appendChild(li);
    });
  }

  // Numbers and groups currently ticked, with display names.
  function selectedTargets() {
    var selectedIds = load(SELECTED_GROUPS_KEY, []);
    return {
      numbers: load(NUMBERS_KEY, [])
        .filter(function (n) { return n.selected !== false; })
        .map(function (n) { return { number: n.number, name: n.name || '' }; }),
      groups: state.groups
        .filter(function (g) { return selectedIds.indexOf(g.id) !== -1; })
        .map(function (g) { return { id: g.id, name: g.name }; }),
    };
  }

  function send() {
    var targets = selectedTargets();
    var numbers = targets.numbers.map(function (n) { return n.number; });
    var groups = targets.groups.map(function (g) { return g.id; });
    var groupName = function (id) {
      var g = state.groups.find(function (x) { return x.id === id; });
      return g ? g.name : id;
    };

    var results = $('send-results');
    results.innerHTML = '';
    if (!numbers.length && !groups.length) {
      $('send-summary').textContent = 'Tick at least one number or group.';
      return;
    }

    var btn = $('send-btn');
    btn.disabled = true;
    $('send-summary').textContent = 'Sending to ' + (numbers.length + groups.length) + ' chat(s)…';

    api('/api/wa/send', {
      method: 'POST',
      body: JSON.stringify({
        date: state.daily.date,
        message: $('message').value,
        includeImage: $('include-image').checked,
        numbers: numbers,
        groups: groups,
      }),
    }).then(function (res) {
      var ok = res.results.filter(function (r) { return r.ok; }).length;
      $('send-summary').textContent = 'Sent ' + ok + ' of ' + res.results.length + '.';
      res.results.forEach(function (r) {
        var li = document.createElement('li');
        li.className = r.ok ? 'ok' : 'err';
        var label = r.kind === 'group' ? groupName(r.target) : r.target;
        li.textContent = label + (r.ok ? '' : ' — ' + r.error);
        results.appendChild(li);
      });
    }).catch(function (err) {
      $('send-summary').textContent = 'Send failed: ' + err.message;
    }).then(function () {
      btn.disabled = false;
    });
  }

  // -------------------------------------------------------------------------
  // Scheduled sends
  // -------------------------------------------------------------------------
  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function describeTargets(s) {
    var names = s.numbers.map(function (n) { return n.name || n.number; })
      .concat(s.groups.map(function (g) { return g.name; }));
    return 'To: ' + names.join(', ');
  }

  function renderSchedules(list) {
    var ul = $('sched-list');
    ul.innerHTML = '';
    list.forEach(function (s) {
      var li = document.createElement('li');
      if (s.repeat === 'once' && s.done) li.className = 'done';

      var when = document.createElement('span');
      when.className = 'when';
      when.textContent = s.repeat === 'daily'
        ? 'Every day at ' + s.time
        : 'Once on ' + D.fromISODate(s.date).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        }) + ' at ' + s.time;
      li.appendChild(when);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn ghost';
      del.textContent = 'Delete';
      del.addEventListener('click', function () {
        if (!confirm('Delete this scheduled send?')) return;
        api('/api/schedules/' + encodeURIComponent(s.id), { method: 'DELETE' })
          .then(loadSchedules)
          .catch(function (e) { $('sched-msg').textContent = e.message; });
      });
      li.appendChild(del);

      var who = document.createElement('span');
      who.className = 'who';
      who.textContent = describeTargets(s) + ' · ' +
        (s.includeImage ? 'with frame image' : 'text only') + (s.japanese ? ' · with Japanese' : '');
      li.appendChild(who);

      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = s.nextRun ? 'Next: ' + fmtDateTime(s.nextRun) : 'Finished';
      if (s.lastRun) {
        var last = document.createElement('span');
        var ok = s.lastRun.results ? s.lastRun.results.filter(function (r) { return r.ok; }).length : 0;
        var total = s.lastRun.results ? s.lastRun.results.length : 0;
        var good = !s.lastRun.error && ok === total;
        last.className = 'last ' + (good ? 'ok' : 'err');
        last.textContent = ' · Last: ' + fmtDateTime(s.lastRun.at) + ' — ' +
          (s.lastRun.error || ('sent ' + ok + ' of ' + total));
        if (s.lastRun.results) {
          last.title = s.lastRun.results.map(function (r) {
            return (r.ok ? '✓ ' : '✕ ') + r.target + (r.ok ? '' : ' — ' + r.error);
          }).join('\n');
        }
        meta.appendChild(last);
      }
      li.appendChild(meta);
      ul.appendChild(li);
    });
  }

  function loadSchedules() {
    return api('/api/schedules').then(renderSchedules).catch(function () { /* server gone */ });
  }

  function addSchedule(e) {
    e.preventDefault();
    var repeat = $('sched-repeat').value;
    var targets = selectedTargets();
    var msg = $('sched-msg');
    if (!targets.numbers.length && !targets.groups.length) {
      msg.textContent = 'Tick at least one number or group above.';
      return;
    }
    api('/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        repeat: repeat,
        time: $('sched-time').value,
        date: repeat === 'once' ? $('sched-date').value : undefined,
        numbers: targets.numbers,
        groups: targets.groups,
        includeImage: $('include-image').checked,
        japanese: showJapanese(),
      }),
    }).then(function (s) {
      msg.textContent = 'Scheduled. Next send: ' + fmtDateTime(s.nextRun) + '.';
      loadSchedules();
    }).catch(function (err) {
      msg.textContent = err.message;
    });
  }

  function initSchedules() {
    $('sched-repeat').addEventListener('change', function () {
      var once = this.value === 'once';
      $('sched-date').hidden = !once;
      $('sched-date').required = once;
      if (once && !$('sched-date').value) $('sched-date').value = D.toISODate(today());
    });
    $('sched-form').addEventListener('submit', addSchedule);
    loadSchedules();
    setInterval(loadSchedules, 30000);
  }

  function initWhatsApp() {
    // The direct-send panel only works when served by the optional local server
    // (server.js). On static hosting such as GitHub Pages it stays hidden.
    var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!isLocal) return;
    api('/api/wa/status').then(function (s) {
      $('push-section').hidden = false;
      $('push-hint').hidden = false;
      renderStatus(s);
      pollStatus();
      initSchedules();
    }).catch(function () { /* static server: no direct push */ });

    $('wa-connect').addEventListener('click', function () {
      $('wa-status-text').textContent = 'Connecting…';
      api('/api/wa/connect', { method: 'POST' }).then(pollStatus).catch(function (e) {
        $('wa-status-text').textContent = 'Could not connect: ' + e.message;
      });
    });
    $('wa-logout').addEventListener('click', function () {
      if (!confirm('Unlink this WhatsApp account from WMMT Daily?')) return;
      api('/api/wa/logout', { method: 'POST' }).then(pollStatus);
    });
    $('reload-groups').addEventListener('click', loadGroups);
    $('group-filter').addEventListener('input', renderGroups);
    $('add-number').addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = $('number-input').value.trim();
      var digits = raw.replace(/\D/g, '');
      if (digits.length < 7) {
        $('number-input').setCustomValidity('Enter the number with country code, e.g. +60 12 345 6789');
        $('number-input').reportValidity();
        return;
      }
      var all = load(NUMBERS_KEY, []);
      if (!all.some(function (n) { return n.number.replace(/\D/g, '') === digits; })) {
        all.push({ number: '+' + digits, name: $('number-name').value.trim(), selected: true });
        save(NUMBERS_KEY, all);
      }
      $('number-input').value = '';
      $('number-name').value = '';
      renderNumbers();
    });
    $('number-input').addEventListener('input', function () { this.setCustomValidity(''); });
    $('send-btn').addEventListener('click', send);
    $('number-list').setAttribute('data-empty', 'No numbers yet — add one above');
    renderNumbers();
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------
  function dateFromHash() {
    var m = /^#(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    if (!m) return null;
    try { return D.fromISODate(m[1]); } catch (e) { return null; }
  }

  $('prev-day').addEventListener('click', function () { setDate(addDays(state.date, -1)); });
  $('next-day').addEventListener('click', function () { setDate(addDays(state.date, 1)); });
  $('today-btn').addEventListener('click', function () { setDate(today()); });
  $('date-input').addEventListener('change', function (e) {
    if (e.target.value) setDate(D.fromISODate(e.target.value));
  });
  window.addEventListener('hashchange', function () {
    setDate(dateFromHash() || today(), { fromHash: true });
  });

  $('message').addEventListener('input', updateShareLink);
  $('reset-msg').addEventListener('click', function () {
    setMessage(D.formatMessage(state.daily, { japanese: showJapanese() }));
  });

  $('show-ja').checked = load(SHOW_JA_KEY, false);
  applyJapanese();
  $('show-ja').addEventListener('change', function () {
    save(SHOW_JA_KEY, showJapanese());
    applyJapanese();
    render();
  });

  var searchTimer = null;
  $('title-search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { search(e.target.value); }, 150);
  });
  $('copy-msg').addEventListener('click', function () {
    var btn = this;
    navigator.clipboard.writeText($('message').value).then(function () { flash(btn, 'Copied'); });
  });
  initImageSharing();

  // Roll over to the new day at midnight if the user is watching "today".
  setInterval(function () {
    if (state.followToday && !sameDay(state.date, today())) setDate(today());
  }, 60000);

  setDate(dateFromHash() || today(), { fromHash: true });
  initWhatsApp();
})();
