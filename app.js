/* ============================================================
   SPACEGRAM v12 — FULL REWRITE
   Часть 1: Ядро, Supabase, helpers, авторизация
   ============================================================ */

// ============ МУЛЬТИ-CDN ЗАГРУЗЧИК ============
const CDNS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/+esm',
  'https://esm.sh/@supabase/supabase-js@2.39.7',
  'https://cdn.skypack.dev/@supabase/supabase-js@2.39.7'
];

async function loadSupabase() {
  let lastErr;
  for (const url of CDNS) {
    try {
      const mod = await import(url);
      if (mod.createClient) {
        console.log('✅ Supabase CDN:', url);
        return mod.createClient;
      }
    } catch (e) {
      lastErr = e;
      console.warn('❌ CDN failed:', url, e.message);
    }
  }
  throw lastErr || new Error('Все CDN упали');
}

// ============ КОНСТАНТЫ ============
const SUPABASE_URL = 'https://qtuvtxbxtypvttfjiydv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA';

let sb = null;

// ============ STATE ============
const state = {
  user: null,
  profile: null,
  chats: [],
  currentChat: null,
  messages: [],
  replyTo: null,
  burnAfter: 0,
  stickers: [],
  pollTimer: null,
  realtimeChats: null,
  realtimeMsgs: null,
  typingTimer: null,
  draftTimer: null,
  adminUsers: [],
  adminFilter: '',
  adminTab: 'users',
  currentStoryUser: null,
  currentStoryIndex: 0,
  storyList: [],
  settings: {
    theme: localStorage.getItem('sg_theme') || 'midnight',
    mode: localStorage.getItem('sg_mode') || 'dark',
    lang: localStorage.getItem('sg_lang') || 'ru',
    sound: localStorage.getItem('sg_sound') !== '0',
    vibrate: localStorage.getItem('sg_vibrate') !== '0',
    preview: localStorage.getItem('sg_preview') !== '0',
    animations: localStorage.getItem('sg_anim') !== '0',
    readReceipts: localStorage.getItem('sg_read') !== '0',
    enterSend: localStorage.getItem('sg_enter') !== '0',
    fontSize: localStorage.getItem('sg_font') || 'normal',
    corners: localStorage.getItem('sg_corners') || 'medium',
    timeFormat: localStorage.getItem('sg_timefmt') || '24h',
    autoDelete: localStorage.getItem('sg_autodel') || 'off',
    ghost: localStorage.getItem('sg_ghost') === '1',
    translate: localStorage.getItem('sg_translate') === '1',
    anon: localStorage.getItem('sg_anon') === '1',
    showTyping: localStorage.getItem('sg_typing') !== '0',
    quietHours: localStorage.getItem('sg_quiet') === '1'
  }
};

// ============ HELPERS ============
const $ = (id) => document.getElementById(id);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const fmtTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  const h = x.getHours().toString().padStart(2,'0');
  const m = x.getMinutes().toString().padStart(2,'0');
  if (state.settings.timeFormat === '12h') {
    const ampm = x.getHours() >= 12 ? 'PM' : 'AM';
    const h12 = (x.getHours() % 12) || 12;
    return `${h12}:${m} ${ampm}`;
  }
  return `${h}:${m}`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  return x.getDate().toString().padStart(2,'0') + '.' +
         (x.getMonth()+1).toString().padStart(2,'0') + '.' +
         x.getFullYear();
};

const fmtDateFull = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const now = new Date();
  const diff = now - x;
  if (diff < 86400000 && x.getDate() === now.getDate()) return 'Сегодня';
  if (diff < 172800000) return 'Вчера';
  return fmtDate(d);
};

const toTime = (d) => {
  if (!d) return 0;
  if (typeof d === 'object' && typeof d.getTime === 'function') return d.getTime();
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
};

const sortMessages = (arr) => [...arr].sort((a, b) => {
  const ta = toTime(a.created_at);
  const tb = toTime(b.created_at);
  if (ta !== tb) return ta - tb;
  return (Number(a.id) || 0) - (Number(b.id) || 0);
});

const uid8 = (id) => (id || '').slice(0, 8);

// ============ TOAST ============
function toast(msg, ms = 2200) {
  let t = $('sgToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sgToast';
    t.style.cssText = 'position:fixed;bottom:calc(90px + var(--sb,0px));left:50%;transform:translateX(-50%);background:rgba(23,33,43,.96);backdrop-filter:blur(20px);color:#fff;padding:12px 22px;border-radius:24px;font-size:14px;font-weight:600;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.08);transition:opacity .25s,transform .25s;max-width:90vw;text-align:center';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
  }, ms);
}

// ============ BAN BANNER ============
function showBanBanner(reason) {
  let b = $('banBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'banBanner';
    document.body.appendChild(b);
  }
  b.innerHTML = `🚫 Вы забанены: ${esc(reason || 'нарушение правил')}`;
}

// ============ ТЕМА ============
function applyTheme(theme) {
  document.body.className = document.body.className.replace(/theme-\S+/g, '').trim();
  if (theme && theme !== 'midnight') {
    document.body.classList.add('theme-' + theme);
  }
  localStorage.setItem('sg_theme', theme);
}

function applyMode(mode) {
  if (mode === 'light') document.body.classList.add('l');
  else document.body.classList.remove('l');
  localStorage.setItem('sg_mode', mode);
}

function applyFontSize(size) {
  const sizes = { small: '13px', normal: '15px', large: '17px', huge: '19px' };
  document.documentElement.style.fontSize = sizes[size] || '15px';
}

function applyCorners(c) {
  const r = { small: '8px', medium: '14px', large: '22px' };
  document.documentElement.style.setProperty('--radius', r[c] || '14px');
}

// ============ АДМИН ПРОВЕРКА ============
function isAdmin() {
  return state.profile?.is_creator === true || state.profile?.role === 'admin';
}
function isMod() {
  return isAdmin() || state.profile?.role === 'moderator' || (state.profile?.mods?.length > 0);
}
function canPostStories() {
  return state.profile?.is_plus || state.profile?.is_creator || state.profile?.role === 'admin';
}

// ============ МОДАЛКА ============
function openModal(html) {
  let ov = $('sgModalOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sgModalOverlay';
    ov.className = 'md';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;z-index:5000;overflow-y:auto';
    ov.innerHTML = '<div class="mb" id="sgModalBox" style="background:var(--panel);border-radius:22px;padding:22px;max-width:480px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.6)"></div>';
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
  }
  $('sgModalBox').innerHTML = html;
  ov.style.display = 'flex';
  ov.style.opacity = '0';
  requestAnimationFrame(() => { ov.style.transition = 'opacity .15s'; ov.style.opacity = '1'; });
}
function closeModal() {
  const ov = $('sgModalOverlay');
  if (ov) ov.style.display = 'none';
}
window.closeModal = closeModal;

// ============ ЗАГРУЗКА ФАЙЛА ============
async function uploadFile(bucket, file, folder = '') {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${folder}${folder ? '/' : ''}${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
/* ============================================================
   Часть 2: Авторизация, вход, чаты, сообщения, realtime
   ============================================================ */

// ============ АВТОРИЗАЦИЯ ============
function initAuth() {
  const bL = $('bL'), bR = $('bR');
  const em = $('em'), pw = $('pw'), un = $('un');
  const err = $('AE');

  // Кнопка "Войти"
  if (bL) bL.onclick = async () => {
    const email = em?.value.trim().toLowerCase();
    const username = un?.value.trim().toLowerCase().replace('@','');
    const password = pw?.value || '';
    if (err) err.textContent = '';

    // Логин по username (если введён) или по email
    let profile = null;
    if (username) {
      const { data } = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
      profile = data;
    } else if (email) {
      const { data } = await sb.from('profiles').select('*').eq('email', email).maybeSingle();
      profile = data;
    }

    if (!profile) { if (err) err.textContent = 'Пользователь не найден'; return; }
    if (profile.pin_code !== password) { if (err) err.textContent = 'Неверный пароль'; return; }
    if (profile.is_banned) { showBanBanner(profile.ban_reason); if (err) err.textContent = 'Вы забанены'; return; }

    localStorage.setItem('sg_user_id', profile.id);
    state.user = { id: profile.id };
    state.profile = profile;
    await enterApp();
  };

  // Кнопка "Регистрация"
  if (bR) bR.onclick = async () => {
    const email = em?.value.trim().toLowerCase();
    const username = un?.value.trim().toLowerCase().replace('@','');
    const password = pw?.value || '';
    if (err) err.textContent = '';

    if (!username || !email || !password) { if (err) err.textContent = 'Заполни все поля'; return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { if (err) err.textContent = 'Username: 3-20 (a-z, 0-9, _)'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { if (err) err.textContent = 'Неверный email'; return; }
    if (password.length < 6) { if (err) err.textContent = 'Пароль ≥ 6 символов'; return; }

    // Проверка занятости
    const { data: existing } = await sb.from('profiles').select('id').or(`username.eq.${username},email.eq.${email}`).maybeSingle();
    if (existing) { if (err) err.textContent = 'Username или email занят'; return; }

    const { data, error } = await sb.from('profiles').insert({
      username, email, pin_code: password,
      display_name: username,
      bio: 'Привет, я в Spacegram! 🚀',
      balance: 100
    }).select().single();

    if (error) { if (err) err.textContent = 'Ошибка: ' + error.message; return; }

    localStorage.setItem('sg_user_id', data.id);
    state.user = { id: data.id };
    state.profile = data;
    await enterApp();
  };
}

// ============ ВХОД В ПРИЛОЖЕНИЕ ============
async function enterApp() {
  const auth = $('A');
  const app = $('APP');
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'flex';

  // Показать админку если админ
  if (isAdmin() && $('bAdm')) $('bAdm').style.display = 'flex';

  await refreshProfile();
  await loadChats();
  await loadStickers();
  setupRealtime();
  setupPolling();

  // Рендер профиля
  if (typeof renderProfileMini === 'function') renderProfileMini();

  // Загрузить ленту если активна
  if (typeof loadFeed === 'function') loadFeed();

  console.log('✅ Вошли в Spacegram');
}

async function refreshProfile() {
  if (!state.user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  if (data) {
    state.profile = data;
    if (data.is_banned) {
      showBanBanner(data.ban_reason);
      setTimeout(logout, 100);
      return;
    }
    if (isAdmin() && $('bAdm')) $('bAdm').style.display = 'flex';
  }
}

function logout() {
  if (state.realtimeChats) sb.removeChannel(state.realtimeChats);
  if (state.realtimeMsgs) sb.removeChannel(state.realtimeMsgs);
  if (state.pollTimer) clearInterval(state.pollTimer);
  localStorage.removeItem('sg_user_id');
  location.reload();
}
window.logout = logout;

// ============ REALTIME ============
function setupRealtime() {
  state.realtimeChats = sb.channel('rt-chats-' + state.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => { loadChats(); })
    .subscribe((s) => console.log('📡 chats:', s));

  state.realtimeMsgs = sb.channel('rt-msgs-' + state.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
      if (state.currentChat && payload.new && String(payload.new.chat_id) === String(state.currentChat.id)) {
        loadMessages();
        if (payload.new.sender !== state.user.id && state.settings.vibrate && navigator.vibrate) {
          navigator.vibrate(30);
        }
      } else {
        loadChats();
      }
    })
    .subscribe((s) => console.log('📡 messages:', s));
}

// ============ POLLING (fallback) ============
function setupPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  let lastKey = null;
  state.pollTimer = setInterval(async () => {
    if (!state.user || !state.currentChat) return;
    const { data } = await sb.from('messages')
      .select('id,created_at')
      .eq('chat_id', state.currentChat.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const key = data ? data.id + ':' + data.created_at : null;
    if (key !== lastKey) { lastKey = key; loadMessages(); }
  }, 2000);
}

// ============ ЧАТЫ ============
async function loadChats() {
  if (!state.user) return;
  const uid = state.user.id;
  const { data: chats, error } = await sb.from('chats')
    .select('*')
    .or(`user1.eq.${uid},user2.eq.${uid},created_by.eq.${uid}`)
    .order('id', { ascending: false })
    .limit(100);

  if (error) { console.error(error); return; }

  const list = [];
  for (const c of (chats || [])) {
    if (c.is_group || c.is_channel || c.is_secret) {
      list.push(c);
      continue;
    }
    const otherId = c.user1 === uid ? c.user2 : c.user1;
    const { data: prof } = await sb.from('profiles').select('*').eq('id', otherId).maybeSingle();
    list.push({ ...c, other: prof });
  }
  state.chats = list;
  renderChats();
}

function renderChats() {
  const el = $('chats');
  if (!el) return;

  if (!state.chats.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--t2);font-size:14px">💬 Нет чатов<br><br>Нажми ➕ чтобы создать</div>';
    return;
  }

  el.innerHTML = state.chats.map(c => {
    const name = (c.is_group || c.is_channel) ? (c.group_name || 'Без названия') : (c.other?.display_name || 'Юзер');
    const initial = (name[0] || '?').toUpperCase();
    const avatar = c.group_avatar || c.other?.avatar_url;
    const emoji = c.is_channel ? '📢' : c.is_group ? '👥' : c.is_secret ? '🔒' : '';
    const plus = c.other?.is_plus ? '⭐' : '';
    const last = c.last_message || 'Нет сообщений';
    return `<div class="ch" data-id="${c.id}">
      <div class="cv" style="background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;overflow:hidden">
        ${avatar ? `<img src="${esc(avatar)}" style="width:100%;height:100%;object-fit:cover">` : initial}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:5px">
          ${esc(name)} ${emoji} ${plus}
        </div>
        <div style="color:var(--t2);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last)}</div>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.ch').forEach(item => {
    item.onclick = () => openChat(item.dataset.id);
  });
}

// ============ ОТКРЫТИЕ ЧАТА ============
async function openChat(chatId) {
  const chat = state.chats.find(c => String(c.id) === String(chatId));
  if (!chat) return;

  state.currentChat = chat;
  state.replyTo = null;

  // Показ
  const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp');
  if (ch) ch.style.display = 'flex';
  if (msgs) msgs.style.display = 'flex';
  if (inp) inp.style.display = 'flex';
  if (emp) emp.style.display = 'none';

  // Заголовок
  const name = (chat.is_group || chat.is_channel) ? (chat.group_name || 'Группа') : (chat.other?.display_name || 'Юзер');
  if ($('hN')) $('hN').textContent = name;
  if ($('hS')) {
    if (chat.is_channel) $('hS').textContent = 'канал';
    else if (chat.is_group) $('hS').textContent = 'группа';
    else $('hS').textContent = 'был(а) недавно';
  }

  const initial = (name[0] || '?').toUpperCase();
  const avatar = chat.group_avatar || chat.other?.avatar_url;
  if ($('hA')) {
    $('hA').innerHTML = avatar
      ? `<img src="${esc(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : initial;
  }

  await loadMessages();
  await markMessagesRead();

  // Обновить черновик
  const draft = localStorage.getItem('sg_draft_' + chat.id);
  if (draft && $('msgI')) $('msgI').value = draft;
}

function back() {
  const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp');
  if (ch) ch.style.display = 'none';
  if (msgs) msgs.style.display = 'none';
  if (inp) inp.style.display = 'none';
  if (emp) emp.style.display = 'flex';
  state.currentChat = null;
  state.replyTo = null;
}
window.back = back;

// ============ СООБЩЕНИЯ ============
async function loadMessages() {
  if (!state.currentChat) return;
  const { data, error } = await sb.from('messages')
    .select('*')
    .eq('chat_id', state.currentChat.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200);

  if (error) { console.error(error); return; }
  state.messages = sortMessages(data || []);
  renderMessages();
}

function renderMessages() {
  const el = $('msgs');
  if (!el) return;

  const sorted = sortMessages(state.messages);
  if (!sorted.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--t2);padding:40px;font-size:13px">Пока нет сообщений ✨</div>';
    return;
  }

  let lastDate = '';
  el.innerHTML = sorted.map(m => {
    const own = m.sender === state.user.id;
    const time = fmtTime(m.created_at);
    const dateKey = fmtDateFull(m.created_at);
    let dateSep = '';
    if (dateKey !== lastDate) {
      dateSep = `<div style="text-align:center;color:var(--t2);font-size:11px;padding:12px 0;font-weight:600">${dateKey}</div>`;
      lastDate = dateKey;
    }

    let content = '';
    if (m.deleted) {
      content = '<i style="opacity:.6">сообщение удалено</i>';
    } else {
      if (m.file_url) {
        const ft = m.file_type || '';
        if (ft.startsWith('image')) {
          content += `<img src="${esc(m.file_url)}" class="msg-media" onclick="window.openImage('${esc(m.file_url)}')">`;
        } else if (ft.startsWith('video')) {
          content += `<video src="${esc(m.file_url)}" controls class="msg-media"></video>`;
        } else if (m.is_voice) {
          content += `<audio src="${esc(m.file_url)}" controls style="max-width:220px;margin-top:4px"></audio>`;
        } else {
          content += `<a href="${esc(m.file_url)}" target="_blank" style="color:inherit">📎 ${esc(m.file_name || 'Файл')}</a>`;
        }
      }
      if (m.text) content += `<div style="white-space:pre-wrap">${esc(m.text)}</div>`;
    }

    // Реакции
    let reactionsHtml = '';
    const reactions = m.reactions || {};
    const keys = Object.keys(reactions).filter(k => reactions[k]?.length);
    if (keys.length) {
      reactionsHtml = `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">${keys.map(k =>
        `<span style="background:rgba(0,0,0,.25);padding:2px 8px;border-radius:12px;font-size:12px;cursor:pointer" onclick="window.toggleReaction('${m.id}','${k}')">${k} ${reactions[k].length}</span>`
      ).join('')}</div>`;
    }

    // Ответ
    let replyHtml = '';
    if (m.reply_to) {
      const rep = sorted.find(x => String(x.id) === String(m.reply_to));
      if (rep) {
        replyHtml = `<div style="border-left:2px solid var(--a);padding:2px 8px;margin-bottom:4px;font-size:12px;opacity:.85">${esc((rep.text || '[медиа]').slice(0,50))}</div>`;
      }
    }

    // Показ sender в группах
    const showSender = !own && (state.currentChat.is_group || state.currentChat.is_channel);

    return `${dateSep}<div class="m ${own ? 'me' : 'you'}" data-id="${m.id}">
      ${showSender ? `<div style="font-size:12px;font-weight:700;color:#4a9eff;margin-bottom:2px">${esc(m.sender_name || 'Юзер')}</div>` : ''}
      ${replyHtml}
      ${content}
      ${reactionsHtml}
      <span style="font-size:10px;opacity:.7;float:right;margin-left:8px;margin-top:4px">${time}</span>
    </div>`;
  }).join('');

  el.scrollTop = el.scrollHeight;
}

async function markMessagesRead() {
  if (!state.currentChat || !state.settings.readReceipts) return;
  const unread = state.messages.filter(m => m.sender !== state.user.id && !m.is_read).map(m => m.id);
  if (!unread.length) return;
  await sb.from('messages').update({ is_read: true }).in('id', unread);
}

// ============ ОТПРАВКА ============
async function sendMessage() {
  if (!state.currentChat) return;
  const inp = $('msgI');
  const text = inp?.value.trim();
  if (!text) return;

  inp.value = '';
  localStorage.removeItem('sg_draft_' + state.currentChat.id);

  // Мут проверка
  if (state.profile.muted_until && new Date(state.profile.muted_until) > new Date()) {
    toast('🔇 Вы в муте до ' + fmtTime(state.profile.muted_until));
    return;
  }

  const payload = {
    chat_id: state.currentChat.id,
    sender: state.user.id,
    sender_name: state.profile.display_name,
    text,
    is_read: false,
    deleted: false
  };

  if (state.replyTo) {
    payload.reply_to = state.replyTo.id;
    cancelRep();
  }
  if (state.burnAfter > 0) {
    payload.burn_after = state.burnAfter;
  }

  let { error } = await sb.from('messages').insert(payload);
  if (error && /sender_name/.test(error.message)) {
    delete payload.sender_name;
    const r = await sb.from('messages').insert(payload);
    error = r.error;
  }
  if (error) { toast('Ошибка: ' + error.message); return; }

  await sb.from('chats').update({ last_message: text.slice(0, 80) }).eq('id', state.currentChat.id);
  await loadMessages();

  // XP за сообщение
  if (state.profile) {
    const newXp = (state.profile.xp || 0) + 1;
    const newLevel = Math.floor(newXp / 50) + 1;
    if (newLevel > (state.profile.level || 1)) {
      state.profile.level = newLevel;
      toast('🎉 Уровень ' + newLevel + '!');
    }
    state.profile.xp = newXp;
    state.profile.messages_count = (state.profile.messages_count || 0) + 1;
    sb.from('profiles').update({
      xp: newXp, level: newLevel,
      messages_count: state.profile.messages_count
    }).eq('id', state.user.id);
  }
}
window.sendMessage = sendMessage;

// ============ ОТВЕТ ============
function cancelRep() {
  state.replyTo = null;
  const rp = $('rP');
  if (rp) rp.style.display = 'none';
}
window.cancelRep = cancelRep;

// ============ РЕАКЦИИ ============
window.toggleReaction = async (msgId, emoji) => {
  const { data: m } = await sb.from('messages').select('reactions').eq('id', msgId).single();
  if (!m) return;
  const reactions = m.reactions || {};
  reactions[emoji] = reactions[emoji] || [];
  const uid = state.user.id;
  if (reactions[emoji].includes(uid)) {
    reactions[emoji] = reactions[emoji].filter(x => x !== uid);
    if (!reactions[emoji].length) delete reactions[emoji];
  } else {
    reactions[emoji].push(uid);
  }
  await sb.from('messages').update({ reactions }).eq('id', msgId);
  if (navigator.vibrate) navigator.vibrate(15);
  await loadMessages();
};

// ============ ЗАГРУЗКА ФАЙЛОВ В ЧАТ ============
async function sendFile(file, type = 'auto') {
  if (!state.currentChat || !file) return;
  toast('Загрузка...');
  try {
    const url = await uploadFile('files', file, 'chat_' + state.currentChat.id);
    const payload = {
      chat_id: state.currentChat.id,
      sender: state.user.id,
      sender_name: state.profile.display_name,
      file_url: url,
      file_type: file.type || type,
      file_name: file.name,
      is_read: false,
      deleted: false
    };
    let { error } = await sb.from('messages').insert(payload);
    if (error && /sender_name/.test(error.message)) {
      delete payload.sender_name;
      const r = await sb.from('messages').insert(payload);
      error = r.error;
    }
    if (error) { toast('Ошибка: ' + error.message); return; }
    await sb.from('chats').update({ last_message: '📎 ' + (file.name || 'файл') }).eq('id', state.currentChat.id);
    await loadMessages();
    toast('Отправлено ✅');
  } catch (e) {
    toast('Ошибка: ' + e.message);
  }
}

// ============ СТИКЕРЫ ============
async function loadStickers() {
  const { data } = await sb.from('stickers').select('*').limit(100);
  state.stickers = data || [];
}
/* ============================================================
   Часть 3: Профиль, настройки, сторис, лента, магазин, промо
   ============================================================ */

// ============ ПРОФИЛЬ (МОДАЛКА) ============
const EMOJI_STATUSES = ['😀','😎','🤔','😴','🥳','😭','❤️','🔥','🚀','⭐','💯','🙏','👀','💀','🤡','🎮','📚','🎧','☕','🍕'];

function showProf() {
  const p = state.profile;
  if (!p) return;
  const initial = (p.display_name || '?')[0].toUpperCase();

  openModal(`
    <h2 style="margin-bottom:14px;font-size:20px;font-weight:800">👤 Профиль</h2>
    <div style="display:flex;justify-content:center;padding:10px 0 16px">
      <div style="width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;color:#fff;overflow:hidden;position:relative;${p.avatar_frame ? 'box-shadow:0 0 20px #ffd700;border:3px solid #ffd700;' : ''}">
        ${p.avatar_url ? `<img src="${esc(p.avatar_url)}" style="width:100%;height:100%;object-fit:cover">` : initial}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div style="background:var(--p2);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800">${p.balance || 0}</div>
        <div style="font-size:10px;color:var(--t2);text-transform:uppercase">💰 SG</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800">${p.level || 1}</div>
        <div style="font-size:10px;color:var(--t2);text-transform:uppercase">🎯 Lvl</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800">${p.messages_count || 0}</div>
        <div style="font-size:10px;color:var(--t2);text-transform:uppercase">💬 Msgs</div>
      </div>
    </div>

    <div style="font-size:12px;color:var(--t2);margin-bottom:4px">Имя</div>
    <input id="pN" value="${esc(p.display_name || '')}" style="width:100%;padding:11px 14px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px;font-size:14px">

    <div style="font-size:12px;color:var(--t2);margin-bottom:4px">Username</div>
    <input value="@${esc(p.username || '')}" disabled style="width:100%;padding:11px 14px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px;font-size:14px;opacity:.6">

    <div style="font-size:12px;color:var(--t2);margin-bottom:4px">Телефон</div>
    <input id="pPh" value="${esc(p.phone || '')}" placeholder="+7..." style="width:100%;padding:11px 14px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px;font-size:14px">

    <div style="font-size:12px;color:var(--t2);margin-bottom:4px">О себе</div>
    <textarea id="pB" rows="2" maxlength="200" style="width:100%;padding:11px 14px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px;font-size:14px;resize:none">${esc(p.bio || '')}</textarea>

    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">Эмодзи-статус</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px" id="emSt">
      ${EMOJI_STATUSES.map(e => `<button data-e="${e}" style="font-size:22px;padding:4px 8px;border-radius:10px;background:${p.emoji_status===e?'var(--a)':'var(--p2)'}">${e}</button>`).join('')}
    </div>

    <button id="bSaveP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;margin-bottom:8px">💾 Сохранить</button>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      <button onclick="window.openProfileViews()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">👀 Кто смотрел</button>
      <button onclick="window.openAnalytics()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">📊 Аналитика</button>
      <button onclick="window.openBalance()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">💰 Баланс</button>
      <button onclick="window.openShop()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">🛒 Магазин</button>
      <button onclick="window.openPromo()" style="padding:11px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:700;font-size:13px;border:none;cursor:pointer">🎁 Промокод</button>
      <button onclick="window.openMods()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">🧩 Моды</button>
      <button onclick="window.openGifts()" style="padding:11px;border-radius:12px;background:linear-gradient(135deg,#e91e63,#9c27b0);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">🎁 Подарки</button>
      <button onclick="window.openQR()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">📱 QR</button>
      <button onclick="window.shareProfile()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">🔗 Поделиться</button>
      <button onclick="window.exportData()" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">📥 Экспорт</button>
    </div>

    <button onclick="window.logout()" style="width:100%;padding:13px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;font-size:14px;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-top:12px">🚪 Выйти</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:6px">Закрыть</button>
  `);

  // Обработчики
  let selectedEmoji = p.emoji_status || '';
  document.querySelectorAll('#emSt button').forEach(b => {
    b.onclick = () => {
      selectedEmoji = b.dataset.e === selectedEmoji ? '' : b.dataset.e;
      document.querySelectorAll('#emSt button').forEach(x => x.style.background = 'var(--p2)');
      if (selectedEmoji) b.style.background = 'var(--a)';
    };
  });

  $('bSaveP').onclick = async () => {
    const updates = {
      display_name: $('pN').value.trim() || p.display_name,
      phone: $('pPh').value.trim() || null,
      bio: $('pB').value.trim(),
      emoji_status: selectedEmoji || null
    };
    const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { toast('Ошибка: ' + error.message); return; }
    await refreshProfile();
    toast('Сохранено ✅');
    closeModal();
  };
}
window.showProf = showProf;

// ============ ПРОСМОТРЫ ПРОФИЛЯ ============
window.openProfileViews = async () => {
  const { data } = await sb.from('profile_views')
    .select('*').eq('profile_id', state.user.id)
    .order('id', { ascending: false }).limit(50);
  const views = data || [];
  const uids = [...new Set(views.map(v => v.viewer_id))];
  const profs = {};
  if (uids.length) {
    const { data: ps } = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', uids);
    (ps || []).forEach(p => profs[p.id] = p);
  }

  openModal(`
    <h2 style="margin-bottom:14px">👀 Кто смотрел профиль</h2>
    <div style="max-height:400px;overflow-y:auto">
      ${views.length ? views.map(v => {
        const p = profs[v.viewer_id];
        if (!p) return '';
        const init = (p.display_name || '?')[0].toUpperCase();
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--p2);border-radius:10px;margin-bottom:6px">
          <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0">
            ${p.avatar_url ? `<img src="${esc(p.avatar_url)}" style="width:100%;height:100%;object-fit:cover">` : init}
          </div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${esc(p.display_name)}</div>
            <div style="font-size:11px;color:var(--t2)">@${esc(p.username)} · ${fmtDate(v.viewed_at || v.created_at)}</div>
          </div>
        </div>`;
      }).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Пока никто не смотрел 😢</div>'}
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

// ============ АНАЛИТИКА ============
window.openAnalytics = async () => {
  const { count: msgCount } = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('sender', state.user.id);
  const { count: chatCount } = await sb.from('chats').select('id', { count: 'exact', head: true }).or(`user1.eq.${state.user.id},user2.eq.${state.user.id}`);
  const { count: storyCount } = await sb.from('stories').select('id', { count: 'exact', head: true }).eq('user_id', state.user.id);

  const created = new Date(state.profile.created_at || Date.now());
  const days = Math.max(1, Math.floor((Date.now() - created.getTime()) / 86400000));

  openModal(`
    <h2 style="margin-bottom:14px">📊 Аналитика профиля</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800">${msgCount || 0}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">💬 Сообщений</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800">${chatCount || 0}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">💭 Чатов</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800">${storyCount || 0}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">📸 Статусов</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800">${days}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">📅 Дней в SG</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center;grid-column:1/-1">
        <div style="font-size:20px;font-weight:800">${Math.round((msgCount || 0) / days * 10) / 10}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">📈 Сообщений в день</div>
      </div>
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

// ============ ПОДЕЛИТЬСЯ ============
window.shareProfile = async () => {
  const url = location.origin + '?u=' + state.profile.username;
  const text = 'Мой профиль Spacegram @' + state.profile.username;
  if (navigator.share) {
    try { await navigator.share({ title: 'Spacegram', text, url }); } catch(e){}
  } else {
    try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована ✅'); }
    catch(e){ toast('Ошибка копирования'); }
  }
};

// ============ QR-КОД ============
window.openQR = () => {
  const url = location.origin + '?u=' + state.profile.username;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url);
  openModal(`
    <h2 style="margin-bottom:14px;text-align:center">📱 QR-код профиля</h2>
    <div style="background:#fff;padding:16px;border-radius:16px;display:flex;justify-content:center;margin-bottom:14px">
      <img src="${qrUrl}" style="width:100%;max-width:250px;display:block">
    </div>
    <div style="text-align:center;color:var(--t2);font-size:13px;margin-bottom:14px">@${esc(state.profile.username)}</div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button>
  `);
};

// ============ ЭКСПОРТ ============
window.exportData = async () => {
  const data = { profile: state.profile, chats: state.chats.length, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spacegram_' + state.profile.username + '.json';
  a.click();
  toast('Экспортировано 📥');
};

// ============ НАСТРОЙКИ ============
function openSettings() {
  const s = state.settings;
  const themes = ['midnight','purple','ocean','sunset','rose','forest','cyber','mono'];

  openModal(`
    <h2 style="margin-bottom:14px">⚙️ Настройки</h2>

    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">🎨 Тема</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px" id="themeGrid">
      ${themes.map(t => `<button data-th="${t}" style="padding:10px;border-radius:10px;background:var(--p2);border:2px solid ${s.theme===t?'var(--a)':'transparent'};color:var(--t);font-size:11px;font-weight:600;cursor:pointer">${t}</button>`).join('')}
    </div>

    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">🌗 Режим</div>
    <div style="display:flex;gap:6px;margin-bottom:14px" id="modeGrp">
      <button data-m="dark" style="flex:1;padding:10px;border-radius:10px;background:${s.mode==='dark'?'var(--a)':'var(--p2)'};color:${s.mode==='dark'?'#fff':'var(--t)'};font-weight:600;border:none;cursor:pointer">🌙 Тёмный</button>
      <button data-m="light" style="flex:1;padding:10px;border-radius:10px;background:${s.mode==='light'?'var(--a)':'var(--p2)'};color:${s.mode==='light'?'#fff':'var(--t)'};font-weight:600;border:none;cursor:pointer">☀️ Светлый</button>
    </div>

    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">📏 Размер шрифта</div>
    <div style="display:flex;gap:6px;margin-bottom:14px" id="fontGrp">
      ${['small','normal','large','huge'].map(f => `<button data-f="${f}" style="flex:1;padding:8px;border-radius:10px;background:${s.fontSize===f?'var(--a)':'var(--p2)'};color:${s.fontSize===f?'#fff':'var(--t)'};font-weight:600;font-size:12px;border:none;cursor:pointer">${f}</button>`).join('')}
    </div>

    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">⬜ Скругления</div>
    <div style="display:flex;gap:6px;margin-bottom:14px" id="cornerGrp">
      ${['small','medium','large'].map(c => `<button data-c="${c}" style="flex:1;padding:8px;border-radius:10px;background:${s.corners===c?'var(--a)':'var(--p2)'};color:${s.corners===c?'#fff':'var(--t)'};font-weight:600;font-size:12px;border:none;cursor:pointer">${c}</button>`).join('')}
    </div>

    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">🕐 Формат времени</div>
    <div style="display:flex;gap:6px;margin-bottom:14px" id="timeGrp">
      <button data-tf="24h" style="flex:1;padding:8px;border-radius:10px;background:${s.timeFormat==='24h'?'var(--a)':'var(--p2)'};color:${s.timeFormat==='24h'?'#fff':'var(--t)'};font-weight:600;font-size:12px;border:none;cursor:pointer">24 часа</button>
      <button data-tf="12h" style="flex:1;padding:8px;border-radius:10px;background:${s.timeFormat==='12h'?'var(--a)':'var(--p2)'};color:${s.timeFormat==='12h'?'#fff':'var(--t)'};font-weight:600;font-size:12px;border:none;cursor:pointer">12 часов</button>
    </div>

    ${toggleRow('cbSound', '🔊 Звук', s.sound)}
    ${toggleRow('cbVib', '📳 Вибрация', s.vibrate)}
    ${toggleRow('cbPrev', '💬 Превью', s.preview)}
    ${toggleRow('cbAnim', '✨ Анимации', s.animations)}
    ${toggleRow('cbRead', '✓✓ Прочтение', s.readReceipts)}
    ${toggleRow('cbEnter', '⌨️ Enter = отправить', s.enterSend)}
    ${toggleRow('cbGhost', '👻 Ghost-режим', s.ghost)}
    ${toggleRow('cbTrans', '🌐 Автоперевод', s.translate)}
    ${toggleRow('cbAnon', '🎭 Анонимный режим', s.anon)}
    ${toggleRow('cbTyping', '⌨️ Показывать «печатает»', s.showTyping)}

    <button onclick="window.openPriv()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);font-weight:600;font-size:13px;border:1px solid var(--br);cursor:pointer;margin-top:8px">🔒 Приватность</button>
    <button onclick="window.openPinSetup()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);font-weight:600;font-size:13px;border:1px solid var(--br);cursor:pointer;margin-top:8px">🔑 PIN-код</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:8px">Закрыть</button>
  `);

  // Темы
  document.querySelectorAll('#themeGrid button').forEach(b => b.onclick = () => {
    state.settings.theme = b.dataset.th;
    applyTheme(b.dataset.th);
    document.querySelectorAll('#themeGrid button').forEach(x => x.style.border = '2px solid transparent');
    b.style.border = '2px solid var(--a)';
  });
  // Режим
  document.querySelectorAll('#modeGrp button').forEach(b => b.onclick = () => {
    state.settings.mode = b.dataset.m;
    applyMode(b.dataset.m);
    document.querySelectorAll('#modeGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
  });
  // Шрифт
  document.querySelectorAll('#fontGrp button').forEach(b => b.onclick = () => {
    state.settings.fontSize = b.dataset.f;
    applyFontSize(b.dataset.f);
    localStorage.setItem('sg_font', b.dataset.f);
    document.querySelectorAll('#fontGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
  });
  // Скругления
  document.querySelectorAll('#cornerGrp button').forEach(b => b.onclick = () => {
    state.settings.corners = b.dataset.c;
    applyCorners(b.dataset.c);
    localStorage.setItem('sg_corners', b.dataset.c);
    document.querySelectorAll('#cornerGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
  });
  // Время
  document.querySelectorAll('#timeGrp button').forEach(b => b.onclick = () => {
    state.settings.timeFormat = b.dataset.tf;
    localStorage.setItem('sg_timefmt', b.dataset.tf);
    document.querySelectorAll('#timeGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
    if (state.currentChat) loadMessages();
  });

  // Чекбоксы
  bindToggle('cbSound', v => { state.settings.sound = v; localStorage.setItem('sg_sound', v ? '1' : '0'); });
  bindToggle('cbVib', v => { state.settings.vibrate = v; localStorage.setItem('sg_vibrate', v ? '1' : '0'); });
  bindToggle('cbPrev', v => { state.settings.preview = v; localStorage.setItem('sg_preview', v ? '1' : '0'); });
  bindToggle('cbAnim', v => { state.settings.animations = v; localStorage.setItem('sg_anim', v ? '1' : '0'); });
  bindToggle('cbRead', v => { state.settings.readReceipts = v; localStorage.setItem('sg_read', v ? '1' : '0'); });
  bindToggle('cbEnter', v => { state.settings.enterSend = v; localStorage.setItem('sg_enter', v ? '1' : '0'); });
  bindToggle('cbGhost', v => {
    state.settings.ghost = v;
    localStorage.setItem('sg_ghost', v ? '1' : '0');
    sb.from('profiles').update({ ghost_mode: v }).eq('id', state.user.id);
  });
  bindToggle('cbTrans', v => { state.settings.translate = v; localStorage.setItem('sg_translate', v ? '1' : '0'); });
  bindToggle('cbAnon', v => { state.settings.anon = v; localStorage.setItem('sg_anon', v ? '1' : '0'); });
  bindToggle('cbTyping', v => { state.settings.showTyping = v; localStorage.setItem('sg_typing', v ? '1' : '0'); });
}
window.openSettings = openSettings;

function toggleRow(id, label, checked) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--br)">
    <div style="font-size:14px">${label}</div>
    <label style="position:relative;display:inline-block;width:44px;height:24px">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="opacity:0;width:0;height:0">
      <span class="sg-slider" style="position:absolute;cursor:pointer;inset:0;background:${checked ? 'var(--a)' : '#444'};border-radius:24px;transition:.2s"></span>
      <span class="sg-knob" style="position:absolute;height:18px;width:18px;left:${checked ? '23px' : '3px'};bottom:3px;background:#fff;border-radius:50%;transition:.2s"></span>
    </label>
  </div>`;
}

function bindToggle(id, cb) {
  const el = $(id);
  if (!el) return;
  el.onchange = () => {
    const v = el.checked;
    const parent = el.closest('label');
    if (parent) {
      const slider = parent.querySelector('.sg-slider');
      const knob = parent.querySelector('.sg-knob');
      if (slider) slider.style.background = v ? 'var(--a)' : '#444';
      if (knob) knob.style.left = v ? '23px' : '3px';
    }
    cb(v);
  };
}

// ============ ПРИВАТНОСТЬ ============
window.openPriv = () => {
  const p = state.profile;
  openModal(`
    <h2 style="margin-bottom:14px">🔒 Приватность</h2>
    ${toggleRow('cbHL', '🕐 Скрыть «был(а) недавно»', p.hide_last_seen)}
    ${toggleRow('cbHP', '📞 Скрыть телефон', p.hide_phone)}
    ${toggleRow('cbHA', '🖼️ Скрыть аватар', p.hide_avatar)}
    <button id="bSavePriv" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-top:14px">💾 Сохранить</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:8px">Закрыть</button>
  `);
  bindToggle('cbHL', () => {});
  bindToggle('cbHP', () => {});
  bindToggle('cbHA', () => {});
  $('bSavePriv').onclick = async () => {
    const updates = {
      hide_last_seen: $('cbHL').checked,
      hide_phone: $('cbHP').checked,
      hide_avatar: $('cbHA').checked
    };
    await sb.from('profiles').update(updates).eq('id', state.user.id);
    await refreshProfile();
    toast('Сохранено ✅');
    closeModal();
  };
};

// ============ PIN-КОД ============
window.openPinSetup = () => {
  openModal(`
    <h2 style="margin-bottom:14px">🔑 PIN-код</h2>
    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">Новый PIN (4 цифры)</div>
    <input id="pinNew" type="tel" maxlength="4" placeholder="0000" style="width:100%;padding:13px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);font-size:20px;text-align:center;letter-spacing:8px;margin-bottom:10px">
    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">Текущий пароль (для смены)</div>
    <input id="pinOld" type="password" placeholder="Пароль" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:14px">
    <button id="bSetPin" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">💾 Установить PIN</button>
    <button id="bRmPin" style="width:100%;padding:11px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:600;font-size:13px;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-bottom:8px">🗑 Удалить PIN</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>
  `);
  $('bSetPin').onclick = async () => {
    const pin = $('pinNew').value.trim();
    if (!/^\d{4}$/.test(pin)) { toast('PIN: 4 цифры'); return; }
    await sb.from('profiles').update({ pin_enabled: true }).eq('id', state.user.id);
    localStorage.setItem('sg_pin', pin);
    toast('PIN установлен ✅');
    closeModal();
  };
  $('bRmPin').onclick = () => {
    localStorage.removeItem('sg_pin');
    sb.from('profiles').update({ pin_enabled: false }).eq('id', state.user.id);
    toast('PIN удалён');
    closeModal();
  };
};

// ============ СТОРИС ============
window.openStories = async () => {
  const { data: stories } = await sb.from('stories')
    .select('*').gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(100);

  const byUser = {};
  (stories || []).forEach(s => {
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push(s);
  });

  const uids = Object.keys(byUser);
  const authors = {};
  if (uids.length) {
    const { data: ps } = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', uids);
    (ps || []).forEach(p => authors[p.id] = p);
  }

  const canPost = canPostStories();
  const myStories = byUser[state.user.id] || [];
  const others = Object.keys(byUser).filter(u => u !== state.user.id);

  openModal(`
    <h2 style="margin-bottom:14px">📸 Статусы</h2>
    ${canPost
      ? `<button onclick="window.addStory()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:14px">＋ Добавить статус</button>`
      : `<div style="text-align:center;padding:12px;background:var(--p2);border-radius:12px;margin-bottom:14px;color:var(--t2);font-size:13px">⭐ Статусы только для Plus</div>`
    }
    ${myStories.length ? `
      <div style="font-size:11px;color:var(--t2);margin-bottom:8px;font-weight:700">МОИ СТАТУСЫ</div>
      <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;margin-bottom:14px">
        ${myStories.map(s => `
          <div style="text-align:center;flex-shrink:0;cursor:pointer" onclick="window.viewStory('${s.id}')">
            <div style="width:68px;height:68px;border-radius:50%;background:${s.bg_color || 'var(--a)'};border:3px solid var(--a);display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;margin-bottom:4px">
              ${s.media_url ? `<img src="${esc(s.media_url)}" style="width:100%;height:100%;object-fit:cover">` : '📝'}
            </div>
            <div style="font-size:10px;color:var(--t2)">${fmtTime(s.created_at)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    ${others.length ? `
      <div style="font-size:11px;color:var(--t2);margin-bottom:8px;font-weight:700">ДРУГИЕ</div>
      <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">
        ${others.map(uid => {
          const a = authors[uid];
          const userStories = byUser[uid];
          const latest = userStories[0];
          const seen = userStories.every(s => (s.views || []).includes(state.user.id));
          const init = (a?.display_name || '?')[0].toUpperCase();
          return `
            <div style="text-align:center;flex-shrink:0;cursor:pointer;min-width:70px" onclick="window.viewStory('${latest.id}')">
              <div style="width:68px;height:68px;border-radius:50%;background:${latest.bg_color || 'var(--a)'};border:3px solid ${seen ? 'var(--br)' : 'var(--a)'};display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;margin:0 auto 4px">
                ${latest.media_url ? `<img src="${esc(latest.media_url)}" style="width:100%;height:100%;object-fit:cover">` : (a?.avatar_url ? `<img src="${esc(a.avatar_url)}" style="width:100%;height:100%;object-fit:cover">` : init)}
              </div>
              <div style="font-size:10px;color:var(--t2);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 auto">${esc(a?.display_name || '?')}</div>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}
    ${!myStories.length && !others.length ? '<div style="text-align:center;padding:30px;color:var(--t2)">Пока нет статусов 😢</div>' : ''}
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

window.addStory = () => {
  if (!canPostStories()) { toast('⭐ Только для Plus'); return; }
  openModal(`
    <h2 style="margin-bottom:14px">📸 Новый статус</h2>
    <input type="file" id="storyFile" accept="image/*,video/*" style="width:100%;margin-bottom:10px">
    <textarea id="storyText" placeholder="Текст (опционально)" rows="2" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px;resize:none"></textarea>
    <div style="font-size:12px;color:var(--t2);margin-bottom:6px">🎨 Цвет фона</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px" id="colorPick">
      ${['#5288c1','#a855f7','#00b4d8','#ff6b35','#f43f5e','#4ade80','#00ff9d','#000000','#333333'].map((c,i) =>
        `<button data-c="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};border:${i===0?'3px solid #fff':'2px solid var(--br)'};cursor:pointer"></button>`
      ).join('')}
    </div>
    <button id="bPubStory" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">📸 Опубликовать</button>
    <button onclick="window.openStories()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">← Назад</button>
  `);
  let bgColor = '#5288c1';
  document.querySelectorAll('#colorPick button').forEach(b => b.onclick = () => {
    bgColor = b.dataset.c;
    document.querySelectorAll('#colorPick button').forEach(x => x.style.border = '2px solid var(--br)');
    b.style.border = '3px solid #fff';
  });
  $('bPubStory').onclick = async () => {
    const file = $('storyFile').files[0];
    const text = $('storyText').value.trim();
    if (!file && !text) { toast('Добавь фото или текст'); return; }
    toast('Публикация...');
    let mediaUrl = null, mediaType = 'text';
    if (file) {
      try {
        mediaUrl = await uploadFile('stories', file, state.user.id);
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
      } catch(e) { toast('Ошибка: ' + e.message); return; }
    }
    const expires = new Date(Date.now() + 24*3600*1000).toISOString();
    const { error } = await sb.from('stories').insert({
      user_id: state.user.id, text_content: text || null,
      media_url: mediaUrl, media_type: mediaType, bg_color: bgColor,
      duration: 5, expires_at: expires, views: []
    });
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Опубликовано 📸');
    window.openStories();
  };
};

window.viewStory = async (sid) => {
  const { data: story } = await sb.from('stories').select('*').eq('id', sid).single();
  if (!story) return;
  const { data: author } = await sb.from('profiles').select('*').eq('id', story.user_id).maybeSingle();
  const views = story.views || [];
  if (!views.includes(state.user.id)) {
    views.push(state.user.id);
    await sb.from('stories').update({ views }).eq('id', sid);
  }
  openModal(`
    <div style="background:${story.bg_color || '#000'};border-radius:14px;padding:20px;min-height:360px;display:flex;flex-direction:column;justify-content:center;align-items:center;position:relative;margin-bottom:14px">
      ${story.media_url
        ? (story.media_type === 'video'
          ? `<video src="${esc(story.media_url)}" style="max-width:100%;max-height:360px;border-radius:10px" autoplay controls></video>`
          : `<img src="${esc(story.media_url)}" style="max-width:100%;max-height:360px;border-radius:10px;object-fit:contain">`)
        : ''}
      ${story.text_content ? `<div style="font-size:18px;font-weight:600;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);margin-top:14px;padding:10px;background:rgba(0,0,0,.35);border-radius:10px;text-align:center">${esc(story.text_content)}</div>` : ''}
      <div style="position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:#4a9eff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0">
          ${author?.avatar_url ? `<img src="${esc(author.avatar_url)}" style="width:100%;height:100%;object-fit:cover">` : (author?.display_name || '?')[0].toUpperCase()}
        </div>
        <div style="flex:1;color:#fff;font-size:12px;text-shadow:0 1px 4px rgba(0,0,0,.8)">
          <b>${esc(author?.display_name || 'Юзер')}</b><br>
          <span style="opacity:.8">${fmtTime(story.created_at)} · 👁 ${views.length}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="window.openStories()" style="flex:1;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">← Назад</button>
      ${story.user_id !== state.user.id
        ? `<button onclick="window.storyReply('${sid}','${story.user_id}')" style="flex:1;padding:11px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">💬 Ответить</button>`
        : `<button onclick="window.deleteStory('${sid}')" style="flex:1;padding:11px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;font-size:13px;border:1px solid rgba(229,57,53,.3);cursor:pointer">🗑 Удалить</button>`}
    </div>
  `);
};

window.deleteStory = async (sid) => {
  if (!confirm('Удалить статус?')) return;
  await sb.from('stories').delete().eq('id', sid);
  toast('Удалено');
  window.openStories();
};

window.storyReply = async (sid, uid) => {
  closeModal();
  if (uid === state.user.id) { toast('Это твой статус'); return; }
  const { data: other } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (!other) return;
  const { data: existing } = await sb.from('chats').select('*')
    .or(`and(user1.eq.${state.user.id},user2.eq.${other.id}),and(user1.eq.${other.id},user2.eq.${state.user.id})`).maybeSingle();
  let chat = existing;
  if (!chat) {
    const { data } = await sb.from('chats').insert({ user1: state.user.id, user2: other.id, created_by: state.user.id }).select().single();
    chat = data;
  }
  await loadChats();
  if (chat) openChat(chat.id);
};

// ============ ЛЕНТА ============
async function loadFeed() {
  const el = $('fdL');
  if (!el) return;
  const { data } = await sb.from('posts').select('*').order('id', { ascending: false }).limit(30);
  if (!data || !data.length) {
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--t2)">📰 Пока нет постов</div>';
    return;
  }
  const uids = [...new Set(data.map(p => p.user_id))];
  const profs = {};
  if (uids.length) {
    const { data: ps } = await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified,is_plus').in('id', uids);
    (ps || []).forEach(p => profs[p.id] = p);
  }
  el.innerHTML = data.map(p => {
    const a = profs[p.user_id] || {};
    const init = (a.display_name || '?')[0].toUpperCase();
    return `<div style="background:var(--p);border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--br)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0">
          ${a.avatar_url ? `<img src="${esc(a.avatar_url)}" style="width:100%;height:100%;object-fit:cover">` : init}
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px">${esc(a.display_name || 'Юзер')} ${a.is_verified ? '✅' : ''} ${a.is_plus ? '⭐' : ''}</div>
          <div style="font-size:11px;color:var(--t2)">@${esc(a.username || '?')} · ${fmtTime(p.created_at)}</div>
        </div>
      </div>
      ${p.text ? `<div style="font-size:14px;line-height:1.5;margin-bottom:10px;white-space:pre-wrap">${esc(p.text)}</div>` : ''}
      ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:100%;border-radius:10px;margin-bottom:10px;cursor:pointer" onclick="window.openImage('${esc(p.image_url)}')">` : ''}
      <div style="display:flex;gap:10px;font-size:13px;color:var(--t2)">
        <span>❤️ ${p.likes_count || 0}</span>
        <span>💬 ${p.comments_count || 0}</span>
      </div>
    </div>`;
  }).join('');
}

window.openPost = () => {
  openModal(`
    <h2 style="margin-bottom:14px">✏️ Новый пост</h2>
    <textarea id="postT" rows="5" placeholder="Что нового?" style="width:100%;padding:12px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px;resize:none;font-size:14px"></textarea>
    <input type="file" id="postImg" accept="image/*" style="width:100%;margin-bottom:14px">
    <button id="bPubP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">🚀 Опубликовать</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>
  `);
  $('bPubP').onclick = async () => {
    const text = $('postT').value.trim();
    const file = $('postImg').files[0];
    if (!text && !file) { toast('Добавь текст или фото'); return; }
    toast('Публикация...');
    let imageUrl = null;
    if (file) {
      try { imageUrl = await uploadFile('files', file, 'posts'); }
      catch(e) { toast('Ошибка: ' + e.message); return; }
    }
    const { error } = await sb.from('posts').insert({
      user_id: state.user.id, text: text || null, image_url: imageUrl,
      likes_count: 0, comments_count: 0
    });
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Опубликовано 🚀');
    closeModal();
    loadFeed();
  };
};

// ============ БАЛАНС ============
window.openBalance = async () => {
  const { data } = await sb.from('balance_log').select('*')
    .eq('user_id', state.user.id).order('id', { ascending: false }).limit(30);
  openModal(`
    <h2 style="margin-bottom:14px">💰 ${state.profile.balance || 0} SG</h2>
    <div style="max-height:400px;overflow-y:auto">
      ${(data || []).length ? data.map(l => `
        <div style="padding:10px;border-bottom:1px solid var(--br);display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px">${esc(l.reason || 'Начисление')}</div>
          <b style="color:${l.amount > 0 ? '#4caf50' : '#e53935'};font-size:14px">${l.amount > 0 ? '+' : ''}${l.amount}</b>
        </div>
      `).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Нет транзакций</div>'}
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

// ============ ПРОМОКОД ============
window.openPromo = () => {
  openModal(`
    <h2 style="margin-bottom:14px">🎁 Промокод</h2>
    <div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:12px">Введи промокод — получишь Plus, мод или SG-монеты.</div>
    <input id="promoI" placeholder="КОД" style="width:100%;padding:13px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);text-transform:uppercase;font-weight:700;letter-spacing:2px;text-align:center;font-size:15px;margin-bottom:8px">
    <div id="promoS" style="font-size:12px;text-align:center;min-height:16px;margin-bottom:8px"></div>
    <button id="bActP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:800;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">🎁 Активировать</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>
  `);
  $('bActP').onclick = async () => {
    const code = $('promoI').value.trim().toUpperCase();
    if (!code) return;
    const s = $('promoS');
    s.textContent = 'Проверка...';
    const { data: promo } = await sb.from('promocodes').select('*').eq('code', code).maybeSingle();
    if (!promo) { s.textContent = '❌ Не найден'; s.style.color = '#e53935'; return; }
    if (promo.uses >= promo.max_uses) { s.textContent = '❌ Исчерпан'; s.style.color = '#e53935'; return; }

    // Проверка повторной активации
    const { data: used } = await sb.from('promo_activations')
      .select('id').eq('user_id', state.user.id).eq('promo_code', code).maybeSingle();
    if (used) { s.textContent = '❌ Уже активирован'; s.style.color = '#e53935'; return; }

    const updates = {};
    if (promo.bonus_coins) updates.balance = (state.profile.balance || 0) + promo.bonus_coins;
    if (promo.days) {
      const until = new Date();
      until.setDate(until.getDate() + promo.days);
      updates.is_plus = true;
      updates.plus_until = until.toISOString();
    }
    if (promo.mod_code) {
      const mods = state.profile.mods || [];
      if (!mods.includes(promo.mod_code)) mods.push(promo.mod_code);
      updates.mods = mods;
    }

    const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { s.textContent = '❌ ' + error.message; s.style.color = '#e53935'; return; }

    await sb.from('promocodes').update({ uses: (promo.uses || 0) + 1 }).eq('id', promo.id);
    await sb.from('promo_activations').insert({ user_id: state.user.id, promo_code: code }).catch(()=>{});
    if (promo.bonus_coins) {
      await sb.from('balance_log').insert({
        user_id: state.user.id, amount: promo.bonus_coins, reason: 'Промокод ' + code
      });
    }
    await refreshProfile();
    s.textContent = '✅ Активирован!';
    s.style.color = '#4caf50';
    toast('🎉 Промокод активирован!');
    setTimeout(() => closeModal(), 1200);
  };
};

// ============ МАГАЗИН ============
window.openShop = async () => {
  const { data: items } = await sb.from('shop_items').select('*').limit(50);
  openModal(`
    <h2 style="margin-bottom:14px">🛒 Магазин</h2>
    <div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:12px;padding:12px;text-align:center;font-weight:700;margin-bottom:14px">💰 ${state.profile.balance || 0} SG</div>
    <div style="max-height:400px;overflow-y:auto">
      ${(items || []).length ? items.map(i => `
        <div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;font-size:14px">${esc(i.name)}</div>
            <div style="font-size:11px;color:var(--t2)">${esc(i.category || '')}</div>
          </div>
          <button onclick="window.buyItem('${i.id}')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">${i.price} SG</button>
        </div>
      `).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Магазин пуст</div>'}
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

window.buyItem = async (itemId) => {
  const { data: item } = await sb.from('shop_items').select('*').eq('id', itemId).single();
  if (!item) return;
  if ((state.profile.balance || 0) < item.price) { toast('Мало SG'); return; }
  await sb.from('profiles').update({ balance: state.profile.balance - item.price }).eq('id', state.user.id);
  await sb.from('user_purchases').insert({ user_id: state.user.id, item_id: itemId }).catch(()=>{});
  await sb.from('balance_log').insert({ user_id: state.user.id, amount: -item.price, reason: 'Покупка: ' + item.name });
  await refreshProfile();
  toast('Куплено ✅');
  window.openShop();
};

// ============ МОДЫ ============
window.openMods = () => {
  const mods = [
    { code: 'stalker', name: '🕵️ StalkerGram', desc: 'Видеть удалённые сообщения' },
    { code: 'ghost', name: '👻 GhostGram', desc: 'Невидимка — не показывать прочтение' },
    { code: 'antidelete', name: '🛡️ AntiDelete', desc: 'Восстанавливать удалённые' }
  ];
  const active = state.profile.mods || [];
  openModal(`
    <h2 style="margin-bottom:14px">🧩 Моды Spacegram</h2>
    <div style="background:var(--p2);border-radius:12px;padding:12px;font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:14px">Моды активируются промокодом: STALKFREE, GHOSTFREE, ANTIDELFREE</div>
    ${mods.map(m => `
      <div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:14px">${m.name}</div>
          <div style="font-size:11px;color:var(--t2)">${m.desc}</div>
        </div>
        <div style="font-size:12px;font-weight:700;color:${active.includes(m.code) ? '#4caf50' : 'var(--t2)'}">${active.includes(m.code) ? '✅ Активен' : '❌ Нет'}</div>
      </div>
    `).join('')}
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

// ============ ПОДАРКИ ============
window.openGifts = async () => {
  const { data: gifts } = await sb.from('gifts').select('*').limit(20);
  openModal(`
    <h2 style="margin-bottom:14px">🎁 Подарки</h2>
    <div style="max-height:400px;overflow-y:auto">
      ${(gifts || []).length ? gifts.map(g => `
        <div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;font-size:14px">${esc(g.name || '🎁 Подарок')}</div>
            <div style="font-size:11px;color:var(--t2)">${esc(g.description || '')}</div>
          </div>
          <button onclick="window.sendGift('${g.id}')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#e91e63,#9c27b0);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">${g.price || 0} SG</button>
        </div>
      `).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Подарков нет</div>'}
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
};

window.sendGift = async (giftId) => {
  const username = prompt('Кому подарить? @username');
  if (!username) return;
  const cleanU = username.replace('@','').toLowerCase();
  const { data: target } = await sb.from('profiles').select('*').eq('username', cleanU).maybeSingle();
  if (!target) { toast('Не найден'); return; }
  const { data: gift } = await sb.from('gifts').select('*').eq('id', giftId).single();
  if (!gift) return;
  if ((state.profile.balance || 0) < (gift.price || 0)) { toast('Мало SG'); return; }
  await sb.from('profiles').update({ balance: state.profile.balance - gift.price }).eq('id', state.user.id);
  await sb.from('profiles').update({ gifts_received: (target.gifts_received || 0) + 1 }).eq('id', target.id);
  await sb.from('balance_log').insert({ user_id: state.user.id, amount: -gift.price, reason: '🎁 Подарок @' + cleanU });
  await refreshProfile();
  toast('🎁 Отправлено @' + cleanU);
  closeModal();
};

// ============ ПРОСМОТР КАРТИНКИ ============
window.openImage = (url) => {
  openModal(`
    <img src="${esc(url)}" style="width:100%;border-radius:14px;display:block;margin-bottom:10px">
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>
  `);
};

// ============ МИНИ-ПРОФИЛЬ В ШАПКЕ ============
function renderProfileMini() {
  const p = state.profile;
  if (!p || !$('myA')) return;
  const init = (p.display_name || '?')[0].toUpperCase();
  $('myA').innerHTML = p.avatar_url
    ? `<img src="${esc(p.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : init;
}
/* ============================================================
   Часть 4: main(), обработчики, бот + 7 API, запись голосовых
   ============================================================ */

// ============ ГОЛОСОВЫЕ СООБЩЕНИЯ ============
let mediaRecorder = null;
let audioChunks = [];
let recordingStart = 0;

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingStart = Date.now();
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const dur = Math.round((Date.now() - recordingStart) / 1000);
      if (dur < 1) { toast('Слишком коротко'); return; }
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      await sendVoice(file, dur);
    };
    mediaRecorder.start();
    const mic = $('bMic');
    if (mic) { mic.textContent = '⏹'; mic.style.background = '#e53935'; }
    toast('🎤 Запись... нажми ещё раз');
  } catch (e) {
    toast('Нет доступа к микрофону');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    const mic = $('bMic');
    if (mic) { mic.textContent = '🎤'; mic.style.background = ''; }
  }
}

async function sendVoice(file, duration) {
  if (!state.currentChat) return;
  toast('Отправка...');
  try {
    const url = await uploadFile('files', file, 'voice');
    const payload = {
      chat_id: state.currentChat.id,
      sender: state.user.id,
      sender_name: state.profile.display_name,
      file_url: url,
      file_type: 'audio/webm',
      file_name: file.name,
      is_voice: true,
      duration,
      is_read: false,
      deleted: false
    };
    let { error } = await sb.from('messages').insert(payload);
    if (error && /sender_name/.test(error.message)) {
      delete payload.sender_name;
      const r = await sb.from('messages').insert(payload);
      error = r.error;
    }
    if (error) { toast('Ошибка: ' + error.message); return; }
    await sb.from('chats').update({ last_message: '🎤 Голосовое' }).eq('id', state.currentChat.id);
    await loadMessages();
  } catch (e) {
    toast('Ошибка: ' + e.message);
  }
}

// ============ 7 API ДЛЯ БОТА ============
async function apiWeather(city) {
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`).then(r => r.json());
    if (!geo.results?.length) return '❌ Город не найден';
    const { latitude, longitude, name } = geo.results[0];
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`).then(r => r.json());
    const c = w.current;
    const codes = {0:'☀️ Ясно',1:'🌤 Малооблачно',2:'⛅ Облачно',3:'☁️ Пасмурно',45:'🌫 Туман',61:'🌧 Дождь',71:'❄️ Снег',80:'🌦 Ливень',95:'⛈ Гроза'};
    const desc = codes[c.weather_code] || '🌡 ' + c.weather_code;
    return `🌍 **${name}**\n${desc}\n🌡 ${c.temperature_2m}°C\n💨 ${c.wind_speed_10m} км/ч`;
  } catch(e) { return '❌ Ошибка погоды'; }
}

async function apiJoke() {
  try {
    const j = await fetch('https://v2.jokeapi.dev/joke/Any?lang=ru&blacklistFlags=nsfw,racist,sexist').then(r => r.json());
    if (j.type === 'single') return '😄 ' + j.joke;
    return `😄 ${j.setup}\n\n||${j.delivery}||`;
  } catch(e) { return '❌ Ошибка шутки'; }
}

async function apiCat() {
  return 'https://cataas.com/cat?t=' + Date.now();
}

async function apiCrypto(symbol = 'bitcoin') {
  try {
    const d = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd,rub&include_24hr_change=true`).then(r => r.json());
    const c = d[symbol];
    if (!c) return '❌ Монета не найдена';
    const ch = c.usd_24h_change || 0;
    const arrow = ch >= 0 ? '📈' : '📉';
    return `${arrow} **${symbol.toUpperCase()}**\n💵 $${c.usd}\n🇷🇺 ${c.rub} ₽\n24ч: ${ch.toFixed(2)}%`;
  } catch(e) { return '❌ Ошибка крипты'; }
}

async function apiTrivia() {
  try {
    const d = await fetch('https://opentdb.com/api.php?amount=1&type=multiple').then(r => r.json());
    const q = d.results[0];
    const decode = (s) => s.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    const answers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
    const letters = ['A','B','C','D'];
    return `❓ **${decode(q.question)}**\n\n${answers.map((a,i) => `${letters[i]}) ${decode(a)}`).join('\n')}\n\n||✅ Правильно: ${decode(q.correct_answer)}||`;
  } catch(e) { return '❌ Ошибка викторины'; }
}

async function apiTranslate(text, to = 'ru') {
  try {
    const d = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${to}`).then(r => r.json());
    return '🌐 ' + (d.responseData?.translatedText || '❌ Не смог');
  } catch(e) { return '❌ Ошибка перевода'; }
}

function apiAIImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
  return url;
}

// ============ БОТ-ПОМОЩНИК ============
async function botReply(text) {
  const t = text.toLowerCase().trim();

  // /start /help
  if (/^\/?(start|help|помощь|хелп)$/.test(t)) {
    return `👋 Привет! Я **Spacegram Helper Bot**.

Вот что я умею:

🌤 **Погода** — \`погода Москва\`
😂 **Шутка** — \`шутка\`
🐱 **Котик** — \`котик\`
💰 **Крипта** — \`биткоин\` / \`btc\`
❓ **Викторина** — \`викторина\`
🌐 **Перевод** — \`переведи hello на русский\`
🎨 **AI-картинка** — \`нарисуй космонавта\`
📊 **Курсы** — \`курс доллара\`

Просто напиши команду!`;
  }

  // Погода
  const wm = t.match(/(?:погод[ауы]?|weather)\s+(.+)/i);
  if (wm) return await apiWeather(wm[1].trim());

  // Шутка
  if (/шутк|анекдот|joke/.test(t)) return await apiJoke();

  // Котик
  if (/котик|кошк|кот[^е]|cat/i.test(t)) return apiCat();

  // Крипта
  const cm = t.match(/(биткоин|btc|bitcoin|эфир|eth|ethereum|додж|doge|bnb|sol)/i);
  if (cm) {
    const map = { 'биткоин':'bitcoin','btc':'bitcoin','bitcoin':'bitcoin','эфир':'ethereum','eth':'ethereum','ethereum':'ethereum','додж':'dogecoin','doge':'dogecoin','bnb':'binancecoin','sol':'solana' };
    const sym = map[cm[1].toLowerCase()] || 'bitcoin';
    return await apiCrypto(sym);
  }

  // Викторина
  if (/викторин|trivia|вопрос/.test(t)) return await apiTrivia();

  // Перевод
  const tm = t.match(/(?:переведи|translate)\s+(.+?)(?:\s+на\s+(\w+))?$/i);
  if (tm) {
    const langMap = { 'русский':'ru','английский':'en','немецкий':'de','французский':'fr','испанский':'es','украинский':'uk','китайский':'zh','японский':'ja' };
    const to = langMap[(tm[2] || '').toLowerCase()] || 'ru';
    return await apiTranslate(tm[1], to);
  }

  // AI-картинка
  const im = t.match(/(?:нарисуй|сгенерируй|draw|imagine)\s+(.+)/i);
  if (im) {
    const prompt = im[1].trim();
    const url = apiAIImage(prompt);
    return `🎨 **${prompt}**\n\n![](${url})\n\n[Открыть](${url})`;
  }

  // Курс доллара/евро
  if (/курс\s+(доллар|евро|usd|eur)/.test(t)) {
    try {
      const d = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub').then(r => r.json());
      return `💵 Доллар ≈ ${d.tether?.rub || '?'} ₽`;
    } catch(e) { return '❌ Ошибка курса'; }
  }

  // Если ничего не подошло
  return `🤔 Не понял команду.\n\nНапиши **помощь** — покажу что умею.`;
}

// ============ ОБРАБОТЧИКИ КНОПОК ============

function bindButtons() {
  // Меню (бургер ⋮)
  const bSidebar = $('bSidebar');
  if (bSidebar) bSidebar.onclick = () => openSidebar();

  // Кнопки в шапке чатов
  const bindings = {
    'bAdm': () => openAdmin(),
    'bSet': () => openSettings(),
    'bShop': () => openShop(),
    'bBot': () => openBotChat(),
    'bGrp': () => openGroupCreate(),
    'bStickers': () => openMyStickers(),
    'bSaved': () => openSavedMessages(),
    'bFriends': () => toast('👥 Друзья — скоро'),
    'bVer': () => openVerification(),
    'bHelp': () => openBotChat(),
    'bApp': () => openWebApps(),
  };

  Object.entries(bindings).forEach(([id, fn]) => {
    const el = $(id);
    if (el) el.onclick = fn;
  });

  // В чате
  const chatActions = {
    'bStalk': () => openStalker(),
    'bChatGallery': () => openChatGallery(),
    'bSrch': () => openChatSearch(),
    'bMenu': () => openChatMenu(),
  };
  Object.entries(chatActions).forEach(([id, fn]) => {
    const el = $(id);
    if (el) el.onclick = fn;
  });

  // Back
  const bk = document.querySelector('.bk');
  if (bk) bk.onclick = back;

  // Отправка
  const msgI = $('msgI');
  const bSend = $('bSend');
  if (msgI) {
    msgI.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && state.settings.enterSend) {
        e.preventDefault();
        sendMessage();
      }
      // Индикатор печати
      if (state.currentChat && state.settings.showTyping) {
        clearTimeout(state.typingTimer);
        sb.from('profiles').update({ typing_until: new Date(Date.now() + 3000).toISOString() }).eq('id', state.user.id);
        state.typingTimer = setTimeout(() => {
          sb.from('profiles').update({ typing_until: null }).eq('id', state.user.id);
        }, 3000);
      }
      // Черновик
      clearTimeout(state.draftTimer);
      state.draftTimer = setTimeout(() => {
        if (state.currentChat) {
          if (msgI.value.trim()) localStorage.setItem('sg_draft_' + state.currentChat.id, msgI.value);
          else localStorage.removeItem('sg_draft_' + state.currentChat.id);
        }
      }, 500);
    };
  }
  if (bSend) bSend.onclick = sendMessage;

  // Плюс (вложения)
  const bPlus = $('bPlus');
  if (bPlus) bPlus.onclick = () => {
    const p = $('attP');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };

  // Эмодзи
  const bEmo = $('bEmo');
  if (bEmo) bEmo.onclick = () => {
    const w = $('emW');
    if (w) w.classList.toggle('show');
  };

  // Микрофон
  const bMic = $('bMic');
  if (bMic) {
    bMic.onclick = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') stopVoiceRecording();
      else startVoiceRecording();
    };
  }

  // Вложения в панели
  ['ap','af','as','ag','avn','ab','apo'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.onclick = () => {
      const attP = $('attP');
      if (attP) attP.style.display = 'none';
      const map = {
        'ap': () => pickFile('image/*'),
        'af': () => pickFile('*/*'),
        'as': () => openStickerPicker(),
        'ag': () => openGifPicker(),
        'avn': () => toast('⭕ Кружки — скоро'),
        'ab': () => toggleBurn(),
        'apo': () => openPollCreate(),
      };
      (map[id] || (()=>{}))();
    };
  });

  // Нижняя навигация
  document.querySelectorAll('.bn button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.bn button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      const tab = b.dataset.tab;
      switchTab(tab);
    };
  });

  // Вкладка "написать пост"
  const fcBtn = $('fcBtn');
  if (fcBtn) fcBtn.onclick = () => openPost();

  // Мой аватар → профиль
  const myA = $('myA');
  if (myA) myA.onclick = () => showProf();
}

// ============ SWITCH TAB ============
function switchTab(tab) {
  const sd = $('SD'), fd = $('fdScr'), pr = $('profM');
  // Скрываем всё
  if (sd) sd.style.display = 'none';
  if (fd) fd.style.display = 'none';

  if (tab === 'chats') {
    if (sd) sd.style.display = 'flex';
  } else if (tab === 'feed') {
    if (fd) fd.style.display = 'flex';
    loadFeed();
    if ($('fcBtn')) $('fcBtn').style.display = 'flex';
  } else if (tab === 'profile') {
    showProf();
  }
}

// ============ ФАЙЛЫ ============
function pickFile(accept = '*/*') {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = accept;
  inp.onchange = () => {
    const file = inp.files[0];
    if (file && state.currentChat) sendFile(file);
  };
  inp.click();
}

// ============ СТИКЕРЫ ============
function openStickerPicker() {
  const s = $('stkP');
  if (!s) return;
  s.classList.toggle('h');
  const g = $('stkG');
  if (g) {
    const allStickers = [
      '😀','😂','🥰','😎','🤔','😴','🤯','🥳','😭','😡','👍','👎','❤️','🔥','🎉','🚀','⭐','💯','✅','❌','🙏','🤝','👀','💀','🤡'
    ];
    g.innerHTML = allStickers.map(e =>
      `<button style="font-size:32px;padding:6px;border-radius:10px;background:var(--p2);border:none;cursor:pointer" onclick="window.sendSticker('${e}')">${e}</button>`
    ).join('');
  }
}

window.sendSticker = async (emoji) => {
  if (!state.currentChat) return;
  const payload = {
    chat_id: state.currentChat.id,
    sender: state.user.id,
    sender_name: state.profile.display_name,
    text: emoji, is_sticker: true,
    is_read: false, deleted: false
  };
  let { error } = await sb.from('messages').insert(payload);
  if (error && /sender_name/.test(error.message)) {
    delete payload.sender_name;
    const r = await sb.from('messages').insert(payload);
    error = r.error;
  }
  if (error) { toast('Ошибка'); return; }
  const p = $('stkP');
  if (p) p.classList.add('h');
  await loadMessages();
};

// ============ GIF ============
function openGifPicker() {
  const p = $('gifP');
  if (!p) return;
  p.classList.toggle('h');
  const inp = $('gifS');
  if (inp) {
    inp.oninput = async () => {
      const q = inp.value.trim();
      if (!q) return;
      try {
        const d = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=20`).then(r => r.json());
        const g = $('gifG');
        if (g) g.innerHTML = (d.data || []).map(x =>
          `<img src="${x.images.fixed_height_small.url}" style="width:100%;border-radius:8px;cursor:pointer" onclick="window.sendGif('${x.images.original.url}')">`
        ).join('');
      } catch(e) {}
    };
  }
}

window.sendGif = async (url) => {
  if (!state.currentChat) return;
  const payload = {
    chat_id: state.currentChat.id,
    sender: state.user.id,
    sender_name: state.profile.display_name,
    file_url: url,
    file_type: 'image/gif',
    is_read: false, deleted: false
  };
  let { error } = await sb.from('messages').insert(payload);
  if (error && /sender_name/.test(error.message)) {
    delete payload.sender_name;
    const r = await sb.from('messages').insert(payload);
    error = r.error;
  }
  if (error) { toast('Ошибка'); return; }
  const p = $('gifP');
  if (p) p.classList.add('h');
  await loadMessages();
};

// ============ САМОУНИЧТОЖЕНИЕ ============
function toggleBurn() {
  const p = $('brnP');
  if (!p) return;
  p.classList.toggle('h');
  const opts = $('brnO');
  if (opts) {
    opts.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', String(state.burnAfter) === b.dataset.b);
      b.onclick = () => {
        state.burnAfter = parseInt(b.dataset.b) || 0;
        opts.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        if (state.burnAfter > 0) toast('🔥 Самоуничтожение: ' + b.textContent);
      };
    });
  }
}

// ============ ОПРОС ============
function openPollCreate() {
  openModal(`
    <h2 style="margin-bottom:14px">📊 Новый опрос</h2>
    <input id="pollQ" placeholder="Вопрос" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px">
    <input class="poll-i" placeholder="Вариант 1" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:8px">
    <input class="poll-i" placeholder="Вариант 2" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:8px">
    <input class="poll-i" placeholder="Вариант 3 (опц.)" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:14px">
    <button id="bCrPoll" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">Создать</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>
  `);
  $('bCrPoll').onclick = async () => {
    const q = $('pollQ').value.trim();
    const opts = [...document.querySelectorAll('.poll-i')].map(i => i.value.trim()).filter(Boolean);
    if (!q || opts.length < 2) { toast('Нужен вопрос и 2 варианта'); return; }
    if (!state.currentChat) return;
    const payload = {
      chat_id: state.currentChat.id,
      sender: state.user.id,
      sender_name: state.profile.display_name,
      text: '📊 ' + q + '\n' + opts.map((o,i) => `${i+1}. ${o}`).join('\n'),
      is_read: false, deleted: false
    };
    let { error } = await sb.from('messages').insert(payload);
    if (error && /sender_name/.test(error.message)) {
      delete payload.sender_name;
      const r = await sb.from('messages').insert(payload);
      error = r.error;
    }
    if (error) { toast('Ошибка'); return; }
    closeModal();
    await loadMessages();
  };
}

// ============ САЙДБАР ============
function openSidebar() {
  let sb2 = document.querySelector('.sg-sidebar');
  if (!sb2) {
    sb2 = document.createElement('div');
    sb2.className = 'sg-sidebar';
    sb2.style.cssText = 'position:fixed;top:0;left:0;bottom:0;width:min(300px,80vw);background:var(--p);z-index:9999;padding:20px;overflow-y:auto;box-shadow:4px 0 24px rgba(0,0,0,.5);transform:translateX(-100%);transition:transform .25s';
    sb2.innerHTML = `
      <div style="font-size:20px;font-weight:800;margin-bottom:20px">✈️ Spacegram</div>
      <div id="sbMenu"></div>
    `;
    document.body.appendChild(sb2);
    const menu = [
      { i:'👤', t:'Мой профиль', a:() => { closeSidebar(); showProf(); } },
      { i:'📸', t:'Статусы', a:() => { closeSidebar(); openStories(); } },
      { i:'🛒', t:'Магазин', a:() => { closeSidebar(); openShop(); } },
      { i:'💰', t:'Баланс', a:() => { closeSidebar(); openBalance(); } },
      { i:'🎁', t:'Промокод', a:() => { closeSidebar(); openPromo(); } },
      { i:'🧩', t:'Моды', a:() => { closeSidebar(); openMods(); } },
      { i:'🎁', t:'Подарки', a:() => { closeSidebar(); openGifts(); } },
      { i:'⚙️', t:'Настройки', a:() => { closeSidebar(); openSettings(); } },
      { i:'🔒', t:'Приватность', a:() => { closeSidebar(); openPriv(); } },
    ];
    if (isAdmin()) menu.push({ i:'👑', t:'Админ-панель', a:() => { closeSidebar(); openAdmin(); } });
    menu.push({ i:'🚪', t:'Выйти', a:() => { if (confirm('Выйти?')) logout(); } });

    $('sbMenu').innerHTML = menu.map((m,i) =>
      `<button data-i="${i}" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:12px;background:transparent;color:var(--t);font-size:14px;font-weight:600;border:none;cursor:pointer;text-align:left;margin-bottom:4px">
        <span style="font-size:18px">${m.i}</span> ${m.t}
      </button>`
    ).join('');
    $('sbMenu').querySelectorAll('button').forEach(b => {
      b.onclick = () => menu[+b.dataset.i].a();
      b.onmouseenter = () => b.style.background = 'var(--p2)';
      b.onmouseleave = () => b.style.background = 'transparent';
    });

    // Overlay
    const ov = document.createElement('div');
    ov.className = 'sg-sidebar-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:none';
    ov.onclick = closeSidebar;
    document.body.appendChild(ov);
  }
  sb2.style.transform = 'translateX(0)';
  document.querySelector('.sg-sidebar-ov').style.display = 'block';
}
function closeSidebar() {
  const sb2 = document.querySelector('.sg-sidebar');
  const ov = document.querySelector('.sg-sidebar-ov');
  if (sb2) sb2.style.transform = 'translateX(-100%)';
  if (ov) ov.style.display = 'none';
}
window.closeSidebar = closeSidebar;

// ============ СОЗДАНИЕ ГРУППЫ ============
function openGroupCreate() {
  openModal(`
    <h2 style="margin-bottom:14px">➕ Новая группа/канал</h2>
    <div style="display:flex;gap:6px;margin-bottom:14px" id="typeGrp">
      <button data-t="group" style="flex:1;padding:10px;border-radius:10px;background:var(--a);color:#fff;font-weight:600;border:none;cursor:pointer">👥 Группа</button>
      <button data-t="channel" style="flex:1;padding:10px;border-radius:10px;background:var(--p2);color:var(--t);font-weight:600;border:none;cursor:pointer">📢 Канал</button>
    </div>
    <input id="grpName" placeholder="Название" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:14px">
    <button id="bCreateGrp" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">Создать</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>
  `);
  let type = 'group';
  document.querySelectorAll('#typeGrp button').forEach(b => b.onclick = () => {
    type = b.dataset.t;
    document.querySelectorAll('#typeGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
  });
  $('bCreateGrp').onclick = async () => {
    const name = $('grpName').value.trim();
    if (!name) { toast('Введи название'); return; }
    const payload = {
      is_group: type === 'group',
      is_channel: type === 'channel',
      group_name: name,
      created_by: state.user.id,
      user1: state.user.id,
      user2: state.user.id
    };
    const { data, error } = await sb.from('chats').insert(payload).select().single();
    if (error) { toast('Ошибка: ' + error.message); return; }
    closeModal();
    await loadChats();
    openChat(data.id);
  };
}

// ============ БОТ-ЧАТ ============
async function openBotChat() {
  // Найти или создать чат с ботом
  const BOT_USERNAME = 'spacegramhelperbot';
  let { data: botProfile } = await sb.from('profiles').select('*').eq('username', BOT_USERNAME).maybeSingle();

  if (!botProfile) {
    toast('🤖 Бот не найден в БД, но команды работают');
    // Просто покажем модалку с подсказкой
    openModal(`
      <h2 style="margin-bottom:14px">🤖 @Spacegramhelperbot</h2>
      <div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;line-height:1.6;color:var(--t2);margin-bottom:14px">
        Напиши мне в любом чате:<br><br>
        🌤 <b>погода Москва</b><br>
        😂 <b>шутка</b><br>
        🐱 <b>котик</b><br>
        💰 <b>биткоин</b><br>
        ❓ <b>викторина</b><br>
        🌐 <b>переведи hello на русский</b><br>
        🎨 <b>нарисуй космонавта</b>
      </div>
      <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Понятно</button>
    `);
    return;
  }

  // Чат с ботом
  const { data: existing } = await sb.from('chats').select('*')
    .or(`and(user1.eq.${state.user.id},user2.eq.${botProfile.id}),and(user1.eq.${botProfile.id},user2.eq.${state.user.id})`).maybeSingle();
  let chat = existing;
  if (!chat) {
    const { data } = await sb.from('chats').insert({
      user1: state.user.id, user2: botProfile.id, created_by: state.user.id
    }).select().single();
    chat = data;
  }
  await loadChats();
  if (chat) openChat(chat.id);
}

// ============ STALKER / ГАЛЕРЕЯ / ПОИСК ============
function openStalker() {
  if (!state.currentChat) return;
  const deleted = state.messages.filter(m => m.deleted);
  openModal(`
    <h2 style="margin-bottom:14px">🕵️ StalkerGram</h2>
    <div style="font-size:13px;color:var(--t2);margin-bottom:10px">Удалённые сообщения (${deleted.length}):</div>
    ${deleted.length ? deleted.map(m => `
      <div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px;font-size:13px;opacity:.7">
        <b>${esc(m.sender_name || '?')}:</b> ${esc(m.text || '[медиа]')}
      </div>
    `).join('') : '<div style="text-align:center;padding:20px;color:var(--t2)">Пусто</div>'}
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
}

function openChatGallery() {
  if (!state.currentChat) return;
  const media = state.messages.filter(m => m.file_url && (m.file_type || '').startsWith('image'));
  openModal(`
    <h2 style="margin-bottom:14px">🖼️ Галерея чата</h2>
    ${media.length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${media.map(m =>
      `<img src="${esc(m.file_url)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.openImage('${esc(m.file_url)}')">`
    ).join('')}</div>` : '<div style="text-align:center;padding:20px;color:var(--t2)">Нет фото</div>'}
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
}

function openChatSearch() {
  openModal(`
    <h2 style="margin-bottom:14px">🔍 Поиск</h2>
    <input id="chatSearchQ" placeholder="Что искать?" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:10px">
    <div id="chatSearchRes" style="max-height:300px;overflow-y:auto"></div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
  $('chatSearchQ').oninput = () => {
    const q = $('chatSearchQ').value.trim().toLowerCase();
    if (q.length < 2) { $('chatSearchRes').innerHTML = ''; return; }
    const found = state.messages.filter(m => (m.text || '').toLowerCase().includes(q));
    $('chatSearchRes').innerHTML = found.length
      ? found.slice(0, 30).map(m => `<div style="padding:8px;background:var(--p2);border-radius:8px;margin-bottom:6px;font-size:13px">
          <b>${esc(m.sender_name || '?')}:</b> ${esc((m.text || '').slice(0, 100))}
        </div>`).join('')
      : '<div style="text-align:center;padding:20px;color:var(--t2)">Ничего не найдено</div>';
  };
}

function openChatMenu() {
  if (!state.currentChat) return;
  const name = (state.currentChat.is_group || state.currentChat.is_channel)
    ? state.currentChat.group_name : state.currentChat.other?.display_name;
  openModal(`
    <h2 style="margin-bottom:14px">${esc(name || 'Чат')}</h2>
    <button onclick="window.clearChatHistory()" style="width:100%;padding:11px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:600;font-size:14px;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-bottom:8px">🗑 Очистить историю</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>
  `);
}

window.clearChatHistory = async () => {
  if (!state.currentChat) return;
  if (!confirm('Очистить все сообщения?')) return;
  await sb.from('messages').update({ deleted: true }).eq('chat_id', state.currentChat.id);
  await loadMessages();
  closeModal();
  toast('Очищено');
};

// ============ СОХРАНЁННЫЕ ============
function openSavedMessages() {
  toast('📌 Избранное — скоро');
}

function openMyStickers() {
  openModal(`
    <h2 style="margin-bottom:14px">🎨 Мои стикеры</h2>
    <input type="file" id="stkFile" accept="image/*" style="width:100%;margin-bottom:14px">
    <button onclick="window.uploadSticker()" style="width:100%;padding:11px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">➕ Загрузить</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>
  `);
}
window.uploadSticker = async () => {
  const f = $('stkFile')?.files[0];
  if (!f) { toast('Выбери файл'); return; }
  try {
    const url = await uploadFile('files', f, 'stickers');
    await sb.from('stickers').insert({ user_id: state.user.id, url, emoji: '🖼' });
    toast('Стикер загружен ✅');
    closeModal();
  } catch(e) { toast('Ошибка: ' + e.message); }
};

// ============ ВЕРИФИКАЦИЯ ============
function openVerification() {
  openModal(`
    <h2 style="margin-bottom:14px">✅ Верификация</h2>
    <div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:14px">
      Отправь заявку на получение галочки. Модератор рассмотрит и ответит.
    </div>
    <textarea id="verMsg" rows="4" placeholder="Ссылки на соцсети, портфолио..." style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t);border:1px solid var(--br);margin-bottom:14px;resize:none"></textarea>
    <button id="bSendVer" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>
  `);
  $('bSendVer').onclick = async () => {
    const msg = $('verMsg').value.trim();
    if (!msg) { toast('Напиши что-нибудь'); return; }
    await sb.from('verification_requests').insert({ user_id: state.user.id, message: msg, status: 'pending' }).catch(()=>{});
    toast('Заявка отправлена ✅');
    closeModal();
  };
}

// ============ WEB APPS ============
function openWebApps() {
  openModal(`
    <h2 style="margin-bottom:14px">📱 Web Apps</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button onclick="window.open('https://polls.spacegram.app')" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">📊 Опросы</button>
      <button onclick="window.open('https://games.spacegram.app')" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🎮 Игры</button>
      <button onclick="window.open('https://money.spacegram.app')" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">💰 Финансы</button>
      <button onclick="window.open('https://ai.spacegram.app')" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🤖 AI</button>
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
}

// ============ АДМИНКА ============
function openAdmin() {
  if (!isAdmin()) { toast('Нет доступа'); return; }
  openModal(`
    <h2 style="margin-bottom:14px">👑 Админ-панель</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button onclick="window.adminLoadUsers()" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">👥 Юзеры</button>
      <button onclick="window.adminLoadTickets()" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🎫 Тикеты</button>
      <button onclick="window.adminLoadReports()" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🚩 Жалобы</button>
      <button onclick="window.adminLoadStats()" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">📊 Стата</button>
    </div>
    <button onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>
  `);
}

window.adminLoadUsers = async () => {
  const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
  const users = data || [];
  openModal(`
    <h2 style="margin-bottom:14px">👥 Юзеры (${users.length})</h2>
    <div style="max-height:55vh;overflow-y:auto">
      ${users.map(u => `
        <div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;font-size:13px">${esc(u.display_name)} ${u.is_creator?'👑':''} ${u.is_verified?'✅':''} ${u.is_banned?'🚫':''}</div>
              <div style="font-size:11px;color:var(--t2)">@${esc(u.username)} · ${u.balance||0} SG · lvl ${u.level||1}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button onclick="window.adminToggleBan('${u.id}',${u.is_banned})" style="padding:5px 9px;border-radius:8px;background:${u.is_banned?'#4caf50':'#e53935'};color:#fff;font-size:11px;font-weight:600;border:none;cursor:pointer">${u.is_banned?'Разбан':'Бан'}</button>
              <button onclick="window.adminDeleteUser('${u.id}','${esc(u.username)}')" style="padding:5px 9px;border-radius:8px;background:rgba(229,57,53,.15);color:#e53935;font-size:11px;font-weight:600;border:1px solid rgba(229,57,53,.3);cursor:pointer">🗑</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <button onclick="window.openAdmin()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>
  `);
};

window.adminToggleBan = async (uid, isBanned) => {
  if (uid === state.user.id) { toast('Себя нельзя'); return; }
  if (isBanned) {
    await sb.from('profiles').update({ is_banned: false, ban_reason: null }).eq('id', uid);
    toast('✅ Разбанен');
  } else {
    const reason = prompt('Причина:', 'Нарушение') || 'Нарушение';
    await sb.from('profiles').update({ is_banned: true, ban_reason: reason }).eq('id', uid);
    toast('🚫 Забанен');
  }
  window.adminLoadUsers();
};

window.adminDeleteUser = async (uid, un) => {
  if (uid === state.user.id) { toast('Себя нельзя'); return; }
  if (!confirm(`Удалить @${un}?`)) return;
  await sb.from('messages').delete().eq('sender', uid);
  await sb.from('profiles').delete().eq('id', uid);
  toast('🗑 Удалён');
  window.adminLoadUsers();
};

window.adminLoadTickets = async () => {
  const { data } = await sb.from('tickets').select('*').order('id', { ascending: false }).limit(50);
  const tickets = data || [];
  openModal(`
    <h2 style="margin-bottom:14px">🎫 Тикеты (${tickets.length})</h2>
    <div style="max-height:55vh;overflow-y:auto">
      ${tickets.length ? tickets.map(t => `
        <div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px">
          <div style="font-weight:700;font-size:13px">${esc(t.subject || 'Без темы')}</div>
          <div style="font-size:11px;color:var(--t2)">${esc(t.email || '')} · ${esc(t.status || 'pending')}</div>
          <div style="font-size:12px;margin-top:6px;opacity:.8">${esc((t.message || '').slice(0, 200))}</div>
        </div>
      `).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Тикетов нет</div>'}
    </div>
    <button onclick="window.openAdmin()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>
  `);
};

window.adminLoadReports = async () => {
  const { data } = await sb.from('reports').select('*').eq('status', 'pending').limit(50).catch(() => ({ data: [] }));
  const reports = data || [];
  openModal(`
    <h2 style="margin-bottom:14px">🚩 Жалобы (${reports.length})</h2>
    <div style="max-height:55vh;overflow-y:auto">
      ${reports.length ? reports.map(r => `
        <div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px">
          <div style="font-weight:700;font-size:13px">${esc(r.reason || '?')}</div>
          <div style="font-size:11px;color:var(--t2)">msg: ${r.message_id}</div>
        </div>
      `).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Жалоб нет</div>'}
    </div>
    <button onclick="window.openAdmin()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>
  `);
};

window.adminLoadStats = async () => {
  const [{ count: u }, { count: c }, { count: m }] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('chats').select('id', { count: 'exact', head: true }),
    sb.from('messages').select('id', { count: 'exact', head: true }),
  ]);
  openModal(`
    <h2 style="margin-bottom:14px">📊 Статистика</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800">${u || 0}</div>
        <div style="font-size:11px;color:var(--t2)">👥 Юзеров</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800">${c || 0}</div>
        <div style="font-size:11px;color:var(--t2)">💬 Чатов</div>
      </div>
      <div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center;grid-column:1/-1">
        <div style="font-size:24px;font-weight:800">${m || 0}</div>
        <div style="font-size:11px;color:var(--t2)">📝 Сообщений</div>
      </div>
    </div>
    <button onclick="window.openAdmin()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>
  `);
};

// ============ ПРОВЕРКА БАНА ЧЕРЕЗ ИНТЕРВАЛ ============
function startBanWatch() {
  setInterval(async () => {
    if (!state.user) return;
    const { data } = await sb.from('profiles').select('is_banned,ban_reason').eq('id', state.user.id).single();
    if (data?.is_banned) {
      showBanBanner(data.ban_reason);
    }
  }, 30000);
}

// ============ ГЛАВНАЯ ============
(async function main() {
  console.log('🚀 Spacegram v12 init...');

  // Загрузка Supabase
  try {
    const createClient = await loadSupabase();
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase client создан');
  } catch (e) {
    console.error('❌ Не удалось загрузить Supabase:', e);
    document.body.innerHTML = `<div style="padding:40px;color:#fff;font-family:monospace;background:#0e1621;min-height:100vh">
      <h1>❌ Ошибка загрузки</h1>
      <p>Не удалось подключиться к Supabase. Проверь интернет и CDN.</p>
      <pre>${esc(e.message)}</pre>
      <button onclick="location.reload()" style="padding:12px 20px;margin-top:20px;border-radius:10px;background:#4a9eff;color:#fff;border:none;cursor:pointer">🔄 Перезагрузить</button>
    </div>`;
    return;
  }

  // Применение сохранённых настроек
  applyTheme(state.settings.theme);
  applyMode(state.settings.mode);
  applyFontSize(state.settings.fontSize);
  applyCorners(state.settings.corners);

  // Инициализация авторизации
  initAuth();

  // Проверка: есть ли сохранённый юзер
  const savedId = localStorage.getItem('sg_user_id');
  if (savedId) {
    const { data } = await sb.from('profiles').select('*').eq('id', savedId).maybeSingle();
    if (data) {
      if (data.is_banned) {
        // Показать бан-баннер, но не пускать
        showBanBanner(data.ban_reason);
        localStorage.removeItem('sg_user_id');
      } else {
        state.user = { id: data.id };
        state.profile = data;
        await enterApp();
        bindButtons();
        startBanWatch();
        console.log('✅ Автологин OK');
      }
    } else {
      localStorage.removeItem('sg_user_id');
    }
  }

  // Если зашли после логина/регистрации через initAuth — bindButtons вызовется внутри enterApp через события
  window.addEventListener('sg:logged-in', () => {
    bindButtons();
    startBanWatch();
  });

  // Обновить enterApp чтобы эмитить событие
  const _origEnter = enterApp;
  enterApp = async function() {
    await _origEnter();
    window.dispatchEvent(new Event('sg:logged-in'));
  };

  console.log('✅ Spacegram готов');
})();
