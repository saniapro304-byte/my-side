const $=id=>document.getElementById(id);
const esc=s=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML};
const el=(t,p={},...c)=>{const e=document.createElement(t);for(const k in p){if(k==='class')e.className=p[k];else if(k==='html')e.innerHTML=p[k];else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),p[k]);else e.setAttribute(k,p[k])}c.forEach(x=>x!=null&&e.append(x));return e};
const tst=m=>{document.querySelectorAll('.tst').forEach(t=>t.remove());const t=el('div',{class:'tst',html:m});document.body.appendChild(t);setTimeout(()=>t.remove(),2400)};
const ft=d=>new Date(d).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
const fd=d=>{const n=new Date(),y=new Date();y.setDate(y.getDate()-1);return d.toDateString()===n.toDateString()?'Сегодня':d.toDateString()===y.toDateString()?'Вчера':d.toLocaleDateString('ru',{day:'numeric',month:'short'})};
const rt=d=>{const diff=Date.now()-new Date(d).getTime();const m=Math.floor(diff/60000);if(m<1)return 'только что';if(m<60)return m+' мин';const h=Math.floor(m/60);if(h<24)return h+' ч';return Math.floor(h/24)+' дн'};
const db=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
const boot=(m,c)=>{const e=$('BE');if(e){e.style.display='block';e.innerHTML='<div style="color:'+(c||'#fff')+'">'+m+'</div>'}const l=$('L');if(l)l.style.display='none'};
const BAD=/бля|хуй|пизд|еба|сука|нах|мудак|гандо|долбо|хер|жоп|срак|говн|мраз|твар|урод/gi;
const TMOUT=(promise,ms=10000,label='запрос')=>Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error('Таймаут '+ms/1000+'с: '+label)),ms))]);
window.tst=tst;window.esc=esc;window.el=el;window.ft=ft;window.fd=fd;window.rt=rt;

const CDN_LIST_SUPABASE=["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/+esm","https://esm.sh/@supabase/supabase-js@2.39.7","https://cdn.skypack.dev/@supabase/supabase-js@2.39.7"];
const CDN_LIST_EMOJI=["https://cdn.jsdelivr.net/npm/emoji-picker-element@1.20.0/+esm","https://esm.sh/emoji-picker-element@1.20.0","https://cdn.skypack.dev/emoji-picker-element@1.20.0"];
async function loadFromCDN(urls,name){let lastErr=null;for(let i=0;i<urls.length;i++){const url=urls[i];try{const module=await import(url);return module}catch(err){lastErr=err}}throw new Error(name+': все CDN недоступны. '+(lastErr?lastErr.message:''))}
let createClient;
try{
  boot('1. SDK...');
  const m=await loadFromCDN(CDN_LIST_SUPABASE,'Supabase');
  createClient=m.createClient;
  boot('2. Emoji...');
  await loadFromCDN(CDN_LIST_EMOJI,'Emoji');
  boot('3. Подключение...');
}catch(e){boot('<span style="color:#f55;font-size:16px">SDK ERROR</span><br><br>'+e.message,'#fff');throw e}

const SB_URL="https://qtuvtxbxtypvttfjiydv.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA";
const CREATOR="itzrealsaneghka",OFFICIAL="spacegram",TENOR="LIVDSRZULELA";

let sb;
try{
  sb=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'spacegram-auth'}});
  boot('4. БД...');
  const t=await TMOUT(sb.from('profiles').select('id').limit(1),12000,'БД');
  if(t.error&&t.error.code!=='PGRST116')throw new Error(t.error.message);
  boot('5. Сессия...');
}catch(e){boot('<span style="color:#f55">DB ERROR: '+e.message+'</span>','#fff');throw e}

$('BE').style.display='none';$('L').style.display='';

let me=null,myP=null,aC=null,aO=null,aCO=null,chSub=null,mSub=null,gSub=null,pollI=null,chatPollI=null,onlineI=null,isPolling=false;
let chats=[],msgs=[],reactions=[],polls={},stickers=[],profiles={},unread={},posts=[],bots=[],shopItems=[],myPurchases=[],myStickers=[];
let settings={theme:'midnight',mode:'dark',readReceipts:true,enterSend:true,notif:true,sound:true,vibro:true,preview:true,lang:'ru',push:false,fontSize:'normal',cornerRadius:'medium',animations:true,timeFormat:'24h',autoDelete:'off',quietHours:false,showTyping:true};
try{Object.assign(settings,JSON.parse(localStorage.getItem('sg_settings')||'{}'))}catch(e){}
let replyTo=null,recorder=null,chunks=[],recording=false,selM=[],isAdmin=false,optId=0,burnTime=0;
let stories=[],storiesByU={},svState={uId:null,i:0,timer:null};
let sFile=null,sType='image',sBg=null,sText='';
let curVerB='verified',feedLoaded=false,curRepMsg=null,curRepReason='spam';
let customSoundUrl=null;
try{customSoundUrl=localStorage.getItem('sg_sound')||null}catch(e){}
let autoReadTimer=null,lastTypingSent=0;
let typingWatcher=null;
let callState={active:false,incoming:false,caller:null,pc:null,localStream:null,remoteStream:null,type:'audio',sub:null,startTime:null,chatId:null,pendingOffer:null};

const BG=['#1a1a2e','#16213e','#0f3460','#e94560','#533483','#f39c12','#27ae60','#8e44ad','#c0392b','#2c3e50','#16a085','#d35400','#2d3436','#000'];
const EMS=['😀','😎','🤔','😴','🎮','🎧','📚','💼','🍕','☕','🔥','💯','🚀','🌙','☀️','❤️','🎉','🎯'];
const BI={creator:{i:'★',n:'Создатель',d:'Основатель Spacegram.'},verified:{i:'✓',n:'Подтверждённый',d:'Проверен админом.'},official:{i:'✓',n:'Официальный канал',d:'Канал Spacegram.'},bot:{i:'✓',n:'Официальный бот',d:'Проверенный бот.'},youtuber:{i:'▶',n:'YouTuber',d:'Известный ютубер.'},plus:{i:'👑',n:'Spacegram Plus',d:'Премиум.'},banned:{i:'🚫',n:'Забанен',d:'Аккаунт заблокирован.'}};

const COSMETICS={
  frame:[
    {id:'fr_none',name:'Нет',preview:'',data:null,price:0,default:true},
    {id:'fr_bronze',name:'Бронза',preview:'🥉',data:'bronze',price:200},
    {id:'fr_silver',name:'Серебро',preview:'🥈',data:'silver',price:400},
    {id:'fr_gold',name:'Золото',preview:'🥇',data:'gold',price:800},
    {id:'fr_diamond',name:'Алмаз',preview:'💎',data:'diamond',price:1500},
    {id:'fr_fire',name:'Огонь',preview:'🔥',data:'fire',price:500},
    {id:'fr_ice',name:'Лёд',preview:'❄️',data:'ice',price:500},
    {id:'fr_rainbow',name:'Радуга',preview:'🌈',data:'rainbow',price:2000},
    {id:'fr_neon',name:'Неон',preview:'💚',data:'neon',price:1000},
    {id:'fr_galaxy',name:'Галактика',preview:'🌌',data:'galaxy',price:2500},
    {id:'fr_blood',name:'Кровь',preview:'🩸',data:'blood',price:700},
    {id:'fr_toxic',name:'Токсик',preview:'☢️',data:'toxic',price:900}
  ],
  badge:[
    {id:'bd_none',name:'Нет',preview:'',data:null,price:0,default:true},
    {id:'bd_early',name:'Ранний',preview:'🌱',data:'early',price:300},
    {id:'bd_premium',name:'Премиум',preview:'💎',data:'premium',price:600},
    {id:'bd_vip',name:'VIP',preview:'⭐',data:'vip',price:1000},
    {id:'bd_legend',name:'Легенда',preview:'🏆',data:'legend',price:3000},
    {id:'bd_king',name:'Король',preview:'👑',data:'king',price:5000},
    {id:'bd_founder',name:'Основатель',preview:'🚀',data:'founder',price:10000},
    {id:'bd_dev',name:'Разработчик',preview:'⚡',data:'dev',price:2000},
    {id:'bd_og',name:'OG',preview:'🎯',data:'og',price:1500}
  ],
  effect:[
    {id:'ef_none',name:'Нет',preview:'',data:null,price:0,default:true},
    {id:'ef_sparkles',name:'Блёстки',preview:'✨',data:'sparkles',price:500},
    {id:'ef_hearts',name:'Сердечки',preview:'💖',data:'hearts',price:600},
    {id:'ef_stars',name:'Звёзды',preview:'⭐',data:'stars',price:700},
    {id:'ef_fire',name:'Огонь',preview:'🔥',data:'fire',price:800},
    {id:'ef_snow',name:'Снег',preview:'❄️',data:'snow',price:800},
    {id:'ef_sakura',name:'Сакура',preview:'🌸',data:'sakura',price:1200},
    {id:'ef_lightning',name:'Молния',preview:'⚡',data:'lightning',price:1500},
    {id:'ef_rainbow',name:'Радуга',preview:'🌈',data:'rainbow',price:2500}
  ],
  avatar:[
    {id:'av_default',name:'Стандарт',preview:'👤',data:null,price:0,default:true},
    {id:'av_heart',name:'Сердце',preview:'❤️',data:'heart',price:400},
    {id:'av_star',name:'Звезда',preview:'⭐',data:'star',price:500},
    {id:'av_crown',name:'Корона',preview:'👑',data:'crown',price:1000},
    {id:'av_skull',name:'Череп',preview:'💀',data:'skull',price:600},
    {id:'av_ghost',name:'Призрак',preview:'👻',data:'ghost',price:700},
    {id:'av_robot',name:'Робот',preview:'🤖',data:'robot',price:800},
    {id:'av_alien',name:'Пришелец',preview:'👽',data:'alien',price:900},
    {id:'av_dragon',name:'Дракон',preview:'🐉',data:'dragon',price:2000},
    {id:'av_phoenix',name:'Феникс',preview:'🦅',data:'phoenix',price:3000}
  ],
  banner:[
    {id:'bn_none',name:'Нет',preview:'',data:null,price:0,default:true},
    {id:'bn_sunset',name:'Закат',preview:'🌅',data:'sunset',price:500},
    {id:'bn_ocean',name:'Океан',preview:'🌊',data:'ocean',price:600},
    {id:'bn_forest',name:'Лес',preview:'🌲',data:'forest',price:500},
    {id:'bn_city',name:'Город',preview:'🌃',data:'city',price:800},
    {id:'bn_space',name:'Космос',preview:'🌌',data:'space',price:1200},
    {id:'bn_neon',name:'Неон',preview:'🎆',data:'neon',price:1500},
    {id:'bn_abstract',name:'Абстракция',preview:'🎨',data:'abstract',price:1000},
    {id:'bn_pixel',name:'Пиксель',preview:'👾',data:'pixel',price:700}
  ]
};
window.COSMETICS=COSMETICS;

function getFrameColor(data){const m={bronze:'#cd7f32',silver:'#c0c0c0',gold:'#ffd700',diamond:'#7df9ff',fire:'#ff4500',ice:'#87ceeb',rainbow:'#ff00ff',neon:'#00ff88',galaxy:'#8a2be2',blood:'#8b0000',toxic:'#00ff00',null:'rgba(255,255,255,.1)'};return m[data]||'rgba(255,255,255,.1)'}
function getFrameGlow(data){const m={bronze:'rgba(205,127,50,.4)',silver:'rgba(192,192,192,.5)',gold:'rgba(255,215,0,.7)',diamond:'rgba(125,249,255,.8)',fire:'rgba(255,69,0,.7)',ice:'rgba(135,206,235,.6)',rainbow:'rgba(255,0,255,.5)',neon:'rgba(0,255,136,.7)',galaxy:'rgba(138,43,226,.6)',blood:'rgba(139,0,0,.6)',toxic:'rgba(0,255,0,.6)',null:'transparent'};return m[data]||'transparent'}
function getBannerBG(data){const m={sunset:'linear-gradient(135deg,#ff6b6b,#feca57)',ocean:'linear-gradient(135deg,#4facfe,#00f2fe)',forest:'linear-gradient(135deg,#0ba360,#3cba92)',city:'linear-gradient(135deg,#232526,#414345)',space:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',neon:'linear-gradient(135deg,#ff00cc,#333399)',abstract:'linear-gradient(135deg,#ff6bcb,#9c27b0,#3f51b5)',pixel:'linear-gradient(135deg,#00c9ff,#92fe9d)',null:'rgba(255,255,255,.05)'};return m[data]||m.null}

function bd(p,isCh){
  if(!p)return '';
  if(p.is_banned)return '<span class="bd ban" onclick="event.stopPropagation();sBI(\'banned\')">🚫</span>';
  let h='';
  if(isCh){if(p.is_official)h+='<span class="bd off" onclick="event.stopPropagation();sBI(\'official\')">✓</span>';return h}
  if(p.is_creator)h+='<span class="bd c" onclick="event.stopPropagation();sBI(\'creator\')">★</span>';
  else if(p.is_youtuber)h+='<span class="bd yt" onclick="event.stopPropagation();sBI(\'youtuber\')">▶</span>';
  else if(p.is_bot_verified||p.username===OFFICIAL)h+='<span class="bd bot" onclick="event.stopPropagation();sBI(\'bot\')">✓</span>';
  else if(p.is_verified)h+='<span class="bd v" onclick="event.stopPropagation();sBI(\'verified\')">✓</span>';
  if(p.is_plus)h+='<span class="bd p" onclick="event.stopPropagation();sBI(\'plus\')">👑</span>';
  if(p.age_verified)h+='<span class="bd" style="background:#10b981;font-size:9px;width:auto;padding:0 4px" onclick="event.stopPropagation();tst(\'16+ подтверждено\')">16+</span>';
  if(p.role==='admin'||p.role==='creator')h+='<span class="bd" style="background:#7c3aed;font-size:9px;width:auto;padding:0 4px" onclick="event.stopPropagation();tst(\''+(p.role==='creator'?'Создатель':'Админ')+'\')">🛡️</span>';
  return h;
}
window.bd=bd;
window.sBI=k=>{const i=BI[k];if(!i)return;$('bmc').innerHTML='<h2>'+i.i+' '+i.n+'</h2><div style="background:var(--p2);border-radius:12px;padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:12px"><div style="font-size:34px">'+i.i+'</div><div style="font-size:13.5px">'+i.d+'</div></div><button onclick="document.getElementById(\'bm\').classList.remove(\'show\')">Понятно</button>';$('bm').classList.add('show')};
function theme(){
  document.body.className='';
  if(myP?.is_plus)document.body.classList.add('plus');
  const t=settings.theme;
  if(t!=='midnight')document.body.classList.add(t.slice(0,2));
  if(settings.mode==='light')document.body.classList.add('l');
  if(settings.fontSize==='small')document.body.classList.add('fs-small');
  else if(settings.fontSize==='large')document.body.classList.add('fs-large');
  else if(settings.fontSize==='huge')document.body.classList.add('fs-huge');
  if(settings.cornerRadius==='small')document.body.classList.add('cr-small');
  else if(settings.cornerRadius==='large')document.body.classList.add('cr-large');
}
window.theme=theme;
const svS=()=>localStorage.setItem('sg_settings',JSON.stringify(settings));
window.svS=svS;
const hl=()=>{const l=$('L');if(l)l.classList.add('h')};

let baseTitle=document.title,titleTimer=null;
function updateTitleBadge(){
  const total=Object.values(unread).reduce((a,b)=>a+b,0);
  if(total>0){if(!titleTimer){let f=false;titleTimer=setInterval(()=>{f=!f;document.title=(f?'('+total+') ':'')+baseTitle},900)}}
  else{if(titleTimer){clearInterval(titleTimer);titleTimer=null}document.title=baseTitle}
  if('setAppBadge' in navigator){try{total>0?navigator.setAppBadge(total):navigator.clearAppBadge()}catch(e){}}
  updateFaviconBadge(total);
}
let faviconLink=null;
function updateFaviconBadge(n){
  if(!faviconLink)faviconLink=document.querySelector('link[rel="icon"]');
  if(!faviconLink)return;
  if(n===0){faviconLink.href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✈️</text></svg>";return}
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✈️</text><circle cx="75" cy="25" r="22" fill="#e74c3c"/><text x="75" y="34" font-size="26" fill="#fff" text-anchor="middle" font-weight="bold">'+(n>9?'9+':n)+'</text></svg>';
  faviconLink.href='data:image/svg+xml,'+encodeURIComponent(svg);
}
function playSound(type){
  type=type||'msg';
  if(!settings.sound)return;
  try{
    const c=new(window.AudioContext||window.webkitAudioContext)();
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    if(type==='mention'){o.frequency.value=1200;g.gain.value=.15;o.start();o.frequency.setValueAtTime(900,c.currentTime+.08);o.stop(c.currentTime+.18)}
    else if(type==='sent'){o.frequency.value=600;g.gain.value=.05;o.start();o.stop(c.currentTime+.06)}
    else if(type==='ring'){o.frequency.value=880;g.gain.value=.2;o.start();o.frequency.setValueAtTime(1100,c.currentTime+.2);o.frequency.setValueAtTime(880,c.currentTime+.4);o.stop(c.currentTime+.6)}
    else{o.frequency.value=800;g.gain.value=.1;o.start();o.stop(c.currentTime+.1)}
  }catch(e){}
}
function vibrate(type){
  type=type||'msg';
  if(!settings.vibro||!navigator.vibrate)return;
  if(type==='mention')navigator.vibrate([100,50,100,50,100]);
  else if(type==='sent')navigator.vibrate(20);
  else if(type==='ring')navigator.vibrate([500,200,500,200,500]);
  else navigator.vibrate([50,30,50]);
}
function notif(type){
  type=type||'msg';
  if(!settings.notif)return;
  if(settings.quietHours){const h=new Date().getHours();if(h>=23||h<8)return}
  if(customSoundUrl&&type!=='sent'){try{const a=new Audio(customSoundUrl);a.volume=.5;a.play().catch(function(){})}catch(e){}}
  else playSound(type);
  vibrate(type);
}
function initPush(){
  if(!('Notification'in window))return;
  if(Notification.permission==='default'){Notification.requestPermission().then(function(p){settings.push=p==='granted';svS();if(p==='granted')tst('Push включены')})}
}
function showPush(title,body,chatId){
  if(!settings.push||Notification.permission!=='granted')return;
  if(!document.hidden)return;
  try{const n=new Notification(title,{body:body,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✈️</text></svg>',tag:chatId||'sg',renotify:true});
  n.onclick=function(){window.focus();if(chatId&&chatId!==aC){const c=chats.find(function(x){return x.id===chatId});if(c)openChat(chatId,c.user1===me.id?c.user2:c.user1,c)}n.close()}}catch(e){}
}
async function getP(id){
  if(profiles[id])return profiles[id];
  try{const r=await TMOUT(sb.from('profiles').select('*').eq('id',id).single(),8000,'getP');const data=r.data;if(data)profiles[id]=data;return data}catch(e){return null}
}
window.getP=getP;

async function addBalance(uid,amount,note){
  const r=await sb.from('profiles').select('balance').eq('id',uid).maybeSingle();
  const p=r.data;
  if(!p)return 0;
  const nb=(p.balance||0)+amount;
  await sb.from('profiles').update({balance:nb}).eq('id',uid);
  await sb.from('balance_log').insert({user_id:uid,amount:amount,reason:note||'',from_admin:me.id});
  return nb;
}
window.addBalance=addBalance;
async function spendBalance(uid,amount,note){
  const r=await sb.from('profiles').select('balance').eq('id',uid).maybeSingle();
  const p=r.data;
  if(!p||(p.balance||0)<amount)return false;
  const nb=(p.balance||0)-amount;
  await sb.from('profiles').update({balance:nb}).eq('id',uid);
  await sb.from('balance_log').insert({user_id:uid,amount:-amount,reason:note||'',from_admin:me.id});
  return true;
}
window.spendBalance=spendBalance;

window.openBalance=async function(){const r=await sb.from('profiles').select('balance').eq('id',me.id).single();myP.balance=r.data.balance||0;$('bmc').innerHTML='<h2>Баланс</h2><div style="text-align:center;padding:20px 0"><div style="font-size:48px">💰</div><div style="font-size:36px;font-weight:800;color:#10b981;margin-top:10px">'+myP.balance+' <span style="font-size:18px;color:var(--t2)">SG</span></div></div><button onclick="showTx()" style="background:var(--p2);color:var(--t)">История</button><button onclick="document.getElementById(\'bm\').classList.remove(\'show\')">Закрыть</button>';$('bm').classList.add('show')};
window.showTx=async function(){const r=await sb.from('balance_log').select('*').eq('user_id',me.id).order('created_at',{ascending:false}).limit(50);const data=r.data;let h='<h2>История</h2>';if(!data||!data.length)h+='<div style="text-align:center;color:var(--t2);padding:20px">Пусто</div>';else data.forEach(function(t){const isIn=t.amount>0;h+='<div style="background:var(--p2);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:13px;font-weight:600">'+esc(t.reason||'Транзакция')+'</div><div style="font-size:10px;color:var(--t2);margin-top:2px">'+new Date(t.created_at).toLocaleString('ru')+'</div></div><div style="font-size:16px;font-weight:800;color:'+(isIn?'var(--g)':'var(--r)')+'">'+(isIn?'+':'')+t.amount+'</div></div>'});h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show')};
async function sendWarn(uid,reason){await sb.from('user_warns').insert({user_id:uid,admin_id:me.id,reason:reason});const rc=await sb.from('user_warns').select('*',{count:'exact',head:true}).eq('user_id',uid);const total=rc.count||0;await sb.from('profiles').update({warns:total}).eq('id',uid);const rp=await sb.from('profiles').select('username').eq('id',uid).maybeSingle();await logMod(uid,'warn',reason);if(total>=3){await sb.from('profiles').update({is_banned:true,ban_reason:'3/3'}).eq('id',uid);tst('ЗАБАНЕН')}else tst('Варн '+total+'/3')}
async function logMod(target,action,details){try{await sb.from('mod_log').insert({admin_id:me.id,target_id:target,action:action,details:details||''})}catch(e){}}
window.logMod=logMod;window.sendWarn=sendWarn;
window.showActivity=async function(){const r=await sb.from('messages').select('created_at').eq('sender',me.id).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).limit(2000);const data=r.data;const byDay={};for(let i=29;i>=0;i--){const d=new Date(Date.now()-i*86400000);byDay[d.toDateString()]=0}(data||[]).forEach(function(m){const k=new Date(m.created_at).toDateString();if(byDay[k]!==undefined)byDay[k]++});const max=Math.max.apply(null,[1].concat(Object.values(byDay)));let h='<h2>Активность</h2><div style="background:var(--p2);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;gap:2px;align-items:flex-end;height:100px">';Object.entries(byDay).forEach(function(e){const day=e[0],count=e[1];const hh=Math.max(2,(count/max)*100);h+='<div style="flex:1;background:'+(count?'var(--a)':'var(--p)')+';height:'+hh+'%;border-radius:2px;min-height:2px"></div>'});h+='</div></div>';const total=Object.values(byDay).reduce(function(a,b){return a+b},0);h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show')};
async function sendTyping(){if(!aC)return;const now=Date.now();if(now-lastTypingSent<3000)return;lastTypingSent=now;try{await sb.from('profiles').update({typing_until:new Date(Date.now()+5000).toISOString(),last_seen:new Date().toISOString()}).eq('id',me.id)}catch(e){}}
window.sendTyping=sendTyping;

window.trackProfileView=async function(uid){if(!uid||uid===me.id)return;try{await sb.from('profile_views').insert({viewer_id:me.id,viewed_id:uid})}catch(e){}};
window.showProfileViews=async function(){const r=await sb.from('profile_views').select('*').eq('viewed_id',me.id).order('viewed_at',{ascending:false}).limit(100);const data=r.data;if(!data||!data.length)return tst('Никто не смотрел');const uniq={};(data||[]).forEach(function(v){if(!uniq[v.viewer_id])uniq[v.viewer_id]={count:0,last:v.viewed_at};uniq[v.viewer_id].count++;if(v.viewed_at>uniq[v.viewer_id].last)uniq[v.viewer_id].last=v.viewed_at});const ids=Object.keys(uniq);const rp=await sb.from('profiles').select('id,username,display_name,avatar_url').in('id',ids);const pm={};(rp.data||[]).forEach(function(p){pm[p.id]=p});let h='<h2>👀 Кто смотрел</h2>';ids.sort(function(a,b){return uniq[b].last>uniq[a].last?1:-1}).forEach(function(id){const p=pm[id];if(!p)return;h+='<div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px"><div style="width:40px;height:40px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-weight:600;overflow:hidden">'+(p.avatar_url?'<img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc(p.display_name[0].toUpperCase()))+'</div><div style="flex:1"><div style="font-weight:600">'+esc(p.display_name)+'</div><div style="font-size:11px;color:var(--t2)">@'+esc(p.username)+' • '+uniq[id].count+' раз • '+rt(uniq[id].last)+'</div></div></div>'});h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show')};

window.openChatGallery=async function(){if(!aC)return tst('Открой чат');const r=await sb.from('messages').select('file_url,file_type,is_img_grid,created_at').eq('chat_id',aC).not('file_url','is',null).order('created_at',{ascending:false}).limit(200);const data=r.data;const imgs=[];(data||[]).forEach(function(m){if(m.is_img_grid&&m.file_url)m.file_url.split('||').forEach(function(u){imgs.push({url:u})});else if(m.file_type&&(m.file_type.indexOf('image')===0||m.file_type.indexOf('video')===0))imgs.push({url:m.file_url})});if(!imgs.length)return tst('Нет медиа');let h='<h2>🖼️ Галерея ('+imgs.length+')</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';imgs.forEach(function(i){h+='<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer" onclick="viewImg(\''+i.url+'\')"><img src="'+i.url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>'});h+='</div><button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:12px">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show')};

window.showAnalytics=async function(){const r=await sb.from('messages').select('created_at,chat_id').eq('sender',me.id).order('created_at',{ascending:false}).limit(5000);const msgs=r.data;const total=msgs?msgs.length:0;const today=new Date();today.setHours(0,0,0,0);const todayMsgs=(msgs||[]).filter(function(m){return new Date(m.created_at)>=today}).length;const week=new Date(Date.now()-7*86400000);const weekMsgs=(msgs||[]).filter(function(m){return new Date(m.created_at)>=week}).length;let h='<h2>📊 Аналитика</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';h+='<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:800;color:var(--a)">'+total+'</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Всего</div></div>';h+='<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:800;color:#10b981">'+todayMsgs+'</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Сегодня</div></div>';h+='<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:800;color:#f39c12">'+weekMsgs+'</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Неделя</div></div></div>';h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="width:100%;padding:12px;border-radius:12px;background:var(--p2);color:var(--t)">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show')};

window.toggleAnon=async function(v){await sb.from('profiles').update({anonymous_mode:v}).eq('id',me.id);myP.anonymous_mode=v;tst(v?'🎭 Вкл':'Обычный')};

function startTypingWatcher(){if(typingWatcher)clearInterval(typingWatcher);typingWatcher=setInterval(async function(){if(!aC||!aO||aCO?.is_group||aCO?.is_channel)return;if(settings.showTyping===false)return;try{const r=await sb.from('profiles').select('typing_until').eq('id',aO).single();const data=r.data;if(data&&data.typing_until&&new Date(data.typing_until)>new Date()){$('hS').textContent='печатает...';$('hS').style.color='var(--a)'}else{const p=profiles[aO];const on=p&&p.last_seen&&(Date.now()-new Date(p.last_seen).getTime())<90000;$('hS').textContent=on?'в сети':'был(а) недавно';$('hS').style.color=''}}catch(e){}},1500)}
window.startTypingWatcher=startTypingWatcher;

const DRAFTS_KEY='sg_drafts';
function saveDraft(cid,text){try{const d=JSON.parse(localStorage.getItem(DRAFTS_KEY)||'{}');if(text)d[cid]=text;else delete d[cid];localStorage.setItem(DRAFTS_KEY,JSON.stringify(d))}catch(e){}}
function loadDraft(cid){try{const d=JSON.parse(localStorage.getItem(DRAFTS_KEY)||'{}');return d[cid]||''}catch(e){return ''}}
window.saveDraft=saveDraft;window.loadDraft=loadDraft;

window.showGiftAnimation=function(emoji){
  emoji=emoji||'🎁';
  const el2=document.createElement('div');
  el2.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99999;pointer-events:none;font-size:120px;animation:giftPop 1.5s ease-out forwards';
  el2.textContent=emoji;
  document.body.appendChild(el2);
  setTimeout(function(){el2.remove()},1600);
};
async function enterApp(){
  $('A').classList.remove('show');$('APP').classList.add('show');
  try{
    const rp=await TMOUT(sb.from('profiles').select('*').eq('id',me.id).maybeSingle(),10000,'enterApp');
    let prof=rp.data;
    if(!prof){const un=(me.user_metadata&&me.user_metadata.username)||(me.email||'').split('@')[0]||'user_'+me.id.slice(0,8);const isC=un===CREATOR,isO=un===OFFICIAL;const rc=await sb.from('profiles').insert({id:me.id,username:un,display_name:un,is_creator:isC,is_verified:isC||isO,is_plus:isC||isO,is_bot_verified:isO,is_youtuber:isC,last_seen:new Date().toISOString()}).select().single();myP=rc.data}
    else myP=prof;
    if(myP&&myP.is_banned){showBanBanner(myP.ban_reason||'Нарушение');}
    profiles[me.id]=myP;
    settings.lang=myP.language||'ru';
    theme();renderMyA();
    try{const rad=await sb.from('admins').select('id').eq('id',me.id).maybeSingle();isAdmin=!!rad.data||myP.role==='admin'||myP.role==='creator';if(isAdmin)$('bAdm').style.display='flex'}catch(e){}
    if(myP.username===CREATOR)isAdmin=true;
    try{const rs=await sb.from('stickers').select('*');stickers=rs.data||[]}catch(e){}
    try{const rit=await sb.from('shop_items').select('*');shopItems=rit.data||[]}catch(e){}
    try{const rpu=await sb.from('user_purchases').select('item_id').eq('user_id',me.id);myPurchases=(rpu.data||[]).map(function(x){return x.item_id})}catch(e){}
    try{const rms=await sb.from('stickers').select('*').eq('user_id',me.id);myStickers=rms.data||[]}catch(e){}
    await loadChats();
    subscribeChats();
    await loadStories();
    setInterval(loadStories,60000);
    await loadFeed();
    feedLoaded=true;
    await loadBots();
    setInterval(checkPlusExp,60000);
    if(isAdmin){setInterval(checkVerMsgs,20000);setInterval(checkTicketBadge,30000)}
    chatPollI=setInterval(function(){if(!document.hidden)loadChats()},20000);
    onlineI=setInterval(async function(){try{const ids=chats.map(function(c){return c.user1===me.id?c.user2:c.user1}).filter(function(id){return id&&id!==me.id});if(!ids.length)return;const ro=await sb.from('profiles').select('id,last_seen').in('id',ids);(ro.data||[]).forEach(function(p){if(profiles[p.id])profiles[p.id].last_seen=p.last_seen})}catch(e){}},5000);
    setInterval(checkMute,30000);checkMute();
    setTimeout(function(){const acts=$('topActs');if(!acts)return;const btns=Array.from(acts.querySelectorAll('button'));btns.forEach(function(b){if(b.id!=='bAdm')b.style.display='none'})},500);
    initSidebar();
    bindButtons();
    initPush();
    document.addEventListener('visibilitychange',function(){if(!document.hidden){updateTitleBadge();if(aC)loadMsgs()}});
  }catch(e){console.error(e);alert('Ошибка: '+e.message)}
  checkPin();
  hl();
}

function bindButtons(){
  const sbBtn=$('bSidebar');
  if(sbBtn)sbBtn.onclick=function(){try{openSidebar()}catch(e){}};
  const cosmBtn=$('bCosmetics');
  if(cosmBtn)cosmBtn.onclick=function(){try{openCosmetics()}catch(e){}};
  const pv=$('bProfileViews');
  if(pv)pv.onclick=function(){$('profM').classList.remove('show');try{showProfileViews()}catch(e){}};
  const an=$('bAnalytics');
  if(an)an.onclick=function(){$('profM').classList.remove('show');try{showAnalytics()}catch(e){}};
  const cg=$('bChatGallery');
  if(cg)cg.onclick=function(){try{openChatGallery()}catch(e){}};
  const cbT=$('cbTranslate');
  if(cbT){cbT.checked=myP?.auto_translate||false;cbT.onchange=async function(e){await sb.from('profiles').update({auto_translate:e.target.checked}).eq('id',me.id);myP.auto_translate=e.target.checked;tst(e.target.checked?'Перевод вкл':'Выкл')}}
  const cbA=$('cbAnon');
  if(cbA){cbA.checked=myP?.anonymous_mode||false;cbA.onchange=function(e){toggleAnon(e.target.checked)}}
  const cbTy=$('cbTyping');
  if(cbTy){cbTy.checked=settings.showTyping!==false;cbTy.onchange=function(e){settings.showTyping=e.target.checked;svS()}}
}
window.bindButtons=bindButtons;

function showBanBanner(reason){
  let b=document.getElementById('banBanner');
  if(!b){b=document.createElement('div');b.id='banBanner';document.body.appendChild(b)}
  b.innerHTML='🚫 Аккаунт забанен: '+esc(reason)+' <button onclick="openTicket(\'unban\')" style="background:#fff;color:#e74c3c;border:none;padding:4px 12px;border-radius:8px;margin-left:10px;font-weight:700">Оспорить</button>';
}
function hideBanBanner(){const b=document.getElementById('banBanner');if(b)b.remove()}
window.showBanBanner=showBanBanner;window.hideBanBanner=hideBanBanner;

async function checkMute(){
  try{
    const rf=await sb.from('profiles').select('muted_until').eq('id',me.id).single();
    const m=rf.data&&rf.data.muted_until;
    if(m&&new Date(m)>new Date()){
      const left=Math.ceil((new Date(m)-Date.now())/60000);
      $('msgI').disabled=true;$('msgI').placeholder='Мут '+left+' мин';$('bSend').disabled=true;
    }else{
      if($('msgI').disabled){$('msgI').disabled=false;$('msgI').placeholder='Сообщение';$('bSend').disabled=false}
    }
  }catch(e){}
}
async function checkPlusExp(){if(myP&&myP.is_plus&&myP.plus_until&&new Date(myP.plus_until)<new Date()){await sb.from('profiles').update({is_plus:false}).eq('id',me.id);myP.is_plus=false;theme();tst('Plus истёк')}}
function renderMyA(){
  const a=$('myA');if(!a)return;
  a.className='avt'+(myP?.is_plus?' plus':'');
  if(myP&&myP.avatar_frame)a.classList.add('frame-'+myP.avatar_frame);
  if(myP&&myP.avatar_url)a.innerHTML='<img src="'+myP.avatar_url+'">';
  else a.textContent=(myP?.display_name||'?')[0].toUpperCase();
  if(myP&&myP.cosmetic_badge){
    const bi=COSMETICS.badge.find(function(x){return x.data===myP.cosmetic_badge});
    if(bi){const bdEl=document.createElement('span');bdEl.style.cssText='position:absolute;bottom:-2px;right:-2px;font-size:12px;background:var(--p);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:2px solid var(--p)';bdEl.textContent=bi.preview;a.appendChild(bdEl)}
  }
  if(myP&&myP.cosmetic_effect){
    const map={sparkles:'✨',hearts:'💖',stars:'⭐',fire:'🔥',snow:'❄️',sakura:'🌸',lightning:'⚡',rainbow:'🌈'};
    const ef=document.createElement('span');
    ef.style.cssText='position:absolute;top:-4px;left:-4px;font-size:12px;pointer-events:none;animation:cosmFloat 2s ease-in-out infinite';
    ef.textContent=map[myP.cosmetic_effect]||'';
    a.appendChild(ef);
  }
  sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',me.id).then(function(){});
}

$('bR').onclick=async function(){
  $('AE').textContent='';
  const e=$('em').value.trim(),p=$('pw').value,u=$('un').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  if(!e||!p)return $('AE').textContent='Заполни';
  if(p.length<6)return $('AE').textContent='Пароль 6+';
  if(u.length<3)return $('AE').textContent='Username 3+';
  $('AE').textContent='...';
  try{
    const r=await sb.auth.signUp({email:e,password:p,options:{data:{username:u,display_name:u}}});
    const data=r.data,error=r.error;
    if(error)return $('AE').textContent=error.message;
    if(!data.user)return $('AE').textContent='Ошибка';
    await new Promise(function(r){setTimeout(r,800)});
    const isC=u===CREATOR,isO=u===OFFICIAL;
    const c={username:u,display_name:u,is_creator:isC,is_verified:isC||isO,is_plus:isC||isO,is_bot_verified:isO,is_youtuber:isC,last_seen:new Date().toISOString()};
    const rp=await sb.from('profiles').select('*').eq('id',data.user.id).maybeSingle();
    if(!rp.data)await sb.from('profiles').insert({id:data.user.id,...c});
    else if(rp.data.username!==u)await sb.from('profiles').update(c).eq('id',data.user.id);
    me=data.user;await enterApp();
  }catch(e){$('AE').textContent=e.message}
};
$('bL').onclick=async function(){
  $('AE').textContent='';
  const e=$('em').value.trim(),p=$('pw').value;
  if(!e||!p)return $('AE').textContent='Заполни';
  $('AE').textContent='Вход...';
  try{const r=await sb.auth.signInWithPassword({email:e,password:p});if(r.error)return $('AE').textContent=r.error.message;me=r.data.user;await enterApp()}catch(e){$('AE').textContent=e.message}
};

$('bnv').onclick=function(e){
  const b=e.target.closest('button');if(!b)return;const t=b.dataset.tab;
  if(aC&&t!=='chats')back();
  document.querySelectorAll('.bn button').forEach(function(x){x.classList.toggle('on',x===b)});
  if(t==='chats'){$('SD').classList.remove('h');$('fdScr').classList.remove('show');$('fcBtn').style.display='none'}
  else if(t==='feed'){$('SD').classList.add('h');$('fdScr').classList.add('show');$('fcBtn').style.display='flex';if(!feedLoaded){loadFeed();feedLoaded=true}}
  else if(t==='profile')showProf()
};

async function loadFeed(){try{const r=await sb.from('posts').select('*').order('created_at',{ascending:false}).limit(50);posts=r.data||[];const uids=[...new Set(posts.map(function(p){return p.author_id}))].filter(function(id){return !profiles[id]});if(uids.length){const rp=await sb.from('profiles').select('*').in('id',uids);(rp.data||[]).forEach(function(p){profiles[p.id]=p})}renderFeed()}catch(e){}}
async function renderFeed(){
  const b=$('fdL');if(!b)return;
  if(!posts.length){b.innerHTML='<div class="emp" style="padding:60px 20px"><div class="ic">📰</div><div>Нет постов</div></div>';return}
  const ids=posts.map(function(p){return p.id});let liked=new Set();
  try{const r=await sb.from('post_likes').select('post_id').eq('user_id',me.id).in('post_id',ids);liked=new Set((r.data||[]).map(function(l){return l.post_id}))}catch(e){}
  b.innerHTML='';
  for(const p of posts){
    const a=profiles[p.author_id]||await getP(p.author_id);if(!a)continue;
    const c=el('div',{class:'po'});c.dataset.pid=p.id;
    let cc=0;
    try{const rc=await sb.from('post_comments').select('*',{count:'exact',head:true}).eq('post_id',p.id);cc=rc.count||0}catch(e){}
    c.innerHTML='<div class="ph"><div class="av" onclick="showUP(\''+a.id+'\')">'+(a.avatar_url?'<img src="'+a.avatar_url+'">':esc(a.display_name[0].toUpperCase()))+'</div><div class="mt"><div class="nm">'+esc(a.display_name)+' '+bd(a)+'</div><div class="tm">'+rt(p.created_at)+'</div></div></div>'+(p.text?'<div class="pt">'+esc(p.text)+'</div>':'')+(p.media_url?'<div class="pmm"><img src="'+p.media_url+'" onclick="viewImg(\''+p.media_url+'\')"></div>':'')+'<div class="pa"><div class="pac '+(liked.has(p.id)?'lk':'')+'" data-like="'+p.id+'"><span class="ic">'+(liked.has(p.id)?'❤️':'🤍')+'</span><span>'+(p.likes||0)+'</span></div><div class="pac" data-comment="'+p.id+'"><span class="ic">💬</span><span class="cc">'+cc+'</span></div></div><div class="cmts" data-slot="'+p.id+'" style="display:none"></div>';
    b.appendChild(c);
  }
  b.querySelectorAll('[data-like]').forEach(function(x){x.onclick=function(e){e.stopPropagation();toggleLike(x.dataset.like)}});
  b.querySelectorAll('[data-comment]').forEach(function(x){x.onclick=function(e){e.stopPropagation();toggleCmts(x.dataset.comment)}});
}
async function toggleLike(pid){const r=await sb.from('post_likes').select('id').eq('post_id',pid).eq('user_id',me.id).maybeSingle();if(r.data){await sb.from('post_likes').delete().eq('id',r.data.id);const p=posts.find(function(x){return x.id===pid});if(p){p.likes=Math.max(0,(p.likes||0)-1);await sb.from('posts').update({likes:p.likes}).eq('id',pid)}}else{await sb.from('post_likes').insert({post_id:pid,user_id:me.id});const p=posts.find(function(x){return x.id===pid});if(p){p.likes=(p.likes||0)+1;await sb.from('posts').update({likes:p.likes}).eq('id',pid)}}renderFeed()}
async function toggleCmts(pid){const s=document.querySelector('.cmts[data-slot="'+pid+'"]');if(!s)return;if(s.style.display!=='none'){s.style.display='none';s.innerHTML='';return}s.style.display='block';s.innerHTML='<div style="background:var(--p2);border-radius:10px;padding:8px;margin-top:8px"><div style="text-align:center;color:var(--t2);padding:20px;font-size:13px">Загрузка...</div></div>';await loadCmts(pid,s)}
async function loadCmts(pid,s){
  const r=await sb.from('post_comments').select('*').eq('post_id',pid).order('created_at',{ascending:true});
  if(r.error)return;
  const cs=r.data;
  const uids=[...new Set((cs||[]).map(function(c){return c.user_id}))].filter(function(id){return !profiles[id]});
  if(uids.length){const rp=await sb.from('profiles').select('*').in('id',uids);(rp.data||[]).forEach(function(p){profiles[p.id]=p})}
  let h='<div style="background:var(--p2);border-radius:10px;padding:8px;margin-top:8px">';
  if(!cs||!cs.length)h+='<div style="text-align:center;color:var(--t2);padding:16px;font-size:12.5px">Комментариев нет</div>';
  else cs.forEach(function(c){
    const u=profiles[c.user_id];if(!u)return;
    const im=c.user_id===me.id;
    h+='<div style="display:flex;gap:8px;padding:6px 0"><div style="width:30px;height:30px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden;flex-shrink:0;cursor:pointer" onclick="showUP(\''+u.id+'\')">'+(u.avatar_url?'<img src="'+u.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc(u.display_name[0].toUpperCase()))+'</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--a)">'+esc(u.display_name)+' '+bd(u)+'</div><div style="font-size:13px;word-wrap:break-word;white-space:pre-wrap">'+esc(c.text)+'</div><div style="font-size:10px;color:var(--t2);margin-top:2px">'+rt(c.created_at)+'</div></div>'+(im?'<div style="color:var(--t2);font-size:14px;cursor:pointer" onclick="delCmt(\''+c.id+'\',\''+pid+'\')">🗑</div>':'')+'</div>';
  });
  h+='</div>';
  const ma=myP&&myP.avatar_url?'<img src="'+myP.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc((myP?.display_name||'?')[0].toUpperCase());
  h+='<div style="display:flex;gap:6px;margin-top:8px"><div style="width:30px;height:30px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden;flex-shrink:0">'+ma+'</div><input id="cmi_'+pid+'" placeholder="Комментарий..." style="flex:1;padding:8px 14px;border-radius:16px;background:var(--p);color:var(--t);font-size:13px" onkeydown="if(event.key===\'Enter\')sendCmt(\''+pid+'\')"><button style="padding:8px 14px;border-radius:16px;background:var(--ab);color:#fff;font-size:13px" onclick="sendCmt(\''+pid+'\')">➤</button></div>';
  s.innerHTML=h;
}
window.sendCmt=async function(pid){const i=$('cmi_'+pid);const t=i&&i.value.trim();if(!t)return;i.value='';i.disabled=true;const r=await sb.from('post_comments').insert({post_id:pid,user_id:me.id,text:t});i.disabled=false;if(r.error){tst(r.error.message);i.value=t;return}const c=document.querySelector('.po[data-pid="'+pid+'"]');if(c){const x=c.querySelector('.cc');if(x)x.textContent=(parseInt(x.textContent)||0)+1}const s=document.querySelector('.cmts[data-slot="'+pid+'"]');if(s)await loadCmts(pid,s);tst('OK')};
window.delCmt=async function(cid,pid){if(!confirm('Удалить?'))return;await sb.from('post_comments').delete().eq('id',cid);const s=document.querySelector('.cmts[data-slot="'+pid+'"]');if(s)await loadCmts(pid,s);tst('OK')};
window.openPost=function(){$('postT').value='';$('postM').classList.add('show')};
let postImg=null;
$('bPostImg').onclick=function(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=async function(e){const f=e.target.files[0];if(!f)return;const p=me.id+'/post_'+Date.now()+'.jpg';const r=await sb.storage.from('media').upload(p,f);if(r.error)return alert(r.error.message);const ru=sb.storage.from('media').getPublicUrl(p);postImg=ru.data.publicUrl;$('postImgPrev').innerHTML='<img src="'+postImg+'" style="border-radius:12px;max-height:200px;width:100%">'};i.click()};
$('bPubP').onclick=async function(){const t=$('postT').value.trim();if(!t&&!postImg)return alert('Напиши');if(t&&BAD.test(t)&&!myP?.age_verified&&myP?.role!=='creator'&&myP?.role!=='admin')return alert('Мат запрещён');const r=await sb.from('posts').insert({author_id:me.id,text:t,media_url:postImg});if(r.error)return alert(r.error.message);tst('OK');$('postM').classList.remove('show');postImg=null;feedLoaded=false;await loadFeed();feedLoaded=true};

async function loadBots(){try{const r=await sb.from('bots').select('*').eq('is_active',true);bots=r.data||[]}catch(e){bots=[]}}
$('bBot').onclick=function(){const l=$('botL');l.innerHTML='';if(!bots.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:20px;font-size:13px">Нет ботов</div>'}else bots.forEach(function(b){const d=el('div',{style:'background:var(--p2);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center'});d.innerHTML='<div style="width:44px;height:44px;background:var(--bl);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px">🤖</div><div style="flex:1"><div style="font-weight:600;font-size:14px">'+esc(b.name)+'</div><div style="font-size:11px;color:var(--t2)">@'+esc(b.username)+'</div></div>';l.appendChild(d)});$('botM').classList.add('show')};
$('bCrBot').onclick=async function(){if(!myP?.is_plus)return alert('Plus');const n=prompt('Имя:');if(!n)return;const u=prompt('@username:').toLowerCase().replace(/[^a-z0-9_]/g,'');if(!u)return;const r=await sb.from('bots').insert({owner_id:me.id,username:u,name:n,is_active:true});if(r.error)return alert(r.error.message);tst('OK');await loadBots()};
const WAPPS=[{n:'Погода',u:'https://wttr.in/',i:'☀️'},{n:'Вики',u:'https://ru.m.wikipedia.org',i:'📚'},{n:'Музыка',u:'https://music.yandex.ru',i:'🎵'},{n:'Игры',u:'https://poki.com/ru',i:'🎮'},{n:'Карты',u:'https://www.openstreetmap.org',i:'🗺️'},{n:'Курсы',u:'https://www.cbr.ru',i:'💵'}];
$('bApp').onclick=function(){const g=$('appG');g.innerHTML='';WAPPS.forEach(function(a){const d=el('div',{style:'background:var(--p2);border-radius:14px;padding:14px;text-align:center;cursor:pointer'});d.innerHTML='<div style="font-size:36px">'+a.i+'</div><div style="font-size:13px;font-weight:600;margin-top:6px">'+a.n+'</div>';d.onclick=function(){window.open(a.u,'_blank')};g.appendChild(d)});$('appM').classList.add('show')};

$('bPriv').onclick=function(){$('cbHL').checked=myP.hide_last_seen||false;$('cbHP').checked=myP.hide_phone||false;$('cbHA').checked=myP.hide_avatar||false;$('setM').classList.remove('show');$('privM').classList.add('show')};
$('bSavePriv').onclick=async function(){const u={hide_last_seen:$('cbHL').checked,hide_phone:$('cbHP').checked,hide_avatar:$('cbHA').checked};await sb.from('profiles').update(u).eq('id',me.id);Object.assign(myP,u);tst('OK');$('privM').classList.remove('show')};
$('bSess').onclick=function(){$('setM').classList.remove('show');showDevices()};

function initSidebar(){
  if(!document.getElementById('sidebar')){const s=document.createElement('div');s.id='sidebar';document.body.appendChild(s)}
  if(!document.getElementById('sidebarOverlay')){const o=document.createElement('div');o.id='sidebarOverlay';o.onclick=function(){closeSidebar()};document.body.appendChild(o)}
  let startX=0,startY=0,tracking=false;
  document.addEventListener('touchstart',function(e){if(aC)return;const t=e.touches[0];if(t.clientX<40){startX=t.clientX;startY=t.clientY;tracking=true}},{passive:true});
  document.addEventListener('touchmove',function(e){if(!tracking)return;const t=e.touches[0];const dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dy)>Math.abs(dx)){tracking=false;return}if(dx>60){openSidebar();tracking=false}},{passive:true});
  document.addEventListener('touchend',function(){tracking=false},{passive:true});
}
window.initSidebar=initSidebar;

function buildSidebar(){
  const s=$('sidebar');if(!s)return;
  const btn=function(icon,label,onclick,color){
    const b=document.createElement('button');
    b.style.cssText='display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;border-radius:14px;background:'+(color||'var(--p2)')+';color:var(--t);font-size:15px;font-weight:600;border:none;cursor:pointer;margin-bottom:8px;text-align:left';
    b.innerHTML='<span style="font-size:22px">'+icon+'</span><span>'+label+'</span>';
    b.onclick=function(){closeSidebar();setTimeout(onclick,200)};
    return b;
  };
  const grp=function(title){
    const t=document.createElement('div');
    t.style.cssText='font-size:11px;color:var(--a);text-transform:uppercase;font-weight:700;padding:10px 18px 6px';
    t.textContent=title;return t;
  };
  s.innerHTML='';
  const head=document.createElement('div');
  head.style.cssText='display:flex;align-items:center;gap:12px;padding:20px 18px;border-bottom:1px solid var(--b);margin-bottom:14px';
  const av=document.createElement('div');
  av.style.cssText='width:48px;height:48px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;overflow:hidden';
  av.innerHTML=myP&&myP.avatar_url?'<img src="'+myP.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc((myP?.display_name||'?')[0].toUpperCase());
  const info=document.createElement('div');
  info.innerHTML='<div style="font-weight:700;font-size:15px">'+esc(myP?.display_name||'?')+'</div><div style="font-size:12px;color:var(--t2)">@'+esc(myP?.username||'?')+'</div>';
  head.appendChild(av);head.appendChild(info);s.appendChild(head);
  s.appendChild(grp('Главное'));
  s.appendChild(btn('👤','Профиль',function(){showProf()}));
  s.appendChild(btn('💬','Чаты',function(){$('SD').classList.remove('h');$('fdScr').classList.remove('show')}));
  s.appendChild(btn('📰','Лента',function(){$('SD').classList.add('h');$('fdScr').classList.add('show');$('fcBtn').style.display='flex';if(!feedLoaded){loadFeed();feedLoaded=true}}));
  s.appendChild(btn('👥','Друзья',function(){$('bFriends').click()}));
  s.appendChild(btn('📌','Избранное',function(){$('bSaved').click()}));
  s.appendChild(grp('Медиа'));
  s.appendChild(btn('🎨','Мои стикеры',function(){$('bStickers').click()}));
  s.appendChild(btn('🎨','Косметика',function(){openCosmetics()},'linear-gradient(135deg,#ff6bcb,#9c27b0)'));
  s.appendChild(btn('👀','Кто смотрел',function(){showProfileViews()},'linear-gradient(135deg,#4a9eff,#7c3aed)'));
  s.appendChild(btn('📊','Аналитика',function(){showAnalytics()},'linear-gradient(135deg,#f39c12,#e67e22)'));
  s.appendChild(btn('🤖','Боты',function(){$('bBot').click()}));
  s.appendChild(btn('🛒','Магазин',function(){$('bShop').click()},'linear-gradient(135deg,#10b981,#059669)'));
  s.appendChild(btn('📱','Приложения',function(){$('bApp').click()}));
  s.appendChild(grp('Ещё'));
  s.appendChild(btn('✅','Верификация',function(){$('bVer').click()}));
  s.appendChild(btn('🎁','Промокоды',function(){closeSidebar();setTimeout(function(){$('promoI').value='';$('promoS').textContent='';$('promoM').classList.add('show')},200)},'linear-gradient(135deg,#e91e63,#9c27b0)'));
  s.appendChild(btn('🧩','Моды',function(){$('bMods').click()}));
  s.appendChild(btn('⚙️','Настройки',function(){$('bSet').click()}));
  if(isAdmin){s.appendChild(grp('Админ'));s.appendChild(btn('🔐','Админ-панель',function(){openAdm()},'linear-gradient(135deg,#ffd700,#ff9500)'))}
  s.appendChild(grp('Аккаунт'));
  s.appendChild(btn('🚪','Выйти',function(){if(confirm('Выйти?')){sb.auth.signOut();localStorage.removeItem('spacegram-auth');location.reload()}},'#e74c3c'));
}
window.buildSidebar=buildSidebar;
function openSidebar(){buildSidebar();const s=$('sidebar'),o=$('sidebarOverlay');if(s)s.style.transform='translateX(0)';if(o){o.style.display='block';setTimeout(function(){o.style.opacity='1'},10)}}
window.openSidebar=openSidebar;
function closeSidebar(){const s=$('sidebar'),o=$('sidebarOverlay');if(s)s.style.transform='translateX(-100%)';if(o){o.style.opacity='0';setTimeout(function(){o.style.display='none'},250)}}
window.closeSidebar=closeSidebar;

async function loadChats(){
  try{
    const r=await sb.from('chats').select('*').or('user1.eq.'+me.id+',user2.eq.'+me.id).order('created_at',{ascending:false}).limit(60);
    chats=r.data||[];
    const seen=new Set();
    chats=chats.filter(function(c){if(c.is_group||c.is_channel)return true;const k=[c.user1,c.user2].sort().join('_');if(seen.has(k))return false;seen.add(k);return true});
    const p=JSON.parse(localStorage.getItem('sg_pins')||'[]');
    chats.sort(function(a,b){const ap=p.indexOf(a.id),bp=p.indexOf(b.id);if(ap>=0&&bp<0)return-1;if(ap<0&&bp>=0)return 1;return 0});
    const ids=chats.filter(function(c){return !c.is_group&&!c.is_channel}).map(function(c){return c.user1===me.id?c.user2:c.user1}).filter(function(id){return !profiles[id]});
    if(ids.length){const rp=await sb.from('profiles').select('*').in('id',ids);(rp.data||[]).forEach(function(p){profiles[p.id]=p})}
    unread={};
    if(chats.length){const rm=await sb.from('messages').select('chat_id').in('chat_id',chats.map(function(c){return c.id})).eq('is_read',false).neq('sender',me.id);(rm.data||[]).forEach(function(m){unread[m.chat_id]=(unread[m.chat_id]||0)+1})}
    renderChats();
    updateTitleBadge();
  }catch(e){console.error(e)}
}

function renderChats(){
  const b=$('chats');b.innerHTML='';
  const block=myP?.blocked_users||[],pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');
  if(!chats.length){b.innerHTML='<div style="padding:30px;color:var(--t2);text-align:center;font-size:13px">Нет чатов</div>';return}
  chats.forEach(function(c){
    const isG=c.is_group||c.is_channel;const oid=c.user1===me.id?c.user2:c.user1;
    if(!isG&&block.includes(oid))return;
    const p=isG?{display_name:c.group_name||'Группа',avatar_url:c.group_avatar,is_official:c.is_official}:profiles[oid];
    if(!p)return;
    const on=p.last_seen&&(Date.now()-new Date(p.last_seen).getTime())<90000&&!p.hide_last_seen;
    const cnt=unread[c.id]||0;const isPin=pins.includes(c.id);
    const i=el('div',{class:'ch'+(c.id===aC?' a':'')});
    i.dataset.cid=c.id;
    let lt=null;
    i.addEventListener('touchstart',function(){lt=setTimeout(function(){lt=null;chatContextMenu(c,p);if(navigator.vibrate)navigator.vibrate(30)},600)},{passive:true});
    i.addEventListener('touchend',function(){if(lt){clearTimeout(lt);lt=null}},{passive:true});
    i.addEventListener('touchmove',function(){if(lt){clearTimeout(lt);lt=null}},{passive:true});
    i.onclick=function(){openChat(c.id,oid,c)};
    i.innerHTML=(isPin?'<span class="pin-ico">📌</span>':'')+'<div class="cv">'+(p.avatar_url&&!p.hide_avatar?'<img src="'+p.avatar_url+'" loading="lazy">':esc((p.display_name||'?')[0].toUpperCase()))+(on&&!isG?'<div style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;background:var(--g);border-radius:50%;border:2.5px solid var(--p)"></div>':'')+'</div><div class="ci"><div class="cn" style="'+(p.name_color?'color:'+p.name_color:'')+'">'+esc(p.display_name)+' '+bd(p,isG)+(c.is_secret?' 🔒':'')+'</div><div class="cp">'+esc(c.last_message||'Начни общение')+'</div></div><div class="ct">'+(c.created_at?ft(c.created_at):'')+(cnt?'<div class="ur">'+(cnt>99?'99+':cnt)+'</div>':'')+'</div>';
    b.appendChild(i);
  });
}
function chatContextMenu(c,p){
  const pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');
  const isPin=pins.includes(c.id);
  const oid=c.user1===me.id?c.user2:c.user1;
  let h='<h2>'+(p.avatar_url?'<img src="'+p.avatar_url+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover">':'')+' '+esc(p.display_name)+'</h2>';
  if(!c.is_group&&!c.is_channel&&oid!==me.id){
    h+='<button onclick="startCall(\''+oid+'\',\'audio\')" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700">📞 Позвонить</button>';
    h+='<button onclick="startCall(\''+oid+'\',\'video\')" style="background:linear-gradient(135deg,#4a9eff,#2b7fff);color:#fff;font-weight:700">📹 Видеозвонок</button>';
  }
  h+='<button onclick="chatAct(\'pin\',\''+c.id+'\')" style="background:var(--p2);color:var(--t)">'+(isPin?'Открепить':'Закрепить')+'</button>';
  h+='<button onclick="chatAct(\'read\',\''+c.id+'\')" style="background:var(--p2);color:var(--t)">Прочитано</button>';
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\');setTimeout(function(){openChatGallery()},300)" style="background:var(--p2);color:var(--t)">🖼️ Галерея</button>';
  if(isAdmin)h+='<button onclick="chatAct(\'stalk\',\''+c.id+'\',\''+oid+'\')" style="background:var(--bl);color:#fff">Связи</button>';
  h+='<button onclick="chatAct(\'clear\',\''+c.id+'\')" style="background:var(--p2);color:var(--t)">Очистить</button>';
  h+='<button onclick="chatAct(\'del\',\''+c.id+'\')" class="dg">Удалить</button>';
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="background:var(--p2);color:var(--t);margin-top:8px">Отмена</button>';
  $('bmc').innerHTML=h;$('bm').classList.add('show');
}
window.chatAct=async function(a,cid,oid){
  $('bm').classList.remove('show');
  const pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');
  if(a==='pin'){const i=pins.indexOf(cid);if(i>=0)pins.splice(i,1);else pins.push(cid);localStorage.setItem('sg_pins',JSON.stringify(pins));tst(i>=0?'Откреплено':'Закреплено');loadChats()}
  else if(a==='read'){await sb.from('messages').update({is_read:true}).eq('chat_id',cid).neq('sender',me.id).eq('is_read',false);tst('OK');loadChats()}
  else if(a==='stalk'){openStalker(oid)}
  else if(a==='clear'){if(!confirm('Очистить?'))return;await sb.from('messages').delete().eq('chat_id',cid);tst('OK');loadChats();if(aC===cid)loadMsgs()}
  else if(a==='del'){if(!confirm('Удалить?'))return;await sb.from('messages').delete().eq('chat_id',cid);await sb.from('chats').delete().eq('id',cid);tst('OK');if(aC===cid)back();loadChats()}
};

function subscribeChats(){
  if(chSub)sb.removeChannel(chSub);
  chSub=sb.channel('chats-s').on('postgres_changes',{event:'*',schema:'public',table:'chats'},function(){loadChats()}).subscribe();
  if(gSub)sb.removeChannel(gSub);
  gSub=sb.channel('g-msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async function(p){
    if(p.new.sender===me.id)return;
    if(p.new.text&&p.new.text.indexOf('[CALL:')===0){handleCallSignal(p.new);return}
    const c=chats.find(function(x){return x.id===p.new.chat_id});if(!c)return;
    const fromMe=aC===p.new.chat_id;
    if(fromMe){notif('msg');return}
    unread[p.new.chat_id]=(unread[p.new.chat_id]||0)+1;
    renderChats();updateTitleBadge();
    const txt=p.new.text||'';
    const isMention=myP&&myP.username&&new RegExp('@'+myP.username,'i').test(txt);
    notif(isMention?'mention':'msg');
    const sender=await getP(p.new.sender);
    const title=sender?sender.display_name:'Spacegram';
    showPush(title,(txt||'файл').slice(0,80),p.new.chat_id);
    if(settings.preview&&!isMention)tst(title+': '+(txt||'файл').slice(0,40));
    else if(isMention)tst(title+' упомянул!');
    botReply(p.new);
  }).subscribe();
}
$('srch').oninput=db(async function(e){
  const v=e.target.value.trim();
  if(!v||v.length<2){renderChats();return}
  try{
    const b=$('chats');b.innerHTML='';
    const rf=await sb.from('messages').select('chat_id,text,sender,created_at').ilike('text','%'+v+'%').order('created_at',{ascending:false}).limit(50);
    const foundMsgs=rf.data;
    if(foundMsgs&&foundMsgs.length){
      b.innerHTML='<div style="padding:10px 12px;font-size:11px;color:var(--a);text-transform:uppercase;font-weight:700">Найдено</div>';
      const chatIds=[...new Set(foundMsgs.map(function(m){return m.chat_id}))];
      const rc=await sb.from('chats').select('*').in('id',chatIds);
      const cmap={};(rc.data||[]).forEach(function(c){cmap[c.id]=c});
      for(const m of foundMsgs.slice(0,20)){
        const c=cmap[m.chat_id];if(!c)continue;
        const otherId=c.user1===me.id?c.user2:c.user1;
        const p=c.is_group||c.is_channel?{display_name:c.group_name||'Группа'}:profiles[otherId]||await getP(otherId);
        if(!p)continue;
        const i=el('div',{class:'ch'});
        i.onclick=function(){openChat(c.id,otherId,c)};
        i.innerHTML='<div class="cv">'+(p.avatar_url?'<img src="'+p.avatar_url+'">':esc((p.display_name||'?')[0].toUpperCase()))+'</div><div class="ci"><div class="cn">'+esc(p.display_name)+'</div><div class="cp">'+esc(m.text.slice(0,60))+'</div></div>';
        b.appendChild(i);
      }
    }
    const vlow=v.toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(vlow.length>=2){
      const ru=await sb.from('profiles').select('*').eq('username',vlow).limit(10);
      if(ru.data&&ru.data.length){
        b.innerHTML+='<div style="padding:10px 12px;font-size:11px;color:var(--a);text-transform:uppercase;font-weight:700">Пользователи</div>';
        ru.data.forEach(function(u){if(u.id===me.id)return;profiles[u.id]=u;const i=el('div',{class:'ch'});i.onclick=function(){startChat(u.id)};i.innerHTML='<div class="cv">'+(u.avatar_url?'<img src="'+u.avatar_url+'">':esc((u.display_name||'?')[0].toUpperCase()))+'</div><div class="ci"><div class="cn">'+esc(u.display_name)+' '+bd(u)+'</div><div class="cp">@'+esc(u.username)+'</div></div>';b.appendChild(i)});
      }
    }
    if(!b.innerHTML)b.innerHTML='<div style="padding:20px;color:var(--t2);text-align:center">Ничего</div>';
  }catch(e){console.error(e)}
},400);

async function startChat(oid){
  const u1=me.id<oid?me.id:oid;const u2=me.id<oid?oid:me.id;
  const re=await sb.from('chats').select('id').or('and(user1.eq.'+u1+',user2.eq.'+u2+'),and(user1.eq.'+u2+',user2.eq.'+u1+')').limit(1);
  let cid;
  if(re.data&&re.data.length)cid=re.data[0].id;
  else{const rn=await sb.from('chats').insert({user1:u1,user2:u2,created_by:me.id}).select().single();if(rn.error)return alert(rn.error.message);cid=rn.data.id}
  $('srch').value='';await loadChats();openChat(cid,oid);
}
window.startChat=startChat;

async function openChat(cid,oid,co){
  $('bnv').classList.add('h');
  aC=cid;aO=oid;aCO=co||chats.find(function(c){return c.id===cid});
  if(!aCO){const rc=await sb.from('chats').select('*').eq('id',cid).single();aCO=rc.data}
  $('AR').classList.add('open');
  $('CH').style.display='flex';$('msgs').style.display='flex';$('inp').style.display='flex';$('emp').style.display='none';
  $('msgs').style.background=myP.chat_wallpaper||'';
  const isG=aCO.is_group||aCO.is_channel;let p;
  if(isG){$('hN').innerHTML=esc(aCO.group_name||'Группа')+' '+bd(aCO,true)+(aCO.is_secret?' 🔒':'');$('hS').textContent=aCO.is_channel?'канал':'группа';$('hA').innerHTML=aCO.group_avatar?'<img src="'+aCO.group_avatar+'">':'👥'}
  else{p=await getP(oid);$('hN').innerHTML=esc(p?.display_name||'?')+' '+bd(p||{})+(aCO.is_secret?' 🔒':'');const on=p&&p.last_seen&&(Date.now()-new Date(p.last_seen).getTime())<90000&&!p.hide_last_seen;$('hS').textContent=on?'в сети':'был(а) недавно';$('hA').innerHTML=p&&p.avatar_url&&!p.hide_avatar?'<img src="'+p.avatar_url+'">':esc((p?.display_name||'?')[0].toUpperCase())}
  delete unread[cid];renderChats();updateTitleBadge();
  await loadMsgs();subscribeMsgs();startPoll();
  if(autoReadTimer)clearTimeout(autoReadTimer);
  autoReadTimer=setTimeout(function(){markRead()},2000);
  $('msgs').addEventListener('scroll',onMsgsScroll);
  const d=loadDraft(cid);if(d&&$('msgI'))$('msgI').value=d;
  startTypingWatcher();
  setTimeout(function(){renderPinned()},300);
}
window.openChat=openChat;
async function markRead(){if(!aC)return;try{await sb.from('messages').update({is_read:true}).eq('chat_id',aC).neq('sender',me.id).eq('is_read',false)}catch(e){}delete unread[aC];updateTitleBadge();renderChats()}
function onMsgsScroll(){const b=$('msgs');if(!b)return;const nearBottom=b.scrollHeight-b.scrollTop-b.clientHeight<60;let btn=$('scrollDownBtn');if(!btn){btn=document.createElement('button');btn.id='scrollDownBtn';btn.style.cssText='position:absolute;right:14px;bottom:14px;width:42px;height:42px;border-radius:50%;background:var(--ab);color:#fff;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,.4);display:none;z-index:50;border:none;cursor:pointer;align-items:center;justify-content:center';btn.innerHTML='↓';btn.onclick=function(){b.scrollTop=b.scrollHeight;btn.style.display='none'};const wrap=$('msgs').parentNode;if(wrap)wrap.appendChild(btn)}if(!nearBottom&&msgs.length>3)btn.style.display='flex';else btn.style.display='none'}

function renderPinned(){
  const oldPin=document.querySelector('.pinnedBar');if(oldPin)oldPin.remove();
  if(!aCO||!aCO.pinned_message_id)return;
  const pm=msgs.find(function(m){return m.id===aCO.pinned_message_id});if(!pm)return;
  const bar=el('div',{class:'pinnedBar',style:'padding:8px 12px;background:var(--p2);border-bottom:1px solid var(--b);display:flex;gap:10px;align-items:center;font-size:12px;cursor:pointer'});
  bar.onclick=function(){const el2=document.querySelector('.mw[data-mid="'+pm.id+'"]');if(el2){el2.scrollIntoView({block:'center',behavior:'smooth'});el2.style.background='rgba(100,181,239,.15)';setTimeout(function(){el2.style.background=''},1500)}};
  bar.innerHTML='<div style="font-size:18px">📌</div><div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--a)">Закреплено</div><div style="color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc((pm.text||'файл').slice(0,60))+'</div></div>';
  const inp=$('inp');if(inp&&inp.parentNode)inp.parentNode.insertBefore(bar,inp);
}
window.renderPinned=renderPinned;

async function loadMsgs(){
  const r=await sb.from('messages').select('*').eq('chat_id',aC).order('created_at',{ascending:true}).limit(200);
  msgs=r.data||[];
  const ids=msgs.map(function(m){return m.id});reactions=[];polls={};
  if(ids.length){
    const rr=await Promise.all([sb.from('reactions').select('*').in('message_id',ids),sb.from('polls').select('*').in('message_id',ids)]);
    reactions=rr[0].data||[];(rr[1].data||[]).forEach(function(p){polls[p.message_id]=p});
  }
  renderMsgs();
  if(settings.readReceipts&&!myP?.ghost_mode)sb.from('messages').update({is_read:true}).eq('chat_id',aC).neq('sender',me.id).eq('is_read',false).then(function(){});
}
function startPoll(){stopPoll();pollI=setInterval(async function(){if(!aC||document.hidden||isPolling)return;isPolling=true;try{const r=await sb.from('messages').select('id,text,is_read,deleted,file_url,created_at').eq('chat_id',aC).order('created_at',{ascending:true}).limit(100);if(!r.data)return;const oldSig=msgs.map(function(m){return m.id}).join(',');const newSig=r.data.map(function(m){return m.id}).join(',');if(oldSig!==newSig)await loadMsgs()}catch(e){}finally{isPolling=false}},1500)}
function stopPoll(){if(pollI){clearInterval(pollI);pollI=null}isPolling=false}
function renderMsgs(){
  const b=$('msgs');b.innerHTML='';
  let ld='';
  msgs.forEach(function(m,idx){
    if(m.text&&m.text.indexOf('[CALL:')===0)return;
    const d=new Date(m.created_at).toDateString();
    if(d!==ld){b.appendChild(el('div',{style:'align-self:center;padding:4px 12px;background:rgba(0,0,0,.3);color:#fff;border-radius:14px;font-size:11.5px;margin:10px 0 6px',text:fd(new Date(m.created_at))}));ld=d}
    const node=buildMsg(m);
    if(settings.animations&&idx>=msgs.length-5){node.style.opacity='0';node.style.transition='opacity .25s';setTimeout(function(){node.style.opacity='1'},20)}
    b.appendChild(node);
  });
  b.scrollTop=b.scrollHeight;
  setTimeout(function(){renderPinned()},50);
}

function buildMsg(m){
  const im=m.sender===me.id;
  const w=el('div',{class:'mw '+(im?'me':'you')});w.dataset.mid=m.id;
  let sx=0,sy=0,swiping=false;
  w.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;swiping=false},{passive:true});
  w.addEventListener('touchmove',function(e){if(!sx)return;const dx=e.touches[0].clientX-sx;const dy=e.touches[0].clientY-sy;if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>20){swiping=true;if(dx>0&&dx<100)w.style.transform='translateX('+dx+'px)'}},{passive:true});
  w.addEventListener('touchend',function(e){if(!sx)return;const dx=(e.changedTouches[0].clientX)-sx;w.style.transform='';if(swiping&&dx>60){startRep(m)}sx=0;sy=0;swiping=false},{passive:true});
  const d=el('div',{class:'m '+(im?'me':'you')+(m.deleted?' del':'')});
  let h='';
  if(m.burn_after)h+='<div style="font-size:10px;color:#ff7b7b;margin-bottom:3px;font-weight:700;width:100%">'+m.burn_after+'с</div>';
  if(m.forwarded_from)h+='<div class="fw">Переслано</div>';
  if(m.reply_to){const rm=msgs.find(function(x){return x.id===m.reply_to});if(rm){const rp=profiles[rm.sender];h+='<div class="rp"><div class="ra">'+esc(rm.sender===me.id?'Ты':(rp?.display_name||'?'))+'</div>'+esc((rm.text||'файл').slice(0,50))+'</div>'}}
  let b='';
  if(m.deleted)b='<i>Удалено</i>';
  else if(m.is_sticker&&m.file_url){d.className='m stk';b='<img src="'+m.file_url+'" loading="lazy">'}
  else if(m.is_voice&&m.file_url){b='<audio controls preload="none"><source src="'+m.file_url+'"></audio><div class="speed-btns"><button data-sp="1" class="on">1x</button><button data-sp="1.5">1.5x</button><button data-sp="2">2x</button></div>'}
  else if(m.is_video_note&&m.file_url)b='<div style="width:180px;height:180px;border-radius:50%;overflow:hidden"><video src="'+m.file_url+'" controls playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"></video></div>';
  else if(m.is_img_grid&&m.file_url)b='<div class="img-grid">'+(m.file_url||'').split('||').map(function(u){return '<img src="'+u+'" onclick="viewImg(\''+u+'\')">'}).join('')+'</div>';
  else if(m.file_url){
    if(m.file_type&&m.file_type.indexOf('image')===0)b+='<img class="im" src="'+m.file_url+'" loading="lazy" onclick="viewImg(\''+m.file_url+'\')">';
    else if(m.file_type&&m.file_type.indexOf('video')===0)b+='<video controls preload="metadata" src="'+m.file_url+'"></video>';
    else b+='<div style="display:flex;align-items:center;gap:10px">📎 <div style="flex:1"><div style="font-size:12px;font-weight:600">'+esc(m.file_name||'файл')+'</div></div><a href="'+m.file_url+'" target="_blank" style="color:var(--a)">⬇</a></div>';
  }
  else if(polls[m.id])b+=renderPoll(polls[m.id]);
  else{let txt=esc(m.text||'');txt=txt.replace(/@([a-z0-9_]+)/gi,'<span class="mn">@$1</span>');txt=txt.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" style="color:var(--a);text-decoration:underline">$1</a>');b+=txt}
  const ch=im?'<span class="chk '+(m.is_read?'rd':'')+'">'+(m.is_read?'✓✓':'✓')+'</span>':'';
  if(m.is_sticker)d.innerHTML=b;
  else d.innerHTML=h+'<div class="tx">'+b+'</div><div class="tm">'+ft(m.created_at)+ch+'</div>';
  w.appendChild(d);
  d.querySelectorAll('.speed-btns button').forEach(function(btn){btn.onclick=function(ev){ev.stopPropagation();const sp=parseFloat(btn.dataset.sp);const au=d.querySelector('audio');if(au){au.playbackRate=sp;d.querySelectorAll('.speed-btns button').forEach(function(x){x.classList.remove('on')});btn.classList.add('on')}}});
  const rx=reactions.filter(function(r){return r.message_id===m.id});
  const gr={};rx.forEach(function(r){(gr[r.emoji]=gr[r.emoji]||[]).push(r.user_id)});
  if(Object.keys(gr).length){const rb=el('div',{class:'rxs'});Object.entries(gr).forEach(function(e){const emoji=e[0],users=e[1];const rd=el('div',{class:'rx'+(users.includes(me.id)?' mn':''),html:emoji+' '+users.length});rd.onclick=function(ev){ev.stopPropagation();togReact(m.id,emoji)};rb.appendChild(rd)});w.appendChild(rb)}
  const tb=el('div',{class:'tb2'});
  [['👍','r-👍'],['❤️','r-❤️'],['😂','r-😂'],['🔥','r-🔥'],['↩','rp'],['↪','fw'],['📌','pn'],['🚩','rep']].forEach(function(pair){
    const i=pair[0],a=pair[1];
    const b2=el('button',{html:i});
    b2.onclick=function(e){e.stopPropagation();msgAct(a,m,w)};
    tb.appendChild(b2);
  });
  if(im){
    const e1=el('button',{html:'✏️'});e1.onclick=function(e){e.stopPropagation();msgAct('ed',m,w)};
    const e2=el('button',{html:'🗑'});e2.onclick=function(e){e.stopPropagation();msgAct('dl',m,w)};
    tb.appendChild(e1);tb.appendChild(e2);
  }
  w.appendChild(tb);
  d.onclick=function(e){e.stopPropagation();document.querySelectorAll('.mw.tb').forEach(function(x){x.classList.remove('tb')});w.classList.add('tb')};
  d.ondblclick=function(e){e.stopPropagation();togReact(m.id,'❤️')};
  return w;
}
async function msgAct(a,m,w){
  w.classList.remove('tb');
  if(a.indexOf('r-')===0)return togReact(m.id,a.replace('r-',''));
  if(a==='rp')return startRep(m);
  if(a==='fw'){if(aCO&&aCO.is_secret||m.forward_restricted)return tst('Нельзя');return fwdMsg(m)}
  if(a==='pn'){await sb.from('chats').update({pinned_message_id:m.id}).eq('id',aC);aCO.pinned_message_id=m.id;tst('Закреплено');renderPinned();return}
  if(a==='rep'){curRepMsg=m;$('repMsg').value='';$('reportM').classList.add('show');return}
  if(a==='ed'){const n=prompt('Новое:',m.text);if(!n||n===m.text)return;if(BAD.test(n)&&!myP?.age_verified&&myP?.role!=='creator'&&myP?.role!=='admin')return tst('Мат');await sb.from('edit_history').insert({message_id:m.id,old_text:m.text});await sb.from('messages').update({text:n}).eq('id',m.id);await loadMsgs();return}
  if(a==='dl'){
    if(!confirm('Удалить?'))return;
    try{await sb.from('deleted_log').insert({chat_id:aC,sender:m.sender,text:m.text||'',file_url:m.file_url||null,deleted_by:me.id})}catch(e){}
    await sb.from('messages').update({deleted:true,text:'',file_url:null}).eq('id',m.id);
    await loadMsgs();
  }
}
function renderPoll(p){
  const o=Array.isArray(p.options)?p.options:JSON.parse(p.options||'[]');
  let h='<div class="poll" data-pid="'+p.id+'"><div style="font-weight:700;margin-bottom:6px;font-size:14px">📊 '+esc(p.question)+'</div>';
  o.forEach(function(x,i){h+='<div class="po" data-idx="'+i+'" style="padding:7px 11px;background:rgba(255,255,255,.08);border-radius:7px;margin-bottom:4px;position:relative;overflow:hidden;font-size:13px;cursor:pointer"><div class="pb" style="position:absolute;inset:0;background:rgba(100,181,239,.22);width:0%"></div><span style="position:relative">'+esc(x)+' <span class="pc" style="float:right;color:var(--t2);font-size:12px;font-weight:600"></span></span></div>'});
  h+='</div>';setTimeout(function(){updPoll(p.id)},100);return h;
}
async function updPoll(pid){
  const e=document.querySelector('.poll[data-pid="'+pid+'"]');if(!e)return;
  const rv=await sb.from('poll_votes').select('*').eq('poll_id',pid);
  const v=rv.data;const t=(v?v.length:0)||1;
  e.querySelectorAll('.po').forEach(function(po,i){
    const c=(v||[]).filter(function(x){return x.option_index===i}).length;
    po.querySelector('.pb').style.width=(c/t*100)+'%';
    po.querySelector('.pc').textContent=c;
  });
}
document.addEventListener('click',async function(e){
  const po=e.target.closest('.po');
  if(!po||!po.closest('.poll'))return;
  const pid=po.closest('.poll').dataset.pid,idx=parseInt(po.dataset.idx);
  const rex=await sb.from('poll_votes').select('id').eq('poll_id',pid).eq('user_id',me.id).eq('option_index',idx).maybeSingle();
  if(rex.data)await sb.from('poll_votes').delete().eq('id',rex.data.id);
  else await sb.from('poll_votes').insert({poll_id:pid,user_id:me.id,option_index:idx});
  updPoll(pid);
});
async function togReact(mid,e){
  const ex=reactions.find(function(r){return r.message_id===mid&&r.user_id===me.id&&r.emoji===e});
  if(ex)await sb.from('reactions').delete().eq('id',ex.id);
  else await sb.from('reactions').insert({message_id:mid,user_id:me.id,emoji:e});
  const ids=msgs.map(function(m){return m.id});
  const rr=await sb.from('reactions').select('*').in('message_id',ids);
  reactions=rr.data||[];renderMsgs();
}
function startRep(m){replyTo=m;const p=profiles[m.sender];$('rA').textContent=m.sender===me.id?'Ты':(p?.display_name||'?');$('rT').textContent=(m.text||'файл').slice(0,50);$('rP').classList.add('on');$('msgI').focus()}
window.cancelRep=function(){replyTo=null;$('rP').classList.remove('on')};
async function fwdMsg(m){
  const r=await sb.from('chats').select('id,user1,user2,is_group,is_channel,group_name').or('user1.eq.'+me.id+',user2.eq.'+me.id).limit(30);
  const data=r.data;if(!data||!data.length)return alert('Нет чатов');
  const n=[];
  for(let i=0;i<data.length;i++){const c=data[i];let nm;if(c.is_group||c.is_channel)nm=c.group_name||'Группа';else{const p=await getP(c.user1===me.id?c.user2:c.user1);nm=p?.display_name||'user'}n.push((i+1)+'. '+nm)}
  const pk=prompt('Куда:\n'+n.join('\n')+'\nНомер:');const idx=parseInt(pk)-1;
  if(isNaN(idx)||!data[idx])return;
  const t=data[idx];
  await sb.from('messages').insert({chat_id:t.id,sender:me.id,text:m.text||'',is_read:false,file_url:m.file_url,file_type:m.file_type,file_name:m.file_name,is_sticker:m.is_sticker,forwarded_from:m.sender,forward_restricted:true});
  await sb.from('chats').update({last_message:'Переслано '+((m.text||'файл').slice(0,40))}).eq('id',t.id);
  tst('OK');
}
function subscribeMsgs(){
  if(mSub)sb.removeChannel(mSub);
  mSub=sb.channel('msgs-'+aC)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'chat_id=eq.'+aC},function(p){
      if(p.new.sender===me.id)return;
      if(msgs.find(function(m){return m.id===p.new.id}))return;
      if(p.new.text&&p.new.text.indexOf('[CALL:')===0){handleCallSignal(p.new);return}
      msgs.push(p.new);
      $('msgs').appendChild(buildMsg(p.new));
      $('msgs').scrollTop=$('msgs').scrollHeight;
      sb.from('messages').update({is_read:true}).eq('id',p.new.id).then(function(){});
      if(p.new.burn_after&&p.new.burn_after>0)setTimeout(async function(){await sb.from('messages').delete().eq('id',p.new.id);loadMsgs()},p.new.burn_after*1000);
      notif('msg');botReply(p.new);
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:'chat_id=eq.'+aC},function(){loadMsgs()})
    .subscribe();
}

async function sendMsg(){
  const t=$('msgI').value.trim();if(!t||!aC)return;
  if(BAD.test(t)&&!myP?.age_verified&&myP?.role!=='creator'&&myP?.role!=='admin'){$('msgI').value='';return tst('Мат запрещён')}
  const rm=await sb.from('profiles').select('muted_until').eq('id',me.id).single();
  const mf=rm.data;
  if(mf&&mf.muted_until&&new Date(mf.muted_until)>new Date())return tst('Вы в муте');
  $('msgI').value='';saveDraft(aC,'');
  const tid='temp_'+(++optId);
  const tm={id:tid,chat_id:aC,sender:me.id,text:t,is_read:false,reply_to:replyTo?.id||null,created_at:new Date().toISOString(),burn_after:burnTime||0};
  msgs.push(tm);
  const te=buildMsg(tm);te.querySelector('.m').style.opacity='0.6';
  $('msgs').appendChild(te);$('msgs').scrollTop=$('msgs').scrollHeight;
  replyTo=null;$('rP').classList.remove('on');
  playSound('sent');
  const r=await sb.from('messages').insert({chat_id:aC,sender:me.id,text:t,is_read:false,reply_to:tm.reply_to,is_secret:aCO?.is_secret||false,burn_after:burnTime||0}).select().single();
  if(r.error){const i=msgs.findIndex(function(m){return m.id===tid});if(i>=0)msgs.splice(i,1);te.remove();alert(r.error.message);return}
  const i=msgs.findIndex(function(m){return m.id===tid});if(i>=0)msgs[i]=r.data;
  te.replaceWith(buildMsg(r.data));
  sb.from('chats').update({last_message:t.slice(0,50)}).eq('id',aC).then(function(){});
  trackRelation(aC,t);
  burnTime=0;document.querySelectorAll('#brnO button').forEach(function(b){b.classList.toggle('on',b.dataset.b==='0')});
}
window.sendMsg=sendMsg;
async function trackRelation(chatId,text){
  try{
    const c=chats.find(function(x){return x.id===chatId});if(!c||c.is_group||c.is_channel)return;
    const oid=c.user1===me.id?c.user2:c.user1;if(!oid||oid===me.id)return;
    const re=await sb.from('user_relations').select('id,messages_count').eq('user_id',me.id).eq('other_id',oid).maybeSingle();
    if(re.data)await sb.from('user_relations').update({messages_count:(re.data.messages_count||0)+1,last_message_at:new Date().toISOString()}).eq('id',re.data.id);
    else await sb.from('user_relations').insert({user_id:me.id,other_id:oid,messages_count:1,last_message_at:new Date().toISOString()});
  }catch(e){}
}
$('bSend').onclick=sendMsg;
$('msgI').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey&&settings.enterSend){e.preventDefault();sendMsg()}};
$('msgI').oninput=function(){sendTyping();if(aC)saveDraft(aC,$('msgI').value)};

$('bPlus').onclick=function(e){e.stopPropagation();const p=$('attP');p.classList.toggle('h');$('stkP').classList.add('h');$('gifP').classList.add('h');$('brnP').classList.add('h');$('ep').classList.remove('show')};
$('ap').onclick=function(){$('attP').classList.add('h');const i=document.createElement('input');i.type='file';i.accept='image/*,video/*';i.multiple=true;i.onchange=async function(e){const files=[...e.target.files];if(!files.length)return;if(files.length===1){const f=files[0];if(f.size>50*1024*1024)return alert('> 50 МБ');const p=aC+'/'+Date.now()+'_'+f.name;const r=await sb.storage.from('media').upload(p,f);if(r.error)return alert(r.error.message);const ru=sb.storage.from('media').getPublicUrl(p);const rr=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,file_url:ru.data.publicUrl,file_type:f.type,file_name:f.name}).select().single();msgs.push(rr.data);$('msgs').appendChild(buildMsg(rr.data));$('msgs').scrollTop=$('msgs').scrollHeight}else{const urls=[];for(const f of files){const p=aC+'/'+Date.now()+'_'+Math.random().toString(36).slice(2)+'_'+f.name;const r=await sb.storage.from('media').upload(p,f);if(r.error)continue;const ru=sb.storage.from('media').getPublicUrl(p);urls.push(ru.data.publicUrl)}const rr=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_img_grid:true,file_url:urls.join('||'),file_type:'grid',file_name:files.length+' фото'}).select().single();msgs.push(rr.data);$('msgs').appendChild(buildMsg(rr.data));$('msgs').scrollTop=$('msgs').scrollHeight}sb.from('chats').update({last_message:files.length+' фото'}).eq('id',aC).then(function(){})};i.click()};
$('af').onclick=function(){$('attP').classList.add('h');pickFile('*/*','Файл')};
function pickFile(acc,pref){const i=document.createElement('input');i.type='file';i.accept=acc;i.onchange=async function(e){const f=e.target.files[0];if(!f)return;if(f.size>50*1024*1024)return alert('> 50 МБ');const p=aC+'/'+Date.now()+'_'+f.name;const r=await sb.storage.from('media').upload(p,f);if(r.error)return alert(r.error.message);const ru=sb.storage.from('media').getPublicUrl(p);const rr=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,file_url:ru.data.publicUrl,file_type:f.type,file_name:f.name}).select().single();msgs.push(rr.data);$('msgs').appendChild(buildMsg(rr.data));$('msgs').scrollTop=$('msgs').scrollHeight;sb.from('chats').update({last_message:pref+' '+f.name}).eq('id',aC).then(function(){})};i.click()}
$('as').onclick=function(e){e.stopPropagation();$('attP').classList.add('h');$('stkP').classList.remove('h');renderStickers()};
$('ag').onclick=function(e){e.stopPropagation();$('attP').classList.add('h');$('gifP').classList.remove('h')};
$('ab').onclick=function(e){e.stopPropagation();$('attP').classList.add('h');$('brnP').classList.remove('h')};
$('apo').onclick=function(){$('attP').classList.add('h');$('pollM').classList.add('show')};
$('avn').onclick=async function(){$('attP').classList.add('h');if(!aC)return;if(!recording){try{const s=await navigator.mediaDevices.getUserMedia({video:{width:480,height:480},audio:true});recorder=new MediaRecorder(s);chunks=[];recorder.ondataavailable=function(e){chunks.push(e.data)};recorder.onstop=async function(){const b=new Blob(chunks,{type:'video/webm'});const f=new File([b],'vn_'+Date.now()+'.webm',{type:'video/webm'});const p=aC+'/'+Date.now()+'_vn.webm';const r=await sb.storage.from('media').upload(p,f);if(r.error)return alert(r.error.message);const ru=sb.storage.from('media').getPublicUrl(p);const rr=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_video_note:true,file_url:ru.data.publicUrl,file_type:'video/webm',file_name:'Кружок'}).select().single();msgs.push(rr.data);$('msgs').appendChild(buildMsg(rr.data));$('msgs').scrollTop=$('msgs').scrollHeight;s.getTracks().forEach(function(t){t.stop()})};recorder.start();recording=true;$('bMic').classList.add('rec');$('bMic').textContent='⏹';setTimeout(function(){if(recording){recorder.stop();recording=false;$('bMic').classList.remove('rec');$('bMic').textContent='🎤'}},10000)}catch(e){alert('Камера: '+e.message)}}else{recorder.stop();recording=false;$('bMic').classList.remove('rec');$('bMic').textContent='🎤'}};
$('bMic').onclick=async function(){if(!aC)return;if(!recording){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(s);chunks=[];recorder.ondataavailable=function(e){chunks.push(e.data)};recorder.onstop=async function(){const b=new Blob(chunks,{type:'audio/webm'});const f=new File([b],'v_'+Date.now()+'.webm',{type:'audio/webm'});const p=aC+'/'+Date.now()+'_v.webm';const r=await sb.storage.from('media').upload(p,f);if(r.error)return alert(r.error.message);const ru=sb.storage.from('media').getPublicUrl(p);const rr=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_voice:true,file_url:ru.data.publicUrl,file_type:'audio/webm',file_name:'Голосовое'}).select().single();msgs.push(rr.data);$('msgs').appendChild(buildMsg(rr.data));$('msgs').scrollTop=$('msgs').scrollHeight;s.getTracks().forEach(function(t){t.stop()});sb.from('chats').update({last_message:'Голосовое'}).eq('id',aC).then(function(){})};recorder.start();recording=true;$('bMic').classList.add('rec');$('bMic').textContent='⏹'}catch(e){alert('Микрофон: '+e.message)}}else{recorder.stop();recording=false;$('bMic').classList.remove('rec');$('bMic').textContent='🎤'}};
$('bEmo').onclick=function(e){e.stopPropagation();const p=$('ep');if(p.parentNode!==document.body)document.body.appendChild(p);p.classList.toggle('show');$('stkP').classList.add('h');$('gifP').classList.add('h');$('brnP').classList.add('h');$('attP').classList.add('h')};
$('ep').addEventListener('emoji-click',function(e){$('msgI').value+=e.detail.unicode;$('msgI').focus()});

function renderStickers(){const ip=myP?.is_plus;const all=[...stickers,...myStickers];$('stkG').innerHTML=all.map(function(s){return '<div style="background:var(--p2);border-radius:10px;padding:6px;text-align:center;cursor:pointer;border:2px solid '+(s.is_premium?'var(--yellow)':'transparent')+'" data-url="'+s.url+'" data-premium="'+s.is_premium+'"><img src="'+s.url+'" style="width:100%;height:46px;object-fit:contain"></div>'}).join('')||'<div style="padding:20px;text-align:center;color:var(--t2)">Нет стикеров</div>';$('stkG').querySelectorAll('[data-url]').forEach(function(el2){el2.onclick=async function(){if(el2.dataset.premium==='true'&&!ip)return alert('Plus');const r=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_sticker:true,file_url:el2.dataset.url}).select().single();msgs.push(r.data);$('msgs').appendChild(buildMsg(r.data));$('msgs').scrollTop=$('msgs').scrollHeight;$('stkP').classList.add('h')}})}
$('gifS').oninput=db(async function(e){const q=e.target.value.trim()||'hello';try{const r=await fetch('https://g.tenor.com/v1/search?q='+encodeURIComponent(q)+'&key='+TENOR+'&limit=12');const d=await r.json();$('gifG').innerHTML=(d.results||[]).map(function(g){return '<div data-full="'+g.media[0].gif.url+'" style="cursor:pointer;border-radius:10px;overflow:hidden"><img src="'+g.media[0].tinygif.url+'" style="width:100%;height:100px;object-fit:cover"></div>'}).join('');$('gifG').querySelectorAll('[data-full]').forEach(function(el2){el2.onclick=async function(){const r=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,file_url:el2.dataset.full,file_type:'gif',file_name:'GIF'}).select().single();msgs.push(r.data);$('msgs').appendChild(buildMsg(r.data));$('msgs').scrollTop=$('msgs').scrollHeight;$('gifP').classList.add('h')}})}catch(e){$('gifG').innerHTML='<div style="color:#888;padding:20px;text-align:center">Ошибка</div>'}},400);

$('bStalk').onclick=async function(){if(!isAdmin&&!await hasMod('stalker'))return tst('Нужен StalkerGram');openStalker(aO)};
$('bChatGallery').onclick=function(){try{openChatGallery()}catch(e){}};
window.openStalker=async function(uid){
  if(!uid)return tst('Выбери чат');
  if(!isAdmin&&!await hasMod('stalker'))return tst('Нужен StalkerGram');
  const p=await getP(uid);if(!p)return tst('Не найден');
  const r1=await sb.from('deleted_log').select('*').eq('chat_id',aC).order('deleted_at',{ascending:false}).limit(50);
  const r2=await sb.from('user_relations').select('*').eq('user_id',uid).order('messages_count',{ascending:false}).limit(30);
  const r3=await sb.from('chats').select('*').or('user1.eq.'+uid+',user2.eq.'+uid).limit(50);
  const del=r1.data,rel=r2.data,allChats=r3.data;
  const partnerIds=[...new Set((allChats||[]).map(function(c){return c.user1===uid?c.user2:c.user1}).filter(function(x){return x&&x!==uid}))];
  const rp=await sb.from('profiles').select('id,username,display_name,avatar_url,last_seen,hide_last_seen').in('id',partnerIds);
  const pmap={};(rp.data||[]).forEach(function(x){pmap[x.id]=x});
  const onlineNow=(rp.data||[]).filter(function(x){return x.last_seen&&(Date.now()-new Date(x.last_seen).getTime())<90000&&!x.hide_last_seen});
  let h='<h2>StalkerGram v3</h2>';
  h+='<div style="background:var(--p2);border-radius:12px;padding:14px;margin-bottom:12px;text-align:center"><div style="font-size:14px;font-weight:700">'+esc(p.display_name)+'</div><div style="font-size:11px;color:var(--t2)">@'+esc(p.username)+'</div>'+(onlineNow.length?'<div style="font-size:11px;color:var(--g);margin-top:6px">Онлайн: '+onlineNow.length+'/'+partnerIds.length+'</div>':'')+'</div>';
  h+='<div class="tg" id="stalkTabs" style="margin-bottom:12px"><button data-st="chats" class="on">Чаты</button><button data-st="relations">Топ</button><button data-st="online">Онлайн</button><button data-st="deleted">Удалённые</button></div>';
  h+='<div id="stalkBody" style="max-height:55vh;overflow-y:auto"></div>';
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:12px">Закрыть</button>';
  $('bmc').innerHTML=h;$('bm').classList.add('show');
  const renderTab=async function(t){
    let body='';
    if(t==='chats'){
      if(!allChats||!allChats.length)body='<div style="text-align:center;color:var(--t2);padding:20px">Нет</div>';
      else allChats.forEach(function(c){
        if(c.is_group||c.is_channel){body+='<div style="background:var(--p2);border-radius:10px;padding:10px;margin-bottom:6px;font-size:13px"><b>'+(c.is_channel?'📢':'👥')+' '+esc(c.group_name||'Группа')+'</b></div>'}
        else{const oid=c.user1===uid?c.user2:c.user1;const op=pmap[oid]||{display_name:'?',username:'?',avatar_url:null};body+='<div style="background:var(--p2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;gap:8px;align-items:center"><div style="width:32px;height:32px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden">'+(op.avatar_url?'<img src="'+op.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc((op.display_name||'?')[0].toUpperCase()))+'</div><div style="flex:1"><div style="font-size:13px;font-weight:600">'+esc(op.display_name)+'</div><div style="font-size:11px;color:var(--t2)">@'+esc(op.username)+'</div></div></div>'}
      });
    }else if(t==='relations'){
      if(!rel||!rel.length)body='<div style="text-align:center;color:var(--t2);padding:20px">Мало данных</div>';
      else{
        const relIds=rel.map(function(r){return r.other_id}).filter(function(id){return !pmap[id]});
        if(relIds.length){const re=await sb.from('profiles').select('id,username,display_name,avatar_url').in('id',relIds);(re.data||[]).forEach(function(x){pmap[x.id]=x})}
        body='<div style="font-size:11px;color:var(--a);font-weight:700;margin-bottom:8px">Топ собеседников</div>';
        rel.forEach(function(r,i){
          const op=pmap[r.other_id]||{display_name:'?',username:'?'};
          body+='<div style="background:var(--p2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;gap:8px;align-items:center"><div style="font-size:16px;font-weight:800;color:var(--a);width:26px">'+(i+1)+'</div><div style="width:32px;height:32px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden">'+(op.avatar_url?'<img src="'+op.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc((op.display_name||'?')[0].toUpperCase()))+'</div><div style="flex:1"><div style="font-size:13px;font-weight:600">'+esc(op.display_name)+'</div><div style="font-size:11px;color:var(--t2)">@'+esc(op.username)+' • '+r.messages_count+' сообщ.</div></div></div>';
        });
      }
    }else if(t==='online'){
      if(!onlineNow.length)body='<div style="text-align:center;color:var(--t2);padding:20px">Никто</div>';
      else{
        body='<div style="font-size:11px;color:var(--g);font-weight:700;margin-bottom:8px">Онлайн</div>';
        onlineNow.forEach(function(x){
          body+='<div style="background:var(--p2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;gap:8px;align-items:center"><div style="width:32px;height:32px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden;position:relative">'+(x.avatar_url?'<img src="'+x.avatar_url+'" style="width:100%;height:100%;object-fit:cover">':esc((x.display_name||'?')[0].toUpperCase()))+'<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:var(--g);border-radius:50%;border:2px solid var(--p2)"></div></div><div style="flex:1"><div style="font-size:13px;font-weight:600">'+esc(x.display_name)+'</div><div style="font-size:11px;color:var(--t2)">@'+esc(x.username)+'</div></div></div>';
        });
      }
    }else if(t==='deleted'){
      if(!del||!del.length)body='<div style="text-align:center;color:var(--t2);padding:20px">Пусто</div>';
      else del.forEach(function(d){
        body+='<div style="background:var(--p2);border-radius:10px;padding:10px;margin-bottom:6px"><div style="font-size:10px;color:var(--a);margin-bottom:4px">'+new Date(d.deleted_at).toLocaleString('ru')+'</div><div style="font-size:13px;white-space:pre-wrap">'+esc(d.text||'файл')+'</div></div>';
      });
    }
    $('stalkBody').innerHTML=body;
  };
  renderTab('chats');
  document.querySelectorAll('#stalkTabs button').forEach(function(b){b.onclick=function(){document.querySelectorAll('#stalkTabs button').forEach(function(x){x.classList.toggle('on',x===b)});renderTab(b.dataset.st)}});
};
async function hasMod(c){if(!myP||!myP.mods||!myP.mods.includes(c))return false;const r=await sb.from('mod_activations').select('*').eq('user_id',me.id).eq('mod_code',c).maybeSingle();if(!r.data)return false;return new Date(r.data.active_until)>new Date()}
window.hasMod=hasMod;

$('bMenu').onclick=function(e){e.stopPropagation();if(!aC)return;const pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');const isPin=pins.includes(aC);const c=prompt('1 - '+(isPin?'Открепить':'Закрепить')+'\n2 - Очистить\n3 - Удалить\nНомер:');if(c==='1'){if(isPin)pins.splice(pins.indexOf(aC),1);else pins.push(aC);localStorage.setItem('sg_pins',JSON.stringify(pins));tst('OK');loadChats()}else if(c==='2'){if(confirm('Очистить?'))sb.from('messages').delete().eq('chat_id',aC).then(function(){loadMsgs()})}else if(c==='3'){if(confirm('Удалить?'))sb.from('messages').delete().eq('chat_id',aC).then(function(){sb.from('chats').delete().eq('id',aC).then(function(){back();loadChats()})})}};
$('bSrch').onclick=function(){const q=prompt('Поиск:');document.querySelectorAll('.mw').forEach(function(w){w.style.opacity='1';w.style.background=''});if(!q)return;let found=0;document.querySelectorAll('.mw').forEach(function(w){const t=(w.querySelector('.m')?.textContent||'').toLowerCase();if(t.includes(q.toLowerCase())){found++;w.style.background='rgba(100,181,200,.15)';w.scrollIntoView({block:'center'})}else w.style.opacity='0.3'});tst('Найдено: '+found)};
window.back=function(){stopPoll();if(autoReadTimer)clearTimeout(autoReadTimer);if(typingWatcher)clearInterval(typingWatcher);$('AR').classList.remove('open');$('stkP').classList.add('h');$('gifP').classList.add('h');$('brnP').classList.add('h');$('attP').classList.add('h');$('ep').classList.remove('show');$('msgs').style.background='';$('bnv').classList.remove('h');if(mSub){sb.removeChannel(mSub);mSub=null}const sb_=$('scrollDownBtn');if(sb_)sb_.remove();const pinBar=document.querySelector('.pinnedBar');if(pinBar)pinBar.remove();aC=null;aO=null;aCO=null;loadChats();updateTitleBadge()};
window.viewImg=function(url){const v=document.createElement('div');v.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;justify-content:center;align-items:center;z-index:2000;padding:16px';v.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:100%;border-radius:10px"><button style="position:absolute;top:20px;right:20px;color:#fff;font-size:26px;background:rgba(0,0,0,.5);width:44px;height:44px;border-radius:50%">✕</button>';v.onclick=function(){v.remove()};document.body.appendChild(v)};

// ==================== АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM-СТИЛЬ ХЕНДЛЕРЫ ====================
window.showDevices=async function(){
  $('bmc').innerHTML='<h2>📱 Активные сессии</h2><div style="background:var(--p2);border-radius:12px;padding:14px;margin-bottom:10px"><div style="font-weight:600;font-size:14px">📱 Это устройство</div><div style="font-size:12px;color:var(--t2);margin-top:4px">'+navigator.userAgent.substring(0,60)+'...</div><div style="font-size:11px;color:var(--g);margin-top:6px">● Активна</div></div><div style="font-size:12px;color:var(--t2);background:var(--p2);border-radius:10px;padding:12px;line-height:1.6">💡 Ты можешь заходить на 10 устройств одновременно. Все работают независимо.</div><button onclick="sb.auth.signOut().then(function(){localStorage.removeItem(\'spacegram-auth\');location.reload()})" class="dg" style="margin-top:10px">🚪 Выйти со всех устройств</button><button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="background:var(--p2);color:var(--t)">Закрыть</button>';
  $('bm').classList.add('show');
};

// ==================== ФИНАЛЬНЫЕ ОБРАБОТЧИКИ ====================
document.addEventListener('click',function(e){
  if(!e.target.closest('.ep'))$('ep').classList.remove('show');
  if(!e.target.closest('#stkP')&&!e.target.closest('#as'))$('stkP').classList.add('h');
  if(!e.target.closest('#gifP')&&!e.target.closest('#ag'))$('gifP').classList.add('h');
  if(!e.target.closest('#brnP')&&!e.target.closest('#ab'))$('brnP').classList.add('h');
  if(!e.target.closest('#attP')&&!e.target.closest('#bPlus'))$('attP').classList.add('h');
  if(!e.target.closest('.mw'))document.querySelectorAll('.mw.tb').forEach(function(w){w.classList.remove('tb')});
});

// ==================== МУЛЬТИ-УСТРОЙСТВА ====================
sb.auth.onAuthStateChange(function(ev,ses){
  console.log('[AUTH]',ev,ses?.user?.id?.slice(0,8));
  if(ev==='SIGNED_IN'&&ses&&!me){me=ses.user;setTimeout(function(){enterApp()},100);return}
  if(ev==='TOKEN_REFRESHED'&&ses&&ses.user){me=ses.user;console.log('[AUTH] Токен обновлён');return}
  if(ev==='USER_UPDATED'&&ses&&ses.user){me=ses.user;return}
  if(ev==='SIGNED_OUT'){
    console.log('[AUTH] SIGNED_OUT — пробуем восстановить');
    setTimeout(async function(){
      try{
        const rs=await sb.auth.getSession();
        if(rs.data&&rs.data.session&&rs.data.session.user){
          me=rs.data.session.user;
          console.log('[AUTH] Сессия восстановлена');
          if(!aC)enterApp();
        }else{
          console.log('[AUTH] Сессия потеряна — показываем вход');
          localStorage.removeItem('spacegram-auth');
          if(!aC){$('A').classList.add('show');hl()}
        }
      }catch(e){console.error('[AUTH]',e)}
    },500);
    return;
  }
});

setInterval(async function(){
  try{
    const rf=await sb.from('profiles').select('is_banned,ban_reason').eq('id',me.id).single();
    if(rf.data&&rf.data.is_banned)showBanBanner(rf.data.ban_reason||'Нарушение');
    else hideBanBanner();
  }catch(e){}
},60000);

setInterval(async function(){
  if(!me)return;
  try{
    const rs=await sb.auth.getSession();
    if(!rs.data.session){
      console.log('[SESSION] Потеряна — восстанавливаю');
      const r2=await sb.auth.refreshSession();
      if(r2.data&&r2.data.session&&r2.data.session.user){me=r2.data.session.user;console.log('[SESSION] Восстановлена')}
    }else{
      me=rs.data.session.user;
    }
  }catch(e){}
},30000);

setTimeout(function(){
  const b=$('bSess');
  if(b&&!b._multi){b._multi=true;b.onclick=function(){$('setM').classList.remove('show');showDevices()}}
},1000);

const showD=function(m){let d=$('D');if(d)d.textContent=m};
(async function(){
  try{
    showD('Старт');theme();
    showD('Сессия');
    const rs=await TMOUT(sb.auth.getSession(),10000,'getSession');
    if(rs.error)throw new Error(rs.error.message);
    if(rs.data.session&&rs.data.session.user){showD('Загрузка');me=rs.data.session.user;await enterApp()}
    else{showD('Вход');$('A').classList.add('show');hl()}
  }catch(e){showD('Ошибка: '+e.message);setTimeout(function(){hl();$('A').classList.add('show')},2500)}
})();
setTimeout(function(){if($('L')&&!$('L').classList.contains('h')){hl();if(!me)$('A').classList.add('show')}},12000);

console.log('[Spacegram v11] Мульти-устройства + все фичи ✅');
