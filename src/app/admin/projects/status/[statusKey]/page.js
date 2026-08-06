import { redirect } from 'next/navigation';

export default function LegacyProjectStatusPage() {
  redirect('/admin/projects');
}
