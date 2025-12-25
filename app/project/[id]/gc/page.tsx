// app/project/[id]/gc/page.tsx — REBUILT VERSION (2025)

"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp,
  updateDoc, doc, getDoc, getDocs
} from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import generateShortId from '@/utils/generateShortId';
import * as turf from '@turf/turf'; // For distance sorting in Live
import { deleteDoc } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import type { Ticket } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function SuperWarRoom() {
  const { id } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // STATES
  const [deliveries, setDeliveries] = useState<Ticket[]>([]); // For map markers (claimed-tracking + untracking with location)
  const [unclaimedTickets, setUnclaimedTickets] = useState<Ticket[]>([]);
  const [liveTickets, setLiveTickets] = useState<Ticket[]>([]);
  const [claimedWaitingTickets, setClaimedWaitingTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "claimed" | "unclaimed">("unclaimed");
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  const [siteLocation, setSiteLocation] = useState({ lat: 46.21667, lng: -119.22323 });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | string>('ALL');
const [highlightedId, setHighlightedId] = useState<string | null>(null);

// Unique divisions for filter buttons
const allTickets = [...liveTickets, ...claimedWaitingTickets, ...unclaimedTickets];
const uniqueCSIDivisions = Array.from(new Set(allTickets.map(t => t.csiDivision || "Other"))).sort();

// Filtered ticket lists
const filteredLive = activeFilter === 'ALL' 
  ? liveTickets 
  : liveTickets.filter(t => (t.csiDivision || "Other") === activeFilter);

const filteredClaimed = activeFilter === 'ALL' 
  ? claimedWaitingTickets 
  : claimedWaitingTickets.filter(t => (t.csiDivision || "Other") === activeFilter);

const filteredUnclaimed = activeFilter === 'ALL' 
  ? unclaimedTickets 
  : unclaimedTickets.filter(t => (t.csiDivision || "Other") === activeFilter);

// Calculate current ETA based on driver location and average speed
const calculateCurrentETA = (ticket: Ticket): string | null => {
  if (!ticket.driverLocation || !siteLocation.lat || !siteLocation.lng) return null;

  const distanceMiles = turf.distance(
    [ticket.driverLocation.lng, ticket.driverLocation.lat],
    [siteLocation.lng, siteLocation.lat],
    { units: 'miles' }
  );

  // Assume average urban speed of 30 mph (conservative for construction areas)
  const timeMinutes = Math.round((distanceMiles / 30) * 60);

  const arrival = new Date();
  arrival.setMinutes(arrival.getMinutes() + timeMinutes);

  return arrival.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

// Calculate delay in minutes
const getDelayInfo = (ticket: Ticket, currentETA: string | null) => {
  if (!ticket.anticipatedTime || !currentETA) return null;

  // Parse anticipated time (assumes format like "10:30 AM")
  const [time, period] = ticket.anticipatedTime.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;

  const anticipatedDate = new Date();
  anticipatedDate.setHours(hours, minutes, 0, 0);

  // Parse current ETA
  const currentDate = new Date();
  const [currentTime, currentPeriod] = currentETA.split(' ');
  let [currentHours, currentMinutes] = currentTime.split(':').map(Number);
  if (currentPeriod.toUpperCase() === 'PM' && currentHours !== 12) currentHours += 12;
  if (currentPeriod.toUpperCase() === 'AM' && currentHours === 12) currentHours = 0;
  currentDate.setHours(currentHours, currentMinutes, 0, 0);

  const diffMinutes = Math.round((currentDate.getTime() - anticipatedDate.getTime()) / 60000);

  return {
    minutes: diffMinutes,
    text: diffMinutes > 0 ? `${diffMinutes} min behind` : 
          diffMinutes < 0 ? `${Math.abs(diffMinutes)} min early` : 'on time',
    color: diffMinutes > 15 ? '#EF4444' : diffMinutes > 0 ? '#FBBF24' : '#22C55E'
  };
};

  // RESOLVE PROJECT ID
  useEffect(() => {
    if (!id) return;

    const resolve = async () => {
      const idStr = id as string;
      if (idStr.length >= 20) {
        setProjectId(idStr);
        return;
      }

      const q = query(collection(db, 'projects'), where('shortCode', '==', idStr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setProjectId(snap.docs[0].id);
      }
    };

    resolve();
  }, [id]);

  // LOAD SITE COORDS
  useEffect(() => {
    if (!projectId) return;

    const unsub = onSnapshot(doc(db, 'projects', projectId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.siteCoords) {
          setSiteLocation(data.siteCoords);
        }
      }
    });
    return unsub;
  }, [projectId]);

  // UNCLAIMED TICKETS LISTENER
  useEffect(() => {
    if (!projectId) {
      setUnclaimedTickets([]);
      return;
    }

    const q = query(
      collection(db, "tickets"),
      where("projectId", "==", projectId),
      where("status", "==", "unclaimed")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Ticket[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      setUnclaimedTickets(list);
    });

    return unsub;
  }, [projectId]);

  // CLAIMED-UNTRACKING (WAITING) LISTENER
  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, "tickets"),
      where("projectId", "==", projectId),
      where("status", "==", "claimed-untracking")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Ticket[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Ticket));
      setClaimedWaitingTickets(list);
    });

    return unsub;
  }, [projectId]);

  // EN-ROUTE (TRACKING + UNTRACKING) FOR MAP & LIVE
  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, "tickets"),
      where("projectId", "==", projectId),
      where("status", "in", ["claimed-tracking", "claimed-untracking"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Ticket[] = [];
      const alerts: string[] = [];

      snap.forEach((doc) => {
        const data = doc.data() as Ticket;
        const ticketId = doc.id;

        if (data.driverLocation) {
          list.push({ id: ticketId, ...data });
        }

        // Alerts
        if (data.gcNotified30min && !data.gcAlert30minShown) {
          alerts.push(`30 min out — ${data.material || 'Load'}`);
          updateDoc(doc.ref, { gcAlert30minShown: true });
        }
        if (data.gcNotified5min && !data.gcAlert5minShown) {
          alerts.push(`5 min out — ${data.material || 'Load'}`);
          updateDoc(doc.ref, { gcAlert5minShown: true });
        }
      });

      setDeliveries(list);
      // Filter and sort live (closest first via distance to site)
      const sortedLive = list.filter(t => t.status === "claimed-tracking").sort((a, b) => {
        if (!a.driverLocation || !b.driverLocation) return 0;
        const distA = turf.distance([a.driverLocation.lng, a.driverLocation.lat], [siteLocation.lng, siteLocation.lat], { units: 'miles' });
        const distB = turf.distance([b.driverLocation.lng, b.driverLocation.lat], [siteLocation.lng, siteLocation.lat], { units: 'miles' });
        return distA - distB;
      });
      setLiveTickets(sortedLive);

      if (alerts.length > 0) {
        setActiveAlerts(prev => [...prev, ...alerts]);
      }
    });

    return unsub;
  }, [projectId, siteLocation]);

  // MAP INIT & UPDATES
  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [siteLocation.lng, siteLocation.lat],
        zoom: 13,
      });

      new mapboxgl.Marker({ color: "#22c55e" })
        .setLngLat([siteLocation.lng, siteLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
        .addTo(map.current);
    }

    // Clear markers
    const clearMarkers = () => {
      if ((map.current as any)._warRoomMarkers) {
        (map.current as any)._warRoomMarkers.forEach((m: any) => m.remove());
      }
      (map.current as any)._warRoomMarkers = [];
    };
    clearMarkers();

    // Add markers
    deliveries.forEach((t) => {
      if (!t.driverLocation?.lat || !t.driverLocation?.lng) return;

      const size = t.vehicleType === '18-Wheeler' ? 32 :
                   t.vehicleType === 'Flatbed' ? 28 :
                   t.vehicleType === 'Box Truck' ? 26 : 24;

      const color = t.vehicleType === '18-Wheeler' ? '#dc2626' :
                    t.vehicleType === 'Flatbed' ? '#ea580c' :
                    t.vehicleType === 'Box Truck' ? '#ca8a04' : '#06b6d4';

      const el = document.createElement('div');
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;
      el.style.borderRadius = '50%';
      el.style.border = '4px solid white';
      el.style.boxShadow = '0 0 20px rgba(255,255,255,0.8)';
      el.style.cursor = 'pointer';

      const arrow = document.createElement('div');
      arrow.style.position = 'absolute';
      arrow.style.top = '50%';
      arrow.style.left = '50%';
      arrow.style.width = '0';
      arrow.style.height = '0';
      arrow.style.borderLeft = '8px solid transparent';
      arrow.style.borderRight = '8px solid transparent';
      arrow.style.borderBottom = '16px solid rgba(0,0,0,0.6)';
      arrow.style.transform = 'translate(-50%, -90%) rotate(0deg)';
      el.appendChild(arrow);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([t.driverLocation.lng, t.driverLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div class="font-bold">${t.material}</div>
          <div>${t.qty}</div>
          <div class="text-sm mt-1">${t.vehicleType || 'Unknown'}</div>
        `))
        .addTo(map.current!);

      (map.current as any)._warRoomMarkers.push(marker);
    });

    // Auto-zoom
    const active = deliveries.filter(t => t.driverLocation?.lat && t.driverLocation?.lng);
    if (active.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      active.forEach(t => bounds.extend([t.driverLocation.lng, t.driverLocation.lat]));
      bounds.extend([siteLocation.lng, siteLocation.lat]);
      map.current.fitBounds(bounds, { padding: 100, maxZoom: 16, duration: 1000 });
    }

    if (map.current) {
      map.current.resize();
    }

    return () => clearMarkers();
  }, [deliveries, siteLocation]);

  // RESIZE LISTENER
  useEffect(() => {
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ADD THIS BLOCK — Outside click to close menu
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (openMenuId && !(event.target as Element).closest('.menu-dropdown')) {
      setOpenMenuId(null);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [openMenuId]);

  // FUNCTIONS
  const createQuickTicket = async () => {
    if (!projectId) {
      alert('Project loading — try again in a few seconds');
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'projects', projectId));
      if (!snap.exists()) {
        alert('Project not found');
        return;
      }

      const p = snap.data() as Project;
      const shortId = generateShortId(7);

      await addDoc(collection(db, 'tickets'), {
        projectId: snap.id,
        shortId,
        material: "Drywall Sheets",
        qty: "800 sheets",
        status: "unclaimed",
        driverId: null,
        vehicleType: null,
        anticipatedTime: "10:30 AM",
        projectName: p.name || "Unknown",
        projectAddress: p.address || "No address",
        siteCoords: p.siteCoords || { lat: 46.21667, lng: -119.22323 },
        operatingHours: p.operatingHours || "Not set",
        siteStatus: p.status || "Open",
        projectContacts: [p.primaryContact, p.secondaryContact].filter(Boolean),
        csiDivision: Math.random() > 0.5 ? "08 - Doors and Windows" : "09 - Finishes",
        createdAt: serverTimestamp(),
        gcNotified30min: false,
        gcNotified5min: false,
      });

      const url = `${window.location.origin}/driver?ticketId=${shortId}`;
      await navigator.clipboard.writeText(url);
      alert(`TICKET CREATED!\n\nLink copied:\n${url}`);
    } catch (err) {
      console.error(err);
      alert("Failed — check console");
    }
  };

  const zoomToAll = () => {
    if (!map.current || deliveries.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    deliveries.forEach(d => {
      if (d.driverLocation) {
        bounds.extend([d.driverLocation.lng, d.driverLocation.lat]);
      }
    });
    bounds.extend([siteLocation.lng, siteLocation.lat]);

    map.current.fitBounds(bounds, { padding: 100, maxZoom: 16, duration: 1500 });
  };

  const zoomToDriver = (ticket: Ticket) => {
    setHighlightedId(ticket.id);
    if (map.current && ticket.driverLocation) {
      map.current.flyTo({
        center: [ticket.driverLocation.lng, ticket.driverLocation.lat],
        zoom: 17,
        duration: 1500,
      });
    }
    setTimeout(() => setHighlightedId(null), 4000);
  };

  // HELPER: Group by CSI (for Unclaimed/Claimed)
  const groupByCSI = (tickets: Ticket[]) => {
    return Object.entries(
      tickets.reduce((groups: Record<string, Ticket[]>, t) => {
        const csi = t.csiDivision || "Other";
        if (!groups[csi]) groups[csi] = [];
        groups[csi].push(t);
        return groups;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
    {/* Header */}
    <div style={{ 
      backgroundColor: '#6B21A8', 
      padding: '1rem 2rem',  // Narrower top/bottom
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      color: 'white',
      position: 'relative'  // For potential absolute button if flex doesn't fit
    }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>SUPER WAR ROOM</h1>
      <p style={{ fontSize: '1.25rem', margin: '0 1rem' }}>
        Project {projectId || id} — {deliveries.length} en route
      </p>
      <button
        onClick={createQuickTicket}
        style={{ 
          backgroundColor: '#16A34A', 
          color: 'white', 
          fontSize: '1rem', 
          fontWeight: 'bold', 
          padding: '0.75rem 1.5rem', 
          borderRadius: '0.75rem', 
          boxShadow: '0 0 10px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap'  // Prevent wrapping
        }}
      >
        + Quick Ticket
      </button>
</div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Pane: Tabs & Tickets */}
        {/* Left Pane: Rolling List with Filters */}
        <div style={{ flex: 1, backgroundColor: '#1F2937', padding: '1rem', overflowY: 'auto', color: 'white', display: 'flex', flexDirection: 'column' }}>
          {/* CSI Filter Carousel */}
          <div style={{ marginBottom: '1.5rem', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'inline-flex', gap: '0.75rem', alignItems: 'center' }}>
              {uniqueCSIDivisions.map((division) => (
                <button
                  key={division}
                  onClick={() => setActiveFilter(division)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: activeFilter === division ? '#3B82F6' : '#4B5563',
                    color: 'white',
                    borderRadius: '9999px',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: activeFilter === division ? 'bold' : 'normal',
                    cursor: 'pointer',
                  }}
                >
                  {division === "Other" ? "Other" : `Div ${division}`}
                </button>
              ))}
              <button
                onClick={() => setActiveFilter('ALL')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: activeFilter === 'ALL' ? '#16A34A' : '#374151',
                  color: 'white',
                  borderRadius: '9999px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  minWidth: '120px'
                }}
              >
                ALL DELIVERIES
              </button>
            </div>
          </div>

          {/* Alerts */}
          {activeAlerts.map((a, i) => (
            <div key={i} style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 'bold', backgroundColor: a.includes('30') ? '#CA8A04' : '#DC2626', color: 'white' }}>
              {a}
            </div>
          ))}

          {/* Single Rolling List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* LIVE Section */}
            {filteredLive.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#06B6D4', margin: '1.5rem 0 1rem' }}>
                  LIVE ({filteredLive.length})
                </h2>
{filteredLive.map((t) => {
  const currentETA = calculateCurrentETA(t);
  const delayInfo = getDelayInfo(t, currentETA);

  return (
    <div 
      key={t.id} 
      onClick={() => zoomToDriver(t)}
      style={{ 
        backgroundColor: highlightedId === t.id ? '#4B5563' : '#374151', 
        padding: '1.25rem', 
        borderRadius: '0.75rem', 
        position: 'relative', 
        marginBottom: '1rem',
        cursor: 'pointer',
        border: highlightedId === t.id ? '2px solid #06B6D4' : 'none',
        transition: 'all 0.2s'
      }}
    >
      {/* 3-dots */}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
  {/* Vehicle Icon */}
  {t.vehicleType ? (
    <span style={{ fontSize: '1.75rem' }}>
      {t.vehicleType === 'Van' && '🚐'}
      {t.vehicleType === 'Box Truck' && '🚚'}
      {t.vehicleType === 'Flatbed' && '🛻'}
      {t.vehicleType === '18-Wheeler' && '🚛🚛'}
    </span>
  ) : (
    <span style={{ fontSize: '1.75rem', opacity: 0.4 }}>❓</span>  // unknown
  )}

  {/* Material + Qty */}
  <p style={{ fontWeight: 'bold', margin: 0, fontSize: '1.125rem', color: '#EAB308' }}>
    {t.material} — {t.qty}
  </p>
</div>

      <p style={{ fontSize: '0.875rem', color: '#D1D5DB', margin: '0.5rem 0' }}>
        Agreed: <span style={{ fontWeight: 'bold' }}>{t.anticipatedTime || "ASAP"}</span>
        {currentETA && (
          <>
            {' → Current: '}
            <span style={{ fontWeight: 'bold' }}>{currentETA}</span>
            {delayInfo && (
              <span style={{ color: delayInfo.color, marginLeft: '0.5rem', fontWeight: '500' }}>
                ({delayInfo.text})
              </span>
            )}
          </>
        )}
      </p>

      <button onClick={(e) => { e.stopPropagation(); zoomToDriver(t); }} /* style */>
        Zoom to Driver
      </button>
    </div>
  );
})}
              </>
            )}

            {/* CLAIMED Section */}
            {filteredClaimed.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3B82F6', margin: '2rem 0 1rem' }}>
                  CLAIMED ({filteredClaimed.length})
                </h2>
                {groupByCSI(filteredClaimed).map(([csi, tickets]) => (
                  <div key={csi}>
                    <h3 style={{ fontSize: '1.125rem', color: '#60A5FA', margin: '1rem 0 0.5rem' }}>
                      {csi === "Other" ? "Other" : `Division ${csi}`}
                    </h3>
                    {tickets.map((t) => {
                      // Variables must be inside the arrow function
                      const currentETA = null; // No real-time location yet
                      const delayInfo = null;

                      return (
                        <div 
                          key={t.id} 
                          style={{ 
                            backgroundColor: '#374151', 
                            padding: '1.25rem', 
                            borderRadius: '0.75rem', 
                            position: 'relative', 
                            marginBottom: '1rem' 
                          }}
                        >
                          {/* Your 3-dots menu here */}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            {/* Vehicle Icon */}
                            {t.vehicleType ? (
                              <span style={{ fontSize: '1.75rem' }}>
                                {t.vehicleType === 'Van' && '🚐'}
                                {t.vehicleType === 'Box Truck' && '🚚'}
                                {t.vehicleType === 'Flatbed' && '🛻'}
                                {t.vehicleType === '18-Wheeler' && '🚛🚛'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '1.75rem', opacity: 0.4 }}>❓</span>  // unknown
                            )}

                            {/* Material + Qty */}
                            <p style={{ fontWeight: 'bold', margin: 0, fontSize: '1.125rem', color: '#EAB308' }}>
                              {t.material} — {t.qty}
                            </p>
                          </div>

                          {/* Enhanced ETA line */}
                          <p style={{ fontSize: '0.875rem', color: '#D1D5DB', margin: '0.5rem 0' }}>
                            Agreed: <span style={{ fontWeight: 'bold' }}>{t.anticipatedTime || "ASAP"}</span>
                            {currentETA && (
                              <>
                                {' → Current: '}
                                <span style={{ fontWeight: 'bold' }}>{currentETA}</span>
                                {delayInfo && (
                                  <span style={{ color: delayInfo.color, marginLeft: '0.5rem', fontWeight: '500' }}>
                                    ({delayInfo.text})
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}

            {/* UNCLAIMED Section */}
            {filteredUnclaimed.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#EAB308', margin: '2rem 0 1rem' }}>
                  UNCLAIMED ({filteredUnclaimed.length})
                </h2>
                {groupByCSI(filteredUnclaimed).map(([csi, tickets]) => (
                  <div key={csi}>
                    <h3 style={{ fontSize: '1.125rem', color: '#FBBF24', margin: '1rem 0 0.5rem' }}>
                      {csi === "Other" ? "Other" : `Division ${csi}`}
                    </h3>
                    {tickets.map((t) => {
                      const currentETA = null;
                      const delayInfo = null;

                      return (
                        <div 
                          key={t.id} 
                          style={{ 
                            backgroundColor: '#374151', 
                            padding: '1.25rem', 
                            borderRadius: '0.75rem', 
                            position: 'relative', 
                            marginBottom: '1rem' 
                          }}
                        >
                          {/* Your 3-dots menu here */}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            {/* Vehicle Icon */}
                            {t.vehicleType ? (
                              <span style={{ fontSize: '1.75rem' }}>
                                {t.vehicleType === 'Van' && '🚐'}
                                {t.vehicleType === 'Box Truck' && '🚚'}
                                {t.vehicleType === 'Flatbed' && '🛻'}
                                {t.vehicleType === '18-Wheeler' && '🚛🚛'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '1.75rem', opacity: 0.4 }}>❓</span>  // unknown
                            )}

                            {/* Material + Qty */}
                            <p style={{ fontWeight: 'bold', margin: 0, fontSize: '1.125rem', color: '#EAB308' }}>
                              {t.material} — {t.qty}
                            </p>
                          </div>

                          {/* Enhanced ETA line */}
                          <p style={{ fontSize: '0.875rem', color: '#D1D5DB', margin: '0.5rem 0' }}>
                            Agreed: <span style={{ fontWeight: 'bold' }}>{t.anticipatedTime || "ASAP"}</span>
                            {currentETA && (
                              <>
                                {' → Current: '}
                                <span style={{ fontWeight: 'bold' }}>{currentETA}</span>
                                {delayInfo && (
                                  <span style={{ color: delayInfo.color, marginLeft: '0.5rem', fontWeight: '500' }}>
                                    ({delayInfo.text})
                                  </span>
                                )}
                              </>
                            )}
                          </p>

                          {/* Copy Driver Link Button */}
                          <button
                            onClick={async () => {
                              const url = `${window.location.origin}/driver?ticketId=${t.shortId || t.id}`;
                              try {
                                await navigator.clipboard.writeText(url);
                                alert("Link copied!");
                              } catch {
                                prompt("Copy link:", url);
                              }
                            }}
                            style={{ 
                              marginTop: '1rem', 
                              width: '100%', 
                              backgroundColor: '#CA8A04', 
                              color: 'white', 
                              padding: '0.5rem', 
                              borderRadius: '0.5rem',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Copy Driver Link
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}

            {/* Empty State */}
            {filteredLive.length === 0 && filteredClaimed.length === 0 && filteredUnclaimed.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '1.5rem', marginTop: '4rem' }}>
                No tickets match filter
              </p>
            )}
          </div>
        </div>

        {/* Right Pane: Map */}
        <div style={{ flex: 2, position: 'relative', height: '100%' }}>
          <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          {/* Legend */}
          <div style={{ position: 'absolute', top: '1rem', left: '1rem', backgroundColor: 'rgba(0,0,0,0.7)', padding: '1rem', borderRadius: '0.5rem', zIndex: 10, color: 'white', fontSize: '0.875rem' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Vehicle Legend:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '1.25rem', height: '1.25rem', backgroundColor: '#06b6d4', borderRadius: '9999px', border: '2px solid white' }} /> Van</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '1.5rem', height: '1.5rem', backgroundColor: '#ca8a04', borderRadius: '9999px', border: '2px solid white' }} /> Box Truck</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '1.75rem', height: '1.75rem', backgroundColor: '#ea580c', borderRadius: '9999px', border: '2px solid white' }} /> Flatbed</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '2rem', height: '2rem', backgroundColor: '#dc2626', borderRadius: '9999px', border: '2px solid white' }} /> 18-Wheeler</div>
            </div>
          </div>

          {/* Buttons */}
          <button
            onClick={zoomToAll}
            style={{ position: 'absolute', bottom: '1rem', left: '1rem', backgroundColor: 'white', color: 'black', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', boxShadow: '0 10px 15px rgba(0,0,0,0.2)', zIndex: 10, fontWeight: 'bold' }}
          >
            Zoom to All Trucks
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ position: 'absolute', bottom: '1rem', right: '1rem', backgroundColor: 'white', color: 'black', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', boxShadow: '0 10px 15px rgba(0,0,0,0.2)', zIndex: 10, fontWeight: 'bold' }}
          >
            Refresh Map
          </button>
        </div>
      </div>
    </div>
  );
}