import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ActionTab } from './components/ActionTab.jsx';
import { MusicTab }  from './components/MusicTab.jsx';
import { CharacterTab } from './components/CharacterTab.jsx';
import { NowPlaying } from './components/NowPlaying.jsx';
import { AudioProvider, useAudio } from './context/AudioContext.jsx';
import { PersonalAudioProvider } from './context/PersonalAudioContext.jsx';
import { PersonalNowPlaying } from './components/PersonalNowPlaying.jsx';
import { PlaylistImportBar } from './components/PlaylistImportBar.jsx';
import { inputBase } from './lib/utils.js';
import { useAuth } from './context/AuthContext.jsx';
import { useRoom } from './context/RoomContext.jsx';
import { RoomProvider } from './context/RoomContext.jsx';
import { LoginPage } from './components/LoginPage.jsx';
import { OnboardingDialog } from './components/OnboardingDialog.jsx';
import { RoomGate } from './components/RoomGate.jsx';
import { RoomSettings } from './components/RoomSettings.jsx';
import { User, Music, Bookmark, Settings } from 'lucide-react';
import { RollPanel } from './components/RollPanel.jsx';

const input = inputBase;

const NAV_ITEMS = [
  { id: 'character', Icon: User,     title: 'Character' },
  { id: 'music',     Icon: Music,    title: 'Music'     },
  { id: 'talismans', Icon: Bookmark, title: 'Talismans' },
];

function ActionTabWrapper() {
  const { drawerOpen } = useAudio();
  return <ActionTab drawerOpen={drawerOpen ?? false} />;
}

function AppContent() {
  const { displayName, logout } = useAuth();
  const { currentRoom, userRooms, roomsLoaded, switchRoom, joinRoom } = useRoom();
  const [tab,          setTab]          = useState('talismans');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newRoomOpen,  setNewRoomOpen]  = useState(false);

  useEffect(() => {
    if (!roomsLoaded) return;
    const code = new URLSearchParams(window.location.search).get('join');
    if (!code) return;
    joinRoom(code).then(() => window.history.replaceState({}, '', '/'));
  }, [roomsLoaded]);

  if (!roomsLoaded || (!currentRoom && userRooms.length > 0)) return null;
  if (!currentRoom) return <RoomGate />;

  return (
    <AudioProvider>
    <PersonalAudioProvider>
    <div className="h-screen flex bg-background text-foreground">

      {/* VS Code-style activity bar */}
      <div className="w-12 shrink-0 border-r border-border flex flex-col items-center pt-2 gap-1">
        {NAV_ITEMS.map(({ id, Icon, title }) => (
          <button
            key={id}
            title={title}
            onClick={() => setTab(id)}
            className={`w-full flex items-center justify-center py-3 transition-colors relative ${
              tab === id
                ? 'text-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            <Icon size={20} />
          </button>
        ))}

        <div className="mt-auto flex flex-col items-center gap-1 pb-2">
          <button
            onClick={() => setSettingsOpen(true)}
            title="Room settings"
            className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="shrink-0 z-20 border-b border-border bg-background px-4 py-2 flex items-center gap-3">
          <select
            value={currentRoom.id}
            onChange={e => {
              if (e.target.value === '__create__') { setNewRoomOpen(true); return; }
              const room = userRooms.find(r => r.id === e.target.value);
              if (room) switchRoom(room);
            }}
            className={`${input} px-2 py-1 text-xs`}>
            <option value="__create__">+ Create or join a room</option>
            {userRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-3">
            {displayName && <span className="text-sm">Welcome, <span className="font-semibold">{displayName}</span></span>}
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-95 transition-all shadow-lg">Sign out</button>
          </div>
        </header>

        {/* Content + Roll Panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <main className="flex-1 overflow-auto p-6 min-h-0">
            {tab === 'character' && <CharacterTab />}
            {tab === 'music'     && <MusicTab />}
            {tab === 'talismans' && <ActionTabWrapper />}
          </main>
          <RollPanel />
        </div>

        <NowPlaying />
        <PersonalNowPlaying />
        <PlaylistImportBar />
      </div>
    </div>

    <RoomSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    <Dialog open={newRoomOpen} onOpenChange={v => !v && setNewRoomOpen(false)}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <RoomGate embedded onDone={() => setNewRoomOpen(false)} />
      </DialogContent>
    </Dialog>
    </PersonalAudioProvider>
    </AudioProvider>
  );
}

export default function App() {
  const { user, loading, needsOnboarding } = useAuth();

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-white">SERAPH</h1>
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );
  if (!user)          return <LoginPage />;
  if (needsOnboarding) return <OnboardingDialog />;

  return (
    <RoomProvider>
      <AppContent />
    </RoomProvider>
  );
}
