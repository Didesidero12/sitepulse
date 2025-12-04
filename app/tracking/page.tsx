// app/tracking/page.tsx
import { Suspense } from 'react';
import TrackingClient from './TrackingClient';

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="text-6xl text-center mt-40">Loading...</div>}>
      <TrackingClient />
    </Suspense>
  );
}