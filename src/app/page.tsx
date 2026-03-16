// Forgewright app entry — see rispecs/00-platform-architecture.spec.md

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">
        Forgewright
      </h1>
      <p className="text-lg text-neutral-400">
        The forge that builds the forge
      </p>
      <div className="mt-8 flex gap-4 text-sm text-neutral-500">
        <span className="text-amber-500">🌅 East</span>
        <span className="text-red-500">🔥 South</span>
        <span className="text-blue-500">🌊 West</span>
        <span className="text-violet-500">❄️ North</span>
      </div>
    </main>
  );
}
