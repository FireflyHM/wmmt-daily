/*
 * Shared date -> daily titles / bingo frame logic.
 * Loaded by the browser (window.WMMTDaily) and by server.js (require).
 *
 * Titles: overseas ("外") rows from https://w.atwiki.jp/wmmt_title/
 *   - titles repeat on a two-year cycle, so the table is keyed by even/odd year
 * Frames: rotation from https://www.dragapult.xyz/wmmt-frame-viewer/
 *   - one frame per day-of-year; leap years insert "studs2" on day 60
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WMMTDaily = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 365-day frame rotation (non-leap year), in day-of-year order.
  var FRAMES = [
    "flame1", "animal1", "neon1", "metal1", "dangerous1", "relief1", "casual1", "floral1",
    "splash1", "graffiti1", "japonism1", "silvercraft1", "cosmos1", "mechanical1", "camo1", "digital1",
    "wall1", "tropical1", "pinstripe1", "leather1", "tile1", "studs1", "steel1", "wood1",
    "sticker1", "thunderbolt1", "glitter1", "jewel1", "tigerstripe1", "lines1", "circles1", "electronic1",
    "fire1", "crush1", "particle1", "leathermesh1", "ortega1", "splintercamo1", "flame2", "animal2",
    "neon2", "metal2", "dangerous2", "relief2", "casual2", "floral2", "splash2", "graffiti2",
    "japonism2", "silvercraft2", "cosmos2", "mechanical2", "camo2", "digital2", "wall2", "tropical2",
    "pinstripe2", "leather2", "tile2", "steel2", "wood2", "sticker2", "thunderbolt2", "glitter2",
    "jewel2", "tigerstripe2", "lines2", "circles2", "electronic2", "fire2", "crush2", "particle2",
    "leathermesh2", "ortega2", "splintercamo2", "flame3", "animal3", "neon3", "metal3", "dangerous3",
    "casual3", "floral3", "splash3", "graffiti3", "japonism3", "silvercraft3", "cosmos3", "mechanical3",
    "camo3", "digital3", "wall3", "tropical3", "pinstripe3", "tile3", "studs3", "steel3",
    "wood3", "thunderbolt3", "glitter3", "tigerstripe3", "lines3", "circles3", "electronic3", "fire3",
    "crush3", "particle3", "leathermesh3", "ortega3", "splintercamo3", "flame4", "animal4", "neon4",
    "metal4", "dangerous4", "casual4", "floral4", "splash4", "graffiti4", "japonism4", "mechanical4",
    "camo4", "digital4", "wall4", "pinstripe4", "steel4", "wood4", "thunderbolt4", "glitter4",
    "tigerstripe4", "lines4", "circles4", "electronic4", "fire4", "crush4", "particle4", "leathermesh4",
    "silvercraft4", "ortega4", "splintercamo4", "flame5", "animal5", "neon5", "metal5", "dangerous5",
    "casual5", "splash5", "japonism5", "silvercraft5", "flame6", "animal6", "neon6", "metal6",
    "dangerous6", "casual6", "splash6", "japonism6", "silvercraft6", "silvercraft7", "animal7", "neon7",
    "metal7", "dangerous7", "casual7", "splash7", "japonism7", "animal8", "neon8", "casual8",
    "splash8", "japonism8", "animal9", "neon9", "animal10", "neon10", "neon11", "neon12",
    "neon13", "neon14", "neon15", "neon16", "neon17", "neon18", "flame1", "animal1",
    "neon1", "metal1", "dangerous1", "relief1", "casual1", "floral1", "splash1", "graffiti1",
    "japonism1", "silvercraft1", "cosmos1", "mechanical1", "camo1", "digital1", "wall1", "tropical1",
    "pinstripe1", "leather1", "tile1", "studs1", "steel1", "wood1", "sticker1", "thunderbolt1",
    "glitter1", "jewel1", "tigerstripe1", "lines1", "circles1", "electronic1", "fire1", "crush1",
    "particle1", "leathermesh1", "ortega1", "splintercamo1", "flame2", "animal2", "neon2", "metal2",
    "dangerous2", "relief2", "casual2", "floral2", "splash2", "graffiti2", "japonism2", "silvercraft2",
    "cosmos2", "mechanical2", "camo2", "digital2", "wall2", "tropical2", "pinstripe2", "leather2",
    "tile2", "studs2", "steel2", "wood2", "sticker2", "thunderbolt2", "glitter2", "jewel2",
    "tigerstripe2", "lines2", "circles2", "electronic2", "fire2", "crush2", "particle2", "leathermesh2",
    "ortega2", "splintercamo2", "flame3", "animal3", "neon3", "metal3", "dangerous3", "casual3",
    "floral3", "splash3", "graffiti3", "japonism3", "silvercraft3", "cosmos3", "mechanical3", "camo3",
    "digital3", "wall3", "tropical3", "pinstripe3", "tile3", "studs3", "steel3", "wood3",
    "thunderbolt3", "glitter3", "tigerstripe3", "lines3", "circles3", "electronic3", "fire3", "crush3",
    "particle3", "leathermesh3", "ortega3", "splintercamo3", "flame4", "animal4", "neon4", "metal4",
    "dangerous4", "casual4", "floral4", "splash4", "graffiti4", "japonism4", "mechanical4", "camo4",
    "digital4", "wall4", "pinstripe4", "steel4", "wood4", "thunderbolt4", "glitter4", "tigerstripe4",
    "lines4", "circles4", "electronic4", "fire4", "crush4", "particle4", "leathermesh4", "silvercraft4",
    "silvercraft5", "ortega4", "splintercamo4", "flame5", "flame6", "animal5", "animal6", "neon5",
    "neon6", "metal5", "dangerous5", "casual5", "splash5", "japonism5", "metal6", "dangerous6",
    "casual6", "splash6", "japonism6", "silvercraft6", "silvercraft7", "animal7", "neon7", "metal7",
    "dangerous7", "casual7", "splash7", "japonism7", "animal8", "neon8", "casual8", "splash8",
    "japonism8", "animal9", "neon9", "animal10", "neon10", "neon11", "neon12", "neon13",
    "neon14", "neon15", "neon16", "neon17", "neon18",
  ];

  var FRAMES_LEAP = FRAMES.slice(0, 59).concat(['studs2'], FRAMES.slice(59));

  // Words used to turn "splintercamo3" into "Splinter Camo 3".
  var FRAME_LABELS = {
    tigerstripe: 'Tiger Stripe',
    leathermesh: 'Leather Mesh',
    splintercamo: 'Splinter Camo',
    silvercraft: 'Silver Craft',
  };

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function dayOfYear(date) {
    var start = Date.UTC(date.getFullYear(), 0, 1);
    var now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((now - start) / 86400000) + 1;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  // "YYYY-MM-DD" in local time (what <input type="date"> uses).
  function toISODate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  // Throws on anything that isn't a real calendar date, rather than letting
  // Date roll "2026-02-31" over to 3 March.
  function fromISODate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) throw new Error('Invalid date: ' + iso);
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var date = new Date(2000, mo - 1, d);
    date.setFullYear(y); // the constructor maps years 0-99 to 1900-1999
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
      throw new Error('Invalid date: ' + iso);
    }
    return date;
  }

  function frameFor(date) {
    var frames = isLeapYear(date.getFullYear()) ? FRAMES_LEAP : FRAMES;
    return frames[(dayOfYear(date) - 1) % frames.length];
  }

  function frameLabel(id) {
    var m = /^([a-z]+)(\d+)$/.exec(id);
    if (!m) return id;
    var base = FRAME_LABELS[m[1]] || m[1].charAt(0).toUpperCase() + m[1].slice(1);
    return base + ' ' + m[2];
  }

  function titleRow(titleTable, lang, parity, key) {
    var t = titleTable && titleTable[lang] && titleTable[lang][parity];
    return (t && t[key]) || [];
  }

  /**
   * Everything shown for one date.
   * @param {Date} date
   * @param {{en: Object, ja: Object}} titleTable data/titles.js
   */
  function getDaily(date, titleTable) {
    var parity = date.getFullYear() % 2 === 0 ? 'even' : 'odd';
    var key = pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    var row = titleRow(titleTable, 'en', parity, key);
    var rowJa = titleRow(titleTable, 'ja', parity, key);
    var frame = frameFor(date);
    return {
      date: toISODate(date),
      parity: parity,
      titles: row.slice(0, 6),
      bingo: row[6] || null,
      titlesJa: rowJa.slice(0, 6),
      bingoJa: rowJa[6] || null,
      frame: frame,
      frameLabel: frameLabel(frame),
      frameImage: 'img/frames/' + frame + '.png',
    };
  }

  function longDate(date) {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // 5 March -> "·3 05", 21 October -> "10 21"
  function numberPlate(date) {
    var month = date.getMonth() + 1;
    return (month < 10 ? '·' + month : String(month)) + ' ' + pad(date.getDate());
  }

  /**
   * Plain-text message for WhatsApp (uses *bold* / _italic_ markup).
   * @param {Object} daily from getDaily()
   * @param {{japanese?: boolean}} [opts] add the Japanese title under each one
   */
  function formatMessage(daily, opts) {
    var japanese = !!(opts && opts.japanese);
    var date = fromISODate(daily.date);
    var withJa = function (en, ja) {
      if (!japanese || !ja) return en || ja;
      return en ? en + '\n    ' + ja : ja;
    };
    var lines = [
      '🏁 *WMMT Daily* — ' + longDate(date),
      '',
      '🖼️ *Bingo Frame:* ' + daily.frameLabel,
      '🚗 *Number Plate:* ' + numberPlate(date),
    ];
    var bingo = withJa(daily.bingo, japanese ? daily.bingoJa : null);
    if (bingo) {
      lines.push('🎯 *Bingo Title:* ' + bingo);
    }
    lines.push('', '🏆 *Daily Titles:*');
    if (daily.titles.length) {
      daily.titles.forEach(function (t, i) { lines.push((i + 1) + '. ' + withJa(t, daily.titlesJa[i])); });
    } else {
      lines.push('_No title data for this date_');
    }
    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Shared by the page (app.js) and the local server (server.js)
  // -------------------------------------------------------------------------

  // Shared frame images get a dark border, so WhatsApp's re-encoding doesn't
  // fill the transparent centre with an arbitrary colour.
  var FRAME_PAD_RATIO = 0.06;
  var FRAME_BG = '#15171c';

  // Number plate drawn over img/plate-blank.png, in that image's pixels.
  // index.html's plate SVG uses the same numbers.
  var PLATE = {
    image: 'img/plate-blank.png',
    width: 478,
    height: 232,
    ink: '#052c00',
    fontSize: 153,
    baseline: 194,
    slots: [133, 210, 341, 422], // digit centres
    dot: { x: 133, y: 146, r: 10 }, // replaces the first digit of a one-digit month
  };

  // "·3 05" -> {dot: true, digits: ['', '3', '0', '5']}; "10 21" -> {dot: false, digits: ['1', '0', '2', '1']}
  function plateDigits(plate) {
    var digits = plate.replace(/\D/g, '').split('');
    var dot = digits.length === 3;
    if (dot) digits.unshift('');
    return { dot: dot, digits: digits };
  }

  // Shared image: the frame on top, the plate below at the frame's height.
  function shareLayout(frameWidth, frameHeight) {
    var pad = Math.round(frameWidth * FRAME_PAD_RATIO);
    var plateWidth = Math.round(frameHeight * PLATE.width / PLATE.height);
    var width = frameWidth + pad * 2;
    return {
      width: width,
      height: frameHeight * 2 + pad * 3,
      frame: { x: pad, y: pad, width: frameWidth, height: frameHeight },
      plate: { x: Math.round((width - plateWidth) / 2), y: frameHeight + pad * 2, width: plateWidth, height: frameHeight },
    };
  }

  var MIN_PHONE_DIGITS = 7;

  // "+60 12-345 6789" -> "60123456789", or null if it's too short to be a number.
  function normalizePhone(raw) {
    var digits = String(raw == null ? '' : raw).replace(/\D/g, '');
    return digits.length >= MIN_PHONE_DIGITS ? digits : null;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  // Case/width-insensitive form: "ＴＯＦＵ" and "tofu" match, as do full/half-width kana.
  function normalizeForSearch(s) {
    return String(s).normalize('NFKC').toLowerCase();
  }

  // Next date on or after `from` with this "MM-DD" key, in a year of the given parity.
  function nextOccurrence(parity, key, from) {
    var mm = Number(key.slice(0, 2));
    var dd = Number(key.slice(3));
    var start = startOfDay(from);
    for (var y = start.getFullYear(); y < start.getFullYear() + 12; y++) {
      if ((y % 2 === 0) !== (parity === 'even')) continue;
      var d = new Date(y, mm - 1, dd);
      if (d.getMonth() !== mm - 1) continue; // 29 Feb in a non-leap year
      if (d >= start) return d;
    }
    return null;
  }

  /**
   * Every date whose English or Japanese titles contain the query.
   * @param {{en: Object, ja: Object}} titleTable data/titles.js
   * @param {string} query already passed through normalizeForSearch()
   * @returns {{even: Match[], odd: Match[]}} in table order, where
   *   Match = {key: "MM-DD", hits: [{slot, en, ja, hitJa}]}
   */
  function findTitleMatches(titleTable, query) {
    var result = {};
    ['even', 'odd'].forEach(function (parity) {
      var en = titleTable.en[parity];
      var ja = titleTable.ja[parity];
      result[parity] = [];
      Object.keys(en).forEach(function (key) {
        var rowEn = en[key] || [];
        var rowJa = ja[key] || [];
        var hits = [];
        for (var i = 0; i < Math.max(rowEn.length, rowJa.length); i++) {
          var e = rowEn[i] || '';
          var j = rowJa[i] || '';
          var hitEn = e && normalizeForSearch(e).indexOf(query) !== -1;
          var hitJa = j && normalizeForSearch(j).indexOf(query) !== -1;
          if (hitEn || hitJa) hits.push({ slot: i, en: e, ja: j, hitJa: !!hitJa });
        }
        if (hits.length) result[parity].push({ key: key, hits: hits });
      });
    });
    return result;
  }

  return {
    FRAMES: FRAMES,
    FRAMES_LEAP: FRAMES_LEAP,
    FRAME_PAD_RATIO: FRAME_PAD_RATIO,
    FRAME_BG: FRAME_BG,
    PLATE: PLATE,
    plateDigits: plateDigits,
    shareLayout: shareLayout,
    MIN_PHONE_DIGITS: MIN_PHONE_DIGITS,
    normalizePhone: normalizePhone,
    startOfDay: startOfDay,
    addDays: addDays,
    normalizeForSearch: normalizeForSearch,
    nextOccurrence: nextOccurrence,
    findTitleMatches: findTitleMatches,
    isLeapYear: isLeapYear,
    dayOfYear: dayOfYear,
    toISODate: toISODate,
    fromISODate: fromISODate,
    frameFor: frameFor,
    frameLabel: frameLabel,
    getDaily: getDaily,
    longDate: longDate,
    numberPlate: numberPlate,
    formatMessage: formatMessage,
  };
});
