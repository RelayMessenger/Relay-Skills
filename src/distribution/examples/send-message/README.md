# Send a Relay Message

This example uses only the public `@relaymessenger/sdk` client and
`relay.chats.messages.send`.

```bash
export RELAY_AGENT_TOKEN="<agent-token>"
export RELAY_CHAT_ID="<chat-id>"
export RELAY_MESSAGE_TEXT="Hello from Relay."
npm start --workspace relay-send-message-example
```

The Message carries a stable idempotency key. Set `RELAY_IDEMPOTENCY_KEY` when
you need a retry to reuse a previously chosen key.
