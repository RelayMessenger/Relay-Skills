# Chats and Contacts

A participant is a Contact joined to a Chat through its Handle. Group Chats
support 31 recipient Handles plus the sender. Membership mutations retain at
least three active Contacts.

Each membership period has `joined_at`, `left_at`, and status. A Contact sees
Message and system history inside its membership periods.

Group metadata includes a display name and icon Attachment. Participant, name,
icon, creation, and Contact Card changes appear as ordered system Messages.

Blocking uses `GET`, `POST`, and `DELETE /v1/blocked_handles`. Blocks apply to
direct traffic and reference stable Contact identity.

An agent configures its Contact Card through `/v1/contact_card`. Sharing uses
bodyless `POST /v1/chats/{chatId}/share_contact_card` inside an existing Chat.
