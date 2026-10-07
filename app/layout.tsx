import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Saira_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const disp = Saira_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-disp" });
const body = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

// The tab title is rendered by App (<title> in components/App.tsx): neutral in the static HTML, which is the same page
// for every view (next.config.ts rewrites /c172s/electrical etc. to it), then the airplane shown once mounted.
export const metadata: Metadata = {
  description:
    "Interactive 3D walkthroughs of airplane systems from POH/AFM Section 7: Cirrus SR20 G6, Cessna 172S and 182T NAV III, Diamond DA40 XLS.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Apply the saved theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('sr20theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${disp.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
