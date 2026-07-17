# Moxt 平台部署指南

> NewAPI 在 Moxt 平台的部署方案与踩坑全记录。

---

## 与原始平台的差异

| 方面 | 原始平台 (Bloome/EdgeSpark) | Moxt |
|------|---------------------------|------|
| 部署方式 | EdgeSpark Functions（长期运行） | Moxt Cloud Sandbox（每次对话临时） |
| 上游地址 | `streambloomeim.com`（硬编码） | `moxt-llm-proxy-prod.onrender.com` |
| 上游 Key | `RESON_LLM_API_KEY`（自动注入） | `ANTHROPIC_API_KEY`（自动注入） |
| Key 生命周期 | 跟随 EdgeSpark 部署，长期有效 | 每次对话轮次生成，旧Key立即失效 |
| 文件持久化 | EdgeSpark 持久 | Sandbox 销毁后文件全部丢失 |
| 后台进程 | 支持 | ❌ 子进程会被清理 |
| 最大空闲时间 | 无限制 | ~30分钟（用户不互动则杀沙盒） |

---

## Moxt LLM Proxy 说明

Moxt 平台内置了一个 LLM 代理，通过环境变量自动注入到 Sandbox 中：

- **地址**: `https://moxt-llm-proxy-prod.onrender.com`
- **认证**: Virtual Key，格式 `sk-vk-{32位hex}`
- **注入方式**: Sandbox 环境变量 `ANTHROPIC_API_KEY`（也存在于 `ANTHROPIC_BASE_URL`）
- **生命周期**: 绑定当前对话 Pipeline，对话结束即失效

### 支持的协议与模型

#### Anthropic Messages 协议

- 端点: `/v1/messages`
- 认证头: `x-api-key: sk-vk-xxx`
- 额外头: `anthropic-version: 2023-06-01`

| 模型 | 状态 |
|------|------|
| `claude-opus-4-8` | ✅ |
| `claude-opus-4-7` | ✅ |
| `claude-sonnet-4-6` | ✅ |
| `claude-sonnet-5` | ✅ |
| `claude-fable-5` | ✅ |

#### OpenAI Chat Completions 协议

- 端点: `/v1/chat/completions`
- 认证头: `Authorization: Bearer sk-vk-xxx`

| 模型 | 状态 |
|------|------|
| `kimi-k2.6` | ✅ |
| `deepseek-v4-pro` | ✅ |
| `glm-5.2` | ✅ |

#### Google Vertex 协议（Gemini）

| 模型 | 状态 |
|------|------|
| `gemini-3.1-pro` | ⚠️ 需 Gemini 原生协议 |
| `gemini-3.5-flash` | ⚠️ 需 Gemini 原生协议 |

#### 不支持的模型

| 模型 | 原因 |
|------|------|
| `gpt-5.5` | Moxt Proxy 仅支持 `openai_responses` 协议，不走 Chat Completions |
| `gpt-5.4` / `gpt-5.4-mini` | Moxt 不提供 |
| `MiniMax-M3` / `MiniMax-M2.7` | Moxt 不提供 |
| `mimo-v2-pro` / `mimo-v2-omni` | Moxt 不提供 |
| `gemini-3-flash` | Moxt 不提供 |

---

## 本地使用方案（推荐）

由于 Moxt 不支持长期部署外部服务，推荐**在本地电脑运行 NewAPI，从 Moxt 获取临时 Key**。

### 前置条件

- Node.js 20+
- Git

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/henryz78/NewAPI.git
cd NewAPI
npm install

# 2. 设置环境变量
# Linux/Mac:
export PROVIDER_BASE_URL="https://moxt-llm-proxy-prod.onrender.com"
export PROVIDER_API_KEY="sk-vk-xxxxxxxx"  # 从 Moxt 对话中获取
export CLIENT_API_KEY="your-custom-key"    # 你自己设定，给客户端用

# Windows (CMD):
set PROVIDER_BASE_URL=https://moxt-llm-proxy-prod.onrender.com
set PROVIDER_API_KEY=sk-vk-xxxxxxxx
set CLIENT_API_KEY=your-custom-key

# 3. 启动
npm start
# 默认监听 http://localhost:3000/api/public/v1
```

### 获取 Key

在 Moxt 中跟 momo 说「给 Key」，复制返回的 `sk-vk-*` 值。

**Key 有效期约 30 分钟**（取决于 Moxt 对话是否活跃）。过期后需重新获取。

### 延长 Key 有效期

在 Moxt 中让 momo 执行保活命令：

> 「每30分钟醒一次」

Momo 会逐个执行 `sleep 1800` 命令，每次在 30 分钟超时前完成，避免被系统判定为 idle。已验证可持续 60 分钟以上。

> ⚠️ 保活期间无法与 momo 对话，因为 momo 正忙于执行 sleep 循环。

### 客户端配置（Cherry Studio / ChatBox 等）

| 配置项 | 值 |
|--------|-----|
| API 地址 | `http://localhost:3000/api/public/v1` |
| API Key | 你设定的 `CLIENT_API_KEY` |
| 可用模型 | `kimi-k2.6`, `deepseek-v4-pro`, `glm-5.2`, `claude-sonnet-5`, `claude-fable-5`, `claude-opus-4-8` 等 |

---

## 失败方案记录（供参考）

以下方案均经过实测，不可行：

| 方案 | 失败原因 |
|------|---------|
| 部署到 Netlify | Key 每轮对话变化，Netlify 无法自动获取最新 Key |
| e2b.dev URL 暴露 HTTP 服务 | 后台进程被 Sandbox 父进程清理 |
| systemd 服务保活 | Sandbox 销毁后服务消失；且无法读取 Sandbox 的环境变量 |
| Cron Job 自动更新 Key | Cron Job 执行完毕即销毁 Sandbox |
| Webhook 转发请求 | 不支持同步返回 HTTP 响应给调用方 |
| Share to Web 暴露 Key | 返回 SPA 页面，不可通过 curl 直接读取 |
| komari-agent 提取 Key | Sandbox 环境变量仅限特定进程，无法被外部服务读取 |
| 单个长 `sleep 7200` | 超过 30 分钟被 Moxt 判定 idle 杀死 |
| `for` 循环 + `echo` | stdout 内容在命令完成前不暴露给用户，仍被判定 idle |

### 已验证可行的方案

✅ **逐个执行独立的 `sleep 300`（5分钟）或 `sleep 1800`（30分钟）命令** — 每个命令在超时前完成并返回，不被判定 idle。

---

## 代码适配说明

为兼容 Moxt 平台，`src/index.ts` 建议做以下修改：

### 1. `getProviderApiKey()` 增加 `ANTHROPIC_API_KEY` fallback

```typescript
function getProviderApiKey(c: Context): string {
  // PROVIDER_API_KEY 优先，fallback 到 Moxt 自动注入的 ANTHROPIC_API_KEY
  return getEnv(c, "PROVIDER_API_KEY") || getEnv(c, "ANTHROPIC_API_KEY" as RuntimeKey);
}
```

### 2. `getProviderBaseUrl()` 增加 Moxt Proxy 默认值

```typescript
function getProviderBaseUrl(c: Context): string {
  return getEnv(c, "PROVIDER_BASE_URL")
    || getEnv(c, "ANTHROPIC_BASE_URL" as RuntimeKey)
    || "https://moxt-llm-proxy-prod.onrender.com";
}
```

### 3. 移除 EdgeSpark 特有代码

- 删除 `__EDGESPARK_INJECT_VARS__` 标记
- 删除 `DEFAULT_PROVIDER_HOST` 硬编码（`streambloomeim.com`）

### 4. 添加 Node.js 本地启动支持

```typescript
import { serve } from "@hono/node-server";

// 文件末尾
const isMain = process.argv[1]?.endsWith("src/index.ts");
if (isMain) {
  const port = parseInt(process.env.PORT || "3000", 10);
  serve({ fetch: app.fetch, port });
  console.log(`NewAPI running on http://localhost:${port}${API_PREFIX}`);
}
```

并在 `package.json` 添加依赖：
```json
"dependencies": {
  "hono": "^4.0.0",
  "@hono/node-server": "^1.0.0"
}
```

---

## 总结

| 问题 | 答案 |
|------|------|
| 能部署到外部平台长期运行吗？ | ❌ Moxt Virtual Key 生命周期太短 |
| 能在本地跑吗？ | ✅ 手动获取 Key，每 30 分钟续一次 |
| Key 能自动续吗？ | ⚠️ 需 momo 执行保活循环，但期间不能对话 |
| 最佳实践 | 本地跑 NewAPI → 去 Moxt 拿 Key → 粘贴 → 用 30 分钟 → 重复 |
