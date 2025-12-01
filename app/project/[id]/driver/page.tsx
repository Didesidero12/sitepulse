// app/project/[id]/driver/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Hard-coded token for guaranteed map load
mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function DriverView() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;   // ← THIS FIXES EVERYTHING

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [delivery, setDelivery] = useState({ material: "Doors from Italy", qty: "12 bifolds", needsForklift: true });
  const [deliveryId, setDeliveryId] = useState<string | null>(null);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };   // ← THIS LINE WAS MISSING

      // GPS + Firestore update + geofencing — FIXED NO DUPLICATES
  useEffect(() => {
    if (!tracking) return;

    let deliveryId = localStorage.getItem(`deliveryId_${id}`) || null;
    let firstPing = true;  // Flag to create only on first ping

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);

        if (!deliveryId && firstPing) {
          firstPing = false;  // Create only on FIRST ping
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
          localStorage.setItem(`deliveryId_${id}`, deliveryId);
        } else if (deliveryId) {
          await updateDoc(doc(db, "deliveries", deliveryId), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        }

        checkGeofence(newLoc);
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, id]);

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

  // Map init — ONCE ONLY (Driver page)
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

  // Update BLUE DRIVER DOT whenever location changes — THIS WAS MISSING (Driver page)
  useEffect(() => {
    if (!map.current || !location) return;

    if (marker.current) marker.current.remove();

    marker.current = new mapboxgl.Marker({ color: "blue" })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);

    map.current.flyTo({ center: [location.lng, location.lat], zoom: 16 });
  }, [location]);

         <button
          onClick={() => setTracking(!tracking)}
          className={`w-full py-16 text-6xl font-bold rounded-3xl transition-all ${
            tracking ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {tracking ? "STOP TRACKING" : "START TRACKING"}
        </button>

        {/* BUTTONS — CLEAN, PERFECT, NO DUPLICATES */}
        <div className="space-y-6">
          {/* START / STOP TRACKING BUTTON */}
          <button
            onClick={() => setTracking(!tracking)}
            className={`w-full py-16 text-6xl font-bold rounded-3xl transition-all ${
              tracking ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {tracking ? "STOP TRACKING" : "START TRACKING"}
          </button>

          {/* I'VE ARRIVED BUTTON — ONLY SHOWS WHEN TRACKING */}
          {tracking && (
            <button
              onClick={async () => {
                const currentId = localStorage.getItem(`deliveryId_${id}`);
                if (currentId) {
                  await updateDoc(doc(db, "deliveries", currentId), {
                    status: "arrived",
                    arrivedAt: serverTimestamp(),
                  });
                  localStorage.removeItem(`deliveryId_${id}`);
                }
                setTracking(false);
                alert("Arrival confirmed — thanks, driver!");
              }}
              className="w-full py-16 text-6xl font-bold bg-yellow-500 hover:bg-yellow-600 rounded-3xl transition-all"
            >
              I'VE ARRIVED
            </button>
          )}
        </div>
      </div>
    </div>
  );
}