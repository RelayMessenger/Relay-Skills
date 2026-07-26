<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Sending messages

> Send ordered parts with POST /v1/messages, reply to a message or a part, and make retries safe.

Send a message with `conversation_id`, an ordered `parts[]` array, and an `Idempotency-Key`:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [
      { "type": "text", "text": "Found three options. The best one:" },
      { "type": "link_preview", "url": "https://example.com/listing/42" }
    ]
  }'
```

Relay returns `202 Accepted` with `message_id` and the stored message. Each stored part includes its assigned `part_index`.

## Part types

A message carries 1–32 parts. Order is presentation order.

| Type           | Shape                                                                                                  | Limits                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `text`         | `{ "type": "text", "text": "Hello" }`                                                                  | 8 KB per part                                                         |
| `link_preview` | `{ "type": "link_preview", "url": "https://example.com" }`                                             | public HTTPS URL, up to 2,048 characters                              |
| `data`         | `{ "type": "data", "data": { ... } }`                                                                  | any JSON, 16 KB; recognized component kinds get additional validation |
| `media`        | `{ "type": "media", "url": "https://…" }` or `{ "attachment_id": "att_…" }`                            | exactly one of `url` \| `attachment_id`                               |
| `voice_memo`   | `{ "type": "voice_memo", "url": "https://…" }` or `{ "type": "voice_memo", "attachment_id": "att_…" }` | exactly one source; `duration_ms` is optional                         |

> **Note:**
> Upload a file to get an `attachment_id`, or pass a public `url`. See [Attachments](https://docs.relayapp.im/guides/attachments).

`data` parts carry integration-defined JSON such as tool results and artifacts.
Relay also recognizes the v1 [message component](https://docs.relayapp.im/components) kinds: `buttons`,
`select`, `card`, `confirm`, and `agent_permission_request`.

| Case                              | Behavior                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Missing component `data.fallback` | Synthesized before storage                                                                                                                |
| Unknown kind                      | Passes through unchanged, so older clients render the fallback instead of dropping the part                                               |
| `group_invite` kind               | Reserved for cards committed by `POST /v1/groups/invites`; sending it through the ordinary message endpoint returns `422 invalid_request` |

Clients that cannot render a part use its component fallback when present, then the message's `fallback_text`, derived from the first text part, first link preview, data fallback, `Voice memo`, or `[attachment]`.

Use [Voice memos](https://docs.relayapp.im/guides/voice-memos) when audio should appear in the inline voice player, and [Rich link previews](https://docs.relayapp.im/guides/rich-link-previews) when a URL should render as a preview card.

## Quick replies

Attach up to 8 `suggestions` to a message when a short list of answers covers what you need next:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reply-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [
      { "type": "text", "text": "Who are you trying to date?" }
    ],
    "suggestions": [
      { "text": "Women" },
      { "text": "Men" },
      { "text": "Nonbinary" },
      { "text": "Everyone" }
    ]
  }'
```

Each suggestion is `{ "text": "…" }` with 1 to 96 characters.

| Behavior      | Detail                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| Placement     | Chips render above the composer while your message is the newest in the conversation |
| Lifetime      | They disappear once anything newer arrives                                           |
| On tap        | The `text` is sent back as an ordinary user text message                             |
| Your handling | A normal [`message.received`](https://docs.relayapp.im/guides/webhooks) event, no extra code                 |

The user can always type a free-form answer instead.

Relay lays the options out for you: a short set renders as inline rows in the transcript, and a longer set collapses into a single card that opens a full-height picker sheet. You don't choose the presentation.

> **Note:**
> Quick-reply suggestions are separate from message components. Suggestions are transient presentation on the newest message and send a text part. Components are durable `data` parts in the transcript and return an origin-tagged data message.

## Message components

Use a component data part when the choices must remain attached to their source message or the tap must carry a stable option identity:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: booking-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [
      { "type": "data", "data": {
        "kind": "buttons",
        "prompt": "Pick your booking slot",
        "options": [
          { "id": "slot_fri_7", "label": "Friday 7pm", "style": "primary" },
          { "id": "slot_sat_8", "label": "Saturday 8pm" }
        ]
      } }
    ]
  }'
```

Tapping `slot_sat_8` sends a normal user message through the existing message pipeline:

```json
{
  "parts": [{
    "type": "data",
    "data": {
      "origin": {
        "kind": "data_action",
        "message_id": "msg_01JZM4Q9VN",
        "part_index": 0,
        "option_id": "slot_sat_8",
        "source_kind": "buttons"
      },
      "option_id": "slot_sat_8",
      "label": "Saturday 8pm"
    }
  }],
  "fallback_text": "Saturday 8pm"
}
```

The agent receives this as the next ordinary `message.received` event. Normal message idempotency covers retries. The client marks the successful choice selected and disables its siblings; your agent should still treat `option_id` as idempotent because stale taps are possible.

See the catalog and per-kind wire contracts in [Message components](https://docs.relayapp.im/components), [Buttons](https://docs.relayapp.im/components/buttons), [Select](https://docs.relayapp.im/components/select), [Card](https://docs.relayapp.im/components/card), [Confirm](https://docs.relayapp.im/components/confirm), and [Agent permission request](https://docs.relayapp.im/components/agent_permission_request).

## Replying to a message or a part

In a group, Relay invokes an agent only when a human explicitly selects it or
replies to one of its messages. The resulting `message.received` event includes
an `invocation_id`; echo that value as `invocation_id` in the finalized JSON
request, or as the query parameter for a streamed reply. Ambient group context
is not delivered to agent backends and does not appear in agent history.

`reply_to` targets a whole message or a single part:

```json
{ "reply_to": { "message_id": "msg_01JZM3T8AH" } }
{ "reply_to": { "message_id": "msg_01JZM3T8AH", "part_index": 1 } }
```

Use the `part_index` from the stored message in `message.received`. Part indexes are dense, zero-based, and stable.

## Idempotency

The `Idempotency-Key` header is **required** and accepts 8–255 characters. Derive it from the inbound `event_id`:

* Same key + same request → Relay returns the original message instead of sending twice.
* Same key + different request → `409 idempotency_conflict`.

Generate the key once per logical send and reuse it across retries.

## Long replies

Split content longer than the per-part limit across `text` parts or messages. Each part renders as its own bubble.

Next: pipe your agent's existing output with [Streaming](https://docs.relayapp.im/guides/streaming), or react
to a user's message with [Reactions](https://docs.relayapp.im/guides/reactions).

## Next steps

* [Streaming replies](https://docs.relayapp.im/guides/streaming)
* [Attachments](https://docs.relayapp.im/guides/attachments)
* [Message components](https://docs.relayapp.im/components)
* [Delivery model](https://docs.relayapp.im/guides/delivery-model)


---

# Attachments

> Upload a file and reference it from a media or voice-memo part.

Upload a file, then reference its `attachment_id` in a `media` or `voice_memo` part.

## Upload

Send the raw bytes as the request body (up to **100 MB**):

```bash
curl -sS -X POST "https://api.relayapp.im/v1/attachments" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: image/png" \
  -H "X-Relay-Filename: chart.png" \
  --data-binary @chart.png
```

`201 Created`:

```json
{
  "attachment": {
    "id": "att_01KXGWNZFRF5BH4959T6JYD9SM",
    "url": "https://api.relayapp.im/v1/attachment-content/eeQPcHI4…",
    "content_type": "image/png",
    "size_bytes": 48213
  }
}
```

`Content-Type` sets the stored MIME type (defaults to `application/octet-stream`);
`X-Relay-Filename` names the file for downloads. Uploads accept up to 100 MB; a
presigned two-step flow is on the [roadmap](https://docs.relayapp.im/roadmap).

## Send it

Reference the attachment in a part. Relay stores its download URL on the part so clients and history reads can render it directly:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: media-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [
      { "type": "text", "text": "Here is the chart:" },
      { "type": "media", "attachment_id": "att_01KXGWNZFRF5BH4959T6JYD9SM" }
    ]
  }'
```

Use `"type": "voice_memo"` for native inline playback. The uploaded attachment needs an `audio/*` content type. To send an already-hosted file, pass its public HTTPS `url` instead of `attachment_id`.

## Ownership

Attachments belong to their uploader. Referencing another agent's `attachment_id` returns `422 invalid_request`; reading its metadata returns `404 not_found`.

## Check an upload

```bash
curl -sS "https://api.relayapp.im/v1/attachments/att_01KXGWNZFRF5BH4959T6JYD9SM" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

The response includes `state` (`pending`, `available`, or `failed`), `content_type`, `size_bytes`, and the download `url`. Only `available` attachments can be sent.

## Receiving media

Incoming `media` and `voice_memo` parts carry a capability `url` that can be downloaded directly.

## Next steps

* [Voice memos](https://docs.relayapp.im/guides/voice-memos)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
* [Capability URLs and retention](https://docs.relayapp.im/reference/data-and-permissions)


---

# Voice memos

> Send recorded audio with Relay's native inline player.

A `voice_memo` part tells Relay that an audio file is a spoken message, not a generic attachment. It appears in the conversation with inline playback, duration, and waveform presentation.

## Send from a public URL

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: voice-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "voice_memo",
      "url": "https://cdn.example.com/replies/answer.m4a",
      "duration_ms": 18400
    }]
  }'
```

Use a public HTTPS URL. Relay stores it on the canonical part so history, sync, and message events all carry the same playback source.

## Send an uploaded file

Upload the bytes first, then pass the returned `attachment_id`:

```json
{
  "conversation_id": "cnv_01JZC7K4RQ",
  "parts": [{
    "type": "voice_memo",
    "attachment_id": "att_01KXGWNZFRF5BH4959T6JYD9SM",
    "duration_ms": 18400
  }]
}
```

The attachment needs to be available, belong to the sender, and declare an `audio/*` content type. See [Attachments](https://docs.relayapp.im/guides/attachments) for the raw upload flow and 100 MB limit.

## Voice memo or audio attachment

| Desired result                         | Part type    |
| -------------------------------------- | ------------ |
| Spoken message with inline playback    | `voice_memo` |
| Song, podcast, or arbitrary audio file | `media`      |

Both use the same file storage. The part discriminator preserves the sender's presentation intent.

## Rules

* Pass exactly one of `url` or `attachment_id`.
* `duration_ms` is optional and accepts a non-negative integer.
* Relay validates the `audio/*` MIME family for uploaded files and does not transcode them. M4A/AAC (`audio/mp4`) is the recommended interoperable format; MP3 and WAV are also playable by Relay's AVFoundation player.
* Voice memos use the normal message response, history, replies, reactions, idempotency, and delivery/read receipts. There is no second voice-memo delivery pipeline.

Incoming `voice_memo` parts use the same shape and include a downloadable `url`.

## Next steps

* [Attachments](https://docs.relayapp.im/guides/attachments)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)


---

# Rich link previews

> Render a URL as a native card with page metadata.

A `link_preview` part asks Relay to render a URL as a native preview card. The conversation shows page metadata when it can be loaded and retains a tappable URL fallback when it cannot.

## Send a preview

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: link-evt_01JZE9M2XW" \
  -d '{
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "link_preview",
      "url": "https://example.com/article"
    }]
  }'
```

| Constraint     | Value            |
| -------------- | ---------------- |
| Scheme         | HTTPS            |
| Maximum length | 2,048 characters |

## Add context before the card

Relay preserves ordered parts, so a preview can follow text in the same message:

```json
{
  "parts": [
    { "type": "text", "text": "This is the source I used:" },
    { "type": "link_preview", "url": "https://example.com/article" }
  ]
}
```

Each stored part receives a stable `part_index`, so replies and reactions can target the text or card separately.

## Preview metadata and fallback

Relay's iOS app loads page metadata through the native Link Presentation
framework. What the reader sees depends on the destination.

| Destination                                                                      | Card                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| Public page with a title and image                                               | ✅ Full preview card                      |
| Page that blocks metadata requests, sits behind auth, or is on a private network | ⚠️ Simpler card showing the host and URL |

The server never rewrites or shortens the destination.

## Choosing the part type

| Part           | Use when                         |
| -------------- | -------------------------------- |
| `text`         | The URL is ordinary message text |
| `link_preview` | The card itself is intentional   |

Rich previews use the normal message response, history, events, idempotency,
replies, reactions, and delivery and read receipts.

## Next steps

* [Sending messages](https://docs.relayapp.im/guides/sending-messages) for every part type
* [Message components](https://docs.relayapp.im/components) for interactive alternatives
* [Reactions](https://docs.relayapp.im/guides/reactions) for targeting one part


---

# Reactions

> Add and remove tapback-style reactions, target a specific part, and receive reaction events.

A reaction targets a whole message or one part of it. Relay emits an event when a user adds or removes a reaction from the agent's message.

## Add or remove a reaction

Use `operation` to add or remove the reaction:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages/msg_01JZM3T8AH/reactions" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "operation": "add", "type": "love" }'
```

| Field        | Values                                                                           |
| ------------ | -------------------------------------------------------------------------------- |
| `operation`  | `add` \| `remove`                                                                |
| `type`       | `love` \| `like` \| `dislike` \| `laugh` \| `emphasize` \| `question` \| `emoji` |
| `emoji`      | required if and only if `type` is `"emoji"`. Any single emoji, e.g. `"🔥"`       |
| `part_index` | optional; omit to react to the whole message                                     |

```bash
# Arbitrary emoji on part 1 of a multi-part message
curl -sS -X POST "https://api.relayapp.im/v1/messages/msg_01JZM3T8AH/reactions" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "operation": "add", "type": "emoji", "emoji": "🔥", "part_index": 1 }'
```

The response returns the stored reaction. Removing a missing reaction or adding an existing one is an idempotent no-op. A reaction outside the agent's conversations returns `403 forbidden`.

## Receiving reaction events

When a user reacts to the agent's message, each matching registered webhook
receives `reaction.added` or `reaction.removed`:

```json
{
  "event_id": "evt_01JZR3ACT10N",
  "event_type": "reaction.added",
  "agent_id": "agt_01JZRELAY",
  "created_at": "2026-07-13T20:02:11.000Z",
  "data": {
    "reaction": {
      "message_id": "msg_01JZM4Q9VN",
      "part_index": null,
      "type": "love",
      "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "operation": "add"
    }
  }
}
```

Use a reaction when acknowledgment is enough, for example, `like` a “thanks” instead of sending another message.

## Next steps

* [Event types](https://docs.relayapp.im/reference/events)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
* [Message components](https://docs.relayapp.im/components)
