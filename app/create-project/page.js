// app/create-project/page.js
"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';

export default function CreateProject() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name || pin.length !== 4) return alert("Name + 4-digit PIN required");
    setLoading(true);
    const id = nanoid(6).toUpperCase();
    await addDoc(collection(db, "projects"), {
      id,
      name,
      pin,
      createdAt: new Date(),
      status: "open"
    });
    alert(`Project created!\nID: ${id}\nGC PIN: ${pin}\nShare this ID with subs & drivers`);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="bg-gray-800 p-10 rounded-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">Create New Project</h1>
        <input placeholder="Project name" value={name} onChange={e=>setName(e.target.value)} className="w-full p-4 mb-4 bg-gray-700 rounded-lg text-xl" />
        <input placeholder="4-digit GC PIN" type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} className="w-full p-4 mb-8 bg-gray-700 rounded-lg text-xl text-center tracking-widest" />
        <button onClick={create} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 py-6 rounded-xl text-2xl font-bold">
          {loading ? "Creating..." : "Create Project"}
        </button>
      </div>
    </div>
  );
}