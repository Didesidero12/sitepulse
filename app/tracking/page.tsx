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
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  const startTracking = () => {
    if (!ticketId) {
      alert("No ticket ID");
      return;
    }
    setTracking(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-10">DRIVER TRACKING</h1>

      {!tracking ? (
        <button
          onClick={startTracking}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-5xl font-bold py-16 px-32 rounded-3xl shadow-2xl transition-all hover:scale-105"
        >
          START TRACKING NOW
        </button>
      ) : location ? (
        <div className="text-center">
          <p className="text-5xl mb-8 animate-pulse">TRACKING ACTIVE</p>
          <p className="text-3xl text-cyan-400">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      ) : (
        <p className="text-4xl animate-pulse">Waiting for GPS...</p>
      )}
    </div>
  );
}