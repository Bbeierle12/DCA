import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, deleteDoc, addDoc, onSnapshot } from "firebase/firestore";
import { PlayerData, HouseBlock } from "../types";

const getFirebaseConfig = () => {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__firebase_config) return window.__firebase_config;
    // @ts-ignore
    if (typeof __firebase_config !== 'undefined') return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
  } catch (e) {
    // Silent fail, will return null
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
let app;
let auth: any = null;
let db: any = null;
let isOnline = false;

// Validate config presence and structure
if (firebaseConfig && typeof firebaseConfig === 'object' && firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isOnline = true;
    } catch (e) {
        console.warn("Firebase initialization failed:", e);
        isOnline = false;
    }
} else {
    console.warn("No valid Firebase config found or API Key missing. Starting in offline mode.");
    isOnline = false;
}

// @ts-ignore
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const COLLECTIONS = {
  PLAYERS: `artifacts/${APP_ID}/public/data/dca_players`,
  HOUSES: `artifacts/${APP_ID}/public/data/dca_houses`
};

export { auth, db };

export const initAuth = async (): Promise<string | null> => {
  if (!isOnline || !auth) {
      console.log("Running offline: Generated mock user ID");
      return `offline_${Date.now()}`;
  }
  try {
    // @ts-ignore
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        // @ts-ignore
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user ? user.uid : null);
        }, (error) => {
            console.warn("Auth state change error:", error);
            resolve(`offline_${Date.now()}`);
        });
    });
  } catch (e) {
    console.error("Auth failed", e);
    // Fallback to offline if auth fails (e.g. invalid key despite having config)
    isOnline = false; // Mark as offline to prevent further DB calls
    return `offline_${Date.now()}`;
  }
};

export const updatePlayerInDb = async (uid: string, data: Partial<PlayerData>) => {
    if (!isOnline || !db) return;
    try {
        await setDoc(doc(db, COLLECTIONS.PLAYERS, uid), data, { merge: true });
    } catch (e) {
        console.warn("DB Update failed", e);
    }
};

export const addHouseBlock = async (block: Omit<HouseBlock, 'id'>) => {
    if (!isOnline || !db) return;
    try {
        await addDoc(collection(db, COLLECTIONS.HOUSES), block);
    } catch (e) {
        console.warn("Add house failed", e);
    }
};

export const removeHouseBlock = async (id: string) => {
    if (!isOnline || !db) return;
    try {
        await deleteDoc(doc(db, COLLECTIONS.HOUSES, id));
    } catch (e) {
        console.warn("Remove house failed", e);
    }
};

export const subscribeToPlayers = (uid: string, callback: (id: string, data: PlayerData) => void) => {
    if (!isOnline || !db) return () => {};
    try {
        return onSnapshot(collection(db, COLLECTIONS.PLAYERS), (snapshot) => {
            snapshot.forEach((doc) => {
                if (doc.id !== uid) {
                    callback(doc.id, doc.data() as PlayerData);
                }
            });
        }, (error) => {
            console.warn("Subscribe players failed", error);
        });
    } catch (e) {
        console.warn("Subscribe players init failed", e);
        return () => {};
    }
};

export const subscribeToHouses = (
    onAdd: (data: HouseBlock) => void, 
    onRemove: (id: string) => void
) => {
    if (!isOnline || !db) return () => {};
    try {
        return onSnapshot(collection(db, COLLECTIONS.HOUSES), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    onAdd({ ...change.doc.data(), id: change.doc.id } as HouseBlock);
                }
                if (change.type === 'removed') {
                    onRemove(change.doc.id);
                }
            });
        }, (error) => {
            console.warn("Subscribe houses failed", error);
        });
    } catch (e) {
         console.warn("Subscribe houses init failed", e);
         return () => {};
    }
};