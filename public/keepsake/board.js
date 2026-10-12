/* GUEST BOARD (スタッフ): 滞在中のゲスト・招待くじ・申し込み・見本・設定。データは /api/keepsake/admin */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var API = "/api/keepsake/admin", app = $("#app"), zm = $("#zm");
  var D = null, tab = "guests", sel = {}, pass = {}, msg = null, busy = false, snd = null, sndDirty = false, sndBusy = "";
  var GF = [["art", "🎨", "ART"], ["rec", "🎵", "Records"], ["card", "🃏", "ポケモンカード"]];
  var KN = { art: "Crane Journey ART", rec: "Crane Nest Records", cheers: "Cheers Around the World" };
  var LN = { ja: "日本語", en: "English", zh: "中文", ko: "한국어" };
  var J = 9 * 3600e3, pad = function (n) { return String(n).padStart(2, "0"); };
  var jd = function (t) { var d = new Date((typeof t === "number" ? t : Date.parse(t)) + J); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); };
  var jt = function (t) { var d = new Date((typeof t === "number" ? t : Date.parse(t)) + J); return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); };
  var where = function (t) { return /関空|空港|airport|kix/i.test(t || "") ? "✈️" : /駅|station/i.test(t || "") ? "🚉" : "📍"; };

  function post(body, form) {
    return fetch(API, form ? { method: "POST", body: body } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "通信できませんでした" }; });
  }
  var ERR = { SETUP_SOUND: "Supabase で SQL（migration_keepsake_sounds.sql）を実行してください", SOUND_TYPE: "mp3・m4a・aac・wav の音を選んでください", SOUND_SIZE: "15MB までの音を選んでください", SETUP: "Supabase で SQL（migration_keepsake.sql）を実行してください", DRAWN: "もうくじを引いたあとなので、贈りものは変えられません", HAS_ORDERS: "申し込みがあるので取り消せません", UNAUTHORIZED: "ログインが切れました。開き直してください", IMAGE: "画像を 2 枚えらんでください", FILE: "このファイルは使えません（画像・音声・動画・PDF）" };
  function fail(j) { msg = { e: true, t: ERR[j.error] || ("できませんでした: " + j.error) }; draw(); }
  function act(body, form) { if (busy) return Promise.resolve(false); busy = true; return post(body, form).then(function (j) { busy = false; if (!j.ok) { fail(j); return false; } msg = null; return load().then(function () { return j; }); }); }

  function load() {
    return fetch(API, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { msg = { e: true, t: ERR[j.error] || "読み込めませんでした" }; D = D || { guests: [], orders: [], examples: [], settings: {} }; }
      else D = j;
      draw(); passports();
    }).catch(function () { msg = { e: true, t: "通信できませんでした" }; D = D || { guests: [], orders: [], examples: [], settings: {} }; draw(); });
  }

  /* パスポートの写真 (5 分だけ見られるリンク。4 分たったら読み直す) */
  function passports() {
    (D.guests || []).forEach(function (g) {
      if (!g.dropId) return; var p = pass[g.dropId];
      if (p && (p.loading || Date.now() - p.at < 240000)) return;
      pass[g.dropId] = { loading: true, at: 0, photos: p ? p.photos : null };
      fetch("/api/kaku/passport?drop=" + encodeURIComponent(g.dropId), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        pass[g.dropId] = { loading: false, at: Date.now(), photos: j.ok ? j.photos : [], off: !j.ok };
        var el = $('[data-pp="' + g.id + '"]'); if (el) { el.innerHTML = ppHtml(g); wirePp(el); }
      }).catch(function () { pass[g.dropId] = { loading: false, at: 0, photos: [], off: true }; });
    });
  }
  function ppHtml(g) {
    if (!g.dropId) return '<div class="miss">🛂 パスポート<br>未登録</div>';
    var p = pass[g.dropId];
    if (!p || (p.loading && !p.photos)) return '<div class="miss ld">🛂 読み込み中…</div>';
    var ph = p.photos || [], miss = Math.max(0, (g.pax || 0) - ph.length);
    return ph.map(function (x, k) { return '<button data-pz="' + g.dropId + ":" + k + '"><img src="' + esc(x.url) + '" alt="" loading="lazy"><span>' + esc(x.name || "—") + "</span></button>"; }).join("") +
      (miss ? '<div class="miss">🛂 写真なし<br>' + miss + " 名</div>" : "") + (!ph.length && !miss ? '<div class="miss">🛂 写真なし</div>' : "");
  }
  function wirePp(el) { $$("[data-pz]", el).forEach(function (b) { b.onclick = function () { var a = b.dataset.pz.split(":"), x = pass[a[0]].photos[+a[1]]; zm.innerHTML = '<img src="' + esc(x.url) + '" alt=""><p>' + esc(x.name) + "<br>タップで閉じる</p>"; zm.classList.add("on"); }; }); }
  zm.onclick = function (e) { if (e.target.closest("[data-keep]")) return; zm.classList.remove("on"); zm.innerHTML = ""; };

  function stOf(g) {
    var i = g.invite; if (!i) return ["未招待", ""];
    var need = i.gifts.filter(function (k) { return k !== "card"; }), od = i.orders || [];
    var allDone = need.every(function (k) { return od.some(function (o) { return o.kind === k && o.status === "done"; }); }) && (i.gifts.indexOf("card") < 0 || i.cardGiven);
    if (i.status === "drawn" && allDone) return ["お渡し済み", "dn"];
    if (od.some(function (o) { return o.status !== "done"; })) return ["申し込みあり・作成待ち", "app"];
    if (i.status === "drawn") return ["くじを引いた", "opn"];
    return ["招待中（まだ引いていない）", "inv"];
  }
  function guestsHtml() {
    var G = D.guests || [], now = Date.now();
    var h = '<div class="sum"><div><b>' + G.length + "</b><small>滞在中の組</small></div><div class=\"w\"><b>" + G.filter(function (g) { return g.depMs - now < 24 * 3600e3; }).length + "</b><small>24 時間以内に出発</small></div><div class=\"a\"><b>" +
      G.filter(function (g) { return !g.names.length || g.names.length < g.pax; }).length + "</b><small>パスポート未登録あり</small></div><div><b>" + G.filter(function (g) { var s = stOf(g)[1]; return s && s !== "dn"; }).length + "</b><small>贈りもの進行中</small></div></div>";
    if (!G.length) return h + '<div class="empty">いま滞在中のゲストはいません。</div>';
    return h + G.map(function (g) {
      var left = g.depMs - now, soon = left < 14 * 3600e3, hh = left > 0 ? Math.floor(left / 3600e3) + ":" + pad(Math.floor(left % 3600e3 / 60e3)) : "0:00";
      var inv = g.invite, st = stOf(g), lock = inv && inv.status === "drawn", cur = sel[g.id] || (inv ? inv.gifts : []);
      var nights = Math.max(1, Math.round((Date.parse(g.checkOut) - Date.parse(g.checkIn)) / 86400e3));
      var d = g.dep, a = g.arr, miss = Math.max(0, g.pax - g.names.length);
      var arr = a.none ? "お迎えなし" : [a.place, a.at ? jd(a.at) + " " + jt(a.at) + " お迎え" : "", a.flightNo ? "便 " + a.flightNo + (a.status ? "（" + a.status + (a.delay ? " +" + a.delay + "分" : "") + "）" : "") : ""].filter(Boolean).join(" · ") || "到着の情報なし";
      var bag = d ? [d.L ? "大 " + d.L : "", d.S ? "小 " + d.S : "", d.sp ? "特殊 " + d.sp : ""].filter(Boolean).join(" · ") || "なし" : "";
      var changed = inv && !lock && cur.join() !== inv.gifts.join();
      return '<div class="g ' + (soon ? "soon " : "") + (inv ? "inv" : "") + '"><div class="h"><span class="rm">' + esc(g.room) + "</span><span><b>" + esc(g.name) + "</b><small>" + (LN[g.lang] || g.lang) + (g.pax ? " · " + g.pax + " 名" : "") + " · " + jd(g.checkIn) + " → " + jd(g.checkOut) + "（" + nights + " 泊）" + (g.today ? " · 本日到着" : "") + '</small></span><span class="cd"><small>' + (g.depSet ? "出発まで" : "チェックアウトまで") + "</small><b>" + hh + "</b></span></div>" +
        (d ? '<div class="dep"><i>' + where(d.dest) + "</i><span><b>" + (d.at ? (d.date ? jd(d.date + "T00:00:00+09:00") + " " : "") + d.at + " → " : "") + esc(d.dest || "行き先未定") + (d.terminal ? " T" + esc(d.terminal) : "") + "</b><span>" + (d.flightAt ? "便 " + d.flightAt + " 発 · " : "") + "👥 " + d.pax + " 名 · 🧳 " + bag + "</span></span></div>"
          : '<div class="dep no"><b>出発の希望はまだ登録されていません（チェックアウト ' + jd(g.checkOut) + " " + jt(g.checkOut) + "）</b></div>") +
        '<div class="pills"><span class="pl ' + (!g.names.length || miss ? "wn" : "ok") + '"><i>🛂</i>' + (g.names.length ? g.names.length + (g.pax ? " / " + g.pax : "") + " 名 登録" + (miss ? " · あと " + miss + " 名" : "") : "パスポート未登録") + '</span><span class="pl"><i>' + where(a.place) + "</i>" + esc(arr) + '</span><span class="pl ' + (g.alarm ? "ok" : "off") + '"><i>⏰</i>' + (g.alarm ? jd(g.alarm.at) + " " + jt(g.alarm.at) + " · " + esc(g.alarm.mode || "") : "光目覚ましなし") + "</span></div>" +
        '<div class="pp" data-pp="' + g.id + '">' + ppHtml(g) + "</div>" + (g.note ? '<div class="memo">📝 ' + esc(g.note) + "</div>" : "") +
        '<div class="gh">GIFT · 記念の贈りもの<span class="st ' + st[1] + '">' + st[0] + "</span></div>" +
        '<div class="chs">' + GF.map(function (f) { return '<button data-g="' + g.id + '" data-v="' + f[0] + '" class="' + (cur.indexOf(f[0]) >= 0 ? "on" : "") + '" ' + (lock ? "disabled" : "") + "><b>" + f[1] + "</b>" + f[2] + "</button>"; }).join("") + "</div>" +
        '<div class="act">' + (!inv ? '<button class="go" data-inv="' + g.id + '" ' + (cur.length ? "" : "disabled") + ">🎁 招待する</button>"
          : (changed ? '<button class="go" data-inv="' + g.id + '" ' + (cur.length ? "" : "disabled") + ">贈りものを変更する</button>" : "") +
            '<button data-open="' + inv.token + '">📱 くじ・記念ページを開く</button><button data-qr="' + inv.token + '">QR</button><button data-copy="' + inv.token + '">リンクをコピー</button>' +
            (inv.gifts.indexOf("card") >= 0 ? '<button data-card="' + g.id + '" data-on="' + (inv.cardGiven ? 1 : 0) + '" class="' + (inv.cardGiven ? "dim" : "") + '">' + (inv.cardGiven ? "🃏 手渡し済み（戻す）" : "🃏 カードを手渡した") + "</button>" : "") +
            (!(inv.orders || []).length ? '<button class="dim" data-cx="' + g.id + '">招待を取り消す</button>' : "")) + "</div></div>";
    }).join("");
  }
  function ordersHtml() {
    var O = D.orders || [];
    if (!O.length) return '<div class="empty">まだ申し込みはありません。ゲストが記念ページから申し込むと、ここに並びます。</div>';
    var W = { start: "旅の始まり", end: "旅の終わり" };
    return O.map(function (o) {
      var p = o.payload || {}, rows = [];
      if (o.kind === "art") rows = [["記念", W[p.when] || ""], ["入れる言葉", p.words || "（なし）"]];
      if (o.kind === "rec") rows = [["記念", W[p.when] || ""], ["スタイル", (p.styles || []).concat(p.style2 || []).join("・")], ["名前", p.names], ["思い出", p.memories || "（なし）"], ["歌詞", p.lyrics]];
      if (o.kind === "cheers") rows = [["お祝い", p.occasion], ["名前", p.name], ["メッセージ", p.message]];
      rows.push(["連絡先", p.contact || "（なし）"], ["言語", LN[p.lang] || p.lang || ""]);
      return '<div class="od ' + (o.status === "done" ? "dn" : "") + '"><div class="t"><b>' + KN[o.kind] + "</b><small>" + esc(o.room) + " · " + esc(o.name) + " · " + jd(o.createdAt) + " " + jt(o.createdAt) + ' 申し込み</small><span class="st ' + (o.status === "done" ? "dn" : "app") + '">' + (o.status === "done" ? "お渡し済み" : "作成待ち") + "</span></div>" +
        '<div class="bd">' + (o.photo ? '<img src="' + esc(o.photo) + '" alt="" data-ph="' + esc(o.photo) + '">' : "") + "<dl>" + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl></div>" +
        (o.photo ? '<div class="fl"><a href="' + esc(o.photo) + '" target="_blank" rel="noopener" download>⬇ ゲストの写真を保存</a></div>' : "") +
        '<div class="fl">' + (o.results || []).map(function (f) { return '<span><a href="' + esc(f.url || "#") + '" target="_blank" rel="noopener">📎 ' + esc(f.name) + '</a><button class="x" data-rmf="' + o.id + '" data-path="' + esc(f.path) + '">✕</button></span>'; }).join("") +
        '<label class="btn">＋ 完成品のファイルを追加<input type="file" data-up="' + o.id + '" hidden></label></div>' +
        '<div class="row"><input class="inp" data-link="' + o.id + '" placeholder="または完成品のリンク（https://…）" value="' + esc(o.link || "") + '">' +
        (o.status === "done" ? '<button class="btn" data-done="' + o.id + '" data-v="0">作成待ちに戻す</button>' : '<button class="btn go" data-done="' + o.id + '" data-v="1">✓ お渡し済みにする（ゲストのページに届く）</button>') + "</div></div>";
    }).join("");
  }
  /* ===== 招待くじの音 (BGM・効果音) ===== */
  var SL = [["bgm", "🎵", "待っている間の BGM", "封筒をタップしてから最後まで、くり返し流れます"], ["env", "✉️", "封筒を開ける", "封筒をタップしたとき"], ["drum", "🥁", "カプセルを揺らす", "約 1.3 秒。この間 BGM は止まります"],
    ["open", "💥", "カプセルが開く", "光る瞬間の「ドン」"], ["win", "🎺", "当選！", "ファンファーレ（約 2 秒）"], ["card", "✨", "贈りものが出る", "カードが回って止まるまで（約 3 秒）"], ["next", "➡️", "次へ・おわり", "「次の贈りもの」「受け取る」を押したとき"]];
  var MODES = [["synth", "標準の音"], ["file", "アップした音"], ["off", "鳴らさない"]];
  function sndInit() { if (!snd || !sndDirty) { snd = {}; var src = (D.settings || {}).sounds || {}; SL.forEach(function (r) { var x = src[r[0]] || {}; snd[r[0]] = { mode: x.mode || "synth", vol: x.vol == null ? 100 : x.vol, path: x.path || null, name: x.name || null, url: x.url || null }; }); } }
  function sndCfg() { var c = {}; SL.forEach(function (r) { var x = snd[r[0]]; c[r[0]] = { mode: x.mode, vol: x.vol, url: x.url }; }); return c; }
  function sndHtml() {
    sndInit();
    return '<div class="sec snd"><h2>くじの音（BGM・効果音）</h2><p>車内 iPad とゲストのスマホで、くじを開けるときに流れる音です。場面ごとに「標準の音」「アップした音」「鳴らさない」と音量を選べます。<br>アップできるのは mp3・m4a・wav（15MB まで）。<b>ご自身で用意した音や、使ってよい許可のある音だけ</b>をアップしてください（市販の曲・ゲームや映画の音は使えません）。</p>' +
      SL.map(function (r) {
        var k = r[0], x = snd[k];
        return '<div class="sr"><div class="sn"><i>' + r[1] + "</i><span><b>" + r[2] + "</b><small>" + r[3] + '</small></span></div><div class="sm">' +
          MODES.map(function (m) { return '<button data-sm="' + k + '" data-v="' + m[0] + '" class="' + (x.mode === m[0] ? "on" : "") + '" ' + (m[0] === "file" && !x.path ? "disabled" : "") + ">" + m[1] + "</button>"; }).join("") + "</div>" +
          '<div class="sf">' + (x.path ? '<span class="fn">🎧 ' + esc(x.name || "アップした音") + "</span>" : '<span class="fn no">まだアップしていません</span>') +
          '<label class="btn">' + (sndBusy === k ? "アップ中…" : x.path ? "変更" : "＋ 音をアップ") + '<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav" data-su="' + k + '" hidden></label>' +
          (x.path ? '<button class="btn dim" data-sx="' + k + '">外す</button>' : "") + "</div>" +
          '<div class="sv"><input type="range" min="0" max="150" step="5" value="' + x.vol + '" data-sv="' + k + '" ' + (x.mode === "off" ? "disabled" : "") + '><span data-svl="' + k + '">' + x.vol + "%</span>" +
          '<button class="btn" data-sp="' + k + '" ' + (x.mode === "off" ? "disabled" : "") + ">" + (k === "bgm" ? "▶ 10 秒試聴" : "▶ 試聴") + "</button></div></div>";
      }).join("") +
      '<div class="row"><button class="btn" id="sAll">▶ くじの流れで通して聞く</button><button class="btn" id="sStop">■ 止める</button><span class="sp"></span>' +
      (sndDirty ? '<button class="btn dim" id="sUndo">元に戻す</button>' : "") + '<button class="btn go" id="sSave" ' + (sndDirty ? "" : "disabled") + ">" + (sndDirty ? "保存する（次のくじから反映）" : "保存済み") + "</button></div></div>";
  }
  function sndWire() {
    if (!window.KSFX) return;
    var F = window.KSFX, use = function () { F.set(sndCfg()); F.ac(); };
    var dirty = function () { sndDirty = true; draw(); };
    $$("[data-sm]").forEach(function (b) { b.onclick = function () { snd[b.dataset.sm].mode = b.dataset.v; dirty(); }; });
    $$("[data-sv]").forEach(function (r) {
      r.oninput = function () { $('[data-svl="' + r.dataset.sv + '"]').textContent = r.value + "%"; snd[r.dataset.sv].vol = +r.value; F.set(sndCfg()); };
      r.onchange = function () { snd[r.dataset.sv].vol = +r.value; dirty(); };
    });
    $$("[data-sp]").forEach(function (b) { b.onclick = function () {
      var k = b.dataset.sp; use();
      if (k === "bgm") { F.bgm(true, .3); clearTimeout(sndWire.t); sndWire.t = setTimeout(function () { F.bgm(false, 1.5); }, 10000); } else F.play(k);
    }; });
    $$("[data-sx]").forEach(function (b) { b.onclick = function () { var x = snd[b.dataset.sx]; x.path = null; x.name = null; x.url = null; if (x.mode === "file") x.mode = "synth"; dirty(); }; });
    $$("[data-su]").forEach(function (inp) { inp.onchange = function () {
      var f = inp.files && inp.files[0], k = inp.dataset.su; if (!f) return;
      var type = f.type || ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav" })[(f.name.split(".").pop() || "").toLowerCase()] || "";
      if (!/^audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|wave)$/.test(type)) { fail({ error: "SOUND_TYPE" }); return; }
      if (f.size > 15 * 1024 * 1024) { fail({ error: "SOUND_SIZE" }); return; }
      sndBusy = k; draw();
      post({ op: "soundSign", slot: k, type: type, size: f.size }).then(function (j) {
        if (!j.ok) { sndBusy = ""; fail(j); return; }
        return fetch(j.url, { method: "PUT", headers: { "content-type": type, "x-upsert": "true" }, body: f }).then(function (r) {
          if (!r.ok) throw new Error("upload " + r.status);
          var x = snd[k]; x.path = j.path; x.name = f.name.slice(0, 80); x.url = URL.createObjectURL(f); x.mode = "file";
          sndBusy = ""; sndDirty = true; msg = { t: "アップしました。「保存する」を押すと、次のくじから流れます" }; draw();
        });
      }).catch(function (e) { sndBusy = ""; fail({ error: "アップロードできませんでした（" + e.message + "）" }); });
    }; });
    var all = $("#sAll"); if (all) all.onclick = function () {
      use(); F.bgm(true, .3); F.play("env");
      var T = [[2200, function () { F.level(0, .3); F.play("drum"); }], [3500, function () { F.play("open"); }], [3950, function () { F.play("win"); }],
        [4700, function () { F.play("card"); }], [6400, function () { F.bgm(true); }], [9500, function () { F.play("next"); }], [11500, function () { F.bgm(false, 2); }]];
      (sndWire.q || []).forEach(clearTimeout); sndWire.q = T.map(function (t) { return setTimeout(t[1], t[0]); });
    };
    var stop = $("#sStop"); if (stop) stop.onclick = function () { (sndWire.q || []).forEach(clearTimeout); clearTimeout(sndWire.t); F.stopAll(); };
    var undo = $("#sUndo"); if (undo) undo.onclick = function () { sndDirty = false; snd = null; draw(); };
    var sv = $("#sSave"); if (sv) sv.onclick = function () {
      var body = {}; SL.forEach(function (r) { var x = snd[r[0]]; body[r[0]] = { mode: x.mode, vol: x.vol, path: x.path, name: x.name }; });
      act({ op: "sounds", sounds: body }).then(function (ok) { if (ok) { sndDirty = false; snd = null; msg = { t: "音の設定を保存しました" }; draw(); } });
    };
  }
  function setupHtml() {
    var E = D.examples || [], s = D.settings || {};
    return sndHtml() + '<div class="sec"><h2>Crane Journey ART の見本（ビフォー・アフター）</h2><p>ゲストの申し込み画面に出る見本です。追加・説明の変更・並べ替え・削除ができます。</p>' +
      (E.map(function (e, k) { return '<div class="ex"><img src="' + esc(e.before || "") + '" alt=""><span>→</span><img src="' + esc(e.after || "") + '" alt=""><input class="inp" data-cap="' + e.id + '" value="' + esc(e.caption) + '" placeholder="説明"><button class="btn" data-mv="' + e.id + '" data-d="up" ' + (k ? "" : "disabled") + '>↑</button><button class="btn" data-mv="' + e.id + '" data-d="down" ' + (k < E.length - 1 ? "" : "disabled") + '>↓</button><button class="btn" data-rm="' + e.id + '">削除</button></div>'; }).join("") || '<div class="empty">見本はまだありません。</div>') +
      '<div class="ex new"><label>ビフォー（写真）<input type="file" id="nB"></label><label>アフター（イラスト）<input type="file" id="nA"></label><input class="inp" id="nC" placeholder="説明（例：家族旅行 · 水彩風）"><button class="btn go" id="nAdd">＋ 見本を追加</button></div></div>' +
      '<div class="sec"><h2>Cheers Around the World（有料）</h2><p>入にすると、招待したゲストの記念ページに有料の申し込みとして出ます。料金と提供元が決まるまでは切のままにしてください。</p>' +
      '<label class="lbl"><input type="checkbox" id="chOn" ' + (s.cheersOn ? "checked" : "") + '>ゲストのページに出す</label>' +
      '<div class="row"><input class="inp" id="chP" placeholder="料金の表示（例：¥5,000）" value="' + esc(s.cheersPrice || "") + '"></div>' +
      '<div class="row"><textarea class="inp" id="chN" rows="3" placeholder="パフォーマーへの支援の説明（ゲストに見せる文。事実が確認できた内容だけを書いてください）">' + esc(s.cheersNote || "") + '</textarea></div><div class="row"><button class="btn go" id="chSave">保存</button></div></div>';
  }

  function draw() {
    if (!D) { app.innerHTML = '<div class="empty">読み込み中…</div>'; return; }
    var nNew = (D.orders || []).filter(function (o) { return o.status !== "done"; }).length;
    app.innerHTML = '<div class="hd"><div><div class="ver">CRANE NEST · STAFF</div><h1>GUEST BOARD</h1></div><a href="/kaku/ops">K-OPS</a><button id="rl">↻ 更新</button></div>' +
      (D.setup ? '<div class="msg">' + ERR.SETUP + "（ゲストの一覧は見られます。招待・申し込みは SQL のあとから使えます）</div>" : "") + (msg ? '<div class="msg ' + (msg.e ? "e" : "") + '">' + esc(msg.t) + "</div>" : "") +
      '<div class="tabs"><button data-t="guests" class="' + (tab === "guests" ? "on" : "") + '">GUESTS</button><button data-t="orders" class="' + (tab === "orders" ? "on" : "") + '">申し込み' + (nNew ? "<b>" + nNew + "</b>" : "") + '</button><button data-t="setup" class="' + (tab === "setup" ? "on" : "") + '">見本・設定</button></div>' +
      '<div id="body">' + (tab === "guests" ? guestsHtml() : tab === "orders" ? ordersHtml() : setupHtml()) + "</div>";
    $("#rl").onclick = function () { load(); };
    $$("[data-t]").forEach(function (b) { b.onclick = function () { tab = b.dataset.t; msg = null; draw(); }; });
    var G = D.guests || [], byId = function (id) { return G.filter(function (g) { return g.id === id; })[0]; };
    $$("[data-pp]").forEach(wirePp);
    $$("[data-g]").forEach(function (b) { b.onclick = function () { var g = byId(b.dataset.g), c = (sel[g.id] || (g.invite ? g.invite.gifts : [])).slice(), v = b.dataset.v, i = c.indexOf(v); if (i < 0) c.push(v); else c.splice(i, 1); sel[g.id] = GF.map(function (f) { return f[0]; }).filter(function (k) { return c.indexOf(k) >= 0; }); draw(); }; });
    $$("[data-inv]").forEach(function (b) { b.onclick = function () { var g = byId(b.dataset.inv); act({ op: "invite", resId: g.id, gifts: sel[g.id] || [], name: g.name, room: g.room }).then(function (ok) { if (ok) delete sel[g.id]; draw(); }); }; });
    $$("[data-cx]").forEach(function (b) { b.onclick = function () { if (!confirm("招待を取り消しますか？")) return; delete sel[b.dataset.cx]; act({ op: "cancel", resId: b.dataset.cx }); }; });
    $$("[data-card]").forEach(function (b) { b.onclick = function () { act({ op: "card", resId: b.dataset.card, given: b.dataset.on !== "1" }); }; });
    var url = function (t) { return location.origin + "/k/" + t; };
    $$("[data-open]").forEach(function (b) { b.onclick = function () { window.open(url(b.dataset.open), "_blank"); }; });
    $$("[data-copy]").forEach(function (b) { b.onclick = function () { var u = url(b.dataset.copy), ok = function () { b.textContent = "✓ コピーしました"; }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok, function () { prompt("", u); }); else prompt("", u); }; });
    $$("[data-qr]").forEach(function (b) { b.onclick = function () { fetch(API + "?qr=" + encodeURIComponent(b.dataset.qr)).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) return; zm.innerHTML = '<div class="qrb"><img src="' + j.qr + '" alt="QR"></div><p>ゲストのスマホで読んでもらうと、くじ・記念ページが開きます（30 日間）<br>タップで閉じる</p>'; zm.classList.add("on"); }); }; });
    /* 申し込み */
    $$("[data-ph]").forEach(function (im) { im.onclick = function () { zm.innerHTML = '<img src="' + esc(im.dataset.ph) + '" alt=""><p>タップで閉じる</p>'; zm.classList.add("on"); }; });
    $$("[data-up]").forEach(function (inp) { inp.onchange = function () { var f = inp.files && inp.files[0]; if (f) upload(inp.dataset.up, f); }; });
    $$("[data-rmf]").forEach(function (b) { b.onclick = function () { if (confirm("このファイルを外しますか？")) act({ op: "orderRemoveFile", id: b.dataset.rmf, path: b.dataset.path }); }; });
    $$("[data-done]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.done, o = (D.orders || []).filter(function (x) { return x.id === id; })[0], link = ($('[data-link="' + id + '"]').value || "").trim(), done = b.dataset.v === "1";
      if (done && !link && !(o.results || []).length) { msg = { e: true, t: "完成品のファイルかリンクを入れてから、お渡し済みにしてください" }; draw(); return; }
      if (link && !/^https:\/\//.test(link)) { msg = { e: true, t: "リンクは https:// で始まるものを入れてください" }; draw(); return; }
      act({ op: "orderDone", id: id, done: done, link: link });
    }; });
    /* 見本・設定 */
    $$("[data-cap]").forEach(function (i) { i.onchange = function () { post({ op: "exCaption", id: i.dataset.cap, caption: i.value }); }; });
    $$("[data-mv]").forEach(function (b) { b.onclick = function () { act({ op: "exMove", id: b.dataset.mv, dir: b.dataset.d }); }; });
    $$("[data-rm]").forEach(function (b) { b.onclick = function () { if (confirm("この見本を削除しますか？")) act({ op: "exDelete", id: b.dataset.rm }); }; });
    var add = $("#nAdd"); if (add) add.onclick = function () {
      var fb = $("#nB").files[0], fa = $("#nA").files[0]; if (!fb || !fa) { msg = { e: true, t: "ビフォーとアフターの両方の画像を選んでください" }; draw(); return; }
      var cap = $("#nC").value; add.disabled = true; add.textContent = "アップロード中…";
      shrink(fb, function (b1) { shrink(fa, function (b2) {
        if (!b1 || !b2) { msg = { e: true, t: "画像を読めませんでした" }; draw(); return; }
        var fd = new FormData(); fd.append("op", "exAdd"); fd.append("before", b1, "b.jpg"); fd.append("after", b2, "a.jpg"); fd.append("caption", cap); act(fd, true);
      }); });
    };
    if (tab === "setup") sndWire();
    var sv = $("#chSave"); if (sv) sv.onclick = function () { act({ op: "settings", cheersOn: $("#chOn").checked, cheersPrice: $("#chP").value, cheersNote: $("#chN").value }).then(function (ok) { if (ok) { msg = { t: "保存しました" }; draw(); } }); };
  }
  function shrink(file, cb) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () { var k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { cb(b); }, "image/jpeg", .86); };
    im.onerror = function () { URL.revokeObjectURL(url); cb(null); }; im.src = url;
  }
  /* 完成品: 4MB まではサーバ経由、大きいものは署名つきリンクで直接アップロード */
  function upload(id, f) {
    msg = { t: "アップロード中… " + f.name }; draw();
    if (f.size <= 4000000) { var fd = new FormData(); fd.append("op", "orderFile"); fd.append("id", id); fd.append("file", f, f.name); return act(fd, true); }
    post({ op: "signUpload", id: id, name: f.name, type: f.type }).then(function (j) {
      if (!j.ok) return fail(j);
      fetch(j.url, { method: "PUT", headers: { "content-type": f.type || "application/octet-stream", "x-upsert": "true" }, body: f }).then(function (r) {
        if (!r.ok) throw new Error("upload " + r.status);
        return act({ op: "orderAddFile", id: id, path: j.path, name: f.name, type: f.type });
      }).catch(function (e) { fail({ error: "アップロードできませんでした（" + e.message + "）。リンクで渡すこともできます" }); });
    });
  }
  load(); setInterval(function () { if (tab === "guests" && !busy && !zm.classList.contains("on") && document.visibilityState === "visible") load(); }, 60000);
})();
