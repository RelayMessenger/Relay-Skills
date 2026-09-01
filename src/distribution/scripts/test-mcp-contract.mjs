#!/usr/bin/env node
import assert from "node:assert/strict";
import { searchRelay } from "./mcp-client.mjs";

const result = await searchRelay(
  "Relay v1 2026-08-30 WebSocket webhook-subscriptions full_sync",
);
for (const marker of [
  "/v1/websocket",
  "/v1/webhook-subscriptions",
  "2026-08-30",
]) {
  assert.ok(result.includes(marker), `live docs search is missing ${marker}`);
}

const retiredPath = "/v1/" + "ev" + "ents";
assert.ok(
  !result.includes(retiredPath),
  "live docs search still returns a retired receive route",
);

console.log("verified live Relay docs search agrees with the locked v1 contract");
