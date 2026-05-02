import { SongThumbnail } from './SongThumbnail.jsx';
import { Volume2 } from 'lucide-react';
import { FaYoutube } from 'react-icons/fa';

export function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Shared player bar shell used by NowPlaying and PersonalNowPlaying.
 *
 * Props
 *   song           – current song object
 *   isPlaying      – boolean
 *   currentTime    – seconds
 *   duration       – seconds
 *   volume         – 0–1
 *   onVolumeChange – (v: number) => void
 *   onSeek         – (time: number) => void, or null/undefined for non-seekable
 *   subtitle       – string shown under the title (artist · zone, etc.)
 *   center         – ReactNode rendered in the centre column
 *   right          – ReactNode rendered in the right column
 *   bottom         – CSS bottom value (number = px, or string)
 *   zIndex         – CSS z-index
 *   drawer         – ReactNode rendered above the progress bar (e.g. playlist)
 */
export function PlayerBar({
  song,
  isPlaying,
  currentTime = 0,
  duration = 0,
  volume,
  onVolumeChange,
  onSeek,
  subtitle,
  center,
  right,
  bottom = 0,
  zIndex = 40,
  drawer,
}) {
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className="fixed left-0 right-0 bg-background border-t border-border flex flex-col"
      style={{ bottom, zIndex }}
    >
      {drawer}

      {/* Progress bar */}
      <div
        className={`relative h-1 w-full bg-muted group ${onSeek ? 'cursor-pointer' : ''}`}
        onClick={e => {
          if (!onSeek || !duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * duration);
        }}
      >
        <div className="h-full bg-primary transition-none" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Main row — three-column grid keeps controls truly centred */}
      <div className="grid grid-cols-3 items-center px-4 h-14">

        {/* Left: song info + volume + time */}
        <div className="flex items-center gap-5 min-w-0">
          {song.youtube_url && (
            <a
              href={song.youtube_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#FF0000] hover:text-[#ff4444] shrink-0 transition-colors"
              title="Open on YouTube"
            >
              <FaYoutube size={36} />
            </a>
          )}
          <SongThumbnail song={song} className="w-9 h-9" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Volume2 size={14} className="text-muted-foreground shrink-0" />
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 accent-primary cursor-pointer"
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>

        {/* Centre */}
        <div className="flex items-center justify-center gap-1">
          {center}
        </div>

        {/* Right */}
        <div className="flex items-center justify-end gap-1">
          {right}
        </div>

      </div>
    </div>
  );
}
