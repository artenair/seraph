import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(undefined);
  const [displayName,     setDisplayName]     = useState(null);
  const [suggestedName,   setSuggestedName]   = useState('');
  const [loading,         setLoading]         = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Handle Discord redirect token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('discordToken');
    const error  = params.get('authError');
    if (token) {
      const name = params.get('discordName');
      if (name) setSuggestedName(decodeURIComponent(name));
      window.history.replaceState({}, '', '/');
      signInWithCustomToken(auth, token).catch(console.error);
    }
    if (error) {
      window.history.replaceState({}, '', '/');
      console.error('Discord auth error:', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref      = doc(db, 'users', firebaseUser.uid);
        const snapshot = await getDoc(ref);
        const data     = snapshot.data() ?? {};

        const provider = firebaseUser.uid.startsWith('discord:')
          ? 'discord'
          : (firebaseUser.providerData[0]?.providerId ?? 'unknown');

        if (!snapshot.exists() || !data.onboardingComplete) {
          await setDoc(ref, { lastSeen: serverTimestamp(), provider }, { merge: true });
          setNeedsOnboarding(true);
        } else {
          await setDoc(ref, { lastSeen: serverTimestamp(), provider }, { merge: true });
          setNeedsOnboarding(false);
        }
        setDisplayName(data.displayName ?? null);
      } else {
        setDisplayName(null);
      }
      setUser(firebaseUser ?? null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout          = () => signOut(auth);

  const completeOnboarding = async (displayName) => {
    if (!auth.currentUser) return;
    await setDoc(doc(db, 'users', auth.currentUser.uid), {
      displayName,
      onboardingComplete: true,
    }, { merge: true });
    setDisplayName(displayName);
    setSuggestedName('');
    setNeedsOnboarding(false);
  };

  return (
    <AuthContext.Provider value={{ user, displayName, suggestedName, loading, needsOnboarding, loginWithGoogle, logout, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
