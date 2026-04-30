# 部署到 EdgeOne Pages

`edgeone` 分支专用的部署说明。`main` 分支是 Python 自部署版本，部署方式见 `README.md`。

## 这版是什么

- 用 EdgeOne Pages **Edge Functions**（V8 / JS 运行时，跑在全球边缘节点）
- 状态存 EdgeOne **KV Storage**（每账号免费 1 GB）
- 单文件实现：`edge-functions/nte/[[default]].js`
- Python 项目（`ntelogin/`）仍在仓库里，但 EdgeOne 不会跑它

**与 Python 版的差异**：
- 没有 WebSocket（Edge Functions 不支持）
- 没有 SSE（serverless 跨实例做不到真推送）
- NTEUID 端只能走 HTTP 轮询 `/nte/status/{auth}`
- KV 跨边缘节点最终一致，最坏 60 秒（NTEUID 看到登录完成会有最多 60s 延迟）

## 一次性配置（首次部署前必做）

### 1. 推代码到 GitHub

```sh
git checkout edgeone
git push -u origin edgeone
```

### 2. EdgeOne 控制台导入仓库

打开 https://console.cloud.tencent.com/edgeone/pages

- "从 Git 仓库导入" → 授权 GitHub → 选 `<你的账号>/nte-login`
- **生产分支** → **`edgeone`**（不要选 main）
- **构建命令** → 留空
- **输出目录** → 留空
- 加速区域：China

### 3. 开通 KV Storage 并绑定

- 左侧 "KV Storage" → "申请开通"（免费 1 GB）
- "创建命名空间" → 名字填 **`nte_kv`**
- 项目设置 → "KV Storage" → "绑定命名空间"
  - 选刚创的 `nte_kv`
  - **变量名填 `nte_kv`** ← 严格匹配代码里的 `nte_kv` 全局变量

### 4. 配置环境变量

项目 → "设置" → "环境变量"：

| Key | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `SHARED_SECRET` | 必填 | — | 与 NTEUID 后台 `NTELoginSecret` 一致；不填则关签名校验（启动会 warn） |
| `SESSION_TTL_S` | 可选 | `600` | 会话存活秒数 |
| `SIG_TTL_S` | 可选 | `300` | HMAC 签名时差容忍秒数 |

老虎 `app_id` / `app_key` 是业务常量，已写死在 `edge-functions/nte/[[default]].js` 顶部（与 Python 版 `ntelogin/constants.py` 一致），要改去改源码再 push。

### 5. 触发首次部署

保存设置后 EdgeOne 会自动跑一次。也可以手动：

```sh
git commit --allow-empty -m "chore: 触发部署" && git push
```

成功后会得到 `https://<project>-<hash>.edgeone.cool?<query>` 预览 URL。**完整 URL 含 query 参数，分享时不要截断**，否则页面打不开。

## NTEUID 后台对应配置

| 字段 | 值 |
| --- | --- |
| `NTELoginTransport` | `http_poll`（不能用 `sse` / `ws`） |
| `NTELoginUrl` | 上一步拿到的 EdgeOne 部署 URL（含 query） |
| `NTELoginSecret` | 同 `SHARED_SECRET` |

## 之后每次部署

```sh
git checkout edgeone
# 改 edge-functions/nte/[[default]].js
git commit -am "..."
git push
```

Push 触发自动部署。约 30 秒上线。

## 本地开发

```sh
npm i -g edgeone@latest
edgeone -v                 # 必须 ≥ 1.2.30
edgeone login --site china
edgeone pages link         # 链接到远端项目（让本地能访问 KV）
edgeone pages dev          # 启动 http://localhost:8088
```

⚠️ `edgeone pages env pull` 会把环境变量写到本地 `.env`，会跟 Python 项目的 `.env` 冲突。要么备份后再 pull，要么直接复制控制台的环境变量到 `.env` 后停手不 pull。

## 常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| 访问 API 返回 `{"detail":"kv_not_bound"}` | KV namespace 没绑或变量名不是 `nte_kv` |
| `/nte/status` 长时间返回 `pending`，但用户已登录成功 | KV 跨边缘节点同步未完成（最多等 60s） |
| 预览 URL 国内访问 401 | 备案 / 加速策略限制。绑已备案自定义域名解决 |
| 部署后 `/nte/i/{auth}` 渲染了 HTML 但接口 404 | 部署分支选错（要选 `edgeone` 不是 `main`） |
| `whoami` 显示意外账号 | 浏览器 session 复用了别的腾讯云账号；从所有 console 退出后重登 |

## 限制速查

| 项 | 上限 |
| --- | --- |
| 单次代码包大小 | 5 MB |
| 单次请求 body | 1 MB |
| 单次 CPU 时间 | 200 ms |
| KV value 大小 | 25 MB |
| KV key 长度 | 512 字节 |
| KV 全球同步延迟 | ≤ 60 s |

## 文件位置参考

```
edge-functions/nte/[[default]].js   # 全部业务逻辑（MD5 / AES / HMAC / KV / 老虎 SDK / 6 个路由）
.gitignore                           # 排除 AI 助手目录
ntelogin/                            # Python 版本，EdgeOne 不会跑（保留以便切回 main 分支）
```
