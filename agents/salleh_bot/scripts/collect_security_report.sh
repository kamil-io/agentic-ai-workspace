#!/usr/bin/env bash
set -euo pipefail

# Salleh_bot's OCI collector is intentionally read-only. It sends only a sanitized
# summary to n8n; scanner output and raw logs remain on the host.
config_file="${ABU_CONFIG_FILE:-/home/ubuntu/.config/abu-security/report.env}"
if [[ ! -r "$config_file" ]]; then
  echo "Salleh_bot configuration file is missing: $config_file" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$config_file"
: "${ABU_REPORT_URL:?ABU_REPORT_URL is required}"
: "${ABU_REPORT_SECRET:?ABU_REPORT_SECRET is required}"

repo_path="${ABU_REPOSITORY_PATH:-/home/ubuntu/agentic-ai-workspace}"
trivy_cache_path="${ABU_TRIVY_CACHE_PATH:-/home/ubuntu/.cache/abu-trivy}"
trivy_max_images="${ABU_TRIVY_MAX_IMAGES:-2}"
if [[ ! "$trivy_max_images" =~ ^[1-9][0-9]*$ ]]; then
  echo "ABU_TRIVY_MAX_IMAGES must be a positive integer" >&2
  exit 1
fi
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

write_value() {
  printf '%s' "$2" > "$work_dir/$1"
}

host_name="$(hostname)"
disk_use="$(df -P / | awk 'NR == 2 {print $5}')"
open_ports="$(ss -ltnH | awk '{print $4}' | sed -E 's/.*:([0-9]+)$/\1/' | sort -nu | paste -sd, -)"
containers="$(docker ps --format '{{.Names}}' | sort | paste -sd, -)"
images="$(docker ps --format '{{.Image}}' | sort -u | head -n "$trivy_max_images")"
n8n_summary="$(docker exec -u postgres odoo18-db-1 psql -U odoo -d n8n -Atc "SELECT status || ':' || count(*) FROM execution_entity GROUP BY status ORDER BY status;" 2>/dev/null | paste -sd, - || true)"
iptables_policy="$(sudo -n iptables -S INPUT 2>/dev/null | head -1 || echo unavailable)"

gitleaks_state="unavailable"
gitleaks_findings="0"
if [[ -d "$repo_path" ]]; then
  set +e
  timeout 300 docker run --rm \
    -v "$repo_path:/repo:ro" \
    -v "$work_dir:/report" \
    zricethezav/gitleaks:latest detect --source=/repo --no-git --redact \
    --report-format=json --report-path=/report/gitleaks.json >/dev/null 2>&1
  gitleaks_exit=$?
  set -e
  if [[ -f "$work_dir/gitleaks.json" ]]; then
    gitleaks_findings="$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1])).length)" "$work_dir/gitleaks.json" 2>/dev/null || echo 0)"
    gitleaks_state="completed"
  elif [[ "$gitleaks_exit" -eq 0 ]]; then
    gitleaks_state="completed"
  else
    gitleaks_state="error"
  fi
fi

trivy_state="unavailable"
trivy_critical="0"
trivy_high="0"
if [[ -n "$images" ]]; then
  mkdir -p "$trivy_cache_path"
  trivy_state="completed"
  while IFS= read -r image; do
    [[ -z "$image" ]] && continue
    report_file="$work_dir/trivy-$(printf '%s' "$image" | sha256sum | cut -d' ' -f1).json"
    set +e
    timeout 600 docker run --rm \
      -v "$trivy_cache_path:/root/.cache/" \
      aquasec/trivy:latest image --quiet --format json --scanners vuln "$image" > "$report_file" 2>/dev/null
    trivy_exit=$?
    set -e
    if [[ "$trivy_exit" -ne 0 || ! -s "$report_file" ]]; then
      trivy_state="partial"
      continue
    fi
    counts="$(node -e "const r=require(process.argv[1]); let c=0,h=0; for(const x of r.Results||[]) for(const v of x.Vulnerabilities||[]){if(v.Severity==='CRITICAL')c++; if(v.Severity==='HIGH')h++;} console.log(c+','+h)" "$report_file" 2>/dev/null || echo '0,0')"
    trivy_critical=$((trivy_critical + ${counts%,*}))
    trivy_high=$((trivy_high + ${counts#*,}))
  done <<< "$images"
fi

write_value hostname "$host_name"
write_value generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
write_value disk_use "$disk_use"
write_value open_ports "$open_ports"
write_value containers "$containers"
write_value n8n_summary "$n8n_summary"
write_value iptables_policy "$iptables_policy"
write_value gitleaks_state "$gitleaks_state"
write_value gitleaks_findings "$gitleaks_findings"
write_value trivy_state "$trivy_state"
write_value trivy_critical "$trivy_critical"
write_value trivy_high "$trivy_high"

node - "$work_dir" > "$work_dir/report.json" <<'NODE'
const fs = require('fs');
const dir = process.argv[2];
const read = (name) => fs.readFileSync(`${dir}/${name}`, 'utf8');
console.log(JSON.stringify({
  schemaVersion: 1,
  source: 'abu-oci',
  generatedAt: read('generated_at'),
  hostname: read('hostname'),
  diskUse: read('disk_use'),
  openPorts: read('open_ports'),
  containers: read('containers'),
  n8nExecutions: read('n8n_summary'),
  firewall: read('iptables_policy'),
  gitleaks: { status: read('gitleaks_state'), findings: Number(read('gitleaks_findings')) },
  trivy: { status: read('trivy_state'), critical: Number(read('trivy_critical')), high: Number(read('trivy_high')) }
}));
NODE

curl --fail --silent --show-error --retry 2 --max-time 30 \
  -H 'Content-Type: application/json' \
  -H "X-Abu-Report-Secret: $ABU_REPORT_SECRET" \
  --data-binary "@$work_dir/report.json" \
  "$ABU_REPORT_URL"
