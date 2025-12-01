// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Fallback token for testing
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function DriverView() {
  const { id } = useParams();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [delivery, setDelivery] = useState({ material: "Doors from Italy", qty: "12 bifolds", needsForklift: true });

  const siteLocation = { lat: 45.5231, lng: -122.6765 }; // Portland example

  // GPS tracking + geofencing
  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        await updateDoc(doc(db, "projects", id), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
        checkGeofence(newLoc);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking]);

  const checkGeofence = (loc) => {
    const dist = getDistance(loc, siteLocation);
    if (dist < 30 && dist > 15) alert("30 MIN OUT — FORKLIFT NEEDED");
    if (dist < 15 && dist > 5) alert("15 MIN OUT — PREPARE UNLOAD");
    if (dist < 5) alert("5 MIN OUT — I'M HERE!");
  };

  const getDistance = (loc1, loc2) => {
    const R = 3958.8; // miles
    const toRad = (x) => x * Math.PI / 180;
    const dLat = toRad(loc2.lat - loc1.lat);
    const dLon = toRad(loc2.lng - loc1.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Map init
  useEffect(() => {
    if (mapContainer.current) {
      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [siteLocation.lng, siteLocation.lat],
        zoom: 12,
      });

      new mapboxgl.Marker({ color: 'green' }).setLngLat([siteLocation.lng, siteLocation.lat]).addTo(m);

      if (location) {
        new mapboxgl.Marker({ color: 'blue' }).setLngLat([location.lng, location.lat]).addTo(m);
        m.flyTo({ center: [location.lng, location.lat], zoom: 15 });
      }
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl">DRIVER MODE</h1>
      <div ref={mapContainer} className="h-96" />
      <button onClick={() => setTracking(!tracking)}>{tracking ? 'STOP' : 'START TRACKING'}</button>
    </div>
  );
}