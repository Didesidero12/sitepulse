// app/(tracking)/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function DriverTracking() {
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
        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          lastUpdate: serverTimestamp(),
        });
        setTracking(true);
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-black mb-12">DRIVER TRACKING</h1>
        {!tracking ? (
          <button
            onClick={startTracking}
            className="bg-cyan-600 hover:bg-cyan-700 text-white text-6xl font-bold py-16 px-40 rounded-3xl shadow-2xl"
          >
            START TRACKING NOW
          </button>
        ) : (
          <p className="text-6xl animate-pulse text-cyan-400">TRACKING ACTIVE</p>
        )}
      </div>
    </div>
  );
}