// app/project/[id]/gc/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import generateShortId from '@/utils/generateShortId';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function SuperWarRoom() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "pending">("live");
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);

  const siteLocation = { lat: 45.5231, lng: -122.6765 };

// LIVE TRUCKS + GC Milestone Alerts (Banner Version)
useEffect(() => {
  const q = query(
    collection(db, "tickets"),
    where("projectId", "==", id),
    where("status", "==", "en_route")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    const newAlerts: string[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      const ticketId = doc.id;

      // GC Milestone Alerts (Banner)
      if (data.gcNotified30min && !data.gcAlert30minShown) {
        newAlerts.push(`Delivery Inbound: 30 min out! — ${data.material || 'Load'} • ${data.qty || ''}`);
        updateDoc(doc.ref, { gcAlert30minShown: true });
      }
      if (data.gcNotified5min && !data.gcAlert5minShown) {
        newAlerts.push(`Delivery Arriving Soon: 5 min out! — ${data.material || 'Load'} • ${data.qty || ''}`);
        updateDoc(doc.ref, { gcAlert5minShown: true });
      }

      if (data.driverLocation) {
        list.push({ id: ticketId, ...data });
      }
    });

    setDeliveries(list);
    if (newAlerts.length > 0) {
      setActiveAlerts((prev) => [...prev, ...newAlerts]);  // Append to existing
      // Optional sound
      // new Audio('/alert-sound.mp3').play().catch(() => {});
    }
  });

  return unsub;
}, [id]);

//Auto-Clear Old Alerts
useEffect(() => {
  if (activeAlerts.length > 0) {
    const timer = setTimeout(() => {
      setActiveAlerts([]);
    }, 15000);
    return () => clearTimeout(timer);
  }
}, [activeAlerts]);

  // PENDING TICKETS
  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("projectId", "==", id),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, shortId: doc.data().shortId, ...doc.data() }));
      setPendingTickets(list);
    });

    return unsub;
  }, [id]);

// QUICK TICKET — FINAL, WORKS EVERYWHERE
const createQuickTicket = async () => {
  const shortId = generateShortId(7);
  await addDoc(collection(db, "tickets"), {
    projectId: id,
    material: "Doors from Italy",
    qty: "12 bifolds",
    status: "pending",
    driverId: null,
    shortId,
    createdAt: serverTimestamp(),
    // New / Updated Fields
    projectName: "Kennewick Project X",  // Pull from project doc later
    projectAddress: "602 N Colorado St Suite 110, Kennewick, WA 99336",
    siteCoords: {
      lat: 46.21667,
      lng: -119.22323,
    },
    csiDivision: "08 - Doors and Windows",
    loadingEquipment: "Forklift",  // ← Replaces needsForklift — flexible string
    projectContacts: [
      { name: "John GC", phone: "509-123-4567", role: "Superintendent" },
      { name: "Jane PM", phone: "509-987-6543", role: "Project Manager" },
    ],
  });

  const shareUrl = `${window.location.origin}/ticket/${shortId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "SitePulse Delivery",
          text: "Doors from Italy • 12 bifolds • Forklift needed",
          url: shareUrl,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      // BULLETPROOF COPY — WORKS ON HTTP, HTTPS, EVERYWHERE
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert(`TICKET READY — LINK COPIED!\n\n${shareUrl}\n\nSend it to the driver`);
    }
  };

  // MAP WITH LIVE CYAN DOTS
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
      <div className="bg-purple-700 p-8 text-center">
        <h1 className="text-6xl font-bold">SUPER WAR ROOM</h1>
        <p className="text-3xl mt-2">
          Project {id} — {deliveries.length} truck{deliveries.length !== 1 ? "s" : ""} en route
        </p>

        <button onClick={createQuickTicket} className="mt-8 bg-green-600 text-white text-2xl font-bold py-4 px-10 rounded-2xl">
          + Quick Ticket
        </button>

        <div className="flex justify-center gap-16 mt-12">
          <button onClick={() => setActiveTab("live")} className={activeTab === "live" ? "text-cyan-400 border-b-4 border-cyan-500" : "text-gray-500"}>LIVE ({deliveries.length})</button>
          <button onClick={() => setActiveTab("pending")} className={activeTab === "pending" ? "text-yellow-400 border-b-4 border-yellow-500" : "text-gray-500"}>PENDING ({pendingTickets.length})</button>
        </div>
      </div>

{activeTab === "live" && (
  <div className="flex-1 p-6 relative">
    {/* Milestone Alert Banners */}
    {activeAlerts.map((alert, i) => (
      <div
        key={i}
        className={`mb-4 p-4 rounded-lg text-white font-bold text-center shadow-lg transition-all ${
          alert.includes('30 min') ? 'bg-yellow-600' : 'bg-red-600'
        }`}
        style={{ animation: 'fadeIn 0.5s, fadeOut 10s 5s forwards' }}  // Fade out after 10s
      >
        🚛 {alert}
      </div>
    ))}

    <div ref={mapContainer} className="w-full h-full rounded-2xl bg-gray-800 overflow-hidden" style={{ height: "70vh" }} />
  </div>
)}

      {activeTab === "pending" && (
        <div className="p-6">
          {pendingTickets.length === 0 ? (
            <p className="text-center text-gray-400 text-3xl mt-20">No pending tickets</p>
          ) : (
            <div className="space-y-6">
              {pendingTickets.map((t) => (
                <div key={t.id} className="bg-yellow-900 bg-opacity-40 p-8 rounded-3xl border-2 border-yellow-600">
                  <p className="text-4xl font-bold text-yellow-300">{t.material}</p>
                  <p className="text-3xl text-gray-300">{t.qty}</p>
                  {t.needsForklift && <p className="text-red-400 text-2xl font-bold mt-4">FORKLIFT NEEDED</p>}
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/ticket/${t.shortId || t.id}`;
                        
                        // BULLETPROOF COPY — WORKS ON HTTP, HTTPS, EVERYWHERE
                        const textarea = document.createElement("textarea");
                        textarea.value = url;
                        textarea.style.position = "fixed";
                        textarea.style.opacity = "0";
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        
                        alert("Link copied!\n" + url);
                      }}
                      className="mt-6 bg-yellow-600 hover:bg-yellow-700 text-white text-2xl font-bold py-4 px-10 rounded-xl transition-all hover:scale-105"
                    >
                      Share Again
                    </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}