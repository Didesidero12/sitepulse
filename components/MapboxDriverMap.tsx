// components/MapboxDriverMap.tsx
"use client";

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "your-token-here";

export default function MapboxDriverMap({ location }: { location: { lat: number; lng: number } }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [location.lng, location.lat],
        zoom: 16,
      });
    }

    if (marker.current) marker.current.remove();
    marker.current = new mapboxgl.Marker({ color: "cyan" })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current!);

    map.current.easeTo({ center: [location.lng, location.lat] });

  }, [location]);

  return <div ref={mapContainer} className="h-full w-full" />;
}