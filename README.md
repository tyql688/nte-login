# nte-login（EdgeOne Pages 版）

NTEUID 外置登录服务，跑在 EdgeOne Pages Edge Functions 上。Python 自部署版本在 `main` 分支。

## 一次性配置

### 1. Git 导入

控制台 → "从 Git 仓库导入" → 选这个仓库 → **生产分支选 `edgeone`**（不是 main） → 构建命令和输出目录都留空。

### 2. 绑 KV

- 左侧 "KV 存储" → "申请开通"（免费 1 GB） → "创建命名空间"，名字填 `nte_kv`
- 项目 → 左侧 "KV 存储" → "绑定命名空间"
  - 命名空间选 `nte_kv`
  - **变量名填 `nte_kv`**（严格对齐代码里的全局变量）

### 3. 加环境变量

项目 → "项目设置" → "环境变量" → 加 `SHARED_SECRET`（和 NTEUID 后台 `NTELoginSecret` 一致）。

可选：`SESSION_TTL_S`（默认 600）、`SIG_TTL_S`（默认 300）。

### 4. 绑稳定域名 ⚠️ 必做

`*.edgeone.cool` 是临时预览 URL —— 每次部署变 hash，分享出去常 401。**给 NTEUID 配的必须是自己的域名**。

1. 项目 → "域名管理" → "添加自定义域名" → 填**已备案**的二级域名
2. 按提示去自己 DNS 加 CNAME，等 EdgeOne 探测到
3. **HTTPS 配置 → "配置"** → 选 "免费证书"（Let's Encrypt 类） → 等下发
4. 域名状态、CNAME、HTTPS 三列全变 **"已生效"** 才算好
5. NTEUID 后台 `NTELoginUrl` 填 `https://你的域名`，不要再用 `*.edgeone.cool`

### 5. 触发首次部署

push 到 edgeone 分支自动构建，约 30 秒上线。

```sh
git push origin edgeone
```

## NTEUID 后台对应

| 字段 | 值 |
| --- | --- |
| `NTELoginTransport` | `http_poll`（不支持 WS/SSE） |
| `NTELoginUrl` | 你绑定的域名 |
| `NTELoginSecret` | 同 `SHARED_SECRET` |

## 排坑

| 现象 | 原因 / 解决 |
| --- | --- |
| 接口返回 EdgeOne 401 HTML 页（不是 JSON） | 用了 `*.edgeone.cool` 预览 URL；换成自己的域名 |
| `{"detail":"kv_not_bound"}` | KV 没绑、变量名不是 `nte_kv`、或绑定后没重新部署 |
| `/nte/status` 长时间 `pending`，但用户已登录 | KV 跨边缘节点最终一致，最坏等 60s |
| 部署后接口 404 | 部署分支选错了（要 `edgeone` 不是 `main`） |

## 本地开发

```sh
npm i -g edgeone@latest
edgeone login --site china
edgeone pages link        # 让本地能访问线上 KV
edgeone pages dev         # http://localhost:8088
```

## 之后改代码

```sh
# 改 edge-functions/nte/[[default]].js
git commit -am "..." && git push
```

push 触发自动部署。要改老虎 `app_id` / `app_key` 也是改这个文件顶部的常量。
