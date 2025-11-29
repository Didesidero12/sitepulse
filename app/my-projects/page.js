// app/my-projects/page.js
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';

export default function MyProjects() {
  const [projects, setProjects] = useState([]);
  const [userId] = useState("user_123"); // In real app: from auth

  useEffect(() => {
    // In real app: query projects the user has joined
    // For now: show all projects (demo mode)
    const q = query(collection(db, "projects"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setProjects(list);
    });
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-6xl font-bold mb-12 text-center">My Projects</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.length === 0 ? (
            <p className="text-center text-3xl col-span-full">
              No projects yet. Create one or join with a Project ID.
            </p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="block bg-gray-800 rounded-2xl p-8 hover:bg-gray-700 transition-all shadow-xl"
              >
                <h2 className="text-4xl font-bold mb-4">{p.name || "Unnamed Project"}</h2>
                <p className="text-2xl text-orange-400 mb-2">ID: {p.id}</p>
                <p className="text-xl text-gray-400">GC PIN: {p.pin}</p>
                <p className="mt-6 text-green-400 font-semibold">
                  Status: {p.status === "open" ? "OPEN" : "CLOSED"}
                </p>
              </Link>
            ))
          )}
        </div>

        <div className="text-center mt-16">
          <Link
            href="/create-project"
            className="bg-green-600 hover:bg-green-500 px-12 py-8 rounded-2xl text-4xl font-bold"
          >
            + Create New Project
          </Link>
        </div>
      </div>
    </div>
  );
}