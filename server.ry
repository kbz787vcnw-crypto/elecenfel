import asyncio, hashlib, hmac, json, logging, os, re, time
from urllib.parse import parse_qsl

import aiohttp
from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bot")

BOT_TOKEN = os.environ["BOT_TOKEN"]
EL_KEY = os.environ["ELEVENLABS_API_KEY"]
WEBAPP_URL = os.environ["WEBAPP_URL"].rstrip("/")
PORT = int(os.getenv("PORT", "8080"))
ALLOWED = {int(x) for x in os.getenv("ALLOWED_USERS", "").replace(" ", "").split(",") if x}
if not ALLOWED:
    raise SystemExit("Укажи ALLOWED_USERS в .env (Telegram ID через запятую)")

EL = "https://api.elevenlabs.io/v1"
BASE = os.path.dirname(os.path.abspath(__file__))
MAX_TTS_CHARS = 5000
MAX_SFX_CHARS = 500
VOICE_RE = re.compile(r"^[A-Za-z0-9]{10,40}$")


# ---------- проверка Telegram + allowlist ----------
def init_user_id(init_data: str):
    """Возвращает id пользователя, если подпись Telegram верна, иначе None."""
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
        received = data.pop("hash")
        check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calc, received) or time.time() - int(data["auth_date"]) > 86400:
            return None
        return json.loads(data["user"])["id"]
    except Exception:
        return None


@web.middleware
async def auth(request, handler):
    if request.path.startswith("/api/"):
        uid = init_user_id(request.headers.get("X-Init-Data", ""))
        if uid not in ALLOWED:
            log.warning("denied uid=%s path=%s", uid, request.path)
            return web.json_response({"error": "forbidden"}, status=403)
    return await handler(request)


# ---------- прокси к ElevenLabs (ключ остаётся на сервере) ----------
async def session_ctx(app):
    app["http"] = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=300))
    yield
    await app["http"].close()


async def el(request, method, path, **kw):
    try:
        async with request.app["http"].request(method, EL + path, headers={"xi-api-key": EL_KEY}, **kw) as r:
            body = await r.read()
            if r.status >= 400:
                log.warning("ElevenLabs %s %s -> %s %s", method, path, r.status, body[:200])
            return web.Response(body=body, status=r.status,
                                content_type=r.headers.get("Content-Type", "application/json").split(";")[0])
    except aiohttp.ClientError as e:
        log.error("ElevenLabs request failed: %s", e)
        return web.json_response({"error": "upstream"}, status=502)


def bad(msg):
    return web.HTTPBadRequest(text=msg)


def voice_id(v):
    if not isinstance(v, str) or not VOICE_RE.match(v):
        raise bad("bad_voice")
    return v


def get_file(form, name):
    f = form.get(name)
    if not isinstance(f, web.FileField):
        raise bad("need_file")
    return f


def to_formdata(f, field, model_id):
    fd = aiohttp.FormData()
    fd.add_field(field, f.file.read(), filename=f.filename, content_type=f.content_type)
    fd.add_field("model_id", model_id)
    return fd


async def voices(request):
    return await el(request, "GET", "/voices")


async def tts(request):  # Text to Speech
    d = await request.json()
    text = (d.get("text") or "").strip()
    if not text or len(text) > MAX_TTS_CHARS:
        raise bad("tts_len")
    return await el(request, "POST", f"/text-to-speech/{voice_id(d.get('voice_id'))}",
                    json={"text": text, "model_id": "eleven_multilingual_v2"})


async def sts(request):  # Speech to Speech
    form = await request.post()
    fd = to_formdata(get_file(form, "audio"), "audio", "eleven_multilingual_sts_v2")
    return await el(request, "POST", f"/speech-to-speech/{voice_id(form.get('voice_id'))}", data=fd)


async def stt(request):  # Speech to Text
    form = await request.post()
    fd = to_formdata(get_file(form, "file"), "file", "scribe_v1")
    return await el(request, "POST", "/speech-to-text", data=fd)


async def sfx(request):  # Sound Effects
    d = await request.json()
    text = (d.get("text") or "").strip()
    if not text or len(text) > MAX_SFX_CHARS:
        raise bad("sfx_len")
    payload = {"text": text}
    if d.get("duration_seconds"):
        try:
            payload["duration_seconds"] = min(max(float(d["duration_seconds"]), 0.5), 30)
        except ValueError:
            raise bad("bad_duration")
    return await el(request, "POST", "/sound-generation", json=payload)


def make_app():
    app = web.Application(middlewares=[auth], client_max_size=25 * 1024 * 1024)
    app.cleanup_ctx.append(session_ctx)
    app.router.add_get("/api/voices", voices)
    app.router.add_post("/api/tts", tts)
    app.router.add_post("/api/sts", sts)
    app.router.add_post("/api/stt", stt)
    app.router.add_post("/api/sfx", sfx)
    app.router.add_get("/", lambda r: web.FileResponse(os.path.join(BASE, "webapp", "index.html")))
    app.router.add_static("/", os.path.join(BASE, "webapp"))
    return app


# ---------- сам бот ----------
dp = Dispatcher()
PAGES = [("🗣 Text to Speech", "tts"), ("🎙 Speech to Speech", "sts"),
         ("📝 Speech to Text", "stt"), ("🔊 Sound Effects", "sfx")]


@dp.message(CommandStart())
async def start(m: Message):
    ru = (m.from_user.language_code or "ru").startswith("ru")
    if m.from_user.id not in ALLOWED:
        return await m.answer("Доступ закрыт." if ru else "Access denied.")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t, web_app=WebAppInfo(url=f"{WEBAPP_URL}/{p}.html"))] for t, p in PAGES
    ])
    await m.answer("Выбери функцию ElevenLabs:" if ru else "Choose an ElevenLabs tool:", reply_markup=kb)


async def main():
    bot = Bot(BOT_TOKEN)
    runner = web.AppRunner(make_app())
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()
    log.info("Server on :%s", PORT)
    try:
        await dp.start_polling(bot)
    finally:
        await runner.cleanup()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
