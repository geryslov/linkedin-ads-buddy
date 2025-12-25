import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Bug, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface TitleTestResult {
  status: 'WORKING' | 'AUTH_ERROR' | 'ACCESS_DENIED' | 'ENDPOINT_ERROR' | 'REQUEST_ERROR' | 'NO_DATA';
  reason?: string;
  hint?: string;
  sampleCount?: number;
  sampleTitles?: Array<{
    id: number;
    name_en: string;
    functionUrn: string | null;
    superTitleUrn: string | null;
  }>;
  error?: string;
}

interface TitlesApiTestModalProps {
  accessToken: string | null;
}

export function TitlesApiTestModal({ accessToken }: TitlesApiTestModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TitleTestResult | null>(null);

  const runTest = async () => {
    if (!accessToken) {
      setResult({
        status: 'AUTH_ERROR',
        reason: 'No access token available',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-titles-api', {
        body: { accessToken },
      });

      if (error) {
        setResult({
          status: 'REQUEST_ERROR',
          reason: 'Failed to call test function',
          error: error.message,
        });
      } else {
        setResult(data as TitleTestResult);
      }
    } catch (err) {
      setResult({
        status: 'REQUEST_ERROR',
        reason: 'Unexpected error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!result) return null;
    
    switch (result.status) {
      case 'WORKING':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'AUTH_ERROR':
      case 'ACCESS_DENIED':
        return <XCircle className="h-8 w-8 text-destructive" />;
      case 'ENDPOINT_ERROR':
      case 'REQUEST_ERROR':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      case 'NO_DATA':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    if (!result) return '';
    
    switch (result.status) {
      case 'WORKING':
        return 'bg-green-500/10 border-green-500/20';
      case 'AUTH_ERROR':
      case 'ACCESS_DENIED':
        return 'bg-destructive/10 border-destructive/20';
      default:
        return 'bg-yellow-500/10 border-yellow-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bug className="h-4 w-4" />
          Test Titles API
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>LinkedIn Titles API Test</DialogTitle>
          <DialogDescription>
            Verify if the Standardized Titles API is accessible with your current OAuth token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button 
            onClick={runTest} 
            disabled={isLoading || !accessToken}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Test'
            )}
          </Button>

          {!accessToken && (
            <p className="text-sm text-muted-foreground text-center">
              No access token available. Please authenticate first.
            </p>
          )}

          {result && (
            <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
              <div className="flex items-start gap-3">
                {getStatusIcon()}
                <div className="flex-1 space-y-2">
                  <p className="font-semibold">{result.status}</p>
                  {result.reason && (
                    <p className="text-sm text-muted-foreground">{result.reason}</p>
                  )}
                  {result.hint && (
                    <p className="text-sm text-muted-foreground italic">{result.hint}</p>
                  )}
                  {result.error && (
                    <p className="text-sm text-destructive font-mono">{result.error}</p>
                  )}
                  {result.sampleCount !== undefined && (
                    <p className="text-sm">
                      Sample count: <span className="font-semibold">{result.sampleCount}</span>
                    </p>
                  )}
                </div>
              </div>

              {result.sampleTitles && result.sampleTitles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Sample Titles:</p>
                  <div className="bg-background/50 rounded p-2 text-xs font-mono max-h-48 overflow-y-auto">
                    {result.sampleTitles.map((title, i) => (
                      <div key={i} className="py-1 border-b border-border/50 last:border-0">
                        <p><strong>ID:</strong> {title.id}</p>
                        <p><strong>Name:</strong> {title.name_en}</p>
                        {title.functionUrn && <p><strong>Function:</strong> {title.functionUrn}</p>}
                        {title.superTitleUrn && <p><strong>Super Title:</strong> {title.superTitleUrn}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
