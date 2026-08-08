import "./globals.css";
import { PublicShellProvider } from '@/components/PublicShellProvider';
import GlobalImageLightbox from '@/components/GlobalImageLightbox';
import { getPublishedSiteShell } from '@/lib/siteShellRepository';

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
    icons: shell.brand.faviconMedia?.secureUrl ? { icon: shell.brand.faviconMedia.secureUrl } : undefined,
    openGraph: { title: meta.ogTitle, description: meta.ogDescription, images: image ? [image] : [], type: 'website', url: meta.canonicalUrl },
    twitter: { card: 'summary_large_image', title: meta.ogTitle, description: meta.ogDescription, images: image ? [image] : [] },
  };
}

export default async function RootLayout({ children }) {
  const shell = await getPublishedSiteShell();
  return (
    <html lang="en">
      <head>
        {/* Google Fonts: Playfair Display and Manrope */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />

        {/* FontAwesome Icons for UI */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <PublicShellProvider shell={shell}>
          {children}
          <GlobalImageLightbox />
        </PublicShellProvider>
      </body>
    </html>
  );
}
