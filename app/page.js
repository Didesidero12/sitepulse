// app/page.js  ← THE VERSION THAT WILL NEVER FAIL
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-8xl font-black mb-12">SitePulse</h1>
      
      <div className="space-y-12 max-w-4xl">
        <Link
          href="/create-project"
          className="block bg-green-600 hover:bg-green-500 py-12 px-24 rounded-3xl text-5xl font-bold shadow-2xl"
        >
          Create New Project (GC only)
        </Link>

        <div className="bg-gray-800 py-12 px-16 rounded-3xl">
          <p className="text-3xl mb-8">Have a Project ID?</p>
          <p className="text-5xl font-mono tracking-widest mb-8">
            Type it here →{' '}
            <code className="bg-black px-8 py-4 rounded-xl">
              yoursite.netlify.app/join/ABC123
            </code>
          </p>
          <p className="text-2xl text-gray-400">
            Just replace ABC123 with your real 6-letter code
          </p>
        </div>
      </div>
    </div>
  );
}