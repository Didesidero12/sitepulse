// app/test-slider/page.tsx
"use client";

import { useState } from 'react';

export default function TestSliderPage() {
  const [sheetExpanded, setSheetExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      {/* SLIDER CONTAINER */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-800 rounded-t-3xl shadow-2xl z-50">
        {/* DRAG HANDLE */}
        <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mt-4 mb-6 cursor-pointer" onClick={() => setSheetExpanded(!sheetExpanded)} />

        {/* CONTENT */}
        <div className="px-6 pb-8 text-center">
          <p className="text-2xl">Slider Test</p>
        </div>
      </div>
    </div>
  );
}