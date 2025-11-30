// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Hard-code Mapbox CDN — bypasses all bundling issues
const MAPBOX_CSS = "https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.css";
const MAPBOX_JS = "https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.js";

export default function DriverView() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // Load Mapbox from CDN
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPBOX_CSS;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = MAPBOX_JS;
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";
      initMap();
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  const initMap = () => {
    if (!mapContainer.current || !window.mapboxgl) return;

    // @ts-ignore
    const map = new window.mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 12,
    });

    new window.mapboxgl.Marker({ color: "green" })
      .setLngLat([siteLocation.lng, siteLocation.lat])
      .setPopup(new window.mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
      .addTo(map);

    if (location) {
      new window.mapboxgl.Marker({ color: "blue" })
        .setLngLat([location.lng, location.lat])
        .addTo(map);
      map.flyTo({ center: [location.lng, location.lat], zoom: 15 });
    }
  };

  // GPS TRACKING
  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        try {
          await updateDoc(doc(db, "projects", id as string), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        } catch (err) {
          console.error("Failed to update:", err);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-green-600 p-6 text-center">
        <h1 className="text-4xl font-bold">DRIVER MODE</h1>
        <p className="text-2xl opacity-90">Project {id}</p>
      </div>

      <div className="p-6 space-y-6 flex-1">
        <div className="bg-gray-800 rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold text-green-400 mb-4">DELIVERY</h2>
          <p className="text-5xl font-bold">Doors from Italy</p>
          <p className="text-3xl">12 bifolds</p>
          <p className="text-red-400 text-3xl font-bold mt-4">FORKLIFT NEEDED</p>
        </div>

        <div ref={mapContainer} className="w-full h-96 rounded-2xl bg-gray-800" style={{ minHeight: "500px" }} />

        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-12 text-5xl font-bold rounded-3xl ${tracking ? 'bg-red-600' : 'bg-green-600'}`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING"}
        </button>
      </div>
    </div>
  );
}