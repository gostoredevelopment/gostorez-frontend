// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyChvzIWUpsYs4hugOSYBKfweN92GmM7f4s",
  authDomain: "gostorezenterprise.firebaseapp.com",
  projectId: "gostorezenterprise",
  storageBucket: "gostorezenterprise.firebasestorage.app",
  messagingSenderId: "311778870845",
  appId: "1:311778870845:web:8d26ed4ce7625b8449cc54"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;