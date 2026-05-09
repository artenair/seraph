import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc,
  onSnapshot, query, where, serverTimestamp, arrayUnion, arrayRemove, updateDoc,
} from 'firebase/firestore';
import { db, rtdb } from '@/lib/firebase.js';
import { ref, set, remove, onValue, onDisconnect } from 'firebase/database';
import { useAuth } from './AuthContext.jsx';

const RoomContext = createContext(null);

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function RoomProvider({ children }) {
  const { user, displayName } = useAuth();

  const [currentRoom,   setCurrentRoom]   = useState(null);
  const [userRoles,     setUserRoles]     = useState([]);
  const [userRooms,     setUserRooms]     = useState([]);
  const [members,       setMembers]       = useState([]);
  const [presenceList,  setPresenceList]  = useState([]);
  const [roomsLoaded,   setRoomsLoaded]   = useState(false);

  // Subscribe to user's room list
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'rooms'),
      snap => {
        const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUserRooms(rooms);
        setRoomsLoaded(true);
      }
    );
    return unsubscribe;
  }, [user]);

  // Auto-select room from localStorage once rooms are loaded
  useEffect(() => {
    if (!roomsLoaded) return;
    setCurrentRoom(prev => { if (prev) return prev; return null; }); // no-op guard

    const lastId   = localStorage.getItem('lastRoomId');
    const targetId = lastId && userRooms.find(r => r.id === lastId)
      ? lastId
      : userRooms.length === 1 ? userRooms[0].id : null;

    if (!targetId) return;

    getDoc(doc(db, 'rooms', targetId)).then(snap => {
      if (snap.exists()) {
        setCurrentRoom(prev => prev ? prev : { id: snap.id, ...snap.data() });
        localStorage.setItem('lastRoomId', snap.id);
      }
    });
  }, [roomsLoaded, userRooms]);

  // Subscribe to current room's members
  useEffect(() => {
    if (!currentRoom?.id || !user) {
      setMembers([]);
      setUserRoles([]);
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, 'rooms', currentRoom.id, 'members'),
      snap => {
        const list = snap.docs.map(d => ({ userId: d.id, ...d.data() }));
        setMembers(list);
        const me = list.find(m => m.userId === user.uid);
        setUserRoles(me?.roles ?? []);
      }
    );
    return unsubscribe;
  }, [currentRoom?.id, user?.uid]);

  // RTDB presence
  useEffect(() => {
    if (!currentRoom?.id || !user) { setPresenceList([]); return; }

    const presenceRef  = ref(rtdb, `rooms/${currentRoom.id}/presence/${user.uid}`);
    const allRef       = ref(rtdb, `rooms/${currentRoom.id}/presence`);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubConnected = onValue(connectedRef, snapshot => {
      if (!snapshot.val()) return;
      onDisconnect(presenceRef).remove();
      set(presenceRef, { displayName: displayName ?? '', joinedAt: Date.now() });
    });

    const unsubPresence = onValue(allRef, snapshot => {
      const val = snapshot.val() ?? {};
      setPresenceList(Object.entries(val).map(([uid, data]) => ({ uid, ...data })));
    });

    return () => {
      unsubConnected();
      unsubPresence();
      remove(presenceRef);
    };
  }, [currentRoom?.id, user?.uid]);

  function selectRoom(room) {
    setCurrentRoom(room);
    localStorage.setItem('lastRoomId', room.id);
  }

  async function createRoom(name) {
    const inviteCode = generateCode();
    const roomRef    = doc(collection(db, 'rooms'));
    const now        = serverTimestamp();

    await setDoc(roomRef, { name, inviteCode, ownerId: user.uid, createdAt: now });
    await setDoc(doc(db, 'rooms', roomRef.id, 'members', user.uid), {
      roles: ['Admin', 'DJ'], displayName: displayName ?? '', joinedAt: now,
    });
    await setDoc(doc(db, 'users', user.uid, 'rooms', roomRef.id), {
      name, inviteCode, ownerId: user.uid, joinedAt: now,
    });

    const room = { id: roomRef.id, name, inviteCode, ownerId: user.uid };
    selectRoom(room);
    return room;
  }

  async function joinRoom(code) {
    const trimmed = code.trim().toUpperCase();
    const snap    = await getDocs(query(collection(db, 'rooms'), where('inviteCode', '==', trimmed)));

    if (snap.empty) throw new Error('Room not found. Check the invite code and try again.');

    const roomDoc = snap.docs[0];
    const room    = { id: roomDoc.id, ...roomDoc.data() };

    const memberRef  = doc(db, 'rooms', room.id, 'members', user.uid);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      const now = serverTimestamp();
      await setDoc(memberRef, { roles: [], displayName: displayName ?? '', joinedAt: now });
      await setDoc(doc(db, 'users', user.uid, 'rooms', room.id), {
        name: room.name, inviteCode: room.inviteCode, ownerId: room.ownerId, joinedAt: now,
      });
    }

    selectRoom(room);
    return room;
  }

  async function leaveRoom() {
    if (!currentRoom || !user) return;
    await Promise.all([
      deleteDoc(doc(db, 'rooms', currentRoom.id, 'members', user.uid)),
      deleteDoc(doc(db, 'users', user.uid, 'rooms', currentRoom.id)),
    ]);
    setCurrentRoom(null);
    localStorage.removeItem('lastRoomId');
  }

  async function deleteRoom() {
    if (!currentRoom || !isOwner) return;
    await Promise.all(
      members.map(m => Promise.all([
        deleteDoc(doc(db, 'rooms', currentRoom.id, 'members', m.userId)),
        deleteDoc(doc(db, 'users', m.userId, 'rooms', currentRoom.id)),
      ]))
    );
    await deleteDoc(doc(db, 'rooms', currentRoom.id));
    setCurrentRoom(null);
    localStorage.removeItem('lastRoomId');
  }

  async function kickMember(userId) {
    if (!currentRoom || !isAdmin) return;
    await Promise.all([
      deleteDoc(doc(db, 'rooms', currentRoom.id, 'members', userId)),
      deleteDoc(doc(db, 'users', userId, 'rooms', currentRoom.id)),
    ]);
  }

  async function assignRole(userId, role) {
    await updateDoc(doc(db, 'rooms', currentRoom.id, 'members', userId), {
      roles: arrayUnion(role),
    });
  }

  async function removeRole(userId, role) {
    await updateDoc(doc(db, 'rooms', currentRoom.id, 'members', userId), {
      roles: arrayRemove(role),
    });
  }

  const isAdmin = userRoles.includes('Admin');
  const isDJ    = userRoles.includes('DJ');
  const isOwner = currentRoom?.ownerId === user?.uid;

  return (
    <RoomContext.Provider value={{
      currentRoom, userRoles, userRooms, members, presenceList,
      roomsLoaded, isAdmin, isDJ, isOwner,
      createRoom, joinRoom, switchRoom: selectRoom,
      assignRole, removeRole, kickMember, leaveRoom, deleteRoom,
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export const useRoom = () => useContext(RoomContext);
