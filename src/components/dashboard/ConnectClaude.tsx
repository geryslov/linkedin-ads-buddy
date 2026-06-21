import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, Bot, ExternalLink } from "lucide-react";

interface ConnectClaudeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | null;
}

const MCP_SERVER_URL = import.meta.env.VITE_MCP_SERVER_URL || "https://linkedin-ads-mcp.up.railway.app";

export function ConnectClaude({ open, onOpenChange, accessToken }: ConnectClaudeProps) {
  const [copied, setCopied] = useState(false);

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        "linkedin-ads": {
          url: `${MCP_SERVER_URL}/mcp`,
          headers: {
            "x-linkedin-token": accessToken || "PASTE_YOUR_TOKEN_HERE",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Connect to Claude Desktop
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Give Claude direct access to your LinkedIn Ads data. Once connected, you can ask
            questions like <em>"what's my CPL this month?"</em> or <em>"pause all underperforming campaigns"</em>.
          </p>

          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">1</span>
              <span>Open <strong>Claude Desktop</strong> → Settings → Developer → Edit Config</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">2</span>
              <span>Copy the snippet below and merge it into your config file</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">3</span>
              <span>Restart Claude Desktop — the <strong>linkedin-ads</strong> tools will appear</span>
            </li>
          </ol>

          <div className="relative rounded-md border border-border bg-muted/40">
            <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-foreground/80">
              {configSnippet}
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-2 top-2 h-7 gap-1.5 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copy</>
              )}
            </Button>
          </div>

          {!accessToken && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Connect your LinkedIn account first — the snippet will include your token automatically.
            </p>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Token refreshes when you re-authenticate</p>
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
