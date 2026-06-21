#!/usr/bin/env node

/**
 * Remote HTTP MCP server for LinkedIn Ads.
 * Deployed on Railway — any Claude Desktop user can connect with just a URL.
 *
 * Config snippet (paste into claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "linkedin-ads": {
 *       "url": "https://<your-railway-url>/mcp",
 *       "headers": { "x-linkedin-token": "<token from LinkedIn Ads app>" }
 *     }
 *   }
 * }
 */

import { randomUUID } from "crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createLinkedInAdsServer } from "./tools.js";

const app = express();
app.use(express.json());

// CORS — Claude Desktop makes requests from a local context
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-linkedin-token, mcp-session-id");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

// Active sessions: sessionId → { transport, server }
const sessions = new Map<string, { transport: StreamableHTTPServerTransport }>();

function extractToken(req: express.Request): string | null {
  return (
    (req.headers["x-linkedin-token"] as string) ||
    (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

// ── POST /mcp — initialize session or handle messages ───────────────────────

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Existing session — route to its transport
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — require token
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "x-linkedin-token header required" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createLinkedInAdsServer(() => token);
  await server.connect(transport);

  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };

  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, { transport });
  }
});

// ── GET /mcp — SSE stream for an existing session ───────────────────────────

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Valid mcp-session-id header required" });
    return;
  }
  const { transport } = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// ── DELETE /mcp — clean up session ──────────────────────────────────────────

app.delete("/mcp", (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) sessions.delete(sessionId);
  res.status(200).end();
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LinkedIn Ads MCP remote server listening on port ${PORT}`);
});
