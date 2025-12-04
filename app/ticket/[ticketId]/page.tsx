// app/ticket/[ticketId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function ClaimTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const loadTicket = async () => {
      if (!ticketId) return;

      try {
        let q = query(collection(db, "tickets"), where("shortId", "==", ticketId as string));
        let snap = await getDocs(q);

        if (snap.empty) {
          const docRef = doc(db, "tickets", ticketId as string);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) snap = { docs: [docSnap] } as any;
        }

        if (!snap.empty) {
          const data = snap.docs[0].data();
          setTicket({ firestoreId: snap.docs[0].id, shortId: ticketId, ...data });
        } else {
          alert("Ticket not found");
        }
      } catch (err) {
        console.error(err);
        alert("Error loading ticket");
      } finally {
        setLoading(false);
      }
    };
    loadTicket();
  }, [ticketId]);

      const claimTicket = async () => {
        try {
          await updateDoc(doc(db, "tickets", ticket.firestoreId), {
            status: "en_route",
            driverId: "driver_001",
            claimedAt: serverTimestamp(),
          });
          setClaimed(true);
        } catch (err) {
          alert("Failed to claim: " + err.message);
        }
      };

  if (claimed) {
    // FULL SCREEN MAP — NO IFRAME, NO TINY BOX, NO WHITE SCREEN
    if (typeof window !== 'undefined') {
      window.location.href = `/tracking?ticketId=${ticket.firestoreId}`;
    }
    return null;
  }

  // ← THIS IS THE CLAIM SCREEN — KEEP IT!
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-10">CLAIM THIS DELIVERY</h1>
      {ticket ? (
        <div className="bg-gray-800 p-12 rounded-3xl text-center max-w-2xl">
          <p className="text-5xl font-bold mb-6">{ticket.material || "Delivery"}</p>
          <p className="text-4xl mb-10">{ticket.qty || "—"}</p>
          {ticket.needsForklift && (
            <p className="text-red-400 text-3xl font-bold mb-10">FORKLIFT NEEDED</p>
          )}
          <button
            onClick={claimTicket}
            className="bg-green-600 hover:bg-green-700 text-white text-5xl font-bold py-10 px-20 rounded-3xl shadow-2xl transition-all hover:scale-105"
          >
            CLAIM THIS DELIVERY
          </button>
        </div>
      ) : (
        <p className="text-4xl text-gray-400">Loading ticket details...</p>
      )}
    </div>
  );
}