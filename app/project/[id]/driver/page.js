// app/project/[id]/driver/page.js
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
// YOUR MAPBOX TOKEN — keep this here
mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function DriverView() {
  const { id } = useParams();
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState(null);

  // Replace these with real data later
  const delivery = {
    material: "Doors from Italy",
    qty: "12 bifolds",
    needsForklift: true,
  };

  const siteLocation = { lat: 45.5231, lng: -122.6765 }; // Portland — change per project later

  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        };
        setLocation(newLoc);

        // Send location to Firebase
        await updateDoc(doc(db, "projects", id), {
          driverLocation: newLoc,
          lastSeen: serverTimestamp(),
        });

        // Geofencing alerts
        const dist = getDistanceMiles(newLoc, siteLocation);
        if (dist < 30 && dist >= 15) alert("30 min out — forklift ready?");
        if (dist < 15 && dist >= 5) alert("15 min out — prepare unload");
        if (dist < 5) alert("5 min out — I'm here!");
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id]);

  const getDistanceMiles = (from, to) => {
    const R = 3958.8; // Earth radius in miles
    const toRad = (deg => deg * Math.PI / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLon = toRad(to.lng - from.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Map
  useEffect(() => {
    {
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 11
    });

    // Site marker
    new mapboxgl.Marker({ color: '#10b981' })
      .setLngLat([siteLocation.lng, siteLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
      .addTo(map);

    // Driver marker (updates live)
    let driverMarker = null;
    if (location) {
      driverMarker = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([location.lng, location.lat])
        .addTo(map);
      map.flyTo({ center: [location.lng, location.lat], zoom: 14 });
    }

    return () => map.remove();
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gradient-to-b from-green-600 to-green-700 p-8 text-center">
        <h1 className="text-5xl font-black">DRIVER MODE</h1>
        <p className="text-3xl mt-2">Project {id}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Delivery Card */}
        <div className="bg-gray-800 rounded-3xl p-8 text-center">
          <h2 className="text-4xl font-bold text-green-400 mb-6">DELIVERY</h2>
          <p className="text-5xl font-bold mb-3">{delivery.material}</p>
          <p className="text-3xl text-gray-300">{delivery.qty}</p>
          {delivery.needsForklift && (
            <p className="text-red-400 text-3xl font-bold mt-6">FORKLIFT NEEDED</p>
          )}
        </div>

        </div>

        {/* Map */}
        <div id="map" className="h-96 w-full rounded-3xl overflow-hidden shadow-2xl" />

        {/* Buttons */}
        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-10 text-6xl font-black rounded-3xl transition ${
            tracking ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING →"}
        </button>

        <button className="w-full bg-blue-600 hover:bg-blue-500 py-10 text-6xl font-black rounded-3xl">
          I'VE ARRIVED
        </button>
      </div>
    </div>
  );
}