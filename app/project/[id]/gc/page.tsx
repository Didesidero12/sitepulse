// app/project/[id]/gc/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function SuperWarRoom() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [deliveries, setDeliveries] = useState<any[]>([]);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // Realtime deliveries with ETA + alerts
  useEffect(() => {
    const getDistance = (loc1: any, loc2: any) => {
      const R = 3958.8;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(loc2.lat - loc1.lat);
      const dLon = toRad(loc2.lng - loc1.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

      const q = query(
        collection(db, "tickets"),
        where("projectId", "==", id),
        where("status", "==", "en_route")
      );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      const seenEtas = new Set<number>();

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.driverLocation && data.status === "en_route") {
          const distanceMiles = getDistance(data.driverLocation, siteLocation);
          const etaMin = Math.round(distanceMiles / 0.833);

          if ([30, 15, 5].includes(etaMin) && !seenEtas.has(etaMin)) {
            seenEtas.add(etaMin);
            alert(`${data.material || "Delivery"} — ${etaMin} MIN OUT!`);
          }

          list.push({ id: doc.id, etaMin, distanceMiles, ...data });
        }
      });

      setDeliveries(list);
    });

    return () => unsub();
  }, [id]);

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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            <div className="bg-purple-700 p-8 text-center">
        <h1 className="text-6xl font-bold">SUPER WAR ROOM</h1>
        <p className="text-3xl mt-2">
          Project {id} — {deliveries.length} truck{deliveries.length !== 1 ? "s" : ""} en route
        </p>

        {/* QUICK TICKET BUTTON — FOR TESTING */}
        <button
          onClick={async () => {
            await addDoc(collection(db, "tickets"), {
              projectId: id,
              material: "Doors from Italy",
              qty: "12 bifolds",
              needsForklift: true,
              status: "pending",
              driverId: null,
            });
            alert("Quick ticket created!");
          }}
          className="mt-8 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold py-4 px-10 rounded-2xl shadow-2xl transition-all hover:scale-105"
        >
          + Quick Ticket (Test)
        </button>
      </div>

      <div className="flex-1 p-6">
        <div ref={mapContainer} className="w-full rounded-2xl bg-gray-800 overflow-hidden" style={{ height: "65vh" }} />
      </div>

      <div className="p-6 bg-gray-800 max-h-96 overflow-y-auto">
        <h2 className="text-4xl font-bold mb-6 text-center">Live Deliveries</h2>

        {deliveries.length === 0 ? (
          <p className="text-center text-gray-400 text-2xl mt-10">No trucks en route</p>
        ) : (
          [...deliveries]
            .sort((a, b) => (a.etaMin || Infinity) - (b.etaMin || Infinity))
            .map((d) => (
              <div
                key={d.id}
                className="bg-gray-800 p-6 rounded-2xl mb-5 shadow-2xl border-l-8 transition-all hover:scale-[1.02]"
                style={{
                  borderLeftColor:
                    d.etaMin > 30 ? "#ef4444" : d.etaMin > 10 ? "#f59e0b" : "#22c55e",
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-3xl font-black text-white">
                      {d.material} • {d.qty}
                    </div>
                    {d.needsForklift && (
                      <span className="inline-block mt-3 px-4 py-2 bg-red-600 text-white text-lg font-bold rounded-full animate-pulse">
                        FORKLIFT NEEDED
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-black text-white leading-tight">
                      {d.etaMin <= 0 ? "ON SITE" : `${d.etaMin}`}
                    </div>
                    <div className="text-2xl text-gray-300">
                      {d.etaMin <= 0 ? "" : "min"}
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