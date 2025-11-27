// app/page.js  ← HOMEPAGE (fixed for Netlify build)
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-7xl font-bold mb-8">SitePulse</h1>
      <p className="text-3xl mb-12 text-center max-w-2xl">
        One link. Three experiences.<br />
        No more 7 AM delivery chaos.
      </p>

      <div className="grid md:grid-cols-2 gap-12 max-w-4xl">
        <Link
          href="/create-project"
          className="bg-green-600 hover:bg-green-500 p-16 rounded-3xl text-4xl font-bold text-center shadow-2xl"
        >
          Create New Project<br />
          <span className="text-2xl">(GC / Superintendent only)</span>
        </Link>

        <div className="bg-gray-800 p-16 rounded-3xl shadow-2xl">
          <p className="text-2xl mb-8 text-center">Have a Project ID?</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.target.elements.id;
              if (input.value.length === 6) {
                window.location.href = `/join/${input.value.toUpperCase()}`;
              }
            }}
            className="flex flex-col items-center"
          >
            <input
              name="id"
              placeholder="H0FMN9"
              maxLength={6}
              required
              className="w-full p-6 bg-gray-700 rounded-xl text-4xl text-center tracking-widest font-mono mb-6"
            />
            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-500 py-6 rounded-xl text-3xl font-bold"
            >
              Join Project →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}