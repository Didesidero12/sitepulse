// app/tracking/TrackingWrapper.tsx
import { Suspense } from 'react';
import TrackingClient from './TrackingClient';

export default function TrackingWrapper() {
  return (
    <Suspense fallback={null}>
      <TrackingClient />
    </Suspense>
  );
}