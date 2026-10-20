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

  function fromISODate(iso) {
    var p = String(iso).split('-').map(Number);
    if (p.length !== 3 || p.some(isNaN)) throw new Error('Invalid date: ' + iso);
    return new Date(p[0], p[1] - 1, p[2]);
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
      return en ? en + '\n    _' + ja + '_' : ja;
    };
    var lines = [
      '🏁 *WMMT Daily* — ' + longDate(date),
      '',
      '🖼️ *Bingo frame:* ' + daily.frameLabel,
      '',
      '🏆 *Daily titles (overseas' + (japanese ? ' / Japanese' : '') + '):*',
    ];
    if (daily.titles.length) {
      daily.titles.forEach(function (t, i) { lines.push((i + 1) + '. ' + withJa(t, daily.titlesJa[i])); });
    } else {
      lines.push('_No title data for this date_');
    }
    var bingo = withJa(daily.bingo, japanese ? daily.bingoJa : null);
    if (bingo) {
      lines.push('', '🎯 *6RR Bingo title:* ' + bingo);
    }
    return lines.join('\n');
  }

  return {
    FRAMES: FRAMES,
    FRAMES_LEAP: FRAMES_LEAP,
    isLeapYear: isLeapYear,
    dayOfYear: dayOfYear,
    toISODate: toISODate,
    fromISODate: fromISODate,
    frameFor: frameFor,
    frameLabel: frameLabel,
    getDaily: getDaily,
    longDate: longDate,
    formatMessage: formatMessage,
  };
});
