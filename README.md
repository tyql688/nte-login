# nte-login

NTEUID 外置登录服务。把原本嵌在 NTEUID 插件进程内的「登录页 + 老虎短信登录」剥离成独立 FastAPI 服务，让 bot 端无需对外暴露端口也能完成登录流程。

## 协议

会话生命周期：

1. NTEUID 收到 `nte登录` 命令 → 用 `sha256(user_id)[:8]` 算 `auth_token`
2. NTEUID `POST /nte/start`（双方都配 `SHARED_SECRET` 时带 HMAC 签名）→ 服务端建会话，返回 `page_url`
3. NTEUID 把链接发给用户，并按配置选 transport 监听结果：
   - `http_poll`：每 2s 轮询 `GET /nte/status/{auth}`
   - `sse`：建立 `GET /nte/events/{auth}` 长连接
   - `ws`：建立 `WS /nte/ws/{auth}` 长连接
4. 用户在 `/nte/i/{auth}` 网页填手机号 + 验证码 → 服务端跑老虎短信登录 → 拿到 `(laohu_token, laohu_user_id)`
5. 服务端把结果推给 transport listener
6. NTEUID 收到回执后调用现有 `login_by_laohu_token()` 完成塔吉多登录 + 落库

外置服务**不接触数据库**，只负责老虎短信登录这一步。塔吉多 user_center_login + 角色拉取 + DB 写入仍归 NTEUID。

## 配置

通过环境变量 / `.env`（见 `.env.example`）：

| 变量 | 默认 | 必填 | 说明 |
| ---- | ---- | :--: | ---- |
| `HOST` | `0.0.0.0` |  | 监听地址，一般不用动 |
| `PORT` | `7861` |  | 监听端口 |
| `LOG_LEVEL` | `INFO` |  | 日志级别（`DEBUG` 排障可看请求体） |
| `SHARED_SECRET` | 空 |  | 与 NTEUID 后台 `NTELoginSecret` 一致；**留空则不校验签名**，启动时会有 warning。内网/同机部署可不填，公网直暴端口时建议填 |
| `SESSION_TTL_S` | `600` |  | 单个登录会话存活秒数 |
| `SIG_TTL_S` | `300` |  | HMAC 签名容忍时差秒数（防重放窗口）；只在启用了 `SHARED_SECRET` 时生效 |

> **没有任何字段是强制的**。完全裸跑（不配任何 env）也能在 `127.0.0.1:7861` 跑起来供本机/内网用。
>
> 登录页对外 URL **不在本服务配**，由 NTEUID 后台的 `NTELoginUrl` 单方面决定（NTEUID 自己拼 `{NTELoginUrl}/nte/i/{auth}` 发给用户）。本服务只关心被请求即可。

## 启动

```sh
uv sync
uv run start
```

或 Docker：

```sh
docker build -t nte-login .

# 最简：本机/内网，啥也不配
docker run -d -p 7861:7861 --name nte-login nte-login

# 生产：启用签名
docker run -d -p 7861:7861 \
  -e SHARED_SECRET=$(openssl rand -hex 32) \
  --name nte-login nte-login
```

## NTEUID 后台对应配置

| 字段 | 取值 | 说明 |
| ---- | ---- | ---- |
| `NTELoginTransport` | `http_poll` / `sse` / `ws` | 留空 = 走 Core 内嵌登录，不调用本服务 |
| `NTELoginUrl` | 本服务对外可达的根地址，例 `https://login.example.com` | 启用外置时必填；既用于 NTEUID 调本服务，也用于拼用户登录页 URL |
| `NTELoginSecret` | 同 `SHARED_SECRET`，可留空 | 留空时本服务的 `SHARED_SECRET` 也得留空，否则 401 |
