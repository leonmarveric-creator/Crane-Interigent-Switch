/* JARVIS の車両ホログラム (K-OPS と HIROSHI DRIVE で共用)。通信は最初の点データ 1 回だけ。
   JVCAR.mount(canvas,{w,h,sc,speed:()=>km/h|null,lite:()=>bool}) → {stop()} */
(function(){let DATA=null;const load=src=>DATA||(DATA=fetch(src||"/kops/jvcar.bin?v=1").then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(b=>new Uint8Array(b)).catch(e=>{DATA=null;throw e}));
function mount(cv,opt){opt=opt||{};let dead=false,vis=true,io=null;const api={stop(){dead=true;if(io)io.disconnect()}};load(opt.src).then(raw=>{if(dead)return;run(cv,opt,raw,()=>dead,()=>vis)}).catch(()=>{});
 if(window.IntersectionObserver){io=new IntersectionObserver(e=>{vis=e[e.length-1].isIntersecting});io.observe(cv)}return api}
function run(cv,opt,raw,isDead,isVis){const g=cv.getContext("2d");const N=raw.length/7|0,P=new Float32Array(N*7);const RAF=f=>{if(isDead())return;if(document.hidden||!isVis()||!cv.offsetParent){setTimeout(()=>RAF(f),400);return}requestAnimationFrame(f)};
  for(let i=0;i<N;i++){const o=i*7,b=k=>raw[o+k];P[o]=b(0)/255*4.8-2.4;P[o+1]=b(1)/255*2.5-1.25;P[o+2]=b(2)/255*1.7-.7;P[o+3]=(b(3)-128)/127;P[o+4]=(b(4)-128)/127;P[o+5]=(b(5)-128)/127;P[o+6]=b(6)/255}
  cv.width=opt.w||560;cv.height=opt.h||430;const YAW0=-2.125,PIT=.05,DIST=10.6,CW=opt.w||560,CH=opt.h||430,SC=opt.sc||112,G=7,GW=(CW/G|0)+2,GH=(CH/G|0)+2,ZB=new Float32Array(GW*GH),SX=new Int16Array(N),SY=new Int16Array(N),SZ=new Float32Array(N),SA=new Float32Array(N);
  let yaw=0,drag=false,lx=0,idle=0;const QS=[["AUTO"],["HIGH",1,60,7,2],["STD",2,30,3,2],["LITE",4,20,0,1]];let qsel=0,q=1,last=0,fps=0,fc=0,ft=0,cost=0,cn=0,slow=0;const liteOn=()=>!!(opt.lite&&opt.lite());try{qsel=+(localStorage.getItem("jvq")||0)}catch(e){}if(qsel)q=qsel;else if(liteOn())q=3;
  cv.parentElement.addEventListener("pointerdown",e=>{const r=cv.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width*CW,my=(e.clientY-r.top)/r.height*CH;if(my>CH-44&&my<CH&&mx<330){const k=Math.floor((mx-70)/62);if(k>=0&&k<4){qsel=k;if(k)q=k;else{cn=0;cost=0;slow=0;q=liteOn()?3:1}try{localStorage.setItem("jvq",k)}catch(_){}}e.stopPropagation()}},true);cv.addEventListener("pointerdown",e=>{drag=true;lx=e.clientX;cv.setPointerCapture(e.pointerId)});cv.addEventListener("pointermove",e=>{if(!drag)return;yaw+=(e.clientX-lx)*.011;lx=e.clientX;idle=performance.now()});
  const up=()=>{drag=false;idle=performance.now()};cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  const img=g.createImageData(CW,CH),buf=img.data,cp=Math.cos(PIT),sp=Math.sin(PIT);
  function put(o,r,gg,b,v){if(v>buf[o+3]){buf[o]=r;buf[o+1]=gg;buf[o+2]=b;buf[o+3]=v}}
  function draw(now){const Q=QS[q],ST=Q[1];if(now-last<1000/Q[2]-3){RAF(draw);return}last=now;const t0=performance.now();fc++;if(now-ft>1000){fps=fc;fc=0;ft=now}const t=now/1000;if(!drag&&now-idle>2500)yaw+=.0035;const a=YAW0+yaw,c=Math.cos(a),s=Math.sin(a),scan=Math.sin(t*.9)*2.4;buf.fill(0);ZB.fill(1e9);
   for(let i=0;i<N;i+=ST){const o=i*7,X=P[o],Y=P[o+1],Z=P[o+2],xr=X*c-Y*s,yr=X*s+Y*c,y2=yr*cp-Z*sp,z2=yr*sp+Z*cp,k=DIST/(DIST+y2),px=(CW/2+xr*k*SC)|0,py=(CH*.56-z2*k*SC)|0;
    if(px<1||py<1||px>=CW-1||py>=CH-1){SX[i]=-1;continue}SX[i]=px;SY[i]=py;SZ[i]=y2;const gi=((py/G)|0)*GW+((px/G)|0);if(y2<ZB[gi])ZB[gi]=y2;
    const nd=P[o+3]*s+P[o+4]*c,fr=Math.max(0,1-Math.abs(nd)),w=P[o+6];SA[i]=w>0?w*(.5+.5*fr):.07+.93*fr*fr*fr*fr}
   for(let i=0;i<N;i+=ST){const px=SX[i];if(px<0)continue;const py=SY[i],y2=SZ[i],X=P[i*7];let al=SA[i];const hid=y2>ZB[((py/G)|0)*GW+((px/G)|0)]+.22;if(hid)al*=.09;
    const ft=P[i*7+6]>0,sc=!hid&&Math.abs(X-scan)<.04;let r=95,gg=227,b=255;if(ft&&al>.6){r=200;gg=245}if(sc){r=255;gg=179;b=71}
    const v=Math.min(255,(al*(sc?2.4:1.7)*255)|0);if(v<6)continue;const o=(py*CW+px)*4;put(o,r,gg,b,v);
    if((ft&&!hid)||sc||(ST>1&&!hid)){put(o+4,r,gg,b,v*.7);put(o+CW*4,r,gg,b,v*.7)}}
   g.putImageData(img,0,0);inner(c,s,t,Q);g.font="13px ui-monospace,Menlo,monospace";g.textAlign="left";g.fillStyle="rgba(95,227,255,.7)";g.fillText("画質",20,CH-20);QS.forEach((z,i)=>{const on=i===qsel;g.fillStyle=on?"rgba(255,179,71,1)":"rgba(95,227,255,.6)";g.fillText(z[0],74+i*62,CH-20)});g.fillStyle="rgba(255,255,255,.55)";g.textAlign="right";g.fillText((qsel===0?"→"+QS[q][0]+" ":"")+fps+"fps",CW-12,CH-20);cost+=performance.now()-t0;cn++;if(qsel===0&&cn%45===0){const m=cost/45;cost=0;if(cn===45)q=Math.max(liteOn()?3:1,m<7?1:m<14?2:3);else if(m>1000/QS[q][2]*.55&&q<3){if(++slow>=2){q++;slow=0}}else slow=0}RAF(draw)}
  const pj=(X,Y,Z,c,s)=>{Z-=.7;const xr=X*c-Y*s,yr=X*s+Y*c,y2=yr*cp-Z*sp,z2=yr*sp+Z*cp,k=DIST/(DIST+y2);return[CW/2+xr*k*SC,CH*.56-z2*k*SC]};
  const AM="255,179,71",GR="140,255,190",CY="95,227,255",OR="255,120,60",T2=6.283;
  const S={eng:[],mg:[],pcu:[],bat:[],hv:[],exh:[],drv:[],tank:[]};
  const seg=(k,a,b)=>S[k].push(a[0],a[1],a[2],b[0],b[1],b[2]);
  const box=(k,x0,x1,y0,y1,z0,z1)=>{const x=[x0,x1],y=[y0,y1],z=[z0,z1];for(let i=0;i<2;i++)for(let j=0;j<2;j++){seg(k,[x0,y[i],z[j]],[x1,y[i],z[j]]);seg(k,[x[i],y0,z[j]],[x[i],y1,z[j]]);seg(k,[x[i],y[j],z0],[x[i],y[j],z1])}};
  const ring=(k,ax,cx,cy,cz,r,n)=>{for(let i=0;i<n;i++){const a0=i/n*T2,a1=(i+1)/n*T2,p=a=>ax==="y"?[cx+Math.cos(a)*r,cy,cz+Math.sin(a)*r]:ax==="z"?[cx+Math.cos(a)*r,cy+Math.sin(a)*r,cz]:[cx,cy+Math.cos(a)*r,cz+Math.sin(a)*r];seg(k,p(a0),p(a1))}};
  const cylY=(k,cx,y0,y1,cz,r,n,m)=>{ring(k,"y",cx,y0,cz,r,n);ring(k,"y",cx,y1,cz,r,n);for(let i=0;i<m;i++){const a=i/m*T2;seg(k,[cx+Math.cos(a)*r,y0,cz+Math.sin(a)*r],[cx+Math.cos(a)*r,y1,cz+Math.sin(a)*r])}};
  const poly=(k,p)=>{for(let i=1;i<p.length;i++)seg(k,p[i-1],p[i])};
  // エンジン (横置き 4 気筒)
  const EX=1.58,CYL=[-.52,-.37,-.22,-.07];
  box("eng",1.4,1.76,-.62,.03,.34,.62);box("eng",1.43,1.73,-.6,.01,.62,.8);box("eng",1.47,1.69,-.58,-.01,.8,.86);
  box("eng",1.36,1.8,-.6,.01,.24,.34);CYL.forEach(y=>{ring("eng","z",EX,y,.62,.058,10);ring("eng","z",EX,y,.8,.058,10);poly("eng",[[1.73,y,.74],[1.84,y,.8],[1.9,y,.76],[1.9,-.3,.7]]);poly("exh",[[1.43,y,.7],[1.33,y,.62],[1.3,-.28,.5]])});
  ring("eng","y",EX,-.64,.42,.1,14);ring("eng","y",1.72,-.64,.7,.06,10);poly("eng",[[EX+.1,-.64,.42],[1.78,-.64,.7]]);poly("eng",[[EX-.1,-.64,.42],[1.66,-.64,.7]]);
  box("eng",1.86,1.95,-.5,-.1,.62,.78);
  // 排気
  poly("exh",[[1.3,-.28,.5],[1.15,-.2,.26],[.6,-.18,.22],[-.4,-.18,.22],[-1.0,-.3,.24],[-1.55,-.42,.26]]);cylY("exh",.2,-.27,-.09,.22,.07,10,4);ring("exh","x",-1.75,-.42,.28,.1,12);ring("exh","x",-2.0,-.42,.28,.1,12);for(let i=0;i<4;i++){const a=i/4*T2;seg("exh",[-1.75,-.42+Math.cos(a)*.1,.28+Math.sin(a)*.1],[-2.0,-.42+Math.cos(a)*.1,.28+Math.sin(a)*.1])}poly("exh",[[-1.55,-.42,.26],[-1.75,-.42,.28]]);poly("exh",[[-2.0,-.42,.28],[-2.14,-.42,.27]]);
  // トランスアクスル (MG1 / 動力分割 / MG2)
  const MX=1.56,MZ=.45;cylY("mg",MX,.08,.26,MZ,.17,18,6);cylY("mg",MX,.26,.34,MZ,.11,14,4);cylY("mg",MX,.34,.58,MZ,.2,18,6);ring("mg","y",MX,.3,MZ,.07,10);box("mg",1.36,1.5,.2,.46,.18,.3);
  // PCU
  box("pcu",1.3,1.68,.1,.56,.74,.9);for(let i=1;i<7;i++){const x=1.3+i*.054;seg("pcu",[x,.1,.9],[x,.56,.9]);seg("pcu",[x,.1,.9],[x,.1,.84])}box("pcu",1.36,1.5,.6,.68,.76,.86);
  [-.05,0,.05].forEach(d=>poly("hv",[[1.5+d,.34,.74],[1.5+d,.36,.62],[MX+d,.4,MZ+.2]]));
  // HV バッテリー
  const B=[-.84,-.34,-.44,.44,.3,.5];box("bat",B[0],B[1],B[2],B[3],B[4],B[5]);for(let i=1;i<14;i++){const y=B[2]+i*(B[3]-B[2])/14;seg("bat",[B[0],y,B[5]],[B[1],y,B[5]]);seg("bat",[B[1],y,B[5]],[B[1],y,B[4]])}seg("bat",[(B[0]+B[1])/2,B[2],B[5]],[(B[0]+B[1])/2,B[3],B[5]]);box("bat",-.78,-.4,.46,.6,.32,.48);ring("bat","z",-.59,.53,.48,.05,10);
  const CAB=[[1.46,.5,.74],[1.3,.6,.5],[1.05,.62,.22],[.2,.62,.2],[-.3,.6,.22],[-.5,.55,.3],[-.59,.5,.4]];poly("hv",CAB);poly("hv",CAB.map(p=>[p[0],p[1]+.035,p[2]]));
  // 燃料タンク
  box("tank",-.3,.18,-.4,.4,.24,.42);poly("tank",[[.18,-.3,.4],[.6,-.36,.26],[1.2,-.4,.3],[1.5,-.45,.62]]);poly("tank",[[-.3,.3,.42],[-.7,.82,.6],[-.9,.86,.78]]);
  // 駆動
  const WH=[[1.32,.8],[1.32,-.8],[-1.28,.8],[-1.28,-.8]],WZ=.34;poly("drv",[[1.32,-.8,WZ],[1.42,-.2,.36],[1.45,.2,.36],[1.32,.8,WZ]]);poly("drv",[[-1.28,-.8,WZ],[-1.28,.8,WZ]]);
  WH.forEach(w=>{ring("drv","y",w[0],w[1],WZ,.16,16);ring("drv","y",w[0],w[1]*.94,WZ,.16,16);box("drv",w[0]-.05,w[0]+.07,w[1]*.9,w[1],WZ+.1,WZ+.19);poly("drv",[[w[0],w[1]*.86,WZ+.05],[w[0],w[1]*.82,.78]]);for(let i=0;i<5;i++)ring("drv","z",w[0],w[1]*.82,.5+i*.055,.05,6)});
  const F={};for(const k in S)F[k]=new Float32Array(S[k]);
  const PATH={hv:CAB,eng:[[EX,-.25,.5],[EX,.0,MZ],[MX,.3,MZ]],whl:[[MX,.3,MZ],[1.45,.2,.36],[1.32,.8,WZ]],whr:[[MX,.3,MZ],[1.42,-.2,.36],[1.32,-.8,WZ]],mgp:[[MX,.4,MZ+.2],[1.5,.36,.62],[1.5,.34,.74]],fuel:[[.18,-.3,.4],[.6,-.36,.26],[1.2,-.4,.3],[1.5,-.45,.62]],ex:[[1.3,-.28,.5],[1.15,-.2,.26],[.6,-.18,.22],[-.4,-.18,.22],[-1.0,-.3,.24],[-1.55,-.42,.26],[-2.14,-.42,.27]]};
  const at=(P,u)=>{let T=0;const l=[];for(let i=1;i<P.length;i++){const d=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]);l.push(d);T+=d}let d=u*T;for(let i=0;i<l.length;i++){if(d<=l[i]){const a=P[i],b=P[i+1],f=d/l[i];return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]}d-=l[i]}return P[P.length-1]};
  const MODES=[{n:"EV DRIVE",j:"バッテリー → モーター → タイヤ",eng:0,f:[["hv",-1,GR],["mgp",-1,GR],["whl",1,CY],["whr",1,CY]],soc:-1},{n:"ENGINE + CHARGE",j:"エンジン → タイヤ ＋ 発電 → バッテリー",eng:1,f:[["fuel",1,AM],["eng",1,AM],["whl",1,CY],["whr",1,CY],["mgp",1,GR],["hv",1,GR],["ex",1,OR]],soc:1},{n:"FULL POWER",j:"エンジン ＋ モーター → タイヤ",eng:1,f:[["fuel",1,AM],["eng",1,AM],["hv",-1,GR],["mgp",-1,GR],["whl",1,CY],["whr",1,CY],["ex",1,OR]],soc:-1},{n:"REGEN BRAKE",j:"タイヤ → モーター → バッテリー",eng:0,f:[["whl",-1,CY],["whr",-1,CY],["mgp",1,GR],["hv",1,GR]],soc:1},{n:"STANDBY",j:"停車中",eng:0,f:[],soc:0}];
  let soc=.58,rpm=0,crank=0,rot=0,wrot=0,lt=0,sweep=0,mi=4,miAt=0,fade=1,vS=0,vP=null,vT=0,acc=0;
  function pick(t){if(!opt.speed)return Math.floor(t/6)%4;const v=opt.speed();if(v==null||!isFinite(v))return 4;if(vP!=null&&t-vT>.4){const a=(v-vP)/(t-vT);acc+=(a-acc)*.5;vP=v;vT=t}else if(vP==null){vP=v;vT=t}vS=v;if(v<3)return 4;if(acc>1.5)return v<35?0:2;if(acc<-1.5)return 3;return v<45?0:1}
  function inner(c,s,t,Q){const LITE=Q[4]===1;const dt=Math.min(.05,t-lt||.016);lt=t;{const n=pick(t);if(n!==mi&&(t-miAt>2.5||!opt.speed)){mi=n;miAt=t}}const M=MODES[mi];fade=Math.min(1,(t-miAt)*2);const mv=opt.speed?Math.min(1.6,vS/45):1;
   rpm+=((M.eng?1:0)-rpm)*dt*2.5;crank+=dt*rpm*22;const spd=opt.speed?mv:(mi===3?.5:1);rot+=dt*9*spd;wrot+=dt*5*spd;soc=Math.max(.3,Math.min(.8,soc+M.soc*dt*.02));
   const st=(k,col,al,w)=>{const A=F[k];g.strokeStyle="rgba("+col+","+al+")";g.lineWidth=w;g.beginPath();for(let i=0;i<A.length;i+=6){const p=pj(A[i],A[i+1],A[i+2],c,s),q=pj(A[i+3],A[i+4],A[i+5],c,s);g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1])}g.stroke()};
   const ln=(a,b)=>{const p=pj(a[0],a[1],a[2],c,s),q=pj(b[0],b[1],b[2],c,s);g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1])};
   g.lineCap="round";g.shadowBlur=Q[3]*Math.min(1,CW/800);
   g.shadowColor="rgba("+CY+",.8)";if(!LITE){st("drv",CY,.5,1.1);st("tank",AM,.28+.2*rpm,1)}
   g.shadowColor="rgba("+OR+",.9)";if(!LITE)st("exh",OR,.22+.5*rpm,1.2);
   g.shadowColor="rgba("+AM+",.9)";st("eng",AM,.42+.45*rpm,1.3);
   g.shadowColor="rgba("+CY+",.9)";st("mg",CY,.8,1.3);
   g.shadowColor="rgba("+GR+",.9)";st("pcu",GR,.75,1.2);st("bat",GR,.7,1.2);st("hv",OR,.8,1.5);
   // ピストン
   g.strokeStyle="rgba(255,235,190,"+(.45+.55*rpm)+")";g.lineWidth=2.2;g.beginPath();CYL.forEach((y,i)=>{const z=.71+.055*Math.cos(crank+(i===1||i===2?Math.PI:0));ln([EX-.05,y,z],[EX+.05,y,z]);ln([EX,y-.05,z],[EX,y+.05,z]);ln([EX,y,z],[EX,y,.46])});g.stroke();
   if(rpm>.3){g.fillStyle="rgba(255,240,200,.95)";const fi=Math.floor(crank/Math.PI)%4,y=CYL[[0,2,3,1][fi]],q=pj(EX,y,.83,c,s);g.beginPath();g.arc(q[0],q[1],3.4,0,T2);g.fill()}
   // 回転 (プーリー / モーター / タイヤ)
   g.strokeStyle="rgba("+AM+","+(.3+.6*rpm)+")";g.lineWidth=1.3;g.beginPath();for(let i=0;i<3;i++){const a=crank*.5+i*T2/3;ln([EX,-.64,.42],[EX+Math.cos(a)*.1,-.64,.42+Math.sin(a)*.1])}g.stroke();
   g.strokeStyle="rgba(210,245,255,.95)";g.lineWidth=1.5;g.beginPath();[[.17,.17,rot*(M.eng?1.4:.3)],[.46,.2,rot]].forEach(m=>{for(let i=0;i<6;i++){const a=m[2]+i*T2/6;ln([MX+Math.cos(a)*.05,m[0],MZ+Math.sin(a)*.05],[MX+Math.cos(a)*m[1]*.9,m[0],MZ+Math.sin(a)*m[1]*.9])}});for(let i=0;i<4;i++){const a=-rot*1.7+i*T2/4;ln([MX+Math.cos(a)*.07,.3,MZ+Math.sin(a)*.07],[MX+Math.cos(a)*.11,.3,MZ+Math.sin(a)*.11])}g.stroke();
   g.strokeStyle="rgba("+CY+",.75)";g.lineWidth=1.1;g.beginPath();WH.forEach(w=>{for(let i=0;i<5;i++){const a=-wrot+i*T2/5;ln([w[0],w[1],WZ],[w[0]+Math.cos(a)*.16,w[1],WZ+Math.sin(a)*.16])}});g.stroke();
   if(mi===3){g.fillStyle="rgba(255,90,60,"+(.5+.4*Math.sin(t*12))+")";WH.forEach(w=>{const q=pj(w[0]+.01,w[1]*.95,WZ+.145,c,s);g.beginPath();g.arc(q[0],q[1],3,0,T2);g.fill()})}
   // バッテリー残量 (セル)
   const nc=14,on=Math.round(soc*nc);for(let i=0;i<nc;i++){const y0=B[2]+i*(B[3]-B[2])/nc+.012,y1=y0+(B[3]-B[2])/nc-.024,a=pj(B[0]+.03,y0,B[5],c,s),b=pj(B[1]-.03,y0,B[5],c,s),d=pj(B[1]-.03,y1,B[5],c,s),e=pj(B[0]+.03,y1,B[5],c,s),lit=i<on,edge=i===on-1;g.fillStyle="rgba("+GR+","+(lit?(edge?.35+.3*Math.sin(t*6):.4):.05)+")";g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(d[0],d[1]);g.lineTo(e[0],e[1]);g.closePath();g.fill()}
   g.strokeStyle="rgba("+GR+",.8)";g.lineWidth=1;g.beginPath();for(let i=0;i<4;i++){const a=t*7+i*T2/4;ln([-.59,.53,.48],[-.59+Math.cos(a)*.05,.53+Math.sin(a)*.05,.48])}g.stroke();
   // エネルギーの流れ
   M.f.forEach(f=>{const P=PATH[f[0]],n=f[0]==="ex"||f[0]==="hv"?9:5;for(let i=0;i<n;i++){let u=(t*.6+i/n)%1;if(f[1]<0)u=1-u;for(let k=0;k<(LITE?1:4);k++){const uu=u-f[1]*k*.018;if(uu<0||uu>1)continue;const p=at(P,uu),q=pj(p[0],p[1],p[2],c,s);g.fillStyle="rgba("+f[2]+","+(fade*(1-k*.24))+")";g.shadowColor="rgba("+f[2]+",1)";g.beginPath();g.arc(q[0],q[1],3.4-k*.6,0,T2);g.fill()}}});
   // スキャン
   sweep=(t*.5)%2;if(sweep<1){const x=2.3-sweep*4.6;g.strokeStyle="rgba("+CY+",.5)";g.lineWidth=1;g.beginPath();ln([x,-1,.05],[x,1,.05]);ln([x,1,.05],[x,1,1.5]);ln([x,1,1.5],[x,-1,1.5]);ln([x,-1,1.5],[x,-1,.05]);g.stroke()}
   g.shadowBlur=0;
   // 表示
   g.textAlign="center";g.font="600 17px ui-monospace,Menlo,monospace";g.fillStyle="rgba(255,255,255,"+fade+")";g.fillText(M.n,CW/2,22);g.font="13px sans-serif";g.fillStyle="rgba("+CY+","+fade*.9+")";g.fillText(M.j,CW/2,40);
   g.font="13px ui-monospace,Menlo,monospace";g.textAlign="right";g.fillStyle="rgba("+GR+",.95)";g.fillText(opt.speed?"推定 · EST":"DEMO",CW/2-12,CH-44);g.textAlign="left";g.fillStyle="rgba("+AM+","+(.45+.5*rpm)+")";g.fillText("ENGINE "+(rpm>.15?"ON":"OFF"),CW/2+12,CH-44)}
  RAF(draw)}
window.JVCAR={mount,preload:load}})();
