// app/project/[id]/gc/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function SuperWarRoom() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // Realtime deliveries
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveries"), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.projectId === id && data.status === "en_route") {
          const etaMin = data.driverLocation
            ? Math.round(getDistance(data.driverLocation, siteLocation) / 0.833) // ~50 mph avg
            : null;
          list.push({ id: doc.id, etaMin, ...data });
        }
      });
      setDeliveries(list);
    });
    return unsub;
  }, [id]);

  const getDistance = (loc1: any, loc2: any) => {
    const R = 3958.8;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(loc2.lat - loc1.lat);
    const dLon = toRad(loc2.lng - loc1.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Map + live markers
  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
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
    }

    deliveries.forEach((d) => {
      const loc = d.driverLocation;
      if (!loc) return;

      const color = d.etaMin === null ? "gray" : d.etaMin <= 0 ? "green" : d.etaMin > 30 ? "red" : "yellow";

      if (markers.current.has(d.id)) {
        markers.current.get(d.id)!.setLngLat([loc.lng, loc.lat]);
      } else {
        const marker = new mapboxgl.Marker({ color })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(
            new mapboxgl.Popup().setHTML(`
              <div class="p-3 font-bold">
                <div>${d.material} • ${d.qty}</div>
                ${d.needsForklift ? "⚠️ FORKLIFT" : ""}
                <div class="${d.etaMin > 30 ? "text-red-600" : d.etaMin > 0 ? "text-yellow-600" : "text-green-600"}">
                  ETA: ${d.etaMin === null ? "—" : d.etaMin <= 0 ? "ON SITE" : `${d.etaMin} min`}
                </div>
              </div>
            `)
          )
          .addTo(map.current!);
        markers.current.set(d.id, marker);
      }
    });

    markers.current.forEach((m, key) => {
      if (!deliveries.find(d => d.id === key)) m.remove();
    });
  }, [deliveries]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-purple-800 p-8 text-center">
        <h1 className="text-6xl font-bold">SUPER WAR ROOM</h1>
        <p className="text-3xl mt-2">Project {id} — {deliveries.length} truck{deliveries.length !== 1 ? "s" : ""} en route</p>
      </div>

      <div ref={mapContainer} className="w-full h-screen" />

      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-6 max-h-96 overflow-y-auto">
        {deliveries
          .sort((a, b) => (a.etaMin || 999) - (b.etaMin || 999))
          .map((d) => (
            <div key={d.id} className="bg-gray-700 p-4 rounded-xl mb-3 flex justify-between items-center">
              <div>
                <strong className="text-2xl">{d.material}</strong> • {d.qty}
                {d.needsForklift && <span className="ml-3 text-red-400">FORKLIFT</span>}
              </div>
              <div className={`text-3xl font-bold ${d.etaMin > 30 ? "text-red-500" : d.etaMin > 0 ? "text-yellow-500" : "text-green-500"}`}>
                {d.etaMin === null ? "—" : d.etaMin <= 0 ? "ON SITE" : `${d.etaMin} min`}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}