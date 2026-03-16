import { useState, useEffect } from "react";
import { Audience } from "@/hooks/useLinkedInAds";
import { AudienceCard } from "./AudienceCard";
import { AudienceExpansionSuggester } from "./AudienceExpansionSuggester";
import { DemographicTable } from "./DemographicTable";
import { JobSeniorityMatrix } from "./JobSeniorityMatrix";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="space-y-6">
      {/* Segment Cards */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          DMP Segments ({audiences.length})
        </h3>
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
            <div className="col-span-full glass rounded-xl p-12 text-center">
              <p className="text-muted-foreground">No audiences found for this account</p>
            </div>
          )}
        </div>
      </div>

      {/* Insights Tabs */}
      {selectedAccount && (
        <Tabs value={activeInsight} onValueChange={setActiveInsight} className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="demographics" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Demographics
            </TabsTrigger>
            <TabsTrigger value="expansion" className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Expansion
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1.5">
              <Grid3X3 className="h-3.5 w-3.5" />
              Seniority Matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demographics">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Pivot by:</span>
                <Select
                  value={demographicReporting.pivot}
                  onValueChange={(v) => demographicReporting.setPivot(v as DemographicPivot)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMOGRAPHIC_PIVOT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DemographicTable
                data={demographicReporting.demographicData}
                isLoading={demographicReporting.isLoading}
                pivot={demographicReporting.pivot}
              />
            </div>
          </TabsContent>

          <TabsContent value="expansion">
            <AudienceExpansionSuggester
              accessToken={accessToken}
              selectedAccount={selectedAccount}
            />
          </TabsContent>

          <TabsContent value="matrix">
            <JobSeniorityMatrix
              matrixData={jobSeniorityMatrix.matrixData}
              isLoading={jobSeniorityMatrix.isLoading}
              selectedMetric={jobSeniorityMatrix.selectedMetric}
              onMetricChange={jobSeniorityMatrix.setSelectedMetric}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
