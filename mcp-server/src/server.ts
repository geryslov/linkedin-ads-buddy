#!/usr/bin/env node

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

// Token store: session token → LinkedIn token (in-memory)
const sessionTokens = new Map<string, string>();
// Auth codes: code → { linkedinToken, redirectUri, expiresAt }
const authCodes = new Map<string, { linkedinToken: string; redirectUri: string; expiresAt: number }>();
// Registered OAuth clients — pre-seed fixed client ID + support dynamic registration
export const CLAUDE_CLIENT_ID = "linkedin-ads-buddy";
const registeredClients = new Map<string, { redirectUris: string[]; clientSecret: string }>();
registeredClients.set(CLAUDE_CLIENT_ID, { redirectUris: ["*"], clientSecret: "not-used" });
// MCP sessions
const mcpSessions = new Map<string, { transport: StreamableHTTPServerTransport }>();

function getBaseUrl(req: express.Request): string {
  return `https://${req.hostname}`;
}

// ── OAuth metadata (required by Claude web) ───────────────────────────────────

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const base = getBaseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    service_documentation: "https://github.com/geryslov/linkedin-ads-buddy",
    logo_uri: `${base}/logo.png`,
  });
});

// ── Favicon / logo (used by Claude web for connector icon) ────────────────────

const LINKEDIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256">
  <rect width="24" height="24" rx="4" fill="#0a66c2"/>
  <path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
</svg>`;

app.get("/logo.png", (_req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(LINKEDIN_SVG);
});

app.get("/favicon.ico", (_req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(LINKEDIN_SVG);
});

// ── Dynamic client registration (RFC 7591) ────────────────────────────────────

app.post("/oauth/register", (req, res) => {
  const { redirect_uris, client_name } = req.body as Record<string, any>;
  if (!redirect_uris || !Array.isArray(redirect_uris)) {
    res.status(400).json({ error: "invalid_client_metadata", error_description: "redirect_uris required" });
    return;
  }
  const clientId = randomUUID();
  const clientSecret = randomUUID();
  registeredClients.set(clientId, { redirectUris: redirect_uris, clientSecret });
  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: client_name || "Claude",
    redirect_uris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  });
});

// ── OAuth authorize — show token input page ───────────────────────────────────

app.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, state } = req.query as Record<string, string>;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect LinkedIn Ads to Claude</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8fafc;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 1rem;
    }
    .card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 2rem; max-width: 440px; width: 100%;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .logo { display: flex; align-items: center; gap: .6rem; margin-bottom: 1.5rem; }
    .logo-icon { width: 32px; height: 32px; background: #0a66c2; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 18px; height: 18px; fill: #fff; }
    h1 { font-size: 1.1rem; font-weight: 600; color: #0f172a; }
    p { font-size: .875rem; color: #64748b; margin: .25rem 0 1.5rem; line-height: 1.5; }
    label { display: block; font-size: .8rem; font-weight: 500; color: #374151; margin-bottom: .4rem; }
    input[type=text] {
      width: 100%; padding: .6rem .75rem; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: .85rem; font-family: monospace; color: #0f172a;
      outline: none; transition: border-color .15s;
    }
    input[type=text]:focus { border-color: #0a66c2; box-shadow: 0 0 0 3px rgba(10,102,194,.1); }
    .hint { font-size: .75rem; color: #94a3b8; margin: .4rem 0 1.25rem; }
    button {
      width: 100%; padding: .65rem 1rem; background: #0a66c2; color: #fff;
      border: none; border-radius: 8px; font-size: .9rem; font-weight: 500;
      cursor: pointer; transition: background .15s;
    }
    button:hover { background: #0958a8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </div>
      <span style="font-weight:600;color:#0f172a">LinkedIn Ads</span>
    </div>
    <h1>Connect to Claude</h1>
    <p>Paste your LinkedIn Ads token to give Claude access to your ad account data.</p>
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${redirect_uri || ""}" />
      <input type="hidden" name="state" value="${state || ""}" />
      <label for="token">LinkedIn access token</label>
      <input type="text" id="token" name="token" placeholder="AQV..." required autocomplete="off" />
      <p class="hint">Find this in LinkedIn Ads Buddy → sidebar → "Connect to Claude"</p>
      <button type="submit">Connect</button>
    </form>
  </div>
</body>
</html>`);
});

app.post("/oauth/authorize", (req, res) => {
  const { redirect_uri, state, token } = req.body as Record<string, string>;
  if (!token || !redirect_uri) {
    res.status(400).send("Missing token or redirect_uri");
    return;
  }
  const code = randomUUID();
  authCodes.set(code, {
    linkedinToken: token,
    redirectUri: redirect_uri,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// ── OAuth token exchange ──────────────────────────────────────────────────────

app.post("/oauth/token", (req, res) => {
  const { code, grant_type } = req.body as Record<string, string>;
  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  const data = authCodes.get(code);
  if (!data || data.expiresAt < Date.now()) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }
  authCodes.delete(code);
  // Return the LinkedIn token directly — no in-memory mapping, survives server restarts
  res.json({ access_token: data.linkedinToken, token_type: "bearer", expires_in: 60 * 24 * 3600 });
});

// ── Token resolution ──────────────────────────────────────────────────────────

function resolveToken(req: express.Request): string | null {
  const bearer = (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    // Could be a session token (OAuth flow) or raw LinkedIn token (Desktop/direct)
    return sessionTokens.get(bearer) ?? bearer;
  }
  return (req.headers["x-linkedin-token"] as string) ?? null;
}

// ── MCP endpoint ──────────────────────────────────────────────────────────────

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && mcpSessions.has(sessionId)) {
    const { transport } = mcpSessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  const token = resolveToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createLinkedInAdsServer(() => token);
  await server.connect(transport);

  transport.onclose = () => {
    if (transport.sessionId) mcpSessions.delete(transport.sessionId);
  };

  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) {
    mcpSessions.set(transport.sessionId, { transport });
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !mcpSessions.has(sessionId)) {
    res.status(400).json({ error: "Valid mcp-session-id required" });
    return;
  }
  const { transport } = mcpSessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete("/mcp", (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) mcpSessions.delete(sessionId);
  res.status(200).end();
});

// ── Health + client ID ────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: mcpSessions.size, clientId: CLAUDE_CLIENT_ID });
});

app.get("/client-id", (_req, res) => {
  res.json({ client_id: CLAUDE_CLIENT_ID });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LinkedIn Ads MCP remote server listening on port ${PORT}`);
});
