// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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
async function initializeFirebase() {
  if (typeof window !== 'undefined') {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    // Actively sign in anonymously if no user is present.
    if (!auth.currentUser) {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Anonymous sign-in failed: ", error);
        }
    }
  }
}

// Call the function to initialize Firebase.
initializeFirebase();

export { app, auth, db, storage };
