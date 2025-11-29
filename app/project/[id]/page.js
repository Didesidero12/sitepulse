// app/project/[id]/page.js   ← THIS IS THE MISSING ROOT PAGE
"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ProjectHome() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-7xl font-bold mb-8">Project {id}</h1>
      <p className="text-4xl mb-12">Choose your role:</p>

      <div className="grid md:grid-cols-3 gap-12 max-w-5xl">
        <Link href={`/project/${id}/gc`} className="bg-blue-600 hover:bg-blue-500 p-16 rounded-3xl text-5xl font-bold shadow-2xl">
          GC / Super
        </Link>
        <Link href={`/project/${id}/sub`} className="bg-orange-600 hover:bg-orange-500 p-16 rounded-3xl text-5xl font-bold shadow-2xl">
          Subcontractor
        </Link>
        <Link href={`/project/${id}/driver`} className="bg-green-600 hover:bg-green-500 p-16 rounded-3xl text-5xl font-bold shadow-2xl">
          Driver
        </Link>
      </div>
    </div>
  );
}