/* ============================================================
   SPACEGRAM v13 — FULL FIX
   Часть 1: Ядро, Supabase, helpers
   ============================================================ */

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

const SUPABASE_URL = 'https://qtuvtxbxtypvttfjiydv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA';

let sb = null;

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
    showTyping: localStorage.getItem('sg_typing') !== '0'
  }
};

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
    return h12 + ':' + m + ' ' + ampm;
  }
  return h + ':' + m;
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

function toast(msg, ms = 2200) {
  let t = $('sgToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sgToast';
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

function showBanBanner(reason) {
  let b = $('banBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'banBanner';
    document.body.appendChild(b);
  }
  b.innerHTML = '🚫 Вы забанены: ' + esc(reason || 'нарушение правил');
}

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

function isAdmin() {
  return state.profile?.is_creator === true || state.profile?.role === 'admin';
}

function canPostStories() {
  return state.profile?.is_plus || state.profile?.is_creator || state.profile?.role === 'admin';
}

function openModal(html) {
  let ov = $('sgModalOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sgModalOverlay';
    ov.className = 'md';
    ov.innerHTML = '<div class="mb" id="sgModalBox"></div>';
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
  }
  $('sgModalBox').innerHTML = html;
  ov.classList.add('show');
}

function closeModal() {
  const ov = $('sgModalOverlay');
  if (ov) ov.classList.remove('show');
}
window.closeModal = closeModal;

async function uploadFile(bucket, file, folder = '') {
  const ext = file.name.split('.').pop() || 'bin';
  const path = (folder ? folder + '/' : '') + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '.' + ext;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
/* ============================================================
   Часть 2: Авторизация, чаты, сообщения
   ============================================================ */

function initAuth() {
  const bL = $('bL'), bR = $('bR');
  const em = $('em'), pw = $('pw'), un = $('un');
  const err = $('AE');

  if (bL) bL.onclick = async () => {
    const email = em?.value.trim().toLowerCase();
    const username = un?.value.trim().toLowerCase().replace('@','');
    const password = pw?.value || '';
    if (err) err.textContent = '';

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
    if (profile.is_banned) { showBanBanner(profile.ban_reason); if (err) err.textContent = 'Забанен'; return; }

    localStorage.setItem('sg_user_id', profile.id);
    state.user = { id: profile.id };
    state.profile = profile;
    await enterApp();
  };

  if (bR) bR.onclick = async () => {
    const email = em?.value.trim().toLowerCase();
    const username = un?.value.trim().toLowerCase().replace('@','');
    const password = pw?.value || '';
    if (err) err.textContent = '';

    if (!username || !email || !password) { if (err) err.textContent = 'Заполни все поля'; return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { if (err) err.textContent = 'Username: 3-20 (a-z, 0-9, _)'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { if (err) err.textContent = 'Неверный email'; return; }
    if (password.length < 6) { if (err) err.textContent = 'Пароль ≥ 6'; return; }

    const { data: existing } = await sb.from('profiles').select('id').or(`username.eq.${username},email.eq.${email}`).maybeSingle();
    if (existing) { if (err) err.textContent = 'Username или email занят'; return; }

    const { data, error } = await sb.from('profiles').insert({
      username, email, pin_code: password, display_name: username,
      bio: 'Привет, я в Spacegram! 🚀', balance: 100
    }).select().single();

    if (error) { if (err) err.textContent = 'Ошибка: ' + error.message; return; }

    localStorage.setItem('sg_user_id', data.id);
    state.user = { id: data.id };
    state.profile = data;
    await enterApp();
  };

  const bUnban = $('bTUnban');
  if (bUnban) bUnban.onclick = () => {
    openModal(`
      <h2>🚫 Запрос на разбан</h2>
      <input id="unbanEmail" placeholder="Email аккаунта">
      <textarea id="unbanMsg" rows="4" placeholder="Объясни ситуацию..."></textarea>
      <button onclick="window.sendUnban()" class="primary" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button>
      <button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>
    `);
  };

  const bContact = $('bTContact');
  if (bContact) bContact.onclick = () => {
    openModal(`
      <h2>💬 Связаться с админом</h2>
      <input id="ticketEmail" placeholder="Email">
      <input id="ticketSubject" placeholder="Тема" maxlength="80">
      <textarea id="ticketText" rows="4" placeholder="Опиши проблему..."></textarea>
      <button onclick="window.sendTicket()" class="primary" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button>
      <button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>
    `);
  };

  const bAge = $('bTAge');
  if (bAge) bAge.onclick = () => {
    if (confirm('Тебе точно 16+?')) {
      localStorage.setItem('sg_age_verified', '1');
      toast('✅ Возраст подтверждён');
    }
  };
}

window.sendUnban = async () => {
  const email = $('unbanEmail')?.value.trim();
  const msg = $('unbanMsg')?.value.trim();
  if (!email || !msg) { toast('Заполни поля'); return; }
  try {
    await sb.from('tickets').insert({ email, subject: 'Разбан', message: msg, type: 'unban', status: 'pending' });
    toast('📤 Отправлено');
    closeModal();
  } catch (e) { toast('Ошибка: ' + e.message); }
};

window.sendTicket = async () => {
  const email = $('ticketEmail')?.value.trim();
  const subject = $('ticketSubject')?.value.trim();
  const text = $('ticketText')?.value.trim();
  if (!email || !text) { toast('Заполни поля'); return; }
  try {
    await sb.from('tickets').insert({ email, subject: subject || 'Обращение', message: text, type: 'contact', status: 'pending' });
    toast('📤 Отправлено');
    closeModal();
  } catch (e) { toast('Ошибка: ' + e.message); }
};

async function enterApp() {
  const auth = $('A'), app = $('APP');
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'flex';

  if (isAdmin() && $('bAdm')) $('bAdm').style.display = 'flex';

  await refreshProfile();
  await loadChats();
  await loadStickers();
  setupRealtime();
  setupPolling();

  renderProfileMini();
  bindButtons();

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
    if (!otherId || otherId === uid) {
      console.warn('⚠️ Чат без собеседника:', c.id);
      continue;
    }
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
    return '<div class="ch" data-id="' + c.id + '">' +
      '<div class="cv">' +
        (avatar ? '<img src="' + esc(avatar) + '">' : initial) +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:5px">' +
          esc(name) + ' ' + emoji + ' ' + plus +
        '</div>' +
        '<div style="color:var(--t2);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(last) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  el.querySelectorAll('.ch').forEach(item => {
    item.onclick = () => openChat(item.dataset.id);
  });
}

async function openChat(chatId) {
  const chat = state.chats.find(c => String(c.id) === String(chatId));
  if (!chat) return;

  state.currentChat = chat;
  state.replyTo = null;

  const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp'), ar = $('AR');
  if (ch) ch.style.display = 'flex';
  if (msgs) msgs.style.display = 'flex';
  if (inp) inp.style.display = 'flex';
  if (emp) emp.style.display = 'none';
  if (ar) ar.classList.add('active');

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
      ? '<img src="' + esc(avatar) + '">'
      : initial;
  }

  await loadMessages();
  await markMessagesRead();

  const draft = localStorage.getItem('sg_draft_' + chat.id);
  if (draft && $('msgI')) $('msgI').value = draft;
}

function back() {
  const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp'), ar = $('AR');
  if (ch) ch.style.display = 'none';
  if (msgs) msgs.style.display = 'none';
  if (inp) inp.style.display = 'none';
  if (emp) emp.style.display = 'flex';
  if (ar) ar.classList.remove('active');
  state.currentChat = null;
  state.replyTo = null;
}
window.back = back;

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
      dateSep = '<div style="text-align:center;color:var(--t2);font-size:11px;padding:12px 0;font-weight:600">' + dateKey + '</div>';
      lastDate = dateKey;
    }

    let content = '';
    if (m.deleted) {
      content = '<i style="opacity:.6">сообщение удалено</i>';
    } else {
      if (m.file_url) {
        const ft = m.file_type || '';
        if (ft.indexOf('image') === 0) {
          content += '<img src="' + esc(m.file_url) + '" class="msg-media" onclick="window.openImage(\'' + esc(m.file_url) + '\')">';
        } else if (ft.indexOf('video') === 0) {
          content += '<video src="' + esc(m.file_url) + '" controls class="msg-media"></video>';
        } else if (m.is_voice) {
          content += '<audio src="' + esc(m.file_url) + '" controls></audio>';
        } else {
          content += '<a href="' + esc(m.file_url) + '" target="_blank">📎 ' + esc(m.file_name || 'Файл') + '</a>';
        }
      }
      if (m.text) content += '<div style="white-space:pre-wrap">' + esc(m.text) + '</div>';
    }

    let reactionsHtml = '';
    const reactions = m.reactions || {};
    const keys = Object.keys(reactions).filter(k => reactions[k]?.length);
    if (keys.length) {
      reactionsHtml = '<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">' + keys.map(k =>
        '<span style="background:rgba(0,0,0,.25);padding:2px 8px;border-radius:12px;font-size:12px;cursor:pointer" onclick="window.toggleReaction(\'' + m.id + '\',\'' + k + '\')">' + k + ' ' + reactions[k].length + '</span>'
      ).join('') + '</div>';
    }

    let replyHtml = '';
    if (m.reply_to) {
      const rep = sorted.find(x => String(x.id) === String(m.reply_to));
      if (rep) {
        replyHtml = '<div style="border-left:2px solid var(--a);padding:2px 8px;margin-bottom:4px;font-size:12px;opacity:.85">' + esc((rep.text || '[медиа]').slice(0,50)) + '</div>';
      }
    }

    const showSender = !own && (state.currentChat.is_group || state.currentChat.is_channel);

    return dateSep + '<div class="m ' + (own ? 'me' : 'you') + '" data-id="' + m.id + '">' +
      (showSender ? '<div style="font-size:12px;font-weight:700;color:#4a9eff;margin-bottom:2px">' + esc(m.sender_name || 'Юзер') + '</div>' : '') +
      replyHtml +
      content +
      reactionsHtml +
      '<span class="msg-time">' + time + '</span>' +
    '</div>';
  }).join('');

  el.scrollTop = el.scrollHeight;
}

async function markMessagesRead() {
  if (!state.currentChat || !state.settings.readReceipts) return;
  const unread = state.messages.filter(m => m.sender !== state.user.id && !m.is_read).map(m => m.id);
  if (!unread.length) return;
  await sb.from('messages').update({ is_read: true }).in('id', unread);
}

async function sendMessage() {
  if (!state.currentChat) return;
  const inp = $('msgI');
  const text = inp?.value.trim();
  if (!text) return;

  inp.value = '';
  localStorage.removeItem('sg_draft_' + state.currentChat.id);

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

  if (state.replyTo) { payload.reply_to = state.replyTo.id; cancelRep(); }
  if (state.burnAfter > 0) payload.burn_after = state.burnAfter;

  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) {
    delete payload.sender_name;
    const r = await sb.from('messages').insert(payload);
    error = r.error;
  }
  if (error) { toast('Ошибка: ' + error.message); return; }

  await sb.from('chats').update({ last_message: text.slice(0, 80) }).eq('id', state.currentChat.id);
  await loadMessages();

  if (state.profile) {
    const newXp = (state.profile.xp || 0) + 1;
    const newLevel = Math.floor(newXp / 50) + 1;
    if (newLevel > (state.profile.level || 1)) {
      state.profile.level = newLevel;
      toast('🎉 Уровень ' + newLevel + '!');
    }
    state.profile.xp = newXp;
    state.profile.messages_count = (state.profile.messages_count || 0) + 1;
    try {
      await sb.from('profiles').update({
        xp: newXp, level: newLevel, messages_count: state.profile.messages_count
      }).eq('id', state.user.id);
    } catch(e) {}
  }
}
window.sendMessage = sendMessage;

function cancelRep() {
  state.replyTo = null;
  const rp = $('rP');
  if (rp) rp.style.display = 'none';
}
window.cancelRep = cancelRep;

window.toggleReaction = async (msgId, emoji) => {
  const { data: m } = await sb.from('messages').select('reactions').eq('id', msgId).single();
  if (!m) return;
  const reactions = m.reactions || {};
  reactions[emoji] = reactions[emoji] || [];
  const uid = state.user.id;
  if (reactions[emoji].indexOf(uid) !== -1) {
    reactions[emoji] = reactions[emoji].filter(x => x !== uid);
    if (!reactions[emoji].length) delete reactions[emoji];
  } else {
    reactions[emoji].push(uid);
  }
  await sb.from('messages').update({ reactions }).eq('id', msgId);
  if (navigator.vibrate) navigator.vibrate(15);
  await loadMessages();
};

async function sendFile(file) {
  if (!state.currentChat || !file) return;
  toast('Загрузка...');
  try {
    const url = await uploadFile('files', file, 'chat_' + state.currentChat.id);
    const payload = {
      chat_id: state.currentChat.id,
      sender: state.user.id,
      sender_name: state.profile.display_name,
      file_url: url,
      file_type: file.type || 'application/octet-stream',
      file_name: file.name,
      is_read: false,
      deleted: false
    };
    let { error } = await sb.from('messages').insert(payload);
    if (error && error.message.indexOf('sender_name') !== -1) {
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

async function loadStickers() {
  const { data } = await sb.from('stickers').select('*').limit(100);
  state.stickers = data || [];
}
/* ============================================================
   Часть 3: Профиль, настройки, сторис, лента, магазин
   ============================================================ */

const EMOJI_STATUSES = ['😀','😎','🤔','😴','🥳','😭','❤️','🔥','🚀','⭐','💯','🙏','👀','💀','🤡','🎮','📚','🎧','☕','🍕'];

function renderProfileMini() {
  const p = state.profile;
  if (!p || !$('myA')) return;
  const init = (p.display_name || '?')[0].toUpperCase();
  $('myA').innerHTML = p.avatar_url
    ? '<img src="' + esc(p.avatar_url) + '">'
    : init;
}

function showProf() {
  const p = state.profile;
  if (!p) return;
  const initial = (p.display_name || '?')[0].toUpperCase();

  openModal(
    '<h2>👤 Профиль</h2>' +
    '<div style="display:flex;justify-content:center;padding:10px 0 16px">' +
      '<div style="width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;color:#fff;overflow:hidden">' +
        (p.avatar_url ? '<img src="' + esc(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover">' : initial) +
      '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">' +
      '<div style="background:var(--p2);border-radius:12px;padding:10px;text-align:center">' +
        '<div style="font-size:18px;font-weight:800">' + (p.balance || 0) + '</div>' +
        '<div style="font-size:10px;color:var(--t2)">💰 SG</div>' +
      '</div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:10px;text-align:center">' +
        '<div style="font-size:18px;font-weight:800">' + (p.level || 1) + '</div>' +
        '<div style="font-size:10px;color:var(--t2)">🎯 Lvl</div>' +
      '</div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:10px;text-align:center">' +
        '<div style="font-size:18px;font-weight:800">' + (p.messages_count || 0) + '</div>' +
        '<div style="font-size:10px;color:var(--t2)">💬 Msgs</div>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Имя</div>' +
    '<input id="pN" value="' + esc(p.display_name || '') + '">' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Username</div>' +
    '<input value="@' + esc(p.username || '') + '" disabled style="opacity:.6">' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Телефон</div>' +
    '<input id="pPh" value="' + esc(p.phone || '') + '" placeholder="+7...">' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">О себе</div>' +
    '<textarea id="pB" rows="2" maxlength="200">' + esc(p.bio || '') + '</textarea>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">Эмодзи-статус</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px" id="emSt">' +
      EMOJI_STATUSES.map(e => '<button data-e="' + e + '" style="font-size:22px;padding:4px 8px;border-radius:10px;background:' + (p.emoji_status === e ? 'var(--a)' : 'var(--p2)') + ';border:none;cursor:pointer">' + e + '</button>').join('') +
    '</div>' +
    '<button id="bSaveP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;margin-bottom:8px">💾 Сохранить</button>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">' +
      '<button onclick="window.openProfileViews()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">👀 Кто смотрел</button>' +
      '<button onclick="window.openAnalytics()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">📊 Аналитика</button>' +
      '<button onclick="window.openBalance()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">💰 Баланс</button>' +
      '<button onclick="window.openShop()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">🛒 Магазин</button>' +
      '<button onclick="window.openPromo()" style="padding:11px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:700;font-size:13px;border:none;cursor:pointer">🎁 Промокод</button>' +
      '<button onclick="window.openMods()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">🧩 Моды</button>' +
      '<button onclick="window.openGifts()" style="padding:11px;border-radius:12px;background:linear-gradient(135deg,#e91e63,#9c27b0);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">🎁 Подарки</button>' +
      '<button onclick="window.openQR()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">📱 QR</button>' +
      '<button onclick="window.shareProfile()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">🔗 Поделиться</button>' +
      '<button onclick="window.exportData()" class="gh" style="padding:11px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;font-size:13px;cursor:pointer">📥 Экспорт</button>' +
    '</div>' +
    '<button onclick="window.logout()" style="width:100%;padding:13px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;font-size:14px;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-top:12px">🚪 Выйти</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:6px">Закрыть</button>'
  );

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
    renderProfileMini();
    toast('Сохранено ✅');
    closeModal();
  };
}
window.showProf = showProf;

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

  openModal(
    '<h2>👀 Кто смотрел профиль</h2>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      (views.length ? views.map(v => {
        const p = profs[v.viewer_id];
        if (!p) return '';
        const init = (p.display_name || '?')[0].toUpperCase();
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--p2);border-radius:10px;margin-bottom:6px">' +
          '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0">' +
            (p.avatar_url ? '<img src="' + esc(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover">' : init) +
          '</div>' +
          '<div style="flex:1">' +
            '<div style="font-weight:600;font-size:13px">' + esc(p.display_name) + '</div>' +
            '<div style="font-size:11px;color:var(--t2)">@' + esc(p.username) + ' · ' + fmtDate(v.viewed_at || v.created_at) + '</div>' +
          '</div>' +
        '</div>';
      }).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Пока никто не смотрел 😢</div>') +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.openAnalytics = async () => {
  let msgCount = 0, chatCount = 0, storyCount = 0;
  try {
    const r1 = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('sender', state.user.id);
    msgCount = r1.count || 0;
  } catch(e) {}
  try {
    const r2 = await sb.from('chats').select('id', { count: 'exact', head: true }).or(`user1.eq.${state.user.id},user2.eq.${state.user.id}`);
    chatCount = r2.count || 0;
  } catch(e) {}
  try {
    const r3 = await sb.from('stories').select('id', { count: 'exact', head: true }).eq('user_id', state.user.id);
    storyCount = r3.count || 0;
  } catch(e) {}

  const created = new Date(state.profile.created_at || Date.now());
  const days = Math.max(1, Math.floor((Date.now() - created.getTime()) / 86400000));

  openModal(
    '<h2>📊 Аналитика профиля</h2>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + msgCount + '</div><div style="font-size:11px;color:var(--t2);margin-top:4px">💬 Сообщений</div></div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + chatCount + '</div><div style="font-size:11px;color:var(--t2);margin-top:4px">💭 Чатов</div></div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + storyCount + '</div><div style="font-size:11px;color:var(--t2);margin-top:4px">📸 Статусов</div></div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + days + '</div><div style="font-size:11px;color:var(--t2);margin-top:4px">📅 Дней в SG</div></div>' +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.shareProfile = async () => {
  const url = location.origin + '?u=' + state.profile.username;
  const text = 'Мой профиль Spacegram @' + state.profile.username;
  if (navigator.share) {
    try { await navigator.share({ title: 'Spacegram', text, url }); } catch(e){}
  } else {
    try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована ✅'); }
    catch(e){ toast('Ошибка'); }
  }
};

window.openQR = () => {
  const url = location.origin + '?u=' + state.profile.username;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url);
  openModal(
    '<h2 style="text-align:center">📱 QR-код профиля</h2>' +
    '<div style="background:#fff;padding:16px;border-radius:16px;display:flex;justify-content:center;margin-bottom:14px">' +
      '<img src="' + qrUrl + '" style="width:100%;max-width:250px;display:block">' +
    '</div>' +
    '<div style="text-align:center;color:var(--t2);font-size:13px;margin-bottom:14px">@' + esc(state.profile.username) + '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button>'
  );
};

window.exportData = async () => {
  const data = { profile: state.profile, chats: state.chats.length, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spacegram_' + state.profile.username + '.json';
  a.click();
  toast('Экспортировано 📥');
};

/* ============ НАСТРОЙКИ ============ */
function toggleRow(id, label, checked) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--br)">' +
    '<div style="font-size:14px">' + label + '</div>' +
    '<label style="position:relative;display:inline-block;width:44px;height:24px">' +
      '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' style="opacity:0;width:0;height:0">' +
      '<span class="sg-slider" style="position:absolute;cursor:pointer;inset:0;background:' + (checked ? 'var(--a)' : '#444') + ';border-radius:24px;transition:.2s"></span>' +
      '<span class="sg-knob" style="position:absolute;height:18px;width:18px;left:' + (checked ? '23px' : '3px') + ';bottom:3px;background:#fff;border-radius:50%;transition:.2s"></span>' +
    '</label>' +
  '</div>';
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

window.openSettings = function() {
  const s = state.settings;
  const themes = ['midnight','purple','ocean','sunset','rose','forest','cyber','mono'];

  openModal(
    '<h2>⚙️ Настройки</h2>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">🎨 Тема</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px" id="themeGrid">' +
      themes.map(t => '<button data-th="' + t + '" class="gh" style="padding:10px;border-radius:10px;background:var(--p2);border:2px solid ' + (s.theme === t ? 'var(--a)' : 'transparent') + ';color:var(--t);font-size:11px;font-weight:600;cursor:pointer">' + t + '</button>').join('') +
    '</div>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">🌗 Режим</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:14px">' +
      '<button data-m="dark" class="gh" style="flex:1;padding:10px;border-radius:10px;background:' + (s.mode === 'dark' ? 'var(--a)' : 'var(--p2)') + ';color:' + (s.mode === 'dark' ? '#fff' : 'var(--t)') + ';font-weight:600;border:none;cursor:pointer">🌙 Тёмный</button>' +
      '<button data-m="light" class="gh" style="flex:1;padding:10px;border-radius:10px;background:' + (s.mode === 'light' ? 'var(--a)' : 'var(--p2)') + ';color:' + (s.mode === 'light' ? '#fff' : 'var(--t)') + ';font-weight:600;border:none;cursor:pointer">☀️ Светлый</button>' +
    '</div>' +
    toggleRow('cbSound', '🔊 Звук', s.sound) +
    toggleRow('cbVib', '📳 Вибрация', s.vibrate) +
    toggleRow('cbPrev', '💬 Превью', s.preview) +
    toggleRow('cbRead', '✓✓ Прочтение', s.readReceipts) +
    toggleRow('cbEnter', '⌨️ Enter = отправить', s.enterSend) +
    toggleRow('cbGhost', '👻 Ghost-режим', s.ghost) +
    toggleRow('cbTyping', '⌨️ Показывать «печатает»', s.showTyping) +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );

  document.querySelectorAll('#themeGrid button').forEach(b => b.onclick = () => {
    state.settings.theme = b.dataset.th;
    applyTheme(b.dataset.th);
    document.querySelectorAll('#themeGrid button').forEach(x => x.style.border = '2px solid transparent');
    b.style.border = '2px solid var(--a)';
  });

  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    state.settings.mode = b.dataset.m;
    applyMode(b.dataset.m);
    document.querySelectorAll('[data-m]').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
  });

  bindToggle('cbSound', v => { state.settings.sound = v; localStorage.setItem('sg_sound', v ? '1' : '0'); });
  bindToggle('cbVib', v => { state.settings.vibrate = v; localStorage.setItem('sg_vibrate', v ? '1' : '0'); });
  bindToggle('cbPrev', v => { state.settings.preview = v; localStorage.setItem('sg_preview', v ? '1' : '0'); });
  bindToggle('cbRead', v => { state.settings.readReceipts = v; localStorage.setItem('sg_read', v ? '1' : '0'); });
  bindToggle('cbEnter', v => { state.settings.enterSend = v; localStorage.setItem('sg_enter', v ? '1' : '0'); });
  bindToggle('cbGhost', v => {
    state.settings.ghost = v;
    localStorage.setItem('sg_ghost', v ? '1' : '0');
    try { sb.from('profiles').update({ ghost_mode: v }).eq('id', state.user.id); } catch(e) {}
  });
  bindToggle('cbTyping', v => { state.settings.showTyping = v; localStorage.setItem('sg_typing', v ? '1' : '0'); });
};

window.openStories = async () => {
  let stories = [];
  try {
    const r = await sb.from('stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100);
    stories = r.data || [];
  } catch(e) {}
  const byUser = {};
  stories.forEach(s => {
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push(s);
  });
  const uids = Object.keys(byUser);
  const authors = {};
  if (uids.length) {
    try {
      const r = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', uids);
      (r.data || []).forEach(p => authors[p.id] = p);
    } catch(e) {}
  }
  const canPost = canPostStories();
  const myStories = byUser[state.user.id] || [];
  const others = Object.keys(byUser).filter(u => u !== state.user.id);

  openModal(
    '<h2>📸 Статусы</h2>' +
    (canPost
      ? '<button onclick="window.addStory()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:14px">＋ Добавить статус</button>'
      : '<div style="text-align:center;padding:12px;background:var(--p2);border-radius:12px;margin-bottom:14px;color:var(--t2);font-size:13px">⭐ Статусы только для Plus</div>') +
    (myStories.length ? '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;font-weight:700">МОИ СТАТУСЫ</div>' +
      '<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;margin-bottom:14px">' +
        myStories.map(s => '<div style="text-align:center;flex-shrink:0;cursor:pointer" onclick="window.viewStory(\'' + s.id + '\')">' +
          '<div style="width:68px;height:68px;border-radius:50%;background:' + (s.bg_color || 'var(--a)') + ';border:3px solid var(--a);display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;margin-bottom:4px">' +
            (s.media_url ? '<img src="' + esc(s.media_url) + '" style="width:100%;height:100%;object-fit:cover">' : '📝') +
          '</div>' +
          '<div style="font-size:10px;color:var(--t2)">' + fmtTime(s.created_at) + '</div>' +
        '</div>').join('') +
      '</div>' : '') +
    (others.length ? '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;font-weight:700">ДРУГИЕ</div>' +
      '<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">' +
        others.map(uid => {
          const a = authors[uid];
          const userStories = byUser[uid];
          const latest = userStories[0];
          const init = (a?.display_name || '?')[0].toUpperCase();
          return '<div style="text-align:center;flex-shrink:0;cursor:pointer;min-width:70px" onclick="window.viewStory(\'' + latest.id + '\')">' +
            '<div style="width:68px;height:68px;border-radius:50%;background:' + (latest.bg_color || 'var(--a)') + ';border:3px solid var(--a);display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;margin:0 auto 4px">' +
              (latest.media_url ? '<img src="' + esc(latest.media_url) + '" style="width:100%;height:100%;object-fit:cover">' : (a?.avatar_url ? '<img src="' + esc(a.avatar_url) + '" style="width:100%;height:100%;object-fit:cover">' : init)) +
            '</div>' +
            '<div style="font-size:10px;color:var(--t2);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 auto">' + esc(a?.display_name || '?') + '</div>' +
          '</div>';
        }).join('') +
      '</div>' : '') +
    (!myStories.length && !others.length ? '<div style="text-align:center;padding:30px;color:var(--t2)">Пока нет статусов 😢</div>' : '') +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.addStory = () => {
  if (!canPostStories()) { toast('⭐ Только для Plus'); return; }
  openModal(
    '<h2>📸 Новый статус</h2>' +
    '<input type="file" id="storyFile" accept="image/*,video/*" style="width:100%;margin-bottom:10px">' +
    '<textarea id="storyText" placeholder="Текст" rows="2"></textarea>' +
    '<button id="bPubStory" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">📸 Опубликовать</button>' +
    '<button onclick="window.openStories()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">← Назад</button>'
  );
  $('bPubStory').onclick = async () => {
    const file = $('storyFile').files[0];
    const text = $('storyText').value.trim();
    if (!file && !text) { toast('Добавь фото или текст'); return; }
    toast('Публикация...');
    let mediaUrl = null, mediaType = 'text';
    if (file) {
      try {
        mediaUrl = await uploadFile('stories', file, state.user.id);
        mediaType = file.type.indexOf('video') === 0 ? 'video' : 'image';
      } catch(e) { toast('Ошибка: ' + e.message); return; }
    }
    const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    try {
      await sb.from('stories').insert({
        user_id: state.user.id, text_content: text || null,
        media_url: mediaUrl, media_type: mediaType, bg_color: '#5288c1',
        duration: 5, expires_at: expires, views: []
      });
      toast('Опубликовано 📸');
      window.openStories();
    } catch(e) { toast('Ошибка: ' + e.message); }
  };
};

window.viewStory = async (sid) => {
  const { data: story } = await sb.from('stories').select('*').eq('id', sid).single();
  if (!story) return;
  const { data: author } = await sb.from('profiles').select('*').eq('id', story.user_id).maybeSingle();
  const views = story.views || [];
  if (views.indexOf(state.user.id) === -1) {
    views.push(state.user.id);
    try { await sb.from('stories').update({ views }).eq('id', sid); } catch(e) {}
  }
  openModal(
    '<div style="background:' + (story.bg_color || '#000') + ';border-radius:14px;padding:20px;min-height:360px;display:flex;flex-direction:column;justify-content:center;align-items:center;position:relative;margin-bottom:14px">' +
      (story.media_url
        ? (story.media_type === 'video'
          ? '<video src="' + esc(story.media_url) + '" style="max-width:100%;max-height:360px;border-radius:10px" autoplay controls></video>'
          : '<img src="' + esc(story.media_url) + '" style="max-width:100%;max-height:360px;border-radius:10px;object-fit:contain">')
        : '') +
      (story.text_content ? '<div style="font-size:18px;font-weight:600;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);margin-top:14px;padding:10px;background:rgba(0,0,0,.35);border-radius:10px;text-align:center">' + esc(story.text_content) + '</div>' : '') +
      '<div style="position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px">' +
        '<div style="width:32px;height:32px;border-radius:50%;background:#4a9eff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0">' +
          (author?.avatar_url ? '<img src="' + esc(author.avatar_url) + '" style="width:100%;height:100%;object-fit:cover">' : (author?.display_name || '?')[0].toUpperCase()) +
        '</div>' +
        '<div style="flex:1;color:#fff;font-size:12px;text-shadow:0 1px 4px rgba(0,0,0,.8)">' +
          '<b>' + esc(author?.display_name || 'Юзер') + '</b><br>' +
          '<span style="opacity:.8">' + fmtTime(story.created_at) + ' · 👁 ' + views.length + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button onclick="window.openStories()" class="gh" style="flex:1;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">← Назад</button>' +
      (story.user_id !== state.user.id
        ? '<button onclick="window.storyReply(\'' + sid + '\',\'' + story.user_id + '\')" style="flex:1;padding:11px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">💬 Ответить</button>'
        : '<button onclick="window.deleteStory(\'' + sid + '\')" style="flex:1;padding:11px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;font-size:13px;border:1px solid rgba(229,57,53,.3);cursor:pointer">🗑 Удалить</button>') +
    '</div>'
  );
};

window.deleteStory = async (sid) => {
  if (!confirm('Удалить?')) return;
  try { await sb.from('stories').delete().eq('id', sid); toast('Удалено'); window.openStories(); } catch(e) { toast('Ошибка'); }
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
    return '<div style="background:var(--p);border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--br)">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0">' +
          (a.avatar_url ? '<img src="' + esc(a.avatar_url) + '" style="width:100%;height:100%;object-fit:cover">' : init) +
        '</div>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:14px">' + esc(a.display_name || 'Юзер') + ' ' + (a.is_verified ? '✅' : '') + ' ' + (a.is_plus ? '⭐' : '') + '</div>' +
          '<div style="font-size:11px;color:var(--t2)">@' + esc(a.username || '?') + ' · ' + fmtTime(p.created_at) + '</div>' +
        '</div>' +
      '</div>' +
      (p.text ? '<div style="font-size:14px;line-height:1.5;margin-bottom:10px;white-space:pre-wrap">' + esc(p.text) + '</div>' : '') +
      (p.image_url ? '<img src="' + esc(p.image_url) + '" style="width:100%;border-radius:10px;margin-bottom:10px;cursor:pointer" onclick="window.openImage(\'' + esc(p.image_url) + '\')">' : '') +
      '<div style="display:flex;gap:10px;font-size:13px;color:var(--t2)">' +
        '<span>❤️ ' + (p.likes_count || 0) + '</span>' +
        '<span>💬 ' + (p.comments_count || 0) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

window.openPost = () => {
  openModal(
    '<h2>✏️ Новый пост</h2>' +
    '<textarea id="postT" rows="5" placeholder="Что нового?"></textarea>' +
    '<input type="file" id="postImg" accept="image/*" style="width:100%;margin-bottom:14px">' +
    '<button id="bPubP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">🚀 Опубликовать</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>'
  );
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
    try {
      await sb.from('posts').insert({ user_id: state.user.id, text: text || null, image_url: imageUrl, likes_count: 0, comments_count: 0 });
      toast('Опубликовано 🚀');
      closeModal();
      loadFeed();
    } catch(e) { toast('Ошибка: ' + e.message); }
  };
};

window.openBalance = async () => {
  const { data } = await sb.from('balance_log').select('*')
    .eq('user_id', state.user.id).order('id', { ascending: false }).limit(30);
  openModal(
    '<h2>💰 ' + (state.profile.balance || 0) + ' SG</h2>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      ((data || []).length ? data.map(l =>
        '<div style="padding:10px;border-bottom:1px solid var(--br);display:flex;justify-content:space-between;align-items:center">' +
          '<div style="font-size:13px">' + esc(l.reason || 'Начисление') + '</div>' +
          '<b style="color:' + (l.amount > 0 ? '#4caf50' : '#e53935') + ';font-size:14px">' + (l.amount > 0 ? '+' : '') + l.amount + '</b>' +
        '</div>'
      ).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Нет транзакций</div>') +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.openPromo = () => {
  openModal(
    '<h2>🎁 Промокод</h2>' +
    '<div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:12px">Введи промокод.</div>' +
    '<input id="promoI" placeholder="КОД" style="text-transform:uppercase;text-align:center;font-weight:700;letter-spacing:2px">' +
    '<div id="promoS" style="font-size:12px;text-align:center;min-height:16px;margin-bottom:8px"></div>' +
    '<button id="bActP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:800;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">🎁 Активировать</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>'
  );
  $('bActP').onclick = async () => {
    const code = $('promoI').value.trim().toUpperCase();
    if (!code) return;
    const s = $('promoS');
    s.textContent = 'Проверка...';
    const { data: promo } = await sb.from('promocodes').select('*').eq('code', code).maybeSingle();
    if (!promo) { s.textContent = '❌ Не найден'; s.style.color = '#e53935'; return; }
    if (promo.uses >= promo.max_uses) { s.textContent = '❌ Исчерпан'; s.style.color = '#e53935'; return; }
    const updates = {};
    if (promo.bonus_coins) updates.balance = (state.profile.balance || 0) + promo.bonus_coins;
    if (promo.days) {
      const until = new Date();
      until.setDate(until.getDate() + promo.days);
      updates.is_plus = true;
      updates.plus_until = until.toISOString();
    }
    const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { s.textContent = '❌ ' + error.message; s.style.color = '#e53935'; return; }
    try { await sb.from('promocodes').update({ uses: (promo.uses || 0) + 1 }).eq('id', promo.id); } catch(e) {}
    if (promo.bonus_coins) {
      try { await sb.from('balance_log').insert({ user_id: state.user.id, amount: promo.bonus_coins, reason: 'Промокод ' + code }); } catch(e) {}
    }
    await refreshProfile();
    s.textContent = '✅ Активирован!';
    s.style.color = '#4caf50';
    toast('🎉 Промокод активирован!');
    setTimeout(() => closeModal(), 1200);
  };
};

window.openShop = async () => {
  const { data: items } = await sb.from('shop_items').select('*').limit(50);
  openModal(
    '<h2>🛒 Магазин</h2>' +
    '<div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:12px;padding:12px;text-align:center;font-weight:700;margin-bottom:14px">💰 ' + (state.profile.balance || 0) + ' SG</div>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      ((items || []).length ? items.map(i =>
        '<div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-weight:700;font-size:14px">' + esc(i.name) + '</div><div style="font-size:11px;color:var(--t2)">' + esc(i.category || '') + '</div></div>' +
          '<button onclick="window.buyItem(\'' + i.id + '\')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">' + i.price + ' SG</button>' +
        '</div>'
      ).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Магазин пуст</div>') +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.buyItem = async (itemId) => {
  const { data: item } = await sb.from('shop_items').select('*').eq('id', itemId).single();
  if (!item) return;
  if ((state.profile.balance || 0) < item.price) { toast('Мало SG'); return; }
  try {
    await sb.from('profiles').update({ balance: state.profile.balance - item.price }).eq('id', state.user.id);
    try { await sb.from('user_purchases').insert({ user_id: state.user.id, item_id: itemId }); } catch(e) {}
    try { await sb.from('balance_log').insert({ user_id: state.user.id, amount: -item.price, reason: 'Покупка: ' + item.name }); } catch(e) {}
    await refreshProfile();
    toast('Куплено ✅');
    window.openShop();
  } catch(e) { toast('Ошибка: ' + e.message); }
};

window.openMods = () => {
  const mods = [
    { code: 'stalker', name: '🕵️ StalkerGram', desc: 'Видеть удалённые' },
    { code: 'ghost', name: '👻 GhostGram', desc: 'Невидимка' },
    { code: 'antidelete', name: '🛡️ AntiDelete', desc: 'Восстанавливать удалённые' }
  ];
  const active = state.profile.mods || [];
  openModal(
    '<h2>🧩 Моды Spacegram</h2>' +
    '<div style="background:var(--p2);border-radius:12px;padding:12px;font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:14px">Промокоды: STALKFREE, GHOSTFREE, ANTIDELFREE</div>' +
    mods.map(m =>
      '<div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
        '<div><div style="font-weight:700;font-size:14px">' + m.name + '</div><div style="font-size:11px;color:var(--t2)">' + m.desc + '</div></div>' +
        '<div style="font-size:12px;font-weight:700;color:' + (active.indexOf(m.code) !== -1 ? '#4caf50' : 'var(--t2)') + '">' + (active.indexOf(m.code) !== -1 ? '✅ Активен' : '❌ Нет') + '</div>' +
      '</div>'
    ).join('') +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.openGifts = async () => {
  const { data: gifts } = await sb.from('gifts').select('*').limit(20);
  openModal(
    '<h2>🎁 Подарки</h2>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      ((gifts || []).length ? gifts.map(g =>
        '<div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-weight:700;font-size:14px">' + esc(g.name || '🎁') + '</div><div style="font-size:11px;color:var(--t2)">' + esc(g.description || '') + '</div></div>' +
          '<button onclick="window.sendGift(\'' + g.id + '\')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#e91e63,#9c27b0);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">' + (g.price || 0) + ' SG</button>' +
        '</div>'
      ).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Подарков нет</div>') +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.sendGift = async (giftId) => {
  const username = prompt('Кому? @username');
  if (!username) return;
  const cleanU = username.replace('@','').toLowerCase();
  const { data: target } = await sb.from('profiles').select('*').eq('username', cleanU).maybeSingle();
  if (!target) { toast('Не найден'); return; }
  const { data: gift } = await sb.from('gifts').select('*').eq('id', giftId).single();
  if (!gift) return;
  if ((state.profile.balance || 0) < (gift.price || 0)) { toast('Мало SG'); return; }
  try {
    await sb.from('profiles').update({ balance: state.profile.balance - gift.price }).eq('id', state.user.id);
    await sb.from('profiles').update({ gifts_received: (target.gifts_received || 0) + 1 }).eq('id', target.id);
    try { await sb.from('balance_log').insert({ user_id: state.user.id, amount: -gift.price, reason: '🎁 Подарок @' + cleanU }); } catch(e) {}
    await refreshProfile();
    toast('🎁 Отправлено @' + cleanU);
    closeModal();
  } catch(e) { toast('Ошибка: ' + e.message); }
};

window.openImage = (url) => {
  openModal(
    '<img src="' + esc(url) + '" style="width:100%;border-radius:14px;display:block;margin-bottom:10px">' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>'
  );
};
/* ============================================================
   Часть 4: Обработчики, бот, голос, main
   ============================================================ */

let mediaRecorder = null;
let audioChunks = [];

function bindButtons() {
  const bSidebar = $('bSidebar');
  if (bSidebar) bSidebar.onclick = () => openSidebar();

  const bindings = {
    'bAdm': () => window.openAdmin(),
    'bSet': () => window.openSettings(),
    'bShop': () => window.openShop(),
    'bBot': () => window.openBotChat(),
    'bGrp': () => window.openGroupCreate(),
    'bStickers': () => window.openMyStickers(),
    'bSaved': () => toast('📌 Избранное — скоро'),
    'bFriends': () => toast('👥 Друзья — скоро'),
    'bVer': () => window.openVerification(),
    'bHelp': () => window.openBotChat(),
    'bApp': () => window.openWebApps()
  };

  Object.keys(bindings).forEach(id => {
    const el = $(id);
    if (el) el.onclick = bindings[id];
  });

  const chatActions = {
    'bStalk': () => window.openStalker(),
    'bChatGallery': () => window.openChatGallery(),
    'bSrch': () => window.openChatSearch(),
    'bMenu': () => window.openChatMenu()
  };
  Object.keys(chatActions).forEach(id => {
    const el = $(id);
    if (el) el.onclick = chatActions[id];
  });

  const bBack = $('bBack');
  if (bBack) bBack.onclick = back;

  const rClose = $('rClose');
  if (rClose) rClose.onclick = cancelRep;

  const msgI = $('msgI');
  const bSend = $('bSend');
  if (msgI) {
    msgI.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && state.settings.enterSend) {
        e.preventDefault();
        sendMessage();
      }
      if (state.currentChat) {
        clearTimeout(state.draftTimer);
        state.draftTimer = setTimeout(() => {
          if (msgI.value.trim()) localStorage.setItem('sg_draft_' + state.currentChat.id, msgI.value);
          else localStorage.removeItem('sg_draft_' + state.currentChat.id);
        }, 500);
      }
    };
  }
  if (bSend) bSend.onclick = sendMessage;

  const bPlus = $('bPlus');
  if (bPlus) bPlus.onclick = () => {
    const p = $('attP');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };

  const bEmo = $('bEmo');
  if (bEmo) bEmo.onclick = () => {
    const ep = $('ep');
    if (ep) ep.classList.toggle('show');
  };

  const bMic = $('bMic');
  if (bMic) bMic.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      bMic.textContent = '🎤';
      bMic.style.background = '';
    } else {
      startVoice();
    }
  };

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
        'apo': () => openPollCreate()
      };
      (map[id] || (()=>{}))();
    };
  });

  document.querySelectorAll('.bn button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.bn button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      switchTab(b.dataset.tab);
    };
  });

  const fcBtn = $('fcBtn');
  if (fcBtn) fcBtn.onclick = () => window.openPost();

  const myA = $('myA');
  if (myA) myA.onclick = () => showProf();
}

function switchTab(tab) {
  const sd = $('SD'), fd = $('fdScr');
  if (sd) sd.style.display = 'none';
  if (fd) fd.style.display = 'none';
  if (fd) fd.classList.remove('active');

  if (tab === 'chats') {
    if (sd) sd.style.display = 'flex';
    if ($('fcBtn')) $('fcBtn').style.display = 'none';
  } else if (tab === 'feed') {
    if (fd) { fd.style.display = 'flex'; fd.classList.add('active'); }
    loadFeed();
    if ($('fcBtn')) $('fcBtn').style.display = 'flex';
  } else if (tab === 'profile') {
    if (sd) sd.style.display = 'flex';
    showProf();
  }
}

function pickFile(accept) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = accept || '*/*';
  inp.onchange = () => {
    const file = inp.files[0];
    if (file && state.currentChat) sendFile(file);
  };
  inp.click();
}

async function startVoice() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const file = new File([blob], 'voice_' + Date.now() + '.webm', { type: 'audio/webm' });
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
          is_read: false,
          deleted: false
        };
        let { error } = await sb.from('messages').insert(payload);
        if (error && error.message.indexOf('sender_name') !== -1) {
          delete payload.sender_name;
          const r = await sb.from('messages').insert(payload);
          error = r.error;
        }
        if (error) { toast('Ошибка'); return; }
        await sb.from('chats').update({ last_message: '🎤 Голосовое' }).eq('id', state.currentChat.id);
        await loadMessages();
      } catch (e) { toast('Ошибка: ' + e.message); }
    };
    mediaRecorder.start();
    const bMic = $('bMic');
    if (bMic) { bMic.textContent = '⏹'; bMic.style.background = '#e53935'; }
    toast('🎤 Запись... нажми ещё раз');
  } catch (e) { toast('Нет доступа к микрофону'); }
}

function openStickerPicker() {
  const s = $('stkP');
  if (!s) return;
  s.classList.toggle('h');
  const g = $('stkG');
  if (g) {
    const list = ['😀','😂','🥰','😎','🤔','😴','🤯','🥳','😭','😡','👍','👎','❤️','🔥','🎉','🚀','⭐','💯','✅','❌','🙏','🤝','👀','💀','🤡'];
    g.innerHTML = list.map(e =>
      '<button style="font-size:32px;padding:6px;border-radius:10px;background:var(--p2);border:none;cursor:pointer" onclick="window.sendSticker(\'' + e + '\')">' + e + '</button>'
    ).join('');
  }
}

window.sendSticker = async (emoji) => {
  if (!state.currentChat) return;
  const payload = {
    chat_id: state.currentChat.id, sender: state.user.id,
    sender_name: state.profile.display_name, text: emoji,
    is_sticker: true, is_read: false, deleted: false
  };
  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) {
    delete payload.sender_name;
    const r = await sb.from('messages').insert(payload);
    error = r.error;
  }
  if (error) { toast('Ошибка'); return; }
  const p = $('stkP');
  if (p) p.classList.add('h');
  await loadMessages();
};

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
        const d = await fetch('https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=' + encodeURIComponent(q) + '&limit=20').then(r => r.json());
        const g = $('gifG');
        if (g) g.innerHTML = (d.data || []).map(x =>
          '<img src="' + x.images.fixed_height_small.url + '" style="width:100%;border-radius:8px;cursor:pointer" onclick="window.sendGif(\'' + x.images.original.url + '\')">'
        ).join('');
      } catch(e) {}
    };
  }
}

window.sendGif = async (url) => {
  if (!state.currentChat) return;
  const payload = {
    chat_id: state.currentChat.id, sender: state.user.id,
    sender_name: state.profile.display_name, file_url: url,
    file_type: 'image/gif', is_read: false, deleted: false
  };
  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) {
    delete payload.sender_name;
    const r = await sb.from('messages').insert(payload);
    error = r.error;
  }
  if (error) { toast('Ошибка'); return; }
  const p = $('gifP');
  if (p) p.classList.add('h');
  await loadMessages();
};

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

function openPollCreate() {
  openModal(
    '<h2>📊 Опрос</h2>' +
    '<input id="pollQ" placeholder="Вопрос">' +
    '<input class="poll-i" placeholder="Вариант 1">' +
    '<input class="poll-i" placeholder="Вариант 2">' +
    '<input class="poll-i" placeholder="Вариант 3 (опц.)">' +
    '<button id="bCrPoll" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">Создать</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>'
  );
  $('bCrPoll').onclick = async () => {
    const q = $('pollQ').value.trim();
    const opts = [...document.querySelectorAll('.poll-i')].map(i => i.value.trim()).filter(Boolean);
    if (!q || opts.length < 2) { toast('Нужен вопрос и 2 варианта'); return; }
    if (!state.currentChat) return;
    const text = '📊 ' + q + '\n' + opts.map((o,i) => (i+1) + '. ' + o).join('\n');
    const payload = {
      chat_id: state.currentChat.id, sender: state.user.id,
      sender_name: state.profile.display_name, text,
      is_read: false, deleted: false
    };
    let { error } = await sb.from('messages').insert(payload);
    if (error && error.message.indexOf('sender_name') !== -1) {
      delete payload.sender_name;
      const r = await sb.from('messages').insert(payload);
      error = r.error;
    }
    if (error) { toast('Ошибка'); return; }
    closeModal();
    await loadMessages();
  };
}

function openSidebar() {
  let sb2 = document.querySelector('.sg-sidebar');
  if (!sb2) {
    sb2 = document.createElement('div');
    sb2.className = 'sg-sidebar';
    sb2.style.cssText = 'position:fixed;top:0;left:0;bottom:0;width:min(300px,80vw);background:var(--p);z-index:9999;padding:20px;overflow-y:auto;box-shadow:4px 0 24px rgba(0,0,0,.5);transform:translateX(-100%);transition:transform .25s';
    sb2.innerHTML = '<div style="font-size:20px;font-weight:800;margin-bottom:20px">✈️ Spacegram</div><div id="sbMenu"></div>';
    document.body.appendChild(sb2);

    const menu = [
      { i:'👤', t:'Мой профиль', a:() => { closeSidebar(); showProf(); } },
      { i:'📸', t:'Статусы', a:() => { closeSidebar(); window.openStories(); } },
      { i:'🛒', t:'Магазин', a:() => { closeSidebar(); window.openShop(); } },
      { i:'💰', t:'Баланс', a:() => { closeSidebar(); window.openBalance(); } },
      { i:'🎁', t:'Промокод', a:() => { closeSidebar(); window.openPromo(); } },
      { i:'🧩', t:'Моды', a:() => { closeSidebar(); window.openMods(); } },
      { i:'🎁', t:'Подарки', a:() => { closeSidebar(); window.openGifts(); } },
      { i:'⚙️', t:'Настройки', a:() => { closeSidebar(); window.openSettings(); } }
    ];
    if (isAdmin()) menu.push({ i:'👑', t:'Админ-панель', a:() => { closeSidebar(); window.openAdmin(); } });
    menu.push({ i:'🚪', t:'Выйти', a:() => { if (confirm('Выйти?')) logout(); } });

    $('sbMenu').innerHTML = menu.map((m,i) =>
      '<button data-i="' + i + '" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:12px;background:transparent;color:var(--t);font-size:14px;font-weight:600;border:none;cursor:pointer;text-align:left;margin-bottom:4px">' +
        '<span style="font-size:18px">' + m.i + '</span> ' + m.t +
      '</button>'
    ).join('');

    $('sbMenu').querySelectorAll('button').forEach(b => {
      b.onclick = () => menu[+b.dataset.i].a();
    });

    const ov = document.createElement('div');
    ov.className = 'sg-sidebar-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:none';
    ov.onclick = closeSidebar;
    document.body.appendChild(ov);
  }
  sb2.style.transform = 'translateX(0)';
  const ov = document.querySelector('.sg-sidebar-ov');
  if (ov) ov.style.display = 'block';
}

function closeSidebar() {
  const sb2 = document.querySelector('.sg-sidebar');
  const ov = document.querySelector('.sg-sidebar-ov');
  if (sb2) sb2.style.transform = 'translateX(-100%)';
  if (ov) ov.style.display = 'none';
}
window.closeSidebar = closeSidebar;

window.openGroupCreate = function() {
  openModal(
    '<h2>➕ Новая группа/канал</h2>' +
    '<div style="display:flex;gap:6px;margin-bottom:14px" id="typeGrp">' +
      '<button data-t="group" style="flex:1;padding:10px;border-radius:10px;background:var(--a);color:#fff;font-weight:600;border:none;cursor:pointer">👥 Группа</button>' +
      '<button data-t="channel" style="flex:1;padding:10px;border-radius:10px;background:var(--p2);color:var(--t);font-weight:600;border:none;cursor:pointer">📢 Канал</button>' +
    '</div>' +
    '<input id="grpName" placeholder="Название">' +
    '<button id="bCreateGrp" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">Создать</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>'
  );
  let type = 'group';
  document.querySelectorAll('#typeGrp button').forEach(b => b.onclick = () => {
    type = b.dataset.t;
    document.querySelectorAll('#typeGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'var(--a)'; b.style.color = '#fff';
  });
  $('bCreateGrp').onclick = async () => {
    const name = $('grpName').value.trim();
    if (!name) { toast('Введи название'); return; }
    const { data, error } = await sb.from('chats').insert({
      is_group: type === 'group', is_channel: type === 'channel',
      group_name: name, created_by: state.user.id,
      user1: state.user.id, user2: state.user.id
    }).select().single();
    if (error) { toast('Ошибка: ' + error.message); return; }
    closeModal();
    await loadChats();
    openChat(data.id);
  };
};

window.openBotChat = async () => {
  openModal(
    '<h2>🤖 @Spacegramhelperbot</h2>' +
    '<div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;line-height:1.6;color:var(--t2);margin-bottom:14px">' +
      'Напиши мне:<br><br>' +
      '🌤 <b>погода Москва</b><br>' +
      '😂 <b>шутка</b><br>' +
      '🐱 <b>котик</b><br>' +
      '💰 <b>биткоин</b><br>' +
      '❓ <b>викторина</b><br>' +
      '🌐 <b>переведи hello на русский</b><br>' +
      '🎨 <b>нарисуй космонавта</b>' +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Понятно</button>'
  );
};

window.openStalker = function() {
  if (!state.currentChat) return;
  const deleted = state.messages.filter(m => m.deleted);
  openModal(
    '<h2>🕵️ StalkerGram</h2>' +
    '<div style="font-size:13px;color:var(--t2);margin-bottom:10px">Удалённые (' + deleted.length + '):</div>' +
    (deleted.length ? deleted.map(m =>
      '<div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px;font-size:13px;opacity:.7"><b>' + esc(m.sender_name || '?') + ':</b> ' + esc(m.text || '[медиа]') + '</div>'
    ).join('') : '<div style="text-align:center;padding:20px;color:var(--t2)">Пусто</div>') +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.openChatGallery = function() {
  if (!state.currentChat) return;
  const media = state.messages.filter(m => m.file_url && (m.file_type || '').indexOf('image') === 0);
  openModal(
    '<h2>🖼️ Галерея чата</h2>' +
    (media.length ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + media.map(m =>
      '<img src="' + esc(m.file_url) + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.openImage(\'' + esc(m.file_url) + '\')">'
    ).join('') + '</div>' : '<div style="text-align:center;padding:20px;color:var(--t2)">Нет фото</div>') +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.openChatSearch = function() {
  openModal(
    '<h2>🔍 Поиск в чате</h2>' +
    '<input id="chatSearchQ" placeholder="Что искать?">' +
    '<div id="chatSearchRes" style="max-height:300px;overflow-y:auto"></div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
  $('chatSearchQ').oninput = () => {
    const q = $('chatSearchQ').value.trim().toLowerCase();
    if (q.length < 2) { $('chatSearchRes').innerHTML = ''; return; }
    const found = state.messages.filter(m => (m.text || '').toLowerCase().indexOf(q) !== -1);
    $('chatSearchRes').innerHTML = found.length
      ? found.slice(0, 30).map(m =>
          '<div style="padding:8px;background:var(--p2);border-radius:8px;margin-bottom:6px;font-size:13px"><b>' + esc(m.sender_name || '?') + ':</b> ' + esc((m.text || '').slice(0, 100)) + '</div>'
        ).join('')
      : '<div style="text-align:center;padding:20px;color:var(--t2)">Ничего не найдено</div>';
  };
};

window.openChatMenu = function() {
  if (!state.currentChat) return;
  const name = (state.currentChat.is_group || state.currentChat.is_channel)
    ? state.currentChat.group_name : state.currentChat.other?.display_name;
  openModal(
    '<h2>' + esc(name || 'Чат') + '</h2>' +
    '<button onclick="window.clearChatHistory()" style="width:100%;padding:11px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:600;font-size:14px;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-bottom:8px">🗑 Очистить историю</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>'
  );
};

window.clearChatHistory = async () => {
  if (!state.currentChat) return;
  if (!confirm('Очистить?')) return;
  await sb.from('messages').update({ deleted: true }).eq('chat_id', state.currentChat.id);
  await loadMessages();
  closeModal();
  toast('Очищено');
};

window.openMyStickers = function() {
  openModal(
    '<h2>🎨 Мои стикеры</h2>' +
    '<input type="file" id="stkFile" accept="image/*" style="width:100%;margin-bottom:14px">' +
    '<button onclick="window.uploadSticker()" style="width:100%;padding:11px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">➕ Загрузить</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Закрыть</button>'
  );
};

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

window.openVerification = function() {
  openModal(
    '<h2>✅ Верификация</h2>' +
    '<div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:14px">Отправь заявку на галочку.</div>' +
    '<textarea id="verMsg" rows="4" placeholder="Ссылки, портфолио..."></textarea>' +
    '<button id="bSendVer" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#7c3aed);color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Отмена</button>'
  );
  $('bSendVer').onclick = async () => {
    const msg = $('verMsg').value.trim();
    if (!msg) { toast('Напиши что-нибудь'); return; }
    try { await sb.from('verification_requests').insert({ user_id: state.user.id, message: msg, status: 'pending' }); } catch(e) {}
    toast('Заявка отправлена ✅');
    closeModal();
  };
};

window.openWebApps = function() {
  openModal(
    '<h2>📱 Web Apps</h2>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<button onclick="toast(\'Скоро\')" class="gh" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">📊 Опросы</button>' +
      '<button onclick="toast(\'Скоро\')" class="gh" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🎮 Игры</button>' +
      '<button onclick="toast(\'Скоро\')" class="gh" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">💰 Финансы</button>' +
      '<button onclick="toast(\'Скоро\')" class="gh" style="padding:16px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🤖 AI</button>' +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

/* ============ АДМИНКА (window.XXX!) ============ */
window.openAdmin = function() {
  if (!isAdmin()) { toast('Нет доступа'); return; }
  openModal(
    '<h2>👑 Админ-панель</h2>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<button onclick="window.adminLoadUsers()" class="gh" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">👥 Юзеры</button>' +
      '<button onclick="window.adminLoadTickets()" class="gh" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🎫 Тикеты</button>' +
      '<button onclick="window.adminLoadReports()" class="gh" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">🚩 Жалобы</button>' +
      '<button onclick="window.adminLoadStats()" class="gh" style="padding:14px;border-radius:12px;background:var(--p2);border:1px solid var(--br);color:var(--t);font-weight:600;cursor:pointer">📊 Стата</button>' +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.adminLoadUsers = async () => {
  const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
  const users = data || [];
  openModal(
    '<h2>👥 Юзеры (' + users.length + ')</h2>' +
    '<div style="max-height:55vh;overflow-y:auto">' +
      users.map(u =>
        '<div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<div style="font-weight:700;font-size:13px">' + esc(u.display_name) + ' ' + (u.is_creator?'👑':'') + ' ' + (u.is_verified?'✅':'') + ' ' + (u.is_banned?'🚫':'') + '</div>' +
              '<div style="font-size:11px;color:var(--t2)">@' + esc(u.username) + ' · ' + (u.balance||0) + ' SG · lvl ' + (u.level||1) + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:4px">' +
              '<button onclick="window.adminToggleBan(\'' + u.id + '\',' + u.is_banned + ')" style="padding:5px 9px;border-radius:8px;background:' + (u.is_banned ? '#4caf50' : '#e53935') + ';color:#fff;font-size:11px;font-weight:600;border:none;cursor:pointer">' + (u.is_banned ? 'Разбан' : 'Бан') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      ).join('') +
    '</div>' +
    '<button onclick="window.openAdmin()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>'
  );
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

window.adminLoadTickets = async () => {
  let tickets = [];
  try {
    const r = await sb.from('tickets').select('*').order('id', { ascending: false }).limit(50);
    tickets = r.data || [];
  } catch(e) {}
  openModal(
    '<h2>🎫 Тикеты (' + tickets.length + ')</h2>' +
    '<div style="max-height:55vh;overflow-y:auto">' +
      (tickets.length ? tickets.map(t =>
        '<div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px">' +
          '<div style="font-weight:700;font-size:13px">' + esc(t.subject || 'Без темы') + '</div>' +
          '<div style="font-size:11px;color:var(--t2)">' + esc(t.email || '') + '</div>' +
          '<div style="font-size:12px;margin-top:6px;opacity:.8">' + esc((t.message || '').slice(0, 200)) + '</div>' +
        '</div>'
      ).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Тикетов нет</div>') +
    '</div>' +
    '<button onclick="window.openAdmin()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>'
  );
};

window.adminLoadReports = async () => {
  let reports = [];
  try {
    const r = await sb.from('reports').select('*').eq('status', 'pending').limit(50);
    reports = r.data || [];
  } catch(e) {}
  openModal(
    '<h2>🚩 Жалобы (' + reports.length + ')</h2>' +
    '<div style="max-height:55vh;overflow-y:auto">' +
      (reports.length ? reports.map(r =>
        '<div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px">' +
          '<div style="font-weight:700;font-size:13px">' + esc(r.reason || '?') + '</div>' +
          '<div style="font-size:11px;color:var(--t2)">msg: ' + r.message_id + '</div>' +
        '</div>'
      ).join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Жалоб нет</div>') +
    '</div>' +
    '<button onclick="window.openAdmin()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>'
  );
};

window.adminLoadStats = async () => {
  let u = 0, c = 0, m = 0;
  try { const r = await sb.from('profiles').select('id', { count: 'exact', head: true }); u = r.count || 0; } catch(e) {}
  try { const r = await sb.from('chats').select('id', { count: 'exact', head: true }); c = r.count || 0; } catch(e) {}
  try { const r = await sb.from('messages').select('id', { count: 'exact', head: true }); m = r.count || 0; } catch(e) {}
  openModal(
    '<h2>📊 Статистика</h2>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + u + '</div><div style="font-size:11px;color:var(--t2)">👥 Юзеров</div></div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + c + '</div><div style="font-size:11px;color:var(--t2)">💬 Чатов</div></div>' +
      '<div style="background:var(--p2);border-radius:12px;padding:14px;text-align:center;grid-column:1/-1"><div style="font-size:24px;font-weight:800">' + m + '</div><div style="font-size:11px;color:var(--t2)">📝 Сообщений</div></div>' +
    '</div>' +
    '<button onclick="window.openAdmin()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:14px">← Назад</button>'
  );
};

/* ============ MAIN ============ */
(async function main() {
  console.log('🚀 Spacegram v13 init...');

  try {
    const createClient = await loadSupabase();
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase client создан');
  } catch (e) {
    console.error('❌ Не удалось загрузить Supabase:', e);
    document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:monospace;background:#0e1621;min-height:100vh">' +
      '<h1>❌ Ошибка загрузки</h1><p>Не удалось подключиться к Supabase.</p>' +
      '<pre>' + esc(e.message) + '</pre>' +
      '<button onclick="location.reload()" style="padding:12px 20px;margin-top:20px;border-radius:10px;background:#4a9eff;color:#fff;border:none;cursor:pointer">🔄 Перезагрузить</button>' +
    '</div>';
    return;
  }

  applyTheme(state.settings.theme);
  applyMode(state.settings.mode);
  applyFontSize(state.settings.fontSize);
  applyCorners(state.settings.corners);

  initAuth();

  const savedId = localStorage.getItem('sg_user_id');
  const loadingEl = $('L');
  const authEl = $('A');

  if (savedId) {
    const { data } = await sb.from('profiles').select('*').eq('id', savedId).maybeSingle();
    if (data && !data.is_banned) {
      state.user = { id: data.id };
      state.profile = data;
      if (loadingEl) loadingEl.style.display = 'none';
      await enterApp();
      console.log('✅ Автологин OK');
    } else {
      if (data && data.is_banned) showBanBanner(data.ban_reason);
      localStorage.removeItem('sg_user_id');
      if (loadingEl) loadingEl.style.display = 'none';
      if (authEl) authEl.style.display = 'flex';
    }
  } else {
    if (loadingEl) loadingEl.style.display = 'none';
    if (authEl) authEl.style.display = 'flex';
  }

  setTimeout(() => {
    if (state.profile) renderProfileMini();
  }, 300);

  console.log('✅ Spacegram готов');
})();
