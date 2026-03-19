import { ExternalLink, MessageSquare, Repeat2, ThumbsUp, Image, Video, FileText, Link2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { SocialPost } from '@/types/socialListener';

const REACTION_EMOJIS: Record<string, string> = {
  LIKE: '👍',
  PRAISE: '👏',
  APPRECIATION: '🙏',
  EMPATHY: '❤️',
  INTEREST: '🔥',
  ENTERTAINMENT: '😂',
};

const MEDIA_ICONS: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  document: FileText,
  link: Link2,
};

interface PostCardProps {
  post: SocialPost;
  compact?: boolean;
}

export function PostCard({ post, compact }: PostCardProps) {
  const MediaIcon = post.mediaType ? MEDIA_ICONS[post.mediaType] : null;

  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.name}
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
              {post.author.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {post.author.name}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {formatDistanceToNow(parseISO(post.postedAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {post.isRepost && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">Repost</Badge>
          )}
          {post.isQuotePost && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">Quote</Badge>
          )}
          {MediaIcon && (
            <span className="text-slate-400">
              <MediaIcon className="w-3.5 h-3.5" />
            </span>
          )}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
            aria-label="Open post"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Text */}
      {post.text && (
        <p className={`text-xs text-slate-700 dark:text-slate-300 leading-relaxed ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>
          {post.text}
        </p>
      )}

      {/* Engagement */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <ThumbsUp className="w-3 h-3" />
          {post.totalReactions.toLocaleString()}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <MessageSquare className="w-3 h-3" />
          {post.comments.toLocaleString()}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <Repeat2 className="w-3 h-3" />
          {post.reposts.toLocaleString()}
        </span>

        {/* Reaction breakdown */}
        {!compact && Object.keys(post.reactionBreakdown).length > 0 && (
          <div className="flex items-center gap-0.5 ml-auto">
            {Object.entries(post.reactionBreakdown)
              .filter(([, v]) => (v ?? 0) > 0)
              .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
              .slice(0, 4)
              .map(([k, v]) => (
                <span
                  key={k}
                  className="text-[10px] text-slate-500"
                  title={`${k}: ${v}`}
                >
                  {REACTION_EMOJIS[k] ?? '👍'} {(v ?? 0) > 99 ? '99+' : v}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
