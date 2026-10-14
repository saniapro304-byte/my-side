/* ============================================================
   FENIX v22 — app.js
   Часть 1: Ядро + auth + чаты + сообщения + профиль + фичи
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
      if (mod.createClient) { console.log('✅ CDN:', url); return mod.createClient; }
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('CDN упали');
}

const SUPABASE_URL = 'https://qtuvtxbxtypvttfjiydv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dXZ0eGJ4dHlwdnR0ZmppeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMDg1NzEsImV4cCI6MjEwNjY4NDU3MX0.hxLhZNqjMoxJmGDgNdfb8eiFg3yGBKwwkioZJG74EpA';

let sb = null;

const state = {
  user: null, profile: null,
  chats: [], currentChat: null, currentFolder: 'all',
  messages: [], replyTo: null, burnAfter: 0,
  stickers: [], pollTimer: null, typingWatchTimer: null,
  realtimeChats: null, realtimeMsgs: null,
  typingTimer: null, draftTimer: null,
  adminUsersCache: [], adminTab: 'users',
  accounts: JSON.parse(localStorage.getItem('sg_accounts') || '[]'),
  settings: {
    theme: localStorage.getItem('sg_theme') || 'midnight',
    mode: localStorage.getItem('sg_mode') || 'dark',
    sound: localStorage.getItem('sg_sound') !== '0',
    vibrate: localStorage.getItem('sg_vibrate') !== '0',
    readReceipts: localStorage.getItem('sg_read') !== '0',
    enterSend: localStorage.getItem('sg_enter') !== '0',
    ghost: localStorage.getItem('sg_ghost') === '1',
    showTyping: localStorage.getItem('sg_typing') !== '0'
  }
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime = (d) => { if (!d) return ''; const x = new Date(d); if (isNaN(x)) return ''; return x.getHours().toString().padStart(2,'0') + ':' + x.getMinutes().toString().padStart(2,'0'); };
const fmtDate = (d) => { if (!d) return '—'; const x = new Date(d); if (isNaN(x)) return '—'; return x.getDate().toString().padStart(2,'0') + '.' + (x.getMonth()+1).toString().padStart(2,'0') + '.' + x.getFullYear(); };
const fmtDateFull = (d) => { if (!d) return ''; const x = new Date(d); const now = new Date(); const diff = now - x; if (diff < 86400000 && x.getDate() === now.getDate()) return 'Сегодня'; if (diff < 172800000) return 'Вчера'; return fmtDate(d); };
const toTime = (d) => { if (!d) return 0; if (typeof d === 'object' && typeof d.getTime === 'function') return d.getTime(); const t = new Date(d).getTime(); return isNaN(t) ? 0 : t; };
const sortMessages = (arr) => [...arr].sort((a, b) => { const ta = toTime(a.created_at), tb = toTime(b.created_at); if (ta !== tb) return ta - tb; return (Number(a.id) || 0) - (Number(b.id) || 0); });

function renderBadge(type) {
  const cfg = { verified: { color: '#2AABEE', shape: 'circle' }, creator: { color: '#000000', shape: 'circle' }, premium: { color: '#2AABEE', shape: 'star' }, owner: { color: '#000000', shape: 'star' }, youtuber: { color: '#FF0000', shape: 'circle' } }[type];
  if (!cfg) return '';
  const ck = 'M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l7.6-7.6 1.4 1.4z';
  if (cfg.shape === 'circle') return '<span class="sg-badge ' + type + '"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="' + cfg.color + '"/><path d="' + ck + '" fill="#fff" transform="translate(-1,1) scale(0.9)"/></svg></span>';
  return '<span class="sg-badge ' + type + '"><svg viewBox="0 0 24 24"><path d="M12 0.5l2.1 2.6 3.3-.6.5 3.3 2.9 1.7-1.5 3 1.5 3-2.9 1.7-.5 3.3-3.3-.6L12 23.5l-2.1-2.6-3.3.6-.5-3.3-2.9-1.7 1.5-3-1.5-3 2.9-1.7.5-3.3 3.3.6L12 0.5z" fill="' + cfg.color + '"/><path d="' + ck + '" fill="#fff" transform="translate(-1,1) scale(0.9)"/></svg></span>';
}

function userBadgeHtml(user) {
  if (!user) return '';
  if (user.is_creator) return renderBadge('creator');
  if (user.role === 'admin') return renderBadge('owner');
  if (user.is_verified) return renderBadge('verified');
  if (user.is_plus) return renderBadge('premium');
  if (user.is_youtuber) return renderBadge('youtuber');
  return '';
}

function toast(msg, ms = 2200) {
  let t = $('sgToast');
  if (!t) { t = document.createElement('div'); t.id = 'sgToast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; }, ms);
}

function showBanBanner(reason) {
  let b = $('banBanner');
  if (!b) { b = document.createElement('div'); b.id = 'banBanner'; document.body.appendChild(b); }
  b.innerHTML = '🚫 Вы забанены: ' + esc(reason || 'нарушение');
}

function applyTheme(theme) {
  document.body.className = document.body.className.replace(/theme-\S+/g, '').trim();
  if (theme && theme !== 'midnight') document.body.classList.add('theme-' + theme);
  localStorage.setItem('sg_theme', theme);
}
function applyMode(mode) { if (mode === 'light') document.body.classList.add('l'); else document.body.classList.remove('l'); localStorage.setItem('sg_mode', mode); }
function isAdmin() { return state.profile?.is_creator === true || state.profile?.role === 'admin'; }
function canPostStories() { return state.profile?.is_plus || state.profile?.is_creator || state.profile?.role === 'admin'; }

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
function closeModal() { const ov = $('sgModalOverlay'); if (ov) ov.classList.remove('show'); }
window.closeModal = closeModal;

async function uploadFile(bucket, file, folder = '') {
  if (!sb) throw new Error('Supabase не готов');
  if (!bucket) throw new Error('Bucket не указан');
  const ext = file.name.split('.').pop() || 'bin';
  const path = (folder ? folder + '/' : '') + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '.' + ext;
  console.log('📤 Upload:', bucket, '->', path);
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('❌ Upload:', error); throw new Error(error.message); }
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* ============ DEVICE ID ============ */
function getDeviceId() {
  let deviceId = localStorage.getItem('sg_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();
    localStorage.setItem('sg_device_id', deviceId);
  }
  return deviceId;
}

async function checkIPBan() {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json').then(r => r.json()).catch(() => null);
    if (!ipRes?.ip) return false;
    const { data } = await sb.from('bans').select('*').eq('type', 'ip').eq('value', ipRes.ip).eq('active', true).or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()).maybeSingle();
    if (data) { showBanBanner('IP забанен: ' + (data.reason || 'нарушение')); return true; }
  } catch(e) {}
  return false;
}

async function checkDeviceBan() {
  const deviceId = getDeviceId();
  try {
    const { data } = await sb.from('bans').select('*').eq('type', 'device').eq('value', deviceId).eq('active', true).or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()).maybeSingle();
    if (data) { showBanBanner('Устройство забанено: ' + (data.reason || 'нарушение')); return true; }
  } catch(e) {}
  return false;
}

/* ============ МУЛЬТИ-АККАУНТ ============ */
function saveAccount(profile) {
  if (!profile || !profile.id) return;
  const acc = { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, is_creator: profile.is_creator, is_verified: profile.is_verified, role: profile.role };
  const idx = state.accounts.findIndex(a => a.id === profile.id);
  if (idx >= 0) state.accounts[idx] = acc;
  else state.accounts.push(acc);
  if (state.accounts.length > 5) state.accounts = state.accounts.slice(-5);
  localStorage.setItem('sg_accounts', JSON.stringify(state.accounts));
}

window.openAccounts = function() {
  if (!state.accounts.length && state.profile) saveAccount(state.profile);
  const html = state.accounts.map(acc => {
    const isActive = state.user && acc.id === state.user.id;
    const init = (acc.display_name || '?')[0].toUpperCase();
    const badge = acc.is_creator ? renderBadge('creator') : (acc.is_verified ? renderBadge('verified') : '');
    return '<div class="acc-item ' + (isActive ? 'active' : '') + '" data-uid="' + acc.id + '">' +
      '<div class="acc-avatar">' + (acc.avatar_url ? '<img src="' + esc(acc.avatar_url) + '">' : init) + '</div>' +
      '<div class="acc-info"><div class="acc-name">' + esc(acc.display_name || '?') + badge + '</div>' +
      '<div class="acc-username">@' + esc(acc.username || '?') + (isActive ? ' · Активный' : '') + '</div></div>' +
      (isActive ? '<span class="acc-check">✓</span>' : '<span style="color:var(--t2);font-size:20px">›</span>') + '</div>';
  }).join('');
  openModal(
    '<h2>🎭 Аккаунты</h2>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:10px">Быстрое переключение (до 5)</div>' +
    (state.accounts.length ? html : '<div style="text-align:center;padding:20px;color:var(--t2)">Нет сохранённых</div>') +
    '<button onclick="window.addAccount()" class="primary" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-top:12px">➕ Добавить аккаунт</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:8px">Закрыть</button>'
  );
  document.querySelectorAll('.acc-item[data-uid]').forEach(el => {
    el.onclick = () => {
      const uid = el.dataset.uid;
      if (uid === state.user.id) { toast('Уже активный'); return; }
      window.switchAccount(uid);
    };
  });
};
window.switchAccount = function(uid) {
  if (!confirm('Переключиться?')) return;
  localStorage.setItem('sg_user_id', uid);
  toast('🔄 Переключение...');
  setTimeout(() => location.reload(), 400);
};
window.addAccount = function() {
  if (!confirm('Выйти и войти в другой?')) return;
  if (state.profile) saveAccount(state.profile);
  localStorage.removeItem('sg_user_id');
  location.reload();
};

/* ============ ПРАВИЛА ============ */
window.openRules = function() {
  openModal(
    '<h2>📜 Правила Fenix</h2>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:10px">Полный список (500 пунктов)</div>' +
    '<div class="rules-content" id="rulesContent"><div style="text-align:center;padding:20px;color:var(--t2)">Загрузка...</div></div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
  loadRules();
};

async function loadRules() {
  const el = $('rulesContent');
  if (!el) return;
  try {
    const r = await fetch('rules.json?v=22');
    if (!r.ok) throw new Error('rules.json не найден');
    const rules = await r.json();
    el.innerHTML = rules.categories.map(cat =>
      '<div class="rules-category">' +
        '<div class="rules-category-title">' + esc(cat.title) + '</div>' +
        cat.rules.map(rule => '<div class="rules-rule">' + esc(rule) + '</div>').join('') +
        (cat.punish ? '<div class="rules-punish">⚖️ Наказание: ' + esc(cat.punish) + '</div>' : '') +
      '</div>'
    ).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Ошибка: ' + esc(e.message) + '</div>';
  }
}

/* ============ ЖАЛОБЫ ============ */
window.openReportMenu = function() {
  if (!state.currentChat) return;
  const chatName = (state.currentChat.is_group || state.currentChat.is_channel) ? state.currentChat.group_name : state.currentChat.other?.display_name;
  openModal(
    '<h2>🚩 Пожаловаться</h2>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:10px">Чат: <b>' + esc(chatName || '') + '</b></div>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">Причина:</div>' +
    '<div class="tg" id="reportReason" style="margin-bottom:12px">' +
      '<button data-r="spam" class="on">📢 Спам</button>' +
      '<button data-r="abuse">😡 Оскорбление</button>' +
      '<button data-r="fraud">💰 Мошенничество</button>' +
      '<button data-r="porn">🔞 18+</button>' +
      '<button data-r="violence">💥 Насилие</button>' +
      '<button data-r="other">❓ Другое</button>' +
    '</div>' +
    '<textarea id="reportComment" rows="3" placeholder="Опиши подробнее (опционально)..."></textarea>' +
    '<button id="bSendReport" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">🚩 Отправить жалобу</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>'
  );
  let selectedReason = 'spam';
  document.querySelectorAll('#reportReason button').forEach(b => {
    b.onclick = () => {
      selectedReason = b.dataset.r;
      document.querySelectorAll('#reportReason button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
  });
  $('bSendReport').onclick = async () => {
    const comment = $('reportComment').value.trim();
    const reportedUser = state.currentChat.other?.id || (state.currentChat.is_group ? state.currentChat.created_by : null);
    const reasonMap = { spam: 'Спам', abuse: 'Оскорбление', fraud: 'Мошенничество', porn: 'Контент 18+', violence: 'Насилие', other: 'Другое' };
    try {
      await sb.from('reports').insert({
        chat_id: state.currentChat.id,
        reporter_id: state.user.id,
        reported_user_id: reportedUser,
        reason: reasonMap[selectedReason] || selectedReason,
        comment: comment || null,
        status: 'pending'
      });
      toast('🚩 Жалоба отправлена!');
      closeModal();
    } catch(e) { console.error(e); toast('Ошибка: ' + e.message); }
  };
};

/* ============ МУТ ============ */
window.adminMute = function(uid) {
  const u = state.adminUsersCache.find(x => x.id === uid);
  if (!u) return;
  const mutedUntil = u.muted_until ? new Date(u.muted_until) : null;
  const isMuted = mutedUntil && mutedUntil > new Date();

  openModal(
    '<h2>🔇 Мут @' + esc(u.username) + '</h2>' +
    (isMuted ? '<div style="background:rgba(243,156,18,.15);color:#f39c12;padding:10px;border-radius:10px;margin-bottom:12px;font-size:13px;font-weight:700">Сейчас в муте до ' + fmtTime(u.muted_until) + ' ' + fmtDate(u.muted_until) + '<br>' + (u.mute_reason ? 'Причина: ' + esc(u.mute_reason) : '') + '</div>' : '') +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">Длительность:</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px" id="muteDurations">' +
      '<button data-min="5" class="mute-dur">5 мин</button>' +
      '<button data-min="30" class="mute-dur">30 мин</button>' +
      '<button data-min="60" class="mute-dur">1 час</button>' +
      '<button data-min="360" class="mute-dur">6 часов</button>' +
      '<button data-min="1440" class="mute-dur">1 день</button>' +
      '<button data-min="4320" class="mute-dur">3 дня</button>' +
      '<button data-min="10080" class="mute-dur">7 дней</button>' +
      '<button data-min="43200" class="mute-dur">30 дней</button>' +
      '<button data-min="0" class="mute-dur" style="background:#4caf50;color:#fff">Снять</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Или своё время (минут):</div>' +
    '<input id="muteCustom" type="number" placeholder="Например: 90" style="margin-bottom:10px">' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Причина мута:</div>' +
    '<textarea id="muteReason" rows="2" placeholder="Например: Спам в чате">' + esc(u.mute_reason || '') + '</textarea>' +
    '<button id="bApplyMute" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#f39c12,#e67e22);color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">🔇 Применить</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>'
  );

  document.querySelectorAll('.mute-dur').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.mute-dur').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
      b.style.background = '#f39c12'; b.style.color = '#fff';
      $('muteCustom').value = b.dataset.min;
    };
  });

  $('bApplyMute').onclick = async () => {
    const mins = parseInt($('muteCustom').value) || 0;
    const reason = $('muteReason').value.trim();
    const until = mins === 0 ? null : new Date(Date.now() + mins * 60000).toISOString();
    try {
      await sb.from('profiles').update({
        muted_until: until,
        mute_reason: mins === 0 ? null : (reason || 'Без причины'),
        muted_by: state.user.id
      }).eq('id', uid);
      toast(mins === 0 ? '🔊 Мут снят' : '🔇 Мут на ' + mins + ' мин');
      closeModal();
      renderAdminUsers();
    } catch(e) { toast('Ошибка: ' + e.message); }
  };
};

/* ============ ВРЕМЕННЫЙ БАН ============ */
window.adminTempBan = function(uid) {
  const u = state.adminUsersCache.find(x => x.id === uid);
  if (!u) return;
  if (uid === state.user.id) { toast('Себя нельзя'); return; }

  openModal(
    '<h2>⏰ Временный бан @' + esc(u.username) + '</h2>' +
    (u.is_banned ? '<div style="background:rgba(229,57,53,.15);color:#e53935;padding:10px;border-radius:10px;margin-bottom:12px;font-size:13px;font-weight:700">Сейчас в бане<br>' + (u.ban_reason ? 'Причина: ' + esc(u.ban_reason) : '') + '</div>' : '') +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">Длительность:</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px" id="banDurations">' +
      '<button data-min="60" class="ban-dur">1 час</button>' +
      '<button data-min="360" class="ban-dur">6 часов</button>' +
      '<button data-min="1440" class="ban-dur">1 день</button>' +
      '<button data-min="4320" class="ban-dur">3 дня</button>' +
      '<button data-min="10080" class="ban-dur">7 дней</button>' +
      '<button data-min="43200" class="ban-dur">30 дней</button>' +
      '<button data-min="0" class="ban-dur" style="background:#4caf50;color:#fff">Разбан</button>' +
      '<button data-min="-1" class="ban-dur" style="background:#e53935;color:#fff">ПЕРМ</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Или своё время (минут):</div>' +
    '<input id="banCustom" type="number" placeholder="Например: 500" style="margin-bottom:10px">' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Причина бана:</div>' +
    '<textarea id="banReason" rows="2" placeholder="Например: Оскорбление администрации">' + esc(u.ban_reason || '') + '</textarea>' +
    '<button id="bApplyBan" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#e53935,#c0392b);color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">🚫 Применить бан</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>'
  );

  document.querySelectorAll('.ban-dur').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.ban-dur').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
      b.style.background = '#e53935'; b.style.color = '#fff';
      $('banCustom').value = b.dataset.min;
    };
  });

  $('bApplyBan').onclick = async () => {
    const mins = parseInt($('banCustom').value);
    const reason = $('banReason').value.trim() || 'Нарушение правил';
    if (isNaN(mins)) { toast('Выбери длительность'); return; }

    if (mins === 0) {
      try {
        await sb.from('profiles').update({ is_banned: false, ban_reason: null, banned_until: null, banned_by: null }).eq('id', uid);
        toast('✅ Разбанен');
      } catch(e) { toast('Ошибка: ' + e.message); return; }
    } else {
      const isPerm = mins === -1;
      const until = isPerm ? null : new Date(Date.now() + mins * 60000).toISOString();
      try {
        await sb.from('profiles').update({
          is_banned: true,
          ban_reason: reason + (isPerm ? ' (ПЕРМ)' : ' (' + mins + ' мин)'),
          banned_until: until,
          banned_by: state.user.id
        }).eq('id', uid);
        toast(isPerm ? '🚫 Перм-бан выдан' : '⏰ Бан на ' + mins + ' мин');
      } catch(e) { toast('Ошибка: ' + e.message); return; }
    }
    closeModal();
    renderAdminUsers();
  };
};

/* ============ БАН ПО IP / ЖЕЛЕЗУ ============ */
window.adminBanIP = async function(uid) {
  const u = state.adminUsersCache.find(x => x.id === uid);
  if (!u) return;
  const ip = prompt('Введи IP:', u.ip_address || '');
  if (!ip) return;
  const reason = prompt('Причина:', 'Нарушение') || 'Нарушение';
  const days = parseInt(prompt('Дней? (0 = навсегда)', '7')) || 7;
  const expires = days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString();
  try {
    await sb.from('bans').insert({ type: 'ip', value: ip, reason, banned_by: state.user.id, expires_at: expires, active: true });
    toast('🚫 IP забанен');
  } catch(e) { toast('Ошибка: ' + e.message); }
};

window.adminBanDevice = async function(uid) {
  const u = state.adminUsersCache.find(x => x.id === uid);
  if (!u) return;
  const deviceId = prompt('Device ID:', u.device_id || '');
  if (!deviceId) return;
  const reason = prompt('Причина:', 'Нарушение') || 'Нарушение';
  const days = parseInt(prompt('Дней? (0 = навсегда)', '7')) || 7;
  const expires = days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString();
  try {
    await sb.from('bans').insert({ type: 'device', value: deviceId, reason, banned_by: state.user.id, expires_at: expires, active: true });
    toast('🚫 Устройство забанено');
  } catch(e) { toast('Ошибка: ' + e.message); }
};

function checkMute() {
  if (!state.profile?.muted_until) return false;
  const until = new Date(state.profile.muted_until);
  if (until <= new Date()) return false;
  const left = Math.ceil((until - new Date()) / 60000);
  toast('🔇 Вы в муте. Осталось: ' + left + ' мин');
  return true;
}

function showMuteBanner() {
  let old = $('muteBanner');
  if (old) old.remove();
  if (!state.profile?.muted_until) return;
  const until = new Date(state.profile.muted_until);
  if (until <= new Date()) return;
  const banner = document.createElement('div');
  banner.id = 'muteBanner';
  banner.classList.add('show');
  const left = Math.ceil((until - new Date()) / 60000);
  banner.textContent = '🔇 Вы в муте. Осталось: ' + left + ' мин' + (state.profile.mute_reason ? ' · ' + state.profile.mute_reason : '');
  const inp = $('inp');
  if (inp && inp.parentNode) inp.parentNode.insertBefore(banner, inp);
}

/* ============ АВТОРИЗАЦИЯ ============ */
function initAuth() {
  const bL = $('bL'), bR = $('bR'), em = $('em'), pw = $('pw'), un = $('un'), err = $('AE');
  if (bL) bL.onclick = async () => {
    const email = em?.value.trim().toLowerCase();
    const username = un?.value.trim().toLowerCase().replace('@','');
    const password = pw?.value || '';
    if (err) err.textContent = '';
    let profile = null;
    if (username) { const { data } = await sb.from('profiles').select('*').eq('username', username).maybeSingle(); profile = data; }
    else if (email) { const { data } = await sb.from('profiles').select('*').eq('email', email).maybeSingle(); profile = data; }
    if (!profile) { if (err) err.textContent = 'Не найден'; return; }
    if (profile.pin_code !== password) { if (err) err.textContent = 'Неверный пароль'; return; }
    if (profile.is_banned) { showBanBanner(profile.ban_reason); if (err) err.textContent = 'Забанен'; return; }
    localStorage.setItem('sg_user_id', profile.id);
    state.user = { id: profile.id }; state.profile = profile;
    try { await sb.from('profiles').update({ device_id: getDeviceId() }).eq('id', profile.id); } catch(e) {}
    await enterApp();
  };
  if (bR) bR.onclick = async () => {
    const email = em?.value.trim().toLowerCase();
    const username = un?.value.trim().toLowerCase().replace('@','');
    const password = pw?.value || '';
    if (err) err.textContent = '';
    if (!username || !email || !password) { if (err) err.textContent = 'Заполни'; return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { if (err) err.textContent = 'Username: 3-20'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { if (err) err.textContent = 'Email'; return; }
    if (password.length < 6) { if (err) err.textContent = 'Пароль ≥ 6'; return; }
    const { data: existing } = await sb.from('profiles').select('id').or(`username.eq.${username},email.eq.${email}`).maybeSingle();
    if (existing) { if (err) err.textContent = 'Занято'; return; }
    const { data, error } = await sb.from('profiles').insert({ username, email, pin_code: password, display_name: username, bio: 'Привет, я в Fenix! 🔥', balance: 100, device_id: getDeviceId() }).select().single();
    if (error) { if (err) err.textContent = 'Ошибка: ' + error.message; return; }
    localStorage.setItem('sg_user_id', data.id);
    state.user = { id: data.id }; state.profile = data;
    await enterApp();
  };
  const bUnban = $('bTUnban');
  if (bUnban) bUnban.onclick = () => openModal('<h2>🚫 Разбан</h2><input id="unbanEmail" placeholder="Email"><textarea id="unbanMsg" rows="4" placeholder="Объясни..."></textarea><button onclick="window.sendUnban()" class="primary" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  const bContact = $('bTContact');
  if (bContact) bContact.onclick = () => openModal('<h2>💬 Связаться</h2><input id="ticketEmail" placeholder="Email"><input id="ticketSubject" placeholder="Тема"><textarea id="ticketText" rows="4" placeholder="Опиши..."></textarea><button onclick="window.sendTicket()" class="primary" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  const bAge = $('bTAge');
  if (bAge) bAge.onclick = () => { if (confirm('16+?')) { localStorage.setItem('sg_age_verified', '1'); toast('✅'); } };
}

window.sendUnban = async () => {
  const email = $('unbanEmail')?.value.trim(), msg = $('unbanMsg')?.value.trim();
  if (!email || !msg) { toast('Заполни'); return; }
  try { await sb.from('tickets').insert({ email, subject: 'Разбан', message: msg, type: 'unban', status: 'pending' }); toast('📤'); closeModal(); } catch(e) { toast('Ошибка'); }
};
window.sendTicket = async () => {
  const email = $('ticketEmail')?.value.trim(), subject = $('ticketSubject')?.value.trim(), text = $('ticketText')?.value.trim();
  if (!email || !text) { toast('Заполни'); return; }
  try { await sb.from('tickets').insert({ email, subject: subject || 'Обращение', message: text, type: 'contact', status: 'pending' }); toast('📤'); closeModal(); } catch(e) { toast('Ошибка'); }
};

async function enterApp() {
  const auth = $('A'), app = $('APP');
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'flex';
  if (isAdmin() && $('bAdm')) $('bAdm').style.display = 'flex';

  const ipBanned = await checkIPBan();
  if (ipBanned) return;
  const devBanned = await checkDeviceBan();
  if (devBanned) return;

  await refreshProfile();
  await loadChats();
  await loadStickers();
  setupRealtime();
  setupPolling();
  await new Promise(r => setTimeout(r, 200));
  renderProfileMini();
  bindButtons();
  setupFolders();
  startTypingWatch();
  setupDoubleTap();
  setupSwipeReply();
  attachTypingToInput();
  if (typeof loadStoriesBar === 'function') await loadStoriesBar();
  if (state.profile) saveAccount(state.profile);
  showMuteBanner();
  console.log('✅ Вошли в Fenix');
}

async function refreshProfile() {
  if (!state.user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  if (data) {
    state.profile = data;
    if (data.is_banned) {
      if (data.banned_until && new Date(data.banned_until) < new Date()) {
        await sb.from('profiles').update({ is_banned: false, ban_reason: null, banned_until: null }).eq('id', state.user.id);
      } else {
        showBanBanner(data.ban_reason);
        setTimeout(logout, 100);
        return;
      }
    }
    if (isAdmin() && $('bAdm')) $('bAdm').style.display = 'flex';
  }
}

function logout() {
  if (state.realtimeChats) sb.removeChannel(state.realtimeChats);
  if (state.realtimeMsgs) sb.removeChannel(state.realtimeMsgs);
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.typingWatchTimer) clearInterval(state.typingWatchTimer);
  localStorage.removeItem('sg_user_id');
  location.reload();
}
window.logout = logout;

function setupRealtime() {
  state.realtimeChats = sb.channel('rt-chats-' + state.user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => { loadChats(); }).subscribe();
  state.realtimeMsgs = sb.channel('rt-msgs-' + state.user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
    if (state.currentChat && payload.new && String(payload.new.chat_id) === String(state.currentChat.id)) loadMessages();
    else loadChats();
  }).subscribe();
}

function setupPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  let lastKey = null;
  state.pollTimer = setInterval(async () => {
    if (!state.user || !state.currentChat) return;
    const { data } = await sb.from('messages').select('id,created_at').eq('chat_id', state.currentChat.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const key = data ? data.id + ':' + data.created_at : null;
    if (key !== lastKey) { lastKey = key; loadMessages(); }
  }, 2000);
}

function setupFolders() {
  document.querySelectorAll('.folder-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.folder-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      state.currentFolder = b.dataset.folder;
      renderChats();
    };
  });
}

function renderProfileMini() {
  const p = state.profile;
  if (!p || !$('myA')) return;
  const init = (p.display_name || '?')[0].toUpperCase();
  if (p.avatar_url) { $('myA').innerHTML = '<img src="' + esc(p.avatar_url) + '" alt="">'; $('myA').style.background = 'transparent'; }
  else $('myA').innerHTML = init;
}

async function loadChats() {
  if (!state.user) return;
  const uid = state.user.id;
  const { data: chats, error } = await sb.from('chats').select('*').or(`user1.eq.${uid},user2.eq.${uid},created_by.eq.${uid}`).order('id', { ascending: false }).limit(150);
  if (error) { console.error(error); return; }
  const list = [];
  for (const c of (chats || [])) {
    if (c.is_group || c.is_channel || c.is_secret) { list.push(c); continue; }
    const otherId = c.user1 === uid ? c.user2 : c.user1;
    if (!otherId || otherId === uid) continue;
    const { data: prof } = await sb.from('profiles').select('*').eq('id', otherId).maybeSingle();
    list.push({ ...c, other: prof });
  }
  state.chats = list;
  renderChats();
}

function renderChats() {
  const el = $('chats');
  if (!el) return;
  let list = state.chats;
  if (state.currentFolder !== 'all') {
    list = state.chats.filter(c => {
      if (state.currentFolder === 'personal') return !c.is_group && !c.is_channel && !c.is_secret;
      if (state.currentFolder === 'groups') return c.is_group;
      if (state.currentFolder === 'channels') return c.is_channel;
      if (state.currentFolder === 'bots') return c.other?.is_bot_verified;
      return true;
    });
  }
  if (!list.length) { el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--t2);font-size:14px">💬 Нет чатов<br><br>Нажми 💬 чтобы начать</div>'; return; }
  el.innerHTML = list.map(c => {
    const name = (c.is_group || c.is_channel) ? (c.group_name || 'Без названия') : (c.other?.display_name || 'Юзер');
    const initial = (name[0] || '?').toUpperCase();
    const avatar = c.group_avatar || c.other?.avatar_url;
    const emoji = c.is_channel ? '📢' : c.is_group ? '👥' : c.is_secret ? '🔒' : '';
    const last = c.last_message || 'Нет сообщений';
    const badge = c.other ? userBadgeHtml(c.other) : '';
    const otherUid = c.other?.id || '';
    return '<div class="ch" data-id="' + c.id + '">' +
      '<div class="cv" data-uid="' + otherUid + '" onclick="event.stopPropagation();if(this.dataset.uid)window.viewUserProfile(this.dataset.uid)">' +
        (avatar ? '<img src="' + esc(avatar) + '">' : initial) + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:5px">' + esc(name) + ' ' + emoji + ' ' + badge + '</div>' +
      '<div style="color:var(--t2);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(last) + '</div></div></div>';
  }).join('');
  el.querySelectorAll('.ch').forEach(item => item.onclick = () => openChat(item.dataset.id));
}

async function openChat(chatId) {
  const chat = state.chats.find(c => String(c.id) === String(chatId));
  if (!chat) return;
  state.currentChat = chat;
  state.replyTo = null;
  const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp'), ar = $('AR');
  if (ch) { ch.style.display = 'flex'; ch.classList.add('active'); }
  if (msgs) { msgs.style.display = 'flex'; msgs.classList.add('active'); }
  if (inp) { inp.style.display = 'flex'; inp.classList.add('active'); }
  if (emp) emp.style.display = 'none';
  if (ar) ar.classList.add('active');
  const name = (chat.is_group || chat.is_channel) ? (chat.group_name || 'Группа') : (chat.other?.display_name || 'Юзер');
  if ($('hN')) { let badgeHtml = chat.other ? userBadgeHtml(chat.other) : ''; $('hN').innerHTML = esc(name) + badgeHtml; }
  if ($('hS')) {
    if (chat.is_channel) $('hS').textContent = 'канал';
    else if (chat.is_group) $('hS').textContent = 'группа';
    else $('hS').textContent = 'был(а) недавно';
  }
  const initial = (name[0] || '?').toUpperCase();
  const avatar = chat.group_avatar || chat.other?.avatar_url;
  if ($('hA')) {
    $('hA').innerHTML = avatar ? '<img src="' + esc(avatar) + '">' : initial;
    $('hA').style.cursor = 'pointer';
    if (chat.other?.id) $('hA').onclick = () => window.viewUserProfile(chat.other.id);
  }
  await loadMessages();
  await markMessagesRead();
  const draft = localStorage.getItem('sg_draft_' + chat.id);
  if (draft && $('msgI')) $('msgI').value = draft;
}

function back() {
  const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp'), ar = $('AR');
  if (ch) { ch.style.display = 'none'; ch.classList.remove('active'); }
  if (msgs) { msgs.style.display = 'none'; msgs.classList.remove('active'); }
  if (inp) { inp.style.display = 'none'; inp.classList.remove('active'); }
  if (emp) emp.style.display = 'flex';
  if (ar) ar.classList.remove('active');
  state.currentChat = null;
  state.replyTo = null;
}
window.back = back;

async function loadMessages() {
  if (!state.currentChat) return;
  const { data, error } = await sb.from('messages').select('*').eq('chat_id', state.currentChat.id).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(200);
  if (error) { console.error(error); return; }
  state.messages = sortMessages(data || []);
  renderMessages();
}

function renderMessages() {
  const el = $('msgs');
  if (!el) return;
  const sorted = sortMessages(state.messages);
  if (!sorted.length) { el.innerHTML = '<div style="text-align:center;color:var(--t2);padding:40px;font-size:13px">Пока нет сообщений ✨</div>'; return; }
  let lastDate = '';
  el.innerHTML = sorted.map(m => {
    const own = m.sender === state.user.id;
    const time = fmtTime(m.created_at);
    const dateKey = fmtDateFull(m.created_at);
    let dateSep = '';
    if (dateKey !== lastDate) { dateSep = '<div style="text-align:center;color:var(--t2);font-size:11px;padding:12px 0;font-weight:600">' + dateKey + '</div>'; lastDate = dateKey; }
    let content = '';
    if (m.deleted) content = '<i style="opacity:.6">сообщение удалено</i>';
    else {
      if (m.file_url) {
        const ft = m.file_type || '';
        if (ft.indexOf('image') === 0) content += '<img src="' + esc(m.file_url) + '" class="msg-media" onclick="window.openImage(\'' + esc(m.file_url) + '\')">';
        else if (ft.indexOf('video') === 0) content += '<video src="' + esc(m.file_url) + '" controls class="msg-media"></video>';
        else if (m.is_voice) content += '<audio src="' + esc(m.file_url) + '" controls></audio>';
        else content += '<a href="' + esc(m.file_url) + '" target="_blank">📎 ' + esc(m.file_name || 'Файл') + '</a>';
      }
      if (m.text) content += '<div style="white-space:pre-wrap">' + esc(m.text) + '</div>';
    }
    let reactionsHtml = '';
    const reactions = m.reactions || {};
    const keys = Object.keys(reactions).filter(k => reactions[k]?.length);
    if (keys.length) reactionsHtml = '<div class="reactions">' + keys.map(k => '<span onclick="window.toggleReaction(\'' + m.id + '\',\'' + k + '\')">' + k + ' ' + reactions[k].length + '</span>').join('') + '</div>';
    let replyHtml = '';
    if (m.reply_to) {
      const rep = sorted.find(x => String(x.id) === String(m.reply_to));
      if (rep) replyHtml = '<div style="border-left:2px solid ' + (own ? '#fff' : '#ff6b35') + ';padding:2px 8px;margin-bottom:4px;font-size:12px;opacity:.85">' + esc((rep.text || '[медиа]').slice(0,50)) + '</div>';
    }
    const showSender = !own && (state.currentChat.is_group || state.currentChat.is_channel);
    return dateSep + '<div class="m ' + (own ? 'me' : 'you') + '" data-id="' + m.id + '">' +
      (showSender ? '<div style="font-size:12px;font-weight:700;color:#ff6b35;margin-bottom:2px">' + esc(m.sender_name || 'Юзер') + '</div>' : '') +
      replyHtml + content + reactionsHtml +
      '<span class="msg-time">' + time + '</span></div>';
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
  if (checkMute()) return;
  inp.value = '';
  localStorage.removeItem('sg_draft_' + state.currentChat.id);
  const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, text, is_read: false, deleted: false };
  if (state.replyTo) { payload.reply_to = state.replyTo.id; cancelRep(); }
  if (state.burnAfter > 0) payload.burn_after = state.burnAfter;
  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
  if (error) { toast('Ошибка: ' + error.message); return; }
  await sb.from('chats').update({ last_message: text.slice(0, 80) }).eq('id', state.currentChat.id);
  await loadMessages();
  if (state.profile) {
    const newXp = (state.profile.xp || 0) + 1;
    const newLevel = Math.min(999, Math.floor(newXp / 500) + 1);
    if (newLevel > (state.profile.level || 1)) { state.profile.level = newLevel; toast('🎉 Уровень ' + newLevel + '!'); }
    state.profile.xp = newXp;
    state.profile.messages_count = (state.profile.messages_count || 0) + 1;
    try { await sb.from('profiles').update({ xp: newXp, level: newLevel, messages_count: state.profile.messages_count }).eq('id', state.user.id); } catch(e) {}
  }
}
window.sendMessage = sendMessage;

function cancelRep() { state.replyTo = null; const rp = $('rP'); if (rp) { rp.style.display = 'none'; rp.classList.remove('active'); } }
window.cancelRep = cancelRep;

window.toggleReaction = async (msgId, emoji) => {
  const { data: m } = await sb.from('messages').select('reactions').eq('id', msgId).single();
  if (!m) return;
  const reactions = m.reactions || {};
  reactions[emoji] = reactions[emoji] || [];
  const uid = state.user.id;
  if (reactions[emoji].indexOf(uid) !== -1) { reactions[emoji] = reactions[emoji].filter(x => x !== uid); if (!reactions[emoji].length) delete reactions[emoji]; }
  else reactions[emoji].push(uid);
  await sb.from('messages').update({ reactions }).eq('id', msgId);
  await loadMessages();
};

async function sendFile(file) {
  if (!state.currentChat || !file) return;
  toast('Загрузка...');
  try {
    const url = await uploadFile('files', file, 'chat_' + state.currentChat.id);
    const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, file_url: url, file_type: file.type || 'application/octet-stream', file_name: file.name, is_read: false, deleted: false };
    let { error } = await sb.from('messages').insert(payload);
    if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
    if (error) { toast('Ошибка'); return; }
    await sb.from('chats').update({ last_message: '📎 ' + (file.name || 'файл') }).eq('id', state.currentChat.id);
    await loadMessages();
    toast('Отправлено ✅');
  } catch (e) { toast('Ошибка: ' + e.message); }
}

async function loadStickers() {
  const { data } = await sb.from('stickers').select('*').limit(100);
  state.stickers = data || [];
}
/* ============================================================
   Часть 2: Профиль, Настройки, Сторис, Лента, Магазин, Бот, Админка, bindButtons, main
   ============================================================ */

const EMOJI_STATUSES = ['😀','😎','🤔','😴','🥳','😭','❤️','🔥','🚀','⭐','💯','🙏','👀','💀','🤡','🎮','📚','🎧','☕','🍕'];

// ============ ПРОФИЛЬ СВОЙ ============
function showProf() {
  const p = state.profile;
  if (!p) return;
  const initial = (p.display_name || '?')[0].toUpperCase();
  let badgesHtml = '';
  if (p.is_creator) badgesHtml += '<span class="badge-pill creator">👑 Создатель</span>';
  if (p.role === 'admin') badgesHtml += '<span class="badge-pill admin">⚡ Админ</span>';
  if (p.is_verified) badgesHtml += '<span class="badge-pill verified">✅ Верифицирован</span>';
  if (p.is_plus) badgesHtml += '<span class="badge-pill plus">⭐ Plus</span>';
  if (p.is_youtuber) badgesHtml += '<span class="badge-pill youtuber">▶️ YouTuber</span>';

  openModal(
    '<div style="text-align:center">' +
      '<div class="profile-avatar-big" style="position:relative;cursor:pointer" onclick="document.getElementById(\'avatarInput\').click()">' +
        (p.avatar_url ? '<img src="' + esc(p.avatar_url) + '">' : initial) +
        '<div style="position:absolute;bottom:0;right:0;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ff6b35,#ffd700);display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid var(--p)">📷</div>' +
      '</div>' +
      '<input type="file" id="avatarInput" accept="image/*" style="display:none">' +
      '<div style="font-size:22px;font-weight:800;margin-top:12px">' + esc(p.display_name || '') + '</div>' +
      '<div style="color:var(--t2);font-size:13px;margin-top:4px">@' + esc(p.username || '') + ' ' + (p.emoji_status || '') + '</div>' +
      (badgesHtml ? '<div class="profile-badges">' + badgesHtml + '</div>' : '') +
    '</div>' +
    '<div class="profile-stats-grid">' +
      '<div class="stat-box"><div class="sb-value">' + (p.balance || 0) + '</div><div class="sb-label">💰 SG</div></div>' +
      '<div class="stat-box"><div class="sb-value">' + (p.level || 1) + '</div><div class="sb-label">🎯 Lvl</div></div>' +
      '<div class="stat-box"><div class="sb-value">' + (p.messages_count || 0) + '</div><div class="sb-label">💬 Msgs</div></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Имя</div>' +
    '<input id="pN" value="' + esc(p.display_name || '') + '">' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">О себе</div>' +
    '<textarea id="pB" rows="2" maxlength="200">' + esc(p.bio || '') + '</textarea>' +
    '<div style="font-size:12px;color:var(--t2);margin-bottom:6px">Эмодзи-статус</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px" id="emSt">' +
      EMOJI_STATUSES.map(e => '<button data-e="' + e + '" style="font-size:22px;padding:4px 8px;border-radius:10px;background:' + (p.emoji_status === e ? 'var(--a)' : 'var(--p2)') + ';border:none;cursor:pointer">' + e + '</button>').join('') +
    '</div>' +
    '<button id="bSaveP" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;font-size:15px;border:none;cursor:pointer;margin-bottom:12px">💾 Сохранить</button>' +
    '<div class="settings-section-title">ПРОФИЛЬ</div>' +
    '<button class="settings-item" onclick="window.openBalance()"><span class="si-icon" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff">💰</span><div class="si-body"><div class="si-title">Баланс</div><div class="si-sub">' + (p.balance || 0) + ' SG</div></div><span class="si-arrow">›</span></button>' +
    '<button class="settings-item" onclick="window.openShop()"><span class="si-icon" style="background:linear-gradient(135deg,#f39c12,#e67e22);color:#fff">🛒</span><div class="si-body"><div class="si-title">Магазин</div></div><span class="si-arrow">›</span></button>' +
    '<button class="settings-item" onclick="window.openPromo()"><span class="si-icon" style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000">🎁</span><div class="si-body"><div class="si-title">Промокод</div></div><span class="si-arrow">›</span></button>' +
    '<button class="settings-item" onclick="window.openVerification()"><span class="si-icon" style="background:linear-gradient(135deg,#2196f3,#00bcd4);color:#fff">✅</span><div class="si-body"><div class="si-title">Верификация</div></div><span class="si-arrow">›</span></button>' +
    '<button class="settings-item" onclick="window.openQR()"><span class="si-icon" style="background:var(--p2)">📱</span><div class="si-body"><div class="si-title">QR-код</div></div><span class="si-arrow">›</span></button>' +
    '<button class="dg" onclick="window.logout()" style="width:100%;padding:13px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;font-size:14px;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-top:16px">🚪 Выйти</button>' +
    '<button class="gh" onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:6px">Закрыть</button>'
  );

  let selectedEmoji = p.emoji_status || '';
  document.querySelectorAll('#emSt button').forEach(b => {
    b.onclick = () => {
      selectedEmoji = b.dataset.e === selectedEmoji ? '' : b.dataset.e;
      document.querySelectorAll('#emSt button').forEach(x => x.style.background = 'var(--p2)');
      if (selectedEmoji) b.style.background = 'var(--a)';
    };
  });

  const avatarInp = $('avatarInput');
  if (avatarInp) {
    avatarInp.onchange = async () => {
      const f = avatarInp.files[0];
      if (!f) return;
      toast('📤 Загрузка...');
      try {
        const url = await uploadFile('avatars', f, state.user.id);
        await sb.from('profiles').update({ avatar_url: url }).eq('id', state.user.id);
        await refreshProfile();
        renderProfileMini();
        saveAccount(state.profile);
        toast('✅ Аватарка обновлена!');
        closeModal();
        showProf();
      } catch(e) { toast('❌ ' + e.message); }
    };
  }

  $('bSaveP').onclick = async () => {
    const updates = { display_name: $('pN').value.trim() || p.display_name, bio: $('pB').value.trim(), emoji_status: selectedEmoji || null };
    const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { toast('Ошибка'); return; }
    await refreshProfile();
    renderProfileMini();
    saveAccount(state.profile);
    toast('Сохранено ✅');
    closeModal();
  };
}
window.showProf = showProf;

// ============ ПРОСМОТР ЧУЖОГО ПРОФИЛЯ ============
window.viewUserProfile = async function(userId) {
  if (!userId) return;
  if (userId === state.user.id) { showProf(); return; }
  const { data: u } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!u) { toast('Профиль не найден'); return; }
  const initial = (u.display_name || '?')[0].toUpperCase();
  let badgesHtml = '';
  if (u.is_creator) badgesHtml += '<span class="badge-pill creator">👑 Создатель</span>';
  if (u.role === 'admin') badgesHtml += '<span class="badge-pill admin">⚡ Админ</span>';
  if (u.is_verified) badgesHtml += '<span class="badge-pill verified">✅ Верифицирован</span>';
  if (u.is_plus) badgesHtml += '<span class="badge-pill plus">⭐ Plus</span>';
  if (u.is_youtuber) badgesHtml += '<span class="badge-pill youtuber">▶️ YouTuber</span>';
  const { data: existing } = await sb.from('chats').select('*').or(`and(user1.eq.${state.user.id},user2.eq.${userId}),and(user1.eq.${userId},user2.eq.${state.user.id})`).maybeSingle();
  openModal(
    '<div style="text-align:center">' +
      '<div class="profile-avatar-big">' + (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '">' : initial) + '</div>' +
      '<div style="font-size:22px;font-weight:800;margin-top:12px">' + esc(u.display_name || '') + '</div>' +
      '<div style="color:var(--t2);font-size:13px;margin-top:4px">@' + esc(u.username || '') + ' ' + (u.emoji_status || '') + '</div>' +
      (badgesHtml ? '<div class="profile-badges">' + badgesHtml + '</div>' : '') +
      (u.bio ? '<div style="font-size:13px;color:var(--t2);margin-top:10px;padding:0 20px;line-height:1.5">' + esc(u.bio) + '</div>' : '') +
    '</div>' +
    '<div class="profile-stats-grid">' +
      '<div class="stat-box"><div class="sb-value">' + (u.level || 1) + '</div><div class="sb-label">🎯 Lvl</div></div>' +
      '<div class="stat-box"><div class="sb-value">' + (u.messages_count || 0) + '</div><div class="sb-label">💬 Msgs</div></div>' +
      '<div class="stat-box"><div class="sb-value">' + fmtDate(u.created_at).slice(0, 5) + '</div><div class="sb-label">📅 Рег</div></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button onclick="window.startChatFromProfile(\'' + userId + '\')" class="primary" style="flex:1;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer">' + (existing ? '💬 Открыть чат' : '💬 Написать') + '</button>' +
      '<button onclick="window.closeModal()" class="gh" style="flex:1;padding:13px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:700;border:none;cursor:pointer">Закрыть</button>' +
    '</div>' +
    (isAdmin() ? '<button onclick="window.closeModal();window.adminMute(\'' + userId + '\')" style="width:100%;padding:11px;border-radius:12px;background:#f39c12;color:#fff;font-weight:700;border:none;cursor:pointer;margin-top:8px">🔇 Мут</button>' : '') +
    (isAdmin() ? '<button onclick="window.closeModal();window.adminTempBan(\'' + userId + '\')" style="width:100%;padding:11px;border-radius:12px;background:#e53935;color:#fff;font-weight:700;border:none;cursor:pointer;margin-top:8px">🚫 Бан</button>' : '')
  );
};

window.startChatFromProfile = async function(userId) {
  closeModal();
  await window.startChatWith(userId);
};

window.openQRof = function(username) {
  const url = location.origin + '?u=' + username;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url);
  openModal('<h2 style="text-align:center">📱 QR @' + esc(username) + '</h2><div style="background:#fff;padding:16px;border-radius:16px;display:flex;justify-content:center;margin-bottom:14px"><img src="' + qrUrl + '" style="width:100%;max-width:250px;display:block"></div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button>');
};

// ============ НАСТРОЙКИ ============
window.openSettings = function() {
  const s = state.settings;
  openModal(
    '<h2>⚙️ Настройки</h2>' +
    '<div class="settings-section-title">ВНЕШНИЙ ВИД</div>' +
    '<button class="settings-item" onclick="window.openThemePicker()"><span class="si-icon" style="background:linear-gradient(135deg,#ff6b35,#ffd700)">🎨</span><div class="si-body"><div class="si-title">Тема</div><div class="si-sub">' + s.theme + ' · ' + (s.mode === 'light' ? 'Светлая' : 'Тёмная') + '</div></div><span class="si-arrow">›</span></button>' +
    '<div class="settings-section-title">УВЕДОМЛЕНИЯ</div>' +
    toggleRowTg('cbSound', '🔊', 'Звук', 'Сообщений', s.sound) +
    toggleRowTg('cbVib', '📳', 'Вибрация', 'При сообщениях', s.vibrate) +
    '<div class="settings-section-title">ЧАТЫ</div>' +
    toggleRowTg('cbRead', '✓✓', 'Прочтение', '', s.readReceipts) +
    toggleRowTg('cbEnter', '⌨️', 'Enter = отправить', '', s.enterSend) +
    toggleRowTg('cbTyping', '⌨️', 'Показывать «печатает»', '', s.showTyping) +
    '<button class="gh" onclick="window.closeModal()" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer;margin-top:16px">Закрыть</button>'
  );
  bindToggleTg('cbSound', v => { state.settings.sound = v; localStorage.setItem('sg_sound', v ? '1' : '0'); });
  bindToggleTg('cbVib', v => { state.settings.vibrate = v; localStorage.setItem('sg_vibrate', v ? '1' : '0'); });
  bindToggleTg('cbRead', v => { state.settings.readReceipts = v; localStorage.setItem('sg_read', v ? '1' : '0'); });
  bindToggleTg('cbEnter', v => { state.settings.enterSend = v; localStorage.setItem('sg_enter', v ? '1' : '0'); });
  bindToggleTg('cbTyping', v => { state.settings.showTyping = v; localStorage.setItem('sg_typing', v ? '1' : '0'); });
};

function toggleRowTg(id, icon, label, sub, checked) {
  return '<div class="settings-toggle"><div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">' + icon + '</span><div><div class="st-label">' + label + '</div><div class="st-sub">' + sub + '</div></div></div><label class="sw"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '><span class="slider"></span></label></div>';
}
function bindToggleTg(id, cb) { const el = $(id); if (!el) return; el.onchange = () => cb(el.checked); }

window.openThemePicker = function() {
  const s = state.settings;
  const themes = ['midnight','purple','ocean','sunset','rose','forest','cyber','mono'];
  openModal(
    '<h2>🎨 Тема</h2>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px" id="themeGrid">' +
      themes.map(t => '<button data-th="' + t + '" style="padding:10px;border-radius:10px;background:var(--p2);border:2px solid ' + (s.theme === t ? '#ff6b35' : 'transparent') + ';color:var(--t);font-size:11px;font-weight:600;cursor:pointer">' + t + '</button>').join('') +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:14px">' +
      '<button data-m="dark" style="flex:1;padding:10px;border-radius:10px;background:' + (s.mode === 'dark' ? 'linear-gradient(135deg,#ff6b35,#ffd700)' : 'var(--p2)') + ';color:' + (s.mode === 'dark' ? '#000' : 'var(--t)') + ';font-weight:600;border:none;cursor:pointer">🌙 Тёмный</button>' +
      '<button data-m="light" style="flex:1;padding:10px;border-radius:10px;background:' + (s.mode === 'light' ? 'linear-gradient(135deg,#ff6b35,#ffd700)' : 'var(--p2)') + ';color:' + (s.mode === 'light' ? '#000' : 'var(--t)') + ';font-weight:600;border:none;cursor:pointer">☀️ Светлый</button>' +
    '</div>' +
    '<button onclick="window.openSettings()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">← Назад</button>'
  );
  document.querySelectorAll('#themeGrid button').forEach(b => b.onclick = () => {
    state.settings.theme = b.dataset.th;
    applyTheme(b.dataset.th);
    document.querySelectorAll('#themeGrid button').forEach(x => x.style.border = '2px solid transparent');
    b.style.border = '2px solid #ff6b35';
  });
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    state.settings.mode = b.dataset.m;
    applyMode(b.dataset.m);
    document.querySelectorAll('[data-m]').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'linear-gradient(135deg,#ff6b35,#ffd700)'; b.style.color = '#000';
  });
};

// ============ БАЛАНС ============
window.openBalance = async () => {
  let logs = [];
  try { const r = await sb.from('balance_log').select('*').eq('user_id', state.user.id).order('id', { ascending: false }).limit(30); logs = r.data || []; } catch(e) {}
  openModal(
    '<h2>💰 Баланс: ' + (state.profile.balance || 0) + ' SG</h2>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      (logs.length ? logs.map(l => '<div style="padding:10px;border-bottom:1px solid var(--br);display:flex;justify-content:space-between"><div style="font-size:13px">' + esc(l.reason || 'Начисление') + '</div><b style="color:' + (l.amount > 0 ? '#4caf50' : '#e53935') + '">' + (l.amount > 0 ? '+' : '') + l.amount + '</b></div>').join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Нет транзакций</div>') +
    '</div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

// ============ ПРОМОКОД ============
window.openPromo = () => {
  openModal(
    '<h2>🎁 Промокод</h2>' +
    '<input id="promoI" placeholder="КОД" style="text-transform:uppercase;text-align:center;font-weight:700;letter-spacing:2px;font-size:16px">' +
    '<div id="promoS" style="font-size:12px;text-align:center;min-height:16px;margin-bottom:8px"></div>' +
    '<button id="bActP" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">🎁 Активировать</button>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button>'
  );
  $('bActP').onclick = async () => {
    const code = $('promoI').value.trim().toUpperCase();
    if (!code) return;
    const s = $('promoS'); s.textContent = 'Проверка...';
    const { data: promo } = await sb.from('promocodes').select('*').eq('code', code).maybeSingle();
    if (!promo) { s.textContent = '❌ Не найден'; s.style.color = '#e53935'; return; }
    if (promo.uses >= promo.max_uses) { s.textContent = '❌ Исчерпан'; s.style.color = '#e53935'; return; }
    const updates = {};
    if (promo.bonus_coins) updates.balance = (state.profile.balance || 0) + promo.bonus_coins;
    if (promo.days) { const u = new Date(); u.setDate(u.getDate() + promo.days); updates.is_plus = true; updates.plus_until = u.toISOString(); }
    const { error } = await sb.from('profiles').update(updates).eq('id', state.user.id);
    if (error) { s.textContent = '❌ ' + error.message; s.style.color = '#e53935'; return; }
    try { await sb.from('promocodes').update({ uses: (promo.uses || 0) + 1 }).eq('id', promo.id); } catch(e) {}
    if (promo.bonus_coins) { try { await sb.from('balance_log').insert({ user_id: state.user.id, amount: promo.bonus_coins, reason: 'Промокод ' + code }); } catch(e) {} }
    await refreshProfile();
    s.textContent = '✅ Активирован!'; s.style.color = '#4caf50';
    toast('🎉 Промокод активирован!');
    setTimeout(() => closeModal(), 1200);
  };
};

// ============ МАГАЗИН ============
window.openShop = async () => {
  let items = [];
  try { const r = await sb.from('shop_items').select('*').limit(50); items = r.data || []; } catch(e) {}
  openModal(
    '<h2>🛒 Магазин</h2>' +
    '<div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:12px;padding:12px;text-align:center;font-weight:700;margin-bottom:14px">💰 ' + (state.profile.balance || 0) + ' SG</div>' +
    '<div style="max-height:400px;overflow-y:auto">' +
      (items.length ? items.map(i => '<div style="padding:12px;background:var(--p2);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:24px">' + (i.icon || '🎁') + '</span><div><div style="font-weight:700;font-size:14px">' + esc(i.name) + '</div><div style="font-size:11px;color:var(--t2)">' + esc(i.category || '') + '</div></div></div><button onclick="window.buyItem(\'' + i.id + '\')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;border:none;cursor:pointer">' + i.price + ' SG</button></div>').join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Магазин пуст 😢</div>') +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};

window.buyItem = async (itemId) => {
  const { data: item } = await sb.from('shop_items').select('*').eq('id', itemId).single();
  if (!item) return;
  if ((state.profile.balance || 0) < item.price) { toast('❌ Мало SG'); return; }
  try {
    await sb.from('profiles').update({ balance: state.profile.balance - item.price }).eq('id', state.user.id);
    try { await sb.from('user_purchases').insert({ user_id: state.user.id, item_id: itemId }); } catch(e) {}
    try { await sb.from('balance_log').insert({ user_id: state.user.id, amount: -item.price, reason: 'Покупка: ' + item.name }); } catch(e) {}
    await refreshProfile();
    toast('✅ Куплено!');
    window.openShop();
  } catch(e) { toast('Ошибка'); }
};

// ============ MUSOR DROP ============
window.openMusorDrop = function() {
  openModal(
    '<h2 style="text-align:center">🎰 Musor Drop</h2>' +
    '<div id="mdGame" style="text-align:center">' +
      '<div style="background:linear-gradient(135deg,#ff6b35,#ffd700);border-radius:20px;padding:30px 20px;margin-bottom:14px"><div style="font-size:64px" id="mdEmoji">🎰</div><div style="font-size:20px;font-weight:800;color:#000;margin-top:10px" id="mdResult">Готов?</div><div style="font-size:14px;color:rgba(0,0,0,.6);margin-top:6px" id="mdBalance">💰 ' + (state.profile.balance || 0) + ' SG</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">' +
        '<button onclick="window.mdSpin(50)" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#4a9eff,#2b5278);color:#fff;font-weight:700;border:none;cursor:pointer">50 SG</button>' +
        '<button onclick="window.mdSpin(200)" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#f39c12,#e67e22);color:#fff;font-weight:700;border:none;cursor:pointer">200 SG</button>' +
        '<button onclick="window.mdSpin(500)" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;font-weight:700;border:none;cursor:pointer">500 SG</button>' +
        '<button onclick="window.mdSpin(1000)" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#9c27b0,#7b1fa2);color:#fff;font-weight:700;border:none;cursor:pointer">1000 SG</button>' +
      '</div>' +
    '</div>' +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>'
  );
};
window.mdSpin = async function(bet) {
  const balance = state.profile.balance || 0;
  if (balance < bet) { toast('❌ Мало SG'); return; }
  const emojiEl = $('mdEmoji'), resultEl = $('mdResult');
  if (!emojiEl || !resultEl) return;
  emojiEl.textContent = '🎰'; resultEl.textContent = 'Крутим...';
  const emojis = ['🎰','🔥','💎','⭐','🎲','🎯'];
  let spins = 0;
  const intv = setInterval(() => {
    emojiEl.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    spins++;
    if (spins > 15) { clearInterval(intv); finishSpin(bet, resultEl, emojiEl); }
  }, 80);
};
async function finishSpin(bet, resultEl, emojiEl) {
  const roll = Math.random();
  let newBal = state.profile.balance || 0, txt = '', emo = '', reason = '', change = 0;
  if (roll < 0.05) { change = bet * 20; newBal = newBal - bet + change; txt = '🎉 ДЖЕКПОТ! +' + change + ' SG'; emo = '💎'; reason = 'Musor Drop 🎉 JACKPOT ×20'; }
  else if (roll < 0.45) { const m = [2,3,5,10][Math.floor(Math.random()*4)]; change = bet * m - bet; newBal = newBal - bet + (bet * m); txt = '✅ Победа! ×' + m + ' (+' + change + ')'; emo = '⭐'; reason = 'Musor Drop ✅ Win ×' + m; }
  else if (roll < 0.85) { newBal = newBal - bet; change = -bet; txt = '❌ Мимо... −' + bet + ' SG'; emo = '💀'; reason = 'Musor Drop ❌ Lose'; }
  else { newBal = 0; change = -(state.profile.balance || 0); txt = '💥 ВСЁ ОТВАЛИЛОСЬ!'; emo = '☠️'; reason = 'Musor Drop 💥 CRASH'; }
  newBal = Math.max(0, Math.floor(newBal));
  change = Math.round(change);
  try {
    await sb.from('profiles').update({ balance: newBal }).eq('id', state.user.id);
    await sb.from('balance_log').insert({ user_id: state.user.id, amount: change, reason });
    state.profile.balance = newBal;
    resultEl.textContent = txt;
    emojiEl.textContent = emo;
    const balEl = $('mdBalance'); if (balEl) balEl.textContent = '💰 ' + newBal + ' SG';
    if (navigator.vibrate) navigator.vibrate(change > 0 ? [30,50,30] : 100);
    toast(change > 0 ? '🎉 +' + change : (newBal === 0 ? '💥 Всё!' : '😢 ' + change));
  } catch(e) { toast('Ошибка'); }
}

// ============ QR ============
window.openQR = () => {
  const url = location.origin + '?u=' + state.profile.username;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url);
  openModal('<h2 style="text-align:center">📱 QR</h2><div style="background:#fff;padding:16px;border-radius:16px;display:flex;justify-content:center;margin-bottom:14px"><img src="' + qrUrl + '" style="width:100%;max-width:250px;display:block"></div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button>');
};

// ============ СТОРИС ============
async function loadStoriesBar() {
  const bar = $('sBar'); if (!bar) return;
  let stories = [];
  try { const r = await sb.from('stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100); stories = r.data || []; } catch(e) {}
  const byUser = {};
  stories.forEach(s => { if (!byUser[s.user_id]) byUser[s.user_id] = []; byUser[s.user_id].push(s); });
  const uids = Object.keys(byUser);
  if (!uids.length) { bar.innerHTML = ''; return; }
  const authors = {};
  try { const r = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', uids); (r.data || []).forEach(p => authors[p.id] = p); } catch(e) {}
  let html = '';
  if (canPostStories()) html += '<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" onclick="window.addStory()"><div class="story-circle"><div class="story-circle-inner" style="font-size:28px;color:#ff6b35">＋</div></div><div class="story-label">Статус</div></div>';
  uids.forEach(uid => {
    const a = authors[uid], latest = byUser[uid][0];
    const init = (a?.display_name || '?')[0].toUpperCase();
    html += '<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" onclick="window.viewStory(\'' + latest.id + '\')"><div class="story-circle"><div class="story-circle-inner">' + (latest.media_url ? '<img src="' + esc(latest.media_url) + '">' : (a?.avatar_url ? '<img src="' + esc(a.avatar_url) + '">' : '<span style="font-size:22px">' + init + '</span>')) + '</div></div><div class="story-label">' + esc(a?.display_name || '?') + '</div></div>';
  });
  bar.innerHTML = html;
}
window.addStory = () => {
  if (!canPostStories()) { toast('⭐ Только Plus'); return; }
  openModal('<h2>📸 Статус</h2><input type="file" id="storyFile" accept="image/*,video/*" style="width:100%;margin-bottom:10px"><textarea id="storyText" placeholder="Текст" rows="2"></textarea><button id="bPubStory" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">📸 Опубликовать</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  $('bPubStory').onclick = async () => {
    const file = $('storyFile').files[0], text = $('storyText').value.trim();
    if (!file && !text) { toast('Добавь фото'); return; }
    let mediaUrl = null, mediaType = 'text';
    if (file) { try { mediaUrl = await uploadFile('stories', file, state.user.id); mediaType = file.type.indexOf('video') === 0 ? 'video' : 'image'; } catch(e) { toast('Ошибка'); return; } }
    const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    try { await sb.from('stories').insert({ user_id: state.user.id, text_content: text || null, media_url: mediaUrl, media_type: mediaType, bg_color: '#5288c1', duration: 5, expires_at: expires, views: [] }); toast('📸'); closeModal(); loadStoriesBar(); } catch(e) { toast('Ошибка'); }
  };
};
window.viewStory = async (sid) => {
  const { data: story } = await sb.from('stories').select('*').eq('id', sid).single();
  if (!story) return;
  const { data: author } = await sb.from('profiles').select('*').eq('id', story.user_id).maybeSingle();
  const views = story.views || [];
  if (views.indexOf(state.user.id) === -1) { views.push(state.user.id); try { await sb.from('stories').update({ views }).eq('id', sid); } catch(e) {} }
  const isMine = story.user_id === state.user.id;
  openModal('<div class="story-card" style="background:' + (story.bg_color || '#000') + '">' + (story.media_url ? (story.media_type === 'video' ? '<video src="' + esc(story.media_url) + '" autoplay controls></video>' : '<img src="' + esc(story.media_url) + '">') : '') + (story.text_content ? '<div class="text-overlay">' + esc(story.text_content) + '</div>' : '') + '<div class="story-author"><div class="story-avatar">' + (author?.avatar_url ? '<img src="' + esc(author.avatar_url) + '">' : (author?.display_name || '?')[0].toUpperCase()) + '</div><div class="story-info"><b>' + esc(author?.display_name || '') + '</b><br><span style="opacity:.8">' + fmtTime(story.created_at) + ' · 👁 ' + views.length + '</span></div></div></div><div class="story-reactions">' + ['❤️','🔥','😂','😮','👏'].map(e => '<button onclick="window.reactStory(\'' + sid + '\',\'' + e + '\')">' + e + '</button>').join('') + '</div><div style="display:flex;gap:8px;margin-top:8px">' + (isMine ? '<button onclick="window.deleteStory(\'' + sid + '\')" class="dg" style="flex:1;padding:11px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;border:1px solid rgba(229,57,53,.3);cursor:pointer">🗑</button>' : '<button onclick="window.storyReply(\'' + sid + '\',\'' + story.user_id + '\')" class="primary" style="flex:1;padding:11px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer">💬</button>') + '<button onclick="window.closeModal()" class="gh" style="flex:1;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button></div>');
};
window.reactStory = async (sid, emoji) => { toast(emoji); try { await sb.from('story_reactions').insert({ story_id: sid, user_id: state.user.id, emoji }); } catch(e) {} };
window.deleteStory = async (sid) => { if (!confirm('Удалить?')) return; try { await sb.from('stories').delete().eq('id', sid); toast('Удалено'); closeModal(); loadStoriesBar(); } catch(e) { toast('Ошибка'); } };
window.storyReply = async (sid, uid) => { closeModal(); if (uid === state.user.id) return; const { data: other } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle(); if (!other) return; const { data: existing } = await sb.from('chats').select('*').or(`and(user1.eq.${state.user.id},user2.eq.${other.id}),and(user1.eq.${other.id},user2.eq.${state.user.id})`).maybeSingle(); let chat = existing; if (!chat) { const { data } = await sb.from('chats').insert({ user1: state.user.id, user2: other.id, created_by: state.user.id }).select().single(); chat = data; } await loadChats(); if (chat) openChat(chat.id); };

// ============ ЛЕНТА ============
async function loadFeed() {
  const el = $('fdL'); if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2)">Загрузка...</div>';
  let posts = [];
  try { const r = await sb.from('posts').select('*').order('id', { ascending: false }).limit(30); if (r.error) { el.innerHTML = '<div class="empty-feed"><div class="empty-feed-icon">📰</div>Ошибка</div>'; return; } posts = r.data || []; } catch(e) { el.innerHTML = '<div class="empty-feed"><div class="empty-feed-icon">📰</div>Ошибка</div>'; return; }
  if (!posts.length) { el.innerHTML = '<div class="empty-feed"><div class="empty-feed-icon">📰</div>Пока нет постов<br><br>Нажми ✏️</div>'; return; }
  const uids = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
  const profs = {};
  if (uids.length) { try { const r = await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified,is_plus,is_creator,role').in('id', uids); (r.data || []).forEach(p => profs[p.id] = p); } catch(e) {} }
  el.innerHTML = posts.map(p => {
    const a = profs[p.user_id] || {};
    const init = (a.display_name || '?')[0].toUpperCase();
    const badge = userBadgeHtml(a);
    return '<div class="post-card"><div class="post-header"><div class="post-avatar">' + (a.avatar_url ? '<img src="' + esc(a.avatar_url) + '">' : init) + '</div><div class="post-meta"><div class="post-author">' + esc(a.display_name || 'Юзер') + badge + '</div><div class="post-time">@' + esc(a.username || '?') + ' · ' + fmtTime(p.created_at) + '</div></div></div>' + (p.text ? '<div class="post-text">' + esc(p.text) + '</div>' : '') + (p.image_url ? '<img class="post-image" src="' + esc(p.image_url) + '" onclick="window.openImage(\'' + esc(p.image_url) + '\')">' : '') + '</div>';
  }).join('');
}
window.openPost = () => {
  openModal('<h2>✏️ Новый пост</h2><textarea id="postT" rows="5" placeholder="Что нового?"></textarea><input type="file" id="postImg" accept="image/*" style="width:100%;margin-bottom:14px"><button id="bPubP" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">🚀 Опубликовать</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  $('bPubP').onclick = async () => {
    const text = $('postT').value.trim(), file = $('postImg').files[0];
    if (!text && !file) { toast('Добавь текст или фото'); return; }
    let imageUrl = null;
    if (file) { try { imageUrl = await uploadFile('files', file, 'posts'); } catch(e) { toast('Ошибка'); return; } }
    try { await sb.from('posts').insert({ user_id: state.user.id, text: text || null, image_url: imageUrl, likes_count: 0, comments_count: 0 }); toast('🚀'); closeModal(); loadFeed(); } catch(e) { toast('Ошибка'); }
  };
};

// ============ БОТ ============
window.openBotChat = async () => {
  openModal('<h2>🤖 @Fenixhelperbot</h2><div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;line-height:1.6;color:var(--t2);margin-bottom:14px">погода Москва<br>шутка<br>котик<br>биткоин<br>викторина<br>переведи hello на русский<br>нарисуй космонавта</div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;font-size:13px;border:none;cursor:pointer">Понятно</button>');
};

// ============ ВЕРИФИКАЦИЯ ============
window.openVerification = function() {
  openModal('<h2>✅ Заявка на галочку</h2><div style="background:var(--p2);border-radius:12px;padding:14px;font-size:13px;color:var(--t2);margin-bottom:14px">Галочка ставится только админом.</div><div style="font-size:12px;color:var(--t2);margin-bottom:6px">Какую?</div><div class="tg" id="verType" style="margin-bottom:14px"><button data-t="verified" class="on">✅ Верифиц</button><button data-t="youtuber">▶️ YT</button><button data-t="bot">🤖 Бот</button></div><textarea id="verMsg" rows="4" placeholder="Ссылки..."></textarea><button id="bSendVer" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">📤 Отправить</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  let badgeType = 'verified';
  document.querySelectorAll('#verType button').forEach(b => b.onclick = () => { badgeType = b.dataset.t; document.querySelectorAll('#verType button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $('bSendVer').onclick = async () => {
    const msg = $('verMsg').value.trim();
    if (!msg) { toast('Напиши'); return; }
    try { await sb.from('verification_requests').insert({ user_id: state.user.id, badge_type: badgeType, message: msg, status: 'pending' }); toast('✅ Отправлено'); closeModal(); } catch(e) { toast('Ошибка: ' + e.message); }
  };
};

// ============ МОИ СТИКЕРЫ ============
window.openMyStickers = function() {
  openModal('<h2>🎨 Мои стикеры</h2><input type="file" id="stkFile" accept="image/*" style="width:100%;margin-bottom:14px"><button onclick="window.uploadSticker()" class="primary" style="width:100%;padding:11px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">➕ Загрузить</button><div id="myStkList" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;max-height:300px;overflow-y:auto"></div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>');
  loadMyStickers();
};
async function loadMyStickers() {
  const el = $('myStkList'); if (!el) return;
  const { data } = await sb.from('stickers').select('*').eq('user_id', state.user.id).limit(50);
  if (!data || !data.length) { el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--t2);font-size:12px">Нет стикеров</div>'; return; }
  el.innerHTML = data.map(s => '<div class="sticker-item" onclick="window.sendStickerImg(\'' + esc(s.url) + '\')"><img src="' + esc(s.url) + '"></div>').join('');
}
window.uploadSticker = async () => {
  const f = $('stkFile')?.files[0]; if (!f) { toast('Выбери'); return; }
  try { const url = await uploadFile('files', f, 'stickers'); await sb.from('stickers').insert({ user_id: state.user.id, url, emoji: '🖼' }); toast('✅'); loadMyStickers(); } catch(e) { toast('Ошибка'); }
};
window.sendStickerImg = async (url) => {
  if (!state.currentChat) { toast('Открой чат'); return; }
  const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, file_url: url, file_type: 'image/png', is_sticker: true, is_read: false, deleted: false };
  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
  if (error) { toast('Ошибка'); return; }
  closeModal(); await loadMessages(); toast('✅');
};

// ============ ГОЛОСОВЫЕ ============
let mediaRecorder = null, audioChunks = [], recordingStart = 0;
async function startVoice() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = []; recordingStart = Date.now();
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      if (Math.round((Date.now() - recordingStart) / 1000) < 1) { toast('Коротко'); return; }
      const file = new File([blob], 'voice_' + Date.now() + '.webm', { type: 'audio/webm' });
      if (!state.currentChat) return;
      try {
        const url = await uploadFile('files', file, 'voice');
        const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, file_url: url, file_type: 'audio/webm', file_name: file.name, is_voice: true, is_read: false, deleted: false };
        let { error } = await sb.from('messages').insert(payload);
        if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
        if (error) { toast('Ошибка'); return; }
        await sb.from('chats').update({ last_message: '🎤 Голосовое' }).eq('id', state.currentChat.id);
        await loadMessages();
      } catch (e) { toast('Ошибка'); }
    };
    mediaRecorder.start();
    const bMic = $('bMic'); if (bMic) { bMic.textContent = '⏹'; bMic.style.background = '#e53935'; }
    toast('🎤 Запись');
  } catch (e) { toast('Нет микрофона'); }
}

// ============ АДМИН-ПАНЕЛЬ ============
window.openAdmin = function() {
  if (!isAdmin()) { toast('Нет доступа'); return; }
  const apn = $('apn'); if (!apn) return;
  apn.classList.add('show');
  document.body.style.overflow = 'hidden';
  renderAdminStats(); renderAdminTabs(); switchAdminTab('users');
};
async function renderAdminStats() {
  const el = $('astat'); if (!el) return;
  let u = 0, c = 0, m = 0, r = 0;
  try { const x = await sb.from('profiles').select('id', { count: 'exact', head: true }); u = x.count || 0; } catch(e) {}
  try { const x = await sb.from('chats').select('id', { count: 'exact', head: true }); c = x.count || 0; } catch(e) {}
  try { const x = await sb.from('messages').select('id', { count: 'exact', head: true }); m = x.count || 0; } catch(e) {}
  try { const x = await sb.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'); r = x.count || 0; } catch(e) {}
  el.innerHTML = '<div class="admin-stat"><div class="admin-stat-value">' + u + '</div><div class="admin-stat-label">Юзеров</div></div><div class="admin-stat"><div class="admin-stat-value">' + c + '</div><div class="admin-stat-label">Чатов</div></div><div class="admin-stat"><div class="admin-stat-value">' + m + '</div><div class="admin-stat-label">Сообщений</div></div><div class="admin-stat"><div class="admin-stat-value" style="color:#ffd700">' + r + '</div><div class="admin-stat-label">Заявок ✅</div></div>';
}
function renderAdminTabs() {
  const el = $('atab'); if (!el) return;
  const tabs = [
    { id: 'users', icon: '👥', name: 'Юзеры' },
    { id: 'verifications', icon: '✅', name: 'Заявки' },
    { id: 'reports', icon: '🚩', name: 'Жалобы' },
    { id: 'tickets', icon: '🎫', name: 'Тикеты' },
    { id: 'promo', icon: '🎁', name: 'Промо' },
    { id: 'bans', icon: '🚫', name: 'Баны' }
  ];
  el.innerHTML = tabs.map(t => '<button data-tab="' + t.id + '" class="' + (state.adminTab === t.id ? 'on' : '') + '">' + t.icon + ' ' + t.name + '</button>').join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => switchAdminTab(b.dataset.tab));
}
function switchAdminTab(tab) {
  state.adminTab = tab;
  renderAdminTabs();
  const bod = $('abod'); if (!bod) return;
  bod.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t2)">Загрузка...</div>';
  if (tab === 'users') renderAdminUsers();
  else if (tab === 'verifications') renderAdminVerifications();
  else if (tab === 'reports') renderAdminReports();
  else if (tab === 'tickets') renderAdminTickets();
  else if (tab === 'promo') renderAdminPromo();
  else if (tab === 'bans') renderAdminBans();
}

// --- АДМИН: ЮЗЕРЫ ---
async function renderAdminUsers() {
  const bod = $('abod'); if (!bod) return;
  let users = [];
  try { const r = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(200); users = r.data || []; } catch(e) {}
  state.adminUsersCache = users;
  bod.innerHTML = '<input id="adminUserSearch" placeholder="🔍 Поиск..." style="margin-bottom:10px;width:100%;padding:10px 14px;border-radius:10px;background:var(--p2);color:var(--t);border:1px solid var(--br)"><div id="adminUserList">' + renderAdminUsersList('') + '</div>';
  const search = $('adminUserSearch');
  if (search) search.oninput = () => { const list = $('adminUserList'); if (list) list.innerHTML = renderAdminUsersList(search.value.toLowerCase().trim()); };
}
function renderAdminUsersList(filter) {
  const list = state.adminUsersCache.filter(u => !filter || (u.username || '').toLowerCase().indexOf(filter) !== -1 || (u.display_name || '').toLowerCase().indexOf(filter) !== -1);
  if (!list.length) return '<div style="text-align:center;padding:30px;color:var(--t2)">Никого</div>';
  return list.map(u => {
    let badges = '';
    if (u.is_creator) badges += renderBadge('creator');
    if (u.role === 'admin') badges += renderBadge('owner');
    if (u.is_verified) badges += renderBadge('verified');
    if (u.is_plus) badges += renderBadge('premium');
    const banned = u.is_banned ? '<span style="color:#e53935;font-size:10px;font-weight:700">🚫 БАН</span>' : '';
    const muted = u.muted_until && new Date(u.muted_until) > new Date() ? '<span style="color:#f39c12;font-size:10px;font-weight:700">🔇 МУТ</span>' : '';
    return '<div class="admin-user-row">' +
      '<div class="admin-user-name">' + esc(u.display_name || '—') + badges + ' ' + banned + ' ' + muted + '</div>' +
      '<div class="admin-user-info">@' + esc(u.username || '—') + ' · 💰 ' + (u.balance||0) + ' · 🎯 ' + (u.level||1) + ' · 💬 ' + (u.messages_count||0) + '</div>' +
      '<div class="admin-user-actions">' +
        '<button onclick="window.adminEditUser(\'' + u.id + '\')" style="background:var(--a);color:#fff">✏️ Изм</button>' +
        '<button onclick="window.adminGiveBalance(\'' + u.id + '\')" style="background:#10b981;color:#fff">💰 SG</button>' +
        '<button onclick="window.adminMute(\'' + u.id + '\')" style="background:#f39c12;color:#fff">🔇 Мут</button>' +
        '<button onclick="window.adminTempBan(\'' + u.id + '\')" style="background:#e74c3c;color:#fff">⏰ Бан</button>' +
        '<button onclick="window.adminToggleVerified(\'' + u.id + '\')" style="background:' + (u.is_verified ? '#e53935' : '#2196f3') + ';color:#fff">' + (u.is_verified ? '❌✅' : '✅') + '</button>' +
        '<button onclick="window.adminTogglePlus(\'' + u.id + '\')" style="background:' + (u.is_plus ? '#e53935' : '#ffd700') + ';color:' + (u.is_plus ? '#fff' : '#000') + '">' + (u.is_plus ? '❌⭐' : '⭐') + '</button>' +
        '<button onclick="window.adminToggleCreator(\'' + u.id + '\')" style="background:' + (u.is_creator ? '#e53935' : '#000') + ';color:#fff">' + (u.is_creator ? '❌👑' : '👑') + '</button>' +
        '<button onclick="window.adminBanIP(\'' + u.id + '\')" style="background:#34495e;color:#fff">🌐 IP</button>' +
        '<button onclick="window.adminBanDevice(\'' + u.id + '\')" style="background:#34495e;color:#fff">📱 Dev</button>' +
        '<button onclick="window.adminToggleBan(\'' + u.id + '\')" style="background:' + (u.is_banned ? '#4caf50' : '#e53935') + ';color:#fff">' + (u.is_banned ? '✅ Разбан' : '🚫 Бан') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}
window.adminEditUser = (uid) => {
  const u = state.adminUsersCache.find(x => x.id === uid); if (!u) return;
  openModal('<h2>✏️ ' + esc(u.username) + '</h2><input id="auName" placeholder="Имя" value="' + esc(u.display_name || '') + '"><input id="auAvatar" placeholder="URL аватара" value="' + esc(u.avatar_url || '') + '"><input id="auBalance" type="number" placeholder="Баланс" value="' + (u.balance || 0) + '"><input id="auLevel" type="number" placeholder="Уровень" value="' + (u.level || 1) + '"><select id="auRole"><option value="user"' + (u.role === 'user' ? ' selected' : '') + '>user</option><option value="moderator"' + (u.role === 'moderator' ? ' selected' : '') + '>moderator</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>admin</option></select><button id="bSaveUser" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">💾 Сохранить</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  $('bSaveUser').onclick = async () => {
    const updates = { display_name: $('auName').value.trim() || u.display_name, avatar_url: $('auAvatar').value.trim() || null, balance: parseInt($('auBalance').value) || 0, level: parseInt($('auLevel').value) || 1, role: $('auRole').value };
    try { await sb.from('profiles').update(updates).eq('id', uid); toast('✅'); closeModal(); renderAdminUsers(); } catch(e) { toast('Ошибка'); }
  };
};
window.adminGiveBalance = (uid) => {
  const u = state.adminUsersCache.find(x => x.id === uid); if (!u) return;
  const amount = prompt('Сколько SG?', '100'); if (!amount) return;
  const n = parseInt(amount); if (isNaN(n)) { toast('Неверно'); return; }
  (async () => {
    const newBal = Math.max(0, (u.balance || 0) + n);
    try { await sb.from('profiles').update({ balance: newBal }).eq('id', uid); try { await sb.from('balance_log').insert({ user_id: uid, amount: n, reason: 'Начисление админом' }); } catch(e) {} toast('💰 ' + newBal); renderAdminUsers(); } catch(e) { toast('Ошибка'); }
  })();
};
window.adminToggleVerified = async (uid) => {
  const u = state.adminUsersCache.find(x => x.id === uid); if (!u) return;
  try { await sb.from('profiles').update({ is_verified: !u.is_verified }).eq('id', uid); toast(!u.is_verified ? '✅' : '❌'); renderAdminUsers(); } catch(e) { toast('Ошибка'); }
};
window.adminTogglePlus = async (uid) => {
  const u = state.adminUsersCache.find(x => x.id === uid); if (!u) return;
  try { await sb.from('profiles').update({ is_plus: !u.is_plus }).eq('id', uid); toast(!u.is_plus ? '⭐' : '❌'); renderAdminUsers(); } catch(e) { toast('Ошибка'); }
};
window.adminToggleCreator = async (uid) => {
  if (uid === state.user.id) { toast('Себя нельзя'); return; }
  const u = state.adminUsersCache.find(x => x.id === uid); if (!u) return;
  if (u.is_creator && !confirm('Снять?')) return;
  try { await sb.from('profiles').update({ is_creator: !u.is_creator }).eq('id', uid); toast(!u.is_creator ? '👑' : '❌'); renderAdminUsers(); } catch(e) { toast('Ошибка'); }
};
window.adminToggleBan = async (uid) => {
  const u = state.adminUsersCache.find(x => x.id === uid); if (!u) return;
  if (uid === state.user.id) { toast('Себя нельзя'); return; }
  try {
    if (u.is_banned) { await sb.from('profiles').update({ is_banned: false, ban_reason: null, banned_until: null }).eq('id', uid); toast('✅ Разбан'); }
    else { const reason = prompt('Причина:', 'Нарушение') || 'Нарушение'; await sb.from('profiles').update({ is_banned: true, ban_reason: reason, banned_by: state.user.id }).eq('id', uid); toast('🚫'); }
    renderAdminUsers();
  } catch(e) { toast('Ошибка'); }
};

// --- АДМИН: ВЕРИФИКАЦИЯ ---
async function renderAdminVerifications() {
  const bod = $('abod'); if (!bod) return;
  let reqs = [];
  try { const r = await sb.from('verification_requests').select('*').eq('status', 'pending').order('id', { ascending: false }).limit(50); reqs = r.data || []; } catch(e) {}
  if (!reqs.length) { bod.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2)">🎉 Нет заявок</div>'; return; }
  const uids = [...new Set(reqs.map(r => r.user_id).filter(Boolean))];
  const profs = {};
  if (uids.length) { try { const r = await sb.from('profiles').select('id,username,display_name').in('id', uids); (r.data || []).forEach(p => profs[p.id] = p); } catch(e) {} }
  const badgeNames = { verified: '✅ Верифицирован', youtuber: '▶️ YouTuber', bot: '🤖 Bot' };
  bod.innerHTML = reqs.map(req => {
    const u = profs[req.user_id] || {};
    return '<div class="ver-card"><div class="ver-card-name">' + esc(u.display_name || '—') + '<span class="ver-card-badge ' + req.badge_type + '">' + (badgeNames[req.badge_type] || req.badge_type) + '</span></div><div class="ver-card-user">@' + esc(u.username || '?') + '</div><div class="ver-card-msg">' + esc(req.message || '') + '</div><div class="ver-card-actions"><button class="approve" onclick="window.adminApproveVer(\'' + req.id + '\',\'' + req.user_id + '\',\'' + req.badge_type + '\')">✅</button><button class="reject" onclick="window.adminRejectVer(\'' + req.id + '\')">❌</button></div></div>';
  }).join('');
}
window.adminApproveVer = async (reqId, uid, badgeType) => {
  try {
    const updates = {};
    if (badgeType === 'verified') updates.is_verified = true;
    else if (badgeType === 'youtuber') updates.is_youtuber = true;
    else if (badgeType === 'bot') updates.is_bot_verified = true;
    await sb.from('profiles').update(updates).eq('id', uid);
    await sb.from('verification_requests').update({ status: 'approved', reviewed_by: state.user.id, reviewed_at: new Date().toISOString() }).eq('id', reqId);
    toast('✅ Галочка выдана');
    renderAdminVerifications(); renderAdminStats();
  } catch(e) { toast('Ошибка'); }
};
window.adminRejectVer = async (reqId) => {
  const reason = prompt('Причина:') || 'Не соответствует';
  try { await sb.from('verification_requests').update({ status: 'rejected', reject_reason: reason, reviewed_by: state.user.id, reviewed_at: new Date().toISOString() }).eq('id', reqId); toast('Отклонено'); renderAdminVerifications(); } catch(e) { toast('Ошибка'); }
};

// --- АДМИН: ЖАЛОБЫ ---
async function renderAdminReports() {
  const bod = $('abod'); if (!bod) return;
  let reports = [];
  try { const r = await sb.from('reports').select('*').eq('status', 'pending').order('id', { ascending: false }).limit(50); reports = r.data || []; } catch(e) { bod.innerHTML = '<div style="text-align:center;padding:40px;color:#e53935">Ошибка</div>'; return; }
  if (!reports.length) { bod.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2)">🎉 Жалоб нет</div>'; return; }
  const uids = [...new Set([...reports.map(r => r.reporter_id).filter(Boolean), ...reports.map(r => r.reported_user_id).filter(Boolean)])];
  const profs = {};
  if (uids.length) { try { const r = await sb.from('profiles').select('id,username,display_name').in('id', uids); (r.data || []).forEach(p => profs[p.id] = p); } catch(e) {} }
  bod.innerHTML = reports.map(r => {
    const reporter = profs[r.reporter_id] || {};
    const reported = profs[r.reported_user_id] || {};
    return '<div class="ver-card"><div class="ver-card-name">🚩 ' + esc(r.reason || '—') + '</div><div class="ver-card-user">От: @' + esc(reporter.username || '?') + (reported.id ? '<br>На: @' + esc(reported.username || '?') : '') + '<br>' + fmtDate(r.created_at) + '</div>' + (r.comment ? '<div class="ver-card-msg">' + esc(r.comment) + '</div>' : '') + '<div class="ver-card-actions">' + (reported.id ? '<button class="approve" onclick="window.reportTakeAction(\'' + reported.id + '\',\'' + r.id + '\')">⚖️</button>' : '') + '<button class="reject" onclick="window.adminResolveReport(\'' + r.id + '\')">✅ Решено</button></div></div>';
  }).join('');
}
window.reportTakeAction = async function(userId, reportId) {
  await sb.from('reports').update({ status: 'reviewed', reviewed_by: state.user.id }).eq('id', reportId);
  closeModal();
  const apn = $('apn'); if (apn) apn.classList.add('show');
  if (!state.adminUsersCache.length) await renderAdminUsers();
  const u = state.adminUsersCache.find(x => x.id === userId);
  if (u) window.adminMute(userId);
  else toast('Обнови админку');
};
window.adminResolveReport = async (rid) => {
  try { await sb.from('reports').update({ status: 'resolved', reviewed_by: state.user.id, reviewed_at: new Date().toISOString() }).eq('id', rid); toast('✅'); renderAdminReports(); } catch(e) { toast('Ошибка'); }
};

// --- АДМИН: ТИКЕТЫ ---
async function renderAdminTickets() {
  const bod = $('abod'); if (!bod) return;
  let tickets = [];
  try { const r = await sb.from('tickets').select('*').order('id', { ascending: false }).limit(50); tickets = r.data || []; } catch(e) {}
  if (!tickets.length) { bod.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2)">🎫 Нет тикетов</div>'; return; }
  bod.innerHTML = tickets.map(t => '<div class="ver-card"><div class="ver-card-name">' + esc(t.subject || 'Без темы') + '</div><div class="ver-card-user">' + esc(t.email || '') + '</div><div class="ver-card-msg">' + esc(t.message || '') + '</div><div class="ver-card-actions"><button class="approve" onclick="window.adminResolveTicket(\'' + t.id + '\')">✅</button><button class="reject" onclick="window.adminDeleteTicket(\'' + t.id + '\')">🗑</button></div></div>').join('');
}
window.adminResolveTicket = async (tid) => { try { await sb.from('tickets').update({ status: 'resolved' }).eq('id', tid); toast('✅'); renderAdminTickets(); } catch(e) {} };
window.adminDeleteTicket = async (tid) => { if (!confirm('Удалить?')) return; try { await sb.from('tickets').delete().eq('id', tid); toast('🗑'); renderAdminTickets(); } catch(e) {} };

// --- АДМИН: ПРОМО ---
async function renderAdminPromo() {
  const bod = $('abod'); if (!bod) return;
  let promos = [];
  try { const r = await sb.from('promocodes').select('*').order('id', { ascending: false }).limit(50); promos = r.data || []; } catch(e) {}
  bod.innerHTML = '<button onclick="window.adminCreatePromo()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:14px">＋ Создать</button>' + (promos.length ? promos.map(p => '<div class="ver-card"><div class="ver-card-name">🎁 ' + esc(p.code) + '</div><div class="ver-card-user">' + (p.days || 0) + ' дней · ' + (p.bonus_coins || 0) + ' SG · ' + (p.uses || 0) + '/' + (p.max_uses || 0) + '</div><div class="ver-card-actions"><button class="reject" onclick="window.adminDeletePromo(\'' + p.id + '\')">🗑</button></div></div>').join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Нет промо</div>');
}
window.adminCreatePromo = () => {
  openModal('<h2>🎁 Промокод</h2><input id="npCode" placeholder="КОД" style="text-transform:uppercase"><input id="npDays" type="number" placeholder="Дней Plus" value="0"><input id="npCoins" type="number" placeholder="SG" value="0"><input id="npMax" type="number" placeholder="Макс" value="100"><button id="bCreatePromo" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">💾 Создать</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  $('bCreatePromo').onclick = async () => {
    const code = $('npCode').value.trim().toUpperCase();
    if (!code) { toast('Код'); return; }
    try { await sb.from('promocodes').insert({ code, days: parseInt($('npDays').value) || 0, bonus_coins: parseInt($('npCoins').value) || 0, max_uses: parseInt($('npMax').value) || 100, uses: 0, created_by: state.user.id }); toast('✅'); closeModal(); renderAdminPromo(); } catch(e) { toast('Ошибка'); }
  };
};
window.adminDeletePromo = async (pid) => { if (!confirm('Удалить?')) return; try { await sb.from('promocodes').delete().eq('id', pid); toast('🗑'); renderAdminPromo(); } catch(e) {} };

// --- АДМИН: БАНЫ (IP/Dev) ---
async function renderAdminBans() {
  const bod = $('abod'); if (!bod) return;
  let bans = [];
  try { const r = await sb.from('bans').select('*').eq('active', true).order('id', { ascending: false }).limit(50); bans = r.data || []; } catch(e) {}
  bod.innerHTML = '<button onclick="window.adminCreateBan()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#e53935,#c0392b);color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:14px">＋ Создать бан</button>' + (bans.length ? bans.map(b => '<div class="ver-card"><div class="ver-card-name">' + (b.type === 'ip' ? '🌐' : '📱') + ' ' + esc(b.value) + '</div><div class="ver-card-user">' + esc(b.reason || '—') + ' · до ' + (b.expires_at ? fmtDate(b.expires_at) : '∞') + '</div><div class="ver-card-actions"><button class="reject" onclick="window.adminRemoveBan(\'' + b.id + '\')">🗑 Снять</button></div></div>').join('') : '<div style="text-align:center;padding:30px;color:var(--t2)">Нет банов</div>');
}
window.adminCreateBan = () => {
  openModal('<h2>🚫 Создать бан</h2><select id="banType"><option value="ip">🌐 IP</option><option value="device">📱 Device</option></select><input id="banValue" placeholder="Значение (IP или Device ID)"><input id="banReason" placeholder="Причина" value="Нарушение"><input id="banDays" type="number" placeholder="Дней (0 = навсегда)" value="7"><button id="bCreateBan" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#e53935,#c0392b);color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">🚫 Забанить</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  $('bCreateBan').onclick = async () => {
    const type = $('banType').value, value = $('banValue').value.trim(), reason = $('banReason').value.trim() || 'Нарушение', days = parseInt($('banDays').value) || 0;
    if (!value) { toast('Значение'); return; }
    const expires = days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString();
    try { await sb.from('bans').insert({ type, value, reason, banned_by: state.user.id, expires_at: expires, active: true }); toast('🚫'); closeModal(); renderAdminBans(); } catch(e) { toast('Ошибка'); }
  };
};
window.adminRemoveBan = async (id) => { if (!confirm('Снять бан?')) return; try { await sb.from('bans').update({ active: false }).eq('id', id); toast('✅'); renderAdminBans(); } catch(e) {} };

// ============ BIND BUTTONS ============
function bindButtons() {
  console.log('🔗 Привязка...');
  const bSidebar = $('bSidebar'); if (bSidebar) bSidebar.onclick = () => openSidebar();
  const bindings = {
    'bAdm': () => window.openAdmin(), 'bSet': () => window.openSettings(), 'bShop': () => window.openShop(),
    'bBot': () => window.openBotChat(), 'bGrp': () => window.openGroupCreate(), 'bNewChat': () => window.openNewChat(),
    'bSearch': () => window.openGlobalSearch(), 'bStickers': () => window.openMyStickers(),
    'bSaved': () => toast('📌 Скоро'), 'bVer': () => window.openVerification()
  };
  Object.keys(bindings).forEach(id => { const el = $(id); if (el) el.onclick = bindings[id]; });
  const chatActions = { 'bStalk': () => window.openStalker(), 'bChatGallery': () => window.openChatGallery(), 'bSrch': () => window.openChatSearch(), 'bMenu': () => window.openChatMenu() };
  Object.keys(chatActions).forEach(id => { const el = $(id); if (el) el.onclick = chatActions[id]; });
  const bBack = $('bBack'); if (bBack) bBack.onclick = back;
  const rClose = $('rClose'); if (rClose) rClose.onclick = cancelRep;
  const msgI = $('msgI'), bSend = $('bSend');
  if (msgI) msgI.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && state.settings.enterSend) { e.preventDefault(); sendMessage(); } };
  if (bSend) bSend.onclick = sendMessage;
  const bPlus = $('bPlus'); if (bPlus) bPlus.onclick = () => { const p = $('attP'); if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none'; };
  const bEmo = $('bEmo'); if (bEmo) bEmo.onclick = () => { const ep = $('ep'); if (ep) ep.classList.toggle('show'); document.querySelectorAll('.pnl').forEach(p => p.classList.add('h')); };
  const bMic = $('bMic'); if (bMic) bMic.onclick = () => { if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); bMic.textContent = '🎤'; bMic.style.background = ''; } else startVoice(); };
  ['ap','af','as','ag','avn','ab','apo'].forEach(id => {
    const el = $(id); if (!el) return;
    el.onclick = () => {
      const attP = $('attP'); if (attP) attP.style.display = 'none';
      const map = { 'ap': () => pickFile('image/*'), 'af': () => pickFile('*/*'), 'as': () => openStickerPicker(), 'ag': () => openGifPicker(), 'avn': () => toast('⭕ Скоро'), 'ab': () => toggleBurn(), 'apo': () => openPollCreate() };
      (map[id] || (()=>{}))();
    };
  });
  document.querySelectorAll('.bn button').forEach(b => {
    b.onclick = null;
    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.bn button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      switchTab(b.dataset.tab);
    });
  });
  const fcBtn = $('fcBtn'); if (fcBtn) fcBtn.onclick = () => window.openPost();
  const myA = $('myA'); if (myA) myA.onclick = () => showProf();
  console.log('✅ Готово');
}
function switchTab(tab) {
  const sd = $('SD'), fd = $('fdScr'), area = $('AR');
  if (sd) sd.style.display = 'none';
  if (fd) fd.style.display = 'none';
  if (area) area.style.display = 'none';
  if (tab === 'chats') {
    if (sd) sd.style.display = 'flex';
    if (area) area.style.display = 'flex';
    if ($('fcBtn')) $('fcBtn').style.display = 'none';
    if (!state.currentChat) {
      const ch = $('CH'), msgs = $('msgs'), inp = $('inp'), emp = $('emp');
      if (ch) { ch.style.display = 'none'; ch.classList.remove('active'); }
      if (msgs) { msgs.style.display = 'none'; msgs.classList.remove('active'); }
      if (inp) { inp.style.display = 'none'; inp.classList.remove('active'); }
      if (emp) emp.style.display = 'flex';
    }
  } else if (tab === 'feed') {
    if (fd) fd.style.display = 'flex';
    if ($('fcBtn')) $('fcBtn').style.display = 'flex';
    loadFeed();
  } else if (tab === 'profile') {
    if (sd) sd.style.display = 'flex';
    if (area) area.style.display = 'flex';
    if ($('fcBtn')) $('fcBtn').style.display = 'none';
    showProf();
  }
}

// ============ ФАЙЛЫ/СТИКЕРЫ/GIF ============
function pickFile(accept) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || '*/*';
  inp.onchange = () => { const file = inp.files[0]; if (file && state.currentChat) sendFile(file); };
  inp.click();
}
function openStickerPicker() {
  const s = $('stkP'); if (!s) return;
  s.classList.toggle('h');
  const g = $('stkG');
  if (g) { const list = ['😀','😂','🥰','😎','🤔','😴','🤯','🥳','😭','😡','👍','👎','❤️','🔥','🎉','🚀','⭐','💯','✅','❌','🙏','🤝','👀','💀','🤡']; g.innerHTML = list.map(e => '<button style="font-size:32px;padding:6px;border-radius:10px;background:var(--p2);border:none;cursor:pointer" onclick="window.sendSticker(\'' + e + '\')">' + e + '</button>').join(''); }
}
window.sendSticker = async (emoji) => {
  if (!state.currentChat) { toast('Открой чат'); return; }
  const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, text: emoji, is_sticker: true, is_read: false, deleted: false };
  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
  if (error) { toast('Ошибка'); return; }
  const p = $('stkP'); if (p) p.classList.add('h');
  await loadMessages();
};
function openGifPicker() {
  const p = $('gifP'); if (!p) return;
  p.classList.toggle('h');
  const inp = $('gifS');
  if (inp) inp.oninput = async () => {
    const q = inp.value.trim(); if (!q) return;
    try { const d = await fetch('https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=' + encodeURIComponent(q) + '&limit=20').then(r => r.json()); const g = $('gifG'); if (g) g.innerHTML = (d.data || []).map(x => '<img src="' + x.images.fixed_height_small.url + '" style="width:100%;border-radius:8px;cursor:pointer" onclick="window.sendGif(\'' + x.images.original.url + '\')">').join(''); } catch(e) {}
  };
}
window.sendGif = async (url) => {
  if (!state.currentChat) return;
  const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, file_url: url, file_type: 'image/gif', is_read: false, deleted: false };
  let { error } = await sb.from('messages').insert(payload);
  if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
  if (error) { toast('Ошибка'); return; }
  const p = $('gifP'); if (p) p.classList.add('h');
  await loadMessages();
};
function toggleBurn() {
  const p = $('brnP'); if (!p) return;
  p.classList.toggle('h');
  const opts = $('brnO');
  if (opts) opts.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', String(state.burnAfter) === b.dataset.b);
    b.onclick = () => { state.burnAfter = parseInt(b.dataset.b) || 0; opts.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); if (state.burnAfter > 0) toast('🔥 ' + b.textContent); };
  });
}
function openPollCreate() {
  openModal('<h2>📊 Опрос</h2><input id="pollQ" placeholder="Вопрос"><input class="poll-i" placeholder="Вариант 1"><input class="poll-i" placeholder="Вариант 2"><input class="poll-i" placeholder="Вариант 3"><button id="bCrPoll" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">Создать</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  $('bCrPoll').onclick = async () => {
    const q = $('pollQ').value.trim();
    const opts = [...document.querySelectorAll('.poll-i')].map(i => i.value.trim()).filter(Boolean);
    if (!q || opts.length < 2) { toast('Нужен вопрос и 2 варианта'); return; }
    if (!state.currentChat) return;
    const text = '📊 ' + q + '\n' + opts.map((o,i) => (i+1) + '. ' + o).join('\n');
    const payload = { chat_id: state.currentChat.id, sender: state.user.id, sender_name: state.profile.display_name, text, is_read: false, deleted: false };
    let { error } = await sb.from('messages').insert(payload);
    if (error && error.message.indexOf('sender_name') !== -1) { delete payload.sender_name; const r = await sb.from('messages').insert(payload); error = r.error; }
    if (error) { toast('Ошибка'); return; }
    closeModal(); await loadMessages();
  };
}

// ============ SIDEBAR ============
function openSidebar() {
  let sb2 = document.querySelector('.sg-sidebar');
  if (!sb2) {
    sb2 = document.createElement('div');
    sb2.className = 'sg-sidebar';
    const p = state.profile || {};
    const init = (p.display_name || '?')[0].toUpperCase();
    const badge = p.is_creator ? renderBadge('creator') : (p.is_verified ? renderBadge('verified') : '');
    sb2.innerHTML = '<div style="font-size:20px;font-weight:800;margin-bottom:16px;background:linear-gradient(135deg,#ff6b35,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent">🔥 Fenix</div><div class="sg-sidebar-user" onclick="closeSidebar();window.openAccounts()"><div class="acc-avatar">' + (p.avatar_url ? '<img src="' + esc(p.avatar_url) + '">' : init) + '</div><div class="acc-info"><div class="acc-name">' + esc(p.display_name || '?') + badge + '</div><div class="acc-username">@' + esc(p.username || '?') + ' · сменить</div></div><span style="color:var(--t2);font-size:20px">⇄</span></div><div id="sbMenu"></div>';
    document.body.appendChild(sb2);
    const menu = [
      { i:'🎭', t:'Аккаунты', a:() => { closeSidebar(); window.openAccounts(); } },
      { i:'📜', t:'Правила Fenix', a:() => { closeSidebar(); window.openRules(); } },
      { i:'💬', t:'Новый чат', a:() => { closeSidebar(); window.openNewChat(); } },
      { i:'➕', t:'Группа/Канал', a:() => { closeSidebar(); window.openGroupCreate(); } },
      { i:'👤', t:'Мой профиль', a:() => { closeSidebar(); showProf(); } },
      { i:'🔍', t:'Поиск', a:() => { closeSidebar(); window.openGlobalSearch(); } },
      { i:'🎰', t:'Musor Drop 🎲', a:() => { closeSidebar(); window.openMusorDrop(); } },
      { i:'🛒', t:'Магазин', a:() => { closeSidebar(); window.openShop(); } },
      { i:'💰', t:'Баланс', a:() => { closeSidebar(); window.openBalance(); } },
      { i:'🎁', t:'Промокод', a:() => { closeSidebar(); window.openPromo(); } },
      { i:'🤖', t:'Бот', a:() => { closeSidebar(); window.openBotChat(); } },
      { i:'✅', t:'Верификация', a:() => { closeSidebar(); window.openVerification(); } },
      { i:'🎨', t:'Стикеры', a:() => { closeSidebar(); window.openMyStickers(); } },
      { i:'⚙️', t:'Настройки', a:() => { closeSidebar(); window.openSettings(); } }
    ];
    if (isAdmin()) menu.push({ i:'👑', t:'Админ-панель', a:() => { closeSidebar(); window.openAdmin(); } });
    menu.push({ i:'🚪', t:'Выйти', a:() => { if (confirm('Выйти?')) logout(); } });
    $('sbMenu').innerHTML = menu.map((m,i) => '<button data-i="' + i + '" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:12px;background:transparent;color:var(--t);font-size:14px;font-weight:600;border:none;cursor:pointer;text-align:left;margin-bottom:4px"><span style="font-size:18px">' + m.i + '</span> ' + m.t + '</button>').join('');
    $('sbMenu').querySelectorAll('button').forEach(b => { b.onclick = () => menu[+b.dataset.i].a(); });
    const ov = document.createElement('div');
    ov.className = 'sg-sidebar-ov';
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

// ============ ГРУППА ============
window.openGroupCreate = function() {
  openModal('<h2>➕ Группа/Канал</h2><div style="display:flex;gap:6px;margin-bottom:14px" id="typeGrp"><button data-t="group" style="flex:1;padding:10px;border-radius:10px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:600;border:none;cursor:pointer">👥 Группа</button><button data-t="channel" style="flex:1;padding:10px;border-radius:10px;background:var(--p2);color:var(--t);font-weight:600;border:none;cursor:pointer">📢 Канал</button></div><input id="grpName" placeholder="Название"><button id="bCreateGrp" class="primary" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;font-weight:700;border:none;cursor:pointer;margin-bottom:8px">Создать</button><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Отмена</button>');
  let type = 'group';
  document.querySelectorAll('#typeGrp button').forEach(b => b.onclick = () => {
    type = b.dataset.t;
    document.querySelectorAll('#typeGrp button').forEach(x => { x.style.background = 'var(--p2)'; x.style.color = 'var(--t)'; });
    b.style.background = 'linear-gradient(135deg,#ff6b35,#ffd700)'; b.style.color = '#000';
  });
  $('bCreateGrp').onclick = async () => {
    const name = $('grpName').value.trim();
    if (!name) { toast('Название'); return; }
    const { data, error } = await sb.from('chats').insert({ is_group: type === 'group', is_channel: type === 'channel', group_name: name, created_by: state.user.id, user1: state.user.id, user2: state.user.id }).select().single();
    if (error) { toast('Ошибка: ' + error.message); return; }
    closeModal(); await loadChats(); openChat(data.id);
  };
};

// ============ STALKER/GALLERY/SEARCH ============
window.openStalker = function() {
  if (!state.currentChat) return;
  const deleted = state.messages.filter(m => m.deleted);
  openModal('<h2>🕵️ StalkerGram</h2>' + (deleted.length ? deleted.map(m => '<div style="padding:10px;background:var(--p2);border-radius:10px;margin-bottom:6px;font-size:13px;opacity:.7"><b>' + esc(m.sender_name || '?') + ':</b> ' + esc(m.text || '[медиа]') + '</div>').join('') : '<div style="text-align:center;padding:20px;color:var(--t2)">Пусто</div>') + '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>');
};
window.openChatGallery = function() {
  if (!state.currentChat) return;
  const media = state.messages.filter(m => m.file_url && (m.file_type || '').indexOf('image') === 0);
  openModal('<h2>🖼️ Галерея</h2>' + (media.length ? '<div class="chat-gallery">' + media.map(m => '<img src="' + esc(m.file_url) + '" onclick="window.openImage(\'' + esc(m.file_url) + '\')">').join('') + '</div>' : '<div style="text-align:center;padding:20px;color:var(--t2)">Нет фото</div>') + '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>');
};
window.openChatSearch = function() {
  openModal('<h2>🔍 Поиск</h2><input id="chatSearchQ" placeholder="Что искать?"><div id="chatSearchRes" style="max-height:300px;overflow-y:auto"></div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:14px">Закрыть</button>');
  $('chatSearchQ').oninput = () => {
    const q = $('chatSearchQ').value.trim().toLowerCase();
    if (q.length < 2) { $('chatSearchRes').innerHTML = ''; return; }
    const found = state.messages.filter(m => (m.text || '').toLowerCase().indexOf(q) !== -1);
    $('chatSearchRes').innerHTML = found.length ? found.slice(0, 30).map(m => '<div style="padding:8px;background:var(--p2);border-radius:8px;margin-bottom:6px;font-size:13px"><b>' + esc(m.sender_name || '?') + ':</b> ' + esc((m.text || '').slice(0, 100)) + '</div>').join('') : '<div style="text-align:center;padding:20px;color:var(--t2)">Ничего</div>';
  };
};
window.openChatMenu = function() {
  if (!state.currentChat) return;
  const name = (state.currentChat.is_group || state.currentChat.is_channel) ? state.currentChat.group_name : state.currentChat.other?.display_name;
  openModal(
    '<h2>' + esc(name || 'Чат') + '</h2>' +
    '<button onclick="window.openReportMenu()" style="width:100%;padding:12px;border-radius:12px;background:rgba(229,57,53,.15);color:#e53935;font-weight:700;border:1px solid rgba(229,57,53,.3);cursor:pointer;margin-bottom:6px">🚩 Пожаловаться</button>' +
    '<button onclick="window.clearChatHistory()" class="gh" style="width:100%;padding:12px;border-radius:12px;background:var(--p2);color:var(--t);font-weight:600;border:1px solid var(--br);cursor:pointer;margin-bottom:6px">🗑 Очистить</button>' +
    (state.currentChat.other ? '<button onclick="window.viewUserProfile(\'' + state.currentChat.other.id + '\')" class="gh" style="width:100%;padding:12px;border-radius:12px;background:var(--p2);color:var(--t);font-weight:600;border:1px solid var(--br);cursor:pointer;margin-bottom:6px">👤 Профиль</button>' : '') +
    (isAdmin() && state.currentChat.other ? '<button onclick="window.closeModal();window.adminMute(\'' + state.currentChat.other.id + '\')" style="width:100%;padding:12px;border-radius:12px;background:#f39c12;color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:6px">🔇 Мут</button>' : '') +
    (isAdmin() && state.currentChat.other ? '<button onclick="window.closeModal();window.adminTempBan(\'' + state.currentChat.other.id + '\')" style="width:100%;padding:12px;border-radius:12px;background:#e53935;color:#fff;font-weight:700;border:none;cursor:pointer;margin-bottom:6px">🚫 Бан</button>' : '') +
    '<button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:8px">Закрыть</button>'
  );
};
window.clearChatHistory = async () => {
  if (!state.currentChat) return;
  if (!confirm('Очистить?')) return;
  await sb.from('messages').update({ deleted: true }).eq('chat_id', state.currentChat.id);
  await loadMessages(); closeModal(); toast('Очищено');
};

// ============ ПОИСК ЮЗЕРОВ ============
window.openNewChat = function() {
  openModal('<h2>💬 Новый чат</h2><input id="newChatUser" placeholder="@username" autocomplete="off"><div id="newChatResults" style="max-height:300px;overflow-y:auto;margin-top:6px"></div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:8px">Закрыть</button>');
  const inp = $('newChatUser'), res = $('newChatResults');
  let timer;
  const doSearch = async () => {
    const q = inp.value.trim().toLowerCase().replace('@', '');
    if (q.length < 1) { res.innerHTML = ''; return; }
    res.innerHTML = '<div style="text-align:center;padding:14px;color:var(--t2)">Поиск...</div>';
    let { data, error } = await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified,is_plus,is_creator,is_youtuber,is_bot_verified,role').ilike('username', '%' + q + '%').limit(30);
    if (!error && (!data || !data.length)) { const ex = await sb.from('profiles').select('*').eq('username', q).limit(10); if (ex.data && ex.data.length) data = ex.data; }
    if (error) { res.innerHTML = '<div style="text-align:center;padding:14px;color:#e53935">' + esc(error.message) + '</div>'; return; }
    const found = (data || []).filter(u => u.id !== state.user.id);
    if (!found.length) { res.innerHTML = '<div style="text-align:center;padding:14px;color:var(--t2)">Никого</div>'; return; }
    res.innerHTML = found.map(u => {
      const init = (u.display_name || '?')[0].toUpperCase();
      const badge = userBadgeHtml(u);
      return '<div class="ch" data-uid="' + u.id + '"><div class="cv" style="width:44px;height:44px;font-size:16px">' + (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '">' : init) + '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:4px">' + esc(u.display_name || '—') + badge + '</div><div style="color:var(--t2);font-size:12px">@' + esc(u.username) + '</div></div><div style="font-size:20px;color:#ff6b35">›</div></div>';
    }).join('');
    res.querySelectorAll('.ch[data-uid]').forEach(el => { el.onclick = () => window.startChatWith(el.dataset.uid); });
  };
  inp.oninput = () => { clearTimeout(timer); timer = setTimeout(doSearch, 250); };
  setTimeout(() => inp.focus(), 100);
};
window.startChatWith = async (otherId) => {
  if (!otherId) return;
  if (otherId === state.user.id) { toast('Это ты'); return; }
  const { data: existing } = await sb.from('chats').select('*').or(`and(user1.eq.${state.user.id},user2.eq.${otherId}),and(user1.eq.${otherId},user2.eq.${state.user.id})`).maybeSingle();
  let chat = existing;
  if (!chat) { const { data, error } = await sb.from('chats').insert({ user1: state.user.id, user2: otherId, created_by: state.user.id, is_group: false, is_channel: false }).select().single(); if (error) { toast('Ошибка: ' + error.message); return; } chat = data; }
  closeModal(); await loadChats(); if (chat) openChat(chat.id);
};
window.openGlobalSearch = function() {
  openModal('<h2>🔍 Поиск</h2><input id="globalSearchQ" placeholder="Юзеры..." autofocus><div id="globalSearchRes" style="max-height:400px;overflow-y:auto;margin-top:6px"></div><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer;margin-top:8px">Закрыть</button>');
  const inp = $('globalSearchQ'), res = $('globalSearchRes');
  let timer;
  inp.oninput = () => { clearTimeout(timer); timer = setTimeout(async () => {
    const q = inp.value.trim().toLowerCase().replace('@','');
    if (q.length < 2) { res.innerHTML = ''; return; }
    const { data: users } = await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified,is_plus,is_creator,is_youtuber,role').or('username.ilike.%' + q + '%,display_name.ilike.%' + q + '%').limit(10);
    let html = '';
    if (users?.length) { html += '<div style="font-size:11px;color:var(--t2);font-weight:700;padding:8px 4px 4px">👤 ЮЗЕРЫ</div>'; html += users.map(u => { const init = (u.display_name || '?')[0].toUpperCase(); const badge = userBadgeHtml(u); return '<div class="ch" data-uid="' + u.id + '"><div class="cv" style="width:40px;height:40px;font-size:14px">' + (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '">' : init) + '</div><div style="flex:1"><div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:4px">' + esc(u.display_name || '—') + badge + '</div><div style="color:var(--t2);font-size:12px">@' + esc(u.username) + '</div></div></div>'; }).join(''); }
    if (!html) html = '<div style="text-align:center;padding:20px;color:var(--t2)">Ничего</div>';
    res.innerHTML = html;
    res.querySelectorAll('.ch[data-uid]').forEach(el => { el.onclick = () => window.startChatWith(el.dataset.uid); });
  }, 400); };
  setTimeout(() => inp.focus(), 100);
};
window.openImage = (url) => openModal('<img src="' + esc(url) + '" style="width:100%;border-radius:14px;display:block;margin-bottom:10px"><button onclick="window.closeModal()" class="gh" style="width:100%;padding:11px;border-radius:12px;background:var(--p2);color:var(--t2);font-weight:600;border:none;cursor:pointer">Закрыть</button>');

// ============ ТИПИНГ/ДВОЙНОЙ ТАП/СВАЙП ============
function startTypingWatch() {
  if (state.typingWatchTimer) clearInterval(state.typingWatchTimer);
  state.typingWatchTimer = setInterval(async () => {
    if (!state.currentChat || !state.user) return;
    if (state.currentChat.is_group || state.currentChat.is_channel) return;
    const otherId = state.currentChat.user1 === state.user.id ? state.currentChat.user2 : state.currentChat.user1;
    if (!otherId) return;
    try { const { data } = await sb.from('profiles').select('typing_until').eq('id', otherId).maybeSingle(); const sub = $('hS'); if (!sub) return; if (data?.typing_until && new Date(data.typing_until) > new Date()) { sub.textContent = 'печатает...'; sub.style.color = '#ff6b35'; } else { sub.textContent = 'был(а) недавно'; sub.style.color = ''; } } catch(e) {}
  }, 1500);
}
function sendTypingStatus() {
  if (!state.user || !state.settings.showTyping) return;
  clearTimeout(state.typingTimer);
  try { sb.from('profiles').update({ typing_until: new Date(Date.now() + 3000).toISOString() }).eq('id', state.user.id); } catch(e) {}
  state.typingTimer = setTimeout(() => { try { sb.from('profiles').update({ typing_until: null }).eq('id', state.user.id); } catch(e) {} }, 3000);
}
function setupDoubleTap() {
  const el = $('msgs'); if (!el || el._dtBound) return; el._dtBound = true;
  const doHeart = async (msgEl, x, y) => {
    const msgId = msgEl.dataset.id; if (!msgId || !state.currentChat) return;
    try { const { data: m } = await sb.from('messages').select('reactions').eq('id', msgId).single(); if (!m) return; const reactions = m.reactions || {}; reactions['❤️'] = reactions['❤️'] || []; const uid = state.user.id; if (reactions['❤️'].indexOf(uid) !== -1) reactions['❤️'] = reactions['❤️'].filter(x => x !== uid); else reactions['❤️'].push(uid); if (!reactions['❤️'].length) delete reactions['❤️']; await sb.from('messages').update({ reactions }).eq('id', msgId); if (navigator.vibrate) navigator.vibrate(20); const heart = document.createElement('div'); heart.textContent = '❤️'; heart.style.cssText = 'position:fixed;font-size:40px;pointer-events:none;z-index:99999;left:' + x + 'px;top:' + y + 'px;animation:heartPop .6s ease-out forwards'; document.body.appendChild(heart); setTimeout(() => heart.remove(), 700); await loadMessages(); } catch(err) {}
  };
  el.addEventListener('dblclick', (e) => { const m = e.target.closest('.m'); if (m) doHeart(m, e.clientX, e.clientY); });
  let lastTap = 0;
  el.addEventListener('touchend', (e) => { const now = Date.now(); const m = e.target.closest('.m'); if (!m) { lastTap = now; return; } if (now - lastTap < 300) { const rect = m.getBoundingClientRect(); doHeart(m, rect.right - 20, rect.top); } lastTap = now; });
}
function setupSwipeReply() {
  const el = $('msgs'); if (!el || el._swBound) return; el._swBound = true;
  let startX = 0, startY = 0, currentMsg = null, currentEl = null;
  el.addEventListener('touchstart', (e) => { const m = e.target.closest('.m'); if (!m) return; startX = e.touches[0].clientX; startY = e.touches[0].clientY; currentMsg = m; currentEl = m; m.style.transition = 'none'; }, { passive: true });
  el.addEventListener('touchmove', (e) => { if (!currentEl) return; const dx = e.touches[0].clientX - startX; const dy = Math.abs(e.touches[0].clientY - startY); if (dy > 20) { currentEl.style.transform = ''; currentMsg = null; currentEl = null; return; } if (dx > 0 && dx < 80) currentEl.style.transform = 'translateX(' + dx + 'px)'; }, { passive: true });
  el.addEventListener('touchend', (e) => { if (!currentEl) return; const dx = e.changedTouches[0].clientX - startX; currentEl.style.transition = 'transform .2s'; currentEl.style.transform = ''; if (dx > 60 && currentMsg) { const msgId = currentMsg.dataset.id; const msg = state.messages.find(m => String(m.id) === String(msgId)); if (msg) { state.replyTo = msg; const rp = $('rP'); if (rp) { rp.style.display = 'flex'; rp.classList.add('active'); const rA = $('rA'), rT = $('rT'); if (rA) rA.textContent = msg.sender === state.user.id ? 'Себе' : (msg.sender_name || 'Юзер'); if (rT) rT.textContent = (msg.text || '[медиа]').slice(0, 60); } if (navigator.vibrate) navigator.vibrate(15); } } currentMsg = null; currentEl = null; });
}
function attachTypingToInput() {
  const inp = $('msgI'); if (!inp || inp._typingBound) return; inp._typingBound = true;
  inp.addEventListener('input', () => { sendTypingStatus(); if (state.currentChat) { clearTimeout(state.draftTimer); state.draftTimer = setTimeout(() => { if (inp.value.trim()) localStorage.setItem('sg_draft_' + state.currentChat.id, inp.value); else localStorage.removeItem('sg_draft_' + state.currentChat.id); }, 500); } });
}

// ============ BAN WATCH ============
function startBanWatch() {
  setInterval(async () => {
    if (!state.user) return;
    try { const { data } = await sb.from('profiles').select('is_banned,ban_reason,muted_until').eq('id', state.user.id).single(); if (data?.is_banned) showBanBanner(data.ban_reason); if (data) { state.profile.muted_until = data.muted_until; showMuteBanner(); } } catch(e) {}
  }, 30000);
}

// ============ MAIN ============
(async function main() {
  console.log('🚀 Fenix v22 init...');
  try { const createClient = await loadSupabase(); sb = createClient(SUPABASE_URL, SUPABASE_KEY); console.log('✅ Supabase OK'); }
  catch (e) { document.body.innerHTML = '<div style="padding:40px;color:#fff;background:#0e1621;min-height:100vh"><h1>❌ Ошибка</h1><pre>' + esc(e.message) + '</pre></div>'; return; }

  applyTheme(state.settings.theme); applyMode(state.settings.mode);
  initAuth();

  const savedId = localStorage.getItem('sg_user_id');
  const loadingEl = $('L'), authEl = $('A');

  if (savedId) {
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', savedId).maybeSingle();
      if (data && !data.is_banned) {
        state.user = { id: data.id }; state.profile = data;
        if (loadingEl) loadingEl.classList.add('hide');
        await enterApp();
        startBanWatch();
        console.log('✅ Автологин');
      } else {
        if (data && data.is_banned) showBanBanner(data.ban_reason);
        localStorage.removeItem('sg_user_id');
        if (loadingEl) loadingEl.classList.add('hide');
        if (authEl) authEl.style.display = 'flex';
      }
    } catch(e) { if (loadingEl) loadingEl.classList.add('hide'); if (authEl) authEl.style.display = 'flex'; }
  } else {
    if (loadingEl) loadingEl.classList.add('hide');
    if (authEl) authEl.style.display = 'flex';
  }
  console.log('✅ Fenix готов');
})();
