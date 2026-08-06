export const STATUSES = ['new', 'contacted', 'qualified', 'closed', 'spam'];
export const STATUS_LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', closed: 'Closed', spam: 'Spam' };

export const TYPE_META = {
  contact: { label: 'Contact Message', icon: 'fa-envelope', badge: 'bg-slate-100 text-slate-700 border-slate-300', accent: '#64748b' },
  project_inquiry: { label: 'Project Inquiry', icon: 'fa-building', badge: 'bg-blue-50 text-blue-700 border-blue-300', accent: '#2563eb' },
  callback_request: { label: 'Callback Request', icon: 'fa-phone', badge: 'bg-purple-50 text-purple-700 border-purple-300', accent: '#7c3aed' },
  layout_request: { label: 'Layout Request', icon: 'fa-file-lines', badge: 'bg-amber-50 text-amber-700 border-amber-300', accent: '#b45309' },
  buyer_lead: { label: 'Buyer Enquiry', icon: 'fa-user-tag', badge: 'bg-emerald-50 text-emerald-700 border-emerald-300', accent: '#059669' },
  landowner_lead: { label: 'Landowner Submission', icon: 'fa-map-location-dot', badge: 'bg-rose-50 text-rose-700 border-rose-300', accent: '#e11d48' },
};
export const FALLBACK_TYPE = { label: 'Inquiry', icon: 'fa-inbox', badge: 'bg-slate-100 text-slate-700 border-slate-300', accent: '#64748b' };
export const typeMeta = (type) => TYPE_META[type] || FALLBACK_TYPE;
