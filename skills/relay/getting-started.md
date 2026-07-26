<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Quickstart

> Register a webhook, receive a message, and send a reply with plain HTTPS.

Create an agent in Relay and save the Agent Token shown once. Relay sends events
to your HTTPS endpoint; your backend sends messages back through the REST API.

```bash
export RELAY_API_URL="https://api.relayapp.im"
export RELAY_AGENT_TOKEN="rly_live_..."
```

**Step 1: Register your webhook**

```bash
curl -sS -X POST "$RELAY_API_URL/v1/webhooks" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://agent.example/webhooks/relay"}'
```

Relay returns the signing secret exactly once:

```json
{
  "webhook": {
    "id": "wh_01JZWEBHOOK",
    "url": "https://agent.example/webhooks/relay",
    "events": ["message.received", "message.edited", "message.unsent", "conversation.added", "conversation.updated", "conversation.removed", "reaction.added", "reaction.removed", "message.delivered", "message.read", "group.invite.completed", "group.invite.expired"],
    "enabled": true,
    "secret_prefix": "whsec_MfKQ9r8G…",
    "created_at": "2026-07-15T20:00:00.000Z",
    "updated_at": "2026-07-15T20:00:00.000Z"
  },
  "signing_secret": "whsec_..."
}
```

Store the secret in your secret manager. It is not returned by list or update requests.
**Step 2: Receive and verify the signed event**

Relay sends the event envelope as the raw JSON request body with
`webhook-id`, `webhook-timestamp`, and `webhook-signature` headers. Verify
the signature before parsing the body, reject timestamps older than five
minutes, durably enqueue the event, and return a `2xx` quickly.

```json
{
  "event_id": "evt_01JZE9M2XW",
  "event_type": "message.received",
  "agent_id": "agt_01JZRELAY",
  "created_at": "2026-07-12T01:21:03.000Z",
  "data": {
    "message": {
      "id": "msg_01JZM3T8AH",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 1,
      "sender": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "parts": [{ "part_index": 0, "type": "text", "text": "What time works tomorrow?" }],
      "reply_to": null,
      "fallback_text": "What time works tomorrow?",
      "status": "sent",
      "created_at": "2026-07-12T01:21:03.000Z"
    }
  }
}
```

Delivery is at least once. Deduplicate with `event_id`.
**Step 3: Reply**

Derive the `Idempotency-Key` from the incoming `event_id` so retries cannot
create a second reply.

```bash
curl -sS -X POST "$RELAY_API_URL/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{ "type": "text", "text": "Tomorrow at 2:00 PM works." }],
    "reply_to": { "message_id": "msg_01JZM3T8AH", "part_index": 0 }
  }'
```

Relay returns `202 Accepted` with the canonical message.
Next, read [Webhooks](https://docs.relayapp.im/guides/webhooks) for verification, retries, rotation, and
event filtering. Then connect the same handler your existing channels already use.

## Next steps

* [Webhooks, for verification, retries, and rotation](https://docs.relayapp.im/guides/webhooks)
* [Sending messages, for every part type](https://docs.relayapp.im/guides/sending-messages)
* [Streaming replies](https://docs.relayapp.im/guides/streaming)
* [Errors](https://docs.relayapp.im/reference/errors)


---

# Create and connect an agent

> Create an agent in Relay, connect its backend, and understand installation.

A Relay agent is the identity people add and message. Your backend supplies its
brain; Relay owns its profile, installation, conversation, and delivery.

## Create the agent

In Relay, tap **New Message**, then **Create Agent**. Enter a display name and
handle. Those are the only creation fields.

| Rule                | Detail                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| Handle format       | 3 to 32 lowercase letters, numbers, or underscores, starting with a letter              |
| Reserved handles    | Product and legal route names such as `dashboard`, `mac`, `privacy`, `support`, `terms` |
| Starting visibility | Private, until the owner changes it                                                     |
| On creation         | Relay installs the agent for its creator and opens its direct conversation              |
| Agent Token         | Shown exactly once                                                                      |

> **Note:**
> Creation never asks for a tagline, accent color, model, personality, prompt,
>   backend URL, or hosting provider. Behavior and backend configuration live in
>   your external backend, not in Relay's identity contract.

### Richer creation through the API

The app keeps creation to display name and handle on purpose. An authenticated
owner can set richer presentation fields in the same request with
`POST /v1/me/agents`.

| Field                                 | Accepts                                                 |
| ------------------------------------- | ------------------------------------------------------- |
| `avatarUrl`, `tagline`, `accentColor` | Presentation identity                                   |
| `capabilities`                        | `text`, `image`, `voice`, `video`, `files`              |
| `openingMessage`                      | The same ordered `parts` a normal Relay message accepts |

Read and update those owner-only fields afterwards:

```bash
curl -sS "$RELAY_API_URL/v1/me/agents/$AGENT_ID/configuration" \
  -H "Authorization: Bearer $RELAY_SESSION_TOKEN"
```

Send `{"openingMessage": null}` to `PATCH .../configuration` to disable the
opening message for future installs.

> **Warning:**
> These endpoints use the owner's Relay session, not the Agent Token.

An opening message is sent as the agent exactly once, when a user first installs
it. Reinstalling, changing visibility, or changing distribution policy never
sends it again, and updating it affects future first installs only.

## Connect the backend

The Agent Token authenticates your backend as this agent. Verify it, then use
the returned agent ID and handle in your logs and configuration.

```bash
curl -sS "$RELAY_API_URL/v1/agents/me" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

## Profile and distribution

Every public or unlisted handle owns a profile at `relayapp.im/handle` carrying
display identity only.

> **Warning:**
> Agent Tokens, owner identity, prompts, model and provider choices, runtime
>   details, backend configuration, and opening-message configuration are never part
>   of a public profile.

The owner chooses **Who can message** from the agent profile:

| Setting      |                       Store                      | Exact handle and share link | Installable by                 |
| ------------ | :----------------------------------------------: | :-------------------------: | ------------------------------ |
| **Public**   | ✅ after Relay approves and publishes the listing |              ✅              | Anyone                         |
| **Unlisted** |                         ❌                        |              ✅              | Anyone with the handle or link |
| **Private**  |                         ❌                        |           ❌ `404`           | The owner only                 |

Relay keeps three states separate:

| State        | Controls                                 |
| ------------ | ---------------------------------------- |
| Visibility   | Who can find the agent                   |
| Store review | Whether it is indexed                    |
| Installation | A user's existing messaging relationship |

Changing visibility never silently removes an existing installation.

## Installation

A user explicitly adds an agent before messaging it. Installation creates or
reuses one direct conversation between that user and agent.

Relay accepts a backend message only while both of these hold:

1. The agent is a participant in the target conversation.
2. The agent is still installed for that user.

| Action                   | Effect                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| Remove an ordinary agent | Ends the installation and blocks new messages from it                             |
| Add it again             | Reuses the existing direct conversation, no duplicate thread                      |
| Block or report          | Available for every agent, ends the installation, overrides required distribution |
| Built-in **Relay** agent | Required, with no ordinary Remove action                                          |

> **Note:**
> The developer API continues from conversation IDs Relay delivers to the agent.
>   Conversation creation and arbitrary user lookup are not part of the preview.

## Next steps

* [Quickstart](https://docs.relayapp.im/quickstart) to receive and reply to the first message
* [Authentication](https://docs.relayapp.im/authentication) for token storage and rotation
* [Conversation lifecycle](https://docs.relayapp.im/guides/conversation-lifecycle)
* [Developer data access and retention](https://docs.relayapp.im/reference/data-and-permissions)


---

# Authentication

> Authenticate requests, verify identity, and rotate credentials.

Set `RELAY_AGENT_TOKEN` in your server environment. Requests authenticate as the Relay agent that issued the token.

```bash
curl -sS "https://api.relayapp.im/v1/agents/me" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

`GET /v1/agents/me` verifies the credential and returns the agent's `id`, `handle`, and profile. Relay shows the `rly_live_…` token once when the agent is created.

## Store and rotate

* Keep it in a secret manager or environment variable. Relay stores only a hash.
* Keep it out of source code, logs, and URLs.
* A `401 unauthorized` response means the credential needs attention. Update it before retrying.
* If a token is exposed, rotate it from the agent profile and update the deployment. Rotation revokes the previous token immediately.

An Agent Token authenticates external code as one agent. It is not a Relay user session or a hosted runtime.

See [Your agent](https://docs.relayapp.im/guides/your-agent) for the identity, installation, and conversation boundaries behind the credential.

## Next steps

* [Create and connect an agent](https://docs.relayapp.im/guides/your-agent)
* [Quickstart](https://docs.relayapp.im/quickstart)
* [Errors, including `401 unauthorized`](https://docs.relayapp.im/reference/errors)
