import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, Bot, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ConnectClaudeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | null;
}

const MCP_SERVER_URL = import.meta.env.VITE_MCP_SERVER_URL || "https://linkedin-ads-buddy-production.up.railway.app";
const MCP_CLIENT_ID = "linkedin-ads-buddy";
const MCP_API_KEY_STORAGE = "linkedin_mcp_api_key";

export function ConnectClaude({ open, onOpenChange, accessToken }: ConnectClaudeProps) {
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let key = localStorage.getItem(MCP_API_KEY_STORAGE);

    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(MCP_API_KEY_STORAGE, key);
    }

    // Always sync on modal open — ensures the row exists even if a prior upsert failed
    if (key && accessToken) {
      supabase.from('mcp_api_keys').upsert(
        { api_key: key, linkedin_token: accessToken, updated_at: new Date().toISOString() },
        { onConflict: 'api_key' }
      ).then(({ error }) => {
        if (error) console.error('[MCP sync] upsert failed:', error);
      });
    }

    setApiKey(key);
  }, [open, accessToken]);

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        "linkedin-ads": {
          url: `${MCP_SERVER_URL}/mcp`,
          headers: {
            "x-linkedin-token": apiKey || "CONNECT_LINKEDIN_FIRST",
          },
        },
      },
    },
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const isReady = !!accessToken && !!apiKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Connect to Claude
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Give Claude access to your LinkedIn Ads data. Your API key is permanent —
            it auto-updates when your LinkedIn session refreshes.
          </p>

          {!isReady && (
            <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              Connect your LinkedIn account first to generate your API key.
            </p>
          )}

          {isReady && (
            <>
              {/* API Key */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Your MCP API key</p>
                <p className="text-xs text-muted-foreground">Permanent — never changes even when your LinkedIn token refreshes.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted border border-border rounded px-2 py-1.5 text-[11px] font-mono truncate">{apiKey}</code>
                  <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={handleCopyKey}>
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                {/* Claude Desktop */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Claude Desktop</p>
                  <div className="relative rounded-md border border-border bg-muted/40">
                    <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-foreground/80">{configSnippet}</pre>
                    <Button size="sm" variant="ghost" className="absolute right-2 top-2 h-7 gap-1.5 text-xs" onClick={handleCopy}>
                      {copied ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                    </Button>
                  </div>
                </div>

                {/* Claude web */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Claude web (claude.ai)</p>
                  <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                    <li>Settings → Integrations → Add integration</li>
                    <li>URL: <code className="bg-muted px-1 rounded">{MCP_SERVER_URL}/mcp</code></li>
                    <li>If asked for OAuth Client ID: <code className="bg-muted px-1 rounded">{MCP_CLIENT_ID}</code></li>
                    <li>On the login page, paste your <strong>MCP API key</strong> (above)</li>
                  </ol>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Auto-updates on token refresh
            </p>
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              About MCP <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
