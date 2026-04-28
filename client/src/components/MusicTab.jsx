import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../lib/useWebSocket.js';
import { inputBase } from '../lib/utils.js';
import { SongThumbnail } from './SongThumbnail.jsx';
import { fetchSongs, downloadSong, updateSong, deleteSong } from '../api.js';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Pencil, Trash2, X, Check, Repeat } from 'lucide-react';

const input = `${inputBase} px-2 py-1.5`;

function StatusIcon({ status }) {
  if (status === 'downloading') return <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />;
  if (status === 'done')        return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === 'error')       return <XCircle size={14} className="text-red-500 shrink-0" />;
  return null;
}

function TagBadge({ tag }) {
  return (
    <span className="px-1.5 py-0.5 text-xs bg-muted border border-border text-muted-foreground">
      {tag}
    </span>
  );
}

function ProgressBar({ label, color, percent, active }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-20 shrink-0 ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <div className="flex-1 h-1 bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${active ? color : 'bg-muted-foreground/30'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
        {active ? `${Math.floor(percent)}%` : percent >= 100 ? '100%' : '—'}
      </span>
    </div>
  );
}

function AudioPlayer({ filename }) {
  const audioRef = useRef(null);
  const [loop, setLoop] = useState(false);

  function toggleLoop() {
    const next = !loop;
    setLoop(next);
    if (audioRef.current) audioRef.current.loop = next;
  }

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} controls src={`/music/${filename}`} className="flex-1 h-8" />
      <button
        onClick={toggleLoop}
        title="Loop"
        className={`p-1 transition-colors ${loop ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
        <Repeat size={14} />
      </button>
    </div>
  );
}

function SongRow({ song, percent, onUpdated, onDeleted }) {
  const [editing, setEditing]   = useState(false);
  const [title,   setTitle]     = useState(song.title);
  const [artist,  setArtist]    = useState(song.artist);
  const [tagsRaw, setTagsRaw]   = useState(() => JSON.parse(song.tags || '[]').join(', '));
  const [saving,  setSaving]    = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!editing) {
      setTitle(song.title);
      setArtist(song.artist);
      setTagsRaw(JSON.parse(song.tags || '[]').join(', '));
    }
  }, [song, editing]);

  async function handleSave() {
    setSaving(true);
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const updated = await updateSong(song.id, { title, artist, tags });
    onUpdated(updated);
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${song.title}"?`)) return;
    setDeleting(true);
    await deleteSong(song.id);
    onDeleted(song.id);
  }

  const tags = JSON.parse(song.tags || '[]');

  return (
    <div className="border border-border p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <SongThumbnail song={song} className="w-10 h-10" fallback={<StatusIcon status={song.status} />} />

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <input className={`${input} w-full`} value={title}   onChange={e => setTitle(e.target.value)}   placeholder="Title" />
              <input className={`${input} w-full`} value={artist}  onChange={e => setArtist(e.target.value)}  placeholder="Artist" />
              <input className={`${input} w-full`} value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="Tags (comma separated)" />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
              {song.artist && <p className="text-xs text-muted-foreground truncate">{song.artist}</p>}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {tags.map(t => <TagBadge key={t} tag={t} />)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="text-green-500 hover:text-green-400 disabled:opacity-50">
                <Check size={14} />
              </button>
              <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
                <Pencil size={14} />
              </button>
              <button onClick={handleDelete} disabled={deleting} className="text-muted-foreground hover:text-red-500 disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {song.status === 'downloading' && (
        <div className="flex flex-col gap-1.5">
          <ProgressBar
            label="Downloading"
            color="bg-blue-500"
            percent={percent?.phase === 'convert' ? 100 : (percent?.percent ?? 0)}
            active={percent?.phase !== 'convert'}
          />
          <ProgressBar
            label="Converting"
            color="bg-amber-500"
            percent={percent?.phase === 'convert' ? (percent?.percent ?? 0) : 0}
            active={percent?.phase === 'convert'}
          />
        </div>
      )}
      {song.status === 'done' && song.filename && (
        <AudioPlayer filename={song.filename} />
      )}
      {song.status === 'error' && (
        <p className="text-xs text-red-500">Download failed.</p>
      )}
    </div>
  );
}

export function MusicTab() {
  const [songs,     setSongs]    = useState([]);
  const [progress,  setProgress] = useState({});
  const [urlInput,  setUrlInput] = useState('');
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState(null);
  const [search,    setSearch]   = useState('');
  const [tagFilter, setTagFilter] = useState('');
  useEffect(() => {
    fetchSongs().then(setSongs);
  }, []);

  useWebSocket(msg => {
    if (msg.type === 'song_progress') {
      setProgress(prev => ({ ...prev, [msg.id]: { phase: msg.phase, percent: msg.percent } }));
    }
    if (msg.type === 'song_updated') {
      setSongs(prev => prev.map(s => s.id === msg.song.id ? msg.song : s));
      setProgress(prev => { const n = { ...prev }; delete n[msg.song.id]; return n; });
    }
  });

  async function handleDownload() {
    if (!urlInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const song = await downloadSong(urlInput.trim());
      setSongs(prev => [song, ...prev]);
      setUrlInput('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const allTags = [...new Set(songs.flatMap(s => JSON.parse(s.tags || '[]')))].sort();

  const filtered = songs.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.artist.toLowerCase().includes(q)) return false;
    }
    if (tagFilter) {
      const tags = JSON.parse(s.tags || '[]');
      if (!tags.includes(tagFilter)) return false;
    }
    return true;
  });

  function handleUpdated(updated) {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function handleDeleted(id) {
    setSongs(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          className={input + ' flex-1'}
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDownload()}
          placeholder="YouTube URL"
          disabled={loading}
        />
        <Button size="sm" onClick={handleDownload} disabled={loading || !urlInput.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Download'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          className={input + ' flex-1'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or artist…"
        />
        {allTags.length > 0 && (
          <select
            className={`${input} w-auto`}
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {songs.length === 0 ? 'No songs yet.' : 'No songs match the filter.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(song => (
          <SongRow
            key={song.id}
            song={song}
            percent={progress[song.id]}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
