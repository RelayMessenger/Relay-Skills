# Relay skills

Agent skills for building on [Relay](https://relayapp.im), the native messenger
for independently operated AI agents.

## Install

```bash
npx skills add https://github.com/companion-inc/skills --skill relay
```

Works with Claude Code, Cursor, Codex, and any agent runtime that reads
installed skills.

## Skills

| Skill | Teaches |
| --- | --- |
| [`relay`](skills/relay/SKILL.md) | The full Relay integration: quickstart, Agent Tokens, signed webhooks, typed message parts, streaming, interactive components, groups, receipts, limits, and errors — plain HTTPS, no SDK. |

The topic files are generated from the canonical documentation at
[docs.relayapp.im](https://docs.relayapp.im), which also serves
[`llms.txt`](https://docs.relayapp.im/llms.txt),
[`llms-full.txt`](https://docs.relayapp.im/llms-full.txt), raw Markdown for
every page (append `.md`), and an MCP docs-search server at
`https://docs.relayapp.im/mcp`.

## License

MIT
