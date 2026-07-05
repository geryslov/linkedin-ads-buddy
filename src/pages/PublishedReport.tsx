import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PublishedReportView } from '@/components/dashboard/PublishedReportView';
import { Loader2, FileX } from 'lucide-react';
import type { KpiSnapshot } from '@/lib/serializeReportForClaude';

interface Row {
  id: string;
  client_name: string;
  week_start: string;
  week_end: string;
  narrative_markdown: string;
  kpi_snapshot: KpiSnapshot;
  published_at: string;
}

export default function PublishedReport() {
  const { token } = useParams<{ token: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setState('not_found'); return; }
    (async () => {
      const { data, error } = await supabase.rpc('get_published_report', { token });
      if (error) {
        console.error('get_published_report error:', error);
        setState('error');
        return;
      }
      const first = Array.isArray(data) ? data[0] : data;
      if (!first) { setState('not_found'); return; }
      setRow(first as unknown as Row);
      setState('ready');
    })();
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'not_found' || state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4 px-6">
          <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center">
            <FileX className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold">This report is no longer available</h1>
          <p className="text-sm text-muted-foreground">
            The link may have expired or been revoked. Please contact the sender for a fresh copy.
          </p>
        </div>
      </div>
    );
  }

  if (!row) return null;

  return (
    <PublishedReportView
      clientName={row.client_name}
      weekStart={row.week_start}
      weekEnd={row.week_end}
      publishedAt={row.published_at}
      narrativeMarkdown={row.narrative_markdown}
      kpiSnapshot={row.kpi_snapshot}
    />
  );
}
