// app/dashboard/page.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase'; 
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const hours = Array.from({ length: 10 }, (_, i) => `${i + 7}:00`);

export default function Dashboard() {
  const [deliveries, setDeliveries] = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveries"), (snap) => {
      const data = {};
      snap.forEach((doc) => {
        const d = doc.data();
        data[`${d.day}-${d.time}`] = { ...d, id: doc.id };
      });
      setDeliveries(data);
    });
    return unsub;
  }, []);

  const book = async (day, time) => {
    const material = prompt("Material (e.g., Doors – Italy)");
    const notes = prompt("Quantity / notes (e.g., 12 bifolds, call Joey 503-555-1234)");
    if (material) {
      await addDoc(collection(db, "deliveries"), {
        day,
        time,
        material,
        notes: notes || "",
        timestamp: serverTimestamp(),
      });
    }
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-bold text-center mb-2">HOFFMAN-PILOT</h1>
        <p className="text-center text-orange-400 text-xl mb-8">Live Delivery Whiteboard</p>

        <div className="overflow-x-auto rounded-2xl shadow-2xl">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gray-800">
                {days.map((d) => (
                  <th key={d} className="p-4 text-2xl font-bold border-r border-gray-700 last:border-r-0">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour} className="border-t-4 border-gray-800">
                  {days.map((day) => {
                    const key = `${day}-${hour}`;
                    const delivery = deliveries[key];
                    const isSelected = selected === key;

                    return (
                      <td
                        key={key}
                        onClick={() => !delivery && setSelected(key)}
                        className={`p-4 h-32 text-center transition-all cursor-pointer
                          ${delivery ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-800 hover:bg-gray-700'}
                          ${isSelected ? 'ring-4 ring-blue-500' : ''}`}
                      >
                        {delivery ? (
                          <div>
                            <div className="font-bold text-lg">{hour}</div>
                            <div className="font-semibold">{delivery.material}</div>
                            <div className="text-sm opacity-90">{delivery.notes}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500">{hour}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center mt-8 text-gray-400">
          Subs open this link on their phone → tap any empty slot → book delivery → super sees it instantly.
        </p>
      </div>
    </div>
  );
}