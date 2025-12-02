// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

// GLOBAL SINGLETON — ONLY ONE TRACKING SESSION EVER
declare global {
  var __ACTIVE_TRACKING__: {
    watchId: number | null;
    deliveryId: string | null;
  } | undefined;
}

if (!global.__ACTIVE_TRACKING__) {
  global.__ACTIVE_TRACKING__ = { watchId: null, deliveryId: null };
}

export default function DriverView() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // TRACKING — FINAL, ONE TRUCK ONLY
  useEffect(() => {
    if (!tracking) {
      if (global.__ACTIVE_TRACKING__?.watchId) {
        navigator.geolocation.clearWatch(global.__ACTIVE_TRACKING__!.watchId);
        global.__ACTIVE_TRACKING__!.watchId = null;
      }
      return;
    }

    if (global.__ACTIVE_TRACKING__?.watchId) return; // Already running

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        let deliveryId = global.__ACTIVE_TRACKING__!.deliveryId;

        if (!deliveryId) {
          const docRef = await addDoc(collection(db, "deliveries"), {
            projectId: id,
            material: "Doors from Italy",
            qty: "12 bifolds",
            needsForklift: true,
            driverLocation: newLoc,
            status: "en_route",
            timestamp: serverTimestamp(),
          });
          deliveryId = docRef.id;
          global.__ACTIVE_TRACKING__!.deliveryId = deliveryId;
        } else {
          await updateDoc(doc(db, "deliveries", deliveryId), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        }
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true }
    );

    global.__ACTIVE_TRACKING__!.watchId = watchId;

    return () => {
      if (global.__ACTIVE_TRACKING__?.watchId) {
        navigator.geolocation.clearWatch(global.__ACTIVE_TRACKING__!.watchId);
        global.__ACTIVE_TRACKING__!.watchId = null;
      }
    };
  }, [tracking, id]);

  // I’VE ARRIVED — FINAL
  const handleArrival = async () => {
    const deliveryId = global.__ACTIVE_TRACKING__?.deliveryId;
    if (deliveryId) {
      await updateDoc(doc(db, "deliveries", deliveryId), {
        status: "arrived",
        arrivedAt: serverTimestamp(),
      });
      global.__ACTIVE_TRACKING__!.deliveryId = null;
    }
    setTracking(false);
    alert("Arrival confirmed — thanks, driver!");
  };

  // Map init + blue dot (unchanged)
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
      .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h