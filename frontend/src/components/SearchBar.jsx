import { useState } from 'react'
import { geocode } from '../services/geocoding'

/**
 * Search bar for destination lookup.
 * Geocodes the query via Nominatim and calls onSearch with the result.
 *
 * Props:
 *   onSearch(location) - called with { lat, lng, name } on success
 *   loading            - true while parking bay data is loading (disables button)
 */
export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return

    setSearching(true)
    setNotFound(false)

    try {
      const location = await geocode(query)
      if (location) {
        onSearch(location)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      console.error('Geocoding failed:', err)
      setNotFound(true)
    } finally {
      setSearching(false)
    }
  }

  function handleChange(e) {
    setQuery(e.target.value)
    if (notFound) setNotFound(false)
  }

  const isBusy = loading || searching

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search destination (e.g. Flinders Lane, State Library)"
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300
                     focus:outline-none focus:ring-2 focus:ring-melopark-teal focus:border-transparent
                     text-sm bg-white"
        />
        <button
          type="submit"
          disabled={isBusy}
          className="px-5 py-2.5 bg-melopark-teal text-white rounded-lg text-sm font-medium
                     hover:bg-melopark-teal-light transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {searching ? 'Searching...' : 'Find parking'}
        </button>
      </form>

      {notFound && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <span>No results found.</span>
          <span className="text-gray-500">Try a street name or landmark in Melbourne CBD.</span>
        </p>
      )}
    </div>
  )
}
