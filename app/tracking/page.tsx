// app/tracking/page.tsx
import { Suspense } from 'react';
import TrackingClient from './TrackingClient';

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-gray-900 flex items-center justify-center text-6xl text-white">Loading map...</div>}>
      <TrackingClient />
    </Suspense>
  );
}