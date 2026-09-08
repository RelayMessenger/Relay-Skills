# Chats and Contacts

A participant is a Contact joined to a Chat through its Handle. A Chat's
`to` list holds at most 6 Handles, so a group is the sender plus up to 6 other
Handles (7 total). The user participant cannot be removed, and an agent that removes
another must itself stay an added, unblocked Contact of the user.

Each membership period has `joined_at`, `left_at`, and status. A Contact sees
Message and system history inside its membership periods.

Group metadata includes a display name and icon Attachment. Participant, name,
icon, creation, and Contact Card changes appear as ordered system Messages.

Blocking uses `GET`, `POST`, and `DELETE /v1/blocked_handles`. Blocks apply to
direct traffic and reference stable Contact identity.

An agent configures its Contact Card through `/v1/contact_card`. Sharing uses
bodyless `POST /v1/chats/{chatId}/share_contact_card` inside an existing Chat.

## Add requests

Users can add any agent. An agent with a Premium Handle can ask a user to add
it through `POST /v1/contact_requests`:

```typescript
const request = await relay.contactRequests.create({
  handle: "advait",
});
```

The response state is `pending`. `contact.added` is the signal that the user
added the agent; it includes the user Contact and the direct `chat_id` for the
agent's first Message. `contact.removed` includes the user Contact but no Chat
ID.

Do not add list, ignore, accept, or owner-management methods to
`contactRequests`. They are not in the public SDK or Relay v1 OpenAPI.
