
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  type Firestore,
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyDo4AmEEV-O0AhLJi0hnVHwGiApNl3j9sE",
  authDomain: "katrinaone.firebaseapp.com",
  projectId: "katrinaone",
  storageBucket: "katrinaone.firebasestorage.app",
  messagingSenderId: "79531218569",
  appId: "1:79531218569:web:7f05767af45e3aa12f1858",
  measurementId: "G-2F66CP4D92"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;


// This function ensures that we initialize Firebase only once.
function initializeFirebase() {
  if (typeof window !== 'undefined') {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      }),
    });
    storage = getStorage(app);
  }
}

// Call the function to initialize Firebase.
initializeFirebase();

export { app, auth, db, storage };
