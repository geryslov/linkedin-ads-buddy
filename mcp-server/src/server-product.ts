#!/usr/bin/env node
/**
 * Multi-tenant MCP server for the standalone LinkedIn Ads MCP product.
 *
 * This is a SEPARATE Railway service from src/server.ts. It shares only the
 * tool definitions in tools.ts (via mode: "product"). The legacy server, its
 * URL, its `mcp_api_keys` table, and its behaviour are untouched by anything
 * here — that separation is the point, so keep it.
 *
 *   legacy   src/server.ts          → mcp_api_keys, anon PostgREST select
 *   product  src/server-product.ts  → mcp_keys, resolve_mcp_key() RPC
 *
 * Run with: npm run start:product
 */

import { randomUUID } from "crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createLinkedInAdsServer } from "./tools.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-linkedin-token, mcp-session-id");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bxoxefmenvlxiubynuay.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

// JWT signed with the project JWT secret carrying {"role":"mcp_server"} — the
// least-privilege role that can EXECUTE resolve_mcp_key and nothing else.
// Required: without it the resolver has no way to authenticate and every
// request fails closed.
const SUPABASE_MCP_JWT = process.env.SUPABASE_MCP_JWT || "";

const SETUP_URL = process.env.SETUP_URL || "https://linkedin-ads-mcp.lovable.app/setup";
const PRODUCT_CLIENT_ID = process.env.OAUTH_CLIENT_ID || "linkedin-ads-mcp";

if (!SUPABASE_MCP_JWT) {
  console.warn("[warn] SUPABASE_MCP_JWT is not set — every key resolution will fail closed.");
}

const authCodes = new Map<string, { apiKey: string; redirectUri: string; expiresAt: number }>();
const mcpSessions = new Map<string, { transport: StreamableHTTPServerTransport; auth: SessionAuth }>();

function getBaseUrl(req: express.Request): string {
  return process.env.PUBLIC_URL || `https://${req.hostname}`;
}

// ── Key resolution ────────────────────────────────────────────────────────────

export type KeyResolution = {
  token: string | null;
  status: string;
  allowWrites: boolean;
  expiresAt: string | null;
};

const DENIED: Record<string, string> = {
  not_found: "That MCP API key is not recognised.",
  revoked: "This MCP API key has been revoked.",
  suspended: "This MCP API key is suspended.",
  access_denied: "Your access has been suspended. Contact the workspace owner.",
  expired: "Your LinkedIn connection has expired.",
};

const FAILED_CLOSED: KeyResolution = {
  token: null, status: "not_found", allowWrites: false, expiresAt: null,
};

async function resolveKey(apiKey: string): Promise<KeyResolution> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_mcp_key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_MCP_JWT}`,
      },
      body: JSON.stringify({ p_key: apiKey }),
    });
    if (!res.ok) {
      console.error(`resolve_mcp_key failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return FAILED_CLOSED;
    }
    const rows = await res.json() as Array<{
      linkedin_token: string | null;
      key_status: string;
      expires_at: string | null;
      allow_writes: boolean;
    }>;
    const row = rows[0];
    if (!row) return FAILED_CLOSED;
    return {
      token: row.linkedin_token,
      status: row.key_status,
      allowWrites: !!row.allow_writes,
      expiresAt: row.expires_at,
    };
  } catch (e) {
    console.error("resolve_mcp_key threw:", e);
    return FAILED_CLOSED;
  }
}

function extractApiKey(req: express.Request): string | null {
  const bearer = (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "");
  return bearer ?? (req.headers["x-linkedin-token"] as string) ?? null;
}

// Re-resolve on a short TTL rather than freezing the token in a closure for the
// life of the session. Without this, revoking a key in the admin panel has no
// effect until the process restarts.
const RESOLVE_TTL_MS = 60_000;

class SessionAuth {
  private cached: KeyResolution | null = null;
  private fetchedAt = 0;
  private inflight: Promise<KeyResolution> | null = null;

  constructor(readonly apiKey: string) {}

  async resolve(): Promise<KeyResolution> {
    if (this.cached && Date.now() - this.fetchedAt < RESOLVE_TTL_MS) return this.cached;
    if (this.inflight) return this.inflight;
    this.inflight = resolveKey(this.apiKey)
      .then((r) => { this.cached = r; this.fetchedAt = Date.now(); return r; })
      .finally(() => { this.inflight = null; });
    return this.inflight;
  }

  currentToken(): string {
    const r = this.cached;
    if (!r || !r.token) {
      const why = r ? (DENIED[r.status] || "Your LinkedIn connection is not available.") : "Not authorised.";
      throw new Error(`${why} Reconnect at ${SETUP_URL}`);
    }
    return r.token;
  }

  allowWrites(): boolean {
    return this.cached?.allowWrites ?? false;
  }
}

// ── OAuth surface (Claude web connector) ──────────────────────────────────────

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const base = getBaseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    service_documentation: SETUP_URL,
    logo_uri: `${base}/logo.png`,
  });
});

const LINKEDIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256">
  <rect width="24" height="24" rx="4" fill="#0a66c2"/>
  <path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
</svg>`;

for (const path of ["/logo.png", "/favicon.ico"]) {
  app.get(path, (_req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(LINKEDIN_SVG);
  });
}

app.post("/oauth/register", (req, res) => {
  const { redirect_uris, client_name } = req.body as Record<string, any>;
  if (!Array.isArray(redirect_uris)) {
    res.status(400).json({ error: "invalid_client_metadata", error_description: "redirect_uris required" });
    return;
  }
  res.status(201).json({
    client_id: randomUUID(),
    client_secret: randomUUID(),
    client_name: client_name || "Claude",
    redirect_uris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

app.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, state } = req.query as Record<string, string>;
  res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Connect LinkedIn Ads to Claude</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;
    display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:2rem;max-width:440px;
    width:100%;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .logo{display:flex;align-items:center;gap:.6rem;margin-bottom:1.5rem}
  .logo-icon{width:32px;height:32px;background:#0a66c2;border-radius:6px;display:flex;
    align-items:center;justify-content:center}
  .logo-icon svg{width:18px;height:18px;fill:#fff}
  h1{font-size:1.1rem;font-weight:600;color:#0f172a}
  p{font-size:.875rem;color:#64748b;margin:.25rem 0 1.5rem;line-height:1.5}
  label{display:block;font-size:.8rem;font-weight:500;color:#374151;margin-bottom:.4rem}
  input[type=text]{width:100%;padding:.6rem .75rem;border:1px solid #d1d5db;border-radius:8px;
    font-size:.85rem;font-family:monospace;color:#0f172a;outline:none}
  input[type=text]:focus{border-color:#0a66c2;box-shadow:0 0 0 3px rgba(10,102,194,.1)}
  .hint{font-size:.75rem;color:#94a3b8;margin:.4rem 0 1.25rem}
  .hint a{color:#0a66c2}
  button{width:100%;padding:.65rem 1rem;background:#0a66c2;color:#fff;border:none;
    border-radius:8px;font-size:.9rem;font-weight:500;cursor:pointer}
  button:hover{background:#0958a8}
</style></head>
<body><div class="card">
  <div class="logo"><div class="logo-icon">
    <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  </div><span style="font-weight:600;color:#0f172a">LinkedIn Ads MCP</span></div>
  <h1>Connect to Claude</h1>
  <p>Paste the MCP API key from your setup page to give Claude access to your LinkedIn ad accounts.</p>
  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || "")}" />
    <input type="hidden" name="state" value="${escapeHtml(state || "")}" />
    <label for="token">MCP API key</label>
    <input type="text" id="token" name="token" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required autocomplete="off" />
    <p class="hint">Find this at <a href="${SETUP_URL}" target="_blank" rel="noopener">${SETUP_URL}</a></p>
    <button type="submit">Connect</button>
  </form>
</div></body></html>`);
});

app.post("/oauth/authorize", async (req, res) => {
  const { redirect_uri, state, token } = req.body as Record<string, string>;
  if (!token || !redirect_uri) { res.status(400).send("Missing token or redirect_uri"); return; }

  // Validate before minting a code, so a bad key fails here with an explanation
  // rather than silently later inside Claude.
  const resolution = await resolveKey(token.trim());
  if (!resolution.token) {
    const why = DENIED[resolution.status] || "That key could not be verified.";
    res.status(400).send(
      `<p style="font-family:sans-serif;padding:2rem">${escapeHtml(why)} ` +
      `<a href="${SETUP_URL}">Go to setup</a></p>`
    );
    return;
  }

  const code = randomUUID();
  authCodes.set(code, {
    apiKey: token.trim(),
    redirectUri: redirect_uri,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.redirect(url.toString());
});

app.post("/oauth/token", (req, res) => {
  const { code, grant_type, redirect_uri } = req.body as Record<string, string>;
  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  const data = authCodes.get(code);
  if (!data || data.expiresAt < Date.now()) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }
  // Unlike the legacy server, the redirect_uri is actually checked against the
  // one the code was issued for.
  if (redirect_uri && redirect_uri !== data.redirectUri) {
    res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
    return;
  }
  authCodes.delete(code);
  // The access_token is the MCP API key. It is revocable server-side, which the
  // raw LinkedIn token the legacy server hands back is not.
  res.json({ access_token: data.apiKey, token_type: "bearer", expires_in: 60 * 24 * 3600 });
});

// ── MCP endpoint ──────────────────────────────────────────────────────────────

function denyRequest(res: express.Response, r: KeyResolution) {
  const detail = DENIED[r.status] || "Not authorised.";
  res.setHeader("WWW-Authenticate", `Bearer realm="linkedin-ads-mcp", error="invalid_token"`);
  res.status(401).json({
    error: "unauthorized",
    reason: r.status,
    error_description: `${detail} Reconnect at ${SETUP_URL}`,
    reconnect_url: SETUP_URL,
    ...(r.expiresAt ? { expired_at: r.expiresAt } : {}),
  });
}

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const presentedKey = extractApiKey(req);

  if (sessionId && mcpSessions.has(sessionId)) {
    const { transport, auth } = mcpSessions.get(sessionId)!;

    // A session id alone must not be a bearer credential.
    if (presentedKey && presentedKey !== auth.apiKey) {
      res.status(403).json({ error: "forbidden", error_description: "Session does not belong to this key." });
      return;
    }
    const current = await auth.resolve();
    if (!current.token) {
      mcpSessions.delete(sessionId);
      denyRequest(res, current);
      return;
    }
    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (!presentedKey) { denyRequest(res, FAILED_CLOSED); return; }

  const auth = new SessionAuth(presentedKey);
  const resolution = await auth.resolve();
  if (!resolution.token) { denyRequest(res, resolution); return; }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createLinkedInAdsServer(() => auth.currentToken(), {
    mode: "product",
    allowWrites: () => auth.allowWrites(),
    setupUrl: SETUP_URL,
  });
  await server.connect(transport);

  transport.onclose = () => {
    if (transport.sessionId) mcpSessions.delete(transport.sessionId);
  };

  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) mcpSessions.set(transport.sessionId, { transport, auth });
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !mcpSessions.has(sessionId)) {
    res.status(400).json({ error: "Valid mcp-session-id required" });
    return;
  }
  const { transport, auth } = mcpSessions.get(sessionId)!;
  const presentedKey = extractApiKey(req);
  if (presentedKey && presentedKey !== auth.apiKey) { res.status(403).json({ error: "forbidden" }); return; }

  const current = await auth.resolve();
  if (!current.token) {
    mcpSessions.delete(sessionId);
    denyRequest(res, current);
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId) { res.status(400).json({ error: "mcp-session-id required" }); return; }
  const session = mcpSessions.get(sessionId);
  if (!session) { res.status(200).end(); return; }

  const presentedKey = extractApiKey(req);
  if (presentedKey && presentedKey !== session.auth.apiKey) { res.status(403).json({ error: "forbidden" }); return; }

  mcpSessions.delete(sessionId);
  res.status(200).end();
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "linkedin-ads-mcp-product",
    sessions: mcpSessions.size,
    clientId: PRODUCT_CLIENT_ID,
    resolverConfigured: !!SUPABASE_MCP_JWT,
  });
});

app.get("/client-id", (_req, res) => {
  res.json({ client_id: PRODUCT_CLIENT_ID });
});

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LinkedIn Ads MCP (product) listening on port ${PORT}`);
});
