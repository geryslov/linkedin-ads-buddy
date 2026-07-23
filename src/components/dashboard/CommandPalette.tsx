import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navGroups } from "./Sidebar";
import { Bot, LogOut, Radio, Shield, Search } from "lucide-react";

interface CommandPaletteProps {
  onNavigate: (tab: string) => void;
  onConnectClaude?: () => void;
  onLogout: () => void;
  isAdmin?: boolean;
}

/** ⌘K palette — jump to any screen or action from anywhere. */
export function CommandPalette({ onNavigate, onConnectClaude, onLogout, isAdmin }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  return (
    <>
      {/* Header affordance — shows the shortcut, opens on click */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-8 pl-3 pr-2 rounded-lg border border-border bg-card text-muted-foreground text-[13px] hover:border-primary/40 hover:text-foreground transition-colors"
        title="Jump to any screen"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Jump to…</span>
        <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-medium">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search screens and actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navGroups.map((group) => (
            <CommandGroup key={group.id} heading={group.label ?? "General"}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${group.label ?? ""} ${item.label}`}
                  onSelect={() => run(() => onNavigate(item.id))}
                  className="gap-2.5"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(() => navigate("/social-listener"))} className="gap-2.5">
              <Radio className="h-4 w-4 text-muted-foreground" />
              Open Social Listener
            </CommandItem>
            {onConnectClaude && (
              <CommandItem onSelect={() => run(onConnectClaude)} className="gap-2.5">
                <Bot className="h-4 w-4 text-muted-foreground" />
                Connect to Claude
              </CommandItem>
            )}
            {isAdmin && (
              <CommandItem onSelect={() => run(() => navigate("/admin"))} className="gap-2.5">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Admin Panel
              </CommandItem>
            )}
            <CommandItem onSelect={() => run(onLogout)} className="gap-2.5">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Disconnect
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
