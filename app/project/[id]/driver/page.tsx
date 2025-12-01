// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Hard-coded token for guaranteed map load
mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function DriverView() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const trackingStarted = useRef(false);   // ← ADD THIS LINE HERE

  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // GPS + Realtime + Geofencing
  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        try {
          await updateDoc(doc(db, "projects", id), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        } catch (err) {
          console.error("Firestore update failed:", err);
        }

        checkGeofence(newLoc);
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id]);

  const checkGeofence = (loc: { lat: number; lng: number }) => {
    const dist = getDistance(loc, siteLocation);
    if (dist < 30 && dist > 15) alert("30 MIN OUT — FORKLIFT NEEDED");
    if (dist < 15 && dist > 5) alert("15 MIN OUT — PREPARE UNLOAD");
    if (dist < 5) alert("5 MIN OUT — I'M HERE!");
  };

  const getDistance = (loc1: any, loc2: any) => {
    const R = 3958.8;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(loc2.lat - loc1.lat);
    const dLon = toRad(loc2.lng - loc1.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // MAP — STOPS THE FLYTO SPAM LOOP (Driver page ONLY
  const trackingStarted = useRef(false); // ← add this line near your other refs

  useEffect(() => {
    if (!mapContainer.current || !map.current) return;

    if (location) {
      // Remove old blue dot
      if (marker.current) marker.current.remove();

      // Add new blue dot
      marker.current = new mapboxgl.Marker({ color: "blue" })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);

      // Fly to driver ONLY the very first time we get a location
      if (!trackingStarted.current) {
        map.current.flyTo({
          center: [location.lng, location.lat],
          zoom: 16,
          essential: true,
        });
        trackingStarted.current = true;
      }
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-green-600 p-6 text-center">
        <h1 className="text-6xl font-bold">DRIVER MODE</h1>
        <p className="text-3xl opacity-90">Project {id}</p>
      </div>

      <div className="flex-1 p-6">
        <div
          ref={mapContainer}
          className="w-full h-full rounded-2xl bg-gray-800"
          style={{ minHeight: "60vh" }}
        />
      </div>

      <div className="p-6">
        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-16 text-6xl font-bold rounded-3xl transition-all ${
            tracking ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING"}
        </button>
      </div>
    </div>
  );
}