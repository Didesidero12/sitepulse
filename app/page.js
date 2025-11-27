import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-7xl font-bold mb-6">SitePulse</h1>
      <p className="text-2xl mb-10 text-center max-w-3xl">
        The real-time pulse of every load, every submittal, every job site on the planet.
      </p>
      <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-700 px-10 py-5 rounded-xl text-2xl font-semibold">
        Open Demo Dashboard →
      </Link>
    </div>
  );
}