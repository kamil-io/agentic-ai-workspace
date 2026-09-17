# Workflow portfolios

Workflows are organised by accountable agent, then business capability. Agent ownership does not grant approval authority. A named human still approves the exact stored content before external publication.

| Portfolio | Scope | Templates |
| --- | --- | --- |
| Hafeez_bot | Threads content and community engagement | `hafeez_bot/threads/` — outbound, autopost, autoreply, content factory |
| Hafeez_bot | Robot People public education | `hafeez_bot/robot-people/` — daily draft generation and Telegram review request |
| Hafeez_bot | Takaful content | `hafeez_bot/takaful/` — manual content preparation |
| Fahmi_bot | Shared human review coordination | `fahmi_bot/approvals/` — separate handlers for publishing approvals and Robot People review decisions |
| Salleh_bot | Read-only security reporting | `salleh_bot/security/` — security report |
| Azri_bot | Manual integration maintenance | `azri_bot/maintenance/` — legacy token setup; not production-ready |
| Alan_bot | Sales qualification and customer care | No verified workflow yet |
| Man_bot | Finance and cash flow | No verified workflow yet |
| Ahmad_ceo_bot | Strategic briefings | Existing root `ceo-reminder.json` is a legacy dated reminder with local user edits; excluded from activation |

`templates/` contains legacy reference material, not approved production workflows. Root `ceo-reminder.json` is retained temporarily to preserve the user's edits. Neither belongs in a blanket activation operation.

## Ownership and handoffs

Hafeez_bot prepares content → PostgreSQL stores draft and target → Fahmi_bot requests named-human approval → shared publisher validates the approval → publishing result is recorded → Hafeez_bot receives the outcome. Salleh_bot reviews evidence; Azri_bot maintains implementation. Neither independently approves content.

## Naming and registration

Use `workflows/<agent>/<capability>/<workflow>.json`. Keep one canonical template per workflow. Proposed n8n display names use `<Agent> | <Brand> | <Purpose>`; tags use owner, brand and capability. Apply production names/tags through a verified n8n deployment, not raw database edits.

Every new workflow must declare owner, purpose, brand, trigger/schedule/timezone, credential types (no values), inputs, outputs, approval requirements, dependencies, failure handling, tests and verified deployment status. Repository presence or agent naming does not prove deployment.

Templates stay inactive in version control. Record activation separately with deployed workflow ID/version, timestamp and test evidence. Manual maintenance tools should not be scheduled merely to make every workflow active.

## Current activation gates

Robot People's daily draft and review-decision workflows were verified active on 16 September 2026. They store the draft and decision in PostgreSQL, accept actions only from the configured Telegram reviewer and chat, and contain no Threads publishing operation. An approval records `APPROVED`; it does not publish.

The live read-only inventory on 15 September 2026 showed the security report active; Threads outbound, approval handler, content factory and token setup inactive. Autopost and Autoreply were absent. This inventory does not verify functional health.

- Confirm the first brand and publishing pace; existing Threads content targets KebunData farming.
- Repair Autopost, Autoreply and Content Factory to store drafts and use the shared approval gate.
- Authenticate Content Factory and reject missing inputs.
- Extend the publisher contract to distinguish standalone posts from replies.
- Verify the actual publishing database, additive migrations, credentials and deployed versions.
- Test approval expiry, immutable approved content, duplicate records/concurrent claims and uncertain external publication outcomes.
- Verify draft-only operation before enabling triggers. A runtime activation is not approval of future content.

See [publishing audit](../docs/task-3-publishing-audit.md) and [partial repair](../docs/task-3-approval-repair.md). Moving files does not resolve these gates.
