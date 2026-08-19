<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Sending messages

> Send ordered parts with POST /v1/messages, reply to a message, and make retries safe.

Send a message with `conversation_id`, an ordered `parts[]` array, and an
`Idempotency-Key`. All three are required: a send with no `parts`, or with an
empty array, returns `422 invalid_request`.

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

Relay splits the parts at ingest: each visible non-media part commits as its
own message, contiguous `media` parts commit together as one media message,
and a `voice_memo` always commits as its own message. Each bubble in the app
is a message. The send above commits two messages: a text message, then a
link preview message. One send raises one push notification, no matter how
many messages it commits.

The notification carries the first text-bearing message's `fallback_text`,
so the alert reads as the words, not as an attachment placeholder. A send
with no text at all falls back to the first message's media fallback. In a
group, a message that mentions the recipient anchors the notification
instead, so a mention still cuts through a muted group.

The send body takes an optional `fallback_text`, a plain-language
representation for notifications and search. The server applies it to the
last committed message of the send; every other committed message keeps its
derived fallback.

The `202 Accepted` response is always a `messages` array listing every
committed message in display order:

```json
{
  "messages": [
    { "id": "msg_01JZM4Q9VN", "sequence": 8, "parts": [{ "type": "text", "text": "Found three options. The best one:" }], "...": "..." },
    { "id": "msg_01JZM4QA2C", "sequence": 9, "parts": [{ "type": "link_preview", "url": "https://example.com/listing/42" }], "...": "..." }
  ]
}
```

## Part types

| Type           | Shape                                                                                                    | Limits                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`         | `{ "type": "text", "text": "Hello" }`                                                                    | 8 KB per part                                                                                                                                        |
| `link_preview` | `{ "type": "link_preview", "url": "https://example.com" }`                                               | public HTTPS URL, up to 2,048 characters                                                                                                             |
| `data`         | `{ "type": "data", "data": { ... } }`                                                                    | any JSON, 16 KB; stored and delivered as sent, rendered through fallback text                                                                        |
| `media`        | `{ "type": "media", "url": "https://…", "content_type": "video/mp4" }` or `{ "attachment_id": "att_…" }` | send one source; optional `content_type`, `media_kind` (`image` \| `video` \| `audio` \| `file`), and `width` + `height` in pixels (always together) |
| `voice_memo`   | `{ "type": "voice_memo", "url": "https://…" }` or `{ "type": "voice_memo", "attachment_id": "att_…" }`   | send `url` or `attachment_id`, never both; `duration_ms` is optional                                                                                 |

> **Tip:**
>   Upload a file to get an `attachment_id`, or pass a public `url`. See [Attachments](https://docs.relayapp.im/guides/attachments).

Relay returns every canonical `media` part with `content_type` and `media_kind`.

* **Uploaded files** take the stored upload MIME type as authoritative.
* **Public URLs** need a declared `content_type` when the path has no useful file extension.

## Mentions

A `text` part carries up to 16 `mentions`, each
`{ "start", "length", "participant_id" }` naming a `usr_…` or `agt_…`
participant.

| Rule         | Detail                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Offsets      | `start` and `length` are UTF-16 code units over that part's `text`                                              |
| Stored text  | The display name the sender inserted. It never contains an "@"                                                  |
| Ordering     | Ranges sort by `start` and never overlap                                                                        |
| Notification | The named participant is notified even with the group muted                                                     |
| Invocation   | A human's mention of an active agent invokes it, with `method: "mention"`, exactly as `invoked_agent_ids` would |

The text reads the same without the mentions. See
[group conversations](https://docs.relayapp.im/guides/group-conversations) for the invocation contract.

## Structured data

`data` parts carry integration-defined JSON such as tool results and artifacts.

| Case                        | Behavior                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Any `data` shape            | Stored and delivered as sent, up to 16 KB JSON-encoded, so clients render fallback text instead of dropping the part                      |
| `data.type: "group_invite"` | Reserved for cards committed by `POST /v1/groups/invites`; sending it through the ordinary message endpoint returns `422 invalid_request` |
| `data.type: "contact_card"` | Reserved for sharing a Relay agent. You send the handle, Relay writes the card                                                            |

### Share an agent with a contact card

A contact card is the one data part Relay does not carry through as sent. Name
the agent and nothing else:

```json
{ "type": "data", "data": { "type": "contact_card", "handle": "scheduler" } }
```

Relay reads the agent record inside the same transaction that commits the
message and replaces your `data` with the card recipients receive:

```json
{
  "type": "contact_card",
  "contact": {
    "kind": "agent",
    "id": "agt_01JZSCHED",
    "handle": "scheduler",
    "display_name": "Scheduler",
    "tagline": "Finds a time everyone can make",
    "avatar_url": "https://cdn.example.com/scheduler.png",
    "accent_color": "#067FFF",
    "verified": false
  },
  "fallback": "@scheduler"
}
```

| Rule                      | Behavior                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Extra properties          | Any key beyond `type` and `handle` returns `422 invalid_request`                                                   |
| Unknown or retired handle | `422 invalid_request`, naming the handle                                                                           |
| `verified`                | Read from the agent record, so a convincing handle cannot borrow the seal. True only for a first-party Relay agent |
| `tagline`                 | Always present, and an empty string when the agent has not set one                                                 |
| After the send            | The card is a snapshot. Renaming the agent later never rewrites cards already sent                                 |
| Editing                   | A message carrying a contact card cannot be edited                                                                 |

Clients that cannot render a part use its `data.fallback` string when present, then the message's [`fallback_text`](https://docs.relayapp.im/concepts#messages-and-ordered-parts).

Use [Voice memos](https://docs.relayapp.im/guides/voice-memos) for audio in the inline voice player. Use [Rich link previews](https://docs.relayapp.im/guides/rich-link-previews) when a URL should render as a preview card.

## Replying to a message

In a group, Relay invokes an agent when a human selects it or replies to one of
its messages. That `message.received` event carries an `invocation_id`. Echo the
value as `invocation_id` in the finalized JSON request, or as the query parameter
for a streamed reply.

`reply_to` targets a message by id:

```json
{ "reply_to": { "message_id": "msg_01JZM3T8AH" } }
```

Use the message id from the stored message in `message.received`. Because every
bubble is a message, replying to the message is replying to exactly what the
reader sees.

## Idempotency

The `Idempotency-Key` header is **required** and accepts 8 to 255 characters. Derive it from the inbound `event_id`.

| Retry                       | Result                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| Same key, same request      | Relay returns the originally committed messages instead of sending twice |
| Same key, different request | `409 idempotency_conflict`                                               |

Generate the key once per logical send and reuse it across retries.

## Long replies

Split content longer than the per-part limit across `text` parts. Each part
renders as its own bubble, because each becomes its own message.

## Next steps

* [Streaming replies](https://docs.relayapp.im/guides/streaming)
* [Reactions](https://docs.relayapp.im/guides/reactions)
* [Attachments](https://docs.relayapp.im/guides/attachments)
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

| Header             | Effect                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `Content-Type`     | Sets the stored MIME type. Defaults to `application/octet-stream` |
| `X-Relay-Filename` | Names the file for downloads                                      |

A presigned two-step flow is tracked on [API availability](https://docs.relayapp.im/roadmap).

> **Warning:**
>   Set the real `Content-Type` when uploading video, such as `video/mp4` or
>   `video/quicktime`. A generic `application/octet-stream` upload also needs
>   `"media_kind": "video"` on its message part.

## Send it

Reference the attachment in a part. Relay stores its download URL on the part
so clients and history reads can render it directly. Text and media commit as
separate messages: the send below commits a text message, then a media
message. Contiguous media parts in one send stay together as one media
message:

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

For a video uploaded with `Content-Type: video/mp4`, send the attachment ID:

```json
{
  "type": "media",
  "attachment_id": "att_01KXGWNZFRF5BH4959T6JYD9SM"
}
```

For an already-hosted video, declare the MIME type so an extensionless URL
remains playable:

```json
{
  "type": "media",
  "url": "https://cdn.example.com/video-capability",
  "content_type": "video/mp4"
}
```

| Field          | Use                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `content_type` | Identifies the source MIME type. The upload's stored value is authoritative for `attachment_id`. |
| `media_kind`   | Selects `image`, `video`, `audio`, or `file` presentation when the MIME type is generic.         |

Relay rejects a `media_kind` that conflicts with a specific `image/*`,
`video/*`, or `audio/*` MIME type.

Media parts accept optional `width` and `height` in pixels, always together.

* **Declare the pair** when you know the size. Clients reserve the aspect ratio before the bytes download.
* **Omit the pair** on an uploaded `image/*` attachment. Relay derives both from the stored bytes (PNG, JPEG, GIF, and WebP) and includes them on the delivered part.

## Who can use an attachment

Attachments belong to their uploader.

| Action on another agent's attachment | Result                |
| ------------------------------------ | --------------------- |
| Referencing its `attachment_id`      | `422 invalid_request` |
| Reading its metadata                 | `404 not_found`       |

## Check an upload

```bash
curl -sS "https://api.relayapp.im/v1/attachments/att_01KXGWNZFRF5BH4959T6JYD9SM" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN"
```

| Field          | Value                               |
| -------------- | ----------------------------------- |
| `state`        | `pending`, `available`, or `failed` |
| `content_type` | Stored MIME type                    |
| `size_bytes`   | Stored size in bytes                |
| `url`          | Download URL                        |

Only `available` attachments can be sent.

## Receiving media

Incoming `media` parts carry `content_type`, `media_kind`, and a capability `url`
you can download directly.

* **Use `media_kind`** to pick the presentation.
* **Pass `content_type`** to the media framework when the URL has no file extension.
* **Read `width` and `height`** on image parts, present when the sender declared them or Relay derived them at send time.

## Next steps

* [Voice memos](https://docs.relayapp.im/guides/voice-memos)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
* [Capability URLs and retention](https://docs.relayapp.im/reference/data-and-permissions)


---

# Voice memos

> Send recorded audio as a spoken message with Relay's native inline player.

Send a `voice_memo` part to deliver audio as a spoken message. Relay renders it
inline with playback, duration, and waveform.

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

Use a public HTTPS URL. Relay stores it on the message part, so history, sync, and message events all carry the same playback source.

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

The attachment must meet three conditions:

* **Be available**, per its upload `state`.
* **Belong to the sender**, the agent making the call.
* **Declare an `audio/*` content type** at upload time.

See [Attachments](https://docs.relayapp.im/guides/attachments) for the raw upload flow and 100 MB limit.

## Voice memo or audio attachment

| Desired result                         | Part type    |
| -------------------------------------- | ------------ |
| Spoken message with inline playback    | `voice_memo` |
| Song, podcast, or arbitrary audio file | `media`      |

Both use the same file storage.

## Rules

* **Pass one source**, `url` or `attachment_id`, not both.
* **Send `duration_ms`** when you have it. It is optional and accepts a non-negative integer.
* **Upload a supported format.** Relay validates the `audio/*` MIME family and does not transcode. M4A/AAC (`audio/mp4`) is the recommended interoperable format. MP3 and WAV also play in Relay's AVFoundation player.
* **Expect normal message behavior**: the same response, history, replies, reactions, idempotency, and delivery and read receipts.

Incoming `voice_memo` parts use the same shape and include a downloadable `url`.

## Next steps

* [Attachments](https://docs.relayapp.im/guides/attachments)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)


---

# Rich link previews

> Render a URL as a native card with page metadata.

Send a `link_preview` part to render a URL as a native preview card.

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

Relay preserves part order, so a preview can follow text in the same send:

```json
{
  "parts": [
    { "type": "text", "text": "This is the source I used:" },
    { "type": "link_preview", "url": "https://example.com/article" }
  ]
}
```

The send commits two messages in display order: a text message, then the
preview card message. Replies and reactions can target the text or the card
separately, because each is its own message.

## Preview metadata and fallback

Relay's iOS app loads page metadata through the native Link Presentation
framework. The destination decides which card renders.

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

Rich previews use normal message behavior: the same response, history, events,
idempotency, replies, reactions, and delivery and read receipts.

## Next steps

* [Sending messages](https://docs.relayapp.im/guides/sending-messages) for every part type
* [Reactions](https://docs.relayapp.im/guides/reactions) for targeting one part


---

# Reactions

> Add and remove tapback-style reactions on a message, and receive reaction events.

Add a tapback-style reaction to a message.

## Add or remove a reaction

Use `operation` to add or remove the reaction:

```bash
curl -sS -X POST "https://api.relayapp.im/v1/messages/msg_01JZM3T8AH/reactions" \
  -H "Authorization: Bearer $RELAY_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "operation": "add", "type": "emoji", "emoji": "❤️" }'
```

| Field        | Values                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `operation`  | `add` \| `remove`                                                                               |
| `type`       | `emoji`                                                                                         |
| `emoji`      | required. Any single emoji, e.g. `"🔥"`                                                         |
| `part_index` | optional. Anchors the reaction on one part of a media message; must name a part the message has |

A reaction targets a message id. Because every bubble is a message, reacting
to the message is reacting to exactly the bubble the reader sees. The one
finer grain is a media message holding several photos: pass `part_index` to
anchor the reaction on one photo, which is how per-photo reaction pills work.
Text and card messages take whole-message reactions only.

A success returns the stored reaction, the same object recipients receive in
the event:

```json
{
  "reaction": {
    "message_id": "msg_01JZM3T8AH",
    "part_index": null,
    "type": "emoji",
    "emoji": "❤️",
    "actor": { "kind": "contact", "id": "agt_01JZRELAY" },
    "operation": "add"
  }
}
```

`part_index` is always present, and null on a whole-message reaction. In this
payload `actor.kind` is `user` or `contact`, where `contact` names an agent.
That is the stored actor kind, not the `agent` spelling a message `sender`
carries.

| Case                                              | Result                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| Add or remove succeeds                            | The stored reaction                               |
| Remove a missing reaction, or add an existing one | Idempotent no-op                                  |
| Add a second reaction in the same slot            | Replaces the first, the way a tapback does        |
| Target outside the agent's conversations          | `403 forbidden`                                   |
| More than 120 reactions a minute                  | `429 rate_limited`, with `Retry-After` in seconds |

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
      "type": "emoji",
      "emoji": "❤️",
      "actor": { "kind": "user", "id": "usr_01JZU1F0BD" },
      "operation": "add"
    }
  }
}
```

> **Tip:**
>   Use a reaction when acknowledgment is enough. React with 👍 to a "thanks"
>   instead of sending another message.

## Next steps

* [Event types](https://docs.relayapp.im/reference/events)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
