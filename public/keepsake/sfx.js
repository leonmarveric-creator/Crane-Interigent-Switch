/* 招待くじの音 (ゲストのページ /k と GUEST BOARD の試聴で共通)
   window.KSFX.set(cfg) で設定を渡す。cfg = { <slot>: { mode: "synth"|"file"|"off", vol: 0-150, url } }
   slot: bgm (待っている間) / env (封筒) / drum (カプセルを揺らす) / open (開く) / win (当選) / card (贈りものが出る) / next (次へ・おわり)
   "synth" はこのファイルで作るオリジナルの音。"file" はアップした音 (読めないときは標準の音)。 */
(function () {
  "use strict";
  var SLOTS = ["bgm", "env", "drum", "open", "win", "card", "next"];
  var AC = null, MG = null, BG = null, SG = {}, cur = null, muted = false, cfg = {}, raw = {}, buf = {};
  var bgT = 0, bgN = 0, bgOn = false, bgSrc = null, bgLevel = 1;
  var SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  function unlock() {
    // iPad の消音モードでも鳴るように (Safari 17+)。古い iOS は無音の音声を 1 回鳴らして解放
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    try { var a = new Audio(SILENT); a.play().catch(function () { }); } catch (e) { /* ignore */ }
  }
  var vol = function (s) { var c = cfg[s]; return c && c.vol != null && isFinite(c.vol) ? Math.max(0, Math.min(1.5, c.vol / 100)) : 1; };
  var mode = function (s) { var c = cfg[s]; return !c ? "synth" : c.mode === "off" ? "off" : c.mode === "file" && c.url ? "file" : "synth"; };

  function ac() {
    try {
      if (!AC) {
        unlock(); AC = new (window.AudioContext || window.webkitAudioContext)();
        MG = AC.createGain(); MG.gain.value = muted ? 0 : 1; MG.connect(AC.destination);
        BG = AC.createGain(); BG.gain.value = 0; BG.connect(MG);
        SLOTS.forEach(function (s) { SG[s] = AC.createGain(); SG[s].connect(s === "bgm" ? BG : MG); });
        applyVol(); decodeAll();
      }
      if (AC.state !== "running") AC.resume();
    } catch (e) { /* ignore */ }
    return AC;
  }
  function applyVol() { if (AC) SLOTS.forEach(function (s) { SG[s].gain.value = vol(s); }); }

  /* アップした音: 先に読み込んでおき、音を出せるようになったら変換 */
  function fetchAll() {
    SLOTS.forEach(function (s) {
      var u = mode(s) === "file" ? cfg[s].url : null; if (!u || raw[u] || buf[u]) return;
      raw[u] = fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).catch(function () { return null; });
    });
    if (AC) decodeAll();
  }
  function decodeAll() {
    Object.keys(raw).forEach(function (u) {
      var p = raw[u]; if (!p || buf[u]) return; buf[u] = "loading";
      p.then(function (ab) {
        if (!ab) { buf[u] = null; return; }
        var done = function (b) { buf[u] = b; if (bgOn && mode("bgm") === "file" && cfg.bgm.url === u && !bgSrc) startBgm(); };
        try { var q = AC.decodeAudioData(ab, done, function () { buf[u] = null; }); if (q && q.catch) q.catch(function () { buf[u] = null; }); } catch (e) { buf[u] = null; }
      });
    });
  }
  function playBuf(s) {
    var u = cfg[s].url, b = buf[u];
    if (b === null) return false; // 読めなかった → 標準の音
    if (b && b !== "loading") { var src = AC.createBufferSource(); src.buffer = b; src.connect(SG[s]); src.start(); return true; }
    try { var a = new Audio(u); a.volume = Math.min(1, vol(s)); a.muted = muted; a.play().catch(function () { }); return true; } catch (e) { return false; }
  }

  /* ---- 標準の音 (オリジナル) ---- */
  var out = function () { return cur || MG; };
  function tone(f, t, d, v, type, to) {
    var c = AC, o = c.createOscillator(), g = c.createGain(), T0 = c.currentTime + t; o.type = type || "triangle"; o.frequency.setValueAtTime(f, T0); if (to) o.frequency.exponentialRampToValueAtTime(to, T0 + d);
    g.gain.setValueAtTime(0, T0); g.gain.linearRampToValueAtTime(v, T0 + .02); g.gain.exponentialRampToValueAtTime(.0001, T0 + d); o.connect(g).connect(out()); o.start(T0); o.stop(T0 + d + .05);
  }
  function noise(t, d, v, hp) {
    var c = AC, n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0);
    for (var i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = "highpass"; f.frequency.value = hp; g.gain.value = v; s.buffer = b; s.connect(f).connect(g).connect(out()); s.start(c.currentTime + t);
  }
  var SYN = {
    env: function () { tone(660, 0, .5, .08, "sine"); tone(990, .12, .7, .06, "sine"); },
    drum: function () { for (var i = 0; i < 22; i++) tone(120 + i * 9, i * .055, .06, .07, "square"); },
    open: function () { tone(90, 0, .9, .3, "sine", 38); noise(0, .5, .25, 1500); },
    win: function () { [[523, 0], [659, .14], [784, .28], [1047, .44], [784, .62], [1047, .76]].forEach(function (a) { tone(a[0], a[1], .5, .11); tone(a[0] * 2, a[1], .4, .04, "sine"); }); [1319, 1568, 2093].forEach(function (f, i) { tone(f, .95 + i * .07, 1.4, .06, "sine"); }); },
    card: function () { for (var i = 0; i < 7; i++) tone(700 + i * 90, i * .33, .09, .05, "sine"); [1568, 2093, 2637].forEach(function (f, i) { tone(f, 3 + i * .09, .9, .07, "sine"); }); },
    next: function () { tone(500, 0, .2, .06, "sine", 900); tone(1047, .12, .5, .05, "sine"); }
  };
  function play(s) {
    if (!ac() || mode(s) === "off") return;
    if (mode(s) === "file" && playBuf(s)) return;
    if (!SYN[s]) return;
    cur = SG[s]; try { SYN[s](); } finally { cur = null; }
  }

  /* ---- BGM ---- */
  var BGS = [[0, 2, 4, 7, 4, 2, 9, 7], [0, 4, 7, 9, 12, 9, 7, 4], [2, 4, 7, 4, 9, 7, 4, 2], [0, 2, 4, 2, 7, 4, 2, 0]], PEN = [0, 2, 4, 7, 9];
  function pluck(f, T0, v) {
    var c = AC, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = "triangle"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.01; lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 6, T0); lp.frequency.exponentialRampToValueAtTime(f * 1.5, T0 + 1);
    g.gain.setValueAtTime(0, T0); g.gain.linearRampToValueAtTime(v, T0 + .008); g.gain.exponentialRampToValueAtTime(.0001, T0 + 1.6);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(SG.bgm); o.start(T0); o2.start(T0); o.stop(T0 + 1.7); o2.stop(T0 + 1.7);
  }
  function tick() {
    var T0 = AC.currentTime + .05, ph = BGS[Math.floor(bgN / 8) % BGS.length], base = 293.66;
    pluck(base * Math.pow(2, ph[bgN % 8] / 12), T0, .09);
    if (bgN % 4 === 0) pluck(base / 2 * Math.pow(2, PEN[Math.floor(bgN / 8) % 3] / 12), T0, .07);
    if (bgN % 16 === 14) pluck(base * 2 * Math.pow(2, 7 / 12), T0 + .16, .03);
    bgN++;
  }
  function ramp(v, sec) { if (!BG) return; var t = AC.currentTime; BG.gain.cancelScheduledValues(t); BG.gain.setValueAtTime(BG.gain.value, t); BG.gain.linearRampToValueAtTime(v, t + (sec || .6)); }
  function stopSrc() { if (bgT) { clearInterval(bgT); bgT = 0; } if (bgSrc) { try { bgSrc.stop(); } catch (e) { /* ignore */ } bgSrc = null; } }
  function startBgm() {
    var m = mode("bgm");
    if (m === "off") return;
    if (m === "file") {
      var b = buf[cfg.bgm.url];
      if (b && b !== "loading") { if (!bgSrc) { stopSrc(); bgSrc = AC.createBufferSource(); bgSrc.buffer = b; bgSrc.loop = true; bgSrc.connect(SG.bgm); bgSrc.start(); } }
      else if (b === null && !bgT) { bgN = 0; bgT = setInterval(tick, 330); tick(); } // 読めなかったら標準の BGM
      return; // 読み込み中: 読めたら startBgm がもう一度呼ばれる
    }
    if (!bgT) { bgN = 0; bgT = setInterval(tick, 330); tick(); }
  }
  function bgm(on, sec) {
    if (!ac()) return;
    bgOn = on;
    if (on) { startBgm(); bgLevel = 1; ramp(1, sec || 1.2); }
    else { bgLevel = 0; ramp(0, sec || 2.5); setTimeout(function () { if (!bgOn) stopSrc(); }, ((sec || 2.5) + .2) * 1000); }
  }
  /* 声のあいだは小さく / 揺らす間は止める */
  function level(v, sec) { if (AC && bgOn) { bgLevel = v; ramp(v, sec); } }

  window.KSFX = {
    SLOTS: SLOTS,
    set: function (c) { cfg = c || {}; applyVol(); fetchAll(); if (AC && bgOn) { stopSrc(); startBgm(); } },
    ac: ac, play: play, bgm: bgm, level: level,
    playing: function () { return bgOn; },
    mute: function (m) { muted = !!m; if (MG) MG.gain.value = muted ? 0 : 1; },
    muted: function () { return muted; },
    stopAll: function () { bgOn = false; stopSrc(); if (BG) BG.gain.value = 0; }
  };
})();
