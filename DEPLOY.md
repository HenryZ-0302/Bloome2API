# DEPLOY.md — 部署流程

> 这是一页纸主流程。排障、环境坑和热更新见 `DEPLOY_NOTES.md`。

---

## 0. 前置检查

确认 Bun 可用。部署时只需要向用户询问 `CLIENT_API_KEY`。

- `PROVIDER_API_KEY` 默认使用 `RESON_LLM_API_KEY`
- 只有环境里没有 `RESON_LLM_API_KEY`，才停下来问上游 provider key
- `CLIENT_API_KEY` 必须由用户提供；不要替用户随机生成，也不要写进仓库

```bash
bun --version
bun install

echo ${#RESON_LLM_API_KEY}
export CLIENT_API_KEY="<用户给的客户端密码>"
```

不要用 `head -c`、截断日志或半段 secret 设置 `PROVIDER_API_KEY`。部署脚本会打印 key 长度并拒绝明显过短的值；只确认长度，不打印密钥内容。

默认部署目标是公网 EdgeSpark 地址；部署完成后需要给用户可直接复制的公网 Base URL。

如果 Bun 不可用，或遇到 `unzip` / Node 版本 / 权限问题，看 `DEPLOY_NOTES.md` 第 1 节。

---

## 1. 本地启动

部署公网前必须先本地 smoke test。

```bash
bun start
```

---

## 2. 验收模板

把 `BASE_URL` 换成本地或公网地址即可复用。

本地：

```bash
export BASE_URL="http://localhost:3000/api/public/v1"
```

公网：

```bash
export BASE_URL="https://<域名>.edgespark.app/api/public/v1"
```

验收：

```bash
curl "$BASE_URL/health"

curl -H "Authorization: Bearer $CLIENT_API_KEY" "$BASE_URL/models"

curl -i "$BASE_URL/models"

curl -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.6","messages":[{"role":"user","content":"Say hi"}],"max_tokens":20}'
```

通过标准：

- `health` 里 `providerApiKey` 和 `clientApiKey` 都是 `true`
- 带 key 的 `models` 返回 200
- 不带 key 的 `models` 返回 401
- `chat/completions` 返回正常 JSON，且有 `choices`

如果返回 `Model alias not found`，先确认上游聚合侧已启用对应模型 alias，再重试。

---

## 3. 创建 EdgeSpark 项目

项目 id / alias 统一用：`项目名_日期`

例如：

```text
newapi_20260526
```

优先 fresh alias：

```bash
export ALIAS="newapi_$(date +%Y%m%d)"
bloome edgespark project create --alias "$ALIAS"
```

如果当前环境只有备用 wrapper，用等价命令；重点是用 Bloome 控制平面创建，不是官方 `edgespark project create`：

```bash
bloome-cli edgespark project create --alias "$ALIAS"
```

---

## 4. Pull Smoke Test

先确认 EdgeSpark scaffold 和认证可用：

```bash
<cloud-cli> secret call EDGESPARK_API_KEY__<ALIAS>__<SUFFIX> -- bash -c '
  export EDGESPARK_API_KEY="$EDGESPARK_API_KEY__<ALIAS>__<SUFFIX>";
  export EDGESPARK_PROJECT_ENVIRONMENT=production;
  PROJECT_DIR="${EDGESPARK_PROJECT_DIR:-}";
  if [ -z "$PROJECT_DIR" ]; then
    for candidate in "edgespark/<alias>" "../edgespark/<alias>"; do
      if [ -f "$candidate/edgespark.toml" ]; then PROJECT_DIR="$candidate"; break; fi;
    done;
  fi;
  cd "${PROJECT_DIR:-edgespark/<alias>}" && edgespark pull
'
```

如果认证或路径失败，看 `DEPLOY_NOTES.md` 第 2 节。

---

## 5. 部署

推荐用本地封装脚本，它会把 `RESON_LLM_API_KEY` 和 `CLIENT_API_KEY` 写入 `/tmp` 临时文件，再让 `secret call` 里面 `cat` 读取，避免 `secret call` 不继承外部环境变量。

```bash
export EDGESPARK_SECRET_NAME="EDGESPARK_API_KEY__<ALIAS>__<SUFFIX>"
export CLIENT_API_KEY="<用户给的客户端密码>"
./scripts/deploy-local.sh <alias>
```

脚本会自动同步 `src/index.ts`、注入 EdgeSpark vars、安装 server 依赖并执行 `edgespark deploy`。
`PROVIDER_BASE_URL`、`ANTHROPIC_DEFAULT_MAX_TOKENS`、`GEMINI_DEFAULT_MAX_TOKENS`、`APP_DEV_MODE` 是可选变量；未设置时不会写入 EdgeSpark VarKey，避免 deploy 被可选空变量拦住。

如果刚执行过第 4 节的 `edgespark pull` smoke test，可以跳过脚本内的重复 pull：

```bash
SKIP_PULL=1 ./scripts/deploy-local.sh <alias>
```

只改源码且不需要重新同步变量 / pull generated types 时，可以用热更新模式：

```bash
HOT_DEPLOY_ONLY=1 ./scripts/deploy-local.sh <alias>
```

---

## 6. 公网验收

```bash
<cloud-cli> edgespark project verify "$ALIAS"
export BASE_URL="https://<域名>.edgespark.app/api/public/v1"
```

然后重新执行第 2 节的验收模板。

---

## 7. 汇报给用户

成功时只给可复制配置：

`Base URL` 和 `API Key` 必须各自单独放在代码块里，保证用户可以直接复制。

Base URL
```text
https://<域名>.edgespark.app/api/public/v1
```

API Key
```text
<CLIENT_API_KEY>
```

当前是默认模式：对外只返回统一错误标志和 `request_id`，详细错误请看平台日志。

如果需要开启开发模式，请告诉我；开发模式会设置 `APP_DEV_MODE=true`，接口响应会显示详细错误日志，排查结束后建议关闭。

另外请确认：是否需要我删除本次部署使用的项目文件夹/临时工作目录，不在部署环境里保留项目文件，只保留公网访问？默认不删除；确认后才执行删除。

失败时说明卡在哪一步：本地 smoke、create、pull、deploy、verify、health、models 或 chat。
