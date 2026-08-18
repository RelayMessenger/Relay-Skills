<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Delivery model

> How Relay stores messages, delivers events, prevents duplicates, and recovers after failure.

What survives a restart, and what does not.

|                    | Stored | Examples                                                                 |
| ------------------ | :----: | ------------------------------------------------------------------------ |
| Survives a restart |    ✅   | Messages, ordered history, webhook events, reactions, receipt watermarks |
| Does not           |    ❌   | Typing indicators, in-flight stream deltas                               |

## Incoming messages

Use webhooks or long polling, not both. Polling with a webhook enabled returns
`409 conflict`.

```mermaid
flowchart LR
  U["User sends"] --> C["Commit to<br/>conversation"]
  C --> L["Event log<br/>(kept 7 days)"]
  L --> W["Signed webhook<br/>Relay pushes"]
  L --> P["Long poll<br/>you pull"]
  W --> B["Your backend"]
  P --> B
  B -- "POST /v1/messages<br/>Idempotency-Key" --> C
```

| Transport                           | Use it when                                              |
| ----------------------------------- | -------------------------------------------------------- |
| [Signed webhooks](https://docs.relayapp.im/guides/webhooks) | Your backend can accept public inbound HTTPS             |
| Long polling                        | Your backend cannot, such as a local coding-agent bridge |

> **Warning:**
>   The two transports are mutually exclusive. Polling while a webhook is enabled
>   returns `409 conflict`.

  
    **Step 1: Verify and deduplicate**

Verify the signature before parsing, then deduplicate on `event_id`.

**Step 2: Accept, then work**

Save the event and return `2xx` within 10 seconds. Do model or tool work after.

    A successful `message.received` webhook advances the delivered watermark. Mark it
    read separately once your backend has consumed it.

    See [Webhooks](https://docs.relayapp.im/guides/webhooks) for registration, signature verification, and
    secret rotation.
  

  
    `GET /v1/events` returns events strictly after the supplied cursor, plus a
    `next_cursor`.

    ```bash
    curl -sS "$RELAY_API_URL/v1/events?cursor=1042&timeout=30" \
      -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
    ```

    | Parameter | Behavior                                                                 |
    | --------- | ------------------------------------------------------------------------ |
    | `cursor`  | Returns events strictly after this sequence                              |
    | `timeout` | 0 to 30 seconds. `timeout=0` returns immediately with any pending events |

    Persist the complete returned page and its `next_cursor` atomically before the
    next request. Supplying that cursor on the next request acknowledges everything
    through it and governs redelivery.

    > **Info:**
>       Redelivery is governed by the cursor you send next, not by the delivered receipt.
>

    Cursors are scoped to the agent, not the token. Rotating an Agent Token never
    resets the ledger.

    Long-poll error codes:

    | Status | Code                           | What happened                                        | What to do                                                                               |
    | ------ | ------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
    | `422`  | `invalid_request`              | Your cursor is ahead of Relay's delivered ledger     | Resume from `error.details.highest_delivered_cursor` after reconciling history over REST |
    | `409`  | `terminated_by_other_consumer` | A newer poll took over the token                     | Run one poller per Agent Token; a second poll terminates the first                       |
    | `409`  | `conflict`                     | A webhook is enabled                                 | Disable the webhook or use it instead                                                    |
    | `410`  | `cursor_expired`               | The cursor is behind the seven-day retention ceiling | Stop and reconcile from history. Do not reset to zero                                    |
  

## Outgoing messages

`POST /v1/messages` returns `202 Accepted`. That means Relay stored the message.
Delivery and read arrive later as `message.delivered` and `message.read`.

Every send requires an `Idempotency-Key`.

| Reuse                       | Result                           |
| --------------------------- | -------------------------------- |
| Same key, same request      | The original message is returned |
| Same key, different request | `409 idempotency_conflict`       |

Derive the key from the incoming `event_id`. A redelivered event then produces
the same write instead of a duplicate reply.

## Delivery and read state

Receipts are monotonic watermarks through a conversation sequence:

```text
sent → delivered → read
```

Relay emits `message.delivered` and `message.read` only when the corresponding
watermark advances. Read implies delivered. Conversation history projects those
watermarks onto each message.

## Live state

Typing indicators never appear in `GET /v1/events` or webhooks. A streaming reply
writes no partial rows: Relay stores one message when the stream finishes, and
sends one notification.

> **Warning:**
>   If generation aborts, errors, or disconnects before completion, Relay commits
>   nothing. Retry the complete stream with the same idempotency key.

## Recovery rule

After any uncertainty, reconcile from [conversation history](https://docs.relayapp.im/guides/conversation-history).
Do not rebuild state from delivery attempts or retry responses.

## Next steps

* [Webhooks](https://docs.relayapp.im/guides/webhooks) for registration, verification, and rotation
* [Embed Relay in your own runtime](https://docs.relayapp.im/integrations/channel-plugin) if you maintain an agent host runtime
* [Event types](https://docs.relayapp.im/reference/events) for every payload shape
* [Read receipts](https://docs.relayapp.im/guides/read-receipts) for the action and lifecycle
* [Conversation history](https://docs.relayapp.im/guides/conversation-history) for reconciliation
* [Errors](https://docs.relayapp.im/reference/errors) for the full status and code table


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Webhooks

> Register an HTTPS receiver, verify signatures, and process at-least-once delivery safely.

Relay sends each agent event to its registered HTTPS endpoints.

## Register an endpoint

```bash
curl -sS -X POST "https://api.relayapp.im/v1/webhooks" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://agent.example/webhooks/relay",
    "events": ["message.received", "reaction.added", "reaction.removed"]
  }'
```

Production endpoints must use public HTTPS URLs. An agent may have up to five
enabled endpoints; disabled ones do not count.

Relay returns a `whsec_...` signing secret only when the endpoint is created or
its secret is rotated. Store it in a secret manager.

When an endpoint is first registered, Relay queues matching events from the
preceding 24 hours, capped at 1,000.

## Verify every request

Relay follows the [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
signing format:

| Header              | Value                                                |
| ------------------- | ---------------------------------------------------- |
| `webhook-id`        | The event's stable `event_id`                        |
| `webhook-timestamp` | Unix seconds when this attempt was signed            |
| `webhook-signature` | One or more space-separated `v1,<base64>` signatures |

Compute HMAC-SHA256 over this exact UTF-8 value:

```text
webhook-id.webhook-timestamp.raw-request-body
```

Decode the base64 value after `whsec_` before using it as the HMAC key. Compare
signatures in constant time and reject timestamps more than five minutes from the
current time. Verify the raw bytes before JSON parsing; reserializing JSON changes
the signature.

In JavaScript:

```bash
npm install standardwebhooks
```

```ts
import { Webhook } from "standardwebhooks";

const rawBody = await request.text();
const event = new Webhook(env.RELAY_WEBHOOK_SECRET).verify(rawBody, {
  "webhook-id": request.headers.get("webhook-id") ?? "",
  "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  "webhook-signature": request.headers.get("webhook-signature") ?? "",
});
```

On Cloudflare Agents: verify in `onRequest()`, enqueue with the Agent SDK's
`this.queue()`, and return `202` before model or tool work.

## Acknowledge and deduplicate

Return any `2xx` once your backend has stored the event. Requests time out after
10 seconds.

Relay retries timeouts, connection errors, `408`, `429`, and `5xx` responses with
exponential backoff and jitter for up to 10 attempts. Every other response,
including redirects and other `4xx`, is a permanent failure: the delivery
dead-letters immediately with no retry.

Store `event_id` as a unique key before producing side effects. Derive outbound
message idempotency keys from it, for example `reply:<event_id>`.

A successful `message.received` delivery advances the agent's delivered watermark.
Mark the message read only after your backend consumes it.

## Manage endpoints

  ```bash List
  # Signing secrets are never returned.
  curl -sS "https://api.relayapp.im/v1/webhooks" \
    -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
  ```

  ```bash Update
  # Change URL, event filters, or enabled state.
  curl -sS -X PATCH "https://api.relayapp.im/v1/webhooks/wh_..." \
    -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"enabled":false}'
  ```

  ```bash Rotate secret
  # The new signing secret is returned once. Relay signs with both the new and
  # previous secret for 24 hours.
  curl -sS -X POST "https://api.relayapp.im/v1/webhooks/wh_.../rotate-secret" \
    -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
  ```

  ```bash Delete
  # Permanent.
  curl -sS -X DELETE "https://api.relayapp.im/v1/webhooks/wh_..." \
    -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
  ```

These are the filters you can subscribe to today:

| Event                                                                  | Fires when                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `message.received`                                                     | A user messages your agent, or invokes it in a group |
| `message.edited`                                                       | A sender edited a visible message                    |
| `message.unsent`                                                       | A sender unsent a message, leaving a tombstone       |
| `message.delivered`                                                    | A recipient's runtime accepted your message          |
| `message.read`                                                         | A recipient read through a sequence                  |
| `reaction.added` / `reaction.removed`                                  | A participant reacted to your message                |
| `conversation.added` / `conversation.updated` / `conversation.removed` | Group membership or metadata changed                 |
| `group.invite.joined` / `group.invite.declined`                        | One invited person answered a group invite           |
| `group.invite.completed` / `group.invite.expired`                      | A group invite reached its terminal state            |

Group invite consent uses the invite endpoint and reports each individual
answer plus the terminal state.

> **Warning:**
>   Ignore unknown event types.

## Next steps

* [Event types](https://docs.relayapp.im/reference/events)
* [Delivery model, including long polling](https://docs.relayapp.im/guides/delivery-model)
* [Embed Relay in your own runtime](https://docs.relayapp.im/integrations/channel-plugin) if your runtime owns many agents
* [Errors](https://docs.relayapp.im/reference/errors)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Event types

> Handle every event envelope and payload Relay emits.

Every event uses the same envelope:

```json
{
  "event_id": "evt_01JZE9M2XW",
  "event_type": "message.received",
  "agent_id": "agt_01JZRELAY",
  "created_at": "2026-07-12T01:21:03.000Z",
  "data": { }
}
```

`event_id` is globally unique and serves as the deduplication key. Delivery is at least once. Ignore unknown `event_type` values so new types do not break the consumer.

See [Delivery model](https://docs.relayapp.im/guides/delivery-model) for webhook acknowledgement,
idempotent writes, live state, and recovery.

## Emitted in v0

### `message.received`

A participant sent a message in one of the agent's direct conversations, or a
human explicitly invoked the agent in a group.

| Field                | Contents                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `data.message`       | The full stored message: `id`, `conversation_id`, `sequence`, `sender`, ordered `parts[]`, `reply_to`, `fallback_text`, `status`, `created_at` |
| `data.invocation_id` | Group deliveries only. Required when replying, see [group conversations](https://docs.relayapp.im/guides/group-conversations)                                          |

The agent's own messages never echo back as `message.received`.

### `message.edited`

The original sender replaced a text-bearing message within its 15-minute edit
window. `data.message` is the full updated message.

`edited_at` marks the latest edit, and `revisions` contains each prior `parts`
and `fallback_text` snapshot from oldest to newest. `data.revision_count` is the
number of stored revisions, from 1 through 5.

```json
{
  "event_type": "message.edited",
  "data": {
    "message": {
      "id": "msg_01K1M9EDITEXAMPLE",
      "conversation_id": "cnv_01K1M9CONVERSATION",
      "sequence": 9,
      "sender": { "kind": "user", "id": "usr_01K1M9ALICE" },
      "parts": [
        { "part_index": 0, "type": "text", "text": "Tomorrow at 3:00 PM works." }
      ],
      "reply_to": null,
      "reactions": [],
      "fallback_text": "Tomorrow at 3:00 PM works.",
      "status": "sent",
      "edited_at": "2026-07-24T20:15:00.000Z",
      "revisions": [
        {
          "parts": [
            { "part_index": 0, "type": "text", "text": "Tomorrow at 2:00 PM works." }
          ],
          "fallback_text": "Tomorrow at 2:00 PM works.",
          "replaced_at": "2026-07-24T20:15:00.000Z"
        }
      ],
      "created_at": "2026-07-24T20:05:00.000Z"
    },
    "revision_count": 1
  }
}
```

In a direct conversation, Relay sends the event to the counterpart agent. In a
group, only agents with an invocation relationship to that message receive it.
Edits do not produce push notifications or change message sequence.

### `message.unsent`

The original sender unsent a message within two minutes of creation. The event
identifies the stable tombstone:

```json
{
  "event_type": "message.unsent",
  "data": {
    "message_id": "msg_01K1M9UNSENT",
    "conversation_id": "cnv_01K1M9CONVERSATION",
    "sequence": 10
  }
}
```

History keeps the id, sequence, sender, status `deleted`, and original
`created_at`, but omits parts and reactions. Unsend uses the same direct and
group agent scope as `message.edited` and does not produce a push notification.

### `message.delivered`

A recipient's runtime accepted the agent's message. Everything through `through_sequence` is delivered to `participant`.

```json
{
  "event_type": "message.delivered",
  "data": {
    "message_id": "msg_01KXEKDSH8M3V5P2R7T9B4C6QD",
    "conversation_id": "cnv_01JZU1CONV",
    "through_sequence": 42,
    "participant": { "kind": "user", "id": "usr_01JZU1X4" },
    "at": "2026-07-13T20:00:01Z"
  }
}
```

### `message.read`

The payload matches `message.delivered`. The participant has read the conversation through `through_sequence`; read implies delivered.

To advance the agent's own read watermark, see [Read receipts](https://docs.relayapp.im/guides/read-receipts).

### `reaction.added` / `reaction.removed`

A participant added or removed a reaction from the agent's message.

```json
{
  "event_type": "reaction.added",
  "data": {
    "reaction": {
      "message_id": "msg_01JZM4Q9VN",
      "part_index": null,
      "type": "emoji",
      "emoji": "🔥",
      "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "operation": "add"
    }
  }
}
```

`part_index` is `null` for whole-message reactions. `emoji` is present if and only if
`type` is `"emoji"`.

### `conversation.added`, `conversation.updated`, and `conversation.removed`

Relay emits these to every active group agent when a human adds or removes the
authenticated agent, renames the group, or changes its avatar. A removed agent
receives no further group events, and pending invocation IDs from an ended
membership period cannot be reused after re-addition.

An agent's group history stays limited to the messages that invoked it and its
own replies. No lifecycle event adds access to the rest of the conversation.

`data` carries `conversation_id`, the human `actor`, the affected participant
when the mutation targets one, the current `membership_version`, the
`system_mutation` with old and new fields, and the system `message` stored in
the conversation. A `conversation.updated` payload omits `affected_participant`,
because metadata updates do not target one member.

  ```json Membership change
  {
    "conversation_id": "cnv_01JZC7K4RQ",
    "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
    "affected_participant": { "kind": "agent", "id": "agt_01JZRELAY" },
    "membership_version": 2,
    "system_mutation": {
      "type": "group.mutation",
      "mutation": "membership.added",
      "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "affected_participant": { "kind": "agent", "id": "agt_01JZRELAY" },
      "changes": {
        "state": { "old": null, "new": "active" },
        "membership_version": { "old": 1, "new": 2 }
      }
    },
    "message": {
      "id": "msg_01JZM3T8AH",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 4,
      "sender": { "kind": "system", "id": "system" },
      "parts": [
        { "part_index": 0, "type": "text", "text": "Scheduler was added" },
        {
          "part_index": 1,
          "type": "data",
          "data": {
            "type": "group.mutation",
            "mutation": "membership.added",
            "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
            "affected_participant": { "kind": "agent", "id": "agt_01JZRELAY" },
            "changes": {
              "state": { "old": null, "new": "active" },
              "membership_version": { "old": 1, "new": 2 }
            }
          }
        }
      ],
      "reply_to": null,
      "fallback_text": "Scheduler was added",
      "status": "sent",
      "created_at": "2026-07-17T12:00:00.000Z"
    }
  }
  ```

  ```json Metadata change
  {
    "conversation_id": "cnv_01JZC7K4RQ",
    "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
    "membership_version": 2,
    "system_mutation": {
      "type": "group.mutation",
      "mutation": "metadata.updated",
      "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "changes": {
        "title": { "old": "Weekend", "new": "Weekend plans" },
        "avatar_url": { "old": null, "new": "https://cdn.relayapp.im/group.png" }
      }
    },
    "message": {
      "id": "msg_01JZM3T8AH",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 5,
      "sender": { "kind": "system", "id": "system" },
      "parts": [
        { "part_index": 0, "type": "text", "text": "Mira updated the group" },
        {
          "part_index": 1,
          "type": "data",
          "data": {
            "type": "group.mutation",
            "mutation": "metadata.updated",
            "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
            "changes": {
              "title": { "old": "Weekend", "new": "Weekend plans" },
              "avatar_url": { "old": null, "new": "https://cdn.relayapp.im/group.png" }
            }
          }
        }
      ],
      "reply_to": null,
      "fallback_text": "Mira updated the group",
      "status": "sent",
      "created_at": "2026-07-17T12:00:00.000Z"
    }
  }
  ```

Both variants carry the mutation twice on the system message: once as a
human-readable text part and once as a structured `data` part.

A backend receives these lifecycle events but cannot create a group or change
its membership; see [API availability](https://docs.relayapp.im/roadmap).

### `group.invite.joined` / `group.invite.declined`

`group.invite.joined` fires on every accept and carries `invite_id`, the
`conversation_id` that person is now in, and their `user_id`. The first accept
creates that conversation, and later accepts join it.

`group.invite.declined` carries `invite_id` and `user_id`.

```json
{
  "event_type": "group.invite.joined",
  "data": {
    "invite_id": "inv_01K1M8FOUNDERSDINNER",
    "conversation_id": "cnv_01K1M8NEWGROUP",
    "user_id": "usr_01K1M8ALICE"
  }
}
```

### `group.invite.completed` / `group.invite.expired`

An invite reaches its terminal state once every invited user answers or its
deadline passes. It completes when a conversation went live, with `invite_id`
and that `conversation_id`, and expires when nobody joined, with `invite_id`
alone.

```json
{
  "event_type": "group.invite.completed",
  "data": {
    "invite_id": "inv_01K1M8FOUNDERSDINNER",
    "conversation_id": "cnv_01K1M8NEWGROUP"
  }
}
```

A decline closes that person's card alone. It leaves the conversation and the
rest of the invite untouched.

Group mutations are an off-by-default preview. Existing group history remains
readable if availability is turned off; the gate prevents new membership and
metadata writes.

## Specified, coming soon

The Relay contract also defines `message.failed`, typing events that enter the
event log, `attachment.available`, install events, and the `call.*` family.
These are **not emitted by v0**. See [API availability](https://docs.relayapp.im/roadmap).

## See also

* [Webhooks](https://docs.relayapp.im/guides/webhooks)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [API availability](https://docs.relayapp.im/roadmap)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Read receipts

> Mark inbound messages read and follow delivery and read state on your replies.

Mark an inbound message read after your backend has consumed it:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/read" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "message_id": "msg_01JZM3T8AH" }'
```

## Receipt watermarks

| Rule                                                 | Behavior                                           |
| ---------------------------------------------------- | -------------------------------------------------- |
| Marking one message read                             | Covers every earlier message in the conversation   |
| Read state                                           | Implies delivered                                  |
| Repeating the request, or targeting an older message | Idempotent no-op                                   |
| Target                                               | Applies only to a message from another participant |

## Track your replies

Relay emits two events as your reply moves through the conversation.

| Event               | Emitted when                                 |
| ------------------- | -------------------------------------------- |
| `message.delivered` | A user's runtime accepts the agent's message |
| `message.read`      | The user reads through it                    |

Both carry `through_sequence`: every message through that sequence has reached
the same state for that participant.

Conversation history projects the watermark onto each outbound message as
`sent`, `delivered`, or `read`.

| Use                                                  | When                                    |
| ---------------------------------------------------- | --------------------------------------- |
| Events                                               | Your backend needs to react immediately |
| [Conversation history](https://docs.relayapp.im/guides/conversation-history) | Rebuilding state after a restart        |

## Next steps

* [Event types](https://docs.relayapp.im/reference/events) for the receipt payloads
* [Webhooks](https://docs.relayapp.im/guides/webhooks) for signature and redelivery behavior
* [Delivery model](https://docs.relayapp.im/guides/delivery-model) for the full watermark lifecycle


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Conversation history

> Read a conversation's messages for context with cursor pagination.

Read conversation history after a restart, on a cold start, or when rebuilding a prompt window.

```bash
curl -sS "https://api.relayapp.im/v1/conversations/cnv_01JZC7K4RQ/messages?limit=50" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

Messages return **newest first** with ordered `parts[]`, `sequence`, `reply_to`,
reactions, revision history, and a receipt-projected `status` (`sent`,
`delivered`, or `read`):

```json
{
  "messages": [
    {
      "id": "msg_01JZM4Q9VN",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 2,
      "sender": { "kind": "agent", "id": "agt_01JZRELAY" },
      "parts": [{ "part_index": 0, "type": "text", "text": "Tomorrow at 2:00 PM works." }],
      "reply_to": { "message_id": "msg_01JZM3T8AH", "part_index": 0 },
      "reactions": [],
      "fallback_text": "Tomorrow at 2:00 PM works.",
      "status": "read",
      "edited_at": "2026-07-12T01:21:12.000Z",
      "revisions": [
        {
          "parts": [{ "part_index": 0, "type": "text", "text": "Tomorrow at 1:00 PM works." }],
          "fallback_text": "Tomorrow at 1:00 PM works.",
          "replaced_at": "2026-07-12T01:21:12.000Z"
        }
      ],
      "created_at": "2026-07-12T01:21:08.000Z"
    }
  ]
}
```

`revisions` is ordered from oldest to newest and is empty for a message that
has never been edited. Each entry preserves the prior parts and fallback text.
`edited_at` is present after the first edit.

An unsent message keeps its place in sequence order but projects as a bare
tombstone:

```json
{
  "id": "msg_01K1M9UNSENT",
  "conversation_id": "cnv_01JZC7K4RQ",
  "sequence": 3,
  "sender": { "kind": "user", "id": "usr_01JZU1F0BD" },
  "status": "deleted",
  "created_at": "2026-07-12T01:21:10.000Z"
}
```

Tombstones do not expose parts, fallback text, reactions, or revisions.

## Pagination

`limit` accepts 1–100 and defaults to 50. To page backward, pass your lowest `sequence` as `before_sequence`.

```bash
curl -sS ".../messages?before_sequence=2&limit=50" ...
```

An empty `messages` array means you have reached the start of the conversation.

## Notes

* History is available while the agent participates in the conversation (`403 forbidden` otherwise).
* `sequence` orders messages *within one conversation*. It is unrelated to a webhook `event_id`.
* History is the recovery path after an event gap or uncertain delivery.

## Next steps

* [Read receipts](https://docs.relayapp.im/guides/read-receipts)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [Conversation lifecycle](https://docs.relayapp.im/guides/conversation-lifecycle)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Identifying users

> Turn a message's sender.id into the human's name and phone number.

A `message.received` event carries the sender under `data.message.sender`:

```json
"sender": { "kind": "user", "id": "usr_01JZU1F0BD" }
```

That `usr_…` id is stable: the same user always has the same id, in direct
chats and in groups. Use it to key your own records.

## Resolve the name and phone

Call `GET /v1/users/{user_id}` (see the **API Reference** tab):

```bash
curl https://api.relayapp.im/v1/users/usr_01JZU1F0BD \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

```json
{
  "user": {
    "id": "usr_01JZU1F0BD",
    "name": "Rushil Kagithala",
    "first_name": "Rushil",
    "last_name": "Kagithala",
    "phone_number": "+13135550123",
    "avatar_url": null,
    "created_at": "2026-07-12T01:20:00.000Z"
  }
}
```

`name` is the stored value. `first_name` and `last_name` are a
convenience split of `name` on the first space, so a two-word given name puts
its tail in `last_name`. Greet with them, but store `name` if you need the
exact value.

> **Tip:**
>   In a group, read `sender.id` from each `message.received` to tell participants
>   apart: three users in a thread are three distinct `usr_…` ids.

## Scope

You can only resolve a user you **currently share an active conversation
with** (direct or group). Any other id, one you have no active conversation
with or one that does not exist, returns `404`:

```json
{ "error": { "code": "not_found", "message": "user not found" } }
```

The two cases are deliberately indistinguishable, so the endpoint can't be
used to enumerate accounts or confirm who owns a phone number. If a user
leaves the conversation or removes your agent, the lookup stops resolving them.

## Next steps

* [Developer data access and retention](https://docs.relayapp.im/reference/data-and-permissions)
* [Conversation lifecycle](https://docs.relayapp.im/guides/conversation-lifecycle)
* [Trust and data](https://docs.relayapp.im/trust-and-data)
