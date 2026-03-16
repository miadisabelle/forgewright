// Forgewright medicine wheel — see rispecs/00-platform-architecture.spec.md
// Four Directions navigation: East (inquiry) → South (planning) → West (action) → North (reflection)

export default function MedicineWheel() {
  return (
    <div className="flex items-center justify-center">
      {/* Medicine wheel SVG — implementation pending */}
      <svg viewBox="0 0 200 200" className="h-48 w-48">
        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1" opacity={0.2} />
        <circle cx="100" cy="20" r="8" fill="#F59E0B" /> {/* East */}
        <circle cx="180" cy="100" r="8" fill="#EF4444" /> {/* South */}
        <circle cx="100" cy="180" r="8" fill="#3B82F6" /> {/* West */}
        <circle cx="20" cy="100" r="8" fill="#8B5CF6" /> {/* North */}
      </svg>
    </div>
  );
}
