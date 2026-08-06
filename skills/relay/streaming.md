<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> There is no Relay SDK. Do not import a relay package; use raw HTTPS and JSON.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Streaming replies

> Pipe an existing Vercel AI SDK UI message stream into Relay in one request.

Send one request with `stream=true` and pipe a Vercel AI SDK `UIMessageStream v1`
into its body. Relay consumes the whole stream and commits one stored message
when it finishes.

## Pipe an AI SDK response

Use the `conversation_id` from `message.received` and derive the idempotency key
from that event's `event_id`.

```ts
const result = streamText({ model, messages });
const uiResponse = result.toUIMessageStreamResponse();

const relayResponse = await fetch(
  `${process.env.RELAY_API_URL}/v1/messages?stream=true&conversation_id=${event.data.message.conversation_id}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RELAY_AGENT_TOKEN}`,
      "Idempotency-Key": `reply-${event.event_id}`,
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
    body: uiResponse.body,
    duplex: "half",
  },
);

if (!relayResponse.ok) throw new Error(await relayResponse.text());
```

## Wire request

The same contract can be exercised without a framework:

```bash
curl -sS -X POST \
  "$RELAY_API_URL/v1/messages?stream=true&conversation_id=cnv_01JZC7K4RQ" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -H "Content-Type: text/event-stream" \
  -H "x-vercel-ai-ui-message-stream: v1" \
  --data-binary @reply.sse
```

`reply.sse` uses the AI SDK's existing framing:

```text
data: {"type":"start","messageId":"ui-message-42"}

data: {"type":"text-start","id":"answer"}

data: {"type":"text-delta","id":"answer","delta":"Tomorrow at "}

data: {"type":"text-delta","id":"answer","delta":"2:00 PM works."}

data: {"type":"text-end","id":"answer"}

data: {"type":"finish","finishReason":"stop"}

data: [DONE]

```

Relay returns the normal `202` message response once the message is committed.

## What Relay preserves

| AI SDK part                         | Relay presentation                                          |
| ----------------------------------- | ----------------------------------------------------------- |
| Text parts                          | `text` parts                                                |
| Tool input and output               | A transcript `tool_call` data part; Relay never executes it |
| URL sources                         | `link_preview` parts                                        |
| Files and document sources          | Transcript artifact parts when they have usable metadata    |
| Reasoning and transient custom data | Remain private to the agent backend                         |

## Completion and recovery

* `finish` is semantic completion. `[DONE]` only closes the transport; it does
  not commit a message by itself.
* `abort`, `error`, malformed ordering, or an early disconnect writes no
  transcript row.
* A successful stream stores one message and sends one notification.
* Retry the whole request with the same `Idempotency-Key`. The same completed
  stream returns the original message; different content returns
  `409 idempotency_conflict`.
* A disconnected app recovers the final message through normal cursor sync
  and history.

Use a separate [typing indicator](https://docs.relayapp.im/guides/typing-indicators) before the output
stream begins when the agent has a long planning or tool phase.

## Next steps

* [Sending finalized messages](https://docs.relayapp.im/guides/sending-messages)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [API overview](https://docs.relayapp.im/api-reference/overview)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> There is no Relay SDK. Do not import a relay package; use raw HTTPS and JSON.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Typing indicators

> Show live typing state while your backend prepares a reply.

Show a typing indicator while your backend is working:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/typing" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "started": true }'
```

Relay returns `204 No Content`. The signal is ephemeral: it is pushed to active devices and never enters the event log, so no webhook or long poll replays it. The agent must be a participant in the conversation.

Add a short status line with `label`:

```json
{ "started": true, "label": "Searching the web…" }
```

Labels can contain up to 80 characters.

## Stop typing

If no message follows, stop the indicator explicitly:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/typing" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "started": false }'
```

Sending a message clears the visible indicator. If a reply may abort before sending, put the stop request in cleanup logic.

For a long planning or tool phase, start typing before the output stream and
stop when the first visible content arrives.

## Next steps

* [Streaming replies](https://docs.relayapp.im/guides/streaming)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
