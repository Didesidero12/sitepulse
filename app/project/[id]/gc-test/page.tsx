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
    if (!map.current || !ticket.driverLocation) return;

    map.current.flyTo({
      center: [ticket.driverLocation.lng, ticket.driverLocation.lat],
      zoom: 17,
      duration: 1500,
    });
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
      <div style={{ backgroundColor: '#6B21A8', padding: '2rem', textAlign: 'center', color: 'white' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>SUPER WAR ROOM</h1>
        <p style={{ fontSize: '1.875rem', marginTop: '0.5rem' }}>
          Project {projectId || id} — {deliveries.length} en route
        </p>
        <button
          onClick={createQuickTicket}
          style={{ marginTop: '2rem', backgroundColor: '#16A34A', color: 'white', fontSize: '1.25rem', fontWeight: 'bold', padding: '1rem 2.5rem', borderRadius: '1rem', transition: 'background-color 0.3s', boxShadow: '0 0 10px rgba(0,0,0,0.2)' }}
        >
          + Quick Ticket
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Pane: Tabs & Tickets */}
        <div style={{ flex: 1, backgroundColor: '#1F2937', padding: '1rem', overflowY: 'auto', color: 'white' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
            <button
              onClick={() => setActiveTab("live")}
              style={{ paddingBottom: '0.5rem', borderBottom: activeTab === "live" ? '4px solid #06B6D4' : '4px solid transparent', color: activeTab === "live" ? '#06B6D4' : '#9CA3AF' }}
            >
              LIVE ({liveTickets.length})
            </button>
            <button
              onClick={() => setActiveTab("claimed")}
              style={{ paddingBottom: '0.5rem', borderBottom: activeTab === "claimed" ? '4px solid #3B82F6' : '4px solid transparent', color: activeTab === "claimed" ? '#3B82F6' : '#9CA3AF' }}
            >
              CLAIMED ({claimedWaitingTickets.length})
            </button>
            <button
              onClick={() => setActiveTab("unclaimed")}
              style={{ paddingBottom: '0.5rem', borderBottom: activeTab === "unclaimed" ? '4px solid #EAB308' : '4px solid transparent', color: activeTab === "unclaimed" ? '#EAB308' : '#9CA3AF' }}
            >
              UNCLAIMED ({unclaimedTickets.length})
            </button>
          </div>

          {/* Alerts */}
          {activeAlerts.map((a, i) => (
            <div key={i} style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 'bold', backgroundColor: a.includes('30') ? '#CA8A04' : '#DC2626', color: 'white' }}>
              {a}
            </div>
          ))}

          {/* Tab Content */}
          {activeTab === "live" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {liveTickets.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '1.25rem' }}>No live deliveries</p>
              ) : (
                liveTickets.map((t) => (
                  <div key={t.id} style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '0.5rem' }}>
                    <p style={{ fontWeight: 'bold' }}>{t.material} — {t.qty}</p>
                    <p style={{ fontSize: '0.875rem', color: '#D1D5DB' }}>ETA: {t.anticipatedTime || "ASAP"}</p>
                    <button
                      onClick={() => zoomToDriver(t)}
                      style={{ marginTop: '0.5rem', backgroundColor: '#06B6D4', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontWeight: 'medium' }}
                    >
                      Zoom to Driver
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "claimed" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {claimedWaitingTickets.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '1.25rem' }}>No claimed tickets waiting</p>
              ) : (
                groupByCSI(claimedWaitingTickets).map(([csi, tickets]) => (
                  <div key={csi} style={{ backgroundColor: '#1F2937', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #4B5563' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3B82F6', marginBottom: '1rem' }}>
                      {csi === "Other" ? "Other Deliveries" : `Division ${csi}`}
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {tickets.map((t) => (
                        <div key={t.id} style={{ backgroundColor: '#374151', padding: '1.25rem', borderRadius: '0.75rem' }}>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#EAB308' }}>
                            {t.material} — {t.qty}
                          </p>
                          <p style={{ color: '#D1D5DB', marginTop: '0.25rem' }}>{t.projectName}</p>
                          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginTop: '0.5rem' }}>
                            ETA: {t.anticipatedTime || "ASAP"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "unclaimed" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {unclaimedTickets.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '1.875rem' }}>No unclaimed tickets</p>
              ) : (
                groupByCSI(unclaimedTickets).map(([csi, tickets]) => (
                  <div key={csi} style={{ backgroundColor: '#1F2937', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #4B5563' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3B82F6', marginBottom: '1rem' }}>
                      {csi === "Other" ? "Other Deliveries" : `Division ${csi}`}
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {tickets.map((t) => (
                        <div key={t.id} style={{ backgroundColor: '#374151', padding: '1.25rem', borderRadius: '0.75rem' }}>
                          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#EAB308' }}>
                            {t.material} — {t.qty}
                          </p>
                          <p style={{ color: '#D1D5DB', marginTop: '0.25rem' }}>{t.projectName}</p>
                          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginTop: '0.5rem' }}>
                            ETA: {t.anticipatedTime || "ASAP"}
                          </p>
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
                            style={{ marginTop: '1rem', width: '100%', backgroundColor: '#CA8A04', color: 'white', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: 'medium' }}
                          >
                            Copy Driver Link
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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