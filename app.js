// ============ SPACEGRAM APP.JS ============
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://qtuvtxbxtypvttfjiydv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ СОСТОЯНИЕ ============
const state = {
  user: null,
  profile: null,
  chats: [],
  currentChat: null,
  messages: [],
  replyTo: null,
  pollTimer: null,
  settings: {
    theme: localStorage.getItem('theme') || 'midnight',
    lang: localStorage.getItem('lang') || 'ru',
    sound: localStorage.getItem('sound') !== '0',
    vibrate: localStorage.getItem('vibrate') !== '0',
    preview: localStorage.getItem('preview') !== '0',
    push: localStorage.getItem('push') === '1'
  }
};

// ============ УТИЛИТЫ ============
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime = (d) => { const x = new Date(d); return x.getHours().toString().padStart(2,'0')+':'+x.getMinutes().toString().padStart(2,'0'); };
const fmtDate = (d) => { const x = new Date(d); const now = new Date(); if (x.toDateString()===now.toDateString()) return fmtTime(d); return x.getDate().toString().padStart(2,'0')+'.'+(x.getMonth()+1).toString().padStart(2,'0'); };

function toast(msg, ms=2000) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function vibrate(ms=30) { if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); }

// ============ ТЕМА ============
function applyTheme(theme) {
  document.body.className = theme === 'midnight' ? '' : 'theme-' + theme;
  localStorage.setItem('theme', theme);
  state.settings.theme = theme;
}

// ============ АВТОРИЗАЦИЯ ============
$('tabLogin').onclick = () => { $('tabLogin').classList.add('active'); $('tabRegister').classList.remove('active'); $('loginForm').classList.remove('hidden'); $('registerForm').classList.add('hidden'); };
$('tabRegister').onclick = () => { $('tabRegister').classList.add('active'); $('tabLogin').classList.remove('active'); $('registerForm').classList.remove('hidden'); $('loginForm').classList.add('hidden'); };

$('loginBtn').onclick = async () => {
  const username = $('loginUsername').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  const err = $('loginError');
  err.textContent = '';
  if (!username || !password) { err.textContent = 'Заполни все поля'; return; }
  $('loginBtn').textContent = 'Вход...';
  const { data, error } = await sb.from('profiles').select('*').eq('username', username).eq('pin_code', password).maybeSingle();
  $('loginBtn').textContent = 'Войти';
  if (error || !data) { err.textContent = 'Неверный логин или пароль'; return; }
  if (data.is_banned) { err.textContent = 'Аккаунт заблокирован: ' + (data.ban_reason || ''); return; }
  localStorage.setItem('sg_user_id', data.id);
  state.profile = data;
  state.user = { id: data.id };
  await enterApp();
};

$('registerBtn').onclick = async () => {
  const username = $('regUsername').value.trim().toLowerCase();
  const display_name = $('regDisplayName').value.trim();
  const phone = $('regPhone').value.trim();
  const password = $('regPassword').value;
  const err = $('registerError');
  err.textContent = '';
  if (!username || !display_name || !password) { err.textContent = 'Заполни обязательные поля'; return; }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) { err.textContent = 'Юзернейм: 3-20 символов (a-z, 0-9, _)'; return; }
  if (password.length < 4) { err.textContent = 'Пароль минимум 4 символа'; return; }
  $('registerBtn').textContent = 'Создание...';
  const { data: existing } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) { $('registerBtn').textContent = 'Создать аккаунт'; err.textContent = 'Юзернейм занят'; return; }
  const { data, error } = await sb.from('profiles').insert({
    username, display_name, phone: phone || null, pin_code: password,
    bio: 'Привет, я в Spacegram! 🚀', balance: 100
  }).select().single();
  $('registerBtn').textContent = 'Создать аккаунт';
  if (error) { err.textContent = 'Ошибка: ' + error.message; return; }
  localStorage.setItem('sg_user_id', data.id);
  state.profile = data;
  state.user = { id: data.id };
  await enterApp();
};

// ============ ВХОД В ПРИЛОЖЕНИЕ ============
async function enterApp() {
  $('authScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  applyTheme(state.settings.theme);
  await refreshProfile();
  await loadChats();
  startPolling();
  checkGhostMode();
}

async function refreshProfile() {
  if (!state.user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  if (data) {
    state.profile = data;
    if (data.is_banned) { alert('Ты забанен: ' + (data.ban_reason||'')); logout(); return; }
  }
}

function logout() {
  localStorage.removeItem('sg_user_id');
  location.reload();
}

// ============ ЧАТЫ ============
async function loadChats() {
  const uid = state.user.id;
  const { data: chats } = await sb.from('chats').select('*').or(`user1.eq.${uid},user2.eq.${uid},created_by.eq.${uid}`).order('id', { ascending: false });
  if (!chats) return;
  const list = [];
  for (const c of chats) {
    if (c.is_group || c.is_channel) { list.push(c); continue; }
    const otherId = c.user1 === uid ? c.user2 : c.user1;
    const { data: prof } = await sb.from('profiles').select('*').eq('id', otherId).maybeSingle();
    list.push({ ...c, other: prof });
  }
  state.chats = list;
  renderChats();
}

function renderChats() {
  const el = $('chatList');
  if (!state.chats.length) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2)">Нет чатов. Создай новый! 🚀</div>'; return; }
  el.innerHTML = state.chats.map(c => {
    const name = c.is_group || c.is_channel ? (c.group_name || 'Без названия') : (c.other?.display_name || 'Юзер');
    const initial = name[0]?.toUpperCase() || '?';
    const avatar = c.group_avatar || c.other?.avatar_url;
    return `<div class="chat-item" data-id="${c.id}">
      <div class="chat-item-avatar">${avatar ? `<img src="${esc(avatar)}">` : initial}</div>
      <div class="chat-item-body">
        <div class="chat-item-name">${esc(name)} ${c.is_channel?'📢':c.is_group?'👥':''}</div>
        <div class="chat-item-last">${esc(c.last_message || 'Нет сообщений')}</div>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('.chat-item').forEach(item => item.onclick = () => openChat(item.dataset.id));
}

// ============ ОТКРЫТИЕ ЧАТА ============
async function openChat(chatId) {
  const chat = state.chats.find(c => String(c.id) === String(chatId));
  if (!chat) return;
  state.currentChat = chat;
  $('chatScreen').classList.remove('hidden');
  const name = chat.is_group || chat.is_channel ? (chat.group_name||'Группа') : (chat.other?.display_name || 'Юзер');
  $('chatTitle').textContent = name;
  $('chatSubtitle').textContent = chat.is_channel ? 'канал' : chat.is_group ? 'группа' : (chat.other?.is_plus ? '⭐ Plus' : 'был(а) недавно');
  const initial = name[0]?.toUpperCase() || '?';
  const avatar = chat.group_avatar || chat.other?.avatar_url;
  $('chatAvatar').innerHTML = avatar ? `<img src="${esc(avatar)}">` : initial;
  await loadMessages();
}

async function loadMessages() {
  if (!state.currentChat) return;
  const { data } = await sb.from('messages').select('*').eq('chat_id', state.currentChat.id).order('id', { ascending: true }).limit(200);
  state.messages = data || [];
  renderMessages();
  // помечаем прочитанным
  const unread = state.messages.filter(m => m.sender !== state.user.id && !m.is_read);
  if (unread.length) {
    await sb.from('messages').update({ is_read: true }).in('id', unread.map(m => m.id));
  }
}

function renderMessages() {
  const el = $('messagesList');
  el.innerHTML = state.messages.map(m => {
    const own = m.sender === state.user.id;
    const time = fmtDate(m.created_at || Date.now());
    let content = '';
    if (m.deleted) content = '<i>сообщение удалено</i>';
    else {
      if (m.reply_to) {
        const orig = state.messages.find(x => x.id === m.reply_to);
        if (orig) content += `<div class="msg-reply-preview"><b>${esc(orig.sender===state.user.id?'Ты':'Собеседник')}</b><br>${esc((orig.text||'').slice(0,80))}</div>`;
      }
      if (m.file_url) {
        if ((m.file_type||'').startsWith('image')) content += `<img src="${esc(m.file_url)}" class="msg-media">`;
        else if ((m.file_type||'').startsWith('video')) content += `<video src="${esc(m.file_url)}" class="msg-media" controls></video>`;
        else if ((m.file_type||'').startsWith('audio')) content += `<audio src="${esc(m.file_url)}" controls></audio>`;
        else content += `<a href="${esc(m.file_url)}" target="_blank">📎 ${esc(m.file_name||'Файл')}</a>`;
      }
      if (m.text) content += `<div>${esc(m.text)}</div>`;
    }
    return `<div class="msg ${own?'own':''} ${m.deleted?'deleted':''}" data-id="${m.id}">
      ${!own && (state.currentChat.is_group||state.currentChat.is_channel) ? `<div class="msg-sender">${esc(m.sender_name||'Юзер')}</div>` : ''}
      ${content}
      <span class="msg-time">${time}</span>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

// ============ ОТПРАВКА ============
$('sendBtn').onclick = sendMessage;
$('messageInput').onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

async function sendMessage() {
  const text = $('messageInput').value.trim();
  if (!text || !state.currentChat) return;
  $('messageInput').value = '';
  const payload = {
    chat_id: state.currentChat.id,
    sender: state.user.id,
    sender_name: state.profile.display_name,
    text,
    is_read: false,
    deleted: false
  };
  if (state.replyTo) { payload.reply_to = state.replyTo.id; state.replyTo = null; $('replyBar').classList.add('hidden'); }
  const { error } = await sb.from('messages').insert(payload);
  if (error) { toast('Ошибка: ' + error.message); return; }
  await sb.from('chats').update({ last_message: text.slice(0,80) }).eq('id', state.currentChat.id);
  await loadMessages();
}

// ============ ПОЛЛИНГ ============
function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (state.currentChat) await loadMessages();
    else await loadChats();
  }, 1500);
}

// ============ МЕНЮ ============
$('menuBtn').onclick = (e) => { e.stopPropagation(); $('headerMenu').classList.toggle('hidden'); };
document.addEventListener('click', (e) => {
  if (!e.target.closest('#menuBtn') && !e.target.closest('#headerMenu')) $('headerMenu').classList.add('hidden');
});
$('headerMenu').querySelectorAll('button').forEach(b => b.onclick = () => {
  const a = b.dataset.action;
  $('headerMenu').classList.add('hidden');
  if (a === 'logout') logout();
  else if (a === 'settings') openSettings();
  else if (a === 'balance') openBalance();
  else if (a === 'shop') openShop();
  else if (a === 'saved') openSaved();
  else if (a === 'friends') openFriends();
  else toast('Скоро 🚀');
});

// ============ НАВИГАЦИЯ ============
document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => {
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  $('tab' + b.dataset.tab.charAt(0).toUpperCase() + b.dataset.tab.slice(1)).classList.remove('hidden');
  if (b.dataset.tab === 'profile') renderProfile();
});

// ============ ПРОФИЛЬ ============
function renderProfile() {
  const p = state.profile;
  if (!p) return;
  const initial = (p.display_name||'?')[0].toUpperCase();
  $('profileContent').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}">` : initial}</div>
      <div class="profile-name">${esc(p.display_name)} ${p.is_verified?'✅':''} ${p.is_plus?'⭐':''}</div>
      <div class="profile-username">@${esc(p.username)}</div>
      ${p.bio ? `<div class="profile-bio">${esc(p.bio)}</div>` : ''}
    </div>
    <div class="profile-stats">
      <div class="stat-card"><div class="stat-value">${p.balance||0}</div><div class="stat-label">SG</div></div>
      <div class="stat-card"><div class="stat-value">${p.gifts_received?.length||0}</div><div class="stat-label">Подарки</div></div>
      <div class="stat-card"><div class="stat-value">${p.warns||0}/3</div><div class="stat-label">Варны</div></div>
    </div>
    <button class="toolbar-btn" style="width:100%;margin-top:10px" onclick="window.editProfile()">✏️ Редактировать профиль</button>
  `;
}

window.editProfile = async () => {
  const p = state.profile;
  const name = prompt('Имя:', p.display_name);
  if (name === null) return;
  const bio = prompt('О себе:', p.bio || '');
  const avatar = prompt('URL аватара:', p.avatar_url || '');
  const { error } = await sb.from('profiles').update({ display_name: name, bio, avatar_url: avatar }).eq('id', state.user.id);
  if (error) { toast('Ошибка'); return; }
  await refreshProfile();
  renderProfile();
  toast('Профиль обновлён ✅');
};

// ============ НАСТРОЙКИ ============
function openSettings() {
  const s = state.settings;
  openModal(`
    <h3>⚙️ Настройки</h3>
    <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text2)">Тема</label>
    <select id="setTheme">
      ${['midnight','purple','ocean','sunset','rose','forest','cyber','mono','light'].map(t => `<option ${s.theme===t?'selected':''}>${t}</option>`).join('')}
    </select>
    <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="setSound" ${s.sound?'checked':''}> 🔔 Звук</label>
    <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="setVib" ${s.vibrate?'checked':''}> 📳 Вибрация</label>
    <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="setPrev" ${s.preview?'checked':''}> 👁 Превью</label>
    <div class="modal-actions">
      <button onclick="closeModal()">Отмена</button>
      <button class="primary" onclick="window.saveSettings()">Сохранить</button>
    </div>
  `);
}

window.saveSettings = () => {
  const t = $('setTheme').value;
  applyTheme(t);
  state.settings.sound = $('setSound').checked; localStorage.setItem('sound', state.settings.sound?'1':'0');
  state.settings.vibrate = $('setVib').checked; localStorage.setItem('vibrate', state.settings.vibrate?'1':'0');
  state.settings.preview = $('setPrev').checked; localStorage.setItem('preview', state.settings.preview?'1':'0');
  closeModal();
  toast('Сохранено ✅');
};

// ============ БАЛАНС ============
async function openBalance() {
  const { data } = await sb.from('balance_log').select('*').eq('user_id', state.user.id).order('id', { ascending: false }).limit(30);
  openModal(`
    <h3>💰 Баланс: ${state.profile.balance||0} SG</h3>
    <button class="toolbar-btn" style="width:100%;margin-bottom:10px" onclick="window.promoPrompt()">🎁 Ввести промокод</button>
    <div style="max-height:300px;overflow-y:auto">
      ${(data||[]).map(l => `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
        <span style="font-size:13px">${esc(l.reason||'Начисление')}</span>
        <b style="color:${l.amount>0?'var(--success)':'var(--danger)'}">${l.amount>0?'+':''}${l.amount}</b>
      </div>`).join('') || '<div style="color:var(--text2);text-align:center;padding:20px">Пока нет транзакций</div>'}
    </div>
    <div class="modal-actions"><button onclick="closeModal()">Закрыть</button></div>
  `);
}

window.promoPrompt = async () => {
  const code = prompt('Промокод:');
  if (!code) return;
  const { data: promo } = await sb.from('promocodes').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (!promo) { toast('Промокод не найден ❌'); return; }
  if (promo.uses >= promo.max_uses) { toast('Промокод исчерпан'); return; }
  const updates = {};
  if (promo.bonus_coins) updates.balance = (state.profile.balance||0) + promo.bonus_coins;
  if (promo.days && promo.tariff_code) {
    const until = new Date(); until.setDate(until.getDate() + promo.days);
    updates.is_plus = true; updates.plus_until = until.toISOString();
  }
  const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
  if (error) { toast('Ошибка: ' + error.message); return; }
  await sb.from('promocodes').update({ uses: (promo.uses||0)+1 }).eq('id', promo.id);
  if (promo.bonus_coins) await sb.from('balance_log').insert({ user_id: state.user.id, amount: promo.bonus_coins, reason: 'Промокод ' + promo.code });
  await refreshProfile();
  toast('Промокод активирован! 🎉');
  closeModal();
};

// ============ МАГАЗИН ============
async function openShop() {
  const { data } = await sb.from('shop_items').select('*');
  openModal(`
    <h3>🛒 Магазин</h3>
    <div style="max-height:400px;overflow-y:auto">
      ${(data||[]).map(i => `<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div><b>${esc(i.name)}</b><br><span style="font-size:12px;color:var(--text2)">${esc(i.category)}</span></div>
        <button class="toolbar-btn" onclick="window.buyItem('${i.id}')">${i.price} SG</button>
      </div>`).join('') || '<div style="color:var(--text2);text-align:center;padding:20px">Магазин пуст</div>'}
    </div>
    <div class="modal-actions"><button onclick="closeModal()">Закрыть</button></div>
  `);
}

window.buyItem = async (itemId) => {
  const { data: item } = await sb.from('shop_items').select('*').eq('id', itemId).single();
  if (!item) return;
  if ((state.profile.balance||0) < item.price) { toast('Недостаточно SG'); return; }
  await sb.from('profiles').update({ balance: state.profile.balance - item.price }).eq('id', state.user.id);
  await sb.from('user_purchases').insert({ user_id: state.user.id, item_id: itemId });
  await sb.from('balance_log').insert({ user_id: state.user.id, amount: -item.price, reason: 'Покупка: ' + item.name });
  await refreshProfile();
  toast('Куплено! ✅');
  closeModal();
};

// ============ СОХРАНЁННЫЕ ============
async function openSaved() {
  toast('Избранное скоро 🚀');
}
async function openFriends() {
  toast('Друзья скоро 🚀');
}

// ============ МОДАЛКА ============
function openModal(html) {
  $('modalBox').innerHTML = html;
  $('modalOverlay').classList.remove('hidden');
}
window.closeModal = () => $('modalOverlay').classList.add('hidden');
$('modalOverlay').onclick = (e) => { if (e.target === $('modalOverlay')) closeModal(); };

// ============ ЧАТ: НАЗАД И МЕНЮ ============
$('chatBack').onclick = () => { $('chatScreen').classList.add('hidden'); state.currentChat = null; };
$('chatMenuBtn').onclick = () => {
  if (!state.currentChat) return;
  const name = state.currentChat.is_group || state.currentChat.is_channel ? state.currentChat.group_name : state.currentChat.other?.display_name;
  openModal(`
    <h3>${esc(name||'Чат')}</h3>
    <button class="toolbar-btn" style="width:100%;margin-bottom:8px" onclick="window.clearChatHistory()">🗑 Очистить историю</button>
    <button class="toolbar-btn" style="width:100%;margin-bottom:8px" onclick="window.blockUser()">🚫 Заблокировать</button>
    <div class="modal-actions"><button onclick="closeModal()">Закрыть</button></div>
  `);
};
window.clearChatHistory = async () => {
  await sb.from('messages').update({ deleted: true }).eq('chat_id', state.currentChat.id);
  await loadMessages(); closeModal(); toast('История очищена');
};
window.blockUser = async () => {
  const other = state.currentChat.other;
  if (!other) return;
  const blocked = state.profile.blocked_users || [];
  if (!blocked.includes(other.id)) blocked.push(other.id);
  await sb.from('profiles').update({ blocked_users: blocked }).eq('id', state.user.id);
  await refreshProfile(); closeModal(); toast('Заблокирован');
};

// ============ НОВЫЙ ЧАТ ============
$('newChatBtn').onclick = () => {
  openModal(`
    <h3>💬 Новый чат</h3>
    <input id="newChatUser" placeholder="Юзернейм пользователя">
    <div class="modal-actions">
      <button onclick="closeModal()">Отмена</button>
      <button class="primary" onclick="window.createChat()">Создать</button>
    </div>
  `);
};
window.createChat = async () => {
  const username = $('newChatUser').value.trim().toLowerCase();
  if (!username) return;
  const { data: other } = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
  if (!other) { toast('Пользователь не найден'); return; }
  if (other.id === state.user.id) { toast('Это ты 🙂'); return; }
  const { data: existing } = await sb.from('chats').select('*').or(`and(user1.eq.${state.user.id},user2.eq.${other.id}),and(user1.eq.${other.id},user2.eq.${state.user.id})`).maybeSingle();
  let chat = existing;
  if (!chat) {
    const { data, error } = await sb.from('chats').insert({ user1: state.user.id, user2: other.id, created_by: state.user.id }).select().single();
    if (error) { toast('Ошибка: ' + error.message); return; }
    chat = data;
  }
  closeModal();
  await loadChats();
  openChat(chat.id);
};

// ============ НОВАЯ ГРУППА / КАНАЛ ============
$('newGroupBtn').onclick = () => createGroup(false);
$('newChannelBtn').onclick = () => createGroup(true);
function createGroup(isChannel) {
  openModal(`
    <h3>${isChannel?'📢 Новый канал':'👥 Новая группа'}</h3>
    <input id="grpName" placeholder="Название">
    <input id="grpAvatar" placeholder="URL аватара (опционально)">
    <div class="modal-actions">
      <button onclick="closeModal()">Отмена</button>
      <button class="primary" onclick="window.doCreateGroup(${isChannel})">Создать</button>
    </div>
  `);
}
window.doCreateGroup = async (isChannel) => {
  const name = $('grpName').value.trim();
  const avatar = $('grpAvatar').value.trim();
  if (!name) { toast('Введи название'); return; }
  const { data, error } = await sb.from('chats').insert({
    is_group: !isChannel, is_channel: isChannel,
    group_name: name, group_avatar: avatar || null,
    created_by: state.user.id, user1: state.user.id, user2: state.user.id
  }).select().single();
  if (error) { toast('Ошибка: ' + error.message); return; }
  closeModal();
  await loadChats();
  openChat(data.id);
};

// ============ ВЛОЖЕНИЯ ============
$('attachBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = async () => {
  const file = $('fileInput').files[0];
  if (!file || !state.currentChat) return;
  toast('Загрузка...');
  const path = `uploads/${Date.now()}_${file.name}`;
  const { error: upErr } = await sb.storage.from('files').upload(path, file);
  if (upErr) { toast('Ошибка загрузки: ' + upErr.message); return; }
  const { data: urlData } = sb.storage.from('files').getPublicUrl(path);
  await sb.from('messages').insert({
    chat_id: state.currentChat.id,
    sender: state.user.id,
    sender_name: state.profile.display_name,
    file_url: urlData.publicUrl,
    file_type: file.type,
    file_name: file.name,
    is_read: false, deleted: false
  });
  $('fileInput').value = '';
  await loadMessages();
};

// ============ ЭМОДЗИ ============
$('emojiBtn').onclick = () => {
  const list = ['😀','😂','🥰','😎','🤔','😴','🤯','🥳','😭','😡','👍','👎','❤️','🔥','🎉','🚀','⭐','💯','✅','❌','🙏','🤝','👀','💀','🤡'];
  openModal(`<h3>😊 Эмодзи</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${list.map(e => `<button style="font-size:24px;padding:6px" onclick="document.getElementById('messageInput').value+='${e}';closeModal()">${e}</button>`).join('')}</div><div class="modal-actions"><button onclick="closeModal()">Закрыть</button></div>`);
};

// ============ РЕАКЦИИ (двойной тап) ============
$('messagesList').addEventListener('dblclick', async (e) => {
  const msgEl = e.target.closest('.msg');
  if (!msgEl || !state.currentChat) return;
  const msgId = msgEl.dataset.id;
  const { data: msg } = await sb.from('messages').select('*').eq('id', msgId).single();
  if (!msg) return;
  const reactions = msg.reactions || {};
  const uid = state.user.id;
  reactions['❤️'] = reactions['❤️'] || [];
  if (reactions['❤️'].includes(uid)) reactions['❤️'] = reactions['❤️'].filter(x => x !== uid);
  else reactions['❤️'].push(uid);
  await sb.from('messages').update({ reactions }).eq('id', msgId);
  vibrate(20);
  await loadMessages();
});

// ============ SWIPE ВПРАВО = ОТВЕТ ============
let swipeStart = null;
$('messagesList').addEventListener('touchstart', (e) => {
  const msgEl = e.target.closest('.msg');
  if (!msgEl) return;
  swipeStart = { x: e.touches[0].clientX, id: msgEl.dataset.id };
});
$('messagesList').addEventListener('touchmove', (e) => {
  if (!swipeStart) return;
  const dx = e.touches[0].clientX - swipeStart.x;
  const msgEl = e.target.closest('.msg');
  if (msgEl && dx > 0 && dx < 100) msgEl.style.transform = `translateX(${dx}px)`;
});
$('messagesList').addEventListener('touchend', (e) => {
  if (!swipeStart) return;
  const dx = e.changedTouches[0].clientX - swipeStart.x;
  const msgEl = document.querySelector(`.msg[data-id="${swipeStart.id}"]`);
  if (msgEl) msgEl.style.transform = '';
  if (dx > 60) {
    const msg = state.messages.find(m => m.id == swipeStart.id);
    if (msg) {
      state.replyTo = msg;
      $('replyBar').classList.remove('hidden');
      $('replyBarText').innerHTML = `<b>Ответ ${esc(msg.sender===state.user.id?'себе':(msg.sender_name||'юзеру'))}:</b> ${esc((msg.text||'').slice(0,60))}`;
    }
  }
  swipeStart = null;
});
$('replyBarClose').onclick = () => { state.replyTo = null; $('replyBar').classList.add('hidden'); };

// ============ SEARCH ============
$('searchBtn').onclick = () => {
  openModal(`
    <h3>🔍 Поиск</h3>
    <input id="searchQ" placeholder="Текст сообщения или @username">
    <div id="searchResults" style="max-height:300px;overflow-y:auto;margin-top:10px"></div>
    <div class="modal-actions"><button onclick="closeModal()">Закрыть</button></div>
  `);
  $('searchQ').oninput = async () => {
    const q = $('searchQ').value.trim();
    if (q.length < 2) { $('searchResults').innerHTML = ''; return; }
    const { data: msgs } = await sb.from('messages').select('*').ilike('text', `%${q}%`).limit(20);
    const { data: users } = await sb.from('profiles').select('*').ilike('username', `%${q}%`).limit(10);
    $('searchResults').innerHTML = `
      ${users?.length ? '<b style="font-size:12px;color:var(--text2)">Пользователи:</b>' + users.map(u => `<div style="padding:6px 0">@${esc(u.username)} — ${esc(u.display_name)}</div>`).join('') : ''}
      ${msgs?.length ? '<b style="font-size:12px;color:var(--text2);display:block;margin-top:8px">Сообщения:</b>' + msgs.map(m => `<div style="padding:6px 0;font-size:13px">${esc((m.text||'').slice(0,80))}</div>`).join('') : ''}
    `;
  };
};

// ============ GHOST MODE ============
function checkGhostMode() {
  if (state.profile?.ghost_mode) toast('👻 Ghost-режим активен', 3000);
}

// ============ АВТОЗАПУСК ============
(async function init() {
  applyTheme(state.settings.theme);
  const savedId = localStorage.getItem('sg_user_id');
  if (savedId) {
    state.user = { id: savedId };
    await enterApp();
  }
})();

// ============ ГЛОБАЛЬНЫЕ ХЕЛПЕРЫ ============
window.logout = logout;
window.state = state;
window.sb = sb;
window.toast = toast;
