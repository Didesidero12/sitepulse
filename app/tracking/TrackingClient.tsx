// app/tracking/TrackingClient.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtYWl3a3l0eDBpM3AycXM3Z3F2aW1nY3UifQ.4oR2bX9x8Z9Y8Z9Y8Z9Y8Z"; // ← Your real token

export default function TrackingClient() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749], // fallback
      zoom: 15,
    });
  }, []);

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

        if (map.current && marker.current) {
          marker.current.setLngLat([newLoc.lng, newLoc.lat]);
          map.current.easeTo({ center: [newLoc.lng, newLoc.lat] });
        } else if (map.current) {
          marker.current = new mapboxgl.Marker({ color: "#00FFFF" })
            .setLngLat([newLoc.lng, newLoc.lat])
            .addTo(map.current);
          map.current.easeTo({ center: [newLoc.lng, newLoc.lat] });
        }
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

   return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* HEADER */}
      <div className="bg-cyan-600 p-6 text-center">
        <h1 className="text-5xl font-black">DRIVER MODE</h1>
      </div>

      {/* MAP — FULL HEIGHT */}
      <div ref={mapContainer} className="flex-1 w-full" />

      {/* BUTTON */}
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

      {/* COORDINATES */}
      {location && (
        <div className="text-center pb-8 text-cyan-400 text-2xl font-mono">
          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}