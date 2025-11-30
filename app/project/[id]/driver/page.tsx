// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function DriverView() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [delivery, setDelivery] = useState({ material: "Doors from Italy", qty: "12 bifolds", needsForklift: true });

  // Fake site location — replace with real from project
  const siteLocation = { lat: 45.5231, lng: -122.6765 }; // Portland example

  // Load delivery data (fake for now)
  useEffect(() => {
    setDelivery({ material: "Doors from Italy", qty: "12 bifolds", needsForklift: true });
  }, []);

  // Live GPS tracking
  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        await updateDoc(doc(db, "projects", id as string), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
        checkGeofence(newLoc);
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id]);

  // Geofencing alerts
  const checkGeofence = (loc: { lat: number; lng: number }) => {
    const dist = getDistance(loc, siteLocation);
    if (dist < 30 && dist > 15) alert("30 MIN OUT — FORKLIFT NEEDED");
    if (dist < 15 && dist > 5) alert("15 MIN OUT — PREPARE UNLOAD");
    if (dist < 5) alert("5 MIN OUT — I'M HERE!");
  };

  const getDistance = (loc1: any, loc2: any) => {
    const R = 3958.8; // miles
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(loc2.lat - loc1.lat);
    const dLon = toRad(loc2.lng - loc1.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Map Setup
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 12,
    });

    // Site marker (green)
    new mapboxgl.Marker({ color: "green" })
      .setLngLat([siteLocation.lng, siteLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
      .addTo(map.current);

    // Driver marker (blue) — updates when location changes
    if (location) {
      if (marker.current) marker.current.remove();
      marker.current = new mapboxgl.Marker({ color: "blue" })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);
      map.current.flyTo({ center: [location.lng, location.lat], zoom: 15 });
    }

    return () => map.current?.remove();
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-green-600 p-6 text-center">
        <h1 className="text-4xl font-bold">DRIVER MODE</h1>
        <p className="text-2xl opacity-90">Project {id}</p>
      </div>

      {/* Delivery Card */}
      <div className="p-6">
        <div className="bg-gray-800 rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold text-green-400 mb-4">DELIVERY</h2>
          <p className="text-5xl font-bold mb-2">{delivery.material}</p>
          <p className="text-3xl mb-4">{delivery.qty}</p>
          {delivery.needsForklift && <p className="text-red-400 text-3xl font-bold mt-4">FORKLIFT NEEDED</p>}
        </div>
      </div>

        {/* MAP — THIS WILL 100% WORK */}
        <div className="w-full bg-gray-800 rounded-2xl overflow-hidden" style={{ height: '500px' }}>
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* Action Buttons */}
      <div className="p-6 space-y-6">
        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-12 text-5xl font-bold rounded-3xl transition ${
            tracking ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING →"}
        </button>

        <button className="w-full bg-blue-600 py-12 text-5xl font-bold rounded-3xl">
          I'VE ARRIVED
        </button>
      </div>
    </div>
  );
}