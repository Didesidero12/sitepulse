// app/ticket/[ticketId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

export default function ClaimTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);

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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      {!claimed ? (
        <>
          <h1 className="text-6xl font-bold mb-10">CLAIM THIS DELIVERY</h1>
          <div className="bg-gray-800 p-12 rounded-3xl text-center max-w-2xl">
            <p className="text-5xl font-bold mb-6">{ticket.material}</p>
            <p className="text-4xl mb-10">{ticket.qty}</p>
            {ticket.needsForklift && <p className="text-red-400 text-3xl font-bold mb-10">FORKLIFT NEEDED</p>}
            <button
              onClick={claimAndTrack}
              className="bg-green-600 hover:bg-green-700 text-white text-5xl font-bold py-10 px-20 rounded-3xl shadow-2xl transition-all hover:scale-105"
            >
              CLAIM & START TRACKING
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-7xl font-black text-green-400 mb-12 animate-pulse">TRACKING ACTIVE</h1>
          {location && (
            <p className="text-4xl text-cyan-400 mb-8">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          )}
          <button
            onClick={() => setTracking(false)}
            className="bg-red-600 hover:bg-red-700 text-white text-4xl font-bold py-8 px-16 rounded-3xl"
          >
            STOP TRACKING
          </button>
        </>
      )}
    </div>
  );
}