// app/project/[id]/driver/page.js
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

export default function DriverView() {
  const { id } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [tracking, setTracking] = useState(false);

  // Fake delivery data for now — in real app this comes from booking
  useEffect(() => {
    setDelivery({
      material: "Doors from Italy",
      qty: "12 bifolds",
      needsForklift: true,
      eta: "30 min"
    });
  }, []);

  // Live tracking
  useEffect(() => {
    if (!tracking) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        // In real app: send coords to Firebase
        console.log("Driver location:", pos.coords.latitude, pos.coords.longitude);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-green-600 p-8 text-center">
        <h1 className="text-4xl font-bold">DRIVER MODE</h1>
        <p className="text-2xl">Project {id}</p>
      </div>

      <div className="p-8 space-y-8">
        <div className="bg-gray-800 p-8 rounded-2xl text-center">
          <h2 className="text-5xl font-bold text-green-400">DELIVERY</h2>
          <p className="text-4xl mt-4">{delivery?.material}</p>
          <p className="text-2xl">{delivery?.qty}</p>
          {delivery?.needsForklift && <p className="text-red-400 text-2xl mt-4">FORKLIFT NEEDED</p>}
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl text-center">
          <h2 className="text-5xl font-bold text-orange-400">ETA</h2>
          <p className="text-8xl font-black mt-4">{delivery?.eta}</p>
        </div>

        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-12 rounded-3xl text-5xl font-bold transition-all
            ${tracking ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING →"}
        </button>

        <button className="w-full bg-blue-600 hover:bg-blue-500 py-12 rounded-3xl text-5xl font-bold">
          I’VE ARRIVED
        </button>
      </div>
    </div>
  );
}