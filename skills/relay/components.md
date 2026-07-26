<!-- Generated from the canonical Relay docs at docs.relayapp.im; regenerate with build-skill.py rather than editing by hand. -->

# Message components

> Send native buttons, selects, cards, confirmations, and agent permission requests as data parts.

Message components are recognized `data` parts inside an ordinary Relay message. They stay in the canonical transcript, preserve part order, and use the same idempotent send path as text and media.

Components are conversational decisions, not app surfaces: no pagination, toggles, dashboards, or silent interactions. Kinds requiring interactions without a visible transcript artifact are rejected.

- **[Buttons](https://docs.relayapp.im/components/buttons)** — A vertical stack with up to five options.

  - **[Select](https://docs.relayapp.im/components/select)** — A collapsed row that opens a native single-select sheet.

  - **[Card](https://docs.relayapp.im/components/card)** — A slot-based media card with up to two actions.

  - **[Confirm](https://docs.relayapp.im/components/confirm)** — A two-role confirm and deny decision.

  - **[Agent permission request](https://docs.relayapp.im/components/agent_permission_request)** — The permission component already emitted by relayapp integrations.
## One message path

An agent sends a component as `{ "type": "data", "data": { "kind": "…" } }`. Relay validates recognized v1 kinds and adds `data.fallback` when it is absent. A tap sends a normal user message whose data part identifies the source option:

```json
{
  "parts": [
    {
      "type": "data",
      "data": {
        "origin": {
          "kind": "data_action",
          "message_id": "msg_01JZM4Q9VN",
          "part_index": 0,
          "option_id": "book",
          "source_kind": "buttons"
        },
        "option_id": "book",
        "label": "Book it"
      }
    }
  ],
  "fallback_text": "Book it"
}
```

If an option already carries `origin`, as permission options do, the client echoes that object verbatim.

`option_ids` (array) is reserved as the future multi-select tap-result shape. Version 1 is single-select; do not emit or interpret `option_ids` yet.

## Common option fields

| Field         | Required | Contract                                                                                                |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `id`          | Yes      | 1–200 bytes, unique within the part, `[A-Za-z0-9_.:-]`; this ASCII charset makes bytes equal characters |
| `label`       | Yes      | 1–24 characters                                                                                         |
| `description` | No       | Up to 72 characters; select rows and card actions only                                                  |
| `style`       | No       | `default`, `primary`, or `danger`; at most one `primary` per part                                       |
| `url`         | No       | Credential-free HTTPS link-out; an option with a URL does not send a postback tap                       |
| `disabled`    | No       | `true` renders the option non-tappable and excludes it from synthesized fallback numbering              |

Every recognized component prompt is limited to 1,024 characters. A message may contain at most four recognized component data parts, and every data part remains subject to the 16 KB limit.

## Fallback and compatibility

Relay synthesizes a missing component fallback from the prompt or title followed by numbered option labels. Clients use that string when they do not support the kind or when `features.postback_interactions` is `false`.

The feature flag controls client rendering only. It does not block component sending, validation, or storage. Unknown `data.kind` values pass through unchanged so clients can render `data.fallback` or the message-level `fallback_text`. Consumers must ignore unknown fields inside known kinds.

> **Warning:**
> Component parts are valid only in 1:1 threads in v1. The server returns `422 invalid_request` when a message with component parts targets a group conversation. Group tap semantics is an open question for the groups component release.

> **Note:**
> [Quick-reply suggestions](https://docs.relayapp.im/guides/sending-messages#quick-replies) are a separate feature. Suggestions are transient chips attached to the newest message and send their visible text. Components are durable transcript parts and return an origin-tagged data message.

The machine-readable registry is `docs/components/catalog.json`. Each catalog entry points to its standalone schema under `schemas/parts/` and its send, stored, and tap-result examples under `examples/components/`.

## See also

* [Sending messages](https://docs.relayapp.im/guides/sending-messages)
* [Buttons component](https://docs.relayapp.im/components/buttons)
* [Select component](https://docs.relayapp.im/components/select)
* [Confirm component](https://docs.relayapp.im/components/confirm)
* [Card component](https://docs.relayapp.im/components/card)


---

# Buttons component

> Attach a vertical stack of up to five options to an agent message.

## Abstract

Use `buttons` when a short set of distinct actions should remain attached to the agent message that requested them. An option without `url` sends an origin-tagged user data message; an option with `url` opens its HTTPS destination.

## Preview

> **Note:**
> TODO: add the real iOS lane capture from `/tmp/relay-component-buttons.png`. This slot intentionally has no fabricated screenshot.

## Wire example

```json
{
  "send": {
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "data",
      "data": {
        "kind": "buttons",
        "prompt": "Want me to book it?",
        "options": [
          { "id": "book", "label": "Book it", "style": "primary" },
          { "id": "later", "label": "Remind me later" }
        ]
      }
    }]
  },
  "stored_part": {
    "part_index": 0,
    "type": "data",
    "data": {
      "kind": "buttons",
      "prompt": "Want me to book it?",
      "options": [
        { "id": "book", "label": "Book it", "style": "primary" },
        { "id": "later", "label": "Remind me later" }
      ],
      "fallback": "Want me to book it?\n1. Book it\n2. Remind me later"
    }
  },
  "tap_result": {
    "parts": [{
      "type": "data",
      "data": {
        "origin": {
          "kind": "data_action",
          "message_id": "msg_01JZM4Q9VN",
          "part_index": 0,
          "option_id": "book",
          "source_kind": "buttons"
        },
        "option_id": "book",
        "label": "Book it"
      }
    }],
    "fallback_text": "Book it"
  }
}
```

## Schema table

| Field      | Type        | Required | Notes                    |
| ---------- | ----------- | -------- | ------------------------ |
| `kind`     | `"buttons"` | Yes      | Selects this renderer    |
| `prompt`   | string      | No       | Up to 1,024 characters   |
| `options`  | option\[]   | Yes      | 1–5 options              |
| `fallback` | string      | No       | Synthesized when omitted |

Button options use the [common option fields](https://docs.relayapp.im/components#common-option-fields), except `description` is not accepted.

## Examples per state

| State                    | Repository artifact                           |
| ------------------------ | --------------------------------------------- |
| Send request             | `examples/components/buttons-send.json`       |
| Canonical stored message | `examples/components/buttons-stored.json`     |
| Tap-result user message  | `examples/components/buttons-tap-result.json` |

## Constraints

| Violation                            | Result                |
| ------------------------------------ | --------------------- |
| No options or more than 5            | `422 invalid_request` |
| Duplicate or invalid option `id`     | `422 invalid_request` |
| Option label over 24 characters      | `422 invalid_request` |
| More than one `primary` option       | `422 invalid_request` |
| `description` on a button option     | `422 invalid_request` |
| Non-HTTPS option URL                 | `422 invalid_request` |
| Message targets a group conversation | `422 invalid_request` |

## iOS rendering notes

Render `ComponentButtons` as a vertical stack under the owning agent bubble at message width. A selected option becomes selected, siblings disable, and an in-flight tap shows a spinner. Style HTTPS link-out options as quieter navigation rows rather than reply choices. A failed send re-enables the options with a brief error.

## See also

* [Message components](https://docs.relayapp.im/components)
* [Confirm](https://docs.relayapp.im/components/confirm)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)


---

# Select component

> Open a native single-select sheet from a collapsed transcript row.

## Abstract

Use `select` when the user should choose one item from a longer, optionally sectioned list. The transcript shows `button_label`; tapping it opens the native picker sheet.

## Preview

> **Note:**
> TODO: add the real iOS lane capture from `/tmp/relay-component-select.png`. This slot intentionally has no fabricated screenshot.

## Wire example

```json
{
  "send": {
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "data",
      "data": {
        "kind": "select",
        "prompt": "Pick a slot",
        "button_label": "View slots",
        "sections": [{
          "title": "Tuesday",
          "options": [{ "id": "tue-2pm", "label": "2:00pm", "description": "45 min" }]
        }]
      }
    }]
  },
  "stored_part": {
    "part_index": 0,
    "type": "data",
    "data": {
      "kind": "select",
      "prompt": "Pick a slot",
      "button_label": "View slots",
      "sections": [{
        "title": "Tuesday",
        "options": [{ "id": "tue-2pm", "label": "2:00pm", "description": "45 min" }]
      }],
      "fallback": "Pick a slot\n1. 2:00pm"
    }
  },
  "tap_result": {
    "parts": [{
      "type": "data",
      "data": {
        "origin": {
          "kind": "data_action",
          "message_id": "msg_01JZM5Q9VN",
          "part_index": 0,
          "option_id": "tue-2pm",
          "source_kind": "select"
        },
        "option_id": "tue-2pm",
        "label": "2:00pm"
      }
    }],
    "fallback_text": "2:00pm"
  }
}
```

## Schema table

| Field                | Type       | Required | Notes                          |
| -------------------- | ---------- | -------- | ------------------------------ |
| `kind`               | `"select"` | Yes      | Selects this renderer          |
| `prompt`             | string     | No       | Up to 1,024 characters         |
| `button_label`       | string     | Yes      | 1–20 characters                |
| `sections`           | section\[] | Yes      | 1–5 sections, 12 options total |
| `sections[].title`   | string     | No       | Up to 24 characters            |
| `sections[].options` | option\[]  | Yes      | Non-empty within each section  |
| `fallback`           | string     | No       | Synthesized when omitted       |

Select options use all [common option fields](https://docs.relayapp.im/components#common-option-fields), including the optional 72-character description.

## Examples per state

| State                    | Repository artifact                          |
| ------------------------ | -------------------------------------------- |
| Send request             | `examples/components/select-send.json`       |
| Canonical stored message | `examples/components/select-stored.json`     |
| Tap-result user message  | `examples/components/select-tap-result.json` |

## Constraints

| Violation                                | Result                |
| ---------------------------------------- | --------------------- |
| No sections or more than 5               | `422 invalid_request` |
| Empty section option list                | `422 invalid_request` |
| More than 12 options across all sections | `422 invalid_request` |
| `button_label` over 20 characters        | `422 invalid_request` |
| Section title over 24 characters         | `422 invalid_request` |
| Description over 72 characters           | `422 invalid_request` |
| Message targets a group conversation     | `422 invalid_request` |

## iOS rendering notes

Render `ComponentSelect` as one collapsed row at message width. Present a native single-select `.sheet` on tap. After a successful choice, show the selected label, disable other choices, and preserve the selection in the transcript.

## See also

* [Message components](https://docs.relayapp.im/components)
* [Buttons](https://docs.relayapp.im/components/buttons)
* [Sending messages](https://docs.relayapp.im/guides/sending-messages)


---

# Confirm component

> Ask for one explicit confirm-or-deny decision in the transcript.

## Abstract

Use `confirm` for a consequential binary decision. The two named roles keep confirmation and denial semantics explicit even when the labels are task-specific.

## Preview

> **Note:**
> TODO: add the real iOS lane capture from `/tmp/relay-component-confirm.png`. This slot intentionally has no fabricated screenshot.

## Wire example

```json
{
  "send": {
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "data",
      "data": {
        "kind": "confirm",
        "prompt": "Cancel Tuesday's reservation?",
        "confirm": { "id": "yes", "label": "Cancel", "style": "danger" },
        "deny": { "id": "keep", "label": "Keep it" }
      }
    }]
  },
  "stored_part": {
    "part_index": 0,
    "type": "data",
    "data": {
      "kind": "confirm",
      "prompt": "Cancel Tuesday's reservation?",
      "confirm": { "id": "yes", "label": "Cancel", "style": "danger" },
      "deny": { "id": "keep", "label": "Keep it" },
      "fallback": "Cancel Tuesday's reservation?\n1. Cancel\n2. Keep it"
    }
  },
  "tap_result": {
    "parts": [{
      "type": "data",
      "data": {
        "origin": {
          "kind": "data_action",
          "message_id": "msg_01JZM7Q9VN",
          "part_index": 0,
          "option_id": "yes",
          "source_kind": "confirm"
        },
        "option_id": "yes",
        "label": "Cancel"
      }
    }],
    "fallback_text": "Cancel"
  }
}
```

## Schema table

| Field      | Type        | Required | Notes                    |
| ---------- | ----------- | -------- | ------------------------ |
| `kind`     | `"confirm"` | Yes      | Selects this renderer    |
| `prompt`   | string      | No       | Up to 1,024 characters   |
| `confirm`  | option      | Yes      | Confirmation role        |
| `deny`     | option      | Yes      | Denial role              |
| `fallback` | string      | No       | Synthesized when omitted |

Confirm and deny use the [common option fields](https://docs.relayapp.im/components#common-option-fields), except `description` is not accepted. Their IDs must differ.

## Examples per state

| State                    | Repository artifact                           |
| ------------------------ | --------------------------------------------- |
| Send request             | `examples/components/confirm-send.json`       |
| Canonical stored message | `examples/components/confirm-stored.json`     |
| Tap-result user message  | `examples/components/confirm-tap-result.json` |

## Constraints

| Violation                            | Result                |
| ------------------------------------ | --------------------- |
| Missing `confirm` or `deny`          | `422 invalid_request` |
| Duplicate role IDs                   | `422 invalid_request` |
| Prompt over 1,024 characters         | `422 invalid_request` |
| Invalid option label, style, or URL  | `422 invalid_request` |
| Message targets a group conversation | `422 invalid_request` |

## iOS rendering notes

Render `ComponentConfirm` as a role-styled pair at message width. Keep short labels side by side, then stack the options for accessibility Dynamic Type or longer labels. Use Relay's danger red for destructive confirmation, keep the denial neutral, and apply the shared selected, disabled, in-flight, and retry states.

## See also

* [Message components](https://docs.relayapp.im/components)
* [Agent permission request](https://docs.relayapp.im/components/agent_permission_request)
* [Buttons](https://docs.relayapp.im/components/buttons)


---

# Card component

> Send a slot-based media card with a title, captions, link, and up to two actions.

## Abstract

Use `card` for one rich object whose image, title, metadata, destination, and actions belong together. Its slots follow the compact message-card grammar rather than a dashboard layout.

## Preview

> **Note:**
> TODO: add the real iOS lane capture from `/tmp/relay-component-card.png`. This slot intentionally has no fabricated screenshot.

## Wire example

```json
{
  "send": {
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "data",
      "data": {
        "kind": "card",
        "media": { "url": "https://example.com/osteria.jpg" },
        "title": "Osteria Mozza",
        "subtitle": "Italian · $$$",
        "caption": "Tue 2:00pm",
        "trailing_caption": "2 seats",
        "url": "https://example.com/restaurants/osteria-mozza",
        "options": [{ "id": "reserve", "label": "Reserve", "style": "primary" }]
      }
    }]
  },
  "stored_part": {
    "part_index": 0,
    "type": "data",
    "data": {
      "kind": "card",
      "media": { "url": "https://example.com/osteria.jpg" },
      "title": "Osteria Mozza",
      "subtitle": "Italian · $$$",
      "caption": "Tue 2:00pm",
      "trailing_caption": "2 seats",
      "url": "https://example.com/restaurants/osteria-mozza",
      "options": [{ "id": "reserve", "label": "Reserve", "style": "primary" }],
      "fallback": "Osteria Mozza\n1. Reserve"
    }
  },
  "tap_result": {
    "parts": [{
      "type": "data",
      "data": {
        "origin": {
          "kind": "data_action",
          "message_id": "msg_01JZM6Q9VN",
          "part_index": 0,
          "option_id": "reserve",
          "source_kind": "card"
        },
        "option_id": "reserve",
        "label": "Reserve"
      }
    }],
    "fallback_text": "Reserve"
  }
}
```

## Schema table

| Field              | Type      | Required | Notes                                                      |
| ------------------ | --------- | -------- | ---------------------------------------------------------- |
| `kind`             | `"card"`  | Yes      | Selects this renderer                                      |
| `media`            | object    | No       | Exactly one `attachment_id` or credential-free HTTPS `url` |
| `title`            | string    | Yes      | 1–60 characters                                            |
| `subtitle`         | string    | No       | Up to 60 characters                                        |
| `caption`          | string    | No       | Up to 60 characters                                        |
| `trailing_caption` | string    | No       | Up to 60 characters                                        |
| `url`              | string    | No       | Credential-free HTTPS card destination                     |
| `options`          | option\[] | No       | Up to 2 actions                                            |
| `fallback`         | string    | No       | Synthesized when omitted                                   |

Card options use all [common option fields](https://docs.relayapp.im/components#common-option-fields), including the optional 72-character description.

## Examples per state

| State                    | Repository artifact                        |
| ------------------------ | ------------------------------------------ |
| Send request             | `examples/components/card-send.json`       |
| Canonical stored message | `examples/components/card-stored.json`     |
| Tap-result user message  | `examples/components/card-tap-result.json` |

## Constraints

| Violation                                   | Result                |
| ------------------------------------------- | --------------------- |
| Missing, empty, or over-60-character title  | `422 invalid_request` |
| Subtitle or caption over 60 characters      | `422 invalid_request` |
| More than 2 options                         | `422 invalid_request` |
| Both or neither media source inside `media` | `422 invalid_request` |
| Non-HTTPS media or card URL                 | `422 invalid_request` |
| Message targets a group conversation        | `422 invalid_request` |

## iOS rendering notes

Render `ComponentCard` at normal message width with slots for media, title,
subtitle, captions, and actions.

* Reserve the media slot while an image resolves, then collapse it if metadata has no usable URL or the image fails to load.
* Keep the card as transcript content, without dashboard chrome.
* Use the existing attachment path for `attachment_id` media.
* Style link-out options as navigation rather than postback choices.

## See also

* [Message components](https://docs.relayapp.im/components)
* [Attachments](https://docs.relayapp.im/guides/attachments)
* [Buttons](https://docs.relayapp.im/components/buttons)


---

# Agent permission request component

> Render relayapp permission choices with their original tap origins intact.

## Abstract

`agent_permission_request` is the permission component already emitted by Relay's coding-agent integrations. Relay validates the shared component fields, preserves integration-owned top-level fields, and never rewrites the option origins.

## Preview

> **Note:**
> TODO: add the real iOS lane capture from `/tmp/relay-component-agent-permission-request.png`. This slot intentionally has no fabricated screenshot.

## Wire example

```json
{
  "send": {
    "conversation_id": "cnv_01JZC7K4RQ",
    "parts": [{
      "type": "data",
      "data": {
        "kind": "agent_permission_request",
        "request_id": "perm_01JZ8A4M",
        "tool_name": "Bash",
        "options": [
          {
            "id": "allow",
            "label": "Allow",
            "style": "primary",
            "origin": { "kind": "agent_permission", "request_id": "perm_01JZ8A4M" }
          },
          {
            "id": "deny",
            "label": "Deny",
            "origin": { "kind": "agent_permission", "request_id": "perm_01JZ8A4M" }
          }
        ]
      }
    }]
  },
  "stored_part": {
    "part_index": 0,
    "type": "data",
    "data": {
      "kind": "agent_permission_request",
      "request_id": "perm_01JZ8A4M",
      "tool_name": "Bash",
      "options": [
        {
          "id": "allow",
          "label": "Allow",
          "style": "primary",
          "origin": { "kind": "agent_permission", "request_id": "perm_01JZ8A4M" }
        },
        {
          "id": "deny",
          "label": "Deny",
          "origin": { "kind": "agent_permission", "request_id": "perm_01JZ8A4M" }
        }
      ],
      "fallback": "1. Allow\n2. Deny"
    }
  },
  "tap_result": {
    "parts": [{
      "type": "data",
      "data": {
        "origin": { "kind": "agent_permission", "request_id": "perm_01JZ8A4M" },
        "option_id": "allow",
        "label": "Allow"
      }
    }],
    "fallback_text": "Allow"
  }
}
```

## Schema table

| Field                  | Type                         | Required | Notes                                    |
| ---------------------- | ---------------------------- | -------- | ---------------------------------------- |
| `kind`                 | `"agent_permission_request"` | Yes      | Selects the permission renderer          |
| `request_id`           | string                       | Yes      | Non-empty integration request identity   |
| `prompt`               | string                       | No       | Up to 1,024 characters                   |
| `options`              | permission option\[]         | Yes      | Non-empty; every option carries `origin` |
| `fallback`             | string                       | No       | Synthesized when omitted                 |
| Other top-level fields | JSON                         | No       | Preserved for relayapp compatibility     |

Each option uses `id`, `label`, optional `style`, and a required `origin` object. Permission options cannot combine an origin with a link-out URL.

## Examples per state

| State                    | Repository artifact                                            |
| ------------------------ | -------------------------------------------------------------- |
| Send request             | `examples/components/agent_permission_request-send.json`       |
| Canonical stored message | `examples/components/agent_permission_request-stored.json`     |
| Tap-result user message  | `examples/components/agent_permission_request-tap-result.json` |

## Constraints

| Violation                                 | Result                |
| ----------------------------------------- | --------------------- |
| Missing or empty `request_id`             | `422 invalid_request` |
| Empty option list                         | `422 invalid_request` |
| Option without `origin`                   | `422 invalid_request` |
| Origin combined with a link-out URL       | `422 invalid_request` |
| Invalid common option ID, label, or style | `422 invalid_request` |
| Message targets a group conversation      | `422 invalid_request` |

## iOS rendering notes

Render with `ComponentConfirm` machinery while preserving the integration's allow and deny labels. On tap, echo the chosen option's `origin` object verbatim instead of constructing `data_action`.

## See also

* [Message components](https://docs.relayapp.im/components)
* [Confirm](https://docs.relayapp.im/components/confirm)
* [Coding agents](https://docs.relayapp.im/guides/coding-agents)
