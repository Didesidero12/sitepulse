"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function SubDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/sub-login');
        return;
      }

      try {
        // TODO: Replace with real sub profile joinedProjects array
        // For now, fetch all projects (demo)
        const q = query(collection(db, 'projects'));
        const snap = await getDocs(q);
        const projectList = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjects(projectList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>Loading your projects...</div>;
  }

  if (projects.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
      <h1>No projects yet</h1>
      <p>Ask your GC to invite you with a project link.</p>
    </div>;
  }

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '2rem' }}>
        My Projects
      </h1>

      <div style={{ display: 'grid', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {projects.map((project) => (
          <div 
            key={project.id}
            style={{
              backgroundColor: '#1F2937',
              borderRadius: '1rem',
              padding: '2rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }}
          >
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {project.name || 'Unnamed Project'}
            </h2>
            <p style={{ fontSize: '1.2rem', color: '#9CA3AF', marginBottom: '2rem' }}>
              {project.address || 'No address'}
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push(`/project/${project.id}/digital-whiteboard`)}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  borderRadius: '0.75rem',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}
              >
                📋 Digital Whiteboard
              </button>

              <button
                onClick={() => router.push(`/project/${project.id}/materials-pulse`)}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#F59E0B',
                  color: 'white',
                  borderRadius: '0.75rem',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}
              >
                🛠️ MaterialsPulse (Coming Soon)
              </button>

              <button
                onClick={() => router.push(`/project/${project.id}/gc`)}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#6B7280',
                  color: 'white',
                  borderRadius: '0.75rem',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}
              >
                👁️ View War Room
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}