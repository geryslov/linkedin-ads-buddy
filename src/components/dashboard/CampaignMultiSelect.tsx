import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Target, ChevronDown, X } from 'lucide-react';
import { CampaignData } from '@/hooks/useCampaignReporting';

interface CampaignMultiSelectProps {
  campaigns: CampaignData[];
  selectedCampaignIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
}

export function CampaignMultiSelect({
  campaigns,
  selectedCampaignIds,
  onSelectionChange,
  isLoading = false,
}: CampaignMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleCampaign = (campaignId: string) => {
    if (selectedCampaignIds.includes(campaignId)) {
      onSelectionChange(selectedCampaignIds.filter(id => id !== campaignId));
    } else {
      onSelectionChange([...selectedCampaignIds, campaignId]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectAll = () => {
    onSelectionChange(campaigns.map(c => c.campaignId));
  };

  const selectedCampaigns = campaigns.filter(c => selectedCampaignIds.includes(c.campaignId));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filter by Campaigns:</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {selectedCampaignIds.length === 0 
                  ? 'All Campaigns' 
                  : `${selectedCampaignIds.length} selected`}
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search campaigns..." />
              <CommandList>
                <CommandEmpty>No campaigns found.</CommandEmpty>
                <CommandGroup>
                  <div className="flex items-center justify-between px-2 py-1.5 border-b">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={selectAll}
                      className="h-7 text-xs"
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearAll}
                      className="h-7 text-xs"
                    >
                      Clear All
                    </Button>
                  </div>
                  {isLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading campaigns...
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No campaigns available
                    </div>
                  ) : (
                    campaigns.map((campaign) => (
                      <CommandItem
                        key={campaign.campaignId}
                        value={campaign.campaignName}
                        onSelect={() => toggleCampaign(campaign.campaignId)}
                        className="cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedCampaignIds.includes(campaign.campaignId)}
                          className="mr-2"
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="truncate text-sm">{campaign.campaignName}</span>
                          <span className="text-xs text-muted-foreground">
                            {campaign.status} • {campaign.impressions.toLocaleString()} impressions
                          </span>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedCampaigns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCampaigns.slice(0, 5).map((campaign) => (
            <Badge
              key={campaign.campaignId}
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => toggleCampaign(campaign.campaignId)}
            >
              <span className="truncate max-w-[150px]">{campaign.campaignName}</span>
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedCampaigns.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{selectedCampaigns.length - 5} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
