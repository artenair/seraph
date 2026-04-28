import { useEffect, useRef, useCallback } from 'react';
import { wsUrl } from './utils.js';

export function useWebSocket(onMessage) {
  const wsRef       = useRef(null);
  const callbackRef = useRef(onMessage);

  useEffect(() => { callbackRef.current = onMessage; });

  useEffect(() => {
    let ws, reconnect;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = e => {
        try { callbackRef.current(JSON.parse(e.data)); } catch {}
      };
      ws.onclose = () => { reconnect = setTimeout(connect, 2000); };
    }
    connect();
    return () => { clearTimeout(reconnect); ws?.close(); };
  }, []);

  return useCallback((payload) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(JSON.stringify(payload));
  }, []);
}
