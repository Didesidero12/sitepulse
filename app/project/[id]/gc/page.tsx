// app/project/[id]/gc/page.tsx — FINAL CLEAN VERSION (2025)
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp,
  updateDoc, doc, getDoc, getDocs  // ← ADD getDocs HERE
} from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import generateShortId from '@/utils/generateShortId';
import type { Project } from '@/lib/types';
import type { Ticket } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function SuperWarRoom() {
  const { id } = useParams();
 const mapContainer = useRef<HTMLDivElement>(null);
 const map = useRef<mapboxgl.Map | null>(null);

 // STATE — CLEAN & FINAL
 const [deliveries, setDeliveries] = useState<Ticket[]>([]);
 const [unclaimedTickets, setUnclaimedTickets] = useState<Ticket[]>([]);
 const [activeTab, setActiveTab] = useState<"enroute" | "unclaimed">("enroute");
 const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
 const [siteLocation, setSiteLocation] = useState({ lat: 46.21667, lng: -119.22323 }); // Kennewick for testing
 const [claimedWaitingTickets, setClaimedWaitingTickets] = useState<any[]>([]);  // claimed-untracking

 const [projectId, setProjectId] = useState<string | null>(null);

 
useEffect(() => {
  if (!projectId) return;

  // If the URL uses shortCode (like RTP--8), resolve to real ID
  const resolveProject = async () => {
    if (id.length <= 12) { // short codes are short
      const q = query(collection(db, 'projects'), where('shortCode', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setProjectId(snap.docs[0].id);
      }
    } else {
      setProjectId(id as string); // already long ID
    }
  };

  resolveProject();
}, [projectId]);

 // LOAD PROJECT SITE COORDS (so we can change later)
 useEffect(() => {
   const unsub = onSnapshot(doc(db, 'projects', projectId || id as string), (snap) => {
     if (snap.exists()) {
       const data = snap.data();
       if (data.siteCoords) {
         setSiteLocation(data.siteCoords);
       }
     }
   });
   return unsub;
 }, [projectId]);

// UNCLAIMED TICKETS — FINAL 100% WORKING VERSION
useEffect(() => {
  // Wait until we have the real projectId (from shortCode resolution)
  if (!projectId) {
    // Optional: set empty list so UI doesn't show old data
    setUnclaimedTickets([]);
    return;
  }

  console.log("Loading unclaimed tickets for projectId:", projectId);

  const q = query(
    collection(db, "tickets"),
    where("projectId", "==", projectId),        // ← use real ID only
    where("status", "==", "unclaimed")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    console.log("Unclaimed tickets loaded:", list.length);
    setUnclaimedTickets(list);
  });

  return unsub;
}, [projectId]);   // ← THIS IS THE KEY: depend on projectId, not id

// CLAIMED-WAITING TICKETS (claimed-untracking)
useEffect(() => {
  const q = query(
    collection(db, "tickets"),
    where("projectId", "==", id),
    where("status", "==", "claimed-untracking")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
    setClaimedWaitingTickets(list);
  });

  return unsub;
}, [projectId]);

 // EN ROUTE TRUCKS (claimed-tracking + claimed-untracking)
 useEffect(() => {
   const q = query(
     collection(db, "tickets"),
     where("projectId", "==", projectId || id),
     where("status", "in", ["claimed-tracking", "claimed-untracking"])
   );

   const unsub = onSnapshot(q, (snap) => {
     const list: any[] = [];
     const alerts: string[] = [];

     snap.forEach((doc) => {
       const data = doc.data();
       const ticketId = doc.id;

       if (data.driverLocation) {
         list.push({ id: ticketId, ...data });
       }

       // 30 / 5 min alerts
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
     if (alerts.length > 0) {
       setActiveAlerts(prev => [...prev, ...alerts]);
     }
   });

   return unsub;
 }, [projectId]);

 // MAP WITH LIVE CYAN DOTS + SITE MARKER
 useEffect(() => {
   if (!mapContainer.current) return;

   if (!map.current) {
     map.current = new mapboxgl.Map({
       container: mapContainer.current,
       style: "mapbox://styles/mapbox/streets-v12",
       center: [siteLocation.lng, siteLocation.lat],
       zoom: 13,
     });

     // Green site marker
     new mapboxgl.Marker({ color: "#22c55e" })
       .setLngLat([siteLocation.lng, siteLocation.lat])
       .setPopup(new mapboxgl.Popup().setHTML("<h3>Job Site</h3>"))
       .addTo(map.current);
   }

   // Clean old markers
   if ((map.current as any)._driverMarkers) {
     (map.current as any)._driverMarkers.forEach((m: any) => m.remove());
   }
   (map.current as any)._driverMarkers = [];

   // Add live driver markers
   deliveries.forEach((d) => {
     if (d.driverLocation) {
       const el = document.createElement('div');
       el.className = 'driver-marker';
       el.style.width = '20px';
       el.style.height = '20px';
       el.style.backgroundColor = 'cyan';
       el.style.borderRadius = '50%';
       el.style.border = '3px solid white';
       el.style.boxShadow = '0 0 15px cyan';

       new mapboxgl.Marker(el)
         .setLngLat([d.driverLocation.lng, d.driverLocation.lat])
         .setPopup(new mapboxgl.Popup().setHTML(`<strong>${d.material || 'TRUCK'}</strong>`))
         .addTo(map.current!);

       (map.current as any)._driverMarkers.push(el);
     }
   });

   // Auto-zoom to show all trucks + site
   if (deliveries.length > 0) {
     const bounds = new mapboxgl.LngLatBounds();
     deliveries.forEach(d => {
       if (d.driverLocation) bounds.extend([d.driverLocation.lng, d.driverLocation.lat]);
     });
     bounds.extend([siteLocation.lng, siteLocation.lat]);
     map.current.fitBounds(bounds, { padding: 100, maxZoom: 15 });
   }
 }, [deliveries, siteLocation]);

 // MULTI-TRUCK MARKERS — PULLED DIRECTLY FROM DRIVER PAGE LOGIC
useEffect(() => {
  if (!map.current || deliveries.length === 0) return;

  // Clear old markers
  if ((map.current as any)._warRoomMarkers) {
    (map.current as any)._warRoomMarkers.forEach((m: any) => m.remove());
  }
  (map.current as any)._warRoomMarkers = [];

  deliveries.forEach((t) => {
    if (!t.driverLocation) return;

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

    // Arrow triangle
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
}, [deliveries]);

  // FINAL RESOLVER — DEPENDS ON URL id, NOT projectId
  useEffect(() => {
    if (!id) {
      console.error("No ID in URL");
      return;
    }

    console.log("URL id:", id);

    const resolve = async () => {
      const idStr = id as string;

      if (idStr.length >= 20) {
        console.log("Long ID detected:", idStr);
        setProjectId(idStr);
        return;
      }

      console.log("Looking up shortCode:", idStr);
      const q = query(collection(db, 'projects'), where('shortCode', '==', idStr));
      const snap = await getDocs(q);

      if (snap.empty) {
        console.error("No project found with shortCode:", idStr);
        alert("Project not found — check shortCode");
        return;
      }

      const realId = snap.docs[0].id;
      console.log("Found real project ID:", realId);
      setProjectId(realId);
    };

    resolve();
  }, [id]);   // ← THIS MUST BE [id], NOT [projectId]

  const copyDriverLink = async (shortId: string) => {
    const url = `${window.location.origin}/driver?ticketId=${shortId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback for non-secure contexts
      prompt("Copy this link:", url);
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

  const zoomToDriver = (ticket: any) => {
    if (!map.current || !ticket.driverLocation) return;

    map.current.flyTo({
      center: [ticket.driverLocation.lng, ticket.driverLocation.lat],
      zoom: 17,
      duration: 1500,
    });
  };

// FINAL QUICK TICKET — PULLS ALL REAL PROJECT DATA
const createQuickTicket = async () => {
  // FINAL FIX — wait for projectId AND show helpful message
  if (!projectId) {
    alert('Project loading — wait 3 seconds after page load, then try again');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'projects', projectId));
    if (!snap.exists()) {
      alert('Project not found');
      return;
    }

    const p = snap.data();
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

      // PULL ALL REAL DATA FROM PROJECT — NO MORE HARDCODING
      projectName: p.name || "Unknown",
      projectAddress: p.address || "No address",
      siteCoords: p.siteCoords || { lat: 46.21667, lng: -119.22323 },
      operatingHours: p.operatingHours || "Not set",
      siteStatus: p.status || "Open",
      projectContacts: [p.primaryContact, p.secondaryContact].filter(Boolean),  // ← THIS IS THE FIX
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

 return (
   <div className="min-h-screen bg-gray-900 text-white flex flex-col">
     <div className="bg-purple-800 p-8 text-center">
       <h1 className="text-6xl font-bold">SUPER WAR ROOM</h1>
       <p className="text-3xl mt-2">Project {projectId || id} — {deliveries.length} en route</p>

       <button
         onClick={createQuickTicket}
         className="mt-8 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold py-4 px-10 rounded-2xl transition"
       >
         + Quick Ticket
       </button>

       <div className="flex justify-center gap-20 mt-10 text-2xl">
         <button
           onClick={() => setActiveTab("enroute")}
           className={activeTab === "enroute" ? "text-cyan-400 border-b-4 border-cyan-400 pb-2" : "text-gray-400"}
         >
           EN ROUTE ({deliveries.length})
         </button>
         <button
           onClick={() => setActiveTab("unclaimed")}
           className={activeTab === "unclaimed" ? "text-yellow-400 border-b-4 border-yellow-400 pb-2" : "text-gray-400"}
         >
           UNCLAIMED ({unclaimedTickets.length})
         </button>
       </div>
     </div>

     {/* ALERTS */}
     {activeAlerts.map((a, i) => (
       <div key={i} className={`mx-4 mt-4 p-4 rounded-lg text-center font-bold ${a.includes('30') ? 'bg-yellow-600' : 'bg-red-600'}`}>
         {a}
       </div>
     ))}

{/* EN ROUTE TAB — MULTI-TRUCK MAP FROM DRIVER PAGE */}
{activeTab === "enroute" && (
  <div className="flex-1 p-4">
    <div ref={mapContainer} className="w-full h-full rounded-2xl overflow-hidden" style={{ height: "75vh" }} />

    {/* VEHICLE ICON LEGEND */}
    <div className="absolute top-8 left-8 bg-black bg-opacity-70 p-4 rounded-xl z-10 text-sm">
      <p className="font-bold mb-2">Vehicle Legend:</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2"><div className="w-5 h-5 bg-cyan-400 rounded-full border-2 border-white" /> Van</div>
        <div className="flex items-center gap-2"><div className="w-6 h-6 bg-yellow-400 rounded border-2 border-white" /> Box Truck</div>
        <div className="flex items-center gap-2"><div className="w-7 h-7 bg-orange-500 rounded border-2 border-white" /> Flatbed</div>
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-red-600 rounded border-2 border-white" /> 18-Wheeler</div>
      </div>
    </div>

    {/* ZOOM TO ALL BUTTON */}
    <button
      onClick={zoomToAll}
      className="absolute bottom-8 right-8 bg-white text-black px-6 py-3 rounded-xl shadow-2xl z-10 font-bold hover:bg-gray-100"
    >
      Zoom to All Trucks
    </button>
  </div>
)}

     {/* UNCLAIMED TAB — CSI GROUPED, FINAL & BULLETPROOF */}
     {activeTab === "unclaimed" && (
       <div className="p-8">
         {unclaimedTickets.length === 0 ? (
           <p className="text-center text-gray-400 text-3xl mt-20">No unclaimed tickets</p>
         ) : (
           <div className="space-y-10">
             {Object.entries(
               unclaimedTickets.reduce((groups: Record<string, any[]>, t) => {
                 const csi = t.csiDivision || "Other";
                 if (!groups[csi]) groups[csi] = [];
                 groups[csi].push(t);
                 return groups;
               }, {})
             )
               .sort(([a], [b]) => a.localeCompare(b)) // alphabetical
               .map(([csi, tickets]) => (
                 <div key={csi} className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                   <h3 className="text-2xl font-bold text-blue-400 mb-6 pb-2 border-b-2 border-blue-400">
                     {csi === "Other" ? "Other Deliveries" : `Division ${csi}`}
                   </h3>
                   <div className="grid gap-4 md:grid-cols-2">
                     {tickets.map((t) => (
                       <div key={t.id} className="bg-gray-700 p-5 rounded-xl">
                         <p className="text-xl font-bold text-yellow-300">
                           {t.material} — {t.qty}
                         </p>
                         <p className="text-gray-300 mt-1">{t.projectName}</p>
                         <p className="text-sm text-gray-400 mt-2">
                           ETA: {t.anticipatedTime || "ASAP"}
                         </p>
                         <button
                           onClick={() => {
                             const url = `${window.location.origin}/driver?ticketId=${t.shortId || t.id}`;
                             navigator.clipboard.writeText(url).catch(() => prompt("Copy link:", url));
                             alert("Link copied!");
                           }}
                           className="mt-4 w-full bg-yellow-600 hover:bg-yellow-500 py-2 rounded-lg font-medium"
                         >
                           Copy Driver Link
                         </button>
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
           </div>
         )}
       </div>
     )}
   </div>
 );
}