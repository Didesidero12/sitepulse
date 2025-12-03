// app/driver-tracking/page.tsx
import { Suspense } from 'react';
import DriverTrackingContent from './DriverTrackingContent';

export default function DriverTrackingPage() {
  return (
    <Suspense fallback={<div className="text-6xl text-white text-center mt-40">Loading tracking...</div>}>
      <DriverTrackingContent />
    </Suspense>
  );
}