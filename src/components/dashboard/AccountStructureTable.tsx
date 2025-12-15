import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, ChevronDown, Folder, Target, Megaphone, Search } from 'lucide-react';
import { AccountStructure, CampaignGroup, Campaign, Creative } from '@/hooks/useAccountStructure';

interface AccountStructureTableProps {
  data: AccountStructure | null;
  isLoading: boolean;
}

function getStatusBadge(status: string) {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower === 'active') {
    return <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-300">Active</Badge>;
  }
  if (statusLower === 'paused') {
    return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-300">Paused</Badge>;
  }
  if (statusLower === 'archived' || statusLower === 'canceled') {
    return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>;
  }
  if (statusLower === 'draft') {
    return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
  }
  return <Badge variant="outline">{status || 'Unknown'}</Badge>;
}

function CreativeRow({ creative, level }: { creative: Creative; level: number }) {
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell style={{ paddingLeft: `${level * 24 + 12}px` }}>
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary/70" />
          <span className="text-sm">{creative.name || `Creative ${creative.id}`}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{creative.id}</TableCell>
      <TableCell>-</TableCell>
      <TableCell>{getStatusBadge(creative.status)}</TableCell>
    </TableRow>
  );
}

function CampaignRow({ campaign, level }: { campaign: Campaign; level: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasCreatives = campaign.creatives && campaign.creatives.length > 0;

  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell style={{ paddingLeft: `${level * 24 + 12}px` }}>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                {hasCreatives ? (
                  isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : (
                  <span className="w-4" />
                )}
                <Target className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{campaign.name || `Campaign ${campaign.id}`}</span>
                {hasCreatives && (
                  <span className="text-xs text-muted-foreground">({campaign.creatives.length} creatives)</span>
                )}
              </div>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{campaign.id}</TableCell>
        <TableCell className="text-sm">{campaign.type || '-'}</TableCell>
        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
      </TableRow>
      {isOpen && hasCreatives && campaign.creatives.map((creative) => (
        <CreativeRow key={creative.id} creative={creative} level={level + 1} />
      ))}
    </>
  );
}

function CampaignGroupRow({ group, level }: { group: CampaignGroup; level: number }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasCampaigns = group.campaigns && group.campaigns.length > 0;

  return (
    <>
      <TableRow className="bg-muted/20 hover:bg-muted/40">
        <TableCell style={{ paddingLeft: `${level * 24 + 12}px` }}>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                {hasCampaigns ? (
                  isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : (
                  <span className="w-4" />
                )}
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="font-semibold">{group.name || `Campaign Group ${group.id}`}</span>
                {hasCampaigns && (
                  <span className="text-xs text-muted-foreground">({group.campaigns.length} campaigns)</span>
                )}
              </div>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{group.id}</TableCell>
        <TableCell>-</TableCell>
        <TableCell>{getStatusBadge(group.status)}</TableCell>
      </TableRow>
      {isOpen && hasCampaigns && group.campaigns.map((campaign) => (
        <CampaignRow key={campaign.id} campaign={campaign} level={level + 1} />
      ))}
    </>
  );
}

export function AccountStructureTable({ data, isLoading }: AccountStructureTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || !data.campaignGroups || data.campaignGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No campaign groups found</p>
        <p className="text-sm">Your account structure will appear here once data is available</p>
      </div>
    );
  }

  // Filter data based on search term
  const filterData = (groups: CampaignGroup[]): CampaignGroup[] => {
    if (!searchTerm.trim()) return groups;
    
    const term = searchTerm.toLowerCase();
    
    return groups.map(group => {
      const groupMatches = group.name?.toLowerCase().includes(term);
      
      const filteredCampaigns = group.campaigns?.filter(campaign => {
        const campaignMatches = campaign.name?.toLowerCase().includes(term);
        const hasMatchingCreative = campaign.creatives?.some(c => 
          c.name?.toLowerCase().includes(term)
        );
        return campaignMatches || hasMatchingCreative;
      }).map(campaign => ({
        ...campaign,
        creatives: campaign.creatives?.filter(c => 
          c.name?.toLowerCase().includes(term) || 
          campaign.name?.toLowerCase().includes(term)
        ) || []
      })) || [];

      if (groupMatches || filteredCampaigns.length > 0) {
        return {
          ...group,
          campaigns: groupMatches ? group.campaigns : filteredCampaigns
        };
      }
      return null;
    }).filter(Boolean) as CampaignGroup[];
  };

  const filteredGroups = filterData(data.campaignGroups);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaign groups, campaigns, or creatives..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredGroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No results match your search</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[45%]">Name</TableHead>
                <TableHead className="w-[20%]">ID</TableHead>
                <TableHead className="w-[15%]">Type</TableHead>
                <TableHead className="w-[20%]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <CampaignGroupRow key={group.id} group={group} level={0} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
