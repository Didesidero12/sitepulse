"use client";

import { useRef, useState, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sheet } from 'react-modal-sheet';

export default function DriverPage() {
  const [sheetSnap, setSheetSnap] = useState(1); // 0 = expanded, 1 = minimized
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const sheetRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (tracking) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setPosition(newPos);

          // Smoothly fly to driver's location
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
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [tracking]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Full-screen Map */}
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: 37.7749,
          longitude: -122.4194,
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
      </Map>

      {/* Bottom Sheet */}
      <Sheet
        ref={sheetRef}
        isOpen={true}
        onClose={() => {}}
        snapPoints={[0.6, 0.15]}
        initialSnap={1}
        onSnap={(index) => setSheetSnap(index)}
        disableDismiss={true}
      >
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            <div style={{ padding: '16px', paddingTop: 0 }}>
              {/* Drag Handle */}
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: '40px', height: '4px', background: '#aaa', margin: '0 auto', borderRadius: '2px' }} />
              </div>

              <h2 style={{ margin: '8px 0 4px', fontSize: '18px', fontWeight: 'bold' }}>Driver Navigation</h2>
              <p style={{ color: '#666', margin: '0 0 16px', fontSize: '14px' }}>
                {tracking ? 'Tracking active • Sharing location' : 'Tap below to begin tracking and navigation'}
              </p>

              {/* Trip Summary Placeholder */}
              <div style={{
                background: '#f3f4f6',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>Trip summary will appear here</p>
                <p style={{ margin: '8px 0 0', fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                  — ETA • — mi
                </p>
              </div>

              {/* Start/Stop Button */}
              <button
                onClick={() => setTracking(!tracking)}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: tracking ? '#dc2626' : '#16a34a',
                  border: 'none',
                  borderRadius: '12px',
                }}
              >
                {tracking ? 'STOP TRACKING' : 'START TRACKING NOW'}
              </button>

              {/* Optional: Show current coords while tracking */}
              {tracking && position && (
                <div style={{ marginTop: '16px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                  Lat: {position.lat.toFixed(6)} • Lng: {position.lng.toFixed(6)}
                </div>
              )}
            </div>
          </Sheet.Content>
        </Sheet.Container>

        <Sheet.Backdrop onTap={() => sheetRef.current?.snapTo(1)} />
      </Sheet>

      {/* Optional: Pulse animation for cyan dot */}
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