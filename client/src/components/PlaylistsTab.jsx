import { useState, useEffect } from 'react';
import { useRoom } from '../context/RoomContext.jsx';
import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { fetchRoomPlaylists, fetchRoomSongs, createRoomPlaylist, deleteRoomPlaylist } from '../api.js';
import { PlaylistEditorDialog } from './PlaylistEditorDialog.jsx';
import { ListMusic, Play, Pause, Plus, Trash2 } from 'lucide-react';

export function PlaylistsTab() {
  const { currentRoom } = useRoom();
  const { playPlaylist, stop, localPlaylist, localSong, isPlaying, togglePlay } = usePersonalAudio();
  const [playlists, setPlaylists] = useState([]);
  const [songs,     setSongs]     = useState([]);
  const [editing,   setEditing]   = useState(null);

  function resolvedSongs(pl) {
    return (pl.songs ?? []).map(id => songs.find(s => s.id === id)).filter(Boolean);
  }

  function isActive(pl) {
    return localPlaylist.length > 0 && localSong &&
      (pl.songs ?? []).includes(localSong.id) &&
      localPlaylist.length === (pl.songs ?? []).length;
  }

  function handlePlay(e, pl) {
    e.stopPropagation();
    if (isActive(pl)) { togglePlay(); return; }
    const resolved = resolvedSongs(pl);
    if (resolved.length) playPlaylist(resolved, 0, pl.name);
  }

  useEffect(() => {
    if (!currentRoom?.id) return;
    fetchRoomPlaylists(currentRoom.id).then(setPlaylists);
    fetchRoomSongs(currentRoom.id).then(ss => setSongs(ss.filter(s => s.status === 'done')));
  }, [currentRoom?.id]);

  async function handleCreate() {
    const pl = await createRoomPlaylist(currentRoom.id, { name: 'New Playlist' });
    setPlaylists(prev => [...prev, pl]);
    setEditing(pl);
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    await deleteRoomPlaylist(currentRoom.id, id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  function handleUpdate(updated) {
    setPlaylists(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditing(updated);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Playlists</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm hover:opacity-90 active:scale-95 transition-all">
          <Plus size={14} />
          New playlist
        </button>
      </div>

      {playlists.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">
          No playlists yet. Create one to get started.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {playlists.map(pl => (
          <div
            key={pl.id}
            onClick={() => setEditing(pl)}
            className="flex items-center gap-3 px-4 py-3 border border-border hover:border-foreground/40 cursor-pointer group transition-colors">
            <ListMusic size={16} className="text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium truncate">{pl.name}</p>
              <p className="text-sm text-muted-foreground">
                {(pl.songs ?? []).length} song{(pl.songs ?? []).length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={e => handlePlay(e, pl)}
              className={`p-2 transition-colors shrink-0 ${isActive(pl) ? 'text-primary' : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'}`}>
              {isActive(pl) && isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              onClick={e => handleDelete(e, pl.id)}
              className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <PlaylistEditorDialog
          open
          onClose={() => setEditing(null)}
          playlist={editing}
          songs={songs}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
