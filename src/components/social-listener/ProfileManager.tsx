import { useState } from 'react';
import { Plus, Trash2, Linkedin, Twitter, Instagram, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import type { TrackedProfile, SocialPlatform } from '@/types/socialListener';

const PLATFORM_ICONS: Record<SocialPlatform, React.ElementType> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  linkedin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  twitter: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
};

const PLATFORM_PLACEHOLDERS: Record<SocialPlatform, string> = {
  linkedin: 'https://www.linkedin.com/in/username',
  twitter: 'https://twitter.com/username',
  instagram: 'https://www.instagram.com/username',
};

interface ProfileManagerProps {
  profiles: TrackedProfile[];
  onAdd: (url: string, platform: SocialPlatform) => void;
  onRemove: (id: string) => void;
  isRunning: boolean;
}

export function ProfileManager({ profiles, onAdd, onRemove, isRunning }: ProfileManagerProps) {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [validationError, setValidationError] = useState('');

  const detectPlatform = (value: string): SocialPlatform => {
    if (value.includes('twitter.com') || value.includes('x.com')) return 'twitter';
    if (value.includes('instagram.com')) return 'instagram';
    return 'linkedin';
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setValidationError('');
    if (value.includes('.com/')) {
      setPlatform(detectPlatform(value));
    }
  };

  const handleAdd = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Enter a profile URL.');
      return;
    }
    if (profiles.some((p) => p.url === trimmed.replace(/\/$/, ''))) {
      setValidationError('This profile is already being tracked.');
      return;
    }
    onAdd(trimmed, platform);
    setUrl('');
    setValidationError('');
  };

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-500" />
          Tracked Profiles
          <Badge variant="secondary" className="ml-auto text-xs">
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex gap-2">
          <Select
            value={platform}
            onValueChange={(v) => setPlatform(v as SocialPlatform)}
          >
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin">
                <span className="flex items-center gap-1.5 text-xs">
                  <Linkedin className="w-3.5 h-3.5 text-blue-600" /> LinkedIn
                </span>
              </SelectItem>
              <SelectItem value="twitter">
                <span className="flex items-center gap-1.5 text-xs">
                  <Twitter className="w-3.5 h-3.5 text-sky-500" /> Twitter / X
                </span>
              </SelectItem>
              <SelectItem value="instagram">
                <span className="flex items-center gap-1.5 text-xs">
                  <Instagram className="w-3.5 h-3.5 text-pink-500" /> Instagram
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1 relative">
            <Input
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={PLATFORM_PLACEHOLDERS[platform]}
              className="h-9 text-xs pr-2"
              disabled={isRunning}
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={isRunning || !url.trim()}
            className="h-9 px-3 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {validationError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {validationError}
          </p>
        )}

        {/* Profile list */}
        {profiles.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
            No profiles tracked yet. Add a LinkedIn, Twitter, or Instagram profile above.
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => {
              const Icon = PLATFORM_ICONS[p.platform];
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 group"
                >
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${PLATFORM_COLORS[p.platform]}`}>
                    <Icon className="w-3 h-3" />
                    {p.platform}
                  </span>
                  <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
                    {p.displayName ?? p.handle}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block">
                    Added {format(parseISO(p.addedAt), 'MMM d')}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        disabled={isRunning}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove profile?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove <strong>{p.handle}</strong> and all their scraped posts from your listener.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => onRemove(p.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
