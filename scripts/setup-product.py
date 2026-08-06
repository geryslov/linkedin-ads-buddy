#!/usr/bin/env python3
"""
One-shot setup for the standalone LinkedIn Ads MCP product.

Does everything that needs a Supabase access token:
  1. verifies the token can actually see the project (the usual failure)
  2. applies the two product migrations
  3. deploys the linkedin-api edge function
  4. mints the mcp_server JWT for Railway
  5. verifies the result

Usage:
    export SUPABASE_ACCESS_TOKEN=sbp_...
    python3 scripts/setup-product.py

    # optional: also mint SUPABASE_MCP_JWT (needs the project JWT secret from
    # Dashboard -> Settings -> API -> JWT Settings)
    export SUPABASE_JWT_SECRET=...
    python3 scripts/setup-product.py

Safe to re-run: the migrations use `if not exists` / `create or replace`, and
the deploy is idempotent.

Stdlib only. Nothing is printed that would leak a token.
"""

import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

PROJECT_REF = "bxoxefmenvlxiubynuay"
API = "https://api.supabase.com/v1"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MIGRATIONS = [
    "supabase/migrations/20260805120000_mcp_product_keys.sql",
    "supabase/migrations/20260805120100_resolve_mcp_key_rpc.sql",
]

OK, BAD, INFO = "  \033[32m✓\033[0m", "  \033[31m✗\033[0m", "  \033[36m·\033[0m"


def die(msg, *hints):
    print(f"{BAD} {msg}")
    for h in hints:
        print(f"      {h}")
    sys.exit(1)


def api(method, path, token, body=None):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"message": raw[:300]}


def step(n, title):
    print(f"\n\033[1m{n}. {title}\033[0m")


def main():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        die(
            "SUPABASE_ACCESS_TOKEN is not set.",
            "Create one at https://supabase.com/dashboard/account/tokens",
            "It must be UNRESTRICTED — a scoped token cannot deploy functions.",
        )

    # ── 1. Token reachability ────────────────────────────────────────────────
    # This is the step that has failed every time so far, so check it first and
    # explain precisely rather than letting a later 403 be the symptom.
    step(1, "Verifying token access")

    status, projects = api("GET", "/projects", token)
    refs = [p.get("id") for p in projects] if isinstance(projects, list) else []

    # Two distinct symptoms, one cause. A restricted token has been observed
    # returning BOTH `200 []` and `403` for the same request minutes apart, so
    # treat them identically rather than trusting the status code.
    if status != 200 or PROJECT_REF not in refs:
        org_status, orgs = api("GET", "/organizations", token)
        org_names = (
            ", ".join(o.get("name", "?") for o in orgs)
            if isinstance(orgs, list) and orgs
            else "none"
        )
        symptom = (
            f"HTTP {status} listing projects"
            if status != 200
            else f"projects visible: {refs or 'NONE'}"
        )
        die(
            f"Token cannot reach project {PROJECT_REF}.",
            f"Symptom: {symptom}",
            f"Organizations visible: {org_names}"
            + ("" if org_status == 200 else f" (org lookup also HTTP {org_status})"),
            "",
            "The token authenticates but lacks project access. Two causes:",
            "  a) it is a RESTRICTED/scoped token — create an unrestricted",
            "     personal access token at",
            "     https://supabase.com/dashboard/account/tokens",
            "  b) the signed-in account is not a member of the organization",
            "     that owns this project — check the org switcher in the",
            "     dashboard against the org listed above",
            "",
            "Quick check for a new token (should list the project, not []):",
            '  curl -sS https://api.supabase.com/v1/projects \\',
            '    -H "Authorization: Bearer sbp_NEW" | head -c 200',
        )
    print(f"{OK} token can see {PROJECT_REF}")

    # ── 2. Migrations ────────────────────────────────────────────────────────
    step(2, "Applying migrations")

    for rel in MIGRATIONS:
        path = os.path.join(REPO, rel)
        if not os.path.exists(path):
            die(f"missing migration: {rel}")
        sql = open(path).read()
        status, resp = api(
            "POST", f"/projects/{PROJECT_REF}/database/query", token, {"query": sql}
        )
        if status not in (200, 201):
            msg = (resp or {}).get("message", "")
            die(f"{os.path.basename(rel)} failed (HTTP {status})", msg[:400])
        print(f"{OK} {os.path.basename(rel)}")

    # ── 3. Edge function ─────────────────────────────────────────────────────
    step(3, "Deploying linkedin-api edge function")

    env = {**os.environ, "SUPABASE_ACCESS_TOKEN": token}
    proc = subprocess.run(
        ["npx", "--yes", "supabase@latest", "functions", "deploy", "linkedin-api",
         "--project-ref", PROJECT_REF],
        cwd=REPO, env=env, capture_output=True, text=True,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout)[-500:]
        die("edge function deploy failed", tail)
    print(f"{OK} linkedin-api deployed")

    # ── 4. mcp_server JWT ────────────────────────────────────────────────────
    step(4, "Minting SUPABASE_MCP_JWT")

    secret = os.environ.get("SUPABASE_JWT_SECRET", "").strip()
    if not secret:
        print(f"{INFO} SUPABASE_JWT_SECRET not set - skipping")
        print("      Get it from Dashboard -> Settings -> API -> JWT Settings,")
        print("      then re-run, or mint it yourself with the same HS256 claim:")
        print('      {"role":"mcp_server","iss":"supabase"}')
        mcp_jwt = None
    else:
        def b64(d):
            return base64.urlsafe_b64encode(d).rstrip(b"=")

        header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
        # 10-year expiry: this is server-to-server and rotating it means a
        # Railway redeploy, so a short TTL buys nothing here.
        payload = b64(json.dumps(
            {"role": "mcp_server", "iss": "supabase", "iat": 1767225600, "exp": 2082758400},
            separators=(",", ":"),
        ).encode())
        signing_input = header + b"." + payload
        sig = b64(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
        mcp_jwt = (signing_input + b"." + sig).decode()
        print(f"{OK} minted ({len(mcp_jwt)} chars)")

    # ── 5. Verify ────────────────────────────────────────────────────────────
    step(5, "Verifying")

    anon = os.environ.get("SUPABASE_ANON_KEY", "")
    if anon:
        base = f"https://{PROJECT_REF}.supabase.co"
        req = urllib.request.Request(
            f"{base}/rest/v1/mcp_keys?select=api_key&limit=1", headers={"apikey": anon}
        )
        try:
            urllib.request.urlopen(req).read()
            print(f"{BAD} mcp_keys is readable by anon - it should NOT be")
        except urllib.error.HTTPError as e:
            print(f"{OK} mcp_keys exists and is locked down (HTTP {e.code} for anon)")
        except Exception as e:
            print(f"{INFO} could not check mcp_keys: {e}")

        req = urllib.request.Request(
            f"{base}/functions/v1/linkedin-api",
            method="POST",
            data=json.dumps({"action": "linkedin_signin", "params": {}}).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {anon}"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                body = r.read().decode()
        except urllib.error.HTTPError as e:
            body = e.read().decode()
        if "Unknown action" in body:
            print(f"{BAD} linkedin_signin still unknown - deploy did not take effect")
        else:
            print(f"{OK} linkedin_signin is live (returned a validation error, as expected)")
    else:
        print(f"{INFO} set SUPABASE_ANON_KEY to enable verification")

    # ── Next ─────────────────────────────────────────────────────────────────
    print("\n\033[1mNext — Railway (manual)\033[0m")
    print("  New service from geryslov/linkedin-ads-buddy")
    print("    Root Directory : mcp-server")
    print("    Start Command  : npm run start:product")
    print("    Variables:")
    print(f"      SUPABASE_MCP_JWT  = {mcp_jwt if mcp_jwt else '<mint it, see step 4>'}")
    print("      SETUP_URL         = https://<your-lovable-domain>/setup")
    print("      OAUTH_CLIENT_ID   = linkedin-ads-mcp")
    print("      SUPABASE_ANON_KEY = <anon key>")
    print("\n  Then set VITE_MCP_SERVER_URL in Lovable to the assigned domain,")
    print("  and add https://<lovable-domain>/auth/callback to the LinkedIn app.")


if __name__ == "__main__":
    main()
