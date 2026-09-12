import "./globals.css";
import { Suspense } from 'react';
import { Manrope, Playfair_Display } from 'next/font/google';
import { PublicShellProvider } from '@/components/PublicShellProvider';
import GlobalImageLightbox from '@/components/GlobalImageLightbox';
import RouteLoader from '@/components/RouteLoader';
import SmoothScroll from '@/components/SmoothScroll';
import { getPublishedSiteShell } from '@/lib/siteShellRepository';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const viewport = {
  themeColor: "#0B1B3D",
  width: "device-width",
  initialScale: 1.0,
};

export async function generateMetadata() {
  const shell = await getPublishedSiteShell();
  const meta = shell.metadata;
  const image = meta.ogImageMedia?.secureUrl;
  return {
    metadataBase: new URL(meta.canonicalUrl),
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonicalUrl },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.png', type: 'image/png', sizes: '192x192' },
        { url: '/assets/logo.svg', type: 'image/svg+xml' },
      ],
      apple: [
        { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
    },
    openGraph: { title: meta.ogTitle, description: meta.ogDescription, images: image ? [image] : [], type: 'website', url: meta.canonicalUrl },
    twitter: { card: 'summary_large_image', title: meta.ogTitle, description: meta.ogDescription, images: image ? [image] : [] },
  };
}

export default async function RootLayout({ children }) {
  const shell = await getPublishedSiteShell();
  return (
    <html lang="en" className={`${manrope.variable} ${playfair.variable}`}>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body>
        <SmoothScroll />
        <PublicShellProvider shell={shell}>
          <Suspense fallback={null}>
            <RouteLoader />
          </Suspense>
          {children}
          <GlobalImageLightbox />
        </PublicShellProvider>
      </body>
    </html>
  );
}
