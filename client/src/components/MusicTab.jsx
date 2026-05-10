import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { inputBase, extractYtId, extractYtPlaylistId } from '../lib/utils.js';
import { useRoom } from '../context/RoomContext.jsx';
import { fetchRoomSongs, addRoomSong, approveRoomSong, updateRoomSong, deleteRoomSong } from '../api.js';
import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Pencil, Trash2, X, Check, Plus, ChevronDown } from 'lucide-react';
import { ref as rtdbRef, onValue } from 'firebase/database';
import { rtdb } from '../lib/firebase.js';

const input = `${inputBase} px-2 py-1.5`;

function thumb(song) {
  if (song.thumbnail?.startsWith('http')) return song.thumbnail;
  const id = extractYtId(song.youtube_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-foreground text-background text-sm shadow-lg border border-border">
      {message}
    </div>
  );
}

function AddSongCard({ onClick, isAdmin }) {
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden border border-dashed border-border group cursor-pointer hover:border-foreground/40 transition-colors"
      onClick={onClick}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
        <Plus size={24} strokeWidth={1.5} />
        <span className="text-xs">{isAdmin ? 'Add a song' : 'Submit a song'}</span>
      </div>
    </div>
  );
}

function AddSongModal({ open, onClose, onToast, isAdmin }) {
  const { currentRoom } = useRoom();
  const [urlInput, setUrlInput] = useState('');
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!open) { setUrlInput(''); setMessage(''); setError(null); }
  }, [open]);

  const isPlaylist = isAdmin && !!extractYtPlaylistId(urlInput);

  async function handleSubmit() {
    if (!urlInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await addRoomSong(currentRoom.id, urlInput.trim(), message.trim());
      if (!isAdmin) onToast('Your submission has been sent for review.');
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function submitLabel() {
    if (loading) return <Loader2 size={14} className="animate-spin" />;
    if (isPlaylist) return 'Import playlist';
    return isAdmin ? 'Add' : 'Submit';
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isAdmin ? 'Add a song' : 'Submit a song'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <input
            className={`${input} w-full`}
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && isAdmin && handleSubmit()}
            placeholder="YouTube URL or playlist URL"
            disabled={loading}
            autoFocus
          />
          {!isAdmin && (
            <textarea
              className={`${input} w-full resize-none`}
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Leave a message (optional)"
              disabled={loading}
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter showCloseButton>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !urlInput.trim()}>
            {submitLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SongCard = memo(function SongCard({ song, onUpdated, onDeleted }) {
  const { play } = usePersonalAudio();
  const { currentRoom } = useRoom();
  const [editing,  setEditing]  = useState(false);
  const [title,    setTitle]    = useState(song.title);
  const [artist,   setArtist]   = useState(song.artist);
  const [tagsRaw,  setTagsRaw]  = useState(() => (Array.isArray(song.tags) ? song.tags : []).join(', '));
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!editing) {
      setTitle(song.title);
      setArtist(song.artist);
      setTagsRaw((Array.isArray(song.tags) ? song.tags : []).join(', '));
    }
  }, [song, editing]);

  async function handleSave() {
    setSaving(true);
    const tags    = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const updated = await updateRoomSong(currentRoom.id, song, { title, artist, tags });
    onUpdated(updated);
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${song.title}"?`)) return;
    setDeleting(true);
    await deleteRoomSong(currentRoom.id, song.id);
    onDeleted(song.id);
  }

  const tags = Array.isArray(song.tags) ? song.tags : [];
  const img  = thumb(song);

  return (
    <div
      className="relative aspect-[4/3] overflow-hidden border border-border group cursor-pointer"
      onClick={() => !editing && play(song)}
    >
      {img
        ? <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        : <div className="absolute inset-0 bg-muted" />
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {tags.map(t => (
              <span key={t} className="px-1.5 py-0.5 text-[9px] uppercase tracking-wide bg-white/10 border border-white/20 text-white/80 leading-none backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs font-semibold text-white leading-snug line-clamp-2 drop-shadow">{song.title}</p>
        {song.artist && <p className="text-[10px] text-white/60 truncate mt-0.5">{song.artist}</p>}
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={e => { e.stopPropagation(); setEditing(true); }}
          className="p-1 bg-black/50 border border-white/20 text-white/70 hover:text-white backdrop-blur-sm transition-colors"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); handleDelete(); }}
          disabled={deleting}
          className="p-1 bg-black/50 border border-white/20 text-white/70 hover:text-red-400 backdrop-blur-sm transition-colors disabled:opacity-40"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {editing && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm p-3 flex flex-col gap-2">
          <input className={`${input} w-full`} value={title}   onChange={e => setTitle(e.target.value)}   placeholder="Title" />
          <input className={`${input} w-full`} value={artist}  onChange={e => setArtist(e.target.value)}  placeholder="Artist" />
          <input className={`${input} w-full`} value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="Tags (comma separated)" />
          <div className="flex gap-2 mt-auto">
            <button onClick={handleSave} disabled={saving} className="text-green-500 hover:text-green-400 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const RemoteSongCard = memo(function RemoteSongCard({ song }) {
  const { play } = usePersonalAudio();
  const img = thumb(song);
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden border border-border group cursor-pointer"
      onClick={() => play(song)}
    >
      {img
        ? <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        : <div className="absolute inset-0 bg-muted" />
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-xs font-semibold text-white leading-snug line-clamp-2 drop-shadow">{song.title}</p>
        {song.artist && <p className="text-[10px] text-white/60 truncate mt-0.5">{song.artist}</p>}
      </div>
    </div>
  );
});

const PendingCard = memo(function PendingCard({ song, onApproved, onRejected }) {
  const { play } = usePersonalAudio();
  const { currentRoom } = useRoom();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const img = thumb(song);

  async function handleApprove(e) {
    e.stopPropagation();
    setApproving(true);
    const updated = await approveRoomSong(currentRoom.id, song);
    onApproved(updated);
  }

  async function handleReject(e) {
    e.stopPropagation();
    if (!confirm(`Reject "${song.title}"?`)) return;
    setRejecting(true);
    await deleteRoomSong(currentRoom.id, song.id);
    onRejected(song.id);
  }

  return (
    <div
      className="relative aspect-[4/3] overflow-hidden border border-dashed border-border group cursor-pointer opacity-80"
      onClick={() => play(song)}
    >
      {img
        ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 bg-muted" />
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute top-2 left-2">
        <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wide bg-yellow-500/80 text-black font-semibold leading-none">
          Pending
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-xs font-semibold text-white leading-snug line-clamp-2 drop-shadow">{song.title}</p>
        {song.artist && <p className="text-[10px] text-white/60 truncate mt-0.5">{song.artist}</p>}
        {song.message && (
          <p className="text-[10px] text-white/50 italic truncate mt-0.5">"{song.message}"</p>
        )}
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={handleApprove}
          disabled={approving || rejecting}
          className="p-1 bg-black/50 border border-white/20 text-green-400 hover:text-green-300 backdrop-blur-sm transition-colors disabled:opacity-40"
          title="Approve"
        >
          <Check size={11} />
        </button>
        <button
          onClick={handleReject}
          disabled={approving || rejecting}
          className="p-1 bg-black/50 border border-white/20 text-white/70 hover:text-red-400 backdrop-blur-sm transition-colors disabled:opacity-40"
          title="Reject"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
});

export function MusicTab() {
  const { isAdmin, isDJ, currentRoom } = useRoom();
  const canManageMusic = isAdmin || isDJ;
  const [songs,       setSongs]       = useState([]);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [jumpOpen,      setJumpOpen]      = useState(false);
  const [jumpInput,     setJumpInput]     = useState('');
  const [pendingOpen, setPendingOpen] = useState(true);
  const [search,      setSearch]      = useState('');
  const [tagFilter,   setTagFilter]   = useState('');
  const [page,        setPage]        = useState(1);
  const [sort,        setSort]        = useState('az');
  const [toast,       setToast]       = useState(null);
  const clearToast = useRef(() => setToast(null)).current;
  const PAGE_SIZE = 34;
  useEffect(() => setPage(1), [search, tagFilter, sort]);

  // Initial load from Firestore
  useEffect(() => {
    if (!currentRoom?.id) return;
    fetchRoomSongs(currentRoom.id).then(setSongs);
  }, [currentRoom?.id]);

  // Real-time updates via RTDB
  useEffect(() => {
    if (!currentRoom?.id) return;
    const firstCall = { seen: false };
    const unsub = onValue(rtdbRef(rtdb, `rooms/${currentRoom.id}/songEvent`), snapshot => {
      if (!firstCall.seen) { firstCall.seen = true; return; } // skip initial value, Firestore covers it
      const event = snapshot.val();
      if (!event) return;
      if (event.type === 'song_created') {
        setSongs(prev => prev.some(s => s.id === event.song.id) ? prev : [event.song, ...prev]);
      }
      if (event.type === 'song_submitted' && canManageMusic) {
        setSongs(prev => prev.some(s => s.id === event.song.id) ? prev : [event.song, ...prev]);
      }
      if (event.type === 'song_updated') {
        setSongs(prev => prev.map(s => s.id === event.song.id ? event.song : s));
      }
      if (event.type === 'song_deleted') {
        setSongs(prev => prev.filter(s => s.id !== event.songId));
      }
    });
    return unsub;
  }, [currentRoom?.id, isAdmin]);

  const pending  = useMemo(() => songs.filter(s => s.status === 'pending'),  [songs]);
  const approved = useMemo(() => songs.filter(s => s.status !== 'pending'), [songs]);

  const handleUpdated = useCallback(updated => setSongs(prev => prev.map(s => s.id === updated.id ? updated : s)), []);
  const handleDeleted = useCallback(id      => setSongs(prev => prev.filter(s => s.id !== id)), []);

  const allTags  = useMemo(() => [...new Set(approved.flatMap(s => Array.isArray(s.tags) ? s.tags : []))].sort(), [approved]);
  const filtered = useMemo(() => approved.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.artist.toLowerCase().includes(q)) return false;
    }
    if (tagFilter && !(Array.isArray(s.tags) ? s.tags : []).includes(tagFilter)) return false;
    return true;
  }), [approved, search, tagFilter]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
    return sort === 'az' ? cmp : -cmp;
  }), [filtered, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible    = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page]);

  return (
    <div className="flex flex-col gap-4">

      {/* Search / filter */}
      <div className="flex gap-2 max-w-xl items-center">
        <input
          className={input + ' flex-1'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or artist…"
        />
        {allTags.length > 0 && (
          <select className={`${input} w-auto`} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select className={`${input} w-auto`} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
      </div>

      {/* Pending queue — local only, collapsible */}
      {canManageMusic && pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-fit"
            onClick={() => setPendingOpen(v => !v)}
          >
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${pendingOpen ? '' : '-rotate-90'}`}
            />
            Pending approval ({pending.length})
          </button>
          {pendingOpen && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {pending.map(song => (
                <PendingCard
                  key={song.id}
                  song={song}
                  onApproved={updated => setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))}
                  onRejected={id => setSongs(prev => prev.filter(s => s.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Song grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <AddSongCard onClick={() => setModalOpen(true)} isAdmin={canManageMusic} />
        {visible.map(song => (
          canManageMusic
            ? <SongCard
                key={song.id}
                song={song}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            : <RemoteSongCard key={song.id} song={song} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 mx-auto">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          >
            ←
          </button>
          {(() => {
            let start = page - 3;
            let end   = page + 2;
            if (start < 1)            { end   += (1 - start);             start = 1; }
            if (end > totalPages)     { start -= (end - totalPages);       end = totalPages; }
            if (start === 1)            end   = Math.min(totalPages, Math.max(end, 8));
            if (end >= totalPages - 1) { end   = totalPages; start = Math.max(1, Math.min(start, totalPages - 7)); }
            start = Math.max(1, start);

            const items = [];
            if (start > 1)  items.push(1);
            if (start > 2)  items.push('...');
            for (let p = start; p <= end; p++) items.push(p);
            if (end < totalPages - 1) items.push('...');
            if (end < totalPages)     items.push(totalPages);

            return items.map((p, i) =>
              p === '...'
                ? <button key={`ellipsis-${i}`} onClick={() => { setJumpInput(''); setJumpOpen(true); }} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">…</button>
                : <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 flex items-center justify-center text-sm font-medium border transition-colors ${p === page ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                  >
                    {p}
                  </button>
            );
          })()}
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page === totalPages}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}

      <Dialog open={jumpOpen} onOpenChange={v => !v && setJumpOpen(false)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Go to page</DialogTitle>
          </DialogHeader>
          <input
            className={`${input} w-full`}
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            onChange={e => setJumpInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const p = parseInt(jumpInput);
                if (p >= 1 && p <= totalPages) { setPage(p); setJumpOpen(false); }
              }
            }}
            placeholder={`1 – ${totalPages}`}
            autoFocus
          />
          <DialogFooter showCloseButton>
            <Button size="sm" onClick={() => {
              const p = parseInt(jumpInput);
              if (p >= 1 && p <= totalPages) { setPage(p); setJumpOpen(false); }
            }}>
              Go
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSongModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onToast={setToast}
        isAdmin={canManageMusic}
      />

      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}
