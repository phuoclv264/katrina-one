
// This file must be in the public directory

importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
const firebaseConfig = {
  apiKey: "AIzaSyDo4AmEEV-O0AhLJi0hnVHwGiApNl3j9sE",
  authDomain: "katrinaone.firebaseapp.com",
  projectId: "katrinaone",
  storageBucket: "katrinaone.firebasestorage.app",
  messagingSenderId: "79531218569",
  appId: "1:79531218569:web:7f05767af45e3aa12f1858",
  measurementId: "G-2F66CP4D92"
};


firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo_coffee.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
