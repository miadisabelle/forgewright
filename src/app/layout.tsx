import type { Metadata, Viewport } from "next";
import "@forgewright/styles/globals.css";

export const metadata: Metadata = {
  title: "Forgewright",
  description: "The forge that builds the forge — graph-based agentic development platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-screen bg-neutral-950 text-neutral-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
