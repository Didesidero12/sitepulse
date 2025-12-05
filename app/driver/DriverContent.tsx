// app/tracking/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // INIT MAP (STEP 1: BLANK BOX)
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [ -122.6765, 45.5231 ], // fallback to site location
      zoom: 14,
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  // START TRACKING + UPDATE MAP (STEP 2: COORDS + MARKER)
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

        // STEP 3: UPDATE MARKER + CENTER
        if (map.current) {
          if (marker.current) {
            marker.current.setLngLat([newLoc.lng, newLoc.lat]);
          } else {
            marker.current = new mapboxgl.Marker({ color: "cyan" })
              .setLngLat([newLoc.lng, newLoc.lat])
              .addTo(map.current);
          }
          map.current.easeTo({ center: [newLoc.lng, newLoc.lat], duration: 1000 });
        }
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-cyan-600 p-6 text-center">
        <h1 className="text-5xl font-black">DRIVER MODE</h1>
      </div>

      {/* STEP 4: MAP CONTAINER WITH FULL HEIGHT */}
      <div className="flex-1 w-full relative">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
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

      {/* COORDINATES AS BONUS */}
      {tracking && location && (
        <p className="text-center text-xl text-cyan-300 mb-4">
          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}