// app/dashboard/page.js
"use client";

import { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiZGlkZXNpZGVybzEyIiwiYSI6ImNtaWgwYXY1bDA4dXUzZnEzM28ya2k5enAifQ.Ad7ucDv06FqdI6btbbstEg";

export default function Dashboard() {
  const [drivers, setDrivers] = useState([]);

  // Fake site location
  const siteLocation = { lat: 45.5231, lng: -122.6765 };

  // Fake driver data (in real: from Firestore)
  useEffect(() => {
    setDrivers([
      { id: "Truck #47", loc: { lat: 45.5, lng: -122.6 }, eta: "25 min", material: "Doors", forklift: true }
    ]);
  }, []);

  // Map setup with driver dots
  useEffect () => {
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [siteLocation.lng, siteLocation.lat],
      zoom: 10
    });

    new mapboxgl.Marker({ color: 'green' }).setLngLat([siteLocation.lng, siteLocation.lat]).addTo(map);

    drivers.forEach(d => {
      new mapboxgl.Marker({ color: 'blue' }).setLngLat([d.loc.lng, d.loc.lat]).addTo(map);
    });
  }, [drivers]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-6xl font-bold mb-8">HOFFMAN-PILOT</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-8 rounded-2xl">
          <h2 className="text-4xl font-bold mb-4">Live Driver Map</h2>
          <div id="map" className="h-96 rounded-lg"></div>
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl">
          <h2 className="text-4xl font-bold mb-4">Incoming Deliveries</h2>
          {drivers.map(d => (
            <div key={d.id} className="bg-orange-600 p-4 rounded-lg mb-4">
              <p className="text-2xl">{d.id} – {d.material}</p>
              <p className="text-xl">ETA: {d.eta}</p>
              <p className="text-red-300">{d.forklift ? "Forklift Needed" : ""}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}