"use client";

import { useSearchParams } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sheet } from 'react-modal-sheet';

export default function DriverContent() {
  const [sheetSnap, setSheetSnap] = useState(1);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const sheetRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  // Parse URL params (now safe inside client component)
    const searchParams = useSearchParams();
    const destLat = parseFloat(searchParams.get('destLat') || '37.7749');
    const destLng = parseFloat(searchParams.get('destLng') || '-122.4194');
    const destination = { lat: destLat, lng: destLng };

  useEffect(() => {
    if (tracking) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(newPos);
          if (mapRef.current) {
            mapRef.current.flyTo({ center: [newPos.lng, newPos.lat], zoom: 16, duration: 2000 });
          }
        },
        (err) => {
          console.error("GPS Error:", err);
          alert("Location access denied or unavailable");
          setTracking(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [tracking]);

  useEffect(() => {
    if (tracking && sheetRef.current) {
      sheetRef.current.snapTo(1);
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
    </Map>

    {/* Re-Center Button - Overlaid on Map */}
    {tracking && position && (
      <div
        style={{
          position: 'absolute',
          bottom: '220px',
          right: '16px',
          background: 'white',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 1000,
          border: '2px solid #ddd',
        }}
        onClick={() => {
          if (mapRef.current && position) {
            mapRef.current.flyTo({
              center: [position.lng, position.lat],
              zoom: 16,
              duration: 1500,
            });
          }
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      snapPoints={[0.6, 0.15]}
      initialSnap={1}
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

        {/* Live ETA Row - Only When Tracking (This is the ONLY thing in peek) */}
        {tracking && (
          <div style={{
            background: '#ecfdf5',
            borderRadius: '12px',
            padding: '14px',  // Slightly tighter
            border: '1px solid #86efac',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 0  // No extra margin
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '26px', fontWeight: 'bold', margin: '0', lineHeight: '1' }}>-- min</p>
              <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0' }}>-- mi • --:-- AM</p>
            </div>
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
                  <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>-- min</p>
                  <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>-- mi • --:-- AM</p>
                </div>
                <button
                  onClick={() => claimed ? setTracking(true) : null}
                  disabled={!claimed}
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: claimed ? '#16a34a' : '#d1d5db',
                    border: 'none',
                    borderRadius: '20px',
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