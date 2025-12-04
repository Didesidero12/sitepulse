// app/tracking/page.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtYWl3a3l0eDBpM3AycXM3Z3F2aW1nY3UifQ.4oR2bX9x8Z9Y8Z9Y8Z9Y8Z";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
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
    if (!ticketId) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        await updateDoc(doc(db, "tickets", ticketId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });

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
      () => {},
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ticketId]);

  return <div ref={mapContainer} className="h-screen w-screen" />;
}