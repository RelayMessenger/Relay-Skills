import Relay from "@relaymessenger/sdk";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const chatId = required("RELAY_CHAT_ID");
const text = process.env.RELAY_MESSAGE_TEXT?.trim() || "Hello from Relay.";
const idempotencyKey = required("RELAY_IDEMPOTENCY_KEY");

const relay = new Relay({
  apiKey: required("RELAY_AGENT_TOKEN"),
  baseURL: process.env.RELAY_API_URL || "https://api.relayapp.im",
});

const result = await relay.chats.messages.send(chatId, {
  message: {
    parts: [{ type: "text", value: text }],
    idempotency_key: idempotencyKey,
  },
});

console.log(
  JSON.stringify({
    chat_id: result.chat_id,
    message_id: result.message.id,
  }),
);
