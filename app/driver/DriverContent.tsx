// app/driver/DriverContent.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function DriverContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    if (!tracking || !ticketId) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          lastUpdate: serverTimestamp(),
        });
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-7xl font-black mb-16">DRIVER TRACKING</h1>
        <button
          onClick={() => setTracking(!tracking)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-6xl font-bold py-20 px-48 rounded-3xl shadow-2xl"
        >
          {tracking ? "STOP TRACKING" : "START TRACKING"}
        </button>
        {tracking && <p className="text-5xl mt-10 animate-pulse text-green-400">ACTIVE</p>}
      </div>
    </div>
  );
}