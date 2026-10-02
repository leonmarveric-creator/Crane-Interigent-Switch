/**
 * AGENT KAKU (Kaku さん専用のミッション画面) の中身。
 *   背景は /kaku/boot.webp・home.webp・hud.webp (1086×1448 の縦長)。その上に動く部品を重ねる。
 *   動かすのは kakuEngine.ts (React は触らない)。
 */
export const KAKU_HTML = `<div class="kroot" id="kroot"><div class="stage" id="stage">
 <!-- ① 起動 -->
 <div class="sc on" id="s1">
  <div class="lt" style="left:140px;top:530px;width:220px;height:60px"></div><div class="lt" style="left:730px;top:530px;width:220px;height:60px"></div>
  <div class="lt" style="left:90px;top:935px;width:290px;height:70px"></div><div class="lt" style="left:715px;top:935px;width:290px;height:70px"></div>
  <div class="bars" id="bm" style="left:150px;top:1064px;width:206px"></div><div class="bars" id="bs" style="left:728px;top:1064px;width:208px"></div>
  <div class="cv" style="left:765px;top:1088px;width:130px;height:22px"></div><div class="onl" id="onl">STANDBY</div>
  <div class="flash" id="flash"></div><div class="scan" id="scan"></div>
  <div class="pw" id="pw"></div>
 </div>
 <!-- ② ホーム -->
 <div class="sc" id="s2">
  <div class="cv" style="left:815px;top:24px;width:250px;height:48px"></div>
  <div class="ab" id="wxL" style="left:815px;top:26px;width:250px;text-align:right;font-size:26px;font-weight:700">泉佐野</div>
  <div class="cv" style="left:172px;top:702px;width:118px;height:66px"></div><div class="ab mono" id="mNo" style="left:160px;top:694px;width:140px;text-align:center;font-size:66px;font-weight:900">03</div>
  <div class="radar"></div>
  <svg class="ab" style="left:0;top:0" width="1086" height="1448" viewBox="0 0 1086 1448"><polyline id="hr" points="292,962 360,958 430,955 500,968 590,985 700,1015 760,1010 845,993" fill="none" stroke="none"/><circle id="hd" r="9" fill="#dfffee" style="filter:drop-shadow(0 0 10px #3dffa8) drop-shadow(0 0 20px #3dffa8)"/></svg>
  <div class="cv" style="left:128px;top:972px;width:150px;height:62px"></div><div class="rtl" style="left:128px;top:972px">CRANE NEST<small id="tA">--:--</small></div>
  <div class="cv" style="left:864px;top:966px;width:112px;height:60px"></div><div class="rtl" style="left:866px;top:964px"><span id="rB">関西空港 T1</span><small id="tB">--:--</small></div>
  <div class="st" id="start"></div>
  <button class="nv" data-nv="hist" style="left:230px;top:1290px;width:170px;height:110px"></button>
  <button class="nv" data-nv="free" style="left:690px;top:1290px;width:170px;height:110px"></button>
  <button class="nv" data-nv="set" style="left:900px;top:1290px;width:170px;height:110px"></button>

  <!-- ミッションの種類 -->
  <div class="ov" id="mc"><div class="ovb" style="top:430px">
   <div class="ovh">SELECT MISSION<button class="x" data-x="mc">✕</button></div>
   <div class="mcg"><button class="mcc" id="mcG"><b>🛬 ゲスト送迎</b><span>空港・駅へお迎え → Crane Nest</span></button>
   <button class="mcc fr" id="mcF"><b>🛰 フリーミッション</b><span>行き先を自由に決めて出発</span></button></div></div></div>
  <!-- フリーミッションの作成 -->
  <div class="ov" id="fm"><div class="ovb" style="top:60px;bottom:60px">
   <div class="ovh">FREE MISSION · 作成<button class="x" data-x="fm">✕</button></div>
   <div class="fmg">
    <label>ミッション名<input id="fName" placeholder="例: パスポート回収（空欄なら自動）"></label>
    <div class="lab2">行き先を追加（最大 3 か所・順番に回ります）</div>
    <div class="srch"><input id="fQ" placeholder="地名・住所で検索"><button id="fGo">検索</button></div>
    <div class="res" id="fRes"></div>
    <div class="lab2">★ お気に入り</div><div class="chips" id="fFav"></div>
    <div class="lab2">地図で選ぶ（タップした地点を追加）</div><div id="pmap"></div>
    <div class="lab2">経由地</div><ol class="wps" id="fWp"></ol>
    <div class="row2"><div><div class="lab2">タイプ</div><div class="chips" id="fType"></div></div>
     <label style="width:190px">目標到着時刻<input type="time" id="fDue"></label></div>
    <label class="chk"><input type="checkbox" id="fRtb" checked> 最後に Crane Nest へ帰還する</label>
   </div>
   <button class="go2" id="fMake">ミッション作成 ▸</button><div class="fmMsg" id="fMsg"></div>
  </div></div>

  <!-- お迎え先 -->
  <div class="ov" id="gp"><div class="ovb" style="top:60px;bottom:60px">
   <div class="ovh">GUEST PICKUP · お迎え先<button class="x" data-x="gp">✕</button></div>
   <div class="gpl" id="gpl"></div></div></div>
  <!-- ミッション記録 -->
  <div class="ov" id="hs"><div class="ovb" style="top:60px;bottom:60px">
   <div class="ovh">MISSION LOG · 記録<button class="x" data-x="hs">✕</button></div>
   <div class="hsum" id="hsum"></div><div class="hsl" id="hsl"></div></div></div>
  <!-- 設定 -->
  <div class="ov" id="st"><div class="ovb" style="top:60px;bottom:60px">
   <div class="ovh">SETTINGS · 設定<button class="x" data-x="st">✕</button></div>
   <div class="fmg">
    <div class="sg pl"><b>⚡ 起動・ホーム BGM</b><label class="fb">＋ 曲を追加<input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav" multiple id="upB" hidden></label><ol class="pll" id="pl_boot"></ol></div>
    <div class="sg pl"><b>🎵 ノーマル BGM (ミッション中)</b><label class="fb">＋ 曲を追加<input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav" multiple id="upN" hidden></label><ol class="pll" id="pl_normal"></ol></div>
    <div class="sg pl"><b>🌉 クルーズ BGM (橋・高速)</b><label class="fb">＋ 曲を追加<input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav" multiple id="upC" hidden></label><ol class="pll" id="pl_cruise"></ol></div>
    <div class="sg"><b>🔀 再生の順番</b><span>曲が終わると次の曲へ進みます</span><button class="tg" id="shTg">登録順</button></div>
    <div class="sgm" id="bgMsg"></div>
    <div class="sg"><b>⚠ 制限速度の目安</b><span>超えると画面が琥珀色になり、ASTRAEA が注意します</span><input type="number" id="limIn" min="30" max="120" step="10" value="80"> <em>km/h</em></div>
    <div class="sg"><b>🤫 静かモード</b><span>案内と警告だけ話します</span><button class="tg" id="qTg">OFF</button></div>
    <div class="sg"><b>😂 ユーモアモード</b><span>車内 iPad の ASTRAEA が、映画・アニメ・ゲームのネタも話します (お父さんのスマホと同じ設定)</span><button class="tg" id="hTg">OFF</button></div>
    <div class="sg"><b>🚗 デモ走行</b><span>GPS を使わず、ルートを自動で走ります (家で試すとき)</span><button class="tg" id="dTg">OFF</button></div>
    <div class="sg"><b>🔊 BGM</b><span>ミッション中の BGM</span><button class="tg on" id="bTg">ON</button></div>
    <div class="sgm" id="gpsSt">GPS: --</div>
   </div></div></div>
 </div>
 <!-- ③ ミッション -->
 <div class="sc" id="s3">
  <div class="lhd"><b>K A K U</b><small>MISSION SYSTEM</small><span class="lon"><i></i>ONLINE</span></div><div class="lact">ACTIVE MISSION</div><div class="ltm">MISSION TIME</div>
  <div class="cv" style="left:72px;top:140px;width:462px;height:92px"></div>
  <div class="ttl"><b id="mT">KIX T1 · お迎え</b><small id="mS">OPERATION 0929</small></div>
  <div class="badge wait" id="bdg">待機中</div>
  <div class="cv" style="left:808px;top:140px;width:210px;height:56px"></div><div class="tmr" id="tmr">00:00:00</div>
  <div class="cv" style="left:48px;top:244px;width:994px;height:54px;border-radius:4px"></div>
  <div class="steps" id="steps"></div>
  <div class="tmap sat" id="tmap"><div id="lmap"></div><div class="tgrid"></div><div class="tsweep"></div>
   <div class="tlab"><b>TACTICAL MAP</b><span>IZUMISANO · LIVE SAT</span></div>
   <div class="tbox" style="top:70px"><i>TARGET</i><div class="tgt" id="tgt">--<small>km</small></div><i id="tbL">KIX T1</i><div class="eta" id="eta"></div></div>
   <div class="tbox" style="top:auto;bottom:40px"><i>GPS</i><div class="tgt" style="font-size:30px">±<span id="acc">5</span><small>m</small></div></div>
   <div class="tco mono" id="tco">34.3830N 135.3226E</div><div class="tacq" id="tacq">ACQUIRING SATELLITE<span class="blink">_</span></div>
   <div class="qm" id="qm">🤫 QUIET</div><button class="tsw" id="tsw">SAT / LINE</button>
   <div class="nly" id="nly"><p class="now" id="ly1"></p><p class="now" id="ly2"></p><p class="nx" id="ly3"></p></div>
   <div class="np" id="np"><i id="npM">♪ NORMAL</i><b id="npT"></b><button id="npN">⏭</button></div>
   <div class="ask"><button id="aEta">⏳<small>あと何分</small></button><button id="aConv">🏪<small>コンビニ</small></button><button id="aSt">📊<small>今日の成績</small></button></div></div>
  <div class="mapx" id="mapx"><canvas id="stars" width="1040" height="470"></canvas><div class="cm" id="cmT">◆ CRUISE MODE ◆</div>
   <div class="bbar"><span>SKY GATE BRIDGE</span><div class="bb"><i id="bbF"></i><em id="bbM"></em></div><b id="bbT">0.0 / 3.8 km</b></div>
   <div class="cin" id="cin"><i class="sw"></i><div class="cinT" id="cinT"></div><div class="cinS" id="cinS">SKY GATE BRIDGE · OVER OSAKA BAY</div></div>
   <div class="mid" id="mid">▲ MIDPOINT · 1.9 KM</div><div class="tr" id="tr"><i class="trg"></i><i class="trb a"></i><i class="trb b"></i><i class="trb c"></i><i class="trb d"></i><i class="trr r1"></i><i class="trr r2"></i><i class="trr r3"></i><i class="trx"></i><i class="try"></i>
    <div class="trc"><div class="trk">◉ LOCK CONFIRMED</div><div class="trt" id="trT">TARGET REACHED</div><div class="trs" id="trS"></div><div class="trbar"><i id="trP"></i></div><div class="trph" id="trPh"></div></div></div></div>
  <div class="cv" style="left:36px;top:1068px;width:504px;height:80px"></div>

  <!-- 受信 (通信) -->
  <div class="wp" style="left:34px;top:812px;width:500px;height:230px" id="wpF">
   <div class="wh"><b>受信</b><span>INCOMING FEED</span><em id="chN">CH 1/4</em></div>
   <canvas id="wave" width="150" height="120" class="wv"></canvas>
   <div class="ch" id="chBox"><div class="chT" id="chT"></div><div id="chB"></div></div>
   <div class="wf"><i class="dot" id="lkD"></i><span id="lkT">LINK</span><span class="src" id="chS"></span></div>
  </div>
  <!-- 上空レーダー (スキャン) -->
  <div class="wp" style="left:554px;top:812px;width:500px;height:230px" id="radP">
   <div class="wh"><b>上空レーダー</b><span>SKY RADAR · KIX 40 KM</span><em id="radS">SCAN</em></div>
   <canvas id="rad" width="220" height="190" class="rd"></canvas>
   <div class="fl" id="fl"></div>
   <div class="wf"><span id="wind">WIND --</span></div><div class="rsrc" id="radSrc"></div>
   <div class="eq" id="eq"></div>
  </div>
  <!-- ドライブ記録 (DEVICE STATUS) -->
  <div class="wp dl" style="left:572px;top:1066px;width:482px;height:84px" id="wpD">
   <div class="dlh">DRIVE LOG</div>
   <div class="dlr"><div><b id="dlKm">0.0</b><small>TODAY KM</small></div><div><b id="dlTm">0:00</b><small>DRIVE TIME</small></div><div><b id="dlKp">--</b><small>LIMIT KEPT</small></div><div><b id="dlRk">--</b><small>RANK</small></div></div>
  </div>
  <div class="spd"><span class="l">SPEED</span><b id="spd">0</b><span class="u">km/h</span><span class="lim" id="limT">LIMIT 80</span><div class="gb"><i id="gb"></i></div></div>
  <div class="authT" id="authT">指紋で出発</div><div class="fp" id="fp"></div><div class="fpScan"></div>
  <div class="auth" id="auth"></div>
  <button class="abt" id="abt">■ 中止</button>
  <div class="ov" id="cf"><div class="ovb" style="top:520px"><div class="ovh">ABORT MISSION</div><div class="cfT">ミッションを中止しますか？（記録は残りません）</div><div class="cfB"><button id="cfN">続ける</button><button id="cfY" class="dg">中止する</button></div></div></div>
  <div class="fin" id="done"><h1>MISSION COMPLETE</h1><div class="stats"><div><b id="dKm">0.0</b><small>KM</small></div><div><b id="dT">00:00</b><small>TIME</small></div><div><b id="dG">A+</b><small>STYLE</small></div><div><b id="dK">100%</b><small>LIMIT KEPT</small></div></div><div class="finT">タップでホームへ</div></div>
 </div>
 <div class="sub hide" id="sub"><i class="o"></i><div><div class="n">ASTRAEA · AGENT CHANNEL</div><div class="j" id="sj"></div><div class="e" id="se"></div></div></div>
</div></div>`;
