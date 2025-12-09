"use client";

import { useSearchParams } from 'next/navigation';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sheet } from 'react-modal-sheet';
import mbxClient from '@mapbox/mapbox-sdk';
import directionsClient from '@mapbox/mapbox-sdk/services/directions';
import * as turf from '@turf/turf';
import { Source, Layer } from 'react-map-gl/mapbox';
import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

const directions = directionsClient({ accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN! });

export default function DriverContent() {
  // UI & Tracking State
  const [sheetSnap, setSheetSnap] = useState(1);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [showArrivalConfirm, setShowArrivalConfirm] = useState(false);
  const [bearingMode, setBearingMode] = useState<'north' | 'heading' | '3d'>('3d');
  const [hasFirstFix, setHasFirstFix] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number }>({
    lat: 46.21667,
    lng: -119.22323,
  });

  // Route & Guidance State
  const [route, setRoute] = useState<any>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [arrivalTime, setArrivalTime] = useState<string>('--:-- AM');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [nextInstruction, setNextInstruction] = useState<string>('Follow the route');

  // Notification State
  const [notified30Min, setNotified30Min] = useState(false);
  const [notified5Min, setNotified5Min] = useState(false);

  // Ticket Integration State (Brick 9)
  const [ticket, setTicket] = useState<any>(null);  // Full ticket from Firebase
  const [loadingTicket, setLoadingTicket] = useState(true);  // Show loading if needed
  
  //my adds
  const [currentPos, setCurrentPos] = useState<{ lng: number; lat: number } | null>(null);
  const [smoothedPos, setSmoothedPos] = useState<{ lng: number; lat: number } | null>(null);
  const animationRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);

  // Refs
  const sheetRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

 // Parse URL params (keep searchParams for other uses if needed)
const searchParams = useSearchParams();
const ticketId = searchParams.get('ticketId');

    // ← ADD fetchRoute HERE
  const fetchRoute = async (origin: { lat: number; lng: number }) => {
    if (!destination) return;

    try {
      const response = await directions.getDirections({
        profile: 'driving-traffic',
        waypoints: [
          { coordinates: [origin.lng, origin.lat] },
          { coordinates: [destination.lng, destination.lat] },
        ],
        geometries: 'geojson',
        overview: 'full',
        steps: true, // ← Updated from false to true
      }).send();

      const routeData = response.body.routes[0];
      setRoute(routeData.geometry);

      const durationMin = Math.round(routeData.duration / 60);
      const distanceMi = (routeData.distance / 1609.34).toFixed(1);

      setEtaMinutes(durationMin);
      setDistanceMiles(parseFloat(distanceMi));

      // Arrival time
      const now = new Date();
      now.setMinutes(now.getMinutes() + durationMin);
      setArrivalTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

      // Turn-by-turn instructions
      if (routeData.legs && routeData.legs[0] && routeData.legs[0].steps) {
        const steps = routeData.legs[0].steps.map((step: any) => step.maneuver.instruction);
        setInstructions(steps);
        setNextInstruction(steps[0] || 'Follow the route');
      } else {
        setInstructions([]);
        setNextInstruction('Follow the route');
      }
    } catch (err) {
      console.error('Route error:', err);
      setEtaMinutes(null);
      setDistanceMiles(null);
      setArrivalTime('--:-- AM');
      setInstructions([]);
      setNextInstruction('Follow the route');
    }
  };

  // Helper Functions (grouped together)
const sendGCMilestoneNotification = async (milestone: '30min' | '5min') => {
    const ticketId = searchParams.get('ticketId');
    if (!ticketId) {
      console.warn('No ticketId — skipping GC notification');
      return;
    }

    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        [`gcNotified${milestone}`]: true,           // e.g., gcNotified30min: true
        gcNotifiedAt: serverTimestamp(),
        lastETAUpdate: serverTimestamp(),
      });
      console.log(`GC notified via Firebase: ${milestone} out for ticket ${ticketId}`);
      // Optional temp driver feedback (remove later)
      // alert(`GC Alert Sent: Delivery is ${milestone === '30min' ? '30 min' : '5 min'} out!`);
    } catch (err) {
      console.error('Failed to send GC notification:', err);
    }
  };

const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return '-- min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} h ${mins > 0 ? `${mins} min` : ''}`;
  };

  const checkArrival = (currentPos: { lat: number; lng: number }) => {
    if (!destination) return false;
    const dist = turf.distance(
      [currentPos.lng, currentPos.lat],
      [destination.lng, destination.lat],
      { units: 'meters' }
    );
    return dist < 75;  // ~75 meters = arrived
  };

    //Ticket Listener
    useEffect(() => {
  const ticketId = searchParams.get('ticketId');
  if (!ticketId) {
    setLoadingTicket(false);
    return;
  }

  const ticketRef = doc(db, 'tickets', ticketId);
  const unsubscribe = onSnapshot(
    ticketRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTicket(data);
        console.log('Real ticket loaded:', data); // Debug
      } else {
        console.warn('No ticket found with ID:', ticketId);
      }
      setLoadingTicket(false);
    },
    (error) => {
      console.error('Error loading ticket:', error);
      setLoadingTicket(false);
    }
  );

  return () => unsubscribe();
}, [searchParams]);

useEffect(() => {
  if (!tracking) return;

  console.log('GPS useEffect triggered — starting watchPosition');

const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const { latitude, longitude, heading } = position.coords;
    if (heading !== null) setHeading(heading);
    const newRawPos = { lng: longitude, lat: latitude };

    // 1. Update all position states (raw + legacy sync)
    setCurrentPos(newRawPos);
    setPosition(newRawPos); // ← keeps old references working (we delete this line forever in 2 minutes)
    // THIS IS THE FINAL LOCK — triggers everything else
    if (!hasFirstFix) {
      setHasFirstFix(true);
    }

    // 2. First GPS fix → initialize smoothed pos instantly
    if (!smoothedPos) {
      setSmoothedPos(newRawPos);
      // Force immediate render of the dot
      requestAnimationFrame(() => setSmoothedPos(newRawPos));
    }

    // 3. Cancel any running animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // 4. Smooth interpolation — the butter
    const startTime = performance.now();
    const animate = () => {
      setSmoothedPos((prev) => {
        if (!prev) return newRawPos;

        const dx = newRawPos.lng - prev.lng;
        const dy = newRawPos.lat - prev.lat;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Big GPS jump (tunnel exit, etc.) → snap instantly
        if (distance > 0.001) return newRawPos;

        const factor = 0.28; // perfect balance
        return {
          lng: prev.lng + dx * factor,
          lat: prev.lat + dy * factor,
        };
      });

      if (performance.now() - startTime < 100) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    // 5. Instant map follow — the legendary snap
    mapRef.current?.flyTo({
      center: [newRawPos.lng, newRawPos.lat],
      zoom: 17,
      duration: 1800,
      speed: 4,
      essential: true,
    });
  },
  (err) => {
    console.error('GPS Error:', err);
    alert('Location access denied or unavailable');
    setTracking(false);
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }
);

  return () => {
    navigator.geolocation.clearWatch(watchId);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    console.log('GPS cleanup complete');
  };
}, [tracking]); // ← only dependency is tracking

{/* FINAL LOCK — Disable panning/zooming after first GPS fix */}
useEffect(() => {
  if (!mapRef.current || !hasFirstFix) return;

  const map = mapRef.current.getMap(); // This gets the real Mapbox instance

  map.dragPan.disable();
  map.scrollZoom.disable();
  map.doubleClickZoom.disable();
  map.touchZoomRotate.disable();
  map.keyboard.disable(); // Optional: disables arrow keys too

  // Cleanup not needed — we want it locked until Stop
}, [hasFirstFix]);

// UseEffect (Realtime Ticket Listener)
useEffect(() => {
  const ticketId = searchParams.get('ticketId');
  if (!ticketId) {
    setLoadingTicket(false);
    return;
  }

  const ticketRef = doc(db, 'tickets', ticketId);
  const unsubscribe = onSnapshot(ticketRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      setTicket(data);
      console.log('Ticket loaded:', data);
    } else {
      console.log('No such ticket!');
    }
    setLoadingTicket(false);
  }, (error) => {
    console.error('Ticket load error:', error);
    setLoadingTicket(false);
  });

  return unsubscribe;
}, [searchParams]);

// Dynamic destination from ticket — supports GC mid-route changes
useEffect(() => {
  if (ticket?.siteCoords) {
    const newDest = {
      lat: ticket.siteCoords.lat,
      lng: ticket.siteCoords.lng,
    };

    // Only update if coords actually changed (prevents unnecessary reroutes)
    if (
      destination.lat !== newDest.lat ||
      destination.lng !== newDest.lng
    ) {
      setDestination(newDest);

      // Notify driver if already tracking
      if (tracking) {
        alert(
          `Destination updated by GC!\nNew drop zone received. Route recalculating...`
        );
      }
    }
  }
}, [ticket?.siteCoords, tracking]);

useEffect(() => {
  if (tracking && currentPos) {           // ← changed
    fetchRoute(currentPos);               // ← changed

    const interval = setInterval(() => {
      fetchRoute(currentPos);             // ← changed

      // Check arrival
      if (checkArrival(currentPos) && !arrived) {    // ← changed
        setArrived(true);
        setShowArrivalConfirm(true);

        setTimeout(() => {
          if (showArrivalConfirm) {
            setTracking(false);
            setShowArrivalConfirm(false);
            alert('Auto-stopped: You have arrived at the site.');
          }
        }, 30000);
      }

      // ETA Milestone Notifications
      if (etaMinutes !== null) {
        if (etaMinutes <= 30 && !notified30Min) {
          sendGCMilestoneNotification('30min');
          setNotified30Min(true);
        }
        if (etaMinutes <= 5 && !notified5Min) {
          sendGCMilestoneNotification('5min');
          setNotified5Min(true);
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  } else {
    setArrived(false);
    setShowArrivalConfirm(false);
    setNotified30Min(false);
    setNotified5Min(false);
  }
}, [tracking, currentPos]);   // ← already correct

useLayoutEffect(() => {
  if (tracking && sheetRef.current) {
    requestAnimationFrame(() => {
      sheetRef.current.snapTo(1); // Peek
    });
  }
}, [tracking]);

return (
  <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
    {/* Full-screen Map */}
<Map
  ref={mapRef}
  initialViewState={{
    latitude: destination.lat,
    longitude: destination.lng,
    zoom: 12,
    bearing: 0,
    pitch: 0,
  }}
  // LIVE bearing & pitch — Mapbox handles the smooth transition natively
  bearing={bearingMode === 'north' ? 0 : (heading || 0)}
  pitch={bearingMode === '3d' ? 60 : 0}
  
  style={{ width: '100%', height: '100%' }}
  mapStyle="mapbox://styles/mapbox/streets-v12"
  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
>
    {/* FINAL CYAN ARROW PUCK — HEADING-AWARE */}
    {tracking && smoothedPos && (
      <Marker
        longitude={smoothedPos.lng}
        latitude={smoothedPos.lat}
        anchor="center"
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            background: 'cyan',
            border: '5px solid white',
            borderRadius: '50%',
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.95)',
            animation: 'pulse 2s infinite',
            position: 'relative',
          }}
        >
          {/* Directional arrowhead — rotates with heading */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 0,
              height: 0,
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderBottom: '20px solid rgba(0, 0, 0, 0.75)',
              transform: `translate(-50%, -85%) rotate(${heading || 0}deg)`,
              transformOrigin: 'center bottom',
              transition: heading !== null ? 'transform 0.18s ease-out' : 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </Marker>
    )}
      {/* Red Destination Pin */}
      <Marker longitude={destination.lng} latitude={destination.lat}>
        <div
          style={{
            width: '24px',
            height: '24px',
            background: 'red',
            border: '4px solid white',
            borderRadius: '50%',
            boxShadow: '0 0 15px rgba(255, 0, 0, 0.6)',
          }}
        />
      </Marker>

        {/* ← ADD THE BLUE ROUTE LINE HERE */}
        {route && (
            <Source id="route" type="geojson" data={route}>
            <Layer
                id="route-line"
                type="line"
                paint={{
                'line-color': '#3887be',
                'line-width': 6,
                'line-opacity': 0.8,
                }}
            />
            </Source>
        )}
        </Map>

{/* ORIENTATION CYCLE BUTTON — Clean icons, no overflow */}
{tracking && (
  <div
    style={{
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'white',
      borderRadius: '50%',
      width: 56,
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 2000,
      border: '2px solid #eee',
      cursor: 'pointer',
      fontWeight: 'bold',
      userSelect: 'none',
    }}
    onClick={() => {
      if (bearingMode === '3d') setBearingMode('north');
      else if (bearingMode === 'north') setBearingMode('heading');
      else setBearingMode('3d');
    }}
  >
    {bearingMode === 'north' && <span style={{ fontSize: 32 }}>N</span>}
    {bearingMode === 'heading' && <span style={{ fontSize: 28, transform: 'rotate(45deg)' }}>Arrow</span>}
    {bearingMode === '3d' && <span style={{ fontSize: 24 }}>3D</span>}
  </div>
)}


{/* RE-CENTER BUTTON — works perfectly in 3D + heading-up mode */}
{tracking && currentPos && sheetSnap !== 0 && (
  <div
    style={{
      position: 'absolute',
      bottom: '240px',  // High enough for all phones
      right: '16px',
      background: 'white',
      borderRadius: '50%',
      width: '56px',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 2000,
      border: '2px solid #eee',
      cursor: 'pointer',
    }}
    onClick={() => {
      mapRef.current?.flyTo({
        center: [currentPos.lng, currentPos.lat],
        zoom: 17.5,
        bearing: bearingMode === 'north' ? 0 : (heading || 0),
        pitch: bearingMode === '3d' ? 60 : 0,
        duration: 1200,
        speed: 3,
        essential: true,
      });
    }}
  >
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  </div>
)}

    {/* Bottom Sheet */}
    <Sheet
    ref={sheetRef}
    isOpen={true}
    onClose={() => {}}
    snapPoints={[0, 0.15, 0.6, 1]}  // Fixed: ascending with 0 and 1
    initialSnap={1}  // Start at peek (0.15)
    onSnap={(index) => setSheetSnap(index)}
    disableDismiss={true}
    disableDrag={false}
    >
  <Sheet.Container>
    {/* REMOVE <Sheet.Header /> completely — no extra line */}

    <Sheet.Content>
      <div style={{ padding: '12px', paddingTop: 8 }}>  {/* Tighter padding */}

        {/* Drag Handle - Always First & Visible */}
        <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
          <div style={{ width: '40px', height: '4px', background: '#aaa', margin: '0 auto', borderRadius: '2px' }} />
        </div>

{/* Live ETA Row - Only When Tracking */}
{tracking && (
  <div style={{
    background: '#ecfdf5',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #86efac',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', lineHeight: '1' }}>
          {etaMinutes !== null ? formatDuration(etaMinutes) : '-- min'}
        </p>
        <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0' }}>
          {distanceMiles !== null ? `${distanceMiles} mi • ${arrivalTime}` : '-- mi • --:-- AM'}
        </p>

        {/* ← ADD NEXT TURN PREVIEW HERE */}
        {instructions.length > 0 && (
          <p style={{ fontSize: '15px', color: '#333', margin: '8px 0 0', fontWeight: '500', lineHeight: '1.3' }}>
            ➤ {nextInstruction}
          </p>
        )}
      </div>

 {/* Stop / Arrival Button Flow — NOW WITH FULL CLEANUP */}
{showArrivalConfirm ? (
  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
    <button
      onClick={async () => {
        const ticketId = searchParams.get('ticketId');
        if (!ticketId) {
          alert('Error: No ticket ID found.');
          setTracking(false);
          setShowArrivalConfirm(false);
          return;
        }

        try {
          await updateDoc(doc(db, 'tickets', ticketId), {
            status: 'delivered',
            deliveredAt: serverTimestamp(),
          });
          alert('Arrival confirmed! Ticket delivered.');
        } catch (err) {
          console.error('Failed to update ticket:', err);
          alert('Error confirming delivery.');
        } finally {
          // FULL CLEAN RESET
          setTracking(false);
          setCurrentPos(null);
          setSmoothedPos(null);
          setPosition(null);
          setRoute(null);
          setEtaMinutes(null);
          setDistanceMiles(null);
          setArrivalTime('--:-- AM');
          setInstructions([]);
          setNextInstruction('Follow the route');
          setArrived(false);
          setShowArrivalConfirm(false);
          setNotified30Min(false);
          setNotified5Min(false);
        }
      }}
      style={{
        padding: '14px 28px',
        fontSize: '18px',
        fontWeight: 'bold',
        color: 'white',
        background: '#2563eb',
        border: 'none',
        borderRadius: '20px',
        minWidth: '160px',
      }}
    >
      Confirm Arrival
    </button>
    <button
      onClick={() => setShowArrivalConfirm(false)}
      style={{
        padding: '14px 28px',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333',
        background: '#e5e7eb',
        border: 'none',
        borderRadius: '20px',
        minWidth: '120px',
      }}
    >
      Not Yet
    </button>
  </div>
) : arrived ? (
  <button
    onClick={async () => {
      // Same as Confirm Arrival above — reuse the same cleanup logic
      // (Just copy the onClick from Confirm Arrival button if you want)
      alert('Use Confirm Arrival button above');
    }}
    style={{
      padding: '14px 28px',
      fontSize: '18px',
      fontWeight: 'bold',
      color: 'white',
      background: '#2563eb',
      border: 'none',
      borderRadius: '20px',
    }}
  >
    I'VE ARRIVED
  </button>
) : (
  <button
    onClick={() => {
      setTracking(false);
      setCurrentPos(null);
      setSmoothedPos(null);
      setPosition(null);
      setRoute(null);
      setEtaMinutes(null);
      setDistanceMiles(null);
      setArrivalTime('--:-- AM');
      setInstructions([]);
      setNextInstruction('Follow the route');
      setArrived(false);
      setShowArrivalConfirm(false);
      setNotified30Min(false);
      setNotified5Min(false);
    }}
    style={{
      padding: '10px 20px',
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'white',
      background: '#dc2626',
      border: 'none',
      borderRadius: '20px',
    }}
  >
    Stop
  </button>
)}
    </div>

    {/* Dynamic Equipment / Site Assistance Warning — Only when arrived */}
    {arrived && (
      <div style={{
        background: '#fef9c3',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #facc15',
        color: '#713f12',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        marginTop: '12px',
      }}>
        ⚠️ <strong>
          {ticket?.equipmentNeeded 
            ? `${ticket.equipmentNeeded} Alert` 
            : ticket?.needsForklift 
              ? 'Forklift Alert' 
              : 'Site Assistance Required'}
        </strong>: Heavy machinery active on site — stay vigilant!
      </div>
    )}
  </div>
)}

        {/* Pre-Tracking Content - Only Visible When Not Tracking */}
        {!tracking && (
          <>
            <h2 style={{ margin: '8px 0 4px', fontSize: '18px', fontWeight: 'bold' }}>Driver Navigation</h2>
            <p style={{ color: '#666', margin: '0 0 16px', fontSize: '14px' }}>
              Tap below to begin tracking and navigation
            </p>

        {/* Trip Summary Card (Pre-Tracking) */}
        <div style={{
        background: '#f3f4f6',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
            <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
            {etaMinutes !== null ? formatDuration(etaMinutes) : '-- min'}
            </p>
            <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
                {distanceMiles !== null ? `${distanceMiles} mi • ${arrivalTime}` : '-- mi • --:-- AM'}
            </p>
            </div>
            <button
            onClick={() => {
                if (claimed) {
                console.log('Start button clicked — setting tracking to true');
                setTracking(true);
                }
            }}
            disabled={!claimed}
            style={{
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                background: claimed ? '#16a34a' : '#d1d5db',
                border: 'none',
                borderRadius: '20px',
                cursor: claimed ? 'pointer' : 'not-allowed',
            }}
            >
            Start
            </button>
        </div>
        </div>

      {/* Ticket Summary + Claim Button — Dynamic from Real Ticket */}
      <div style={{
        background: '#f3f4f6',
        borderRadius: '12px',
        padding: '12px',
        fontSize: '14px',
        color: '#333',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div>
          <p style={{ margin: '0 0 4px' }}>
            <strong>Materials:</strong> {ticket?.material || 'Loading...'} ({ticket?.qty || ''})
          </p>
          <p style={{ margin: '0 0 4px' }}>
            <strong>Forklift Needed:</strong> {ticket?.needsForklift ? 'Yes' : 'No'}
          </p>
          {ticket?.projectName && (
            <p style={{ margin: '0 0 4px' }}>
              <strong>Project:</strong> {ticket.projectName}
            </p>
          )}
          {ticket?.projectAddress && (
            <p style={{ margin: '0 0 4px' }}>
              <strong>Address:</strong> {ticket.projectAddress}
            </p>
          )}
          {ticket?.csiDivision && (
            <p style={{ margin: '0 0 4px' }}>
              <strong>CSI Division:</strong> {ticket.csiDivision}
            </p>
          )}
          {ticket?.projectContacts && ticket.projectContacts.length > 0 && (
            <div style={{ margin: '8px 0 0' }}>
              <strong>Contacts:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                {ticket.projectContacts.map((contact: any, i: number) => (
                  <li key={i}>
                    {contact.name} ({contact.role}):{' '}
                    <a href={`tel:${contact.phone}`} style={{ color: '#3b82f6' }}>
                      {contact.phone}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setClaimed(true);
            // TODO: Real Firebase claim update in Brick 9
          }}
          disabled={claimed}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'white',
            background: claimed ? '#d1d5db' : '#3b82f6',
            border: 'none',
            borderRadius: '20px',
            alignSelf: 'flex-end',
          }}
        >
          {claimed ? 'Claimed' : 'Claim Delivery'}
        </button>
      </div>
          </>
        )}

        {/* Expanded-Only Content */}
        {sheetSnap === 0 && tracking && position && (
          <div style={{ marginTop: '16px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
            Lat: {position.lat.toFixed(6)} • Lng: {position.lng.toFixed(6)}
          </div>
        )}
        {/* Full Turn-by-Turn List - Only When Sheet Expanded */}
        {sheetSnap === 0 && instructions.length > 0 && (
        <div style={{ marginTop: '20px', padding: '0 4px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 'bold' }}>
            Turn-by-Turn Directions
            </h3>
            <ol style={{ margin: 0, paddingLeft: '24px', fontSize: '15px', lineHeight: '1.6' }}>
            {instructions.map((inst, i) => (
                <li
                key={i}
                style={{
                    marginBottom: '10px',
                    color: i === 0 ? '#2563eb' : '#333',
                    fontWeight: i === 0 ? 'bold' : 'normal',
                }}
                >
                {inst}
                </li>
            ))}
            </ol>
        </div>
        )}
      </div>
    </Sheet.Content>
  </Sheet.Container>

  <Sheet.Backdrop onTap={() => sheetRef.current?.snapTo(1)} />
</Sheet>
  
    {/* Global Style for Touch Pass-Through */}
        <style jsx global>{`
        .react-modal-sheet-backdrop {
            pointer-events: none !important;
        }
        .react-modal-sheet-container {
            pointer-events: none !important;
        }
        .react-modal-sheet-content > div {
            pointer-events: auto !important;
        }
        `}</style>

        {/* Pulse Animation */}
        <style jsx>{`
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 255, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0); }
        }
        `}</style>
    </div>
    );
  }