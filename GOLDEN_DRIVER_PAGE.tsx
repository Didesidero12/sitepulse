// GOLDEN DRIVER PAGE — DO NOT TOUCH — THIS ONE WORKS 100%
// Saved on 2025-04-05 — the day we finally beat the map
// Map is idle, button works, dot moves, no errors

"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function TestDriverPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // INIT MAP — IDLE STATE
  useEffect(() => {
    console.log("Map init starting...");
    if (!mapContainer.current) {
      console.log("No mapContainer — waiting");
      return;
    }

    console.log("Creating map...");
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-122.6765, 45.5231], // fallback to site
      zoom: 15,
    });

    console.log("Map created — idle state ready");
    return () => {
      console.log("Cleaning up map...");
      map.current?.remove();
    };
  }, []);

  // START TRACKING + UPDATE MARKER
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

        // MARKER UPDATE MOVED TO SEPARATE useEffect BELOW
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  // MARKER UPDATE — SEPARATE, CLEAN, BULLETPROOF
  useEffect(() => {
    if (!location || !map.current) return;

    if (marker.current) {
      marker.current.setLngLat([location.lng, location.lat]);
    } else {
      marker.current = new mapboxgl.Marker({ color: "cyan" })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);
    }

    map.current.easeTo({ center: [location.lng, location.lat], duration: 1000 });
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-cyan-600 p-6 text-center">
        <h1 className="text-5xl font-black">DRIVER MODE</h1>
      </div>

      {/* MAP CONTAINER — FULL HEIGHT, VISIBLE */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" style={{ height: '100vh', width: '100%' }} />
        {!tracking && (
          <p className="absolute inset-0 flex items-center justify-center text-4xl text-gray-400 z-10">
            Ready to start tracking
          </p>
        )}
      </div>

      <div className="p-6">
        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-12 text-5xl sm:text-6xl font-bold rounded-3xl transition-all ${
            tracking ? "bg-red-600 hover:bg-red-700" : "bg-cyan-600 hover:bg-cyan-700"
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING NOW"}
        </button>
      </div>

      {/* COORDINATES */}
      {tracking && location && (
        <p className="text-center text-xl text-cyan-400 mb-4">
          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}