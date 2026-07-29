import { Link } from 'react-router-dom'

/**
 * Public landing page for Dock Market.
 * Provides navigation to auth and market pages.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 text-white">
      <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <h1 className="text-5xl font-bold mb-4">Dock Market</h1>
        <p className="text-xl text-blue-200 mb-8">
          A naval trading simulator — buy, sell, and sail your way to fortune across 14 cities.
        </p>

        <div className="flex gap-4 mb-16">
          <Link
            to="/auth"
            className="px-6 py-3 bg-white text-blue-900 font-semibold rounded-lg hover:bg-blue-50 transition"
          >
            Get Started
          </Link>
          <Link
            to="/market"
            className="px-6 py-3 border border-white rounded-lg hover:bg-white/10 transition"
          >
            View Market
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Trade Goods</h3>
            <p className="text-blue-200 text-sm">
              Buy low, sell high across a network of cities with dynamic market prices.
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Manage Ships</h3>
            <p className="text-blue-200 text-sm">
              Build your fleet with ships of varying speed and cargo capacity.
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Build Factories</h3>
            <p className="text-blue-200 text-sm">
              Invest in production facilities that generate items over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
