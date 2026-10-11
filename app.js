import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://qtuvtxbxtypvttfjiydv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null, profile: null, chats: [], currentChat: null,
  messages: [], replyTo: null, pollTimer: null,
  adminUsers: [], adminFilter: '',
  settings: {
    theme: localStorage.getItem('theme') || 'midnight',
    sound: localStorage.getItem('sound') !== '0',
    vibrate: localStorage.getItem('vibrate') !== '0'
  }
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime = (d) => { const x = new Date(d); return x.getHours().toString().padStart(2,'0')+':'+x.getMinutes().toString().padStart(2,'0'); };
const fmtDate = (d) => { if (!d) return '—'; const x = new Date(d); return x.getDate().toString().padStart(2,'0')+'.'+(x.getMonth()+1).toString().padStart(2,'0')+'.'+x.getFullYear(); };

function toast(msg, ms=2000) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function applyTheme(theme) {
  document.body.className = theme === 'midnight' ? '' : 'theme-' + theme;
  localStorage.setItem('theme', theme);
}

function isAdmin() {
  return state.profile?.is_creator === true || state.profile?.role === 'admin';
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Spacegram init');
  applyTheme(state.settings.theme);

  // ============ АВТОРИЗАЦИЯ ============
  $('tabLogin').onclick = () => { $('tabLogin').classList.add('active'); $('tabRegister').classList.remove('active'); $('loginForm').classList.remove('hidden'); $('registerForm').classList.add('hidden'); };
  $('tabRegister').onclick = () => { $('tabRegister').classList.add('active'); $('tabLogin').classList.remove('active'); $('registerForm').classList.remove('hidden'); $('loginForm').classList.add('hidden'); };

  $('loginBtn').onclick = async () => {
    const username = $('loginUsername').value.trim().toLowerCase();
    const password = $('loginPassword').value;
    const err = $('loginError'); err.textContent = '';
    if (!username || !password) { err.textContent = 'Заполни все поля'; return; }
    $('loginBtn').textContent = 'Вход...';
    const { data, error } = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
    $('loginBtn').textContent = 'Войти';
    if (error) { console.error(error); err.textContent = 'Ошибка БД: ' + error.message; return; }
    if (!data) { err.textContent = 'Пользователь не найден'; return; }
    if (data.pin_code !== password) { err.textContent = 'Неверный пароль' + (data.pin_code === null ? ' (в БД не задан!)' : ''); return; }
    if (data.is_banned) { err.textContent = 'Забанен: ' + (data.ban_reason||''); return; }
    localStorage.setItem('sg_user_id', data.id);
    state.profile = data; state.user = { id: data.id };
    await enterApp();
  };

  $('registerBtn').onclick = async () => {
    const username = $('regUsername').value.trim().toLowerCase();
    const display_name = $('regDisplayName').value.trim();
    const phone = $('regPhone').value.trim();
    const password = $('regPassword').value;
    const err = $('registerError'); err.textContent = '';
    if (!username || !display_name || !password) { err.textContent = 'Заполни поля'; return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { err.textContent = 'Юзернейм: 3-20 (a-z, 0-9, _)'; return; }
    if (password.length < 4) { err.textContent = 'Пароль ≥ 4 символа'; return; }
    $('registerBtn').textContent = 'Создание...';
    const { data: existing } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
    if (existing) { $('registerBtn').textContent = 'Создать аккаунт'; err.textContent = 'Юзернейм занят'; return; }
    const { data, error } = await sb.from('profiles').insert({
      username, display_name, phone: phone || null, pin_code: password,
      bio: 'Привет, я в Spacegram! 🚀', balance: 100
    }).select().single();
    $('registerBtn').textContent = 'Создать аккаунт';
    if (error) { console.error(error); err.textContent = 'Ошибка: ' + error.message; return; }
    localStorage.setItem('sg_user_id', data.id);
    state.profile = data; state.user = { id: data.id };
    await enterApp();
  };

  async function enterApp() {
    $('authScreen').classList.add('hidden');
    $('app').classList.remove('hidden');
    if (isAdmin()) $('adminMenuItem').classList.remove('hidden');
    await refreshProfile();
    await loadChats();
    startPolling();
  }

  async function refreshProfile() {
    if (!state.user) return;
    const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
    if (data) {
      state.profile = data;
      if (data.is_banned) { alert('Забанен: ' + (data.ban_reason||'')); logout(); return; }
      if (isAdmin()) $('adminMenuItem').classList.remove('hidden');
    }
  }

  function logout() { localStorage.removeItem('sg_user_id'); location.reload(); }

  // ============ ЧАТЫ ============
  async function loadChats() {
    const uid = state.user.id;
    const { data: chats, error } = await sb.from('chats').select('*').or(`user1.eq.${uid},user2.eq.${uid},created_by.eq.${uid}`).order('id', { ascending: false });
    if (error) { console.error(error); return; }
    const list = [];
    for (const c of (chats||[])) {
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
    if (!state.chats.length) { el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text2)">💬 Нет чатов<br><br>Нажми «＋ Чат»</div>'; return; }
    el.innerHTML = state.chats.map(c => {
      const name = c.is_group || c.is_channel ? (c.group_name || 'Без названия') : (c.other?.display_name || 'Юзер');
      const initial = name[0]?.toUpperCase() || '?';
      const avatar = c.group_avatar || c.other?.avatar_url;
      return `<div class="chat-item" data-id="${c.id}">
        <div class="chat-item-avatar">${avatar ? `<img src="${esc(avatar)}">` : initial}</div>
        <div class="chat-item-body">
          <div class="chat-item-name">${esc(name)} ${c.is_channel?'📢':c.is_group?'👥':''} ${c.other?.is_plus?'⭐':''}</div>
          <div class="chat-item-last">${esc(c.last_message || 'Нет сообщений')}</div>
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('.chat-item').forEach(i => i.onclick = () => openChat(i.dataset.id));
  }

  async function openChat(chatId) {
    const chat = state.chats.find(c => String(c.id) === String(chatId));
    if (!chat) return;
    state.currentChat = chat;
    $('chatScreen').classList.remove('hidden');
    const name = chat.is_group || chat.is_channel ? (chat.group_name||'Группа') : (chat.other?.display_name || 'Юзер');
    $('chatTitle').textContent = name;
    $('chatSubtitle').textContent = chat.is_channel ? 'канал' : chat.is_group ? 'группа' : 'был(а) недавно';
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
    const unread = state.messages.filter(m => m.sender !== state.user.id && !m.is_read);
    if (unread.length) await sb.from('messages').update({ is_read: true }).in('id', unread.map(m => m.id));
  }

  function renderMessages() {
    const el = $('messagesList');
    el.innerHTML = state.messages.map(m => {
      const own = m.sender === state.user.id;
      const time = fmtTime(m.created_at || Date.now());
      let content = '';
      if (m.deleted) content = '<i>сообщение удалено</i>';
      else {
        if (m.file_url) {
          if ((m.file_type||'').startsWith('image')) content += `<img src="${esc(m.file_url)}" class="msg-media">`;
          else if ((m.file_type||'').startsWith('video')) content += `<video src="${esc(m.file_url)}" class="msg-media" controls></video>`;
          else content += `<a href="${esc(m.file_url)}" target="_blank">📎 ${esc(m.file_name||'Файл')}</a>`;
        }
        if (m.text) content += `<div>${esc(m.text)}</div>`;
      }
      return `<div class="msg ${own?'own':''} ${m.deleted?'deleted':''}" data-id="${m.id}">
        ${!own && (state.currentChat.is_group||state.currentChat.is_channel) ? `<div class="msg-sender">${esc(m.sender_name||'Юзер')}</div>` : ''}
        ${content}<span class="msg-time">${time}</span></div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  $('sendBtn').onclick = sendMessage;
  $('messageInput').onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

  async function sendMessage() {
    const text = $('messageInput').value.trim();
    if (!text || !state.currentChat) return;
    $('messageInput').value = '';
    const payload = {
      chat_id: state.currentChat.id,
      sender: state.user.id,
      text, is_read: false, deleted: false
    };
    if (state.replyTo) { payload.reply_to = state.replyTo.id; state.replyTo = null; $('replyBar').classList.add('hidden'); }
    let { error } = await sb.from('messages').insert(payload);
    if (error && /sender_name/.test(error.message)) {
      // fallback: колонки нет — пробуем без неё (и не падаем)
      const { error: e2 } = await sb.from('messages').insert(payload);
      error = e2;
    }
    if (error) { toast('Ошибка: ' + error.message); return; }
    await sb.from('chats').update({ last_message: text.slice(0,80) }).eq('id', state.currentChat.id);
    await loadMessages();
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    let lastKey = '';
    state.pollTimer = setInterval(async () => {
      if (!state.user) return;
      if (state.currentChat) {
        await loadMessages();
      } else {
        const uid = state.user.id;
        const { data } = await sb.from('chats').select('*')
          .or(`user1.eq.${uid},user2.eq.${uid},created_by.eq.${uid}`)
          .order('id', { ascending: false });
        const key = JSON.stringify((data||[]).map(c => c.id + ':' + (c.last_message||'') + ':' + (c.group_name||'')));
        if (key !== lastKey) { lastKey = key; await loadChats(); }
      }
    }, 3000);
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
    else if (a === 'admin') openAdmin();
    else if (a === 'stories') openStories();
    else if (a === 'friends') toast('Друзья скоро 🚀');
    else if (a === 'saved') toast('Избранное скоро 🚀');
    else if (a === 'mods') toast('Моды скоро 🚀');
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
    const badges = [];
    if (p.is_creator) badges.push('<span class="badge creator" data-badge="creator">👑 Создатель</span>');
    if (p.is_verified) badges.push('<span class="badge verified" data-badge="verified">✅ Верифицирован</span>');
    if (p.is_plus) badges.push('<span class="badge plus" data-badge="plus">⭐ Plus</span>');
    if (p.is_youtuber) badges.push('<span class="badge yt" data-badge="youtuber">▶️ YouTuber</span>');
    if (p.role === 'admin') badges.push('<span class="badge gold" data-badge="admin">⚡ Админ</span>');
    if (p.is_bot_verified) badges.push('<span class="badge" data-badge="bot">🤖 Bot</span>');

    $('profileContent').innerHTML = `
      <div class="profile-cover"></div>
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}">` : initial}</div>
          ${p.avatar_frame ? '<div class="profile-avatar-frame"></div>' : ''}
          <div class="profile-status-dot"></div>
        </div>
        <div class="profile-name">${esc(p.display_name)}</div>
        <div class="profile-username">@${esc(p.username)} ${p.emoji_status||''}</div>
        ${p.bio ? `<div class="profile-bio">${esc(p.bio)}</div>` : ''}
        ${badges.length ? `<div class="profile-badges">${badges.join('')}</div>` : ''}
      </div>
      <div class="profile-stats">
        <div class="stat-card"><div class="stat-value">${p.balance||0}</div><div class="stat-label">💰 SG</div></div>
        <div class="stat-card"><div class="stat-value">${p.level||1}</div><div class="stat-label">🎯 Уровень</div></div>
        <div class="stat-card"><div class="stat-value">${p.messages_count||0}</div><div class="stat-label">💬 Сообщений</div></div>
      </div>
      <div class="profile-actions">
        <button class="primary" onclick="window.editProfile()">✏️ Редактировать</button>
        <button onclick="window.shareProfile()">📤 Поделиться</button>
        ${isAdmin() ? '<button style="grid-column:1/-1;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;border:none" onclick="window.openAdmin()">👑 Админ-панель</button>' : ''}
      </div>
    `;

    // Клики по бейджам
    setTimeout(() => {
      document.querySelectorAll('[data-badge]').forEach(b => {
        b.style.cursor = 'pointer';
        b.onclick = () => showBadgeInfo(b.dataset.badge);
      });
    }, 30);
  }

  function showBadgeInfo(type) {
    const info = {
      creator: { icon: '👑', title: 'Создатель Spacegram', desc: 'Основатель проекта. Имеет полный доступ к админ-панели и всем функциям приложения.' },
      verified: { icon: '✅', title: 'Верифицирован', desc: 'Подтверждённый аккаунт. Личность подтверждена администрацией Spacegram.' },
      plus: { icon: '⭐', title: 'Spacegram Plus', desc: 'Премиум-подписка. Доступ к эксклюзивным стикерам, сторис, темам и бейджам.' },
      youtuber: { icon: '▶️', title: 'YouTuber', desc: 'Проверенный контент-мейкер. Ведёт канал о Spacegram или смежном контенте.' },
      admin: { icon: '⚡', title: 'Администратор', desc: 'Модератор проекта. Следит за порядком, банит нарушителей, решает жалобы.' },
      bot: { icon: '🤖', title: 'Bot Verified', desc: 'Официальный бот Spacegram, проверенный администрацией.' }
    };
    const i = info[type];
    if (!i) return;
    openModal(`
      <div style="text-align:center">
        <div style="font-size:64px;margin-bottom:10px">${i.icon}</div>
        <h3>${i.title}</h3>
        <p style="color:var(--text2);margin-top:10px;line-height:1.5">${i.desc}</p>
        <div class="modal-actions" style="margin-top:20px">
          <button class="primary" onclick="window.closeModal()">Понятно</button>
        </div>
      </div>
    `);
  }

  window.editProfile = async () => {
    const p = state.profile;
    openModal(`
      <h3>✏️ Редактировать профиль</h3>
      <input id="epName" placeholder="Имя" value="${esc(p.display_name||'')}">
      <input id="epAvatar" placeholder="URL аватара" value="${esc(p.avatar_url||'')}">
      <input id="epStatus" placeholder="Emoji-статус" value="${esc(p.emoji_status||'')}" maxlength="4">
      <textarea id="epBio" placeholder="О себе" rows="3">${esc(p.bio||'')}</textarea>
      <div class="modal-actions">
        <button onclick="window.closeModal()">Отмена</button>
        <button class="primary" onclick="window.saveProfile()">Сохранить</button>
      </div>
    `);
  };

  window.saveProfile = async () => {
    const updates = {
      display_name: $('epName').value.trim() || state.profile.display_name,
      avatar_url: $('epAvatar').value.trim() || null,
      emoji_status: $('epStatus').value.trim() || null,
      bio: $('epBio').value.trim()
    };
    const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { toast('Ошибка: ' + error.message); return; }
    await refreshProfile();
    renderProfile();
    window.closeModal();
    toast('Профиль обновлён ✅');
  };

  window.shareProfile = async () => {
    const url = location.origin + '?u=' + state.profile.username;
    if (navigator.share) {
      try { await navigator.share({ title: 'Spacegram', text: 'Мой профиль @' + state.profile.username, url }); } catch(e){}
    } else {
      await navigator.clipboard.writeText(url);
      toast('Ссылка скопирована ✅');
    }
  };

  // ============ СТОРИС ============
  async function openStories() {
    const { data: stories } = await sb.from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    const canPost = state.profile?.is_plus || state.profile?.is_creator || state.profile?.role === 'admin';

    openModal(`
      <h3>📸 Сторис</h3>
      ${canPost 
        ? `<button class="toolbar-btn primary" style="width:100%;margin-bottom:12px" onclick="window.addStory()">＋ Добавить сторис</button>` 
        : `<div style="text-align:center;padding:12px;background:var(--panel2);border-radius:10px;margin-bottom:12px;color:var(--text2);font-size:13px">⭐ Сторис только для Plus</div>`
      }
      <div style="max-height:450px;overflow-y:auto">
        ${(stories||[]).length ? (stories||[]).map(s => {
          const seen = (s.views||[]).includes(state.user.id);
          return `<div class="admin-row" style="cursor:pointer" onclick="window.viewStory('${s.id}')">
            <div style="width:48px;height:48px;border-radius:50%;background:${s.bg_color||'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:2px solid ${seen?'var(--border)':'var(--accent)'};color:#fff">
              ${s.media_url ? '🖼' : '📝'}
            </div>
            <div class="admin-row-info">
              <div class="admin-row-name">${esc((s.text_content||'').slice(0,40) || 'Медиа-сторис')}</div>
              <div class="admin-row-sub">${fmtTime(s.created_at)} · ${s.media_type||'text'}</div>
            </div>
            ${!seen ? '<div class="online-dot"></div>' : ''}
          </div>`;
        }).join('') : '<div style="text-align:center;padding:30px;color:var(--text2)">Пока нет сторис 😢</div>'}
      </div>
      <div class="modal-actions"><button onclick="window.closeModal()">Закрыть</button></div>
    `);
  }

  window.addStory = async () => {
    const text = prompt('Текст сторис (или URL картинки):');
    if (!text) return;
    const isUrl = /^https?:\/\//.test(text);
    const bg = prompt('Цвет фона (например #ff0000):', '#5288c1') || '#5288c1';
    const expires = new Date(Date.now() + 24*3600*1000).toISOString();
    const { error } = await sb.from('stories').insert({
      user_id: state.user.id,
      text_content: isUrl ? null : text,
      media_url: isUrl ? text : null,
      media_type: isUrl ? 'image' : 'text',
      bg_color: bg,
      duration: 5,
      expires_at: expires,
      views: []
    });
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Сторис опубликован! 📸');
    openStories();
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
      <div style="background:${story.bg_color||'#000'};border-radius:14px;padding:40px 20px;text-align:center;min-height:300px;display:flex;flex-direction:column;justify-content:center;align-items:center">
        ${story.media_url ? `<img src="${esc(story.media_url)}" style="max-width:100%;max-height:250px;border-radius:10px">` : ''}
        ${story.text_content ? `<div style="font-size:22px;font-weight:600;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5);margin-top:${story.media_url?'14px':'0'}">${esc(story.text_content)}</div>` : ''}
        <div style="margin-top:20px;color:rgba(255,255,255,.8);font-size:12px">
          @${esc(author?.username||'юзер')} · ${fmtTime(story.created_at)}
        </div>
      </div>
      <div class="modal-actions" style="margin-top:14px">
        <button onclick="window.closeModal()">Закрыть</button>
        <button class="primary" onclick="window.storyReply('${sid}','${story.user_id}')">💬 Ответить</button>
      </div>
    `);
  };

  window.storyReply = async (sid, uid) => {
    window.closeModal();
    if (uid === state.user.id) { toast('Это твоя сторис 🙂'); return; }
    // Открываем/создаём чат с автором
    const { data: other } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!other) return;
    const { data: existing } = await sb.from('chats').select('*').or(`and(user1.eq.${state.user.id},user2.eq.${other.id}),and(user1.eq.${other.id},user2.eq.${state.user.id})`).maybeSingle();
    let chat = existing;
    if (!chat) {
      const { data } = await sb.from('chats').insert({ user1: state.user.id, user2: other.id, created_by: state.user.id }).select().single();
      chat = data;
    }
    await loadChats();
    if (chat) openChat(chat.id);
  };

  // ============ НАСТРОЙКИ ============
  function openSettings() {
    openModal(`
      <h3>⚙️ Настройки</h3>
      <label style="font-size:13px;color:var(--text2)">Тема</label>
      <select id="setTheme">
        ${['midnight','purple','ocean','sunset','rose','forest','cyber','mono','light'].map(t => `<option ${state.settings.theme===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="setSound" ${state.settings.sound?'checked':''}> 🔔 Звук</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="setVib" ${state.settings.vibrate?'checked':''}> 📳 Вибрация</label>
      <div class="modal-actions">
        <button onclick="window.closeModal()">Отмена</button>
        <button class="primary" onclick="window.saveSettings()">Сохранить</button>
      </div>
    `);
  }
  window.saveSettings = () => {
    applyTheme($('setTheme').value);
    state.settings.sound = $('setSound').checked; localStorage.setItem('sound', state.settings.sound?'1':'0');
    state.settings.vibrate = $('setVib').checked; localStorage.setItem('vibrate', state.settings.vibrate?'1':'0');
    window.closeModal(); toast('Сохранено ✅');
  };

  // ============ БАЛАНС ============
  async function openBalance() {
    const { data } = await sb.from('balance_log').select('*').eq('user_id', state.user.id).order('id', { ascending: false }).limit(30);
    openModal(`
      <h3>💰 Баланс: ${state.profile.balance||0} SG</h3>
      <button class="toolbar-btn" style="width:100%;margin-bottom:10px" onclick="window.promoPrompt()">🎁 Промокод</button>
      <div style="max-height:300px;overflow-y:auto">
        ${(data||[]).map(l => `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
          <span style="font-size:13px">${esc(l.reason||'Начисление')}</span>
          <b style="color:${l.amount>0?'var(--success)':'var(--danger)'}">${l.amount>0?'+':''}${l.amount}</b>
        </div>`).join('') || '<div style="color:var(--text2);text-align:center;padding:20px">Нет транзакций</div>'}
      </div>
      <div class="modal-actions"><button onclick="window.closeModal()">Закрыть</button></div>
    `);
  }

  window.promoPrompt = async () => {
    const code = prompt('Промокод:');
    if (!code) return;
    const { data: promo } = await sb.from('promocodes').select('*').eq('code', code.toUpperCase()).maybeSingle();
    if (!promo) { toast('Не найден ❌'); return; }
    if (promo.uses >= promo.max_uses) { toast('Исчерпан'); return; }
    const updates = {};
    if (promo.bonus_coins) updates.balance = (state.profile.balance||0) + promo.bonus_coins;
    if (promo.days && promo.tariff_code) {
      const until = new Date(); until.setDate(until.getDate() + promo.days);
      updates.is_plus = true; updates.plus_until = until.toISOString();
    }
    await sb.from('profiles').update(updates).eq('id', state.user.id);
    await sb.from('promocodes').update({ uses: (promo.uses||0)+1 }).eq('id', promo.id);
    if (promo.bonus_coins) await sb.from('balance_log').insert({ user_id: state.user.id, amount: promo.bonus_coins, reason: 'Промокод ' + promo.code });
    await refreshProfile();
    toast('Активирован! 🎉'); window.closeModal();
  };

  async function openShop() {
    const { data } = await sb.from('shop_items').select('*');
    openModal(`
      <h3>🛒 Магазин</h3>
      <div style="max-height:400px;overflow-y:auto">
        ${(data||[]).map(i => `<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <div><b>${esc(i.name)}</b><br><span style="font-size:12px;color:var(--text2)">${esc(i.category)}</span></div>
          <button class="admin-btn" onclick="window.buyItem('${i.id}')">${i.price} SG</button>
        </div>`).join('') || '<div style="color:var(--text2);text-align:center;padding:20px">Магазин пуст</div>'}
      </div>
      <div class="modal-actions"><button onclick="window.closeModal()">Закрыть</button></div>
    `);
  }

  window.buyItem = async (itemId) => {
    const { data: item } = await sb.from('shop_items').select('*').eq('id', itemId).single();
    if (!item) return;
    if ((state.profile.balance||0) < item.price) { toast('Мало SG'); return; }
    await sb.from('profiles').update({ balance: state.profile.balance - item.price }).eq('id', state.user.id);
    await sb.from('user_purchases').insert({ user_id: state.user.id, item_id: itemId });
    await sb.from('balance_log').insert({ user_id: state.user.id, amount: -item.price, reason: 'Покупка: ' + item.name });
    await refreshProfile();
    toast('Куплено! ✅'); window.closeModal();
  };

  // ============ МОДАЛКА ============
  function openModal(html) { $('modalBox').innerHTML = html; $('modalOverlay').classList.remove('hidden'); }
  window.closeModal = () => $('modalOverlay').classList.add('hidden');
  $('modalOverlay').onclick = (e) => { if (e.target === $('modalOverlay')) window.closeModal(); };

  // ============ ЧАТ МЕНЮ ============
  $('chatBack').onclick = () => { $('chatScreen').classList.add('hidden'); state.currentChat = null; };
  $('chatMenuBtn').onclick = () => {
    if (!state.currentChat) return;
    const name = state.currentChat.is_group || state.currentChat.is_channel ? state.currentChat.group_name : state.currentChat.other?.display_name;
    openModal(`
      <h3>${esc(name||'Чат')}</h3>
      <button class="toolbar-btn" style="width:100%;margin-bottom:8px" onclick="window.clearChatHistory()">🗑 Очистить</button>
      <div class="modal-actions"><button onclick="window.closeModal()">Закрыть</button></div>
    `);
  };
  window.clearChatHistory = async () => {
    await sb.from('messages').update({ deleted: true }).eq('chat_id', state.currentChat.id);
    await loadMessages(); window.closeModal(); toast('Очищено');
  };

  // ============ НОВЫЙ ЧАТ ============
  $('newChatBtn').onclick = () => {
    openModal(`<h3>💬 Новый чат</h3><input id="newChatUser" placeholder="Юзернейм"><div class="modal-actions"><button onclick="window.closeModal()">Отмена</button><button class="primary" onclick="window.createChat()">Создать</button></div>`);
  };
  window.createChat = async () => {
    const username = $('newChatUser').value.trim().toLowerCase();
    if (!username) return;
    const { data: other } = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
    if (!other) { toast('Не найден'); return; }
    if (other.id === state.user.id) { toast('Это ты 🙂'); return; }
    const { data: existing } = await sb.from('chats').select('*').or(`and(user1.eq.${state.user.id},user2.eq.${other.id}),and(user1.eq.${other.id},user2.eq.${state.user.id})`).maybeSingle();
    let chat = existing;
    if (!chat) {
      const { data, error } = await sb.from('chats').insert({ user1: state.user.id, user2: other.id, created_by: state.user.id }).select().single();
      if (error) { toast('Ошибка: ' + error.message); return; }
      chat = data;
    }
    window.closeModal(); await loadChats(); openChat(chat.id);
  };

  $('newGroupBtn').onclick = () => createGroup(false);
  $('newChannelBtn').onclick = () => createGroup(true);
  function createGroup(isChannel) {
    openModal(`<h3>${isChannel?'📢 Канал':'👥 Группа'}</h3><input id="grpName" placeholder="Название"><div class="modal-actions"><button onclick="window.closeModal()">Отмена</button><button class="primary" onclick="window.doCreateGroup(${isChannel})">Создать</button></div>`);
  }
  window.doCreateGroup = async (isChannel) => {
    const name = $('grpName').value.trim();
    if (!name) { toast('Введи название'); return; }
    const { data, error } = await sb.from('chats').insert({ is_group: !isChannel, is_channel: isChannel, group_name: name, created_by: state.user.id, user1: state.user.id, user2: state.user.id }).select().single();
    if (error) { toast('Ошибка: ' + error.message); return; }
    window.closeModal(); await loadChats(); openChat(data.id);
  };

  // ============ ФАЙЛЫ ============
  $('attachBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = async () => {
    const file = $('fileInput').files[0];
    if (!file || !state.currentChat) return;
    toast('Загрузка...');
    const path = `uploads/${Date.now()}_${file.name}`;
    const { error: upErr } = await sb.storage.from('files').upload(path, file);
    if (upErr) { toast('Ошибка: ' + upErr.message); return; }
    const { data: urlData } = sb.storage.from('files').getPublicUrl(path);
    const payload = {
      chat_id: state.currentChat.id, sender: state.user.id,
      file_url: urlData.publicUrl, file_type: file.type, file_name: file.name,
      is_read: false, deleted: false
    };
    let { error } = await sb.from('messages').insert(payload);
    if (error && /sender_name/.test(error.message)) { const r = await sb.from('messages').insert(payload); error = r.error; }
    if (error) { toast('Ошибка: ' + error.message); return; }
    $('fileInput').value = '';
    await loadMessages();
  };

  // ============ ЭМОДЗИ ============
  $('emojiBtn').onclick = () => {
    const list = ['😀','😂','🥰','😎','🤔','😴','🤯','🥳','😭','😡','👍','👎','❤️','🔥','🎉','🚀','⭐','💯','✅','❌','🙏','🤝','👀','💀','🤡'];
    openModal(`<h3>😊 Эмодзи</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${list.map(e => `<button style="font-size:24px;padding:6px" onclick="document.getElementById('messageInput').value+='${e}';window.closeModal()">${e}</button>`).join('')}</div><div class="modal-actions"><button onclick="window.closeModal()">Закрыть</button></div>`);
  };

  // ============ РЕАКЦИИ ============
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
    if (navigator.vibrate) navigator.vibrate(20);
    await loadMessages();
  });

  // ============ SWIPE ============
  let swipeStart = null;
  $('messagesList').addEventListener('touchstart', (e) => {
    const msgEl = e.target.closest('.msg');
    if (!msgEl) return;
    swipeStart = { x: e.touches[0].clientX, id: msgEl.dataset.id };
  });
  $('messagesList').addEventListener('touchend', (e) => {
    if (!swipeStart) return;
    const dx = e.changedTouches[0].clientX - swipeStart.x;
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

  // ============ ПОИСК ============
  $('searchBtn').onclick = () => {
    openModal(`<h3>🔍 Поиск</h3><input id="searchQ" placeholder="Текст или @username"><div id="searchResults" style="max-height:300px;overflow-y:auto;margin-top:10px"></div><div class="modal-actions"><button onclick="window.closeModal()">Закрыть</button></div>`);
    $('searchQ').oninput = async () => {
      const q = $('searchQ').value.trim();
      if (q.length < 2) { $('searchResults').innerHTML = ''; return; }
      const { data: msgs } = await sb.from('messages').select('*').ilike('text', `%${q}%`).limit(20);
      const { data: users } = await sb.from('profiles').select('*').ilike('username', `%${q}%`).limit(10);
      $('searchResults').innerHTML = `
        ${users?.length ? '<b style="font-size:12px;color:var(--text2)">Юзеры:</b>' + users.map(u => `<div style="padding:6px 0">@${esc(u.username)} — ${esc(u.display_name)}</div>`).join('') : ''}
        ${msgs?.length ? '<b style="font-size:12px;color:var(--text2);display:block;margin-top:8px">Сообщения:</b>' + msgs.map(m => `<div style="padding:6px 0;font-size:13px">${esc((m.text||'').slice(0,80))}</div>`).join('') : ''}
      `;
    };
  };

  // ============================================
  // ============ 👑 АДМИН-ПАНЕЛЬ ============
  // ============================================
  let adminTab = 'users';

  window.openAdmin = async () => {
    if (!isAdmin()) { toast('Нет доступа'); return; }
    renderAdmin();
  };

  async function renderAdmin() {
    const [users, chats, messages, promos, shopItems, reports] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(200).then(r => r.data || []),
      sb.from('chats').select('*').order('id', { ascending: false }).limit(30).then(r => r.data || []),
      sb.from('messages').select('*').order('id', { ascending: false }).limit(50).then(r => r.data || []),
      sb.from('promocodes').select('*').limit(50).then(r => r.data || []),
      sb.from('shop_items').select('*').limit(50).then(r => r.data || []),
      sb.from('reports').select('*').eq('status', 'pending').limit(50).then(r => r.data || [])
    ]);

    state.adminUsers = users;

    const content = adminTab === 'users' ? renderAdminUsers()
      : adminTab === 'chats' ? renderAdminChats(chats)
      : adminTab === 'messages' ? renderAdminMessages(messages)
      : adminTab === 'promos' ? renderAdminPromos(promos)
      : adminTab === 'shop' ? renderAdminShop(shopItems)
      : adminTab === 'reports' ? renderAdminReports(reports)
      : renderAdminStats(users, chats, messages);

    openModal(`
      <h3>👑 Админ-панель</h3>
      <div class="admin-tabs">
        <button class="admin-tab ${adminTab==='users'?'active':''}" data-atab="users">👥 Юзеры</button>
        <button class="admin-tab ${adminTab==='chats'?'active':''}" data-atab="chats">💬 Чаты</button>
        <button class="admin-tab ${adminTab==='messages'?'active':''}" data-atab="messages">📝 Сообщения</button>
        <button class="admin-tab ${adminTab==='promos'?'active':''}" data-atab="promos">🎁 Промо</button>
        <button class="admin-tab ${adminTab==='shop'?'active':''}" data-atab="shop">🛒 Магазин</button>
        <button class="admin-tab ${adminTab==='reports'?'active':''}" data-atab="reports">🚨 Жалобы</button>
        <button class="admin-tab ${adminTab==='stats'?'active':''}" data-atab="stats">📊 Стата</button>
      </div>
      <div style="max-height:55vh;overflow-y:auto">${content}</div>
      <div class="modal-actions">
        <button onclick="window.closeModal()">Закрыть</button>
        <button class="primary" onclick="window.adminRefresh()">🔄 Обновить</button>
      </div>
    `);

    document.querySelectorAll('.admin-tab').forEach(t => t.onclick = () => { adminTab = t.dataset.atab; renderAdmin(); });

    const searchU = $('adminUserSearch');
    if (searchU) searchU.oninput = () => {
      state.adminFilter = searchU.value.toLowerCase().trim();
      const list = $('adminUserList');
      if (list) list.innerHTML = renderAdminUsersList();
    };
  }

  // ============ 👥 УПРАВЛЕНИЕ ЮЗЕРАМИ ============
  function renderAdminUsers() {
    return `
      <input id="adminUserSearch" placeholder="🔍 Поиск по @username или имени..." value="${esc(state.adminFilter)}" style="margin-bottom:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <button class="admin-btn success" onclick="window.adminShowCreateUser()">＋ Создать</button>
        <button class="admin-btn" onclick="window.adminExportUsers()">📤 Экспорт JSON</button>
      </div>
      <div id="adminUserList">${renderAdminUsersList()}</div>
    `;
  }

  function renderAdminUsersList() {
    const f = state.adminFilter;
    const list = state.adminUsers.filter(u =>
      !f || u.username?.toLowerCase().includes(f) || u.display_name?.toLowerCase().includes(f)
    );

    if (!list.length) return '<div style="text-align:center;padding:30px;color:var(--text2)">Никого не найдено</div>';

    return list.map(u => {
      const badges = [];
      if (u.is_creator) badges.push('👑');
      if (u.role === 'admin') badges.push('⚡');
      if (u.is_verified) badges.push('✅');
      if (u.is_plus) badges.push('⭐');
      if (u.is_youtuber) badges.push('▶️');
      if (u.is_bot_verified) badges.push('🤖');

      return `
        <div class="admin-row" style="flex-wrap:wrap">
          <div class="admin-row-info" style="flex-basis:100%">
            <div class="admin-row-name">
              ${badges.join(' ')} ${esc(u.display_name||'—')}
              ${u.is_banned ? '<span style="color:var(--danger)">🚫 БАН</span>' : ''}
            </div>
            <div class="admin-row-sub">
              @${esc(u.username||'—')} · ID: <code style="font-size:10px">${u.id.slice(0,8)}</code><br>
              💰 ${u.balance||0} SG · 🎯 lvl ${u.level||1} · 💬 ${u.messages_count||0}<br>
              ⚠️ варны: ${u.warns||0}/3 · рег: ${fmtDate(u.created_at)}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;flex-basis:100%;margin-top:6px">
            <button class="admin-btn" data-act="edit" data-uid="${u.id}">✏️ Изменить</button>
            <button class="admin-btn" data-act="balance" data-uid="${u.id}">💰 Баланс</button>
            <button class="admin-btn" data-act="pass" data-uid="${u.id}">🔑 Пароль</button>
            <button class="admin-btn" data-act="warn" data-uid="${u.id}">⚠️ Варн</button>
            <button class="admin-btn" data-act="mute" data-uid="${u.id}">🔇 Мут</button>
            <button class="admin-btn" data-act="verify" data-uid="${u.id}">${u.is_verified?'❌ Снять✅':'✅ Вериф'}</button>
            <button class="admin-btn" data-act="plus" data-uid="${u.id}">${u.is_plus?'❌ Снять⭐':'⭐ Plus'}</button>
            ${u.is_creator ? '' : `<button class="admin-btn" data-act="creator" data-uid="${u.id}">👑 Создатель</button>`}
            <button class="admin-btn danger" data-act="delete" data-uid="${u.id}">🗑 Удалить</button>
            <button class="admin-btn ${u.is_banned?'success':'danger'}" data-act="ban" data-uid="${u.id}">${u.is_banned?'✅ Разбан':'🚫 Бан'}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Привязка кнопок через делегирование (не спамит обработчиками)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && document.querySelector('.admin-tabs')) adminUserAction(b.dataset.act, b.dataset.uid);
  });

  async function adminUserAction(action, uid) {
    if (!isAdmin()) return;
    const u = state.adminUsers.find(x => x.id === uid);
    if (!u) return;

    switch(action) {
      case 'edit': return window.adminShowEditUser(u);
      case 'balance': return window.adminShowBalance(u);
      case 'pass': return window.adminShowPass(u);
      case 'warn': return window.adminAddWarn(u);
      case 'mute': return window.adminMute(u);
      case 'verify': return window.adminToggleVerified(u);
      case 'plus': return window.adminTogglePlus(u);
      case 'creator': return window.adminToggleCreator(u);
      case 'delete': return window.adminDeleteUser(u);
      case 'ban': return window.adminToggleBan(u);
    }
  }

  window.adminShowEditUser = (u) => {
    openModal(`
      <h3>✏️ ${esc(u.username)}</h3>
      <label style="font-size:12px;color:var(--text2)">ID: <code>${u.id}</code></label>
      <input id="auName" placeholder="Имя" value="${esc(u.display_name||'')}">
      <input id="auAvatar" placeholder="URL аватара" value="${esc(u.avatar_url||'')}">
      <input id="auPhone" placeholder="Телефон" value="${esc(u.phone||'')}">
      <textarea id="auBio" placeholder="Био" rows="2">${esc(u.bio||'')}</textarea>
      <input id="auStatus" placeholder="Emoji-статус" value="${esc(u.emoji_status||'')}">
      <input id="auLevel" type="number" placeholder="Уровень" value="${u.level||1}">
      <input id="auXP" type="number" placeholder="XP" value="${u.xp||0}">
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="auVerified" ${u.is_verified?'checked':''}> ✅ Верифицирован</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="auPlus" ${u.is_plus?'checked':''}> ⭐ Plus</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="auCreator" ${u.is_creator?'checked':''}> 👑 Создатель</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="auYt" ${u.is_youtuber?'checked':''}> ▶️ YouTuber</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="auBot" ${u.is_bot_verified?'checked':''}> 🤖 Bot Verified</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="auGhost" ${u.ghost_mode?'checked':''}> 👻 Ghost mode</label>
      <select id="auRole">
        <option value="user" ${u.role==='user'?'selected':''}>user</option>
        <option value="moderator" ${u.role==='moderator'?'selected':''}>moderator</option>
        <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
      </select>
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminSaveUser('${u.id}')">💾 Сохранить</button>
      </div>
    `);
  };

  window.adminSaveUser = async (uid) => {
    const updates = {
      display_name: $('auName').value.trim(),
      avatar_url: $('auAvatar').value.trim() || null,
      phone: $('auPhone').value.trim() || null,
      bio: $('auBio').value.trim(),
      emoji_status: $('auStatus').value.trim() || null,
      level: parseInt($('auLevel').value) || 1,
      xp: parseInt($('auXP').value) || 0,
      is_verified: $('auVerified').checked,
      is_plus: $('auPlus').checked,
      is_creator: $('auCreator').checked,
      is_youtuber: $('auYt').checked,
      is_bot_verified: $('auBot').checked,
      ghost_mode: $('auGhost').checked,
      role: $('auRole').value
    };
    const { error } = await sb.from('profiles').update(updates).eq('id', uid);
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Сохранено ✅'); renderAdmin();
  };

  window.adminShowBalance = (u) => {
    openModal(`
      <h3>💰 Баланс @${esc(u.username)}</h3>
      <p style="margin-bottom:10px">Текущий: <b>${u.balance||0} SG</b></p>
      <input id="abAmount" type="number" placeholder="Сумма (+ или -)" value="100">
      <input id="abReason" placeholder="Причина" value="Начисление админа">
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminChangeBalance('${u.id}')">💰 Применить</button>
      </div>
    `);
  };
  window.adminChangeBalance = async (uid) => {
    const amount = parseInt($('abAmount').value) || 0;
    const reason = $('abReason').value.trim() || 'Начисление';
    const u = state.adminUsers.find(x => x.id === uid);
    const newBal = Math.max(0, (u.balance||0) + amount);
    await sb.from('profiles').update({ balance: newBal }).eq('id', uid);
    await sb.from('balance_log').insert({ user_id: uid, amount, reason: reason + ' (админ)', from_admin: state.user.id });
    toast(`Баланс: ${newBal} SG`); renderAdmin();
  };

  window.adminShowPass = (u) => {
    openModal(`
      <h3>🔑 Смена пароля @${esc(u.username)}</h3>
      <input id="apNew" placeholder="Новый пароль">
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminSetPass('${u.id}')">🔑 Сменить</button>
      </div>
    `);
  };
  window.adminSetPass = async (uid) => {
    const pass = $('apNew').value.trim();
    if (pass.length < 4) { toast('Минимум 4 символа'); return; }
    await sb.from('profiles').update({ pin_code: pass }).eq('id', uid);
    toast('Пароль изменён ✅'); renderAdmin();
  };

  window.adminAddWarn = async (u) => {
    const reason = prompt('Причина варна:');
    if (!reason) return;
    const warns = (u.warns||0) + 1;
    await sb.from('profiles').update({ warns }).eq('id', u.id);
    await sb.from('user_warns').insert({ user_id: u.id, admin_id: state.user.id, reason });
    if (warns >= 3) {
      await sb.from('profiles').update({ is_banned: true, ban_reason: 'Автобан: 3 варна' }).eq('id', u.id);
      toast('🚫 3 варна — автобан!');
    } else toast(`Варн ${warns}/3`);
    renderAdmin();
  };

  window.adminMute = (u) => {
    openModal(`
      <h3>🔇 Мут @${esc(u.username)}</h3>
      <select id="amDur">
        <option value="5">5 минут</option>
        <option value="60">1 час</option>
        <option value="1440">1 день</option>
        <option value="10080">7 дней</option>
        <option value="0">Снять мут</option>
      </select>
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminApplyMute('${u.id}')">🔇 Применить</button>
      </div>
    `);
  };
  window.adminApplyMute = async (uid) => {
    const mins = parseInt($('amDur').value);
    const until = mins === 0 ? null : new Date(Date.now() + mins*60000).toISOString();
    await sb.from('profiles').update({ muted_until: until, mute_until: until }).eq('id', uid);
    toast(mins === 0 ? 'Мут снят' : `Мут на ${mins} мин`); renderAdmin();
  };

  window.adminToggleVerified = async (u) => {
    await sb.from('profiles').update({ is_verified: !u.is_verified }).eq('id', u.id);
    toast(!u.is_verified ? '✅ Верифицирован' : '❌ Снята'); renderAdmin();
  };
  window.adminTogglePlus = async (u) => {
    await sb.from('profiles').update({ is_plus: !u.is_plus }).eq('id', u.id);
    toast(!u.is_plus ? '⭐ Plus выдан' : '❌ Снят'); renderAdmin();
  };
  window.adminToggleCreator = async (u) => {
    if (u.id === state.user.id) { toast('Нельзя снять с себя'); return; }
    await sb.from('profiles').update({ is_creator: !u.is_creator }).eq('id', u.id);
    toast(!u.is_creator ? '👑 Создатель' : '❌ Снят'); renderAdmin();
  };

  window.adminToggleBan = async (u) => {
    if (u.id === state.user.id) { toast('Нельзя забанить себя'); return; }
    if (u.is_banned) {
      await sb.from('profiles').update({ is_banned: false, ban_reason: null }).eq('id', u.id);
      toast('✅ Разбанен');
    } else {
      const reason = prompt('Причина бана:', 'Нарушение') || 'Нарушение';
      await sb.from('profiles').update({ is_banned: true, ban_reason: reason, banned_at: new Date().toISOString(), banned_by: state.user.id }).eq('id', u.id);
      toast('🚫 Забанен');
    }
    renderAdmin();
  };

  window.adminDeleteUser = async (u) => {
    if (u.id === state.user.id) { toast('Нельзя удалить себя'); return; }
    if (!confirm(`УДАЛИТЬ @${u.username}? Это необратимо!`)) return;
    await sb.from('messages').delete().eq('sender', u.id);
    await sb.from('chats').delete().or(`user1.eq.${u.id},user2.eq.${u.id}`);
    await sb.from('profiles').delete().eq('id', u.id);
    toast('🗑 Удалён'); renderAdmin();
  };

  window.adminShowCreateUser = () => {
    openModal(`
      <h3>＋ Создать юзера</h3>
      <input id="cuUsername" placeholder="username">
      <input id="cuName" placeholder="Имя">
      <input id="cuPassword" placeholder="Пароль">
      <input id="cuBalance" type="number" placeholder="Баланс SG" value="100">
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminCreateUser()">＋ Создать</button>
      </div>
    `);
  };
  window.adminCreateUser = async () => {
    const username = $('cuUsername').value.trim().toLowerCase();
    const display_name = $('cuName').value.trim();
    const pin_code = $('cuPassword').value;
    const balance = parseInt($('cuBalance').value) || 100;
    if (!username || !display_name || !pin_code) { toast('Заполни поля'); return; }
    const { error } = await sb.from('profiles').insert({ username, display_name, pin_code, balance, bio: '' });
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Создан ✅'); renderAdmin();
  };

  window.adminExportUsers = () => {
    const blob = new Blob([JSON.stringify(state.adminUsers, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spacegram_users_' + Date.now() + '.json';
    a.click();
    toast('Экспортировано 📤');
  };

  // ============ ОСТАЛЬНЫЕ ВКЛАДКИ ============
  function renderAdminStats(users, chats, messages) {
    const bannedCount = users.filter(u => u.is_banned).length;
    const plusCount = users.filter(u => u.is_plus).length;
    const totalBalance = users.reduce((s,u) => s + (u.balance||0), 0);
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="stat-card"><div class="stat-value">${users.length}</div><div class="stat-label">Юзеров</div></div>
        <div class="stat-card"><div class="stat-value">${chats.length}</div><div class="stat-label">Чатов</div></div>
        <div class="stat-card"><div class="stat-value">${messages.length}</div><div class="stat-label">Сообщений</div></div>
        <div class="stat-card"><div class="stat-value">${plusCount}</div><div class="stat-label">⭐ Plus</div></div>
        <div class="stat-card"><div class="stat-value">${bannedCount}</div><div class="stat-label">🚫 Бан</div></div>
        <div class="stat-card"><div class="stat-value">${totalBalance}</div><div class="stat-label">💰 SG</div></div>
      </div>
    `;
  }

  function renderAdminChats(chats) {
    return chats.map(c => `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(c.group_name || 'Чат #' + c.id)} ${c.is_channel?'📢':c.is_group?'👥':'💬'}</div>
          <div class="admin-row-sub">ID: ${c.id} · last: ${esc((c.last_message||'').slice(0,40))}</div>
        </div>
        <button class="admin-btn danger" onclick="window.adminDeleteChat('${c.id}')">🗑</button>
      </div>
    `).join('');
  }
  window.adminDeleteChat = async (cid) => {
    if (!confirm('Удалить чат и все сообщения?')) return;
    await sb.from('messages').delete().eq('chat_id', cid);
    await sb.from('chats').delete().eq('id', cid);
    toast('Удалено'); renderAdmin();
  };

  function renderAdminMessages(messages) {
    return messages.map(m => `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc((m.text||m.file_name||'[медиа]').slice(0,50))}</div>
          <div class="admin-row-sub">от ${esc(m.sender_name||m.sender)} · ${m.deleted?'🗑':'✓'}</div>
        </div>
        <button class="admin-btn danger" onclick="window.adminDeleteMsg('${m.id}')">🗑</button>
      </div>
    `).join('');
  }
  window.adminDeleteMsg = async (mid) => {
    if (!confirm('Удалить сообщение?')) return;
    await sb.from('messages').update({ deleted: true, text: null }).eq('id', mid);
    toast('Удалено'); renderAdmin();
  };

  function renderAdminPromos(promos) {
    return `
      <button class="admin-btn success" style="width:100%;margin-bottom:10px" onclick="window.adminCreatePromo()">＋ Создать промокод</button>
      ${promos.map(p => `
        <div class="admin-row">
          <div class="admin-row-info">
            <div class="admin-row-name">🎁 ${esc(p.code)}</div>
            <div class="admin-row-sub">${p.days||0} дней · ${p.bonus_coins||0} SG · ${p.uses||0}/${p.max_uses||0}</div>
          </div>
          <button class="admin-btn danger" onclick="window.adminDeletePromo('${p.id}')">🗑</button>
        </div>
      `).join('')}
    `;
  }
  window.adminCreatePromo = () => {
    openModal(`
      <h3>🎁 Новый промокод</h3>
      <input id="npCode" placeholder="КОД" style="text-transform:uppercase">
      <input id="npDays" type="number" placeholder="Дней Plus" value="0">
      <input id="npCoins" type="number" placeholder="SG монет" value="0">
      <input id="npMax" type="number" placeholder="Макс использований" value="100">
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminSavePromo()">💾 Создать</button>
      </div>
    `);
  };
  window.adminSavePromo = async () => {
    const code = $('npCode').value.trim().toUpperCase();
    if (!code) { toast('Введи код'); return; }
    const { error } = await sb.from('promocodes').insert({
      code, days: parseInt($('npDays').value) || 0,
      bonus_coins: parseInt($('npCoins').value) || 0,
      max_uses: parseInt($('npMax').value) || 100, uses: 0, created_by: state.user.id
    });
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Создан ✅'); renderAdmin();
  };
  window.adminDeletePromo = async (pid) => {
    if (!confirm('Удалить?')) return;
    await sb.from('promocodes').delete().eq('id', pid);
    toast('Удалено'); renderAdmin();
  };

  function renderAdminShop(items) {
    return `
      <button class="admin-btn success" style="width:100%;margin-bottom:10px" onclick="window.adminCreateShop()">＋ Добавить товар</button>
      ${items.map(i => `
        <div class="admin-row">
          <div class="admin-row-info">
            <div class="admin-row-name">${esc(i.name)}</div>
            <div class="admin-row-sub">${esc(i.category)} · ${i.price} SG</div>
          </div>
          <button class="admin-btn danger" onclick="window.adminDeleteShop('${i.id}')">🗑</button>
        </div>
      `).join('')}
    `;
  }
  window.adminCreateShop = () => {
    openModal(`
      <h3>🛒 Новый товар</h3>
      <input id="nsName" placeholder="Название">
      <select id="nsCat"><option value="frame">Рамка</option><option value="color">Цвет имени</option><option value="wallpaper">Обои</option></select>
      <input id="nsPrice" type="number" placeholder="Цена SG" value="100">
      <div class="modal-actions">
        <button onclick="window.openAdmin()">← Назад</button>
        <button class="primary" onclick="window.adminSaveShop()">💾 Создать</button>
      </div>
    `);
  };
  window.adminSaveShop = async () => {
    const { error } = await sb.from('shop_items').insert({
      name: $('nsName').value.trim(), category: $('nsCat').value, price: parseInt($('nsPrice').value) || 100
    });
    if (error) { toast('Ошибка: ' + error.message); return; }
    toast('Создан ✅'); renderAdmin();
  };
  window.adminDeleteShop = async (sid) => {
    if (!confirm('Удалить?')) return;
    await sb.from('shop_items').delete().eq('id', sid);
    toast('Удалено'); renderAdmin();
  };

  function renderAdminReports(reports) {
    if (!reports.length) return '<div style="text-align:center;padding:30px;color:var(--text2)">🎉 Жалоб нет</div>';
    return reports.map(r => `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">🚨 ${esc(r.reason||'Без причины')}</div>
          <div class="admin-row-sub">msg: ${r.message_id} · от ${esc(r.reporter_id)}</div>
        </div>
        <button class="admin-btn success" onclick="window.adminResolveReport('${r.id}')">✅</button>
      </div>
    `).join('');
  }
  window.adminResolveReport = async (rid) => {
    await sb.from('reports').update({ status: 'resolved', reviewed_by: state.user.id }).eq('id', rid);
    toast('Решено ✅'); renderAdmin();
  };

  window.adminRefresh = () => { renderAdmin(); toast('Обновлено 🔄'); };

  // ============ АВТОЗАПУСК ============
  (async function init() {
    const savedId = localStorage.getItem('sg_user_id');
    if (savedId) {
      state.user = { id: savedId };
      await enterApp();
    }
  })();

  console.log('✅ Spacegram loaded');
});
