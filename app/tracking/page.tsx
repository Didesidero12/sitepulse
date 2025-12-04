// app/tracking/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

  useEffect(() => {
    if (!tracking || !ticketId) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
      },
      (err) => {
        alert("GPS error: " + err.message);
        setTracking(false);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  const start = () => {
    if (!ticketId) {
      alert("No ticket");
      return;
    }
    setTracking(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-7xl font-black mb-16">DRIVER TRACKING</h1>

      {!tracking ? (
        <button
          onClick={start}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-6xl font-bold py-20 px-48 rounded-3xl shadow-2xl transition-all hover:scale-105"
        >
          START TRACKING NOW
        </button>
      ) : location ? (
        <div className="text-center">
          <p className="text-6xl font-black text-green-400 animate-pulse mb-8">ACTIVE</p>
          <p className="text-4xl text-cyan-300">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      ) : (
        <p className="text-5xl animate-pulse">Waiting for GPS...</p>
      )}
    </div>
  );
}