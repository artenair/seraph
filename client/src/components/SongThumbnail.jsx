import { cn, extractYtId } from '../lib/utils.js';

function resolveThumbnail(song) {
  if (song.thumbnail?.startsWith('http')) return song.thumbnail;
  const ytId = extractYtId(song.youtube_url);
  if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  return null;
}

export function SongThumbnail({ song, className = 'w-9 h-9', fallback = null }) {
  const src = resolveThumbnail(song);
  if (src) {
    return <img src={src} alt="" className={cn(className, 'object-cover shrink-0')} />;
  }
  return (
    <div className={cn(className, 'bg-muted shrink-0', fallback && 'flex items-center justify-center')}>
      {fallback}
    </div>
  );
}
