import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Saira_Condensed } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { vercelAnalytics } from "@/lib/staticExport";
import "./globals.css";

const disp = Saira_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-disp" });
// Keep Source Sans local: Google's generated URLs can break Turbopack's font query parser in clean CI builds.
const body = localFont({
  src: [
    { path: "./fonts/SourceSans3VF-Upright.woff2", weight: "400", style: "normal" },
    { path: "./fonts/SourceSans3VF-Upright.woff2", weight: "600", style: "normal" },
    { path: "./fonts/SourceSans3VF-Upright.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

// Each airplane's route names its airplane in the tab title (app/(fleet)/airplane-route.ts); the root keeps this one.
export const metadata: Metadata = {
  title: "Airplane Systems",
  description:
    "Interactive 3D walkthroughs of airplane systems from POH/AFM Section 7: Cirrus SR20 G6 and SR22T G6, Cessna 172S and 182T NAV III, Diamond DA40 XLS, Mooney M20C Ranger.",
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
      <body>
        {children}
        {vercelAnalytics(process.env.NEXT_PUBLIC_STATIC_EXPORT) && <Analytics />}
      </body>
    </html>
  );
}
