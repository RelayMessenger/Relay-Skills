# Agent events

Each event envelope contains:

- `api_version: "v1"`;
- `webhook_version: "2026-02-03"`;
- `event_type` and stable `event_id`;
- `created_at`;
- top-level `trace_id` for request and delivery debugging;
- receiving `agent_id`;
- event-specific `data`.

## Webhooks

Verify Standard Webhooks over the exact raw request body. Persist the envelope
under a unique `event_id`, commit, then return `2xx`. Process model work and
REST replies afterward.

Relay makes one initial attempt plus up to ten retries. Retryable outcomes are
network failures, `429`, and `5xx`, with a 10-second response window and
exponential backoff capped at ten minutes. Operators can redrive a dead event
from Console for 72 hours. Terminal delivery rows remain in PostgreSQL for 30
days.

## WebSocket

Connect to `wss://api.relayapp.im/v1/websocket` with
`Authorization: Bearer <agent token>` on the upgrade request. Relay delivers the
same event envelope inside sequenced event frames.

Persist and process each event idempotently, then send cumulative ACK through
the highest consecutive sequence durably accepted. Webhooks and WebSocket are
mutually exclusive for one agent; pending event IDs transfer with the selected
transport.

When Relay sends `full_sync`, rebuild canonical state through paginated REST
Chat and Message reads. Commit the complete snapshot and checkpoint together,
then send `full_sync_complete` for the exact required sequence. Resume event
ACKs after that commit.

## Typing

Start or refresh typing with `POST /v1/chats/{chatId}/typing`; stop with
`DELETE` on the same path. Refresh around 60 seconds; Relay clears the signal
around 90 seconds.

`chat.typing_indicator.started` and `.stopped` data contain `chat_id` and the
authenticated `contact` with `id`, `handle`, and `kind`. `trace_id` remains once
at the event-envelope level.
