# Robot People Agentic AI Workspace

Workflow definitions and operating documentation for Robot People Industries.

The project supports KebunData smart-farming engagement and marketing operations with n8n as the workflow engine, PostgreSQL for state, and human approval before external publishing.

## Agent organisation

See the [company agent organisation](docs/agent-organisation.md) for the proposed chart, confirmed names and role boundaries: Ahmad_ceo_bot as CEO, ak.kamil as Pekebun Data (Developer & Farmer), Fahmi_bot for operations, Alan_bot for sales and customer care, Hafeez_bot for marketing and content, Man_bot for finance and Salleh_bot for security. The Delivery & Automation assistant's name and runtime migrations remain pending.

## Architecture

```text
Threads / Telegram / business inputs
                |
                v
          n8n workflows
                |
      +---------+----------+
      |                    |
      v                    v
PostgreSQL state      Gemini / Hermes
      |
      v
Human approval gate
      |
      v
Threads publishing
```

Odoo is the intended system of record for CRM and commercial operations. The current repository contains workflow definitions and integration plans; it does not claim that every planned integration is live.

## Repository layout

| Path | Purpose |
| --- | --- |
| `agents/` | Agent roles and communication guidance |
| `workflows/` | Importable n8n workflow templates |
| `infrastructure/` | Database schemas and deployment assets |
| `docs/` | Architecture, setup and operating documentation |
| `skills/` | Local development utilities |

## Threads workflow templates

| Workflow | Purpose | Default state |
| --- | --- | --- |
| `kebundata-threads-outbound-engager.json` | Finds suitable conversations, produces a draft, stores it, then requests approval | Inactive |
| `kebundata-threads-approval-handler.json` | Validates an approval against its stored draft and publishes only an approved reply | Inactive |
| `kebundata-threads-autopost.json` | Scheduled draft and publishing template | Inactive |
| `kebundata-threads-autoreply.json` | Inbound reply template | Inactive |
| `kebundata-threads-content-factory.json` | Webhook-driven content template | Inactive |

Read [workflow operations](docs/workflow-operations.md) before importing or activating a workflow.

## Security operations

[Salleh_bot](agents/salleh_bot/SOUL.md) is the local security advisor and operations guardian. Salleh_bot reviews evidence from approved tools across GitHub, n8n, OCI and public services, then prepares remediation plans for human approval. Read [Salleh_bot security operations](docs/security-operations.md) for the operating model and guardrails.

## Security and publishing policy

- Never commit secrets, tokens, keys, database passwords or credential exports.
- Store API secrets only in n8n Credentials or an approved secret manager.
- Keep workflow exports inactive until credentials, webhooks and approval controls are verified.
- A missing, incomplete, expired or already-used approval must block publishing.
- Do not publish generated content until a named human approver has approved the specific stored draft.

## Development

1. Create a feature branch.
2. Make focused changes and validate JSON/YAML.
3. Scan changed files for secrets before committing.
4. Review the diff before deployment.
5. Import to a non-production n8n environment first when practical.

See [the repository operating rules](AGENTS.md) for implementation constraints.
