// app/dashboard/page.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const hours = Array.from({ length: 10 }, (_, i) => `${i + 7}:00`);

export default function Dashboard() {
  const [deliveries, setDeliveries] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveries"), (snap) => {
      const data = {};
      snap.forEach((doc) => {
        const d = doc.data();
        data[`${d.day}-${d.time}`] = d;
      });
      setDeliveries(data);
    });
    return unsub;
  }, []);

  const bookSlot = async (day, time) => {
    const material = prompt("Material (e.g., Doors – Italy)");
    const notes = prompt("Notes / qty");
    if (material) {
      await addDoc(collection(db, "deliveries"), {
        day,
        time,
        material,
        notes: notes || "",
        timestamp: serverTimestamp(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-6xl text-center mb-8">HOFFMAN-PILOT – LIVE WHITEBOARD</h1>

      <div className="max-w-6xl mx-auto overflow-x-auto">
        <table className="w-full table-fixed border-4 border-gray-700">
          <thead className="bg-gray-800">
            <tr>
              {days.map((d) => (
                <th key={d} className="p-4 text-2xl border-r-4 border-gray-700 last:border-r-0">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                {days.map((day) => {
                  const key = `${day}-${hour}`;
                  const d = deliveries[key];
                  return (
                    <td
                      key={key}
                      onClick={() => !d && bookSlot(day, hour)}
                      className={`p-8 h-32 text-center cursor-pointer transition-all border-2 border-gray-700
                        ${d ? 'bg-orange-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                      {d ? (
                        <div>
                          <div className="font-bold">{hour}</div>
                          <div>{d.material}</div>
                          <div className="text-sm">{d.notes}</div>
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
    </div>
  );
}