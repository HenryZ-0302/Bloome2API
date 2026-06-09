# Manual Context Compaction

NewAPI supports a manual context compaction loop. The client decides when to
compact; the gateway only generates a compact item and expands it again on later
requests.

This is intentionally not automatic compression, not conversation persistence,
and not OpenAI's official encrypted platform format.

## What It Does

1. Call `POST /responses/compact` with the context you want to summarize.
2. NewAPI returns a local `type: "compaction"` item with `encrypted_content`.
3. Send that item back through `/responses` or `/chat/completions`.
4. NewAPI expands it into a system-level context summary before calling the
   upstream model.

The original long context is not stored by the gateway. The client remains
responsible for deciding when to compact and which recent messages to keep.

## Create A Compaction Item

```bash
curl -X POST "$BASE_URL/responses/compact" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "input": [
      {
        "role": "user",
        "content": [
          {
            "type": "input_text",
            "text": "Project facts: NewAPI is an API gateway. Do not continue prompt cache work. Keep manual context compaction."
          }
        ]
      }
    ],
    "max_output_tokens": 512
  }'
```

The response includes an item like this:

```json
{
  "type": "compaction",
  "encrypted_content": "..."
}
```

`encrypted_content` is an opaque NewAPI payload. It is not OpenAI's official
platform encryption format.

## Continue Through Responses

```bash
curl -X POST "$BASE_URL/responses" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "input": [
      { "type": "compaction", "encrypted_content": "<encrypted_content>" },
      {
        "role": "user",
        "content": [
          { "type": "input_text", "text": "Continue from the compacted context." }
        ]
      }
    ],
    "max_output_tokens": 512
  }'
```

## Continue Through Chat Completions

Top-level `messages` item:

```bash
curl -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [
      { "type": "compaction", "encrypted_content": "<encrypted_content>" },
      { "role": "user", "content": "Continue from the compacted context." }
    ],
    "max_tokens": 512
  }'
```

Inside a message content array:

```json
{
  "model": "claude-haiku-4-5",
  "messages": [
    {
      "role": "system",
      "content": [
        { "type": "compaction", "encrypted_content": "<encrypted_content>" }
      ]
    },
    { "role": "user", "content": "Continue." }
  ],
  "max_tokens": 512
}
```

## Limits

- This is manual only. NewAPI does not automatically compact long requests.
- NewAPI does not persist `response_id`, conversations, or original input
  messages.
- The summary is lossy. Keep recent important turns in full when exact detail
  matters.
- Bad or unknown compaction payloads degrade to an opaque fallback summary
  instead of exposing internal errors.
- Gemini `stream: true` remains proxy-layer pseudo streaming; compaction does
  not change that upstream behavior.
