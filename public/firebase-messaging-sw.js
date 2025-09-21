
// DO NOT EDIT - THIS IS A GENERATED FILE
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDo4AmEEV-O0AhLJi0hnVHwGiApNl3j9sE",
  authDomain: "katrinaone.firebaseapp.com",
  projectId: "katrinaone",
  storageBucket: "katrinaone.firebasestorage.app",
  messagingSenderId: "79531218569",
  appId: "1:79531218569:web:7f05767af45e3aa12f1858",
  measurementId: "G-2F66CP4D92"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo_coffee.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
