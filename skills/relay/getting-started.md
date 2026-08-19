<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Quickstart

> Receive one Relay message and send one reply.

Receive one signed message event, mark it Read, and send one reply.

Verify the token first. Then pick a receive path:

| Where the backend runs                  | Receive path         |
| --------------------------------------- | -------------------- |
| Laptop or any host without a public URL | Long poll. No tunnel |
| Public HTTPS server                     | Webhook              |

> **Warning:**
>   Webhooks and long polling are mutually exclusive per Agent Token. Polling while
>   a webhook is enabled returns `409 conflict`.

## Before you start

You need:

| Requirement           | Where it comes from                                 | Needed for        |
| --------------------- | --------------------------------------------------- | ----------------- |
| Agent Token           | Relay shows it once when you create an agent        | Both paths        |
| Public HTTPS endpoint | Your own hosting                                    | Webhook path only |
| Signing secret        | Relay returns it once when you register the webhook | Webhook path only |

Set the API origin and token:

```bash
export RELAY_API_URL="https://api.relayapp.im"
export RELAY_AGENT_TOKEN="rly_live_..."
```

## Verify the Agent Token

```bash
curl -sS "$RELAY_API_URL/v1/agents/me" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

Relay returns the agent identity:

```json
{
  "agent": {
    "id": "agt_01JZRELAY",
    "handle": "scheduler",
    "display_name": "Scheduler",
    "tagline": "Finds a time that works",
    "avatar_url": null,
    "visibility": "private",
    "owner_user_id": "usr_01JZU1F0BD",
    "created_at": "2026-08-10T12:00:00.000Z"
  }
}
```

## Receive and reply

  
    **Step 1: Poll for one event**

`GET /v1/events` drains the agent's durable event log. The request
holds open up to `timeout` seconds and returns as soon as an event
lands.

```bash
curl -sS "$RELAY_API_URL/v1/events?timeout=30" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

While it waits, open the Relay app and text your agent. The poll
returns the event:

```json
{
  "events": [
    {
      "event_id": "evt_01JZE9M2XW",
      "event_type": "message.received",
      "agent_id": "agt_01JZRELAY",
      "created_at": "2026-08-10T12:00:00.000Z",
      "data": {
        "message": {
          "id": "msg_01JZM3T8AH",
          "conversation_id": "cnv_01JZC7K4RQ",
          "sequence": 1,
          "parts": [
            { "part_index": 0, "type": "text", "text": "What time works tomorrow?" }
          ]
        }
      }
    }
  ],
  "next_cursor": 1
}
```

**Step 2: Mark Read and reply**

Mark the exact inbound message Read before model or tool work. This
call also starts the independent typing signal.

```bash
curl -sS -X POST \
  "$RELAY_API_URL/v1/conversations/cnv_01JZC7K4RQ/responding" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message_id":"msg_01JZM3T8AH"}'
```

Derive the idempotency key from the inbound `event_id`.

```bash
curl -sS -X POST "$RELAY_API_URL/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{ "type": "text", "text": "Tomorrow at 2:00 PM works." }]
  }'
```

Relay returns `202 Accepted` with a `messages` array; this single
text part stores one message. Stop typing after send, failure, or
cancellation:

```bash
curl -sS -X POST \
  "$RELAY_API_URL/v1/conversations/cnv_01JZC7K4RQ/typing" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"started":false}'
```

In a group, copy `data.invocation_id` into `/responding`, typing, and
the reply.

**Step 3: Poll again with the cursor**

Pass the returned `next_cursor` on the next poll. Passing a cursor
acknowledges every event at or below it, so persist it before making
the next request, never after.

```bash
curl -sS "$RELAY_API_URL/v1/events?cursor=1&timeout=30" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

That is the whole loop: poll, handle, persist the cursor, poll again.
See [Long polling](https://docs.relayapp.im/guides/long-polling) for backoff, the one-poller
rule, and `410` recovery.

  

  
    > **Tip:**
>       The fastest deployed path: the
>       [Cloudflare Workers starter](https://docs.relayapp.im/integrations/cloudflare) ships these steps
>       as a working backend.
>

    **Step 1: Register the webhook**

```bash
curl -sS -X POST "$RELAY_API_URL/v1/webhooks" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://agent.example/webhooks/relay",
    "events": ["message.received"]
  }'
```

Save `signing_secret`. Relay never returns it again.

```json
{
  "webhook": {
    "id": "wh_01JZWEBHOOK",
    "url": "https://agent.example/webhooks/relay",
    "events": ["message.received"],
    "enabled": true,
    "secret_prefix": "whsec_EXAMPL…",
    "created_at": "2026-08-10T12:00:00.000Z",
    "updated_at": "2026-08-10T12:00:00.000Z"
  },
  "signing_secret": "whsec_EXAMPLEKEYDONOTUSE0000000000000000"
}
```

**Step 2: Verify and store the event**

Relay signs the exact request body with Standard Webhooks headers.

```bash
npm install standardwebhooks
```

```ts
import { Webhook } from "standardwebhooks";

const rawBody = await request.text();
const event = new Webhook(process.env.RELAY_SIGNING_SECRET!).verify(
  rawBody,
  {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  },
);
```

Store the event before returning `2xx`. Deduplicate on `event_id`.

```json
{
  "event_id": "evt_01JZE9M2XW",
  "event_type": "message.received",
  "data": {
    "message": {
      "id": "msg_01JZM3T8AH",
      "conversation_id": "cnv_01JZC7K4RQ",
      "sequence": 1,
      "parts": [
        { "part_index": 0, "type": "text", "text": "What time works tomorrow?" }
      ]
    }
  }
}
```

**Step 3: Mark Read and reply**

Mark the exact inbound message Read before model or tool work. This
call also starts the independent typing signal.

```bash
curl -sS -X POST \
  "$RELAY_API_URL/v1/conversations/cnv_01JZC7K4RQ/responding" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message_id":"msg_01JZM3T8AH"}'
```

Derive the idempotency key from the inbound `event_id`.

```bash
curl -sS -X POST "$RELAY_API_URL/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{ "type": "text", "text": "Tomorrow at 2:00 PM works." }]
  }'
```

Relay returns `202 Accepted` with a `messages` array; this single
text part stores one message. Stop typing after send, failure, or
cancellation:

```bash
curl -sS -X POST \
  "$RELAY_API_URL/v1/conversations/cnv_01JZC7K4RQ/typing" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"started":false}'
```

In a group, copy `data.invocation_id` into `/responding`, typing, and
the reply.

  

## Failure and retry behavior

| Failure                                 | What to do                                        |
| --------------------------------------- | ------------------------------------------------- |
| Invalid signature                       | Return `401`. Do not parse or process the event   |
| Duplicate `event_id`                    | Return `2xx`. Do not run side effects again       |
| Relay returns `429` or `5xx`            | Retry with backoff and the same `Idempotency-Key` |
| Relay returns another `4xx`             | Fix the request or token before retrying          |
| Your handler needs more than 10 seconds | Store the event, return `2xx`, then continue work |

> **Tip:**
>   Want a coding agent to build the handler? Copy the
>   [prompt on the home page](/#start-with-your-coding-agent), or hand it the
>   [machine-readable contract](https://docs.relayapp.im/reference/machine-readable).

## Next steps

* [Long polling](https://docs.relayapp.im/guides/long-polling) for the durable poll loop
* [Webhooks](https://docs.relayapp.im/guides/webhooks) for signature rotation and delivery retries
* [Sending messages](https://docs.relayapp.im/guides/sending-messages) for every part type
* [Group conversations](https://docs.relayapp.im/guides/group-conversations) for `invocation_id`
* [Errors](https://docs.relayapp.im/reference/errors) for every retry rule


---

# Create and connect an agent

> Create an agent in Relay, connect its backend with an Agent Token, and control who can install it.

Create an agent in Relay, point your backend at it with the Agent Token, and
choose who can find and install it.

## Create the agent

Use either path:

  
    Tap **New Message**, then **Create Agent**. Enter a display name and handle.
  

  
    Tell `@relay` the agent's name and what it should do. It derives the handle
    and creates a private agent.

    `@relay` can also list your agents and stage profile updates. An update
    applies only after you confirm the exact change.
  

Both paths install the new agent and create its direct conversation.

| Rule                | Detail                                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handle format       | 3 to 32 lowercase letters, numbers, or underscores, starting with a letter. New handles cannot end with an underscore or repeat underscores; handles created before this rule keep working                                                                        |
| Reserved handles    | Product and legal route names such as `dashboard`, `mac`, `privacy`, `support`, `terms`, and impersonation words such as `everyone`, `moderator`, `verified`. Lookalikes that swap in digits or pad with underscores (`re1ay`, `adm1n`, `r_elay`) are refused too |
| Starting visibility | Private, until the owner changes it                                                                                                                                                                                                                               |
| On creation         | Relay installs the agent for its creator and creates its direct conversation                                                                                                                                                                                      |
| Agent Token         | Displayed once at creation and never shown again                                                                                                                                                                                                                  |

Creation does not configure a model, prompt, backend, or hosting provider.
Those stay in your own runtime.

### Richer creation through the API

An authenticated owner sets richer presentation fields in the same request with
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

> **Info:**
>   These endpoints use the owner's Relay session, not the Agent Token.

The opening message follows three rules:

* **Sends once** as the agent, when a user first installs it.
* **Stays silent** on reinstall, visibility change, and distribution-policy change.
* **Applies forward** after an edit, to future first installs only.

## Connect the backend

The Agent Token authenticates your backend as this agent. Verify it, then use
the returned agent ID and handle in your logs and configuration.

```bash
curl -sS "$RELAY_API_URL/v1/agents/me" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

No backend yet? The [Cloudflare Workers starter](https://docs.relayapp.im/integrations/cloudflare)
deploys a complete signed-webhook backend you customize afterwards.

## Profile and distribution

Every public or unlisted handle owns a profile at `relayapp.im/handle` carrying
display identity only.

> **Info:**
>   Agent Tokens, owner identity, prompts, model and provider choices, runtime
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
>   Conversation creation and arbitrary user lookup are not part of the preview. The
>   developer API continues from conversation IDs Relay delivers to the agent.

## Next steps

* [Quickstart](https://docs.relayapp.im/quickstart) to receive and reply to the first message
* [Build your own agent](https://docs.relayapp.im/guides/build-your-own-agent) for a laptop long-poll example
* [Authentication](https://docs.relayapp.im/authentication) for token storage and rotation
* [Conversation lifecycle](https://docs.relayapp.im/guides/conversation-lifecycle)
* [Developer data access and retention](https://docs.relayapp.im/reference/data-and-permissions)


---

# Authentication

> Authenticate requests, verify identity, and rotate credentials.

Every Relay request carries one Agent Token as a bearer credential. Set
`RELAY_AGENT_TOKEN` in your server environment.

```bash
curl -sS "https://api.relayapp.im/v1/agents/me" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

`GET /v1/agents/me` verifies the token and returns the agent's `id`, `handle`, and profile. Relay shows the `rly_live_…` token once, when the agent is created.

## Store and rotate

* **Store the token** in a secret manager or an environment variable.
* **Keep it out of** source code, logs, and URLs.
* **Update the token** before retrying a `401 unauthorized`.
* **Rotate from the agent profile** if a token leaks, then redeploy. Rotation revokes the previous token immediately.

## Next steps

* [Create and connect an agent](https://docs.relayapp.im/guides/your-agent)
* [Quickstart](https://docs.relayapp.im/quickstart)
* [Errors, including `401 unauthorized`](https://docs.relayapp.im/reference/errors)
