"use client";

import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sheet } from 'react-modal-sheet';
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import * as turf from '@turf/turf';
import { useSearchParams } from 'next/navigation';

const directionsClient = mbxDirections({ accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN });

export default function DriverPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const destLat = parseFloat(searchParams.get('destLat') || '37.7749'); // Fallback to SF
  const destLng = parseFloat(searchParams.get('destLng') || '-122.4194');
  const destination = { lat: destLat, lng: destLng };

  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState({ lat: 0, lng: 0 });
  const [route, setRoute] = useState(null); // GeoJSON for polyline
  const [eta, setEta] = useState('Calculating...'); // Seconds → format to min
  const [distance, setDistance] = useState('Calculating...'); // Miles/km
  const [instructions, setInstructions] = useState([]); // Turn-by-turn array
  const [arrived, setArrived] = useState(false);
  const [sheetSnap, setSheetSnap] = useState(1); // 1 = minimized
  const mapRef = useRef(null); // For map instance
  const directionsRef = useRef(null); // For plugin
  const sheetRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && !directionsRef.current) {
      directionsRef.current = new MapboxDirections({
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        unit: 'imperial', // Miles/min
        profile: 'mapbox/driving-traffic', // Traffic-aware
        controls: { inputs: false, instructions: false }, // We'll handle UI
      });
      mapRef.current.addControl(directionsRef.current, 'top-left'); // But hide if needed
    }
  }, [mapRef]);

  const fetchRoute = async (origin, dest) => {
    try {
      const response = await directionsClient.getDirections({
        profile: 'driving-traffic',
        waypoints: [
          { coordinates: [origin.lng, origin.lat] },
          { coordinates: [dest.lng, dest.lat] },
        ],
        geometries: 'geojson',
        overview: 'full',
        steps: true,
        annotations: ['duration', 'distance'],
      }).send();

      const data = response.body.routes[0];
      setRoute(data.geometry); // For polyline
      setEta(Math.round(data.duration / 60) + ' min');
      setDistance((data.distance / 1609.34).toFixed(1) + ' mi'); // Meters to miles
      setInstructions(data.legs[0].steps.map(step => step.maneuver.instruction));
    } catch (error) {
      console.error('Route fetch error:', error);
      setEta('Error calculating');
      setDistance('Error calculating');
    }
  };

  useEffect(() => {
    if (tracking && position.lat !== 0) {
      fetchRoute(position, destination); // Initial route
      const interval = setInterval(() => {
        // Simple deviation check (expand later)
        const distToDest = turf.distance([position.lng, position.lat], [destination.lng, destination.lat], { units: 'miles' });
        if (distToDest < 0.03) { // ~50m
          setArrived(true);
          setTracking(false);
        } else {
          // TODO: Full deviation logic – for now, just refresh if needed
          fetchRoute(position, destination);
        }
      }, 10000); // Every 10s
      return () => clearInterval(interval);
    }
  }, [tracking, position, destination]);

  useEffect(() => {
    if (tracking) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(newPos);
          // Send to Firebase for War Room cyan dot
          if (mapRef.current) {
            mapRef.current.flyTo({ center: [newPos.lng, newPos.lat], zoom: 15 });
          }
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [tracking]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: position.lat || destination.lat,
          longitude: position.lng || destination.lng,
          zoom: 14,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      >
        {tracking && position.lat !== 0 && (
          <Marker longitude={position.lng} latitude={position.lat}>
            <div style={{ background: 'cyan', width: '20px', height: '20px', borderRadius: '50%', boxShadow: '0 0 10px cyan' }} />
          </Marker>
        )}
        {route && (
          <Source id="route" type="geojson" data={{ type: 'Feature', geometry: route }}>
            <Layer
              id="route-layer"
              type="line"
              paint={{ 'line-color': '#3887be', 'line-width': 5, 'line-opacity': 0.75 }}
            />
          </Source>
        )}
        <Marker longitude={destination.lng} latitude={destination.lat}>
          <div style={{ background: 'red', width: '15px', height: '15px', borderRadius: '50%' }} />
        </Marker>
      </Map>

      <Sheet
        ref={sheetRef}
        isOpen={true}
        onClose={() => {}}
        snapPoints={[0.6, 0.25]}
        initialSnap={1}
        onSnap={(index) => setSheetSnap(index)}
      >
        <Sheet.Container>
          <Sheet.Header>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: '40px', height: '4px', background: '#aaa', margin: '0 auto', borderRadius: '2px' }} />
            </div>
          </Sheet.Header>
          <Sheet.Content>
            <div style={{ padding: '16px' }}>
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
                  marginBottom: '16px',
                }}
              >
                {tracking ? 'STOP TRACKING' : 'START TRACKING NOW'}
              </button>

              {tracking && (
                <>
                  <div style={{ display: 'grid', gap: '12px', fontSize: '14px', marginBottom: '16px' }}>
                    <div><strong>ETA:</strong> {eta}</div>
                    <div><strong>Distance:</strong> {distance}</div>
                    <div><strong>Next Turn:</strong> {instructions[0] || 'Straight ahead'}</div>
                  </div>
                  {sheetSnap === 0 && (
                    <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 16px' }}>
                      {instructions.map((inst, i) => (
                        <li key={i} style={{ marginBottom: '8px' }}>{inst}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <div style={{ display: 'grid', gap: '12px', fontSize: '14px', marginBottom: '16px' }}>
                <div>
                  <strong>Current Position:</strong><br />
                  {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                </div>
              </div>

              <div style={{
                background: '#fef9c3',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #facc15',
                color: '#713f12',
                marginBottom: '16px',
              }}>
                ⚠️ <strong>Forklift Alert:</strong> Heavy machinery active on site — stay vigilant!
              </div>

              {arrived && (
                <button
                  onClick={() => {
                    // TODO: Firebase update ticket status to 'delivered', notify War Room
                    alert('Arrival confirmed! Ticket closed.');
                    // Redirect? e.g., window.location.href = '/';
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '12px',
                  }}
                >
                  I'VE ARRIVED
                </button>
              )}

              {sheetSnap === 0 && !tracking && (
                <div style={{ marginTop: '24px', color: '#666', fontSize: '14px' }}>
                  <p>Turn-by-turn navigation coming soon.</p>
                </div>
              )}
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={() => sheetRef.current?.snapTo(1)} />
      </Sheet>
    </div>
  );
}