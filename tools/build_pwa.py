from PIL import Image, ImageDraw
import json
def rep(s,old,new,n=1):
    assert s.count(old)==n,('COUNT',s.count(old),old[:80]); return s.replace(old,new)

# ============ ICONOS ============
def icon(sz):
    im=Image.new('RGB',(sz,sz),(17,20,24)); d=ImageDraw.Draw(im)
    # degradado suave
    for y in range(sz):
        t=y/sz; d.line([(0,y),(sz,y)],fill=(int(20+10*t),int(26+14*t),int(36+30*t)))
    pts=[(.16,.70),(.34,.52),(.48,.62),(.66,.34),(.84,.24)]
    P=[(x*sz,y*sz) for x,y in pts]
    w=max(3,int(sz*.055))
    d.line(P,fill=(76,195,138),width=w,joint='curve')
    for x,y in P[-1:]:
        r=sz*.045; d.ellipse([x-r,y-r,x+r,y+r],fill=(76,195,138))
    # base
    d.line([(sz*.14,sz*.80),(sz*.86,sz*.80)],fill=(70,80,95),width=max(2,int(sz*.012)))
    return im
icon(256).save('./favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])
for n,sz in [('icon-512.png',512),('icon-192.png',192),('apple-touch-icon.png',180)]:
    icon(sz).save('./'+n)

# ============ MANIFEST + SERVICE WORKER ============
json.dump({"name":"Mi Cartera","short_name":"Cartera","start_url":"./","scope":"./","display":"standalone","background_color":"#111418","theme_color":"#111418","lang":"es",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"}]},
 open('./manifest.webmanifest','w'),indent=1)
open('./sw.js','w').write('''const C='mc-v2',F=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;   // los datos (Apps Script) nunca pasan por aquí
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
''')

# ============ INDEX DE LA PWA ============
s=open('src/Index_v3.html',encoding='utf-8').read()
s=rep(s,'<html lang="es"><head><base target="_top"><meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">',
'''<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mi Cartera</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Cartera">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#111418">
<meta name="robots" content="noindex,nofollow">''')
s=rep(s,"<h1>📈 Cartera</h1>","<h1><img src=\"apple-touch-icon.png\" alt=\"\" style=\"width:30px;height:30px;border-radius:7px;vertical-align:-7px;margin-right:8px\">Cartera</h1>")
s=rep(s,"main{max-width:1040px;margin:0 auto;padding:16px}","main{max-width:1040px;margin:0 auto;padding:16px;padding-top:calc(16px + env(safe-area-inset-top));padding-bottom:calc(24px + env(safe-area-inset-bottom))}\n.ov{padding-top:calc(16px + env(safe-area-inset-top))}\ninput.q{font-size:16px}")
s=rep(s,"main{padding:12px}","main{padding:12px;padding-top:calc(12px + env(safe-area-inset-top));padding-bottom:calc(20px + env(safe-area-inset-bottom));padding-left:calc(12px + env(safe-area-inset-left));padding-right:calc(12px + env(safe-area-inset-right))}")
s=rep(s,"@media(max-width:760px){.nm{display:none}","@media(max-width:760px){main{padding-left:calc(12px + env(safe-area-inset-left));padding-right:calc(12px + env(safe-area-inset-right))}.nm{display:none}")
# pantalla de conexión
s=rep(s,'<div id="msg" class="card">','<div id="cfgscr" class="card hide"><h2>Conexión con tu hoja</h2><div class="note" style="margin:0 0 10px">Pega la URL de la implementación web de Apps Script (termina en /exec) y la clave de acceso. Solo se guardan en este dispositivo.</div><input class="q" id="cu" placeholder="URL de Apps Script (…/exec)" style="width:100%;margin-bottom:8px"><input class="q" id="ck" placeholder="Clave" style="width:100%;margin-bottom:10px"><div class="row"><button id="cs" class="on">Guardar y cargar</button><button id="cc">Borrar caché</button></div><div id="ce" class="err" style="margin-top:8px"></div></div>\n<div id="msg" class="card">')
# shim de google.script.run -> fetch
shim=r'''
/* ---------- Conexión: sustituye a google.script.run por llamadas HTTP al Apps Script ---------- */
const CFG={url:'',key:''};
try{
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('u')&&h.get('k')){localStorage.setItem('mc_url',h.get('u'));localStorage.setItem('mc_key',h.get('k'))}
  CFG.url=localStorage.getItem('mc_url')||h.get('u')||'';CFG.key=localStorage.getItem('mc_key')||h.get('k')||'';
}catch(e){}
const idb={
  _o:()=>new Promise((res,rej)=>{try{const r=indexedDB.open('mc',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}),
  get:k=>idb._o().then(db=>new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})).catch(()=>null),
  set:(k,v)=>idb._o().then(db=>new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false)})).catch(()=>false),
  clear:()=>idb._o().then(db=>new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=()=>res(true)})).catch(()=>false)
};
async function apiCall(name,args){
  const q=new URLSearchParams({a:name,k:CFG.key});if(args&&args[0]!=null)q.set('s',args[0]);
  const r=await fetch(CFG.url+(CFG.url.includes('?')?'&':'?')+q.toString());
  const t=await r.text();
  if(t.trim()[0]!=='{')throw new Error('Respuesta no válida del servidor (¿URL correcta y acceso «Cualquier persona»?)');
  return t;
}
function mkRun(ok,ko){return new Proxy({},{get:(_,name)=>{
  if(name==='withSuccessHandler')return f=>mkRun(f,ko);
  if(name==='withFailureHandler')return g=>mkRun(ok,g);
  return async(...args)=>{
    let served=false;
    try{
      if(name==='loadAll'&&!window.__PTR){const c=await idb.get('data');if(c){served=true;window.__CACHED=true;try{ok&&ok(c)}finally{window.__CACHED=false}}}
      if(name==='loadLogos'){const c=await idb.get('lg'+(args[0]||0));if(c&&Date.now()-c.t<6048e5){ok&&ok(c.v);return}}
      if(name==='loadTvLogos'){const c=await idb.get('tv');if(c&&Date.now()-c.t<6048e5){ok&&ok(c.v);return}}
      const t=await apiCall(name,args);
      let o=null;try{o=JSON.parse(t)}catch(e){}
      if(o&&o.error&&name!=='loadLogos'&&name!=='loadTvLogos')throw new Error(o.error);
      if(name==='loadAll')idb.set('data',t);
      if(name==='loadLogos'&&o&&!o.error)idb.set('lg'+(args[0]||0),{t:Date.now(),v:t});
      if(name==='loadTvLogos'&&o&&!o.error&&o.pending===0)idb.set('tv',{t:Date.now(),v:t});
      ok&&ok(name==='buildHistory'?o:t);
    }catch(e){
      if(name==='loadAll'&&/No autorizado/.test(String(e&&e.message))){showCfg(String(e.message));return}
      if(!served)ko&&ko(e);else {const m=document.getElementById('smeta')||document.getElementById('meta');if(m)m.textContent='sin conexión · datos guardados'}
    }
  }}})}
window.google={script:{run:mkRun(null,null)}};
function showCfg(msg){
  $('#msg').classList.add('hide');$('#app').classList.add('hide');$('#cfgscr').classList.remove('hide');
  $('#cu').value=CFG.url;$('#ck').value=CFG.key;$('#ce').textContent=msg||'';
}
'''
s=rep(s,"const $=s=>document.querySelector(s);","const $=s=>document.querySelector(s);"+shim)
# ajustes: conexión
s=rep(s,"${eyeSvg(false)} Ocultar importes</button></div>","${eyeSvg(false)} Ocultar importes</button><button id=\"s-conn\" style=\"white-space:nowrap\">🔌 Conexión</button></div>")
s=rep(s,"  $('#s-eye').onclick=toggleHide;","  $('#s-eye').onclick=toggleHide;\n  $('#s-conn').onclick=()=>{$('#st').classList.add('hide');showCfg()};")
# arranque
s=rep(s,"$('#rf').onclick=load;load();","""$('#cs').onclick=()=>{CFG.url=$('#cu').value.trim();CFG.key=$('#ck').value.trim();
  if(!/^https:\\/\\/script\\.google\\.com\\//.test(CFG.url)){$('#ce').textContent='La URL debe empezar por https://script.google.com/…';return}
  try{localStorage.setItem('mc_url',CFG.url);localStorage.setItem('mc_key',CFG.key)}catch(e){}
  $('#cfgscr').classList.add('hide');LGSTART=false;load()};
$('#cc').onclick=async()=>{await idb.clear();$('#ce').textContent='Caché borrada.'};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js?v=2').catch(()=>{});
if(!CFG.url||!CFG.key)showCfg();else load();""")
s=rep(s,"#gtt{","html,body{overscroll-behavior-y:none}\n#gtt{")
s=rep(s,"#gtt{","#sbar{position:fixed;top:0;left:0;width:100%;height:max(env(safe-area-inset-top,0px),8px);background:var(--bg);z-index:25}\n#gtt{")
s=rep(s,'<div id="gtt" class="tt hide"></div>','<div id="sbar"></div><div id="ptr"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="7" transform="rotate(0 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(30 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(60 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(90 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(120 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(150 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(180 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(210 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(240 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(270 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(300 12 12)"/><line x1="12" y1="3" x2="12" y2="7" transform="rotate(330 12 12)"/></svg></div><div id="gtt" class="tt hide"></div>')
PTR_JS = r"""
(function(){
  const rf=document.getElementById('rf'),pt=document.getElementById('ptr');if(!rf||!pt)return;
  const svg=rf.querySelector('svg'),els=()=>[...document.querySelectorAll('#cfgscr,#msg,#app,#ft')],tk=[...pt.querySelectorAll('line')];
  tk.forEach((l,i)=>l.style.opacity=0);
  const HOLD=56,THR=90,S=0.45;            /* S = grados por ms del giro continuo (360° en 800 ms) */
  let off=0,vo=0,tgt=0,dragging=false,raf=0,last=0,y0=0,x0=0,dy=0,act=false,busy=false,shown=-1,tb=0,anim=null;
  const top=()=>(document.scrollingElement||document.documentElement).scrollTop<=0;
  const blocked=()=>[...document.querySelectorAll('.ov')].some(o=>!o.classList.contains('hide'));
  const rubber=d=>110*(1-Math.exp(-Math.max(0,d)/150));
  const curAng=()=>{const m=getComputedStyle(svg).transform;if(!m||m==='none')return 0;const v=m.match(/matrix\(([^)]+)\)/);if(!v)return 0;const q=v[1].split(',').map(Number);return (Math.atan2(q[1],q[0])*180/Math.PI+360)%360};
  const ticks=n=>{if(n===shown)return;shown=n;tk.forEach((l,i)=>l.style.opacity=i<n?(0.25+0.75*(i/11)).toFixed(2):0)};
  const apply=()=>{const tr=Math.abs(off)>.05?'translateY('+off.toFixed(2)+'px)':'';els().forEach(e=>e.style.transform=tr);
    pt.style.top=(tb+(12+off)/2-13)+'px';pt.style.opacity=Math.max(0,Math.min(1,(off-8)/26));if(!busy)ticks(Math.round(Math.min(1,off/HOLD)*12))};
  const tick=ts=>{raf=0;const dt=Math.min(.033,((ts-last)/1000)||.016);last=ts;let go=dragging;
    if(!dragging){const a=-260*(off-tgt)-20*vo;vo+=a*dt;off+=vo*dt;if(Math.abs(off-tgt)>.3||Math.abs(vo)>4)go=true;else{off=tgt;vo=0}}
    apply();if(go)raf=requestAnimationFrame(tick);else{off=0;apply();pt.classList.remove('sp');ticks(0)}};
  const run=()=>{if(!raf){last=performance.now();raf=requestAnimationFrame(tick)}};
  /* giro del icono con la API de animaciones: sigue fluido aunque el hilo principal esté ocupado pintando */
  const spinStart=a0=>{if(anim)anim.cancel();svg.style.transform='';
    const T=500,d=0.5*S*T;
    anim=svg.animate([{transform:'rotate('+a0+'deg)'},{transform:'rotate('+(a0+d)+'deg)'}],{duration:T,easing:'cubic-bezier(.333,0,.667,.333)',fill:'forwards'});
    anim.onfinish=()=>{const b=a0+d;anim.cancel();anim=svg.animate([{transform:'rotate('+b+'deg)'},{transform:'rotate('+(b+360)+'deg)'}],{duration:360/S,iterations:Infinity})}};
  const spinStop=()=>{if(!anim)return;const th=curAng();anim.cancel();anim=null;
    let r=360-th;if(r<70)r+=360;const T=2*r/S;
    svg.style.transform='';anim=svg.animate([{transform:'rotate('+th+'deg)'},{transform:'rotate('+(th+r)+'deg)'}],{duration:T,easing:'cubic-bezier(.333,.667,.667,1)'});
    anim.onfinish=()=>{anim.cancel();anim=null}};
  const start=()=>{if(busy)return;if(!CFG.url||!CFG.key){showCfg();return}
    const a0=dragging||dy>0?Math.max(0,dy)*2.4%360:0;
    busy=true;window.__PTR=true;dragging=false;tgt=HOLD;ticks(12);pt.classList.add('sp');run();spinStart(a0);const t0=Date.now();
    setTimeout(()=>{tgt=0;vo=-30;run()},650);
    const fin=()=>setTimeout(()=>{window.__PTR=false;busy=false;spinStop()},Math.max(0,1000-(Date.now()-t0)));
    const safety=setTimeout(fin,45000);load(()=>{clearTimeout(safety);fin()})};
  window.refreshData=start;rf.onclick=()=>{dy=0;start()};
  addEventListener('touchstart',e=>{if(busy||e.touches.length!==1||blocked()||!top()){act=false;return}
    y0=e.touches[0].clientY;x0=e.touches[0].clientX;dy=0;act=true;dragging=true;off=0;vo=0;tgt=0;shown=-1;
    const h=document.querySelector('.top');tb=h?h.getBoundingClientRect().bottom:60;run()},{passive:true});
  addEventListener('touchmove',e=>{if(!act)return;const t=e.touches[0];dy=t.clientY-y0;
    if(Math.abs(t.clientX-x0)>Math.abs(dy)&&dy>0){act=false;dragging=false;tgt=0;svg.style.transform='';run();return}
    off=rubber(dy);svg.style.transform='rotate('+(Math.max(0,dy)*2.4)+'deg)';run()},{passive:true});
  const end=()=>{if(!act)return;act=false;dragging=false;
    if(dy>THR)start();else{svg.style.transition='transform .25s';svg.style.transform='';setTimeout(()=>svg.style.transition='',300);tgt=0;vo=0;run()}};
  addEventListener('touchend',end,{passive:true});addEventListener('touchcancel',end,{passive:true});
})();
"""
s=rep(s,"if(!CFG.url||!CFG.key)showCfg();else load();",
      "if(!CFG.url||!CFG.key)showCfg();else load();"+PTR_JS)
s=rep(s,"#gtt{","#ptr{position:fixed;left:50%;margin-left:-13px;top:0;width:26px;height:26px;opacity:0;z-index:5;pointer-events:none;color:var(--mu)}#ptr svg{display:block}#ptr.sp svg{animation:ptrs 1s steps(12) infinite}@keyframes ptrs{to{transform:rotate(360deg)}}\n#gtt{")
open('index.html','w',encoding='utf-8').write(s)
print('built',len(s))
