(() => {
const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [a, b, c] = s.split('-'); return new Date(+a, b - 1, +c); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmt = s => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const blank = () => ({ holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null, endAuto: true, extra: [], off: [] });
const list = a => a.map(([name, date]) => ({ name, date }));

let D = {
  settings: { darkMode: 'system', absentPenalty: 0, lastSelectedSem: '1' },
  semesters: {},
  staticHolidays: list([["New Year's Day", '01-01'], ['Republic Day', '01-26'], ['Ambedkar Jayanti', '04-14'], ['Independence Day', '08-15'], ['Gandhi Jayanti', '10-02'], ['Christmas Day', '12-25']]),
  dynamicHolidays: list([['Radha Saptami', '2026-01-25'], ['Maha Shivaratri', '2026-02-15'], ['Holi', '2026-03-03'], ['Ugadi', '2026-03-19'], ['Ramzan', '2026-03-21'], ['Sri Rama Navami', '2026-03-27'], ['Good Friday', '2026-04-03'], ['Bakrid (Eid al-Adha)', '2026-05-28'], ['Muharram', '2026-06-26'], ['Varalakshmi Vratam', '2026-08-21'], ['Milad-un-Nabi', '2026-08-26'], ['Krishna Janmashtami', '2026-09-04'], ["Teachers' Day", '2026-09-05'], ['Vinayaka Chavithi', '2026-09-14'], ['Vijayadashami', '2026-10-20'], ['Diwali', '2026-11-08']]),
  bulkHolidays: [{ name: 'Sankranti', startDate: '2026-01-11', endDate: '2026-01-17' }]
};
let sel = today(), view = new Date(); view.setDate(1);

/* ---------- Single source of truth for day status ---------- */
const holName = (ds, s) => {
  const n = [];
  D.staticHolidays.forEach(h => h.date === ds.slice(5) && n.push(h.name));
  D.dynamicHolidays.forEach(h => h.date === ds && n.push(h.name));
  D.bulkHolidays.forEach(h => ds >= h.startDate && ds <= h.endDate && n.push(h.name));
  if (s.holidays.includes(ds)) n.push(s.holidayNames[ds] || 'College leave');
  return n.join(', ');
};
const natural = (ds, s) => parse(ds).getDay() !== 0 && !holName(ds, s);
const working = (ds, s) => !!s.startDate && ds >= s.startDate && ds <= s.endDate && !s.off.includes(ds) && (s.extra.includes(ds) || natural(ds, s));

const cur = () => D.semesters[D.settings.lastSelectedSem];
const save = () => { try { localStorage.setItem('attendanceData', JSON.stringify(D)); } catch (e) {} };

/* End date: in "Till today" mode it always moves forward with the calendar */
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
  const p = wd ? Math.max(0, at / wd * 100 - (wd - at) * (D.settings.absentPenalty || 0)) : 0;
  return { wd, hd, at, p };
}

/* ---------- Load ---------- */
try { const v = JSON.parse(localStorage.getItem('attendanceData')); if (v) D = { ...D, ...v, settings: { ...D.settings, ...v.settings } }; } catch (e) {}
if (!D.settings.lastSelectedSem || D.settings.lastSelectedSem > 8) D.settings.lastSelectedSem = '1';
for (let i = 1; i <= 8; i++) D.semesters[i] = Object.assign(blank(), D.semesters[i]);
Object.values(D.semesters).forEach(s => s.attended.forEach(d => { if (!s.extra.includes(d) && !natural(d, s)) s.extra.push(d); }));

/* ---------- UI helpers ---------- */
let tt; const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); };
const strip = (s, ds) => { s.extra = s.extra.filter(d => d !== ds); s.off = s.off.filter(d => d !== ds); s.holidays = s.holidays.filter(d => d !== ds); };
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

function render() {
  const s = cur(); syncEnd(s);
  const st = stats(s);
  $('semester').value = D.settings.lastSelectedSem;
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
  renderCalendar(s);
  const names = [parse(sel).getDay() === 0 ? 'Sunday' : '', holName(sel, s)].filter(Boolean).join(', ');
  $('today-date').textContent = (sel === today() ? 'Today · ' : '') + fmt(sel);
  $('holiday-name-display').textContent = names;
  $('working-day').checked = working(sel, s);
  $('college-leave').checked = s.holidays.includes(sel);
  $('went-to-college').checked = working(sel, s) && s.attended.includes(sel);
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
  if (e.target.checked) { setWorking(s, sel, false); s.holidays.push(sel); s.holidayNames[sel] = 'College leave'; }
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

/* ---------- Range: no "Set" button, applies instantly ---------- */
$('start-date').onchange = e => { const s = cur(); s.startDate = e.target.value || null; render(); };
$('end-date').onchange = e => { const s = cur(); s.endDate = e.target.value || today(); s.endAuto = false; render(); };
$('auto-end').onchange = e => { const s = cur(); s.endAuto = e.target.checked; if (s.endAuto) toast('End date now follows today automatically'); render(); };

/* ---------- Calendar interaction ---------- */
$('calendar-grid').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { sel = b.dataset.d; render(); } };
const move = n => { view.setMonth(view.getMonth() + n); render(); };
[['prev-month', -1], ['next-month', 1]].forEach(([id, n]) => {
  const b = $(id); let t1, t2, held = false;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  b.onpointerdown = () => { held = true; move(n); t1 = setTimeout(() => t2 = setInterval(() => move(n), 140), 450); };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
  b.onclick = e => { if (e.detail === 0) move(n); }; // keyboard only
});

/* ---------- Semester + settings ---------- */
$('semester').innerHTML = Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">Sem ${i + 1}</option>`).join('');
$('semester').onchange = e => { D.settings.lastSelectedSem = e.target.value; render(); };
$('settings-btn').onclick = () => { $('settings-page').hidden = false; renderHolidays(); };
$('back-btn').onclick = () => { $('settings-page').hidden = true; };
$('dark-mode-select').onchange = e => { D.settings.darkMode = e.target.value; applyTheme(); save(); };
$('absent-penalty').onchange = e => { D.settings.absentPenalty = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); e.target.value = D.settings.absentPenalty; render(); };
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
$('holiday-list').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  D[b.dataset.k].splice(+b.dataset.i, 1); renderHolidays(); render();
};

/* ---------- Add holiday dialog (single day, yearly, or range) ---------- */
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

/* ---------- Init ---------- */
$('dark-mode-select').value = D.settings.darkMode;
$('absent-penalty').value = D.settings.absentPenalty || 0;
applyTheme(); render();
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }); // rolls "Till today" forward after midnight
})();
