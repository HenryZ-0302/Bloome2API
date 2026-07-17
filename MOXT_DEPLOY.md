# Moxt 平台部署指南（NewAPI 版）

> ⚠️ **如果你只是想用 Moxt 的 LLM 模型**，不需要部署 NewAPI。
> 直接看 **[MOXT_PROXY_GUIDE.md](MOXT_PROXY_GUIDE.md)** — 零部署，拿 Key 就用。

---

本文档面向**仍想部署 NewAPI 网关**的场景（需要自定义路由、速率限制、协议转换等）。

完整踩坑记录和模型清单请参考 [MOXT_PROXY_GUIDE.md](MOXT_PROXY_GUIDE.md)，本文档仅列出 NewAPI 专属的代码适配步骤。

## 代码适配

### 1. `getProviderApiKey()` 增加 fallback
```typescript
function getProviderApiKey(c: Context): string {
  return getEnv(c, "PROVIDER_API_KEY") || getEnv(c, "ANTHROPIC_API_KEY" as RuntimeKey);
}
```

### 2. `getProviderBaseUrl()` 增加 fallback
```typescript
function getProviderBaseUrl(c: Context): string {
  return getEnv(c, "PROVIDER_BASE_URL")
    || getEnv(c, "ANTHROPIC_BASE_URL" as RuntimeKey)
    || "https://moxt-llm-proxy-prod.onrender.com";
}
```

### 3. 移除 EdgeSpark 代码
- 删除 `__EDGESPARK_INJECT_VARS__`
- 删除 `DEFAULT_PROVIDER_HOST`

### 4. 本地启动
```typescript
import { serve } from "@hono/node-server";
// 文件末尾
const isMain = process.argv[1]?.endsWith("src/index.ts");
if (isMain) {
  serve({ fetch: app.fetch, port: parseInt(process.env.PORT || "3000") });
}
```

`package.json` 添加：
```json
"dependencies": {
  "hono": "^4.0.0",
  "@hono/node-server": "^1.0.0"
}
```

### 5. 健康检查模型
`HEALTH_CHECK_MODELS` 改为 Moxt 可用模型（如 `kimi-k2.6`、`glm-5.1`），否则 `/health` 报错。

## 本地运行

```bash
git clone https://github.com/henryz78/NewAPI.git && cd NewAPI
npm install && npm install @hono/node-server
export PROVIDER_BASE_URL="https://moxt-llm-proxy-prod.onrender.com"
export PROVIDER_API_KEY="sk-vk-xxx"  # 从 Moxt 对话获取
export CLIENT_API_KEY="your-key"     # 自定义
npm start
```

默认 `http://localhost:3000/api/public/v1`。
