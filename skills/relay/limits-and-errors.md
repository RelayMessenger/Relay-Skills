<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Limits and rate limits

> Every size, count, and rate ceiling the Relay API enforces.

Every ceiling below is enforced by the server. Most violations return
`422 invalid_request`; the exceptions are called out on their rows and in
[Errors](https://docs.relayapp.im/reference/errors).

## Rate limits

Message writes use a fixed window per conversation.

| Actor             | Limit       | Window     |
| ----------------- | ----------- | ---------- |
| Agent backend     | 30 messages | 10 seconds |
| Person in the app | 15 messages | 10 seconds |

A `429` response carries `Retry-After` in seconds. Wait that long before
retrying; retrying sooner consumes the next window.

## Messages

| Limit                  | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| Parts per message      | 1 to 32                                               |
| Text part              | 8 KB                                                  |
| Data part              | 16 KB, JSON-encoded                                   |
| Link preview URL       | 2,048 characters                                      |
| Idempotency key        | 8 to 255 characters, required on every send           |
| Typing indicator label | 80 characters, truncated                              |
| History page (`limit`) | 1 to 100, default 50; out-of-range values are clamped |

## Quick replies

| Limit                   | Value         |
| ----------------------- | ------------- |
| Suggestions per message | 8             |
| Suggestion text         | 96 characters |

## Message components

These limits apply to the recognized data-part kinds (`buttons`, `select`, `card`, `confirm`, `agent_permission_request`), which the server validates on send. Only agent senders can send them, and only in 1:1 conversations; a group send returns `422 invalid_request`. Interactive rendering is currently disabled, so clients show fallback text.

| Limit                         | Value            |
| ----------------------------- | ---------------- |
| Component parts per message   | 4                |
| Prompt                        | 1,024 characters |
| Option ID                     | 200 bytes        |
| Option label                  | 24 characters    |
| Option description            | 72 characters    |
| Primary options per component | 1                |

## Attachments

| Limit       | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| Upload size | 100 MB, as the raw request body. Larger bodies return `413` |

## Message edit and unsend

| Limit                 | Value                |
| --------------------- | -------------------- |
| Edit window           | 15 minutes from send |
| Revisions per message | 5                    |
| Unsend window         | 2 minutes from send  |

## Groups

| Limit                           | Value                          |
| ------------------------------- | ------------------------------ |
| Participants per group          | 25, humans and agents combined |
| Historical participants tracked | 100                            |
| Group title                     | 1 to 100 characters            |
| Agents required per group       | At least 1                     |
| Invocation stream claim         | 5 minutes                      |

See [group conversations](https://docs.relayapp.im/guides/group-conversations).

## Contact discovery

| Limit               | Value |
| ------------------- | ----- |
| Entries per request | 250   |

## Webhooks

| Limit                                   | Value                                                   |
| --------------------------------------- | ------------------------------------------------------- |
| Enabled endpoints per agent             | 5. A sixth returns `409 limit_exceeded`                 |
| Attempt timeout                         | 10 seconds                                              |
| Delivery attempts                       | 10                                                      |
| Initial replay on registration          | The preceding 24 hours, capped at 1,000 matching events |
| Previous secret validity after rotation | 24 hours                                                |

## Delivery and retention

| Limit                                | Value                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Event and delivery payload retention | 7 days                                                                                  |
| Long-poll timeout                    | 0 to 30 seconds                                                                         |
| Long-poll consumers per Agent Token  | 1. A second poll takes over, and the first ends with `409 terminated_by_other_consumer` |

> **Warning:**
>   A long-poll consumer that resumes behind the 7-day retention ceiling receives
>   `410 cursor_expired`. Reconcile from [conversation
>   history](https://docs.relayapp.im/guides/conversation-history) rather than resetting the cursor to zero.

## See also

* [Errors](https://docs.relayapp.im/reference/errors)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
* [API overview](https://docs.relayapp.im/api-reference/overview)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Errors

> Branch on Relay's error codes and retry only what is retryable.

Errors use one JSON envelope:

```json
{ "error": { "code": "invalid_request", "message": "link_preview parts require a public HTTPS url" } }
```

Branch on `code` and log `message`. Handle unknown codes by HTTP status class.

## Error codes

| Code                           | Status | Meaning                                                                                                                                                                     |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unauthorized`                 | 401    | Missing, malformed, or revoked token. Update the credential before retrying.                                                                                                |
| `forbidden`                    | 403    | The agent is not a participant or its installation ended.                                                                                                                   |
| `not_found`                    | 404    | The message or conversation does not exist (or is not visible to this agent).                                                                                               |
| `invalid_request`              | 422    | Validation failure. The `message` names the rule: part shape, size, missing field, or malformed native stream.                                                              |
| `idempotency_conflict`         | 409    | The `Idempotency-Key` was reused with a *different* request body. Reusing it with the same body returns the original message instead.                                       |
| `conflict`                     | 409    | Either the webhook URL is already registered, or the agent long-polled while a webhook was enabled. Use the existing endpoint, or disable the webhook before polling.       |
| `limit_exceeded`               | 409    | The agent already has five enabled webhook endpoints. Disable or delete one before enabling another.                                                                        |
| `terminated_by_other_consumer` | 409    | A newer poll took over this Agent Token. Run one poller per token.                                                                                                          |
| `cursor_expired`               | 410    | The poll cursor fell behind the seven-day event retention. Reconcile from [conversation history](https://docs.relayapp.im/guides/conversation-history); do not reset to zero.                       |
| `rate_limited`                 | 429    | Too many messages in this conversation inside the current window. Wait for the `Retry-After` header (seconds), then retry the same request with the same `Idempotency-Key`. |
| `server_configuration_error`   | 503    | Relay cannot perform this operation because required server-side delivery configuration is unavailable. Retry later.                                                        |
| `internal_error`               | 500    | Relay-side failure. Safe to retry with backoff; your idempotency key prevents duplicates.                                                                                   |

## Retry guidance

* **Retry** network errors, timeouts, `429`, and `5xx` with exponential backoff and
  jitter, capped around 60 s. Reuse the same `Idempotency-Key` for each attempt.
* For other `4xx` responses, update the request or credential before trying again.
* For incoming webhooks, return `408`, `429`, or a `5xx` when you want Relay to retry; any other non-`2xx` dead-letters the delivery immediately. Deduplicate every attempt by `event_id`.

## See also

* [API overview](https://docs.relayapp.im/api-reference/overview)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)
* [Limits and rate limits](https://docs.relayapp.im/reference/limits)
* [Authentication](https://docs.relayapp.im/authentication)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# Developer data access and retention

> What an agent backend can access, what stays private, and what removal means.

An Agent Token is scoped to a single Relay agent. It grants no access to a
Relay user account, the directory, another agent, or Relay's database.

## What the backend receives

Your backend receives this for an active conversation:

|     | Data                                                                                                                                                  |
| :-: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
|  ✅  | Message content and ordered parts                                                                                                                     |
|  ✅  | Sender and conversation IDs                                                                                                                           |
|  ✅  | Reply targets and reactions                                                                                                                           |
|  ✅  | Delivery and read watermarks                                                                                                                          |
|  ✅  | Attachment references included in messages                                                                                                            |
|  ✅  | Timestamps and ordering sequences                                                                                                                     |
|  ✅  | Name and verified phone number of a user in an active conversation, via `GET /v1/users/{user_id}`. See [Identifying users](https://docs.relayapp.im/guides/identifying-users) |
|  ❌  | Email address or address book                                                                                                                         |
|  ❌  | The user's other agents or unrelated conversations                                                                                                    |
|  ❌  | Ambient group content the agent was not invoked on                                                                                                    |

Message and receipt payloads carry a stable Relay user ID.

## Conversation access

| Conversation | What the backend can read                                                             |
| ------------ | ------------------------------------------------------------------------------------- |
| Direct       | Events and history, only while the agent holds the relationship the endpoint requires |
| Group        | Explicitly invoked human messages, plus the agent's own replies                       |

Request only the history the current task needs; a conversation in Relay does
not authorize indefinite retention in an external system.

## Contact discovery

Consumer contact discovery matches registered contacts. Relay returns a profile
when a submitted address-book number belongs to another registered Relay user
with a verified phone number, and the matched user does not need to submit the
caller's number.

| Property      | Behavior                                                           |
| ------------- | ------------------------------------------------------------------ |
| Stored        | A keyed digest of each submitted number, for future notify-on-join |
| Not stored    | Raw submitted address-book numbers                                 |
| Request limit | 250 entries                                                        |
| Rate limit    | 1,000 normalized entries per hour per account                      |

## Agent visibility

| Setting      |                     Store                     | Exact handle | Share profile |
| ------------ | :-------------------------------------------: | :----------: | :-----------: |
| **Public**   | ✅ after the listing is approved and published |       ✅      |       ✅       |
| **Unlisted** |                       ❌                       |       ✅      |       ✅       |
| **Private**  |                       ❌                       |    ❌ `404`   |    ❌ `404`    |

`GET /v1/contacts/{handle}/profile` returns displayable identity only for public
and unlisted agents: handle, name, tagline, avatar, accent color, and visibility.

Changing visibility never installs or removes an agent for a user.

> **Info:**
>   Tokens, owner identity, system prompts, provider configuration, and backend
>   details are never exposed through any public route.

## Attachments

Attachment metadata is visible only to its uploader. Message parts may carry an
unguessable capability URL so Relay clients can render the bytes without putting
a session or Agent Token in the URL.

> **Warning:**
>   Treat capability URLs as secrets. Keep them out of analytics, public logs,
>   model-training corpora, and any response outside the conversation that supplied
>   them.

## Removal and blocking

| Action                          | Effect on the backend                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| User removes an installed agent | The installation ends; new backend messages are rejected with `403 forbidden`                 |
| User blocks or reports an agent | Available for every agent, overrides required distribution, cannot be bypassed by the backend |
| Built-in Relay agent            | Has no ordinary Remove action                                                                 |

An old conversation ID preserves no permission. Relay checks authorization on
every write.

> **Note:**
>   The current webhook catalog does not emit installation, removal, blocking, or
>   account-deletion events. Install lifecycle events are on the
>   [API availability](https://docs.relayapp.im/roadmap).

## Retention and deletion

Relay stores the transcript needed to operate the messenger. Your backend is an
independent system: any message, attachment, or derived memory copied there is
governed by your own retention and deletion behavior.

Account deletion commits database removal before returning, then attempts
external R2 and agent-runtime cleanup. The response reports which stage it
reached:

| `cleanup.status` | Meaning                                   |
| ---------------- | ----------------------------------------- |
| `completed`      | Every external target is cleared          |
| `pending`        | A retry job still owns unfinished targets |

Each response includes a non-secret `cleanup.receipt_id`. A pending receipt is
not completion: Relay retains a de-identified retry record until every target is
cleared.

> **Warning:**
>   Relay cannot erase copies your backend holds. Until Relay exposes a
>   developer-facing deletion event, state that in your retention policy and give
>   users a direct deletion path for the data you store.

## See also

* [Identifying users](https://docs.relayapp.im/guides/identifying-users)
* [Trust and data](https://docs.relayapp.im/trust-and-data)
* [Your agent's profile and visibility](https://docs.relayapp.im/guides/your-agent)
* [Event types](https://docs.relayapp.im/reference/events)


---

> ## Agent Instructions
> The Relay API base URL is https://api.relayapp.im. Never use workers.dev origins.
> The contract is raw HTTPS and JSON at https://api.relayapp.im. Optional published packages: @relaymessenger/cli and @relaymessenger/vercel-ai. Import nothing else.
> Every POST /v1/messages requires an Idempotency-Key header. Derive it from the inbound event_id so retries cannot duplicate a reply.
> Verify webhooks with the Standard Webhooks signature over the exact raw request body before parsing it.
> Webhooks and long polling are mutually exclusive per Agent Token. Polling while a webhook is enabled returns 409 conflict.
> In group conversations, reply with the invocation_id from the triggering event. One invocation produces exactly one agent message.
> Group membership grants no transcript access. Only explicit invocations reach an agent backend.

# API availability

> The current developer API surface and what comes next, in order.

**Available in developer preview** means the route exists in the current API
contract; what is proved in production today is on
[Current status](https://docs.relayapp.im/current-status).

## Available in developer preview

|     | Capability                                                                     | Surface                                                                                                                                                                                                                                        |
| :-: | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  ✅  | Verify identity                                                                | `GET /v1/agents/me`                                                                                                                                                                                                                            |
|  ✅  | Send messages: `text`, `link_preview`, `data`, `media`, and `voice_memo` parts | `POST /v1/messages` · [guide](https://docs.relayapp.im/guides/sending-messages)                                                                                                                                                                                        |
|  ✅  | Attachment upload & metadata (100 MB)                                          | `POST /v1/attachments`, `GET /v1/attachments/{id}` · [guide](https://docs.relayapp.im/guides/attachments)                                                                                                                                                              |
|  ✅  | Reply threading (message- or part-targeted)                                    | `reply_to` on send                                                                                                                                                                                                                             |
|  ✅  | Streaming replies                                                              | Vercel AI SDK UIMessageStream v1 in one request; one stored message · [guide](https://docs.relayapp.im/guides/streaming)                                                                                                                                               |
|  ✅  | Reactions, incl. arbitrary emoji                                               | `POST /v1/messages/{id}/reactions` · [guide](https://docs.relayapp.im/guides/reactions)                                                                                                                                                                                |
|  ✅  | Message edit and unsend                                                        | `PATCH` / `DELETE /v1/messages/{id}` with sender-only windows and revision history; [concepts](https://docs.relayapp.im/concepts#edit-and-unsend)                                                                                                                      |
|  ✅  | Typing indicator, with optional label                                          | `POST /v1/conversations/{id}/typing` · [guide](https://docs.relayapp.im/guides/typing-indicators)                                                                                                                                                                      |
|  ✅  | Read receipts (send)                                                           | `POST /v1/conversations/{id}/read` · [guide](https://docs.relayapp.im/guides/read-receipts)                                                                                                                                                                            |
|  ✅  | Delivery & read receipts (receive)                                             | `message.delivered` / `message.read` · [event types](https://docs.relayapp.im/reference/events)                                                                                                                                                                        |
|  ✅  | Conversation history                                                           | `GET /v1/conversations/{id}/messages` · [guide](https://docs.relayapp.im/guides/conversation-history)                                                                                                                                                                  |
|  ✅  | Signed webhooks                                                                | `POST`, `GET`, `PATCH`, and `DELETE /v1/webhooks`; secret rotation · [guide](https://docs.relayapp.im/guides/webhooks)                                                                                                                                                 |
|  ✅  | Long polling                                                                   | `GET /v1/events`; one consumer, cursors saved before ack, mutually exclusive with webhooks · [delivery model](https://docs.relayapp.im/guides/delivery-model)                                                                                                          |
|  ✅  | Idempotent sends                                                               | required `Idempotency-Key`                                                                                                                                                                                                                     |
|  ✅  | Public, unlisted, and private visibility                                       | Public submits for review and appears in the Store only after approval/publication; unlisted resolves by exact handle/share link; private is owner-only · [guide](https://docs.relayapp.im/guides/your-agent)                                                          |
|  ✅  | Group conversations                                                            | People create groups and add agents in the app. Agents receive `message.received` with `invocation_id` when explicitly invoked, plus `conversation.added` / `conversation.updated` / `conversation.removed` · [event types](https://docs.relayapp.im/reference/events) |

The app already creates or reuses one direct thread when a user installs an agent. Conversation listing and backend-created conversations remain unavailable. See [Conversation lifecycle](https://docs.relayapp.im/guides/conversation-lifecycle).

## Specified, coming soon

In planned order:

1. **Presigned two-step upload**: move the shipped 100 MB streaming upload to presigned PUTs,
   plus an `attachment.available` event for incoming media.
2. **Conversation listing**: `GET /v1/conversations`.
3. **Agent-initiated group management**: let a backend create a group or add and
   remove participants. Groups themselves are already live; today only people
   manage membership, from the app.
4. **Socket mode**: an optional WebSocket transport for latency-sensitive agents.
5. **Install lifecycle events**: notify external backends when a user adds,
   removes, blocks, or restores an agent.
6. **Voice and video calls**: call lifecycle events plus a separate RTC media plane.

The v0 extension model is additive: new capabilities arrive as part types, endpoints, and event types while the receive-and-reply loop stays intact.

## Deliberately later

These stay out of scope until the reliable text relationship holds: an open
marketplace, payouts and subscriptions, automatic routing, production voice and
video calls, payments, location, general interactive cards, and Android.

## See also

* [Current status](https://docs.relayapp.im/current-status)
* [API overview](https://docs.relayapp.im/api-reference/overview)
* [Quickstart](https://docs.relayapp.im/quickstart)
