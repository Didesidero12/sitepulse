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

    let watchId: number | null = null;

    const start = () => {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(newLoc);

          try {
            await updateDoc(doc(db, "tickets", ticketId), {
              driverLocation: newLoc,
              lastUpdate: serverTimestamp(),
            });
          } catch (err) {
            console.error("Update failed:", err);
          }
        },
        (err) => {
          alert("GPS error: " + err.message);
          setTracking(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    };

    start();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [tracking, ticketId]);

  const handleStart = () => {
    if (!ticketId) {
      alert("No ticket ID found");
      return;
    }
    setTracking(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-7xl font-black mb-12">DRIVER TRACKING</h1>

      {!tracking ? (
        <button
          onClick={handleStart}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-6xl font-bold py-16 px-40 rounded-3xl shadow-2xl transition-all hover:scale-105"
        >
          START TRACKING NOW
        </button>
      ) : location ? (
        <div className="text-center">
          <p className="text-5xl mb-8 animate-pulse text-green-400">ACTIVE</p>
          <p className="text-3xl text-cyan-300">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      ) : (
        <p className="text-4xl animate-pulse">Waiting for GPS...</p>
      )}
    </div>
  );
}