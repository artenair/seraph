import { useState, useEffect, useRef, useMemo } from 'react';
import { useRoom } from '../context/RoomContext.jsx';
import { updateRoomPlaylist } from '../api.js';
import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { SongThumbnail } from './SongThumbnail.jsx';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog.jsx';
import { GripVertical, Play, Pause, Plus, X, Sparkles, Library } from 'lucide-react';
import { inputBase } from '../lib/utils.js';

const input = `${inputBase} px-2 py-1.5`;

// CLAP embeddings are L2-normalised, so cosine similarity = dot product.
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function averageEmbedding(embeddings) {
  const len = embeddings[0].length;
  const avg = new Array(len).fill(0);
  for (const e of embeddings)
    for (let i = 0; i < len; i++) avg[i] += e[i] / embeddings.length;
  return avg;
}

function useSuggestions(playlistSongs, candidateSongs) {
  return useMemo(() => {
    const withEmbedding = playlistSongs.filter(s => s.embedding?.length);
    if (withEmbedding.length === 0) return [];

    const dim   = withEmbedding[0].embedding.length;
    const query = averageEmbedding(withEmbedding.map(s => s.embedding));

    const ranked = candidateSongs
      .filter(s => s.embedding?.length === dim)
      .map(s => ({ song: s, score: dotProduct(query, s.embedding) }))
      .sort((a, b) => b.score - a.score);

    const max = ranked[0]?.score ?? 1;
    return ranked
      .map(({ song, score }) => ({ song, pct: Math.round((score / max) * 100) }))
      .filter(({ pct }) => pct >= 60);
  }, [playlistSongs, candidateSongs]);
}

export function PlaylistEditorDialog({ open, onClose, playlist, songs, onUpdate }) {
  const { currentRoom } = useRoom();
  const { play, stop, togglePlay, localSong, isPlaying } = usePersonalAudio();
  const [name,   setName]   = useState(playlist.name);
  const [search, setSearch] = useState('');
  const [view,   setView]   = useState('library'); // 'library' | 'suggested'
  const dragIndex = useRef(null);

  useEffect(() => { setName(playlist.name); }, [playlist.id]);
  useEffect(() => { if (!open) { stop(); setView('library'); } }, [open]);

  const songIds       = playlist.songs ?? [];
  const inPlaylist    = new Set(songIds);
  const playlistSongs = songIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
  const outsideSongs  = songs.filter(s => !inPlaylist.has(s.id));
  const librarySongs  = outsideSongs.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  );
  const suggestions   = useSuggestions(playlistSongs, outsideSongs);
  const canSuggest    = playlistSongs.some(s => s.embedding?.length);

  async function saveName() {
    if (!name.trim() || name.trim() === playlist.name) return;
    const updated = await updateRoomPlaylist(currentRoom.id, playlist.id, { name: name.trim() });
    onUpdate(updated);
  }

  async function addSong(songId) {
    const updated = await updateRoomPlaylist(currentRoom.id, playlist.id, { songs: [...songIds, songId] });
    onUpdate(updated);
  }

  async function removeSong(songId) {
    const updated = await updateRoomPlaylist(currentRoom.id, playlist.id, { songs: songIds.filter(id => id !== songId) });
    onUpdate(updated);
  }

  async function reorder(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const next = [...songIds];
    next.splice(toIndex, 0, next.splice(fromIndex, 1)[0]);
    const updated = await updateRoomPlaylist(currentRoom.id, playlist.id, { songs: next });
    onUpdate(updated);
  }

  function togglePreview(song) {
    if (localSong?.id === song.id) togglePlay(); else play(song);
  }

  function previewIcon(song) {
    if (localSong?.id === song.id) return isPlaying ? <Pause size={15} /> : <Play size={15} />;
    return <Play size={15} />;
  }

  function previewClass(song) {
    if (localSong?.id === song.id) return 'shrink-0 p-2 transition-colors text-primary';
    return 'shrink-0 p-2 transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100';
  }

  const displayedLibrary = view === 'suggested'
    ? suggestions.map(({ song }) => song)
    : librarySongs;
  const scoreOf = song => suggestions.find(s => s.song.id === song.id)?.pct ?? null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent showCloseButton className="flex flex-col gap-0 p-0 max-w-5xl w-[92vw] h-[85vh] sm:max-w-5xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center gap-3">
          <DialogTitle asChild>
            <input
              className="flex-1 min-w-0 text-xl font-semibold bg-transparent border-none outline-none text-foreground"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => e.key === 'Enter' && e.target.blur()}
            />
          </DialogTitle>
          <span className="text-muted-foreground text-base shrink-0">
            · {playlistSongs.length} song{playlistSongs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Two-panel body */}
        <div className="flex flex-1 min-h-0">

          {/* Left panel */}
          <div className="w-1/2 flex flex-col border-r border-border min-h-0">
            <div className="px-5 py-3 border-b border-border shrink-0 flex flex-col gap-2">

              {/* View toggle */}
              <div className="flex gap-1">
                <button
                  onClick={() => setView('library')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs transition-colors ${view === 'library' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Library size={11} /> Library
                </button>
                <button
                  onClick={() => setView('suggested')}
                  disabled={!canSuggest}
                  title={canSuggest ? undefined : 'Add songs with embeddings to enable suggestions'}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${view === 'suggested' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Sparkles size={11} /> Suggested
                </button>
              </div>

              {view === 'library' && (
                <input
                  className={input + ' w-full'}
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {displayedLibrary.length === 0 && (
                <p className="text-base text-muted-foreground text-center py-10">
                  {view === 'suggested'
                    ? 'No songs with embeddings found outside the playlist.'
                    : search ? 'No songs match.' : 'All songs are in the playlist.'}
                </p>
              )}
              {displayedLibrary.map(song => {
                const pct = view === 'suggested' ? scoreOf(song) : null;
                return (
                <div key={song.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 group">
                  <SongThumbnail song={song} className="w-12 h-12 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-base truncate block">{song.title}</span>
                    {Array.isArray(song.tags) && song.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {song.tags.map(tag => (
                          <span key={tag} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5">{tag.charAt(0).toUpperCase() + tag.slice(1)}</span>
                        ))}
                      </div>
                    )}
                    {pct !== null && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground shrink-0">Similarity</span>
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{pct}%</span>
                      </div>
                    )}
                  </div>
                  <button
                    title="Preview"
                    onClick={() => togglePreview(song)}
                    className={previewClass(song)}>
                    {previewIcon(song)}
                  </button>
                  <button
                    title="Add to playlist"
                    onClick={() => addSong(song.id)}
                    className="shrink-0 p-2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                );
              })}
            </div>
          </div>

          {/* Playlist */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-border shrink-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Playlist</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {playlistSongs.length === 0 && (
                <p className="text-base text-muted-foreground text-center py-10">
                  No songs yet.<br />Add from the library.
                </p>
              )}
              {playlistSongs.map((song, i) => (
                <div
                  key={song.id}
                  draggable
                  onDragStart={() => { dragIndex.current = i; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { reorder(dragIndex.current, i); dragIndex.current = null; }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 group cursor-default">
                  <GripVertical size={16} className="text-muted-foreground/40 shrink-0 cursor-grab" />
                  <span className="text-base text-muted-foreground/40 w-6 shrink-0 text-right tabular-nums">{i + 1}</span>
                  <SongThumbnail song={song} className="w-12 h-12 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-base truncate block">{song.title}</span>
                    {Array.isArray(song.tags) && song.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {song.tags.map(tag => (
                          <span key={tag} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5">{tag.charAt(0).toUpperCase() + tag.slice(1)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    title="Preview"
                    onClick={() => togglePreview(song)}
                    className={previewClass(song)}>
                    {previewIcon(song)}
                  </button>
                  <button
                    title="Remove"
                    onClick={() => removeSong(song.id)}
                    className="shrink-0 p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
