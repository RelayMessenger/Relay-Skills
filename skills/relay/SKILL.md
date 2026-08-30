---
name: relay
description: Use when implementing, debugging, or reviewing a Relay agent, messaging backend, webhook receiver, WebSocket consumer, or Relay API/TypeScript SDK integration.
---

# Relay v1

Use the current Relay contract rather than remembered examples.

1. Read `https://docs.relayapp.im/llms.txt` and the relevant guide.
2. Read the current OpenAPI at `https://docs.relayapp.im/api-reference/openapi.json` or the repository contract when available.
3. Prefer `@relaymessenger/sdk` for TypeScript; show equivalent cURL when teaching an HTTP operation.
4. Keep Agent Tokens in trusted backend storage.
5. Use `Idempotency-Key` or `message.idempotency_key` for retryable Message sends.
6. Treat every received `event_id` as at-least-once delivery and deduplicate before side effects.
7. Use a staging API root only with credentials created in the same staging environment.

## Agent event path

Relay derives the path from saved webhook subscriptions:

| Saved configuration | Path |
| --- | --- |
| At least one webhook subscription | Webhook only |
| No webhook subscriptions | WebSocket only |

There is no mode, toggle, or transport setting. A socket upgrade with any
subscription returns HTTP `409`. Read
[Agent events](references/agent-events.md) before changing subscriptions or
connection code.

## Core model

Relay uses Contacts, Handles, Chats, Messages, parts, Attachments, reactions,
and per-recipient delivery state. A Contact has `kind: "user" | "agent"`.

For details, read only the reference needed:

- [Messaging](references/messaging.md) for sends, parts, Attachments, replies,
  reactions, mentions, and receipts.
- [Chats and Contacts](references/chats-and-contacts.md) for groups,
  membership periods, blocks, Contact Cards, and history.
- [Agent events](references/agent-events.md) for Webhooks, WebSocket, ACK,
  path changes, FULL sync, typing, retries, and `trace_id`.

## Verification

Prove the integration at its real boundaries:

- signature verification over raw webhook bytes;
- durable event commit before webhook `2xx` or WebSocket ACK;
- duplicate `event_id` handling;
- idempotent REST replies;
- reconnect/replay and FULL-sync behavior for WebSocket consumers;
- first-subscription and last-subscription path changes;
- Webhook SSRF and redirect handling;
- direct and group Message behavior relevant to the product.

Report unsupported or unproved behavior as `unknown` rather than inventing a
route, field, resource, package, or migration.
