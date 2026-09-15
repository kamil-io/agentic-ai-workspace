# Robot People Agentic AI Project

## Objective

Build maintainable marketing and customer-engagement workflows for Robot People Industries.

## Architecture rules

- n8n runs deterministic workflow steps.
- PostgreSQL stores workflow state, approvals and execution evidence.
- Hermes and Gemini provide reasoning and content assistance.
- Salleh_bot provides read-only security review and remediation planning.
- Odoo is the intended business system of record.
- A named human approver controls external publishing.

## Security rules

- Never commit credentials, access tokens, API keys, passwords, SSH keys or credential exports.
- Use n8n Credentials or an approved secret manager for runtime secrets.
- Do not add fallback content to a publishing path.
- Missing, invalid, expired or previously consumed approvals must fail closed.
- Treat workflow exports as templates unless deployment status is independently verified.

## Development rules

- Audit before changing workflow behavior.
- Preserve unrelated user changes.
- Keep workflows inactive by default in version control.
- Validate JSON and embedded JavaScript.
- Run secret scans and review the final diff before committing.
