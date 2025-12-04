// app/tracking/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);

  const startTracking = () => {
    if (!ticketId) {
      alert("No ticket ID");
      return;
    }

    navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
        setTracking(true);
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-10">DRIVER TRACKING</h1>
      {!tracking ? (
        <button
          onClick={startTracking}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-5xl font-bold py-16 px-32 rounded-3xl"
        >
          START TRACKING NOW
        </button>
      ) : (
        <p className="text-5xl animate-pulse">TRACKING ACTIVE</p>
      )}
    </div>
  );
}