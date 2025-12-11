// migrate.ts  ← root of project (this one works 100%)
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDfZthCoqe3owZnKG8qnjLwan9IG2bxf70",
  authDomain: "sitepulse-world.firebaseapp.com",
  projectId: "sitepulse-world",
  storageBucket: "sitepulse-world.firebasestorage.app",
  messagingSenderId: "721123369540",
  appId: "1:721123369540:web:a839a6617e3c38aa571211"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

(async () => {
  try {
    console.log('Signing in anonymously...');
    await signInAnonymously(auth);
    console.log('Signed in — starting migration');

    const snap = await getDocs(collection(db, 'tickets'));
    let count = 0;

    for (const d of snap.docs) {
      const data = d.data();
      let newStatus: 'unclaimed' | 'claimed-untracking' | 'claimed-tracking' | 'arrived' = 'unclaimed';

      if (data.status === 'en_route' || data.status === 'pending' || data.driverId) {
        newStatus = data.driverLocation ? 'claimed-tracking' : 'claimed-untracking';
      }

      if (!data.status || data.status !== newStatus) {
        await updateDoc(doc(db, 'tickets', d.id), { status: newStatus });
        console.log(`Fixed ${d.id} → ${newStatus}`);
        count++;
      }
    }

    console.log(`\nMIGRATION COMPLETE — Fixed ${count} tickets`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();