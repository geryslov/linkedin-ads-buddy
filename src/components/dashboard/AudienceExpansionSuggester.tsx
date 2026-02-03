import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Users, TrendingUp, Lightbulb, Copy, Check } from 'lucide-react';
import { useAudienceExpansion, ExpansionSuggestion, TitlePerformance } from '@/hooks/useAudienceExpansion';
import { TimeFrameSelector } from './TimeFrameSelector';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AudienceExpansionSuggesterProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function AudienceExpansionSuggester({ accessToken, selectedAccount }: AudienceExpansionSuggesterProps) {
  const {
    data,
    isLoading,
    error,
    fetchAudienceExpansion,
    dateRange,
    setDateRange,
    selectedTitles,
    toggleTitleSelection,
    selectAllSuggestions,
    clearSelection,
    allSuggestedTitles,
  } = useAudienceExpansion(accessToken);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedAccount) {
      fetchAudienceExpansion(selectedAccount);
    }
  }, [selectedAccount, fetchAudienceExpansion]);

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchAudienceExpansion(selectedAccount);
    }
  };

  const handleCopySelected = () => {
    const selectedTitlesList = allSuggestedTitles
      .filter(t => selectedTitles.has(t.titleId))
      .map(t => t.titleName)
      .join('\n');

    if (selectedTitlesList) {
      navigator.clipboard.writeText(selectedTitlesList);
      setCopied(true);
      toast({ title: 'Copied', description: `${selectedTitles.size} titles copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const timeFrameOptions = [
    { label: 'Last 14 Days', value: 'last_14_days', startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 30 Days', value: 'last_30_days', startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 60 Days', value: 'last_60_days', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 90 Days', value: 'last_90_days', startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), endDate: new Date() },
  ];

  const handleTimeFrameChange = (option: typeof timeFrameOptions[0]) => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive/30">
        <CardContent className="pt-4">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TimeFrameSelector
              timeFrameOptions={timeFrameOptions}
              selectedTimeFrame="last_30_days"
              onTimeFrameChange={handleTimeFrameChange}
              timeGranularity="ALL"
              onGranularityChange={() => {}}
              dateRange={dateRange}
              onCustomDateChange={(start, end) => {
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0],
                });
              }}
            />
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Titles Analyzed</div>
            <div className="text-2xl font-bold">{data?.summary?.totalTitlesAnalyzed || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">With Conversions</div>
            <div className="text-2xl font-bold">{data?.summary?.titlesWithLeads || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="pt-4">
            <div className="text-xs text-primary">Expansion Suggestions</div>
            <div className="text-2xl font-bold text-primary">{data?.summary?.expansionSuggestions || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Selected</div>
            <div className="text-2xl font-bold">{selectedTitles.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Titles */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Performing Titles
          </CardTitle>
          <CardDescription>
            Job titles with the best conversion efficiency (lowest CPL)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.topPerformers?.titles && data.topPerformers.titles.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topPerformers.titles.slice(0, 10).map((title) => (
                    <TableRow key={title.titleId}>
                      <TableCell className="font-medium">{title.titleName}</TableCell>
                      <TableCell className="text-right">{title.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{title.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{title.leads}</TableCell>
                      <TableCell className="text-right">{title.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-medium">${title.cpl.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No title performance data available</p>
          )}
        </CardContent>
      </Card>

      {/* Top Job Functions */}
      {data?.topPerformers?.functions && data.topPerformers.functions.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Top Job Functions
            </CardTitle>
            <CardDescription>
              Job functions with the best conversion efficiency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.topPerformers.functions.map((func) => (
                <div key={func.functionUrn} className="p-3 border rounded-lg">
                  <div className="font-medium">{func.functionName}</div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>{func.leads} leads</span>
                    <span className="font-medium text-primary">${func.cpl.toFixed(2)} CPL</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Function-Based Suggestions */}
      {data?.functionSuggestions && data.functionSuggestions.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Function-Based Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.functionSuggestions.map((suggestion, i) => (
                <div key={i} className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">{suggestion.functionName}</Badge>
                      <p className="text-sm">{suggestion.suggestion}</p>
                    </div>
                    <div className="text-right text-sm">
                      <div>{suggestion.currentPerformance.leads} leads</div>
                      <div className="font-medium text-primary">${suggestion.currentPerformance.cpl.toFixed(2)} CPL</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expansion Suggestions */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Title Expansion Suggestions
              </CardTitle>
              <CardDescription>
                Similar titles to your top performers that you may want to target
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllSuggestions}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <Button size="sm" onClick={handleCopySelected} disabled={selectedTitles.size === 0}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy Selected
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data?.suggestions && data.suggestions.length > 0 ? (
            <Accordion type="multiple" className="space-y-2">
              {data.suggestions.map((suggestion, i) => (
                <AccordionItem key={i} value={`suggestion-${i}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4 text-left">
                      <div>
                        <span className="font-medium">{suggestion.basedOn.titleName}</span>
                        <span className="text-muted-foreground ml-2 text-sm">
                          ({suggestion.basedOn.leads} leads, ${suggestion.basedOn.cpl.toFixed(2)} CPL)
                        </span>
                      </div>
                      <Badge variant="secondary">{suggestion.suggestedTitles.length} suggestions</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {suggestion.suggestedTitles.map((title) => (
                        <div
                          key={title.titleId}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleTitleSelection(title.titleId)}
                        >
                          <Checkbox
                            checked={selectedTitles.has(title.titleId)}
                            onCheckedChange={() => toggleTitleSelection(title.titleId)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{title.titleName}</div>
                            <div className="text-xs text-muted-foreground">{title.reason}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No expansion suggestions available.</p>
              <p className="text-sm mt-2">Suggestions are generated based on titles with conversions.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
