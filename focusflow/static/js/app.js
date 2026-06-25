/* ════════════════════════════════════════════════
   FocusFlow — app.js
   ════════════════════════════════════════════════ */

// ── TIMER STATE ──────────────────────────────────
let timerInterval  = null;
let timerSeconds   = 25 * 60;
let timerDuration  = 25 * 60;
let timerRunning   = false;
let currentCat     = 'all';

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
];

// ── BOOT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setDateLabels();
  loadQuote();
  loadStats();
  loadDashboardTasks();
  loadDashboardGoals();
  loadSessions();
  loadTodayNote();
  updateTimerDisplay();
  updateRing();
  setupMoodPicker();
  requestNotificationPermission();
  setInterval(loadStats, 60000);
  setInterval(checkReminders, 5 * 60000);
});

// ── HELPERS ──────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, type = 'info') {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3500);
}

async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── NAVIGATION ───────────────────────────────────
function showSection(name, btnEl) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = $('sec-' + name);
  if (sec) sec.classList.add('active');
  if (btnEl) btnEl.classList.add('active');

  if (name === 'tasks')     loadTasks();
  if (name === 'goals')     loadGoals();
  if (name === 'focus')     { loadSessions(); refreshFocusStats(); }
  if (name === 'notes')     loadTodayNote();
  if (name === 'dashboard') { loadStats(); loadDashboardTasks(); loadDashboardGoals(); }

  if (window.innerWidth <= 700) $('sidebar').classList.remove('open');
}

function toggleSidebar() { $('sidebar').classList.toggle('open'); }

// ── DATE ─────────────────────────────────────────
function setDateLabels() {
  const fmt = new Date().toLocaleDateString('en-IN',
    { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  setText('topbar-date', fmt);
  setText('notes-date', fmt);
}

// ── QUOTE ────────────────────────────────────────
function loadQuote() {
  const q = QUOTES[new Date().getDate() % QUOTES.length];
  setText('quote-text',   '"' + q.text + '"');
  setText('quote-author', '— ' + q.author);
}

// ── STATS ────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api('GET', '/api/stats');
    setText('stat-done',    s.completed_today);
    setText('stat-pending', s.pending);
    setText('stat-overdue', s.overdue);
    setText('stat-focus',   s.focus_minutes_today + 'm');
    setText('stat-goals',   s.goals_active);
    setText('stat-streak',  s.streak);
    setText('streak-num',   s.streak);
    const b = $('badge-tasks');
    if (b) b.textContent = s.pending > 0 ? s.pending : '';
  } catch(e) { console.error('Stats:', e); }
}

// ── TASKS ─────────────────────────────────────────
async function loadTasks() {
  const showDone = $('show-completed') && $('show-completed').checked;
  let url = '/api/tasks?completed=' + (showDone ? 'true' : 'false');
  if (currentCat !== 'all') url += '&category=' + currentCat;
  try {
    const tasks = await api('GET', url);
    renderTasks(tasks, 'tasks-list');
  } catch(e) { console.error('Load tasks:', e); }
}

async function loadDashboardTasks() {
  try {
    const tasks = await api('GET', '/api/tasks?completed=false');
    const el = $('dash-tasks');
    if (!el) return;
    const top = tasks.slice(0, 5);
    if (!top.length) {
      el.innerHTML = '<div class="empty">🎉 All caught up for today!</div>';
      return;
    }
    el.innerHTML = top.map(t => `
      <div class="dash-row">
        <span class="dot ${t.priority}"></span>
        <span class="dash-title">${esc(t.title)}</span>
        ${t.due_time ? `<span class="dash-time">${t.due_time}</span>` : ''}
      </div>`).join('');
  } catch(e) { console.error(e); }
}

function renderTasks(tasks, containerId) {
  const el = $(containerId);
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = '<div class="empty">📭 No tasks. Click "+ Add Task" above!</div>';
    return;
  }
  const catLabel = { study:'📖 Study', project:'💻 Project', revision:'🔄 Revision', personal:'🙋 Personal' };
  el.innerHTML = tasks.map(t => {
    const tags = (t.tags || '').split(',').map(s=>s.trim()).filter(Boolean);
    return `
    <div class="task-card ${t.completed ? 'done' : ''} ${t.is_overdue ? 'overdue' : ''}" id="tc-${t.id}">
      <button class="chk ${t.completed ? 'checked' : ''}" onclick="toggleTask(${t.id}, ${!t.completed})">
        ${t.completed ? '✓' : ''}
      </button>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
        <div class="task-meta">
          <span class="cat-badge cat-${t.category}">${catLabel[t.category] || t.category}</span>
          <span class="pri-badge pri-${t.priority}">${t.priority}</span>
          ${t.due_date ? `<span class="due ${t.is_overdue?'overdue-txt':''}">📅 ${t.due_date}${t.due_time?' '+t.due_time:''}</span>` : ''}
          ${tags.map(tg=>`<span class="tag">${esc(tg)}</span>`).join('')}
        </div>
      </div>
      <div class="task-actions">
        <button onclick="openEditTask(${t.id})" title="Edit">✏️</button>
        <button onclick="deleteTask(${t.id})" title="Delete" class="del">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function filterTasks(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTasks();
}

async function toggleTask(id, completed) {
  try {
    await api('PUT', '/api/tasks/' + id, { completed });
    loadTasks();
    loadStats();
    loadDashboardTasks();
    toast(completed ? '✅ Task completed!' : '↩ Reopened', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api('DELETE', '/api/tasks/' + id);
    const el = $('tc-' + id);
    if (el) el.remove();
    loadStats();
    toast('🗑️ Deleted', 'info');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── TASK MODAL ────────────────────────────────────
let editTaskId = null;

function openAddTask() {
  editTaskId = null;
  setText('modal-task-title', 'Add Task');
  clearForm(['t-title','t-desc','t-tags','t-time']);
  $('t-cat').value  = 'study';
  $('t-pri').value  = 'medium';
  $('t-date').value = todayISO();
  openModal('modal-task');
  $('t-title').focus();
}

async function openEditTask(id) {
  try {
    const tasks = await api('GET', '/api/tasks');
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    editTaskId = id;
    setText('modal-task-title', 'Edit Task');
    $('t-title').value = t.title;
    $('t-desc').value  = t.description;
    $('t-cat').value   = t.category;
    $('t-pri').value   = t.priority;
    $('t-date').value  = t.due_date || '';
    $('t-time').value  = t.due_time || '';
    $('t-tags').value  = t.tags || '';
    openModal('modal-task');
    $('t-title').focus();
  } catch(e) { toast('Could not load task', 'error'); }
}

async function saveTask() {
  const title = ($('t-title').value || '').trim();
  if (!title) { toast('⚠️ Please enter a task title', 'error'); $('t-title').focus(); return; }

  const payload = {
    title,
    description: $('t-desc').value  || '',
    category:    $('t-cat').value   || 'study',
    priority:    $('t-pri').value   || 'medium',
    due_date:    $('t-date').value  || '',
    due_time:    $('t-time').value  || '',
    tags:        $('t-tags').value  || '',
  };

  try {
    if (editTaskId) {
      await api('PUT', '/api/tasks/' + editTaskId, payload);
      toast('✅ Task updated!', 'success');
    } else {
      await api('POST', '/api/tasks', payload);
      toast('✅ Task added!', 'success');
    }
    closeModal('modal-task');
    loadTasks();
    loadStats();
    loadDashboardTasks();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── GOALS ─────────────────────────────────────────
async function loadGoals() {
  try {
    const goals = await api('GET', '/api/goals');
    renderGoals(goals, 'goals-list');
  } catch(e) { console.error(e); }
}

async function loadDashboardGoals() {
  try {
    const goals = await api('GET', '/api/goals');
    const el = $('dash-goals');
    if (!el) return;
    const active = goals.filter(g => !g.completed).slice(0, 4);
    if (!active.length) {
      el.innerHTML = '<div class="empty">🚀 Add your first learning goal!</div>';
      return;
    }
    el.innerHTML = active.map(g => `
      <div class="dash-goal">
        <div class="dg-row">
          <span class="dg-title">${esc(g.title)}</span>
          <span class="dg-pct">${g.progress}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:${g.progress}%"></div></div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

function renderGoals(goals, containerId) {
  const el = $(containerId);
  if (!el) return;
  if (!goals.length) {
    el.innerHTML = '<div class="empty">🚀 No goals yet. Click "+ Add Goal"!</div>';
    return;
  }
  el.innerHTML = goals.map(g => {
    const res = Array.isArray(g.resources) ? g.resources : [];
    return `
    <div class="goal-card ${g.completed ? 'done' : ''}" id="gc-${g.id}">
      <div class="goal-top">
        <div class="goal-title">${esc(g.title)}</div>
        <div class="goal-actions">
          <button onclick="openEditGoal(${g.id})" title="Edit">✏️</button>
          <button onclick="deleteGoal(${g.id})" title="Delete" class="del">🗑️</button>
        </div>
      </div>
      ${g.description ? `<div class="goal-desc">${esc(g.description)}</div>` : ''}
      <div class="prog-bar" style="margin:.75rem 0 .35rem"><div class="prog-fill" id="pf-${g.id}" style="width:${g.progress}%"></div></div>
      <div class="prog-labels">
        <span>Progress</span>
        <span id="pct-${g.id}">${g.progress}%</span>
      </div>
      <input type="range" min="0" max="100" value="${g.progress}"
        oninput="liveProgress(${g.id}, this.value)"
        onchange="saveProgress(${g.id}, this.value)"
        class="slider" />
      ${g.target_date ? `<div class="goal-target">🎯 Target: ${g.target_date}</div>` : ''}
      ${res.length ? `<div class="goal-links">${res.map(r => {
        try { return `<a href="${esc(r)}" target="_blank">🔗 ${new URL(r).hostname}</a>`; }
        catch(e) { return `<a href="${esc(r)}" target="_blank">🔗 Link</a>`; }
      }).join('')}</div>` : ''}
      <button class="mark-btn" onclick="toggleGoal(${g.id}, ${!g.completed})">
        ${g.completed ? '↩ Reopen' : '✓ Mark Complete'}
      </button>
    </div>`;
  }).join('');
}

function liveProgress(id, val) {
  const pf  = $('pf-'  + id);
  const pct = $('pct-' + id);
  if (pf)  pf.style.width  = val + '%';
  if (pct) pct.textContent = val + '%';
}

async function saveProgress(id, val) {
  try {
    await api('PUT', '/api/goals/' + id, { progress: parseInt(val) });
    loadDashboardGoals();
    loadStats();
  } catch(e) { console.error(e); }
}

async function toggleGoal(id, completed) {
  try {
    await api('PUT', '/api/goals/' + id, { completed });
    loadGoals();
    loadStats();
    if (completed) toast('🎉 Goal completed! Great work!', 'success');
    else toast('↩ Goal reopened', 'info');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  try {
    await api('DELETE', '/api/goals/' + id);
    const el = $('gc-' + id);
    if (el) el.remove();
    loadStats();
    toast('🗑️ Goal deleted', 'info');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── GOAL MODAL ────────────────────────────────────
let editGoalId = null;

function openAddGoal() {
  editGoalId = null;
  setText('modal-goal-title', 'Add Learning Goal');
  clearForm(['g-title','g-desc','g-resources']);
  $('g-target').value   = '';
  $('g-progress').value = 0;
  openModal('modal-goal');
  $('g-title').focus();
}

async function openEditGoal(id) {
  try {
    const goals = await api('GET', '/api/goals');
    const g = goals.find(x => x.id === id);
    if (!g) return;
    editGoalId = id;
    setText('modal-goal-title', 'Edit Goal');
    $('g-title').value     = g.title;
    $('g-desc').value      = g.description;
    $('g-target').value    = g.target_date || '';
    $('g-progress').value  = g.progress || 0;
    const res = Array.isArray(g.resources) ? g.resources : [];
    $('g-resources').value = res.join('\n');
    openModal('modal-goal');
    $('g-title').focus();
  } catch(e) { toast('Could not load goal', 'error'); }
}

async function saveGoal() {
  const title = ($('g-title').value || '').trim();
  if (!title) { toast('⚠️ Please enter a goal title', 'error'); $('g-title').focus(); return; }

  const resRaw   = ($('g-resources').value || '').trim();
  const resources = resRaw ? resRaw.split('\n').map(s=>s.trim()).filter(Boolean) : [];

  const payload = {
    title,
    description: $('g-desc').value     || '',
    target_date: $('g-target').value   || '',
    progress:    parseInt($('g-progress').value || 0),
    resources,
  };

  try {
    if (editGoalId) {
      await api('PUT', '/api/goals/' + editGoalId, payload);
      toast('🚀 Goal updated!', 'success');
    } else {
      await api('POST', '/api/goals', payload);
      toast('🚀 Goal added!', 'success');
    }
    closeModal('modal-goal');
    loadGoals();
    loadDashboardGoals();
    loadStats();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── FOCUS TIMER ───────────────────────────────────
function setMode(min, btn) {
  if (timerRunning) { toast('Stop current session first', 'error'); return; }
  timerDuration = min * 60;
  timerSeconds  = timerDuration;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateTimerDisplay();
  updateRing();
}

function updateTimerDisplay() {
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  setText('timer-time', m + ':' + s);
}

function updateRing() {
  const ring = $('ring');
  if (!ring) return;
  const C   = 2 * Math.PI * 88;
  const pct = timerSeconds / timerDuration;
  ring.style.strokeDasharray  = C;
  ring.style.strokeDashoffset = C * (1 - pct);
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  $('btn-start').style.display = 'none';
  $('btn-pause').style.display = 'inline-flex';

  timerInterval = setInterval(async () => {
    timerSeconds--;
    updateTimerDisplay();
    updateRing();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      $('btn-start').style.display = 'inline-flex';
      $('btn-pause').style.display = 'none';
      timerSeconds = timerDuration;
      updateTimerDisplay();
      updateRing();
      // save completed session
      const label = ($('focus-label').value || '').trim() || 'Focus Session';
      try {
        await api('POST', '/api/sessions', {
          duration_minutes: Math.round(timerDuration / 60),
          task_label: label,
          completed: true
        });
      } catch(e) {}
      toast('🎉 Session complete! Take a break.', 'success');
      sendBrowserNotif('Session done! Time for a break. 🎉');
      loadSessions();
      refreshFocusStats();
      loadStats();
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerRunning = false;
  $('btn-start').style.display = 'inline-flex';
  $('btn-pause').style.display = 'none';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning  = false;
  timerSeconds  = timerDuration;
  $('btn-start').style.display = 'inline-flex';
  $('btn-pause').style.display = 'none';
  updateTimerDisplay();
  updateRing();
}

async function loadSessions() {
  try {
    const sessions = await api('GET', '/api/sessions');
    const el = $('sessions-list');
    if (!el) return;
    if (!sessions.length) {
      el.innerHTML = '<div class="empty">No sessions yet. Start your first!</div>';
      return;
    }
    el.innerHTML = sessions.slice(0, 15).map(s => {
      const d = new Date(s.started_at);
      const t = d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
      const dt = d.toLocaleDateString('en-IN', { month:'short', day:'numeric' });
      return `
      <div class="sess-item">
        <div class="sess-label">${esc(s.task_label || 'Focus Session')} — ${s.duration_minutes}m</div>
        <div class="sess-meta">${dt} at ${t} ${s.completed ? '✅' : '⏸'}</div>
      </div>`;
    }).join('');
  } catch(e) {}
}

async function refreshFocusStats() {
  try {
    const s = await api('GET', '/api/stats');
    setText('sess-count',  Math.floor(s.focus_minutes_today / 25));
    setText('focus-today', s.focus_minutes_today + 'm');
  } catch(e) {}
}

// ── NOTES ─────────────────────────────────────────
async function loadTodayNote() {
  try {
    const note = await api('GET', '/api/notes/today');
    const ta = $('notes-ta');
    if (ta) ta.value = note.content || '';
    setActiveMood(note.mood || 'neutral');
  } catch(e) {}
}

async function saveNote() {
  const content = ($('notes-ta') || {}).value || '';
  const mood    = (document.querySelector('.mood-btn.active') || {}).dataset?.mood || 'neutral';
  try {
    await api('PUT', '/api/notes/today', { content, mood });
    toast('💾 Notes saved!', 'success');
  } catch(e) { toast('Error saving notes', 'error'); }
}

function insertSnip(text) {
  const ta = $('notes-ta');
  if (!ta) return;
  const pos = ta.selectionStart;
  ta.value  = ta.value.slice(0, pos) + text + ta.value.slice(pos);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = pos + text.length;
}

// ── MOOD ──────────────────────────────────────────
function setupMoodPicker() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveMood(btn.dataset.mood);
      setTimeout(saveNote, 200);
    });
  });
}

function setActiveMood(mood) {
  document.querySelectorAll('.mood-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mood === mood));
}

// ── MODAL HELPERS ─────────────────────────────────
function openModal(id) {
  const el = $(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('open');
}
function overlayClick(e, id) {
  if (e.target === $(id)) closeModal(id);
}
function clearForm(ids) {
  ids.forEach(id => { const el = $(id); if (el) el.value = ''; });
}

// ── COPY ──────────────────────────────────────────
function copyBlock(btn) {
  const pre = btn.previousElementSibling;
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent.trim()).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

function copyLinkedIn() {
  const el = $('li-post');
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() =>
    toast('📋 LinkedIn post copied!', 'success'));
}

// ── REMINDERS ─────────────────────────────────────
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendBrowserNotif(msg) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('FocusFlow ⚡', { body: msg });
  }
}

async function checkReminders() {
  try {
    const tasks = await api('GET', '/api/tasks');
    const now   = new Date();
    tasks.forEach(t => {
      if (!t.due_date || !t.due_time || t.completed) return;
      const due     = new Date(t.due_date + 'T' + t.due_time);
      const diffMin = (due - now) / 60000;
      if (diffMin > 0 && diffMin <= 30) {
        sendBrowserNotif(`"${t.title}" is due in ${Math.round(diffMin)} minutes!`);
      }
    });
  } catch(e) {}
}

// ── KEYBOARD ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal('modal-task'); closeModal('modal-goal'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const active = document.querySelector('.section.active');
    if (active && active.id === 'sec-notes') saveNote();
  }
});
