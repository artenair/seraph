import { useState, useEffect } from 'react';

const DB_NAME  = 'seraph-local';
const STORE    = 'kv';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

function dbGet(key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

function dbPut(key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
    req.onsuccess = () => {
      window.dispatchEvent(new CustomEvent('localstore:update', { detail: { key, value } }));
      resolve();
    };
    req.onerror = e => reject(e.target.error);
  }));
}

export function useLocalStore(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    dbGet(key).then(v => { if (v !== undefined) setValue(v); });
  }, [key]);

  useEffect(() => {
    function handler(e) {
      if (e.detail.key === key) setValue(e.detail.value);
    }
    window.addEventListener('localstore:update', handler);
    return () => window.removeEventListener('localstore:update', handler);
  }, [key]);

  function set(newValue) {
    setValue(newValue);
    dbPut(key, newValue);
  }

  return [value, set];
}
