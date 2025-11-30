// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// CDN — proven to work
const MAPBOX_CSS = "https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.css";
const MAPBOX_JS = "https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.js";

export default function DriverView() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const driverMarker = useRef<any>(null);

  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // === AUTO-RESUME TRACKING ON REFRESH (ADDED) ===
  useEffect(() => {
    const wasTracking = localStorage.getItem(`tracking_${id}`) === "true";
    if (wasTracking) {
      setTracking(true);
    }
  }, [id]);

  // Save tracking state to localStorage
  useEffect(() => {
    if (tracking) {
      localStorage.setItem(`tracking_${id}`, "true");
    } else {
      localStorage.removeItem(`tracking_${id}`);
    }
  }, [tracking, id]);
  // ================================================

  // 1. Load Mapbox from CDN
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
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  // 2. Initialize map + green pin (once)
  const initMap = () => {
    if (!mapContainer.current || !window.mapboxgl) return;

    map.current = new window.mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 14,
    });

    new window.mapboxgl.Marker({ color: "green" })
      .setLngLat([siteLocation.lng, siteLocation.lat])
      .setPopup(new window.mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
      .addTo(map.current);
  };

  // 3. Update BLUE DRIVER DOT whenever location changes
  useEffect(() => {
    if (!map.current || !location) return;

    if (driverMarker.current) driverMarker.current.remove();

    driverMarker.current = new window.mapboxgl.Marker({ color: "blue" })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);

    map.current.flyTo({
      center: [location.lng, location.lat],
      zoom: 16,
      essential: true,
    });
  }, [location]);

  // 4. GPS TRACKING (your existing perfect code)
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
          console.error("Firestore update failed:", err);
        }
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* ... your existing JSX ... */}
      <div className="p-6 space-y-6 flex-1">
        {/* delivery card */}
        {/* map container */}
        <div
          ref={mapContainer}
          className="w-full rounded-2xl bg-gray-800"
          style={{ height: "500px" }}
        />

        <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-12 text-5xl font-bold rounded-3xl transition ${
            tracking ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING"}
        </button>
      </div>
    </div>
  );
}