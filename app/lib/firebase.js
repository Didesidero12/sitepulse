// app/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfZthCoqe3owZnKG8qnjLwan9IG2bxf70",
  authDomain: "sitepulse-world.firebaseapp.com",
  projectId: "sitepulse-world",
  storageBucket: "sitepulse-world.firebasestorage.app",
  messagingSenderId: "721123369540",
  appId: "1:721123369540:web:a839a6617e3c38aa571211"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { serverTimestamp };