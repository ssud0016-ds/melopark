import { useState } from 'react'

/**
 * Search bar for destination lookup.
 * Uses the browser's built-in geolocation or a text geocoding approach.
 * For the MVP, we provide a simple text input that geocodes via
 * Nominatim (OpenStreetMap's free geocoder).
 */
export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return

    try {
      // Geocode using Nominatim (free, no API key)
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query + ', Melbourne, Victoria, Australia')}` +
        `&format=json&limit=1`,
        { headers: { 'User-Agent': 'MelOPark/1.0 (university project)' } }
      )
      const results = await resp.json()

      if (results.length > 0) {
        onSearch({
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
          name: results[0].display_name,
        })
      } else {
        alert('Could not find that location. Try a street name or landmark in Melbourne CBD.')
      }
    } catch (err) {
      console.error('Geocoding failed:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search destination (e.g. Flinders Lane, State Library)"
        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300
                   focus:outline-none focus:ring-2 focus:ring-melopark-teal focus:border-transparent
                   text-sm bg-white"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 bg-melopark-teal text-white rounded-lg text-sm font-medium
                   hover:bg-melopark-teal-light transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Searching...' : 'Find parking'}
      </button>
    </form>
  )
}
