// Forgewright shell component — see rispecs/00-platform-architecture.spec.md
// Layer 5: Product Shell — Three-pane UI: Chat + Editor + Preview

export default function Shell() {
  return (
    <div className="flex h-screen w-full">
      {/* Chat pane */}
      <aside className="w-80 border-r border-neutral-800" />
      {/* Editor pane */}
      <main className="flex-1" />
      {/* Preview pane */}
      <aside className="w-96 border-l border-neutral-800" />
    </div>
  );
}
