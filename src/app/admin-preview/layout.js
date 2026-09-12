export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminPreviewLayout({ children }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      {children}
    </>
  );
}
