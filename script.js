(() => {
const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [a, b, c] = s.split('-'); return new Date(+a, b - 1, +c); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmt = s => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = hhmm => { const [h, m] = hhmm.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'course';
/* startDate/endDate are STABLE and never auto-mutated by the Till Today toggle. */
const blank = () => ({ startDate: null, endDate: null, tillToday: false, attended: [], absent: [], absentReasons: {}, extra: [], off: [] });
const list = a => a.map(([name, date]) => ({ name, date }));

/* ---------- Education (flat list, contextual fields only) ---------- */
const YOUNG = new Set(['LKG', 'UKG', '1', '2', '3', '4', '5']);
const SCHOOL_CLASSES = [
  { id: 'LKG', label: 'LKG' }, { id: 'UKG', label: 'UKG' },
  { id: '1', label: '1st' }, { id: '2', label: '2nd' }, { id: '3', label: '3rd' }, { id: '4', label: '4th' }, { id: '5', label: '5th' },
  { id: '6', label: '6th' }, { id: '7', label: '7th' }, { id: '8', label: '8th' }, { id: '9', label: '9th' }, { id: '10', label: '10th' }
];
const EDU = {
  school: { label: 'School' },
  intermediate: { label: 'Intermediate Education' },
  polytechnic: { label: 'Polytechnic / Diploma' },
  degree: { label: 'Degree' },
  honours: { label: 'Honours Degree' },
  engineering: { label: 'Engineering' },
  iiit: { label: 'IIIT' },
  iit: { label: 'IIT' },
  pg: { label: 'PG' },
  other: { label: 'Other' }
};
const YEARWISE_ORDER = ['school', 'intermediate'];
const SEMWISE_ORDER = ['polytechnic', 'degree', 'honours', 'engineering', 'iiit', 'iit', 'pg', 'other'];
const SEMWISE = new Set(SEMWISE_ORDER);

let D = { 
  version: 5,
  settings: {
    darkMode: 'system',
    mode: null, category: null, classId: null, otherName: '', years: null, semesters: null, semester: null,
    targetPercent: 75, extraPenalty: 0,
    reminderEnabled: false, reminderTime: '18:00', lastReminded: null, periodicSyncOn: false
  },
  profiles: {},
  staticHolidays: list([["New Year's Day", '01-01'], ['Republic Day', '01-26'], ['Ambedkar Jayanti', '04-14'], ['Independence Day', '08-15'], ['Gandhi Jayanti', '10-02'], ['Christmas Day', '12-25']]),
  dynamicHolidays: list([['Radha Saptami', '2026-01-25'], ['Maha Shivaratri', '2026-02-15'], ['Holi', '2026-03-03'], ['Ugadi', '2026-03-19'], ['Ramzan', '2026-03-21'], ['Sri Rama Navami', '2026-03-27'], ['Good Friday', '2026-04-03'], ['Bakrid (Eid al-Adha)', '2026-05-28'], ['Muharram', '2026-06-26'], ['Varalakshmi Vratam', '2026-08-21'], ['Milad-un-Nabi', '2026-08-26'], ['Krishna Janmashtami', '2026-09-04'], ["Teachers' Day", '2026-09-05'], ['Vinayaka Chavithi', '2026-09-14'], ['Vijayadashami', '2026-10-20'], ['Diwali', '2026-11-08']]),
  bulkHolidays: [{ name: 'Sankranti', startDate: '2026-01-11', endDate: '2026-01-17' }]
};
let sel = today(), view = new Date(); view.setDate(1);
let lastKnownDate = today();

/* ---------- Load + migrate (never delete old data) ---------- */
try {
  const v = JSON.parse(localStorage.getItem('attendanceData'));
  if (v && typeof v === 'object') {
    D = { ...D, ...v, settings: { ...D.settings, ...(v.settings || {}) } };
    if (!v.version || v.version < 4) {
      D.profiles = {};
      const t = today();
      const oldProfiles = v.profiles || {};
      // Merge old per-semester/per-year sub-profiles of the same course into one continuous
      // profile, since v4 tracks a whole course as a single range rather than per-term.
      const merged = {}; // newKey -> { starts:[], ends:[], attended:Set, extra:Set, off:Set, maxLevel }
      const mergeInto = (newKey, p, levelNum) => {
        const m = merged[newKey] || (merged[newKey] = { starts: [], ends: [], attended: new Set(), extra: new Set(), off: new Set(), maxLevel: 0 });
        if (p.startDate) m.starts.push(p.startDate);
        if (p.endDate) m.ends.push(p.endDate);
        (p.attended || []).forEach(d => m.attended.add(d));
        (p.extra || []).forEach(d => m.extra.add(d));
        (p.off || []).forEach(d => m.off.add(d));
        if (levelNum) m.maxLevel = Math.max(m.maxLevel, levelNum);
      };
      Object.keys(oldProfiles).forEach(key => {
        const p = oldProfiles[key];
        const parts = key.split('-');
        if (parts[0] === 'school') D.profiles[`school-${parts[1]}`] = Object.assign(blank(), { startDate: p.startDate || null, endDate: p.endDate || null, tillToday: !!p.endAuto, attended: p.attended || [], extra: p.extra || [], off: p.off || [] });
        else if (parts[0] === 'intermediate') mergeInto('intermediate', p, 2);
        else if (parts[0] === 'polytechnic') mergeInto(`polytechnic`, p, +parts[1] || 1);
        else if (parts[0] === 'higher') {
          const course = parts[1], levelNum = +parts[2] || 1;
          if (course === 'engineering') mergeInto('engineering', p, levelNum);
          else if (course === 'iiit') mergeInto('iiit', p, levelNum);
          else if (course === 'iit') mergeInto('iit', p, levelNum);
          else if (course === 'pg') mergeInto('pg', p, levelNum);
          else if (course === 'degree') mergeInto('degree', p, levelNum);
          else mergeInto('other-migrated', p, levelNum);
        }
      });
      Object.keys(merged).forEach(newKey => {
        const m = merged[newKey];
        const starts = m.starts.sort(), ends = m.ends.sort();
        D.profiles[newKey] = Object.assign(blank(), {
          startDate: starts[0] || null, endDate: ends[ends.length - 1] || null,
          tillToday: !ends.length || ends[ends.length - 1] >= t,
          attended: [...m.attended], extra: [...m.extra], off: [...m.off]
        });
      });
if (merged.polytechnic) {
  D.profiles.polytechnic.__years = Math.min(
    12,
    Math.max(
      1,
      merged.polytechnic.maxLevel || 1
    )
  );

  D.profiles.polytechnic.__semesters =
    D.profiles.polytechnic.__years * 2;
}

['engineering', 'iiit', 'iit', 'pg'].forEach(c => {
  if (merged[c]) {
    D.profiles[c].__years = Math.min(
      12,
      Math.max(
        1,
        Math.ceil((merged[c].maxLevel || 2) / 2)
      )
    );

    D.profiles[c].__semesters =
      D.profiles[c].__years * 2;
  }
});

      // Point current selection at whatever the user last had active, if we can tell.
      const old = v.settings || {};
      if (old.category === 'school' && old.levelId) { D.settings.category = 'school'; D.settings.classId = old.levelId; }
      else if (old.category === 'intermediate') { D.settings.category = 'intermediate'; }
      else if (old.category === 'polytechnic') { D.settings.category = 'polytechnic'; D.settings.years = D.profiles.polytechnic ? D.profiles.polytechnic.__years : 1; }
      else if (old.category === 'higher' && ['engineering', 'iiit', 'iit', 'pg', 'degree'].includes(old.course)) {
        D.settings.category = old.course;
        if (old.course !== 'degree') D.settings.years = D.profiles[old.course] ? D.profiles[old.course].__years : 2;
      } else if (old.category === 'higher' && old.course === 'other') { D.settings.category = 'other'; D.settings.otherName = 'Other'; D.settings.years = 2; }
      D.version = 4;
      D.legacyData = { profiles: oldProfiles, settings: old }; // kept, never deleted, just unused going forward
      D.migrationNote = 'Leave records and per-semester splits from the previous version were not carried into the new attendance counts — see Settings → About.';
    }
    // v4 -> v5: courses that select years+semesters now get one independent profile per
    // semester, instead of a single continuous profile. Existing attendance is kept and
    // placed into Semester 1; it is never deleted.
    if (!D.version || D.version < 5) {
      const oldV4Profiles = D.profiles || {};
      const oldSettings = { ...D.settings };
      D.profiles = {};
      Object.keys(oldV4Profiles).forEach(key => {
        const p = oldV4Profiles[key];
        if (key.startsWith('school-')) { D.profiles[key] = p; return; } // unchanged shape
        if (key === 'intermediate') { D.profiles['intermediate-1'] = p; return; } // default: 1st Year
        if (key === 'degree') { D.profiles['degree-3y-6s-sem1'] = p; return; }
        if (key === 'honours') { D.profiles['honours-4y-8s-sem1'] = p; return; }
if (
  ['polytechnic', 'engineering', 'iiit', 'iit', 'pg'].includes(key) &&
  p &&
  p.__years
) {
  const yrs = Math.min(
    12,
    Math.max(1, Number(p.__years) || 1)
  );

  const sems = Math.min(
    24,
    Math.max(1, Number(p.__semesters) || yrs * 2)
  );

  const rest = { ...p };

  delete rest.__years;
  delete rest.__semesters;

  D.profiles[
    `${key}-${yrs}y-${sems}s-sem1`
  ] = rest;

  return;
}

let m = key.match(
  /^(polytechnic|engineering|iiit|iit|pg)-(\d+)y(?:-(\d+)s)?$/
);

if (m) {
  const yrs = Math.min(
    12,
    Math.max(1, Number(m[2]) || 1)
  );

  const sems = Math.min(
    24,
    Math.max(1, Number(m[3]) || yrs * 2)
  );

  D.profiles[
    `${m[1]}-${yrs}y-${sems}s-sem1`
  ] = p;

  return;
}

m = key.match(
  /^other-(.+)-(\d+)y(?:-(\d+)s)?$/
);

if (m) {
  const yrs = Math.min(
    12,
    Math.max(1, Number(m[2]) || 1)
  );

  const sems = Math.min(
    24,
    Math.max(1, Number(m[3]) || yrs * 2)
  );

  D.profiles[
    `other-${m[1]}-${yrs}y-${sems}s-sem1`
  ] = p;

  return;
}
        D.profiles[key] = p; // unrecognized key: keep as-is rather than silently drop it
      });
      if (oldSettings.category === 'school') { D.settings.mode = 'year'; D.settings.classId = oldSettings.classId; }
      else if (oldSettings.category === 'intermediate') { D.settings.mode = 'year'; D.settings.category = 'intermediate'; D.settings.classId = '1'; }
else if (
  [
    'polytechnic',
    'degree',
    'honours',
    'engineering',
    'iiit',
    'iit',
    'pg',
    'other'
  ].includes(oldSettings.category)
) {
  D.settings.mode = 'semester';

  const defaultYears =
    oldSettings.category === 'degree'
      ? 3
      : oldSettings.category === 'honours'
        ? 4
        : 2;

  const yrs = Math.min(
    12,
    Math.max(
      1,
      Number(oldSettings.years) || defaultYears
    )
  );

  const sems = Math.min(
    24,
    Math.max(
      1,
      Number(oldSettings.semesters) || yrs * 2
    )
  );

  D.settings.years = yrs;
  D.settings.semesters = sems;

  D.settings.semester =
    Number.isInteger(oldSettings.semester) &&
    oldSettings.semester >= 1 &&
    oldSettings.semester <= sems
      ? oldSettings.semester
      : 1;

  D.settings.otherName =
    oldSettings.category === 'other'
      ? (oldSettings.otherName || '')
      : '';
}
      D.version = 5;
      D.legacyDataV4 = { profiles: oldV4Profiles, settings: oldSettings }; // kept, never deleted
      D.migrationNoteV5 = 'Your course now has one attendance record per semester — your existing data was placed in Semester 1. See the Semester Report in Settings → Education.';
    }
  }
} catch (e) { console.warn('SAC: could not read saved data, starting fresh. Nothing was deleted on disk.', e); }

function years() {
  const value = Number(D.settings.years);
  return Number.isFinite(value)
    ? Math.min(12, Math.max(1, Math.floor(value)))
    : 1;
}

function semesterCount() {
  const value = Number(D.settings.semesters);

  return Number.isFinite(value)
    ? Math.min(24, Math.max(1, Math.floor(value)))
    : Math.min(24, years() * 2);
}

function activeSemester() {
  return Math.min(
    semesterCount(),
    Math.max(1, Number(D.settings.semester) || 1)
  );
}
function validConfig() {
  const c = D.settings.category; if (!c || !EDU[c]) return false;
  if (c === 'school') return !!D.settings.classId && SCHOOL_CLASSES.some(x => x.id === D.settings.classId);
  if (c === 'intermediate') return D.settings.classId === '1' || D.settings.classId === '2';
if (SEMWISE.has(c)) {
  const yrs = Number(D.settings.years);
  const sems = Number(D.settings.semesters);

  if (
    !Number.isInteger(yrs) ||
    yrs < 1 ||
    yrs > 12
  ) return false;

  if (
    !Number.isInteger(sems) ||
    sems < 1 ||
    sems > 24
  ) return false;

  if (c === 'other' && !D.settings.otherName.trim()) return false;

  return true;
}
  return false;
}
function profileId() {
  const c = D.settings.category;
  if (c === 'school') return `school-${D.settings.classId}`;
  if (c === 'intermediate') return `intermediate-${D.settings.classId}`;
  if (c === 'other') return `other-${slug(D.settings.otherName)}-${years()}y-${semesterCount()}s-sem${activeSemester()}`;
  return `${c}-${years()}y-${semesterCount()}s-sem${activeSemester()}`;
}
const cur = () => (D.profiles[profileId()] = Object.assign(blank(), D.profiles[profileId()]));
const isSchool = () => D.settings.category === 'school';
const isYoung = () => isSchool() && YOUNG.has(D.settings.classId);
const isSemWise = () => SEMWISE.has(D.settings.category);
const save = () => { try { localStorage.setItem('attendanceData', JSON.stringify(D)); } catch (e) { console.warn('SAC: could not save to localStorage', e); } };

function configSummary() {
  if (!validConfig()) return null;
  const c = D.settings.category, meta = EDU[c];
  if (c === 'school') { const it = SCHOOL_CLASSES.find(x => x.id === D.settings.classId); return /^\d+$/.test(D.settings.classId) ? `School · Class ${D.settings.classId}` : `School · ${it.label}`; }
  if (c === 'intermediate') return `Intermediate ${D.settings.classId === '1' ? '1st' : '2nd'} Year`;
  const yrs = years(), sems = semesterCount();
  const name = c === 'other' ? D.settings.otherName : meta.label;
  return `${name} · ${yrs} year${yrs > 1 ? 's' : ''} · ${sems} semester${sems === 1 ? '' : 's'}`;
}

/* ---------- Single source of truth for day status ---------- */
const holName = ds => {
  const n = [];
  D.staticHolidays.forEach(h => h.date === ds.slice(5) && n.push(h.name));
  D.dynamicHolidays.forEach(h => h.date === ds && n.push(h.name));
  D.bulkHolidays.forEach(h => ds >= h.startDate && ds <= h.endDate && n.push(h.name));
  return n.join(', ');
};
const natural = ds => parse(ds).getDay() !== 0 && !holName(ds);
/* working() is bounded by the STABLE configured range only — never by the Till Today cutoff,
   so the calendar always shows the full configured date range regardless of the toggle. */
const working = (ds, s) => !!s.startDate && !!s.endDate && ds >= s.startDate && ds <= s.endDate && !s.off.includes(ds) && (s.extra.includes(ds) || natural(ds));

/* The one place Till Today has any effect: where the attendance-calculation cutoff falls. */
function cutoffDate(s) {
  const t = today();
  if (!s.startDate) return null;
  if (s.tillToday) return s.endDate && s.endDate < t ? s.endDate : t;
  return s.endDate || null;
}
function statsRange(s, from, to) {
  let wd = 0, at = 0;
  if (!from || !to || to < from) return { wd, at, p: 0 };
  for (let d = from; d <= to; d = addDays(d, 1)) if (working(d, s)) { wd++; if (s.attended.includes(d)) at++; }
  return { wd, at, p: wd ? at / wd * 100 : 0 };
}
const soFarStats = s => statsRange(s, s.startDate, cutoffDate(s));
/* Real-world remaining working days ahead of today, independent of the Till Today toggle —
   used only for target reachability. Kept internally even though the old "Semester overview"
   UI that used to display it has been removed. */
function remainingWorkingDays(s) {
  if (!s.endDate || !s.startDate) return null;
  const t = today();
  if (s.endDate <= t) return 0;
  let n = 0;
  for (let d = addDays(t, 1); d <= s.endDate; d = addDays(d, 1)) if (working(d, s)) n++;
  return n;
}
function holidayCount(s, from, to) {
  let hd = 0;
  if (!from || !to || to < from) return 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (!working(d, s) && parse(d).getDay() !== 0 && holName(d)) hd++;
  return hd;
}

/* ---------- Target math (penalty-aware; verified against spec examples) ---------- */
function targetInfo(soFar, remaining, targetPct, extra) {
  if (!soFar.wd) return { ok: false, text: 'Set a start and end date (or turn on Till Today) to see your target status.' };
  const raw = soFar.p, adjusted = Math.max(0, raw - extra);
  const diff = adjusted - targetPct;
  let text, state;
  if (Math.abs(diff) < 0.005) { text = "You're at your target."; state = 'good'; }
  else if (diff > 0) { text = `You're ${diff.toFixed(2)} percentage points above your target.`; state = 'good'; }
  else {
    const T2 = Math.min(0.999, (targetPct + extra) / 100);
    const need = Math.max(0, Math.ceil((T2 * soFar.wd - soFar.at) / (1 - T2)));
    if (remaining !== null && need > remaining) { text = `${targetPct}% cannot be reached within the remaining working days.`; state = 'warn'; }
    else { text = `You're ${Math.abs(diff).toFixed(2)} percentage points below your ${targetPct}% target.` + (need > 0 ? ` Attend the next ${need} working day${need === 1 ? '' : 's'} to reach ${targetPct}%.` : ''); state = 'warn'; }
  }
  return { ok: true, text, state, raw, adjusted };
}

/* ---------- UI helpers ---------- */
let tt; const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200); };
const dropArr = (a, ds) => a.filter(d => d !== ds);

function applyTheme() {
  const m = D.settings.darkMode, dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function renderCalendar(s) {
  const y = view.getFullYear(), m = view.getMonth(), t = today();
  $('month-year').textContent = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  let h = '<div class="d empty"></div>'.repeat(new Date(y, m, 1).getDay());
  for (let i = 1, n = new Date(y, m + 1, 0).getDate(); i <= n; i++) {
    const ds = `${y}-${pad(m + 1)}-${pad(i)}`, w = working(ds, s);
    let c = 'd';
    if (parse(ds).getDay() === 0) c += ' sun';
    if (!w && holName(ds)) c += ' hol';
    if (w) {
      c += ' wd';
      if (s.attended.includes(ds)) c += ' at';
      else if (s.absent.includes(ds)) c += ' ab';
    }
    if (ds === t) c += ' today';
    if (ds === sel) c += ' sel';
    h += `<button class="${c}" data-d="${ds}" aria-label="${fmt(ds)}" role="gridcell">${i}</button>`;
  }
  $('calendar-grid').innerHTML = h;
}

function applyTerms() {
  const school = isSchool();
  $('attend-label').textContent = school ? 'Present so far' : 'Attendance so far';
  $('percent-cap').textContent = school ? 'Present' : 'Attendance';
  $('mark-attended').textContent = school ? '✓ Present' : '✓ Attended';
  $('legend-at').textContent = school ? 'Present' : 'Attended';
  $('wd-label').textContent = (school ? 'School days' : 'Working days') + ' so far';
  $('attended-label').textContent = school ? 'Days present' : 'Days attended';
  $('summary-title').textContent = 'This profile';
  $('parent-note').hidden = !isYoung();
  $('target-block').style.display = isYoung() ? 'none' : '';
  $('target-row').style.display = isYoung() ? 'none' : '';
}

function render() {
  const summary = configSummary();
  $('config-summary').textContent = summary || 'Set up your education';
  $('settings-edu-summary').textContent = summary || 'Not set up';
  if (!summary) {
    $('calendar-grid').innerHTML = '';
    return;
  }
  if (isSemWise()) {
    $('sem-select-wrap').hidden = false;
    const n = semesterCount(), active = activeSemester();
    $('semester-select').innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}"${i + 1 === active ? ' selected' : ''}>Semester ${i + 1}</option>`).join('');
  } else $('sem-select-wrap').hidden = true;

  const s = cur();
  applyTerms();
  const cutoff = cutoffDate(s), soFar = soFarStats(s), remaining = remainingWorkingDays(s), extra = D.settings.extraPenalty || 0;
  const ti = targetInfo(soFar, remaining, D.settings.targetPercent, extra);

  $('start-date').value = s.startDate || '';
  $('end-date').value = s.endDate || '';
  $('till-today').checked = s.tillToday;
  $('attendance-display').textContent = `${soFar.at} / ${soFar.wd} working days`;
  $('percentage-display').textContent = `${soFar.p.toFixed(2)}%`;
  $('bar-fill').style.width = Math.min(100, soFar.p) + '%';
  $('target-value').textContent = D.settings.targetPercent + '%';
  $('bar-target').style.left = Math.min(100, D.settings.targetPercent) + '%';
  $('target-msg').textContent = ti.text;
  $('target-row').classList.remove('good', 'warn');
  if (ti.state) $('target-row').classList.add(ti.state);
  $('target-detail').textContent = ti.text;

  const hd = holidayCount(s, s.startDate, cutoff || today());
  $('total-working-days').textContent = soFar.wd;
  $('total-holidays').textContent = hd;
  $('total-attended').textContent = soFar.at;
  $('total-absent').textContent = s.absent.length;
  $('modal-percentage').textContent = `${soFar.p.toFixed(2)}%`;

  if (extra > 0 && soFar.wd && !isYoung()) {
    $('penalty-detail').hidden = false;
    $('raw-pct').textContent = ti.raw.toFixed(2) + '%';
    $('penalty-adj').textContent = '−' + extra.toFixed(2) + ' pts';
    $('adjusted-pct').textContent = ti.adjusted.toFixed(2) + '%';
  } else $('penalty-detail').hidden = true;

  renderCalendar(s);
  renderDayPanel(s);
  renderSemReport();
  $('reminder-status').textContent = D.settings.reminderEnabled
    ? `Reminders are on · Daily at ${fmtTime(D.settings.reminderTime)}` + (D.settings.periodicSyncOn ? '' : '. Background delivery depends on browser support.')
    : 'Reminders are off.';
  save();
}

function renderDayPanel(s) {
  const t = today(), isSun = parse(sel).getDay() === 0, hName = holName(sel), isHol = !!hName;
  const isWorking = working(sel, s);

  $('today-date').textContent = (sel === t ? 'Today · ' : '') + fmt(sel);
  $('sun-tag').hidden = !isSun;

  $('holiday-name-display').hidden = !isHol;
  $('holiday-name-display').textContent = isHol ? hName : '';

  const isAbsent = s.absent.includes(sel);
  const reasonEl = $('absent-reason-display');
  if (isAbsent) {
    const r = s.absentReasons[sel];
    const text = r && (r.reason || r.note) ? [r.reason, r.note].filter(Boolean).join(' · ') : '';
    reasonEl.hidden = !text;
    reasonEl.textContent = text ? `Absent · ${text}` : '';
  } else reasonEl.hidden = true;

  const setPressed = (id, on) => $(id).setAttribute('aria-pressed', String(on));
  $('day-working').textContent = natural(sel) ? 'Working Day' : 'Override as Working Day';
  setPressed('day-working', isWorking);
  setPressed('day-holiday', isHol);

  const isFuture = sel > t;
  $('future-note').hidden = !isFuture;
  $('notworking-note').hidden = isFuture || isWorking;
  $('attend-group').hidden = isFuture || !isWorking;
  if (!isFuture && isWorking) {
    setPressed('mark-attended', s.attended.includes(sel));
    setPressed('mark-absent', isAbsent);
  }
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

/* ---------- Day status actions ---------- */
function setWorking(s, ds, on) {
  s.extra = dropArr(s.extra, ds); s.off = dropArr(s.off, ds);
  if (on && !natural(ds)) s.extra.push(ds);
  if (!on) { s.attended = dropArr(s.attended, ds); s.absent = dropArr(s.absent, ds); delete s.absentReasons[ds]; if (natural(ds)) s.off.push(ds); }
}
$('day-working').onclick = () => { const s = cur(); setWorking(s, sel, !working(sel, s)); save(); render(); };

const dlg = $('hol-dlg');
const openHolDlg = (a, b) => { $('holiday-name').value = ''; $('holiday-start').value = a; $('holiday-end').value = b || a; $('holiday-yearly').checked = false; dlg.showModal(); };
$('day-holiday').onclick = () => {
  const name = holName(sel);
  if (name) toast(`Already a holiday: ${name}. Edit it in Settings → Holidays.`);
  else openHolDlg(sel, sel);
};
$('settings-add-holiday').onclick = () => openHolDlg(sel, sel);
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
  for (let d = a; d <= b; d = addDays(d, 1)) setWorking(s, d, false);
  save(); renderHolidays(); render(); toast('Holiday added');
};

$('mark-attended').onclick = () => {
  const s = cur();
  if (sel > today()) return toast("Can't mark a future date as attended");
  if (!s.startDate) return toast('Set the start date first');
  if (!working(sel, s)) setWorking(s, sel, true);
  s.absent = dropArr(s.absent, sel); delete s.absentReasons[sel];
  if (s.attended.includes(sel)) s.attended = dropArr(s.attended, sel); // toggle off back to unmarked
  else s.attended.push(sel);
  save(); render();
};

const absentDlg = $('absent-dlg');
function openAbsentDlg() {
  const s = cur(), r = s.absentReasons[sel] || {};
  const presets = ['Sick', 'Personal', 'Family', 'Medical', 'Travel'];
  $('absent-reason-type').value = presets.includes(r.reason) ? r.reason : (r.reason ? 'Other' : '');
  $('absent-reason-note').value = r.note || (r.reason && !presets.includes(r.reason) ? r.reason : '') || '';
  $('absent-delete').hidden = !(r.reason || r.note);
  absentDlg.showModal();
}
$('mark-absent').onclick = () => {
  const s = cur();
  if (sel > today()) return toast("Can't mark a future date as absent");
  if (!s.startDate) return toast('Set the start date first');
  if (!working(sel, s)) setWorking(s, sel, true);
  s.attended = dropArr(s.attended, sel);
  if (s.absent.includes(sel)) { s.absent = dropArr(s.absent, sel); delete s.absentReasons[sel]; save(); render(); } // toggle off
  else { s.absent.push(sel); save(); render(); openAbsentDlg(); }
};
const saveAbsentReason = () => {
  const s = cur(), reason = $('absent-reason-type').value, note = $('absent-reason-note').value.trim();
  if (reason || note) s.absentReasons[sel] = { reason, note }; else delete s.absentReasons[sel];
  absentDlg.close(); save(); render();
};
$('absent-form').onsubmit = saveAbsentReason;
$('absent-skip').onclick = () => { delete cur().absentReasons[sel]; absentDlg.close(); save(); render(); };
$('absent-delete').onclick = () => { delete cur().absentReasons[sel]; absentDlg.close(); save(); render(); toast('Reason deleted'); };

/* ---------- Range ---------- */
$('start-date').onchange = e => {
  const s = cur(), v = e.target.value || null;
  if (v && s.endDate && v > s.endDate) { toast('Start date must not be after end date'); e.target.value = s.startDate || ''; return; }
  s.startDate = v; save(); render();
};
$('end-date').onchange = e => {
  const s = cur(), v = e.target.value || null;
  if (v && s.startDate && v < s.startDate) { toast('End date must not be before start date'); e.target.value = s.endDate || ''; return; }
  s.endDate = v; save(); render();
};
$('till-today').onchange = e => { cur().tillToday = e.target.checked; save(); render(); };
$('till-info-btn').onclick = () => {
  const open = $('till-info-detail').hidden;
  $('till-info-detail').hidden = !open;
  $('till-info-btn').setAttribute('aria-expanded', String(open));
};

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

/* ---------- Education modal: Year Wise (School, Intermediate) / Semester Wise (the rest) ---------- */

/* ---------- Education modal: Year Wise / Semester Wise ---------- */

const eduDlg = $('edu-dlg');

let pending = {
  mode: null,
  category: null,
  classId: null,
  otherName: '',
  years: null,
  semesters: null
};


/* ---------- Education UI helpers ---------- */

function setEduHidden(id, hidden) {
  const el = $(id);
  if (!el) return;

  el.hidden = hidden;

  // Prevent any CSS rule from accidentally keeping the old
  // semester summary visible after switching modes.
  if (hidden) {
    el.style.display = 'none';
  } else {
    el.style.display = '';
  }
}

function clearSemesterUI() {
  const yearsInput = $('edu-years-count');
  const semestersInput = $('edu-semesters-count');

  if (yearsInput) yearsInput.value = '';
  if (semestersInput) semestersInput.value = '';

  if ($('edu-selected-years')) {
    $('edu-selected-years').textContent = '';
  }

  if ($('edu-selected-sem')) {
    $('edu-selected-sem').textContent = '';
  }

  setEduHidden('edu-selected-wrap', true);
}


/* ---------- Type list ---------- */

function renderTypeList() {
  const order =
    pending.mode === 'year'
      ? YEARWISE_ORDER
      : SEMWISE_ORDER;

  $('edu-type-label').textContent =
    pending.mode === 'year'
      ? 'Select type'
      : 'Select course';

  $('edu-list').innerHTML = order.map(id => `
    <label class="edu-opt">
      <input
        type="radio"
        name="edu-cat"
        value="${id}"
        ${pending.category === id ? 'checked' : ''}
      >
      <span>${EDU[id].label}</span>
    </label>
  `).join('');

  $('edu-list')
    .querySelectorAll('input')
    .forEach(r => {
      r.onchange = () => {

        pending.category = r.value;
        pending.classId = null;
        pending.otherName = '';
        pending.years = null;
        pending.semesters = null;

        clearSemesterUI();

        if ($('edu-other-name')) {
          $('edu-other-name').value = '';
        }

        showCategoryFields();
      };
    });
}


/* ---------- School / Intermediate ---------- */

function renderSchoolOrInterLevels() {
  const isInter = pending.category === 'intermediate';

  $('edu-school-label').textContent =
    isInter ? 'Select year' : 'Select class';

  const items = isInter
    ? [
        { id: '1', label: 'Intermediate 1st Year' },
        { id: '2', label: 'Intermediate 2nd Year' }
      ]
    : SCHOOL_CLASSES;

  $('edu-school-levels').innerHTML = items.map(it => `
    <label class="edu-lvl">
      <input
        type="radio"
        name="edu-class"
        value="${it.id}"
        ${pending.classId === it.id ? 'checked' : ''}
      >
      <span>
        ${it.label}
        ${
          !isInter && YOUNG.has(it.id)
            ? '<small>Parent-guided</small>'
            : ''
        }
      </span>
    </label>
  `).join('');

  $('edu-school-levels')
    .querySelectorAll('input')
    .forEach(r => {
      r.onchange = () => {
        pending.classId = r.value;
        validateEdu();
      };
    });
}


/* ---------- User-selectable years ---------- */

function renderDurationOpts() {
  const input = $('edu-years-count');

  if (!input) return;

  input.value =
    Number.isInteger(pending.years)
      ? pending.years
      : '';

  input.oninput = () => {
    const value = parseInt(input.value, 10);

    pending.years =
      Number.isFinite(value)
        ? Math.min(12, Math.max(1, value))
        : null;

    updateSelectedDisplay();
    validateEdu();
  };
}


/* ---------- User-selectable semesters ---------- */

function renderSemesterInput() {
  const input = $('edu-semesters-count');

  if (!input) return;

  input.value =
    Number.isInteger(pending.semesters)
      ? pending.semesters
      : '';

  input.oninput = () => {
    const value = parseInt(input.value, 10);

    pending.semesters =
      Number.isFinite(value)
        ? Math.min(24, Math.max(1, value))
        : null;

    updateSelectedDisplay();
    validateEdu();
  };
}


/* ---------- Selected duration summary ---------- */

function updateSelectedDisplay() {

  // This box belongs ONLY to Semester Wise mode.
  if (pending.mode !== 'semester') {
    clearSemesterUI();
    return;
  }

  const validYears =
    Number.isInteger(pending.years) &&
    pending.years >= 1 &&
    pending.years <= 12;

  const validSemesters =
    Number.isInteger(pending.semesters) &&
    pending.semesters >= 1 &&
    pending.semesters <= 24;

  const show = validYears && validSemesters;

  setEduHidden('edu-selected-wrap', !show);

  if (!show) {
    if ($('edu-selected-years')) {
      $('edu-selected-years').textContent = '';
    }

    if ($('edu-selected-sem')) {
      $('edu-selected-sem').textContent = '';
    }

    return;
  }

  $('edu-selected-years').textContent =
    `${pending.years} year${pending.years === 1 ? '' : 's'}`;

  $('edu-selected-sem').textContent =
    `${pending.semesters} semester${pending.semesters === 1 ? '' : 's'}`;
}


/* ---------- Validation ---------- */

function validateEdu() {
  const c = pending.category;

  let ok =
    !!pending.mode &&
    !!c;

  // Year Wise
  if (
    ok &&
    (c === 'school' || c === 'intermediate')
  ) {
    ok = !!pending.classId;
  }

  // Semester Wise
  if (ok && SEMWISE.has(c)) {
    ok =
      Number.isInteger(pending.years) &&
      pending.years >= 1 &&
      pending.years <= 12 &&

      Number.isInteger(pending.semesters) &&
      pending.semesters >= 1 &&
      pending.semesters <= 24;
  }

  // Other requires a custom education name
  if (ok && c === 'other') {
    ok = !!pending.otherName.trim();
  }

  $('edu-save').disabled = !ok;
}


/* ---------- Category fields ---------- */

function showCategoryFields() {
  const c = pending.category;
  const semesterWise =
    pending.mode === 'semester' &&
    SEMWISE.has(c);

  const yearWise =
    pending.mode === 'year' &&
    (c === 'school' || c === 'intermediate');

  // Always reset every conditional section first.
  setEduHidden('edu-school-wrap', true);
  setEduHidden('edu-other-name-wrap', true);
  setEduHidden('edu-duration-wrap', true);
  setEduHidden('edu-semesters-wrap', true);
  setEduHidden('edu-selected-wrap', true);

  // YEAR WISE
  if (yearWise) {
    clearSemesterUI();

    setEduHidden('edu-school-wrap', false);

    renderSchoolOrInterLevels();

    validateEdu();
    return;
  }

  // SEMESTER WISE
  if (semesterWise) {

    setEduHidden('edu-duration-wrap', false);
    setEduHidden('edu-semesters-wrap', false);

    renderDurationOpts();
    renderSemesterInput();

    updateSelectedDisplay();

    if (c === 'other') {
      setEduHidden('edu-other-name-wrap', false);
    }

    validateEdu();
    return;
  }

  // Safety reset
  clearSemesterUI();

  validateEdu();
}


/* ---------- Mode switching ---------- */

document
  .querySelectorAll('#edu-mode input')
  .forEach(r => {

    r.onchange = () => {

      pending.mode = r.value;

      // IMPORTANT:
      // Switching mode starts a fresh education selection.
      pending.category = null;
      pending.classId = null;
      pending.otherName = '';
      pending.years = null;
      pending.semesters = null;

      // Clear every previous value.
      clearSemesterUI();

      if ($('edu-other-name')) {
        $('edu-other-name').value = '';
      }

      if ($('edu-years-count')) {
        $('edu-years-count').value = '';
      }

      if ($('edu-semesters-count')) {
        $('edu-semesters-count').value = '';
      }

      // Hide all dependent sections.
      setEduHidden('edu-school-wrap', true);
      setEduHidden('edu-other-name-wrap', true);
      setEduHidden('edu-duration-wrap', true);
      setEduHidden('edu-semesters-wrap', true);
      setEduHidden('edu-selected-wrap', true);

      // Show type/course list.
      setEduHidden('edu-type-wrap', false);

      renderTypeList();

      $('edu-save').disabled = true;
    };

  });


/* ---------- Other education name ---------- */

$('edu-other-name').oninput = e => {
  pending.otherName = e.target.value;
  validateEdu();
};


/* ---------- Open education dialog ---------- */

function openEduDlg() {

  pending = {
    mode: D.settings.mode || null,
    category: D.settings.category || null,
    classId: D.settings.classId || null,
    otherName: D.settings.otherName || '',
    years: Number.isInteger(D.settings.years)
      ? D.settings.years
      : null,
    semesters: Number.isInteger(D.settings.semesters)
      ? D.settings.semesters
      : null
  };

  // Set mode radio.
  document
    .querySelectorAll('#edu-mode input')
    .forEach(r => {
      r.checked = r.value === pending.mode;
    });

  // Reset visible UI first.
  setEduHidden('edu-type-wrap', true);
  setEduHidden('edu-school-wrap', true);
  setEduHidden('edu-other-name-wrap', true);
  setEduHidden('edu-duration-wrap', true);
  setEduHidden('edu-semesters-wrap', true);
  setEduHidden('edu-selected-wrap', true);

  clearSemesterUI();

  if ($('edu-other-name')) {
    $('edu-other-name').value = pending.otherName;
  }

  $('edu-save').disabled = true;

  if (pending.mode) {

    setEduHidden('edu-type-wrap', false);

    renderTypeList();

    if (pending.category) {
      showCategoryFields();
    }
  }

  eduDlg.showModal();
}


/* ---------- Education buttons ---------- */

$('config-btn').onclick = openEduDlg;

$('settings-edu-edit').onclick = openEduDlg;

$('edu-cancel').onclick = () => eduDlg.close();


/* ---------- Save education ---------- */

$('edu-form').onsubmit = () => {

  D.settings.mode = pending.mode;

  D.settings.category = pending.category;

  D.settings.classId =
    (
      pending.category === 'school' ||
      pending.category === 'intermediate'
    )
      ? pending.classId
      : null;

  D.settings.otherName =
    pending.category === 'other'
      ? pending.otherName.trim()
      : '';

  D.settings.years =
    SEMWISE.has(pending.category)
      ? pending.years
      : null;

  D.settings.semesters =
    SEMWISE.has(pending.category)
      ? pending.semesters
      : null;

  // Keep the selected semester valid.
  if (SEMWISE.has(pending.category)) {
    if (
      !Number.isInteger(D.settings.semester) ||
      D.settings.semester < 1 ||
      D.settings.semester > D.settings.semesters
    ) {
      D.settings.semester = 1;
    }
  } else {
    D.settings.semester = null;
  }

  save();
  render();

  toast('Saved: ' + configSummary());
};


/* ---------- Semester selector ---------- */

$('semester-select').onchange = e => {

  D.settings.semester = Math.min(
    semesterCount(),
    Math.max(1, parseInt(e.target.value, 10) || 1)
  );

  save();
  render();
};


/* ---------- Semester Report ---------- */

function renderSemReport() {

  const wrap = $('sem-report-wrap');

  if (!isSemWise()) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;

  const n = semesterCount();
  const yrs = years();

  const base =
    D.settings.category === 'other'
      ? `other-${slug(D.settings.otherName)}`
      : D.settings.category;

  let html = '';

  for (let i = 1; i <= n; i++) {

    const key =
      `${base}-${yrs}y-${n}s-sem${i}`;

    const p = D.profiles[key];

    let pct = '—';

    if (p && p.startDate) {
      const st =
        soFarStats(
          Object.assign(blank(), p)
        );

      if (st.wd) {
        pct = st.p.toFixed(2) + '%';
      }
    }

    html += `
      <dt>Semester ${i}</dt>
      <dd>${pct}</dd>
    `;
  }

  $('sem-report-list').innerHTML = html;
}

/* ---------- Semester selector (Semester Wise profiles only) ---------- */
$('semester-select').onchange = e => {
  D.settings.semester = Math.min(semesterCount(), Math.max(1, +e.target.value));
  save(); render();
};

/* ---------- Semester Report: read-only, never writes attendance ---------- */
function renderSemReport() {
  const wrap = $('sem-report-wrap');
  if (!isSemWise()) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const n = semesterCount(), yrs = years(), base = D.settings.category === 'other' ? `other-${slug(D.settings.otherName)}` : D.settings.category;
  let html = '';
  for (let i = 1; i <= n; i++) {
    const key = `${base}-${yrs}y-${n}s-sem${i}`;
    const p = D.profiles[key];
    let pct = '—';
    if (p && p.startDate) {
      const st = soFarStats(Object.assign(blank(), p)); // read-only snapshot; never written back
      if (st.wd) pct = st.p.toFixed(2) + '%';
    }
    html += `<dt>Semester ${i}</dt><dd>${pct}</dd>`;
  }
  $('sem-report-list').innerHTML = html;
}

/* ---------- Settings ---------- */
$('settings-btn').onclick = () => { $('settings-page').hidden = false; renderHolidays(); };
$('back-btn').onclick = () => { $('settings-page').hidden = true; };
$('target-edit').onclick = () => { $('settings-page').hidden = false; renderHolidays(); $('target-percent').focus(); };
$('dark-mode-select').onchange = e => { D.settings.darkMode = e.target.value; applyTheme(); save(); };
$('target-percent').onchange = e => { D.settings.targetPercent = Math.min(100, Math.max(1, parseInt(e.target.value) || 75)); e.target.value = D.settings.targetPercent; save(); render(); };
$('extra-penalty').onchange = e => { D.settings.extraPenalty = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); e.target.value = D.settings.extraPenalty; save(); render(); };
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
$('holiday-list').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  D[b.dataset.k].splice(+b.dataset.i, 1); save(); renderHolidays(); render();
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
      if (!v || typeof v !== 'object' || (!v.profiles && !v.semesters)) throw new Error('bad file');
      D = { ...D, ...v, settings: { ...D.settings, ...(v.settings || {}) } };
      $('dark-mode-select').value = D.settings.darkMode;
      $('target-percent').value = D.settings.targetPercent;
      $('extra-penalty').value = D.settings.extraPenalty || 0;
      $('reminder-enabled').checked = D.settings.reminderEnabled;
      $('reminder-time').value = D.settings.reminderTime;
      applyTheme(); renderHolidays(); render();
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
    D.settings.periodicSyncOn = await tryPeriodicSync();
  }
  D.settings.reminderEnabled = e.target.checked; save(); render();
};
$('reminder-time').onchange = e => { D.settings.reminderTime = e.target.value; save(); render(); };
/* Skips Sunday, holidays (both via working()), and dates already marked Attended or Absent;
   never fires twice for the same date. */
setInterval(() => {
  if (!D.settings.reminderEnabled || !('Notification' in window) || Notification.permission !== 'granted' || !validConfig()) return;
  const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, t = today();
  if (hm === D.settings.reminderTime && D.settings.lastReminded !== t) {
    const s = cur();
    if (working(t, s) && !s.attended.includes(t) && !s.absent.includes(t)) new Notification("Mark today's attendance", { body: 'Open SAC to record whether you were present today.' });
    D.settings.lastReminded = t; save();
  }
}, 30000);

/* ---------- Offline support ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});


/* ---------- Erase All Data ---------- */

const eraseDataDlg = $('erase-data-dlg');

$('erase-all-data').onclick = () => {
  eraseDataDlg.showModal();
};

$('erase-data-cancel').onclick = () => {
  eraseDataDlg.close();
};

$('erase-data-confirm').onclick = () => {
  try {
    // Remove the complete SAC database.
    localStorage.removeItem('attendanceData');

    // Also remove any other SAC-specific localStorage keys
    // if they are introduced later.
    Object.keys(localStorage).forEach(key => {
      if (
        key.startsWith('sac-') ||
        key.startsWith('SAC-')
      ) {
        localStorage.removeItem(key);
      }
    });

    eraseDataDlg.close();

    /*
     * IMPORTANT:
     * Do not just call render().
     *
     * render() uses the existing in-memory D object,
     * which still contains the old data.
     *
     * Reloading forces SAC to run its normal startup:
     *   localStorage → no attendanceData → fresh D
     */
    window.location.reload();

  } catch (e) {
    console.error('SAC: failed to erase all data:', e);

    eraseDataDlg.close();

    toast('Could not erase all data.');
  }
};


/* ---------- Init ---------- */
try {
  $('dark-mode-select').value = D.settings.darkMode;
  $('target-percent').value = D.settings.targetPercent;
  $('extra-penalty').value = D.settings.extraPenalty || 0;
  $('reminder-enabled').checked = D.settings.reminderEnabled;
  $('reminder-time').value = D.settings.reminderTime;
  applyTheme();
  if (!validConfig()) openEduDlg();
  render();
  const migNotes = [D.migrationNote, D.migrationNoteV5].filter(Boolean);
  if (migNotes.length) { toast(migNotes.length > 1 ? 'Your data was upgraded. ' + migNotes.join(' ') : migNotes[0]); delete D.migrationNote; delete D.migrationNoteV5; save(); }
} catch (e) { console.error('SAC failed to start cleanly:', e); toast('Something went wrong loading your data. Your saved data is untouched.'); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
window.addEventListener('focus', render);
setInterval(() => { if (today() !== lastKnownDate) { lastKnownDate = today(); render(); } }, 60000);
})();


