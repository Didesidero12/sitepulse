  "use client";

 import { useParams } from 'next/navigation';
  import { useState, useEffect } from 'react';
  import { addDays, format, startOfWeek } from 'date-fns';
  import { db } from '@/lib/firebase';
  import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    addDoc, 
    serverTimestamp,
    getDocs,
    updateDoc,
    deleteDoc   // ← ADD THIS
  } from 'firebase/firestore';
  import generateShortId from '@/utils/generateShortId'; // if using shortId

  export default function DigitalWhiteboard() {
    const { id } = useParams();  // ← GET PROJECT ID FROM URL
    const projectId = id as string;  // ← DYNAMIC!

    // If no ID (e.g., direct access), fallback or redirect
    if (!projectId) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
        No project selected — access via War Room link
      </div>;
    }

  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [bookingMaterial, setBookingMaterial] = useState('');
  const [bookingQty, setBookingQty] = useState('');
  const [bookingDivision, setBookingDivision] = useState('');
  const [generateTicket, setGenerateTicket] = useState(true);  // Default checked
  const [openMenuSlot, setOpenMenuSlot] = useState<{ date: string; time: string; top: number; left: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
// My adds
  const isTVMode = isFullscreen; // for now

  // ← SLOTS STATE HERE
  const [slots, setSlots] = useState<any[]>([]);
    // NEW: Division color mapping for left stripe
  const getDivisionColor = (division: string | undefined) => {
    if (!division) return '#6B7280'; // Gray fallback
    const colors: Record<string, string> = {
      '01 - General Requirements': '#8B5CF6', // Violet
      '03 - Concrete': '#EF4444',              // Red
      '04 - Masonry': '#F97316',               // Orange
      '05 - Metals': '#EAB308',                // Yellow
      '06 - Wood & Plastics': '#84CC16',       // Lime
      '08 - Doors & Windows': '#06B6D4',       // Cyan
      '09 - Finishes': '#FBBF24',              // Amber
      '31 - Earthwork': '#10B981',              // Emerald
      '32 - Exterior Improvements': '#14B8A6', // Teal
      // Add more as needed
    };
    // Match partial or full
    for (const key in colors) {
      if (division.includes(key.split(' - ')[0])) {
        return colors[key];
      }
    }
    return '#6B7280'; // Default gray
  };

  // NEW: Simple at-risk detection (back-to-back deliveries)
  const isAtRisk = (dateStr: string, timeStr: string) => {
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr);
    const min = parseInt(minStr);

    let prevHour = hour;
    let prevMin = min - 30;
    if (prevMin < 0) {
      prevHour -= 1;
      prevMin = 30;
    }
    if (prevHour < 6) return false; // Before workday

    const prevTime = `${prevHour.toString().padStart(2, '0')}:${prevMin.toString().padStart(2, '0')}`;
    const prevSlot = slots.find(s => s.date === dateStr && s.time === prevTime && s.status === 'taken');
    return !!prevSlot;
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  const times = [];
  for (let hour = 6; hour < 18; hour++) {
    times.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 17) times.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    setIsFullscreen(true);
  } else {
    document.exitFullscreen();
    setIsFullscreen(false);
  }
};

  // ← NOW getSlotStatus can use slots
  const getSlotStatus = (dateStr: string, timeStr: string) => {
    const slot = slots.find(s => s.date === dateStr && s.time === timeStr) || { status: 'available' };
    if (slot.status === 'taken') {
      slot.atRisk = isAtRisk(dateStr, timeStr);
    }
    return slot;
  };

const handleGenerateTicketLater = async () => {
  if (!openMenuSlot) return;

  // Find the slot data
  const slot = slots.find(s => s.date === openMenuSlot.date && s.time === openMenuSlot.time);
  if (!slot) return;

  // Pre-fill form from slot
  setSelectedSlot(openMenuSlot);
  setBookingMaterial(slot.material || '');
  setBookingQty(slot.qty || '');
  setBookingDivision(slot.csiDivision || '');
  setGenerateTicket(true); // force ticket creation

  setShowBookingModal(true);
  setOpenMenuSlot(null);
};

const handleDeleteSlot = async () => {
  if (!openMenuSlot || !confirm('Delete this slot? This will free the time but keep the delivery ticket.')) return;

  try {
    const q = query(
      collection(db, 'deliverySlots'),
      where('projectId', '==', projectId),
      where('date', '==', openMenuSlot.date),
      where('time', '==', openMenuSlot.time)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const slotDoc = snap.docs[0];

      // If there's a linked ticket, unlink it (don't delete ticket!)
      if (slotDoc.data().ticketId) {
        const ticketId = slotDoc.data().ticketId;
        // Optional: update ticket to remove slot reference (if you add one later)
        // await updateDoc(doc(db, 'tickets', ticketId), { slotId: deleteField() });
      }

      // Delete the slot document
      await deleteDoc(slotDoc.ref);

      alert('Slot deleted — time freed up. Delivery ticket preserved.');
    }
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete slot');
  }

  setOpenMenuSlot(null);
};

useEffect(() => {
  if (!isFullscreen) return;

const highlightCurrentTime = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute < 30 ? '00' : '30'}`;

  // Remove previous highlights
  document.querySelectorAll('[data-current-time="true"]').forEach(el => {
    (el as HTMLElement).style.boxShadow = '';
    (el as HTMLElement).style.border = '';
    el.removeAttribute('data-current-time');
  });

  // Highlight only today's current time slot
  const currentDayStr = format(now, 'yyyy-MM-dd');
  const currentSlots = document.querySelectorAll(`[data-time="${currentTimeStr}"][data-date="${currentDayStr}"]`);

  currentSlots.forEach(el => {
    (el as HTMLElement).style.boxShadow = '0 0 30px #FBBF24, inset 0 0 0 6px #FBBF24';
    (el as HTMLElement).style.border = '4px solid #FBBF24';
    (el as HTMLElement).style.transition = 'all 0.5s';
    el.setAttribute('data-current-time', 'true');
  });

  // Scroll current day into view
  const currentDayEl = document.querySelector(`[data-date="${currentDayStr}"]`);
  if (currentDayEl) {
    currentDayEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
};

  // Run immediately
  highlightCurrentTime();

  // Then every 30 minutes
  const interval = setInterval(highlightCurrentTime, 1800000); // 30 min

  return () => clearInterval(interval);
}, [isFullscreen, days]); // add days if it changes

useEffect(() => {
  if (!projectId) return;

  console.log('Current projectId from URL:', projectId); // ← Add this for debugging

  // Point to the root-level deliverySlots collection
  const slotsRef = collection(db, 'deliverySlots');

  // Filter documents where projectId matches the current project
  const q = query(slotsRef, where('projectId', '==', projectId));

  const unsub = onSnapshot(q, (snap) => {
    const loadedSlots: any[] = [];
    snap.forEach((doc) => {
      loadedSlots.push({ id: doc.id, ...doc.data() });
    });
    setSlots(loadedSlots);
    console.log('Realtime slots loaded for this project:', loadedSlots);
  }, (error) => {
    console.error('Firestore listener error:', error);
  });

  return () => unsub();
}, [projectId]);


return (
  <div style={{
    padding: isFullscreen ? '0.5rem' : '1rem',  // Much less padding in TV
    height: '100vh',
    backgroundColor: '#111827',
    color: 'white',
    overflow: 'hidden',
    fontSize: isFullscreen ? '1.4rem' : '1rem',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column'
  }}>
    {/* Slim Header in TV Mode */}
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: isFullscreen ? '0.5rem' : '1rem'
    }}>
      <h1 style={{ 
        fontSize: isFullscreen ? '4rem' : '2.5rem', 
        fontWeight: 'bold', 
        textAlign: 'center', 
        margin: isFullscreen ? '0.5rem 0' : '0 0 1rem 0'
      }}>
        Digital Whiteboard
      </h1>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: isFullscreen ? '1.5rem' : '1rem', 
        margin: '0',
        fontSize: isFullscreen ? '1.3rem' : '1rem'
      }}>
        <button 
          onClick={() => setStartDate(addDays(startDate, -7))} 
          style={{ 
            padding: isFullscreen ? '0.5rem 1rem' : '0.5rem 1rem', 
            backgroundColor: '#374151', 
            borderRadius: '0.5rem',
            minWidth: isFullscreen ? '120px' : 'auto'
          }}
        >
          ← Previous
        </button>
        <button 
          onClick={() => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))} 
          style={{ 
            padding: isFullscreen ? '0.6rem 1.2rem' : '0.5rem 1rem', 
            backgroundColor: '#16A34A', 
            borderRadius: '0.5rem',
            fontWeight: 'bold',
            minWidth: isFullscreen ? '140px' : 'auto'
          }}
        >
          This Week
        </button>
        <button 
          onClick={() => setStartDate(addDays(startDate, 7))} 
          style={{ 
            padding: isFullscreen ? '0.5rem 1rem' : '0.5rem 1rem', 
            backgroundColor: '#374151', 
            borderRadius: '0.5rem',
            minWidth: isFullscreen ? '120px' : 'auto'
          }}
        >
          Next →
        </button>
        </div>
        <button 
        onClick={toggleFullscreen}
        style={{ 
          position: 'absolute', 
          top: '1rem', 
          right: '1rem', 
          padding: '0.75rem 1.5rem', 
          backgroundColor: '#4F46E5', 
          color: 'white', 
          borderRadius: '0.5rem',
          fontWeight: 'bold',
          fontSize: '1rem',
          zIndex: 10
        }}
      >
        {isFullscreen ? 'Exit Fullscreen' : 'TV Mode'}
      </button>
      </div>
{!isFullscreen ? (
  // NORMAL MODE: Full detailed grid (keep your existing code)
  <div style={{ display: 'flex', overflowX: 'auto', height: 'calc(100% - 120px)' }}>
    {days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');

      return (
        <div key={dateStr} style={{ 
          minWidth: isFullscreen ? '400px' : '220px', 
          marginRight: isFullscreen ? '2rem' : '1rem', 
          borderRight: '1px solid #374151' 
        }}>
          <h2 style={{ 
            textAlign: 'center', 
            padding: isFullscreen ? '2rem 0' : '1rem 0', 
            fontWeight: 'bold', 
            backgroundColor: '#1F2937',
            fontSize: isFullscreen ? '2.5rem' : '1.5rem'
          }}>
            {format(day, 'EEE')}<br />
            {format(day, 'MMM d')}
          </h2>

          <div>
            {times.map((time) => {
              const slot = getSlotStatus(dateStr, time);
              const isTaken = slot.status === 'taken';

              return (
              <div
                key={time}
                data-time={time}  // ← ADD THIS
                data-date={dateStr}  // ← ADD THIS (on the day column or slot)
                style={{
                  height: isFullscreen ?'30px' : '40px',
                  padding: '0.5rem',
                  borderBottom: '1px solid #374151',
                  backgroundColor: isTaken ? '#374151' : '#166534',
                  borderLeft: isTaken ? `6px solid ${getDivisionColor(slot.csiDivision)}` : 'none',
                  boxShadow: slot.atRisk ? '0 0 0 3px #EAB308 inset' : 'none',
                  cursor: isTaken ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  overflow: 'visible',
                }}
                title={
                  isTaken
                    ? `${slot.material || 'Delivery'}\nQty: ${slot.qty || '?'}\nDivision: ${slot.csiDivision || 'N/A'}\n${slot.atRisk ? '⚠️ Back-to-back' : ''}`
                    : `Available at ${time}`
                }
                onClick={() => {
                  if (!isTaken) {
                    setSelectedSlot({ date: dateStr, time });
                    setShowBookingModal(true);
                  }
                }}
              >
                {isTaken ? (
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 1rem'
                  }}>
                    {/* Left: Text content */}
                    <div style={{ flex: 1, minWidth: 0 }}>  {/* minWidth prevents text squash */}
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slot.material || 'Delivery'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>
                        {time}
                      </div>
                      {slot.atRisk && (
                        <div style={{ fontSize: '0.8rem', color: '#FBBF24', marginTop: '0.2rem' }}>
                          ⚠️ Tight turnaround
                        </div>
                      )}
                    </div>

                    {/* Right: Emoji + 3-dots */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }}>
                      {/* Emoji only if ticket exists */}
                      {slot.ticketId && (
                        <div style={{
                          fontSize: '2rem',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                        }}>
                          {slot.vehicleType === 'Van' ? '🚐' :
                           slot.vehicleType === 'Box Truck' ? '🚚' :
                           slot.vehicleType === 'Flatbed' ? '🛻' :
                           slot.vehicleType === '18-Wheeler' ? '🚛' :
                           '📦'}
                        </div>
                      )}

                      {/* 3-Dots Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const newPos = {
                            date: dateStr,
                            time: time,
                            top: rect.bottom + window.scrollY + 8,
                            left: rect.right + window.scrollX - 190  // aligns menu to right of button
                          };
                          setOpenMenuSlot(
                            openMenuSlot?.date === dateStr && openMenuSlot.time === time
                              ? null
                              : newPos
                          );
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#9CA3AF',
                          fontSize: '1.5rem',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(55,65,81,0.6)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.95rem', color: '#9CA3AF' }}>
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
) : (
  // TV MODE — FULL WEEK GRID FOR COORDINATION
  <div style={{ 
    height: '100vh', 
    backgroundColor: '#111827', 
    color: 'white', 
    overflow: 'hidden',
    fontSize: '1.4rem',
    display: 'flex',
    flexDirection: 'column'
  }}>
    {/* Grid Body — Full height, no scroll, thinner rows */}
    <div style={{ flex: 1, display: 'flex', overflowY: 'hidden' }}>
      {/* Time Labels Column */}
      <div style={{ width: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        {times.map((time) => (
          <div key={time} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '1.2rem' }}>
            {time}
          </div>
        ))}
      </div>

      {/* Days Columns */}
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return (
          <div key={dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '2px solid #374151' }}>
            {times.map((time) => {
              const slot = getSlotStatus(dateStr, time);
              const isTaken = slot.status === 'taken';

              return (
                <div
                  key={time}
                  data-time={time}  // ← ADD THIS
                  data-date={dateStr}  // ← ADD THIS (on the day column or slot)
                  style={{
                    height: '40px',
                    backgroundColor: isTaken ? '#374151' : '#166534',
                    borderBottom: '1px solid #374151',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 0.5rem',
                    position: 'relative',
                    opacity: isTaken ? 1 : 0.5,
                    boxShadow: slot.atRisk ? 'inset 0 0 0 2px #EAB308' : 'none'
                  }}
                >
                  {isTaken ? (
                    // TAKEN SLOT — material + icon
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      width: '100%', 
                      gap: '0.5rem', 
                      fontSize: '1.1rem',
                      padding: '0 0.5rem'
                    }}>
                      <div style={{ 
                        flex: 1, 
                        fontWeight: 'bold', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {slot.material || 'Delivery'}
                      </div>
                      {slot.ticketId && (
                        <div style={{ fontSize: '1.6rem' }}>
                          {slot.vehicleType === 'Van' ? '🚐' :
                           slot.vehicleType === 'Box Truck' ? '🚚' :
                           slot.vehicleType === 'Flatbed' ? '🛻' :
                           slot.vehicleType === '18-Wheeler' ? '🚛' :
                           '📦'}
                        </div>
                      )}
                    </div>
                  ) : (
                    // OPEN SLOT — show time only, lighter
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#9CA3AF', 
                      textAlign: 'center',
                      width: '100%'
                    }}>
                      {time}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  </div>
)}

      {/* BOOKING MODAL — PASTE HERE */}
      {showBookingModal && selectedSlot && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#1F2937',
            padding: '2rem',
            borderRadius: '1rem',
            width: '90%',
            maxWidth: '500px',
            color: 'white'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              Book Delivery Slot
            </h2>
            <p style={{ marginBottom: '1.5rem' }}>
              {format(new Date(selectedSlot.date), 'MMM d')} at {selectedSlot.time}
            </p>

            <input
              type="text"
              placeholder="Material (e.g., Drywall Sheets)"
              value={bookingMaterial}
              onChange={(e) => setBookingMaterial(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', backgroundColor: '#374151', color: 'white', border: 'none' }}
            />

            <input
              type="text"
              placeholder="Quantity (e.g., 800 sheets)"
              value={bookingQty}
              onChange={(e) => setBookingQty(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', backgroundColor: '#374151', color: 'white', border: 'none' }}
            />

            <input
              type="text"
              placeholder="CSI Division (e.g., 09 - Finishes)"
              value={bookingDivision}
              onChange={(e) => setBookingDivision(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', marginBottom: '2rem', borderRadius: '0.5rem', backgroundColor: '#374151', color: 'white', border: 'none' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                checked={generateTicket}
                onChange={(e) => setGenerateTicket(e.target.checked)}
                id="generateTicket"
              />
              <label htmlFor="generateTicket" style={{ fontSize: '0.95rem', color: '#D1D5DB' }}>
                Generate Delivery Ticket Now
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setSelectedSlot(null);
                  setBookingMaterial('');
                  setBookingQty('');
                  setBookingDivision('');
                }}
                style={{ flex: 1, padding: '1rem', backgroundColor: '#4B5563', borderRadius: '0.5rem' }}
              >
                Cancel
              </button>
              <button
              onClick={async () => {
                if (!bookingMaterial || !bookingQty) {
                  alert('Please fill material and quantity');
                  return;
                }

                try {
                  let ticketRef = null;

                  // ONLY create ticket if checkbox is checked
                  if (generateTicket) {
                    ticketRef = await addDoc(collection(db, 'tickets'), {
                      projectId,
                      material: bookingMaterial,
                      qty: bookingQty,
                      csiDivision: bookingDivision,
                      anticipatedTime: selectedSlot.time,
                      status: 'unclaimed',
                      createdAt: serverTimestamp(),
                      shortId: generateShortId(7),
                      // Add other defaults if needed
                    });
                  }

                  // Always mark the slot as taken
                  const slotQuery = query(
                    collection(db, 'deliverySlots'),
                    where('projectId', '==', projectId),
                    where('date', '==', selectedSlot.date),
                    where('time', '==', selectedSlot.time)
                  );
                  const snap = await getDocs(slotQuery);

                    if (!snap.empty) {
                      // Update existing slot
                      await updateDoc(snap.docs[0].ref, {
                        status: 'taken',
                        ticketId: ticketRef ? ticketRef.id : null,  // only if ticket created
                        material: bookingMaterial,
                        qty: bookingQty,                            // ← NEW: save qty
                        csiDivision: bookingDivision,               // ← NEW: save division
                      });
                    } else {
                      // Create new slot if it doesn't exist
                      await addDoc(collection(db, 'deliverySlots'), {
                        projectId,
                        date: selectedSlot.date,
                        time: selectedSlot.time,
                        status: 'taken',
                        ticketId: ticketRef ? ticketRef.id : null,
                        material: bookingMaterial,
                        qty: bookingQty,
                        csiDivision: bookingDivision,
                      });
                    }

                  alert(generateTicket 
                    ? 'Slot booked! Ticket created in Unclaimed.' 
                    : 'Slot reserved! No ticket created.'
                  );

                  // Reset form
                  setShowBookingModal(false);
                  setSelectedSlot(null);
                  setBookingMaterial('');
                  setBookingQty('');
                  setBookingDivision('');
                  setGenerateTicket(true); // reset checkbox
                } catch (err) {
                  console.error(err);
                  alert('Booking failed');
                }
              }}
                style={{ flex: 1, padding: '1rem', backgroundColor: '#16A34A', borderRadius: '0.5rem' }}
              >
                Book Slot
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PORTALED DROPDOWN — FIXED CLICK ISSUE */}
{openMenuSlot && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'auto',    // catches outside clicks
            zIndex: 9999
          }}
          onClick={() => setOpenMenuSlot(null)}  // close on outside
        >
          <div 
            style={{
              position: 'absolute',
              top: `${openMenuSlot.top}px`,
              left: `${openMenuSlot.left}px`,
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}  // block close when clicking menu
          >
            <div style={{
              backgroundColor: '#1F2937',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              border: '2px solid #4B5563',
              minWidth: '190px',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => {
                  handleGenerateTicketLater();
                  setOpenMenuSlot(null);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '1rem',
                  background: 'none',
                  border: 'none',
                  color: '#3B82F6',
                  textAlign: 'left',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                📄 Generate Ticket
              </button>
              <button
                onClick={() => {
                  handleDeleteSlot();
                  setOpenMenuSlot(null);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '1rem',
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  textAlign: 'left',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#991B1B'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🗑️ Delete Slot
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}