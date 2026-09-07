#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const lock = JSON.parse(
  await readFile(new URL("../RELAY_V1_LOCK.json", import.meta.url), "utf8"),
);

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const raw = (repository, commit, path) => {
  const parsed = new URL(repository);
  return `https://raw.githubusercontent.com${parsed.pathname}/${commit}/${path}`;
};

for (const [repository, commit, path, expected] of [
  [
    lock.api.repository,
    lock.api.commit,
    lock.api.openapi_path,
    lock.api.openapi_sha256,
  ],
  [
    lock.api.repository,
    lock.api.commit,
    lock.api.skill_path,
    lock.api.skill_sha256,
  ],
  [
    lock.sdk.repository,
    lock.sdk.commit,
    lock.sdk.package_path,
    lock.sdk.package_sha256,
  ],
]) {
  const response = await fetch(raw(repository, commit, path), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${path} could not be fetched`);
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), expected, path);
}

const registry = await fetch(
  "https://registry.npmjs.org/@relaymessenger%2Fsdk",
  { signal: AbortSignal.timeout(30_000) },
);
assert.equal(registry.status, 200);
const metadata = await registry.json();
// The lock pins ONE immutable version, verified above by the sha256 of the
// package.json at a fixed Relay-SDK commit. `dist-tags.<tag>` is a moving
// pointer that the Relay-SDK lane rewrites on every publish, so asserting the
// pin equals it fails on every SDK release and proves nothing about this lock.
// Gate on what the lock actually promises: the channel it names still exists,
// and the pinned version is still published and not deprecated.
const channel = metadata["dist-tags"][lock.sdk.dist_tag];
assert.ok(
  channel,
  `${lock.sdk.package} has no ${lock.sdk.dist_tag} dist-tag`,
);
const pinned = metadata.versions[lock.sdk.version];
assert.ok(
  pinned,
  `${lock.sdk.package}@${lock.sdk.version} is no longer published`,
);
assert.ok(
  !pinned.deprecated,
  `${lock.sdk.package}@${lock.sdk.version} is deprecated: ${pinned.deprecated}`,
);

console.log(
  `verified Relay v1 lock at Docs ${lock.api.commit} and SDK ${lock.sdk.version}` +
    ` (${lock.sdk.dist_tag} tag now at ${channel})`,
);
