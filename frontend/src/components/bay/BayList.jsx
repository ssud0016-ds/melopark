import BayCard from './BayCard'

export default function BayList({ visibleBays, selectedBayId, destination, onSelect }) {
  if (!visibleBays.length) {
    return (
      <div className="text-center py-8 px-4 text-gray-400 dark:text-gray-500">
        <div className="text-3xl mb-2.5">🅿️</div>
        <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">No bays match</div>
        <div className="text-sm">Try a different filter or widen your search</div>
      </div>
    )
  }

  return (
    <div className="px-3 pb-5 pt-1" role="listbox" aria-label="Parking bays">
      {visibleBays.map((bay) => (
        <BayCard
          key={bay.id}
          bay={bay}
          selected={bay.id === selectedBayId}
          destination={destination}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
