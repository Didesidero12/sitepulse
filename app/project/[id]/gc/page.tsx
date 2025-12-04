"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import generateShortId from '@/utils/generateShortId';

export default function SuperWarRoom() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "pending">("live");

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // LIVE TRUCKS
  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("projectId", "==", id),
      where("status", "==", "en_route")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.driverLocation) {
          list.push({ id: doc.id, ...data });
        }
      });
      setDeliveries(list);
    });

    return unsub;
  }, [id]);

  // PENDING TICKETS
  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("projectId", "==", id),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setPendingTickets(list);
    });

    return unsub;
  }, [id]);

  // MAP + LIVE DOTS
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

    if ((map.current as any)._driverMarkers) {
      (map.current as any)._driverMarkers.forEach((m: any) => m.remove());
    }
    (map.current as any)._driverMarkers = [];

    deliveries.forEach((d) => {
      if (d.driverLocation?.lng && d.driverLocation?.lat) {
        const marker = new mapboxgl.Marker({ color: "cyan", scale: 1.5 })
          .setLngLat([d.driverLocation.lng, d.driverLocation.lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${d.material || "TRUCK"}</strong>`))
          .addTo(map.current!);
        (map.current as any)._driverMarkers.push(marker);
      }
    });
  }, [deliveries]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* HEADER */}
      <div className="bg-purple-700 p-8 text-center">
        <h1 className="text-6xl font-bold">SUPER WAR ROOM</h1>
        <p className="text-3xl mt-2">
          Project {id} — {deliveries.length} truck{deliveries.length !== 1 ? "s" : ""} en route
        </p>

        {/* QUICK TICKET */}
        <button
          onClick={async () => {
            const shortId = generateShortId(7);
            await addDoc(collection(db, "tickets"), {
              projectId: id,
              material: "Doors from Italy",
              qty: "12 bifolds",
              needsForklift: true,
              status: "pending",
              driverId: null,
              shortId,
              createdAt: serverTimestamp(),
            });

            const shareUrl = `${window.location.origin}/ticket/${shortId}`;

            if (navigator.share) {
              try {
                await navigator.share({
                  title: "SitePulse Delivery",
                  text: "Doors from Italy • 12 bifolds",
                  url: shareUrl,
                });
              } catch (err) {
                console.log("Share cancelled");
              }
            } else {
              const textarea = document.createElement("textarea");
              textarea.value = shareUrl;
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              document.body.removeChild(textarea);
              alert(`TICKET READY — LINK COPIED!\n\n${shareUrl}`);
            }
          }}
          className="mt-8 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold py-4 px-10 rounded-2xl shadow-2xl transition-all hover:scale-105"
        >
          + Quick Ticket
        </button>

        {/* TABS */}
        <div className="flex justify-center gap-16 mt-12">
          <button
            onClick={() => setActiveTab("live")}
            className={`text-4xl font-bold pb-3 border-b-4 transition-all ${
              activeTab === "live" ? "border-cyan-500 text-cyan-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            LIVE TRUCKS ({deliveries.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`text-4xl font-bold pb-3 border-b-4 transition-all ${
              activeTab === "pending" ? "border-yellow-500 text-yellow-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            PENDING ({pendingTickets.length})
          </button>
        </div>
      </div>

      {/* LIVE TAB */}
      {activeTab === "live" && (
        <>
          <div className="flex-1 p-6">
            <div ref={mapContainer} className="w-full rounded-2xl bg-gray-800 overflow-hidden" style={{ height: "65vh" }} />
          </div>

          <div className="p-6 bg-gray-800 max-h-96 overflow-y-auto">
            <h2 className="text-4xl font-bold mb-6 text-center">Live Deliveries</h2>
            {deliveries.length === 0 ? (
              <p className="text-center text-gray-400 text-2xl mt-10">No trucks en route</p>
            ) : (
              deliveries.map((d) => (
                <div key={d.id} className="bg-gray-800 p-6 rounded-2xl mb-5 shadow-2xl border-l-8" style={{ borderLeftColor: "#22c55e" }}>
                  <div className="text-3xl font-black">{d.material} • {d.qty}</div>
                  {d.needsForklift && <span className="inline-block mt-2 px-4 py-2 bg-red-600 text-white text-lg font-bold rounded-full animate-pulse">FORKLIFT NEEDED</span>}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* PENDING TAB */}
      {activeTab === "pending" && (
        <div className="p-6">
          {pendingTickets.length === 0 ? (
            <p className="text-center text-gray-400 text-3xl mt-20">No pending tickets</p>
          ) : (
            <div className="space-y-6">
              {pendingTickets.map((t) => {
                const shareUrl = `${window.location.origin}/ticket/${t.shortId || t.id}`;
                const handleShare = async () => {
                  if (navigator.share) {
                    try { await navigator.share({ title: "Delivery Ticket", text: t.material, url: shareUrl }); }
                    catch (err) { console.log("Share cancelled"); }
                  } else {
                    const textarea = document.createElement("textarea");
                    textarea.value = shareUrl;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand("copy");
                    document.body.removeChild(textarea);
                    alert("Link copied!\n" + shareUrl);
                  }
                };

                return (
                  <div key={t.id} className="bg-yellow-900 bg-opacity-40 p-8 rounded-3xl border-2 border-yellow-600">
                    <p className="text-4xl font-bold text-yellow-300">{t.material}</p>
                    <p className="text-3xl text-gray-300 mt-2">{t.qty}</p>
                    {t.needsForklift && <p className="text-red-400 text-2xl font-bold mt-4">FORKLIFT NEEDED</p>}
                    <button onClick={handleShare} className="mt-6 bg-yellow-600 hover:bg-yellow-700 text-white text-2xl font-bold py-4 px-10 rounded-xl">
                      Share Ticket
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}