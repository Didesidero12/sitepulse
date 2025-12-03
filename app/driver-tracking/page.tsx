"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function DriverTracking() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [location, setLocation] = useState<any>(null);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        if (ticketId) {
          await updateDoc(doc(db, "tickets", ticketId), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ticketId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-8">TRACKING ACTIVE</h1>
        <p className="text-3xl">Live location is being sent to Super War Room</p>
        {location && (
          <p className="text-xl mt-8 text-gray-400">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}