// app/dashboard/page.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const times = ['7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];

export default function Dashboard() {
  const [deliveries, setDeliveries] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveries"), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => {
        const d = doc.data();
        const key = `${d.day}-${d.time}`;
        data[key] = { ...d, id: doc.id };
      });
      setDeliveries(data);
    });
    return unsub;
  }, []);

  const bookSlot = async (day, time) => {
    const material = prompt("Material (e.g., Drywall – PCI)");
    const qty = prompt("Quantity / notes (e.g., 40 sheets)");
    if (material) {
      await addDoc(collection(db, "deliveries"), {
        day,
        time,
        material,
        qty,
        bookedBy: "Sub",
        timestamp: serverTimestamp(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto overflow-x-auto rounded-2xl shadow-2xl">
        <table className="w-full table-fixed text-2xl text-center border-4 border-gray-600">
          <thead className="bg-gray-700">
            <tr>
              {days.map(d => <th key={d} className="p-4 border-r-4 border-gray-600 last:border-r-0">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {times.map(time => (
              <tr key={time} className="border-t-4 border-gray-600">
                {days.map(day => {
                  const key = `${day}-${time}`;
                  const delivery = deliveries[key];
                  return (
                    <td
                      key={key}
                      className={`p-6 h-24 cursor-pointer transition-all
                        ${delivery ? 'bg-orange-600 hover:bg-orange-500' : 'hover:bg-gray-700'}
                        border-l-4 border-gray-600 first:border-l-0`}
                      onClick={() => !delivery && bookSlot(day, time)}
                    >
                      {delivery ? (
                        <div>
                          <div className="font-bold">{time}</div>
                          <div>{delivery.material}</div>
                          <div className="text-sm">{delivery.qty}</div>
                        </div>
                      ) : (
                        <div className="text-gray-500">{time}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}