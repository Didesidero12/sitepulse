// app/ticket/[ticketId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

// PASTE YOUR REAL CONFIG HERE — FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDfZthCoqe3owZnKG8qnjLwan9IG2bxf70",
  authDomain: "sitepulse-world.firebaseapp.com",
  projectId: "sitepulse-world",
  storageBucket: "sitepulse-world.firebasestorage.app",
  appId: "1:721123369540:web:a839a6617e3c38aa571211"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function ClaimTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const loadTicket = async () => {
      try {
        const docRef = doc(db, "tickets", ticketId as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setTicket({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert("Ticket not found in Firestore");
        }
      } catch (err: any) {
        console.error("Firebase error:", err);
        alert("Error: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadTicket();
  }, [ticketId]);

  const claimTicket = async () => {
    try {
      await updateDoc(doc(db, "tickets", ticketId as string), {
        status: "en_route",
        driverId: "driver_001",
        claimedAt: serverTimestamp(),
      });
      setClaimed(true);   // ← This triggers the "CLAIMED — GO!" screen
    } catch (err: any) {
      alert("Failed to claim: " + err.message);
    }
  };

  if (loading) return <p className="text-6xl text-center mt-40">Loading...</p>;
  if (!ticket) return <p className="text-6xl text-red-400 text-center mt-40">Invalid Ticket</p>;

  // CLAIMED SUCCESS SCREEN
  if (claimed) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
        <h1 className="text-7xl font-black text-green-400 mb-12 animate-pulse">CLAIMED — GO!</h1>
        <Link href={`/driver-tracking?ticketId=${ticketId}`}>
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white text-5xl font-bold py-12 px-24 rounded-3xl shadow-2xl transition-all hover:scale-110">
            START TRACKING
          </button>
        </Link>
      </div>
    );
  }

  // ORIGINAL CLAIM SCREEN
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-10">CLAIM THIS DELIVERY</h1>
      <div className="bg-gray-800 p-12 rounded-3xl text-center max-w-2xl">
        <p className="text-5xl font-bold mb-6">{ticket.material}</p>
        <p className="text-4xl mb-10">{ticket.qty}</p>
        {ticket.needsForklift && (
          <p className="text-red-400 text-3xl font-bold mb-10">FORKLIFT NEEDED</p>
        )}
        <button
          onClick={claimTicket}
          className="bg-green-600 hover:bg-green-700 text-white text-5xl font-bold py-10 px-20 rounded-3xl shadow-2xl transition-all hover:scale-105"
        >
          CLAIM THIS DELIVERY
        </button>
      </div>
    </div>
  );
}