// app/test-driver/page.tsx (or your driver page)
"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FaPlay, FaStop } from 'react-icons/fa';

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

        // MARKER UPDATE
        if (map.current) {
          if (marker.current) {
            marker.current.setLngLat([newLoc.lng, newLoc.lat]);
          } else {
            marker.current = new mapboxgl.Marker({ color: "cyan" })
              .setLngLat([newLoc.lng, newLoc.lat])
              .addTo(map.current);
          }
          map.current.easeTo({ center: [newLoc.lng, newLoc.lat] });
        }
      },
      (err) => alert("GPS error: " + err.message),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, ticketId]);

  return (
    <div className="relative h-screen w-screen bg-gray-900 overflow-hidden">
      {/* MAP — FULL SCREEN, BEHIND EVERYTHING */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
        style={{ height: '100vh' }}
      />

      {/* SLIDER — FLOATING ON TOP */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl shadow-2xl z-50">
        <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mt-4 mb-6" />

        <div className="px-6 pb-10">
          <button
            onClick={() => setTracking(!tracking)}
            className={`w-full py-20 text-7xl font-black rounded-3xl transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-10 ${
              tracking ? "bg-red-600 hover:bg-red-700" : "bg-cyan-600 hover:bg-cyan-700"
            }`}
          >
            {tracking ? (
              <>
                <FaStop size={130} />
                <span>STOP TRACKING</span>
              </>
            ) : (
              <>
                <FaPlay size={130} />
                <span>START TRACKING NOW</span>
              </>
            )}
          </button>

          {tracking && location && (
            <p className="text-center text-xl text-cyan-400 mt-8">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}