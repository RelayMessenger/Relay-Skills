<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Group conversations

> Receive explicit invocations in a group, reply to them, and follow membership changes.

People create groups in the Relay app and add agents to them. Your backend
receives an event only when a human explicitly invokes your agent, and replies
to that invocation with the ID Relay supplied.

## The invocation boundary

Group membership is not transcript authority. This is the single rule that
shapes everything else on this page.

| Your backend receives                      | Your backend does not receive        |
| ------------------------------------------ | ------------------------------------ |
| Messages that explicitly invoke your agent | Ambient group conversation           |
| Your agent's own replies, in history       | Messages between other participants  |
| Membership and metadata lifecycle events   | Any message from before it was added |

> **Warning:**
> An agent added to a group yesterday cannot read what the group said this
>   morning. Only invocations reach you.

## Receive an invocation

A group `message.received` carries an extra `data.invocation_id` alongside the
usual message envelope.

```json
{
  "event_type": "message.received",
  "agent_id": "agt_01JZRELAY",
  "data": {
    "invocation_id": "inv_01JZC7INVOKE",
    "message": {
      "id": "msg_01JZM3T8AH",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 12,
      "sender": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "parts": [{ "part_index": 0, "type": "text", "text": "@scheduler when are we free?" }],
      "status": "sent",
      "created_at": "2026-07-17T12:00:00.000Z"
    }
  }
}
```

Treat `invocation_id` as required state for the reply. Store it with the
`event_id` you are already deduplicating on.

## Reply to an invocation

Reply exactly as you would in a direct conversation, and pass the
`invocation_id` through.

```bash
curl -sS -X POST "$RELAY_API_URL/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "invocation_id": "inv_01JZC7INVOKE",
    "parts": [{ "type": "text", "text": "Thursday after 4pm works for everyone." }]
  }'
```

A streaming reply carries it as a **query parameter**, not a body field:

```bash
curl -sS -X POST \
  "$RELAY_API_URL/v1/messages?stream=true&conversation_id=cnv_01JZC7K4RQ&invocation_id=inv_01JZC7INVOKE" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -H "Content-Type: text/event-stream" \
  -H "x-vercel-ai-ui-message-stream: v1" \
  --data-binary @reply.sse
```

### Invocation errors

| Status                | Message                                                         | Cause                                                |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `403 forbidden`       | `group agent replies require invocation_id`                     | A group reply omitted it                             |
| `403 forbidden`       | `group agent streams require invocation_id`                     | A group stream omitted the query parameter           |
| `403 forbidden`       | `invocation is invalid, completed, or belongs to another agent` | The invocation was already consumed, or is not yours |
| `403 forbidden`       | `invocation belongs to an ended membership period`              | Your agent was removed and re-added since            |
| `403 forbidden`       | `message is outside this agent's invocation scope`              | The reply targets content you were never invoked on  |
| `422 invalid_request` | `invocation_id must be a Relay invocation id`                   | Malformed ID                                         |

> **Warning:**
> An invocation is consumed once. Reuse the same `Idempotency-Key` to retry a
>   reply safely; do not reuse the `invocation_id` for a second, different message.

## Membership and metadata events

Relay emits lifecycle events to every active group agent.

| Event                  | Emitted when                                    |
| ---------------------- | ----------------------------------------------- |
| `conversation.added`   | A human adds your agent to a group              |
| `conversation.updated` | A human renames the group or changes its avatar |
| `conversation.removed` | A human removes your agent                      |

Each payload is typed and self-contained: `conversation_id`, the human `actor`,
the affected participant when the mutation targets one, the current
`membership_version`, a structured `system_mutation` with old and new values,
and the canonical system `message`.

Full payloads are in [event types](https://docs.relayapp.im/reference/events).

> **Warning:**
> A lifecycle event grants no transcript access. `conversation.added` tells you
>   that you are a member, not what the group has been saying.

## Limits

| Limit                           | Value                               |
| ------------------------------- | ----------------------------------- |
| Participants per group          | 25, including every human and agent |
| Historical participants tracked | 100                                 |
| Group title                     | 1 to 100 characters                 |
| Agents required per group       | At least 1                          |
| Invocation stream claim         | 5 minutes                           |

## What people do, and what backends cannot

Group creation and membership are first-party app actions, authenticated with a
person's Relay session. There is no Agent Token route for them.

| Action                                | Who                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Create a group, set its title         | A person, in the app                                                        |
| Add or remove a participant           | A person, in the app                                                        |
| Rename the group or change its avatar | A person, in the app                                                        |
| Leave the group                       | A person, in the app                                                        |
| Invoke an agent                       | A person, in the app                                                        |
| Reply to an invocation                | Your backend                                                                |
| Send a group invite card              | Your backend, via `POST /v1/groups/invites`; the person consents in the app |

> **Note:**
> Direct membership writes stay human. A backend can propose with an invite card,
>   and `group.invite.completed` or `group.invite.expired` reports the terminal
>   state, but only a person's consent changes who is in a group. Fuller
>   agent-initiated management is on the [roadmap](https://docs.relayapp.im/roadmap).

## Next steps

* [Event types](https://docs.relayapp.im/reference/events) for the exact lifecycle payloads
* [Sending messages](https://docs.relayapp.im/guides/sending-messages) for every part type
* [Streaming replies](https://docs.relayapp.im/guides/streaming)
* [Developer data access and retention](https://docs.relayapp.im/reference/data-and-permissions)


---

# Conversation lifecycle

> Understand how a direct conversation begins, remains active, and is recovered.

A conversation is the durable thread between a Relay user and an agent. The current developer preview supports direct conversations initiated inside Relay.

## How a conversation begins

Relay creates or reuses the direct conversation when a user installs the agent. When that user sends a message, the agent receives `message.received` with the stable `conversation_id`:

```json
{
  "event_type": "message.received",
  "data": {
    "message": {
      "id": "msg_01JZM3T8AH",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 1
    }
  }
}
```

Store the ID and pass it back unchanged when sending, typing, marking read, or reading history.

## Active conversation

A direct conversation contains one user and one agent. Relay serializes its messages with a dense, increasing `sequence`.

Relay checks both conversation membership and the user's active installation before accepting a send. A `403 forbidden` response here usually means the agent is no longer a participant or installed.

Keep each send and reply target within the relationship that produced the conversation ID.

## Remove and return

| Action                   | Effect on the conversation                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove an ordinary agent | The installation ends; the backend can no longer add messages                                                                                        |
| Add the agent again      | Relay reuses the existing direct conversation, never a second one                                                                                    |
| Block any agent          | Removes the active installation, including for a required built-in agent, and suppresses required-distribution reconciliation while the block exists |
| Built-in **Relay** agent | Has no ordinary Remove action                                                                                                                        |

## Recover the thread

Two identifiers do different jobs. Keep them separate when storing and
recovering state.

| Identifier | Answers                                              |
| ---------- | ---------------------------------------------------- |
| `event_id` | Have I already processed this durable change?        |
| `sequence` | Where does this message sit inside one conversation? |

After a restart or an uncertain webhook attempt, rebuild from
[conversation history](https://docs.relayapp.im/guides/conversation-history). Your registered endpoint
keeps receiving new events automatically.

> **Note:**
> Conversation listing, backend-created conversations, and agent-initiated group
>   management are not available in the current developer preview. Groups
>   themselves are live: people create them in the app, and your backend receives
>   invocations and lifecycle events. See [API availability](https://docs.relayapp.im/roadmap).

## Next steps

* [Conversation history](https://docs.relayapp.im/guides/conversation-history) to rebuild a thread
* [Delivery model](https://docs.relayapp.im/guides/delivery-model) for ordering and recovery rules
* [Create and connect an agent](https://docs.relayapp.im/guides/your-agent) for installation behavior
