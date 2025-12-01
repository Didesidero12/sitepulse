// app/project/[id]/gc/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Hard-coded token — guaranteed to bind client-side
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
        if (data.projectId === id && data.status === "en_route" && data.driverLocation) {
          list.push({ id: doc.id, ...data });
        }
      });
      setDeliveries(list);
    });
    return unsub;
  }, [id]);

  // Map init — BULLETPROOF TIMING
  useEffect(() => {
    if (!mapContainer.current) return;

    // Delay init to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!map.current) {
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [siteLocation.lng, siteLocation.lat],
          zoom: 14,
        });

        new mapboxgl.Marker({ color: "green" })
          .setLngLat([siteLocation.lng, siteLocation.lat])
          .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
          .addTo(map.current);

        // Initial markers
        deliveries.forEach((d) => addMarker(d));
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Update markers on deliveries change
  useEffect(() => {
    if (!map.current) return;

    deliveries.forEach((d) => addMarker(d));

    // Cleanup old markers
    markers.current.forEach((m, key) => {
      if (!deliveries.find((d) => d.id === key)) {
        m.remove();
        markers.current.delete(key);
      }
    });
  }, [deliveries]);

  const addMarker = (d: any) => {
    const loc = d.driverLocation;
    if (!loc) return;

    if (markers.current.has(d.id)) {
      markers.current.get(d.id)!.setLngLat([loc.lng, loc.lat]);
    } else {
      const marker = new mapboxgl.Marker({ color: "blue" })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div class="p-2 font-bold">
              <div>${d.material} • ${d.qty}</div>
              ${d.needsForklift ? "⚠️ FORKLIFT NEEDED" : ""}
            </div>
          `)
        )
        .addTo(map.current!);
      markers.current.set(d.id, marker);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-purple-700 p-8 text-center">
        <h1 className="text-6xl font-bold">SUPER WAR ROOM</h1>
        <p className="text-3xl mt-2">Project {id} — {deliveries.length} truck{deliveries.length !== 1 ? "s" : ""} en route</p>
      </div>

      <div className="flex-1 p-6">
        <div
          ref={mapContainer}
          className="w-full rounded-2xl bg-gray-800 overflow-hidden"
          style={{ height: "65vh" }}
        />
      </div>

      <div className="p-6 bg-gray-800 max-h-96 overflow-y-auto">
        <h2 className="text-4xl font-bold mb-4">Live Deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="text-center text-gray-400 text-2xl">No trucks en route</p>
        ) : (
          deliveries.map((d) => (
            <div key={d.id} className="bg-gray-700 p-4 rounded-xl mb-3">
              <div className="flex justify-between items-center">
                <div>
                  <strong className="text-2xl">{d.material}</strong> • {d.qty}
                  {d.needsForklift && <span className="ml-3 text-red-400">FORKLIFT</span>}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-400">
                    {d.eta || "Calculating..."}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}