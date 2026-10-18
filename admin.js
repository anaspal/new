/* StudyGuide Palestine — المحتوى الحي ووضع المدير
 * - القراءة: عامة لكل الزوار من Firebase Realtime Database (المسار /content)
 * - الكتابة: لحساب المدير فقط، والتحقق يتم بواسطة Firebase Authentication وقواعد القاعدة
 * - الدخول: الضغط على اسم المصمم في تذييل الصفحة (بدون أي زر ظاهر)
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCt8-AzCx8FmM894sMQ2l7uWl0ZDOZLRE0",
  authDomain: "studyguide-palestine.firebaseapp.com",
  databaseURL: "https://studyguide-palestine-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studyguide-palestine",
  storageBucket: "studyguide-palestine.firebasestorage.app",
  messagingSenderId: "616439408734",
  appId: "1:616439408734:web:5fd71aac560b192b1b2ccf"
};

const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
const ADMIN_DOMAIN = "studyguide.admin"; // اسم المستخدم يتحول داخلياً إلى <username>@studyguide.admin
const LS_CACHE = "sg-live-cache-v1";
const LS_ADMIN = "sg-admin-hint";
const LIMIT = 4;
const MAX_IMGS = 3;
const IMG_PREFIX = "data:image/jpeg;base64,";
const IMG_ID = /^[-\w]{10,40}$/;

/* ---------- تعريف الأقسام والحقول ---------- */
const COLS = {
  news: {
    ar: "آخر الأخبار", en: "Latest news", one: "خبر",
    fields: [
      { k: "text", l: "نص الخبر", t: "area", req: 1, max: 600 },
      { k: "en", l: "النص بالإنجليزية (اختياري، يظهر عند اختيار English)", t: "area", max: 600 },
      { k: "link", l: "رابط (اختياري)", t: "url", max: 500 }
    ]
  },
  homework: {
    ar: "الواجبات", en: "Homework", one: "واجب",
    empty: "لا توجد واجبات حالياً.",
    fields: [
      { k: "subject", l: "المادة", t: "text", req: 1, max: 60, list: 1 },
      { k: "text", l: "نص الواجب", t: "area", req: 1, max: 600 },
      { k: "imgs", l: "صور مرفقة (اختياري، حتى 3 صور)", t: "images" },
      { k: "due", l: "موعد التسليم", t: "date" },
      { k: "group", l: "الصف / الشعبة (اختياري)", t: "text", max: 60 },
      { k: "link", l: "رابط مرفق (اختياري)", t: "url", max: 500 }
    ]
  },
  exams: {
    ar: "الامتحانات", en: "Exams", one: "امتحان",
    empty: "لا توجد امتحانات مجدولة.",
    fields: [
      { k: "subject", l: "المادة", t: "text", req: 1, max: 60, list: 1 },
      { k: "title", l: "اسم الامتحان (مثال: امتحان الوحدة الثانية)", t: "text", max: 120 },
      { k: "date", l: "تاريخ الامتحان", t: "date", req: 1 },
      { k: "time", l: "الوقت (اختياري)", t: "text", max: 40 },
      { k: "group", l: "الصف / الشعبة (اختياري)", t: "text", max: 60 },
      { k: "note", l: "ملاحظات (اختياري)", t: "area", max: 400 }
    ]
  },
  live: {
    ar: "الحصص والتسجيلات", en: "Live classes & recordings", one: "حصة / تسجيل",
    empty: "لا توجد حصص أو تسجيلات حالياً.",
    fields: [
      { k: "kind", l: "النوع", t: "select", req: 1, opts: [["live", "حصة مباشرة"], ["rec", "تسجيل"]] },
      { k: "subject", l: "المادة", t: "text", req: 1, max: 60, list: 1 },
      { k: "title", l: "عنوان الدرس (اختياري)", t: "text", max: 120 },
      { k: "teacher", l: "المدرس (اختياري)", t: "text", max: 60 },
      { k: "when", l: "الموعد (مثال: الأحد 5:00 م)", t: "text", max: 60 },
      { k: "link", l: "رابط الحصة أو التسجيل", t: "url", req: 1, max: 500 },
      { k: "group", l: "الصف / الشعبة (اختياري)", t: "text", max: 60 }
    ]
  },
  teachers: {
    ar: "المدرسون", en: "Teachers", one: "مدرس",
    empty: "لم تُضف أرقام المدرسين بعد.",
    fields: [
      { k: "name", l: "اسم المدرس", t: "text", req: 1, max: 80 },
      { k: "subject", l: "المادة", t: "text", req: 1, max: 60, list: 1 },
      { k: "phone", l: "رقم الجوال", t: "tel", max: 25 },
      { k: "group", l: "الصف / الشعبة (اختياري)", t: "text", max: 60 }
    ]
  }
};
const CARDS = ["homework", "exams", "live", "teachers"];

const state = {
  q: "",
  data: { news: {}, homework: {}, exams: {}, live: {}, teachers: {} },
  admin: false,
  expanded: {},
  filter: { homework: null }
};
const listeners = [];
let fbApp = null, fbDb = null, db = null, authWatching = false;
let adminCtx = null, adminUid = null;
let dbReady = null;

/* ---------- أدوات صغيرة ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const clean = (v, max = 600) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const safeUrl = (u) => {
  try {
    const x = new URL(String(u).trim());
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : "";
  } catch { return ""; }
};
const phoneTel = (p) => String(p || "").replace(/[^\d+]/g, "");
const waNumber = (p) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "970" + d.slice(1);
  return d;
};
const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");

const todayMid = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? new Date(s + "T00:00:00") : null);
const dayDiff = (s) => { const d = parseDay(s); return d ? Math.round((d - todayMid()) / 864e5) : null; };
const fmtDay = (s) => {
  const d = parseDay(s);
  return d ? d.toLocaleDateString("ar-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }) : "";
};
const rel = (n) => {
  if (n === 0) return "اليوم";
  if (n === 1) return "غداً";
  if (n === 2) return "بعد يومين";
  if (n > 2 && n <= 10) return `بعد ${n} أيام`;
  if (n > 10) return `بعد ${n} يوماً`;
  if (n === -1) return "أمس";
  return `قبل ${-n} ${-n <= 10 ? "أيام" : "يوماً"}`;
};

const items = (col) => Object.entries(state.data[col] || {})
  .filter(([, v]) => v && typeof v === "object")
  .map(([id, v]) => ({ id, ...v }));
const dateKey = (s) => { const d = dayDiff(s); return d === null ? 5e5 : d >= 0 ? d : 1e6 - d; };
function sorted(col) {
  const a = items(col);
  const byTs = (x, y) => (y.ts || 0) - (x.ts || 0);
  if (col === "homework") return a.sort((x, y) => dateKey(x.due) - dateKey(y.due) || byTs(x, y));
  if (col === "exams") return a.sort((x, y) => dateKey(x.date) - dateKey(y.date) || byTs(x, y));
  if (col === "live") return a.sort((x, y) => (x.kind === "live" ? 0 : 1) - (y.kind === "live" ? 0 : 1) || byTs(x, y));
  if (col === "teachers") return a.sort((x, y) => (x.subject || "").localeCompare(y.subject || "", "ar") || (x.name || "").localeCompare(y.name || "", "ar"));
  return a.sort(byTs);
}

/* ---------- التصنيف الذكي للمواد ---------- */
const SUBJECT_DEFS = [
  ["اللغة العربية", ["عربي", "عربية", "arabic", "نحو"]],
  ["الرياضيات", ["رياضيات", "math", "maths", "mathematics", "ماث", "جبر", "هندسة", "تفاضل", "حساب"]],
  ["اللغة الإنجليزية", ["انجليزي", "انجليزية", "انكليزي", "انكليزية", "english", "انجلش"]],
  ["العلوم", ["علوم", "science"]],
  ["الفيزياء", ["فيزياء", "فيزيا", "physics"]],
  ["الكيمياء", ["كيمياء", "كيميا", "chemistry"]],
  ["الأحياء", ["احياء", "بيولوجيا", "بيولوجي", "biology"]],
  ["التاريخ", ["تاريخ", "history"]],
  ["الجغرافيا", ["جغرافيا", "جغرافيه", "geography"]],
  ["التربية الإسلامية", ["اسلامية", "تربية اسلامية", "اسلامي", "دين", "قران", "تجويد", "islamic"]],
  ["التكنولوجيا", ["تكنولوجيا", "تكنولوجي", "حاسوب", "حاسب", "computer", "برمجة", "tech"]],
  ["اللغة الفرنسية", ["فرنسي", "فرنسية", "french"]],
  ["التربية الوطنية", ["وطنية", "تربية وطنية"]],
  ["الاجتماعيات", ["اجتماعيات", "دراسات اجتماعية"]],
  ["التربية الرياضية", ["رياضة", "رياضية", "تربية رياضية"]],
  ["التربية الفنية", ["فنية", "رسم", "تربية فنية"]],
  ["الاقتصاد", ["اقتصاد"]],
  ["المحاسبة", ["محاسبة"]]
];
const SUBJ_STOP = new Set(["ماده", "مواد", "لغه", "مبحث", "درس", "دروس", "واجب", "واجبات", "منهج", "تدريب"]);
const normAr = (s) => String(s || "").toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const subjTokens = (s) => normAr(s).split(" ").filter(Boolean)
  .map((w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w)).filter((w) => !SUBJ_STOP.has(w));
const SUBJ_ALIASES = SUBJECT_DEFS.map(([label, al]) => [label, al.map((a) => subjTokens(a).join(" ")).filter(Boolean)]);
function lev1(a, b) { // هل المسافة بين الكلمتين حرف واحد أو أقل؟
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}
function classify(subject) {
  const toks = subjTokens(subject);
  const joined = " " + toks.join(" ") + " ";
  for (const [label, al] of SUBJ_ALIASES) for (const a of al) if (joined.includes(" " + a + " ")) return { key: "k:" + label, label };
  for (const [label, al] of SUBJ_ALIASES) for (const a of al) {
    if (a.length < 5 || a.includes(" ")) continue;
    if (toks.some((t) => t.length >= 5 && lev1(t, a))) return { key: "k:" + label, label };
  }
  const key = toks.join(" ") || normAr(subject);
  return { key: "u:" + key, label: clean(subject, 60) || "أخرى" };
}
function homeworkGroups() {
  const map = new Map();
  for (const it of items("homework")) {
    const c = classify(it.subject);
    const g = map.get(c.key) || { key: c.key, label: c.label, count: 0 };
    g.count++; map.set(c.key, g);
  }
  const order = SUBJECT_DEFS.map((d) => "k:" + d[0]);
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.label.localeCompare(b.label, "ar");
  });
}
function subjectSuggestions() {
  const set = new Set(SUBJECT_DEFS.map((d) => d[0]));
  for (const col of ["homework", "exams", "live", "teachers"]) for (const it of items(col)) if (it.subject) set.add(it.subject);
  return [...set];
}

/* ---------- ضغط الصور (تُحفظ داخل قاعدة البيانات بحجم صغير) ---------- */
async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("not-image");
  if (file.size > 20 * 1024 * 1024) throw new Error("too-big");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
    let dim = 1280, q = 0.72, out = "";
    for (let k = 0; k < 8; k++) {
      const sc = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", q);
      if (out.length <= 260000) return out;
      if (q > 0.45) q -= 0.1; else dim = Math.round(dim * 0.8);
    }
    if (out.length > 380000) throw new Error("too-big");
    return out;
  } finally { URL.revokeObjectURL(url); }
}
const imgCache = new Map();
async function loadImage(id) {
  if (!IMG_ID.test(String(id))) throw new Error("bad-id");
  if (imgCache.has(id)) return imgCache.get(id);
  await dbReady;
  if (!db) throw new Error("offline");
  const snap = await fbDb.get(fbDb.ref(db, "images/" + id));
  const v = snap.val();
  if (typeof v !== "string" || !v.startsWith(IMG_PREFIX)) throw new Error("bad-image");
  imgCache.set(id, v);
  return v;
}

/* ---------- الأنماط ---------- */
const CSS = `
#sg-ticker,#sg-dash,.sg-dlg,.sg-bar,.sg-toast{--sg-b:var(--card,#fff);--sg-f:var(--ink,#17261c);--sg-f2:var(--ink-soft,#4d6253);--sg-l:var(--line,#d8e1d7);--sg-a:var(--accent,#104020);--sg-as:var(--accent-soft,#e2eee4);--sg-r:var(--coral,#b03030);--sg-p:var(--paper,#f8f9f4);--sg-at:var(--sg-a);font-family:inherit}
html.dark #sg-ticker,html.dark #sg-dash,html.dark .sg-dlg,html.dark .sg-bar,html.dark .sg-toast{--sg-at:color-mix(in srgb,var(--accent,#104020) 36%,#fff)}
#sg-ticker{position:relative}
#sg-ticker[hidden]{display:none}
#sg-ticker .ticker-track:hover,#sg-ticker .ticker-track:focus-within{animation-play-state:paused}
#sg-ticker .ticker-track a{color:inherit;text-decoration:none}
#sg-ticker .ticker-track a:hover,#sg-ticker .ticker-track a:focus-visible{text-decoration:underline}
.sg-tk-edit{position:absolute;inset-block:0;inset-inline-end:0;z-index:2;border:0;background:var(--navy-deep,#101b14);color:#f7faf8;font:inherit;font-weight:800;padding:0 14px;cursor:pointer;box-shadow:0 0 14px 10px var(--navy-deep,#101b14)}
.sg-tk-edit:hover{text-decoration:underline}
@media (prefers-reduced-motion:reduce){#sg-ticker .ticker-track{animation:none}#sg-ticker .ticker-marquee{overflow-x:auto}}
.sg-res .card-open .sg-arr{font-size:15px;line-height:1}
.sg-card-add{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;min-height:34px;padding:0 12px;border-radius:8px 2px;border:1px solid var(--line);background:var(--card);color:var(--tone,var(--accent));font:inherit;font-size:12px;font-weight:800;cursor:pointer;position:relative;z-index:1}
.sg-card-add:hover{background:var(--tone,var(--accent));color:#fff}
@media (max-width:760px){.sg-card-add{background:#fff;color:var(--accent);border-color:#fff;border-radius:5px;min-height:36px}#sg-dash .resource-card-actions{flex-wrap:wrap}}
#sg-sres{display:contents}
#sg-sres~button:not(.search-suggestion){display:none}
body.sg-search-hit .empty-search{display:none}
#sg-dash{max-width:1280px;margin:0 auto;padding:24px 32px 56px}
#sg-dash[hidden]{display:none}
.sg-list{display:flex;flex-direction:column}
.sg-item{display:flex;gap:8px;padding:12px 0;border-top:1px solid var(--sg-l);align-items:flex-start}
.sg-item:first-child{border-top:0}
.sg-item-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.sg-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.sg-chip{background:var(--sg-as);color:var(--sg-at);border-radius:8px;padding:2px 9px;font-size:12.5px;font-weight:800}
.sg-chip-soft{background:transparent;border:1px solid var(--sg-l);color:var(--sg-f2);font-weight:600}
.sg-badge{border-radius:8px;padding:2px 9px;font-size:12.5px;font-weight:700;background:var(--sg-p);color:var(--sg-f2);border:1px solid var(--sg-l)}
.sg-soon{background:color-mix(in srgb,var(--sg-r) 14%,transparent);color:var(--sg-r);border-color:transparent}
.sg-late{opacity:.7;text-decoration:line-through}
.sg-live-dot{color:var(--sg-r)}
.sg-title{margin:0;font-weight:800;color:var(--sg-f);font-size:15px;line-height:1.5}
.sg-txt{margin:0;color:var(--sg-f);font-size:14.5px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.sg-meta{margin:0;color:var(--sg-f2);font-size:13px;line-height:1.6}
.sg-ctl{display:flex;gap:4px;flex:none}
.sg-del:hover{background:color-mix(in srgb,var(--sg-r) 14%,transparent);color:var(--sg-r)}
.sg-empty{margin:8px 0;color:var(--sg-f2);font-size:14px}
.sg-ic-btns{display:flex;flex-wrap:wrap;gap:8px}
.sg-bar{position:fixed;inset-block-end:18px;inset-inline:0;margin-inline:auto;width:max-content;max-width:calc(100% - 24px);z-index:60;display:flex;align-items:center;gap:14px;background:var(--navy-deep,#101b14);color:#f4f1e8;border:1px solid rgba(255,255,255,.12);border-radius:99px;padding-block:6px;padding-inline:18px 6px;box-shadow:0 12px 32px #0007;font-size:14px;font-weight:800}
.sg-bar-lbl{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
.sg-bar-out{border:0;cursor:pointer;min-height:36px;padding:0 18px;border-radius:99px;background:rgba(255,255,255,.14);color:inherit;font:inherit;font-size:13px;font-weight:800;transition:background-color .16s}
.sg-bar-out:hover{background:rgba(255,255,255,.26)}
.sg-dot{width:9px;height:9px;border-radius:50%;background:#4cd37b;display:inline-block;margin-inline-end:8px;box-shadow:0 0 0 4px rgba(76,211,123,.2)}
.sg-toast{position:fixed;inset-block-end:76px;inset-inline:0;margin-inline:auto;width:max-content;max-width:calc(100% - 24px);z-index:80;background:var(--sg-f);color:var(--sg-b);border-radius:12px;padding:10px 16px;font-size:14px;font-weight:700;box-shadow:0 10px 30px #0004}
.sg-dlg{margin:auto;border:0;padding:0;border-radius:20px;background:var(--sg-b);color:var(--sg-f);width:min(520px,calc(100% - 24px));max-height:calc(100dvh - 24px);box-shadow:0 30px 80px #0007}
.sg-dlg.sg-wide{width:min(720px,calc(100% - 24px))}
.sg-dlg::backdrop{background:rgba(8,14,10,.55);backdrop-filter:blur(2px)}
.sg-dlg-in{padding:20px;display:flex;flex-direction:column;gap:14px;max-height:calc(100dvh - 24px);overflow:auto}
.sg-dlg-h{display:flex;align-items:center;gap:10px}
.sg-dlg-h h3{margin:0;flex:1;font-size:18px;font-weight:800}
.sg-f{display:flex;flex-direction:column;gap:6px}
.sg-f label{font-size:13.5px;font-weight:700;color:var(--sg-f2)}
.sg-f input,.sg-f textarea,.sg-f select{font:inherit;font-size:16px;color:var(--sg-f);background:var(--sg-p);border:1px solid var(--sg-l);border-radius:12px;padding:10px 12px;min-height:44px;width:100%;box-sizing:border-box}
.sg-f textarea{resize:vertical;min-height:84px}
.sg-f input:focus,.sg-f textarea:focus,.sg-f select:focus{outline:2px solid var(--sg-at);outline-offset:1px}
.sg-err{margin:0;color:var(--sg-r);font-size:13.5px;font-weight:700;min-height:1.2em}
.sg-acts{display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap}
.sg-acts button[disabled]{opacity:.6;cursor:wait}
.sg-mgr{display:flex;flex-direction:column}
.sg-mgr .sg-item{padding:10px 0}
#sg-dash button:focus-visible,#sg-dash a:focus-visible,.sg-dlg button:focus-visible,.sg-dlg a:focus-visible,#sg-ticker button:focus-visible,#sg-ticker a:focus-visible,.sg-bar button:focus-visible{outline:3px solid var(--sg-at);outline-offset:2px}
.sg-acts .primary-cta,.sg-acts .secondary-cta{flex:1 1 auto}
.sg-ctl .close-button{font-size:15px}
.sg-item .primary-cta,.sg-item .secondary-cta{align-self:flex-start}
.sg-subjects{margin:0 0 4px}
.sg-subjects button{flex:0 1 auto;padding:0 14px}
.sg-subjects button[aria-pressed="true"]{color:#fff;background:var(--accent,#104020);border-color:var(--accent,#104020)}
.sg-imgs{display:flex;flex-wrap:wrap;gap:8px}
.sg-thumb{position:relative;width:76px;height:76px;border-radius:10px;overflow:hidden;border:1px solid var(--sg-l);background:var(--sg-p)}
.sg-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.sg-thumb button{position:absolute;inset-block-start:2px;inset-inline-start:2px;width:26px;height:26px;border-radius:99px;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:13px;cursor:pointer}
.sg-gal{display:flex;flex-direction:column;gap:8px}
.sg-gal img{width:100%;height:auto;border-radius:12px;border:1px solid var(--sg-l);display:block}
.sg-f input[type=file]{padding:8px}
#sg-dash .hero-primary,.sg-dlg .hero-primary{background:var(--coral,#b03030);box-shadow:0 11px 22px color-mix(in srgb,var(--coral,#b03030) 26%,transparent)}
#sg-dash .hero-primary:hover,.sg-dlg .hero-primary:hover{box-shadow:0 14px 27px color-mix(in srgb,var(--coral,#b03030) 33%,transparent);background:#bf573f}
@media (max-width:760px){#sg-dash .hero-primary,.sg-dlg .hero-primary{background:var(--mobile-olive,#78936A)!important;box-shadow:0 8px 17px color-mix(in srgb,var(--mobile-olive,#78936A) 32%,transparent)!important}}
@media (max-width:640px){#sg-dash{padding:4px 16px 40px}}
`;

/* ---------- عناصر صغيرة ---------- */
const iconBtn = (label, glyph, fn, cls = "") => h("button", { type: "button", class: `close-button ${cls}`.trim(), "aria-label": label, title: label, onclick: fn }, glyph);
const chip = (t, cls = "") => (t ? h("span", { class: `sg-chip ${cls}`.trim() }, t) : null);
const linkBtn = (href, text, pri) => {
  const u = safeUrl(href);
  return u ? h("a", { class: pri ? "primary-cta hero-primary" : "secondary-cta", href: u, target: "_blank", rel: "noopener noreferrer" }, text) : null;
};
function dueBadge(s, prefix) {
  const d = dayDiff(s);
  if (d === null) return null;
  const cls = d < 0 ? "sg-badge sg-late" : d <= 1 ? "sg-badge sg-soon" : "sg-badge";
  return h("span", { class: cls }, `${prefix ? prefix + " " : ""}${rel(d)}`);
}

let toastTimer = 0;
function toast(msg) {
  document.querySelectorAll(".sg-toast").forEach((t) => t.remove());
  const t = h("div", { class: "sg-toast", role: "status", "aria-live": "polite" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

/* ---------- عناصر الصفحة (الشريط + البطاقات) ---------- */
const tickerEl = h("div", { id: "sg-ticker", class: "ticker", role: "note", hidden: true });
const dashEl = h("section", { id: "sg-dash", "aria-label": "المستجدات الدراسية", hidden: true });
const origTicker = () => document.querySelector(".ticker:not(#sg-ticker)");
const newsText = (n) => (lang() === "en" && n.en ? n.en : n.text);
const hasNews = () => sorted("news").some((n) => n.text);

// شريط الأخبار الأصلي للموقع يُستبدل بشريطنا (بنفس التصميم) عندما توجد أخبار أو يكون المدير داخلاً
function syncTicker() {
  const orig = origTicker();
  if (orig) { if (tickerEl.nextElementSibling !== orig) orig.before(tickerEl); }
  else if (!tickerEl.isConnected) {
    const root = document.getElementById("root");
    if (root && root.childElementCount) root.before(tickerEl);
  }
  const mine = state.admin || hasNews();
  tickerEl.hidden = !mine;
  if (orig) orig.style.display = mine ? "none" : "";
}
function mountDash() {
  const main = document.querySelector("main");
  if (!main) return false;
  const anchor = main.querySelector(":scope > .quick-strip") || main.querySelector(":scope > .hero");
  if (dashEl.isConnected && main.contains(dashEl) && (!anchor || dashEl.previousElementSibling === anchor)) return true;
  if (anchor) anchor.after(dashEl); else main.prepend(dashEl);
  return true;
}

function renderTicker() {
  const news = sorted("news").filter((n) => n.text);
  tickerEl.replaceChildren();
  syncTicker();
  if (tickerEl.hidden) return;

  const orig = origTicker();
  const icon = orig && orig.querySelector("svg") ? orig.querySelector("svg") : null;
  const marquee = h("div", { class: "ticker-marquee" });
  tickerEl.append(marquee);

  const buildTrack = (reps) => {
    const track = h("div", { class: "ticker-track" });
    for (let copy = 0; copy < 2; copy++) {
      for (let r = 0; r < reps; r++) {
        for (const n of news) {
          const u = safeUrl(n.link);
          const label = newsText(n);
          track.append(h("span", { "aria-hidden": copy ? "true" : null },
            icon ? icon.cloneNode(true) : null,
            u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer", tabindex: copy ? "-1" : null }, label) : label));
        }
      }
    }
    return track;
  };

  if (news.length) {
    let track = buildTrack(1);
    marquee.append(track);
    requestAnimationFrame(() => {
      const half = track.scrollWidth / 2 || 1;
      const reps = Math.max(1, Math.ceil((marquee.clientWidth || 600) / half));
      if (reps > 1) { const t2 = buildTrack(reps); track.replaceWith(t2); track = t2; }
      track.style.animationDuration = Math.max(20, Math.round(track.scrollWidth / 2 / 55)) + "s";
    });
  } else {
    marquee.append(h("div", { class: "ticker-track", style: "animation:none" }, h("span", {}, "لا توجد أخبار بعد. اضغط «إدارة الأخبار» لإضافة أول خبر أو لاستيراد رسائل الشريط الحالية.")));
  }

  if (state.admin) tickerEl.append(h("button", { type: "button", class: "sg-tk-edit", onclick: openNewsManager }, "✎ إدارة الأخبار"));
}

function itemShell(col, it, body) {
  return h("div", { class: "sg-item" },
    h("div", { class: "sg-item-b" }, body),
    state.admin ? h("div", { class: "sg-ctl" },
      iconBtn("تعديل", "✎", () => openItemForm(col, it)),
      iconBtn("حذف", "🗑", () => deleteItem(col, it), "sg-del")) : null);
}

function renderItem(col, it) {
  if (col === "homework") {
    return itemShell(col, it, [
      h("div", { class: "sg-row" }, chip(it.subject), chip(it.group, "sg-chip-soft"), dueBadge(it.due, "التسليم")),
      h("p", { class: "sg-txt", dir: "auto" }, it.text),
      it.due ? h("p", { class: "sg-meta" }, "📅 " + fmtDay(it.due)) : null,
      Array.isArray(it.imgs) && it.imgs.length ? h("button", { type: "button", class: "secondary-cta", onclick: () => openGallery(it.imgs) }, `📷 عرض الصور (${it.imgs.length})`) : null,
      linkBtn(it.link, "فتح المرفق")
    ]);
  }
  if (col === "exams") {
    return itemShell(col, it, [
      h("div", { class: "sg-row" }, chip(it.subject), chip(it.group, "sg-chip-soft"), dueBadge(it.date)),
      it.title ? h("p", { class: "sg-title", dir: "auto" }, it.title) : null,
      h("p", { class: "sg-meta" }, "📅 " + fmtDay(it.date) + (it.time ? " · ⏰ " + it.time : "")),
      it.note ? h("p", { class: "sg-txt", dir: "auto" }, it.note) : null
    ]);
  }
  if (col === "live") {
    const isLive = it.kind !== "rec";
    return itemShell(col, it, [
      h("div", { class: "sg-row" },
        h("span", { class: "sg-chip" }, isLive ? h("span", { class: "sg-live-dot" }, "●") : "▶", isLive ? " حصة مباشرة" : " تسجيل"),
        chip(it.subject, "sg-chip-soft"), chip(it.group, "sg-chip-soft")),
      it.title ? h("p", { class: "sg-title", dir: "auto" }, it.title) : null,
      (it.teacher || it.when) ? h("p", { class: "sg-meta" }, [it.teacher ? "👤 " + it.teacher : "", it.when ? "🕒 " + it.when : ""].filter(Boolean).join(" · ")) : null,
      linkBtn(it.link, isLive ? "انضم للحصة" : "شاهد التسجيل", true)
    ]);
  }
  // teachers
  const tel = phoneTel(it.phone), wa = waNumber(it.phone);
  return itemShell(col, it, [
    h("div", { class: "sg-row" }, h("p", { class: "sg-title", dir: "auto" }, it.name), chip(it.subject), chip(it.group, "sg-chip-soft")),
    tel ? h("div", { class: "sg-ic-btns" },
      h("a", { class: "secondary-cta", href: "tel:" + tel, "aria-label": "اتصال بـ " + it.name }, "📞 اتصال"),
      wa ? h("a", { class: "secondary-cta", href: "https://wa.me/" + wa, target: "_blank", rel: "noopener noreferrer", "aria-label": "واتساب مع " + it.name }, "💬 واتساب") : null,
      h("span", { class: "sg-meta", dir: "ltr", style: "align-self:center" }, it.phone)) : null
  ]);
}

const ICON_PATHS = {
  homework: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  exams: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  live: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  teachers: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>'
};
function svgIcon(col, size = 24) {
  const span = document.createElement("span");
  span.style.display = "inline-grid";
  span.style.placeItems = "center";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[col]}</svg>`;
  return span;
}
const YT_URL = "https://youtube.com/@gazdi-e6i?si=fgK1amanriWXQ3dZ";
/* ---------- البحث في أقسام المتابعة اليومية ---------- */
const SEC_ALIAS = {
  homework: ["واجب", "واجبات", "تكليف", "تكاليف", "وظيفة", "وظائف", "homework", "assignment"],
  exams: ["امتحان", "امتحانات", "اختبار", "اختبارات", "فحص", "exam", "exams", "test"],
  live: ["حصة", "حصص", "تسجيل", "تسجيلات", "بث", "مباشر", "يوتيوب", "youtube", "live", "recording", "قناة"],
  teachers: ["مدرس", "مدرسين", "معلم", "معلمين", "استاذ", "اساتذة", "رقم", "ارقام", "teacher", "teachers", "تواصل"]
};
const GENERAL_ALIAS = ["متابعة", "يومية", "مستجدات", "updates", "daily"];
const nq = (v) => normAr(v).split(" ").filter(Boolean).map((w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w)).join(" ");
const itemHay = (it) => nq(["subject", "text", "title", "name", "teacher", "group", "note", "when", "kind"].map((k) => it[k] || "").join(" "));
function sectionMatches(col, q) {
  const k = nq(q);
  if (k.length < 2) return false;
  const def = COLS[col];
  const names = [def.ar, def.en, ...SEC_ALIAS[col], ...GENERAL_ALIAS].map(nq);
  return names.some((a) => a.includes(k) || (a.length >= 3 && k.includes(a)));
}
function searchHits(q) {
  const k = nq(q);
  const out = [];
  if (k.length < 2) return out;
  for (const col of CARDS) {
    const def = COLS[col];
    if (sectionMatches(col, q)) out.push({ col, title: def.ar, sub: "المتابعة اليومية · " + cardSummary(col), sec: true });
  }
  for (const col of CARDS) {
    const def = COLS[col];
    for (const it of sorted(col)) {
      if (!itemHay(it).includes(k)) continue;
      const main = col === "teachers" ? it.name : (it.title || it.text || it.subject || "");
      out.push({ col, title: clean(main, 70) || def.ar, sub: `${def.ar}${it.subject && col !== "teachers" ? " · " + it.subject : it.subject ? " · " + it.subject : ""}` });
      if (out.length >= 8) return out;
    }
  }
  return out.slice(0, 8);
}
function syncSearch() {
  const q = state.q.trim();
  const box = document.querySelector(".hero-search-results");
  const hits = q ? searchHits(q) : [];
  document.body.classList.toggle("sg-search-hit", hits.length > 0);
  let mine = document.getElementById("sg-sres");
  if (!box || !hits.length) { if (mine) mine.remove(); return; }
  const sig = hits.map((x) => x.col + "|" + x.title + "|" + x.sub).join("§");
  if (!mine) mine = h("div", { id: "sg-sres" });
  if (mine.dataset.sig !== sig) {
    mine.dataset.sig = sig;
    mine.replaceChildren(...hits.map((x) => h("button", { type: "button", class: "search-suggestion", onclick: () => openSection(x.col) },
      h("span", {}, h("b", {}, x.title), h("small", {}, x.sub)))));
  }
  if (box.firstChild !== mine) box.prepend(mine);
}
function readSearch() {
  const inp = document.querySelector(".hero-search input");
  const v = inp ? inp.value : "";
  if (v !== state.q) { state.q = v; renderDash(); }
  syncSearch();
}

const TONES = { homework: "tone-olive", exams: "tone-coral", live: "tone-blue", teachers: "tone-gold" };
const EYEBROW = { homework: ["الواجبات", "HOMEWORK"], exams: ["الامتحانات", "EXAMS"], live: ["مباشر ومسجّل", "LIVE"], teachers: ["للتواصل", "CONTACT"] };
const OPEN_LABEL = { homework: "عرض الواجبات", exams: "عرض الامتحانات", live: "عرض الحصص", teachers: "عرض الأرقام" };

function cardSummary(col) {
  const a = items(col);
  const def = COLS[col];
  if (!a.length) return def.empty;
  if (col === "homework" || col === "exams") {
    const key = col === "homework" ? "due" : "date";
    const next = sorted(col).find((x) => { const d = dayDiff(x[key]); return d !== null && d >= 0; });
    if (next) return `${col === "homework" ? "الأقرب تسليماً" : "القادم"}: ${next.subject || ""} — ${rel(dayDiff(next[key]))}`;
    return col === "homework" ? `${a.length} من الواجبات المسجّلة` : `${a.length} من الامتحانات المسجّلة`;
  }
  if (col === "live") {
    const live = a.filter((x) => x.kind !== "rec").length;
    return `${live} حصة مباشرة · ${a.length - live} تسجيل`;
  }
  return `${a.length} من المدرسين حسب المادة`;
}

function renderCard(col, idx) {
  const def = COLS[col];
  const en = lang() === "en";
  const total = items(col).length;
  return h("article", { class: `resource-card ${TONES[col]}`, style: `animation-delay:${idx * 45}ms` },
    h("div", { class: "resource-card-top" },
      h("div", { class: "resource-icon", "aria-hidden": "true" }, svgIcon(col, 24)),
      h("span", { class: "paper-tab" }, EYEBROW[col][en ? 1 : 0])),
    h("h3", {}, def[lang()]),
    h("p", {}, cardSummary(col)),
    h("div", { class: "resource-card-actions" },
      h("button", { type: "button", class: "card-open", onclick: () => openSection(col) },
        `${OPEN_LABEL[col]} (${total}) `, h("span", { class: "sg-arr", "aria-hidden": "true" }, "←")),
      col === "live" ? h("a", { class: "sg-card-add", href: YT_URL, target: "_blank", rel: "noopener noreferrer" }, "▶ قناة يوتيوب") : null,
      state.admin ? h("button", { type: "button", class: "sg-card-add", onclick: () => openItemForm(col, null) }, "＋ إضافة") : null));
}

function openSection(col) {
  const def = COLS[col];
  const d = openDialog([]);
  d.classList.add("sg-wide");
  const inner = d.firstChild;
  const draw = () => {
    const keep = inner.scrollTop;
    const total = items(col).length;
    let all = sorted(col);
    let subjects = null;
    if (col === "homework") {
      const groups = homeworkGroups();
      if (state.filter.homework && !groups.some((g) => g.key === state.filter.homework)) state.filter.homework = null;
      const cur = state.filter.homework;
      if (cur) all = all.filter((it) => classify(it.subject).key === cur);
      if (groups.length) {
        subjects = h("div", { class: "support-actions sg-subjects", role: "group", "aria-label": "تصفية الواجبات حسب المادة" },
          h("button", { type: "button", "aria-pressed": String(!cur), onclick: () => { state.filter.homework = null; draw(); } }, `الكل (${total})`),
          groups.map((g) => h("button", { type: "button", "aria-pressed": String(cur === g.key), onclick: () => { state.filter.homework = g.key; draw(); } }, `واجبات ${g.label} (${g.count})`)));
      }
    }
    const yt = col === "live" ? h("div", { class: "sg-acts" }, h("a", { class: "secondary-cta", href: YT_URL, target: "_blank", rel: "noopener noreferrer" }, "▶ قناة تسجيلات الحصص (يوتيوب)")) : null;
    inner.replaceChildren(...[
      dlgHead([svgIcon(col, 22), ` ${def[lang()]} (${total})`], d),
      yt,
      state.admin ? h("div", { class: "sg-acts" }, h("button", { type: "button", class: "primary-cta", onclick: () => openItemForm(col, null) }, "＋ إضافة " + def.one)) : null,
      subjects,
      all.length ? h("div", { class: "sg-list" }, all.map((it) => renderItem(col, it))) : h("p", { class: "sg-empty" }, def.empty)].filter(Boolean));
    inner.scrollTop = keep;
  };
  draw();
  listeners.push(draw);
  d.addEventListener("close", () => { const i = listeners.indexOf(draw); if (i >= 0) listeners.splice(i, 1); });
}

function renderDash() {
  const en = lang() === "en";
  const q = state.q.trim();
  const cols = q ? CARDS.filter((c) => sectionMatches(c, q) || searchHits(q).some((x) => x.col === c)) : CARDS;
  dashEl.hidden = !cols.length;
  if (!cols.length) { dashEl.replaceChildren(); return; }
  dashEl.replaceChildren(
    h("div", { class: "section-heading" },
      h("div", {}, h("div", { class: "section-tab" }, en ? "UPDATES" : "المتابعة اليومية"),
        h("h2", {}, en ? "Study updates" : "مستجدات الدراسة"))),
    h("div", { class: "resource-grid sg-res" }, cols.map((c, i) => renderCard(c, i))));
  mountDash();
}

function renderAdminBar() {
  document.querySelectorAll(".sg-bar").forEach((b) => b.remove());
  if (!state.admin) return;
  document.body.append(h("div", { class: "sg-bar", role: "region", "aria-label": "وضع المدير" },
    h("span", { class: "sg-bar-lbl" }, h("span", { class: "sg-dot", "aria-hidden": "true" }), "وضع المدير"),
    h("button", { type: "button", class: "sg-bar-out", onclick: doLogout }, "خروج")));
}

function renderAll() {
  renderTicker();
  renderDash();
  syncSearch();
  renderAdminBar();
  listeners.slice().forEach((f) => { try { f(); } catch { /* ignore */ } });
}

/* ---------- النوافذ ---------- */
function openDialog(inner) {
  const d = h("dialog", { class: "sg-dlg" }, h("div", { class: "sg-dlg-in" }, inner));
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}
const dlgHead = (title, d) => h("div", { class: "sg-dlg-h" }, h("h3", { style: "display:flex;align-items:center;gap:8px" }, title),
  h("button", { type: "button", class: "close-button", "aria-label": "إغلاق", onclick: () => d.close() }, "✕"));

function openForm({ heading, fields, values = {}, submitLabel = "حفظ", onSubmit }) {
  const holder = { d: null };
  const inputs = {};
  const imgStates = {};
  const err = h("p", { class: "sg-err", role: "alert" });
  const form = h("form", { novalidate: true, class: "sg-dlg-in", style: "padding:0;overflow:visible" });
  if (fields.some((f) => f.list)) form.append(h("datalist", { id: "sg-subjects-dl" }, subjectSuggestions().map((x) => h("option", { value: x }))));
  for (const f of fields) {
    const id = "sgf-" + f.k;
    if (f.t === "images") {
      const st = { keep: Array.isArray(values[f.k]) ? values[f.k].filter((x) => IMG_ID.test(String(x))).slice(0, MAX_IMGS) : [], add: [] };
      imgStates[f.k] = st;
      const list = h("div", { class: "sg-imgs" });
      const file = h("input", { id, type: "file", accept: "image/*", multiple: true });
      const total = () => st.keep.length + st.add.length;
      const redraw = () => {
        const kids = [];
        st.keep.forEach((iid, i) => {
          const im = h("img", { alt: "صورة محفوظة " + (i + 1) });
          loadImage(iid).then((u) => { im.src = u; }).catch(() => {});
          kids.push(h("div", { class: "sg-thumb" }, im, h("button", { type: "button", "aria-label": "إزالة الصورة", onclick: () => { st.keep.splice(i, 1); redraw(); } }, "✕")));
        });
        st.add.forEach((u, i) => kids.push(h("div", { class: "sg-thumb" }, h("img", { src: u, alt: "صورة جديدة " + (i + 1) }),
          h("button", { type: "button", "aria-label": "إزالة الصورة", onclick: () => { st.add.splice(i, 1); redraw(); } }, "✕"))));
        list.replaceChildren(...kids);
        file.disabled = total() >= MAX_IMGS;
      };
      file.addEventListener("change", async () => {
        err.textContent = "";
        for (const fl of Array.from(file.files)) {
          if (total() >= MAX_IMGS) break;
          try { st.add.push(await compressImage(fl)); }
          catch (ex) { err.textContent = ex && ex.message === "too-big" ? "الصورة كبيرة جداً، اختر صورة أصغر." : "تعذّر قراءة الصورة. استخدم صورة بصيغة JPG أو PNG."; }
        }
        file.value = ""; redraw();
      });
      redraw();
      form.append(h("div", { class: "sg-f" }, h("label", { for: id }, f.l), file, list));
      continue;
    }
    let el;
    if (f.t === "area") el = h("textarea", { id, rows: "3", maxlength: String(f.max || 600) });
    else if (f.t === "select") el = h("select", { id }, f.opts.map(([v, l]) => h("option", { value: v }, l)));
    else el = h("input", {
      id, maxlength: String(f.max || 200),
      type: f.t === "date" ? "date" : f.t === "password" ? "password" : f.t === "tel" ? "tel" : f.t === "url" ? "url" : "text",
      dir: f.t === "url" || f.t === "tel" ? "ltr" : null,
      list: f.list ? "sg-subjects-dl" : null,
      autocomplete: f.auto || "off", autocapitalize: f.t === "text" ? null : "off"
    });
    el.value = values[f.k] ?? (f.t === "select" ? f.opts[0][0] : "");
    inputs[f.k] = el;
    form.append(h("div", { class: "sg-f" }, h("label", { for: id }, f.l + (f.req ? " *" : "")), el));
  }
  const save = h("button", { type: "submit", class: "primary-cta" }, submitLabel);
  const cancel = h("button", { type: "button", class: "secondary-cta", onclick: () => holder.d.close() }, "إلغاء");
  form.append(err, h("div", { class: "sg-acts" }, save, cancel));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const out = {};
    for (const f of fields) {
      if (f.t === "images") { out[f.k] = { keep: imgStates[f.k].keep.slice(), add: imgStates[f.k].add.slice() }; continue; }
      out[f.k] = f.t === "password" ? inputs[f.k].value : clean(inputs[f.k].value, f.max || 600);
      if (f.req && !out[f.k]) { err.textContent = `الحقل «${f.l.replace(/\s*\(.*\)$/, "")}» مطلوب.`; inputs[f.k].focus(); return; }
      if (f.t === "url" && out[f.k] && !safeUrl(out[f.k])) { err.textContent = "الرابط غير صالح، يجب أن يبدأ بـ https://"; inputs[f.k].focus(); return; }
    }
    save.disabled = true; cancel.disabled = true;
    const label = save.textContent; save.textContent = "جارٍ الحفظ…";
    try {
      await onSubmit(out, err);
      holder.d.close();
    } catch (ex) {
      err.textContent = ex && ex.userMessage ? ex.userMessage : "تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى.";
      save.disabled = false; cancel.disabled = false; save.textContent = label;
    }
  });
  holder.d = openDialog([dlgHead(heading, { close: () => holder.d.close() }), form]);
  const first = form.querySelector("input,textarea,select");
  if (first) first.focus();
  return holder.d;
}

/* ---------- Firebase ---------- */
function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_CACHE) || "null");
    if (c && typeof c === "object") for (const k of Object.keys(state.data)) if (c[k] && typeof c[k] === "object") state.data[k] = c[k];
  } catch { /* ignore */ }
}
function saveCache() { try { localStorage.setItem(LS_CACHE, JSON.stringify(state.data)); } catch { /* ignore */ } }

function initDb() {
  dbReady = (async () => {
    const [appMod, dbMod] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-database.js")]);
    fbApp = appMod.initializeApp(FIREBASE_CONFIG);
    fbDb = dbMod;
    db = dbMod.getDatabase(fbApp);
    dbMod.onValue(dbMod.ref(db, "content"), (snap) => {
      const v = snap.val() || {};
      for (const k of Object.keys(state.data)) state.data[k] = v[k] && typeof v[k] === "object" ? v[k] : {};
      saveCache();
      renderAll();
    }, (e) => console.warn("[StudyGuide] تعذّرت قراءة المحتوى:", e && e.code));
  })().catch((e) => { console.warn("[StudyGuide] تعذّر تحميل Firebase:", e); });
  return dbReady;
}

function getAdmin() {
  if (!adminCtx) {
    adminCtx = (async () => {
      const [appM, authM, dbM] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-database.js")]);
      const app = appM.initializeApp(FIREBASE_CONFIG, "admin");
      const a = authM.getAuth(app);   // مهم: تهيئة المصادقة قبل قاعدة البيانات حتى يُرفق توكن المدير مع كل كتابة
      const d = dbM.getDatabase(app);
      return { authM, dbM, a, d };
    })().catch(() => { adminCtx = null; const e = new Error("offline"); e.code = "auth/network-request-failed"; throw e; });
  }
  return adminCtx;
}

async function watchAuth() {
  if (authWatching) return;
  const { authM, a } = await getAdmin();
  authWatching = true;
  authM.onAuthStateChanged(a, (u) => {
    const ok = !!u && typeof u.email === "string" && u.email.endsWith("@" + ADMIN_DOMAIN);
    adminUid = ok ? u.uid : null;
    if (!u) { try { localStorage.removeItem(LS_ADMIN); } catch { /* ignore */ } }
    if (state.admin !== ok) { state.admin = ok; renderAll(); }
  });
}

const loginMessage = (code) => {
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email", "auth/invalid-login-credentials"].includes(code)) return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  if (code === "auth/too-many-requests") return "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
  if (code === "auth/network-request-failed") return "تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.";
  if (code === "auth/operation-not-allowed") return "تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase.";
  return "تعذّر تسجيل الدخول. حاول مرة أخرى.";
};

function openLogin() {
  openForm({
    heading: "دخول المدير",
    submitLabel: "دخول",
    fields: [
      { k: "u", l: "اسم المستخدم", t: "text", req: 1, max: 60, auto: "username" },
      { k: "p", l: "كلمة المرور", t: "password", req: 1, auto: "current-password" }
    ],
    onSubmit: async (v) => {
      const user = v.u.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(user)) { const e = new Error("bad"); e.userMessage = loginMessage("auth/invalid-credential"); throw e; }
      try {
        const { authM, a } = await getAdmin();
        await authM.signInWithEmailAndPassword(a, `${user}@${ADMIN_DOMAIN}`, v.p);
      } catch (ex) { const e = new Error("login"); e.userMessage = loginMessage(ex && ex.code); throw e; }
      try { localStorage.setItem(LS_ADMIN, "1"); } catch { /* ignore */ }
      await watchAuth();
      toast("تم الدخول إلى وضع المدير");
    }
  });
}

function openAdminPanel() {
  const d = openDialog([]);
  const inner = d.firstChild;
  inner.replaceChildren(...[
    dlgHead("وضع المدير", d),
    h("p", { class: "sg-meta" }, "أنت مسجّل الدخول. استخدم أزرار «＋ إضافة» و«✎» و«🗑» على البطاقات لتعديل المحتوى."),
    adminUid ? h("p", { class: "sg-meta", dir: "ltr", style: "overflow-wrap:anywhere" }, "UID: " + adminUid) : null,
    h("div", { class: "sg-acts" },
      h("button", { type: "button", class: "primary-cta", onclick: () => { d.close(); openNewsManager(); } }, "إدارة الأخبار"),
      h("button", { type: "button", class: "secondary-cta", onclick: () => { d.close(); doLogout(); } }, "تسجيل الخروج"))].filter(Boolean));
}

async function doLogout() {
  try { const { authM, a } = await getAdmin(); await authM.signOut(a); } catch { /* ignore */ }
  state.admin = false; adminUid = null;
  try { localStorage.removeItem(LS_ADMIN); } catch { /* ignore */ }
  renderAll();
  toast("تم تسجيل الخروج");
}

/* ---------- الكتابة (للمدير فقط، والصلاحية تفرضها قواعد القاعدة) ---------- */
const writeError = (ex) => {
  if (ex && ex.userMessage) return ex;
  const e = new Error("write");
  const denied = ex && String(ex.code || ex.message).toUpperCase().includes("PERMISSION");
  e.userMessage = denied
    ? (adminUid
      ? `لا تملك صلاحية الكتابة. تأكد أن قواعد Firebase منشورة وأن UID فيها يساوي: ${adminUid}`
      : "انتهت جلسة الدخول. سجّل الدخول من جديد.")
    : "تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى.";
  return e;
};

async function wctx() {
  let c;
  try { c = await getAdmin(); } catch (ex) { throw writeError(ex); }
  if (!c.a.currentUser) throw writeError({ code: "PERMISSION" });
  return c;
}

async function saveItem(col, old, values) {
  const { dbM, d } = await wctx();
  const def = COLS[col];
  const obj = {};
  for (const f of def.fields) {
    if (f.t === "images") continue;
    let v = clean(values[f.k], f.max || 600);
    if (f.t === "url" && v) v = safeUrl(v);
    if (f.k === "subject" && v) { const c = classify(v); if (c.key.startsWith("k:")) v = c.label; }
    if (v) obj[f.k] = v;
  }
  const removed = [];
  try {
    const imgField = def.fields.find((f) => f.t === "images");
    if (imgField) {
      const v = values[imgField.k] || { keep: [], add: [] };
      const keep = (v.keep || []).filter((x) => IMG_ID.test(String(x))).slice(0, MAX_IMGS);
      const added = [];
      for (const u of (v.add || []).slice(0, MAX_IMGS - keep.length)) {
        if (typeof u !== "string" || !u.startsWith(IMG_PREFIX) || u.length > 380000) continue;
        const k = dbM.push(dbM.ref(d, "images")).key;
        await dbM.set(dbM.ref(d, "images/" + k), u);
        added.push(k);
      }
      const ids = [...keep, ...added].slice(0, MAX_IMGS);
      if (ids.length) obj.imgs = ids;
      for (const x of (old && Array.isArray(old.imgs) ? old.imgs : [])) if (!ids.includes(x)) removed.push(x);
    }
    obj.ts = (old && old.ts) || Date.now();
    obj.upd = Date.now();
    const key = old ? old.id : dbM.push(dbM.ref(d, `content/${col}`)).key;
    await dbM.set(dbM.ref(d, `content/${col}/${key}`), obj);
    for (const x of removed) { try { await dbM.remove(dbM.ref(d, "images/" + x)); } catch { /* ignore */ } }
  } catch (ex) { throw writeError(ex); }
}

function openItemForm(col, it) {
  const def = COLS[col];
  openForm({
    heading: (it ? "تعديل " : "إضافة ") + def.one,
    fields: def.fields,
    values: it || {},
    onSubmit: async (v) => { await saveItem(col, it, v); toast(it ? "تم التعديل" : "تمت الإضافة"); }
  });
}

async function deleteItem(col, it) {
  if (!window.confirm("هل تريد حذف هذا العنصر نهائياً؟")) return;
  try {
    const { dbM, d } = await wctx();
    await dbM.remove(dbM.ref(d, `content/${col}/${it.id}`));
    for (const x of Array.isArray(it.imgs) ? it.imgs : []) {
      if (IMG_ID.test(String(x))) { try { await dbM.remove(dbM.ref(d, "images/" + x)); } catch { /* ignore */ } }
    }
    toast("تم الحذف");
  } catch (ex) { toast(writeError(ex).userMessage); }
}

function openGallery(ids) {
  const d = openDialog([]);
  const slots = ids.map(() => h("div", { class: "sg-gal" }, h("p", { class: "sg-meta" }, "جارٍ تحميل الصورة…")));
  d.firstChild.replaceChildren(dlgHead("صور الواجب", d), ...slots);
  ids.forEach((id, i) => {
    loadImage(id).then((u) => {
      slots[i].replaceChildren(
        h("img", { src: u, alt: `صورة الواجب ${i + 1}` }),
        h("a", { class: "secondary-cta", href: u, download: `homework-${i + 1}.jpg` }, "تحميل الصورة"));
    }).catch(() => slots[i].replaceChildren(h("p", { class: "sg-err" }, "تعذّر تحميل الصورة. تحقق من الاتصال.")));
  });
}

const DEFAULT_NEWS = [
  { text: "تنبيه: يرجى التأكد من تغيير كلمة المرور فور دخولك للحساب — صلّوا على النبي ﷺ", en: "Note: Change your password immediately after your first login." },
  { text: "تذكير: لا تشارك بيانات الدخول أو كلمة المرور مع أي شخص.", en: "Reminder: Do not share your login details or password with anyone." },
  { text: "تعلن وزارة التربية والتعليم العالي مواعيد العام الدراسي 2026/2027: بدء الدوام 5/9/2026، امتحانات الفصل الأول 28/12/2026–12/1/2027، عطلة نصف السنة 13/1/2027–31/1/2027، بدء الفصل الثاني 1/2/2027، امتحانات الفصل الثاني 2/6/2027–17/6/2027، وبداية العطلة الصيفية 18/6/2027.", en: "The Ministry of Education and Higher Education announces the 2026/2027 school calendar: classes begin 5 Sep 2026; first-semester exams 28 Dec 2026–12 Jan 2027; mid-year break 13–31 Jan 2027; the second semester begins 1 Feb 2027; second-semester exams 2–17 Jun 2027; and the summer break begins 18 Jun 2027." }
];

async function importDefaultNews() {
  const { dbM, d } = await wctx();
  const base = Date.now();
  try {
    for (let i = 0; i < DEFAULT_NEWS.length; i++) {
      const key = dbM.push(dbM.ref(d, "content/news")).key;
      await dbM.set(dbM.ref(d, `content/news/${key}`), { ...DEFAULT_NEWS[i], ts: base - i, upd: base });
    }
  } catch (ex) { throw writeError(ex); }
}

function openNewsManager() {
  const d = openDialog([]);
  const inner = d.firstChild;
  const draw = () => {
    const news = sorted("news");
    inner.replaceChildren(
      dlgHead("إدارة شريط الأخبار", d),
      h("div", { class: "sg-acts" },
        h("button", { type: "button", class: "primary-cta", onclick: () => openItemForm("news", null) }, "＋ إضافة خبر"),
        news.length ? null : h("button", { type: "button", class: "secondary-cta", onclick: async (e) => {
          e.target.disabled = true;
          try { await importDefaultNews(); toast("تم استيراد رسائل الشريط الحالية"); } catch (ex) { e.target.disabled = false; toast(ex.userMessage || "تعذّر الاستيراد"); }
        } }, "استيراد رسائل الشريط الحالية")),
      h("div", { class: "sg-mgr" }, news.length
        ? news.map((n) => h("div", { class: "sg-item" },
          h("div", { class: "sg-item-b" }, h("p", { class: "sg-txt", dir: "auto" }, n.text), n.link ? h("p", { class: "sg-meta", dir: "ltr" }, n.link) : null),
          h("div", { class: "sg-ctl" }, iconBtn("تعديل", "✎", () => openItemForm("news", n)), iconBtn("حذف", "🗑", () => deleteItem("news", n), "sg-del"))))
        : h("p", { class: "sg-empty" }, "لا توجد أخبار بعد. الشريط الحالي في الموقع سيبقى ظاهراً حتى تضيف خبراً أو تستورد رسائله.")));
  };
  draw();
  listeners.push(draw);
  d.addEventListener("close", () => { const i = listeners.indexOf(draw); if (i >= 0) listeners.splice(i, 1); });
}

/* ---------- التشغيل ---------- */
function start() {
  const st = h("style", { id: "sg-admin-css" });
  st.textContent = CSS;
  document.head.append(st);

  loadCache();
  renderAll();

  // إعادة التركيب إذا أعاد التطبيق رسم الصفحة
  let raf = 0;
  new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      syncTicker();
      mountDash();
      readSearch();
    });
  }).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => renderAll()).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  document.addEventListener("input", (e) => { if (e.target && e.target.closest && e.target.closest(".hero-search")) readSearch(); }, true);
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest(".hero-search > button")) setTimeout(readSearch, 0); }, true);

  // الدخول: الضغط على اسم المصمم في التذييل (لا يوجد زر ظاهر)
  document.addEventListener("click", (e) => {
    const t = e.target;
    const hit = t && t.closest ? t.closest(".designer-credit b") : null;
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    if (state.admin) openAdminPanel(); else openLogin();
  }, true);

  initDb();
  let hint = false;
  try { hint = localStorage.getItem(LS_ADMIN) === "1"; } catch { /* ignore */ }
  if (hint) watchAuth().catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
