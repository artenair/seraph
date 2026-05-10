import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useRoom } from '../context/RoomContext.jsx';

const STORAGE_KEY = 'seraph:online-users-panel';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function OnlineUsers({ onClose }) {
  const { presenceList } = useRoom();
  const saved            = load();

  const [pos,       setPos]       = useState({ x: saved.x ?? 80, y: saved.y ?? 80 });
  const [collapsed, setCollapsed] = useState(saved.collapsed ?? false);
  const dragging = useRef(null);
  const panelRef = useRef(null);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    save({ ...load(), collapsed: next });
  };

  const onMouseDown = useCallback(e => {
    if (e.target.closest('button')) return;
    dragging.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return;
      const x = e.clientX - dragging.current.startX;
      const y = e.clientY - dragging.current.startY;
      setPos({ x, y });
      save({ ...load(), x, y });
    }
    function onMouseUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-56 bg-background border border-border shadow-xl select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground flex-1">
          Online · {presenceList.length}
        </span>
        <button onClick={toggleCollapse} className="text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* User list */}
      {!collapsed && (
        <div className="flex flex-col py-1 max-h-64 overflow-y-auto">
          {presenceList.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">No one online</p>
          )}
          {presenceList.map(u => (
            <div key={u.uid} className="flex items-center gap-2.5 px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-sm truncate text-foreground">{u.displayName || 'Unknown'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
