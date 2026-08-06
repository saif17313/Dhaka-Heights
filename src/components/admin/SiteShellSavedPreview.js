'use client';

import { PublicShellProvider } from '@/components/PublicShellProvider';
import Navbar from '@/components/Navbar';
import QuickInquiry from '@/components/QuickInquiry';
import Footer from '@/components/Footer';

export default function SiteShellSavedPreview({ shell }) {
  return <PublicShellProvider shell={shell}><div className="min-h-screen bg-[#f5f7fb]"><Navbar /><QuickInquiry /><main className="flex min-h-[70vh] items-center justify-center px-6 pt-32 text-center"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#B59410]">Authenticated saved preview</p><h1 className="mt-3 font-serif text-4xl font-bold text-[#0B1B3D]">{shell.brand.companyName}</h1><p className="mx-auto mt-4 max-w-xl text-sm text-slate-500">This preview uses the currently saved {shell.status} Site Shell, including navigation, branding, quick inquiry, and footer content.</p></div></main><Footer /></div></PublicShellProvider>;
}
