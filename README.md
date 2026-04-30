# nte-login（EdgeOne Pages 版）

NTEUID 外置登录服务，部署在 EdgeOne Pages Edge Functions（V8 / JS）上，状态用 EdgeOne KV Storage。

> Python 自部署版本在 `main` 分支。

## 架构

- 单文件实现：`edge-functions/nte/[[default]].js`（MD5 / AES-128-ECB / HMAC-SHA256 / KV session / 老虎 SDK / 6 路由 dispatcher）
- 状态：KV namespace 绑定到全局变量 `nte_kv`，会话 TTL 由代码侧用 `expires_at` 字段控制
- 仅支持 HTTP 轮询（Edge Functions 不支持 WebSocket；SSE 在 serverless 跨实例做不到真推送）
- KV 全球同步最坏 60 秒；NTEUID 端轮询 `/nte/status/{auth}` 看到登录完成最大延迟 60 秒

## 一次性配置

### 1. 推到 GitHub

```sh
git checkout edgeone
git push -u origin edgeone
```

### 2. 控制台导入仓库

打开 https://console.cloud.tencent.com/edgeone/pages

- "从 Git 仓库导入" → 授权 GitHub → 选 `<你的账号>/nte-login`
- **生产分支** → **`edgeone`**（不要选 main）
- 构建命令、输出目录都留空
- 加速区域：China

### 3. 开通 KV 并绑定

**3a. 开通并创建命名空间**（全局，每个账号一次）

- 控制台主页 → 左侧 "KV 存储" → "申请开通"（免费 1 GB）
- "创建命名空间" → 名字填 `nte_kv`

**3b. 绑定到项目**

- 进入项目 → 左侧 "KV 存储" → 点 "绑定命名空间"
- **命名空间**：选刚创的 `nte_kv`
- **变量名称**：填 `nte_kv` ← 严格匹配代码里的全局变量

绑定成功后 "KV 命名空间管理" 页应该看到一行：

| 变量名称 | 命名空间 | 操作 |
| --- | --- | --- |
| `nte_kv` | `nte_kv` | 编辑 / 删除 |

### 4. 配置环境变量

项目 → "设置" → "环境变量"：

| Key | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `SHARED_SECRET` | 必填 | — | 与 NTEUID 后台 `NTELoginSecret` 一致；不填则关签名校验（启动会 warn） |
| `SESSION_TTL_S` | 可选 | `600` | 会话存活秒数 |
| `SIG_TTL_S` | 可选 | `300` | HMAC 签名时差容忍秒数 |

老虎 `app_id` / `app_key` 写死在 `edge-functions/nte/[[default]].js` 顶部，要改改源码再 push。

### 5. 触发首次部署

```sh
git commit --allow-empty -m "chore: 触发部署" && git push
```

成功后会得到 `https://<project>-<hash>.edgeone.cool?<query>` 预览 URL。**完整 URL 含 query 参数，分享时不要截断**。

## NTEUID 后台对应配置

| 字段 | 值 |
| --- | --- |
| `NTELoginTransport` | `http_poll` |
| `NTELoginUrl` | EdgeOne 部署 URL（含 query） |
| `NTELoginSecret` | 同 `SHARED_SECRET` |

## 之后每次部署

```sh
# 改 edge-functions/nte/[[default]].js
git commit -am "..."
git push
```

push 触发自动部署，约 30 秒上线。

## 本地开发

```sh
npm i -g edgeone@latest
edgeone -v                 # ≥ 1.2.30
edgeone login --site china
edgeone pages link         # 链接远端项目（让本地能访问 KV）
edgeone pages dev          # http://localhost:8088
```

## 常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| API 返回 `{"detail":"kv_not_bound"}` | KV namespace 没绑或变量名不是 `nte_kv` |
| `/nte/status` 长时间返 `pending` 但用户已登录 | KV 跨边缘节点同步未完成，最多 60s |
| 预览 URL 国内访问 401 | 备案 / 加速策略限制；绑已备案自定义域名 |
| 部署后接口 404 | 部署分支选错（要 `edgeone` 不是 `main`） |
| `whoami` 显示意外账号 | 浏览器 session 复用；从所有腾讯云 console 退出后重登 |

## 限制

| 项 | 上限 |
| --- | --- |
| 单次代码包大小 | 5 MB |
| 单次请求 body | 1 MB |
| 单次 CPU 时间 | 200 ms |
| KV value 大小 | 25 MB |
| KV key 长度 | 512 字节 |
| KV 全球同步延迟 | ≤ 60 s |
