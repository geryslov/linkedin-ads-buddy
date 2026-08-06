import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreativeThumbnailProps {
  imageUrl?: string;
  creativeName?: string;
  size?: number;
}

export function CreativeThumbnail({ imageUrl, creativeName, size = 40 }: CreativeThumbnailProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div
        className="rounded-md bg-secondary/60 border border-border/60 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <>
      <img
        src={imageUrl}
        alt={creativeName || 'Creative thumbnail'}
        className="rounded-md object-cover cursor-pointer ring-1 ring-border/60 hover:ring-primary/40 hover:opacity-90 transition-all shrink-0"
        style={{ width: size, height: size }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        onError={() => setHasError(true)}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">{creativeName || 'Creative Preview'}</DialogTitle>
          <img
            src={imageUrl}
            alt={creativeName || 'Creative preview'}
            className="w-full h-auto rounded-lg"
          />
          {creativeName && (
            <p className="text-sm text-muted-foreground mt-2 break-words">{creativeName}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
