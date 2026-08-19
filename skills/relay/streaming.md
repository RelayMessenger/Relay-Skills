<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Streaming replies

> Pipe an existing Vercel AI SDK UI message stream into Relay in one request.

Send one request with `stream=true` and pipe a Vercel AI SDK `UIMessageStream v1`
into its body. Relay consumes the whole stream and commits one or more finished
messages when it finishes: each visible non-media part becomes its own message.

The stream is an ingestion format, not a rendering mode. Relay writes no partial
row and sends no partial delta to the app, so the reader sees finished messages
appear, never a bubble typing itself out. Use a
[typing indicator](https://docs.relayapp.im/guides/typing-indicators) to show the agent is working.

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

Exercise the same contract without a framework:

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

Relay returns the normal `202` response, a `messages` array, once every
message is committed. The stream above commits one text message.

## What Relay preserves

| AI SDK part                         | Relay presentation                                       |
| ----------------------------------- | -------------------------------------------------------- |
| Text parts                          | `text` parts                                             |
| URL sources                         | `link_preview` parts                                     |
| Files and document sources          | Transcript artifact parts when they have usable metadata |
| Tool input and output               | Discarded; Relay has no tool-call presentation           |
| Reasoning and transient custom data | Remain private to the agent backend                      |

## Completion and recovery

* **`finish` is semantic completion.** `[DONE]` only closes the transport. It
  commits nothing by itself.
* **`abort`, `error`, malformed ordering, or an early disconnect** writes no
  transcript row.
* **A stream that finishes with nothing a person can read** is rejected. Tool
  activity alone is not message content: put the answer in a text part.
* **A successful stream** stores one or more messages, with one push
  notification for the send as a whole.
* **Retry the whole request** with the same `Idempotency-Key`. The same completed
  stream returns the originally committed messages. Different content returns
  `409 idempotency_conflict`.
* **A disconnected app** recovers the final messages through normal cursor sync
  and history.

Call [`/responding`](https://docs.relayapp.im/guides/read-receipts) with the consumed message before
the output stream begins. Relay commits Read before the typing signal starts.

## Next steps

* [Sending finalized messages](https://docs.relayapp.im/guides/sending-messages)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [API overview](https://docs.relayapp.im/api-reference/overview)


---

# Typing indicators

> Send temporary response or proactive typing state without changing delivery receipts.

Use `/responding` for ordinary replies. It commits Read for the consumed message
before it starts typing:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/responding" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "msg_01JZM3T8AH",
    "label": "Searching the web…"
  }'
```

Group responses also require the matching `invocation_id`.

## Proactive typing

Use `/typing` when activity has no inbound target:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/typing" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "started": true, "label": "Preparing an update…" }'
```

Relay returns `204 No Content`.

* **Independent state.** Typing does not advance Delivered or Read.
* **Ephemeral state.** Relay pushes it to active devices and never logs it.
* **Temporary state.** Refresh a long-running start before its expiry.
* **Scoped state.** Group typing requires a pending `invocation_id`.
* **Budgeted state.** Past 120 signals a minute the route answers
  `429 rate_limited` with `Retry-After` in seconds. Refresh on a timer, not on
  every token.

A conversation can correctly show Delivered and typing together. This means the
runtime accepted one message while the participant sent a separate live signal.

## Stop typing

Stop explicitly after send, failure, cancellation, or cleanup:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/typing" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "started": false }'
```

Sending a message also clears the visible indicator. Cleanup still needs an
explicit stop when no message follows.

## Next steps

* [Read receipts](https://docs.relayapp.im/guides/read-receipts)
* [Streaming replies](https://docs.relayapp.im/guides/streaming)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
