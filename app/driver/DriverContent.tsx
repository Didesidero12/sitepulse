"use client";

import { useSearchParams } from 'next/navigation';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sheet } from 'react-modal-sheet';
import directionsClient from '@mapbox/mapbox-sdk/services/directions';
import * as turf from '@turf/turf';
import { Source, Layer } from 'react-map-gl/mapbox';
import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { deleteField } from 'firebase/firestore';

import type { DirectionsResponse } from '@mapbox/mapbox-sdk/services/directions';
import type { Map as MapboxMap } from 'mapbox-gl';
import { Ticket, MapboxRoute } from '@/lib/types';

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
  const [mapIsOffCenter, setMapIsOffCenter] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number }>({
    lat: 46.21667,
    lng: -119.22323,
  });

  // Route & Guidance State
  //what I added
  const [route, setRoute] = useState<MapboxRoute | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [arrivalTime, setArrivalTime] = useState<string>('--:-- AM');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [nextInstruction, setNextInstruction] = useState<string>('Follow the route');

  // Notification State
  const [notified30Min, setNotified30Min] = useState(false);
  const [notified5Min, setNotified5Min] = useState(false);

  // Ticket Integration State (Brick 9)
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(true);  // Show loading if needed
  
  //my adds
  const [currentPos, setCurrentPos] = useState<{ lng: number; lat: number } | null>(null);
  const [smoothedPos, setSmoothedPos] = useState<{ lng: number; lat: number } | null>(null);
  const animationRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);
  const lastLocationWrite = useRef<number>(0);  // ← ADD THIS LINE
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<'Van' | 'Box Truck' | 'Flatbed' | '18-Wheeler'>('Van');
  const [canMakeTime, setCanMakeTime] = useState<'yes' | 'no' | null>(null);  // ← Fixed type
  const [alternativeTime, setAlternativeTime] = useState('');
  

  // Refs
  const sheetRef = useRef<any>(null);  // sheet doesn't have types — fine to leave as any
  const mapRef = useRef<any>(null); // ← THIS IS THE WINNER

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
        const steps = routeData.legs[0].steps.map((step) => step.maneuver.instruction);
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

  useEffect(() => {
  setIsMounted(true);
}, []);

useEffect(() => {
  if (!tracking) return;

  console.log('GPS useEffect triggered — starting watchPosition');

const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const { latitude, longitude, heading } = position.coords;
    if (heading !== null) setHeading(heading);
    const newRawPos = { lng: longitude, lat: latitude };

    // ──────────────────────────────────────────────────────────────
    // REAL-TIME FIRESTORE WRITE — THIS MAKES SUPER WAR ROOM SEE YOU
    // ──────────────────────────────────────────────────────────────
    if (ticket?.id) {
      const now = Date.now();
      if (!lastLocationWrite.current || now - lastLocationWrite.current > 10000) {
        updateDoc(doc(db, 'tickets', ticket.id), {
          driverLocation: { lat: newRawPos.lat, lng: newRawPos.lng },
          lastLocationUpdate: serverTimestamp(),
          status: tracking ? 'claimed-tracking' : 'claimed-untracking',
        }).catch(err => console.warn('Location write failed:', err));
        lastLocationWrite.current = now;
      }
    }
    // ──────────────────────────────────────────────────────────────
    
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
    console.log('Error Code:', err.code);  // ← ADD THIS
    console.log('Error Message:', err.message);  // ← ADD THIS
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

{/* SOFT FOLLOW MODE — Google-style: free to look around + glow when off-center */}
useEffect(() => {
  if (!tracking || !mapRef.current || !currentPos) return;

  const map = mapRef.current?.getMap();
  if (!map) return;

  // Re-enable all interaction — driver can explore
  map.dragPan.enable();
  map.scrollZoom.enable();
  map.doubleClickZoom.enable();
  map.touchZoomRotate.enable();

  // Track if map is off-center (for button glow)
  const checkOffCenter = () => {
    if (!currentPos) return;
    const center = map.getCenter();
    const distance = turf.distance(
      [center.lng, center.lat],
      [currentPos.lng, currentPos.lat],
      { units: 'meters' }
    );
    setMapIsOffCenter(distance > 100); // glow if more than ~100m off
  };

  // Gentle recenter every 8 seconds
  const recenterInterval = setInterval(() => {
    if (tracking && currentPos) {
      map.easeTo({
        center: [currentPos.lng, currentPos.lat],
        zoom: 17.5,
        bearing: bearingMode === 'north' ? 0 : (heading || 0),
        pitch: bearingMode === '3d' ? 60 : 0,
        duration: 1500,
        essential: true,
      });
      setMapIsOffCenter(false); // reset glow after recenter
    }
  }, 8000);

  // Instant recenter on big movement (>50m)
  let lastPos = currentPos;
  const checkMovement = () => {
    if (!tracking || !currentPos || !lastPos) return;

    const distance = turf.distance(
      [lastPos.lng, lastPos.lat],
      [currentPos.lng, currentPos.lat],
      { units: 'meters' }
    );

    if (distance > 50) {
      map.easeTo({
        center: [currentPos.lng, currentPos.lat],
        zoom: 17.5,
        bearing: bearingMode === 'north' ? 0 : (heading || 0),
        pitch: bearingMode === '3d' ? 60 : 0,
        duration: 1200,
      });
      setMapIsOffCenter(false);
    }

    lastPos = currentPos;
    checkOffCenter(); // update glow state every 3 sec
  };

  const movementInterval = setInterval(checkMovement, 3000);

  // Also check on manual pan/zoom
  map.on('moveend', checkOffCenter);

  return () => {
    clearInterval(recenterInterval);
    clearInterval(movementInterval);
    map.off('moveend', checkOffCenter);
  };
}, [tracking, currentPos, heading, bearingMode]);

// TICKET LOADING — RESOLVES shortId OR real ticketId, THEN REALTIME LISTEN
useEffect(() => {
  const rawId = searchParams.get('ticketId');
  if (!rawId) {
    setLoadingTicket(false);
    return;
  }

  let unsubscribe: (() => void) | undefined;

  const resolveAndListen = async () => {
    let resolvedId = rawId;

    // Step 1: Try direct load (real Firestore ID)
    const directSnap = await getDoc(doc(db, 'tickets', rawId));
    if (!directSnap.exists()) {
      // Step 2: If not, assume shortId and query
      const q = query(collection(db, 'tickets'), where('shortId', '==', rawId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        resolvedId = snap.docs[0].id;
      } else {
        console.warn('No ticket found for ID/shortId:', rawId);
        setLoadingTicket(false);
        return;
      }
    }

    // Step 3: Now listen realtime on resolved ID
    const ticketRef = doc(db, 'tickets', resolvedId);
    unsubscribe = onSnapshot(
      ticketRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTicket({ id: docSnap.id, ...(data as Ticket) });
          console.log('Real ticket loaded:', data);
        } else {
          console.warn('Ticket disappeared:', resolvedId);
        }
        setLoadingTicket(false);
      },
      (error) => {
        console.error('Error loading ticket:', error);
        setLoadingTicket(false);
      }
    );
  };

  resolveAndListen();

  return () => {
    if (unsubscribe) unsubscribe();
  };
}, [searchParams]);

// Dynamic destination from ticket — 100% safe, no more NaN crashes
useEffect(() => {
  if (!ticket?.siteCoords) {
    console.warn("No siteCoords in ticket — using Kennewick fallback");
    setDestination({ lat: 46.21667, lng: -119.22323 });
    return;
  }

  const lat = Number(ticket.siteCoords.lat);
  const lng = Number(ticket.siteCoords.lng);

  // If either coord is invalid, fall back to Kennewick
  if (isNaN(lat) || isNaN(lng)) {
    console.warn("Invalid coordinates in ticket:", ticket.siteCoords, "using Kennewick");
    setDestination({ lat: 46.21667, lng: -119.22323 });
    return;
  }

  const newDest = { lat, lng };

  // Only update if actually different
  if (destination.lat !== newDest.lat || destination.lng !== newDest.lng) {
    console.log("Updating destination to:", newDest);
    setDestination(newDest);

    if (tracking) {
      alert("Destination updated by GC!\nNew drop zone received. Route recalculating...");
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
    // Primary snap
    requestAnimationFrame(() => {
      sheetRef.current.snapTo(0);
    });

    // Fallback in case animation hasn't settled
    setTimeout(() => {
      if (tracking && sheetRef.current) {
        sheetRef.current.snapTo(0);
      }
    }, 300);
  }
}, [tracking]);

const handleStop = async () => {
  if (ticket?.id) {
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), {
        driverLocation: deleteField(),
        status: 'claimed-untracking',  // ← THIS IS KEY
      });
      console.log("Driver stopped — back to Claimed tab");
    } catch (err) {
      console.warn("Failed to update status on stop:", err);
    }
  }

  // 2. Your existing cleanup — keep everything you already had
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
  setHasFirstFix(false);

  // 3. Unlock map
  if (mapRef.current) {
    const map = mapRef.current.getMap();
    if (map) {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.keyboard.enable();
    }
  }

  // 4. Drop the sheet so you can see any errors
  sheetRef.current?.snapTo(1);
};



return (
  <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
    {/* Full-screen Map */}
<Map
  ref={mapRef}
initialViewState={{
  latitude: typeof destination.lat === 'number' && !isNaN(destination.lat) ? destination.lat : 46.21667,
  longitude: typeof destination.lng === 'number' && !isNaN(destination.lng) ? destination.lng : -119.22323,
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



{/* RECENTER BUTTON — Google-style: flashes when off-center */}
{tracking && currentPos && (
  <div
    style={{
      position: 'absolute',
      bottom: 230,  // ← moved lower, clear of sheet
      right: 60,
      background: 'white',
      borderRadius: '50%',
      width: 56,
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 2000,
      border: '3px solid #eee',
      cursor: 'pointer',
      animation: mapIsOffCenter ? 'pulse-glow 2s infinite' : 'none', // ← flashes when off-center
      transition: 'all 0.3s ease',
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
      setMapIsOffCenter(false); // reset flash
    }}
  >
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  </div>
)}

{/* Bottom Sheet - Only render after mount to avoid hydration mismatch */}
    {isMounted ? (
      <Sheet
      ref={sheetRef}
      isOpen={true}
      onClose={() => {}}
      snapPoints={[0, 0.5, 1]}           // 0 = peek, 0.5 = half, 1 = full
      initialSnap={1}                    // ← CHANGE TO 1 → starts at half-mast (0.5)
      onSnap={(index) => setSheetSnap(index)}
      disableDismiss={true}
      disableDrag={false}
    >
      <Sheet.Container>
    {/* REMOVE <Sheet.Header /> completely — no extra line */}

<Sheet.Content>
  <div style={{ padding: '12px', paddingTop: 8 }}>
    {/* Drag Handle */}
    <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
      <div style={{ width: '40px', height: '4px', background: '#aaa', margin: '0 auto', borderRadius: '2px' }} />
    </div>

    {/* PRE-CLAIM QUESTIONS — only show if not claimed */}
    {!claimed && ticket && (
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid #334155'
      }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#FBBF24' }}>
          Confirm Your Delivery
        </h3>

        {/* Vehicle Type */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Vehicle Type
          </label>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value as any)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: '#334155',
              color: 'white',
              border: 'none'
            }}
          >
            <option>Van</option>
            <option>Box Truck</option>
            <option>Flatbed</option>
            <option>18-Wheeler</option>
          </select>
        </div>

        {/* ETA Question */}
        <p style={{ marginBottom: '1rem', fontWeight: '600' }}>
          Requested arrival: <span style={{ color: '#FBBF24' }}>{ticket.anticipatedTime || "ASAP"}</span>
        </p>
        <p style={{ marginBottom: '1rem' }}>Can you arrive by then?</p>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setCanMakeTime('yes')}
            style={{
              flex: 1,
              padding: '1rem',
              borderRadius: '0.5rem',
              backgroundColor: canMakeTime === 'yes' ? '#16A34A' : '#334155',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            Yes
          </button>
          <button
            onClick={() => setCanMakeTime('no')}
            style={{
              flex: 1,
              padding: '1rem',
              borderRadius: '0.5rem',
              backgroundColor: canMakeTime === 'no' ? '#DC2626' : '#334155',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            No
          </button>
        </div>

        {canMakeTime === 'no' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Your proposed time
            </label>
            <input
              type="text"
              value={alternativeTime}
              onChange={(e) => setAlternativeTime(e.target.value)}
              placeholder="e.g. 2:00 PM"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none'
              }}
            />
          </div>
        )}

        <button
          onClick={async () => {
            if (!ticket?.id) return;

            const finalTime = canMakeTime === 'no' ? alternativeTime : ticket.anticipatedTime;

            try {
              await updateDoc(doc(db, 'tickets', ticket.id), {
                status: 'claimed-untracking',
                vehicleType: selectedVehicle,
                anticipatedTime: finalTime || ticket.anticipatedTime,
              });
              setClaimed(true);
              // Reset form
              setCanMakeTime(null);
              setAlternativeTime('');
              setSelectedVehicle('Van');
            } catch (err) {
              console.error(err);
              alert('Failed to claim');
            }
          }}
          disabled={canMakeTime === null || (canMakeTime === 'no' && !alternativeTime)}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: '#16A34A',
            color: 'white',
            borderRadius: '0.5rem',
            fontWeight: 'bold',
            opacity: (canMakeTime === null || (canMakeTime === 'no' && !alternativeTime)) ? 0.5 : 1
          }}
        >
          Confirm & Claim Delivery
        </button>
      </div>
    )}

        {/* TICKET SUMMARY + BUTTONS — FINAL, PERFECT, BUTTONS ON RIGHT */}
        <div style={{
          background: '#f3f4f6',
          borderRadius: '12px',
          padding: '16px',
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '20px',
        }}>
          {/* LEFT: ALL TICKET INFO */}
          <div style={{ flex: 1, fontSize: '15px', lineHeight: '1.6' }}>
            {ticket?.csiDivision && (
              <p style={{ margin: '0 0 8px', fontWeight: '600', color: '#1e40af' }}>
                CSI Division: {ticket.csiDivision}
              </p>
            )}

            <p style={{ margin: '0 0 8px', fontWeight: 'bold', fontSize: '16px' }}>
              Materials: {ticket?.material || '—'} ({ticket?.qty || '—'})
            </p>

            {ticket?.loadingEquipment && (
              <p style={{ margin: '0 0 8px', color: '#dc2626', fontWeight: 'bold' }}>
                Loading Equipment: {ticket.loadingEquipment}
              </p>
            )}

            <p style={{ margin: '0 0 8px' }}>
              <strong>Project:</strong> {ticket?.projectName || '—'}
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Address:</strong> {ticket?.projectAddress || '—'}
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Operating Hours:</strong> {ticket?.operatingHours || 'Not specified'}
            </p>

            {ticket?.siteStatus && (
              <p style={{
                margin: '8px 0',
                padding: '6px 10px',
                borderRadius: '8px',
                fontWeight: 'bold',
                background: ticket.siteStatus === 'Open' ? '#dcfce7' : '#fee2e2',
                color: ticket.siteStatus === 'Open' ? '#166534' : '#991b1b',
                display: 'inline-block',
              }}>
                Status: {ticket.siteStatus}
              </p>
            )}

            {ticket?.projectContacts?.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <strong>Contacts:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px', listStyle: 'none' }}>
                  {ticket.projectContacts.map((c, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600' }}>{c.name} ({c.role})</div>
                      <a href={`tel:${c.phone}`} style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                        {c.phone}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* RIGHT: CLAIM/UNCLAIM + START — TIGHT AND BEAUTIFUL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button
            onClick={async () => {
              if (claimed) {
                // UNCLAIM — keep your existing perfect logic
                if (confirm('Unclaim this delivery?')) {
                  try {
                    if (ticket?.id) {
                      await updateDoc(doc(db, 'tickets', ticket.id), {
                        status: 'unclaimed',
                        driverLocation: deleteField(),
                        driverId: deleteField(),
                      });
                    }
                    setClaimed(false);
                    setTracking(false);
                  } catch (err) {
                    console.error('Unclaim failed:', err);
                    alert('Failed to unclaim');
                  }
                }
              } else {
                // CLAIM — instead of immediate claim, show modal
                setShowClaimModal(true);
              }
            }}
            >
              {claimed ? 'Unclaim Delivery' : 'Claim Delivery'}
            </button>

            {claimed && !tracking && (
              <button
                onClick={async () => {
                  if (!ticket?.id) {
                    alert('Ticket not loaded yet — try again in a second');
                    return;
                  }

                  try {
                    // Update Firestore status so War Room moves it to Live tab
                    await updateDoc(doc(db, 'tickets', ticket.id), {
                      status: 'claimed-tracking',
                    });
                    console.log('Status updated to claimed-tracking');
                  } catch (err) {
                    console.error('Failed to update status:', err);
                    alert('Failed to start tracking — check connection');
                    return; // don't start local tracking if Firestore fails
                  }

                  // Only after successful Firestore write, start local tracking
                  setTracking(true);
                }}
                style={{
                  padding: '16px 40px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '30px',
                  minWidth: '240px',
                  boxShadow: '0 8px 28px rgba(22,163,74,0.5)',
                }}
              >
                Start Navigation
              </button>
            )}
          </div>
        </div>

        {/* Turn-by-turn */}
        {sheetSnap === 0 && instructions.length > 0 && (
          <div style={{ marginTop: '20px', padding: '0 4px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 'bold' }}>
              Turn-by-Turn Directions
            </h3>
            <ol style={{ margin: 0, paddingLeft: '24px', fontSize: '15px', lineHeight: '1.6' }}>
              {instructions.map((inst, i) => (
                <li key={i} style={{ marginBottom: '10px', color: i === 0 ? '#2563eb' : '#333', fontWeight: i === 0 ? 'bold' : 'normal' }}>
                  {inst}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
</Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={() => sheetRef.current?.snapTo(1)} />  {/* optional: tap backdrop to reopen half */}
      </Sheet>
    ) : (
      // Placeholder during SSR — prevents layout shift and hydration error
      <div style={{ 
        height: '50vh', 
        backgroundColor: '#f3f4f6',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      }} />
    )}
  
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

      {/* Pulse Animation — for the cyan puck */}
      <style jsx>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(0, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0); }
        }
      `}</style>

      {/* RECENTER BUTTON GLOW — flashes green when off-center */}
      <style jsx global>{`
        @keyframes pulse-glow {
          0% { 
            box-shadow: 0 4px 20px rgba(0,0,0,0.4); 
            border-color: #eee;
          }
          50% { 
            box-shadow: 0 0 30px 10px rgba(34, 197, 94, 0.7); 
            border-color: #22c55e;
          }
          100% { 
            box-shadow: 0 4px 20px rgba(0,0,0,0.4); 
            border-color: #eee;
          }
        }
      `}</style>
    </div>
    );
  }