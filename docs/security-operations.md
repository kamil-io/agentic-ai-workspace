# Salleh_bot security operations

Salleh_bot is the local security advisor for Robot People Industries. Salleh_bot interprets evidence from security tools and proposes remediation; Salleh_bot is not the security control itself.

## Evidence sources

| Area | Evidence to collect |
| --- | --- |
| GitHub | Secret scanning, Dependabot alerts, pull-request diffs and branch protection |
| Repository | Gitleaks, dependency checks and workflow JSON validation |
| OCI | Firewall rules, open ports, package status, disk capacity, backups and restore tests |
| Containers | Trivy findings, image age, running service inventory and container health |
| n8n | Failed executions, webhook authentication, credential references and publishing gates |
| Public services | TLS, security headers and approved non-intrusive external exposure checks |

## Operating cycle

1. Collect read-only evidence.
2. Run deterministic checks.
3. Have Salleh_bot assess severity and impact.
4. Send Ahmad a concise report with remediation options.
5. Apply production changes only after explicit approval.
6. Verify the result and record what changed.

## Required guardrails

- Do not send raw logs or secrets to an external model.
- Restrict active scanning to Robot People assets Ahmad has authorized.
- Do not run destructive security tests in production.
- Treat a security report as advisory until a deterministic check confirms it.
- Keep a restore-tested backup before material infrastructure changes.

## Initial weekly report

The first report should cover:

- New GitHub secret or dependency alerts
- Repository secret scan results
- n8n workflow failures and inactive publishing controls
- OCI open ports, disk capacity and pending updates
- Container image vulnerabilities
- Backup freshness and last successful restore test

## Weekly OCI collector

The versioned collector at `agents/salleh_bot/scripts/collect_security_report.sh` runs on OCI as the `ubuntu` user. It uses read-only checks, sends a sanitized JSON summary to n8n through a header-authenticated webhook, and n8n sends the Telegram report.

Runtime configuration is deliberately outside Git:

```ini
ABU_REPORT_URL=https://n8n.example.com/webhook/abu-weekly-security-report
ABU_REPORT_SECRET=generated-secret-stored-outside-version-control
ABU_REPOSITORY_PATH=/home/ubuntu/agentic-ai-workspace
ABU_TRIVY_MAX_IMAGES=2
ABU_TRIVY_CACHE_PATH=/home/ubuntu/.cache/abu-trivy
```

The collector reports counts and status only. It does not transmit scanner findings, credentials or raw logs.
It scans at most two active container images per run by default to keep the weekly job suitable for the current OCI capacity.

The systemd templates under `agents/salleh_bot/systemd/` schedule the report for Monday at 01:00 UTC with a randomized delay of up to 15 minutes. Their existing `abu-security-report` unit names are retained for runtime compatibility. Installing the files is not enough to activate the timer; a named human operator must explicitly enable it after the n8n webhook credential, Telegram credential, chat ID and host configuration have been verified.

Suggested deployment sequence:

1. Import `workflows/abu-weekly-security-report.json` into n8n and keep it inactive.
2. Assign an n8n Header Auth credential whose header is `X-Abu-Report-Secret`, assign the Telegram credential, and replace `YOUR_TELEGRAM_CHAT_ID`.
3. Create `/home/ubuntu/.config/abu-security/report.env` with mode `0600`; never add it to Git.
4. Install the collector at `/usr/local/lib/abu-security/collect_security_report.sh` and the service and timer templates in `/etc/systemd/system/`, then run one manual service test while the n8n workflow is active and observed.
5. Only after the test is reviewed, enable `abu-security-report.timer`.
