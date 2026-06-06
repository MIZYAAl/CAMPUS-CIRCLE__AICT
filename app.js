/* ============================================================
   NEXUS SOCIAL — Main App Logic  (fully corrected)
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, get, set as firebaseSet } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyChpHnXu0hAg-3guA7iPONfcpy3FK_yB8Q",
  authDomain: "campus-circle-b74ae.firebaseapp.com",
  databaseURL: "https://campus-circle-b74ae-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "campus-circle-b74ae",
  storageBucket: "campus-circle-b74ae.appspot.com",
  messagingSenderId: "181092931200",
  appId: "1:181092931200:web:3630269897c19cff857865"
};

const firebaseApp = initializeApp(firebaseConfig);
const database    = getDatabase(firebaseApp);
const FIREBASE_ROOT = 'campus_circle_b74ae';
const CACHE = {};
const FIREBASE_KEYS = new Set(['nx_users', 'nx_posts', 'nx_messages', 'nx_notifications']);

function safeParse(value, fallback = null) {
  try { return value !== null ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function localGet(key, fallback = null) {
  try { return safeParse(localStorage.getItem(key), fallback); } catch { return fallback; }
}

function localSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function getDatabaseRef(key) {
  return ref(database, `${FIREBASE_ROOT}/${key}`);
}

async function firebaseRead(key) {
  try {
    const snapshot = await get(getDatabaseRef(key));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (err) {
    console.warn('Firebase read failed for', key, err);
    return null;
  }
}

async function firebaseWrite(key, val) {
  try {
    await firebaseSet(getDatabaseRef(key), val);
  } catch (err) {
    console.warn('Firebase write failed for', key, err);
  }
}

const DB = {
  get(key, fallback = null) {
    if (CACHE[key] !== undefined) return CACHE[key];
    const value = localGet(key, fallback);
    CACHE[key] = value;
    return value;
  },
  set(key, val) {
    CACHE[key] = val;
    localSet(key, val);
    if (FIREBASE_KEYS.has(key)) {
      firebaseWrite(key, val);
    }
  },
};

async function initializeFirebaseStorage() {
  const keys = ['nx_users', 'nx_posts', 'nx_messages', 'nx_notifications'];
  for (const key of keys) {
    const remoteValue = await firebaseRead(key);
    if (remoteValue !== null) {
      CACHE[key] = remoteValue;
      localSet(key, remoteValue);
    } else {
      const localValue = localGet(key, null);
      if (localValue !== null) {
        CACHE[key] = localValue;
        firebaseWrite(key, localValue);
      }
    }
  }
}

// ── Data Keys ──────────────────────────────────────────────
const KEYS = {
  USERS:         'nx_users',
  CURRENT:       'nx_current',
  POSTS:         'nx_posts',
  MESSAGES:      'nx_messages',
  NOTIFICATIONS: 'nx_notifications',
};

// ── Helpers ────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toast(msg) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
window.escHtml = escHtml;

// ── Data Access ────────────────────────────────────────────
function getUsers()    { return DB.get(KEYS.USERS, {}); }
function saveUsers(u)  { DB.set(KEYS.USERS, u); }
function getPosts()    { return DB.get(KEYS.POSTS, []); }
function savePosts(p)  { DB.set(KEYS.POSTS, p); }
function getMessages()      { return DB.get(KEYS.MESSAGES, {}); }
function saveMessages(m)      { DB.set(KEYS.MESSAGES, m); }
function getNotifications()   { return DB.get(KEYS.NOTIFICATIONS, []); }
function saveNotifications(n) { DB.set(KEYS.NOTIFICATIONS, n); }

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getCurrentUser() {
  const id = DB.get(KEYS.CURRENT);
  if (!id) return null;
  const user = getUsers()[id];
  if (!user) return null;
  return {
    ...user,
    followers: safeArray(user.followers),
    following: safeArray(user.following),
  };
}
function saveCurrentId(id) { DB.set(KEYS.CURRENT, id); }

function convKey(a, b) { return [a, b].sort().join('__'); }

function updateNotificationBadge(cu) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = getUserNotifications(cu.id).length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function addNotification(notification) {
  const notifs = getNotifications();
  notifs.unshift({
    id: uuid(),
    ts: Date.now(),
    ...notification,
  });
  saveNotifications(notifs.slice(0, 60));
  const cu = getCurrentUser();
  if (cu) updateNotificationBadge(cu);
}

function getUserNotifications(userId) {
  return getNotifications().filter(n => n.to === userId);
}


// ── Seed data ──────────────────────────────────────────────
function seedIfEmpty() {
  let users = getUsers();
  if (Object.keys(users).length === 0) {
    const demo = [
      { id: 'user_demo1', studentId: 'SP26BSSE0001', username: 'sara_khan',   displayName: 'Sara Khan',     bio: 'CS student @ FAST | Coffee addict ☕',           location: 'Lahore, Pakistan',     joinDate: 'September 2022', password: 'demo123', avatar: '', banner: '', followers: [], following: [], dob: '2001-05-15' },
      { id: 'user_demo2', studentId: 'SP26BSSE0002', username: 'ahmed_codes', displayName: 'Ahmed Ali',      bio: 'Full-stack dev | Open source | Building things 🛠️', location: 'Karachi, Pakistan',   joinDate: 'January 2023',   password: 'demo123', avatar: '', banner: '', followers: [], following: [], dob: '2000-11-22' },
      { id: 'user_demo3', studentId: 'SP26BSSE0003', username: 'fatima_dev',  displayName: 'Fatima Malik',   bio: 'UX Designer & Frontend dev | LUMS 2024',           location: 'Islamabad, Pakistan', joinDate: 'March 2021',     password: 'demo123', avatar: '', banner: '', followers: [], following: [], dob: '2002-03-08' },
    ];
    demo.forEach(u => { users[u.id] = u; });
    saveUsers(users);

    const now = Date.now();
    const posts = [
      { id: uuid(), authorId: 'user_demo1', text: 'Just submitted my final project! 🎉 Semester is finally over. Time to breathe again 😤',    timestamp: now - 3600000 * 2,  likes: ['user_demo2'],             retweets: [],              replies: [] },
      { id: uuid(), authorId: 'user_demo2', text: 'Hot take: Tabs > Spaces. I said what I said 😤\n\nFight me in the replies.',                  timestamp: now - 3600000 * 5,  likes: ['user_demo3','user_demo1'], retweets: ['user_demo3'],   replies: [] },
      { id: uuid(), authorId: 'user_demo3', text: 'Campus WiFi is down again and I have a submission in 20 mins. Classic. 🙃',                   timestamp: now - 86400000,      likes: ['user_demo1'],             retweets: [],              replies: [] },
      { id: uuid(), authorId: 'user_demo2', text: "Reminder: The hackathon registrations close TOMORROW at midnight. Don't miss out! Link in bio 🚀", timestamp: now - 86400000 * 2, likes: ['user_demo1','user_demo3'], retweets: ['user_demo1'],   replies: [] },
    ];
    savePosts(posts);
  }
}

// ── Auth ───────────────────────────────────────────────────
function register(studentId, username, displayName, password) {
  if (!studentId || !username || !password || !displayName) return { ok: false, err: 'All fields are required' };
  
  // Validate Student ID format: SP26BSSE0028 (2 letters + 2 digits + 4 letters + 4 digits)
  const studentIdRegex = /^[A-Z]{2}\d{2}[A-Z]{4}\d{4}$/;
  const cleanedStudentId = studentId.trim().toUpperCase();
  if (!studentIdRegex.test(cleanedStudentId)) {
    return { ok: false, err: 'Invalid Student ID format. Use format like SP26BSSE0028 (2 letters + 2 digits + 4 letters + 4 digits)' };
  }
  
  // Validate username length
  const cleanedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
  if (cleanedUsername.length < 4) {
    return { ok: false, err: 'Username must be at least 4 characters long' };
  }
  
  // Validate password length
  if (password.length < 6) {
    return { ok: false, err: 'Password must be at least 6 characters long' };
  }
  
  const users = getUsers();
  const studentIdTaken = Object.values(users).some(u => u.studentId === cleanedStudentId);
  if (studentIdTaken) return { ok: false, err: 'Student ID already registered' };
  
  const usernameTaken = Object.values(users).some(u => u.username === cleanedUsername);
  if (usernameTaken) return { ok: false, err: 'Username already taken' };
  
  const id = 'user_' + uuid();
  const user = {
    id, studentId: cleanedStudentId, username: cleanedUsername, displayName, password,
    bio: '', location: '',
    joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    avatar: '', banner: '', followers: [], following: [], dob: '',
  };
  users[id] = user;
  saveUsers(users);
  return { ok: true, user };
}

function login(studentIdOrEmail, password) {
  const searchValue = studentIdOrEmail.trim().toUpperCase();
  const users = getUsers();
  // Support both Student ID and email (legacy)
  const user = Object.values(users).find(u => 
    (u.studentId === searchValue || u.username === searchValue.toLowerCase()) && 
    u.password === password
  );
  if (!user) return { ok: false, err: 'Invalid Student ID or password' };
  saveCurrentId(user.id);
  return { ok: true, user };
}

function logout() {
  DB.set(KEYS.CURRENT, null);
  window.location.href = 'index.html';
}

// ── Post Actions ───────────────────────────────────────────
function createPost(authorId, text, imageData) {
  const post = { id: uuid(), authorId, text, image: imageData || null, timestamp: Date.now(), likes: [], retweets: [], replies: [] };
  const posts = getPosts();
  posts.unshift(post);
  savePosts(posts);
  return post;
}

function toggleLike(postId, userId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  post.likes = safeArray(post.likes);
  const idx = post.likes.indexOf(userId);
  const liked = idx === -1;
  if (liked) post.likes.push(userId); else post.likes.splice(idx, 1);
  savePosts(posts);
  if (liked && post.authorId !== userId) {
    addNotification({
      type: 'like',
      from: userId,
      to: post.authorId,
      postId: post.id,
      message: 'liked your post',
    });
  }
  return post;
}

function toggleRetweet(postId, userId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  post.retweets = safeArray(post.retweets);
  const idx = post.retweets.indexOf(userId);
  const reposted = idx === -1;
  if (reposted) post.retweets.push(userId); else post.retweets.splice(idx, 1);
  savePosts(posts);
  if (reposted && post.authorId !== userId) {
    addNotification({
      type: 'repost',
      from: userId,
      to: post.authorId,
      postId: post.id,
      message: 'reposted your post',
    });
  }
  return post;
}

function replyToPost(postId, fromId, text) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post || !text.trim()) return null;
  post.replies = safeArray(post.replies);
  const reply = { id: uuid(), from: fromId, text: text.trim(), ts: Date.now() };
  post.replies.push(reply);
  savePosts(posts);
  if (post.authorId !== fromId) {
    addNotification({
      type: 'comment',
      from: fromId,
      to: post.authorId,
      postId: post.id,
      message: 'commented on your post',
    });
  }
  return reply;
}

// ── Follow ─────────────────────────────────────────────────
function toggleFollow(actorId, targetId) {
  const users = getUsers();
  const actor  = users[actorId];
  const target = users[targetId];
  if (!actor || !target) return false;
  actor.following = safeArray(actor.following);
  target.followers = safeArray(target.followers);
  const already = actor.following.includes(targetId);
  if (already) {
    actor.following  = actor.following.filter(id => id !== targetId);
    target.followers = target.followers.filter(id => id !== actorId);
  } else {
    actor.following.push(targetId);
    target.followers.push(actorId);
    if (actorId !== targetId) {
      addNotification({
        type: 'follow',
        from: actorId,
        to: targetId,
        message: 'started following you',
      });
    }
  }
  saveUsers(users);
  return !already;
}

function isFollowing(actorId, targetId) {
  return getUsers()[actorId]?.following?.includes(targetId) || false;
}

// ── Messages ───────────────────────────────────────────────
function canChat(a, b) {
  return isFollowing(a, b) && isFollowing(b, a);
}

function sendMessage(fromId, toId, text) {
  if (!text.trim()) return;
  const msgs = getMessages();
  const key  = convKey(fromId, toId);
  if (!msgs[key]) msgs[key] = [];
  msgs[key].push({ id: uuid(), from: fromId, to: toId, text: text.trim(), ts: Date.now(), read: false });
  saveMessages(msgs);
}

function getConversation(a, b) {
  return getMessages()[convKey(a, b)] || [];
}

function markRead(a, b) {
  const msgs = getMessages();
  const key  = convKey(a, b);
  if (msgs[key]) msgs[key].forEach(m => { if (m.to === a) m.read = true; });
  saveMessages(msgs);
}

// ── Render Helpers ─────────────────────────────────────────
function getAvatarHtml(user, size = 40) {
  if (user?.avatar) {
    return `<img class="post-avatar" src="${user.avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`;
  }
  const initials = (user?.displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors   = ['#1d9bf0', '#00ba7c', '#f4212e', '#794bc4', '#ff7a00'];
  const color    = colors[(user?.username || '').charCodeAt(0) % colors.length];
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size * 0.35)}px;color:#fff;flex-shrink:0">${initials}</div>`;
}

function getColorForUser(user) {
  const colors = ['#1d9bf0', '#00ba7c', '#f4212e', '#794bc4', '#ff7a00', '#17bf63'];
  return colors[(user?.studentId || user?.username || '').charCodeAt(0) % colors.length];
}
window.getColorForUser = getColorForUser;

function getUserHandle(user) {
  return user?.studentId || user?.username || 'unknown';
}

// ── SVG Icons ──────────────────────────────────────────────
const ICONS = {
  home:            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12h3v9h5v-5h4v5h5v-9h3L12 2z"/></svg>`,
  explore:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  notif:           `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`,
  chat:            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
  profile:         `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  post_like:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  post_like_filled: `<svg viewBox="0 0 24 24" fill="#f4212e"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  post_reply:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  post_rt:          `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.77 15.67c-.22-.22-.59-.22-.81 0l-1.83 1.83V12h-1.5v5.5c0 .2.12.38.3.47.07.03.14.03.2.03.14 0 .27-.05.38-.16l2.26-2.26c.22-.22.22-.59 0-.81zM1.98 10.5c0-.2.12-.38.3-.47.07-.03.14-.03.2-.03.14 0 .27.05.38.16l2.26 2.26c.22.22.22.59 0 .81-.22.22-.59.22-.81 0L2.48 11.4V17h8.5v-1.5H3.98v-5h1.5l-2.26-2.26a.563.563 0 0 0-.94.29v.97zM22 2H6C4.9 2 4 2.9 4 4v5h1.5V4h16v12h-3.5v1.5H22c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
  post_share:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  post_views:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  repost_icon:      `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M23.77 15.67c-.22-.22-.59-.22-.81 0l-1.83 1.83V12h-1.5v5.5c0 .2.12.38.3.47.07.03.14.03.2.03.14 0 .27-.05.38-.16l2.26-2.26c.22-.22.22-.59 0-.81z"/></svg>`,
  send:             `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
  back:             `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`,
  location:         `<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;vertical-align:middle"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  calendar:         `<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;vertical-align:middle"><path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/></svg>`,
  camera:           `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2c-1.99 0-3.6-1.61-3.6-3.6s1.61-3.6 3.6-3.6 3.6 1.61 3.6 3.6-1.61 3.6-3.6 3.6zm7.8-10H4.2C3.54 5.2 3 5.74 3 6.4v13.2c0 .66.54 1.2 1.2 1.2h15.6c.66 0 1.2-.54 1.2-1.2V6.4c0-.66-.54-1.2-1.2-1.2zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zM9 3l-1.5 2h-2L7 3h2zm6 0l1.5 2h-2L13 3h2z"/></svg>`,
  dots:             `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
  compose_img:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  emoji:            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
};

// ============================================================
//  PAGE ROUTER
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initializeFirebaseStorage().catch(() => {});
  fetchCampusNews();
  setInterval(fetchCampusNews, 10 * 60 * 1000);
  seedIfEmpty();
  if (document.getElementById('auth-page'))    initAuthPage();
  if (document.getElementById('home-page'))    initHomePage();
  if (document.getElementById('profile-page')) initProfilePage();
});

// ============================================================
//  AUTH PAGE (index.html)
// ============================================================
function initAuthPage() {
  if (getCurrentUser()) { window.location.href = 'home.html'; return; }

  const tabs         = document.querySelectorAll('.auth-tab');
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
      }
    });
  });

  document.getElementById('login-submit')?.addEventListener('click', () => {
    const u   = document.getElementById('login-username').value.trim();
    const p   = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    const res = login(u, p);
    if (res.ok) { window.location.href = 'home.html'; }
    else { err.textContent = res.err; }
  });

  document.getElementById('login-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-submit')?.click();
  });

  document.getElementById('register-submit')?.addEventListener('click', () => {
    const dn  = document.getElementById('reg-displayname').value.trim();
    const sid = document.getElementById('reg-studentid').value.trim();
    const un  = document.getElementById('reg-username').value.trim();
    const p   = document.getElementById('reg-password').value;
    const err = document.getElementById('register-error');
    const suc = document.getElementById('register-success');
    err.textContent = ''; suc.textContent = '';
    const res = register(sid, un, dn, p);
    if (res.ok) {
      suc.textContent = 'Account created! Logging you in…';
      setTimeout(() => { login(sid, p); window.location.href = 'home.html'; }, 800);
    } else { err.textContent = res.err; }
  });
}

// ============================================================
//  HOME PAGE (home.html)
// ============================================================
function initHomePage() {
  const cu = getCurrentUser();
  if (!cu) { window.location.href = 'index.html'; return; }

  renderSidebar(cu);
  updateNotificationBadge(cu);
  renderRightSidebar(cu);
  renderFeed(cu, 'for-you');
  initCompose(cu);
  initChatPanel(cu);
  initSearch(cu);
  initNotificationModal(cu);

  document.querySelectorAll('.feed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderFeed(cu, tab.dataset.tab);
    });
  });

  // Scroll to specific post if coming from notification
  const scrollToPostId = sessionStorage.getItem('scroll_to_post');
  if (scrollToPostId) {
    sessionStorage.removeItem('scroll_to_post');
    setTimeout(() => {
      const postElement = document.querySelector(`[data-post-id="${scrollToPostId}"]`);
      if (postElement) {
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postElement.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
        setTimeout(() => { postElement.style.backgroundColor = ''; }, 2000);
      }
    }, 100);
  }
}

// ── Sidebar (shared) ────────────────────────────────────────
function renderSidebar(cu, activePage = 'home') {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  nav.innerHTML = `
    <li class="nav-item ${activePage === 'home' ? 'active' : ''}" id="nav-home">
      ${ICONS.home}<span class="nav-label">Home</span>
    </li>
    <li class="nav-item ${activePage === 'explore' ? 'active' : ''}" id="nav-explore">
      ${ICONS.explore}<span class="nav-label">Explore</span>
    </li>
    <li class="nav-item" id="nav-notif">
      ${ICONS.notif}<span class="nav-label">Notifications</span>
      <span class="notif-badge" id="notif-badge" style="display:none">0</span>
    </li>
    <li class="nav-item" id="chat-nav-btn">
      ${ICONS.chat}<span class="nav-label">Messages</span>
    </li>
    <li class="nav-item ${activePage === 'profile' ? 'active' : ''}" id="nav-profile">
      ${ICONS.profile}<span class="nav-label">Profile</span>
    </li>
  `;

  document.getElementById('nav-home')?.addEventListener('click',    () => window.location.href = 'home.html');
  document.getElementById('nav-explore')?.addEventListener('click', () => window.location.href = 'explore.html');
  document.getElementById('nav-profile')?.addEventListener('click', () => { sessionStorage.removeItem('view_profile_id'); window.location.href = 'profile.html'; });
  document.getElementById('nav-notif')?.addEventListener('click', () => {
    const modal = document.getElementById('notif-modal');
    if (modal) {
      modal.classList.add('open');
      renderNotifications(cu);
      // Clear notifications after viewing
      saveNotifications(getNotifications().filter(n => n.to !== cu.id));
      updateNotificationBadge(cu);
    }
  });
  document.getElementById('chat-nav-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('chat-panel');
    if (panel) { panel.classList.toggle('open'); renderChatList(cu); }
  });

  // User section (lower sidebar)
  const userSec = document.getElementById('sidebar-user');
  if (userSec) {
    userSec.innerHTML = `
      ${getAvatarHtml(cu, 40)}
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${escHtml(cu.displayName)}</div>
        <div class="sidebar-user-handle">@${escHtml(cu.username)}</div>
      </div>
      <div class="sidebar-user-dots">${ICONS.dots}</div>
      <div class="user-popup" id="user-popup">
        <div class="user-popup-item" id="goto-profile-btn">View profile</div>
        <div class="user-popup-item danger" id="logout-btn">Log out @${escHtml(cu.username)}</div>
      </div>
    `;
    userSec.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('user-popup')?.classList.toggle('open');
    });
    document.addEventListener('click', () => document.getElementById('user-popup')?.classList.remove('open'));
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('goto-profile-btn')?.addEventListener('click', () => {
      sessionStorage.removeItem('view_profile_id');
      window.location.href = 'profile.html';
    });
  }
}

// ── Compose ────────────────────────────────────────────────
function initCompose(cu) {
  // Replace avatar placeholder
  const avatarSlot = document.getElementById('compose-avatar');
  if (avatarSlot) {
    const avatarNode = document.createElement('div');
    avatarNode.innerHTML = getAvatarHtml(cu, 40);
    avatarNode.firstElementChild.id = 'compose-avatar';
    avatarSlot.replaceWith(avatarNode.firstElementChild);
  }

  const textarea   = document.getElementById('compose-text');
  const submitBtn  = document.getElementById('compose-submit');
  const imgInput   = document.getElementById('compose-img-input');
  const imgPreview = document.getElementById('compose-img-preview');
  if (!textarea || !submitBtn) return;

  let pendingImage = null;

  textarea.addEventListener('input', () => {
    submitBtn.disabled = textarea.value.trim().length === 0 && !pendingImage;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  document.getElementById('compose-img-btn')?.addEventListener('click', () => imgInput?.click());
  imgInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      pendingImage = r.result;
      if (imgPreview) { imgPreview.src = r.result; imgPreview.style.display = 'block'; }
      submitBtn.disabled = false;
    };
    r.readAsDataURL(file);
  });

  submitBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text && !pendingImage) return;
    createPost(cu.id, text, pendingImage);
    textarea.value = '';
    pendingImage = null;
    imgInput && (imgInput.value = '');
    if (imgPreview) { imgPreview.style.display = 'none'; imgPreview.src = ''; }
    submitBtn.disabled = true;
    textarea.style.height = 'auto';
    const activeTab = document.querySelector('.feed-tab.active')?.dataset.tab || 'for-you';
    renderFeed(cu, activeTab);
    toast('Post created!');
  });
}

// ── Feed ───────────────────────────────────────────────────
function renderFeed(cu, tab) {
  const container = document.getElementById('feed-posts');
  if (!container) return;
  let posts = getPosts();
  const users = getUsers();

  const following = safeArray(cu.following);
  if (tab === 'following') {
    posts = posts.filter(p => following.includes(p.authorId) || p.authorId === cu.id);
  }

  if (posts.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No posts yet</h3><p>${tab === 'following' ? 'Follow someone to see their posts here.' : 'Be the first to post something!'}</p></div>`;
    return;
  }

  container.innerHTML = posts.map(post => {
    const author = users[post.authorId];
    if (!author) return '';
    const likes    = safeArray(post.likes);
    const retweets = safeArray(post.retweets);
    const replies  = safeArray(post.replies);
    const isLiked  = likes.includes(cu.id);
    const isRt     = retweets.includes(cu.id);
    const rtById   = retweets.find(id => following.includes(id) && id !== post.authorId);
    const rtUser   = rtById ? users[rtById] : null;
    return `
      ${rtUser ? `<div class="repost-label">${ICONS.repost_icon} ${escHtml(rtUser.displayName)} reposted</div>` : ''}
      <div class="post-card" data-post-id="${post.id}">
        <div onclick="event.stopPropagation();visitProfile('${author.id}')" style="cursor:pointer">
          ${getAvatarHtml(author, 40)}
        </div>
        <div class="post-body">
          <div class="post-header">
            <span class="post-display-name">${escHtml(author.displayName)}</span>
            <span class="post-handle">@${escHtml(author.username)}</span>
            <span class="post-dot">·</span>
            <span class="post-time">${timeAgo(post.timestamp)}</span>
          </div>
          <div class="post-text">${escHtml(post.text)}</div>
          ${post.image ? `<img class="post-image" src="${post.image}" alt="">` : ''}
          <div class="post-actions">
            <button class="post-action${isLiked ? ' liked' : ''}" onclick="event.stopPropagation();handleLike('${post.id}')">
              ${isLiked ? ICONS.post_like_filled : ICONS.post_like}<span>${likes.length}</span>
            </button>
            <button class="post-action${isRt ? ' retweeted' : ''}" onclick="event.stopPropagation();handleRetweet('${post.id}')">
              ${ICONS.post_rt}<span>${retweets.length}</span>
            </button>
            <button class="post-action" onclick="event.stopPropagation();openReplyModal('${post.id}')">
              ${ICONS.post_reply}<span>${replies.length}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleLike(postId) {
  const cu = getCurrentUser(); if (!cu) return;
  toggleLike(postId, cu.id);
  // Re-render whatever context we're in
  if (document.getElementById('feed-posts')) {
    const tab = document.querySelector('.feed-tab.active')?.dataset.tab || 'for-you';
    renderFeed(cu, tab);
  }
  if (document.getElementById('profile-posts-container')) {
    const ptab = document.querySelector('.profile-tab.active')?.dataset.ptab || 'posts';
    const viewId = _currentProfileTargetId || cu.id;
    renderProfilePosts(cu, getUsers()[viewId], ptab);
  }
}
window.handleLike = handleLike;

function handleRetweet(postId) {
  const cu = getCurrentUser(); if (!cu) return;
  const post = toggleRetweet(postId, cu.id);
  if (document.getElementById('feed-posts')) {
    const tab = document.querySelector('.feed-tab.active')?.dataset.tab || 'for-you';
    renderFeed(cu, tab);
  }
  if (document.getElementById('profile-posts-container')) {
    const ptab = document.querySelector('.profile-tab.active')?.dataset.ptab || 'posts';
    const viewId = _currentProfileTargetId || cu.id;
    renderProfilePosts(cu, getUsers()[viewId], ptab);
  }
  toast(safeArray(post?.retweets).includes(cu.id) ? 'Reposted!' : 'Undo repost');
}
window.handleRetweet = handleRetweet;

function visitProfile(userId) {
  sessionStorage.setItem('view_profile_id', userId);
  window.location.href = 'profile.html';
}
window.visitProfile = visitProfile;

// ── Right Sidebar ──────────────────────────────────────────
function renderRightSidebar(cu) {
  renderSuggestedUsers(cu);
  renderCampusNews();
}

function renderNotifications(cu) {
  const modal = document.getElementById('notif-modal');
  const panel = document.getElementById('notif-panel');
  if (!panel || !modal) return;
  const items = getUserNotifications(cu.id);

  const users = getUsers();
  panel.innerHTML = `
    ${items.length === 0 ? `<div class="notif-empty">No notifications yet. When someone likes, reposts, comments on your post, or follows you, it will show here.</div>` : `
      <div class="notif-list">
        ${items.map(n => {
          const from = users[n.from];
          const icon = n.type === 'like' ? '❤️' : n.type === 'repost' ? '🔄' : n.type === 'comment' ? '💬' : '👤';
          const authorName = from ? escHtml(from.displayName) : 'Someone';
          const action = escHtml(n.message);
          const clickHandler = n.type === 'follow' 
            ? `onclick="handleNotificationClick('${n.from}', 'follow')"` 
            : `onclick="handleNotificationClick('${n.postId}', '${n.type}')"`;
          return `
            <div class="notif-item" ${clickHandler} style="cursor:pointer">
              <div class="notif-avatar">${getAvatarHtml(from, 40)}</div>
              <div class="notif-content">
                <div class="notif-icon">${icon}</div>
                <div class="notif-text"><strong>${authorName}</strong> ${action}</div>
                <div class="notif-time">${timeAgo(n.ts)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function handleNotificationClick(target, type) {
  const modal = document.getElementById('notif-modal');
  if (modal) modal.classList.remove('open');
  
  if (type === 'follow') {
    visitProfile(target);
  } else {
    const post = getPosts().find(p => p.id === target);
    if (post) {
      sessionStorage.setItem('scroll_to_post', target);
      window.location.href = 'home.html';
    }
  }
}
window.handleNotificationClick = handleNotificationClick;

function clearAllNotifications(cu) {
  saveNotifications(getNotifications().filter(n => n.to !== cu.id));
  updateNotificationBadge(cu);
  renderNotifications(cu);
}

function openNotificationModal(cu) {
  const modal = document.getElementById('notif-modal');
  if (modal) {
    modal.classList.add('open');
    renderNotifications(cu);
  }
}
window.openNotificationModal = openNotificationModal;

function openReplyModal(postId) {
  const cu = getCurrentUser();
  if (!cu) return;
  const post = getPosts().find(p => p.id === postId);
  if (!post) return;
  const users = getUsers();
  const author = users[post.authorId];
  const modal = document.getElementById('reply-modal');
  const title = document.getElementById('reply-summary');
  const list  = document.getElementById('reply-list');
  const input = document.getElementById('reply-input');
  const send  = document.getElementById('reply-send-btn');
  const close = document.getElementById('reply-modal-close');
  if (!modal || !input || !send || !list || !title || !close) return;

  modal.classList.add('open');
  title.innerHTML = `Replying to <strong>${escHtml(author?.displayName || 'a post')}</strong>`;
  input.value = '';
  send.disabled = true;
  renderReplyList(post);

  input.oninput = () => {
    send.disabled = input.value.trim().length === 0;
  };

  const handleSend = () => {
    const text = input.value.trim();
    if (!text) return;
    replyToPost(postId, cu.id, text);
    modal.classList.remove('open');
    renderReplyList(post);
    if (document.getElementById('feed-posts')) {
      const tab = document.querySelector('.feed-tab.active')?.dataset.tab || 'for-you';
      renderFeed(cu, tab);
    }
    if (document.getElementById('profile-posts-container')) {
      const ptab = document.querySelector('.profile-tab.active')?.dataset.ptab || 'posts';
      const viewId = _currentProfileTargetId || cu.id;
      renderProfilePosts(cu, getUsers()[viewId], ptab);
    }
    toast('Comment posted!');
  };

  send.onclick = handleSend;
  close.onclick = () => modal.classList.remove('open');
  modal.onclick = e => { if (e.target === modal) modal.classList.remove('open'); };
}

function renderReplyList(post) {
  const list = document.getElementById('reply-list');
  if (!list) return;
  const users = getUsers();
  const replies = safeArray(post.replies);
  if (replies.length === 0) {
    list.innerHTML = `<div class="reply-empty">No replies yet</div>`;
    return;
  }
  list.innerHTML = replies.map(reply => {
    const user = users[reply.from];
    return `
      <div class="reply-item">
        <div class="reply-item-title">${escHtml(user?.displayName || 'Someone')} · ${timeAgo(reply.ts)}</div>
        <div class="reply-item-text">${escHtml(reply.text)}</div>
      </div>
    `;
  }).join('');
}

function renderSuggestedUsers(cu) {
  const container = document.getElementById('suggest-users');
  if (!container) return;
  const users = getUsers();
  const following = safeArray(cu.following);
  const suggestions = Object.values(users)
    .filter(u => u.id !== cu.id && !following.includes(u.id))
    .slice(0, 3);

  if (suggestions.length === 0) {
    container.innerHTML = '<div style="padding:12px 16px;color:var(--text-muted);font-size:14px">You\'re following everyone!</div>';
    return;
  }
  container.innerHTML = suggestions.map(u => `
    <div class="suggest-item" onclick="visitProfile('${u.id}')">
      ${getAvatarHtml(u, 40).replace('class="post-avatar"', 'class="suggest-avatar"')}
      <div class="suggest-info">
        <div class="suggest-name">${escHtml(u.displayName)}</div>
        <div class="suggest-handle">@${escHtml(u.username)}</div>
      </div>
      <button class="btn-follow${isFollowing(cu.id, u.id) ? ' following' : ''}" id="follow-btn-${u.id}"
        onclick="event.stopPropagation();handleFollow('${u.id}')">
        ${isFollowing(cu.id, u.id) ? 'Following' : 'Follow'}
      </button>
    </div>
  `).join('');

  // wire 'Show more' to suggested users modal
  const widget = container.closest('.widget-card');
  if (widget) {
    const btn = widget.querySelector('.widget-show-more');
    if (btn) btn.onclick = () => { openSuggestedUsersModal(cu); };
  }
}

function openSuggestedUsersModal(cu) {
  const modal = document.getElementById('follow-modal');
  const title = document.getElementById('follow-modal-title');
  const list = document.getElementById('follow-modal-list');
  const subtitle = document.getElementById('follow-modal-subtitle');
  const backBtn = document.getElementById('follow-modal-back');
  const settingsBtn = document.getElementById('follow-modal-settings');
  
  if (!modal || !title || !list || !subtitle) return;

  const users = getUsers();
  const following = safeArray(cu.following);
  const suggestions = Object.values(users)
    .filter(u => u.id !== cu.id && !following.includes(u.id));

  title.textContent = 'Follow';
  subtitle.textContent = 'Suggested for you';

  if (suggestions.length === 0) {
    list.innerHTML = `<div class="follow-empty">No more suggestions available</div>`;
  } else {
    list.innerHTML = suggestions.map(u => {
      const isCurrentUserFollowing = cu.following.includes(u.id);
      return `
        <div class="follow-item" onclick="visitProfile('${u.id}')">
          ${getAvatarHtml(u, 48).replace('class="post-avatar"', 'class="follow-item-avatar"')}
          <div class="follow-item-info">
            <div class="follow-item-name">${escHtml(u.displayName)}</div>
            <div class="follow-item-handle">@${escHtml(u.username)}</div>
            <div class="follow-item-bio">${escHtml(u.bio || '')}</div>
          </div>
          <button class="btn-follow-modal${isCurrentUserFollowing ? ' following' : ''}" onclick="event.stopPropagation();handleFollowFromModal('${u.id}')">
            ${isCurrentUserFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('open');
  backBtn.onclick = () => modal.classList.remove('open');
  settingsBtn.onclick = () => { /* Settings functionality can be added later */ };
  modal.onclick = e => { if (e.target === modal) modal.classList.remove('open'); };
}
window.openSuggestedUsersModal = openSuggestedUsersModal;

function handleFollow(targetId) {
  const cu = getCurrentUser(); if (!cu) return;
  const nowFollowing = toggleFollow(cu.id, targetId);
  const freshCu = getCurrentUser();
  renderSuggestedUsers(freshCu);
  toast(nowFollowing ? 'Followed!' : 'Unfollowed');
}
window.handleFollow = handleFollow;

function openFollowModal(userId, type, displayName) {
  const modal = document.getElementById('follow-modal');
  const title = document.getElementById('follow-modal-title');
  const subtitle = document.getElementById('follow-modal-subtitle');
  const list = document.getElementById('follow-modal-list');
  const backBtn = document.getElementById('follow-modal-back');
  if (!modal || !title || !list || !backBtn) return;

  const users = getUsers();
  const user = users[userId];
  if (!user) return;

  const isFollowing = type === 'following';
  const ids = isFollowing ? user.following : user.followers;
  title.textContent = 'Follow';
  subtitle.textContent = isFollowing ? `${displayName}'s following` : `${displayName}'s followers`;

  if (ids.length === 0) {
    list.innerHTML = `<div class="follow-empty">${isFollowing ? 'Not following anyone yet' : 'No followers yet'}</div>`;
  } else {
    list.innerHTML = ids.map(id => {
      const u = users[id];
      if (!u) return '';
      const isCurrentUserFollowing = getCurrentUser()?.following?.includes(id) || false;
      return `
        <div class="follow-item" onclick="visitProfile('${id}')">
          ${getAvatarHtml(u, 48).replace('class="post-avatar"', 'class="follow-item-avatar"')}
          <div class="follow-item-info">
            <div class="follow-item-name">${escHtml(u.displayName)}</div>
            <div class="follow-item-handle">@${escHtml(u.username)}</div>
            <div class="follow-item-bio">${escHtml(u.bio || '')}</div>
          </div>
          <button class="btn-follow-modal${isCurrentUserFollowing ? ' following' : ''}" onclick="event.stopPropagation();handleFollowFromModal('${id}')">
            ${isCurrentUserFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('open');
  backBtn.onclick = () => modal.classList.remove('open');
  modal.onclick = e => { if (e.target === modal) modal.classList.remove('open'); };
}
window.openFollowModal = openFollowModal;

function handleFollowFromModal(targetId) {
  const cu = getCurrentUser(); if (!cu) return;
  const nowFollowing = toggleFollow(cu.id, targetId);
  const btn = event.target;
  btn.textContent = nowFollowing ? 'Following' : 'Follow';
  btn.className = `btn-follow-modal${nowFollowing ? ' following' : ''}`;
  toast(nowFollowing ? 'Followed!' : 'Unfollowed');
}
window.handleFollowFromModal = handleFollowFromModal;

function parsePublishedAt(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

const GNEWS_URL = 'https://gnews.io/api/v4/search?q=Karachi+University+Students&lang=en&sortby=publishedAt&token=66b9f8e4ac65981c7c3b1dc68ccddf18';

async function fetchCampusNews() {
  try {
    const res = await fetch(GNEWS_URL);
    if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
    const json = await res.json();
    const articles = Array.isArray(json.articles) ? json.articles.map(a => ({
      title: a.title || 'Untitled news',
      description: a.description || 'No description available.',
      source: a.source?.name || 'Unknown source',
      publishedAt: a.publishedAt || '',
      url: a.url || '#'
    })) : [];
    CACHE['campusNews'] = articles;
    renderCampusNews();
    if (document.getElementById('explore-news-list')) renderExplorePage();
  } catch (err) {
    console.warn('Campus news fetch failed', err);
    CACHE['campusNews'] = [];
    renderCampusNews();
    if (document.getElementById('explore-news-list')) renderExplorePage();
  }
}

function renderCampusNews() {
  const container = document.getElementById('campus-news');
  if (!container) return;
  const items = CACHE['campusNews'] || [];
  const slice = items.slice(0, 4);
  if (slice.length === 0) {
    container.innerHTML = '<div class="small">No recent campus news found.</div>';
  } else {
    container.innerHTML = slice.map(item => {
      const time = item.publishedAt ? timeAgo(parsePublishedAt(item.publishedAt)) : 'just now';
      return `
      <div class="news-item">
        <div class="news-item-title">${escHtml(item.title)}</div>
        <div class="news-item-body small">${escHtml(item.description)}</div>
        <div class="news-item-time small">${escHtml(item.source)} · ${escHtml(time)}</div>
        <a class="news-read-more" href="${escAttr(item.url)}" target="_blank" rel="noreferrer">Read more</a>
      </div>
    `;
    }).join('');
  }
  const widget = container.closest('.widget-card');
  if (widget) {
    const btn = widget.querySelector('.widget-show-more');
    if (btn) btn.onclick = () => { window.location.href = 'explore.html'; };
  }
}

function renderExplorePage() {
  const listEl = document.getElementById('explore-news-list');
  if (!listEl) return;
  const items = CACHE['campusNews'] || [];
  if (items.length === 0) {
    listEl.innerHTML = '<div class="small">No recent campus news found.</div>';
    return;
  }
  listEl.innerHTML = items.map(item => {
    const time = item.publishedAt ? timeAgo(parsePublishedAt(item.publishedAt)) : 'just now';
    return `
      <div class="news-item">
        <div class="news-item-title">${escHtml(item.title)}</div>
        <div class="news-item-body small">${escHtml(item.description)}</div>
        <div class="meta">${escHtml(item.source)} · ${escHtml(time)}</div>
        <a class="news-read-more" href="${escAttr(item.url)}" target="_blank" rel="noreferrer">Read more</a>
      </div>
    `;
  }).join('');
}

function renderUserList() {
  const listEl = document.getElementById('users-list');
  if (!listEl) return;
  const users = Object.values(getUsers() || {});
  if (users.length === 0) { listEl.innerHTML = '<div class="small">No users.</div>'; return; }
  listEl.innerHTML = users.map(u => `<div class="news-item"><div><strong>${escHtml(u.displayName)}</strong> · @${escHtml(u.username)}</div><div class="meta">${escHtml(u.bio||'')}</div></div>`).join('');
  const suggestContainer = document.getElementById('suggest-users');
  if (suggestContainer) {
    const widget = suggestContainer.closest('.widget-card');
    if (widget) {
      const btn = widget.querySelector('.widget-show-more');
      if (btn) btn.onclick = () => { window.location.href = 'users.html'; };
    }
  }
}

// ── Search ─────────────────────────────────────────────────
function initSearch(cu) {
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('open'); return; }
    const users = getUsers();
    const matches = Object.values(users).filter(u =>
      u.id !== cu.id &&
      (u.username.includes(q) || u.displayName.toLowerCase().includes(q))
    ).slice(0, 6);

    if (matches.length === 0) { results.classList.remove('open'); return; }
    results.innerHTML = matches.map(u => `
      <div class="search-result-item" onclick="visitProfile('${u.id}')">
        ${getAvatarHtml(u, 36).replace('class="post-avatar"', 'class="search-result-avatar"')}
        <div>
          <div class="search-result-name">${escHtml(u.displayName)}</div>
          <div class="search-result-handle">@${escHtml(u.username)}</div>
        </div>
      </div>
    `).join('');
    results.classList.add('open');
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.classList.remove('open');
  });
}

// ── Chat Panel ─────────────────────────────────────────────
function initChatPanel(cu) {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  renderChatList(cu);
  document.getElementById('chat-close-btn')?.addEventListener('click', () => panel.classList.remove('open'));
}

function initNotificationModal(cu) {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;
  document.getElementById('notif-modal-close')?.addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('notif-modal-back')?.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });
}

let _activeChatPartnerId = null;

function renderChatList(cu, preserveThread = false) {
  const list   = document.getElementById('chat-list');
  const thread = document.getElementById('chat-thread');
  if (!list) return;
  if (!preserveThread && thread) { thread.classList.remove('open'); thread.innerHTML = ''; }
  list.style.display = (_activeChatPartnerId && preserveThread) ? 'none' : '';

  const users  = getUsers();
  const mutual = Object.values(users).filter(u => u.id !== cu.id && canChat(cu.id, u.id));

  if (mutual.length === 0) {
    list.innerHTML = `<div class="no-chat-access"><p>Follow someone who follows you back to start chatting.</p></div>`;
    return;
  }

  const msgs = getMessages();
  list.innerHTML = mutual.map(u => {
    const conv   = msgs[convKey(cu.id, u.id)] || [];
    const last   = conv[conv.length - 1];
    const unread = conv.filter(m => m.to === cu.id && !m.read).length;
    return `
      <div class="chat-conv-item${u.id === _activeChatPartnerId ? ' active' : ''}" onclick="openThread('${u.id}')">
        ${getAvatarHtml(u, 44).replace('class="post-avatar"', 'class="chat-conv-avatar"')}
        <div class="chat-conv-info">
          <div class="chat-conv-name">${escHtml(u.displayName)}</div>
          <div class="chat-conv-last">${last ? escHtml(last.text) : 'Start a conversation'}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-left:auto">
          ${last ? `<div class="chat-conv-time">${timeAgo(last.ts)}</div>` : ''}
          ${unread > 0 ? `<div class="chat-unread">${unread}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}
window.renderChatList = renderChatList;

let _chatPollInterval = null;

function openThread(partnerId) {
  const cu      = getCurrentUser();
  const users   = getUsers();
  const partner = users[partnerId];
  if (!partner || !cu) return;

  _activeChatPartnerId = partnerId;
  markRead(cu.id, partnerId);

  const list   = document.getElementById('chat-list');
  const thread = document.getElementById('chat-thread');
  if (list)   list.style.display = 'none';
  if (!thread) return;

  thread.classList.add('open');
  thread.innerHTML = `
    <div class="chat-thread-header">
      <button class="chat-back-btn" onclick="closeChatThread()">${ICONS.back}</button>
      ${getAvatarHtml(partner, 36).replace('class="post-avatar"', 'class="chat-thread-avatar"')}
      <div>
        <div class="chat-thread-name">${escHtml(partner.displayName)}</div>
        <div class="chat-thread-status">@${escHtml(partner.username)}</div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages-inner"></div>
    <div class="chat-input-area">
      <textarea class="chat-input" id="chat-msg-input" placeholder="Start a message" rows="1"></textarea>
      <button class="chat-send-btn" id="chat-send-btn" disabled>${ICONS.send}</button>
    </div>
  `;

  renderThreadMessages(cu, partnerId);

  const msgInput = document.getElementById('chat-msg-input');
  const sendBtn  = document.getElementById('chat-send-btn');

  msgInput?.addEventListener('input', () => {
    sendBtn.disabled = msgInput.value.trim().length === 0;
    msgInput.style.height = 'auto';
    const maxHeight = 120;
    const newHeight = Math.min(msgInput.scrollHeight, maxHeight);
    msgInput.style.height = newHeight + 'px';
    msgInput.style.overflowY = msgInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
  });
  msgInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
  });
  sendBtn?.addEventListener('click', () => {
    const text = msgInput.value.trim();
    if (!text) return;
    sendMessage(cu.id, partnerId, text);
    msgInput.value = '';
    msgInput.style.height = 'auto';
    sendBtn.disabled = true;
    renderThreadMessages(cu, partnerId);
    renderChatList(cu, true);
  });

  // Poll for new messages every 2s
  if (_chatPollInterval) clearInterval(_chatPollInterval);
  _chatPollInterval = setInterval(() => {
    const cu2 = getCurrentUser();
    if (!cu2 || !document.getElementById('chat-messages-inner')) { clearInterval(_chatPollInterval); return; }
    markRead(cu2.id, partnerId);
    renderThreadMessages(cu2, partnerId);
  }, 2000);
}
window.openThread = openThread;

function renderThreadMessages(cu, partnerId) {
  const inner = document.getElementById('chat-messages-inner');
  if (!inner) return;
  const msgs    = getConversation(cu.id, partnerId);
  const atBottom = inner.scrollHeight - inner.scrollTop - inner.clientHeight < 40;

  if (msgs.length === 0) {
    inner.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px">Say hello! 👋</div>`;
    return;
  }
  inner.innerHTML = msgs.map(m => {
    const isSent = m.from === cu.id;
    return `
      <div class="msg-group ${isSent ? 'sent' : 'received'}">
        <div class="msg-bubble ${isSent ? 'sent' : 'received'}">${escHtml(m.text)}</div>
        <div class="msg-time">${timeAgo(m.ts)}</div>
      </div>
    `;
  }).join('');

  if (atBottom) inner.scrollTop = inner.scrollHeight;
}

function closeChatThread() {
  if (_chatPollInterval) { clearInterval(_chatPollInterval); _chatPollInterval = null; }
  _activeChatPartnerId = null;
  const cu = getCurrentUser();
  if (cu) renderChatList(cu);
}
window.closeChatThread = closeChatThread;

// ============================================================
//  PROFILE PAGE (profile.html)
// ============================================================
let _currentProfileTargetId = null;

function initProfilePage() {
  const cu = getCurrentUser();
  if (!cu) { window.location.href = 'index.html'; return; }

  const viewId = sessionStorage.getItem('view_profile_id');
  const users  = getUsers() || {};
  let target = cu;
  if (viewId && users[viewId]) {
    target = users[viewId];
  }
  if (!target || !target.id) {
    target = cu;
  }
  const isOwn  = target.id === cu.id;

  _currentProfileTargetId = target.id;
  sessionStorage.removeItem('view_profile_id');

  renderSidebar(cu, isOwn ? 'profile' : 'home');
  updateNotificationBadge(cu);
  renderProfileContent(cu, target, isOwn);
  initChatPanel(cu);
  initNotificationModal(cu);
  if (isOwn) initEditProfileModal(cu);
}

function renderProfileContent(cu, target, isOwn) {
  const main = document.getElementById('profile-main');
  if (!main) return;

  target = {
    id: target?.id || cu?.id || 'unknown',
    displayName: target?.displayName || 'Unknown user',
    username: target?.username || 'unknown',
    bio: target?.bio || '',
    location: target?.location || '',
    joinDate: target?.joinDate || '',
    avatar: target?.avatar || '',
    banner: target?.banner || '',
    followers: Array.isArray(target?.followers) ? target.followers : [],
    following: Array.isArray(target?.following) ? target.following : [],
  };

  const following = isFollowing(cu.id, target.id);
  const postCount = getPosts().filter(p => p.authorId === target.id).length;
  const avatarBg  = getColorForUser(target);
  const initials  = (target.displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  main.innerHTML = `
    <!-- Header -->
    <div class="feed-header">
      <div class="feed-header-inner">
        <button onclick="history.back()" class="back-btn-header">${ICONS.back}</button>
        <div>
          <div class="feed-title">${escHtml(target.displayName)}</div>
          <div style="color:var(--text-muted);font-size:13px">${postCount} post${postCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>

    <!-- Banner -->
    <div class="profile-banner" id="profile-banner">
      ${target.banner ? `<img src="${target.banner}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}
      ${isOwn ? `<div class="profile-banner-overlay"></div><button class="banner-edit-btn" id="banner-edit-btn">${ICONS.camera} Change banner</button>` : ''}
    </div>

    <!-- Info -->
    <div class="profile-info-section">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="profile-avatar-wrap">
          ${target.avatar
            ? `<img class="profile-avatar" src="${target.avatar}" alt="">`
            : `<div class="profile-avatar" style="background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:#fff">${initials}</div>`
          }
          ${isOwn ? `<div class="avatar-edit-btn" id="avatar-edit-btn">${ICONS.camera}<span style="font-size:11px">Edit</span></div>` : ''}
        </div>
        <div style="margin-top:16px">
          ${isOwn
            ? `<button class="btn-edit-profile" id="edit-profile-btn">Edit profile</button>`
            : `<button class="btn-follow${following ? ' following' : ''}" id="follow-profile-btn" onclick="handleProfileFollow('${target.id}')">${following ? 'Following' : 'Follow'}</button>`
          }
        </div>
      </div>

      <div class="profile-display-name">${escHtml(target.displayName)}</div>
      <div class="profile-handle">@${escHtml(target.username)}</div>
      <div class="profile-bio">${target.bio ? escHtml(target.bio) : '<span style="color:var(--text-muted)">No bio yet.</span>'}</div>

      <div class="profile-meta">
        ${target.location ? `<span class="profile-meta-item">${ICONS.location} ${escHtml(target.location)}</span>` : ''}
        <span class="profile-meta-item">${ICONS.calendar} Joined ${escHtml(target.joinDate)}</span>
      </div>

      <div class="profile-stats">
        <div class="profile-stat" onclick="openFollowModal('${target.id}', 'following', '${escHtml(target.displayName)}')"><strong>${target.following.length}</strong> <span>Following</span></div>
        <div class="profile-stat" onclick="openFollowModal('${target.id}', 'followers', '${escHtml(target.displayName)}')"><strong>${target.followers.length}</strong> <span>Followers</span></div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="profile-tabs">
      <div class="profile-tab active" data-ptab="posts">Posts</div>
      <div class="profile-tab" data-ptab="reposts">Reposts</div>
      <div class="profile-tab" data-ptab="replies">Replies</div>
    </div>
    <div id="profile-posts-container"></div>
  `;

  renderProfilePosts(cu, target, 'posts');

  main.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      main.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderProfilePosts(cu, target, tab.dataset.ptab);
    });
  });

  if (isOwn) {
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      document.getElementById('edit-profile-modal')?.classList.add('open');
    });
    document.getElementById('avatar-edit-btn')?.addEventListener('click', () => {
      document.getElementById('edit-profile-modal')?.classList.add('open');
    });
    document.getElementById('banner-edit-btn')?.addEventListener('click', () => {
      document.getElementById('edit-profile-modal')?.classList.add('open');
    });
  }
}

function handleProfileFollow(targetId) {
  const cu = getCurrentUser(); if (!cu) return;
  const nowFollowing = toggleFollow(cu.id, targetId);
  const btn = document.getElementById('follow-profile-btn');
  if (btn) {
    btn.textContent = nowFollowing ? 'Following' : 'Follow';
    btn.className   = `btn-follow${nowFollowing ? ' following' : ''}`;
  }
  // Refresh follower count display
  const freshTarget = getUsers()[targetId];
  if (freshTarget) {
    const stats = document.querySelectorAll('.profile-stat strong');
    // re-render the whole content to get fresh counts
    renderProfileContent(cu, freshTarget, false);
  }
  toast(nowFollowing ? 'Followed!' : 'Unfollowed');
}
window.handleProfileFollow = handleProfileFollow;

function renderProfilePosts(cu, target, tab) {
  const container = document.getElementById('profile-posts-container');
  if (!container || !target) return;
  const posts = getPosts();
  const users = getUsers();

  let filtered;
  if (tab === 'posts') {
    filtered = posts.filter(p => p.authorId === target.id);
  } else if (tab === 'reposts') {
    filtered = posts.filter(p => safeArray(p.retweets).includes(target.id) && p.authorId !== target.id);
  } else if (tab === 'replies') {
    filtered = posts.filter(p => {
      const replies = safeArray(p.replies);
      const hasUserReply = replies.some(r => r.from === target.id);
      const isUserPost = p.authorId === target.id;
      return hasUserReply || isUserPost;
    });
  } else {
    filtered = [];
  }

  if (filtered.length === 0) {
    const emptyMessages = {
      posts: 'No posts yet',
      reposts: 'No reposts yet',
      replies: 'No replies yet'
    };
    container.innerHTML = `<div class="empty-state">
      <h3>${emptyMessages[tab] || 'No items'}</h3>
      <p>${tab === 'posts' && target.id === cu.id ? 'Share something with the world!' : ''}</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(post => {
    const author  = users[post.authorId];
    if (!author) return '';
    const likes    = safeArray(post.likes);
    const retweets = safeArray(post.retweets);
    const replies  = safeArray(post.replies);
    const isLiked  = likes.includes(cu.id);
    const isRt     = retweets.includes(cu.id);
    return `
      <div class="post-card">
        <div onclick="visitProfile('${author.id}')" style="cursor:pointer">
          ${getAvatarHtml(author, 40)}
        </div>
        <div class="post-body">
          <div class="post-header">
            <span class="post-display-name">${escHtml(author.displayName)}</span>
            <span class="post-handle">@${escHtml(author.username)}</span>
            <span class="post-dot">·</span>
            <span class="post-time">${timeAgo(post.timestamp)}</span>
          </div>
          <div class="post-text">${escHtml(post.text)}</div>
          ${post.image ? `<img class="post-image" src="${post.image}" alt="">` : ''}
          <div class="post-actions">
            <button class="post-action${isLiked ? ' liked' : ''}" onclick="handleLike('${post.id}')">
              ${isLiked ? ICONS.post_like_filled : ICONS.post_like}<span>${likes.length}</span>
            </button>
            <button class="post-action${isRt ? ' retweeted' : ''}" onclick="handleRetweet('${post.id}')">
              ${ICONS.post_rt}<span>${retweets.length}</span>
            </button>
            <button class="post-action" onclick="openReplyModal('${post.id}')">
              ${ICONS.post_reply}<span>${replies.length}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
window.renderProfilePosts = renderProfilePosts;
window.getCurrentUser    = getCurrentUser;
window.getUsers          = getUsers;

// Expose commonly-used handlers to the global `window` so inline
// `onclick` attributes in the HTML/templates can call them when
// `app.js` is loaded as a module.
window.openReplyModal = openReplyModal;
window.handleLike = handleLike;
window.handleRetweet = handleRetweet;
window.visitProfile = visitProfile;
window.handleNotificationClick = handleNotificationClick;
window.openNotificationModal = openNotificationModal;
window.handleFollow = handleFollow;
window.handleFollowFromModal = handleFollowFromModal;
window.openFollowModal = openFollowModal;
window.handleProfileFollow = handleProfileFollow;
window.openThread = openThread;
window.closeChatThread = closeChatThread;
window.renderChatList = renderChatList;
window.sendMessage = sendMessage;
window.toggleLike = toggleLike;
window.toggleRetweet = toggleRetweet;
window.replyToPost = replyToPost;
window.renderCampusNews = renderCampusNews;
window.renderSuggestedUsers = renderSuggestedUsers;
window.initSearch = initSearch;
window.renderExplorePage = renderExplorePage;
window.renderUserList = renderUserList;

// ── Edit Profile Modal ─────────────────────────────────────
function initEditProfileModal(cu) {
  const modal = document.getElementById('edit-profile-modal');
  if (!modal) return;

  // Fresh user data every time
  const freshCu = getCurrentUser();

  // Populate fields
  const dnInput  = document.getElementById('ep-displayname');
  const unInput  = document.getElementById('ep-username');
  const bioInput = document.getElementById('ep-bio');
  const locInput = document.getElementById('ep-location');
  if (dnInput)  dnInput.value  = freshCu.displayName || '';
  if (unInput)  unInput.value  = freshCu.username    || '';
  if (bioInput) bioInput.value = freshCu.bio         || '';
  if (locInput) locInput.value = freshCu.location    || '';

  const avatarImg = document.getElementById('ep-avatar-img');
  const bannerImg = document.getElementById('ep-banner-img');
  if (avatarImg && freshCu.avatar) { avatarImg.src = freshCu.avatar; }
  if (bannerImg && freshCu.banner) { bannerImg.src = freshCu.banner; bannerImg.style.display = 'block'; }

  // Remove previous listeners by cloning nodes
  const closeBtn = document.getElementById('ep-close');
  if (closeBtn) {
    const newClose = closeBtn.cloneNode(true);
    closeBtn.replaceWith(newClose);
    newClose.addEventListener('click', () => modal.classList.remove('open'));
  }

  const backdrop = modal._backdropHandler;
  if (backdrop) modal.removeEventListener('click', backdrop);
  const newBackdrop = e => { if (e.target === modal) modal.classList.remove('open'); };
  modal._backdropHandler = newBackdrop;
  modal.addEventListener('click', newBackdrop);

  // Avatar upload
  const avatarClick = document.getElementById('ep-avatar-click');
  if (avatarClick) {
    avatarClick.onclick = () => {
      const input = document.getElementById('ep-avatar-input');
      input?.click();
    };
  }
  const avatarInput = document.getElementById('ep-avatar-input');
  if (avatarInput) {
    avatarInput.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => { document.getElementById('ep-avatar-img').src = r.result; };
      r.readAsDataURL(file);
    };
  }

  // Banner upload
  const bannerClick = document.getElementById('ep-banner-click');
  if (bannerClick) {
    bannerClick.onclick = () => {
      const input = document.getElementById('ep-banner-input');
      input?.click();
    };
  }
  const bannerInput = document.getElementById('ep-banner-input');
  if (bannerInput) {
    bannerInput.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        const img = document.getElementById('ep-banner-img');
        if (img) { img.src = r.result; img.style.display = 'block'; }
      };
      r.readAsDataURL(file);
    };
  }

  // Save
  const saveBtn = document.getElementById('ep-save');
  if (saveBtn) {
    const newSave = saveBtn.cloneNode(true);
    saveBtn.replaceWith(newSave);
    newSave.addEventListener('click', () => {
      const displayName = document.getElementById('ep-displayname')?.value.trim();
      const username    = document.getElementById('ep-username')?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const bio         = document.getElementById('ep-bio')?.value.trim();
      const location    = document.getElementById('ep-location')?.value.trim();
      const avatarSrc   = document.getElementById('ep-avatar-img')?.src;
      const bannerSrc   = document.getElementById('ep-banner-img')?.src;

      if (!displayName || !username) { toast('Name and username are required'); return; }
      if (username.length < 3)       { toast('Username must be at least 3 characters'); return; }

      const users  = getUsers();
      const taken  = Object.values(users).some(u => u.username === username && u.id !== freshCu.id);
      if (taken) { toast('Username already taken'); return; }

      users[freshCu.id].displayName = displayName;
      users[freshCu.id].username    = username;
      users[freshCu.id].bio         = bio      || '';
      users[freshCu.id].location    = location || '';

      // Only store data URIs (actual uploaded images), not page URLs
      if (avatarSrc && avatarSrc.startsWith('data:')) users[freshCu.id].avatar = avatarSrc;
      if (bannerSrc && bannerSrc.startsWith('data:')) users[freshCu.id].banner = bannerSrc;

      saveUsers(users);
      modal.classList.remove('open');
      toast('Profile updated!');

      const updatedCu = getCurrentUser();
      _currentProfileTargetId = updatedCu.id;
      renderSidebar(updatedCu, 'profile');
      renderProfileContent(updatedCu, users[updatedCu.id], true);
      initEditProfileModal(updatedCu);
    });
  }
}