const get  = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
const post = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json().then(d => r.ok ? d : Promise.reject(new Error(d.error ?? r.statusText))));
const patch = (url, body) => fetch(url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json().then(d => r.ok ? d : Promise.reject(new Error(d.error ?? r.statusText))));

export const fetchSite        = ()     => get('/api/site');
export const fetchExorcists   = ()     => get('/api/exorcists');
export const fetchMissions    = ()     => get('/api/missions');
export const fetchExorcist    = id     => get(`/api/exorcists/${encodeURIComponent(id)}`);
export const fetchMission     = id     => get(`/api/missions/${encodeURIComponent(id)}`);
export const fetchBlasphemies = ()     => get('/api/blasphemies');
export const fetchAgendas     = ()     => get('/api/agendas');
export const createExorcist   = body   => post('/api/exorcists', body);
export const deleteExorcist   = id     => fetch(`/api/exorcists/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const fetchAudioZones  = ()        => get('/api/audio-zones');
export const createAudioZone  = body      => post('/api/audio-zones', body);
export const updateAudioZone  = (id, body) => patch(`/api/audio-zones/${id}`, body);
export const deleteAudioZone  = id        => fetch(`/api/audio-zones/${id}`, { method: 'DELETE' });

export const fetchSongs       = ()              => get('/api/music');
export const addSong          = url             => post('/api/music', { url });
export const submitSong       = (url, message)  => post('/api/music', { url, message });
export const approveSong      = id              => post(`/api/music/${id}/approve`, {});
export const updateSong       = (id, body)      => patch(`/api/music/${id}`, body);
export const deleteSong       = id              => fetch(`/api/music/${id}`, { method: 'DELETE' });
