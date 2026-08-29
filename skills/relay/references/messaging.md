# Messaging

## Send

Use `POST /v1/messages` to resolve or create a Chat from recipient Handles.
Use `POST /v1/chats/{chatId}/messages` for an existing Chat.

A Message contains ordered `parts`:

- `text` with optional structured `mention` and UTF-16 `mention_range`;
- `media` with exactly one uploaded `attachment_id` or remote `url`;
- `link` with one absolute URL as the only part.

Adjacent text parts are invalid. Replies use `reply_to.message_id` and optional
`reply_to.part_index`.

## Attachments

Allocate with `POST /v1/attachments`, upload raw bytes with the returned method
and required headers, then send the returned Attachment ID as a media part.
The allocation and upload byte length and content type must match. WebP is an
image type; SVG is rejected.

Voice memos use the dedicated Chat voice-memo operation after uploading audio.

## Reactions and mentions

Reactions target a Message and part index. Built-in reactions use the named
type; custom reactions also provide `custom_emoji`.

Mentions are group-only structured text-part fields. The mentioned Handle must
be active in the Chat.

## Delivery

`sent`, `delivered`, and `read` are monotonic Message states. Relay stores
per-recipient delivery truth. User delivery means a device durably applied the
Message. Agent delivery means the webhook receiver returned `2xx` after a
durable commit or the WebSocket consumer cumulatively ACKed after one.

The iOS presentation shows Delivered/Read labels in direct Chats. Developers
can inspect per-recipient delivery state for direct and group Chats.
