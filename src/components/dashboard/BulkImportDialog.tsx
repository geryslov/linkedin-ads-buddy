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
import { Loader2, Upload, CheckCircle2, XCircle, Search, Plus } from 'lucide-react';

interface TargetingEntity {
  id: string;
  urn: string;
  name: string;
  type: 'title' | 'skill' | 'company' | 'industry';
  targetable: boolean;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (names: string[]) => Promise<{ results: TargetingEntity[]; notFound: string[] }>;
  onAddToSelection: (entities: TargetingEntity[]) => void;
  type?: 'titles' | 'skills';
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onResolve,
  onAddToSelection,
  type = 'titles',
}: BulkImportDialogProps) {
  const label = type === 'skills' ? 'Skill' : 'Job Title';
  const labelPlural = type === 'skills' ? 'Skills' : 'Job Titles';
  const placeholder = type === 'skills'
    ? 'Python\nMachine Learning\nData Analysis\nProject Management'
    : 'Chief Marketing Officer\nVP of Sales\nSoftware Engineer\nProduct Manager';
  const [inputText, setInputText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedEntities, setResolvedEntities] = useState<TargetingEntity[]>([]);
  const [notFoundTitles, setNotFoundTitles] = useState<string[]>([]);
  const [hasResolved, setHasResolved] = useState(false);

  const handleResolve = async () => {
    const titles = inputText
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (titles.length === 0) return;

    setIsResolving(true);
    try {
      const { results, notFound } = await onResolve(titles);

      setResolvedEntities(results);
      setNotFoundTitles(notFound);
      setHasResolved(true);
    } finally {
      setIsResolving(false);
    }
  };

  const handleAddAll = () => {
    onAddToSelection(resolvedEntities);
    handleClose();
  };

  const handleClose = () => {
    setInputText('');
    setResolvedEntities([]);
    setNotFoundTitles([]);
    setHasResolved(false);
    onOpenChange(false);
  };

  const titleCount = inputText
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Bulk Import {labelPlural}
          </DialogTitle>
          <DialogDescription>
            Paste {labelPlural.toLowerCase()} (one per line) to resolve them against LinkedIn's targeting database.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!hasResolved ? (
            <>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="names">{labelPlural}</Label>
                  {titleCount > 0 && (
                    <Badge variant="secondary">{titleCount} {titleCount === 1 ? label.toLowerCase() : labelPlural.toLowerCase()}</Badge>
                  )}
                </div>
                <Textarea
                  id="names"
                  placeholder={placeholder}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isResolving}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one {label.toLowerCase()} per line. Maximum 50 per import.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Resolution Results</p>
                  <p className="text-xs text-muted-foreground">
                    {resolvedEntities.length} matched, {notFoundTitles.length} not found
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setHasResolved(false)}>
                  Back to Edit
                </Button>
              </div>
              
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {resolvedEntities.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Matched Titles
                      </p>
                      {resolvedEntities.map((entity) => (
                        <div 
                          key={entity.urn}
                          className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          <span className="text-sm font-medium truncate">{entity.name}</span>
                          {entity.targetable && (
                            <Badge variant="secondary" className="text-xs ml-auto">Targetable</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {notFoundTitles.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-amber-500" />
                        Not Found
                      </p>
                      {notFoundTitles.map((title, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30"
                        >
                          <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="text-sm text-muted-foreground truncate">{title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {!hasResolved ? (
            <Button onClick={handleResolve} disabled={isResolving || titleCount === 0}>
              {isResolving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Resolve {labelPlural} ({Math.min(titleCount, 50)})
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleAddAll} disabled={resolvedEntities.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add {resolvedEntities.length} Matched
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
