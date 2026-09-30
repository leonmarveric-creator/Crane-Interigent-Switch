/**
 * 車内 iPad: お見送りで駅へ向かうとき、右下の「近くのおすすめ」の枠を「電車の案内」にする (ゲストが電車に乗る参考)。
 *   次の電車 (あと何分・種別・行き先) + 時刻表上の「今ごろここ」の小さな路線図 + このあとの電車。
 *   ※ 時刻表から計算した予定。遅れは反映しない (画面にも書く)。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GLang } from "@/lib/cabinGeo";
import { OP_NAME, TRAIN_TYPES, jstNow, nextTrains, schedPos, stName, typeName, type TrainStation } from "@/lib/cabinTrains";

const TX: Record<GLang, Record<string, string>> = {
  ja: { h: "電車の案内", sched: "時刻表から · 参考", min: "分", now: "まもなく", dep: "発", to: "行", note: "位置は時刻表上の予定です", none: "本日の電車は終了しました", orig: "当駅始発" },
  zh: { h: "列车信息", sched: "按时刻表 · 仅供参考", min: "分钟", now: "即将发车", dep: "发车", to: "开往", note: "位置为时刻表推算", none: "今天的列车已结束", orig: "本站始发" },
  en: { h: "TRAINS", sched: "TIMETABLE · REFERENCE", min: "min", now: "Now", dep: "dep.", to: "for", note: "Positions are scheduled, not live", none: "No more trains today", orig: "Starts here" },
  ko: { h: "열차 안내", sched: "시각표 기준 · 참고", min: "분", now: "곧 출발", dep: "출발", to: "행", note: "위치는 시각표 기준 예상입니다", none: "오늘 열차는 종료되었습니다", orig: "당역 시발" },
};
const hm = (m: number) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`; };
const esc = (s: string) => s.replace(/[<&>"]/g, "");
const dest = (to: string, l: GLang) => (l === "zh" || l === "en" ? `${TX[l].to} ${stName(to, l)}` : `${stName(to, l)} ${TX[l].to}`);

export interface Trains { show(sts: TrainStation[]): void; hide(): void; on(): boolean }

export function createTrains(c: { box: HTMLElement; title: HTMLElement; lang: () => GLang; now?: () => number }): Trains {
  const host = document.createElement("div"); host.className = "trn"; c.box.appendChild(host);
  let sts: TrainStation[] = [], iv: any = null, oldTitle = "";
  const now = () => (c.now ? c.now() : Date.now());
  function draw() {
    const L = c.lang(), t = TX[L] ?? TX.en, J = jstNow(now()), list = nextTrains(sts, J.min, J.hol, 4);
    const names = [...new Set(sts.map((s) => stName(s.name, L)))].join(" · ");
    c.title.innerHTML = `<i class="trnDot"></i>${esc(t.h)} · ${esc(names)} <em>${esc(t.sched)}</em>`;
    if (!list.length) { host.innerHTML = `<div class="trnNone">${esc(t.none)}</div>`; return; }
    const f = list[0], ty = TRAIN_TYPES[f.type] ?? { c: "#7c8aa0" }, m = Math.max(0, Math.ceil(f.dep - J.min));
    const R = 34, C = 2 * Math.PI * R, u = Math.max(0, Math.min(1, (f.dep - J.min) / 30));
    // 小さな路線図 (次の電車の方面)。その方面の電車を「今ごろここ」に
    const d = f.dir, n = d.strip.length, X = (i: number) => 18 + i * ((404 - 36) / (n - 1)), Y = 26;
    let svg = `<line x1="8" y1="${Y}" x2="396" y2="${Y}" class="trnLn"/>`;
    d.strip.forEach((k, i) => { const me = i === d.here; svg += `<circle cx="${X(i)}" cy="${Y}" r="${me ? 6.5 : 4}" class="${me ? "trnMe" : "trnSt"}"/>${me ? `<circle cx="${X(i)}" cy="${Y}" r="11" class="trnPing"/>` : ""}<text x="${X(i)}" y="${Y + 22}" class="${me ? "trnNm me" : "trnNm"}">${esc(stName(k, L))}</text>`; });
    for (const tr of nextTrains(sts, J.min - 20, J.hol, 40).filter((x) => x.dir === d)) {
      const p = schedPos(d, tr.dep, tr.orig, J.min); if (p == null) continue;
      const x = X(Math.min(n - 1, p)), col = TRAIN_TYPES[tr.type]?.c ?? "#7c8aa0", past = p > d.here + 0.02;
      svg += `<g class="trnTr${past ? " past" : ""}" transform="translate(${x.toFixed(1)} ${Y})"><rect x="-11" y="-8" width="22" height="16" rx="5" fill="${col}"/><path d="M3 -4l5 4l-5 4z" fill="#fff"/>${tr === f || (tr.dep === f.dep && tr.type === f.type) ? `<rect x="-14" y="-11" width="28" height="22" rx="7" class="trnHi"/>` : ""}</g>`;
    }
    const rows = list.slice(1).map((x) => { const mm = Math.max(0, Math.ceil(x.dep - J.min)), col = TRAIN_TYPES[x.type]?.c ?? "#7c8aa0";
      return `<div class="trnR"><b>${hm(x.dep)}</b><i style="background:${col}">${esc(typeName(x.type, L))}</i><span>${esc(dest(x.to, L))}</span><em>${mm <= 0 ? esc(t.now) : `${mm}${esc(t.min)}`}</em></div>`; }).join("");
    host.innerHTML = `<div class="trnTop"><div class="trnRing"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" class="trnRb"/><circle cx="40" cy="40" r="${R}" class="trnRf${m <= 3 ? " hot" : ""}" stroke-dasharray="${(u * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/></svg><div>${m <= 0 ? `<small class="nw">${esc(t.now)}</small>` : `<b>${m}</b><small>${esc(t.min)}</small>`}</div></div>
      <div class="trnInf"><div class="trnTy"><i style="background:${ty.c}">${esc(typeName(f.type, L))}</i><span class="op ${f.st.op}">${esc(OP_NAME[f.st.op][L])}</span></div><div class="trnTo">${esc(dest(f.to, L))}</div><div class="trnAt">${hm(f.dep)} ${esc(t.dep)} · ${esc(f.dir.lab[L])}${f.orig ? ` · ${esc(t.orig)}` : ""}</div></div></div>
      <svg class="trnMap" viewBox="0 0 404 58">${svg}</svg>
      <div class="trnRs">${rows}</div><div class="trnNote">⏱ ${esc(t.note)}${sts.some((s) => s.sample) ? " · SAMPLE" : ""}</div>`;
  }
  return {
    show(s) {
      sts = s; if (!s.length) return this.hide();
      if (!c.box.classList.contains("trn-on")) oldTitle = c.title.innerHTML;
      c.box.classList.add("trn-on"); draw(); clearInterval(iv); iv = setInterval(draw, 1000);
    },
    hide() { if (!c.box.classList.contains("trn-on")) return; c.box.classList.remove("trn-on"); clearInterval(iv); iv = null; host.innerHTML = ""; if (oldTitle) c.title.innerHTML = oldTitle; },
    on: () => c.box.classList.contains("trn-on"),
  };
}
