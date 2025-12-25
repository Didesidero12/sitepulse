"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function DigitalWhiteboard() {
  const { id } = useParams();
  const projectId = id as string;

  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // ← SLOTS STATE HERE
  const [slots, setSlots] = useState<any[]>([]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  const times = [];
  for (let hour = 6; hour < 18; hour++) {
    times.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 17) times.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  // ← NOW getSlotStatus can use slots
  const getSlotStatus = (dateStr: string, timeStr: string) => {
    return slots.find(s => s.date === dateStr && s.time === timeStr) || { status: 'available' };
  };

  // TEMP: Use current projectId — replace with real from params later

useEffect(() => {
  if (!projectId) return;

  const slotsRef = collection(db, 'projects', projectId, 'deliverySlots');

  const unsub = onSnapshot(slotsRef, (snap) => {
    const loadedSlots: any[] = [];
    snap.forEach((doc) => {
      loadedSlots.push({ id: doc.id, ...doc.data() });
    });
    setSlots(loadedSlots);
    console.log('Loaded slots:', loadedSlots); // Safe now
  }, (error) => {
    console.error('Firestore error:', error);
  });

  return unsub;
}, [projectId]);


  return (
    <div style={{ padding: '1rem', height: '100vh', backgroundColor: '#111827', color: 'white', overflow: 'hidden' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>
        Digital Whiteboard
      </h1>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1rem 0' }}>
        <button onClick={() => setStartDate(addDays(startDate, -7))} style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', borderRadius: '0.5rem' }}>
          ← Previous Week
        </button>
        <button onClick={() => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))} style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', borderRadius: '0.5rem' }}>
          This Week
        </button>
        <button onClick={() => setStartDate(addDays(startDate, 7))} style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', borderRadius: '0.5rem' }}>
          Next Week →
        </button>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', height: 'calc(100% - 80px)' }}>
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');

          return (
            <div key={dateStr} style={{ minWidth: '220px', marginRight: '1rem', borderRight: '1px solid #374151' }}>
              <h2 style={{ textAlign: 'center', padding: '1rem 0', fontWeight: 'bold', backgroundColor: '#1F2937' }}>
                {format(day, 'EEE')}<br />
                {format(day, 'MMM d')}
              </h2>

              <div>
                {times.map((time) => {
                  const dateStr = format(day, 'yyyy-MM-dd');  // ← Move this line inside the map, but before getSlotStatus
                  console.log('Looking for slot:', dateStr, time); // temp debug
                  const slot = getSlotStatus(dateStr, time);
                  const isTaken = slot.status === 'taken';

                  return (
                    <div
                      key={time}
                      style={{
                        height: '60px',
                        padding: '0.5rem',
                        borderBottom: '1px solid #374151',
                        backgroundColor: isTaken ? '#374151' : '#166534',
                        cursor: isTaken ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isTaken ? 0.7 : 1,
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        if (!isTaken) {
                          alert(`Book slot: ${format(day, 'MMM d')} at ${time}`);
                        }
                      }}
                    >
                      {isTaken ? (
                        <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                          <div style={{ fontWeight: 'bold' }}>{slot.material || 'Delivery'}</div>
                          <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{time}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
                          {time}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}