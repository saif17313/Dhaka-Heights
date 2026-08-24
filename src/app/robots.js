export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/admin-preview/', '/api/'],
    },
    sitemap: 'https://www.dhakaheights.com/sitemap.xml',
  };
}
