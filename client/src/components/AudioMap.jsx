import { useState, useEffect, useRef } from 'react';
import { fetchRoomZones, createRoomZone, updateRoomZone, deleteRoomZone, fetchRoomSongs, fetchRoomPlaylists } from '../api.js';
import { useAudio } from '../context/AudioContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import { getLocalStorage, inputBase } from '../lib/utils.js';
import { PlaylistEditorDialog } from './PlaylistEditorDialog.jsx';
import { Trash2, Hand, Circle, ListMusic, ChevronRight } from 'lucide-react';

const GRID_SIZE      = 40;
const DRAG_THRESHOLD = 5;
const HANDLE_HIT     = 8;
const ZONE_COLORS    = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

const input = `${inputBase} px-2 py-1.5`;

// ── Toolbar ────────────────────────────────────────────────────────────────────

function Toolbar({ mode, onModeChange }) {
  const tools = [
    { id: 'hand',   Icon: Hand,   title: 'Hand — pan the canvas' },
    { id: 'circle', Icon: Circle, title: 'Circle — draw zones'   },
  ];
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-background border border-border p-1">
      {tools.map(({ id, Icon, title }) => (
        <button
          key={id}
          title={title}
          onClick={() => onModeChange(id)}
          className={`p-2 transition-colors ${
            mode === id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

// ── Zone panel ─────────────────────────────────────────────────────────────────

function ZonePanel({ zone, color, songs, playlists, onUpdate, onUpdatePlaylist, onDelete }) {
  const { currentRoom } = useRoom();
  const [name,          setName]          = useState(zone.name);
  const [editingPlaylist, setEditingPlaylist] = useState(false);

  useEffect(() => { setName(zone.name); }, [zone.id]);

  const assignedPlaylist = playlists.find(p => p.id === zone.playlistId) ?? null;

  async function saveName() {
    if (name.trim() === zone.name) return;
    const updated = await updateRoomZone(currentRoom.id, zone.id, { name: name.trim() || zone.name });
    onUpdate(updated);
  }

  async function assignPlaylist(playlistId) {
    const updated = await updateRoomZone(currentRoom.id, zone.id, { playlistId: playlistId || null });
    onUpdate(updated);
  }

  return (
    <>
      <div className="w-64 shrink-0 border border-border flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
          <input
            className={input + ' flex-1 min-w-0'}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          />
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 shrink-0">
            <Trash2 size={13} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Playlist</p>
          <select
            className={input + ' w-full'}
            value={zone.playlistId ?? ''}
            onChange={e => assignPlaylist(e.target.value)}>
            <option value="">No playlist</option>
            {playlists.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {assignedPlaylist && (
            <button
              onClick={() => setEditingPlaylist(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start">
              <ListMusic size={11} />
              Edit content
              <ChevronRight size={11} />
            </button>
          )}
        </div>
      </div>

      {assignedPlaylist && (
        <PlaylistEditorDialog
          open={editingPlaylist}
          onClose={() => setEditingPlaylist(false)}
          playlist={assignedPlaylist}
          songs={songs}
          onUpdate={onUpdatePlaylist}
        />
      )}
    </>
  );
}

// ── Listener pin image ─────────────────────────────────────────────────────────

const pinImgCache = {};
function getPinImage(color) {
  if (pinImgCache[color]) return pinImgCache[color];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#0a0a0a"/></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  pinImgCache[color] = img;
  return img;
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────

function drawCanvas(canvas, zones, selectedId, hoveredId, pan, zoom, size, listener, hoveredListener, activeZoneId, playlists) {
  const { w, h } = size;
  if (w === 0 || h === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  // Tiling grid in world space
  const minX = Math.floor(-pan.x / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
  const minY = Math.floor(-pan.y / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
  const maxX = minX + w / zoom + GRID_SIZE * 2;
  const maxY = minY + h / zoom + GRID_SIZE * 2;

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1 / zoom;
  for (let x = minX; x <= maxX; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
  }
  for (let y = minY; y <= maxY; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
  }

  // Zones
  zones.forEach((zone, i) => {
    const color      = ZONE_COLORS[i % ZONE_COLORS.length];
    const isSelected = zone.id === selectedId;
    const isHovered  = zone.id === hoveredId && !isSelected;
    const isActive   = zone.id === activeZoneId;

    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fillStyle = color + (isSelected ? '55' : isActive ? '48' : isHovered ? '42' : '30');
    ctx.fill();
    ctx.strokeStyle = isSelected ? color : isActive ? color + 'ff' : isHovered ? color + 'dd' : color + 'aa';
    ctx.lineWidth = (isSelected || isActive ? 2 : 1) / zoom;
    ctx.setLineDash(isSelected || isActive ? [] : [4 / zoom, 3 / zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    const namePx    = Math.max(18, Math.min(36, 15 * zoom)) / zoom;
    const trackPx   = Math.max(16, Math.min(32, 13 * zoom)) / zoom;
    ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#eeeeee' : '#cccccc';
    ctx.font = `${isSelected ? 600 : 400} ${namePx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.name, zone.x, zone.y);

    const playlist = zone.playlistId
      ? (playlists?.find(p => p.id === zone.playlistId)?.songs ?? [])
      : (Array.isArray(zone.playlist) ? zone.playlist : []);
    if (playlist.length > 0) {
      ctx.font = `${trackPx}px sans-serif`;
      ctx.fillStyle = color;
      const label = isActive
        ? `♪ ${playlist.length} track${playlist.length !== 1 ? 's' : ''}`
        : `${playlist.length} track${playlist.length !== 1 ? 's' : ''}`;
      ctx.fillText(label, zone.x, zone.y + (namePx + 4));
    }

    if (isSelected) {
      const hs = 4 / zoom;
      ctx.fillStyle = color;
      ctx.fillRect(zone.x + zone.radius - hs, zone.y - hs, hs * 2, hs * 2);
    }
  });

  // Listener
  if (listener) {
    const size2  = 32 / zoom;
    const hov    = hoveredListener;
    const px     = listener.x;
    const py     = listener.y;
    const color  = hov ? '#ffffff' : '#e2e8f0';
    const img    = getPinImage(color);

    ctx.save();
    ctx.shadowColor = '#ffffff44';
    ctx.shadowBlur  = hov ? 14 / zoom : 4 / zoom;
    ctx.drawImage(img, px - size2 / 2, py - size2, size2, size2);
    ctx.restore();

    const labelPx = Math.max(11, Math.min(26, 10 * zoom)) / zoom;
    ctx.font      = `600 ${labelPx}px sans-serif`;
    ctx.fillStyle = hov ? '#ffffff' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Listener', px, py - size2 - 2 / zoom);
  }

  ctx.restore(); // pop pan+zoom
  ctx.restore(); // pop dpr scale
}

// ── AudioMap ───────────────────────────────────────────────────────────────────

export function AudioMap() {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [zones,     setZones]     = useState([]);
  const [songs,     setSongs]     = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [mode,       setMode]       = useState('hand');
  const [pan,        setPan]        = useState(() => getLocalStorage('audiomap-pan', { x: 0, y: 0 }));
  const [size,       setSize]       = useState({ w: 0, h: 0 });
  const [selectedId,  setSelectedId]  = useState(null);
  const [hoveredId,   setHoveredId]   = useState(null);
  const [hoverHandle,    setHoverHandle]    = useState(false);
  const [zoom,           setZoom]           = useState(() => getLocalStorage('audiomap-zoom', 1));
  const [listener,       setListener]       = useState(() => getLocalStorage('audiomap-listener', { x: 200, y: 150 }));
  const [hoverListener,  setHoverListener]  = useState(false);
  const { playZone, stopAudio, activeZoneId } = useAudio();
  const { currentRoom } = useRoom();
  const zonesRef       = useRef([]);
  const songsRef       = useRef([]);
  const playlistsRef   = useRef([]);
  const panRef         = useRef({ x: 0, y: 0 });
  const zoomRef        = useRef(1);
  const listenerRef    = useRef(listener);
  const sizeRef        = useRef({ w: 0, h: 0 });
  const dragState      = useRef(null);
  const activeZoneRef  = useRef(null);

  useEffect(() => { zonesRef.current = zones; }, [zones]);
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);
  useEffect(() => { panRef.current = pan; localStorage.setItem('audiomap-pan', JSON.stringify(pan)); }, [pan]);
  useEffect(() => { zoomRef.current = zoom; localStorage.setItem('audiomap-zoom', JSON.stringify(zoom)); }, [zoom]);
  useEffect(() => { listenerRef.current = listener; localStorage.setItem('audiomap-listener', JSON.stringify(listener)); }, [listener]);

  // Resize observer — keeps canvas buffer = CSS size × DPR
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w   = container.clientWidth;
      const h   = container.clientHeight;
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      sizeRef.current = { w, h };
      setSize({ w, h });
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!currentRoom?.id) return;
    fetchRoomZones(currentRoom.id).then(setZones);
    fetchRoomSongs(currentRoom.id).then(ss => setSongs(ss.filter(s => s.status === 'done')));
    fetchRoomPlaylists(currentRoom.id).then(setPlaylists);
  }, [currentRoom?.id]);

  useEffect(() => {
    if (canvasRef.current) drawCanvas(canvasRef.current, zones, selectedId, hoveredId, pan, zoom, size, listener, hoverListener, activeZoneId, playlists);
  }, [zones, playlists, selectedId, hoveredId, pan, zoom, size, listener, hoverListener, activeZoneId]);

  // Detect zone under listener and delegate playback to context
  useEffect(() => {
    const l  = listener;
    const zs = zonesRef.current;
    let foundId = null;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      const dx = l.x - z.x, dy = l.y - z.y;
      if (Math.sqrt(dx * dx + dy * dy) <= z.radius) { foundId = z.id; break; }
    }
    if (foundId === activeZoneRef.current) return;
    activeZoneRef.current = foundId;
    if (foundId) {
      const zone = zonesRef.current.find(z => z.id === foundId);
      if (zone) {
        let resolved = zone;
        if (zone.playlistId) {
          const pl = playlistsRef.current.find(p => p.id === zone.playlistId);
          if (pl) resolved = { ...zone, playlist: pl.songs ?? [] };
        }
        playZone(resolved, songsRef.current);
      }
    } else {
      stopAudio();
    }
  }, [listener]);

  // Non-passive wheel listener so preventDefault works
  useEffect(() => {
    const canvas = canvasRef.current;
    function onWheel(e) {
      e.preventDefault();
      const sp      = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };
      const factor  = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(0.1, Math.min(10, oldZoom * factor));
      const worldX  = (sp.x - panRef.current.x) / oldZoom;
      const worldY  = (sp.y - panRef.current.y) / oldZoom;
      const newPan  = { x: sp.x - worldX * newZoom, y: sp.y - worldY * newZoom };
      zoomRef.current  = newZoom;
      panRef.current   = newPan;
      setZoom(newZoom);
      setPan(newPan);
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // CSS pixel coords (no pan, no DPR — logical = CSS pixel)
  function getScreenPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // World-space coords (pan + zoom applied)
  function getPos(e) {
    const sp = getScreenPos(e);
    return {
      x: (sp.x - panRef.current.x) / zoomRef.current,
      y: (sp.y - panRef.current.y) / zoomRef.current,
    };
  }

  function hitZone(pos) {
    const zs = zonesRef.current;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z  = zs[i];
      const dx = pos.x - z.x;
      const dy = pos.y - z.y;
      if (Math.sqrt(dx * dx + dy * dy) <= z.radius) return z.id;
    }
    return null;
  }

  function hitListener(pos) {
    const l = listenerRef.current;
    if (!l) return false;
    const size2 = 32 / zoomRef.current;
    const dx = pos.x - l.x;
    const dy = pos.y - l.y;
    // cover tip at (0,0) and pin body above it
    return dx >= -size2 / 2 && dx <= size2 / 2 && dy >= -size2 && dy <= 4 / zoomRef.current;
  }

  function hitHandle(pos) {
    if (selectedId === null) return false;
    const zone = zonesRef.current.find(z => z.id === selectedId);
    if (!zone) return false;
    const dx = pos.x - (zone.x + zone.radius);
    const dy = pos.y - zone.y;
    return Math.sqrt(dx * dx + dy * dy) <= HANDLE_HIT / zoomRef.current;
  }

  function handleMouseDown(e) {
    const pos = getPos(e);

    if (hitListener(pos)) {
      const l = listenerRef.current;
      dragState.current = {
        type: 'listener',
        offsetX: pos.x - l.x, offsetY: pos.y - l.y,
        isDragging: false, startX: pos.x, startY: pos.y,
      };
      return;
    }

    if (mode === 'hand') {
      const sp  = getScreenPos(e);
      dragState.current = {
        type: 'pan',
        startSX: sp.x, startSY: sp.y,
        startPX: panRef.current.x, startPY: panRef.current.y,
        zoneId: hitZone(pos),
        isDragging: false,
      };
      return;
    }

    if (hitHandle(pos)) {
      dragState.current = { type: 'resize', zoneId: selectedId, startX: pos.x, startY: pos.y, isDragging: false };
      return;
    }

    const hitId = hitZone(pos);
    const zone  = hitId !== null ? zonesRef.current.find(z => z.id === hitId) : null;
    dragState.current = {
      type:    'move',
      zoneId:  hitId,
      startX:  pos.x, startY: pos.y,
      offsetX: zone ? pos.x - zone.x : 0,
      offsetY: zone ? pos.y - zone.y : 0,
      isDragging: false,
    };
  }

  function handleMouseMove(e) {
    const ds = dragState.current;

    if (ds?.type === 'pan') {
      const sp  = getScreenPos(e);
      const ddx = sp.x - ds.startSX;
      const ddy = sp.y - ds.startSY;
      if (!ds.isDragging && Math.sqrt(ddx * ddx + ddy * ddy) > DRAG_THRESHOLD) ds.isDragging = true;
      const nx = ds.startPX + ddx;
      const ny = ds.startPY + ddy;
      panRef.current = { x: nx, y: ny };
      setPan({ x: nx, y: ny });
      return;
    }

    const pos = getPos(e);

    if (!ds) {
      const onListener = hitListener(pos);
      setHoverListener(onListener);
      const onHandle = !onListener && hitHandle(pos);
      setHoverHandle(onHandle);
      setHoveredId(onListener || onHandle ? null : hitZone(pos));
      return;
    }

    if (ds.type === 'listener') {
      if (!ds.isDragging) {
        const dx = pos.x - ds.startX, dy = pos.y - ds.startY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) ds.isDragging = true;
      }
      if (ds.isDragging) setListener({ x: pos.x - ds.offsetX, y: pos.y - ds.offsetY });
      return;
    }

    if (!ds.isDragging) {
      const dx = pos.x - ds.startX;
      const dy = pos.y - ds.startY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) ds.isDragging = true;
    }

    if (!ds.isDragging) return;

    if (ds.type === 'resize') {
      const zone = zonesRef.current.find(z => z.id === ds.zoneId);
      if (!zone) return;
      const dx = pos.x - zone.x;
      const dy = pos.y - zone.y;
      setZones(prev => prev.map(z => z.id === ds.zoneId
        ? { ...z, radius: Math.max(20, Math.sqrt(dx * dx + dy * dy)) }
        : z
      ));
    } else {
      setZones(prev => prev.map(z => z.id === ds.zoneId
        ? { ...z, x: pos.x - ds.offsetX, y: pos.y - ds.offsetY }
        : z
      ));
    }
  }

  async function handleMouseUp(e) {
    const ds  = dragState.current;
    const pos = getPos(e);
    dragState.current = null;
    setHoverHandle(false);

    if (!ds) return;

    if (ds.type === 'listener') return;

    if (ds.type === 'pan') {
      if (!ds.isDragging) {
        if (ds.zoneId !== null) setSelectedId(prev => prev === ds.zoneId ? null : ds.zoneId);
        else setSelectedId(null);
      }
      return;
    }

    if (ds.isDragging) {
      const zone = zonesRef.current.find(z => z.id === ds.zoneId);
      if (!zone) return;
      if (ds.type === 'resize') {
        await updateRoomZone(currentRoom.id, zone.id, { radius: zone.radius });
      } else {
        await updateRoomZone(currentRoom.id, zone.id, { x: zone.x, y: zone.y });
      }
    } else if (ds.type === 'move') {
      if (ds.zoneId !== null) {
        setSelectedId(prev => prev === ds.zoneId ? null : ds.zoneId);
      } else if (mode === 'circle') {
        const zone = await createRoomZone(currentRoom.id, {
          name: `Zone ${zonesRef.current.length + 1}`,
          x: pos.x, y: pos.y, radius: 60,
        });
        setZones(prev => [...prev, zone]);
        setSelectedId(zone.id);
      }
    }
  }

  function handleMouseLeave() {
    setHoveredId(null);
    setHoverHandle(false);
    setHoverListener(false);
  }

  const selectedZone  = zones.find(z => z.id === selectedId) ?? null;
  const selectedIndex = zones.findIndex(z => z.id === selectedId);
  const selectedColor = selectedIndex >= 0 ? ZONE_COLORS[selectedIndex % ZONE_COLORS.length] : null;

  const ds = dragState.current;
  const cursor = ds?.type === 'listener'
    ? 'grabbing'
    : hoverListener
      ? 'grab'
      : mode === 'hand'
        ? (ds?.type === 'pan' ? 'grabbing' : 'grab')
        : hoverHandle || ds?.type === 'resize'
          ? 'ew-resize'
          : ds?.isDragging
            ? 'grabbing'
            : hoveredId
              ? 'grab'
              : 'crosshair';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex gap-3 flex-1 min-h-0">
        <div ref={containerRef} className="flex-1 min-w-0">
          <canvas
            ref={canvasRef}
            className="border border-border block"
            style={{ cursor }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>
        {selectedZone && (
          <ZonePanel
            zone={selectedZone}
            color={selectedColor}
            songs={songs}
            playlists={playlists}
            onUpdate={updated => setZones(prev => prev.map(z => z.id === updated.id ? updated : z))}
            onUpdatePlaylist={updated => setPlaylists(prev => prev.map(p => p.id === updated.id ? updated : p))}
            onDelete={async () => {
              await deleteRoomZone(currentRoom.id, selectedZone.id);
              setZones(prev => prev.filter(z => z.id !== selectedZone.id));
              setSelectedId(null);
            }}
          />
        )}
      </div>
      <Toolbar mode={mode} onModeChange={setMode} />
    </div>
  );
}
