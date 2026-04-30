// EdgeOne Pages Edge Function - nte-login
//
// 路由（[[default]] 兜底捕获 /nte/*，统一在 onRequest 里分发）：
//   POST /nte/start              创建 / 复用登录会话
//   POST /nte/sendSmsCode        触发老虎下发短信验证码
//   POST /nte/login              提交验证码完成登录
//   GET  /nte/status/{auth}      读会话状态（NTEUID 端轮询）
//   GET  /nte/i/{auth}           登录页 HTML
//   GET  /nte/done               登录完成页 HTML
//
// 依赖：
//   * KV namespace 绑定到全局变量 `nte_kv`（在控制台 KV Storage → 绑定项目时配）
//   * 环境变量：仅 SHARED_SECRET（控制台 → 环境变量，只配这 1 个）

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

// 与 Python 版 ntelogin/constants.py / settings.py 保持一致：固定常量直接写死
const LAOHU_APP_ID = "10550";
const LAOHU_APP_KEY = "89155cc4e8634ec5b1b6364013b23e3e";
const SESSION_TTL_S = 600;
const SIG_TTL_S = 300;

const LAOHU_BASE_URL = "https://user.laohu.com";
const LAOHU_SDK_VERSION = "4.273.0";
const LAOHU_USER_AGENT = "okhttp/4.9.0";
const LAOHU_DEFAULT_PACKAGE = "com.pwrd.htassistant";
const LAOHU_DEFAULT_VERSION_CODE = "12";

const TERMINAL_STATUS = new Set(["success", "failed", "expired"]);

const MOBILE_RE = /^1\d{10}$/;
const CODE_RE = /^\d{4,8}$/;

function readConfig(env) {
  // 只有 SHARED_SECRET 是部署相关的（要跟 NTEUID 后台 NTELoginSecret 一致）
  return {
    sharedSecret: env.SHARED_SECRET || "",
    laohuAppId: LAOHU_APP_ID,
    laohuAppKey: LAOHU_APP_KEY,
    sessionTtlS: SESSION_TTL_S,
    sigTtlS: SIG_TTL_S,
  };
}

// ---------------------------------------------------------------------------
// MD5（laohu 接口签名要用，Web Crypto 没有）
// ---------------------------------------------------------------------------

const MD5_K = new Uint32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
]);
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

function md5Hex(input) {
  const utf8 = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const len = utf8.length;
  const numBlocks = Math.ceil((len + 9) / 64);
  const padded = new Uint8Array(numBlocks * 64);
  padded.set(utf8);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  // 长度（bits）小端 64 位
  const bitLenLo = (len << 3) >>> 0;
  const bitLenHi = Math.floor(len / 0x20000000) >>> 0;
  view.setUint32(padded.length - 8, bitLenLo, true);
  view.setUint32(padded.length - 4, bitLenHi, true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let off = 0; off < padded.length; off += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);

    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D;
      D = C;
      C = B;
      const sum = (A + F + MD5_K[i] + M[g]) >>> 0;
      B = (B + ((sum << MD5_S[i]) | (sum >>> (32 - MD5_S[i])))) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, a0, true);
  odv.setUint32(4, b0, true);
  odv.setUint32(8, c0, true);
  odv.setUint32(12, d0, true);
  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// AES-128-ECB-PKCS7（Web Crypto 没 ECB，用 CBC IV=0 逐块 + 手动 PKCS7）
// ---------------------------------------------------------------------------

async function aesEcbEncryptBase64(keyBytes, plaintextStr) {
  const data = new TextEncoder().encode(plaintextStr);
  const padLen = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  for (let i = data.length; i < padded.length; i++) padded[i] = padLen;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC", length: 128 },
    false,
    ["encrypt"],
  );

  const out = new Uint8Array(padded.length);
  const zeroIv = new Uint8Array(16);
  for (let i = 0; i < padded.length; i += 16) {
    const block = padded.slice(i, i + 16);
    // AES-CBC 给单块 + IV=0 等价于该块的 ECB 加密。
    // crypto.subtle 会对输入再补一个 PKCS7 块，结果取前 16 字节即可。
    const encryptedBuf = await crypto.subtle.encrypt({ name: "AES-CBC", iv: zeroIv }, cryptoKey, block);
    out.set(new Uint8Array(encryptedBuf).slice(0, 16), i);
  }

  // base64 编码
  let binary = "";
  for (let i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 hex（NTEUID 协议签名，与 Python 的 utils/signature.py 对齐）
// ---------------------------------------------------------------------------

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySig(secret, parts, expected, ts, ttlS) {
  if (!secret) return true; // 空 secret 等同于关签名校验（Python 行为一致）
  if (!expected) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > ttlS) return false;
  const expectedSig = await hmacSha256Hex(secret, parts.join("|"));
  return constantTimeEqualHex(expectedSig, expected);
}

async function verifyStart(payload, cfg) {
  return verifySig(
    cfg.sharedSecret,
    ["start", payload.auth, payload.user_id, String(payload.ts)],
    payload.sig || "",
    payload.ts,
    cfg.sigTtlS,
  );
}

async function verifyListen(auth, ts, sig, cfg) {
  return verifySig(cfg.sharedSecret, ["listen", auth, String(ts)], sig || "", ts, cfg.sigTtlS);
}

// ---------------------------------------------------------------------------
// 设备指纹（与 Python LaohuDevice 默认值一致）
// ---------------------------------------------------------------------------

function newDevice() {
  // Python 是 "HT" + uuid4().hex[:14].upper() —— 14 位大写十六进制
  const rand = new Uint8Array(7);
  crypto.getRandomValues(rand);
  const deviceId = "HT" + Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return {
    device_id: deviceId,
    device_type: "Pixel 6",
    device_model: "Pixel 6",
    device_name: "Pixel 6",
    device_sys: "Android 14",
    adm: deviceId,
    imei: "",
    idfa: "",
    mac: "",
  };
}

// ---------------------------------------------------------------------------
// Session 存储（KV 没原生 TTL，把过期戳塞进 value）
// ---------------------------------------------------------------------------

function sessionKey(auth) {
  return `sess:${auth}`;
}

async function getSession(auth) {
  const raw = await nte_kv.get(sessionKey(auth), "json");
  if (!raw) return null;
  if (typeof raw.expires_at !== "number" || raw.expires_at <= Date.now()) {
    // 已过期，惰性清理
    await nte_kv.delete(sessionKey(auth)).catch(() => {});
    return null;
  }
  return raw;
}

async function putSession(session) {
  await nte_kv.put(sessionKey(session.auth), JSON.stringify(session));
}

async function dropSession(auth) {
  await nte_kv.delete(sessionKey(auth)).catch(() => {});
}

// ---------------------------------------------------------------------------
// 老虎 SDK
// ---------------------------------------------------------------------------

function laohuCommonFields(cfg, device, useMillis) {
  const ts = useMillis ? Date.now() : Math.floor(Date.now() / 1000);
  const base = {
    appId: String(cfg.laohuAppId),
    channelId: "1",
    deviceId: device.device_id,
    deviceType: device.device_type,
    deviceModel: device.device_model,
    deviceName: device.device_name,
    deviceSys: device.device_sys,
    adm: device.adm,
    idfa: device.idfa,
    sdkVersion: LAOHU_SDK_VERSION,
    bid: LAOHU_DEFAULT_PACKAGE,
    t: String(ts),
  };
  if (useMillis) {
    base.version = LAOHU_DEFAULT_VERSION_CODE;
    base.mac = device.mac;
  } else {
    base.versionCode = LAOHU_DEFAULT_VERSION_CODE;
    base.imei = device.imei;
  }
  return base;
}

function laohuSign(params, appKey) {
  const sortedKeys = Object.keys(params).sort();
  const raw = sortedKeys.map((k) => params[k]).join("") + appKey;
  return md5Hex(raw);
}

function formUrlEncode(params) {
  const out = [];
  for (const [k, v] of Object.entries(params)) {
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

async function laohuSubmit(path, params, cfg, { keepEmpty = false } = {}) {
  const signed = { ...params, sign: laohuSign(params, cfg.laohuAppKey) };
  const cleaned = {};
  for (const [k, v] of Object.entries(signed)) {
    if (v === null || v === undefined) continue;
    if (!keepEmpty && v === "") continue;
    cleaned[k] = String(v);
  }

  const resp = await fetch(`${LAOHU_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "User-Agent": LAOHU_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formUrlEncode(cleaned),
  });

  const text = await resp.text();
  if (resp.status >= 400) {
    throw new LaohuError(`[${path}] HTTP ${resp.status}`, { status_code: resp.status, text });
  }
  if (!text) throw new LaohuError(`[${path}] 响应为空`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return text;
  }
  const code = payload?.code;
  if (code !== 0 && code !== "0") {
    throw new LaohuError(`[${path}] ${payload?.message || ""}`, payload);
  }
  return payload?.result ?? {};
}

class LaohuError extends Error {
  constructor(message, raw) {
    super(message);
    this.raw = raw;
  }
}

async function laohuSendSms(cellphone, cfg, device) {
  const params = laohuCommonFields(cfg, device, false);
  params.cellphone = cellphone;
  params.areaCodeId = "1";
  params.type = "16";
  await laohuSubmit("/m/newApi/sendPhoneCaptchaWithOutLogin", params, cfg);
}

async function laohuLoginBySms(cellphone, code, cfg, device) {
  // checkPhoneCaptcha 先校验
  {
    const p = laohuCommonFields(cfg, device, false);
    p.cellphone = cellphone;
    p.captcha = code;
    await laohuSubmit("/m/newApi/checkPhoneCaptchaWithOutLogin", p, cfg);
  }

  const aesKey = new TextEncoder().encode(cfg.laohuAppKey.slice(-16));
  const params = laohuCommonFields(cfg, device, true);
  params.cellphone = await aesEcbEncryptBase64(aesKey, cellphone);
  params.captcha = await aesEcbEncryptBase64(aesKey, code);
  params.areaCodeId = "1";
  params.type = "16";

  const result = await laohuSubmit("/openApi/sms/new/login", params, cfg, { keepEmpty: true });
  const userIdRaw = result?.userId;
  const tokenRaw = result?.token;
  if (userIdRaw == null || tokenRaw == null) throw new LaohuError("老虎登录返回缺少 userId/token", result);
  const token = String(tokenRaw);
  if (!token) throw new LaohuError("老虎登录返回 token 为空", result);
  const userId = parseInt(userIdRaw, 10);
  if (!Number.isFinite(userId) || userId <= 0) throw new LaohuError("老虎登录返回 userId 无效", result);
  return { user_id: userId, token };
}

// ---------------------------------------------------------------------------
// HTML 渲染
// ---------------------------------------------------------------------------

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function ttlLabel(ttlS) {
  if (ttlS >= 60 && ttlS % 60 === 0) return `${ttlS / 60} 分钟内有效`;
  return `${ttlS} 秒内有效`;
}

function renderLogin(auth, userId, ttlS) {
  return LOGIN_HTML
    .replaceAll("__AUTH__", JSON.stringify(auth))
    .replaceAll("__USER_ID__", htmlEscape(userId))
    .replaceAll("__TTL_LABEL__", htmlEscape(ttlLabel(ttlS)));
}

// ---------------------------------------------------------------------------
// 路由处理
// ---------------------------------------------------------------------------

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function handleStart(request, cfg) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ detail: "bad_request" }, 400);
  }

  if (typeof payload?.auth !== "string" || payload.auth.length < 4 || payload.auth.length > 64) {
    return jsonResponse({ detail: "bad_request" }, 400);
  }
  if (typeof payload?.user_id !== "string" || payload.user_id.length === 0 || payload.user_id.length > 64) {
    return jsonResponse({ detail: "bad_request" }, 400);
  }
  if (typeof payload?.ts !== "number") {
    return jsonResponse({ detail: "bad_request" }, 400);
  }

  if (!(await verifyStart(payload, cfg))) {
    return jsonResponse({ detail: "bad_signature" }, 401);
  }

  const existing = await getSession(payload.auth);
  if (existing && existing.status === "pending") {
    return jsonResponse({ auth: payload.auth, expires_in_s: cfg.sessionTtlS });
  }

  const session = {
    auth: payload.auth,
    user_id: payload.user_id,
    bot_id: payload.bot_id || "",
    group_id: payload.group_id ?? null,
    device: newDevice(),
    status: "pending",
    msg: "",
    credential: null,
    expires_at: Date.now() + cfg.sessionTtlS * 1000,
  };
  await putSession(session);
  return jsonResponse({ auth: payload.auth, expires_in_s: cfg.sessionTtlS });
}

async function handleSendSms(request, cfg) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ detail: "bad_request" }, 400);
  }

  if (!MOBILE_RE.test(payload?.mobile || "")) {
    return jsonResponse({ ok: false, msg: "手机号格式错误" }, 400);
  }
  const session = await getSession(payload?.auth || "");
  if (!session) return jsonResponse({ detail: "session_expired" }, 404);

  try {
    await laohuSendSms(payload.mobile, cfg, session.device);
  } catch (err) {
    return jsonResponse({ ok: false, msg: "验证码发送失败，请稍后再试" }, 400);
  }
  return jsonResponse({ ok: true, msg: "验证码已发送" });
}

async function handleLogin(request, cfg) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ detail: "bad_request" }, 400);
  }

  if (!MOBILE_RE.test(payload?.mobile || "")) {
    return jsonResponse({ ok: false, msg: "手机号格式错误" }, 400);
  }
  if (!CODE_RE.test(payload?.code || "")) {
    return jsonResponse({ ok: false, msg: "验证码格式错误" }, 400);
  }
  const session = await getSession(payload?.auth || "");
  if (!session) return jsonResponse({ detail: "session_expired" }, 404);
  if (session.status === "success") {
    return jsonResponse({ detail: "already_finished" }, 409);
  }

  let account;
  try {
    account = await laohuLoginBySms(payload.mobile, payload.code, cfg, session.device);
  } catch (err) {
    session.status = "failed";
    session.msg = "验证码错误或已过期，请重新获取";
    await putSession(session);
    return jsonResponse({ ok: false, msg: "验证码错误或已过期，请重新获取" }, 400);
  }

  session.status = "success";
  session.msg = "登录成功";
  session.credential = {
    laohu_token: account.token,
    laohu_user_id: String(account.user_id),
  };
  await putSession(session);
  return jsonResponse({ ok: true, msg: "登录成功" });
}

async function handleStatus(auth, urlParams, cfg) {
  const ts = parseInt(urlParams.get("ts") || "0", 10);
  const sig = urlParams.get("sig") || "";
  if (!(await verifyListen(auth, ts, sig, cfg))) {
    return jsonResponse({ detail: "bad_signature" }, 401);
  }

  const session = await getSession(auth);
  if (!session) return jsonResponse({ status: "expired", msg: "", credential: null });

  const snap = { status: session.status, msg: session.msg, credential: session.credential };
  if (snap.status === "success" || snap.status === "failed") {
    // 终态被拿走后立刻丢弃，凭据是一次性的
    await dropSession(auth);
  }
  return jsonResponse(snap);
}

async function handleLoginPage(auth, cfg) {
  const session = await getSession(auth);
  if (!session) return htmlResponse(NOT_FOUND_HTML, 404);
  if (session.status === "success") return htmlResponse(DONE_HTML);
  return htmlResponse(renderLogin(auth, session.user_id, cfg.sessionTtlS));
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export async function onRequest(context) {
  const cfg = readConfig(context.env);

  // KV 绑定健康检查 —— 没绑会立刻显式报错，避免后续 ReferenceError
  if (typeof nte_kv === "undefined") {
    return jsonResponse({ detail: "kv_not_bound", hint: "在 EdgeOne 控制台 KV Storage 创建 namespace 并绑定到本项目，变量名设为 nte_kv" }, 500);
  }

  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method;
  const req = context.request;

  if (method === "POST" && path === "/nte/start") return handleStart(req, cfg);
  if (method === "POST" && path === "/nte/sendSmsCode") return handleSendSms(req, cfg);
  if (method === "POST" && path === "/nte/login") return handleLogin(req, cfg);
  if (method === "GET" && path === "/nte/done") return htmlResponse(DONE_HTML);

  let m = path.match(/^\/nte\/i\/([^/]+)$/);
  if (method === "GET" && m) return handleLoginPage(decodeURIComponent(m[1]), cfg);

  m = path.match(/^\/nte\/status\/([^/]+)$/);
  if (method === "GET" && m) return handleStatus(decodeURIComponent(m[1]), url.searchParams, cfg);

  return new Response("Not Found", { status: 404 });
}

// ---------------------------------------------------------------------------
// HTML 模板（来自 ntelogin/templates/，placeholder 用 __XXX__）
// ---------------------------------------------------------------------------

const LOGIN_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>异环 · 登录</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400;1,500&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" />
    <style>
      :root {
        --text:      rgba(255, 255, 255, 0.96);
        --text-dim:  rgba(255, 255, 255, 0.70);
        --text-mute: rgba(255, 255, 255, 0.42);
        --glass-top:    rgba(255, 255, 255, 0.16);
        --glass-bot:    rgba(255, 255, 255, 0.06);
        --glass-field:  rgba(255, 255, 255, 0.08);
        --glass-strong: rgba(255, 255, 255, 0.22);
        --edge:         rgba(255, 255, 255, 0.18);
        --specular:     rgba(255, 255, 255, 0.35);
        --accent: #d6c2ff;
        --good:   #86e5a2;
        --bad:    #ff9aa8;
        --serif: 'Cormorant Garamond', serif;
        --display: 'Fraunces', 'Cormorant Garamond', serif;
        --sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
                'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
      }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body { margin: 0; padding: 0; }
      body { font-family: var(--sans); color: var(--text); background: #000; min-height: 100vh; -webkit-font-smoothing: antialiased; }
      .stage { position: fixed; inset: 0; z-index: -1; background: #000; }
      .stage video { width: 100%; height: 100%; object-fit: cover; filter: saturate(1.05) brightness(0.72); }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
      .card {
        width: min(380px, 100%); padding: 26px 26px 22px;
        background: linear-gradient(180deg, var(--glass-top) 0%, var(--glass-bot) 100%);
        backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%);
        border: 1px solid var(--edge); border-radius: 24px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 var(--specular), inset 0 -1px 0 rgba(255, 255, 255, 0.04);
      }
      .brand { position: relative; display: flex; align-items: center; gap: 18px; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
      .avatar { flex-shrink: 0; width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: var(--glass-strong); border: 1px solid var(--edge); box-shadow: 0 10px 26px rgba(0, 0, 0, 0.32), inset 0 1px 0 var(--specular); }
      .avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .wordmark { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
      .wordmark .brand-name { margin: 0; font-family: var(--display); font-size: 30px; font-weight: 700; font-variation-settings: "opsz" 144, "SOFT" 0, "WONK" 1; letter-spacing: 0.06em; line-height: 1; }
      .wordmark .brand-sub { margin: 0; font-size: 12.5px; font-weight: 400; color: var(--text-dim); letter-spacing: 0.02em; line-height: 1.3; }
      .wordmark .brand-sub .slash { color: var(--text-mute); margin: 0 5px; }
      .wordmark .brand-sub .en { font-family: var(--serif); font-style: italic; font-weight: 500; }
      .field { margin-bottom: 14px; }
      .field label { display: block; font-size: 12px; color: var(--text-dim); margin: 0 0 8px 4px; font-weight: 500; }
      .input-wrap { display: flex; align-items: stretch; background: var(--glass-field); border: 1px solid var(--edge); border-radius: 14px; overflow: hidden; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s; }
      .input-wrap:focus-within { border-color: rgba(214, 194, 255, 0.55); background: rgba(255, 255, 255, 0.12); box-shadow: 0 0 0 3px rgba(214, 194, 255, 0.15); }
      .input-wrap input { flex: 1; min-width: 0; padding: 13px 16px; background: transparent; border: none; color: var(--text); font-family: var(--sans); font-size: 15px; }
      .input-wrap input:focus { outline: none; }
      .input-wrap input::placeholder { color: var(--text-mute); }
      .send-btn { flex-shrink: 0; padding: 0 16px; background: transparent; border: none; color: var(--accent); font-family: var(--sans); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: opacity 0.2s; }
      .send-btn:hover:not(:disabled) { opacity: 0.7; }
      .send-btn:disabled { color: var(--text-mute); cursor: not-allowed; }
      .submit { width: 100%; margin-top: 12px; padding: 14px; border: 1px solid var(--edge); border-radius: 14px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); color: var(--text); font-family: var(--sans); font-size: 15px; font-weight: 600; letter-spacing: 0.1em; padding-left: calc(14px + 0.1em); cursor: pointer; box-shadow: inset 0 1px 0 var(--specular); transition: background 0.2s, transform 0.1s; }
      .submit:hover:not(:disabled) { background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.2) 100%); }
      .submit:active:not(:disabled) { transform: translateY(1px); }
      .submit:disabled { background: rgba(255, 255, 255, 0.05); color: var(--text-mute); cursor: not-allowed; box-shadow: none; }
      .status { margin-top: 14px; padding: 10px 14px; border-radius: 12px; font-size: 13px; text-align: center; background: rgba(0, 0, 0, 0.25); backdrop-filter: blur(16px); display: none; }
      .status.show { display: block; }
      .status.ok { color: var(--good); }
      .status.fail { color: var(--bad); }
      .footer { margin-top: 22px; text-align: center; font-size: 11px; color: var(--text-mute); line-height: 1.7; }
      .footer code { font-family: 'SF Mono', 'Menlo', 'Consolas', monospace; font-size: 11px; color: var(--text-dim); padding: 1px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); }
    </style>
  </head>
  <body>
    <div class="stage">
      <video autoplay muted loop playsinline preload="auto"
             poster="https://yh.wanmei.com/images/main260418/bg-video-poster.jpg"
             src="https://yhvmg.wmupd.com/webops/yh/yh_bgvideo_20260418.mp4"></video>
    </div>

    <main>
      <section class="card">
        <header class="brand">
          <div class="avatar">
            <img src="https://s1.imagehub.cc/images/2026/04/22/f00a93d8c1a5958ea22e6a0d185d9453.md.png" alt="NTE" />
          </div>
          <div class="wordmark">
            <p class="brand-name">NTEUID</p>
            <p class="brand-sub">塔吉多<span class="slash">/</span><span class="en">Neverness to Everness</span></p>
          </div>
        </header>

        <form onsubmit="return false">
          <div class="field">
            <label for="mobile">手机号</label>
            <div class="input-wrap">
              <input id="mobile" type="tel" inputmode="numeric" maxlength="11"
                     placeholder="请输入 11 位手机号" autocomplete="tel" />
            </div>
          </div>

          <div class="field">
            <label for="code">验证码</label>
            <div class="input-wrap">
              <input id="code" type="text" inputmode="numeric" maxlength="8"
                     placeholder="收到的短信验证码" autocomplete="one-time-code" />
              <button id="sendBtn" class="send-btn" type="button" disabled>获取</button>
            </div>
          </div>

          <button id="loginBtn" class="submit" type="submit" disabled>完成登录</button>

          <div class="status" id="status"></div>
        </form>

        <p class="footer">
          会话 <code>__USER_ID__</code> · __TTL_LABEL__
        </p>
      </section>
    </main>

    <script>
      const AUTH = __AUTH__;
      const $ = (id) => document.getElementById(id);
      const mobile = $('mobile');
      const code = $('code');
      const sendBtn = $('sendBtn');
      const loginBtn = $('loginBtn');
      const statusEl = $('status');

      function showStatus(msg, ok) {
        statusEl.textContent = msg;
        statusEl.className = \`status show \${ok ? 'ok' : 'fail'}\`;
      }

      function onlyDigits(el, max) {
        el.addEventListener('input', () => {
          const cleaned = el.value.replace(/\\D/g, '').slice(0, max);
          if (cleaned !== el.value) el.value = cleaned;
          validate();
        });
      }

      function validate() {
        const phoneOk = /^1\\d{10}$/.test(mobile.value);
        const codeOk = /^\\d{4,8}$/.test(code.value);
        sendBtn.disabled = !phoneOk || sendBtn.dataset.cooldown === '1';
        loginBtn.disabled = !(phoneOk && codeOk);
      }

      onlyDigits(mobile, 11);
      onlyDigits(code, 8);

      sendBtn.addEventListener('click', async () => {
        sendBtn.dataset.cooldown = '1';
        sendBtn.disabled = true;
        let remain = 60;
        const timer = setInterval(() => {
          sendBtn.textContent = \`\${remain}s\`;
          remain -= 1;
          if (remain < 0) {
            clearInterval(timer);
            sendBtn.textContent = '获取';
            sendBtn.dataset.cooldown = '0';
            validate();
          }
        }, 1000);

        const reply = await fetch('/nte/sendSmsCode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth: AUTH, mobile: mobile.value.trim() }),
        }).then((r) => r.json());
        showStatus(reply.msg || (reply.ok ? '验证码已发送' : '验证码发送失败'), !!reply.ok);
      });

      loginBtn.addEventListener('click', async () => {
        loginBtn.disabled = true;
        const origin = loginBtn.textContent;
        loginBtn.textContent = '验证中';
        const reply = await fetch('/nte/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth: AUTH, mobile: mobile.value.trim(), code: code.value.trim() }),
        }).then((r) => r.json());
        if (reply.ok) {
          mobile.disabled = true;
          code.disabled = true;
          sendBtn.disabled = true;
          loginBtn.textContent = '登录成功';
          showStatus('登录成功', true);
          window.location.replace('/nte/done');
          return;
        }
        loginBtn.textContent = origin;
        validate();
        showStatus(reply.msg || '登录失败', false);
      });

      validate();
    </script>
  </body>
</html>`;

const DONE_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>异环 · 登录完成</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400;1,500&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" />
    <style>
      :root {
        --text:      rgba(255, 255, 255, 0.96);
        --text-dim:  rgba(255, 255, 255, 0.70);
        --text-mute: rgba(255, 255, 255, 0.42);
        --glass-top: rgba(255, 255, 255, 0.16);
        --glass-bot: rgba(255, 255, 255, 0.06);
        --edge:      rgba(255, 255, 255, 0.18);
        --specular:  rgba(255, 255, 255, 0.35);
        --good:      #86e5a2;
        --display: 'Fraunces', 'Cormorant Garamond', serif;
        --sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
                'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
      }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body { margin: 0; padding: 0; }
      body { font-family: var(--sans); color: var(--text); background: #000; min-height: 100vh; -webkit-font-smoothing: antialiased; }
      .stage { position: fixed; inset: 0; z-index: -1; background: #000; }
      .stage video { width: 100%; height: 100%; object-fit: cover; filter: saturate(1.05) brightness(0.68); }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
      .card {
        width: min(380px, 100%); padding: 40px 28px 30px; text-align: center;
        background: linear-gradient(180deg, var(--glass-top) 0%, var(--glass-bot) 100%);
        backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%);
        border: 1px solid var(--edge); border-radius: 24px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 var(--specular);
      }
      .check { width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 50%; background: rgba(134, 229, 162, 0.18); border: 1px solid rgba(134, 229, 162, 0.45); display: flex; align-items: center; justify-content: center; color: var(--good); font-size: 38px; box-shadow: inset 0 1px 0 var(--specular); }
      h1 { margin: 0 0 8px; font-family: var(--display); font-size: 26px; font-weight: 700; letter-spacing: 0.04em; }
      p.sub { margin: 0 0 24px; color: var(--text-dim); font-size: 14px; line-height: 1.6; }
      .hint { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 12px; color: var(--text-mute); line-height: 1.7; }
    </style>
  </head>
  <body>
    <div class="stage">
      <video autoplay muted loop playsinline preload="auto"
             poster="https://yh.wanmei.com/images/main260418/bg-video-poster.jpg"
             src="https://yhvmg.wmupd.com/webops/yh/yh_bgvideo_20260418.mp4"></video>
    </div>

    <main>
      <section class="card">
        <div class="check">&#10003;</div>
        <h1>登录完成</h1>
        <p class="sub">登录结果已提交到 NTEUID，可以关闭此页面回到聊天。</p>
        <p class="hint">关闭后回到机器人对话继续操作即可。</p>
      </section>
    </main>
  </body>
</html>`;

const NOT_FOUND_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>异环 · 链接已失效</title>
    <style>
      body { margin: 0; min-height: 100vh; background: #0e0c14; color: #e8e3f1; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
      .box { width: min(380px, 100%); text-align: center; padding: 40px 28px; border-radius: 22px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
      h1 { margin: 0 0 12px; font-size: 22px; font-weight: 600; letter-spacing: 0.04em; }
      p { margin: 0; color: rgba(232,227,241,0.65); font-size: 14px; line-height: 1.7; }
    </style>
  </head>
  <body>
    <main class="box">
      <h1>链接已失效</h1>
      <p>请回到机器人对话重新发送 <code>nte登录</code>。</p>
    </main>
  </body>
</html>`;
