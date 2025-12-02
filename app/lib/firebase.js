// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// FCM — ONLY INITIALIZE IF SUPPORTED (works on most browsers)
let messaging = null;
if (typeof window !== "undefined" && isSupported()) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("FCM not available:", err);
  }
}

export { messaging };

// Listen for messages when app is in foreground
if (messaging && typeof window !== "undefined") {
  onMessage(messaging, (payload) => {
    console.log("Message received (foreground):", payload);
    const title = payload.notification?.title || "SitePulse Alert";
    const body = payload.notification?.body || "New delivery update";
    alert(`${title}\n${body}`);
  });
}