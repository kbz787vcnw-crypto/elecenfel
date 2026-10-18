const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); } catch {}
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

/* ---------- языки ---------- */
const I18N = {
  ru: {
    app_title: "ElevenLabs", menu_title: "Выбери инструмент", menu_back: "← Меню",
    tts_title: "Текст в речь", sts_title: "Речь в речь", stt_title: "Речь в текст", sfx_title: "Звуковые эффекты",
    tts_ph: "Введите текст для озвучки", stt_ph: "Здесь будет текст",
    sfx_ph: "Опиши звук: например, удар меча по щиту", dur_ph: "Длительность, сек (необязательно)",
    go_tts: "Озвучить", go_sts: "Изменить голос", go_stt: "Распознать", go_sfx: "Сгенерировать",
    busy: "⏳ Обработка…", done: "✅ Готово",
    pick_audio: "Выбери аудиофайл", pick_file: "Выбери файл",
    err_forbidden: "Доступ запрещён", err_bad_voice: "Некорректный голос", err_need_file: "Нужен файл",
    err_tts_len: "Текст: от 1 до 5000 символов", err_sfx_len: "Описание: от 1 до 500 символов",
    err_bad_duration: "Некорректная длительность", err_upstream: "Ошибка связи с ElevenLabs",
    err_network: "Нет связи с сервером"
  },
  en: {
    app_title: "ElevenLabs", menu_title: "Choose a tool", menu_back: "← Menu",
    tts_title: "Text to Speech", sts_title: "Speech to Speech", stt_title: "Speech to Text", sfx_title: "Sound Effects",
    tts_ph: "Enter text to voice", stt_ph: "Text will appear here",
    sfx_ph: "Describe a sound, e.g. a sword hitting a shield", dur_ph: "Duration, sec (optional)",
    go_tts: "Generate speech", go_sts: "Change voice", go_stt: "Transcribe", go_sfx: "Generate",
    busy: "⏳ Processing…", done: "✅ Done",
    pick_audio: "Choose an audio file", pick_file: "Choose a file",
    err_forbidden: "Access denied", err_bad_voice: "Invalid voice", err_need_file: "A file is required",
    err_tts_len: "Text must be 1–5000 characters", err_sfx_len: "Description must be 1–500 characters",
    err_bad_duration: "Invalid duration", err_upstream: "Couldn't reach ElevenLabs",
    err_network: "No connection to the server"
  }
};
let lang = LS.get("lang") === "en" ? "en" : "ru";
const t = k => I18N[lang][k] ?? I18N.en[k] ?? k;

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
  document.title = t(document.body.dataset.title || "app_title");
}

/* ---------- цветовые темы ---------- */
const THEMES = {
  navy:    { c: ["#010409", "#06122e", "#0c2a63"], a: "#3b82f6" },
  violet:  { c: ["#05010d", "#170a3a", "#3a1578"], a: "#8b5cf6" },
  emerald: { c: ["#010806", "#04261d", "#0a5a45"], a: "#10b981" },
  crimson: { c: ["#0a0103", "#2a0711", "#6b1224"], a: "#f43f5e" },
  cyan:    { c: ["#01090c", "#05303b", "#0b6a7d"], a: "#06b6d4" }
};
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (h, k) => "#" + rgb(h).map(v => Math.round(v * k).toString(16).padStart(2, "0")).join("");
const lum = h => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const customTheme = h => ({ c: [mix(h, .06), mix(h, .22), mix(h, .5)], a: h });

const root = document.documentElement;
function resolveTheme(s) { return s.id === "custom" ? customTheme(s.color) : THEMES[s.id]; }
function applyTheme(th) {
  root.style.setProperty("--c1", th.c[0]);
  root.style.setProperty("--c2", th.c[1]);
  root.style.setProperty("--c3", th.c[2]);
  root.style.setProperty("--accent", th.a);
  root.style.setProperty("--on", lum(th.a) > 0.62 ? "#06101f" : "#ffffff");
  try { tg?.setHeaderColor(th.c[0]); tg?.setBackgroundColor(th.c[0]); } catch {}
}
function loadTheme() {
  try {
    const s = JSON.parse(LS.get("theme"));
    if (s?.id === "custom" && /^#[0-9a-f]{6}$/i.test(s.color)) return s;
    if (THEMES[s?.id]) return s;
  } catch {}
  return { id: "navy" };
}
let theme = loadTheme();
root.classList.add("no-t");              // без анимации при загрузке страницы
applyTheme(resolveTheme(theme));
setTimeout(() => root.classList.remove("no-t"), 80);

function setTheme(s) {
  theme = s; LS.set("theme", JSON.stringify(s));
  applyTheme(resolveTheme(s)); refreshBar();
}

/* ---------- панель: цвета + язык ---------- */
function refreshBar() {
  document.querySelectorAll(".dot[data-theme]").forEach(b => b.classList.toggle("sel", theme.id === b.dataset.theme));
  document.querySelector(".dot.custom")?.classList.toggle("sel", theme.id === "custom");
  document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("sel", b.dataset.lang === lang));
}
document.addEventListener("DOMContentLoaded", () => {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.innerHTML =
    '<div class="dots">' +
    Object.keys(THEMES).map(id =>
      `<button class="dot" data-theme="${id}" aria-label="${id}" style="background:linear-gradient(135deg,${THEMES[id].c[1]},${THEMES[id].a})"></button>`
    ).join("") +
    '<label class="dot custom" aria-label="Custom color"><input type="color" id="cc"></label></div>' +
    '<div class="lang"><button data-lang="ru">RU</button><button data-lang="en">EN</button></div>';
  document.body.prepend(bar);

  const cc = bar.querySelector("#cc");
  cc.value = theme.color || "#3b82f6";
  cc.addEventListener("input", () => setTheme({ id: "custom", color: cc.value }));
  bar.querySelectorAll(".dot[data-theme]").forEach(b => b.addEventListener("click", () => setTheme({ id: b.dataset.theme })));
  bar.querySelectorAll(".lang button").forEach(b => b.addEventListener("click", () => {
    lang = b.dataset.lang; LS.set("lang", lang); applyLang(); refreshBar();
    const st = document.getElementById("st"); if (st) st.textContent = "";
  }));
  applyLang(); refreshBar();
});

/* ---------- API ---------- */
function errText(body) {
  let m = body;
  try { const j = JSON.parse(body); m = j.error || j.detail?.message || (typeof j.detail === "string" ? j.detail : body); } catch {}
  return I18N[lang]["err_" + m] || String(m).slice(0, 300);
}
async function api(path, opts = {}) {
  opts.headers = { ...(opts.headers || {}), "X-Init-Data": tg?.initData || "" };
  let r;
  try { r = await fetch("/api" + path, opts); } catch { throw new Error(t("err_network")); }
  if (!r.ok) throw new Error(errText(await r.text()));
  return r;
}
async function loadVoices(sel) {
  try {
    const j = await (await api("/voices")).json();
    sel.replaceChildren(...j.voices.map(v => new Option(v.name, v.voice_id)));
  } catch (e) {
    const st = document.getElementById("st"); if (st) st.textContent = "❌ " + e.message;
  }
}
async function run(btn, st, fn) {
  btn.disabled = true; st.textContent = t("busy");
  try { await fn(); st.textContent = t("done"); }
  catch (e) { st.textContent = "❌ " + e.message; }
  btn.disabled = false;
}
async function showAudio(resp, el) {
  el.src = URL.createObjectURL(await resp.blob());
  el.hidden = false; el.play().catch(() => {});
}
