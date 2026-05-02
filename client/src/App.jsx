import { useEffect, useState } from 'react';
import { fetchSite, fetchExorcists, fetchMissions } from './api.js';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ExorcistGrid } from './components/ExorcistGrid.jsx';
import { ExorcistDetail } from './components/ExorcistDetail.jsx';
import { ExorcistForm } from './components/ExorcistForm.jsx';
import { MissionGrid } from './components/MissionGrid.jsx';
import { MissionDetail } from './components/MissionDetail.jsx';
import { ActionTab } from './components/ActionTab.jsx';
import { MusicTab }  from './components/MusicTab.jsx';
import { NowPlaying } from './components/NowPlaying.jsx';
import { AudioProvider, useAudio } from './context/AudioContext.jsx';
import { PersonalAudioProvider } from './context/PersonalAudioContext.jsx';
import { PersonalNowPlaying } from './components/PersonalNowPlaying.jsx';
import { PlaylistImportBar } from './components/PlaylistImportBar.jsx';
import { Button } from '@/components/ui/button';
import { isLocal } from './lib/utils.js';

function ActionTabWrapper() {
  const { drawerOpen } = useAudio();
  return <ActionTab drawerOpen={drawerOpen ?? false} />;
}

export default function App() {
  const [site,      setSite]      = useState(null);
  const [exorcists, setExorcists] = useState([]);
  const [missions,  setMissions]  = useState([]);
  const [tab,       setTab]       = useState('action');
  const [panel,     setPanel]     = useState(null); // { type, id }
  const [formOpen,  setFormOpen]  = useState(false);

  useEffect(() => {
    fetchSite().then(setSite);
    fetchExorcists().then(setExorcists);
    fetchMissions().then(setMissions);
  }, []);

  useEffect(() => {
    if (site) document.title = site.name;
  }, [site]);

  const openPanel  = (type, id) => setPanel({ type, id });
  const closePanel = () => setPanel(null);

  return (
    <AudioProvider>
    <PersonalAudioProvider>
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0 z-20 border-b border-border bg-background px-6 py-3 flex items-center gap-6">
        <h1 className="text-sm font-semibold whitespace-nowrap">
          {site?.name ?? '…'}
          {site && <span className="text-muted-foreground text-xs ml-1.5">[{site.site_id}]</span>}
        </h1>
        <Tabs value={tab} onValueChange={t => { setTab(t); closePanel(); }}>
          <TabsList>
            {isLocal && <TabsTrigger value="exorcists">Exorcists</TabsTrigger>}
            {isLocal && <TabsTrigger value="missions">Missions</TabsTrigger>}
            <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="action">Take action!</TabsTrigger>
          </TabsList>
        </Tabs>
        {isLocal && tab === 'exorcists' && (
          <Button size="sm" className="ml-auto" onClick={() => setFormOpen(true)}>+ New</Button>
        )}

      </header>

      <main className="flex-1 overflow-auto p-6 min-h-0">
        {tab === 'exorcists' && (
          <ExorcistGrid
            exorcists={exorcists}
            selectedId={panel?.type === 'exorcist' ? panel.id : null}
            onSelect={id => openPanel('exorcist', id)}
          />
        )}
        {tab === 'missions' && (
          <MissionGrid
            missions={missions}
            selectedId={panel?.type === 'mission' ? panel.id : null}
            onSelect={id => openPanel('mission', id)}
          />
        )}
        {tab === 'music' && <MusicTab />}
        {tab === 'action' && <ActionTabWrapper />}
      </main>

      <Dialog open={panel !== null} onOpenChange={open => !open && closePanel()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {panel?.type === 'exorcist' && <ExorcistDetail id={panel.id} onDeleted={id => { setExorcists(prev => prev.filter(e => e.id !== id)); closePanel(); }} />}
          {panel?.type === 'mission'  && <MissionDetail  id={panel.id} />}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={open => !open && setFormOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {formOpen && (
            <ExorcistForm
              onCreated={exo => {
                setExorcists(prev => [exo, ...prev]);
                setFormOpen(false);
                openPanel('exorcist', exo.id);
              }}
              onClose={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      <NowPlaying />
      <PersonalNowPlaying />
      <PlaylistImportBar />
    </div>
    </PersonalAudioProvider>
    </AudioProvider>
  );
}
