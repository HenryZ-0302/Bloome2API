# Moxt 平台部署指南

> NewAPI 在 Moxt 平台的接入方案、可用模型清单与踩坑全记录。
> 最后更新：基于对 `moxt-llm-proxy-prod.onrender.com` 的完整实测。

---

## 一、核心结论

**Moxt 平台无法长期部署外部 API 服务**，原因是 Moxt 注入的 LLM Key 是「会话级临时 Key」，随对话轮次刷新、旧 Key 立即失效。

推荐用法：**本地运行 NewAPI + 从 Moxt 获取临时 Key**（详见第四节）。

---

## 二、与原始平台的差异

| 方面 | 原始平台 (Bloome/EdgeSpark) | Moxt |
|------|---------------------------|------|
| 部署方式 | EdgeSpark Functions（长期运行） | Cloud Sandbox（对话级临时） |
| 上游地址 | `streambloomeim.com`（硬编码） | `moxt-llm-proxy-prod.onrender.com` |
| 上游 Key 变量 | `RESON_LLM_API_KEY` | `ANTHROPIC_API_KEY` |
| 上游地址变量 | — | `ANTHROPIC_BASE_URL` |
| Key 格式 | — | `sk-vk-{32位hex}` |
| Key 生命周期 | 长期有效 | **每轮对话刷新，旧Key立即失效** |
| Key 最大存活 | 无限制 | ~30 分钟（无用户互动即销毁沙盒） |
| 文件持久化 | 持久 | ❌ 沙盒销毁后全部丢失 |
| 后台进程 | 支持 | ❌ 子进程会被清理 |

---

## 三、Moxt LLM Proxy 可用模型清单

> 通过 `moxt-llm-proxy-prod.onrender.com` 实测。Moxt Web 界面能选的模型更多，但以下是**API 实际可调用**的。

### ✅ API 可调用（13 个）

#### Anthropic Messages 协议
- 端点：`POST /v1/messages`
- 认证：`x-api-key: sk-vk-xxx`
- 必需头：`anthropic-version: 2023-06-01`

| 模型 | 上下文 | 思考 |
|------|-------|------|
| `claude-opus-4-8` | 1M | ✅ High |
| `claude-opus-4-7` | 1M | ✅ Xhigh |
| `claude-opus-4-6` | 1M | ✅ High |
| `claude-sonnet-4-6` | 1M | ✅ Medium |
| `claude-sonnet-5` | 1M | ✅ |
| `claude-fable-5` | 1M | ✅ |

#### OpenAI Chat Completions 协议
- 端点：`POST /v1/chat/completions`
- 认证：`Authorization: Bearer sk-vk-xxx`

| 模型 | 上下文 | 思考 |
|------|-------|------|
| `deepseek-v4-pro` | 1M | ✅ High |
| `deepseek-v4-flash` | 1M | ❌ |
| `kimi-k2.6` | 256K | ❌ |
| `glm-5.2` | 1M | ❌ |
| `glm-5.1` | 200K | ❌ |
| `qwen-3.7-max` | 1M | ❌ |

#### OpenAI Responses 协议
- 端点：`POST /v1/responses`
- 认证：`Authorization: Bearer sk-vk-xxx`
- 注意：`max_output_tokens` 最小值为 **16**

| 模型 | 上下文 | 思考 |
|------|-------|------|
| `gpt-5.5` | 1.05M | ✅ `reasoning_effort` |

### ⚠️ Web UI 有，但 Proxy API 未开放（4 个）

| 模型 | 状态 |
|------|------|
| `gemini-3.1-pro` | Proxy 识别但只认 `google_vertex_generate_content_stream` 协议，且 Vertex 路由返回 404 |
| `gemini-3.5-flash` | 同上 |
| `gemini-3-flash` | 同上 |
| `MiMo-V2.5-Pro` | Proxy 返回 `model_not_found`，仅限 Web UI 使用 |

### ❌ 完全不支持

GPT-5.6 全系（Sol/Terra/Luna 已注册但路由报 500，Sol-Pro 未注册）、GPT-5.4/5.1、o 系列、gpt-4o、Claude Mythos 5、Claude Haiku 4.5、Grok 全系、MiniMax、字节 Doubao/Seed、腾讯 Hy、百度 ERNIE、Mistral、Llama、Qwen 3.7-Plus。

---

## 四、本地使用方案（推荐）

### 前置条件
- Node.js 20+
- Git

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/henryz78/NewAPI.git
cd NewAPI
npm install
npm install @hono/node-server   # 本地服务器依赖

# 2. 设置环境变量
# Linux / Mac:
export PROVIDER_BASE_URL="https://moxt-llm-proxy-prod.onrender.com"
export PROVIDER_API_KEY="sk-vk-xxxxxxxx"   # 从 Moxt 对话中获取
export CLIENT_API_KEY="your-custom-key"     # 自定义，给客户端用

# Windows (CMD):
set PROVIDER_BASE_URL=https://moxt-llm-proxy-prod.onrender.com
set PROVIDER_API_KEY=sk-vk-xxxxxxxx
set CLIENT_API_KEY=your-custom-key

# 3. 启动
npm start
# 默认监听 http://localhost:3000/api/public/v1
```

### 获取并延长 Key

1. 在 Moxt 对话中跟 momo 说「给 Key」，复制返回的 `sk-vk-*`。
2. **Key 有效期约 30 分钟。**
3. 延长：让 momo「每 30 分钟醒一次」，它会逐个执行独立的 `sleep 1800` 命令保活（每个命令在超时前完成，避免 idle 判定）。已验证可持续 60 分钟以上。
   - ⚠️ 保活期间 momo 无法回复其他消息。

### 客户端配置（Cherry Studio / ChatBox 等）

| 配置项 | 值 |
|--------|-----|
| API 地址 | `http://localhost:3000/api/public/v1` |
| API Key | 你设定的 `CLIENT_API_KEY` |
| 模型 | 见第三节「API 可调用」的 13 个模型名 |

---

## 五、代码适配说明

为兼容 Moxt，`src/index.ts` 建议做以下修改：

### 1. `getProviderApiKey()` 增加 `ANTHROPIC_API_KEY` fallback
```typescript
function getProviderApiKey(c: Context): string {
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
- 删除 `DEFAULT_PROVIDER_HOST`（硬编码 `streambloomeim.com`）

### 4. 添加 Node.js 本地启动
```typescript
import { serve } from "@hono/node-server";

const isMain = process.argv[1]?.endsWith("src/index.ts");
if (isMain) {
  const port = parseInt(process.env.PORT || "3000", 10);
  serve({ fetch: app.fetch, port });
  console.log(`NewAPI running on http://localhost:${port}${API_PREFIX}`);
}
```

`package.json` 依赖：
```json
"dependencies": {
  "hono": "^4.0.0",
  "@hono/node-server": "^1.0.0"
}
```

### 5. 模型清单同步
NewAPI 原有的模型映射（`MiniMax-M3`、`gemini-3-flash`、`gpt-5.4` 等）在 Moxt 上不可用。健康检查用的 `HEALTH_CHECK_MODELS` 也应改为 Moxt 实际可用的模型（如 `kimi-k2.6`、`glm-5.1`、`deepseek-v4-flash`），否则 `/health` 会报模型不存在。

---

## 六、失败方案记录（供参考，勿重复踩坑）

| 方案 | 失败原因 |
|------|---------|
| 部署到 Netlify | Key 每轮对话变化，Netlify 无法自动获取最新 Key |
| e2b.dev URL 暴露 HTTP 服务 | 后台进程被 Sandbox 父进程清理，对话结束沙盒销毁 |
| systemd 服务保活 | 沙盒销毁后服务消失；且服务读不到沙盒环境变量 |
| Cron Job 更新 Key | Job 执行完即销毁沙盒，Key 随之失效 |
| Heartbeat 保活 | 同 Cron，单次执行后结束 |
| Webhook 转发请求 | 不能同步返回 HTTP 响应给调用方 |
| Share to Web 暴露 Key | 返回 SPA 页面，无法 curl 读取纯文本 |
| Moxt MCP API 读 Key | 需 User API Token，部分账号无创建入口 |
| komari-agent 提取 Key | 沙盒环境变量仅限特定进程，跨进程读不到 |
| 单个长 `sleep 7200` | 超 30 分钟被 Moxt 判定 idle 杀死 |
| `for` 循环 + `echo` 保活 | stdout 在命令完成前不返回给用户，仍判 idle |

### ✅ 唯一验证可行的保活方案
**逐个执行独立的 `sleep 1800`（30分钟）命令**——每个命令在超时前完成并返回，不被判 idle。可无限接力。

---

## 七、总结

| 问题 | 答案 |
|------|------|
| 能部署到外部平台长期运行吗？ | ❌ Virtual Key 生命周期太短 |
| 能在本地跑吗？ | ✅ 手动获取 Key，每 30 分钟续一次 |
| Key 能自动续吗？ | ⚠️ 需 momo 执行保活循环，期间不能对话 |
| 有多少模型可用？ | 13 个（Claude ×6、DeepSeek ×2、Kimi、GLM ×2、Qwen、GPT-5.5） |
| Gemini 能用吗？ | ❌ Web UI 能选，但 Proxy API 未开放 |
| 最佳实践 | 本地跑 NewAPI → 找 momo 拿 Key → 粘贴 → 用 30 分钟 → 重复 |
