// app/driver/page.tsx
import { Suspense } from 'react';
import DriverContent from './DriverContent';

export default function DriverPage() {
  return (
    <Suspense fallback={<div className="text-6xl text-center mt-40">Loading...</div>}>
      <DriverContent />
    </Suspense>
  );
}