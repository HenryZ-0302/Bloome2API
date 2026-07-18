# NewAPI

一个 API 网关聚合中转站，对外提供统一兼容接口，对内聚合和转发多模型请求。

> **如果你是 M 用户，不需要部署 NewAPI。** 直接看 [M_DEPLOY.md](M_DEPLOY.md) 零部署接入 M LLM Proxy。

适合这些场景：
- 让支持 OpenAI API 的客户端接入统一中转站
- 用统一接口聚合和转发多个模型供应商
- 在 EdgeSpark 上快速部署自己的 API 网关入口

> **M 部署分支**：本分支 (`m-only`) 已移除 EdgeSpark 专属的 `DEPLOY.md` / `DEPLOY_NOTES.md`，增加 `M_DEPLOY.md`。主分支 (`main`) 保留原始 EdgeSpark 部署文档。

---

## 特性

- OpenAI Chat Completions 兼容接口
- OpenAI Responses API 最小无状态兼容层
- Anthropic Messages API 兼容接口
- 内置多模型路由与协议转换
- 支持 `tools` / `tool_calls`
- 支持 `-thinking` / `reasoning_content` 兼容
- 支持手动上下文压缩闭环
- 支持 CORS
- 返回 `x-request-id`
- 提供深度 `health` 检查

---

## 接口

默认前缀：`/api/public/v1`

- `GET /health`
- `GET /models`
- `POST /chat/completions`
- `POST /responses`
- `POST /responses/compact`
- `POST /responses/input_tokens`
- `POST /messages`
- `POST /messages/count_tokens`

---

## 部署

| 平台 | 文档 |
|------|------|
| **M（本分支）** | [M_DEPLOY.md](M_DEPLOY.md) — 零部署，直接用 |
| **EdgeSpark / Bloome** | 切换到 `main` 分支查看 `DEPLOY.md` |

---

## 本地运行

```bash
bun install
export PROVIDER_API_KEY="你的上游 provider key"
export CLIENT_API_KEY="你给客户端的 Key"
bun start
```

默认 `http://localhost:3000/api/public/v1`。

---

## 说明

- 核心源码入口：`src/index.ts`
- 手动上下文压缩说明：`docs/COMPACTION.md`
- 模型映射说明：`docs/MODELS.md`
- thinking / reasoning 说明：`docs/THINKING.md`
- 错误分类说明：`docs/ERRORS.md`
