import Image from 'next/image';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-6xl font-bold mb-4">HOFFMAN-PILOT</h1>
      <p className="text-2xl text-gray-400 mb-10">Demo Project – Live Whiteboard + Delivery Map</p>

      <div className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto">
        {/* Delivery Map */}
        <div className="bg-gray-800 p-8 rounded-2xl border-4 border-green-600">
          <h2 className="text-4xl font-bold mb-6 text-green-400">Delivery Map</h2>
          <Image
            src="/site-map.png"
            alt="Site delivery map"
            width={1200}
            height={800}
            className="rounded-xl border-8 border-green-500 shadow-2xl"
          />
          <p className="text-center mt-4 text-green-400 text-xl">
            ↑ Green = Entry | Red = Exit | Blue = Unload Zone
          </p>
        </div>

        {/* Whiteboard */}
        <div className="bg-gray-800 p-8 rounded-2xl border-4 border-orange-600">
          <h2 className="text-4xl font-bold mb-6 text-orange-400">This Week – Whiteboard</h2>
          <table className="w-full table-fixed text-2xl text-center border-4 border-gray-600">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-4">Mon</th>
                <th className="p-4">Tue</th>
                <th className="p-4">Wed</th>
                <th className="p-4">Thu</th>
                <th className="p-4">Fri</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-orange-600 h-32">
                <td colSpan={5}>9:00 AM – Drywall – PCI (40 sheets)</td>
              </tr>
              <tr className="h-32 hover:bg-gray-700 cursor-pointer">
                <td colSpan={5}>Click any cell to book a delivery</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}