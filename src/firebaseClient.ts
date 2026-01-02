import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  // add other fields if needed
};

// Initialize Firebase app only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export auth instance
export const auth = getAuth(app);
export default app;
