import { useState, useEffect } from 'react';
import { SongThumbnail } from './SongThumbnail.jsx';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Volume2, ChevronDown, ListMusic, X } from 'lucide-react';
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
 *   center         – ReactNode rendered in the centre column (full controls)
 *   playPause      – ReactNode rendered in the compact mobile row (play/pause only)
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
  playPause,
  playlist,
  onPlaylistOpen,
  playlistName,
  onSheetClose,
  right,
  bottom = 0,
  zIndex = 40,
  drawer,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [playlistSheetOpen, setPlaylistSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const TAB_BAR = 56;
  const effectiveBottom = isMobile
    ? (typeof bottom === 'number' ? bottom + TAB_BAR : `calc(${bottom} + ${TAB_BAR}px)`)
    : bottom;

  const progress = duration > 0 ? currentTime / duration : 0;

  function seekFromClick(e) {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * duration);
  }

  return (
    <>
      <div
        className="fixed left-0 md:left-12 right-0 bg-background border-t border-border flex flex-col"
        style={{ bottom: effectiveBottom, zIndex }}
      >
        <div className="hidden md:block">{drawer}</div>

        {/* Progress bar */}
        <div
          className={`relative h-1 w-full bg-muted group ${onSeek ? 'cursor-pointer' : ''}`}
          onClick={seekFromClick}
        >
          <div className="h-full bg-primary transition-none" style={{ width: `${progress * 100}%` }} />
        </div>

        {/* Mobile compact row */}
        <div
          className="flex md:hidden items-center gap-3 px-4 h-14 cursor-pointer"
          onClick={() => setSheetOpen(true)}
        >
          <SongThumbnail song={song} className="w-9 h-9 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div onClick={e => e.stopPropagation()}>
            {playPause}
          </div>
        </div>

        {/* Desktop row — three-column grid keeps controls truly centred */}
        <div className="hidden md:grid grid-cols-3 items-center px-4 h-14">

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

      {/* Mobile full-screen player sheet */}
      <Sheet open={sheetOpen} onOpenChange={v => { setSheetOpen(v); if (!v) { setPlaylistSheetOpen(false); onSheetClose?.(); } }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="p-0 flex flex-col overflow-hidden"
          style={{ height: '100dvh', zIndex: zIndex + 10 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <button onClick={() => setSheetOpen(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown size={22} />
            </button>
            {subtitle && <span className="text-xs text-muted-foreground uppercase tracking-widest">{subtitle}</span>}
            <div className="w-10" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-6 px-6 pb-8 pt-4">

            {/* Thumbnail */}
            <div className="flex justify-center">
              <SongThumbnail song={song} className="w-40 h-40" />
            </div>

            {/* Title */}
            <div>
              <p className="text-xl font-semibold text-foreground truncate">{song.title}</p>
              {song.artist && <p className="text-sm text-muted-foreground truncate">{song.artist}</p>}
            </div>

            {/* Progress */}
            <div className="flex flex-col gap-1">
              <div
                className={`relative h-1.5 w-full bg-muted rounded-full ${onSeek ? 'cursor-pointer' : ''}`}
                onClick={e => {
                  if (!onSeek || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onSeek(((e.clientX - rect.left) / rect.width) * duration);
                }}
              >
                <div className="h-full bg-primary rounded-full transition-none" style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{fmt(currentTime)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>

            {/* Playback controls + playlist + volume */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setVolumeOpen(v => !v)}
                  className={`p-1.5 transition-colors ${volumeOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Volume2 size={18} />
                </button>
                {center}
                {playlist && (
                  <button
                    onClick={() => { onPlaylistOpen?.(); setPlaylistSheetOpen(true); }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ListMusic size={18} />
                  </button>
                )}
              </div>
              {volumeOpen && (
                <input
                  type="range"
                  min={0} max={1} step={0.01}
                  value={volume}
                  onChange={e => onVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              )}
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile playlist sheet */}
      <Sheet open={playlistSheetOpen} onOpenChange={setPlaylistSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="p-0 overflow-hidden flex flex-col"
          style={{ height: '75dvh', zIndex: zIndex + 20 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-medium">{playlistName ?? 'Playlist'}</span>
            <button
              onClick={() => setPlaylistSheetOpen(false)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {drawer}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
