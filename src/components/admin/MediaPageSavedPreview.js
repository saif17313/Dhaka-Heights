'use client';
import { Suspense } from 'react';
import MediaCenterClient from '@/components/MediaCenterClient';
export default function MediaPageSavedPreview({mediaPage}){return <Suspense fallback={null}><MediaCenterClient mediaPage={mediaPage}/></Suspense>;}
