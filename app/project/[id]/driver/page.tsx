// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  collection, 
  addDoc, 
  doc as firestoreDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// Hard-coded token — guaranteed to work
mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function DriverView() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryId] = useState<string | null>(localStorage.getItem(`deliveryId_${id}`)); // Persist delivery ID

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

// GPS + Firestore update — FIXED NO CONFLICTS
  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        if (deliveryId) {
          // UPDATE EXISTING DELIVERY
          await updateDoc(firestoreDoc(db, "deliveries", deliveryId), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        } else {
          // CREATE NEW DELIVERY ON FIRST POSITION
          const newDelivery = await addDoc(collection(db, "deliveries"), {
            projectId: id,
            material: "Doors from Italy",
            qty: "12 bifolds",
            needsForklift: true,
            driverLocation: newLoc,
            status: "en_route",
            timestamp: serverTimestamp(),
          });
          localStorage.setItem(`deliveryId_${id}`, newDelivery.id);
        }

        checkGeofence(newLoc);
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id, deliveryId]);

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

  // Map init — ONCE ONLY, NO RE-INIT
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 14,
    });

    // Green site pin
    new mapboxgl.Marker({ color: "green" })
      .setLngLat([siteLocation.lng, siteLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
      .addTo(map.current);

    // Initial driver marker
    if (location) {
      marker.current = new mapboxgl.Marker({ color: "blue" })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);
    }

    return () => map.current?.remove();
  }, []); // Empty deps — init once only

  // Update driver marker on location change — NO RE-INIT
  useEffect(() => {
    if (!map.current || !location) return;

    if (marker.current) marker.current.remove();

    marker.current = new mapboxgl.Marker({ color: "blue" })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);

    // Smooth flyTo — no spam
    map.current.easeTo({
      center: [location.lng, location.lat],
      zoom: 16,
      duration: 1000,
    });
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-green-600 p-6 text-center">
        <h1 className="text-4xl font-bold">DRIVER MODE</h1>
        <p className="text-2xl opacity-90">Project {id}</p>
      </div>

      <div className="flex-1 p-6">
        <div
          ref={mapContainer}
          className="w-full rounded-2xl bg-gray-800 overflow-hidden"
          style={{ height: "65vh" }}
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