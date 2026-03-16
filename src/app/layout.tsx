import type { Metadata } from "next";
import "@forgewright/styles/globals.css";

export const metadata: Metadata = {
  title: "Forgewright",
  description: "The forge that builds the forge — graph-based agentic development platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
