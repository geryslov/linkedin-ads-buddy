import { useState, useEffect } from "react";
import { Audience } from "@/hooks/useLinkedInAds";
import { AudienceCard } from "./AudienceCard";
import { AudienceExpansionSuggester } from "./AudienceExpansionSuggester";
import { DemographicTable } from "./DemographicTable";
import { JobSeniorityMatrix } from "./JobSeniorityMatrix";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetCard, EmptyState, SegmentedControl } from "./widgets";
import { Users, BarChart3, Lightbulb, Grid3X3 } from "lucide-react";
import { useDemographicReporting, DemographicPivot, DEMOGRAPHIC_PIVOT_OPTIONS } from "@/hooks/useDemographicReporting";
import { useJobSeniorityMatrix } from "@/hooks/useJobSeniorityMatrix";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AudienceInsightsHubProps {
  audiences: Audience[];
  isLoading: boolean;
  accessToken: string | null;
  selectedAccount: string | null;
}

export function AudienceInsightsHub({
  audiences,
  isLoading,
  accessToken,
  selectedAccount,
}: AudienceInsightsHubProps) {
  const [activeInsight, setActiveInsight] = useState("demographics");
  const demographicReporting = useDemographicReporting(accessToken);
  const jobSeniorityMatrix = useJobSeniorityMatrix(accessToken);

  // Fetch demographics when that tab is active
  useEffect(() => {
    if (selectedAccount && activeInsight === "demographics") {
      demographicReporting.fetchDemographicAnalytics(selectedAccount);
    }
  }, [selectedAccount, activeInsight, demographicReporting.pivot, demographicReporting.dateRange]);

  // Fetch matrix when that tab is active
  useEffect(() => {
    if (selectedAccount && activeInsight === "matrix") {
      jobSeniorityMatrix.fetchMatrix(selectedAccount);
    }
  }, [selectedAccount, activeInsight, jobSeniorityMatrix.dateRange]);

  return (
    <div className="space-y-5">
      {/* Segment Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground leading-tight">DMP Segments</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{audiences.length} segments</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl bg-secondary" />
            ))
          ) : audiences.length > 0 ? (
            audiences.map((audience, i) => (
              <AudienceCard
                key={audience.id}
                audience={audience}
                delay={i * 50}
              />
            ))
          ) : (
            <div className="col-span-full">
              <WidgetCard noPadding>
                <EmptyState
                  icon={Users}
                  title="No audiences found"
                  description="No matched audiences exist for this account yet."
                />
              </WidgetCard>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {selectedAccount && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SegmentedControl
              value={activeInsight}
              onChange={setActiveInsight}
              options={[
                {
                  value: "demographics",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Demographics
                    </span>
                  ),
                },
                {
                  value: "expansion",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Expansion
                    </span>
                  ),
                },
                {
                  value: "matrix",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Grid3X3 className="h-3.5 w-3.5" />
                      Seniority Matrix
                    </span>
                  ),
                },
              ]}
            />

            {activeInsight === "demographics" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pivot by</span>
                <Select
                  value={demographicReporting.pivot}
                  onValueChange={(v) => demographicReporting.setPivot(v as DemographicPivot)}
                >
                  <SelectTrigger className="h-8 w-[180px] text-sm bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {DEMOGRAPHIC_PIVOT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {activeInsight === "demographics" && (
            <DemographicTable
              data={demographicReporting.demographicData}
              isLoading={demographicReporting.isLoading}
              pivot={demographicReporting.pivot}
            />
          )}

          {activeInsight === "expansion" && (
            <AudienceExpansionSuggester
              accessToken={accessToken}
              selectedAccount={selectedAccount}
            />
          )}

          {activeInsight === "matrix" && (
            <JobSeniorityMatrix
              matrixData={jobSeniorityMatrix.matrixData}
              isLoading={jobSeniorityMatrix.isLoading}
              selectedMetric={jobSeniorityMatrix.selectedMetric}
              onMetricChange={jobSeniorityMatrix.setSelectedMetric}
            />
          )}
        </div>
      )}
    </div>
  );
}
