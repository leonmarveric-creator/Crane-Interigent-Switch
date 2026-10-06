/* 「すぐ知らせる」合図 (Supabase Realtime の broadcast)。
   相手に「変わったよ」とだけ伝え、受け取った側はすぐサーバーへ聞きに行く。これで、ふだんの問い合わせの間隔を空けても反応が遅れない。
   つながらない・設定が無いときは何もしない (今までどおり一定の間隔で聞きに行く)。 */
(function(){
 if(window.CNRT)return;
 var cfg,ws=null,ref=0,hb=0,chs={},msg={},retry=0,want=false,rT=0,opening=false;
 function send(o){try{if(ws&&ws.readyState===1){ws.send(JSON.stringify(o));return true}}catch(e){}return false}
 function joinMsg(c){send({topic:"realtime:"+c,event:"phx_join",payload:{config:{broadcast:{self:false,ack:false},presence:{key:""}}},ref:String(++ref)})}
 function later(){if(!want||rT)return;retry=Math.min(60000,(retry||2500)*2);rT=setTimeout(function(){rT=0;open()},retry)}
 function open(){
  if(ws||opening||!want||cfg===false)return;opening=true;
  var go=function(){opening=false;if(!cfg||!cfg.key||!cfg.url){cfg=false;return}
   var u=String(cfg.url).replace(/^http/,"ws").replace(/\/$/,"")+"/realtime/v1/websocket?apikey="+encodeURIComponent(cfg.key)+"&vsn=1.0.0",s;
   try{s=new WebSocket(u)}catch(e){return later()}
   ws=s;
   s.onopen=function(){retry=0;Object.keys(chs).forEach(joinMsg);clearInterval(hb);hb=setInterval(function(){send({topic:"phoenix",event:"heartbeat",payload:{},ref:String(++ref)})},25000)};
   s.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.event==="broadcast"&&m.payload){var c=String(m.topic).replace(/^realtime:/,""),ev=m.payload.event;
     if(ev==="kick")(chs[c]||[]).forEach(function(f){try{f()}catch(x){}});else(msg[c]||[]).forEach(function(f){try{f(ev,m.payload.payload)}catch(x){}})}}catch(x){}};
   s.onclose=function(){if(ws===s){clearInterval(hb);ws=null;later()}};
   s.onerror=function(){try{s.close()}catch(x){}}};
  if(cfg)return go();
  fetch("/api/rt",{cache:"no-store"}).then(function(r){return r.json()}).then(function(r){cfg=r&&r.ok?r:false;go()},function(){opening=false;later()});
 }
 document.addEventListener("visibilitychange",function(){if(!document.hidden&&want&&!ws)open()});
 window.CNRT={
  /* 合図を受け取る。g = 中身つきのメッセージを受け取る (名前, 中身) */join:function(c,f,g){want=true;if(!chs[c]){chs[c]=[];if(ws&&ws.readyState===1)joinMsg(c)}chs[c].push(f);if(g)(msg[c]=msg[c]||[]).push(g);open()},
  /* 中身つきのメッセージを送る (届いたかは分からない。送れなければ false) */send:function(c,ev,p){want=true;if(!chs[c]){chs[c]=[];if(ws&&ws.readyState===1)joinMsg(c)}var ok=send({topic:"realtime:"+c,event:"broadcast",payload:{type:"broadcast",event:ev,payload:p},ref:String(++ref)});if(!ok)open();return ok},
  /* 合図を送る */kick:function(c){want=true;if(!chs[c]){chs[c]=[];if(ws&&ws.readyState===1)joinMsg(c)}if(!send({topic:"realtime:"+c,event:"broadcast",payload:{type:"broadcast",event:"kick",payload:{}},ref:String(++ref)}))open()},
  /* つながっているか */on:function(){return!!(ws&&ws.readyState===1)}};
})();
