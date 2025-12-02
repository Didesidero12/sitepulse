// app/ticket/[ticketId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function ClaimTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const loadTicket = async () => {
      const docSnap = await getDoc(doc(db, "tickets", ticketId as string));
      if (docSnap.exists()) {
        setTicket({ id: docSnap.id, ...docSnap.data() });
      }
    };
    loadTicket();
  }, [ticketId]);

  const claimTicket = async () => {
    await updateDoc(doc(db, "tickets", ticketId as string), {
      status: "en_route",
      driverId: "driver_001", // in real app, get from auth
      claimedAt: serverTimestamp(),
    });
    setClaimed(true);
    alert("Ticket claimed! Start tracking.");
  };

  if (!ticket) return <p>Loading...</p>;
  if (claimed) return <p className="text-6xl text-center mt-20">CLAIMED — GO!</p>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-8">CLAIM DELIVERY</h1>
      <div className="bg-gray-800 p-10 rounded-3xl text-center">
        <p className="text-4xl mb-4">{ticket.material}</p>
        <p className="text-3xl mb-8">{ticket.qty}</p>
        {ticket.needsForklift && <p className="text-red-400 text-2xl mb-8">FORKLIFT NEEDED</p>}
        <button
          onClick={claimTicket}
          className="bg-green-600 hover:bg-green-700 text-white text-4xl font-bold py-8 px-16 rounded-3xl"
        >
          CLAIM THIS DELIVERY
        </button>
      </div>
    </div>
  );
}