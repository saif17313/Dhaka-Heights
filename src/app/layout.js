import "./globals.css";
import { Suspense } from 'react';
import { Manrope, Playfair_Display } from 'next/font/google';
import { PublicShellProvider } from '@/components/PublicShellProvider';
import GlobalImageLightbox from '@/components/GlobalImageLightbox';
import RouteLoader from '@/components/RouteLoader';
import SmoothScroll from '@/components/SmoothScroll';
import FontAwesomeLoader from '@/components/FontAwesomeLoader';
import { getPublishedSiteShell } from '@/lib/siteShellRepository';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
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
    icons: { icon: '/assets/logo.svg' },
    openGraph: { title: meta.ogTitle, description: meta.ogDescription, images: image ? [image] : [], type: 'website', url: meta.canonicalUrl },
    twitter: { card: 'summary_large_image', title: meta.ogTitle, description: meta.ogDescription, images: image ? [image] : [] },
  };
}

export default async function RootLayout({ children }) {
  const shell = await getPublishedSiteShell();
  return (
    <html lang="en" className={`${manrope.variable} ${playfair.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />
        <link
          rel="preload"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          as="style"
        />
        <noscript>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        </noscript>
      </head>
      <body>
        <FontAwesomeLoader />
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
