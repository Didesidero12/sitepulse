// app/(tracking)/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import dynamic from 'next/dynamic';

// Dynamically import mapbox-gl (client-only)
const MapboxMap = dynamic(() => import('@/components/MapboxDriverMap'), {
  ssr: false,
  loading: () => <p className="text-center text-3xl">Loading map...</p>,
});

export default function DriverTracking() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

  const startTracking = () => {
    if (!ticketId) {
      alert("No ticket ID");
      return;
    }

    navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        setTracking(true);

        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-cyan-600 p-6 text-center">
        <h1 className="text-4xl font-bold">DRIVER MODE</h1>
      </div>

      <div className="flex-1">
        {location ? (
          <MapboxMap && <MapboxMap location={location} />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-800">
            <p className="text-3xl">Waiting for GPS...</p>
          </div>
        )}
      </div>

      <div className="p-6">
        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-16 text-6xl font-bold rounded-3xl transition-all ${
            tracking ? "bg-red-600 hover:bg-red-700" : "bg-cyan-600 hover:bg-cyan-700"
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING NOW"}
        </button>
      </div>
    </div>
  );
}