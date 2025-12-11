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

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function SuperWarRoom() {
  const { id } = useParams();
 const mapContainer = useRef<HTMLDivElement>(null);
 const map = useRef<mapboxgl.Map | null>(null);

 // STATE — CLEAN & FINAL
 const [deliveries, setDeliveries] = useState<any[]>([]);
 const [unclaimedTickets, setUnclaimedTickets] = useState<any[]>([]);
 const [activeTab, setActiveTab] = useState<"enroute" | "unclaimed">("enroute");
 const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
 const [siteLocation, setSiteLocation] = useState({ lat: 46.21667, lng: -119.22323 }); // Kennewick for testing

 const [projectId, setProjectId] = useState<string | null>(null);

useEffect(() => {
  if (!id) return;

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
}, [id]);

 // LOAD PROJECT SITE COORDS (so we can change later)
 useEffect(() => {
   const unsub = onSnapshot(doc(db, 'projects', id as string), (snap) => {
     if (snap.exists()) {
       const data = snap.data();
       if (data.siteCoords) {
         setSiteLocation(data.siteCoords);
       }
     }
   });
   return unsub;
 }, [id]);

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
 }, [id]);

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

  // FINAL RESOLVER — WORKS 100%
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
  }, [id]);

  // FINAL QUICK TICKET — WORKS WITH SHORTCODE
  const createQuickTicket = async () => {
    console.log("Quick Ticket clicked — projectId:", projectId);

    if (!projectId) {
      alert('Project still loading — wait 2 seconds');
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
        projectName: p.name || "Unknown",
        projectAddress: p.address || "No address",
        siteCoords: p.siteCoords || { lat: 46.21667, lng: -119.22323 },
        operatingHours: typeof p.operatingHours === 'string' ? p.operatingHours : "Not set",
        siteStatus: p.status || "Open",
        projectContacts: [
          { name: "Mike Rodriguez", phone: "503-555-0100", role: "Superintendent" },
          { name: "Sarah Chen", phone: "503-555-0101", role: "Project Manager" },
        ],
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

     {/* EN ROUTE TAB — MAP */}
     {activeTab === "enroute" && (
       <div className="flex-1 p-4">
         <div ref={mapContainer} className="w-full h-full rounded-2xl overflow-hidden" style={{ height: "75vh" }} />
       </div>
     )}

     {/* UNCLAIMED TAB — LIST */}
     {activeTab === "unclaimed" && (
       <div className="p-8">
         {unclaimedTickets.length === 0 ? (
           <p className="text-center text-gray-400 text-3xl mt-20">No unclaimed tickets</p>
         ) : (
           <div className="space-y-6">
             {unclaimedTickets.map((t) => (
               <div key={t.id} className="bg-gray-800 p-8 rounded-2xl border border-gray-700">
                 <p className="text-3xl font-bold text-yellow-300">{t.material} — {t.qty}</p>
                 <p className="text-xl text-gray-300 mt-2">{t.projectName || 'Unknown Project'}</p>
                 <p className="text-lg text-gray-400">{t.projectAddress}</p>
                 <button
                   onClick={async () => {
                     const url = `${window.location.origin}/driver?ticketId=${t.shortId || t.id}`;
                     await navigator.clipboard.writeText(url);
                     alert("Link copied!\n" + url);
                   }}
                   className="mt-4 bg-yellow-600 hover:bg-yellow-700 px-8 py-3 rounded-xl text-xl"
                 >
                   Copy Driver Link
                 </button>
               </div>
             ))}
           </div>
         )}
       </div>
     )}
   </div>
 );
}