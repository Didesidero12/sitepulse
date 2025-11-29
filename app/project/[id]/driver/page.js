// app/project/[id]/driver/page.js
"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg"; // Your token

export default function DriverView() {
  const { id } = useParams();
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [delivery, setDelivery] = useState(null);

  // Fake site location (replace with real from project)
  const siteLocation = { lat: 45.5231, lng: -122.6765 }; // Portland example

  // Load delivery data (fake for now)
  useEffect(() => {
    setDelivery({ material: "Doors from Italy", qty: "12 bifolds", needsForklift: true, eta: "30 min" });
  }, []);

  // Live tracking
  useEffect(() => {
    if (!tracking) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        updateDoc(doc(db, "projects", id), { driverLocation: newLoc }); // Send to Firebase
        checkGeofence(newLoc);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking]);

  // Geofencing alerts
  const checkGeofence = (loc) => {
    const dist = getDistance(loc, siteLocation);
    if (dist < 30 && dist > 15) alert("30 min out — forklift needed");
    if (dist < 15 && dist > 5) alert("15 min out — prepare unload");
    if (dist < 5) alert("5 min out — I'm here!");
  };

  // Simple distance calc (Haversine)
  const getDistance = (loc1, loc2) => {
    const R = 3958.8; // miles
    const rlat1 = loc1.lat * (Math.PI/180);
    const rlat2 = loc2.lat * (Math.PI/180);
    const difflat = rlat2-rlat1;
    const difflon = (loc2.lng-loc1.lng) * (Math.PI/180);

    const d = 2 * R * Math.asin(Math.sqrt(Math.sin(difflat/2)*Math.sin(difflat/2)+Math.cos(rlat1)*Math.cos(rlat2)*Math.sin(difflon/2)*Math.sin(difflon/2)));
    return d;
  };

  // Map setup
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 10
    });

    new mapboxgl.Marker({ color: 'green' }).setLngLat([siteLocation.lng, siteLocation.lat]).addTo(map);

    if (location) {
      new mapboxgl.Marker({ color: 'blue' }).setLngLat([location.lng, location.lat]).addTo(map);
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-green-600 p-8 text-center">
        <h1 className="text-4xl font-bold">DRIVER MODE</h1>
        <p className="text-2xl">Project {id}</p>
      </div>

      <div className="p-8 space-y-8">
        <div className="bg-gray-800 p-8 rounded-2xl text-center">
          <h2 className="text-3xl font-bold text-green-400 mb-4">DELIVERY</h2>
          <p className="text-4xl mb-2">{delivery?.material}</p>
          <p className="text-2xl mb-4">{delivery?.qty}</p>
          {delivery?.needsForklift && <p className="text-red-400 text-2xl">FORKLIFT NEEDED</p>}
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl text-center">
          <h2 className="text-3xl font-bold text-orange-400 mb-4">ETA</h2>
          <p className="text-8xl font-black">{delivery?.eta}</p>
        </div>

        <div id="map" className="h-64 rounded-2xl bg-gray-800"></div>

        <button onClick={() => setTracking(!tracking)} className={`${tracking ? 'bg-red-600' : 'bg-green-600'} hover:opacity-90 p-8 text-4xl font-bold rounded-2xl`}>
          {tracking ? "STOP TRACKING" : "START TRACKING"}
        </button>

        <button className="bg-blue-600 hover:bg-blue-500 p-8 text-4xl font-bold rounded-2xl">
          I’VE ARRIVED
        </button>
      </div>
    </div>
  );
}