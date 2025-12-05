// app/ticket/[ticketId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function ClaimTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

    const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-122.4194, 37.7749],
      zoom: 15,
    });
  }, []);

  // Update marker when location changes
  useEffect(() => {
    if (!map.current || !location) return;

    if (marker.current) {
      marker.current.setLngLat([location.lng, location.lat]);
    } else {
      marker.current = new mapboxgl.Marker({ color: "#00FFFF" })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);
    }

    map.current.easeTo({ center: [location.lng, location.lat] });
  }, [location]);

  useEffect(() => {
    const loadTicket = async () => {
      if (!ticketId) return;

      try {
        let q = query(collection(db, "tickets"), where("shortId", "==", ticketId as string));
        let snap = await getDocs(q);

        if (snap.empty) {
          const docSnap = await getDoc(doc(db, "tickets", ticketId as string));
          if (docSnap.exists()) {
            snap = { docs: [docSnap] } as any;
          }
        }

        if (!snap.empty) {
          const data = snap.docs[0].data();
          setTicket({ firestoreId: snap.docs[0].id, ...data });
        }
      } finally {
        setLoading(false);
      }
    };
    loadTicket();
  }, [ticketId]);

  const claimAndTrack = async () => {
    if (!ticket?.firestoreId) return;

    try {
      await updateDoc(doc(db, "tickets", ticket.firestoreId), {
        status: "en_route",
        driverId: "driver_001",
        claimedAt: serverTimestamp(),
      });
      setClaimed(true);
      setTracking(true);

      // START GPS IMMEDIATELY
      navigator.geolocation.watchPosition(
        async (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(newLoc);
          await updateDoc(doc(db, "tickets", ticket.firestoreId), {
            driverLocation: newLoc,
            lastUpdate: serverTimestamp(),
          });
        },
        (err) => alert("GPS error: " + err.message),
        { enableHighAccuracy: true }
      );
    } catch (err) {
      alert("Failed to claim");
    }
  };

  if (loading) return <p className="text-6xl text-center mt-40">Loading...</p>;
  if (!ticket) return <p className="text-6xl text-red-400 text-center mt-40">Invalid Ticket</p>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* HEADER */}
      <div className="bg-cyan-600 p-6 text-center">
        <h1 className="text-5xl font-black">DRIVER MODE</h1>
      </div>

      {/* MAP — ONLY WHEN TRACKING */}
      {tracking ? (
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-800">
          <p className="text-4xl text-gray-400">Ready to start tracking</p>
        </div>
      )}

      {/* CLAIM OR TRACKING SCREEN */}
      {!claimed ? (
        <div className="p-8">
          <h1 className="text-6xl font-bold mb-10 text-center">CLAIM THIS DELIVERY</h1>
          <div className="bg-gray-800 p-12 rounded-3xl text-center max-w-2xl mx-auto">
            <p className="text-5xl font-bold mb-6">{ticket.material}</p>
            <p className="text-4xl mb-10">{ticket.qty}</p>
            {ticket.needsForklift && <p className="text-red-400 text-3xl font-bold mb-10">FORKLIFT NEEDED</p>}
            <button
              onClick={claimAndTrack}
              className="bg-green-600 hover:bg-green-700 text-white text-5xl font-bold py-12 px-32 rounded-3xl shadow-2xl transition-all hover:scale-105"
            >
              CLAIM & START TRACKING
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center">
          <h1 className="text-7xl font-black text-green-400 mb-12 animate-pulse">TRACKING ACTIVE</h1>
          {location && (
            <p className="text-3xl text-cyan-400 mb-8">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          )}
          <button
            onClick={() => setTracking(false)}
            className="bg-red-600 hover:bg-red-700 text-white text-4xl font-bold py-8 px-20 rounded-3xl"
          >
            STOP TRACKING
          </button>
        </div>
      )}
    </div>
  );
}