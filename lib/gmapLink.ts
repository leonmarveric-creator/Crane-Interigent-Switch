/** Google マップの URL (またはページの中身) から、場所の位置 (日本の範囲) と名前を読む。読めなければ null */
export function gmapParse(u: string): { ll: [number, number]; n: string | null } | null {
  let d = u; try { d = decodeURIComponent(u); } catch { /* そのまま */ }
  const ok = (la: number, lo: number) => la >= 20 && la <= 50 && lo >= 120 && lo <= 155;
  // 場所そのものの位置 (!3d..!4d..) を優先。なければ q= / ll= / 画面の中心 (@..)
  const m = d.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || d.match(/[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || d.match(/\/(?:place|search)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || d.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null; const la = Number(m[1]), lo = Number(m[2]); if (!ok(la, lo)) return null;
  const nm = d.match(/\/place\/([^/@]+)/); const n = nm && !/^-?\d+\.\d+,/.test(nm[1]) ? nm[1].replace(/\+/g, " ").trim().slice(0, 60) : null;
  return { ll: [la, lo], n };
}
