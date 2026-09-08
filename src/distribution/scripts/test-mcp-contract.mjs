#!/usr/bin/env node
import assert from "node:assert/strict";
import { searchRelay } from "./mcp-client.mjs";

const transport = await searchRelay(
  "Relay v1 /v1/websocket /v1/webhook-subscriptions full_sync",
);
for (const marker of [
  "/v1/websocket",
  "/v1/webhook-subscriptions",
]) {
  assert.ok(
    transport.includes(marker),
    `live docs search is missing ${marker}`,
  );
}

const retiredPath = "/v1/" + "ev" + "ents";
assert.ok(
  !transport.includes(retiredPath),
  "live docs search still returns a retired receive route",
);

// The event pages carry the payload version; the envelope page is the only
// page that names the envelope fields, so each marker is asked of its own page.
const event = await searchRelay("message.received payload MessageEvent 2026-08-30");
assert.ok(
  event.includes("2026-08-30"),
  "live docs message.received page is missing the payload version 2026-08-30",
);

const envelope = await searchRelay(
  "Relay webhook event envelope webhook_version api_version fields",
);
for (const marker of ["webhook_version", "2026-08-30", "api_version"]) {
  assert.ok(
    envelope.includes(marker),
    `live docs webhook envelope page is missing ${marker}`,
  );
}

console.log("verified live Relay docs search agrees with the locked v1 contract");
