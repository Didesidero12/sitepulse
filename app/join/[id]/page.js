// app/join/[id]/page.js
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Join() {
  const { id } = useParams();
  const router = useRouter();
  const [pin, setPin] = useState('');

  if (!id || id.length !== 6) return <div>Invalid ID</div>;

  const go = (role) => {
    if (role === 'gc') {
      const entered = prompt("Enter 4-digit GC PIN");
      if (entered === "1234") { // replace with real check later
        router.push(`/project/${id}/gc`);
      } else {
        alert("Wrong PIN");
      }
    } else if (role === 'sub') {
      router.push(`/project/${id}/sub`);
    } else if (role === 'driver') {
      router.push(`/project/${id}/driver`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold mb-8">Project {id}</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <button onClick={()=>go('gc')} className="bg-blue-600 hover:bg-blue-500 p-12 rounded-2xl text-3xl font-bold">GC / Super</button>
        <button onClick={()=>go('sub')} className="bg-orange-600 hover:bg-orange-500 p-12 rounded-2xl text-3xl font-bold">Sub</button>
        <button onClick={()=>go('driver')} className="bg-green-600 hover:bg-green-500 p-12 rounded-2xl text-3xl font-bold">Driver</button>
      </div>
    </div>
  );
}