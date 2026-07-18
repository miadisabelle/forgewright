import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Zilla_Slab } from "next/font/google";
import "@forgewright/styles/globals.css";

const zillaSlab = Zilla_Slab({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-zilla",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});

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
    <html
      lang="en"
      className={`h-full ${zillaSlab.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="h-full min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
