import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { studyFontStyle } from "./fonts/study-fonts";
import { Analytics } from "@vercel/analytics/next";
import { vercelAnalytics } from "@/lib/staticExport";
import { THEME_COLORS } from "@/lib/theme";
import { OfflineSupport } from "@/components/OfflineSupport";
import "./globals.css";

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

// Each airplane's route names its airplane in the tab title (app/(fleet)/airplane-route.ts); the root keeps this one.
export const metadata: Metadata = {
  title: "Airplane Systems",
  applicationName: "Airplane Systems",
  appleWebApp: {
    capable: true,
    title: "Airplane Systems",
    statusBarStyle: "default",
  },
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  description:
    "Interactive 3D walkthroughs of airplane systems from POH/AFM Section 7: Cirrus SR20 G6 and SR22T G6, Cessna 172S and 182T NAV III, Diamond DA40 XLS, Mooney M20C Ranger.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

// Apply the saved theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('sr20theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.media=m.content===${JSON.stringify(THEME_COLORS)}[t]?'all':'not all'})}catch(e){}`;
// A page whose code fails to download never hydrates: mark it so the Loader says so (components/Loader.tsx LoadFailed),
// and make its Retry reload the page, without waiting for React (in the capture phase: React holds back a click on a part
// of the page still waiting to hydrate, to replay it once it has).
const loadFailedScript = `addEventListener('error',function(e){var s=e.target;if(s&&s.tagName==='SCRIPT'&&s.src.indexOf('/_next/')>=0)document.documentElement.setAttribute('data-load-failed','')},true);addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[data-reload]'))location.reload()},true)`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={body.variable} style={studyFontStyle} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: loadFailedScript }} />
      </head>
      <body>
        {children}
        <OfflineSupport />
        {vercelAnalytics(process.env.NEXT_PUBLIC_STATIC_EXPORT) && <Analytics />}
      </body>
    </html>
  );
}
