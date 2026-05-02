import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ActionTab } from './components/ActionTab.jsx';
import { MusicTab }  from './components/MusicTab.jsx';
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
import { Settings } from 'lucide-react';

const input = inputBase;

function ActionTabWrapper() {
  const { drawerOpen } = useAudio();
  return <ActionTab drawerOpen={drawerOpen ?? false} />;
}

function AppContent() {
  const { displayName, logout } = useAuth();
  const { currentRoom, userRooms, roomsLoaded, switchRoom, joinRoom } = useRoom();
  const [tab, setTab] = useState('action');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newRoomOpen,  setNewRoomOpen]  = useState(false);

  useEffect(() => {
    if (!roomsLoaded) return;
    const code = new URLSearchParams(window.location.search).get('join');
    if (!code) return;
    joinRoom(code).then(() => window.history.replaceState({}, '', '/'));
  }, [roomsLoaded]);

  if (!roomsLoaded) return null;
  if (!currentRoom) return <RoomGate />;

  return (
    <AudioProvider>
    <PersonalAudioProvider>
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0 z-20 border-b border-border bg-background px-6 py-3 flex items-center gap-4">
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="action">Take action!</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Room settings">
            <Settings size={16} />
          </button>
          {displayName && <span className="text-sm">Welcome, <span className="font-semibold">{displayName}</span></span>}
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-95 transition-all shadow-lg">Sign out</button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 min-h-0">
        {tab === 'music'  && <MusicTab />}
        {tab === 'action' && <ActionTabWrapper />}
      </main>

      <NowPlaying />
      <PersonalNowPlaying />
      <PlaylistImportBar />
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

  if (loading) return null;
  if (!user)   return <LoginPage />;
  if (needsOnboarding) return <OnboardingDialog />;

  return (
    <RoomProvider>
      <AppContent />
    </RoomProvider>
  );
}
