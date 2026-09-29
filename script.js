(() => {
const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [a, b, c] = s.split('-'); return new Date(+a, b - 1, +c); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmt = s => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const blank = () => ({ holidays: [], attended: [], holidayNames: {}, leaveReasons: {}, startDate: null, endDate: null, endAuto: true, extra: [], off: [], academicYear: '' });
const list = a => a.map(([name, date]) => ({ name, date }));

/* ---------- Education levels ---------- */
const YOUNG = new Set(['LKG', 'UKG', '1', '2', '3', '4', '5']);
const LEVELS = {
  school: [
    { id: 'LKG', label: 'LKG' }, { id: 'UKG', label: 'UKG' },
    { id: '1', label: '1st' }, { id: '2', label: '2nd' }, { id: '3', label: '3rd' }, { id: '4', label: '4th' }, { id: '5', label: '5th' },
    { id: '6', label: '6th' }, { id: '7', label: '7th' }, { id: '8', label: '8th' }, { id: '9', label: '9th' }, { id: '10', label: '10th' },
    { id: '11', label: '11th / Inter 1st Year' }, { id: '12', label: '12th / Inter 2nd Year' }
  ],
  college: Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1), label: `Semester ${i + 1}` }))
};
const TERMS = {
  school: { level: 'Class', leave: 'Leave', workingDays: 'School days', attended: 'Present', summaryTitle: 'This class' },
  college: { level: 'Semester', leave: 'College Leave', workingDays: 'Working days', attended: 'Attended', summaryTitle: 'This semester' }
};

let D = {
  version: 2,
  settings: {
    darkMode: 'system', eduType: 'college', levelId: '1',
    targetPercent: 75, extraPenalty: 0,
    reminderEnabled: false, reminderTime: '18:00', lastReminded: null, periodicSyncOn: false
  },
  profiles: {},
  staticHolidays: list([["New Year's Day", '01-01'], ['Republic Day', '01-26'], ['Ambedkar Jayanti', '04-14'], ['Independence Day', '08-15'], ['Gandhi Jayanti', '10-02'], ['Christmas Day', '12-25']]),
  dynamicHolidays: list([['Radha Saptami', '2026-01-25'], ['Maha Shivaratri', '2026-02-15'], ['Holi', '2026-03-03'], ['Ugadi', '2026-03-19'], ['Ramzan', '2026-03-21'], ['Sri Rama Navami', '2026-03-27'], ['Good Friday', '2026-04-03'], ['Bakrid (Eid al-Adha)', '2026-05-28'], ['Muharram', '2026-06-26'], ['Varalakshmi Vratam', '2026-08-21'], ['Milad-un-Nabi', '2026-08-26'], ['Krishna Janmashtami', '2026-09-04'], ["Teachers' Day", '2026-09-05'], ['Vinayaka Chavithi', '2026-09-14'], ['Vijayadashami', '2026-10-20'], ['Diwali', '2026-11-08']]),
  bulkHolidays: [{ name: 'Sankranti', startDate: '2026-01-11', endDate: '2026-01-17' }]
};
let sel = today(), view = new Date(); view.setDate(1);

/* ---------- Load + migrate (never delete old data) ---------- */
try {
  const v = JSON.parse(localStorage.getItem('attendanceData'));
  if (v) {
    D = { ...D, ...v, settings: { ...D.settings, ...v.settings } };
    if (!v.profiles) {
      // Migrating from the pre-school-support version, which stored D.semesters[1..8]
      D.profiles = {};
      if (v.semesters) for (let i = 1; i <= 8; i++) if (v.semesters[i]) D.profiles['college-' + i] = Object.assign(blank(), v.semesters[i]);
      D.settings.eduType = 'college';
      D.settings.levelId = String(v.settings && v.settings.lastSelectedSem || '1');
      D.legacySemesters = v.semesters || null; // kept, never deleted, just unused going forward
    }
  }
} catch (e) {}
if (!LEVELS[D.settings.eduType]) D.settings.eduType = 'college';
if (!LEVELS[D.settings.eduType].some(l => l.id === D.settings.levelId)) D.settings.levelId = LEVELS[D.settings.eduType][0].id;

const profileId = () => `${D.settings.eduType}-${D.settings.levelId}`;
const cur = () => (D.profiles[profileId()] = Object.assign(blank(), D.profiles[profileId()]));
const terms = () => TERMS[D.settings.eduType];
const isYoung = () => D.settings.eduType === 'school' && YOUNG.has(D.settings.levelId);
const save = () => { try { localStorage.setItem('attendanceData', JSON.stringify(D)); } catch (e) {} };

/* ---------- Single source of truth for day status ---------- */
const holName = (ds, s) => {
  const n = [];
  D.staticHolidays.forEach(h => h.date === ds.slice(5) && n.push(h.name));
  D.dynamicHolidays.forEach(h => h.date === ds && n.push(h.name));
  D.bulkHolidays.forEach(h => ds >= h.startDate && ds <= h.endDate && n.push(h.name));
  if (s.holidays.includes(ds)) n.push(s.holidayNames[ds] || terms().leave);
  return n.join(', ');
};
const natural = (ds, s) => parse(ds).getDay() !== 0 && !holName(ds, s);
const working = (ds, s) => !!s.startDate && ds >= s.startDate && ds <= s.endDate && !s.off.includes(ds) && (s.extra.includes(ds) || natural(ds, s));

function syncEnd(s) {
  if (s.endAuto || !s.endDate) s.endDate = today();
  if (s.startDate && s.endDate < s.startDate) s.endDate = s.startDate;
}
function stats(s) {
  let wd = 0, hd = 0, at = 0;
  if (s.startDate) for (let d = s.startDate; d <= s.endDate; d = addDays(d, 1)) {
    if (working(d, s)) { wd++; s.attended.includes(d) && at++; }
    else if (parse(d).getDay() !== 0 && holName(d, s)) hd++;
  }
  const p = wd ? at / wd * 100 : 0;
  return { wd, hd, at, p };
}

/* Bunk / attend calculator: T is a fraction (0-1) */
function bunkCalc(st, T) {
  const { wd, at } = st;
  if (!wd) return { mode: 'none' };
  if (at >= T * wd) return { mode: 'safe', n: Math.max(0, Math.floor(at / T - wd)) };
  return { mode: 'need', n: Math.ceil((T * wd - at) / (1 - T)) };
}
/* Dynamic percentage-drop-per-absence: impact of the NEXT working day being a miss */
function dropImpact(st, extra) {
  if (!st.wd) return null;
  const cur = st.p;
  const nextP = Math.max(0, st.at / (st.wd + 1) * 100 - extra);
  return { cur, nextP, dropPts: cur - nextP };
}

/* ---------- UI helpers ---------- */
let tt; const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200); };
const strip = (s, ds) => { s.extra = s.extra.filter(d => d !== ds); s.off = s.off.filter(d => d !== ds); s.holidays = s.holidays.filter(d => d !== ds); delete s.leaveReasons[ds]; };
const drop = (a, ds) => a.filter(d => d !== ds);

function applyTheme() {
  const m = D.settings.darkMode, dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function renderCalendar(s) {
  const y = view.getFullYear(), m = view.getMonth(), t = today();
  $('month-year').textContent = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  let h = '<div class="d empty"></div>'.repeat(new Date(y, m, 1).getDay());
  for (let i = 1, n = new Date(y, m + 1, 0).getDate(); i <= n; i++) {
    const ds = `${y}-${pad(m + 1)}-${pad(i)}`, w = working(ds, s), at = w && s.attended.includes(ds);
    let c = 'd';
    if (parse(ds).getDay() === 0) c += ' sun';
    if (!w && holName(ds, s)) c += ' hol';
    if (w) c += ' wd';
    if (at) c += ' at'; else if (w && ds < t) c += ' ab';
    if (ds === t) c += ' today';
    if (ds === sel) c += ' sel';
    h += `<button class="${c}" data-d="${ds}" aria-label="${fmt(ds)}">${i}</button>`;
  }
  $('calendar-grid').innerHTML = h;
}

function renderTarget(st) {
  const T = D.settings.targetPercent / 100;
  const banner = $('target-banner'), msg = $('target-msg');
  $('target-value').textContent = D.settings.targetPercent + '%';
  $('bar-target').style.left = Math.min(100, D.settings.targetPercent) + '%';
  banner.classList.remove('good', 'warn');
  if (!st.wd) { const t = 'Set a start date to see your target status.'; msg.textContent = t; $('target-detail').textContent = t; return; }
  const c = bunkCalc(st, T);
  let text;
  if (c.mode === 'safe') {
    text = c.n > 0 ? `You can miss ${c.n} more day${c.n === 1 ? '' : 's'} and stay at or above ${D.settings.targetPercent}%.`
                   : `You're exactly at ${D.settings.targetPercent}% — one more absence will drop you below it.`;
    banner.classList.add('good');
  } else {
    text = `Attend the next ${c.n} working day${c.n === 1 ? '' : 's'} in a row to reach ${D.settings.targetPercent}%.`;
    banner.classList.add('warn');
  }
  msg.textContent = text;
  $('target-detail').textContent = text;
}

function renderDrop(st) {
  const banner = $('drop-banner'), extra = D.settings.extraPenalty || 0;
  const d = dropImpact(st, extra);
  if (!d) { banner.hidden = true; $('drop-detail').textContent = 'Set a start date to see this.'; return; }
  banner.hidden = false;
  const text = `Missing your next working day would drop you from ${d.cur.toFixed(2)}% to ${d.nextP.toFixed(2)}% (−${d.dropPts.toFixed(2)} pts).`;
  $('drop-msg').textContent = text;
  $('drop-detail').textContent = text + (extra ? ` Includes your configured ${extra} pt penalty.` : '');
}

function renderProjection(s, st) {
  const block = $('projection-block'), t = today();
  if (s.endAuto || !s.startDate || s.endDate <= t) { block.hidden = true; return; }
  let remaining = 0;
  for (let d = addDays(t, 1); d <= s.endDate; d = addDays(d, 1)) if (natural(d, s) || (s.extra.includes(d) && !s.off.includes(d))) remaining++;
  if (!remaining) { block.hidden = true; return; }
  const best = ((st.at + remaining) / (st.wd + remaining) * 100).toFixed(2);
  const worst = (st.at / (st.wd + remaining) * 100).toFixed(2);
  const T = D.settings.targetPercent / 100;
  const need = Math.ceil(T * (st.wd + remaining) - st.at);
  block.hidden = false;
  $('projection-detail').textContent = need <= remaining
    ? `${remaining} working day${remaining === 1 ? '' : 's'} left until ${fmt(s.endDate)}. Attend at least ${Math.max(0, need)} of them to finish at ${D.settings.targetPercent}% or above. Best case ${best}%, worst case ${worst}%.`
    : `${remaining} working day${remaining === 1 ? '' : 's'} left until ${fmt(s.endDate)}. Even attending all of them caps you at ${best}%, below your ${D.settings.targetPercent}% target.`;
}

function applyTerms() {
  const T = terms();
  $('level-label').textContent = T.level;
  $('attend-label').textContent = T.attended === 'Present' ? 'Present days' : 'Attendance';
  $('leave-label').textContent = T.leave;
  $('attend-chip-label').textContent = T.attended;
  $('legend-at').textContent = T.attended;
  $('wd-label').textContent = T.workingDays;
  $('attended-label').textContent = `Days ${T.attended.toLowerCase()}`;
  $('summary-title').textContent = T.summaryTitle;
  $('parent-note').hidden = !isYoung();
  $('target-banner').style.display = isYoung() ? 'none' : '';
  $('drop-banner').style.display = isYoung() ? 'none' : '';
  $('target-block').style.display = isYoung() ? 'none' : '';
  document.querySelectorAll('.seg').forEach(b => b.setAttribute('aria-selected', b.dataset.edu === D.settings.eduType));
}

function populateLevel() {
  $('level').innerHTML = LEVELS[D.settings.eduType].map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  $('level').value = D.settings.levelId;
}

function render() {
  const s = cur(); syncEnd(s);
  const st = stats(s);
  applyTerms();
  $('start-date').value = s.startDate || '';
  $('end-date').value = s.endDate || '';
  $('end-date').disabled = s.endAuto;
  $('auto-end').checked = s.endAuto;
  $('attendance-display').textContent = `${st.at} / ${st.wd} days`;
  $('percentage-display').textContent = `${st.p.toFixed(2)}%`;
  $('bar-fill').style.width = Math.min(100, st.p) + '%';
  $('total-working-days').textContent = st.wd;
  $('total-holidays').textContent = st.hd;
  $('total-attended').textContent = st.at;
  $('modal-percentage').textContent = `${st.p.toFixed(2)}%`;
  $('academic-year').value = s.academicYear || '';
  renderCalendar(s);
  if (!isYoung()) { renderTarget(st); renderDrop(st); renderProjection(s, st); } else { $('projection-block').hidden = true; }
  const names = [parse(sel).getDay() === 0 ? 'Sunday' : '', holName(sel, s)].filter(Boolean).join(', ');
  $('today-date').textContent = (sel === today() ? 'Today · ' : '') + fmt(sel);
  $('holiday-name-display').textContent = names;
  $('working-day').checked = working(sel, s);
  const onLeave = s.holidays.includes(sel);
  $('college-leave').checked = onLeave;
  $('went-to-college').checked = working(sel, s) && s.attended.includes(sel);
  $('leave-reason-wrap').hidden = !onLeave;
  const r = s.leaveReasons[sel] || {};
  $('leave-reason-type').value = r.reason || '';
  $('leave-reason-note').value = r.note || '';
  $('reminder-status').textContent = D.settings.reminderEnabled ? `Reminders are on, daily at ${D.settings.reminderTime}.` : 'Reminders are off.';
  save();
}

function renderHolidays() {
  const ul = $('holiday-list'); ul.innerHTML = '';
  const add = (k, i, name, when) => {
    const li = document.createElement('li'), d = document.createElement('div'), b = document.createElement('button'), sm = document.createElement('small');
    d.className = 'nm'; d.textContent = name; sm.textContent = when; d.appendChild(sm);
    b.textContent = '✕'; b.dataset.k = k; b.dataset.i = i; b.setAttribute('aria-label', 'Delete ' + name);
    li.append(d, b); ul.appendChild(li);
  };
  D.bulkHolidays.forEach((h, i) => add('bulkHolidays', i, h.name, `${h.startDate} to ${h.endDate}`));
  D.dynamicHolidays.forEach((h, i) => add('dynamicHolidays', i, h.name, h.date));
  D.staticHolidays.forEach((h, i) => add('staticHolidays', i, h.name, `${h.date} · every year`));
}

/* ---------- Day actions ---------- */
function setWorking(s, ds, on) {
  strip(s, ds);
  if (on && !natural(ds, s)) s.extra.push(ds);
  if (!on) { s.attended = drop(s.attended, ds); if (natural(ds, s)) s.off.push(ds); }
  if (on && ds > s.endDate) { s.endDate = ds; s.endAuto = false; toast('End date extended to ' + fmt(ds)); }
}
$('working-day').onchange = e => { setWorking(cur(), sel, e.target.checked); render(); };
$('college-leave').onchange = e => {
  const s = cur();
  if (e.target.checked) { setWorking(s, sel, false); s.holidays.push(sel); s.holidayNames[sel] = terms().leave; }
  else strip(s, sel);
  render();
};
$('went-to-college').onchange = e => {
  const s = cur();
  if (e.target.checked) {
    if (sel > today()) { e.target.checked = false; return toast("Can't mark a future date as attended"); }
    if (!s.startDate) { e.target.checked = false; return toast('Set the start date first'); }
    if (!working(sel, s)) setWorking(s, sel, true);
    s.attended.push(sel);
  } else s.attended = drop(s.attended, sel);
  render();
};
const saveLeaveReason = () => {
  const s = cur();
  if (!s.holidays.includes(sel)) return;
  const reason = $('leave-reason-type').value, note = $('leave-reason-note').value.trim();
  if (reason || note) s.leaveReasons[sel] = { reason, note }; else delete s.leaveReasons[sel];
  save(); toast('Leave reason saved');
};
$('leave-reason-type').onchange = saveLeaveReason;
$('leave-reason-note').onchange = saveLeaveReason;
$('leave-reason-clear').onclick = () => { $('leave-reason-type').value = ''; $('leave-reason-note').value = ''; delete cur().leaveReasons[sel]; save(); toast('Leave reason cleared'); };

/* ---------- Range ---------- */
$('start-date').onchange = e => { const s = cur(); s.startDate = e.target.value || null; render(); };
$('end-date').onchange = e => {
  const s = cur(), v = e.target.value || today();
  if (s.startDate && v < s.startDate) { toast('End date must not be before start date'); render(); return; }
  s.endDate = v; s.endAuto = false; render();
};
$('auto-end').onchange = e => { const s = cur(); s.endAuto = e.target.checked; if (s.endAuto) toast('End date now follows today automatically'); render(); };
$('academic-year').onchange = e => { cur().academicYear = e.target.value.trim(); save(); };

/* ---------- Calendar interaction ---------- */
$('calendar-grid').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { sel = b.dataset.d; render(); } };
const move = n => { view.setMonth(view.getMonth() + n); render(); };
[['prev-month', -1], ['next-month', 1]].forEach(([id, n]) => {
  const b = $(id); let t1, t2;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  b.onpointerdown = () => { move(n); t1 = setTimeout(() => t2 = setInterval(() => move(n), 140), 450); };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
  b.onclick = e => { if (e.detail === 0) move(n); };
});

/* ---------- Education toggle + level ---------- */
document.querySelectorAll('.seg').forEach(b => b.onclick = () => {
  D.settings.eduType = b.dataset.edu;
  if (!LEVELS[D.settings.eduType].some(l => l.id === D.settings.levelId)) D.settings.levelId = LEVELS[D.settings.eduType][0].id;
  populateLevel(); render();
});
$('level').onchange = e => { D.settings.levelId = e.target.value; render(); };
populateLevel();

/* ---------- Settings ---------- */
$('settings-btn').onclick = () => { $('settings-page').hidden = false; renderHolidays(); };
$('back-btn').onclick = () => { $('settings-page').hidden = true; };
$('target-edit').onclick = () => { $('settings-page').hidden = false; renderHolidays(); $('target-percent').focus(); };
$('dark-mode-select').onchange = e => { D.settings.darkMode = e.target.value; applyTheme(); save(); };
$('target-percent').onchange = e => { D.settings.targetPercent = Math.min(100, Math.max(1, parseInt(e.target.value) || 75)); e.target.value = D.settings.targetPercent; render(); };
$('extra-penalty').onchange = e => { D.settings.extraPenalty = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); e.target.value = D.settings.extraPenalty; render(); };
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
$('holiday-list').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  D[b.dataset.k].splice(+b.dataset.i, 1); renderHolidays(); render();
};

/* ---------- Add holiday dialog ---------- */
const dlg = $('hol-dlg');
const openDlg = () => { $('holiday-name').value = ''; $('holiday-start').value = $('holiday-end').value = sel; $('holiday-yearly').checked = false; dlg.showModal(); };
$('add-holiday-btn').onclick = openDlg;
$('settings-add-holiday').onclick = openDlg;
$('hol-cancel').onclick = () => dlg.close();
$('holiday-start').onchange = e => { if ($('holiday-end').value < e.target.value) $('holiday-end').value = e.target.value; };
$('hol-form').onsubmit = () => {
  const name = $('holiday-name').value.trim(), a = $('holiday-start').value, b = $('holiday-end').value;
  if (!name || !a || !b) return;
  if (b < a) { toast('End date must not be before start date'); return; }
  if (a === b && $('holiday-yearly').checked) D.staticHolidays.push({ name, date: a.slice(5) });
  else if (a === b) D.dynamicHolidays.push({ name, date: a });
  else D.bulkHolidays.push({ name, startDate: a, endDate: b });
  const s = cur();
  for (let d = a; d <= b; d = addDays(d, 1)) { s.attended = drop(s.attended, d); strip(s, d); }
  renderHolidays(); render(); toast('Holiday added');
};

/* ---------- Backup / restore ---------- */
$('export-btn').onclick = () => {
  const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sac-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
};
$('import-input').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const v = JSON.parse(r.result);
      if (!v || (!v.profiles && !v.semesters)) throw new Error('bad file');
      D = { ...D, ...v, settings: { ...D.settings, ...v.settings } };
      if (!v.profiles && v.semesters) { D.profiles = {}; for (let i = 1; i <= 8; i++) if (v.semesters[i]) D.profiles['college-' + i] = Object.assign(blank(), v.semesters[i]); }
      if (!LEVELS[D.settings.eduType]) D.settings.eduType = 'college';
      if (!LEVELS[D.settings.eduType].some(l => l.id === D.settings.levelId)) D.settings.levelId = LEVELS[D.settings.eduType][0].id;
      $('dark-mode-select').value = D.settings.darkMode;
      $('target-percent').value = D.settings.targetPercent;
      $('extra-penalty').value = D.settings.extraPenalty || 0;
      $('reminder-enabled').checked = D.settings.reminderEnabled;
      $('reminder-time').value = D.settings.reminderTime;
      applyTheme(); populateLevel(); renderHolidays(); render();
      toast('Backup restored');
    } catch (err) { toast('That file could not be read as a SAC backup'); }
  };
  r.readAsText(file);
  e.target.value = '';
};

/* ---------- Daily reminder ---------- */
async function tryPeriodicSync() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg && 'permissions' in navigator) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') { await reg.periodicSync.register('attendance-reminder', { minInterval: 12 * 60 * 60 * 1000 }); return true; }
    }
  } catch (e) {}
  return false;
}
$('reminder-enabled').onchange = async e => {
  if (e.target.checked) {
    if (!('Notification' in window)) { toast('Notifications are not supported in this browser'); e.target.checked = false; return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notification permission was not granted'); e.target.checked = false; return; }
    const bg = await tryPeriodicSync();
    D.settings.periodicSyncOn = bg;
    toast(bg ? 'Reminders enabled, including background checks where supported.' : "Reminders enabled. Background delivery isn't supported here, so keep SAC open in a tab around your reminder time.");
  }
  D.settings.reminderEnabled = e.target.checked; save(); render();
};
$('reminder-time').onchange = e => { D.settings.reminderTime = e.target.value; save(); render(); };
setInterval(() => {
  if (!D.settings.reminderEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, t = today();
  if (hm === D.settings.reminderTime && D.settings.lastReminded !== t) {
    const s = cur();
    if (working(t, s) && !s.attended.includes(t)) new Notification("Mark today's attendance", { body: 'Open SAC to record whether you were present today.' });
    D.settings.lastReminded = t; save();
  }
}, 30000);

/* ---------- Holiday import (Nager.Date public holidays API, India) ---------- */
const importDlg = $('import-dlg');
const thisYear = new Date().getFullYear();
$('import-year').innerHTML = Array.from({ length: 4 }, (_, i) => thisYear - 1 + i).map(y => `<option value="${y}"${y === thisYear ? ' selected' : ''}>${y}</option>`).join('');
let fetchedHolidays = [];
$('import-holidays-btn').onclick = () => { fetchedHolidays = []; $('import-list').innerHTML = ''; $('import-status').textContent = ''; $('import-apply').disabled = true; importDlg.showModal(); };
$('import-cancel').onclick = () => importDlg.close();
$('import-fetch').onclick = async () => {
  if (!navigator.onLine) { $('import-status').textContent = "You're offline — connect to the internet to import holidays."; return; }
  const year = $('import-year').value;
  $('import-status').textContent = 'Fetching holidays…';
  $('import-list').innerHTML = ''; $('import-apply').disabled = true;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`);
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) { $('import-status').textContent = 'No holidays were returned for that year.'; return; }
    fetchedHolidays = data.map(h => ({ name: h.localName || h.name, date: h.date }));
    $('import-status').textContent = `Found ${fetchedHolidays.length} national holiday${fetchedHolidays.length === 1 ? '' : 's'}. Review and import below.`;
    $('import-list').innerHTML = fetchedHolidays.map((h, i) =>
      `<li><label><input type="checkbox" class="imp-chk" data-i="${i}" checked><span>${h.name}</span></label><small>${h.date}</small></li>`).join('');
    $('import-apply').disabled = false;
  } catch (err) {
    $('import-status').textContent = 'Could not fetch holidays. Check your connection and try again.';
  }
};
$('import-form').onsubmit = () => {
  const checked = Array.from(document.querySelectorAll('.imp-chk:checked')).map(c => fetchedHolidays[+c.dataset.i]);
  let added = 0, skipped = 0;
  checked.forEach(h => {
    const dup = D.dynamicHolidays.some(x => x.date === h.date) || D.staticHolidays.some(x => x.date === h.date.slice(5)) || D.bulkHolidays.some(x => h.date >= x.startDate && h.date <= x.endDate);
    if (dup) { skipped++; return; }
    D.dynamicHolidays.push({ name: h.name, date: h.date }); added++;
  });
  renderHolidays(); render();
  toast(`Imported ${added} holiday${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`);
};

/* ---------- Offline support ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Init ---------- */
$('dark-mode-select').value = D.settings.darkMode;
$('target-percent').value = D.settings.targetPercent;
$('extra-penalty').value = D.settings.extraPenalty || 0;
$('reminder-enabled').checked = D.settings.reminderEnabled;
$('reminder-time').value = D.settings.reminderTime;
applyTheme(); render();
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
window.addEventListener('focus', render);
})();
