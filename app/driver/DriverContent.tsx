"use client";

import { useSearchParams } from 'next/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sheet } from 'react-modal-sheet';
import mbxClient from '@mapbox/mapbox-sdk';
import directionsClient from '@mapbox/mapbox-sdk/services/directions';
import * as turf from '@turf/turf';
import { useRef, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import dynamic from 'next/dynamic';

const directions = directionsClient({ accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN! });

export default function DriverContent() {
  const [viewState, setViewState] = useState({
    longitude: -119.22323,
    latitude: 46.21667,
    zoom: 10,
    pitch: 0,
    bearing: 0,
  });

  // UI & Tracking State
  const [sheetSnap, setSheetSnap] = useState(1);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number; heading?: number } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [showArrivalConfirm, setShowArrivalConfirm] = useState(false);
  const [cameraMode, setCameraMode] = useState<'north-up' | 'heading-up' | '3d-heading-up'>('north-up');
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

  // Ticket Integration State
  const [ticket, setTicket] = useState<any>(null);
  const [loadingTicket, setLoadingTicket] = useState(true);

  // Refs
  const sheetRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  const Map = dynamic(() => import('react-map-gl/mapbox').then(mod => mod.Map), { ssr: false });
  const Marker = dynamic(() => import('react-map-gl/mapbox').then(mod => mod.Marker), { ssr: false });
  const Source = dynamic(() => import('react-map-gl/mapbox').then(mod => mod.Source), { ssr: false });
  const Layer = dynamic(() => import('react-map-gl/mapbox').then(mod => mod.Layer), { ssr: false });

  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');

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
        steps: true,
      }).send();

      const routeData = response.body.routes[0];
      setRoute(routeData.geometry);

      const durationMin = Math.round(routeData.duration / 60);
      const distanceMi = (routeData.distance / 1609.34).toFixed(1);

      setEtaMinutes(durationMin);
      setDistanceMiles(parseFloat(distanceMi));

      const now = new Date();
      now.setMinutes(now.getMinutes() + durationMin);
      setArrivalTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

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

  const sendGCMilestoneNotification = async (milestone: '30min' | '5min') => {
    const ticketId = searchParams.get('ticketId');
    if (!ticketId) {
      console.warn('No ticketId — skipping GC notification');
      return;
    }

    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        [`gcNotified${milestone}`]: true,
        gcNotifiedAt: serverTimestamp(),
        lastETAUpdate: serverTimestamp(),
      });
      console.log(`GC notified via Firebase: ${milestone} out for ticket ${ticketId}`);
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
    return dist < 75;
  };

  let animationFrameId: number | null = null;
  let targetPosition: { lat: number; lng: number } | null = null;

  const animateMarker = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    const startTime = performance.now();
    const duration = 2000;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const lat = from.lat + (to.lat - from.lat) * progress;
      const lng = from.lng + (to.lng - from.lng) * progress;

      setPosition({ lat, lng });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        animationFrameId = null;
      }
    };

    animationFrameId = requestAnimationFrame(animate);
  };

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
          console.log('Real ticket loaded:', data);
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
    if (tracking) {
      console.log('GPS useEffect triggered — starting watchPosition');

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? undefined
          };
          console.log('GPS success — new position + heading:', newPos);

          if (position) {
            animateMarker(position, newPos);
          } else {
            setPosition(newPos);
          }

          targetPosition = newPos;

          // FIX: Removed conflicting flyTo here — centralized camera handles it now
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
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    }
  }, [tracking]);

  // FIX: Removed duplicate/old "On Start" useEffect — centralized one handles it

  useEffect(() => {
    if (ticket?.siteCoords) {
      const newDest = {
        lat: ticket.siteCoords.lat,
        lng: ticket.siteCoords.lng,
      };

      if (
        destination.lat !== newDest.lat ||
        destination.lng !== newDest.lng
      ) {
        setDestination(newDest);

        if (tracking) {
          alert(`Destination updated by GC!\nNew drop zone received. Route recalculating...`);
        }
      }
    }
  }, [ticket?.siteCoords, tracking]);

  useEffect(() => {
    if (tracking && position) {
      fetchRoute(position);

      const interval = setInterval(() => {
        fetchRoute(position);

        if (checkArrival(position) && !arrived) {
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
  }, [tracking, position]);

  // Centralized camera control
  useEffect(() => {
    if (!mapRef.current || !tracking || !position) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    const { lat, lng, heading = 0 } = position;

    let bearing = 0;
    let pitch = 0;

    if (cameraMode === 'heading-up' || cameraMode === '3d-heading-up') {
      bearing = heading;
    }
    if (cameraMode === '3d-heading-up') {
      pitch = 60;
    }

    map.easeTo({
      center: [lng, lat],
      zoom: 16,
      bearing,
      pitch,
      duration: 1000,
      essential: true,
    });
  }, [position, cameraMode, tracking]);

  // Initial snap on Start
  useEffect(() => {
    if (tracking && mapRef.current && position) {
      const map = mapRef.current.getMap();
      if (map) {
        map.flyTo({
          center: [position.lng, position.lat],
          zoom: 16,
          duration: 1500,
          essential: true,
        });
      }
    }
  }, [tracking, position]);

  // FIX: Force resize on load to prevent blank canvas
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      if (map) {
        map.resize();  // Triggers WebGL redraw
      }
    }
  }, [viewState]);  // Runs on any view change/move

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        reuseMaps
        antialias={true}  // FIX: Prevents blank on move/reload
        dragPan={!tracking}
        dragRotate={!tracking}
        scrollZoom={!tracking}
        touchZoomRotate={!tracking}
        keyboard={!tracking}
        doubleClickZoom={!tracking}
      >
        {tracking && position && (
          <Marker
            longitude={position.lng}
            latitude={position.lat}
            anchor="center"
            rotationAlignment="map"
            rotation={position.heading ?? 0}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'cyan',
                border: '5px solid white',
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
                boxShadow: '0 0 25px rgba(0, 255, 255, 0.9)',
              }}
            />
          </Marker>
        )}

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
        <>
          <div
            style={{
              position: 'absolute',
              bottom: '320px',
              right: '16px',
              background:
                cameraMode === 'north-up' ? 'white' :
                cameraMode === 'heading-up' ? '#2563eb' :
                '#7c3aed',
              color: cameraMode === 'north-up' ? '#333' : 'white',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              border: '2px solid #eee',
              cursor: 'pointer',
              zIndex: 2000,
            }}
            onClick={() => {
              if (cameraMode === 'north-up') setCameraMode('heading-up');
              else if (cameraMode === 'heading-up') setCameraMode('3d-heading-up');
              else setCameraMode('north-up');
            }}
          >
            {cameraMode === 'north-up' && (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v20" />
              </svg>
            )}
            {cameraMode === 'heading-up' && (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 12h3v8h14v-8h3L12 2z" />
                <path d="M12 8v8" />
              </svg>
            )}
            {cameraMode === '3d-heading-up' && (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l-10 10h4v10h12v-10h4l-10-10z" />
                <path d="M8 8l4 4 4-4" />
              </svg>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '240px',
              right: '16px',
              background: 'white',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              border: '2px solid #eee',
              cursor: 'pointer',
              zIndex: 2000,
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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
          </div>
        </>
      )}

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
          <Sheet.Content>
            <div style={{ padding: '12px', paddingTop: 8 }}>
              <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                <div style={{ width: '40px', height: '4px', background: '#aaa', margin: '0 auto', borderRadius: '2px' }} />
              </div>

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

                      {instructions.length > 0 && (
                        <p style={{ fontSize: '15px', color: '#333', margin: '8px 0 0', fontWeight: '500', lineHeight: '1.3' }}>
                          ➤ {nextInstruction}
                        </p>
                      )}
                    </div>

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
                              console.log(`Ticket ${ticketId} marked as delivered`);
                              alert('Arrival confirmed! Ticket delivered.');
                            } catch (err) {
                              console.error('Failed to update ticket:', err);
                              alert('Error confirming delivery. Try again.');
                            } finally {
                              setTracking(false);
                              setShowArrivalConfirm(false);
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
                          const ticketId = searchParams.get('ticketId');
                          if (!ticketId) {
                            alert('Error: No ticket ID found.');
                            setTracking(false);
                            return;
                          }

                          try {
                            await updateDoc(doc(db, 'tickets', ticketId), {
                              status: 'delivered',
                              deliveredAt: serverTimestamp(),
                            });
                            console.log(`Ticket ${ticketId} marked as delivered`);
                            alert('Arrival confirmed! Ticket delivered.');
                          } catch (err) {
                            console.error('Failed to update ticket:', err);
                            alert('Error confirming delivery. Try again.');
                          } finally {
                            setTracking(false);
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

              {!tracking && (
                <>
                  <h2 style={{ margin: '8px 0 4px', fontSize: '18px', fontWeight: 'bold' }}>Driver Navigation</h2>
                  <p style={{ color: '#666', margin: '0 0 16px', fontSize: '14px' }}>
                    Tap below to begin tracking and navigation
                  </p>

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

              {sheetSnap === 0 && tracking && position && (
                <div style={{ marginTop: '16px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                  Lat: {position.lat.toFixed(6)} • Lng: {position.lng.toFixed(6)}
                </div>
              )}
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