import { cn } from '../lib/utils.js';

export function SongThumbnail({ song, className = 'w-9 h-9', fallback = null }) {
  if (song.thumbnail) {
    return <img src={`/music/${song.thumbnail}`} alt="" className={cn(className, 'object-cover shrink-0')} />;
  }
  return (
    <div className={cn(className, 'bg-muted shrink-0', fallback && 'flex items-center justify-center')}>
      {fallback}
    </div>
  );
}
