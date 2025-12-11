// app/my-projects/page.js — 100% WORKING .js VERSION
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

export default function MyProjects() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load projects
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

  // Create project
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target;

    const shortCode = (form.shortCode.value || "").trim().toUpperCase() || 
      Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      await addDoc(collection(db, 'projects'), {
        name: form.name.value,
        address: form.address.value,
        siteCoords: {
          lat: parseFloat(form.lat.value),
          lng: parseFloat(form.lng.value),
        },
        operatingHours: form.hours.value || "7:00 AM – 5:00 PM",
        status: "open",
        shortCode,
        primaryContact: {
          name: form.pcName.value,
          phone: form.pcPhone.value,
          role: "Superintendent",
        },
        secondaryContact: form.scName.value ? {
          name: form.scName.value,
          phone: form.scPhone.value || "",
          role: "Project Manager",
        } : null,
        createdAt: serverTimestamp(),
      });

      alert(`Project created!\nShort Code: ${shortCode}\nUse /project/${shortCode}`);
      setShowForm(false);
      form.reset();
    } catch (err) {
      alert("Failed to create project");
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-6xl font-bold mb-12 text-center">My Projects</h1>

        {/* Project List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {projects.length === 0 ? (
            <p className="text-center text-3xl col-span-full text-gray-400">
              No projects yet. Create one below!
            </p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.shortCode || p.id}`}
                className="block bg-gray-800 rounded-2xl p-8 hover:bg-gray-700 transition-all shadow-xl"
              >
                <h2 className="text-4xl font-bold mb-4">{p.name || "Unnamed Project"}</h2>
                <p className="text-2xl text-cyan-400 mb-2">Code: {p.shortCode || p.id}</p>
                <p className="text-xl text-gray-400 mb-4">{p.address || "No address"}</p>
                <p className="mt-6 text-green-400 font-semibold">
                  Status: {p.status === "open" ? "OPEN" : "CLOSED"}
                </p>
              </Link>
            ))
          )}
        </div>

        {/* Create Button / Form */}
        <div className="text-center">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-block bg-green-600 hover:bg-green-500 px-16 py-10 rounded-3xl text-5xl font-bold shadow-2xl"
            >
              + Create New Project
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-2xl">
              <input name="shortCode" placeholder="Project Code (e.g. RTP--8) — optional" className="w-full p-4 mb-4 rounded bg-gray-700" />
              <input name="name" placeholder="Project Name" required className="w-full p-4 mb-4 rounded bg-gray-700" />
              <input name="address" placeholder="Full Address" required className="w-full p-4 mb-4 rounded bg-gray-700" />
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input name="lat" type="number" step="any" placeholder="Latitude (e.g. 46.21667)" required className="p-4 rounded bg-gray-700" />
                <input name="lng" type="number" step="any" placeholder="Longitude (e.g. -119.22323)" required className="p-4 rounded bg-gray-700" />
              </div>
              <input name="hours" placeholder="Operating Hours" className="w-full p-4 mb-4 rounded bg-gray-700" />
              <input name="pcName" placeholder="Primary Contact Name" required className="w-full p-4 mb-4 rounded bg-gray-700" />
              <input name="pcPhone" placeholder="Primary Contact Phone" required className="w-full p-4 mb-4 rounded bg-gray-700" />
              <input name="scName" placeholder="Secondary Contact Name (optional)" className="w-full p-4 mb-4 rounded bg-gray-700" />
              <input name="scPhone" placeholder="Secondary Contact Phone (optional)" className="w-full p-4 mb-8 rounded bg-gray-700" />

              <div className="flex gap-4 justify-center">
                <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-500 px-12 py-6 rounded-xl text-2xl font-bold">
                  {loading ? "Creating..." : "Create Project"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-gray-600 hover:bg-gray-500 px-12 py-6 rounded-xl text-2xl font-bold">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}