import { Suspense } from 'react';
import DriverContent from './DriverContent';

export default function DriverPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading navigation...</div>}>
      <DriverContent />
    </Suspense>
  );
}

// Optional: Force dynamic if needed (extra safety)
export const dynamic = 'force-dynamic';