/** /kaku を開いたときの最初の画面: K-OPS (新しい画面) か CLASSIC (今までの画面) を選ぶ */
export default function KakuChooser() {
  return (
    <main className="kch">
      <style>{`
@font-face{font-family:KRaj;src:url(/kops/fonts/rajdhani-latin-600-normal.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:KMono;src:url(/kops/fonts/share-tech-mono-latin-400-normal.woff2) format("woff2");font-display:swap}
.kch{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px 16px;box-sizing:border-box;
 background:radial-gradient(ellipse at 50% 30%,#06231a,#020806 65%);color:#eafff6;font-family:KRaj,"Hiragino Sans","PingFang SC",sans-serif;overflow:auto}
.kch:before{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(60,242,166,.05) 0 1px,transparent 1px 4px)}
.kch h1{margin:0;font-size:30px;letter-spacing:.32em;font-weight:600;color:#3cf2a6;text-shadow:0 0 14px rgba(60,242,166,.55)}
.kch .sub{font-family:KMono,monospace;font-size:11px;letter-spacing:.3em;color:#86b9a5;margin-top:-10px}
.kch .row{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;width:100%;max-width:760px}
.kch a{flex:1 1 280px;max-width:360px;display:block;text-decoration:none;color:inherit;border:1px solid rgba(70,245,175,.62);background:rgba(4,17,13,.88);
 padding:22px 22px 20px;position:relative;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));transition:background .15s}
.kch a:active,.kch a:hover{background:rgba(20,70,50,.9)}
.kch a b{display:block;font-size:26px;letter-spacing:.2em;color:#3cf2a6}
.kch a.cl b{color:#eafff6}
.kch a small{display:block;font-family:KMono,monospace;font-size:10px;letter-spacing:.2em;color:#86b9a5;margin:2px 0 10px}
.kch a span{display:block;font-size:14px;line-height:1.6;color:#cfe9df}
.kch a i{position:absolute;right:18px;top:18px;font-style:normal;font-family:KMono,monospace;font-size:10px;border:1px solid #3cf2a6;color:#3cf2a6;padding:2px 6px;letter-spacing:.15em}
.kch .ft{font-family:KMono,monospace;font-size:10px;letter-spacing:.25em;color:#4f7f6d}
`}</style>
      <h1>AGENT KAKU</h1>
      <div className="sub">SELECT MISSION TERMINAL</div>
      <div className="row">
        <a href="/kaku/ops">
          <i>NEW</i>
          <b>K-OPS</b>
          <small>MISSION · HOLO · REMOTE LINK</small>
          <span>新しいミッション画面。スマホで iPad を操作・テーマ切り替え・オフライン保存</span>
        </a>
        <a href="/kaku?ui=classic" className="cl">
          <b>CLASSIC</b>
          <small>AGENT KAKU · ORIGINAL</small>
          <span>今までの AGENT KAKU の画面</span>
        </a>
      </div>
      <div className="ft">CRANE NEST · SECURE ACCESS</div>
    </main>
  );
}
