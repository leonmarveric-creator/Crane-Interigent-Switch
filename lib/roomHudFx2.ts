/**
 * 自動 ON / 自動 OFF の演出 (洗練版 HUD)。ガラスのパネル・細い線・細い数字でまとめた、落ち着いたハイテク。
 *   上: 任務のカプセル (◇ 春 · 自動 OFF  3/5)        左上・右上: 細い線の丸いリング (建物のレーダー / 電力)
 *   奥: その部屋の 3D ホログラム                       中央: 結果パネル (LOAD 0.00 kW) + 経過時間
 *   左: 機器のパネル (丸いアイコン・名前・前 ▸ 後)     右: ASTRAEA の通信 (声の波形アナライザ + 字幕)
 *   下: 電力の弧 + エアコン / 灯りの状態の札
 *   全体はヘルメットの内側の曲面に貼ってあるように、少し傾けて奥行きを付ける。音はその場で作る (オリジナル)
 */
import type { FxLang } from "@/lib/roomPowerFx";
import { holoLite, loadHoloGeo, type HoloLite } from "@/lib/holoLite";
import { playbackSession } from "@/lib/iosAudio";

export interface RoomHudFx2 {
  kind: "on" | "off";
  holo: string;
  room: string;
  lang?: FxLang;
  parts?: string[];
  was?: Record<string, boolean>;
  acMode?: "cool" | "heat" | null;
  voice?: string | null;
  sound?: boolean;
  note?: string;
  frame?: (f: HTMLIFrameElement) => void;
  /** 軽量版 (お父さんのスマホ): 3D ホログラムの代わりに線画の部屋 (2D)。先読みなし・粒は少なめ・揺れなし・短め (約 4 秒) */
  lite?: boolean;
  /** 軽量版の写真の場所 (指定したときだけ写真の重ね合わせを使う。ふだんは動く線のホログラム) */
  liteSrc?: (k: string) => string;
  /** 軽量版の建物の形 (見本では埋め込み) */
  geoUrl?: string;
}

const HOLO_V = "67b35bafe7";
const EN: Record<string, string> = { haru: "HARU", natsu: "NATSU", aki: "AKI", fuyu: "FUYU" };
const RADAR: Record<string, [number, number]> = { haru: [-0.42, 0.28], natsu: [0.36, -0.42], aki: [0.38, 0.02], fuyu: [0.36, 0.4] };
const DEV: Record<string, { code: string; on: string; off: string; kw: number; ir: string }> = {
  ac: { code: "AIR", on: "ac_comfort", off: "ac_off", kw: 0.86, ir: "IR·AC" },
  ceil: { code: "CEIL", on: "light_on", off: "light_off", kw: 0.04, ir: "IR·LT" },
  wa: { code: "ANDON", on: "wafu_on", off: "wafu_off", kw: 0.01, ir: "BULB" },
  galaxy: { code: "GALAXY", on: "galaxy_on", off: "galaxy_off", kw: 0.02, ir: "IR·GX" },
  nest: { code: "NEST", on: "nest_on", off: "nest_off", kw: 0.02, ir: "PLUG" },
};
const ICON: Record<string, string> = {
  ac: `<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M6 15v1M10 15v3M14 15v3M18 15v1"/>`,
  ceil: `<path d="M4 7h16"/><path d="M8 7l1 5h6l1-5"/><path d="M12 15v1M8 16l-1 1M16 16l1 1"/>`,
  wa: `<rect x="8" y="5" width="8" height="12" rx="2"/><path d="M12 3v2M10 20h4M8 9h8M8 13h8"/>`,
  galaxy: `<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><circle cx="18" cy="17" r="1"/><circle cx="6" cy="18" r=".8"/>`,
  nest: `<circle cx="12" cy="12" r="6"/><path d="M6.5 10c3 1.5 8 1.5 11 0M6.5 14c3-1.5 8-1.5 11 0M12 6c-2 3-2 9 0 12"/>`,
};
const T: Record<FxLang, Record<string, any>> = {
  ja: { ac: "エアコン", ceil: "天井の照明", wa: "和の灯り", galaxy: "ギャラクシー", nest: "NEST の灯り", cool: "冷房", heat: "暖房", on: "ON", off: "OFF", lights: "灯り", objOn: "{r} · 自動ON", objOff: "{r} · 自動OFF", sayOn: "{r}の準備を始めます。{d}をオンにしました。", sayOff: "{r}の{d}をオフにしました。お部屋は安全です。", sayNone: "{r}はもともとすべてオフでした。", done: "完了", and: "・", was: "もともとOFF", result: "結果", elapsed: "所要時間", devices: "機器", short: { ac: "エアコン", ceil: "天井", wa: "和の灯り", galaxy: "ギャラクシー", nest: "NEST" } as any },
  zh: { ac: "空调", ceil: "顶灯", wa: "和风灯", galaxy: "星空投影", nest: "NEST 灯", cool: "制冷", heat: "制热", on: "开", off: "关", lights: "灯光", objOn: "{r} · 自动开启", objOff: "{r} · 自动关闭", sayOn: "开始准备{r}。已打开{d}。", sayOff: "已关闭{r}的{d}。房间已安全。", sayNone: "{r}原本已全部关闭。", done: "完成", and: "、", was: "原本已关", result: "结果", elapsed: "用时", devices: "设备", short: { ac: "空调", ceil: "顶灯", wa: "和风灯", galaxy: "星空投影", nest: "NEST" } as any },
  en: { ac: "Air conditioner", ceil: "Ceiling light", wa: "Andon light", galaxy: "Galaxy", nest: "Nest lamps", cool: "COOL", heat: "HEAT", on: "ON", off: "OFF", lights: "Lights", objOn: "{r} · AUTO ON", objOff: "{r} · AUTO OFF", sayOn: "Preparing {r}. {d} now on.", sayOff: "{d} in {r} switched off. Room secured.", sayNone: "Everything in {r} was already off.", done: "COMPLETE", and: ", ", was: "already off", result: "RESULT", elapsed: "ELAPSED", devices: "DEVICES", short: { ac: "air con", ceil: "ceiling", wa: "andon", galaxy: "galaxy", nest: "nest" } as any },
  ko: { ac: "에어컨", ceil: "천장 조명", wa: "와등", galaxy: "갤럭시", nest: "NEST 조명", cool: "냉방", heat: "난방", on: "ON", off: "OFF", lights: "조명", objOn: "{r} · 자동 ON", objOff: "{r} · 자동 OFF", sayOn: "{r} 준비를 시작합니다. {d}을(를) 켰어요.", sayOff: "{r}의 {d}을(를) 껐어요. 객실은 안전합니다.", sayNone: "{r}은(는) 원래 모두 꺼져 있었어요.", done: "완료", and: "·", was: "원래 꺼짐", result: "결과", elapsed: "소요 시간", devices: "기기", short: { ac: "에어컨", ceil: "천장", wa: "와등", galaxy: "갤럭시", nest: "NEST" } as any },
};

const CSS = `
.hz{position:fixed;inset:0;z-index:2147483601;pointer-events:none;overflow:hidden;color:rgba(236,250,255,.94);font-family:-apple-system,"Hiragino Sans","PingFang SC",sans-serif;
 --c:#6fe0ff;--c5:rgba(111,224,255,.5);--c3:rgba(111,224,255,.28);--c1:rgba(111,224,255,.1);--a:#ffad4a;--ok:#7dffc4;--d:"Rajdhani",ui-monospace,Menlo,monospace;--k:min(100vw,100vh);perspective:1100px;perspective-origin:50% 45%}
.hz.isoff{--c:#8fd9ff}
/* 背景 (ホログラムより奥): 空間の色・床のグリッド・投影の光の柱・浮かぶ光の粒 */
.hz-bg{position:fixed;inset:0;z-index:2147483598;pointer-events:none;opacity:0;transition:opacity .5s;background:radial-gradient(ellipse 80% 70% at 50% 42%,rgba(14,42,64,.9),rgba(3,10,18,.97) 70%);perspective:900px;overflow:hidden}
.hz-bg.in{opacity:1}
.hz-bg .floor{position:absolute;left:-50%;right:-50%;top:58%;height:90%;transform-origin:50% 0;transform:rotateX(78deg);background:repeating-linear-gradient(90deg,rgba(111,224,255,.16) 0 1px,transparent 1px 70px),repeating-linear-gradient(0deg,rgba(111,224,255,.16) 0 1px,transparent 1px 70px);-webkit-mask-image:radial-gradient(ellipse 45% 55% at 50% 0,#000,transparent 85%);mask-image:radial-gradient(ellipse 45% 55% at 50% 0,#000,transparent 85%);animation:hzFl 4s linear infinite}
@keyframes hzFl{to{background-position:0 70px,0 70px}}
.hz-bg .cone{position:absolute;left:50%;top:18%;width:min(70vw,640px);height:62%;transform:translateX(-50%);background:linear-gradient(0deg,rgba(111,224,255,.22),rgba(111,224,255,0) 80%);clip-path:polygon(38% 100%,62% 100%,100% 0,0 0);filter:blur(6px);opacity:.7}
.hz-bg canvas{position:absolute;inset:0;width:100%;height:100%}
.hz-bg .lk{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);font:600 11px "Rajdhani",ui-monospace,monospace;letter-spacing:.4em;color:rgba(111,224,255,.75);transition:opacity .3s}
.hz-bg .lk:after{content:"";display:block;margin:10px auto 0;width:120px;height:1px;background:linear-gradient(90deg,transparent,#6fe0ff,transparent);animation:hzLk 1s ease-in-out infinite alternate}
@keyframes hzLk{from{transform:scaleX(.2)}to{transform:scaleX(1)}}
/* 軽量版 (動く): 本物のホログラムの線と面を 2D の canvas で描いて回す (WebGL なし) */
.hz-cv{position:fixed;left:50%;top:44%;width:min(66vw,70vh,700px);aspect-ratio:6/5;transform:translate(-50%,-50%) scale(.94);z-index:2147483599;pointer-events:none;opacity:0;transition:opacity .6s,transform .9s cubic-bezier(.2,.8,.2,1);-webkit-mask-image:radial-gradient(ellipse 54% 54% at 50% 50%,#000 60%,transparent 100%);mask-image:radial-gradient(ellipse 54% 54% at 50% 50%,#000 60%,transparent 100%)}
@media (orientation:portrait){.hz-cv{top:35%;width:min(100vw,44vh)}}
@media (orientation:landscape) and (max-height:520px){.hz-cv{top:38%;width:min(40vw,56vh)}}
.hz-cv.on{opacity:1;transform:translate(-50%,-50%)}
.hz-cv canvas{width:100%;height:100%;display:block}
/* 軽量版: ホログラムを前もって撮った写真 (部屋ごと 7 枚・約 250KB)。機器の光は写真を重ねて (画面合成) 出す。3D は使わないので軽い */
.hz-img{position:fixed;left:50%;top:44%;width:min(66vw,70vh,700px);aspect-ratio:6/5;transform:translate(-50%,-50%) scale(.94);z-index:2147483599;pointer-events:none;opacity:0;transition:opacity .6s,transform .9s cubic-bezier(.2,.8,.2,1);perspective:700px;-webkit-mask-image:radial-gradient(ellipse 52% 52% at 50% 52%,#000 55%,transparent 100%);mask-image:radial-gradient(ellipse 52% 52% at 50% 52%,#000 55%,transparent 100%)}
@media (orientation:portrait){.hz-img{top:35%;width:min(100vw,44vh)}}
.hz-img.on{opacity:.95;transform:translate(-50%,-50%)}
.hz-img .w{position:absolute;inset:0;animation:hzFloat 6s ease-in-out infinite alternate;transform-origin:50% 60%}
@keyframes hzFloat{0%{transform:rotateY(-4deg) rotateX(2deg) translateY(3px)}100%{transform:rotateY(4deg) rotateX(-1deg) translateY(-4px)}}
.hz-img img{position:absolute;inset:0;width:100%;height:100%;display:block}
.hz-img .ly{opacity:0;transition:opacity .6s;mix-blend-mode:screen}.hz-img .fu{opacity:0;transition:opacity .8s}
.hz-img .ly.on,.hz-img .fu.on{opacity:1}
.hz-img .sc{position:absolute;left:0;right:0;height:30%;top:-30%;background:linear-gradient(180deg,transparent,rgba(140,225,255,.16),transparent);animation:hzSc 3.2s linear infinite;mix-blend-mode:screen}
@keyframes hzSc{to{top:100%}}
.hz-img .fk{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(140,225,255,.05) 0 1px,transparent 1px 3px);animation:hzFk 4s steps(1) infinite}
@keyframes hzFk{0%,93%,100%{opacity:1}94%{opacity:.4}96%{opacity:.9}97%{opacity:.5}}
.hz-img.glitch .w{animation:hzGl .5s steps(3) 1,hzFloat 6s ease-in-out .5s infinite alternate}
@keyframes hzGl{0%{transform:translateX(-6px) skewX(4deg);filter:hue-rotate(40deg) brightness(1.6)}50%{transform:translateX(5px) skewX(-3deg)}100%{transform:none;filter:none}}
@media (orientation:landscape) and (max-height:520px){.hz-img{top:38%;width:min(40vw,56vh)}}
/* 軽量版 (予備): 線画の部屋 (2D)。季節の部屋の写真が無いとき */
.hz-sch{position:fixed;left:50%;top:44%;width:min(62vw,64vh,560px);aspect-ratio:300/220;transform:translate(-50%,-50%) scale(.94);z-index:2147483599;pointer-events:none;opacity:0;transition:opacity .5s,transform .8s cubic-bezier(.2,.8,.2,1)}
@media (orientation:portrait){.hz-sch{top:36%;width:min(76vw,38vh)}}
.hz-sch.on{opacity:1;transform:translate(-50%,-50%)}
.hz-sch svg{width:100%;height:100%;overflow:visible}
.hz-sch .w{fill:rgba(111,224,255,.04);stroke:rgba(150,230,255,.55);stroke-width:.8}
.hz-sch .fl{fill:rgba(111,224,255,.07);stroke:rgba(150,230,255,.7);stroke-width:1}
.hz-sch .tl{stroke:rgba(150,230,255,.22);stroke-width:.6;fill:none}
.hz-sch .d{fill:none;stroke:rgba(150,230,255,.45);stroke-width:1.1;transition:stroke .35s,filter .35s}
.hz-sch .d .gl{opacity:0;transition:opacity .35s}
.hz-sch .d.on{stroke:#ffd9a0;filter:drop-shadow(0 0 4px rgba(255,190,110,.9))}.hz-sch .d.on .gl{opacity:1}
.hz-sch .d.ac.on{stroke:#a8f0ff;filter:drop-shadow(0 0 4px rgba(111,224,255,.95))}
.hz-sch .flow{stroke:#a8f0ff;stroke-width:.8;stroke-dasharray:3 5;fill:none;opacity:0;animation:hzFlow .8s linear infinite}
.hz-sch .d.ac.on .flow{opacity:.9}@keyframes hzFlow{to{stroke-dashoffset:-16}}
.hz-sch .sh{fill:none;stroke:rgba(255,173,74,.0);stroke-width:1.2;transition:stroke .5s}.hz-sch.secure .sh{stroke:rgba(255,173,74,.75);filter:drop-shadow(0 0 5px rgba(255,160,60,.8))}
.hz-sch .scan{fill:url(#hzScan);opacity:.6;animation:hzScanY 2.4s linear infinite}@keyframes hzScanY{from{transform:translateY(-40px)}to{transform:translateY(200px)}}
.hz.lite .rig{animation:none}.hz.lite .par{transform:none}

/* ホログラム (先に読み込んでおき、見えない所で待機。使うときだけ表に出す) */
.hz-holo{position:fixed;left:50%;top:44%;width:min(66vw,70vh,700px);aspect-ratio:6/5;transform:translate(-50%,-50%) scale(.92);border:0;z-index:2147483599;pointer-events:none;opacity:0;transition:opacity .9s,transform 1.2s cubic-bezier(.2,.8,.2,1);-webkit-mask-image:radial-gradient(ellipse 52% 52% at 50% 52%,#000 55%,transparent 100%);mask-image:radial-gradient(ellipse 52% 52% at 50% 52%,#000 55%,transparent 100%)}
@media (orientation:portrait){.hz-holo{top:35%;width:min(100vw,44vh)}}
.hz-holo.on{opacity:.92;transform:translate(-50%,-50%)}
.hz-holo.park{left:-200vw;top:0;opacity:0;transition:none}
.hz .grain{position:absolute;inset:0;opacity:.5;background:repeating-linear-gradient(0deg,rgba(140,220,255,.03) 0 1px,transparent 1px 3px),radial-gradient(ellipse 70% 60% at 50% 45%,transparent 60%,rgba(0,0,0,.55))}
.hz .hud{position:absolute;inset:0;transform-style:preserve-3d;opacity:0;transform:translateZ(90px);transition:opacity .45s,transform 1s cubic-bezier(.2,.8,.2,1)}
.hz.in .hud{opacity:1;transform:none}
.hz.out .hud{opacity:0;transform:translateZ(-140px);transition:opacity .55s,transform .7s cubic-bezier(.6,0,.9,.4)}
.hz .par{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateY(calc(var(--px,0) * 5deg)) rotateX(calc(var(--py,0) * -4deg));transition:transform .5s ease-out}
.hz .rig{position:absolute;inset:0;transform-style:preserve-3d;animation:hzSw 7s ease-in-out infinite alternate}
@keyframes hzSw{from{transform:rotateY(-3deg) rotateX(1deg)}to{transform:rotateY(3deg) rotateX(-.8deg)}}
/* パネル (ガラス) */
.hz .pn{position:absolute;background:linear-gradient(180deg,rgba(20,52,74,.82),rgba(7,20,31,.88));border:1px solid var(--c3);transform-style:preserve-3d;
 box-shadow:inset 0 1px 0 rgba(190,245,255,.18),inset 0 -1px 0 rgba(0,0,0,.4),5px 7px 0 -1px rgba(6,22,34,.95),5px 7px 0 0 rgba(111,224,255,.22),0 28px 50px rgba(0,0,0,.55);opacity:0;transition:opacity .5s,translate .7s cubic-bezier(.2,.8,.2,1);overflow:hidden}
.hz .pn .glint{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(200,245,255,.09) 45%,transparent 55%);background-size:300% 100%;animation:hzGlint 5s ease-in-out infinite}
@keyframes hzGlint{0%{background-position:120% 0}60%,100%{background-position:-60% 0}}
.hz.in .pn{opacity:1;translate:0 0 0}
.hz .pn:before,.hz .pn:after{content:"";position:absolute;width:9px;height:9px;border:1.5px solid var(--c)}
.hz .pn:before{left:-1px;top:-1px;border-right:0;border-bottom:0}.hz .pn:after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.hz .hdr{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;border-bottom:1px solid var(--c1);background:linear-gradient(90deg,var(--c1),transparent);font:600 10px var(--d);letter-spacing:.24em;color:var(--c);text-transform:uppercase}
.hz .hdr i{font-style:normal;color:rgba(236,250,255,.4);letter-spacing:.12em}
/* 任務のカプセル */
.hz .obj{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 4.5vh);translate:-50% -14px;opacity:0;display:flex;align-items:center;gap:12px;padding:8px 18px 8px 12px;border:1.5px solid var(--a);border-radius:3px;background:linear-gradient(180deg,rgba(26,20,12,.88),rgba(12,10,8,.9));box-shadow:0 0 24px rgba(255,160,60,.28);transition:opacity .4s .3s,translate .6s cubic-bezier(.2,.9,.3,1.1) .3s;rotate:x -12deg;white-space:nowrap}
.hz.in .obj{opacity:1;translate:-50% 0 40px}
.hz .obj i{width:15px;height:15px;border:1.5px solid var(--a);border-radius:50%;display:flex;align-items:center;justify-content:center}.hz .obj i:after{content:"";width:5px;height:5px;border-radius:50%;background:var(--a)}
.hz .obj b{font-size:clamp(13px,3.6vw,16px);font-weight:600;letter-spacing:.06em}.hz .obj em{font:600 14px var(--d);font-style:normal;letter-spacing:.08em;color:#ffd9a6}
.hz.done .obj{border-color:var(--ok);box-shadow:0 0 24px rgba(125,255,196,.3)}.hz.done .obj i{border-color:var(--ok)}.hz.done .obj i:after{background:var(--ok)}.hz.done .obj em{color:var(--ok)}
/* 細い線のリング */
.hz .rg{position:absolute;width:calc(var(--k) * .26);max-width:210px;aspect-ratio:1;opacity:0;transition:opacity .6s .2s}
.hz.in .rg{opacity:1}
.hz .rg svg{width:100%;height:100%;overflow:visible;display:block}
.hz .rg .l{fill:none;stroke:rgba(200,240,255,.75);stroke-width:.7}.hz .rg .l2{fill:none;stroke:var(--c);stroke-width:1.6;filter:drop-shadow(0 0 3px var(--c5))}
.hz .rg .tk{fill:none;stroke:rgba(200,240,255,.45);stroke-width:.5}
.hz .rg .sp{transform-origin:50% 50%;animation:hzR 18s linear infinite}.hz .rg .sp2{transform-origin:50% 50%;animation:hzR 9s linear infinite reverse}
@keyframes hzR{to{transform:rotate(360deg)}}
.hz .rg text{font:600 4.2px var(--d);letter-spacing:.9px;fill:rgba(200,240,255,.55)}
.hz .rg .sw{transform-origin:50px 50px;animation:hzR 3s linear infinite}
.hz .rg .v{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.hz .rg .v small{font:600 9px var(--d);letter-spacing:.28em;color:rgba(200,240,255,.6)}.hz .rg .v b{font:500 clamp(18px,5vw,28px) var(--d);letter-spacing:.04em}
.hz .r1{left:calc(env(safe-area-inset-left,0px) + 4vw);top:calc(env(safe-area-inset-top,0px) + 11vh);transform:rotateY(32deg) translateZ(-70px)}
.hz .r2{right:calc(env(safe-area-inset-right,0px) + 4vw);top:calc(env(safe-area-inset-top,0px) + 11vh);transform:rotateY(-32deg) translateZ(-70px)}
.hz .rg svg{filter:drop-shadow(0 0 1px rgba(111,224,255,.6)) drop-shadow(6px 9px 0 rgba(4,16,26,.9))}
/* ホログラム */
/* 結果パネル */
.hz .res{left:0;right:0;margin:0 auto;top:60%;width:min(44vw,300px);translate:0 14px 0;text-align:center;transform:rotateX(10deg) translateZ(90px)}
.hz.in .res{translate:0 0 0}
@media (orientation:portrait){.hz .res{top:49%;width:min(70vw,280px)}.hz .res .big{font-size:40px}}
.hz .res .big{padding:6px 12px 2px;font:500 clamp(34px,9vw,56px)/1 var(--d);letter-spacing:.04em;text-shadow:0 0 18px var(--c5)}
.hz .res .big small{font-size:.38em;letter-spacing:.18em;color:rgba(236,250,255,.6);margin-left:4px}
.hz .res .ft{display:flex;justify-content:space-between;padding:4px 10px 6px;font:600 10px var(--d);letter-spacing:.2em;color:rgba(236,250,255,.5)}.hz .res .ft b{color:rgba(236,250,255,.9);font-weight:600}
.hz .bar{height:2px;margin:4px 10px 0;background:rgba(255,255,255,.08);position:relative}.hz .bar s{position:absolute;inset:0 auto 0 0;background:var(--c);box-shadow:0 0 8px var(--c);transition:width .45s}
/* 左: 機器 */
.hz .dv{left:calc(env(safe-area-inset-left,0px) + 3vw);top:42%;width:min(26vw,280px);translate:-20px 0 0;transform:rotateY(26deg) translateZ(-20px);transform-origin:0 50%}
.hz .dv .it{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.05);transition:background .3s}
.hz .dv .ic{width:28px;height:28px;border-radius:50%;border:1px solid var(--c3);display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(111,224,255,.12),transparent 70%);transition:all .3s}
.hz .dv .ic svg{width:16px;height:16px;fill:none;stroke:rgba(236,250,255,.7);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.hz .dv b{font-size:12.5px;font-weight:600}.hz .dv b small{display:block;font:600 9px var(--d);letter-spacing:.2em;color:rgba(236,250,255,.4)}
.hz .dv em{font:600 11px var(--d);font-style:normal;letter-spacing:.14em;color:rgba(236,250,255,.45);white-space:nowrap}
.hz .dv .it.act{background:linear-gradient(90deg,var(--c1),transparent)}.hz .dv .it.act .ic{border-color:var(--c);box-shadow:0 0 12px var(--c5)}.hz .dv .it.act .ic svg{stroke:var(--c)}.hz .dv .it.act em{color:var(--c)}
.hz .dv .it.cut em{color:var(--a)}.hz .dv .it.cut .ic{border-color:rgba(255,173,74,.6)}.hz .dv .it.cut .ic svg{stroke:var(--a)}
.hz .dv .it.was{opacity:.4}
/* 右: ASTRAEA */
.hz .as{right:calc(env(safe-area-inset-right,0px) + 3vw);top:42%;width:min(28vw,300px);translate:20px 0 0;transform:rotateY(-26deg) translateZ(-20px);transform-origin:100% 50%}
.hz .as canvas{display:block;width:100%;height:64px}
.hz .as p{margin:0;padding:8px 12px 10px;font-size:12.5px;line-height:1.55;min-height:3.1em;border-top:1px solid var(--c1)}
.hz .as .lg{padding:0 12px 8px;font:500 9.5px/14px var(--d);letter-spacing:.08em;color:rgba(150,230,255,.55)}.hz .as .lg b{color:var(--ok);font-weight:600}
@media (orientation:portrait){.hz .dv{left:2.5vw;top:64%;width:47vw;transform:rotateY(14deg) translateZ(-10px)}.hz .as{right:2.5vw;top:64%;width:46vw;transform:rotateY(-14deg) translateZ(-10px)}.hz .as .lg{display:none}.hz .as canvas{height:44px}.hz .as p{font-size:11.5px}
 .hz .dv .it{padding:4px 7px;grid-template-columns:22px 1fr auto;gap:6px}.hz .dv .ic{width:22px;height:22px}.hz .dv .ic svg{width:13px;height:13px}.hz .dv b{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hz .dv b .ln{display:none}.hz .dv b .sh{display:inline!important}.hz .dv b small{display:none}.hz .dv em{font-size:9.5px;letter-spacing:.06em}
 .hz .tag{display:none}.hz .r1,.hz .r2{width:28vw}}
/* 下: 電力の弧と札 */
.hz .pw{position:absolute;left:0;right:0;margin:0 auto;bottom:calc(env(safe-area-inset-bottom,0px) + 2vh);width:min(30vw,200px);transform:rotateX(40deg) translateZ(30px)}
.hz .pw svg{width:100%;overflow:visible;display:block}.hz .pw b{position:absolute;left:0;right:0;bottom:4%;text-align:center;font:500 clamp(15px,4vw,20px) var(--d);letter-spacing:.06em}
.hz .pwA{fill:none;stroke:var(--c);stroke-width:4;stroke-linecap:round;filter:drop-shadow(0 0 4px var(--c5));transition:stroke-dashoffset .45s}
.hz .tag{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 4vh);padding:7px 16px;border:1px solid var(--c3);background:rgba(8,20,30,.8);font-size:clamp(12px,3.2vw,15px);font-weight:600;letter-spacing:.06em;opacity:0;transition:opacity .5s .5s}
.hz.in .tag{opacity:1}
.hz .tag em{margin-left:10px;font:600 12px var(--d);font-style:normal;letter-spacing:.2em;color:var(--c)}.hz .tag.cut em{color:var(--a)}
.hz .t1{left:calc(env(safe-area-inset-left,0px) + 6vw);rotate:y 22deg}.hz .t2{right:calc(env(safe-area-inset-right,0px) + 6vw);rotate:y -22deg}
@media (orientation:portrait){.hz .t1{left:3vw;bottom:calc(env(safe-area-inset-bottom,0px) + 13vh)}.hz .t2{right:3vw;bottom:calc(env(safe-area-inset-bottom,0px) + 13vh)}.hz .r1,.hz .r2{top:calc(env(safe-area-inset-top,0px) + 11vh);width:28vw}.hz .r1{left:7vw}.hz .r2{right:7vw}}
.hz .tg2{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center;font:600 11px var(--d);letter-spacing:.26em;color:var(--c);text-shadow:0 0 8px var(--c5)}
@media (orientation:portrait){.hz .tg2{top:36%}}
.hz .tg2 i{display:block;margin:6px auto 0;width:14px;height:14px;border:1.5px solid var(--a);border-radius:50%;box-shadow:0 0 8px rgba(255,160,60,.6)}
.hz .fl{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:20px;height:20px;margin:0;border-radius:50%;border:1px solid var(--c);opacity:0}
@media (orientation:portrait){.hz .fl{top:36%}}
.hz .fl.on{animation:hzFl .9s ease-out}@keyframes hzFl{0%{opacity:.8;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(16)}}
/* スマホの横向き (高さが低い画面): 小さく・詰めて並べる */
@media (orientation:landscape) and (max-height:520px){
 .hz .obj{top:calc(env(safe-area-inset-top,0px) + 8px);padding:5px 14px 5px 10px}.hz .obj b{font-size:13px}.hz .obj em{font-size:12px}
 .hz .rg{width:30vh}.hz .r1,.hz .r2{top:calc(env(safe-area-inset-top,0px) + 8px)}.hz .rg .v b{font-size:15px}
 .hz-sch{top:38%;width:min(34vw,50vh)}.hz-holo{top:40%;width:min(40vw,56vh)}
 .hz .res{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);width:min(30vw,240px)}.hz .res .big{font-size:28px;padding:2px 8px 0}.hz .res .hdr{padding:3px 8px}.hz .res .ft{padding:2px 8px 4px}
 .hz .dv{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);left:calc(env(safe-area-inset-left,0px) + 2vw);width:min(30vw,250px)}
 .hz .as{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);right:calc(env(safe-area-inset-right,0px) + 2vw);width:min(30vw,250px)}
 .hz .hdr{padding:3px 8px;font-size:9px}.hz .dv .it{padding:2px 8px;grid-template-columns:20px 1fr auto;gap:6px}.hz .dv .ic{width:18px;height:18px}.hz .dv .ic svg{width:11px;height:11px}
 .hz .dv b{font-size:10.5px}.hz .dv b small{display:none}.hz .dv em{font-size:9px;letter-spacing:.06em}
 .hz .as canvas{height:28px}.hz .as p{font-size:10.5px;padding:4px 8px 6px;min-height:0}.hz .as .lg{display:none}
 .hz .tag,.hz .pw{display:none}
}
`;

let AC: AudioContext | null = null;
/* iPhone: 消音 (マナーモード) でも鳴らす (playback)。音は指で押したときに準備した AudioContext でないと鳴らないので、
   「出発」を押したときに primeHudAudio() で準備しておく (GPS で自動に始まる演出は、指で押した流れの外のため) */
const ac = () => { try { if (!AC) { playbackSession(); AC = new (window.AudioContext || (window as any).webkitAudioContext)(); } if (AC.state !== "running") void AC.resume(); return AC; } catch { return null; } };
/** 指で押したときに呼ぶ (出発・音を出すボタン)。無音を 1 回鳴らして、あとから自動で鳴らせるようにする */
export function primeHudAudio() {
  try { playbackSession(); const a = ac(); if (!a) return; const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch { /* */ }
}
function tone(f0: number, f1: number, at: number, dur: number, v: number, type: OscillatorType = "sine") {
  const a = ac(); if (!a) return; const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(at: number, dur: number, v: number, f0: number, f1: number) {
  const a = ac(); if (!a) return; const t = a.currentTime + at, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = "bandpass"; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
}
/* 効果音は控えめに (洗練版) */
const S = {
  boot: () => { noise(0, 0.9, 0.04, 600, 4200); tone(140, 420, 0, 0.7, 0.05, "triangle"); [0.45, 0.55].forEach((x, i) => tone(2000 + i * 400, 2000 + i * 400, x, 0.03, 0.03, "sine")); },
  dev: (on: boolean, i: number) => { if (on) { tone(1200 + i * 90, 1800 + i * 120, 0, 0.18, 0.05, "sine"); tone(140, 110, 0, 0.12, 0.08); } else { tone(1500 - i * 110, 700 - i * 40, 0, 0.2, 0.05, "sine"); tone(110, 70, 0.02, 0.14, 0.09); } },
  done: (on: boolean) => { (on ? [523.25, 659.25, 783.99, 1046.5] : [783.99, 659.25, 523.25]).forEach((f, i) => tone(f, f, i * 0.08, 1.4, 0.035)); },
};

/* ホログラムは 1 つだけ先に読み込んで、画面の外で止めておく (使うたびに読むと、最初にカクッと止まるため) */
let HF: { f: HTMLIFrameElement; holo: string; ready: Promise<boolean> } | null = null;
export function warmRoomHud(holo: string, lang: string = "ja", frame?: (f: HTMLIFrameElement) => void): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  if (!document.getElementById("hz-css")) { const s = document.createElement("style"); s.id = "hz-css"; s.textContent = CSS; document.head.appendChild(s); }
  if (!document.getElementById("hz-font")) { const l = document.createElement("link"); l.id = "hz-font"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600&display=swap"; document.head.appendChild(l); }
  if (HF && HF.holo === holo) return HF.ready;
  HF?.f.remove();
  const f = document.createElement("iframe"); f.className = "hz-holo park"; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
  if (frame) frame(f); else f.src = `/holo/room.html?room=${encodeURIComponent(holo)}&lang=${lang}&v=${HOLO_V}`;
  document.body.appendChild(f);
  const ready = new Promise<boolean>((res) => {
    const t0 = Date.now(); const tick = () => { let ok = false; try { ok = !!(f.contentWindow as any)?.__ready; } catch { ok = true; }
      if (ok) { try { const d = f.contentDocument; if (d) { const s = d.createElement("style"); s.textContent = "#hud,#st,#sub{display:none!important}.fx{display:none}"; d.head.appendChild(s); } f.contentWindow?.postMessage({ holo: 1, pause: true }, "*"); } catch { /* */ } res(true); }
      else if (Date.now() - t0 > 12000) res(false); else setTimeout(tick, 120); };
    setTimeout(tick, 120);
  });
  HF = { f, holo, ready };
  return ready;
}

/** 線画の部屋 (ななめ上から見た和室。オリジナル) */
const SCH = `<svg viewBox="0 0 300 220"><defs><linearGradient id="hzScan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(111,224,255,0)"/><stop offset=".5" stop-color="rgba(111,224,255,.18)"/><stop offset="1" stop-color="rgba(111,224,255,0)"/></linearGradient>
 <radialGradient id="hzWarm"><stop offset="0" stop-color="rgba(255,210,140,.55)"/><stop offset="1" stop-color="rgba(255,210,140,0)"/></radialGradient></defs>
 <polygon class="w" points="30,140 150,80 150,4 30,64"/><polygon class="w" points="150,80 270,140 270,64 150,4"/>
 <polygon class="fl" points="150,200 270,140 150,80 30,140"/>
 <path class="tl" d="M90,170 L210,110 M120,185 L240,125 M60,155 L180,95 M90,110 L210,170 M120,95 L240,155"/>
 <path class="tl" d="M150,80 V4 M30,64 L150,4 L270,64"/>
 <g class="d ac" data-d="ac"><polygon points="58,78 122,46 122,60 58,92"/><path d="M64,86 L116,60 M64,90 L116,64"/><path class="flow" d="M70,96 Q90,120 110,104 M80,100 Q100,128 122,110"/></g>
 <g class="d ceil" data-d="ceil"><path d="M190,28 V46"/><ellipse cx="190" cy="52" rx="16" ry="6"/><polygon class="gl" points="174,54 206,54 236,150 150,150" fill="url(#hzWarm)" stroke="none"/></g>
 <g class="d wa" data-d="wa"><rect x="206" y="118" width="14" height="22" rx="2"/><path d="M206,126 H220 M206,133 H220 M213,114 V118"/><circle class="gl" cx="213" cy="129" r="20" fill="url(#hzWarm)" stroke="none"/></g>
 <g class="d nest" data-d="nest"><circle cx="86" cy="116" r="10"/><path d="M76,113 Q86,118 96,113 M76,119 Q86,114 96,119 M86,106 Q81,116 86,126"/><circle class="gl" cx="86" cy="116" r="22" fill="url(#hzWarm)" stroke="none"/></g>
 <g class="d galaxy" data-d="galaxy"><path d="M168,166 a10,6 0 0 1 20,0 z"/><path class="gl" d="M178,160 L160,40 M178,160 L200,30 M178,160 L230,70 M178,160 L130,60" stroke="rgba(190,160,255,.5)"/></g>
 <polygon class="sh" points="150,206 278,140 278,58 150,-4 22,58 22,140"/>
 <rect class="scan" x="20" y="0" width="260" height="40"/>
</svg>`;

const LITE_V = "1", LITE_K = ["base", "ac", "ceil", "wa", "nest", "galaxy", "away"];
const liteUrl = (h: string, k: string) => `/holo/lite/${h}-${k}.webp?v=${LITE_V}`;
/** 軽量版の写真を先に読んでおく (送迎を始めたときなど。部屋ごと約 250KB、2 回目からはキャッシュ) */
export function warmRoomHudLite(holo: string, src?: (k: string) => string): Promise<void> {
  return Promise.all(LITE_K.map((k) => { const i = new Image(); i.src = src ? src(k) : liteUrl(holo, k); return (i.decode ? i.decode() : Promise.resolve()).catch(() => {}); })).then(() => {});
}

function ensureCss() {
  if (!document.getElementById("hz-css")) { const s = document.createElement("style"); s.id = "hz-css"; s.textContent = CSS; document.head.appendChild(s); }
  if (!document.getElementById("hz-font")) { const l = document.createElement("link"); l.id = "hz-font"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600&display=swap"; document.head.appendChild(l); }
}
/** ほかのアプリへ切り替えた・画面が消えた: 残りの演出は待たずに終わらせる (裏で動かし続けない) */
const away = () => typeof document !== "undefined" && document.hidden;

let busy: Promise<void> = Promise.resolve();
export function roomHudFx2(o: RoomHudFx2): Promise<void> {
  busy = busy.then(() => run(o)).catch((e) => { console.error("roomHudFx2", e); });
  return busy;
}

function ring(id: string, label: string, inner: string): string {
  let tk = ""; for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, r1 = i % 6 ? 44.5 : 42.5; tk += `M${50 + Math.cos(a) * r1} ${50 + Math.sin(a) * r1}L${50 + Math.cos(a) * 46} ${50 + Math.sin(a) * 46}`; }
  return `<svg viewBox="0 0 100 100"><defs><path id="${id}" d="M50 50 m-39 0 a39 39 0 1 1 78 0 a39 39 0 1 1 -78 0"/></defs>
   <circle class="l" cx="50" cy="50" r="48"/><path class="tk" d="${tk}"/>
   <g class="sp"><text><textPath href="#${id}">${label} · ${label} · ${label} ·</textPath></text></g>
   <g class="sp2"><circle class="l2" cx="50" cy="50" r="34" stroke-dasharray="40 14 6 14"/></g><circle class="l" cx="50" cy="50" r="30" stroke-dasharray="1 3"/>${inner}</svg>`;
}

async function run(o: RoomHudFx2) {
  if (typeof document === "undefined") return;
  ensureCss();
  const on = o.kind === "on", lg = o.lang ?? "ja", X = T[lg] ?? T.ja, snd = o.sound !== false;
  const parts = (o.parts?.length ? o.parts : on ? ["ac", "ceil"] : ["ac", "ceil", "wa"]).filter((p) => DEV[p]);
  const act = (p: string) => on || !o.was || o.was[p] !== false;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, away() ? 0 : ms));
  const esc = (s: string) => s.replace(/[<&>"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" }[c]!));
  const mode = o.acMode === "heat" ? X.heat : X.cool;
  const moved = parts.filter(act), lights = parts.filter((p) => p !== "ac");
  const totalKw = moved.reduce((s, p) => s + DEV[p].kw, 0) || 0.9;
  const before = (p: string) => (p === "ac" ? mode : X.on);
  const objTxt = (on ? X.objOn : X.objOff).replace("{r}", o.room);
  const C = Math.PI * 40;
  const [rx, ry] = RADAR[o.holo] ?? [0, 0];

  // ① 背景 (すぐ出る・軽い)  ② ホログラムの準備を待つ (先読み済みなら一瞬)  ③ HUD
  const bg = document.createElement("div"); bg.className = "hz-bg";
  bg.innerHTML = `<div class="floor"></div><div class="cone"></div><canvas></canvas><div class="lk">LINKING · ${esc(EN[o.holo] ?? "")}</div>`;
  document.body.appendChild(bg); requestAnimationFrame(() => bg.classList.add("in"));
  let alive = true;
  // 浮かぶ光の粒 (奥行きで大きさ・明るさが変わる。ゆっくり上へ)
  { const dc = bg.querySelector("canvas") as HTMLCanvasElement, dx = dc.getContext("2d")!, dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const D = Array.from({ length: o.lite ? 24 : 70 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
    let dl = 0;
    const dust = (ts: number) => { if (!alive) return; requestAnimationFrame(dust); if (o.lite && ts - dl < 32) return; dl = ts; // 軽量版は 30 コマ
      const W = innerWidth * dpr | 0, H = innerHeight * dpr | 0; if (dc.width !== W || dc.height !== H) { dc.width = W; dc.height = H; } dx.clearRect(0, 0, W, H);
      for (const q of D) { q.y -= 0.0006 + q.z * 0.0012; if (q.y < -0.05) { q.y = 1.05; q.x = Math.random(); } const r = (0.6 + q.z * 2.4) * dpr;
        dx.fillStyle = `rgba(150,230,255,${0.12 + q.z * 0.5})`; dx.beginPath(); dx.arc(q.x * W, q.y * H, r, 0, 7); dx.fill(); } };
    requestAnimationFrame(dust); }
  let okHolo = false, f: HTMLIFrameElement | null = null, sch: HTMLDivElement | null = null;
  let post = (_dev: string) => {}, liteStop = () => {};
  if (o.lite) {
    // 軽量版: 動く線のホログラム (WebGL は使わない)
    const geo = EN[o.holo] ? await Promise.race([loadHoloGeo(o.holo, o.geoUrl), wait(2000).then(() => null)]) : null;
    if (geo) {
      // 動く建物のホログラム (2D canvas)
      sch = document.createElement("div"); sch.className = "hz-cv"; sch.innerHTML = "<canvas></canvas>"; document.body.appendChild(sch);
      const hl: HoloLite = holoLite(sch.querySelector("canvas")!, geo); liteStop = () => hl.stop();
      if (!on) moved.forEach((p) => hl.set(p, true));
      post = (dev: string) => { const p = Object.keys(DEV).find((k) => DEV[k].on === dev || DEV[k].off === dev); if (p) hl.set(p, DEV[p].on === dev); if (dev === "away") hl.shield(true); };
    } else if (EN[o.holo] && o.liteSrc) {
      // 写真の重ね合わせ (ホログラムと同じ見た目)
      await Promise.race([warmRoomHudLite(o.holo, o.liteSrc), wait(1800)]);
      const u = (k: string) => (o.liteSrc ? o.liteSrc(k) : liteUrl(o.holo, k));
      sch = document.createElement("div"); sch.className = "hz-img";
      sch.innerHTML = `<div class="w"><img src="${u("base")}" alt="">${["ac", "ceil", "wa", "nest"].map((k) => `<img class="ly" data-d="${k}" src="${u(k)}" alt="">`).join("")}${["galaxy", "away"].map((k) => `<img class="fu" data-d="${k}" src="${u(k)}" alt="">`).join("")}<div class="sc"></div><div class="fk"></div></div>`;
      document.body.appendChild(sch);
      if (!on) moved.forEach((p) => sch!.querySelector(`[data-d="${p}"]`)?.classList.add("on"));
      post = (dev: string) => { const p = Object.keys(DEV).find((k) => DEV[k].on === dev || DEV[k].off === dev); if (p) sch!.querySelector(`[data-d="${p}"]`)?.classList.toggle("on", DEV[p].on === dev);
        if (dev === "away") { sch!.querySelectorAll(".ly,.fu").forEach((x) => x.classList.remove("on")); sch!.querySelector('[data-d="away"]')?.classList.add("on"); } };
      setTimeout(() => sch?.classList.add("glitch"), 60);
    } else {
      sch = document.createElement("div"); sch.className = "hz-sch"; sch.innerHTML = SCH; document.body.appendChild(sch);
      sch.querySelectorAll(".d").forEach((g) => { const d = (g as SVGElement).dataset.d!; if (!parts.includes(d)) (g as SVGElement).style.opacity = ".25"; else if (!on && act(d)) g.classList.add("on"); });
      post = (dev: string) => { const p = Object.keys(DEV).find((k) => DEV[k].on === dev || DEV[k].off === dev); if (p) sch!.querySelector(`.d[data-d="${p}"]`)?.classList.toggle("on", DEV[p].on === dev); if (dev === "away") sch!.classList.add("secure"); };
    }
    okHolo = true; (bg.querySelector(".lk") as HTMLElement).style.opacity = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => sch!.classList.add("on")));
  } else {
    okHolo = await Promise.race([warmRoomHud(o.holo, lg, o.frame), wait(4500).then(() => false)]);
    (bg.querySelector(".lk") as HTMLElement).style.opacity = "0";
    f = HF!.f; const fr = f;
    post = (dev: string) => { try { fr.contentWindow?.postMessage({ holo: 1, dev }, "*"); } catch { /* */ } };
    try { f.contentWindow?.postMessage({ holo: 1, pause: false }, "*"); } catch { /* */ }
    post("normal"); post("light_off"); post("wafu_off"); post("ac_off"); post("galaxy_off"); post("nest_off"); // まず「全部消えている」に揃える
    if (!on) moved.forEach((p) => post(DEV[p].on));
    if (okHolo) { f.classList.remove("park"); requestAnimationFrame(() => requestAnimationFrame(() => fr.classList.add("on"))); }
  }
  const Q = o.lite ? 0.6 : 1; // 軽量版は短め

  const el = document.createElement("div"); el.className = `hz${on ? "" : " isoff"}${o.lite ? " lite" : ""}`;
  el.innerHTML = `<div class="hud"><div class="par"><div class="rig">
   <div class="fl"></div>
   <div class="tg2"><span>${esc(o.room)} · ${esc(EN[o.holo] ?? "")}</span><i></i></div>
   <div class="obj"><i></i><b>${esc(objTxt)}</b><em id="hzN">0/${moved.length}</em></div>
   <div class="rg r1">${ring("hzP1", "CRANE NEST · BUILDING SCAN", `<g class="sw"><path d="M50 50 L50 18 A32 32 0 0 1 72 27 Z" fill="rgba(111,224,255,.14)"/></g>
      ${Object.entries(RADAR).map(([k, [x, y]]) => `<circle cx="${50 + x * 34}" cy="${50 + y * 34}" r="${k === o.holo ? 2.4 : 1.3}" fill="${k === o.holo ? "#ffad4a" : "rgba(200,240,255,.6)"}"/>`).join("")}
      <circle cx="${50 + rx * 34}" cy="${50 + ry * 34}" r="6" fill="none" stroke="#ffad4a" stroke-width=".6"/>`)}<div class="v" style="justify-content:flex-end;padding-bottom:16%"><small>${esc(EN[o.holo] ?? "")}</small></div></div>
   <div class="rg r2">${ring("hzP2", "POWER · LOAD MONITOR", `<circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="3"/><circle id="hzPr" cx="50" cy="50" r="24" fill="none" stroke="var(--c)" stroke-width="3" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="${2 * Math.PI * 24}" stroke-dashoffset="${on ? 2 * Math.PI * 24 : 0}" style="transition:stroke-dashoffset .45s"/>`)}<div class="v"><small>LOAD</small><b id="hzKwS">${on ? "0.00" : totalKw.toFixed(2)}</b><small>kW</small></div></div>
   <div class="pn res"><div class="hdr"><span>${esc(X.result)}</span><i>${on ? "POWER UP" : "POWER DOWN"}</i></div><div class="big"><span id="hzKw">${on ? "0.00" : totalKw.toFixed(2)}</span><small>kW</small></div>
     <div class="bar"><s id="hzBar" style="width:${on ? 0 : 100}%"></s></div><div class="ft"><span>${esc(X.elapsed)}</span><b id="hzT">0:00.00</b></div></div>
   <div class="pn dv"><div class="hdr"><span>${esc(X.devices)}</span><i>${parts.length} · ${esc(EN[o.holo] ?? "")}</i></div>
     ${parts.map((p) => `<div class="it${act(p) ? "" : " was"}" data-p="${p}"><span class="ic"><svg viewBox="0 0 24 24">${ICON[p]}</svg></span><b><span class="ln">${esc(X[p])}</span><span class="sh" style="display:none">${esc(X.short[p])}</span><small>${DEV[p].code}</small></b><em>${on ? X.off : act(p) ? before(p) : X.was}</em></div>`).join("")}</div>
   <div class="pn as"><div class="hdr"><span>ASTRAEA</span><i>VOICE · LIVE</i></div><canvas id="hzW" width="300" height="64"></canvas><p id="hzSay"></p><div class="lg" id="hzLog"></div></div>
   <div class="tag t1${on ? "" : act("ac") ? "" : " cut"}" id="hzAc">${esc(X.short.ac)}<em>${on ? X.off : act("ac") ? mode : X.off}</em></div>
   <div class="tag t2" id="hzLt">${esc(X.lights)}<em>${on ? X.off : lights.some(act) ? X.on : X.off}</em></div>
   <div class="pw"><svg viewBox="0 0 100 52"><path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="4" stroke-linecap="round"/><path id="hzPw" class="pwA" d="M10 50 A40 40 0 0 1 90 50" stroke-dasharray="${C}" stroke-dashoffset="${on ? C : 0}"/></svg><b id="hzPct">${on ? "0%" : "100%"}</b></div>
  </div></div></div><div class="grain"></div>`;
  el.querySelectorAll(".pn").forEach((p) => { const g = document.createElement("i"); g.className = "glint"; p.appendChild(g); });
  document.body.appendChild(el);
  const $ = <E extends Element>(s: string) => el.querySelector(s) as E;
  // 指・マウスの位置で少し傾ける (のぞき込むような立体感)
  const onMove = (e: PointerEvent) => { if (o.lite) return; el.style.setProperty("--px", String((e.clientX / innerWidth - 0.5) * 2)); el.style.setProperty("--py", String((e.clientY / innerHeight - 0.5) * 2)); };
  addEventListener("pointermove", onMove);
  requestAnimationFrame(() => el.classList.add("in"));
  if (snd) S.boot();
  const tStart = performance.now(); let talk = 0;
  const clock = () => { if (!alive || el.classList.contains("done")) return; const s = (performance.now() - tStart) / 1000; $<HTMLElement>("#hzT").textContent = `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`; requestAnimationFrame(clock); };
  requestAnimationFrame(clock);
  // 声の波形アナライザ (話している間は大きく揺れる)
  const cv = $<HTMLCanvasElement>("#hzW"), g = cv.getContext("2d")!;
  let wl = 0;
  const wave = (t: number) => {
    if (!alive) return; if (o.lite && t - wl < 32) { requestAnimationFrame(wave); return; } wl = t; g.clearRect(0, 0, 300, 64); const k = t / 1000;
    g.strokeStyle = "rgba(111,224,255,.12)"; g.lineWidth = 1; for (let y = 8; y < 64; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(300, y); g.stroke(); }
    for (let w = 0; w < 3; w++) { g.beginPath(); for (let x = 0; x <= 300; x += 3) { const amp = (2 + talk * 16) * (1 - Math.abs(x - 150) / 170) * (1 - w * 0.25); const y = 32 + Math.sin(x * (0.05 + w * 0.02) + k * (4 + w * 2)) * amp * Math.sin(x * 0.013 + k * 1.3 + w); x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = w ? `rgba(111,224,255,${0.35 - w * 0.08})` : "rgba(200,245,255,.9)"; g.lineWidth = w ? 1 : 1.6; g.stroke(); }
    requestAnimationFrame(wave);
  };
  requestAnimationFrame(wave);
  const say = async (txt: string) => { const p = $<HTMLElement>("#hzSay"); talk = 1; for (let i = 1; i <= txt.length; i++) { p.textContent = txt.slice(0, i); await wait((lg === "en" ? 22 : 45) * Q); } talk = 0.12; };
  const logEl = $<HTMLElement>("#hzLog");
  const log = (h: string) => { const d = document.createElement("div"); d.innerHTML = h; logEl.appendChild(d); while (logEl.children.length > 3) logEl.firstElementChild!.remove(); };

  log(`LINK · ${EN[o.holo] ?? ""} <b>${okHolo ? "OK" : "—"}</b>`);
  await wait(700 * Q);
  el.classList.add("lit"); log(`HOLO · ${parts.length} DEV <b>SYNC</b>`);
  const names = moved.map((p) => (p === "ac" ? `${X.short.ac}(${mode})` : X.short[p]));
  const line = (moved.length ? (on ? X.sayOn : X.sayOff) : X.sayNone).replace("{r}", o.room).replace("{d}", names.join(X.and));
  await wait(400 * Q);
  const sayP = say(line);
  let vEnd: Promise<void> = Promise.resolve();
  if (o.voice) { try { const v = new Audio(o.voice); v.volume = 0.9; vEnd = new Promise<void>((res) => { v.onended = () => res(); v.onerror = () => res(); setTimeout(res, 9000); void v.play().catch(() => res()); }); } catch { /* */ } }
  await wait(600 * Q);

  let kw = on ? 0 : totalKw, n = 0;
  const setKw = (k: number) => { const r = Math.min(1, k / totalKw); $<HTMLElement>("#hzKw").textContent = k.toFixed(2); $<HTMLElement>("#hzKwS").textContent = k.toFixed(2);
    $<HTMLElement>("#hzBar").style.width = `${r * 100}%`; $<SVGCircleElement>("#hzPr").style.strokeDashoffset = String(2 * Math.PI * 24 * (1 - r)); $<SVGPathElement>("#hzPw").style.strokeDashoffset = String(C * (1 - r)); $<HTMLElement>("#hzPct").textContent = `${Math.round(r * 100)}%`; };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], it = el.querySelector(`.it[data-p="${p}"]`) as HTMLElement, em = it.querySelector("em") as HTMLElement;
    if (!act(p)) { log(`${DEV[p].code} · SKIP`); await wait(120); continue; }
    post(on ? DEV[p].on : DEV[p].off); if (snd) S.dev(on, i);
    it.className = "it act"; const fl = $<HTMLElement>(".fl"); fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on");
    const after = on ? before(p) : X.off, from = on ? X.off : before(p); em.textContent = `${from} ▸ ${after}`;
    log(`${DEV[p].ir} ${(on ? DEV[p].on : DEV[p].off).toUpperCase()} <b>OK</b> ${140 + Math.floor(Math.random() * 180)}ms`);
    const k0 = kw, k1 = on ? kw + DEV[p].kw : Math.max(0, kw - DEV[p].kw), s0 = performance.now();
    await new Promise<void>((res) => { const st = () => { if (away()) { setKw(k1); res(); return; } const u = Math.min(1, (performance.now() - s0) / 420); setKw(k0 + (k1 - k0) * u); if (u < 1) requestAnimationFrame(st); else res(); }; st(); });
    kw = k1; n++; $<HTMLElement>("#hzN").textContent = `${n}/${moved.length}`;
    if (!on) it.className = "it cut";
    if (p === "ac") { const t = $<HTMLElement>("#hzAc"); t.classList.toggle("cut", !on); t.querySelector("em")!.textContent = after; }
    else { const rest = !on && lights.slice(lights.indexOf(p) + 1).some(act), t = $<HTMLElement>("#hzLt"); t.classList.toggle("cut", !on && !rest); t.querySelector("em")!.textContent = on || rest ? X.on : X.off; }
    await wait(380 * Q);
  }
  if (!on) { post("away"); log(`SHIELD · AWAY <b>ON</b>`); }
  await sayP;
  el.classList.add("done"); $<HTMLElement>(".obj b").textContent = `${objTxt} · ${X.done}`; $<HTMLElement>(".tg2 span").textContent = on ? "SYSTEMS ONLINE" : "ROOM SECURED";
  if (snd) S.done(on);
  await wait(2600 * Q); talk = 0;
  el.classList.add("out"); bg.classList.remove("in"); f?.classList.remove("on"); sch?.classList.remove("on"); await wait(900);
  alive = false; el.remove(); bg.remove(); removeEventListener("pointermove", onMove);
  liteStop(); sch?.remove();
  if (f) { f.classList.add("park"); try { f.contentWindow?.postMessage({ holo: 1, pause: true }, "*"); } catch { /* */ } }
  await vEnd;
}
