// @ts-nocheck
/** 地図の色付け (スマホの軽量モード)。CSS の filter と同じ計算を、地図の画像を読み込んだときに 1 回だけ行う → 見た目は同じで、走行中は毎回計算しない */
/* eslint-disable */
export const cssFx = ((): ((str: string) => (a: Uint8ClampedArray) => void) => {const cl=v=>v<0?0:v>1?1:v;
 const M={grayscale:a=>{const s=1-a;return[.2126+.7874*s,.7152-.7152*s,.0722-.0722*s,.2126-.2126*s,.7152+.2848*s,.0722-.0722*s,.2126-.2126*s,.7152-.7152*s,.0722+.9278*s]},
  sepia:a=>{const s=1-a;return[.393+.607*s,.769-.769*s,.189-.189*s,.349-.349*s,.686+.314*s,.168-.168*s,.272-.272*s,.534-.534*s,.131+.869*s]},
  saturate:s=>[.213+.787*s,.715-.715*s,.072-.072*s,.213-.213*s,.715+.285*s,.072-.072*s,.213-.213*s,.715-.715*s,.072+.928*s],
  "hue-rotate":d=>{const r=d*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[.213+c*.787-s*.213,.715-c*.715-s*.715,.072-c*.072+s*.928,.213-c*.213+s*.143,.715+c*.285+s*.140,.072-c*.072-s*.283,.213-c*.213-s*.787,.715-c*.715+s*.715,.072+c*.928+s*.072]}};
 const parse=str=>[...str.matchAll(/([a-z-]+)\(([-\d.]+)(deg)?\)/g)].map(m=>[m[1],+m[2]]);
 return (str)=>{const ops=parse(str);return (a)=>{for(let i=0;i<a.length;i+=4){let r=a[i]/255,g=a[i+1]/255,b=a[i+2]/255;
  for(const[f,v]of ops){if(f==="invert"){r=v*(1-r)+(1-v)*r;g=v*(1-g)+(1-v)*g;b=v*(1-b)+(1-v)*b}else if(f==="brightness"){r*=v;g*=v;b*=v}else if(f==="contrast"){r=(r-.5)*v+.5;g=(g-.5)*v+.5;b=(b-.5)*v+.5}
   else{const m=M[f](v),R=m[0]*r+m[1]*g+m[2]*b,G=m[3]*r+m[4]*g+m[5]*b,B=m[6]*r+m[7]*g+m[8]*b;r=R;g=G;b=B}r=cl(r);g=cl(g);b=cl(b)}
  a[i]=r*255;a[i+1]=g*255;a[i+2]=b*255}}}})();

/** app/cabin/cabin.css と同じ値 */
export const TINT = {
  dark: "invert(1) grayscale(.35) hue-rotate(190deg) brightness(.7) contrast(1.9) saturate(2.2)",
  photo: "brightness(.82) saturate(1.15) contrast(1.08)",
  dh: "grayscale(1) brightness(.5) contrast(12) sepia(1) hue-rotate(172deg) saturate(2.6) brightness(.55)",
};
/** 画像を読み込んで色を付けた canvas を返す (失敗したら色なしの画像のまま) */
export function tintTile(url: string, f: string, done: (err: any, el: HTMLElement) => void): HTMLCanvasElement {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const g = cv.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D;
  const im = new Image(); if (!url.startsWith("blob:")) im.crossOrigin = "anonymous";
  im.onload = () => { try { g.drawImage(im, 0, 0, 256, 256); const d = g.getImageData(0, 0, 256, 256); cssFx(f)(d.data); g.putImageData(d, 0, 0); } catch { /* 色なし */ } if (url.startsWith("blob:")) URL.revokeObjectURL(url); done(null, cv); };
  im.onerror = (e) => done(e, cv); im.src = url; return cv;
}
