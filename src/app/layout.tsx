import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import CookieBanner from "@/components/CookieBanner";
import Providers from "@/components/Providers";

const ibm = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm",
  display: "swap",
});
const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neotravel - Transport de groupe intelligent",
  description:
    "Plateforme d'automatisation commerciale avec agent IA, devis et suivi des demandes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${ibm.variable} ${sora.variable}`}>
      <body>
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
