#!/usr/bin/env python3
import re
from pathlib import Path


root = Path(__file__).resolve().parents[1]
skill_path = root / "skills/relay/SKILL.md"
reference_root = skill_path.parent / "references"
skill = skill_path.read_text()
references = sorted(reference_root.glob("*.md"))
all_text = "\n".join([skill, *(path.read_text() for path in references)])

for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", skill):
    if "://" in target or target.startswith("#"):
        continue
    if not (skill_path.parent / target).is_file():
        raise SystemExit(f"broken skill reference: {target}")

linked = set(re.findall(r"\((references/[^)]+\.md)\)", skill))
expected = {
    str(path.relative_to(skill_path.parent))
    for path in references
}
if linked != expected:
    raise SystemExit(f"skill reference index drifted: {sorted(linked ^ expected)}")

for rule in [
    "at least one webhook subscription",
    "no webhook subscriptions",
    "no mode, toggle, or transport setting",
    "http `409`",
    "closes connected agent sockets",
    "deleting the last webhook subscription",
    "events wait durably",
    "30 days",
    "cumulative ack",
    "full_sync",
    "ping every 30 seconds",
    "60 seconds",
    "localhost",
    "private",
    "link-local",
    "cloud metadata",
    "redirects as terminal",
    "repeat an `event_id`",
    "`relay listen`",
    "is deleted",
    "shared `/v1/websocket`",
    "staging api root",
]:
    if rule not in all_text.lower():
        raise SystemExit(f"final Relay guidance is missing: {rule}")

for stale in [
    "relay.websocket.update",
    '{"enabled":true}',
    '"enabled": true',
    "websocket is enabled",
    "long poll",
    "@relaymessenger/cli",
    "@relaymessenger/vercel-ai",
]:
    if stale in all_text.lower():
        raise SystemExit(f"stale Relay skill text returned: {stale}")

print(
    f"validated Relay skill, {len(references)} references, "
    "and final transport guidance"
)
