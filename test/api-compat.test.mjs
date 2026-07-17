import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const deployScript = readFileSync(new URL("../scripts/deploy-edgespark.sh", import.meta.url), "utf8");
const deployDoc = readFileSync(new URL("../DEPLOY.md", import.meta.url), "utf8");
const deployNotes = readFileSync(new URL("../DEPLOY_NOTES.md", import.meta.url), "utf8");
const deployLocalScript = readFileSync(new URL("../scripts/deploy-local.sh", import.meta.url), "utf8");
const modelsDoc = readFileSync(new URL("../docs/MODELS.md", import.meta.url), "utf8");
const thinkingDoc = readFileSync(new URL("../docs/THINKING.md", import.meta.url), "utf8");
const compactionDoc = readFileSync(new URL("../docs/COMPACTION.md", import.meta.url), "utf8");

test("public v1 exposes Anthropic Messages and OpenAI Responses compatibility routes", () => {
  assert.match(source, /API_PREFIX}\/messages`/);
  assert.match(source, /API_PREFIX}\/messages\/count_tokens`/);
  assert.match(source, /API_PREFIX}\/responses`/);
  assert.match(source, /API_PREFIX}\/responses\/compact`/);
  assert.match(source, /API_PREFIX}\/responses\/input_tokens`/);
});

test("static Responses routes are registered before dynamic response id routes", () => {
  const compact = source.indexOf("app.post(`${API_PREFIX}/responses/compact`");
  const inputTokens = source.indexOf("app.post(`${API_PREFIX}/responses/input_tokens`");
  const dynamicCompact = source.indexOf("app.post(`${API_PREFIX}/responses/:response_id/compact`");
  const retrieve = source.indexOf("app.get(`${API_PREFIX}/responses/:response_id`");

  assert.ok(compact > 0);
  assert.ok(inputTokens > 0);
  assert.ok(dynamicCompact > 0);
  assert.ok(retrieve > 0);
  assert.ok(compact < dynamicCompact);
  assert.ok(inputTokens < retrieve);
});

test("CORS allows Anthropic SDK headers", () => {
  assert.match(source, /Access-Control-Allow-Origin", "\*"/);
  assert.match(source, /anthropic-version/);
  assert.match(source, /anthropic-beta/);
  assert.match(source, /x-client-request-id/);
  assert.match(source, /Access-Control-Expose-Headers/);
});

test("health probes rotate across available OpenAI-compatible models", () => {
  assert.match(source, /HEALTH_CHECK_MODELS/);
  assert.match(source, /Math\.random/);
  assert.doesNotMatch(source, /model: "kimi-k2\.6"/);
  assert.match(source, /healthModel/);
});

test("public runtime surface is white-label", () => {
  assert.match(source, /PROVIDER_API_KEY/);
  assert.match(source, /APP_DEV_MODE/);
  assert.match(source, /providerApiKey/);
  assert.doesNotMatch(source, /BLOOME_API_KEY/);
  assert.doesNotMatch(source, /BLOOME2API_DEV_MODE/);
  assert.doesNotMatch(source, /bloomeApiKey/);
  assert.doesNotMatch(source, /owned_by: "reson"/);
  assert.doesNotMatch(source, /bloome2api\.compaction/);
  assert.doesNotMatch(source, /`bloome-\$\{hashString/);
});

test("model catalog includes Claude Opus 4.8 with adaptive thinking", () => {
  assert.match(source, /id: "claude-opus-4-8"/);
  assert.match(source, /id: "claude-opus-4-8-thinking"/);
  assert.match(source, /"claude-opus-4-8": 128000/);
  assert.match(source, /"claude-opus-4-8-thinking": 128000/);

  const thinkingStart = source.indexOf("function getClaudeThinkingConfig");
  const googleStart = source.indexOf("function isGoogleModel");
  assert.ok(thinkingStart > 0);
  assert.ok(googleStart > thinkingStart);
  const thinkingSource = source.slice(thinkingStart, googleStart);
  assert.match(thinkingSource, /case "claude-opus-4-8":/);
  assert.match(thinkingSource, /thinking: \{ type: "adaptive", display: "summarized" \}/);
  assert.match(thinkingSource, /output_config: \{ effort: "medium" \}/);

  assert.match(modelsDoc, /Claude Opus 4\.8/);
  assert.match(modelsDoc, /`claude-opus-4-8-thinking`/);
  assert.match(modelsDoc, /`claude-opus-4-8` \/ `claude-opus-4-8-thinking`：`128000`/);
  assert.match(thinkingDoc, /`claude-opus-4-8-thinking`/);
  assert.match(thinkingDoc, /\| `claude-opus-4-8` \| 可用 \| 不支持 \| 支持/);
  assert.match(source, /PUBLIC_MODEL_OWNER/);
});

test("model catalog includes latest discovered model aliases", () => {
  assert.match(source, /id: "MiniMax-M3"/);
  assert.match(source, /id: "MiniMax-M3-thinking"/);
  assert.match(source, /id: "gemini-3\.5-flash"/);
  assert.match(source, /id: "gemini-3\.5-flash-thinking"/);
  assert.match(source, /id: "glm-5\.2"/);
  assert.match(source, /id: "kimi-k2\.7-code"/);
  assert.match(source, /"minimax-m3": 131072/);
  assert.match(source, /"minimax-m3-thinking": 131072/);
  assert.match(source, /"gemini-3\.5-flash": 65536/);
  assert.match(source, /"gemini-3\.5-flash-thinking": 65536/);
  assert.match(source, /model === "MiniMax-M3"/);
  assert.match(source, /model === "MiniMax-M3-thinking"/);
  assert.match(source, /case "MiniMax-M3":/);
  assert.match(source, /thinking: \{ type: "adaptive" \}/);
  assert.match(modelsDoc, /MiniMax M3/);
  assert.match(modelsDoc, /`MiniMax-M3`/);
  assert.match(modelsDoc, /`MiniMax-M3-thinking`/);
  assert.match(modelsDoc, /Gemini 3\.5 Flash/);
  assert.match(modelsDoc, /`gemini-3\.5-flash`/);
  assert.match(modelsDoc, /`gemini-3\.5-flash-thinking`/);
  assert.match(modelsDoc, /GLM 5\.2/);
  assert.match(modelsDoc, /`glm-5\.2`/);
  assert.match(modelsDoc, /Kimi K2\.7 Code/);
  assert.match(modelsDoc, /`kimi-k2\.7-code`/);
  assert.match(modelsDoc, /Kimi K3/);
  assert.match(modelsDoc, /`kimi-k3`/);
  assert.match(thinkingDoc, /`MiniMax-M3-thinking`/);
  assert.match(thinkingDoc, /`gemini-3\.5-flash-thinking`/);
  assert.match(thinkingDoc, /`glm-5\.2`/);
  assert.match(thinkingDoc, /`kimi-k2\.7-code`/);
  assert.doesNotMatch(source, /id: "glm-5\.0"/);
  assert.doesNotMatch(source, /id: "deepseek-v3-2"/);
  assert.doesNotMatch(source, /id: "glm-5\.2-thinking"/);
  assert.doesNotMatch(source, /id: "kimi-k2\.7-code-thinking"/);
  assert.doesNotMatch(source, /id: "kimi-k3-thinking"/);
  assert.doesNotMatch(modelsDoc, /\| GLM 5\.0 \|/);
  assert.doesNotMatch(modelsDoc, /\| DeepSeek V3\.2 \|/);
  assert.doesNotMatch(thinkingDoc, /`glm-5\.0`/);
  assert.doesNotMatch(thinkingDoc, /`deepseek-v3-2`/);
  assert.doesNotMatch(thinkingDoc, /`glm-5\.2-thinking`/);
  assert.doesNotMatch(thinkingDoc, /`kimi-k2\.7-code-thinking`/);
});

test("models docs record the official Bloome pricing catalog", () => {
  const pricingStart = modelsDoc.indexOf("## Bloome 官方公开模型与基础单价");
  const supportedStart = modelsDoc.indexOf("## 当前支持模型", pricingStart);
  assert.ok(pricingStart > 0);
  assert.ok(supportedStart > pricingStart);

  const pricing = modelsDoc.slice(pricingStart, supportedStart);
  assert.match(pricing, /2026-07-17/);
  assert.match(pricing, /26 个模型/);
  assert.match(pricing, /每 100 万 tokens/);
  assert.match(pricing, /\| Kimi K3 \| 视觉 \| 1M \| \$3\.00 \| \$0\.30 \| \$15\.00 \|/);

  for (const modelName of [
    "Claude Opus 4.8",
    "Claude Opus 4.7",
    "Claude Opus 4.6",
    "Claude Sonnet 5",
    "Claude Sonnet 4.6",
    "Claude Haiku 4.5",
    "GPT 5.6 Sol",
    "GPT 5.6 Terra",
    "GPT 5.6 Luna",
    "GPT 5.5",
    "Grok 4.5",
    "GLM 5.2",
    "GLM 5.1",
    "Xiaomi MiMo V2.5 Pro",
    "Xiaomi MiMo V2.5",
    "DeepSeek V4 Pro",
    "DeepSeek V4 Flash",
    "Gemini 3.5 Flash",
    "Gemini 3.1 Pro",
    "Gemini 3 Flash",
    "Kimi K2.7 Code",
    "Kimi K2.6",
    "Kimi K2.5",
    "MiniMax M3",
    "MiniMax M2.7",
  ]) {
    const escapedName = modelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(pricing, new RegExp(`\\| ${escapedName} \\|`));
  }

  assert.match(pricing, /\| GPT 5\.6 Sol \| 视觉 \| 272K \| \$5\.00 \| \$0\.50 \| \$30\.00 \|/);
  assert.match(pricing, /\| Grok 4\.5 \| 视觉 \| 200K \| \$2\.00 \| \$0\.50 \| \$6\.00 \|/);
  assert.match(pricing, /MiniMax M3.*>512K：输入 \$0\.60 \/ 输出 \$2\.40/s);
  assert.match(pricing, /Xiaomi MiMo V2\.5 Pro.*>256K：输入 \$2\.10 \/ 输出 \$6\.30/s);
});

test("model catalog includes Sonnet 5, GPT 5.6 variants, and Grok 4.5", () => {
  for (const modelId of [
    "claude-sonnet-5",
    "claude-sonnet-5-thinking",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "grok-4.5",
    "kimi-k3",
  ]) {
    assert.match(source, new RegExp(`id: "${modelId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }

  assert.match(source, /"claude-sonnet-5": 128000/);
  assert.match(source, /"claude-sonnet-5-thinking": 128000/);
  assert.doesNotMatch(source, /id: "gpt-5\.6-(?:sol|terra|luna)-thinking"/);
  assert.doesNotMatch(source, /id: "grok-4\.5-thinking"/);

  const modelsStart = source.indexOf("const MODELS = [");
  const helpersStart = source.indexOf("// ========== Helpers ==========", modelsStart);
  assert.ok(modelsStart > 0);
  assert.ok(helpersStart > modelsStart);
  const modelCatalog = source.slice(modelsStart, helpersStart);
  assert.equal([...modelCatalog.matchAll(/\{ id: "/g)].length, 41);

  const thinkingStart = source.indexOf("function getClaudeThinkingConfig");
  const googleStart = source.indexOf("function isGoogleModel", thinkingStart);
  const thinkingSource = source.slice(thinkingStart, googleStart);
  const sonnet5Start = thinkingSource.indexOf('case "claude-sonnet-5":');
  const nextCase = thinkingSource.indexOf("case ", sonnet5Start + 1);
  assert.ok(sonnet5Start > 0);
  const sonnet5Config = thinkingSource.slice(sonnet5Start, nextCase);
  assert.match(sonnet5Config, /thinking: \{ type: "adaptive", display: "summarized" \}/);
  assert.match(sonnet5Config, /output_config: \{ effort: "medium" \}/);

  assert.match(modelsDoc, /\| Claude Sonnet 5 \| `claude-sonnet-5` \|/);
  assert.match(modelsDoc, /\| Claude Sonnet 5 Thinking \| `claude-sonnet-5-thinking` \|/);
  assert.match(modelsDoc, /\| GPT 5\.6 Sol \| `gpt-5\.6-sol` \|/);
  assert.match(modelsDoc, /\| GPT 5\.6 Terra \| `gpt-5\.6-terra` \|/);
  assert.match(modelsDoc, /\| GPT 5\.6 Luna \| `gpt-5\.6-luna` \|/);
  assert.match(modelsDoc, /\| Grok 4\.5 \| `grok-4\.5` \|/);
  assert.match(thinkingDoc, /`claude-sonnet-5-thinking`/);
  assert.doesNotMatch(thinkingDoc, /`gpt-5\.6-sol-thinking`/);
  assert.doesNotMatch(thinkingDoc, /`grok-4\.5-thinking`/);
});

test("translated Chat Completions handle developer messages and stream usage", () => {
  assert.match(source, /m\.role === "developer"/);
  assert.match(source, /wantsStreamUsage/);
  assert.match(source, /writeOpenAIStreamUsageChunk/);
  assert.match(source, /presence_penalty/);
  assert.match(source, /frequency_penalty/);
  assert.match(source, /parallel_tool_calls/);
  assert.match(source, /mergeOpenAIUsage\(lastUsage, m\.usage\)/);
  assert.match(source, /mergeOpenAIUsage\(lastUsage, d\.usage\)/);
});

test("Responses streaming emits item and content lifecycle events", () => {
  assert.match(source, /response\.output_item\.added/);
  assert.match(source, /response\.content_part\.added/);
  assert.match(source, /response\.output_text\.done/);
  assert.match(source, /response\.content_part\.done/);
  assert.match(source, /response\.output_item\.done/);
  assert.match(source, /writeResponseNonTextOutputEvents/);
});

test("Chat Completions can consume local compaction items", () => {
  assert.match(source, /function normalizeChatCompactionMessages/);
  assert.match(source, /chatCompactionItemToSystemMessage/);
  assert.match(source, /body\.messages = normalizeChatCompactionMessages\(body\.messages\)/);
  assert.match(source, /item\.type === "compaction"/);
  assert.match(readme, /\/chat\/completions` 可识别 `type: "compaction"`/);
  assert.match(modelsDoc, /`\/chat\/completions` 也可以消费本项目的 `type: "compaction"` item/);
});

test("manual compaction docs describe the explicit client-controlled loop", () => {
  assert.match(readme, /docs\/COMPACTION\.md/);
  assert.match(modelsDoc, /COMPACTION\.md/);
  assert.match(compactionDoc, /Manual Context Compaction/);
  assert.match(compactionDoc, /manual context compaction loop/);
  assert.match(compactionDoc, /not automatic compression/);
  assert.match(compactionDoc, /not conversation persistence/);
  assert.match(compactionDoc, /not OpenAI's official encrypted platform format/);
  assert.match(compactionDoc, /POST \/responses\/compact/);
  assert.match(compactionDoc, /"type": "compaction"/);
  assert.match(compactionDoc, /\$BASE_URL\/responses"/);
  assert.match(compactionDoc, /\$BASE_URL\/chat\/completions"/);
});

test("Responses internal errors keep the public safe-error policy", () => {
  assert.match(source, /classifyInternalGatewayStatus/);
  assert.match(source, /openAIEventError/);
  assert.doesNotMatch(source, /return c\.json\(upstream \|\|/);
});

test("token count unsupported cases map to not_supported_error", () => {
  assert.match(source, /function isUpstreamNotSupportedStatus/);
  assert.match(source, /status === 400/);
  assert.match(source, /token counting is only available for Anthropic-compatible models/);
  assert.match(source, /return anthropicJsonError\(c, 501, "not_supported_error"/);
});

test("public errors have explicit type and code taxonomy", () => {
  for (const type of [
    "configuration_error",
    "unsupported_error",
    "model_not_found_error",
    "rate_limit_error",
    "upstream_bad_request",
    "upstream_auth_error",
    "upstream_unavailable",
  ]) {
    assert.match(source, new RegExp(`${type}: \\{`));
  }
  assert.match(source, /code: "model_not_found"/);
  assert.match(source, /code: "unsupported_parameter"/);
  assert.match(source, /publicErrorBody/);
});

test("upstream errors are classified by status and body text", () => {
  assert.match(source, /function classifyUpstreamError/);
  assert.match(source, /unknown gemini action/);
  assert.match(source, /rate limit/);
  assert.match(source, /invalid api key/);
  assert.match(source, /status === 400\) return \{ status: 502, type: "upstream_bad_request" \}/);
});

test("upstream error text does not scan full upstream payloads", () => {
  const upstreamTextStart = source.indexOf("function upstreamErrorText");
  const classifierStart = source.indexOf("function classifyUpstreamError");
  assert.ok(upstreamTextStart > 0);
  assert.ok(classifierStart > upstreamTextStart);

  const upstreamTextSource = source.slice(upstreamTextStart, classifierStart);
  assert.match(upstreamTextSource, /body\.error\?\.message/);
  assert.doesNotMatch(upstreamTextSource, /JSON\.stringify\(body\)/);
});

test("model-not-found classification avoids broad unrelated text matches", () => {
  const classifierStart = source.indexOf("function classifyUpstreamError");
  const unsupportedStatusStart = source.indexOf("function classifyInternalGatewayStatus");
  assert.ok(classifierStart > 0);
  assert.ok(unsupportedStatusStart > classifierStart);

  const classifierSource = source.slice(classifierStart, unsupportedStatusStart);
  assert.match(classifierSource, /model alias/);
  assert.doesNotMatch(classifierSource, /text\.includes\("model"\) && text\.includes\("not found"\)/);
});

test("translated unsupported parameters return unsupported_error", () => {
  assert.match(source, /"unsupported_error", \{ unsupported: \["functions", "function_call"\] \}/);
  assert.match(source, /"unsupported_error", \{ unsupported: unsupportedReasons \}/);
});

test("deploy script supports hot deploy without var sync or pull", () => {
  assert.match(deployScript, /HOT_DEPLOY_ONLY/);
  assert.match(deployScript, /SKIP_VAR_SYNC/);
  assert.match(deployScript, /SKIP_PULL/);
  assert.match(deployScript, /if \[\[ "\$\{SKIP_NPM_INSTALL:-0\}" != "1" \]\]; then\s+require_cmd npm/s);
  assert.match(deployScript, /if \[\[ "\$\{SKIP_VAR_SYNC:-0\}" != "1" \]\]/);
  assert.match(deployScript, /: "\$\{PROVIDER_API_KEY:\?Missing PROVIDER_API_KEY\}"/);
  assert.match(deployScript, /require_secret_min_length PROVIDER_API_KEY 40/);
  assert.match(deployScript, /echo "\$name is too short: length=\$length, expected >= \$min_length"/);
  assert.match(deployScript, /echo "==> \$name length: \$length"/);
  assert.match(deployScript, /runtime_var_keys=\(/);
  assert.match(deployScript, /runtime_var_keys\+=\("PROVIDER_BASE_URL"\)/);
  assert.match(deployScript, /RUNTIME_VAR_KEYS=/);
  assert.match(deployScript, /vars\.get\(key as any\)/);
  assert.doesNotMatch(deployScript, /export type VarKey =\\n  \| "PROVIDER_BASE_URL"\\n  \| "PROVIDER_API_KEY"\\n  \| "CLIENT_API_KEY"\\n  \| "ANTHROPIC_DEFAULT_MAX_TOKENS"\\n  \| "GEMINI_DEFAULT_MAX_TOKENS"\\n  \| "APP_DEV_MODE";/);
  assert.doesNotMatch(deployScript, /BLOOME_API_KEY/);
  assert.doesNotMatch(deployScript, /BLOOME2API_DEV_MODE/);
  assert.match(deployScript, /if \[\[ "\$\{SKIP_PULL:-0\}" != "1" \]\]/);
});

test("deploy docs require user-provided client key and copyable success report", () => {
  assert.match(deployDoc, /只需要向用户询问 `CLIENT_API_KEY`/);
  assert.match(deployDoc, /`PROVIDER_API_KEY` 默认使用 `RESON_LLM_API_KEY`/);
  assert.match(deployDoc, /只有环境里没有 `RESON_LLM_API_KEY`/);
  assert.doesNotMatch(deployDoc, /准备两个 key/);
  assert.match(deployDoc, /默认部署目标是公网 EdgeSpark 地址/);
  assert.match(deployDoc, /echo \$\{#RESON_LLM_API_KEY\}/);
  assert.match(deployDoc, /不要用 `head -c`/);
  assert.match(deployDoc, /拒绝明显过短的值/);
  assert.match(deployDoc, /未设置时不会写入 EdgeSpark VarKey/);
  assert.match(deployDoc, /项目名_日期/);
  assert.match(deployDoc, /newapi_\$\(date \+%Y%m%d\)/);
  assert.match(deployDoc, /bloome edgespark project create --alias "\$ALIAS"/);
  assert.doesNotMatch(deployDoc, /<cloud-cli> edgespark project create --alias "\$ALIAS"/);
  assert.match(deployDoc, /Base URL/);
  assert.match(deployDoc, /API Key/);
  assert.match(deployDoc, /各自单独放在代码块里/);
  assert.match(deployDoc, /Base URL\s+```text\s+https:\/\/<域名>\.edgespark\.app\/api\/public\/v1\s+```/s);
  assert.match(deployDoc, /API Key\s+```text\s+<CLIENT_API_KEY>\s+```/s);
  assert.match(deployDoc, /是否需要我删除本次部署使用的项目文件夹\/临时工作目录/);
  assert.match(deployDoc, /默认不删除；确认后才执行删除/);
  assert.doesNotMatch(deployDoc, /环境变量对比值/);
  assert.doesNotMatch(deployDoc, /PROVIDER_API_KEY=<当前部署使用的 PROVIDER_API_KEY>/);
  assert.doesNotMatch(deployDoc, /APP_DEV_MODE=<未设置或当前值>/);
  assert.doesNotMatch(deployDoc, /Bloome2API 部署成功/);
  assert.match(deployDoc, /不要替用户随机生成/);
  assert.doesNotMatch(deployDoc, /openssl rand|uuidgen|pwgen|randomBytes/i);
});

test("public docs use neutral product naming", () => {
  assert.match(deployDoc, /PROVIDER_API_KEY/);
  assert.match(deployDoc, /APP_DEV_MODE/);
  assert.doesNotMatch(deployDoc, /BLOOME2API_DEV_MODE/);
  assert.doesNotMatch(deployDoc, /Bloome2API 部署成功/);
});

test("local deploy wrapper keeps secrets explicit and supports optional verification", () => {
  assert.match(deployLocalScript, /EDGESPARK_SECRET_NAME/);
  assert.match(deployLocalScript, /RESON_LLM_API_KEY/);
  assert.match(deployLocalScript, /CLIENT_API_KEY/);
  assert.match(deployLocalScript, /PROVIDER_KEY_FILE="\$\(mktemp/);
  assert.match(deployLocalScript, /CLIENT_KEY_FILE="\$\(mktemp/);
  assert.match(deployLocalScript, /trap cleanup EXIT/);
  assert.match(deployLocalScript, /cat "\$PROVIDER_KEY_FILE"/);
  assert.match(deployLocalScript, /cat "\$CLIENT_KEY_FILE"/);
  assert.match(deployLocalScript, /printenv "\$SECRET_NAME"/);
  assert.match(deployLocalScript, /CLOUD_CMD/);
  assert.match(deployLocalScript, /command -v bloome/);
  assert.match(deployLocalScript, /command -v bloome-cli/);
  assert.match(deployLocalScript, /cloud CLI not found/);
  assert.match(deployLocalScript, /HOT_DEPLOY_ONLY/);
  assert.match(deployLocalScript, /BASE_URL/);
  assert.match(deployLocalScript, /require_cmd curl/);
  assert.match(deployLocalScript, /chat\/completions/);
  assert.match(deployLocalScript, /scripts\/deploy-edgespark\.sh/);
  assert.doesNotMatch(deployLocalScript, /export PROVIDER_API_KEY="\$RESON_LLM_API_KEY"/);
  assert.doesNotMatch(deployLocalScript, /require_cmd bloome/);
  assert.doesNotMatch(deployLocalScript, /1346792580a/);
  assert.doesNotMatch(deployLocalScript, /CLIENT_API_KEY=["'][^"$]/);
  assert.match(deployNotes, /scripts\/deploy-local\.sh/);
  assert.match(deployNotes, /upstream_auth_error/);
  assert.match(deployNotes, /PROVIDER_API_KEY.*截断/);
  assert.match(deployNotes, /都当成 deploy 前必须存在/);
  assert.match(deployNotes, /`secret call` 不透传外部环境变量/);
  assert.match(deployNotes, /不会继承外层的 `RESON_LLM_API_KEY` \/ `CLIENT_API_KEY`/);
  assert.match(deployNotes, /先把 key 写到 `\/tmp` 临时文件/);
  assert.match(deployNotes, /`secret call` 里面再 `cat` 读取/);
  assert.match(deployNotes, /部署结束会自动删除临时文件/);
  assert.match(deployNotes, /`PROVIDER_API_KEY` 默认来自 `RESON_LLM_API_KEY`/);
  assert.match(deployNotes, /不要为了通过 deploy 去补空的 `PROVIDER_BASE_URL`/);
});
