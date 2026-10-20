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
      daily.titles.forEach(function (t) {
        var li = document.createElement('li');
        li.textContent = t;
        list.appendChild(li);
      });
    } else {
      var li = document.createElement('li');
      li.textContent = 'No title data for this date';
      list.appendChild(li);
    }

    $('bingo-box').hidden = !daily.bingo;
    $('bingo-title').textContent = daily.bingo || '';

    renderWeek();
    setMessage(D.formatMessage(daily));
    document.title = 'WMMT Daily — ' + daily.date;
  }

  function renderWeek() {
    var strip = $('week-strip');
    strip.innerHTML = '';
    for (var i = 1; i <= 7; i++) {
      var d = addDays(state.date, i);
      var daily = D.getDaily(d, TITLES);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'week-day';
      if (sameDay(d, today())) btn.setAttribute('aria-current', 'date');
      btn.title = D.longDate(d);
      btn.innerHTML =
        '<span class="d"></span><img loading="lazy" alt=""><span class="f"></span><span class="b"></span>';
      btn.querySelector('.d').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      btn.querySelector('img').src = daily.frameImage;
      btn.querySelector('.f').textContent = daily.frameLabel;
      btn.querySelector('.b').textContent = daily.bingo || daily.titles[0] || '';
      btn.addEventListener('click', setDate.bind(null, d, undefined));
      strip.appendChild(btn);
    }
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

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
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

  function send() {
    var numbers = load(NUMBERS_KEY, [])
      .filter(function (n) { return n.selected !== false; })
      .map(function (n) { return n.number; });
    var groups = load(SELECTED_GROUPS_KEY, [])
      .filter(function (id) { return state.groups.some(function (g) { return g.id === id; }); });
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

    var includeImage = $('include-image').checked;
    var image = includeImage
      ? frameImageBlob(state.daily).then(blobToDataURL).catch(function () { return null; })
      : Promise.resolve(null);

    image.then(function (dataUrl) {
      return api('/api/wa/send', {
        method: 'POST',
        body: JSON.stringify({
          date: state.daily.date,
          message: $('message').value,
          includeImage: includeImage,
          image: dataUrl,
          numbers: numbers,
          groups: groups,
        }),
      });
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
  $('reset-msg').addEventListener('click', function () { setMessage(D.formatMessage(state.daily)); });
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
