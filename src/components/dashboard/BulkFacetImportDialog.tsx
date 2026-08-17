import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Upload, CheckCircle2, XCircle, Search, Plus, Users, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TargetingEntity } from '@/hooks/useSavedAudiences';

const MAX_NAMES = 150;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | null;
  /** Full facet URN, e.g. urn:li:adTargetingFacet:titles */
  facet: string;
  facetLabel: string;
  /** true = free-text typeahead facet, false = enumerable value list */
  typeahead: boolean;
  bucket: 'include' | 'exclude';
  onAdd: (entities: TargetingEntity[], bucket: 'include' | 'exclude') => void;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const shortOf = (facetUrn: string) => facetUrn.split(':').pop() || facetUrn;

export function BulkFacetImportDialog({
  open,
  onOpenChange,
  accessToken,
  facet,
  facetLabel,
  typeahead,
  bucket,
  onAdd,
}: Props) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [matched, setMatched] = useState<TargetingEntity[]>([]);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [hasResolved, setHasResolved] = useState(false);

  const names = Array.from(
    new Set(
      text
        .split(/\n|,|;|\t/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_NAMES);

  const search = async (query: string) => {
    const { data, error } = await supabase.functions.invoke('linkedin-api', {
      body: {
        action: 'search_targeting_entities',
        accessToken,
        params: { facet, query },
      },
    });
    if (error) throw error;
    return ((data?.entities || []) as any[]).map((i) => ({
      id: i.id,
      urn: i.urn,
      name: i.name,
      facet,
      type: shortOf(facet),
      targetable: i.targetable !== false,
    })) as TargetingEntity[];
  };

  const pick = (wanted: string, results: TargetingEntity[]) => {
    if (!results.length) return null;
    const exact = results.find((r) => norm(r.name || '') === norm(wanted));
    if (exact) return exact;
    const starts = results.find((r) => norm(r.name || '').startsWith(norm(wanted)));
    return starts || results[0];
  };

  const handleResolve = async () => {
    if (!accessToken || !names.length) return;
    setIsResolving(true);
    setProgress(0);
    const found: TargetingEntity[] = [];
    const missing: string[] = [];
    try {
      if (!typeahead) {
        // Enumerable facet — pull the whole value list once and match locally.
        const all = await search('');
        for (const n of names) {
          const hit = all.find((r) => norm(r.name || '') === norm(n)) ||
            all.find((r) => norm(r.name || '').includes(norm(n)));
          if (hit) found.push(hit);
          else missing.push(n);
        }
        setProgress(names.length);
      } else {
        const CHUNK = 5;
        for (let i = 0; i < names.length; i += CHUNK) {
          const slice = names.slice(i, i + CHUNK);
          const settled = await Promise.all(
            slice.map(async (n) => {
              try {
                return { n, hit: pick(n, await search(n)) };
              } catch {
                return { n, hit: null };
              }
            }),
          );
          for (const { n, hit } of settled) {
            if (hit) found.push(hit);
            else missing.push(n);
          }
          setProgress(Math.min(i + CHUNK, names.length));
        }
      }

      // de-dupe by urn
      const seen = new Set<string>();
      setMatched(found.filter((e) => (seen.has(e.urn) ? false : (seen.add(e.urn), true))));
      setNotFound(missing);
      setHasResolved(true);
    } catch (err) {
      toast({
        title: 'Bulk resolve failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const close = () => {
    setText('');
    setMatched([]);
    setNotFound([]);
    setHasResolved(false);
    setProgress(0);
    onOpenChange(false);
  };

  const addAll = () => {
    onAdd(matched, bucket);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Bulk add — {facetLabel}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Paste values (one per line, or comma separated). They'll be resolved against LinkedIn and
            added to the
            <Badge
              variant="outline"
              className={
                bucket === 'exclude'
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-primary/30 bg-primary/10 text-primary'
              }
            >
              {bucket === 'exclude' ? (
                <Ban className="mr-1 h-3 w-3" />
              ) : (
                <Users className="mr-1 h-3 w-3" />
              )}
              {bucket}
            </Badge>
            layer.
          </DialogDescription>
        </DialogHeader>

        {!hasResolved ? (
          <div className="grid gap-2 py-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-values">{facetLabel}</Label>
              {names.length > 0 && <Badge variant="secondary">{names.length} values</Badge>}
            </div>
            <Textarea
              id="bulk-values"
              rows={10}
              className="font-mono text-sm"
              placeholder={'Chief Marketing Officer\nVP of Sales\nHead of Growth'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isResolving}
            />
            <p className="text-xs text-muted-foreground">
              Duplicates are removed automatically. Maximum {MAX_NAMES} values per import.
              {isResolving && ` · Resolving ${progress}/${names.length}…`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {matched.length} matched · {notFound.length} not found
              </p>
              <Button variant="outline" size="sm" onClick={() => setHasResolved(false)}>
                Back to edit
              </Button>
            </div>
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-1.5">
                {matched.map((e) => (
                  <div
                    key={e.urn}
                    className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-sm">{e.name || e.urn}</span>
                  </div>
                ))}
                {notFound.map((n) => (
                  <div
                    key={n}
                    className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2"
                  >
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <span className="truncate text-sm text-muted-foreground">{n}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          {!hasResolved ? (
            <Button onClick={handleResolve} disabled={isResolving || !names.length}>
              {isResolving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resolving {progress}/{names.length}
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Resolve {names.length} values
                </>
              )}
            </Button>
          ) : (
            <Button onClick={addAll} disabled={!matched.length}>
              <Plus className="mr-2 h-4 w-4" />
              Add {matched.length} to {bucket}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
