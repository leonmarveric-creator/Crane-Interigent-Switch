/** 地球儀ウェルカム (public/cabin/air/welcome.html) が読む写真の版。/tmp/wc/wc_prod.py が作る (手で変えない) */
export const WELCOME_AV = "dcd99287";
export type WelcomeQ = "std" | "lite" | "ul";
/** 先に読んでおくもの (ページ本体と、その画質の地球の写真)。2 回目からはキャッシュで一瞬 */
export const welcomeAssets = (q: WelcomeQ): string[] => ["/cabin/air/welcome.html", ...["day", "night", "clouds", "topo", "water"].map((k) => `/cabin/air/tex/${k}-${q}.jpg?v=${WELCOME_AV}`)];
