// ==================== SPACEGRAM APP.JS v3 ====================
// ФИНАЛЬНАЯ ВЕРСИЯ с таймаутами и защитой от вечной загрузки

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

// ⭐ ТАЙМАУТ
const TMOUT=(promise,ms=10000,label='запрос')=>Promise.race([
  promise,
  new Promise((_,rej)=>setTimeout(()=>rej(new Error(`Таймаут ${ms/1000}с: ${label}`)),ms))
]);

// ==================== МУЛЬТИ-CDN ====================
const CDN_LIST_SUPABASE=[
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/+esm",
  "https://esm.sh/@supabase/supabase-js@2.39.7",
  "https://cdn.skypack.dev/@supabase/supabase-js@2.39.7"
];
const CDN_LIST_EMOJI=[
  "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.20.0/+esm",
  "https://esm.sh/emoji-picker-element@1.20.0",
  "https://cdn.skypack.dev/emoji-picker-element@1.20.0"
];
async function loadFromCDN(urls,name){
  let lastErr=null;
  for(let i=0;i<urls.length;i++){
    const url=urls[i];
    try{
      console.log(`[CDN] ${name}: пробую ${url}`);
      const module=await import(/* @vite-ignore */ url);
      console.log(`[CDN] ${name}: ✅ ${url}`);
      return module;
    }catch(err){
      lastErr=err;
      console.warn(`[CDN] ${name}: ❌ ${url} — ${err.message}`);
    }
  }
  throw new Error(`${name}: все ${urls.length} CDN недоступны. Последняя: ${lastErr?.message||'?'}`);
}
let createClient;
try{
  boot('1. SDK... (3 CDN)');
  const m=await loadFromCDN(CDN_LIST_SUPABASE,'Supabase SDK');
  createClient=m.createClient;
  boot('2. Emoji... (3 CDN)');
  await loadFromCDN(CDN_LIST_EMOJI,'Emoji-picker');
  boot('3. Подключение...');
}catch(e){boot('<span style="color:#f55;font-size:16px">❌ SDK</span><br><br>'+e.message+'<br><br><span style="color:#faa">Все CDN недоступны. Включи VPN.</span>',"#fff");throw e}

const SB_URL="https://qtuvtxbxtypvttfjiydv.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA";
const CREATOR="itzrealsaneghka",OFFICIAL="spacegram",TENOR="LIVDSRZULELA";

let sb;
try{
  sb=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'spacegram-auth'}});
  boot('4. БД...');
  const t=await TMOUT(sb.from('profiles').select('id').limit(1),12000,'БД-check');
  if(t.error&&t.error.code!=='PGRST116')throw new Error(t.error.message);
  boot('5. Сессия...');
}catch(e){boot('<span style="color:#f55">❌ БД: '+e.message+'</span>',"#fff");throw e}

$('BE').style.display='none';$('L').style.display='';

// ==================== СОСТОЯНИЕ ====================
let me=null,myP=null,aC=null,aO=null,aCO=null,chSub=null,mSub=null,gSub=null,pollI=null,chatPollI=null,onlineI=null,isPolling=false;
let chats=[],msgs=[],reactions=[],polls={},stickers=[],profiles={},unread={},posts=[],bots=[],shopItems=[],myPurchases=[],myStickers=[];
let settings={theme:'midnight',mode:'dark',readReceipts:true,enterSend:true,notif:true,sound:true,vibro:true,preview:true,lang:'ru',push:false};
try{Object.assign(settings,JSON.parse(localStorage.getItem('sg_settings')||'{}'))}catch(e){}
let replyTo=null,recorder=null,chunks=[],recording=false,selM=[],isAdmin=false,optId=0,burnTime=0;
let stories=[],storiesByU={},svState={uId:null,i:0,timer:null};
let sFile=null,sType='image',sBg=null,sText='';
let curVerB='verified',feedLoaded=false,curRepMsg=null,curRepReason='spam';
let customSoundUrl=null;
try{customSoundUrl=localStorage.getItem('sg_sound')||null}catch(e){}
let autoReadTimer=null;
let lastTypingSent=0;
let unreadSinceScroll=0;

const BG=['#1a1a2e','#16213e','#0f3460','#e94560','#533483','#f39c12','#27ae60','#8e44ad','#c0392b','#2c3e50','#16a085','#d35400','#2d3436','#000'];
const EMS=['😀','😎','🤔','😴','🎮','🎧','📚','💼','🍕','☕','🔥','💯','🚀','🌙','☀️','❤️','🎉','🎯'];
const BI={creator:{i:'★',n:'Создатель',d:'Основатель Spacegram.'},verified:{i:'✓',n:'Подтверждённый',d:'Проверен админом.'},official:{i:'✓',n:'Официальный канал',d:'Канал Spacegram.'},bot:{i:'✓',n:'Официальный бот',d:'Проверенный бот.'},youtuber:{i:'▶',n:'YouTuber',d:'Известный ютубер.'},plus:{i:'👑',n:'Spacegram Plus',d:'Премиум. Истории, стикеры, значок.'},banned:{i:'🚫',n:'Забанен',d:'Аккаунт заблокирован.'}};

// ==================== УВЕДОМЛЕНИЯ ====================
let baseTitle=document.title;
let titleTimer=null;
function updateTitleBadge(){
  const total=Object.values(unread).reduce((a,b)=>a+b,0);
  if(total>0){
    if(!titleTimer){let flip=false;titleTimer=setInterval(()=>{flip=!flip;document.title=(flip?'('+total+') ':'')+baseTitle},900)}
  }else{if(titleTimer){clearInterval(titleTimer);titleTimer=null}document.title=baseTitle}
  if('setAppBadge' in navigator){try{total>0?navigator.setAppBadge(total):navigator.clearAppBadge()}catch(e){}}
  updateFaviconBadge(total);
}
let faviconLink=null;
function updateFaviconBadge(n){
  if(!faviconLink)faviconLink=document.querySelector('link[rel="icon"]');
  if(!faviconLink)return;
  if(n===0){faviconLink.href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✈️</text></svg>";return}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✈️</text><circle cx="75" cy="25" r="22" fill="#e74c3c"/><text x="75" y="34" font-size="26" fill="#fff" text-anchor="middle" font-weight="bold">${n>9?'9+':n}</text></svg>`;
  faviconLink.href='data:image/svg+xml,'+encodeURIComponent(svg);
}
function playSound(type='msg'){
  if(!settings.sound)return;
  try{
    const c=new(window.AudioContext||window.webkitAudioContext)();
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    if(type==='mention'){o.frequency.value=1200;g.gain.value=.15;o.start();o.frequency.setValueAtTime(900,c.currentTime+.08);o.stop(c.currentTime+.18)}
    else if(type==='sent'){o.frequency.value=600;g.gain.value=.05;o.start();o.stop(c.currentTime+.06)}
    else{o.frequency.value=800;g.gain.value=.1;o.start();o.stop(c.currentTime+.1)}
  }catch(e){}
}
function vibrate(type='msg'){
  if(!settings.vibro||!navigator.vibrate)return;
  if(type==='mention')navigator.vibrate([100,50,100,50,100]);
  else if(type==='sent')navigator.vibrate(20);
  else navigator.vibrate([50,30,50]);
}
function notif(type='msg'){
  if(!settings.notif)return;
  if(customSoundUrl&&type!=='sent'){try{const a=new Audio(customSoundUrl);a.volume=.5;a.play().catch(()=>{})}catch(e){}}
  else playSound(type);
  vibrate(type);
}
function initPush(){
  if(!('Notification'in window))return;
  if(Notification.permission==='default'){Notification.requestPermission().then(p=>{settings.push=p==='granted';svS();if(p==='granted')tst('🔔 Push включены')})}
}
function showPush(title,body,chatId){
  if(!settings.push||Notification.permission!=='granted')return;
  if(!document.hidden)return;
  try{
    const n=new Notification(title,{body,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✈️</text></svg>',tag:chatId||'spacegram',renotify:true});
    n.onclick=()=>{window.focus();if(chatId&&chatId!==aC){const c=chats.find(x=>x.id===chatId);if(c)openChat(chatId,c.user1===me.id?c.user2:c.user1,c)}n.close()};
  }catch(e){}
}
async function getP(id){
  if(profiles[id])return profiles[id];
  try{const{data}=await TMOUT(sb.from('profiles').select('*').eq('id',id).single(),8000,'getP');if(data)profiles[id]=data;return data}catch(e){return null}
}
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
  return h;
}
window.sBI=k=>{const i=BI[k];if(!i)return;$('bmc').innerHTML=`<h2>${i.i} ${i.n}</h2><div style="background:var(--p2);border-radius:12px;padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:12px"><div style="font-size:34px">${i.i}</div><div style="font-size:13.5px">${i.d}</div></div><button onclick="document.getElementById('bm').classList.remove('show')">Понятно</button>`;$('bm').classList.add('show')};
function theme(){document.body.className='';if(myP?.is_plus)document.body.classList.add('plus');const t=settings.theme;if(t!=='midnight')document.body.classList.add(t.slice(0,2));if(settings.mode==='light')document.body.classList.add('l')}
const svS=()=>localStorage.setItem('sg_settings',JSON.stringify(settings));
const hl=()=>{const l=$('L');if(l)l.classList.add('h')};// ==================== БАЛАНС ====================
async function addBalance(uid,amount,note){
  const{data:p}=await sb.from('profiles').select('balance').eq('id',uid).maybeSingle();
  if(!p)return 0;
  const nb=(p.balance||0)+amount;
  await sb.from('profiles').update({balance:nb}).eq('id',uid);
  await sb.from('balance_log').insert({user_id:uid,amount,reason:note||'',from_admin:me.id});
  return nb;
}
async function spendBalance(uid,amount,note){
  const{data:p}=await sb.from('profiles').select('balance').eq('id',uid).maybeSingle();
  if(!p||(p.balance||0)<amount)return false;
  const nb=(p.balance||0)-amount;
  await sb.from('profiles').update({balance:nb}).eq('id',uid);
  await sb.from('balance_log').insert({user_id:uid,amount:-amount,reason:note||'',from_admin:me.id});
  return true;
}
window.openBalance=async()=>{
  const{data:fresh}=await sb.from('profiles').select('balance').eq('id',me.id).single();
  myP.balance=fresh.balance||0;
  $('bmc').innerHTML=`<h2>💰 Баланс</h2><div style="text-align:center;padding:20px 0"><div style="font-size:48px">💰</div><div style="font-size:36px;font-weight:800;color:#10b981;margin-top:10px">${myP.balance} <span style="font-size:18px;color:var(--t2)">SG</span></div></div><div style="font-size:11px;color:var(--t2);background:var(--p2);padding:12px;border-radius:10px;line-height:1.6">💡 Как заработать:<br>• Промокоды на SG<br>• Подарки от друзей<br>• Награды от админов</div><button onclick="showTx()" style="background:var(--p2);color:var(--t)">📜 История</button><button onclick="document.getElementById('bm').classList.remove('show')">Закрыть</button>`;
  $('bm').classList.add('show');
};
window.showTx=async()=>{
  const{data}=await sb.from('balance_log').select('*').eq('user_id',me.id).order('created_at',{ascending:false}).limit(50);
  let h='<h2>📜 История</h2>';
  if(!data?.length)h+='<div style="text-align:center;color:var(--t2);padding:20px">Пусто</div>';
  else data.forEach(t=>{const isIn=t.amount>0;h+=`<div style="background:var(--p2);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:13px;font-weight:600">${esc(t.reason||'Транзакция')}</div><div style="font-size:10px;color:var(--t2);margin-top:2px">${new Date(t.created_at).toLocaleString('ru')}</div></div><div style="font-size:16px;font-weight:800;color:${isIn?'var(--g)':'var(--r)'}">${isIn?'+':''}${t.amount}</div></div>`});
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';
  $('bmc').innerHTML=h;$('bm').classList.add('show');
};
async function sendWarn(uid,reason){
  await sb.from('user_warns').insert({user_id:uid,admin_id:me.id,reason});
  const{count}=await sb.from('user_warns').select('*',{count:'exact',head:true}).eq('user_id',uid);
  const total=count||0;
  await sb.from('profiles').update({warns:total}).eq('id',uid);
  const{data:p}=await sb.from('profiles').select('username').eq('id',uid).maybeSingle();
  await logMod(uid,'warn',reason);
  if(total>=3){await sb.from('profiles').update({is_banned:true,ban_reason:'3/3 варна'}).eq('id',uid);tst(`🚫 @${p?.username||'?'} ЗАБАНЕН (3/3)`)}
  else tst(`⚠️ Варн ${total}/3 @${p?.username||'?'}`);
}
async function logMod(target,action,details){try{await sb.from('mod_log').insert({admin_id:me.id,target_id:target,action,details:details||''})}catch(e){}}
window.showActivity=async()=>{
  const{data}=await sb.from('messages').select('created_at').eq('sender',me.id).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).limit(2000);
  const byDay={};for(let i=29;i>=0;i--){const d=new Date(Date.now()-i*86400000);byDay[d.toDateString()]=0}
  (data||[]).forEach(m=>{const k=new Date(m.created_at).toDateString();if(byDay[k]!==undefined)byDay[k]++});
  const max=Math.max(1,...Object.values(byDay));
  let h='<h2>📊 Активность (30 дней)</h2><div style="background:var(--p2);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;gap:2px;align-items:flex-end;height:100px">';
  Object.entries(byDay).forEach(([day,count])=>{const hh=Math.max(2,(count/max)*100);h+=`<div style="flex:1;background:${count?'var(--a)':'var(--p)'};height:${hh}%;border-radius:2px;min-height:2px" title="${day}: ${count}"></div>`});
  h+='</div></div>';
  const total=Object.values(byDay).reduce((a,b)=>a+b,0);
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:var(--p2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--a)">${total}</div><div style="font-size:10px;color:var(--t2);text-transform:uppercase">За 30 дней</div></div><div style="background:var(--p2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--a)">${Math.round(total/30)}</div><div style="font-size:10px;color:var(--t2);text-transform:uppercase">В день</div></div></div>`;
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';
  $('bmc').innerHTML=h;$('bm').classList.add('show');
};
async function sendTyping(){if(!aC)return;const now=Date.now();if(now-lastTypingSent<3000)return;lastTypingSent=now;try{await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',me.id)}catch(e){}}

// ==================== ENTER APP ====================
async function enterApp(){
  $('A').classList.remove('show');$('APP').classList.add('show');
  try{
    let{data:prof}=await TMOUT(sb.from('profiles').select('*').eq('id',me.id).maybeSingle(),10000,'enterApp');
    if(!prof){
      const un=me.user_metadata?.username||(me.email||'').split('@')[0]||'user_'+me.id.slice(0,8);
      const isC=un===CREATOR,isO=un===OFFICIAL;
      const{data:c}=await sb.from('profiles').insert({id:me.id,username:un,display_name:un,is_creator:isC,is_verified:isC||isO,is_plus:isC||isO,is_bot_verified:isO,is_youtuber:isC,last_seen:new Date().toISOString()}).select().single();
      myP=c;
    } else myP=prof;
    if(myP?.is_banned){alert('🚫 Забанен');await sb.auth.signOut();location.reload();return}
    profiles[me.id]=myP;
    settings.lang=myP.language||'ru';
    theme();renderMyA();
    try{const{data:ad}=await sb.from('admins').select('id').eq('id',me.id).maybeSingle();isAdmin=!!ad;if(isAdmin)$('bAdm').style.display='flex'}catch(e){}
    if(myP?.username===CREATOR)isAdmin=true;
    try{const{data:s}=await sb.from('stickers').select('*');stickers=s||[]}catch(e){}
    try{const{data:it}=await sb.from('shop_items').select('*');shopItems=it||[]}catch(e){}
    try{const{data:pu}=await sb.from('user_purchases').select('item_id').eq('user_id',me.id);myPurchases=(pu||[]).map(x=>x.item_id)}catch(e){}
    try{const{data:ms}=await sb.from('stickers').select('*').eq('user_id',me.id);myStickers=ms||[]}catch(e){}
    await loadChats();
    subscribeChats();
    await loadStories();
    setInterval(loadStories,60000);
    await loadFeed();
    feedLoaded=true;
    await loadBots();
    setInterval(checkPlusExp,60000);
    if(isAdmin)setInterval(checkVerMsgs,20000);
    chatPollI=setInterval(()=>{if(!document.hidden)loadChats()},20000);
    onlineI=setInterval(async()=>{try{const ids=chats.map(c=>c.user1===me.id?c.user2:c.user1).filter(id=>id&&id!==me.id);if(!ids.length)return;const{data}=await sb.from('profiles').select('id,last_seen').in('id',ids);(data||[]).forEach(p=>{if(profiles[p.id])profiles[p.id].last_seen=p.last_seen})}catch(e){}},5000);
    setInterval(checkMute,30000);checkMute();
    setTimeout(()=>{const acts=$('topActs');if(!acts)return;const btns=Array.from(acts.querySelectorAll('button'));btns.forEach(b=>{if(b.id!=='bAdm')b.style.display='none'});const menu=el('button',{class:'tb',html:'⋮',title:'Меню'});menu.onclick=()=>{const items=btns.map(b=>`<button style="width:100%;padding:12px;border-radius:10px;background:var(--p2);color:var(--t);text-align:left;font-size:14px;margin-bottom:6px" onclick="document.getElementById('${b.id}').click();document.getElementById('bm').classList.remove('show')">${b.textContent} ${b.title||''}</button>`).join('');$('bmc').innerHTML=`<h2>Меню</h2>${items}<button onclick="document.getElementById('bm').classList.remove('show')" style="margin-top:8px">Закрыть</button>`;$('bm').classList.add('show')};acts.insertBefore(menu,acts.querySelector('.avt'))},500);
    initPush();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateTitleBadge();if(aC)loadMsgs()}});
  }catch(e){console.error(e);alert('Ошибка: '+e.message)}
  checkPin();
  hl();
}
async function checkMute(){try{const{data:fresh}=await sb.from('profiles').select('muted_until').eq('id',me.id).single();const m=fresh?.muted_until;if(m&&new Date(m)>new Date()){const left=Math.ceil((new Date(m)-Date.now())/60000);$('msgI').disabled=true;$('msgI').placeholder=`🔇 Мут ${left} мин`;$('bSend').disabled=true}else{if($('msgI').disabled){$('msgI').disabled=false;$('msgI').placeholder='Сообщение';$('bSend').disabled=false}}}catch(e){}}
async function checkPlusExp(){if(myP?.is_plus&&myP.plus_until&&new Date(myP.plus_until)<new Date()){await sb.from('profiles').update({is_plus:false}).eq('id',me.id);myP.is_plus=false;theme();tst('⌛ Plus истёк')}}
function renderMyA(){const a=$('myA');a.className='avt'+(myP?.is_plus?' plus':'');if(myP?.avatar_frame)a.classList.add('frame-'+myP.avatar_frame);if(myP?.avatar_url)a.innerHTML=`<img src="${myP.avatar_url}">`;else a.textContent=(myP?.display_name||'?')[0].toUpperCase();sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',me.id).then(()=>{})}

// ==================== AUTH ====================
$('bR').onclick=async()=>{
  $('AE').textContent='';
  const e=$('em').value.trim(),p=$('pw').value,u=$('un').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  if(!e||!p)return $('AE').textContent='Заполни';
  if(p.length<6)return $('AE').textContent='Пароль 6+';
  if(u.length<3)return $('AE').textContent='Username 3+';
  $('AE').textContent='...';
  try{
    const{data,error}=await sb.auth.signUp({email:e,password:p,options:{data:{username:u,display_name:u}}});
    if(error)return $('AE').textContent=error.message;
    if(!data.user)return $('AE').textContent='Ошибка';
    await new Promise(r=>setTimeout(r,800));
    const isC=u===CREATOR,isO=u===OFFICIAL;
    const c={username:u,display_name:u,is_creator:isC,is_verified:isC||isO,is_plus:isC||isO,is_bot_verified:isO,is_youtuber:isC,last_seen:new Date().toISOString()};
    const{data:prof}=await sb.from('profiles').select('*').eq('id',data.user.id).maybeSingle();
    if(!prof)await sb.from('profiles').insert({id:data.user.id,...c});
    else if(prof.username!==u)await sb.from('profiles').update(c).eq('id',data.user.id);
    me=data.user;
    await enterApp();
  }catch(e){$('AE').textContent=e.message}
};
$('bL').onclick=async()=>{
  $('AE').textContent='';
  const e=$('em').value.trim(),p=$('pw').value;
  if(!e||!p)return $('AE').textContent='Заполни';
  $('AE').textContent='Вход...';
  try{const{data,error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)return $('AE').textContent=error.message;me=data.user;await enterApp()}catch(e){$('AE').textContent=e.message}
};

// ==================== НАВИГАЦИЯ ====================
$('bnv').onclick=e=>{const b=e.target.closest('button');if(!b)return;const t=b.dataset.tab;if(aC&&t!=='chats')back();document.querySelectorAll('.bn button').forEach(x=>x.classList.toggle('on',x===b));if(t==='chats'){$('SD').classList.remove('h');$('fdScr').classList.remove('show');$('fcBtn').style.display='none'}else if(t==='feed'){$('SD').classList.add('h');$('fdScr').classList.add('show');$('fcBtn').style.display='flex';if(!feedLoaded){loadFeed();feedLoaded=true}}else if(t==='profile')showProf()};

// ==================== ЛЕНТА ====================
async function loadFeed(){try{const{data}=await sb.from('posts').select('*').order('created_at',{ascending:false}).limit(50);posts=data||[];const uids=[...new Set(posts.map(p=>p.author_id))].filter(id=>!profiles[id]);if(uids.length){const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p)}renderFeed()}catch(e){}}
async function renderFeed(){const b=$('fdL');if(!b)return;if(!posts.length){b.innerHTML='<div class="emp" style="padding:60px 20px"><div class="ic">📰</div><div>Нет постов</div></div>';return}const ids=posts.map(p=>p.id);let liked=new Set();try{const{data}=await sb.from('post_likes').select('post_id').eq('user_id',me.id).in('post_id',ids);liked=new Set((data||[]).map(l=>l.post_id))}catch(e){}b.innerHTML='';for(const p of posts){const a=profiles[p.author_id]||await getP(p.author_id);if(!a)continue;const c=el('div',{class:'po'});c.dataset.pid=p.id;let cc=0;try{const{count}=await sb.from('post_comments').select('*',{count:'exact',head:true}).eq('post_id',p.id);cc=count||0}catch(e){}c.innerHTML=`<div class="ph"><div class="av" onclick="showUP('${a.id}')">${a.avatar_url?`<img src="${a.avatar_url}">`:esc(a.display_name[0].toUpperCase())}</div><div class="mt"><div class="nm">${esc(a.display_name)} ${bd(a)}</div><div class="tm">${rt(p.created_at)}</div></div></div>${p.text?`<div class="pt">${esc(p.text)}</div>`:''}${p.media_url?`<div class="pmm"><img src="${p.media_url}" onclick="viewImg('${p.media_url}')"></div>`:''}<div class="pa"><div class="pac ${liked.has(p.id)?'lk':''}" data-like="${p.id}"><span class="ic">${liked.has(p.id)?'❤️':'🤍'}</span><span>${p.likes||0}</span></div><div class="pac" data-comment="${p.id}"><span class="ic">💬</span><span class="cc">${cc}</span></div></div><div class="cmts" data-slot="${p.id}" style="display:none"></div>`;b.appendChild(c)}b.querySelectorAll('[data-like]').forEach(x=>x.onclick=e=>{e.stopPropagation();toggleLike(x.dataset.like)});b.querySelectorAll('[data-comment]').forEach(x=>x.onclick=e=>{e.stopPropagation();toggleCmts(x.dataset.comment)})}
async function toggleLike(pid){const{data:ex}=await sb.from('post_likes').select('id').eq('post_id',pid).eq('user_id',me.id).maybeSingle();if(ex){await sb.from('post_likes').delete().eq('id',ex.id);const p=posts.find(x=>x.id===pid);if(p){p.likes=Math.max(0,(p.likes||0)-1);await sb.from('posts').update({likes:p.likes}).eq('id',pid)}}else{await sb.from('post_likes').insert({post_id:pid,user_id:me.id});const p=posts.find(x=>x.id===pid);if(p){p.likes=(p.likes||0)+1;await sb.from('posts').update({likes:p.likes}).eq('id',pid)}}renderFeed()}
async function toggleCmts(pid){const s=document.querySelector(`.cmts[data-slot="${pid}"]`);if(!s)return;if(s.style.display!=='none'){s.style.display='none';s.innerHTML='';return}s.style.display='block';s.innerHTML='<div style="background:var(--p2);border-radius:10px;padding:8px;margin-top:8px"><div style="text-align:center;color:var(--t2);padding:20px;font-size:13px">Загрузка...</div></div>';await loadCmts(pid,s)}
async function loadCmts(pid,s){const{data:cs,error}=await sb.from('post_comments').select('*').eq('post_id',pid).order('created_at',{ascending:true});if(error)return;const uids=[...new Set((cs||[]).map(c=>c.user_id))].filter(id=>!profiles[id]);if(uids.length){const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p)}let h='<div style="background:var(--p2);border-radius:10px;padding:8px;margin-top:8px">';if(!cs?.length)h+='<div style="text-align:center;color:var(--t2);padding:16px;font-size:12.5px">Комментариев нет</div>';else cs.forEach(c=>{const u=profiles[c.user_id];if(!u)return;const im=c.user_id===me.id;h+=`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="width:30px;height:30px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden;flex-shrink:0;cursor:pointer" onclick="showUP('${u.id}')">${u.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:esc(u.display_name[0].toUpperCase())}</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--a);cursor:pointer" onclick="showUP('${u.id}')">${esc(u.display_name)} ${bd(u)}</div><div style="font-size:13px;line-height:1.4;word-wrap:break-word;white-space:pre-wrap">${esc(c.text)}</div><div style="font-size:10px;color:var(--t2);margin-top:2px">${rt(c.created_at)}</div></div>${im?`<div style="color:var(--t2);font-size:14px;cursor:pointer;opacity:.5" onclick="delCmt('${c.id}','${pid}')">🗑</div>`:''}</div>`});h+='</div>';const ma=myP?.avatar_url?`<img src="${myP.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:esc((myP?.display_name||'?')[0].toUpperCase());h+=`<div style="display:flex;gap:6px;margin-top:8px"><div style="width:30px;height:30px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden;flex-shrink:0">${ma}</div><input id="cmi_${pid}" placeholder="Комментарий..." style="flex:1;padding:8px 14px;border-radius:16px;background:var(--p);color:var(--t);font-size:13px;min-width:0" onkeydown="if(event.key==='Enter')sendCmt('${pid}')"><button style="padding:8px 14px;border-radius:16px;background:var(--ab);color:#fff;font-size:13px;font-weight:600" onclick="sendCmt('${pid}')">➤</button></div>`;s.innerHTML=h}
window.sendCmt=async pid=>{const i=$('cmi_'+pid);const t=i?.value.trim();if(!t)return;i.value='';i.disabled=true;const{error}=await sb.from('post_comments').insert({post_id:pid,user_id:me.id,text:t});i.disabled=false;if(error){tst('❌ '+error.message);i.value=t;return}const c=document.querySelector(`.po[data-pid="${pid}"]`);if(c){const x=c.querySelector('.cc');if(x)x.textContent=(parseInt(x.textContent)||0)+1}const s=document.querySelector(`.cmts[data-slot="${pid}"]`);if(s)await loadCmts(pid,s);tst('💬')};
window.delCmt=async(cid,pid)=>{if(!confirm('Удалить?'))return;await sb.from('post_comments').delete().eq('id',cid);const c=document.querySelector(`.po[data-pid="${pid}"]`);if(c){const x=c.querySelector('.cc');if(x)x.textContent=Math.max(0,(parseInt(x.textContent)||1)-1)}const s=document.querySelector(`.cmts[data-slot="${pid}"]`);if(s)await loadCmts(pid,s);tst('🗑')};
window.openPost=()=>{$('postT').value='';$('postM').classList.add('show')};
let postImg=null;
$('bPostImg').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=async e=>{const f=e.target.files[0];if(!f)return;const p=`${me.id}/post_${Date.now()}.jpg`;const{error}=await sb.storage.from('media').upload(p,f);if(error)return alert(error.message);const{data:u}=sb.storage.from('media').getPublicUrl(p);postImg=u.publicUrl;$('postImgPrev').innerHTML=`<img src="${postImg}" style="border-radius:12px;max-height:200px;object-fit:cover;width:100%">`};i.click()};
$('bPubP').onclick=async()=>{const t=$('postT').value.trim();if(!t&&!postImg)return alert('Напиши');if(t&&BAD.test(t))return alert('🚫 Мат');const{error}=await sb.from('posts').insert({author_id:me.id,text:t,media_url:postImg});if(error)return alert(error.message);tst('✅');$('postM').classList.remove('show');postImg=null;feedLoaded=false;await loadFeed();feedLoaded=true};

// ==================== БОТЫ ====================
async function loadBots(){try{const{data}=await sb.from('bots').select('*').eq('is_active',true);bots=data||[]}catch(e){bots=[]}}
$('bBot').onclick=()=>{const l=$('botL');l.innerHTML='';if(!bots.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:20px;font-size:13px">Нет ботов</div>'}else bots.forEach(b=>{const d=el('div',{style:'background:var(--p2);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center'});d.innerHTML=`<div style="width:44px;height:44px;background:var(--bl);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px">🤖</div><div style="flex:1"><div style="font-weight:600;font-size:14px">${esc(b.name)}</div><div style="font-size:11px;color:var(--t2)">@${esc(b.username)}</div></div>`;l.appendChild(d)});$('botM').classList.add('show')};
$('bCrBot').onclick=async()=>{if(!myP?.is_plus)return alert('👑 Plus');const n=prompt('Имя:');if(!n)return;const u=prompt('@username:').toLowerCase().replace(/[^a-z0-9_]/g,'');if(!u)return;const{error}=await sb.from('bots').insert({owner_id:me.id,username:u,name:n,is_active:true});if(error)return alert(error.message);tst('✅');await loadBots()};
const WAPPS=[{n:'Погода',u:'https://wttr.in/',i:'☀️'},{n:'Вики',u:'https://ru.m.wikipedia.org',i:'📚'},{n:'Музыка',u:'https://music.yandex.ru',i:'🎵'},{n:'Игры',u:'https://poki.com/ru',i:'🎮'},{n:'Карты',u:'https://www.openstreetmap.org',i:'🗺️'},{n:'Курсы',u:'https://www.cbr.ru',i:'💵'}];
$('bApp').onclick=()=>{const g=$('appG');g.innerHTML='';WAPPS.forEach(a=>{const d=el('div',{style:'background:var(--p2);border-radius:14px;padding:14px;text-align:center;cursor:pointer'});d.innerHTML=`<div style="font-size:36px">${a.i}</div><div style="font-size:13px;font-weight:600;margin-top:6px">${a.n}</div>`;d.onclick=()=>window.open(a.u,'_blank');g.appendChild(d)});$('appM').classList.add('show')};

// ==================== ПРИВАТНОСТЬ ====================
$('bPriv').onclick=()=>{$('cbHL').checked=myP.hide_last_seen||false;$('cbHP').checked=myP.hide_phone||false;$('cbHA').checked=myP.hide_avatar||false;$('setM').classList.remove('show');$('privM').classList.add('show')};
$('bSavePriv').onclick=async()=>{const u={hide_last_seen:$('cbHL').checked,hide_phone:$('cbHP').checked,hide_avatar:$('cbHA').checked};await sb.from('profiles').update(u).eq('id',me.id);Object.assign(myP,u);tst('✅');$('privM').classList.remove('show')};
$('bSess').onclick=()=>{$('setM').classList.remove('show');$('sessL').innerHTML=`<div style="background:var(--p2);border-radius:12px;padding:14px;margin-bottom:10px"><div style="font-weight:600;font-size:14px">📱 Это устройство</div><div style="font-size:12px;color:var(--t2);margin-top:4px">${navigator.userAgent.substring(0,60)}...</div><div style="font-size:11px;color:var(--g);margin-top:6px">● Активна</div></div><button class="dg" onclick="if(confirm('Выйти со всех?')){sb.auth.signOut();location.reload()}">🚪 Завершить все</button>`;$('sessM').classList.add('show')};// ==================== ЧАТЫ ====================
async function loadChats(){
  try{
    const{data}=await sb.from('chats').select('*').or(`user1.eq.${me.id},user2.eq.${me.id}`).order('created_at',{ascending:false}).limit(60);
    chats=data||[];
    const seen=new Set();chats=chats.filter(c=>{if(c.is_group||c.is_channel)return true;const k=[c.user1,c.user2].sort().join('_');if(seen.has(k))return false;seen.add(k);return true});
    const p=JSON.parse(localStorage.getItem('sg_pins')||'[]');
    chats.sort((a,b)=>{const ap=p.indexOf(a.id),bp=p.indexOf(b.id);if(ap>=0&&bp<0)return-1;if(ap<0&&bp>=0)return 1;return 0});
    const ids=chats.filter(c=>!c.is_group&&!c.is_channel).map(c=>c.user1===me.id?c.user2:c.user1).filter(id=>!profiles[id]);
    if(ids.length){const{data:pr}=await sb.from('profiles').select('*').in('id',ids);(pr||[]).forEach(p=>profiles[p.id]=p)}
    unread={};
    if(chats.length){const{data}=await sb.from('messages').select('chat_id').in('chat_id',chats.map(c=>c.id)).eq('is_read',false).neq('sender',me.id);(data||[]).forEach(m=>unread[m.chat_id]=(unread[m.chat_id]||0)+1)}
    renderChats();
    updateTitleBadge();
  }catch(e){console.error(e)}
}
function renderChats(){
  const b=$('chats');b.innerHTML='';
  const block=myP?.blocked_users||[],pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');
  if(!chats.length){b.innerHTML='<div style="padding:30px;color:var(--t2);text-align:center;font-size:13px">Нет чатов</div>';return}
  chats.forEach(c=>{
    const isG=c.is_group||c.is_channel;const oid=c.user1===me.id?c.user2:c.user1;
    if(!isG&&block.includes(oid))return;
    const p=isG?{display_name:c.group_name||'Группа',avatar_url:c.group_avatar,is_official:c.is_official}:profiles[oid];
    if(!p)return;
    const on=p.last_seen&&(Date.now()-new Date(p.last_seen).getTime())<90000&&!p.hide_last_seen;
    const cnt=unread[c.id]||0;const isPin=pins.includes(c.id);
    const i=el('div',{class:'ch'+(c.id===aC?' a':'')});
    i.dataset.cid=c.id;
    let lt=null;
    i.addEventListener('touchstart',e=>{lt=setTimeout(()=>{lt=null;chatContextMenu(c,p);if(navigator.vibrate)navigator.vibrate(30)},600)},{passive:true});
    i.addEventListener('touchend',()=>{if(lt){clearTimeout(lt);lt=null}},{passive:true});
    i.addEventListener('touchmove',()=>{if(lt){clearTimeout(lt);lt=null}},{passive:true});
    i.onclick=()=>openChat(c.id,oid,c);
    i.innerHTML=`${isPin?'<span class="pin-ico">📌</span>':''}<div class="cv">${p.avatar_url&&!p.hide_avatar?`<img src="${p.avatar_url}" loading="lazy">`:esc((p.display_name||'?')[0].toUpperCase())}${on&&!isG?'<div style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;background:var(--g);border-radius:50%;border:2.5px solid var(--p)"></div>':''}</div><div class="ci"><div class="cn" style="${p.name_color?'color:'+p.name_color:''}">${esc(p.display_name)} ${bd(p,isG)}${c.is_secret?' 🔒':''}</div><div class="cp">${esc(c.last_message||'Начни общение')}</div></div><div class="ct">${c.created_at?ft(c.created_at):''}${cnt?`<div class="ur">${cnt>99?'99+':cnt}</div>`:''}</div>`;
    b.appendChild(i);
  });
}
function chatContextMenu(c,p){
  const pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');
  const isPin=pins.includes(c.id);
  let h=`<h2>${p.avatar_url?`<img src="${p.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`:''} ${esc(p.display_name)}</h2>`;
  h+=`<button onclick="chatAct('pin','${c.id}')" style="background:var(--p2);color:var(--t)">${isPin?'📌 Открепить':'📌 Закрепить'}</button>`;
  h+=`<button onclick="chatAct('read','${c.id}')" style="background:var(--p2);color:var(--t)">✓✓ Прочитано</button>`;
  h+=`<button onclick="chatAct('clear','${c.id}')" style="background:var(--p2);color:var(--t)">🧹 Очистить</button>`;
  h+=`<button onclick="chatAct('del','${c.id}')" class="dg">🗑 Удалить чат</button>`;
  h+=`<button onclick="document.getElementById('bm').classList.remove('show')" style="background:var(--p2);color:var(--t);margin-top:8px">Отмена</button>`;
  $('bmc').innerHTML=h;$('bm').classList.add('show');
}
window.chatAct=async(a,cid)=>{
  $('bm').classList.remove('show');
  const pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');
  if(a==='pin'){const i=pins.indexOf(cid);if(i>=0)pins.splice(i,1);else pins.push(cid);localStorage.setItem('sg_pins',JSON.stringify(pins));tst(i>=0?'📌 Откреплено':'📌 Закреплено');loadChats()}
  else if(a==='read'){await sb.from('messages').update({is_read:true}).eq('chat_id',cid).neq('sender',me.id).eq('is_read',false);tst('✓✓');loadChats()}
  else if(a==='clear'){if(!confirm('Очистить все сообщения?'))return;await sb.from('messages').delete().eq('chat_id',cid);tst('🧹');loadChats();if(aC===cid)loadMsgs()}
  else if(a==='del'){if(!confirm('Удалить чат со всеми сообщениями?'))return;await sb.from('messages').delete().eq('chat_id',cid);await sb.from('chats').delete().eq('id',cid);tst('🗑');if(aC===cid)back();loadChats()}
};
function subscribeChats(){
  if(chSub)sb.removeChannel(chSub);
  chSub=sb.channel('chats-s').on('postgres_changes',{event:'*',schema:'public',table:'chats'},()=>loadChats()).subscribe();
  if(gSub)sb.removeChannel(gSub);
  gSub=sb.channel('g-msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async p=>{
    if(p.new.sender===me.id)return;
    const c=chats.find(x=>x.id===p.new.chat_id);if(!c)return;
    const fromMe=aC===p.new.chat_id;
    if(fromMe){notif('msg');return}
    unread[p.new.chat_id]=(unread[p.new.chat_id]||0)+1;
    renderChats();
    updateTitleBadge();
    const txt=p.new.text||'';
    const isMention=myP?.username&&new RegExp('@'+myP.username,'i').test(txt);
    notif(isMention?'mention':'msg');
    const sender=await getP(p.new.sender);
    const title=sender?.display_name||'Spacegram';
    showPush(title,(txt||'📎').slice(0,80),p.new.chat_id);
    if(settings.preview&&!isMention)tst(`💬 ${title}: ${(txt||'📎').slice(0,40)}`);
    else if(isMention)tst(`🔔 ${title} упомянул тебя!`);
    botReply(p.new);
  }).subscribe();
}

// ==================== ПОИСК ====================
$('srch').oninput=db(async e=>{
  const v=e.target.value.trim();
  if(!v||v.length<2){renderChats();return}
  try{
    const b=$('chats');b.innerHTML='';
    const{data:foundMsgs}=await sb.from('messages').select('chat_id,text,sender,created_at').ilike('text','%'+v+'%').order('created_at',{ascending:false}).limit(50);
    if(foundMsgs?.length){
      b.innerHTML='<div style="padding:10px 12px;font-size:11px;color:var(--a);text-transform:uppercase;font-weight:700">🔍 Найдено в сообщениях</div>';
      const chatIds=[...new Set(foundMsgs.map(m=>m.chat_id))];
      const{data:chs}=await sb.from('chats').select('*').in('id',chatIds);
      const cmap={};(chs||[]).forEach(c=>cmap[c.id]=c);
      for(const m of foundMsgs.slice(0,20)){
        const c=cmap[m.chat_id];if(!c)continue;
        const otherId=c.user1===me.id?c.user2:c.user1;
        const p=c.is_group||c.is_channel?{display_name:c.group_name||'Группа'}:profiles[otherId]||await getP(otherId);
        if(!p)continue;
        const i=el('div',{class:'ch'});
        i.onclick=()=>openChat(c.id,otherId,c);
        i.innerHTML=`<div class="cv">${p.avatar_url?`<img src="${p.avatar_url}">`:esc((p.display_name||'?')[0].toUpperCase())}</div><div class="ci"><div class="cn">${esc(p.display_name)}</div><div class="cp">${esc(m.text.slice(0,60))}</div></div>`;
        b.appendChild(i);
      }
    }
    const vlow=v.toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(vlow.length>=2){
      const{data:users}=await sb.from('profiles').select('*').eq('username',vlow).limit(10);
      if(users?.length){
        b.innerHTML+='<div style="padding:10px 12px;font-size:11px;color:var(--a);text-transform:uppercase;font-weight:700">👤 Пользователи</div>';
        users.forEach(u=>{if(u.id===me.id)return;profiles[u.id]=u;const i=el('div',{class:'ch'});i.onclick=()=>startChat(u.id);i.innerHTML=`<div class="cv">${u.avatar_url?`<img src="${u.avatar_url}">`:esc((u.display_name||'?')[0].toUpperCase())}</div><div class="ci"><div class="cn">${esc(u.display_name)} ${bd(u)}</div><div class="cp">@${esc(u.username)}</div></div>`;b.appendChild(i)});
      }
    }
    if(!b.innerHTML)b.innerHTML='<div style="padding:20px;color:var(--t2);text-align:center">Ничего не найдено</div>';
  }catch(e){console.error(e)}
},400);

async function startChat(oid){
  const[u1,u2]=[me.id,oid].sort();
  let{data:ex}=await sb.from('chats').select('id').or(`and(user1.eq.${u1},user2.eq.${u2}),and(user1.eq.${u2},user2.eq.${u1})`).limit(1);
  let cid;
  if(ex?.length)cid=ex[0].id;
  else{const{data,error}=await sb.from('chats').insert({user1:u1,user2:u2,created_by:me.id}).select().single();if(error)return alert(error.message);cid=data.id}
  $('srch').value='';await loadChats();openChat(cid,oid);
}

// ==================== ОТКРЫТИЕ ЧАТА ====================
async function openChat(cid,oid,co){
  $('bnv').classList.add('h');
  aC=cid;aO=oid;aCO=co||chats.find(c=>c.id===cid);
  if(!aCO){const{data}=await sb.from('chats').select('*').eq('id',cid).single();aCO=data}
  $('AR').classList.add('open');
  $('CH').style.display='flex';$('msgs').style.display='flex';$('inp').style.display='flex';$('emp').style.display='none';
  $('msgs').style.background=myP.chat_wallpaper||'';
  const isG=aCO.is_group||aCO.is_channel;let p;
  if(isG){$('hN').innerHTML=`${esc(aCO.group_name||'Группа')} ${bd(aCO,true)}${aCO.is_secret?' 🔒':''}`;$('hS').textContent=aCO.is_channel?'канал':'группа';$('hA').innerHTML=aCO.group_avatar?`<img src="${aCO.group_avatar}">`:'👥'}
  else{p=await getP(oid);$('hN').innerHTML=`${esc(p?.display_name||'?')} ${bd(p||{})}${aCO.is_secret?' 🔒':''}`;const on=p?.last_seen&&(Date.now()-new Date(p.last_seen).getTime())<90000&&!p?.hide_last_seen;$('hS').textContent=on?'в сети':'был(а) недавно';$('hA').innerHTML=p?.avatar_url&&!p?.hide_avatar?`<img src="${p.avatar_url}">`:esc((p?.display_name||'?')[0].toUpperCase())}
  delete unread[cid];renderChats();updateTitleBadge();
  await loadMsgs();
  subscribeMsgs();
  startPoll();
  if(autoReadTimer)clearTimeout(autoReadTimer);
  autoReadTimer=setTimeout(()=>markRead(),2000);
  $('msgs').addEventListener('scroll',onMsgsScroll);
}
async function markRead(){
  if(!aC)return;
  try{await sb.from('messages').update({is_read:true}).eq('chat_id',aC).neq('sender',me.id).eq('is_read',false)}catch(e){}
  delete unread[aC];
  updateTitleBadge();
  renderChats();
}
function onMsgsScroll(){
  const b=$('msgs');if(!b)return;
  const nearBottom=b.scrollHeight-b.scrollTop-b.clientHeight<60;
  let btn=$('scrollDownBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='scrollDownBtn';
    btn.style.cssText='position:absolute;right:14px;bottom:14px;width:42px;height:42px;border-radius:50%;background:var(--ab);color:#fff;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,.4);display:none;z-index:50;border:none;cursor:pointer;align-items:center;justify-content:center';
    btn.innerHTML='↓';
    btn.onclick=()=>{b.scrollTop=b.scrollHeight;btn.style.display='none'};
    const wrap=$('msgs').parentNode;
    if(wrap)wrap.appendChild(btn);
  }
  if(!nearBottom&&msgs.length>3)btn.style.display='flex';else btn.style.display='none';
}

// ==================== СООБЩЕНИЯ ====================
async function loadMsgs(){
  const{data}=await sb.from('messages').select('*').eq('chat_id',aC).order('created_at',{ascending:true}).limit(200);
  msgs=data||[];const ids=msgs.map(m=>m.id);reactions=[];polls={};
  if(ids.length){const[rx,pl]=await Promise.all([sb.from('reactions').select('*').in('message_id',ids),sb.from('polls').select('*').in('message_id',ids)]);reactions=rx.data||[];(pl.data||[]).forEach(p=>polls[p.message_id]=p)}
  renderMsgs();
  if(settings.readReceipts&&!myP?.ghost_mode)sb.from('messages').update({is_read:true}).eq('chat_id',aC).neq('sender',me.id).eq('is_read',false).then(()=>{});
}
function startPoll(){stopPoll();pollI=setInterval(async()=>{if(!aC||document.hidden||isPolling)return;isPolling=true;try{const{data}=await sb.from('messages').select('id,text,is_read,deleted,file_url,created_at').eq('chat_id',aC).order('created_at',{ascending:true}).limit(100);if(!data)return;const oldSig=msgs.map(m=>m.id).join(',');const newSig=data.map(m=>m.id).join(',');if(oldSig!==newSig)await loadMsgs()}catch(e){}finally{isPolling=false}},1500)}
function stopPoll(){if(pollI){clearInterval(pollI);pollI=null}isPolling=false}
function renderMsgs(){
  const b=$('msgs');b.innerHTML='';
  let ld='';
  msgs.forEach((m,idx)=>{
    const d=new Date(m.created_at).toDateString();
    if(d!==ld){b.appendChild(el('div',{style:'align-self:center;padding:4px 12px;background:rgba(0,0,0,.3);color:#fff;border-radius:14px;font-size:11.5px;margin:10px 0 6px',text:fd(new Date(m.created_at))}));ld=d}
    const node=buildMsg(m);
    if(idx>=msgs.length-5){node.style.opacity='0';node.style.transition='opacity .25s';setTimeout(()=>node.style.opacity='1',20)}
    b.appendChild(node);
  });
  b.scrollTop=b.scrollHeight;
}

// ==================== ПОСТРОЕНИЕ СООБЩЕНИЯ ====================
function buildMsg(m){
  const im=m.sender===me.id;
  const w=el('div',{class:'mw '+(im?'me':'you')});w.dataset.mid=m.id;
  let sx=0,sy=0,swiping=false;
  w.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;swiping=false},{passive:true});
  w.addEventListener('touchmove',e=>{if(!sx)return;const dx=e.touches[0].clientX-sx;const dy=e.touches[0].clientY-sy;if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>20){swiping=true;if(dx>0&&dx<100)w.style.transform=`translateX(${dx}px)`}},{passive:true});
  w.addEventListener('touchend',e=>{if(!sx)return;const dx=(e.changedTouches[0].clientX)-sx;w.style.transform='';if(swiping&&dx>60){startRep(m)}sx=0;sy=0;swiping=false},{passive:true});
  const d=el('div',{class:'m '+(im?'me':'you')+(m.deleted?' del':'')});
  let h='';
  if(m.burn_after)h+=`<div style="font-size:10px;color:#ff7b7b;margin-bottom:3px;font-weight:700;width:100%">🔒 ${m.burn_after}с</div>`;
  if(m.forwarded_from)h+='<div class="fw">↪ Переслано</div>';
  if(m.reply_to){const rm=msgs.find(x=>x.id===m.reply_to);if(rm){const rp=profiles[rm.sender];h+=`<div class="rp"><div class="ra">${esc(rm.sender===me.id?'Ты':(rp?.display_name||'?'))}</div>${esc((rm.text||'📎').slice(0,50))}</div>`}}
  let b='';
  if(m.deleted)b='<i>Удалено</i>';
  else if(m.is_sticker&&m.file_url){d.className='m stk';b=`<img src="${m.file_url}" loading="lazy">`}
  else if(m.is_voice&&m.file_url){b=`<audio controls preload="none"><source src="${m.file_url}"></audio><div class="speed-btns"><button data-sp="1" class="on">1x</button><button data-sp="1.5">1.5x</button><button data-sp="2">2x</button></div>`}
  else if(m.is_video_note&&m.file_url)b=`<div style="width:180px;height:180px;border-radius:50%;overflow:hidden"><video src="${m.file_url}" controls playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"></video></div>`;
  else if(m.is_img_grid&&m.file_url)b=`<div class="img-grid">${(m.file_url||'').split('||').map(u=>`<img src="${u}" onclick="viewImg('${u}')">`).join('')}</div>`;
  else if(m.file_url){if(m.file_type?.startsWith('image'))b+=`<img class="im" src="${m.file_url}" loading="lazy" onclick="viewImg('${m.file_url}')">`;else if(m.file_type?.startsWith('video'))b+=`<video controls preload="metadata" src="${m.file_url}"></video>`;else b+=`<div style="display:flex;align-items:center;gap:10px">📎 <div style="flex:1"><div style="font-size:12px;font-weight:600">${esc(m.file_name||'файл')}</div></div><a href="${m.file_url}" target="_blank" style="color:var(--a)">⬇</a></div>`}
  else if(polls[m.id])b+=renderPoll(polls[m.id]);
  else{let txt=esc(m.text||'');txt=txt.replace(/@([a-z0-9_]+)/gi,'<span class="mn">@$1</span>');txt=txt.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" style="color:var(--a);text-decoration:underline">$1</a>');b+=txt}
  const ch=im?`<span class="chk ${m.is_read?'rd':''}">${m.is_read?'✓✓':'✓'}</span>`:'';
  if(m.is_sticker)d.innerHTML=b;
  else d.innerHTML=h+`<div class="tx">${b}</div><div class="tm">${ft(m.created_at)}${ch}</div>`;
  w.appendChild(d);
  d.querySelectorAll('.speed-btns button').forEach(btn=>btn.onclick=ev=>{ev.stopPropagation();const sp=parseFloat(btn.dataset.sp);const au=d.querySelector('audio');if(au){au.playbackRate=sp;d.querySelectorAll('.speed-btns button').forEach(x=>x.classList.remove('on'));btn.classList.add('on')}});
  const rx=reactions.filter(r=>r.message_id===m.id);const gr={};rx.forEach(r=>{(gr[r.emoji]=gr[r.emoji]||[]).push(r.user_id)});
  if(Object.keys(gr).length){const rb=el('div',{class:'rxs'});Object.entries(gr).forEach(([e,u])=>{const rd=el('div',{class:'rx'+(u.includes(me.id)?' mn':''),html:`${e} ${u.length}`});rd.onclick=ev=>{ev.stopPropagation();togReact(m.id,e)};rb.appendChild(rd)});w.appendChild(rb)}
  const tb=el('div',{class:'tb2'});
  [['👍','r-👍'],['❤️','r-❤️'],['😂','r-😂'],['🔥','r-🔥'],['↩','rp'],['↪','fw'],['📌','pn'],['🚩','rep']].forEach(([i,a])=>{const b=el('button',{html:i});b.onclick=e=>{e.stopPropagation();msgAct(a,m,w)};tb.appendChild(b)});
  if(im){const e1=el('button',{html:'✏️'});e1.onclick=e=>{e.stopPropagation();msgAct('ed',m,w)};const e2=el('button',{html:'🗑'});e2.onclick=e=>{e.stopPropagation();msgAct('dl',m,w)};tb.appendChild(e1);tb.appendChild(e2)}
  w.appendChild(tb);
  d.onclick=e=>{e.stopPropagation();document.querySelectorAll('.mw.tb').forEach(x=>x.classList.remove('tb'));w.classList.add('tb')};
  d.ondblclick=e=>{e.stopPropagation();togReact(m.id,'❤️')};
  return w;
}
async function msgAct(a,m,w){
  w.classList.remove('tb');
  if(a.startsWith('r-'))return togReact(m.id,a.replace('r-',''));
  if(a==='rp')return startRep(m);
  if(a==='fw'){if(aCO?.is_secret||m.forward_restricted)return tst('🚫');return fwdMsg(m)}
  if(a==='pn'){await sb.from('chats').update({pinned_message_id:m.id}).eq('id',aC);aCO.pinned_message_id=m.id;tst('📌');return}
  if(a==='rep'){curRepMsg=m;$('repMsg').value='';$('reportM').classList.add('show');return}
  if(a==='ed'){const n=prompt('Новое:',m.text);if(!n||n===m.text)return;if(BAD.test(n))return tst('🚫 Мат');await sb.from('edit_history').insert({message_id:m.id,old_text:m.text});await sb.from('messages').update({text:n}).eq('id',m.id);await loadMsgs();return}
  if(a==='dl'){if(!confirm('Удалить?'))return;try{await sb.from('deleted_log').insert({chat_id:aC,sender:m.sender,text:m.text||'',file_url:m.file_url||null,deleted_by:me.id})}catch(e){}await sb.from('messages').update({deleted:true,text:'',file_url:null}).eq('id',m.id);await loadMsgs()}
}
function renderPoll(p){const o=Array.isArray(p.options)?p.options:JSON.parse(p.options||'[]');let h=`<div class="poll" data-pid="${p.id}"><div style="font-weight:700;margin-bottom:6px;font-size:14px">📊 ${esc(p.question)}</div>`;o.forEach((x,i)=>{h+=`<div class="po" data-idx="${i}" style="padding:7px 11px;background:rgba(255,255,255,.08);border-radius:7px;margin-bottom:4px;position:relative;overflow:hidden;font-size:13px;cursor:pointer"><div class="pb" style="position:absolute;inset:0;background:rgba(100,181,239,.22);width:0%"></div><span style="position:relative">${esc(x)} <span class="pc" style="float:right;color:var(--t2);font-size:12px;font-weight:600"></span></span></div>`});h+='</div>';setTimeout(()=>updPoll(p.id),100);return h}
async function updPoll(pid){const e=document.querySelector(`.poll[data-pid="${pid}"]`);if(!e)return;const{data:v}=await sb.from('poll_votes').select('*').eq('poll_id',pid);const t=(v?.length)||1;e.querySelectorAll('.po').forEach((po,i)=>{const c=(v||[]).filter(x=>x.option_index===i).length;po.querySelector('.pb').style.width=(c/t*100)+'%';po.querySelector('.pc').textContent=c})}
document.addEventListener('click',async e=>{const po=e.target.closest('.po');if(!po||!po.closest('.poll'))return;const pid=po.closest('.poll').dataset.pid,idx=parseInt(po.dataset.idx);const{data:ex}=await sb.from('poll_votes').select('id').eq('poll_id',pid).eq('user_id',me.id).eq('option_index',idx).maybeSingle();if(ex)await sb.from('poll_votes').delete().eq('id',ex.id);else await sb.from('poll_votes').insert({poll_id:pid,user_id:me.id,option_index:idx});updPoll(pid)});
async function togReact(mid,e){const ex=reactions.find(r=>r.message_id===mid&&r.user_id===me.id&&r.emoji===e);if(ex)await sb.from('reactions').delete().eq('id',ex.id);else await sb.from('reactions').insert({message_id:mid,user_id:me.id,emoji:e});const ids=msgs.map(m=>m.id);const{data}=await sb.from('reactions').select('*').in('message_id',ids);reactions=data||[];renderMsgs()}
function startRep(m){replyTo=m;const p=profiles[m.sender];$('rA').textContent=m.sender===me.id?'Ты':(p?.display_name||'?');$('rT').textContent=(m.text||'📎').slice(0,50);$('rP').classList.add('on');$('msgI').focus()}
window.cancelRep=()=>{replyTo=null;$('rP').classList.remove('on')};
async function fwdMsg(m){const{data}=await sb.from('chats').select('id,user1,user2,is_group,is_channel,group_name').or(`user1.eq.${me.id},user2.eq.${me.id}`).limit(30);if(!data?.length)return alert('Нет чатов');const n=[];for(let i=0;i<data.length;i++){const c=data[i];let nm;if(c.is_group||c.is_channel)nm=c.group_name||'Группа';else{const p=await getP(c.user1===me.id?c.user2:c.user1);nm=p?.display_name||'user'}n.push(`${i+1}. ${nm}`)}const pk=prompt('Куда:\n'+n.join('\n')+'\nНомер:');const idx=parseInt(pk)-1;if(isNaN(idx)||!data[idx])return;const t=data[idx];await sb.from('messages').insert({chat_id:t.id,sender:me.id,text:m.text||'',is_read:false,file_url:m.file_url,file_type:m.file_type,file_name:m.file_name,is_sticker:m.is_sticker,forwarded_from:m.sender,forward_restricted:true});await sb.from('chats').update({last_message:'↪ '+((m.text||'файл').slice(0,40))}).eq('id',t.id);tst('✅')}
function subscribeMsgs(){if(mSub)sb.removeChannel(mSub);mSub=sb.channel('msgs-'+aC).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`chat_id=eq.${aC}`},p=>{if(p.new.sender===me.id)return;if(msgs.find(m=>m.id===p.new.id))return;msgs.push(p.new);$('msgs').appendChild(buildMsg(p.new));$('msgs').scrollTop=$('msgs').scrollHeight;sb.from('messages').update({is_read:true}).eq('id',p.new.id).then(()=>{});if(p.new.burn_after&&p.new.burn_after>0)setTimeout(async()=>{await sb.from('messages').delete().eq('id',p.new.id);loadMsgs()},p.new.burn_after*1000);notif('msg');botReply(p.new)}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:`chat_id=eq.${aC}`},()=>loadMsgs()).subscribe()}

// ==================== ОТПРАВКА ====================
async function sendMsg(){
  const t=$('msgI').value.trim();if(!t||!aC)return;
  if(BAD.test(t)){$('msgI').value='';return tst('🚫 Мат запрещён')}
  const{data:mf}=await sb.from('profiles').select('muted_until').eq('id',me.id).single();
  if(mf?.muted_until&&new Date(mf.muted_until)>new Date())return tst('🔇 Вы в муте');
  $('msgI').value='';
  const tid='temp_'+(++optId);
  const tm={id:tid,chat_id:aC,sender:me.id,text:t,is_read:false,reply_to:replyTo?.id||null,created_at:new Date().toISOString(),burn_after:burnTime||0};
  msgs.push(tm);const te=buildMsg(tm);te.querySelector('.m').style.opacity='0.6';
  $('msgs').appendChild(te);$('msgs').scrollTop=$('msgs').scrollHeight;
  replyTo=null;$('rP').classList.remove('on');
  playSound('sent');
  const{data,error}=await sb.from('messages').insert({chat_id:aC,sender:me.id,text:t,is_read:false,reply_to:tm.reply_to,is_secret:aCO?.is_secret||false,burn_after:burnTime||0}).select().single();
  if(error){const i=msgs.findIndex(m=>m.id===tid);if(i>=0)msgs.splice(i,1);te.remove();alert(error.message);return}
  const i=msgs.findIndex(m=>m.id===tid);if(i>=0)msgs[i]=data;
  te.replaceWith(buildMsg(data));
  sb.from('chats').update({last_message:t.slice(0,50)}).eq('id',aC).then(()=>{});
  burnTime=0;document.querySelectorAll('#brnO button').forEach(b=>b.classList.toggle('on',b.dataset.b==='0'));
}
$('bSend').onclick=sendMsg;
$('msgI').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&settings.enterSend){e.preventDefault();sendMsg()}};
$('msgI').oninput=()=>{sendTyping()};

// ==================== ВЛОЖЕНИЯ ====================
$('bPlus').onclick=e=>{e.stopPropagation();const p=$('attP');p.classList.toggle('h');$('stkP').classList.add('h');$('gifP').classList.add('h');$('brnP').classList.add('h');$('ep').classList.remove('show')};
$('ap').onclick=()=>{$('attP').classList.add('h');const i=document.createElement('input');i.type='file';i.accept='image/*,video/*';i.multiple=true;i.onchange=async e=>{const files=[...e.target.files];if(!files.length)return;if(files.length===1){const f=files[0];if(f.size>50*1024*1024)return alert('> 50 МБ');const p=`${aC}/${Date.now()}_${f.name}`;const{error}=await sb.storage.from('media').upload(p,f);if(error)return alert(error.message);const{data:u}=sb.storage.from('media').getPublicUrl(p);const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,file_url:u.publicUrl,file_type:f.type,file_name:f.name}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight}else{const urls=[];for(const f of files){const p=`${aC}/${Date.now()}_${Math.random().toString(36).slice(2)}_${f.name}`;const{error}=await sb.storage.from('media').upload(p,f);if(error)continue;const{data:u}=sb.storage.from('media').getPublicUrl(p);urls.push(u.publicUrl)}const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_img_grid:true,file_url:urls.join('||'),file_type:'grid',file_name:files.length+' фото'}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight}sb.from('chats').update({last_message:'🖼️ '+files.length+' фото'}).eq('id',aC).then(()=>{})};i.click()};
$('af').onclick=()=>{$('attP').classList.add('h');pickFile('*/*','📎')};
function pickFile(acc,pref){const i=document.createElement('input');i.type='file';i.accept=acc;i.onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>50*1024*1024)return alert('> 50 МБ');const p=`${aC}/${Date.now()}_${f.name}`;const{error}=await sb.storage.from('media').upload(p,f);if(error)return alert(error.message);const{data:u}=sb.storage.from('media').getPublicUrl(p);const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,file_url:u.publicUrl,file_type:f.type,file_name:f.name}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight;sb.from('chats').update({last_message:pref+' '+f.name}).eq('id',aC).then(()=>{})};i.click()}
$('as').onclick=e=>{e.stopPropagation();$('attP').classList.add('h');$('stkP').classList.remove('h');renderStickers()};
$('ag').onclick=e=>{e.stopPropagation();$('attP').classList.add('h');$('gifP').classList.remove('h')};
$('ab').onclick=e=>{e.stopPropagation();$('attP').classList.add('h');$('brnP').classList.remove('h')};
$('apo').onclick=()=>{$('attP').classList.add('h');$('pollM').classList.add('show')};
$('avn').onclick=async()=>{$('attP').classList.add('h');if(!aC)return;if(!recording){try{const s=await navigator.mediaDevices.getUserMedia({video:{width:480,height:480},audio:true});recorder=new MediaRecorder(s);chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{const b=new Blob(chunks,{type:'video/webm'});const f=new File([b],`vn_${Date.now()}.webm`,{type:'video/webm'});const p=`${aC}/${Date.now()}_vn.webm`;const{error}=await sb.storage.from('media').upload(p,f);if(error)return alert(error.message);const{data:u}=sb.storage.from('media').getPublicUrl(p);const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_video_note:true,file_url:u.publicUrl,file_type:'video/webm',file_name:'Кружок'}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight;s.getTracks().forEach(t=>t.stop())};recorder.start();recording=true;$('bMic').classList.add('rec');$('bMic').textContent='⏹';setTimeout(()=>{if(recording){recorder.stop();recording=false;$('bMic').classList.remove('rec');$('bMic').textContent='🎤'}},10000)}catch(e){alert('Камера: '+e.message)}}else{recorder.stop();recording=false;$('bMic').classList.remove('rec');$('bMic').textContent='🎤'}};
$('bMic').onclick=async()=>{if(!aC)return;if(!recording){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(s);chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{const b=new Blob(chunks,{type:'audio/webm'});const f=new File([b],`v_${Date.now()}.webm`,{type:'audio/webm'});const p=`${aC}/${Date.now()}_v.webm`;const{error}=await sb.storage.from('media').upload(p,f);if(error)return alert(error.message);const{data:u}=sb.storage.from('media').getPublicUrl(p);const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_voice:true,file_url:u.publicUrl,file_type:'audio/webm',file_name:'Голосовое'}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight;s.getTracks().forEach(t=>t.stop());sb.from('chats').update({last_message:'🎤'}).eq('id',aC).then(()=>{})};recorder.start();recording=true;$('bMic').classList.add('rec');$('bMic').textContent='⏹'}catch(e){alert('Микрофон: '+e.message)}}else{recorder.stop();recording=false;$('bMic').classList.remove('rec');$('bMic').textContent='🎤'}};
$('bEmo').onclick=e=>{e.stopPropagation();const p=$('ep');if(p.parentNode!==document.body)document.body.appendChild(p);p.classList.toggle('show');$('stkP').classList.add('h');$('gifP').classList.add('h');$('brnP').classList.add('h');$('attP').classList.add('h')};
$('ep').addEventListener('emoji-click',e=>{$('msgI').value+=e.detail.unicode;$('msgI').focus()});

// ==================== СТИКЕРЫ ====================
function renderStickers(){const ip=myP?.is_plus;const all=[...stickers,...myStickers];$('stkG').innerHTML=all.map(s=>`<div style="background:var(--p2);border-radius:10px;padding:6px;text-align:center;cursor:pointer;border:2px solid ${s.is_premium?'var(--yellow)':'transparent'}" data-url="${s.url}" data-premium="${s.is_premium}"><img src="${s.url}" style="width:100%;height:46px;object-fit:contain"></div>`).join('')||'<div style="padding:20px;text-align:center;color:var(--t2)">Нет стикеров</div>';$('stkG').querySelectorAll('[data-url]').forEach(el=>{el.onclick=async()=>{if(el.dataset.premium==='true'&&!ip)return alert('👑 Plus');const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,is_sticker:true,file_url:el.dataset.url}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight;$('stkP').classList.add('h')}})}
$('gifS').oninput=db(async e=>{const q=e.target.value.trim()||'hello';try{const r=await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR}&limit=12`);const d=await r.json();$('gifG').innerHTML=(d.results||[]).map(g=>`<div data-full="${g.media[0].gif.url}" style="cursor:pointer;border-radius:10px;overflow:hidden"><img src="${g.media[0].tinygif.url}" style="width:100%;height:100px;object-fit:cover"></div>`).join('');$('gifG').querySelectorAll('[data-full]').forEach(el=>{el.onclick=async()=>{const{data}=await sb.from('messages').insert({chat_id:aC,sender:me.id,is_read:false,file_url:el.dataset.full,file_type:'gif',file_name:'GIF'}).select().single();msgs.push(data);$('msgs').appendChild(buildMsg(data));$('msgs').scrollTop=$('msgs').scrollHeight;$('gifP').classList.add('h')}})}catch(e){$('gifG').innerHTML='<div style="color:#888;padding:20px;text-align:center">Ошибка</div>'}},400);

// ==================== STALKER ====================
$('bStalk').onclick=async()=>{if(!await hasMod('stalker'))return tst('🕵️ Нужен StalkerGram');const{data}=await sb.from('deleted_log').select('*').eq('chat_id',aC).order('deleted_at',{ascending:false}).limit(100);$('bmc').innerHTML=`<h2>🕵️ StalkerGram</h2><div style="max-height:60vh;overflow-y:auto">${(data||[]).length?data.map(d=>`<div style="background:var(--p2);border-radius:10px;padding:10px;margin-bottom:8px"><div style="font-size:11px;color:var(--a);margin-bottom:4px">${new Date(d.deleted_at).toLocaleString('ru')}</div><div style="font-size:13px;white-space:pre-wrap">${esc(d.text||'📎')}</div></div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">Пусто</div>'}</div><button onclick="document.getElementById('bm').classList.remove('show')">Закрыть</button>`;$('bm').classList.add('show')};
$('bMenu').onclick=e=>{e.stopPropagation();if(!aC)return;const pins=JSON.parse(localStorage.getItem('sg_pins')||'[]');const isPin=pins.includes(aC);const c=prompt('1 — '+(isPin?'Открепить':'Закрепить')+'\n2 — Очистить\n3 — Удалить\nНомер:');if(c==='1'){if(isPin)pins.splice(pins.indexOf(aC),1);else pins.push(aC);localStorage.setItem('sg_pins',JSON.stringify(pins));tst(isPin?'📌 Откреплено':'📌 Закреплено');loadChats()}else if(c==='2'){if(confirm('Очистить?'))sb.from('messages').delete().eq('chat_id',aC).then(()=>loadMsgs())}else if(c==='3'){if(confirm('Удалить?'))sb.from('messages').delete().eq('chat_id',aC).then(()=>sb.from('chats').delete().eq('id',aC).then(()=>{back();loadChats()}))}};
$('bSrch').onclick=()=>{const q=prompt('Поиск в чате:');const oldBar=document.querySelector('.chSearchBar');if(oldBar)oldBar.remove();document.querySelectorAll('.mw').forEach(w=>{w.style.opacity='1';w.style.background=''});if(!q)return;let found=0;document.querySelectorAll('.mw').forEach(w=>{const t=(w.querySelector('.m')?.textContent||'').toLowerCase();if(t.includes(q.toLowerCase())){found++;w.style.background='rgba(100,181,200,.15)';w.scrollIntoView({block:'center'})}else w.style.opacity='0.3'});const bar=el('div',{class:'chSearchBar',style:'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--p);padding:8px 14px;border-radius:20px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.4);z-index:100;display:flex;gap:10px;align-items:center',html:`🔍 "${esc(q)}" — ${found}<button style="background:none;color:var(--a);font-size:16px;padding:0 6px" onclick="this.parentNode.remove();document.querySelectorAll('.mw').forEach(w=>{w.style.opacity='1';w.style.background=''})">✕</button>`});document.body.appendChild(bar)};
window.back=()=>{stopPoll();if(autoReadTimer)clearTimeout(autoReadTimer);$('AR').classList.remove('open');$('stkP').classList.add('h');$('gifP').classList.add('h');$('brnP').classList.add('h');$('attP').classList.add('h');$('ep').classList.remove('show');$('msgs').style.background='';$('bnv').classList.remove('h');if(mSub){sb.removeChannel(mSub);mSub=null}const sb_=$('scrollDownBtn');if(sb_)sb_.remove();const csb=document.querySelector('.chSearchBar');if(csb)csb.remove();aC=null;aO=null;aCO=null;loadChats();updateTitleBadge()};
window.viewImg=url=>{const v=document.createElement('div');v.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;justify-content:center;align-items:center;z-index:2000;padding:16px';v.innerHTML=`<img src="${url}" style="max-width:100%;max-height:100%;border-radius:10px"><button style="position:absolute;top:20px;right:20px;color:#fff;font-size:26px;background:rgba(0,0,0,.5);width:44px;height:44px;border-radius:50%">✕</button>`;v.onclick=()=>v.remove();document.body.appendChild(v)};// ==================== ПРОФИЛЬ ====================
window.showProf=async()=>{
  if(!myP)return;
  try{const{data:fresh}=await sb.from('profiles').select('*').eq('id',me.id).single();if(fresh){myP=fresh;profiles[me.id]=fresh}}catch(e){}
  $('pN').value=myP.display_name||'';
  $('pU').value='@'+myP.username;
  $('pPh').value=myP.phone||'';
  $('pB').value=myP.bio||'';
  const p=$('avP');
  p.className='avp'+(myP.is_plus?' gl':'');
  if(myP.avatar_frame)p.classList.add('frame-'+myP.avatar_frame);
  p.innerHTML=myP.avatar_url?`<img src="${myP.avatar_url}">`:esc((myP.display_name||'?')[0].toUpperCase());
  $('profT').innerHTML='Профиль '+(myP.is_plus?'<span style="color:#ffd700">👑</span>':'');
  const es=$('emSt');
  es.innerHTML=EMS.map(e=>`<button style="padding:6px 10px;border-radius:10px;background:${myP.emoji_status===e?'var(--ab)':'var(--p2)'};font-size:20px;border:2px solid transparent" data-e="${e}">${e}</button>`).join('');
  es.querySelectorAll('button').forEach(b=>b.onclick=()=>{myP.emoji_status=myP.emoji_status===b.dataset.e?null:b.dataset.e;showProf()});
  let mc=0,fc=0;
  try{const{data:ch}=await sb.from('chats').select('id').or(`user1.eq.${me.id},user2.eq.${me.id}`).limit(200);if(ch?.length){const{count}=await sb.from('messages').select('*',{count:'exact',head:true}).in('chat_id',ch.map(c=>c.id));mc=count||0}}catch(e){}
  try{const{count}=await sb.from('friends').select('*',{count:'exact',head:true}).eq('user_id',me.id);fc=count||0}catch(e){}
  const plusInfo=myP.is_plus?`<div style="background:linear-gradient(135deg,#ffd700,#ff9500);color:#000;border-radius:12px;padding:12px;text-align:center;font-weight:700;margin:10px 0">👑 Plus${myP.plus_until?' до '+new Date(myP.plus_until).toLocaleDateString('ru'):''}</div>`:'';
  const balBox=`<div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:12px;padding:12px;text-align:center;font-weight:700;margin:10px 0">💰 ${myP.balance||0} SG</div>`;
  const stats=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin:10px 0"><div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--a)">${mc}</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Сообщ</div></div><div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--a)">${fc}</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Друзей</div></div><div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--a)">${myP.gifts_received||0}</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Подар</div></div><div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${(myP.warns||0)>=3?'var(--r)':'var(--a)'}">${myP.warns||0}/3</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Варны</div></div></div>`;
  $('profileStats').innerHTML=plusInfo+balBox+stats;
  $('profM').classList.add('show');
};
$('avP').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=async e=>{const f=e.target.files[0];if(!f)return;const p=`${me.id}/ava_${Date.now()}.jpg`;const{error}=await sb.storage.from('avatars').upload(p,f,{upsert:true});if(error)return alert(error.message);const{data:u}=sb.storage.from('avatars').getPublicUrl(p);await sb.from('profiles').update({avatar_url:u.publicUrl}).eq('id',me.id);myP.avatar_url=u.publicUrl;renderMyA();showProf()};i.click()};
$('bSaveP').onclick=async()=>{const n=$('pN').value.trim();if(!n)return alert('Введи имя');const u={display_name:n,phone:$('pPh').value.trim(),bio:$('pB').value.trim(),emoji_status:myP.emoji_status||null};await sb.from('profiles').update(u).eq('id',me.id);Object.assign(myP,u);renderMyA();tst('✅');$('profM').classList.remove('show')};
$('bOut').onclick=async()=>{if(!confirm('Выйти?'))return;await sb.auth.signOut();localStorage.removeItem('spacegram-auth');location.reload()};
$('bBal').onclick=()=>openBalance();
$('bActivity').onclick=()=>{$('profM').classList.remove('show');showActivity()};
$('hI').onclick=()=>showUP(aO);
$('bQR').onclick=()=>{$('bmc').innerHTML=`<h2>📱 QR профиля</h2><div style="text-align:center;padding:14px 0"><img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=@${myP.username}&bgcolor=17212b&color=64b5ef" style="border-radius:12px;margin:0 auto"></div><div style="text-align:center;font-size:13px;color:var(--t2);margin-bottom:10px">@${esc(myP.username)}</div><button onclick="document.getElementById('bm').classList.remove('show')">Закрыть</button>`;$('bm').classList.add('show')};
$('bExport').onclick=()=>{const data={profile:myP,chats,messages:msgs,stories};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='spacegram-'+myP.username+'.json';a.click();tst('📥 Скачано')};
$('bShare').onclick=async()=>{const url='https://saniapro304-byte.github.io/my-site/?u='+myP.username;if(navigator.share){try{await navigator.share({title:'Spacegram',text:'@'+myP.username,url})}catch(e){}}else{await navigator.clipboard.writeText(url);tst('🔗 Скопировано')}};

// ==================== БЛОКИРОВКА / ДРУЗЬЯ ====================
window.togBlock=async uid=>{const bl=myP.blocked_users||[];const i=bl.indexOf(uid);if(i>=0)bl.splice(i,1);else bl.push(uid);await sb.from('profiles').update({blocked_users:bl}).eq('id',me.id);myP.blocked_users=bl;tst(i>=0?'✓ Разблок':'🚫 Блок');$('usrM').classList.remove('show');loadChats()};
async function isFriend(uid){const{data}=await sb.from('friends').select('id').eq('user_id',me.id).eq('friend_id',uid).maybeSingle();return !!data}
window.togFriend=async uid=>{const{data:ex}=await sb.from('friends').select('id').eq('user_id',me.id).eq('friend_id',uid).maybeSingle();if(ex){await sb.from('friends').delete().eq('id',ex.id);tst('✓ Убран')}else{await sb.from('friends').insert({user_id:me.id,friend_id:uid});tst('✓ В друзьях')}showUP(uid)};

// ==================== ПРОФИЛЬ ДРУГОГО ====================
window.showUP=async uid=>{
  if(!uid)return;
  const p=await getP(uid);if(!p)return;
  const on=p.last_seen&&(Date.now()-new Date(p.last_seen).getTime())<90000&&!p.hide_last_seen;
  const im=uid===me.id;
  const bl=myP?.blocked_users||[];const ib=bl.includes(uid);
  const fr=await isFriend(uid);
  let mc=0;
  try{const{data:ch}=await sb.from('chats').select('id').or(`and(user1.eq.${me.id},user2.eq.${uid}),and(user1.eq.${uid},user2.eq.${me.id})`).limit(1);if(ch?.length){const{count}=await sb.from('messages').select('*',{count:'exact',head:true}).eq('chat_id',ch[0].id);mc=count||0}}catch(e){}
  const frame=p.avatar_frame?'frame-'+p.avatar_frame:'';
  $('usrC').innerHTML=`
    <div class="uv">
      <div class="lg ${p.is_plus?'gl':''} ${frame}">${p.avatar_url&&!p.hide_avatar?`<img src="${p.avatar_url}">`:esc((p.display_name||'?')[0].toUpperCase())}</div>
      <div class="nm">${esc(p.display_name)} ${bd(p)} ${p.emoji_status?`<span style="font-size:18px">${p.emoji_status}</span>`:''}</div>
      <div class="nk">@${esc(p.username)}</div>
      ${p.bio?`<div class="bi" style="background:var(--p2);border-radius:10px;padding:10px;max-width:100%;font-style:italic">"${esc(p.bio)}"</div>`:''}
      <div class="stt">${on?'🟢 в сети':'⚫ '+rt(p.last_seen||Date.now())}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin:14px 0">
      <div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--a)">${mc}</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Сообщ</div></div>
      <div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#10b981">${p.balance||0}</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">SG</div></div>
      <div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--a)">${p.gifts_received||0}</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Подар</div></div>
      <div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${(p.warns||0)>=3?'var(--r)':'var(--a)'}">${p.warns||0}/3</div><div style="font-size:9px;color:var(--t2);text-transform:uppercase">Варны</div></div>
    </div>
    <div style="background:var(--p2);border-radius:10px;padding:12px;font-size:12.5px;line-height:1.7;color:var(--t2)">
      ${p.created_at?`<div><b style="color:var(--t)">📅 Регистрация:</b> ${new Date(p.created_at).toLocaleDateString('ru')}</div>`:''}
      ${p.phone&&!p.hide_phone?`<div><b style="color:var(--t)">📱 Телефон:</b> ${esc(p.phone)}</div>`:''}
      <div><b style="color:var(--t)">👑 Plus:</b> ${p.is_plus?'Да':'Нет'}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      ${!im?`<button onclick="startChat('${uid}').then(()=>document.getElementById('usrM').classList.remove('show'))" style="flex:1;padding:11px;border-radius:12px;background:var(--ab);color:#fff;font-weight:600;font-size:13px">💬 Написать</button>`:''}
      ${!im?`<button onclick="sendGiftTo('${uid}')" style="flex:1;padding:11px;border-radius:12px;background:linear-gradient(135deg,#e91e63,#9c27b0);color:#fff;font-weight:600;font-size:13px">🎁 Подарить</button>`:''}
      ${!im?`<button onclick="giveBalance('${uid}')" style="flex:1;padding:11px;border-radius:12px;background:#10b981;color:#fff;font-weight:600;font-size:13px">💰 Дать SG</button>`:''}
      ${!im?`<button onclick="togFriend('${uid}')" style="flex:1;padding:11px;border-radius:12px;background:var(--bl);color:#fff;font-weight:600;font-size:13px">${fr?'✓ В друзьях':'+ В друзья'}</button>`:''}
      ${!im?`<button onclick="togBlock('${uid}')" style="flex:1;padding:11px;border-radius:12px;background:${ib?'#4ade80':'var(--r)'};color:#fff;font-weight:600;font-size:13px">${ib?'✓ Разблок':'🚫 Блок'}</button>`:''}
    </div>
    <button onclick="document.getElementById('usrM').classList.remove('show')" style="width:100%;padding:12px;border-radius:12px;background:var(--p2);color:var(--t);margin-top:10px">Закрыть</button>
  `;
  $('usrM').classList.add('show');
};
window.sendGiftTo=async uid=>{const days=parseInt(prompt('Сколько дней Plus?','30'))||30;const msg=prompt('Сообщение (пусто):','');const{error}=await sb.from('gifts').insert({sender_id:me.id,receiver_id:uid,days,message:msg||null,claimed:false});if(error)return tst('❌ '+error.message);tst('🎁 Отправлено!');$('usrM').classList.remove('show')};
window.giveBalance=async uid=>{const amt=parseInt(prompt('Сколько SG подарить?','100'))||0;if(!amt||amt<=0)return;if((myP.balance||0)<amt)return tst('❌ Не хватает SG');const ok=await spendBalance(me.id,amt,'Подарок');if(!ok)return tst('❌ Ошибка');await addBalance(uid,amt,'Подарок от @'+myP.username);myP.balance-=amt;tst(`💰 -${amt} SG → подарок`);$('usrM').classList.remove('show')};

// ==================== ГРУППЫ / ОПРОСЫ ====================
$('typeTG').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#typeTG button').forEach(x=>x.classList.toggle('on',x===b));$('grpMT').textContent=b.dataset.t==='channel'?'📢 Канал':b.dataset.t==='secret'?'🔒 Секретный':'👥 Группа'};
$('brnO').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#brnO button').forEach(x=>x.classList.toggle('on',x===b));burnTime=parseInt(b.dataset.b);tst(burnTime?'🔥 '+b.textContent:'🔥 Выкл')};
$('bGrp').onclick=()=>{selM=[];$('gN').value='';$('gS').value='';$('gR').innerHTML='';$('gSel').innerHTML='';$('grpM').classList.add('show')};
$('gS').oninput=db(async e=>{const v=e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');if(v.length<2){$('gR').innerHTML='';return}const{data}=await sb.from('profiles').select('*').ilike('username',`%${v}%`).limit(10);$('gR').innerHTML='';(data||[]).filter(u=>u.id!==me.id).forEach(u=>{const d=el('div',{style:'background:var(--p2);border-radius:12px;padding:10px;margin-bottom:6px;display:flex;gap:10px;align-items:center'});d.innerHTML=`<div style="width:36px;height:36px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;overflow:hidden">${u.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:esc(u.display_name[0].toUpperCase())}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(u.display_name)}</div></div><button style="padding:6px 12px;border-radius:8px;background:var(--ab);color:#fff;font-size:12px">+</button>`;d.querySelector('button').onclick=()=>{if(selM.find(m=>m.id===u.id))return;selM.push(u);$('gSel').innerHTML=selM.map(m=>`<div style="background:var(--p2);padding:4px 8px;border-radius:16px;font-size:11px">${esc(m.display_name)}</div>`).join('')};$('gR').appendChild(d)})},300);
$('bCrG').onclick=async()=>{const tb=document.querySelector('#typeTG button.on');const type=tb?.dataset.t||'group';const n=$('gN').value.trim();if(!n)return alert('Введи название');const{data,error}=await sb.from('chats').insert({user1:me.id,user2:me.id,is_group:type==='group',is_channel:type==='channel',is_secret:type==='secret',group_name:n,created_by:me.id,last_message:'Создано'}).select().single();if(error)return alert(error.message);$('grpM').classList.remove('show');await loadChats();openChat(data.id,null,data)};
$('bCrPoll').onclick=async()=>{const q=$('pollQ').value.trim();const o=Array.from(document.querySelectorAll('.poll-i')).map(i=>i.value.trim()).filter(Boolean);if(!q||o.length<2)return alert('Нужен вопрос и 2+ варианта');const{data:m}=await sb.from('messages').insert({chat_id:aC,sender:me.id,text:'📊 '+q,is_read:false}).select().single();await sb.from('polls').insert({message_id:m.id,question:q,options:o});msgs.push(m);polls[m.id]={id:m.id,message_id:m.id,question:q,options:o};$('msgs').appendChild(buildMsg(m));$('msgs').scrollTop=$('msgs').scrollHeight;$('pollQ').value='';document.querySelectorAll('.poll-i').forEach(i=>i.value='');$('pollM').classList.remove('show')};

// ==================== НАСТРОЙКИ ====================
$('bSet').onclick=()=>{$('cbR').checked=settings.readReceipts!==false;$('cbE').checked=settings.enterSend!==false;$('cbN').checked=settings.notif!==false;$('cbS').checked=settings.sound!==false;$('cbV').checked=settings.vibro!==false;$('cbP').checked=settings.preview!==false;$('cbGhost').checked=myP.ghost_mode||false;$('cbPush').checked=settings.push||false;document.querySelectorAll('#modeT button').forEach(b=>b.classList.toggle('on',b.dataset.m===(settings.mode||'dark')));document.querySelectorAll('#langT button').forEach(b=>b.classList.toggle('on',b.dataset.l===(settings.lang||'ru')));renderThemes();$('setM').classList.add('show')};
const THEMES=[{id:'midnight',c:['#0a0e14','#17212b','#0369a1']},{id:'purple',c:['#1a0f2e','#241642','#7c3aed']},{id:'ocean',c:['#042f2e','#134e4a','#0d9488']},{id:'sunset',c:['#2b1108','#431407','#ea580c']},{id:'rose',c:['#2d0617','#4c0519','#e11d48']},{id:'forest',c:['#052e16','#14532d','#16a34a']},{id:'cyber',c:['#0f0524','#1a0b2e','#a855f7']},{id:'mono',c:['#000','#111','#444']}];
function renderThemes(){$('tgr').innerHTML=THEMES.map(t=>`<button class="tbt ${settings.theme===t.id?'on':''}" data-t="${t.id}"><div class="s2">${t.c.map(c=>`<div style="background:${c}"></div>`).join('')}</div></button>`).join('');$('tgr').querySelectorAll('.tbt').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.t;svS();theme();renderThemes()})}
$('modeT').onclick=e=>{const b=e.target.closest('button');if(!b)return;settings.mode=b.dataset.m;svS();theme();document.querySelectorAll('#modeT button').forEach(x=>x.classList.toggle('on',x===b))};
$('langT').onclick=async e=>{const b=e.target.closest('button');if(!b)return;settings.lang=b.dataset.l;svS();await sb.from('profiles').update({language:b.dataset.l}).eq('id',me.id);myP.language=b.dataset.l;document.querySelectorAll('#langT button').forEach(x=>x.classList.toggle('on',x===b));tst('🌍 '+b.textContent)};
$('cbR').onchange=e=>{settings.readReceipts=e.target.checked;svS()};
$('cbE').onchange=e=>{settings.enterSend=e.target.checked;svS()};
$('cbN').onchange=e=>{settings.notif=e.target.checked;svS()};
$('cbS').onchange=e=>{settings.sound=e.target.checked;svS()};
$('cbV').onchange=e=>{settings.vibro=e.target.checked;svS()};
$('cbP').onchange=e=>{settings.preview=e.target.checked;svS()};
$('cbGhost').onchange=async e=>{const v=e.target.checked;await sb.from('profiles').update({ghost_mode:v}).eq('id',me.id);myP.ghost_mode=v;tst(v?'👻 Ghost вкл':'Ghost выкл')};
$('cbPush').onchange=e=>{settings.push=e.target.checked;svS();if(e.target.checked)initPush()};
$('bCustomSound').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='audio/*';i.onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024)return tst('❌ > 2 МБ');const r=new FileReader();r.onload=()=>{customSoundUrl=r.result;try{localStorage.setItem('sg_sound',customSoundUrl)}catch(e){tst('❌ Слишком большой')}tst('🎵 Установлен')};r.readAsDataURL(f)};i.click()};
$('bWallpaper').onclick=()=>{const colors=['','#0a0a0a','#1a3a1a','#87ceeb','#2b1108','#0f0524'];let h='<h2>🖼️ Обои чата</h2><div class="tg" style="margin-bottom:10px">';colors.forEach(c=>{h+=`<button style="flex:1;min-width:60px;padding:14px;background:${c||'var(--p2)'};border-radius:10px;border:2px solid ${!c?'var(--a)':c}" data-c="${c}">${c?'':'Нет'}</button>`});h+='</div><button onclick="document.getElementById(\'bm\').classList.remove(\'show\')">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show');$('bmc').querySelectorAll('button[data-c]').forEach(b=>b.onclick=async()=>{const c=b.dataset.c;await sb.from('profiles').update({chat_wallpaper:c||null}).eq('id',me.id);myP.chat_wallpaper=c||null;$('msgs').style.background=c||'';tst('✅');$('bm').classList.remove('show')})};

// ==================== PIN ====================
$('bPin').onclick=async()=>{const cur=myP.pin_code?prompt('Текущий PIN:',''):'';if(myP.pin_code&&cur!==myP.pin_code)return tst('❌ Неверно');const nw=prompt('Новый PIN 4 цифры (пусто = отключить):','');if(nw===null)return;if(nw===''){await sb.from('profiles').update({pin_code:null,pin_enabled:false}).eq('id',me.id);myP.pin_code=null;myP.pin_enabled=false;tst('🔓 Отключено')}else if(/^\d{4}$/.test(nw)){await sb.from('profiles').update({pin_code:nw,pin_enabled:true}).eq('id',me.id);myP.pin_code=nw;myP.pin_enabled=true;tst('🔒 Установлен')}else tst('❌ 4 цифры')};
function checkPin(){if(!myP?.pin_enabled||!myP?.pin_code)return;$('pinLock').style.display='flex';let e='';const upd=()=>$('pinDots').textContent=e.padEnd(4,'○').split('').join(' ');const kb=$('pinKb');kb.innerHTML='';['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(n=>{const b=document.createElement('button');b.style.cssText='padding:18px;border-radius:50%;background:var(--p2);font-size:24px;font-weight:600;color:var(--t)';b.textContent=n;b.onclick=()=>{if(n==='⌫'){e=e.slice(0,-1);upd();return}if(!n)return;e+=n;upd();if(e.length===4){if(e===myP.pin_code){$('pinLock').style.display='none';e='';upd()}else{$('pinErr').textContent='❌ Неверно';setTimeout(()=>{e='';upd();$('pinErr').textContent=''},800)}}};kb.appendChild(b)})}

// ==================== ПРОМОКОДЫ ====================
$('bPromo').onclick=()=>{$('profM').classList.remove('show');$('promoI').value='';$('promoS').textContent='';$('promoM').classList.add('show')};
$('bActP').onclick=async()=>{
  const code=$('promoI').value.trim().toUpperCase();
  if(!code)return $('promoS').textContent='Введи код';
  $('promoS').textContent='...';
  const{data:p,error}=await sb.from('promocodes').select('*').eq('code',code).maybeSingle();
  if(error||!p)return $('promoS').textContent='❌ Не найден';
  if(p.uses>=p.max_uses)return $('promoS').textContent='❌ Исчерпан';
  const{data:ex}=await sb.from('promo_activations').select('id').eq('code',code).eq('user_id',me.id).maybeSingle();
  if(ex)return $('promoS').textContent='⚠️ Уже активирован';
  await sb.from('promo_activations').insert({code,user_id:me.id});
  await sb.from('promocodes').update({uses:p.uses+1}).eq('id',p.id);
  if(p.promo_type==='coins'&&p.bonus_coins>0){const nb=await addBalance(me.id,p.bonus_coins,'Промокод '+code);myP.balance=nb;$('promoS').innerHTML=`<span style="color:#10b981">💰 +${p.bonus_coins} SG!</span>`;tst(`💰 +${p.bonus_coins} SG`)}
  else{const isF=p.tariff_code==='forever';const now=new Date();const cur=myP.plus_until&&new Date(myP.plus_until)>now?new Date(myP.plus_until):now;const until=isF?'2099-12-31T23:59:59.000Z':new Date(cur.getTime()+p.days*86400000).toISOString();await sb.from('profiles').update({is_plus:true,plus_until:until}).eq('id',me.id);myP.is_plus=true;myP.plus_until=until;theme();$('promoS').innerHTML=`<span style="color:#ffd700">👑 ${isF?'Навсегда':'На '+p.days+' дн'}!</span>`;tst('👑 Активирован!')}
  setTimeout(()=>$('promoM').classList.remove('show'),1500);
};

// ==================== МОДЫ ====================
$('bMods').onclick=async()=>{
  $('profM').classList.remove('show');
  const{data:mods}=await sb.from('mod_plugins').select('*');
  const{data:act}=await sb.from('mod_activations').select('*').eq('user_id',me.id).gt('active_until',new Date().toISOString());
  const am={};(act||[]).forEach(a=>am[a.mod_code]=a);
  const{data:freshBal}=await sb.from('profiles').select('balance').eq('id',me.id).single();
  myP.balance=freshBal.balance||0;
  const l=$('modsL');
  l.innerHTML=`<div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:10px;padding:10px;text-align:center;font-weight:700;margin-bottom:12px">💰 Баланс: ${myP.balance} SG</div>`;
  (mods||[]).forEach(m=>{
    const a=am[m.code];const price=m.coin_price||100;
    const d=el('div',{style:'background:var(--p2);border-radius:14px;padding:14px;margin-bottom:10px'});
    d.innerHTML=`<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><div style="font-size:32px">${m.icon}</div><div style="flex:1"><div style="font-weight:700;font-size:15px">${esc(m.name)}</div><div style="font-size:11px;color:${a?'var(--g)':'var(--t2)'}">${a?'✓ Активен':'Не активирован'} • 💰${price} SG</div></div></div><div style="font-size:12.5px;color:var(--t2);line-height:1.5;margin-bottom:10px">${esc(m.description)}</div>${!a?`<button style="width:100%;padding:10px;border-radius:10px;background:var(--ab);color:#fff;font-weight:600;font-size:13px;margin-bottom:6px" data-mod="${m.code}">🔑 Промокод</button><button style="width:100%;padding:10px;border-radius:10px;background:#10b981;color:#fff;font-weight:700;font-size:13px" data-buy="${m.code}" data-price="${price}">💰 Купить за ${price} SG</button>`:'<div style="text-align:center;color:var(--g);font-size:12px">✓ Активен</div>'}`;
    const btn=d.querySelector('button[data-mod]');if(btn)btn.onclick=()=>actMod(m.code);
    const buy=d.querySelector('button[data-buy]');if(buy)buy.onclick=()=>buyMod(buy.dataset.buy,parseInt(buy.dataset.price));
    l.appendChild(d);
  });
  $('modsM').classList.add('show');
};
async function buyMod(mc,price){if((myP.balance||0)<price)return tst('❌ Не хватает SG');const ok=await spendBalance(me.id,price,'Покупка '+mc);if(!ok)return tst('❌ Ошибка');const until='2099-12-31T23:59:59.000Z';const{data:ex}=await sb.from('mod_activations').select('id').eq('user_id',me.id).eq('mod_code',mc).maybeSingle();if(ex)await sb.from('mod_activations').update({active_until:until}).eq('id',ex.id);else await sb.from('mod_activations').insert({user_id:me.id,mod_code:mc,active_until:until});const mods=[...new Set([...(myP.mods||[]),mc])];await sb.from('profiles').update({mods}).eq('id',me.id);myP.mods=mods;myP.balance-=price;tst(`✅ Мод куплен! -${price} SG`);$('modsM').classList.remove('show')}
async function actMod(mc){const code=prompt('Промокод мода:');if(!code)return;const up=code.trim().toUpperCase();const{data:p,error}=await sb.from('mod_promocodes').select('*').eq('code',up).eq('mod_code',mc).maybeSingle();if(error||!p)return tst('❌ Не найден');if(p.uses>=p.max_uses)return tst('❌ Исчерпан');const{data:ex}=await sb.from('mod_activations').select('id').eq('user_id',me.id).eq('mod_code',mc).maybeSingle();const isF=p.days>=36500;const until=isF?'2099-12-31T23:59:59.000Z':new Date(Date.now()+p.days*86400000).toISOString();if(ex)await sb.from('mod_activations').update({active_until:until}).eq('id',ex.id);else await sb.from('mod_activations').insert({user_id:me.id,mod_code:mc,active_until:until});await sb.from('mod_promocodes').update({uses:p.uses+1}).eq('id',p.id);const mods=[...new Set([...(myP.mods||[]),mc])];await sb.from('profiles').update({mods}).eq('id',me.id);myP.mods=mods;tst(isF?'♾️ Навсегда!':'✅ На '+p.days+'д');$('modsM').classList.remove('show')}
async function hasMod(c){if(!myP?.mods?.includes(c))return false;const{data}=await sb.from('mod_activations').select('*').eq('user_id',me.id).eq('mod_code',c).maybeSingle();if(!data)return false;return new Date(data.active_until)>new Date()}

// ==================== МАГАЗИН ====================
$('bShop').onclick=async()=>{
  const{data:fresh}=await sb.from('profiles').select('balance,avatar_frame,name_color,chat_wallpaper').eq('id',me.id).single();
  myP.balance=fresh.balance||0;myP.avatar_frame=fresh.avatar_frame;myP.name_color=fresh.name_color;myP.chat_wallpaper=fresh.chat_wallpaper;
  const{data:pu}=await sb.from('user_purchases').select('item_id').eq('user_id',me.id);
  myPurchases=(pu||[]).map(x=>x.item_id);
  $('shopBal').innerHTML='💰 '+myP.balance+' SG';
  renderShop();
  $('shopM').classList.add('show');
};
function renderShop(){
  const frames=shopItems.filter(x=>x.category==='frame');
  const colors=shopItems.filter(x=>x.category==='color');
  const walls=shopItems.filter(x=>x.category==='wallpaper');
  $('shopFrames').innerHTML=frames.map(x=>{const owned=myPurchases.includes(x.id);const active=myP.avatar_frame===x.data;return `<div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center;border:2px solid ${active?'var(--a)':'transparent'}" data-id="${x.id}"><div style="font-size:26px">${x.preview}</div><div style="font-size:11px;font-weight:600;margin:4px 0">${esc(x.name)}</div><div style="font-size:11px;color:${owned?'var(--g)':'var(--a)'}">${owned?'✓ Куплено':'💰'+x.price}</div></div>`}).join('');
  $('shopColors').innerHTML=colors.map(x=>{const owned=myPurchases.includes(x.id);const active=myP.name_color===x.data;return `<div style="background:var(--p2);border-radius:10px;padding:10px;text-align:center;border:2px solid ${active?'var(--a)':'transparent'}" data-id="${x.id}"><div style="font-size:26px">${x.preview}</div><div style="font-size:11px;font-weight:600;margin:4px 0">${esc(x.name)}</div><div style="font-size:11px;color:${owned?'var(--g)':'var(--a)'}">${owned?'✓ Куплено':'💰'+x.price}</div></div>`}).join('');
  $('shopWalls').innerHTML=walls.map(x=>{const owned=myPurchases.includes(x.id);const active=myP.chat_wallpaper===x.data;return `<div style="background:${x.data};border-radius:10px;padding:10px;text-align:center;border:2px solid ${active?'var(--a)':'transparent'};color:#fff" data-id="${x.id}"><div style="font-size:26px">${x.preview}</div><div style="font-size:11px;font-weight:600;margin:4px 0">${esc(x.name)}</div><div style="font-size:11px">${owned?'✓ Куплено':'💰'+x.price}</div></div>`}).join('');
  [...$('shopFrames').querySelectorAll('[data-id]'),...$('shopColors').querySelectorAll('[data-id]'),...$('shopWalls').querySelectorAll('[data-id]')].forEach(card=>{card.style.cursor='pointer';card.onclick=()=>buyOrEquip(card.dataset.id)});
}
async function buyOrEquip(itemId){
  const item=shopItems.find(x=>x.id===itemId);if(!item)return;
  const owned=myPurchases.includes(itemId);
  if(!owned){if((myP.balance||0)<item.price)return tst('❌ Не хватает SG');if(!confirm(`Купить "${item.name}" за ${item.price} SG?`))return;const ok=await spendBalance(me.id,item.price,'Покупка '+item.name);if(!ok)return tst('❌ Ошибка');await sb.from('user_purchases').insert({user_id:me.id,item_id:itemId});myPurchases.push(itemId);myP.balance-=item.price;tst('✅ Куплено!')}
  const upd={};
  if(item.category==='frame'){upd.avatar_frame=myP.avatar_frame===item.data?null:item.data;myP.avatar_frame=upd.avatar_frame}
  else if(item.category==='color'){upd.name_color=myP.name_color===item.data?null:item.data;myP.name_color=upd.name_color}
  else if(item.category==='wallpaper'){upd.chat_wallpaper=myP.chat_wallpaper===item.data?null:item.data;myP.chat_wallpaper=upd.chat_wallpaper;$('msgs').style.background=upd.chat_wallpaper||''}
  await sb.from('profiles').update(upd).eq('id',me.id);
  Object.assign(myP,upd);renderMyA();$('shopBal').innerHTML='💰 '+myP.balance+' SG';renderShop();tst('✅ Установлено');
}
$('bBuyPlus').onclick=async()=>{if((myP.balance||0)<5000)return tst('❌ Нужно 5000 SG');if(!confirm('Купить Plus на 30 дней за 5000 SG?'))return;const ok=await spendBalance(me.id,5000,'Покупка Plus');if(!ok)return tst('❌');const now=new Date();const cur=myP.plus_until&&new Date(myP.plus_until)>now?new Date(myP.plus_until):now;const until=new Date(cur.getTime()+30*86400000).toISOString();await sb.from('profiles').update({is_plus:true,plus_until:until}).eq('id',me.id);myP.is_plus=true;myP.plus_until=until;myP.balance-=5000;theme();renderMyA();tst('👑 Plus на 30 дн!');$('shopBal').innerHTML='💰 '+myP.balance+' SG'};

// ==================== МОИ СТИКЕРЫ ====================
$('bStickers').onclick=async()=>{$('myStickersM').classList.add('show');renderMyStickers()};
function renderMyStickers(){const grid=$('myStkList');if(!myStickers.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--t2);padding:20px;font-size:13px">У тебя пока нет стикеров</div>';return}grid.innerHTML=myStickers.map(s=>`<div style="background:var(--p2);border-radius:10px;padding:8px;text-align:center;position:relative"><img src="${s.url}" style="width:100%;height:60px;object-fit:contain"><button style="position:absolute;top:2px;right:2px;background:var(--r);color:#fff;border-radius:50%;width:20px;height:20px;font-size:12px;display:flex;align-items:center;justify-content:center" data-del="${s.id}">✕</button></div>`).join('');grid.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Удалить стикер?'))return;await sb.from('stickers').delete().eq('id',b.dataset.del);myStickers=myStickers.filter(x=>x.id!==b.dataset.del);renderMyStickers()})}
$('bUploadSticker').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>500*1024)return tst('❌ Максимум 500 КБ');tst('Загрузка...');const p=`stickers/${me.id}_${Date.now()}.png`;const{error}=await sb.storage.from('media').upload(p,f);if(error)return tst('❌ '+error.message);const{data:u}=sb.storage.from('media').getPublicUrl(p);const{data,error:e2}=await sb.from('stickers').insert({url:u.publicUrl,user_id:me.id,name:'Мой стикер',is_public:false,is_premium:false}).select().single();if(e2)return tst('❌ '+e2.message);myStickers.push(data);renderMyStickers();tst('✅ Стикер добавлен')};i.click()};

// ==================== ВЕРИФИКАЦИЯ ====================
$('bVer').onclick=()=>{$('verMsg').value='';curVerB='verified';document.querySelectorAll('#verT button').forEach(b=>b.classList.toggle('on',b.dataset.b==='verified'));$('verM').classList.add('show')};
$('verT').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#verT button').forEach(x=>x.classList.toggle('on',x===b));curVerB=b.dataset.b};
$('bSendVer').onclick=async()=>{const m=$('verMsg').value.trim();if(!m)return tst('Напиши');const{error}=await sb.from('verification_requests').insert({user_id:me.id,requested_badge:curVerB,message:m});if(error)return tst('❌ '+error.message);tst('✅ Отправлено');$('verM').classList.remove('show');try{const{data:ap}=await sb.from('profiles').select('id').eq('username',CREATOR).maybeSingle();if(ap&&ap.id!==me.id){const[u1,u2]=[me.id,ap.id].sort();let{data:c}=await sb.from('chats').select('id').or(`and(user1.eq.${u1},user2.eq.${u2}),and(user1.eq.${u2},user2.eq.${u1})`).limit(1);let cid;if(c?.length)cid=c[0].id;else{const{data:nc}=await sb.from('chats').insert({user1:u1,user2:u2,created_by:me.id}).select().single();cid=nc.id}await sb.from('messages').insert({chat_id:cid,sender:me.id,text:`🤖 Заявка\nГалочка: ${curVerB}\n\n${m}\n\n[VERIFY_REQUEST:${curVerB}]`,is_read:false});await sb.from('chats').update({last_message:'📥 Заявка'}).eq('id',cid)}}catch(e){}};
async function checkVerMsgs(){if(!isAdmin)return;try{const{data}=await sb.from('messages').select('*').ilike('text','%[VERIFY_REQUEST:%').eq('is_read',false).neq('sender',me.id).limit(5);if(!data?.length)return;for(const m of data){await sb.from('messages').update({is_read:true}).eq('id',m.id)}tst('📥 Новая заявка')}catch(e){}}

// ==================== БОТ-ПОМОЩНИК ====================
$('bHelp').onclick=async()=>{
  let{data:bp}=await sb.from('profiles').select('*').eq('username','Spacegramhelperbot').maybeSingle();
  if(!bp){const{data:c,error}=await sb.from('profiles').insert({username:'Spacegramhelperbot',display_name:'💡 Spacegram Helper',bio:'Бот. Команды: /help',is_bot_verified:true,is_verified:true,is_plus:true,last_seen:new Date().toISOString()}).select().single();if(error)return tst('❌ '+error.message);bp=c}
  profiles[bp.id]=bp;
  const[u1,u2]=[me.id,bp.id].sort();
  let{data:c}=await sb.from('chats').select('id').or(`and(user1.eq.${u1},user2.eq.${u2}),and(user1.eq.${u2},user2.eq.${u1})`).limit(1);
  let cid;
  if(c?.length)cid=c[0].id;
  else{const{data:nc}=await sb.from('chats').insert({user1:u1,user2:u2,created_by:me.id,last_message:'👋 /help'}).select().single();cid=nc.id;await sb.from('messages').insert({chat_id:cid,sender:bp.id,text:'👋 Привет! Напиши /help',is_read:false})}
  await loadChats();openChat(cid,bp.id);
};
async function botReply(msg){
  try{
    const{data:bp}=await sb.from('profiles').select('*').eq('username','Spacegramhelperbot').maybeSingle();
    if(!bp||msg.chat_id!==aC)return;
    const{data:ch}=await sb.from('chats').select('*').eq('id',msg.chat_id).single();
    if(!ch||ch.is_group||ch.is_channel)return;
    if(!((ch.user1===bp.id&&ch.user2===me.id)||(ch.user2===bp.id&&ch.user1===me.id)))return;
    const t=(msg.text||'').trim().toLowerCase();
    if(!t)return;
    let ans=null;
    const{data:ex}=await sb.from('bot_answers').select('*').eq('keyword',t).maybeSingle();
    if(ex)ans=ex.answer;
    else{const{data:all}=await sb.from('bot_answers').select('*');const f=(all||[]).find(a=>t.includes(a.keyword.toLowerCase()));if(f)ans=f.answer}
    if(!ans)ans='🤔 Не понимаю. /help';
    setTimeout(async()=>{await sb.from('messages').insert({chat_id:msg.chat_id,sender:bp.id,text:ans,is_read:false});await sb.from('chats').update({last_message:ans.slice(0,50)}).eq('id',msg.chat_id)},400);
  }catch(e){}
}

// ==================== ИЗБРАННОЕ / ДРУЗЬЯ ====================
$('bSaved').onclick=async()=>{let{data:c}=await sb.from('chats').select('id').eq('user1',me.id).eq('user2',me.id).eq('is_group',false).limit(1);let cid;if(c?.length)cid=c[0].id;else{const{data:nc}=await sb.from('chats').insert({user1:me.id,user2:me.id,created_by:me.id,is_group:false,last_message:'📌 Сохранёнки'}).select().single();cid=nc.id}await loadChats();openChat(cid,me.id)};
$('bFriends').onclick=async()=>{const{data}=await sb.from('friends').select('friend_id').eq('user_id',me.id);const ids=(data||[]).map(x=>x.friend_id);let h='<h2>👥 Друзья ('+ids.length+')</h2>';if(!ids.length)h+='<div style="text-align:center;color:var(--t2);padding:20px">Пусто</div>';else{const{data:pr}=await sb.from('profiles').select('*').in('id',ids);(pr||[]).forEach(u=>{h+=`<div style="background:var(--p2);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;cursor:pointer" onclick="startChat('${u.id}');document.getElementById('bm').classList.remove('show')"><div style="width:40px;height:40px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-weight:600;overflow:hidden">${u.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:esc(u.display_name[0].toUpperCase())}</div><div style="flex:1"><div style="font-weight:600">${esc(u.display_name)}</div><div style="font-size:11px;color:var(--t2)">@${esc(u.username)}</div></div></div>`})}h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';$('bmc').innerHTML=h;$('bm').classList.add('show')};

// ==================== ПОДАРКИ ====================
$('bGifts').onclick=async()=>{
  $('profM').classList.remove('show');
  const{data:recv}=await sb.from('gifts').select('*').eq('receiver_id',me.id).order('created_at',{ascending:false});
  const{data:sent}=await sb.from('gifts').select('*').eq('sender_id',me.id).order('created_at',{ascending:false});
  let h='<h2>🎁 Подарки</h2>';
  h+=`<div style="display:flex;gap:8px;margin-bottom:14px"><div style="flex:1;background:var(--p2);border-radius:12px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--a)">${(recv||[]).filter(g=>!g.claimed).length}</div><div style="font-size:11px;color:var(--t2)">Получено</div></div><div style="flex:1;background:var(--p2);border-radius:12px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--a)">${(sent||[]).length}</div><div style="font-size:11px;color:var(--t2)">Отправлено</div></div></div>`;
  h+='<button id="bSendGift" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#e91e63,#9c27b0);color:#fff;font-weight:700;margin-bottom:14px">📤 Подарить Plus</button>';
  const un=(recv||[]).filter(g=>!g.claimed);
  if(un.length){h+='<div style="font-size:11px;color:var(--a);font-weight:700;margin-bottom:8px">📥 НОВЫЕ</div>';un.forEach(g=>{h+=`<div style="background:var(--p2);border-radius:12px;padding:12px;margin-bottom:8px"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><div style="font-size:32px">🎁</div><div style="flex:1"><div style="font-weight:700">👑 Plus ${g.days} дн</div></div></div>${g.message?`<div style="font-size:12px;color:var(--t2);margin-bottom:8px;font-style:italic">"${esc(g.message)}"</div>`:''}<button style="width:100%;padding:10px;border-radius:10px;background:var(--ab);color:#fff;font-weight:600" onclick="claimGift('${g.id}')">✓ Принять</button></div>`})}
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="width:100%;padding:12px;border-radius:12px;background:var(--p2);color:var(--t);margin-top:10px">Закрыть</button>';
  $('bmc').innerHTML=h;$('bm').classList.add('show');
  $('bSendGift').onclick=()=>sendGift();
};
async function sendGift(){
  const un=prompt('@username получателя:');if(!un)return;
  const{data:t,error:e1}=await sb.from('profiles').select('id,display_name').eq('username',un.trim().toLowerCase().replace('@','')).maybeSingle();
  if(e1)return tst('❌ '+e1.message);
  if(!t)return tst('❌ Не найден');
  if(t.id===me.id)return tst('❌ Себе нельзя');
  const days=parseInt(prompt('Дней Plus:','30'))||30;
  const msg=prompt('Сообщение (пусто):','');
  const{error}=await sb.from('gifts').insert({sender_id:me.id,receiver_id:t.id,days,message:msg||null,claimed:false});
  if(error)return tst('❌ '+error.message);
  await sb.from('profiles').update({gifts_sent:(myP.gifts_sent||0)+1}).eq('id',me.id);
  myP.gifts_sent=(myP.gifts_sent||0)+1;
  tst('🎁 Отправлено '+t.display_name);
  $('bm').classList.remove('show');
}
window.claimGift=async gid=>{
  try{
    const{data:g,error:ge}=await sb.from('gifts').select('*').eq('id',gid).maybeSingle();
    if(ge)return tst('❌ '+ge.message);
    if(!g)return tst('❌ Не найден');
    if(g.claimed)return tst('❌ Уже принят');
    const now=new Date();const cur=myP.plus_until&&new Date(myP.plus_until)>now?new Date(myP.plus_until):now;const until=new Date(cur.getTime()+g.days*86400000).toISOString();
    const{error:ue}=await sb.from('gifts').update({claimed:true}).eq('id',gid);
    if(ue)return tst('❌ '+ue.message);
    const{error:pe}=await sb.from('profiles').update({is_plus:true,plus_until:until,gifts_received:(myP.gifts_received||0)+1}).eq('id',me.id);
    if(pe)return tst('❌ '+pe.message);
    myP.is_plus=true;myP.plus_until=until;myP.gifts_received=(myP.gifts_received||0)+1;
    theme();renderMyA();tst(`🎉 +${g.days} дней Plus!`);
    $('bm').classList.remove('show');
  }catch(e){console.error(e);tst('❌ '+e.message)}
};

// ==================== ЖАЛОБЫ ====================
$('repT').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#repT button').forEach(x=>x.classList.toggle('on',x===b));curRepReason=b.dataset.r};
$('bSendRep').onclick=async()=>{if(!curRepMsg)return;const txt=$('repMsg').value.trim();const{error}=await sb.from('reports').insert({reporter_id:me.id,message_id:curRepMsg.id,chat_id:aC,reason:curRepReason+': '+txt});if(error)return tst('❌ '+error.message);tst('🚩 Жалоба отправлена');$('reportM').classList.remove('show');curRepMsg=null};

// ==================== АДМИНКА ====================
$('bAdm').onclick=openAdm;
$('lg').onclick=(()=>{let n=0;return()=>{n++;if(n>=5){openAdm();n=0}}})();
async function openAdm(){try{const{data}=await sb.from('admins').select('id').eq('id',me.id).maybeSingle();if(data||myP?.username===CREATOR){isAdmin=true;$('bAdm').style.display='flex';actuallyOpen();return}}catch(e){}alert('❌ Только для админов')}
function actuallyOpen(){$('apn').classList.add('show');renderAStat();loadAT('users')}
window.closeAdm=()=>{$('apn').classList.remove('show');loadChats()};
$('atab').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#atab button').forEach(x=>x.classList.toggle('on',x===b));loadAT(b.dataset.t)};
async function renderAStat(){try{const[u,m,c]=await Promise.all([sb.from('profiles').select('*',{count:'exact',head:true}),sb.from('messages').select('*',{count:'exact',head:true}),sb.from('chats').select('*',{count:'exact',head:true})]);$('astat').innerHTML=`<div class="a"><div class="n">${u?.count||0}</div><div class="l">Юзеры</div></div><div class="a"><div class="n">${m?.count||0}</div><div class="l">Сообщ</div></div><div class="a"><div class="n">${c?.count||0}</div><div class="l">Чаты</div></div>`}catch(e){}}
let aST=null;
async function loadAT(tab){
  if(tab==='users'){$('abod').innerHTML=`<input style="width:100%;padding:12px 16px;border-radius:12px;background:var(--p2);margin-bottom:12px;font-size:14px;color:var(--t)" id="aSr" placeholder="🔍 Поиск..."><div id="aL"></div>`;$('aSr').oninput=e=>{clearTimeout(aST);aST=setTimeout(()=>loadAU(e.target.value.trim().toLowerCase()),350)};loadAU('')}
  else if(tab==='bans'){$('abod').innerHTML='<div id="aB"></div>';loadAB()}
  else if(tab==='channels'){$('abod').innerHTML='<div id="aCh"></div>';loadACh()}
  else if(tab==='promo'){$('abod').innerHTML='<button id="bNP" style="width:100%;padding:12px;border-radius:12px;background:var(--go);color:#000;font-weight:700;margin-bottom:8px">+ Промокод Plus</button><button id="bNPM" style="width:100%;padding:12px;border-radius:12px;background:var(--bl);color:#fff;font-weight:700;margin-bottom:8px">+ Промокод Мод</button><button id="bNBC" style="width:100%;padding:12px;border-radius:12px;background:#10b981;color:#fff;font-weight:700;margin-bottom:12px">+ Промокод на SG</button><div id="aPr"></div>';$('bNP').onclick=()=>crPromo('plus');$('bNPM').onclick=()=>crPromo('mod');$('bNBC').onclick=()=>crPromo('coins');loadAPr()}
  else if(tab==='gifts'){$('abod').innerHTML='<div id="aGi"></div>';loadAGi()}
  else if(tab==='verify'){$('abod').innerHTML='<div id="aVe"></div>';loadAVe()}
  else if(tab==='reports'){$('abod').innerHTML='<div id="aRep"></div>';loadARep()}
  else if(tab==='modlog'){$('abod').innerHTML='<div id="aML"></div>';loadAML()}
  else if(tab==='mods'){$('abod').innerHTML='<div id="aMods"></div>';loadAMods()}
  else if(tab==='stickers'){$('abod').innerHTML='<div id="aStk"></div>';loadAStk()}
  else if(tab==='stats'){$('abod').innerHTML='<div id="aStats"></div>';loadAStats()}
}
async function loadAU(s){const l=$('aL');if(!l)return;l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Загрузка...</div>';let q=sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(80);if(s.length>=2)q=q.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);const{data}=await q;l.innerHTML='';if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Пусто</div>';return}data.forEach(u=>l.appendChild(buildAC(u)))}
function buildAC(u){const d=el('div',{class:'acd'});const isC=u.username===CREATOR,isO=u.username===OFFICIAL;const ct=isC||isO;d.innerHTML=`<div class="av">${u.avatar_url?`<img src="${u.avatar_url}">`:esc((u.display_name||'?')[0].toUpperCase())}</div><div class="in"><div class="nm">${esc(u.display_name||u.username)} ${bd(u)}</div><div class="nk">@${esc(u.username)} • 💰${u.balance||0} • ⚠️${u.warns||0}/3</div></div><div class="ac"><button class="abt b ${u.is_verified?'':'off'}" data-a="v" ${ct?'disabled style="opacity:.4"':''}>${u.is_verified?'🔵':'✓'}</button><button class="abt yt ${u.is_youtuber?'':'off'}" data-a="yt" ${ct?'disabled style="opacity:.4"':''}>▶</button><button class="abt g ${u.is_plus?'':'off'}" data-a="plus" ${ct?'disabled style="opacity:.4"':''}>👑</button><button class="abt bl" data-a="bal">💰</button><button class="abt wn" data-a="warn">⚠️</button><button class="abt mut" data-a="mute">🔇</button><button class="abt r ${u.is_banned?'':'off'}" data-a="ban" ${ct?'disabled style="opacity:.4"':''}>🚫</button></div>`;d.querySelectorAll('button[data-a]').forEach(b=>{if(!b.disabled)b.onclick=()=>admAct(b.dataset.a,u,b)});return d}
async function admAct(a,u,b){
  try{
    if(a==='v'){const nv=!u.is_verified;await sb.from('profiles').update({is_verified:nv}).eq('id',u.id);b.classList.toggle('off',!nv);b.textContent=nv?'🔵':'✓';delete profiles[u.id];tst(nv?'🔵':'Снято');logMod(u.id,'verify',nv?'выдан':'снят')}
    else if(a==='yt'){const nv=!u.is_youtuber;await sb.from('profiles').update({is_youtuber:nv}).eq('id',u.id);b.classList.toggle('off',!nv);delete profiles[u.id];tst(nv?'▶':'Снято');logMod(u.id,'yt',nv?'выдан':'снят')}
    else if(a==='plus'){const nv=!u.is_plus;const pu=nv?new Date(Date.now()+30*86400000).toISOString():null;await sb.from('profiles').update({is_plus:nv,plus_until:pu}).eq('id',u.id);b.classList.toggle('off',!nv);delete profiles[u.id];tst(nv?'👑':'Снято');logMod(u.id,'plus',nv?'выдан 30д':'снят')}
    else if(a==='ban'){if(u.is_banned){await sb.from('profiles').update({is_banned:false,ban_reason:null,warns:0}).eq('id',u.id);b.classList.add('off');tst('✓ Разбан');logMod(u.id,'unban','')}else{const r=prompt('Причина:','Нарушение');if(r===null)return;await sb.from('profiles').update({is_banned:true,ban_reason:r,banned_at:new Date().toISOString(),banned_by:me.id}).eq('id',u.id);b.classList.remove('off');tst('🚫');logMod(u.id,'ban',r)}delete profiles[u.id]}
    else if(a==='warn'){const r=prompt('Причина варна:','Нарушение правил');if(r===null)return;await sendWarn(u.id,r)}
    else if(a==='mute'){const t=prompt('Мут на сколько минут? (0 = снять)','60');if(!t)return;const m=parseInt(t);if(m<=0){await sb.from('profiles').update({muted_until:null}).eq('id',u.id);tst('🔊 Мут снят');logMod(u.id,'unmute','')}else{const until=new Date(Date.now()+m*60000).toISOString();await sb.from('profiles').update({muted_until:until}).eq('id',u.id);tst('🔇 Мут '+m+' мин');logMod(u.id,'mute',m+' мин')}}
    else if(a==='bal'){const cur=prompt(`Баланс @${u.username}: ${u.balance||0} SG\n\nСумма (+ пополнить, - списать):`,'100');if(!cur)return;const amt=parseInt(cur);if(!amt)return;const note=prompt('Комментарий:','Начисление админа')||'';const nb=await addBalance(u.id,amt,note);u.balance=nb;tst(`💰 ${amt>0?'+':''}${amt} → @${u.username} (${nb} SG)`);const card=b.closest('.acd');if(card){const nk=card.querySelector('.nk');if(nk)nk.textContent='@'+u.username+' • 💰'+nb+' • ⚠️'+(u.warns||0)+'/3'}}
  }catch(e){alert('Ошибка: '+e.message)}
}
async function loadAB(){const l=$('aB');const{data}=await sb.from('profiles').select('*').eq('is_banned',true);if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Никого 🎉</div>';return}l.innerHTML='';data.forEach(u=>{const d=el('div',{class:'acd'});d.innerHTML=`<div class="av">${u.avatar_url?`<img src="${u.avatar_url}">`:esc((u.display_name||'?')[0].toUpperCase())}</div><div class="in"><div class="nm">${esc(u.display_name||u.username)}</div><div class="nk">@${esc(u.username)} • ${esc(u.ban_reason||'')}</div></div><div class="ac"><button class="abt gr" data-a="unban">✓ Разбан</button></div>`;d.querySelector('[data-a="unban"]').onclick=async()=>{await sb.from('profiles').update({is_banned:false,ban_reason:null,warns:0}).eq('id',u.id);delete profiles[u.id];loadAB()};l.appendChild(d)})}
async function loadACh(){const l=$('aCh');const{data}=await sb.from('chats').select('*').eq('is_channel',true);if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Нет каналов</div>';return}l.innerHTML='';data.forEach(c=>{const d=el('div',{class:'acd'});d.innerHTML=`<div class="av" style="background:var(--ab)">📢</div><div class="in"><div class="nm">${esc(c.group_name)}</div></div><div class="ac"><button class="abt ${c.is_official?'r':'b'}" data-a="off">${c.is_official?'Снять':'✓'}</button></div>`;d.querySelector('[data-a="off"]').onclick=async()=>{await sb.from('chats').update({is_official:!c.is_official}).eq('id',c.id);tst('✅');loadACh()};l.appendChild(d)})}
async function crPromo(type){
  const code=prompt('Код:');if(!code)return;
  const up=code.trim().toUpperCase();
  const maxUses=parseInt(prompt('Макс. использований:','100'))||100;
  if(type==='plus'){const tariff=prompt('Тариф: bronze/silver/gold/premium/forever','bronze');if(!tariff)return;const days={bronze:7,silver:30,gold:90,premium:365,forever:36500}[tariff]||30;const{error}=await sb.from('promocodes').insert({code:up,days,max_uses:maxUses,tariff_code:tariff,promo_type:'plus',created_by:me.id});if(error)return tst('❌ '+error.message)}
  else if(type==='mod'){const mod=prompt('Мод: stalker/ghost/antidelete','stalker');if(!mod)return;const days=parseInt(prompt('Дней:','30'))||30;const{error}=await sb.from('mod_promocodes').insert({code:up,mod_code:mod,days,max_uses:maxUses,created_by:me.id});if(error)return tst('❌ '+error.message)}
  else if(type==='coins'){const coins=parseInt(prompt('Сколько SG?','100'))||100;const{error}=await sb.from('promocodes').insert({code:up,days:0,max_uses:maxUses,promo_type:'coins',bonus_coins:coins,created_by:me.id});if(error)return tst('❌ '+error.message)}
  tst('✅ Создан: '+up);loadAPr();
}
async function loadAPr(){const l=$('aPr');if(!l)return;const{data:p}=await sb.from('promocodes').select('*').order('created_at',{ascending:false}).limit(50);const{data:m}=await sb.from('mod_promocodes').select('*').order('created_at',{ascending:false}).limit(50);l.innerHTML='';(p||[]).forEach(x=>{const isCoins=x.promo_type==='coins';const d=el('div',{style:'background:var(--p2);border-radius:12px;padding:12px;margin-bottom:8px'});d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:15px;font-weight:800;color:var(--a)">${esc(x.code)}</div><div style="background:${isCoins?'#10b981':'var(--go)'};color:${isCoins?'#fff':'#000'};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${isCoins?'💰 '+x.bonus_coins+' SG':'👑 '+x.days+'д'}</div></div>`;l.appendChild(d)});(m||[]).forEach(x=>{const d=el('div',{style:'background:var(--p2);border-radius:12px;padding:12px;margin-bottom:8px'});d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:15px;font-weight:800;color:var(--a)">${esc(x.code)}</div><div style="background:var(--bl);color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">🧩 ${x.mod_code}</div></div>`;l.appendChild(d)})}
async function loadAGi(){const l=$('aGi');const{data}=await sb.from('gifts').select('*').order('created_at',{ascending:false}).limit(50);if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Нет подарков</div>';return}const uids=[...new Set(data.flatMap(g=>[g.sender_id,g.receiver_id]).filter(Boolean))];const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p);l.innerHTML='';data.forEach(g=>{const s=profiles[g.sender_id],r=profiles[g.receiver_id];const d=el('div',{style:'background:var(--p2);border-radius:12px;padding:12px;margin-bottom:8px'});d.innerHTML=`<div style="font-size:13px">🎁 <b>${esc(s?.display_name||'?')}</b> → <b>${esc(r?.display_name||'?')}</b></div><div style="font-size:11px;color:var(--t2);margin-top:4px">${g.days}д • ${g.claimed?'✅':'⏳'}</div>`;l.appendChild(d)})}
async function loadAVe(){const l=$('aVe');const{data}=await sb.from('verification_requests').select('*').eq('status','pending').order('created_at',{ascending:false});if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Нет заявок</div>';return}const uids=[...new Set(data.map(r=>r.user_id))];const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p);l.innerHTML='';data.forEach(r=>{const u=profiles[r.user_id];if(!u)return;const d=el('div',{style:'background:var(--p2);border-radius:12px;padding:12px;margin-bottom:10px'});d.innerHTML=`<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><div style="width:40px;height:40px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-weight:600;overflow:hidden">${u.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:esc(u.display_name[0].toUpperCase())}</div><div style="flex:1"><div style="font-weight:600">${esc(u.display_name)}</div><div style="font-size:11px;color:var(--t2)">@${esc(u.username)}</div></div></div><div style="font-size:12px;background:var(--p);padding:8px;border-radius:8px;margin-bottom:8px;white-space:pre-wrap">${esc(r.message)}</div><div style="display:flex;gap:6px"><button class="abt b" data-a="verified">🔵</button><button class="abt yt" data-a="youtuber">▶</button><button class="abt r" data-a="reject">✕</button></div>`;d.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>handleVer(r,b.dataset.a));l.appendChild(d)})}
window.handleVer=async(r,a)=>{try{if(a==='reject'){await sb.from('verification_requests').update({status:'rejected',reviewed_by:me.id,reviewed_at:new Date().toISOString()}).eq('id',r.id);tst('❌')}else{const u={};if(a==='verified')u.is_verified=true;else if(a==='youtuber')u.is_youtuber=true;await sb.from('profiles').update(u).eq('id',r.user_id);await sb.from('verification_requests').update({status:'approved',reviewed_by:me.id,reviewed_at:new Date().toISOString()}).eq('id',r.id);delete profiles[r.user_id];tst('✅ '+a)}loadAVe()}catch(e){tst('❌ '+e.message)}};
async function loadARep(){const l=$('aRep');const{data}=await sb.from('reports').select('*').eq('status','pending').order('created_at',{ascending:false}).limit(50);if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Нет жалоб</div>';return}const uids=[...new Set(data.map(r=>r.reporter_id))];const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p);l.innerHTML='';data.forEach(r=>{const u=profiles[r.reporter_id];const d=el('div',{style:'background:var(--p2);border-radius:12px;padding:12px;margin-bottom:10px'});d.innerHTML=`<div style="font-size:13px;font-weight:600">🚩 От @${esc(u?.username||'?')}</div><div style="font-size:12px;color:var(--t2);margin-top:6px">${esc(r.reason||'Без причины')}</div><div style="font-size:10px;color:var(--t2);margin-top:4px">${new Date(r.created_at).toLocaleString('ru')}</div><div style="display:flex;gap:6px;margin-top:10px"><button class="abt gr" data-a="ok">✓ Обработано</button><button class="abt r" data-a="rej">✕ Отклонить</button></div>`;d.querySelectorAll('button[data-a]').forEach(b=>b.onclick=async()=>{await sb.from('reports').update({status:'closed',reviewed_by:me.id}).eq('id',r.id);tst('✅');loadARep()});l.appendChild(d)})}
async function loadAML(){const l=$('aML');const{data}=await sb.from('mod_log').select('*').order('created_at',{ascending:false}).limit(100);if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Пусто</div>';return}const ids=[...new Set(data.flatMap(x=>[x.admin_id,x.target_id]).filter(Boolean))];const{data:pr}=await sb.from('profiles').select('id,username,display_name').in('id',ids);const pm={};(pr||[]).forEach(p=>pm[p.id]=p);l.innerHTML='';data.forEach(x=>{const a=pm[x.admin_id],t=pm[x.target_id];const d=el('div',{style:'background:var(--p2);border-radius:10px;padding:10px;margin-bottom:8px;font-size:12px'});d.innerHTML=`<div><b style="color:var(--a)">@${esc(a?.username||'?')}</b> → <b>@${esc(t?.username||'?')}</b></div><div style="color:var(--t2);margin-top:4px"><b>${esc(x.action)}</b> ${esc(x.details||'')}</div><div style="color:var(--t2);font-size:10px;margin-top:4px">${new Date(x.created_at).toLocaleString('ru')}</div>`;l.appendChild(d)})}
async function loadAMods(){const l=$('aMods');const{data:m}=await sb.from('mod_promocodes').select('*').order('created_at',{ascending:false});const{data:a}=await sb.from('mod_activations').select('*').gt('active_until',new Date().toISOString());let h=`<div style="background:var(--p2);border-radius:12px;padding:14px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><div style="font-size:22px;font-weight:800;color:var(--a)">${(a||[]).length}</div><div style="font-size:10px;color:var(--t2);text-transform:uppercase">Активных</div></div><div><div style="font-size:22px;font-weight:800;color:var(--a)">${(m||[]).length}</div><div style="font-size:10px;color:var(--t2);text-transform:uppercase">Промокодов</div></div></div>`;h+='<button id="bNMod" style="width:100%;padding:12px;border-radius:12px;background:var(--bl);color:#fff;font-weight:700;margin-bottom:12px">+ Создать промокод мода</button>';(m||[]).forEach(x=>{h+=`<div style="background:var(--p2);border-radius:12px;padding:12px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:15px;font-weight:800;color:var(--a)">${esc(x.code)}</div><div style="background:var(--bl);color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${x.mod_code} • ${x.days}д</div></div></div>`});l.innerHTML=h;$('bNMod').onclick=async()=>{const code=prompt('Код:');if(!code)return;const mod=prompt('Мод: stalker/ghost/antidelete','stalker');if(!mod)return;const days=parseInt(prompt('Дней:','30'))||30;const{error}=await sb.from('mod_promocodes').insert({code:code.trim().toUpperCase(),mod_code:mod,days,max_uses:1000,created_by:me.id});if(error)return tst('❌ '+error.message);tst('✅');loadAMods()}}
async function loadAStk(){const l=$('aStk');const{data}=await sb.from('stickers').select('*').order('created_at',{ascending:false}).limit(100);if(!data?.length){l.innerHTML='<div style="text-align:center;color:var(--t2);padding:40px">Нет стикеров</div>';return}l.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${data.map(s=>`<div style="background:var(--p2);border-radius:10px;padding:8px;text-align:center;position:relative"><img src="${s.url}" style="width:100%;height:60px;object-fit:contain"><button style="position:absolute;top:2px;right:2px;background:var(--r);color:#fff;border-radius:50%;width:20px;height:20px;font-size:12px" data-del="${s.id}">✕</button></div>`).join('')}</div>`;l.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Удалить?'))return;await sb.from('stickers').delete().eq('id',b.dataset.del);loadAStk()})}
async function loadAStats(){const l=$('aStats');try{const[u,m,c,p,f,g,plus,ban]=await Promise.all([sb.from('profiles').select('*',{count:'exact',head:true}),sb.from('messages').select('*',{count:'exact',head:true}),sb.from('chats').select('*',{count:'exact',head:true}),sb.from('posts').select('*',{count:'exact',head:true}),sb.from('friends').select('*',{count:'exact',head:true}),sb.from('gifts').select('*',{count:'exact',head:true}),sb.from('profiles').select('*',{count:'exact',head:true}).eq('is_plus',true),sb.from('profiles').select('*',{count:'exact',head:true}).eq('is_banned',true)]);l.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--a)">${u?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Юзеров</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--a)">${m?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Сообщений</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--a)">${c?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Чатов</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--a)">${p?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Постов</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:#ffd700">${plus?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Plus</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--r)">${ban?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Забанено</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--a)">${f?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Дружб</div></div><div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:#e91e63">${g?.count||0}</div><div style="font-size:11px;color:var(--t2);text-transform:uppercase">Подарков</div></div></div>`}catch(e){l.innerHTML='<div style="color:var(--r);padding:20px">Ошибка: '+e.message+'</div>'}}// ==================== ИСТОРИИ ====================
async function loadStories(){
  try{
    const{data}=await sb.from('stories').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true});
    stories=data||[];
    storiesByU={};
    const uids=[...new Set(stories.map(s=>s.user_id))].filter(id=>!profiles[id]);
    if(uids.length){const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p)}
    const{data:v}=await sb.from('story_views').select('story_id').eq('viewer_id',me.id);
    const vs=new Set((v||[]).map(x=>x.story_id));
    stories.forEach(s=>{if(!storiesByU[s.user_id])storiesByU[s.user_id]=[];s._viewed=vs.has(s.id);storiesByU[s.user_id].push(s)});
    const su=Object.keys(storiesByU).sort((a,b)=>{
      if(a===me.id)return-1;
      if(b===me.id)return 1;
      const au=storiesByU[a].some(s=>!s._viewed);
      const bu=storiesByU[b].some(s=>!s._viewed);
      if(au&&!bu)return-1;
      if(!au&&bu)return 1;
      return new Date(storiesByU[a][0].created_at)-new Date(storiesByU[b][0].created_at)
    });
    renderSBar(su);
  }catch(e){}
}
function renderSBar(su){
  const b=$('sBar');if(!b)return;
  b.innerHTML='';
  const ms=storiesByU[me.id]||[];
  const mi=el('div',{class:'sti'});
  const ma=el('div',{class:'sa '+(ms.length?'':'mine')+(ms.length&&ms.every(s=>s._viewed)?' seen':'')});
  ma.innerHTML=myP.avatar_url?`<img src="${myP.avatar_url}">`:`<div class="ini">${esc((myP.display_name||'?')[0].toUpperCase())}</div>`;
  ma.innerHTML+=`<div class="plus">+</div>`;
  ma.onclick=()=>{if(ms.length)return openSV(me.id);if(!myP?.is_plus)return tst('👑 Истории только для Plus');openCS()};
  mi.appendChild(ma);
  mi.appendChild(el('div',{class:'sn mine',text:ms.length?'Моя':'Добавить'}));
  b.appendChild(mi);
  su.filter(u=>u!==me.id).forEach(u=>{
    const us=storiesByU[u];const p=profiles[u];if(!p)return;
    const av=us.every(s=>s._viewed);
    const i=el('div',{class:'sti'});
    const a=el('div',{class:'sa'+(av?' seen':'')});
    a.innerHTML=p.avatar_url?`<img src="${p.avatar_url}">`:`<div class="ini">${esc((p.display_name||'?')[0].toUpperCase())}</div>`;
    a.onclick=()=>openSV(u);
    i.appendChild(a);
    i.appendChild(el('div',{class:'sn',text:p.display_name||'?'}));
    b.appendChild(i);
  });
}
function openCS(){
  if(!myP?.is_plus)return tst('👑 Только Plus');
  sFile=null;sBg=null;sText='';
  $('csB').innerHTML=`<div class="emp"><div class="ic">📷</div><div style="margin-bottom:14px">Выбери фото или видео</div><button style="padding:14px 28px;border-radius:14px;background:var(--ab);color:#fff;font-size:15px;font-weight:600" onclick="pickSM()">Открыть галерею</button></div>`;
  renderBGP();
  $('crS').classList.add('show');
}
function renderBGP(){
  const p=$('bgP');
  p.innerHTML=BG.map(c=>`<button style="background:${c}" data-c="${c}" class="${sBg===c?'on':''}"></button>`).join('')+`<button style="background:transparent;border:2px dashed #666;color:#fff;font-size:16px" data-c="none">✕</button>`;
  p.querySelectorAll('button').forEach(b=>b.onclick=()=>{sBg=b.dataset.c==='none'?null:b.dataset.c;renderBGP();applySBG()});
}
function applySBG(){const b=$('csB');if(sBg)b.style.background=sBg;else b.style.background=''}
window.pickSB=()=>{renderBGP()};
window.pickSM=()=>{
  const i=document.createElement('input');
  i.type='file';i.accept='image/*,video/*';
  i.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>50*1024*1024)return alert('> 50 МБ');
    sFile=f;
    sType=f.type.startsWith('video')?'video':'image';
    const u=URL.createObjectURL(f);
    $('csB').innerHTML=sType==='video'?`<video src="${u}" autoplay muted loop playsinline style="max-width:100%;max-height:100%;object-fit:contain"></video>`:`<img src="${u}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    applySBG();
  };
  i.click();
};
window.addST=()=>{
  const t=prompt('Текст:',sText||'');if(t===null)return;
  sText=t.trim();
  let o=$('csOv');
  if(!o){o=el('div',{id:'csOv',style:'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;color:#fff;font-size:24px;font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.5);pointer-events:none'});$('csB').appendChild(o)}
  o.textContent=sText;
};
window.closeCS=()=>{$('crS').classList.remove('show');$('csB').style.background='';sFile=null;sBg=null;sText=''};
window.pubS=async()=>{
  if(!myP?.is_plus)return tst('👑 Только Plus');
  if(!sFile&&!sText)return tst('Добавь фото или текст');
  tst('Публикация...');
  let mu=null,mt=null;
  if(sFile){
    const e=sFile.name.split('.').pop()||'jpg';
    const p=`${me.id}/story_${Date.now()}.${e}`;
    const{error}=await sb.storage.from('media').upload(p,sFile);
    if(error)return tst('Ошибка: '+error.message);
    const{data:u}=sb.storage.from('media').getPublicUrl(p);
    mu=u.publicUrl;mt=sType;
  }
  const ins={user_id:me.id,media_url:mu||'',media_type:mt||'text'};
  if(sText)ins.text_content=sText;
  if(sBg)ins.bg_color=sBg;
  const{error}=await sb.from('stories').insert(ins);
  if(error)return tst('Ошибка: '+error.message);
  tst('✅');closeCS();await loadStories();
};
async function openSV(uid){
  const us=storiesByU[uid];
  if(!us?.length){tst('Нет историй');return}
  svState.uId=uid;svState.i=0;
  $('svV').classList.add('show');
  try{await showSV()}catch(e){console.error(e);tst('❌ '+e.message);closeSV()}
}
async function showSV(){
  try{
    const us=storiesByU[svState.uId];
    if(!us||!us[svState.i]){closeSV();return}
    const i=svState.i;
    const s=us[i];
    const p=profiles[s.user_id];
    $('svP').innerHTML=us.map((x,idx)=>`<div class="b ${idx<i?'dn':''}"><div class="f" id="pf_${idx}"></div></div>`).join('');
    $('svH').innerHTML=`<div class="av">${p?.avatar_url?`<img src="${p.avatar_url}">`:esc((p?.display_name||'?')[0].toUpperCase())}</div><div class="in"><div class="nm">${esc(p?.display_name||'?')} ${bd(p||{})}</div><div class="tm">${rt(s.created_at)}</div></div>`;
    let c='';
    if(s.media_url&&s.media_type==='video')c=`<video src="${s.media_url}" autoplay muted playsinline style="max-width:100%;max-height:100%;object-fit:contain"></video>`;
    else if(s.media_url)c=`<img src="${s.media_url}" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.style.display='none'">`;
    if(s.text_content)c+=`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;color:#fff;font-size:24px;font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.5);pointer-events:none">${esc(s.text_content)}</div>`;
    if(!c)c='<div style="color:#fff;font-size:14px;opacity:.5">Пустая</div>';
    $('svC').innerHTML=c;
    $('svC').style.background=s.bg_color||'#000';
    if(s.user_id===me.id){
      $('svF').innerHTML=`<button class="ic" style="width:auto;padding:0 16px;border-radius:24px;display:flex;align-items:center;gap:6px" onclick="showSVViews('${s.id}')">👁 <span id="svc">...</span></button>`;
      try{const{count}=await sb.from('story_views').select('*',{count:'exact',head:true}).eq('story_id',s.id);const e=$('svc');if(e)e.textContent=count||0}catch(e){}
    }else{
      $('svF').innerHTML=`<input id="svReply" placeholder="Ответить..." onkeydown="if(event.key==='Enter')replySV()"><button class="ic" onclick="reactSV('❤️')">❤️</button><button class="ic" style="background:var(--ab)" onclick="replySV()">➤</button>`;
    }
    if(s.user_id!==me.id&&!s._viewed){
      try{await sb.from('story_views').insert({story_id:s.id,viewer_id:me.id});s._viewed=true}catch(e){}
    }
    startST(s.duration||5);
  }catch(e){console.error(e);closeSV()}
}
function startST(sec){
  clearInterval(svState.timer);
  const f=$('pf_'+svState.i);if(!f)return;
  f.style.width='0%';
  let e=0;
  const t=sec*1000,s=50;
  svState.timer=setInterval(()=>{
    e+=s;
    f.style.width=Math.min(100,e/t*100)+'%';
    if(e>=t){clearInterval(svState.timer);nextS()}
  },s);
}
window.nextS=()=>{
  clearInterval(svState.timer);
  const us=storiesByU[svState.uId];
  if(svState.i<us.length-1){svState.i++;showSV()}
  else{
    const u=Object.keys(storiesByU);
    const ci=u.indexOf(svState.uId);
    if(ci<u.length-1){svState.uId=u[ci+1];svState.i=0;showSV()}
    else closeSV();
  }
};
window.prevS=()=>{clearInterval(svState.timer);if(svState.i>0){svState.i--;showSV()}};
window.closeSV=()=>{clearInterval(svState.timer);$('svV').classList.remove('show');$('svC').style.background='';loadStories()};
window.reactSV=async e=>{
  const s=storiesByU[svState.uId][svState.i];if(!s)return;
  const{data:ex}=await sb.from('story_reactions').select('id').eq('story_id',s.id).eq('user_id',me.id).maybeSingle();
  if(ex)await sb.from('story_reactions').update({emoji:e}).eq('id',ex.id);
  else await sb.from('story_reactions').insert({story_id:s.id,user_id:me.id,emoji:e});
  tst(e);
};
window.replySV=async()=>{
  const s=storiesByU[svState.uId][svState.i];
  const i=$('svReply');const t=i?.value.trim();
  if(!t||!s)return;
  const oid=s.user_id;
  const[u1,u2]=[me.id,oid].sort();
  let{data:c}=await sb.from('chats').select('id').or(`and(user1.eq.${u1},user2.eq.${u2}),and(user1.eq.${u2},user2.eq.${u1})`).limit(1);
  let cid;
  if(c?.length)cid=c[0].id;
  else{const{data:nc}=await sb.from('chats').insert({user1:u1,user2:u2,created_by:me.id}).select().single();cid=nc.id}
  await sb.from('messages').insert({chat_id:cid,sender:me.id,text:`↩ ${t}`,is_read:false});
  i.value='';tst('✅');
};
window.showSVViews=async sid=>{
  const{data:v}=await sb.from('story_views').select('*').eq('story_id',sid).order('viewed_at',{ascending:false});
  const uids=[...new Set((v||[]).map(x=>x.viewer_id))].filter(id=>!profiles[id]);
  if(uids.length){const{data:pr}=await sb.from('profiles').select('*').in('id',uids);(pr||[]).forEach(p=>profiles[p.id]=p)}
  let h=`<h2>👁 ${v?.length||0}</h2>`;
  (v||[]).forEach(x=>{
    const p=profiles[x.viewer_id];if(!p)return;
    h+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0"><div style="width:36px;height:36px;border-radius:50%;background:var(--ab);display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden">${p.avatar_url?`<img src="${p.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:esc(p.display_name[0].toUpperCase())}</div><div style="flex:1">${esc(p.display_name)}</div></div>`;
  });
  h+='<button onclick="document.getElementById(\'bm\').classList.remove(\'show\')" style="margin-top:10px">Закрыть</button>';
  $('bmc').innerHTML=h;$('bm').classList.add('show');
};

// ==================== ФИНАЛЬНЫЕ ОБРАБОТЧИКИ ====================
document.addEventListener('click',e=>{
  if(!e.target.closest('.ep'))$('ep').classList.remove('show');
  if(!e.target.closest('#stkP')&&!e.target.closest('#as'))$('stkP').classList.add('h');
  if(!e.target.closest('#gifP')&&!e.target.closest('#ag'))$('gifP').classList.add('h');
  if(!e.target.closest('#brnP')&&!e.target.closest('#ab'))$('brnP').classList.add('h');
  if(!e.target.closest('#attP')&&!e.target.closest('#bPlus'))$('attP').classList.add('h');
  if(!e.target.closest('.mw'))document.querySelectorAll('.mw.tb').forEach(w=>w.classList.remove('tb'));
});

sb.auth.onAuthStateChange((ev,ses)=>{
  if(ev==='SIGNED_IN'&&ses&&!me){me=ses.user;setTimeout(()=>enterApp(),100)}
  if(ev==='SIGNED_OUT')localStorage.removeItem('spacegram-auth');
});

// ==================== СТАРТ ====================
const showD=m=>{let d=$('D');if(d)d.textContent=m};
(async()=>{
  try{
    showD('▶ Старт');
    theme();
    showD('▶ Проверка сессии');
    const{data:{session},error:se}=await TMOUT(sb.auth.getSession(),10000,'getSession');
    if(se)throw new Error(se.message);
    if(session&&session.user){showD('▶ Загрузка приложения');me=session.user;await enterApp()}
    else{showD('▶ Вход');$('A').classList.add('show');hl()}
  }catch(e){
    showD('❌ '+e.message);
    setTimeout(()=>{hl();$('A').classList.add('show')},2500);
  }
})();
setTimeout(()=>{if($('L')&&!$('L').classList.contains('h')){hl();if(!me)$('A').classList.add('show')}},12000);

// ==================== ГОТОВО ====================
