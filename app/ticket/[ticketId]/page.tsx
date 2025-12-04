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

  if (claimed) return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* HEADER */}
      <div className="bg-cyan-600 p-6 text-center">
        <h1 className="text-5xl font-black">DRIVER MODE</h1>
      </div>

      {/* LIVE MAP — EMBEDDED */}
      <div className="flex-1">
        <iframe
          src={`/tracking?ticketId=${ticket.firestoreId}`}
          className="w-full h-full border-0"
          title="Live Tracking"
        />
      </div>

      {/* UNCLAIM BUTTON */}
      <div className="p-6">
        <button
          onClick={async () => {
            if (confirm("Unclaim this ticket?")) {
              await updateDoc(doc(db, "tickets", ticket.firestoreId), {
                status: "pending",
                driverId: null,
                claimedAt: null,
                driverLocation: null,
              });
              alert("Unclaimed!");
              window.location.reload();
            }
          }}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-4xl font-bold py-8 rounded-3xl"
        >
          Wrong ticket? Unclaim
        </button>
      </div>
    </div>
  );

  // ← DELETE EVERYTHING BELOW THIS LINE (the second return)