/* ===== تبدیل تاریخ شمسی/میلادی — jalaali-js (MIT, © Behrang Noruzi Niya) ===== */
const JalaaliLib = (function () {
//#region src/index.ts
/**
* Jalaali years that begin a new 33-year leap cycle. Used by the
* Borkowski algorithm to locate the correct cycle for any given year.
*/
const BREAKS = [
	-61,
	9,
	38,
	199,
	426,
	686,
	756,
	818,
	1111,
	1181,
	1210,
	1635,
	2060,
	2097,
	2192,
	2262,
	2324,
	2394,
	2456,
	3178
];
/** Minimum supported Jalaali year (inclusive). */
const MIN_JALAALI_YEAR = BREAKS[0];
/** Maximum supported Jalaali year (inclusive). */
const MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;
function toJalaali(gyOrDate, gm, gd) {
	if (gyOrDate instanceof Date) return d2j(g2d(gyOrDate.getFullYear(), gyOrDate.getMonth() + 1, gyOrDate.getDate()));
	return d2j(g2d(gyOrDate, gm, gd));
}
/**
* Converts a Jalaali date to Gregorian.
*
* @example
* toGregorian(1395, 1, 23) // { gy: 2016, gm: 4, gd: 11 }
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function toGregorian(jy, jm, jd) {
	return d2g(j2d(jy, jm, jd));
}
/**
* Returns `true` if `(jy, jm, jd)` is a real date in the Jalaali calendar.
*
* The check is **lenient** — non-integer inputs that happen to fall inside
* the allowed numeric ranges are accepted. Pass integers in production code.
*
* @example
* isValidJalaaliDate(1394, 12, 30) // false (1394 is a common year)
* isValidJalaaliDate(1395, 12, 30) // true  (1395 is leap)
*/
function isValidJalaaliDate(jy, jm, jd) {
	return jy >= MIN_JALAALI_YEAR && jy <= MAX_JALAALI_YEAR && jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaaliMonthLength(jy, jm);
}
/**
* Returns `true` if the given Jalaali year is leap (366 days).
*
* @example
* isLeapJalaaliYear(1394) // false
* isLeapJalaaliYear(1395) // true
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function isLeapJalaaliYear(jy) {
	return jalCalLeap(jy) === 0;
}
/**
* Returns the number of days in the given Jalaali month.
*
* The function trusts its inputs: `jm` is not range-checked, and an
* out-of-range `jm` will return whichever branch happens to match.
* For input validation, use {@link isValidJalaaliDate} instead.
*
* @example
* jalaaliMonthLength(1394, 12) // 29 (common year)
* jalaaliMonthLength(1395, 12) // 30 (leap year)
*/
function jalaaliMonthLength(jy, jm) {
	if (jm <= 6) return 31;
	if (jm <= 11) return 30;
	return isLeapJalaaliYear(jy) ? 30 : 29;
}
/**
* Computes the leap-cycle state of a Jalaali year and the Gregorian date
* of Farvardin 1 in that year.
*
* Use this directly when you need the leap field; if you only need
* `{ gy, march }`, prefer {@link jalCalShort}.
*
* @example
* jalCal(1391) // { leap: 0, gy: 2012, march: 20 }
* jalCal(1395) // { leap: 0, gy: 2016, march: 20 }
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function jalCal(jy) {
	const { gy, march, jump, n } = jalCalCore(jy);
	return {
		leap: leapFromCycle(jump, n),
		gy,
		march
	};
}
/**
* Like {@link jalCal} but omits the leap-cycle computation.
*
* @remarks
* Equivalent to v1's `jalCal(jy, true)` — extracted to its own export
* in v2 to give it a proper return type. Prefer this when the leap field
* isn't needed; it avoids a small amount of work per call.
*
* @example
* jalCalShort(1391) // { gy: 2012, march: 20 }
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function jalCalShort(jy) {
	const { gy, march } = jalCalCore(jy);
	return {
		gy,
		march
	};
}
/**
* Converts a Jalaali date to a Julian Day number.
*
* The result is an integer corresponding to noon UT on the given calendar
* day. Inputs are not range-checked — pass valid dates.
*
* @example
* j2d(1395, 1, 23) // 2457490
*/
function j2d(jy, jm, jd) {
	const r = jalCalShort(jy);
	return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
const FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
const LAST_JALAALI_JDN = j2d(MAX_JALAALI_YEAR, 12, jalaaliMonthLength(MAX_JALAALI_YEAR, 12));
/**
* Converts a Julian Day number to a Jalaali date.
*
* @example
* d2j(2457490) // { jy: 1395, jm: 1, jd: 23 }
*
* @throws {RangeError} if `jdn` falls outside the supported Jalaali range
*   `[-61, 3177]`.
*/
function d2j(jdn) {
	if (jdn < FIRST_JALAALI_JDN || jdn > LAST_JALAALI_JDN) throw new RangeError(`Invalid Julian Day number ${jdn}: outside the supported Jalaali range [${MIN_JALAALI_YEAR}, ${MAX_JALAALI_YEAR}]`);
	const gy = d2g(jdn).gy;
	let jy = Math.min(gy - 621, MAX_JALAALI_YEAR);
	const r = jalCal(jy);
	let k = jdn - g2d(r.gy, 3, r.march);
	if (k >= 0) {
		if (k <= 185) return {
			jy,
			jm: 1 + div(k, 31),
			jd: mod(k, 31) + 1
		};
		k -= 186;
	} else {
		jy -= 1;
		k += 179;
		if (r.leap === 1) k += 1;
	}
	return {
		jy,
		jm: 7 + div(k, 30),
		jd: mod(k, 30) + 1
	};
}
/**
* Converts a Gregorian date to a Julian Day number.
*
* Tested correct from 1 March, -100100 (of both calendars) through several
* million years into the future.
*
* @example
* g2d(2016, 4, 11) // 2457490
*/
function g2d(gy, gm, gd) {
	let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
	d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
	return d;
}
/**
* Converts a Julian Day number to a Gregorian date.
*
* Valid for `jdn ≥ -34839655` (year -100100 of both calendars).
*
* @example
* d2g(2457490) // { gy: 2016, gm: 4, gd: 11 }
*/
function d2g(jdn) {
	let j = 4 * jdn + 139361631;
	j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
	const i = div(mod(j, 1461), 4) * 5 + 308;
	const gd = div(mod(i, 153), 5) + 1;
	const gm = mod(div(i, 153), 12) + 1;
	return {
		gy: div(j, 1461) - 100100 + div(8 - gm, 6),
		gm,
		gd
	};
}
/**
* Converts a Jalaali date (optionally with a time of day) to a JavaScript
* `Date` constructed in the local time zone.
*
* Time components default to `0`. Out-of-range time components are *not*
* clamped — they overflow the way the `Date` constructor handles them
* (e.g. `h = 25` rolls into the next day).
*
* @example
* jalaaliToDateObject(1400, 4, 30)
*   // → new Date(2021, 6, 21, 0, 0, 0, 0)
*
* jalaaliToDateObject(1400, 4, 30, 14, 30)
*   // → new Date(2021, 6, 21, 14, 30)
*/
function jalaaliToDateObject(jy, jm, jd, h = 0, m = 0, s = 0, ms = 0) {
	const g = toGregorian(jy, jm, jd);
	return new Date(g.gy, g.gm - 1, g.gd, h, m, s, ms);
}
/**
* Returns the Saturday and Friday bounding the Jalaali week that contains
* the given date. The Jalaali week starts on **Saturday**.
*
* @example
* jalaaliWeek(1400, 4, 30)
*   // → { saturday: { jy: 1400, jm: 4, jd: 26 },
*   //     friday:   { jy: 1400, jm: 5, jd:  1 } }
*
* @remarks
* Uses {@link jalaaliToDateObject} to read the day-of-week, which reflects
* the host's local time zone. For dates near a DST boundary the underlying
* `Date.getDay()` is still correct because the conversion is done in local
* time on both sides.
*/
function jalaaliWeek(jy, jm, jd) {
	const dayOfWeek = jalaaliToDateObject(jy, jm, jd).getDay();
	const startDayDifference = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
	const endDayDifference = 6 + startDayDifference;
	return {
		saturday: d2j(j2d(jy, jm, jd + startDayDifference)),
		friday: d2j(j2d(jy, jm, jd + endDayDifference))
	};
}
/**
* Core of the Borkowski algorithm: locate the Jalaali year inside the
* cycle table and compute Farvardin 1's Gregorian date.
*/
function jalCalCore(jy) {
	if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
	const gy = jy + 621;
	let leapJ = -14;
	let jp = BREAKS[0];
	let jm = 0;
	let jump = 0;
	for (let i = 1; i < BREAKS.length; i += 1) {
		jm = BREAKS[i];
		jump = jm - jp;
		if (jy < jm) break;
		leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
		jp = jm;
	}
	const n = jy - jp;
	leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
	if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
	const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
	return {
		gy,
		march: 20 + leapJ - leapG,
		jump,
		n
	};
}
/**
* Given a 33-year cycle length `jump` and the year offset `n` within that
* cycle, returns the number of years since the last leap year (`0 … 4`).
* `0` means the current year is leap.
*/
function leapFromCycle(jump, n) {
	let adjusted = n;
	if (jump - n < 6) adjusted = n - jump + div(jump + 4, 33) * 33;
	let leap = mod(mod(adjusted + 1, 33) - 1, 4);
	if (leap === -1) leap = 4;
	return leap;
}
/**
* Leap-only variant — same loop as {@link jalCalCore} without computing
* the Gregorian fields. Kept separate to avoid the per-call object
* allocation on the hot `isLeapJalaaliYear` path.
*/
function jalCalLeap(jy) {
	if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
	let jp = BREAKS[0];
	let jm = 0;
	let jump = 0;
	for (let i = 1; i < BREAKS.length; i += 1) {
		jm = BREAKS[i];
		jump = jm - jp;
		if (jy < jm) break;
		jp = jm;
	}
	return leapFromCycle(jump, jy - jp);
}
/**
* Integer division — `Math.trunc(a / b)` equivalent that's faster on V8
* for values that fit in 32 bits. Used pervasively inside the algorithm.
*/
function div(a, b) {
	return ~~(a / b);
}
/**
* Mathematical modulo — like `%` but always returns a non-negative result
* when `b` is positive (matches Python's `%` semantics, not JavaScript's).
*/
function mod(a, b) {
	return a - ~~(a / b) * b;
}
//#endregion
return { toJalaali, toGregorian, isValidJalaaliDate, jalaaliMonthLength };
})();

const SUPABASE_URL = "https://ooeedxwyjpcgurxeutdb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZWVkeHd5anBjZ3VyeGV1dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzM4NTEsImV4cCI6MjEwNTY0OTg1MX0.ZbDel9uPG0sSsdzWRbgvrH_inLA7IafmprYTpqhTPXQ";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STAGES = ["سرنخ جدید", "تماس اولیه", "جلسه برگزار شد", "پیشنهاد ارسال شد", "برنده", "بازنده"];
const SPECIALTIES = ["ورزشی", "مسکونی", "تجاری-اداری", "بازسازی بافت فرسوده", "سایر"];
const CLIENT_TYPES = ["خصوصی-مسکونی", "شرکتی-تجاری‌اداری", "دولتی-نهادی"];
const PHASES = ["فاز صفر", "طراحی مفهومی", "طراحی تفصیلی (DD)", "اجرا", "نظارت", "تکمیل‌شده"];
const PROJECT_STATUSES = ["فعال", "متوقف", "لغوشده", "تکمیل‌شده"];
const CONTRACT_STATUSES = ["پیش‌نویس", "امضاشده", "فسخ‌شده"];
const DEPARTMENTS = ["طراحی و اجرا - معماری", "طراحی و اجرا - داخلی", "طراحی و اجرا - نظارت", "توسعه بازار و ورزشی", "مالی و قرارداد", "مدیریت پروژه"];
const ACCESS_LEVELS = ["مشاهده", "تعامل", "مدیریت"];
const TASK_PRIORITIES = ["بالا", "متوسط", "پایین"];
const TASK_STATUSES = ["در انتظار", "در حال انجام", "تکمیل‌شده"];
const TENDER_TYPES = ["مناقصه", "مسابقه"];
const TENDER_STATUSES = ["در حال بررسی", "ثبت‌نام‌شده", "برنده", "بازنده"];

let currentUser = null, currentProfile = null;
let attendanceTimer = null, activeCheckIn = null;
let allProfiles = [];

let leads = [], clients = [], projects = [], contracts = [], contractStagesMap = {},
    members = [], erpTasks = [], fixedCosts = [], tenders = [], interactions = [];


function toFaDigits(str) { return String(str).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }

// نمایش تاریخ: از میلادی (ذخیره‌شده در دیتابیس) به شمسی
function fmtDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const j = JalaaliLib.toJalaali(+m[1], +m[2], +m[3]);
  return toFaDigits(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`);
}

// انتخاب تاریخ شمسی با سه کشویی (سال / ماه / روز)
function jalaliDateField(id, iso) {
  const now = new Date();
  const cur = JalaaliLib.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  const sel = m ? JalaaliLib.toJalaali(+m[1], +m[2], +m[3]) : null;
  let y0 = cur.jy - 2, y1 = cur.jy + 5;
  if (sel) { y0 = Math.min(y0, sel.jy); y1 = Math.max(y1, sel.jy); }
  let years = '<option value="">سال</option>';
  for (let y = y0; y <= y1; y++) years += `<option value="${y}" ${sel && sel.jy === y ? 'selected' : ''}>${toFaDigits(y)}</option>`;
  const months = '<option value="">ماه</option>' + JALALI_MONTHS.map((n, i) => `<option value="${i + 1}" ${sel && sel.jm === i + 1 ? 'selected' : ''}>${n}</option>`).join('');
  let days = '<option value="">روز</option>';
  for (let d = 1; d <= 31; d++) days += `<option value="${d}" ${sel && sel.jd === d ? 'selected' : ''}>${toFaDigits(d)}</option>`;
  return `<span class="jdate" id="${id}"><select>${years}</select><select>${months}</select><select>${days}</select></span>`;
}
// خواندن تاریخ انتخاب‌شده: خروجی میلادی «YYYY-MM-DD» یا null اگر کامل انتخاب نشده
function getJalaliDate(id) {
  const box = document.getElementById(id); if (!box) return null;
  const [ys, ms, ds] = box.querySelectorAll('select');
  const jy = parseInt(ys.value), jm = parseInt(ms.value);
  let jd = parseInt(ds.value);
  if (!jy || !jm || !jd) return null;
  jd = Math.min(jd, JalaaliLib.jalaaliMonthLength(jy, jm));
  const g = JalaaliLib.toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}
function clearJalaliDate(id) {
  const box = document.getElementById(id);
  if (box) box.querySelectorAll('select').forEach(x => { x.value = ''; });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function statusLabel(s) {
  if (s === 'new') return '<span class="status-badge status-new">جدید</span>';
  if (s === 'progress') return '<span class="status-badge status-progress">در حال انجام</span>';
  return '<span class="status-badge status-done">تکمیل شده</span>';
}
function scoreClass(n) { return n >= 4 ? 'high' : n >= 3 ? 'mid' : 'low'; }

let sessionToken = null;
async function authHeader() {
  if (!sessionToken) { const { data } = await sb.auth.getSession(); sessionToken = data.session ? data.session.access_token : null; }
  return { Authorization: 'Bearer ' + sessionToken };
}
async function apiPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}

// ================= AUTH =================
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const email = username + '@daftar.local';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById('login-error').innerText = "نام کاربری یا رمز عبور اشتباه است."; return; }
  currentUser = data.user;
  sessionToken = data.session.access_token;
  await loadProfileAndShowApp();
}
async function doLogout() {
  if (taskChannel) { sb.removeChannel(taskChannel); taskChannel = null; }
  try {
    const sub = swReg && await swReg.pushManager.getSubscription();
    if (sub) { await apiPost('/api/push-subscribe', { action: 'unsubscribe', endpoint: sub.endpoint }); }
  } catch (e) {}
  await sb.auth.signOut();
  sessionToken = null;
  clearInterval(attendanceTimer);
  document.getElementById('app-root').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}
async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) { currentUser = data.session.user; sessionToken = data.session.access_token; await loadProfileAndShowApp(); }
}

const NAV_ITEMS = [
  { id: 'attendance', label: 'ورود و خروج' },
  { id: 'tasks', label: 'کارها' },
  { id: 'dashboard', label: 'داشبورد', adminOnly: true },
  { id: 'pipeline', label: 'پایپ‌لاین سرنخ‌ها', adminOnly: true },
  { id: 'clients', label: 'کارفرمایان', adminOnly: true },
  { id: 'projects', label: 'پروژه‌ها', adminOnly: true },
  { id: 'contracts', label: 'قراردادها و مطالبات', adminOnly: true },
  { id: 'office-tasks', label: 'کارهای دفتر', adminOnly: true },
  { id: 'team', label: 'تیم', adminOnly: true },
  { id: 'erp-tasks', label: 'وظایف', adminOnly: true },
  { id: 'costs', label: 'هزینه‌های ثابت', adminOnly: true },
  { id: 'tenders', label: 'مناقصه / مسابقه', adminOnly: true },
];

async function loadProfileAndShowApp() {
  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = profile || { full_name: currentUser.email, is_admin: false };
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
  document.getElementById('user-badge').innerText = `${currentProfile.full_name || ''} ${currentProfile.role_title ? '— ' + currentProfile.role_title : ''}`;

  buildNav();
  switchSection('attendance');
  loadAttendanceStatus();
  loadMyTasks();
  refreshGoogleStatus();
  startTaskNotifications();

  if (currentProfile.is_admin) {
    const { data: profs } = await sb.from('profiles').select('*');
    allProfiles = profs || [];
    refreshAllErpData();
    if (document.getElementById('teamtasks-table')) { fillEmployeeSelect(); loadTeamTasks(); }
    if (document.getElementById('attendance-all-table')) loadAttendanceAll();
  }
}


// ================= اعلان فوری کار جدید =================
let swReg = null, taskChannel = null;
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#342D73;color:#fff;padding:12px 18px;border-radius:10px;z-index:200;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:90vw;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 7000);
}
async function notifyUser(title, body) {
  showToast(`${title}: ${body}`);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (swReg) await swReg.showNotification(title, { body, dir: 'rtl', lang: 'fa' });
    else new Notification(title, { body, dir: 'rtl' });
  } catch (e) { /* اعلان سیستمی ممکن نشد؛ پیام داخل صفحه نمایش داده شد */ }
}
const VAPID_PUBLIC_KEY = 'BBlhXzAtTRWGRgqQbXw7eaNFdRl_pKd4Gjzg2vGKNdplVGfAq0GGM2pGRpbe5r1inrgmc0GNfkNX8XYGokzdPpg';
function b64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// ثبت این دستگاه برای دریافت اعلان‌های سرور (یادآور ورود و خروج)
async function subscribeToPush() {
  if (!pushSupported() || !swReg) return false;
  let sub = await swReg.pushManager.getSubscription();
  if (!sub) sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
  const r = await apiPost('/api/push-subscribe', { subscription: sub.toJSON() });
  return r && r.status === 'saved';
}
async function enableNotifications() {
  if (isIOS() && !isStandalone()) { showInstallHelp(); return; }
  if (!pushSupported()) { alert('این مرورگر از اعلان پشتیبانی نمی‌کند. از کروم یا سافاری استفاده کن.'); return; }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { alert('اجازه‌ی اعلان داده نشد. از تنظیمات مرورگر/گوشی می‌توانی فعالش کنی.'); return; }
  const ok = await subscribeToPush();
  const btn = document.getElementById('notif-btn');
  if (ok) { if (btn) btn.classList.add('hidden'); notifyUser('اعلان‌ها فعال شد ✅', 'یادآور ورود (۹ صبح) و خروج (۵ عصر) برای این دستگاه فعال است.'); }
  else alert('فعال‌سازی اعلان روی سرور ثبت نشد، دوباره تلاش کن.');
}

// نصب اپ روی گوشی
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; updateInstallBtn(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; updateInstallBtn(); });
function updateInstallBtn() {
  const btn = document.getElementById('install-btn'); if (!btn) return;
  btn.classList.toggle('hidden', isStandalone() || !currentUser);
}
async function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; updateInstallBtn(); }
  else showInstallHelp();
}
function showInstallHelp() {
  const ios = isIOS();
  const steps = ios
    ? ['در Safari این صفحه را باز کن (نه کروم)', 'روی دکمه‌ی اشتراک‌گذاری (مربع با فلش رو به بالا) بزن', '«Add to Home Screen» (افزودن به صفحه‌ی اصلی) را انتخاب کن', 'اپ را از آیکونش روی صفحه‌ی اصلی باز کن و آنجا «فعال‌سازی اعلان» را بزن']
    : ['روی منوی سه‌نقطه‌ی مرورگر بزن', '«Install app» یا «افزودن به صفحه‌ی اصلی» را انتخاب کن', 'اپ را از آیکونش روی صفحه‌ی اصلی باز کن'];
  const root = document.getElementById('edit-modal-root');
  root.innerHTML = `<div class="overlay" onclick="if(event.target===this) this.remove()"><div class="modal">
    <h3>نصب اپ روی ${ios ? 'آیفون' : 'گوشی'}</h3>
    <ol style="line-height:2;padding-right:18px;margin:0;">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
    ${ios ? '<p style="font-size:12px;color:var(--muted);">در آیفون، اعلان فقط بعد از نصب اپ روی صفحه‌ی اصلی کار می‌کند (iOS نسخه ۱۶.۴ به بالا).</p>' : ''}
    <div class="modal-actions"><button class="btn" onclick="this.closest('.overlay').remove()">متوجه شدم</button></div>
  </div></div>`;
}

async function startTaskNotifications() {
  if ('serviceWorker' in navigator) { try { swReg = await navigator.serviceWorker.register('/sw.js'); } catch (e) {} }
  updateInstallBtn();
  const btn = document.getElementById('notif-btn');
  if (pushSupported() && Notification.permission === 'granted') {
    subscribeToPush().catch(() => {});                       // هر بار ورود، دستگاه دوباره روی حساب فعلی ثبت می‌شود
    if (btn) btn.classList.add('hidden');
  } else if (btn) {
    btn.classList.remove('hidden');                          // در آیفونِ نصب‌نشده هم نمایش داده می‌شود تا راهنما بیاید
  }
  if (taskChannel) sb.removeChannel(taskChannel);
  taskChannel = sb.channel('tasks-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'personal_tasks', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
      const t = payload.new;
      if (t.assigned_by && t.assigned_by !== currentUser.id) {
        notifyUser('کار جدید برای شما', `${t.title}${t.due_date ? ' — مهلت: ' + fmtDate(t.due_date) : ''}`);
      }
      loadMyTasks();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'personal_tasks', filter: `user_id=eq.${currentUser.id}` }, () => loadMyTasks())
    .subscribe();
}

let googleStatus = null;
async function refreshGoogleStatus() {
  const r = await fetch('/api/google-status', { headers: await authHeader() });
  googleStatus = await r.json().catch(() => null);
  const btn = document.getElementById('calendar-btn');
  if (!googleStatus || !btn) return;
  btn.classList.remove('hidden');
  if (googleStatus.me.needs_reconnect) btn.innerText = '⚠️ اتصال مجدد به گوگل کلندر';
  else if (googleStatus.me.connected) btn.innerText = `متصل: ${googleStatus.me.email || 'گوگل کلندر'}`;
  else btn.innerText = 'اتصال به گوگل کلندر';
  if (currentProfile.is_admin && document.getElementById('teamtasks-table')) renderEmployeeCalendarBadges();
}
function renderEmployeeCalendarBadges() {
  if (!googleStatus || !googleStatus.all) return;
  ['team-task-employee', 'team-task-filter'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    [...sel.options].forEach(opt => {
      const st = googleStatus.all[opt.value];
      const base = opt.textContent.replace(/ \((وصل نیست|نیاز به اتصال مجدد)\)$/, '');
      if (st && st.needs_reconnect) opt.textContent = base + ' (نیاز به اتصال مجدد)';
      else if (st && !st.connected) opt.textContent = base + ' (وصل نیست)';
      else opt.textContent = base;
    });
  });
}
async function connectCalendar() {
  const r = await apiPost('/api/auth/login');
  if (r && r.url) window.location.href = r.url;
  else alert('اتصال به گوگل ممکن نشد.');
}

function buildNav() {
  const nav = document.getElementById('top-nav');
  const visible = NAV_ITEMS.filter(t => !t.adminOnly || currentProfile.is_admin);
  nav.innerHTML = visible.map((t,i) => `<button data-id="${t.id}" class="${i===0?'active':''}" onclick="switchSection('${t.id}')">${t.label}</button>`).join('');
}

function switchSection(id) {
  document.querySelectorAll('#top-nav button').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  document.querySelectorAll('main > div').forEach(d => d.classList.add('hidden'));
  document.getElementById('section-' + id).classList.remove('hidden');
  const renderMap = {
    dashboard: renderDashboard, pipeline: renderPipeline, clients: renderClients,
    projects: renderProjects, contracts: renderContracts, team: renderTeam,
    'erp-tasks': renderErpTasks, costs: renderFixedCosts, tenders: renderTenders,
    'office-tasks': renderOfficeTasks
  };
  if (id === 'attendance') renderAttendanceSection();
  else if (id === 'tasks') renderTasksSection();
  else if (renderMap[id]) document.getElementById('section-' + id).innerHTML = renderMap[id]();
}

async function refreshAllErpData() {
  const [l, c, p, ct, m, et, fc, td, itr] = await Promise.all([
    sb.from('leads').select('*').order('created_at', { ascending: false }),
    sb.from('clients').select('*').order('created_at', { ascending: false }),
    sb.from('projects').select('*').order('created_at', { ascending: false }),
    sb.from('contracts').select('*').order('created_at', { ascending: false }),
    sb.from('members').select('*').order('created_at', { ascending: false }),
    sb.from('erp_tasks').select('*').order('created_at', { ascending: false }),
    sb.from('fixed_costs').select('*').order('created_at', { ascending: false }),
    sb.from('tenders').select('*').order('created_at', { ascending: false }),
    sb.from('interactions').select('*').order('created_at', { ascending: false }),
  ]);
  leads = l.data || []; clients = c.data || []; projects = p.data || []; contracts = ct.data || [];
  members = m.data || []; erpTasks = et.data || []; fixedCosts = fc.data || []; tenders = td.data || [];
  interactions = itr.data || [];
  cacheRows('leads', leads); cacheRows('clients', clients); cacheRows('projects', projects); cacheRows('contracts', contracts);
  cacheRows('members', members); cacheRows('erp_tasks', erpTasks); cacheRows('fixed_costs', fixedCosts); cacheRows('tenders', tenders);

  const { data: stages } = await sb.from('contract_stages').select('*');
  cacheRows('contract_stages', stages || []);
  contractStagesMap = {};
  (stages || []).forEach(s => {
    if (!contractStagesMap[s.contract_id]) contractStagesMap[s.contract_id] = [];
    contractStagesMap[s.contract_id].push(s);
  });

  const current = document.querySelector('#top-nav button.active');
  if (current) switchSection(current.dataset.id);
}

// ================= حضور و غیاب =================
function renderAttendanceSection() {
  const el = document.getElementById('section-attendance');
  const adminBlock = currentProfile.is_admin ? `
    <div class="card">
      <div class="row-top">
        <h2>حضور و غیاب همه پرسنل</h2>
        <div class="row" style="margin:0;">
          <select id="export-jy"></select>
          <select id="export-jm"></select>
          <button class="btn small" onclick="exportTimesheet()">دریافت خروجی اکسل این ماه</button>
        </div>
      </div>
      <table><thead><tr><th>نام</th><th>تاریخ</th><th>ورود</th><th>خروج</th><th>مدت</th></tr></thead><tbody id="attendance-all-table"></tbody></table>
    </div>` : '';
  el.innerHTML = `
    <div class="card">
      <div class="counter" id="attendance-counter">--:--:--</div>
      <div style="text-align:center;"><button class="btn big" id="attendance-btn" onclick="toggleAttendance()">ثبت ورود</button></div>
      <h3 style="margin-top:24px;">تاریخچه</h3>
      <table><thead><tr><th>تاریخ</th><th>ورود</th><th>خروج</th><th>مدت</th></tr></thead><tbody id="attendance-table"></tbody></table>
    </div>
    ${adminBlock}
  `;
  loadAttendanceStatus();
  if (currentProfile.is_admin) { loadAttendanceAll(); fillJalaliSelectors(); }
}

async function loadAttendanceStatus() {
  const { data } = await sb.from('attendance').select('*').eq('user_id', currentUser.id).is('check_out', null).order('created_at', { ascending: false }).limit(1);
  const btn = document.getElementById('attendance-btn');
  if (!btn) return;
  if (data && data[0]) {
    activeCheckIn = data[0]; btn.innerText = 'ثبت خروج'; startCounter(new Date(activeCheckIn.check_in));
  } else {
    activeCheckIn = null; btn.innerText = 'ثبت ورود';
    document.getElementById('attendance-counter').innerText = '--:--:--'; clearInterval(attendanceTimer);
  }
  loadMyAttendanceHistory();
}
function startCounter(startTime) {
  clearInterval(attendanceTimer);
  attendanceTimer = setInterval(() => {
    const diff = Date.now() - startTime.getTime();
    const h = String(Math.floor(diff/3600000)).padStart(2,'0');
    const m = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    const c = document.getElementById('attendance-counter');
    if (c) c.innerText = `${h}:${m}:${s}`;
  }, 1000);
}
async function toggleAttendance() {
  if (activeCheckIn) await sb.from('attendance').update({ check_out: new Date().toISOString() }).eq('id', activeCheckIn.id);
  else await sb.from('attendance').insert([{ user_id: currentUser.id, check_in: new Date().toISOString() }]);
  loadAttendanceStatus();
}
function formatDuration(inTime, outTime) {
  if (!outTime) return '—';
  const diff = new Date(outTime) - new Date(inTime);
  return `${Math.floor(diff/3600000)} ساعت ${Math.floor((diff%3600000)/60000)} دقیقه`;
}
async function loadMyAttendanceHistory() {
  const { data } = await sb.from('attendance').select('*').eq('user_id', currentUser.id).order('check_in', { ascending: false }).limit(30);
  const tbody = document.getElementById('attendance-table'); if (!tbody) return;
  tbody.innerHTML = (data||[]).map(a => `<tr>
    <td>${new Date(a.check_in).toLocaleDateString('fa-IR')}</td>
    <td>${new Date(a.check_in).toLocaleTimeString('fa-IR')}</td>
    <td>${a.check_out ? new Date(a.check_out).toLocaleTimeString('fa-IR') : '—'}</td>
    <td>${formatDuration(a.check_in, a.check_out)}</td>
  </tr>`).join('');
}
async function loadAttendanceAll() {
  const { data } = await sb.from('attendance').select('*').order('check_in', { ascending: false }).limit(100);
  const tbody = document.getElementById('attendance-all-table'); if (!tbody) return;
  tbody.innerHTML = (data||[]).map(a => `<tr>
    <td>${escapeHtml(nameOf(a.user_id))}</td>
    <td>${new Date(a.check_in).toLocaleDateString('fa-IR')}</td>
    <td>${new Date(a.check_in).toLocaleTimeString('fa-IR')}</td>
    <td>${a.check_out ? new Date(a.check_out).toLocaleTimeString('fa-IR') : '—'}</td>
    <td>${formatDuration(a.check_in, a.check_out)}</td>
  </tr>`).join('');
}
const JALALI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
function fillJalaliSelectors() {
  const now = new Date(); const cur = JalaaliLib.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate()); const baseJY = cur.jy;
  const yearSel = document.getElementById('export-jy'), monthSel = document.getElementById('export-jm');
  if (!yearSel) return;
  yearSel.innerHTML = ''; for (let y=baseJY-1; y<=baseJY+1; y++) yearSel.innerHTML += `<option value="${y}" ${y===baseJY?'selected':''}>${y}</option>`;
  monthSel.innerHTML = JALALI_MONTHS.map((m,i) => `<option value="${i+1}" ${i+1===cur.jm?'selected':''}>${m}</option>`).join('');
}
function exportTimesheet() {
  const jy = document.getElementById('export-jy').value, jm = document.getElementById('export-jm').value;
  if (!jy || !jm) { alert('سال و ماه رو انتخاب کن'); return; }
  window.open(`/api/export-timesheet?jy=${jy}&jm=${jm}`, '_blank');
}

// ================= کارها (شخصی) =================
function renderTasksSection() {
  const el = document.getElementById('section-tasks');
  const teamBlock = currentProfile.is_admin ? `
    <div class="card">
      <div class="row-top"><h2>کارهای کارمندان</h2></div>
      <div class="row">
        <select id="team-task-employee"></select>
        <input type="text" id="team-task-title" placeholder="عنوان کار">
        ${jalaliDateField('team-task-date')}
        <button class="btn" onclick="addTeamTask()">محول کردن کار</button>
      </div>
      <div class="row">
        <label style="margin:0;">نمایش کارهای:</label>
        <select id="team-task-filter" onchange="loadTeamTasks()"><option value="">— همه پرسنل —</option></select>
      </div>
      <div id="team-task-summary" style="margin-bottom:10px;font-size:13px;color:var(--muted);"></div>
      <table><thead><tr><th>کارمند</th><th>عنوان</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead><tbody id="teamtasks-table"></tbody></table>
    </div>` : '';
  el.innerHTML = `
    <div class="card">
      <div class="row-top"><h2>کارهای من</h2></div>
      <div class="row">
        <input type="text" id="mytask-title" placeholder="عنوان کار">
        ${jalaliDateField('mytask-date')}
        <button class="btn" onclick="addMyTask()">افزودن</button>
      </div>
      <table><thead><tr><th>عنوان</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead><tbody id="mytasks-table"></tbody></table>
    </div>
    ${teamBlock}
  `;
  loadMyTasks();
  if (currentProfile.is_admin) { fillEmployeeSelect(); loadTeamTasks(); }
}

const CAL_MSG = {
  not_connected: 'گوگل کلندر وصل نیست، پس مهلت در کلندر ثبت نشد.',
  needs_reconnect: 'اتصال گوگل کلندر منقضی شده و باید دوباره وصل شود.',
  error: 'ثبت در گوگل کلندر انجام نشد.',
  google_error: 'ثبت در گوگل کلندر انجام نشد.'
};
async function syncTaskCalendar(taskId, forOther) {
  const r = await apiPost('/api/task-calendar', { task_id: taskId, action: 'sync' });
  if (r && r.status === 'created') showToast('مهلت در گوگل کلندر ثبت شد ✅');
  else if (r && CAL_MSG[r.status]) showToast((forOther ? 'برای این کارمند: ' : '') + CAL_MSG[r.status]);
}
function taskActionButtons(t, onDelete) {
  const next = { new: ['progress', 'شروع کار'], progress: ['done', 'انجام شد'] }[t.status];
  return `${next ? `<button class="btn small" onclick="advanceTask('${t.id}','${next[0]}')">${next[1]}</button>` : ''}
    ${t.status === 'done' ? `<button class="btn small secondary" onclick="advanceTask('${t.id}','new')">بازگشایی</button>` : ''}
    <button class="btn small secondary" onclick="editRow('personal_tasks','${t.id}')">ویرایش</button>
    <button class="btn small danger" onclick="${onDelete}">حذف</button>`;
}
async function advanceTask(id, status) {
  await sb.from('personal_tasks').update({ status }).eq('id', id);
  apiPost('/api/task-calendar', { task_id: id, action: 'sync' });
  loadMyTasks(); if (currentProfile.is_admin) loadTeamTasks();
}

async function addMyTask() {
  const title = document.getElementById('mytask-title').value.trim();
  const due_date = getJalaliDate('mytask-date');
  if (!title) return;
  const { data, error } = await sb.from('personal_tasks').insert([{ user_id: currentUser.id, title, due_date, status: 'new' }]).select().single();
  document.getElementById('mytask-title').value=''; clearJalaliDate('mytask-date');
  if (error) { alert('ذخیره نشد: ' + error.message); return; }
  if (data && due_date) syncTaskCalendar(data.id, false);
  loadMyTasks();
}
async function loadMyTasks() {
  const { data } = await sb.from('personal_tasks').select('*').eq('user_id', currentUser.id).order('due_date', { ascending: true });
  const tbody = document.getElementById('mytasks-table'); if (!tbody) return;
  cacheRows('personal_tasks', data||[]);
  tbody.innerHTML = (data||[]).map(t => `<tr>
    <td>${escapeHtml(t.title)}</td><td>${fmtDate(t.due_date)}</td><td>${statusLabel(t.status)}</td>
    <td>${taskActionButtons(t, `deleteMyTask('${t.id}')`)}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="empty">کاری ثبت نشده</td></tr>';
}
async function deleteMyTask(id) {
  await apiPost('/api/task-calendar', { task_id: id, action: 'remove' });
  await sb.from('personal_tasks').delete().eq('id', id);
  loadMyTasks(); if (currentProfile.is_admin) loadTeamTasks();
}

function nameOf(uid) { const p = allProfiles.find(x => x.id === uid); return p ? (p.full_name || '—') : '—'; }
function fillEmployeeSelect() {
  const opts = allProfiles.map(p => `<option value="${p.id}">${escapeHtml(p.full_name || p.id.slice(0,8))}</option>`).join('');
  const sel = document.getElementById('team-task-employee'); if (sel) sel.innerHTML = opts;
  const filt = document.getElementById('team-task-filter'); if (filt) filt.innerHTML = '<option value="">— همه پرسنل —</option>' + opts;
}
async function addTeamTask() {
  const user_id = document.getElementById('team-task-employee').value;
  const title = document.getElementById('team-task-title').value.trim();
  const due_date = getJalaliDate('team-task-date');
  if (!title || !user_id) return;
  const { data, error } = await sb.from('personal_tasks').insert([{ user_id, title, due_date, status: 'new', assigned_by: currentUser.id }]).select().single();
  document.getElementById('team-task-title').value=''; clearJalaliDate('team-task-date');
  if (error) { alert('ذخیره نشد: ' + error.message); return; }
  if (data && due_date) syncTaskCalendar(data.id, data.user_id !== currentUser.id);
  loadTeamTasks(); if (data && data.user_id === currentUser.id) loadMyTasks();
}
async function loadTeamTasks() {
  const filterId = document.getElementById('team-task-filter') ? document.getElementById('team-task-filter').value : '';
  let q = sb.from('personal_tasks').select('*').order('due_date', { ascending: true });
  if (filterId) q = q.eq('user_id', filterId);
  const { data } = await q;
  const rows = data || [];
  cacheRows('personal_tasks', rows);
  const tbody = document.getElementById('teamtasks-table'); if (!tbody) return;
  tbody.innerHTML = rows.map(t => `<tr>
    <td>${escapeHtml(nameOf(t.user_id))}</td><td>${escapeHtml(t.title)}</td><td>${fmtDate(t.due_date)}</td><td>${statusLabel(t.status)}</td>
    <td>${taskActionButtons(t, `deleteTeamTask('${t.id}')`)}</td>
  </tr>`).join('') || '<tr><td colspan="5" class="empty">کاری ثبت نشده</td></tr>';

  const summary = document.getElementById('team-task-summary');
  if (summary) {
    const c = { new: 0, progress: 0, done: 0 };
    rows.forEach(t => { c[t.status] = (c[t.status]||0) + 1; });
    summary.innerHTML = filterId
      ? `از مجموع ${rows.length} کار: <b>${c.new||0}</b> انجام‌نشده، <b>${c.progress||0}</b> در حال انجام، <b>${c.done||0}</b> انجام‌شده`
      : `مجموع ${rows.length} کار برای همه پرسنل`;
  }
}
async function deleteTeamTask(id) {
  await apiPost('/api/task-calendar', { task_id: id, action: 'remove' });
  await sb.from('personal_tasks').delete().eq('id', id);
  loadTeamTasks();
}

// ================= داشبورد =================
function renderDashboard() {
  const activeLeads = leads.filter(l => l.stage !== 'برنده' && l.stage !== 'بازنده').length;
  const won = leads.filter(l => l.stage === 'برنده').length;
  const lost = leads.filter(l => l.stage === 'بازنده').length;
  const total = won + lost;
  const conv = total > 0 ? Math.round((won/total)*100) : 0;
  const activeProjects = projects.filter(p => p.status === 'فعال').length;
  let overdueSum = 0, pendingSum = 0;
  Object.values(contractStagesMap).flat().forEach(s => {
    const eff = stageEffectiveStatus(s);
    if (eff === 'سررسید گذشته') overdueSum += (s.amount||0);
    if (eff === 'در انتظار') pendingSum += (s.amount||0);
  });
  const monthlyCosts = fixedCosts.reduce((a,c) => a + (c.monthly_amount||0), 0);
  const netFlow = pendingSum - monthlyCosts;
  const todayStr = new Date().toISOString().slice(0,10);
  const upcoming = interactions.filter(i => i.next_follow_up_date && i.next_follow_up_date >= todayStr)
    .sort((a,b) => new Date(a.next_follow_up_date)-new Date(b.next_follow_up_date)).slice(0,6);

  return `
    <div class="grid-stats">
      <div class="stat"><div class="num">${activeLeads}</div><div class="label">سرنخ فعال</div></div>
      <div class="stat"><div class="num">${clients.length}</div><div class="label">کارفرما</div></div>
      <div class="stat"><div class="num">${conv}%</div><div class="label">نرخ تبدیل</div></div>
      <div class="stat"><div class="num">${activeProjects}</div><div class="label">پروژه فعال</div></div>
      <div class="stat"><div class="num" style="color:var(--danger);">${overdueSum.toLocaleString('fa-IR')}</div><div class="label">مطالبات معوق (تومان)</div></div>
    </div>
    <div class="card">
      <div class="row-top" style="margin-bottom:0;">
        <div><h2 style="margin:0;">جریان نقدی برآوردی</h2><div class="meta" style="color:var(--muted);font-size:12px;">مطالبات در انتظار منهای هزینه ثابت ماهانه</div></div>
        <div class="num" style="font-size:22px;color:${netFlow>=0?'var(--success)':'var(--danger)'};">${netFlow.toLocaleString('fa-IR')} تومان</div>
      </div>
    </div>
    <div class="card">
      <h2>پیگیری‌های نزدیک</h2>
      ${upcoming.length ? upcoming.map(i => `<div style="border-bottom:1px solid var(--border);padding:10px 0;font-size:13px;">
        <strong>${escapeHtml(i.related_name||'')}</strong> — ${escapeHtml(i.type)}
        <div style="color:var(--muted);font-size:11px;">${escapeHtml(i.note||'')} ${i.next_follow_up_date===todayStr?'· امروز':'· '+fmtDate(i.next_follow_up_date)}</div>
      </div>`).join('') : '<div class="empty">پیگیری‌ای ثبت نشده</div>'}
    </div>
  `;
}

// ================= پایپ‌لاین سرنخ‌ها =================
function renderPipeline() {
  let html = `
    <div class="row-top"><h2>پایپ‌لاین سرنخ‌ها</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="lead-name" placeholder="نام سرنخ">
        <input type="text" id="lead-source" placeholder="منبع">
        <select id="lead-specialty"><option value="">دسته تخصصی</option>${SPECIALTIES.map(s=>`<option>${s}</option>`).join('')}</select>
        <button class="btn" onclick="addLead()">+ سرنخ جدید</button>
      </div>
    </div>
    <div class="pipeline">`;
  STAGES.forEach(stage => {
    const items = leads.filter(l => l.stage === stage);
    html += `<div class="stage-col"><h3>${stage} <span>${items.length}</span></h3>`;
    if (!items.length) html += `<div class="empty" style="padding:10px 0;">—</div>`;
    items.forEach(l => {
      const idx = STAGES.indexOf(l.stage) + 1;
      const nextStage = idx < STAGES.length - 2 ? STAGES[idx] : null;
      html += `<div class="lead-card">
        <div class="name">${escapeHtml(l.name)}</div>
        <div class="meta">${l.specialty_category?`<span class="tag">${l.specialty_category}</span>`:''}${l.source?escapeHtml(l.source):''}</div>
        <div class="actions">
          ${nextStage?`<button class="btn small secondary" onclick="updateLeadStage('${l.id}','${nextStage}')">→ ${nextStage}</button>`:''}
          ${stage!=='برنده'&&stage!=='بازنده'?`<button class="btn small secondary" onclick="updateLeadStage('${l.id}','بازنده')">بازنده</button>`:''}
          ${stage!=='برنده'?`<button class="btn small" onclick="convertLeadToClient('${l.id}')">تبدیل به کارفرما</button>`:''}
          <button class="btn small secondary" onclick="editRow('leads','${l.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteLead('${l.id}')">حذف</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}
async function addLead() {
  const name = document.getElementById('lead-name').value.trim();
  const source = document.getElementById('lead-source').value.trim();
  const specialty_category = document.getElementById('lead-specialty').value;
  if (!name) return;
  await sb.from('leads').insert([{ name, source, specialty_category, stage: STAGES[0], status: 'new' }]);
  refreshAllErpData();
}
async function updateLeadStage(id, stage) { await sb.from('leads').update({ stage }).eq('id', id); refreshAllErpData(); }
async function deleteLead(id) { await sb.from('leads').delete().eq('id', id); refreshAllErpData(); }
async function convertLeadToClient(id) {
  const lead = leads.find(x => x.id === id); if (!lead) return;
  await sb.from('clients').insert([{ name: lead.name, type: CLIENT_TYPES[1], contact_info: lead.source || '', reliability_score: 3, status: 'new' }]);
  await updateLeadStage(id, 'برنده');
}

// ================= کارفرمایان =================
function renderClients() {
  let html = `
    <div class="row-top"><h2>کارفرمایان</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="client-name" placeholder="نام کارفرما">
        <select id="client-type"><option value="">نوع</option>${CLIENT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
        <input type="text" id="client-contact" placeholder="اطلاعات تماس">
        <select id="client-score">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>امتیاز اعتبار ${n}</option>`).join('')}</select>
        <button class="btn" onclick="addClient()">+ کارفرمای جدید</button>
      </div>
    </div>
    <div class="card">`;
  if (!clients.length) html += `<div class="empty">هنوز کارفرمایی ثبت نشده</div>`;
  else {
    html += `<table><thead><tr><th>نام</th><th>نوع</th><th>امتیاز اعتبار</th><th>تماس</th><th></th></tr></thead><tbody>`;
    clients.forEach(c => {
      html += `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.type||'')}</td>
        <td class="score ${scoreClass(c.reliability_score||3)}">${c.reliability_score||3}/۵</td>
        <td>${escapeHtml(c.contact_info||c.phone||'')}</td>
        <td>
          <button class="btn small secondary" onclick="editRow('clients','${c.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteRow('clients','${c.id}')">حذف</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  return html;
}
async function addClient() {
  const name = document.getElementById('client-name').value.trim();
  const type = document.getElementById('client-type').value;
  const contact_info = document.getElementById('client-contact').value.trim();
  const reliability_score = parseInt(document.getElementById('client-score').value);
  if (!name) return;
  await sb.from('clients').insert([{ name, type, contact_info, reliability_score, status: 'new' }]);
  refreshAllErpData();
}

// ================= پروژه‌ها =================
function renderProjects() {
  let html = `<div class="row-top"><h2>پروژه‌ها</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="project-title" placeholder="عنوان پروژه">
        <select id="project-client"><option value="">— کارفرما —</option>${clients.map(c=>`<option value="${c.id}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <input type="text" id="project-responsible" placeholder="مسئول پروژه">
        <select id="project-specialty"><option value="">دسته تخصصی</option>${SPECIALTIES.map(s=>`<option>${s}</option>`).join('')}</select>
        <button class="btn" onclick="addProject()">+ پروژه جدید</button>
      </div>
    </div>`;
  if (!projects.length) { html += `<div class="card"><div class="empty">هنوز پروژه‌ای ثبت نشده</div></div>`; return html; }
  projects.forEach(p => {
    html += `<div class="card">
      <div class="row-top" style="margin-bottom:6px;">
        <div><strong>${escapeHtml(p.title)}</strong> ${p.specialty_category?`<span class="tag">${p.specialty_category}</span>`:''}
          <div style="color:var(--muted);font-size:12px;">کارفرما: ${escapeHtml(p.client_name||'—')} · مسئول: ${escapeHtml(p.responsible_member||'—')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <select onchange="updateProjectField('${p.id}','phase',this.value)" style="width:auto;">${PHASES.map(ph=>`<option ${ph===p.phase?'selected':''}>${ph}</option>`).join('')}</select>
          <select onchange="updateProjectField('${p.id}','status',this.value)" style="width:auto;">${PROJECT_STATUSES.map(s=>`<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select>
          <button class="btn small secondary" onclick="editRow('projects','${p.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteRow('projects','${p.id}')">حذف</button>
        </div>
      </div>
    </div>`;
  });
  return html;
}
async function addProject() {
  const title = document.getElementById('project-title').value.trim();
  const clientSel = document.getElementById('project-client');
  const client_id = clientSel.value || null;
  const client_name = clientSel.selectedOptions[0] ? clientSel.selectedOptions[0].dataset.name : '';
  const responsible_member = document.getElementById('project-responsible').value.trim();
  const specialty_category = document.getElementById('project-specialty').value;
  if (!title) return;
  await sb.from('projects').insert([{ title, client_id, client_name, responsible_member, specialty_category }]);
  refreshAllErpData();
}
async function updateProjectField(id, field, value) { await sb.from('projects').update({ [field]: value }).eq('id', id); refreshAllErpData(); }

// ================= قراردادها =================
function renderContracts() {
  const allStages = Object.entries(contractStagesMap).flatMap(([cid, arr]) => arr);
  const overdue = allStages.filter(s => stageEffectiveStatus(s) === 'سررسید گذشته');
  const pending = allStages.filter(s => stageEffectiveStatus(s) === 'در انتظار');
  let html = `<div class="row-top"><h2>قراردادها و مطالبات</h2></div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${overdue.length}</div><div class="label">مرحله سررسید گذشته</div></div>
      <div class="stat"><div class="num">${overdue.reduce((a,s)=>a+(s.amount||0),0).toLocaleString('fa-IR')}</div><div class="label">مبلغ معوق</div></div>
      <div class="stat"><div class="num">${pending.length}</div><div class="label">مرحله در انتظار</div></div>
      <div class="stat"><div class="num">${pending.reduce((a,s)=>a+(s.amount||0),0).toLocaleString('fa-IR')}</div><div class="label">مبلغ در انتظار</div></div>
    </div>
    <div class="card">
      <div class="row">
        <select id="contract-project"><option value="">— پروژه —</option>${projects.map(p=>`<option value="${p.id}" data-title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</option>`).join('')}</select>
        <input type="number" id="contract-amount" placeholder="مبلغ کل (تومان)">
        <input type="number" id="contract-advance" placeholder="درصد پیش‌پرداخت">
        <button class="btn" onclick="addContract()">+ قرارداد جدید</button>
      </div>
    </div>`;
  if (!contracts.length) { html += `<div class="card"><div class="empty">هنوز قراردادی ثبت نشده</div></div>`; return html; }
  contracts.forEach(c => {
    const stages = contractStagesMap[c.id] || [];
    html += `<div class="card">
      <div class="row-top" style="margin-bottom:6px;">
        <div><strong>${escapeHtml(c.project_title||'—')}</strong>
          <div style="color:var(--muted);font-size:12px;">مبلغ کل: ${(c.total_amount||0).toLocaleString('fa-IR')} تومان · پیش‌پرداخت: ${c.advance_payment_percent||0}٪</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <select onchange="updateContractField('${c.id}','status',this.value)" style="width:auto;">${CONTRACT_STATUSES.map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select>
          <button class="btn small secondary" onclick="editRow('contracts','${c.id}')">ویرایش</button>
        </div>
      </div>
      <div class="row">
        <input type="text" placeholder="عنوان مرحله" id="stage-title-${c.id}">
        <input type="number" placeholder="مبلغ" id="stage-amount-${c.id}">
        ${jalaliDateField('stage-date-' + c.id)}
        <button class="btn small" onclick="addStage('${c.id}')">+ مرحله</button>
      </div>
      <table><thead><tr><th>مرحله</th><th>مبلغ</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead><tbody>
        ${stages.map(s => { const eff = stageEffectiveStatus(s); const cls = eff==='وصول‌شده'?'high':eff==='سررسید گذشته'?'low':'mid';
          return `<tr><td>${escapeHtml(s.title)}</td><td>${(s.amount||0).toLocaleString('fa-IR')}</td><td>${fmtDate(s.due_date) || '—'}</td>
          <td class="score ${cls}">${eff}</td>
          <td><button class="btn small secondary" onclick="editRow('contract_stages','${s.id}')">ویرایش</button> ${eff!=='وصول‌شده'?`<button class="btn small secondary" onclick="markStageReceived('${s.id}')">وصول شد</button>`:''}</td></tr>`;
        }).join('')}
      </tbody></table>
    </div>`;
  });
  return html;
}
function stageEffectiveStatus(s) {
  if (s.received) return 'وصول‌شده';
  if (s.due_date && new Date(s.due_date) < new Date(new Date().toDateString())) return 'سررسید گذشته';
  return 'در انتظار';
}
async function addContract() {
  const sel = document.getElementById('contract-project');
  const project_id = sel.value || null;
  const project_title = sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.title : '';
  const total_amount = parseFloat(document.getElementById('contract-amount').value) || 0;
  const advance_payment_percent = parseInt(document.getElementById('contract-advance').value) || 0;
  await sb.from('contracts').insert([{ project_id, project_title, total_amount, advance_payment_percent }]);
  refreshAllErpData();
}
async function updateContractField(id, field, value) { await sb.from('contracts').update({ [field]: value }).eq('id', id); refreshAllErpData(); }
async function addStage(contractId) {
  const title = document.getElementById(`stage-title-${contractId}`).value.trim();
  const amount = parseFloat(document.getElementById(`stage-amount-${contractId}`).value) || 0;
  const due_date = getJalaliDate(`stage-date-${contractId}`);
  if (!title) return;
  await sb.from('contract_stages').insert([{ contract_id: contractId, title, amount, due_date }]);
  refreshAllErpData();
}
async function markStageReceived(stageId) { await sb.from('contract_stages').update({ received: true }).eq('id', stageId); refreshAllErpData(); }

// ================= کارهای دفتر (CRM tasks + کلندر) =================
function renderOfficeTasks() {
  let html = `<div class="row-top"><h2>کارهای دفتر</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="task-title" placeholder="عنوان کار">
        ${jalaliDateField('task-date')}
        <select id="task-client"><option value="">— انتخاب کارفرما —</option>${clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <button class="btn" onclick="addOfficeTask()">افزودن کار</button>
      </div>
    </div>
    <div class="card"><table><thead><tr><th>عنوان</th><th>تاریخ</th><th>مربوط به</th><th>وضعیت</th><th></th></tr></thead><tbody id="tasks-table"></tbody></table></div>`;
  loadOfficeTasks();
  return html;
}
async function addOfficeTask() {
  const title = document.getElementById('task-title').value.trim();
  const date = getJalaliDate('task-date');
  const client_id = document.getElementById('task-client').value || null;
  if (!title) return;
  await sb.from('tasks').insert([{ title, date, client_id, status: 'new' }]);
  if (date) apiPost('/api/create-event', { title, date });
  document.getElementById('task-title').value=''; clearJalaliDate('task-date');
  loadOfficeTasks();
}
async function loadOfficeTasks() {
  const { data } = await sb.from('tasks').select('*, clients(name)').order('date', { ascending: true });
  const tbody = document.getElementById('tasks-table'); if (!tbody) return;
  cacheRows('tasks', data||[]);
  tbody.innerHTML = (data||[]).map(t => `<tr>
    <td>${escapeHtml(t.title)}</td><td>${fmtDate(t.date)}</td><td>${t.clients?t.clients.name:'-'}</td><td>${statusLabel(t.status)}</td>
    <td><button class="btn small secondary" onclick="editRow('tasks','${t.id}')">ویرایش</button> <button class="btn small danger" onclick="deleteRow('tasks','${t.id}')">حذف</button></td>
  </tr>`).join('');
}

// ================= تیم =================
function renderTeam() {
  let html = `<div class="row-top"><h2>تیم</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="member-name" placeholder="نام عضو">
        <select id="member-department"><option value="">واحد</option>${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select>
        <select id="member-access"><option value="">سطح دسترسی</option>${ACCESS_LEVELS.map(a=>`<option>${a}</option>`).join('')}</select>
        <button class="btn" onclick="addMember()">+ عضو جدید</button>
      </div>
    </div>
    <div class="card">`;
  if (!members.length) html += `<div class="empty">هنوز عضوی ثبت نشده</div>`;
  else {
    html += `<table><thead><tr><th>نام</th><th>واحد</th><th>سطح دسترسی</th><th></th></tr></thead><tbody>`;
    members.forEach(m => html += `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.department||'')}</td><td>${escapeHtml(m.access_level||'')}</td>
      <td><button class="btn small secondary" onclick="editRow('members','${m.id}')">ویرایش</button> <button class="btn small danger" onclick="deleteRow('members','${m.id}')">حذف</button></td></tr>`);
    html += `</tbody></table>`;
  }
  html += `</div>`;
  return html;
}
async function addMember() {
  const name = document.getElementById('member-name').value.trim();
  const department = document.getElementById('member-department').value;
  const access_level = document.getElementById('member-access').value;
  if (!name) return;
  await sb.from('members').insert([{ name, department, access_level }]);
  refreshAllErpData();
}

// ================= وظایف (ERP) =================
function renderErpTasks() {
  let html = `<div class="row-top"><h2>وظایف</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="erptask-title" placeholder="عنوان وظیفه">
        <input type="text" id="erptask-responsible" placeholder="مسئول">
        <select id="erptask-priority">${TASK_PRIORITIES.map(p=>`<option>${p}</option>`).join('')}</select>
        ${jalaliDateField('erptask-date')}
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;"><input type="checkbox" id="erptask-approval" checked style="width:auto;"> نیازمند تأیید مؤسس</label>
        <button class="btn" onclick="addErpTask()">+ وظیفه جدید</button>
      </div>
    </div>
    <div class="pipeline">`;
  TASK_STATUSES.forEach(status => {
    const items = erpTasks.filter(t => t.status === status);
    html += `<div class="stage-col"><h3>${status} <span>${items.length}</span></h3>`;
    if (!items.length) html += `<div class="empty" style="padding:10px 0;">—</div>`;
    items.forEach(t => {
      const idx = TASK_STATUSES.indexOf(t.status) + 1;
      const next = idx < TASK_STATUSES.length ? TASK_STATUSES[idx] : null;
      html += `<div class="lead-card">
        <div class="name">${escapeHtml(t.title)}</div>
        <div class="meta">${t.responsible_member_name?escapeHtml(t.responsible_member_name):'بدون مسئول'} · اولویت ${escapeHtml(t.priority||'')} ${t.due_date?'· '+fmtDate(t.due_date):''}</div>
        <div class="meta" style="margin-bottom:6px;">${t.requires_founder_approval?'<span class="tag">نیازمند تأیید مؤسس</span>':'<span class="tag">مستقل</span>'}</div>
        <div class="actions">
          ${next?`<button class="btn small secondary" onclick="updateErpTask('${t.id}','status','${next}')">→ ${next}</button>`:''}
          <button class="btn small secondary" onclick="updateErpTask('${t.id}','requires_founder_approval',${!t.requires_founder_approval})">تغییر وضعیت تأیید</button>
          <button class="btn small secondary" onclick="editRow('erp_tasks','${t.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteRow('erp_tasks','${t.id}')">حذف</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}
async function addErpTask() {
  const title = document.getElementById('erptask-title').value.trim();
  const responsible_member_name = document.getElementById('erptask-responsible').value.trim();
  const priority = document.getElementById('erptask-priority').value;
  const due_date = getJalaliDate('erptask-date');
  const requires_founder_approval = document.getElementById('erptask-approval').checked;
  if (!title) return;
  await sb.from('erp_tasks').insert([{ title, responsible_member_name, priority, due_date, requires_founder_approval, status: TASK_STATUSES[0] }]);
  refreshAllErpData();
}
async function updateErpTask(id, field, value) { await sb.from('erp_tasks').update({ [field]: value }).eq('id', id); refreshAllErpData(); }

// ================= هزینه‌های ثابت =================
function renderFixedCosts() {
  const totalMonthly = fixedCosts.reduce((a,c)=>a+(c.monthly_amount||0),0);
  const unpaid = fixedCosts.filter(c=>c.payment_status!=='پرداخت‌شده');
  const unpaidSum = unpaid.reduce((a,c)=>a+(c.monthly_amount||0),0);
  let html = `<div class="row-top"><h2>هزینه‌های ثابت دفتر</h2></div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${totalMonthly.toLocaleString('fa-IR')}</div><div class="label">مجموع ماهانه</div></div>
      <div class="stat"><div class="num" style="color:${unpaidSum>0?'var(--danger)':'var(--success)'};">${unpaidSum.toLocaleString('fa-IR')}</div><div class="label">پرداخت‌نشده</div></div>
    </div>
    <div class="card">
      <div class="row">
        <input type="text" id="cost-title" placeholder="عنوان هزینه">
        <input type="number" id="cost-amount" placeholder="مبلغ ماهانه">
        <input type="number" id="cost-day" placeholder="روز سررسید" min="1" max="31">
        <button class="btn" onclick="addFixedCost()">+ هزینه جدید</button>
      </div>`;
  if (!fixedCosts.length) html += `<div class="empty">هنوز هزینه ثابتی ثبت نشده</div>`;
  else {
    html += `<table><thead><tr><th>عنوان</th><th>مبلغ ماهانه</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead><tbody>`;
    fixedCosts.forEach(c => { const paid = c.payment_status === 'پرداخت‌شده';
      html += `<tr><td>${escapeHtml(c.title)}</td><td>${(c.monthly_amount||0).toLocaleString('fa-IR')}</td><td>روز ${c.due_day||1}</td>
      <td class="score ${paid?'high':'low'}">${c.payment_status}</td>
      <td><button class="btn small secondary" onclick="editRow('fixed_costs','${c.id}')">ویرایش</button> <button class="btn small secondary" onclick="toggleCostPaid('${c.id}',${paid})">${paid?'پرداخت‌نشده کن':'پرداخت‌شده کن'}</button></td></tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  return html;
}
async function addFixedCost() {
  const title = document.getElementById('cost-title').value.trim();
  const monthly_amount = parseFloat(document.getElementById('cost-amount').value) || 0;
  const due_day = parseInt(document.getElementById('cost-day').value) || 1;
  if (!title) return;
  await sb.from('fixed_costs').insert([{ title, monthly_amount, due_day }]);
  refreshAllErpData();
}
async function toggleCostPaid(id, currentlyPaid) {
  await sb.from('fixed_costs').update({ payment_status: currentlyPaid ? 'پرداخت‌نشده' : 'پرداخت‌شده' }).eq('id', id);
  refreshAllErpData();
}

// ================= مناقصه / مسابقه =================
function renderTenders() {
  const sportsTenders = tenders.filter(t => t.specialty_category === 'ورزشی');
  const won = tenders.filter(t => t.status === 'برنده').length;
  let html = `<div class="row-top"><h2>مناقصه / مسابقه</h2></div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${tenders.length}</div><div class="label">کل ثبت‌شده</div></div>
      <div class="stat"><div class="num">${sportsTenders.length}</div><div class="label">دسته ورزشی</div></div>
      <div class="stat"><div class="num">${won}</div><div class="label">برنده‌شده</div></div>
    </div>
    <div class="card">
      <div class="row">
        <input type="text" id="tender-title" placeholder="عنوان">
        <select id="tender-type">${TENDER_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
        <input type="text" id="tender-issuer" placeholder="برگزارکننده">
        <select id="tender-specialty"><option value="">دسته</option>${SPECIALTIES.map(s=>`<option>${s}</option>`).join('')}</select>
        ${jalaliDateField('tender-date')}
        <button class="btn" onclick="addTender()">+ جدید</button>
      </div>
    </div>`;
  if (!tenders.length) { html += `<div class="card"><div class="empty">هنوز مناقصه/مسابقه‌ای ثبت نشده</div></div>`; return html; }
  html += `<div class="card"><table><thead><tr><th>عنوان</th><th>نوع</th><th>برگزارکننده</th><th>دسته</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead><tbody>`;
  tenders.forEach(t => {
    html += `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.type||'')}</td><td>${escapeHtml(t.issuing_body||'')}</td>
      <td>${t.specialty_category?`<span class="tag">${t.specialty_category}</span>`:''}</td><td>${fmtDate(t.event_date) || '—'}</td>
      <td><select onchange="updateTenderStatus('${t.id}',this.value)" style="width:auto;">${TENDER_STATUSES.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td>
      <td><button class="btn small secondary" onclick="editRow('tenders','${t.id}')">ویرایش</button> <button class="btn small danger" onclick="deleteRow('tenders','${t.id}')">حذف</button></td></tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}
async function addTender() {
  const title = document.getElementById('tender-title').value.trim();
  const type = document.getElementById('tender-type').value;
  const issuing_body = document.getElementById('tender-issuer').value.trim();
  const specialty_category = document.getElementById('tender-specialty').value;
  const event_date = getJalaliDate('tender-date');
  if (!title) return;
  await sb.from('tenders').insert([{ title, type, issuing_body, specialty_category, event_date }]);
  refreshAllErpData();
}
async function updateTenderStatus(id, status) { await sb.from('tenders').update({ status }).eq('id', id); refreshAllErpData(); }

// ================= عمومی =================
async function deleteRow(table, id) { await sb.from(table).delete().eq('id', id); refreshAllErpData(); }

const rowCache = {};
function cacheRows(table, rows) { (rows || []).forEach(r => { rowCache[table + ':' + r.id] = r; }); }

const EDIT_CONFIG = {
  clients: { title: 'کارفرما', fields: [
    { key: 'name', label: 'نام', type: 'text' },
    { key: 'type', label: 'نوع', type: 'select', options: CLIENT_TYPES },
    { key: 'contact_info', label: 'اطلاعات تماس', type: 'text' },
    { key: 'reliability_score', label: 'امتیاز اعتبار (۱ تا ۵)', type: 'select', options: [1,2,3,4,5] } ] },
  leads: { title: 'سرنخ', fields: [
    { key: 'name', label: 'نام', type: 'text' },
    { key: 'source', label: 'منبع', type: 'text' },
    { key: 'specialty_category', label: 'دسته تخصصی', type: 'select', options: SPECIALTIES },
    { key: 'stage', label: 'مرحله', type: 'select', options: STAGES } ] },
  projects: { title: 'پروژه', fields: [
    { key: 'title', label: 'عنوان پروژه', type: 'text' },
    { key: 'responsible_member', label: 'مسئول پروژه', type: 'text' },
    { key: 'specialty_category', label: 'دسته تخصصی', type: 'select', options: SPECIALTIES },
    { key: 'phase', label: 'فاز', type: 'select', options: PHASES },
    { key: 'status', label: 'وضعیت', type: 'select', options: PROJECT_STATUSES } ] },
  contracts: { title: 'قرارداد', fields: [
    { key: 'project_title', label: 'عنوان پروژه', type: 'text' },
    { key: 'total_amount', label: 'مبلغ کل (تومان)', type: 'number' },
    { key: 'advance_payment_percent', label: 'درصد پیش‌پرداخت', type: 'number' },
    { key: 'status', label: 'وضعیت', type: 'select', options: CONTRACT_STATUSES } ] },
  contract_stages: { title: 'مرحله پرداخت', fields: [
    { key: 'title', label: 'عنوان مرحله', type: 'text' },
    { key: 'amount', label: 'مبلغ (تومان)', type: 'number' },
    { key: 'due_date', label: 'تاریخ سررسید', type: 'date' } ] },
  tasks: { title: 'کار دفتر', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'date', label: 'تاریخ', type: 'date' } ] },
  personal_tasks: { title: 'کار', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'due_date', label: 'تاریخ', type: 'date' } ] },
  members: { title: 'عضو تیم', fields: [
    { key: 'name', label: 'نام', type: 'text' },
    { key: 'department', label: 'واحد', type: 'select', options: DEPARTMENTS },
    { key: 'access_level', label: 'سطح دسترسی', type: 'select', options: ACCESS_LEVELS } ] },
  erp_tasks: { title: 'وظیفه', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'responsible_member_name', label: 'مسئول', type: 'text' },
    { key: 'priority', label: 'اولویت', type: 'select', options: TASK_PRIORITIES },
    { key: 'due_date', label: 'تاریخ', type: 'date' },
    { key: 'status', label: 'وضعیت', type: 'select', options: TASK_STATUSES } ] },
  fixed_costs: { title: 'هزینه ثابت', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'monthly_amount', label: 'مبلغ ماهانه (تومان)', type: 'number' },
    { key: 'due_day', label: 'روز سررسید (۱ تا ۳۱)', type: 'number' } ] },
  tenders: { title: 'مناقصه / مسابقه', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'type', label: 'نوع', type: 'select', options: TENDER_TYPES },
    { key: 'issuing_body', label: 'برگزارکننده', type: 'text' },
    { key: 'specialty_category', label: 'دسته', type: 'select', options: SPECIALTIES },
    { key: 'event_date', label: 'تاریخ', type: 'date' },
    { key: 'status', label: 'وضعیت', type: 'select', options: TENDER_STATUSES } ] },
};

function editRow(table, id) {
  const cfg = EDIT_CONFIG[table], row = rowCache[table + ':' + id];
  if (!cfg || !row) { alert('اطلاعات این مورد پیدا نشد، صفحه را رفرش کن.'); return; }
  openEditModal(table, id, cfg.title, cfg.fields, row);
}

function openEditModal(table, id, title, fields, values) {
  const root = document.getElementById('edit-modal-root');
  root.innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeEditModal()">
      <div class="modal">
        <h3>ویرایش ${title}</h3>
        ${fields.map(f => {
          const cur = values[f.key] ?? '';
          if (f.type === 'select') {
            const blank = String(cur) === '' ? '<option value="">—</option>' : '';
            return `<label>${f.label}</label><select id="edit-${f.key}">${blank}${f.options.map(o => `<option value="${o}" ${String(o) === String(cur) ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
          }
          if (f.type === 'date') return `<label>${f.label}</label>${jalaliDateField('edit-' + f.key, cur)}`;
          return `<label>${f.label}</label><input type="${f.type}" id="edit-${f.key}" value="${escapeHtml(cur)}">`;
        }).join('')}
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeEditModal()">انصراف</button>
          <button class="btn" onclick="saveEditModal('${table}','${id}')">ذخیره تغییرات</button>
        </div>
      </div>
    </div>`;
  root.dataset.fields = JSON.stringify(fields.map(f => ({ key: f.key, type: f.type })));
}
function closeEditModal() { document.getElementById('edit-modal-root').innerHTML = ''; }
async function saveEditModal(table, id) {
  const root = document.getElementById('edit-modal-root');
  const fields = JSON.parse(root.dataset.fields);
  const payload = {};
  fields.forEach(f => {
    if (f.type === 'date') { payload[f.key] = getJalaliDate('edit-' + f.key); return; }
    const el = document.getElementById('edit-' + f.key);
    let v = el.value;
    if (f.type === 'number') v = v === '' ? null : (parseFloat(v) || 0);
    payload[f.key] = v;
  });
  const { error } = await sb.from(table).update(payload).eq('id', id);
  if (error) { alert('ذخیره نشد: ' + error.message); return; }
  if (table === 'personal_tasks') apiPost('/api/task-calendar', { task_id: id, action: 'sync' });
  closeEditModal();
  if (currentProfile.is_admin) { refreshAllErpData(); if (document.getElementById('teamtasks-table')) loadTeamTasks(); }
  else renderTasksSection();
}

checkSession();

const _calParam = new URLSearchParams(location.search).get('calendar');
if (_calParam) {
  window.history.replaceState({}, '', location.pathname);
  if (_calParam === 'connected') setTimeout(() => alert('گوگل کلندر با موفقیت وصل شد.'), 300);
  else if (_calParam === 'error') setTimeout(() => alert('اتصال گوگل کلندر ناموفق بود، دوباره تلاش کن.'), 300);
}
