// app/project/[id]/gc/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
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

  // Realtime deliveries from Firestore
  useEffect(() => {
    const q = query(collection(db, "deliveries"), where("projectId", "==", id));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setDeliveries(list);
    });
    return unsub;
  }, [id]);

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

    // Update markers for each delivery
    deliveries.forEach((d) => {
      const loc = d.driverLocation;
      if (!loc) return;

      if (markers.current.has(d.id)) {
        markers.current.get(d.id)!.setLngLat([loc.lng, loc.lat]);
      } else {
        const marker = new mapboxgl.Marker({ color: "blue" })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <strong>${d.material}</strong><br>
              ${d.qty}<br>
              ${d.needsForklift ? "⚠️ FORKLIFT NEEDED" : ""}
            </div>
          `))
          .addTo(map.current!);
        markers.current.set(d.id, marker);
      }
    });

    // Clean up removed deliveries
    markers.current.forEach((marker, dId) => {
      if (!deliveries.some(d => d.id === dId)) {
        marker.remove();
        markers.current.delete(dId);
      }
    });
  }, [deliveries]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-purple-700 p-6 text-center">
        <h1 className="text-5xl font-bold">SUPER WAR ROOM</h1>
        <p className="text-2xl">Project {id} — {deliveries.length} trucks en route</p>
      </div>

        {/* MAP — BULLETPROOF CONTAINER */}
        <div 
          className="w-full bg-gray-800 rounded-2xl overflow-hidden" 
          style="height: 600px"
        >
          <div ref={mapContainer} className="w-full h-full" />
        </div>

      <div className="bg-gray-800 p-6 max-h-96 overflow-y-auto">
        <h2 className="text-3xl font-bold mb-4">Incoming Deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="text-center text-gray-400">No trucks en route</p>
        ) : (
          <div className="space-y-4">
            {deliveries.sort((a, b) => (a.eta || 0) - (b.eta || 0)).map((d) => (
              <div key={d.id} className="bg-gray-700 p-4 rounded-xl">
                <div className="flex justify-between">
                  <div>
                    <strong className="text-xl">{d.material}</strong><br />
                    {d.qty} • {d.needsForklift && "⚠️ Forklift"}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      {d.eta || "Calculating..."}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}