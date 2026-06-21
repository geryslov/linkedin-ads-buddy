#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLinkedInAdsServer } from "./tools.js";

function getToken(): string {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) throw new Error("LINKEDIN_ACCESS_TOKEN environment variable is required");
  return token;
}

async function main() {
  const server = createLinkedInAdsServer(getToken);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LinkedIn Ads MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
