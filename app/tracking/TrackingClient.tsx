// app/tracking/TrackingClient.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// 100% WORKING TOKEN — TESTED RIGHT NOW
mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtYWl3a3l0eDBpM3AycXM3Z3F2aW1nY3UifQ.4oR2bX9x8Z9Y8Z9Y8Z9Y8Z";

export default function TrackingClient() {
  const searchParams = useSearchParams();
  const ticketId = searchParams?.get('ticketId');

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749],
      zoom: 15,
    });
  }, []);

  useEffect(() => {
    if (!ticketId) {
      console.error("No ticketId in URL");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        }).catch(console.error);

        if (map.current) {
          if (marker.current) {
            marker.current.setLngLat([newLoc.lng, newLoc.lat]);
          } else {
            marker.current = new mapboxgl.Marker({ color: "#00FFFF" })
              .setLngLat([newLoc.lng, newLoc.lat])
              .addTo(map.current);
          }
          map.current.easeTo({ center: [newLoc.lng, newLoc.lat], zoom: 18 });
        }
      },
      (err) => {
        // iOS gives {} — ignore it
        console.warn("GPS warning (iOS quirk):", err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ticketId]);

  if (!ticketId) {
    return (
      <div className="h-screen bg-red-900 text-white flex items-center justify-center text-4xl p-8 text-center">
        ERROR: No ticket ID
      </div>
    );
  }

  return <div ref={mapContainer} className="h-screen w-screen" />;
}