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

const directions = directionsClient({ accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN! });

export default function DriverContent() {
  const [sheetSnap, setSheetSnap] = useState(1);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [route, setRoute] = useState<any>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [arrivalTime, setArrivalTime] = useState<string>('--:-- AM');
  const [arrived, setArrived] = useState(false);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [nextInstruction, setNextInstruction] = useState<string>('Follow the route');
  const [notified30Min, setNotified30Min] = useState(false);
  const [notified5Min, setNotified5Min] = useState(false);
  const [equipmentNeeded, setEquipmentNeeded] = useState('Forklift'); // Stub
  const [showArrivalConfirm, setShowArrivalConfirm] = useState(false);
  const sheetRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  // Parse URL params (now safe inside client component)
    const searchParams = useSearchParams();
    const destLat = parseFloat(searchParams.get('destLat') || '46.21667'); // Your Kennewick office
    const destLng = parseFloat(searchParams.get('destLng') || '-119.22323');
    const destination = { lat: destLat, lng: destLng };

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
    //GC Alerts - 5Min/30Min
    const sendGCMilestoneNotification = async (milestone: '30min' | '5min') => {
        try {
        console.log(`GC Notification: Delivery is ${milestone === '30min' ? '30 min' : '5 min'} out!`);
        alert(`GC Alert: Delivery is ${milestone === '30min' ? '30 min' : '5 min'} out!`); // Temp visible feedback
        // TODO: Real Firebase update in Brick 9
        } catch (err) {
        console.error('Notification error:', err);
        }
    };  

    // ← ADD formatDuration HELPER FUNCTION HERE
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

    // ← REPLACE THE OLD ROUTE-RELATED EFFECT (if any) WITH THIS NEW ONE
useEffect(() => {
  if (tracking) {
    console.log('GPS useEffect triggered — starting watchPosition');  // Debug log

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        console.log('GPS success — new position:', newPos);  // Debug log

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [newPos.lng, newPos.lat],
            zoom: 16,
            duration: 2000,
          });
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        alert("Location access denied or unavailable");
        setTracking(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      console.log('GPS useEffect cleanup — watch cleared');  // Debug log
    };
  }
}, [tracking]);

useEffect(() => {
  if (tracking && position) {
    fetchRoute(position);

    const interval = setInterval(() => {
      fetchRoute(position);

      // Check arrival
      if (checkArrival(position) && !arrived) {
        setArrived(true);
        setShowArrivalConfirm(true);  // ← Trigger confirmation buttons

        // Optional: Auto-stop after 30 seconds if driver doesn't respond
        setTimeout(() => {
          if (showArrivalConfirm) {  // Still not confirmed
            setTracking(false);
            setShowArrivalConfirm(false);
            alert('Auto-stopped: You have arrived at the site.');
          }
        }, 30000);  // 30 seconds
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
    setShowArrivalConfirm(false);  // ← Reset confirmation on stop
    setNotified30Min(false);
    setNotified5Min(false);
  }
}, [tracking, position]);

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
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
    >
      {/* Cyan Dot Marker */}
      {tracking && position && (
        <Marker longitude={position.lng} latitude={position.lat}>
          <div
            style={{
              width: '28px',
              height: '28px',
              background: 'cyan',
              border: '4px solid white',
              borderRadius: '50%',
              boxShadow: '0 0 20px rgba(0, 255, 255, 0.8)',
              animation: 'pulse 2s infinite',
            }}
          />
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

    {tracking && position && sheetSnap !== 0 && (
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
        }}
        onClick={() => {
        mapRef.current?.flyTo({
            center: [position.lng, position.lat],
            zoom: 16,
            duration: 1500,
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

      {/* Conditional Button Flow: Confirm / Not Yet, I've Arrived, or Stop */}
      {showArrivalConfirm ? (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setTracking(false);
              setShowArrivalConfirm(false);
              alert('Arrival confirmed! Ticket delivered.');
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
          onClick={() => {
            setTracking(false);
            alert('Arrival confirmed! Ticket delivered.');
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
          onClick={() => setTracking(false)}
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

    {/* Forklift / Site Assistance Warning — Only when arrived */}
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
        ⚠️ <strong>{equipmentNeeded} Alert:</strong> Heavy machinery active — stay vigilant!
            {/* Future: Dynamic message */}
            {/* {ticket.equipmentNeeded ? `${ticket.equipmentNeeded} Required` : 'Heavy machinery active — stay vigilant!'} */}
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

            {/* Ticket Summary + Claim Button */}
            <div style={{
              background: '#f3f4f6',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '14px',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <p style={{ margin: '0 0 4px' }}><strong>Materials:</strong> Doors from Italy (12 bifolds)</p>
                <p style={{ margin: '0' }}><strong>Forklift Needed:</strong> Yes</p>
              </div>
              <button
                onClick={() => setClaimed(true)}
                disabled={claimed}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: claimed ? '#d1d5db' : '#3b82f6',
                  border: 'none',
                  borderRadius: '20px',
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