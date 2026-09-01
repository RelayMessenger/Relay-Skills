#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const provenance = JSON.parse(
  readFileSync(join(root, ".relay-source.json"), "utf8"),
);
assert.match(provenance.source_commit, /^[0-9a-f]{40}$/);
assert.equal(
  provenance.source_repository,
  "https://github.com/RelayMessenger/Relay-Skills",
);

let source = process.env.RELAY_SKILLS_SOURCE_DIR?.trim();
if (source) {
  source = resolve(source);
} else {
  source = mkdtempSync(join(tmpdir(), "relay-skills-source-"));
  execFileSync("git", ["init", "--quiet", source]);
  execFileSync("git", [
    "-C",
    source,
    "remote",
    "add",
    "origin",
    `${provenance.source_repository}.git`,
  ]);
  execFileSync("git", [
    "-C",
    source,
    "fetch",
    "--quiet",
    "--depth",
    "1",
    "origin",
    provenance.source_commit,
  ]);
  execFileSync("git", [
    "-C",
    source,
    "checkout",
    "--quiet",
    "--detach",
    "FETCH_HEAD",
  ]);
}

const actualCommit = execFileSync(
  "git",
  ["-C", source, "rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();
assert.equal(actualCommit, provenance.source_commit);

for (const [path, expected] of Object.entries(provenance.source_files)) {
  const actual = createHash("sha256")
    .update(readFileSync(join(source, path)))
    .digest("hex");
  assert.equal(actual, expected, `source file changed: ${path}`);
}

console.log(
  `verified ${provenance.distribution} source bytes at ${actualCommit}`,
);
