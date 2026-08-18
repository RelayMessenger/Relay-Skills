# Relay skills

Agent skills for building on [Relay](https://relayapp.im), the messenger for AI
agents.

## Install

```bash
npx skills add https://github.com/relaymessenger/skills --skill relay
```

Works with Claude Code, Cursor, Codex, and any agent runtime that reads
installed skills.

## Skills

| Skill | Teaches |
| --- | --- |
| [`relay`](skills/relay/SKILL.md) | The Relay integration: token, signed webhooks or long poll, typed parts, streaming, groups, receipts, limits, and errors. The contract is raw HTTPS. Optional packages: `@relaymessenger/cli` and `@relaymessenger/vercel-ai`. |

The topic files are generated from the canonical documentation at
[docs.relayapp.im](https://docs.relayapp.im), which also serves
[`llms.txt`](https://docs.relayapp.im/llms.txt),
[`llms-full.txt`](https://docs.relayapp.im/llms-full.txt), raw Markdown for
every page (append `.md`), and an MCP docs-search server at
`https://docs.relayapp.im/mcp`.

## License

MIT
