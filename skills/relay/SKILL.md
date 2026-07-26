---
name: relay
description: >
  Build AI agents people message like contacts, with Relay — the native
  messenger for independently operated AI agents. Your backend keeps its own
  model, tools, and hosting; Relay owns the consumer app, profiles,
  conversations, delivery, media, and safety. The integration is plain HTTPS
  and JSON against https://api.relayapp.im with one Agent Token — no SDK.
  Use this skill for any Relay question — quickstart (register a signed
  webhook, receive message.received, reply with an idempotent POST
  /v1/messages), creating and connecting an agent, Agent Token auth and
  rotation, sending ordered typed parts (text, media, voice_memo,
  link_preview, data), attachments, streaming a Vercel AI SDK UIMessageStream
  v1 into one canonical message, typing indicators, reactions and tapbacks,
  delivery and read receipt watermarks, interactive message components
  (buttons, select, confirm, card, agent permission request) with
  origin-tagged tap results, Standard Webhooks signature verification and
  secret rotation, durable long polling with cursors, group conversations and
  invocation_id replies, conversation history recovery, identifying users,
  rate limits and size limits, error codes, and the developer-preview
  availability matrix.
  Keywords: relay, relayapp, relay api, ai agent messenger, agent inbox,
  message agent, agent token, rly_live, webhook, standard webhooks,
  webhook-signature, message.received, message.delivered, message.read,
  reaction.added, conversation.added, invocation_id, idempotency-key,
  idempotent send, POST /v1/messages, /v1/webhooks, /v1/events, long polling,
  cursor, UIMessageStream, vercel ai sdk, stream=true, typed parts, text part,
  data part, media part, voice memo, link preview, quick replies, suggestions,
  message components, buttons component, select component, confirm component,
  card component, agent_permission_request, tapback, read receipt, typing
  indicator, group conversation, group invocation, conversation history,
  attachment upload, capability url, rate limit, 429, 202 accepted,
  agent-to-user messaging, consumer messaging channel, imessage-style agent.
license: MIT
metadata:
  author: companion-inc
  version: "1.0.0"
---

# Relay

Relay is a native messenger for AI agents: people add an agent like a contact,
message it in a durable conversation, and your backend answers over plain
HTTPS. Relay owns identity, profiles, conversations, ordering, delivery, sync,
notifications, media transport, installation, and safety; you own the model,
prompts, tools, memory, and hosting. There is no SDK to adopt — one Agent
Token authenticates `https://api.relayapp.im`, and events arrive by signed
webhook or long polling.

## How this skill is organized

| File | Covers |
| --- | --- |
| `getting-started.md` | The quickstart loop, creating and connecting an agent, Agent Token auth and rotation |
| `messages.md` | Ordered typed parts, attachments, voice memos, link previews, quick replies, reactions |
| `streaming.md` | Piping a Vercel AI SDK UIMessageStream v1 into one canonical message; typing indicators |
| `components.md` | Interactive components: buttons, select, confirm, card, permission request, and their tap results |
| `events-and-delivery.md` | The delivery model, signed webhooks, long polling, every event payload, receipts, history recovery, identifying users |
| `groups.md` | Group conversations, the invocation boundary, `invocation_id` replies, conversation lifecycle |
| `limits-and-errors.md` | Every size/rate limit, error codes and retry guidance, data access boundaries, the availability matrix |

## The core loop

1. A person creates the agent in Relay (**New Message → Create Agent**) and
   copies the Agent Token, shown exactly once.
2. Your backend registers a webhook: `POST /v1/webhooks` returns the signing
   secret once.
3. Relay POSTs signed `message.received` events; verify the Standard Webhooks
   signature, deduplicate on `event_id`, return `2xx` fast.
4. Reply with `POST /v1/messages`, deriving `Idempotency-Key` from the
   inbound `event_id` so retries can never double-send. Relay returns
   `202 Accepted` with the canonical message.

Always read `getting-started.md` first; it contains the complete runnable
quickstart. The live documentation mirror of this skill is
<https://docs.relayapp.im> — every page also serves raw Markdown by appending
`.md`, the whole site is at `/llms-full.txt`, and an MCP docs-search server
runs at `https://docs.relayapp.im/mcp`.
