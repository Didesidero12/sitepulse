// app/project/[id]/page.js
"use client";

import { useParams } from 'next/navigation';

export default function ProjectView() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 text-center">
      <h1 className="text-6xl font-bold mb-8">Project {id}</h1>
      <p className="text-3xl">Role picker + dashboard coming here tomorrow!</p>
    </div>
  );
}