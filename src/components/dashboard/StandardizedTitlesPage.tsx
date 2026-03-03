import { useState, useCallback } from 'react';
import { useStandardizedTitles, StandardizedTitle } from '@/hooks/useStandardizedTitles';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Search, Loader2, Download, Briefcase, Layers } from 'lucide-react';

interface StandardizedTitlesPageProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function StandardizedTitlesPage({ accessToken }: StandardizedTitlesPageProps) {
  const { titles, metadata, isLoading, fetchAllTitles, fetchTitlesByIds } = useStandardizedTitles(accessToken);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [idsInput, setIdsInput] = useState('');
  const [functionFilter, setFunctionFilter] = useState<string>('all');
  const [mode, setMode] = useState<'all' | 'byIds'>('all');

  const handleFetchAll = useCallback(() => {
    if (!accessToken) {
      toast({ title: 'Not authenticated', description: 'Please connect your LinkedIn account first.', variant: 'destructive' });
      return;
    }
    fetchAllTitles();
  }, [accessToken, fetchAllTitles, toast]);

  const handleFetchByIds = useCallback(() => {
    if (!accessToken) {
      toast({ title: 'Not authenticated', description: 'Please connect your LinkedIn account first.', variant: 'destructive' });
      return;
    }
    const ids = idsInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));
    if (ids.length === 0) {
      toast({ title: 'Invalid IDs', description: 'Enter comma-separated numeric title IDs.', variant: 'destructive' });
      return;
    }
    fetchTitlesByIds(ids);
  }, [accessToken, idsInput, fetchTitlesByIds, toast]);

  // Derive unique functions for the filter dropdown
  const uniqueFunctions = Array.from(
    new Map(titles.map(t => [t.function.urn, t.function.name || t.function.urn])).entries()
  ).sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));

  // Filter titles by search query and function
  const filtered = titles.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.superTitle.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFunction = functionFilter === 'all' || t.function.urn === functionFilter;
    return matchesSearch && matchesFunction;
  });

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return;
    const header = 'ID,Name,Function,Super Title,URN';
    const rows = filtered.map(t =>
      `${t.id},"${t.name.replace(/"/g, '""')}","${(t.function.name || '').replace(/"/g, '""')}","${(t.superTitle.name || '').replace(/"/g, '""')}","${t.urn}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'standardized_titles.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-500" />
          Standardized Titles
        </h2>
        <p className="text-muted-foreground">
          Browse LinkedIn standardized job titles with their function and super title
        </p>
      </div>

      {/* Fetch Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fetch Titles</CardTitle>
          <CardDescription>Load all standardized titles or look up specific ones by ID</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <Select value={mode} onValueChange={(v: 'all' | 'byIds') => setMode(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Fetch All</SelectItem>
                <SelectItem value="byIds">By Title IDs</SelectItem>
              </SelectContent>
            </Select>

            {mode === 'byIds' && (
              <Input
                placeholder="e.g. 9, 10, 11"
                value={idsInput}
                onChange={(e) => setIdsInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchByIds()}
                disabled={isLoading}
                className="flex-1"
              />
            )}

            <Button
              onClick={mode === 'all' ? handleFetchAll : handleFetchByIds}
              disabled={isLoading || !accessToken}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" />Fetch</>
              )}
            </Button>
          </div>

          {metadata && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span><span className="font-medium text-foreground">{metadata.total}</span> titles loaded</span>
              <span><span className="font-medium text-foreground">{metadata.superTitlesResolved}</span> super titles resolved</span>
              <span>Locale: <span className="font-medium text-foreground">{metadata.locale}</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {titles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Results</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>
            {/* Filters */}
            <div className="flex gap-3 mt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search titles or super titles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All Functions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {uniqueFunctions.map(([urn, name]) => (
                    <SelectItem key={urn} value={urn}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Showing {filtered.length} of {titles.length} titles
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-16">ID</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Function</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Super Title</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{t.id}</td>
                      <td className="px-4 py-2.5 font-medium">{t.name}</td>
                      <td className="px-4 py-2.5">
                        {t.function.name ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            <Briefcase className="mr-1 h-3 w-3" />
                            {t.function.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.superTitle.name ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            <Layers className="mr-1 h-3 w-3" />
                            {t.superTitle.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center border-t bg-muted/30">
                  Showing first 500 of {filtered.length} results. Use the search or filter to narrow down.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
