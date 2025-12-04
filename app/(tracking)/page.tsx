// app/(tracking)/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function DriverTracking() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // Map init
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 14,
    });

    new mapboxgl.Marker({ color: "green" })
      .setLngLat([siteLocation.lng, siteLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
      .addTo(map.current);

    return () => map.current?.remove();
  }, []);

  // Blue dot update
  useEffect(() => {
    if (!map.current || !location) return;
    if (marker.current) marker.current.remove();

    marker.current = new mapboxgl.Marker({ color: "blue" })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);

    map.current.easeTo({ center: [location.lng, location.lat], zoom: 16, duration: 1000 });
  }, [location]);

  if (!ticketId) {
    return <p className="text-6xl text-red-400 text-center mt-40">No ticket ID — go back and claim again</p>;
  }

  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-10">DRIVER TRACKING</h1>

      {!tracking ? (
        <button
          onClick={() => setTracking(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-5xl font-bold py-16 px-32 rounded-3xl shadow-2xl transition-all hover:scale-105"
        >
          START TRACKING NOW
        </button>
      ) : (
        <div className="text-center">
          <p className="text-5xl mb-8 animate-pulse">TRACKING ACTIVE</p>
          <p className="text-3xl text-cyan-400">
            {location?.lat.toFixed(6)}, {location?.lng.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}