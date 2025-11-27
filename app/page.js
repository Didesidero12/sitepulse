// app/page.js  ← this is your new homepage
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-7xl font-bold mb-8">SitePulse</h1>
      <p className="text-3xl mb-12 text-center max-w-2xl">
        One link. Three experiences.<br />No more 7 AM delivery chaos.
      </p>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
        <Link href="/create-project" className="bg-green-600 hover:bg-green-500 p-12 rounded-2xl text-4xl font-bold text-center">
          Create New Project (GC only)
        </Link>
        <div className="bg-gray-800 p-12 rounded-2xl text-2xl">
          <p className="mb-4">Already have a Project ID?</p>
          <input
            placeholder="Enter 6-digit ID (e.g., H0FMN9)"
            className="w-full p-4 bg-gray-700 rounded-lg text-center text-3xl tracking-widest"
            onKeyUp={(e) => e.key === 'Enter' && e.target.value.length === 6 && window.location = `/join/${e.target.value.toUpperCase()}`}
          />
        </div>
      </div>
    </div>
  );
}