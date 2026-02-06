/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD7JAffnalypSItqqZWGWYRTF7ZmKCowD4",
  authDomain: "gostorez-enterprise.firebaseapp.com",
  projectId: "gostorez-enterprise",
  storageBucket: "gostorez-enterprise.appspot.com",
  messagingSenderId: "84399336805",
  appId: "1:84399336805:web:e4e5e57b95d1a2bb8b858c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  self.registration.showNotification(
    payload.notification?.title || 'GoStorez',
    {
      body: payload.notification?.body,
      icon: '/logo.png',
    }
  );
});
