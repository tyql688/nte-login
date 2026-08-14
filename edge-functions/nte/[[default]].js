// EdgeOne Pages Edge Function - nte-login
const LAOHU_APP_ID = "10550";
const LAOHU_APP_KEY = "89155cc4e8634ec5b1b6364013b23e3e";

const LAOHU_BASE_URL = "https://user.laohu.com";
const LAOHU_SDK_VERSION = "4.273.0";
const LAOHU_USER_AGENT = "okhttp/4.9.0";
const LAOHU_DEFAULT_PACKAGE = "com.pwrd.htassistant";
const LAOHU_DEFAULT_VERSION_CODE = "12";

const WANMEI_ID_BASE_URL = "https://id.wanmei.com";
const WANMEI_KF_BASE_URL = "https://kf.wanmei.com";
const WANMEI_KF_GAME_ID = "191";
const WANMEI_LOGIN_RETURN_URL = `${WANMEI_KF_BASE_URL}/selfItemFlowQuery?gameId=${WANMEI_KF_GAME_ID}`;
const WANMEI_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const MOBILE_RE = /^1\d{10}$/;
const CODE_RE = /^\d{4,8}$/;

function readConfig(env) {
  return {
    sharedSecret: env.SHARED_SECRET || "",
    laohuAppId: LAOHU_APP_ID,
    laohuAppKey: LAOHU_APP_KEY,
    sessionTtlS: parseInt(env.SESSION_TTL_S || "600", 10),
    sigTtlS: parseInt(env.SIG_TTL_S || "300", 10),
  };
}

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

  let binary = "";
  for (let i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]);
  return btoa(binary);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function rsaOaepEncrypt(publicKey, value) {
  const encoded = publicKey
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSA-OAEP", hash: "SHA-1" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64(new Uint8Array(encrypted));
}

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

function newDevice() {
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

// EdgeOne 不同时期文档对 KV 暴露位置说法不一；这里两条路径都试
function resolveKv(context) {
  try { if (typeof nte_kv !== "undefined") return nte_kv; } catch {}
  if (context?.env?.nte_kv) return context.env.nte_kv;
  if (typeof globalThis !== "undefined" && globalThis.nte_kv) return globalThis.nte_kv;
  return null;
}

function sessionKey(auth) {
  return `sess:${auth}`;
}

async function getSession(kv, auth) {
  const raw = await kv.get(sessionKey(auth), "json");
  if (!raw) return null;
  if (typeof raw.expires_at !== "number" || raw.expires_at <= Date.now()) {
    await kv.delete(sessionKey(auth)).catch(() => {});
    return null;
  }
  return raw;
}

async function putSession(kv, session) {
  await kv.put(sessionKey(session.auth), JSON.stringify(session));
}

async function dropSession(kv, auth) {
  await kv.delete(sessionKey(auth)).catch(() => {});
}

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
  if (resp.status >= 400) throw new Error(`[${path}] HTTP ${resp.status}`);
  if (!text) throw new Error(`[${path}] 响应为空`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return text;
  }
  const code = payload?.code;
  if (code !== 0 && code !== "0") throw new Error(`[${path}] ${payload?.message || ""}`);
  return payload?.result ?? {};
}

async function laohuSendSms(cellphone, cfg, device) {
  const params = laohuCommonFields(cfg, device, false);
  params.cellphone = cellphone;
  params.areaCodeId = "1";
  params.type = "16";
  await laohuSubmit("/m/newApi/sendPhoneCaptchaWithOutLogin", params, cfg);
}

async function laohuLoginBySms(cellphone, code, cfg, device) {
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
  if (userIdRaw == null || tokenRaw == null) throw new Error("老虎登录返回缺少 userId/token");
  const token = String(tokenRaw);
  if (!token) throw new Error("老虎登录返回 token 为空");
  const userId = parseInt(userIdRaw, 10);
  if (!Number.isFinite(userId) || userId <= 0) throw new Error("老虎登录返回 userId 无效");
  return { user_id: userId, token };
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function updateCookies(cookies, headers) {
  for (const header of headers.getSetCookie()) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookies[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
}

async function wanmeiRequest(
  wanmei,
  baseUrl,
  path,
  { method = "GET", query, form, headers: extraHeaders = {} } = {},
) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  }
  const headers = {
    "User-Agent": WANMEI_USER_AGENT,
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    ...extraHeaders,
  };
  const cookies = cookieHeader(wanmei.cookies);
  if (cookies !== "") headers.Cookie = cookies;
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";

  const response = await fetch(url, {
    method,
    headers,
    body: form ? formUrlEncode(form) : undefined,
    redirect: "manual",
  });
  updateCookies(wanmei.cookies, response.headers);
  if (response.status >= 400) throw new Error(`[${path}] HTTP ${response.status}`);
  return response;
}

async function wanmeiJsonForm(wanmei, path, form) {
  const response = await wanmeiRequest(wanmei, WANMEI_ID_BASE_URL, path, {
    method: "POST",
    form,
  });
  const data = await response.json();
  if (data?.code !== 0) {
    const message =
      typeof data?.message === "string" && data.message !== ""
        ? data.message
        : `[${path}] 请求失败`;
    throw new Error(message);
  }
  return data;
}

async function newWanmeiState() {
  const wanmei = {
    public_key: "",
    jsession_id: "",
    area_codes: [],
    cookies: {},
    roles: null,
    logon: null,
  };
  const loginResponse = await wanmeiRequest(wanmei, WANMEI_ID_BASE_URL, "/login", {
    query: { location: WANMEI_LOGIN_RETURN_URL },
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  const html = await loginResponse.text();
  const publicKey = html.match(/id="publicKey"[^>]*value="([^"]+)"/);
  const jsessionId = html.match(/id="jsessionId"[^>]*value="([^"]+)"/);
  if (!publicKey || !jsessionId) throw new Error("完美世界登录页格式错误");

  const areaCodes = await wanmeiJsonForm(wanmei, "/areaCode/list", {});
  if (!Array.isArray(areaCodes.result)) throw new Error("完美世界区号列表格式错误");
  wanmei.public_key = publicKey[1];
  wanmei.jsession_id = jsessionId[1];
  wanmei.area_codes = areaCodes.result;
  return wanmei;
}

async function refreshWanmeiCapTicket(wanmei) {
  const data = await wanmeiJsonForm(wanmei, "/user/security/getCapTicket", {
    t: String(Date.now()),
  });
  if (typeof data.result !== "string") throw new Error("完美世界验证码票据格式错误");
  return data.result;
}

async function wanmeiSendSms(wanmei, payload) {
  await wanmeiJsonForm(wanmei, "/checkPhoneWithNationAreaId", {
    nationAreaId: String(payload.areaCodeId),
    phoneNumber: payload.phone,
  });
  await wanmeiJsonForm(wanmei, "/sendPhoneCaptchaForSlidCaptcha", {
    nationAreaId: String(payload.areaCodeId),
    phone: payload.phone,
    capTicket: payload.capTicket,
    secCode: payload.secCode,
  });
}

async function wanmeiLoginBySms(wanmei, payload) {
  const deviceId = new Uint8Array(8);
  crypto.getRandomValues(deviceId);
  await wanmeiJsonForm(wanmei, "/setDeviceInfo", {
    jsessionId: wanmei.jsession_id,
    deviceId: `NTEUID-${Array.from(deviceId, (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
    deviceModel: "NTEUID Web Login",
    deviceSys: "Web",
  });
  await wanmeiJsonForm(wanmei, "/checkPhoneCaptcha", {
    phone: payload.phone,
    phoneCaptcha: payload.smsCode,
  });
  await wanmeiJsonForm(wanmei, "/shortMessageLogon", {
    phoneNumber: await rsaOaepEncrypt(wanmei.public_key, payload.phone),
    newCaptcha: await rsaOaepEncrypt(wanmei.public_key, payload.smsCode),
    nationAreaId: String(payload.areaCodeId),
    capTicket: payload.capTicket,
    secCode: payload.secCode,
    location: WANMEI_LOGIN_RETURN_URL,
    state: wanmei.jsession_id,
  });
  const logon = wanmei.cookies.logon;
  if (typeof logon !== "string" || logon === "") {
    throw new Error("完美世界短信登录响应缺少 logon Cookie");
  }

  const response = await wanmeiRequest(
    wanmei,
    WANMEI_KF_BASE_URL,
    "/laohuSelfService/searchActiveGameRoles",
    {
      query: { gameId: WANMEI_KF_GAME_ID },
      headers: { Referer: WANMEI_LOGIN_RETURN_URL },
    },
  );
  const roles = await response.json();
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error("完美世界客服未返回异环角色");
  }
  wanmei.roles = roles;
  wanmei.logon = logon;
  return roles;
}

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function ttlLabel(ttlS) {
  if (ttlS >= 60 && ttlS % 60 === 0) return `${ttlS / 60} 分钟内有效`;
  return `${ttlS} 秒内有效`;
}

function renderLogin(auth, userId, ttlS, done = false) {
  return LOGIN_HTML
    .replaceAll("__AUTH__", JSON.stringify(auth).replaceAll("<", "\\u003c"))
    .replaceAll("__USER_ID__", htmlEscape(userId))
    .replaceAll("__TTL_LABEL__", htmlEscape(ttlLabel(ttlS)))
    .replaceAll("__LOGIN_HIDDEN__", done ? "hidden" : "")
    .replaceAll("__DONE_HIDDEN__", done ? "" : "hidden");
}

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

async function requestPayload(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleStart(request, cfg, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);

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

  const existing = await getSession(kv, payload.auth);
  if (existing) {
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
    wanmei: null,
    expires_at: Date.now() + cfg.sessionTtlS * 1000,
  };
  await putSession(kv, session);
  return jsonResponse({ auth: payload.auth, expires_in_s: cfg.sessionTtlS });
}

async function handleSendSms(request, cfg, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);

  if (!MOBILE_RE.test(payload?.mobile || "")) {
    return jsonResponse({ ok: false, msg: "手机号格式错误" }, 400);
  }
  const session = await getSession(kv, payload?.auth || "");
  if (!session) return jsonResponse({ detail: "session_expired" }, 404);

  try {
    await laohuSendSms(payload.mobile, cfg, session.device);
  } catch {
    return jsonResponse({ ok: false, msg: "验证码发送失败，请稍后再试" }, 400);
  }
  return jsonResponse({ ok: true, msg: "验证码已发送" });
}

async function handleLogin(request, cfg, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);

  if (!MOBILE_RE.test(payload?.mobile || "")) {
    return jsonResponse({ ok: false, msg: "手机号格式错误" }, 400);
  }
  if (!CODE_RE.test(payload?.code || "")) {
    return jsonResponse({ ok: false, msg: "验证码格式错误" }, 400);
  }
  const session = await getSession(kv, payload?.auth || "");
  if (!session) return jsonResponse({ detail: "session_expired" }, 404);
  if (session.status === "success") {
    return jsonResponse({ detail: "already_finished" }, 409);
  }

  let account;
  try {
    account = await laohuLoginBySms(payload.mobile, payload.code, cfg, session.device);
  } catch {
    return jsonResponse({ ok: false, msg: "验证码错误或已过期，请重新获取" }, 400);
  }

  session.status = "success";
  session.msg = "登录成功";
  session.credential = {
    kind: "tajiduo",
    laohu_token: account.token,
    laohu_user_id: String(account.user_id),
  };
  await putSession(kv, session);
  return jsonResponse({ ok: true, msg: "登录成功" });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "完美世界登录失败";
}

function validWanmeiSmsPayload(payload, withSmsCode = false) {
  if (!Number.isInteger(payload?.areaCodeId)) return false;
  if (typeof payload?.phone !== "string" || payload.phone === "") return false;
  if (typeof payload?.capTicket !== "string" || payload.capTicket === "") return false;
  if (typeof payload?.secCode !== "string" || payload.secCode === "") return false;
  return !withSmsCode || (typeof payload?.smsCode === "string" && payload.smsCode !== "");
}

async function handleWanmeiPrepare(request, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);
  if (typeof payload?.auth !== "string") return jsonResponse({ detail: "bad_request" }, 400);
  const session = await getSession(kv, payload.auth);
  if (!session) return jsonResponse({ ok: false, message: "完美登录链接已失效" }, 400);

  try {
    if (!session.wanmei) session.wanmei = await newWanmeiState();
    const capTicket = await refreshWanmeiCapTicket(session.wanmei);
    await putSession(kv, session);
    return jsonResponse({
      ok: true,
      areaCodes: session.wanmei.area_codes,
      capTicket,
    });
  } catch (error) {
    return jsonResponse({ ok: false, message: errorMessage(error) }, 400);
  }
}

async function handleWanmeiSendSms(request, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);
  if (typeof payload?.auth !== "string" || !validWanmeiSmsPayload(payload)) {
    return jsonResponse({ detail: "bad_request" }, 400);
  }
  const session = await getSession(kv, payload.auth);
  if (!session?.wanmei) return jsonResponse({ ok: false, message: "完美登录链接已失效" }, 400);

  try {
    await wanmeiSendSms(session.wanmei, payload);
    await putSession(kv, session);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, message: errorMessage(error) }, 400);
  }
}

async function handleWanmeiLogin(request, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);
  if (typeof payload?.auth !== "string" || !validWanmeiSmsPayload(payload, true)) {
    return jsonResponse({ detail: "bad_request" }, 400);
  }
  const session = await getSession(kv, payload.auth);
  if (!session?.wanmei) return jsonResponse({ ok: false, message: "完美登录链接已失效" }, 400);

  try {
    const roles = await wanmeiLoginBySms(session.wanmei, payload);
    if (roles.length === 1) finishWanmeiLogin(session, roles[0]);
    await putSession(kv, session);
    return jsonResponse({ ok: true, roles });
  } catch (error) {
    return jsonResponse({ ok: false, message: errorMessage(error) }, 400);
  }
}

function finishWanmeiLogin(session, role) {
  if (typeof role?.roleId !== "string" || typeof role?.roleName !== "string") {
    throw new Error("完美世界角色格式错误");
  }
  const logon = session.wanmei?.logon;
  if (typeof logon !== "string" || logon === "") {
    throw new Error("完美世界登录凭据已失效");
  }
  session.status = "success";
  session.msg = "登录成功";
  session.credential = {
    kind: "wanmei",
    logon,
    role_id: role.roleId,
    role_name: role.roleName,
  };
  session.wanmei = null;
}

async function handleWanmeiSelectRole(request, kv) {
  const payload = await requestPayload(request);
  if (payload === null) return jsonResponse({ detail: "bad_request" }, 400);
  if (typeof payload?.auth !== "string") return jsonResponse({ detail: "bad_request" }, 400);
  const session = await getSession(kv, payload.auth);
  const roles = session?.wanmei?.roles;
  if (!session || !Array.isArray(roles) || typeof payload?.roleId !== "string") {
    return jsonResponse({ ok: false, message: "完美登录角色列表已失效" }, 400);
  }
  const role = roles.find((item) => item.roleId === payload.roleId);
  if (!role) return jsonResponse({ ok: false, message: "所选角色不在本次登录结果中" }, 400);

  try {
    finishWanmeiLogin(session, role);
    await putSession(kv, session);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, message: errorMessage(error) }, 400);
  }
}

async function handleStatus(auth, urlParams, cfg, kv) {
  const ts = parseInt(urlParams.get("ts") || "0", 10);
  const sig = urlParams.get("sig") || "";
  if (!(await verifyListen(auth, ts, sig, cfg))) {
    return jsonResponse({ detail: "bad_signature" }, 401);
  }

  const session = await getSession(kv, auth);
  if (!session) return jsonResponse({ status: "expired", msg: "", credential: null });

  const snap = { status: session.status, msg: session.msg, credential: session.credential };
  if (snap.status === "success" || snap.status === "failed") {
    // 终态被拿走后立刻丢弃，凭据是一次性的
    await dropSession(kv, auth);
  }
  return jsonResponse(snap);
}

async function handleLoginPage(auth, cfg, kv) {
  const session = await getSession(kv, auth);
  if (!session) return htmlResponse(NOT_FOUND_HTML, 404);
  return htmlResponse(renderLogin(auth, session.user_id, cfg.sessionTtlS, session.status === "success"));
}

export async function onRequest(context) {
  const cfg = readConfig(context.env);
  const kv = resolveKv(context);

  if (!kv) {
    let globalHasIt = false;
    try { globalHasIt = typeof nte_kv !== "undefined"; } catch {}
    return jsonResponse({
      detail: "kv_not_bound",
      hint: "在 EdgeOne 控制台 KV Storage 创建 namespace 并绑定到本项目，变量名设为 nte_kv（绑定后需要重新部署一次让新绑定生效）",
      debug: {
        globalHasIt,
        envKeys: Object.keys(context?.env || {}),
        globalThisHasIt: typeof globalThis?.nte_kv !== "undefined",
      },
    }, 500);
  }

  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method;
  const req = context.request;

  if (method === "POST" && path === "/nte/start") return handleStart(req, cfg, kv);
  if (method === "POST" && path === "/nte/sendSmsCode") return handleSendSms(req, cfg, kv);
  if (method === "POST" && path === "/nte/login") return handleLogin(req, cfg, kv);
  if (method === "POST" && path === "/nte/wanmei/prepare") return handleWanmeiPrepare(req, kv);
  if (method === "POST" && path === "/nte/wanmei/sendSmsCode") return handleWanmeiSendSms(req, kv);
  if (method === "POST" && path === "/nte/wanmei/login") return handleWanmeiLogin(req, kv);
  if (method === "POST" && path === "/nte/wanmei/selectRole") return handleWanmeiSelectRole(req, kv);
  if (method === "GET" && path === "/nte/done") return htmlResponse(renderLogin("", "", cfg.sessionTtlS, true));

  let m = path.match(/^\/nte\/i\/([^/]+)$/);
  if (method === "GET" && m) return handleLoginPage(decodeURIComponent(m[1]), cfg, kv);

  m = path.match(/^\/nte\/status\/([^/]+)$/);
  if (method === "GET" && m) return handleStatus(decodeURIComponent(m[1]), url.searchParams, cfg, kv);

  return new Response("Not Found", { status: 404 });
}

const LOGIN_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>异环 · 登录</title>
    <script src="https://cstatic.games.wanmei.com/captchas/ai/js/wanmeiCaptcha.min.js"></script>
    <style>
      :root {
        color-scheme: dark;
        --text: rgba(255,255,255,.96);
        --dim: rgba(255,255,255,.68);
        --mute: rgba(255,255,255,.42);
        --edge: rgba(255,255,255,.18);
        --field: rgba(255,255,255,.08);
        --accent: #d6c2ff;
        --good: #86e5a2;
        --bad: #ff9aa8;
        --sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body { margin: 0; min-height: 100%; }
      body { background: #050507; color: var(--text); font-family: var(--sans); }
      .stage { position: fixed; inset: 0; z-index: -1; overflow: hidden; }
      .stage video { width: 100%; height: 100%; object-fit: cover; filter: brightness(.48) saturate(1.08); }
      main { min-height: 100vh; display: grid; place-items: center; padding: 28px 18px; }
      .card {
        width: min(420px, 100%); padding: 26px; border: 1px solid var(--edge); border-radius: 24px;
        background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.06));
        backdrop-filter: blur(18px) saturate(145%); box-shadow: 0 18px 58px rgba(0,0,0,.4);
      }
      .brand { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
      .brand img { width: 58px; height: 58px; border: 1px solid var(--edge); border-radius: 50%; object-fit: cover; }
      h1 { margin: 0 0 5px; font-size: 26px; letter-spacing: .04em; }
      .brand p, .lead { margin: 0; color: var(--dim); font-size: 13px; line-height: 1.6; }
      .mode-switch {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px;
        margin-bottom: 22px; border: 1px solid var(--edge); border-radius: 13px; background: rgba(0,0,0,.18);
      }
      .mode-switch button {
        min-height: 0; padding: 10px 8px; border: 0; border-radius: 9px; color: var(--dim);
        background: transparent; font-size: 13px; font-weight: 650; text-align: center;
      }
      .mode-switch button[aria-selected="true"] { color: var(--text); background: rgba(255,255,255,.16); }
      .login-content[hidden], .login-panel[hidden], #wanmeiLoginPanel[hidden],
      #wanmeiRolePanel[hidden], .done[hidden] { display: none; }
      .lead { margin-bottom: 18px; }
      .field { margin-bottom: 14px; }
      label { display: block; margin: 0 0 7px 3px; color: var(--dim); font-size: 12px; }
      .row { display: grid; grid-template-columns: 122px minmax(0,1fr); gap: 9px; }
      .code-row { grid-template-columns: minmax(0,1fr) 112px; }
      input, select, button {
        width: 100%; min-height: 46px; padding: 0 14px; border: 1px solid var(--edge); border-radius: 13px;
        color: var(--text); background: var(--field); font: inherit;
      }
      select option { color: #111; }
      input:focus, select:focus { outline: 3px solid rgba(214,194,255,.14); border-color: rgba(214,194,255,.55); }
      button { cursor: pointer; font-weight: 650; }
      button:disabled { opacity: .42; cursor: not-allowed; }
      .send { color: var(--accent); white-space: nowrap; }
      .submit { margin-top: 4px; background: linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,.12)); }
      #captchaBox { display: flex; justify-content: center; min-height: 50px; margin: 2px 0 14px; }
      .role { margin-top: 9px; text-align: left; }
      .status { min-height: 20px; margin: 13px 0 0; text-align: center; font-size: 13px; }
      .status.ok { color: var(--good); }
      .status.fail { color: var(--bad); }
      .footer { margin: 18px 0 0; color: var(--mute); font-size: 11px; text-align: center; }
      .done { padding: 22px 0 8px; text-align: center; }
      .done-mark {
        display: grid; place-items: center; width: 72px; height: 72px; margin: 0 auto 20px;
        border: 1px solid rgba(134,229,162,.45); border-radius: 50%;
        color: var(--good); background: rgba(134,229,162,.18); font-size: 38px;
      }
      .done h1 { margin-bottom: 10px; }
      .done p { margin: 0; color: var(--dim); font-size: 14px; line-height: 1.7; }
      @media (max-width: 420px) {
        .card { padding: 23px 19px; }
        .row { grid-template-columns: 104px minmax(0,1fr); }
        .code-row { grid-template-columns: minmax(0,1fr) 105px; }
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <video autoplay muted loop playsinline poster="https://yh.wanmei.com/images/main260418/bg-video-poster.jpg"
             src="https://yhvmg.wmupd.com/webops/yh/yh_bgvideo_20260418.mp4"></video>
    </div>
    <main>
      <section class="card">
        <div id="loginContent" class="login-content" __LOGIN_HIDDEN__>
        <header class="brand">
          <img src="https://s1.imagehub.cc/images/2026/04/22/f00a93d8c1a5958ea22e6a0d185d9453.md.png" alt="NTE" />
          <div><h1>NTEUID</h1><p>异环账号登录</p></div>
        </header>
        <nav class="mode-switch" aria-label="登录方式">
          <button id="tajiduoTab" type="button" data-mode="tajiduo" role="tab"
                  aria-controls="tajiduoPanel">塔吉多登录</button>
          <button id="wanmeiTab" type="button" data-mode="wanmei" role="tab"
                  aria-controls="wanmeiPanel">完美登录</button>
        </nav>

        <section id="tajiduoPanel" class="login-panel" role="tabpanel">
          <p class="lead">登录塔吉多账号，用于角色、签到和游戏数据功能。</p>
          <form onsubmit="return false">
            <div class="field">
              <label for="tajiduoMobile">手机号</label>
              <input id="tajiduoMobile" type="tel" inputmode="numeric" maxlength="11"
                     placeholder="请输入 11 位手机号" autocomplete="tel" />
            </div>
            <div class="field">
              <label for="tajiduoCode">短信验证码</label>
              <div class="row code-row">
                <input id="tajiduoCode" type="text" inputmode="numeric" maxlength="8"
                       placeholder="请输入验证码" autocomplete="one-time-code" />
                <button id="tajiduoSendBtn" class="send" type="button" disabled>获取验证码</button>
              </div>
            </div>
            <button id="tajiduoLoginBtn" class="submit" type="submit" disabled>完成塔吉多登录</button>
          </form>
        </section>

        <section id="wanmeiPanel" class="login-panel" role="tabpanel">
          <p class="lead">登录完美世界账号，可查询刮刮乐数据，不影响塔吉多登录。</p>
          <div id="wanmeiLoginPanel">
            <div class="field">
              <label for="wanmeiPhone">手机号</label>
              <div class="row">
                <select id="wanmeiAreaCode" aria-label="国家或地区区号"></select>
                <input id="wanmeiPhone" type="tel" inputmode="numeric"
                       placeholder="请输入手机号" autocomplete="tel" />
              </div>
            </div>
            <div id="captchaBox"></div>
            <div class="field">
              <label for="wanmeiSmsCode">短信验证码</label>
              <div class="row code-row">
                <input id="wanmeiSmsCode" type="text" inputmode="numeric"
                       placeholder="请输入验证码" autocomplete="one-time-code" />
                <button id="wanmeiSendBtn" class="send" type="button">获取验证码</button>
              </div>
            </div>
            <button id="wanmeiLoginBtn" class="submit" type="button">登录</button>
          </div>
          <div id="wanmeiRolePanel" hidden>
            <p class="lead">请选择用于查询刮刮乐数据的异环角色。</p>
            <div id="wanmeiRoles"></div>
          </div>
        </section>

        <p id="status" class="status"></p>
        <p class="footer">会话 __USER_ID__ · __TTL_LABEL__</p>
        </div>
        <div id="donePanel" class="done" __DONE_HIDDEN__>
          <div class="done-mark">✓</div>
          <h1>登录完成</h1>
          <p>登录结果已提交到 NTEUID，可以关闭页面回到聊天。</p>
        </div>
      </section>
    </main>

    <script>
      const AUTH = __AUTH__;

      function showStatus(message, ok) {
        const status = document.getElementById("status");
        status.textContent = message;
        status.className = \`status \${ok ? "ok" : "fail"}\`;
      }

      function finishLogin() {
        document.getElementById("loginContent").hidden = true;
        document.getElementById("donePanel").hidden = false;
      }

      function keepDigits(input, maxLength) {
        input.addEventListener("input", () => {
          input.value = input.value.replace(/\\D/g, "").slice(0, maxLength);
        });
      }

      const tajiduoMobile = document.getElementById("tajiduoMobile");
      const tajiduoCode = document.getElementById("tajiduoCode");
      const tajiduoSendBtn = document.getElementById("tajiduoSendBtn");
      const tajiduoLoginBtn = document.getElementById("tajiduoLoginBtn");

      function validateTajiduoForm() {
        const phoneOk = /^1\\d{10}$/.test(tajiduoMobile.value);
        tajiduoSendBtn.disabled = !phoneOk || tajiduoSendBtn.dataset.cooldown === "1";
        tajiduoLoginBtn.disabled = !(phoneOk && /^\\d{4,8}$/.test(tajiduoCode.value));
      }

      keepDigits(tajiduoMobile, 11);
      keepDigits(tajiduoCode, 8);
      tajiduoMobile.addEventListener("input", validateTajiduoForm);
      tajiduoCode.addEventListener("input", validateTajiduoForm);

      tajiduoSendBtn.addEventListener("click", async () => {
        const response = await fetch("/nte/sendSmsCode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth: AUTH, mobile: tajiduoMobile.value.trim() }),
        });
        const reply = await response.json();
        showStatus(reply.msg, reply.ok);
        if (!reply.ok) return;

        tajiduoSendBtn.dataset.cooldown = "1";
        validateTajiduoForm();
        let remain = 60;
        const timer = setInterval(() => {
          tajiduoSendBtn.textContent = \`\${remain}s\`;
          remain -= 1;
          if (remain < 0) {
            clearInterval(timer);
            tajiduoSendBtn.textContent = "获取验证码";
            tajiduoSendBtn.dataset.cooldown = "0";
            validateTajiduoForm();
          }
        }, 1000);
      });

      tajiduoLoginBtn.addEventListener("click", async () => {
        tajiduoLoginBtn.disabled = true;
        tajiduoLoginBtn.textContent = "登录中";
        const response = await fetch("/nte/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth: AUTH,
            mobile: tajiduoMobile.value.trim(),
            code: tajiduoCode.value.trim(),
          }),
        });
        const reply = await response.json();
        if (reply.ok) {
          finishLogin();
          return;
        }
        tajiduoLoginBtn.textContent = "完成塔吉多登录";
        validateTajiduoForm();
        showStatus(reply.msg, false);
      });

      let wanmeiReady = false;
      let wanmeiCaptcha = null;
      let wanmeiCapTicket = "";

      function initWanmeiCaptcha() {
        wanmeiCaptcha = new WanmeiCaptcha({ containerId: "captchaBox" });
        wanmeiCaptcha.init({
          appId: "20047",
          capTicket: wanmeiCapTicket,
          bindBtn: "",
          onRefresh: resetCaptcha,
          initCallback: (failed) => {
            if (failed) showStatus("智能验证加载失败，请刷新页面", false);
          },
        });
      }

      function getCaptchaCode() {
        if (wanmeiCaptcha === null) {
          showStatus("请先完成官方智能验证", false);
          return "";
        }
        const code = wanmeiCaptcha.getValidateResult();
        if (!code) showStatus("请先完成官方智能验证", false);
        return code;
      }

      async function resetCaptcha() {
        const response = await fetch("/nte/wanmei/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth: AUTH }),
        });
        const reply = await response.json();
        if (!reply.ok) {
          showStatus(reply.message, false);
          return;
        }
        wanmeiCapTicket = reply.capTicket;
        document.getElementById("captchaBox").replaceChildren();
        initWanmeiCaptcha();
      }

      function showWanmeiRoles(roles) {
        document.getElementById("wanmeiLoginPanel").hidden = true;
        document.getElementById("wanmeiRolePanel").hidden = false;
        const holder = document.getElementById("wanmeiRoles");
        holder.replaceChildren();
        for (const role of roles) {
          const button = document.createElement("button");
          button.className = "role";
          button.textContent = \`\${role.roleName}（\${role.roleId}）\`;
          button.addEventListener("click", async () => {
            button.disabled = true;
            const response = await fetch("/nte/wanmei/selectRole", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ auth: AUTH, roleId: role.roleId }),
            });
            const reply = await response.json();
            if (reply.ok) {
              finishLogin();
              return;
            }
            button.disabled = false;
            showStatus(reply.message, false);
          });
          holder.appendChild(button);
        }
      }

      async function prepareWanmei() {
        if (wanmeiReady) return;

        const response = await fetch("/nte/wanmei/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth: AUTH }),
        });
        const reply = await response.json();
        if (!reply.ok) {
          showStatus(reply.message, false);
          return;
        }
        wanmeiReady = true;
        const areaCode = document.getElementById("wanmeiAreaCode");
        areaCode.replaceChildren();
        for (const item of reply.areaCodes) {
          const option = document.createElement("option");
          option.value = item.areaCodeId;
          option.textContent = \`\${item.areaName} +\${item.areaCode}\`;
          option.selected = item.areaCodeId === 1;
          areaCode.appendChild(option);
        }
        wanmeiCapTicket = reply.capTicket;
        initWanmeiCaptcha();
      }

      const wanmeiPhone = document.getElementById("wanmeiPhone");
      const wanmeiSmsCode = document.getElementById("wanmeiSmsCode");
      const wanmeiSendBtn = document.getElementById("wanmeiSendBtn");
      const wanmeiLoginBtn = document.getElementById("wanmeiLoginBtn");

      wanmeiSendBtn.addEventListener("click", async () => {
        const phone = wanmeiPhone.value.trim();
        const secCode = getCaptchaCode();
        if (!secCode) return;

        wanmeiSendBtn.disabled = true;
        const response = await fetch("/nte/wanmei/sendSmsCode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth: AUTH,
            areaCodeId: Number(document.getElementById("wanmeiAreaCode").value),
            phone,
            capTicket: wanmeiCapTicket,
            secCode,
          }),
        });
        const reply = await response.json();
        showStatus(reply.ok ? "短信验证码已发送" : reply.message, reply.ok);
        if (!reply.ok) {
          wanmeiSendBtn.disabled = false;
          await resetCaptcha();
          return;
        }

        let remain = 60;
        const timer = setInterval(() => {
          wanmeiSendBtn.textContent = \`\${remain}s\`;
          remain -= 1;
          if (remain < 0) {
            clearInterval(timer);
            wanmeiSendBtn.textContent = "获取验证码";
            wanmeiSendBtn.disabled = false;
          }
        }, 1000);
      });

      wanmeiLoginBtn.addEventListener("click", async () => {
        const phone = wanmeiPhone.value.trim();
        const smsCode = wanmeiSmsCode.value.trim();
        const secCode = getCaptchaCode();
        if (!secCode) return;

        wanmeiLoginBtn.disabled = true;
        wanmeiLoginBtn.textContent = "登录中";
        const response = await fetch("/nte/wanmei/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth: AUTH,
            areaCodeId: Number(document.getElementById("wanmeiAreaCode").value),
            phone,
            smsCode,
            capTicket: wanmeiCapTicket,
            secCode,
          }),
        });
        const reply = await response.json();
        if (reply.ok && reply.roles.length > 1) {
          showWanmeiRoles(reply.roles);
          return;
        }
        if (reply.ok) {
          finishLogin();
          return;
        }
        wanmeiLoginBtn.disabled = false;
        wanmeiLoginBtn.textContent = "登录";
        showStatus(reply.message, false);
        await resetCaptcha();
      });

      function switchMode(mode) {
        const showTajiduo = mode === "tajiduo";
        document.getElementById("tajiduoPanel").hidden = !showTajiduo;
        document.getElementById("tajiduoTab").setAttribute("aria-selected", String(showTajiduo));
        document.getElementById("wanmeiPanel").hidden = showTajiduo;
        document.getElementById("wanmeiTab").setAttribute("aria-selected", String(!showTajiduo));
        if (!showTajiduo) prepareWanmei();
      }

      for (const button of document.querySelectorAll("[data-mode]")) {
        button.addEventListener("click", () => switchMode(button.dataset.mode));
      }
      if (!document.getElementById("loginContent").hidden) {
        validateTajiduoForm();
        switchMode(new URLSearchParams(window.location.search).get("mode") === "wanmei" ? "wanmei" : "tajiduo");
      }
    </script>
  </body>
</html>

`;
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
