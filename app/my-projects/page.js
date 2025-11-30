// app/my-projects/page.js
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';

export default function MyProjects() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
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
            <p className="text-center text-3xl col-span-full text-gray-400">
              No projects yet. Create one or join with a Project ID.
            </p>
          ) : (
            projects.map((project) => (  // Changed 'p' to 'project' for clarity
              <Link
                key={project.id}
                href={`/project/${project.id}`}  // Use 'project.id'
                className="block bg-gray-800 rounded-2xl p-8 hover:bg-gray-700 transition-all shadow-xl"
              >
                <h2 className="text-4xl font-bold mb-4">{project.name || "Unnamed Project"}</h2>
                <p className="text-2xl text-orange-400 mb-2">ID: {project.id}</p>
                <p className="text-xl text-gray-400">GC PIN: {project.pin}</p>
                <p className="mt-6 text-green-400 font-semibold">
                  Status: {project.status === "open" ? "OPEN" : "CLOSED"}
                </p>
              </Link>
            ))
          )}
        </div>

        <div className="text-center mt-16">
          <Link
            href="/create-project"
            className="inline-block bg-green-600 hover:bg-green-500 px-16 py-10 rounded-3xl text-5xl font-bold shadow-2xl transition"
          >
            + Create New Project
          </Link>
        </div>
      </div>
    </div>
  );
}