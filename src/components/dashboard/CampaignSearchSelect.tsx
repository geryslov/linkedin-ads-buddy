import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronDown, X, CheckSquare, Square } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface CampaignSearchSelectProps {
  campaigns: Campaign[];
  selectedCampaignIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function CampaignSearchSelect({
  campaigns,
  selectedCampaignIds,
  onChange,
  disabled = false,
}: CampaignSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCampaigns = useMemo(() => {
    if (!search.trim()) return campaigns;
    const lowerSearch = search.toLowerCase();
    return campaigns.filter(c => 
      c.name.toLowerCase().includes(lowerSearch) ||
      c.status.toLowerCase().includes(lowerSearch)
    );
  }, [campaigns, search]);

  const activeCampaigns = useMemo(() => 
    campaigns.filter(c => c.status === 'ACTIVE'),
  [campaigns]);

  const toggleCampaign = (id: string) => {
    if (selectedCampaignIds.includes(id)) {
      onChange(selectedCampaignIds.filter(cId => cId !== id));
    } else {
      onChange([...selectedCampaignIds, id]);
    }
  };

  const selectAllActive = () => {
    const activeIds = activeCampaigns.map(c => c.id);
    const currentActive = selectedCampaignIds.filter(id => 
      activeCampaigns.some(c => c.id === id)
    );
    
    if (currentActive.length === activeIds.length) {
      // Deselect all active
      onChange(selectedCampaignIds.filter(id => !activeIds.includes(id)));
    } else {
      // Select all active
      const newIds = [...new Set([...selectedCampaignIds, ...activeIds])];
      onChange(newIds);
    }
  };

  const removeSelected = (id: string) => {
    onChange(selectedCampaignIds.filter(cId => cId !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500';
      case 'PAUSED': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const selectedCampaigns = campaigns.filter(c => selectedCampaignIds.includes(c.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="truncate">
              {selectedCampaignIds.length === 0 
                ? 'Select campaigns...'
                : `${selectedCampaignIds.length} campaign${selectedCampaignIds.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search campaigns..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No campaigns found.</CommandEmpty>
              <CommandGroup>
                {/* Select All Active Button */}
                {activeCampaigns.length > 0 && (
                  <CommandItem
                    onSelect={selectAllActive}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {activeCampaigns.every(c => selectedCampaignIds.includes(c.id)) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">Select all active ({activeCampaigns.length})</span>
                  </CommandItem>
                )}
                
                {/* Campaign List */}
                <ScrollArea className="max-h-[250px]">
                  {filteredCampaigns.map((campaign) => {
                    const isSelected = selectedCampaignIds.includes(campaign.id);
                    return (
                      <CommandItem
                        key={campaign.id}
                        onSelect={() => toggleCampaign(campaign.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox 
                          checked={isSelected}
                          className="pointer-events-none"
                        />
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(campaign.status)}`} />
                        <span className="truncate flex-1">{campaign.name}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {campaign.status}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Selected Campaigns Badges */}
      {selectedCampaigns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCampaigns.slice(0, 5).map((campaign) => (
            <Badge 
              key={campaign.id} 
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(campaign.status)}`} />
              <span className="truncate max-w-[120px]">{campaign.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive/20"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSelected(campaign.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
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
