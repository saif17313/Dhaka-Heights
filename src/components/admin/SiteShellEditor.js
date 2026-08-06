'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MediaLibrary from './MediaLibrary';
import { publishSiteShellDraft, saveSiteShellDraft } from '@/lib/siteShellActions';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1 block text-[11px] font-bold text-slate-700';
const PANELS = ['Brand & SEO', 'Preloader & Contact', 'Navigation', 'Footer', 'Advanced Structure'];
const sectionFields = {
  brand: [['companyName','Company name'],['brandTitle','Header brand title'],['brandSubtitle','Header brand subtitle'],['tagline','Brand tagline'],['logoAlt','Logo alt text']],
  metadata: [['title','Browser title'],['description','SEO description'],['canonicalUrl','Canonical URL'],['ogTitle','Social title'],['ogDescription','Social description']],
  preloader: [['title','Preloader title'],['subtitle','Preloader subtitle'],['durationMs','Duration (ms)','number']],
  mobileDrawer: [['address','Mobile drawer address'],['phone','Mobile drawer phone']],
  quickInquiry: [['tabLabel','Drawer tab label'],['title','Drawer heading'],['phone','Drawer phone'],['ctaLabel','Drawer CTA'],['targetId','Home target ID']],
  footer: [['brandDescription','Brand description'],['address','Office address'],['phone','Hotline'],['email','Email'],['website','Website label'],['copyright','Copyright'],['developerName','Developer name'],['developerUrl','Developer URL']],
};
function cleanShell(source) { return JSON.parse(JSON.stringify(source)); }
function comparable(shell) { const copy = cleanShell(shell); delete copy.history; delete copy.updatedBy; delete copy.publishedBy; return JSON.stringify(copy); }
function key(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function normalizeOrders(items) { return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })); }
function move(items, index, direction) { const destination = index + direction; if (destination < 0 || destination >= items.length) return items; const next = [...items]; [next[index], next[destination]] = [next[destination], next[index]]; return normalizeOrders(next); }
function targetProps(target) { return target === '_blank' ? { target, rel: 'noopener noreferrer' } : { target }; }

function Field({ label, value, type = 'text', onChange, multiline = false }) {
  const Control = multiline ? 'textarea' : 'input';
  return <label><span className={LABEL}>{label}</span><Control type={type} value={value ?? ''} rows={multiline ? 3 : undefined} onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} className={INPUT} /></label>;
}
function Reorder({ index, count, onMove, onRemove }) { return <div className="flex gap-1"><button type="button" disabled={!index} onClick={() => onMove(-1)} className="h-8 w-8 rounded-lg border disabled:opacity-30" aria-label="Move up">↑</button><button type="button" disabled={index === count - 1} onClick={() => onMove(1)} className="h-8 w-8 rounded-lg border disabled:opacity-30" aria-label="Move down">↓</button><button type="button" disabled={count <= 1} onClick={onRemove} className="h-8 w-8 rounded-lg border border-red-200 text-red-600 disabled:opacity-30" aria-label="Remove">×</button></div>; }

export default function SiteShellEditor({ initialShell, initialError = '' }) {
  const router = useRouter();
  const initial = useMemo(() => cleanShell(initialShell), [initialShell]);
  const [shell, setShell] = useState(initial);
  const [baseline, setBaseline] = useState(comparable(initial));
  const [panel, setPanel] = useState(PANELS[0]);
  const [structureText, setStructureText] = useState(() => JSON.stringify({ navigation: initial.navigation, footerGroups: initial.footerGroups, socialLinks: initial.socialLinks }, null, 2));
  const [mediaPicker, setMediaPicker] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(initialError);
  const [tone, setTone] = useState(initialError ? 'error' : 'neutral');
  const dirty = comparable(shell) !== baseline;
  const updateSection = (section, field, value) => setShell((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  const setRepeated = (field, value) => setShell((current) => ({ ...current, [field]: value }));
  const applyStructure = () => {
    try {
      const parsed = JSON.parse(structureText);
      if (!Array.isArray(parsed.navigation) || !Array.isArray(parsed.footerGroups) || !Array.isArray(parsed.socialLinks)) throw new Error('All three arrays are required.');
      setShell((current) => ({ ...current, navigation: parsed.navigation, footerGroups: parsed.footerGroups, socialLinks: parsed.socialLinks }));
      setTone('success'); setMessage('Structured navigation, footer, and social content applied locally. Save Draft to persist it.');
    } catch (error) { setTone('error'); setMessage(`Structured content is invalid: ${error.message}`); }
  };
  const selectMedia = (asset) => {
    const mapped = { id: asset.id, secureUrl: asset.secure_url || asset.secureUrl || asset.url, displayName: asset.display_name || asset.displayName || asset.filename, altText: asset.alt_text || asset.altText || '', format: asset.format };
    if (mediaPicker === 'logo') setShell((current) => ({ ...current, brand: { ...current.brand, logoMediaId: asset.id, logoMedia: mapped } }));
    if (mediaPicker === 'favicon') setShell((current) => ({ ...current, brand: { ...current.brand, faviconMediaId: asset.id, faviconMedia: mapped } }));
    if (mediaPicker === 'og') setShell((current) => ({ ...current, metadata: { ...current.metadata, ogImageMediaId: asset.id, ogImageMedia: mapped } }));
    setMediaPicker(null);
  };
  const save = async () => {
    setBusy('save'); setMessage('');
    try { const result = await saveSiteShellDraft(shell); if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Draft save failed.'); return; } const saved = cleanShell(result.data); setShell(saved); setBaseline(comparable(saved)); setTone('success'); setMessage('Draft saved. Public content remains unchanged.'); }
    finally { setBusy(''); }
  };
  const publish = async () => {
    setBusy('publish'); setMessage('');
    try { const result = await publishSiteShellDraft({ id: shell.id, expectedUpdatedAt: shell.updatedAt }); if (!result?.ok) { setTone('error'); setMessage(result?.error || 'Publish failed.'); return; } const published = cleanShell(result.data); setShell(published); setBaseline(comparable(published)); setTone('success'); setMessage('Global Site Shell published and every public route was revalidated.'); router.refresh(); }
    finally { setBusy(''); }
  };
  const renderFields = (section) => <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{sectionFields[section].map(([field,label,type]) => <Field key={field} label={label} type={type} multiline={['description','ogDescription','brandDescription','address'].includes(field)} value={shell[section][field]} onChange={(value) => updateSection(section, field, value)} />)}</div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">Global content workflow</p><h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">Site Shell Editor</h1><p className="text-xs text-slate-500">Version {shell.versionNumber} · {shell.status} · {dirty ? 'Unsaved changes' : 'Up to date'}</p></div><div className="flex gap-2"><Link href="/admin-preview/site-shell" target="_blank" className="rounded-xl border px-4 py-2 text-xs font-bold">Saved Preview</Link><button type="button" disabled={busy || !dirty} onClick={save} className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'save' ? 'Saving…' : 'Save Draft'}</button><button type="button" disabled={busy || shell.status !== 'draft' || dirty} onClick={publish} className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button></div></div>
    {message && <div className={`rounded-xl border p-3 text-xs font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message}</div>}
    <div className="flex flex-wrap gap-2">{PANELS.map((name) => <button type="button" key={name} onClick={() => { setPanel(name); if (name === 'Advanced Structure') setStructureText(JSON.stringify({ navigation: shell.navigation, footerGroups: shell.footerGroups, socialLinks: shell.socialLinks }, null, 2)); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${panel === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'}`}>{name}</button>)}</div>
    {panel === 'Advanced Structure' && <section className="rounded-2xl border bg-white p-5"><h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Complete repeated-content editor</h2><p className="mb-3 text-xs text-slate-500">Edit parent and child navigation, footer groups and links, or social records. Keys, targets, URLs, visibility, mobile modes, and sort order are validated again by the server and database.</p><textarea value={structureText} onChange={(event) => setStructureText(event.target.value)} rows={26} spellCheck={false} className={`${INPUT} font-mono leading-5`} /><button type="button" onClick={applyStructure} className="mt-3 rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white">Apply structured content</button></section>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><section className="space-y-5 rounded-2xl border bg-white p-5">
      {panel === 'Brand & SEO' && <><h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Brand identity</h2>{renderFields('brand')}<div className="grid gap-3 md:grid-cols-3">{[['logo','Logo',shell.brand.logoMedia],['favicon','Favicon',shell.brand.faviconMedia],['og','Social image',shell.metadata.ogImageMedia]].map(([name,label,item]) => <div key={name} className="rounded-xl border p-3"><span className={LABEL}>{label}</span>{item?.secureUrl && <img src={item.secureUrl} alt="" className="mb-2 h-24 w-full object-contain" />}<button type="button" onClick={() => setMediaPicker(name)} className="rounded-lg border px-3 py-2 text-xs font-bold">Choose media</button></div>)}</div><h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Metadata</h2>{renderFields('metadata')}</>}
      {panel === 'Preloader & Contact' && <><h2 className="font-serif text-lg font-bold">Preloader</h2>{renderFields('preloader')}<h2 className="font-serif text-lg font-bold">Mobile drawer</h2>{renderFields('mobileDrawer')}<h2 className="font-serif text-lg font-bold">Quick inquiry</h2>{renderFields('quickInquiry')}</>}
      {panel === 'Navigation' && <><div className="flex justify-between"><h2 className="font-serif text-lg font-bold">Primary navigation</h2><button type="button" onClick={() => setRepeated('navigation', [...shell.navigation, { itemKey: key('nav'), label: 'New Link', mobileLabel: 'New Link', url: '/', target: '_self', mobileMode: 'link', isVisible: true, children: [], sortOrder: (shell.navigation.length + 1) * 10 }])} className="rounded-lg border px-3 text-xs font-bold">+ Add</button></div>{shell.navigation.map((item,index) => <div key={item.itemKey} className="space-y-3 rounded-xl border p-3"><div className="flex justify-between"><strong className="text-xs">{item.label}</strong><Reorder index={index} count={shell.navigation.length} onMove={(direction) => setRepeated('navigation', move(shell.navigation,index,direction))} onRemove={() => confirm('Remove this navigation item?') && setRepeated('navigation', normalizeOrders(shell.navigation.filter((_,i) => i !== index)))} /></div><div className="grid gap-2 md:grid-cols-3"><Field label="Desktop label" value={item.label} onChange={(value) => setRepeated('navigation', shell.navigation.map((x,i) => i===index ? {...x,label:value}:x))}/><Field label="Mobile label" value={item.mobileLabel} onChange={(value) => setRepeated('navigation', shell.navigation.map((x,i) => i===index ? {...x,mobileLabel:value}:x))}/><Field label="URL" value={item.url} onChange={(value) => setRepeated('navigation', shell.navigation.map((x,i) => i===index ? {...x,url:value}:x))}/></div><label className="text-xs"><input type="checkbox" checked={item.isVisible} onChange={(e) => setRepeated('navigation', shell.navigation.map((x,i) => i===index ? {...x,isVisible:e.target.checked}:x))}/> Visible</label><p className="text-[10px] text-slate-500">Dropdown children: {item.itemKey === 'nav-concern' ? 'Derived from published Concerns' : item.children.map((child) => child.label).join(', ') || 'None'}</p></div>)}</>}
      {panel === 'Footer' && <><h2 className="font-serif text-lg font-bold">Footer contact and credits</h2>{renderFields('footer')}<h2 className="font-serif text-lg font-bold">Link groups</h2>{shell.footerGroups.map((group,gIndex) => <div key={group.groupKey} className="space-y-2 rounded-xl border p-3"><Field label="Group title" value={group.title} onChange={(value) => setRepeated('footerGroups', shell.footerGroups.map((x,i)=>i===gIndex?{...x,title:value}:x))}/>{group.links.map((item,lIndex) => <div key={item.linkKey} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Field label="Label" value={item.label} onChange={(value)=>setRepeated('footerGroups',shell.footerGroups.map((x,i)=>i===gIndex?{...x,links:x.links.map((l,j)=>j===lIndex?{...l,label:value}:l)}:x))}/><Field label="URL" value={item.url} onChange={(value)=>setRepeated('footerGroups',shell.footerGroups.map((x,i)=>i===gIndex?{...x,links:x.links.map((l,j)=>j===lIndex?{...l,url:value}:l)}:x))}/><label className="pt-6 text-xs"><input type="checkbox" checked={item.isVisible} onChange={(e)=>setRepeated('footerGroups',shell.footerGroups.map((x,i)=>i===gIndex?{...x,links:x.links.map((l,j)=>j===lIndex?{...l,isVisible:e.target.checked}:l)}:x))}/> Visible</label></div>)}</div>)}<h2 className="font-serif text-lg font-bold">Social links</h2>{shell.socialLinks.map((item,index)=><div key={item.itemKey} className="grid gap-2 rounded-xl border p-3 md:grid-cols-3"><Field label="Platform" value={item.platformName} onChange={(value)=>setRepeated('socialLinks',shell.socialLinks.map((x,i)=>i===index?{...x,platformName:value}:x))}/><Field label="URL" value={item.url} onChange={(value)=>setRepeated('socialLinks',shell.socialLinks.map((x,i)=>i===index?{...x,url:value}:x))}/><Field label="Icon key" value={item.iconKey} onChange={(value)=>setRepeated('socialLinks',shell.socialLinks.map((x,i)=>i===index?{...x,iconKey:value}:x))}/></div>)}</>}
    </section><aside className="space-y-4 rounded-2xl border bg-[#071a3b] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C5A880]">Local preview</p><div className="flex items-center gap-3"><img src={shell.brand.logoMedia?.secureUrl} alt="" className="h-12 w-12 object-contain"/><div><div className="font-serif font-bold">{shell.brand.brandTitle}</div><div className="text-[9px] text-[#C5A880]">{shell.brand.brandSubtitle}</div></div></div><div className="flex flex-wrap gap-3 text-[10px]">{shell.navigation.filter(x=>x.isVisible).map(x=><span key={x.itemKey}>{x.label}</span>)}</div><hr className="border-white/10"/><p className="text-xs leading-6 text-white/70">{shell.footer.brandDescription}</p><div className="text-xs"><div>{shell.footer.address}</div><div>{shell.footer.phone}</div><div>{shell.footer.email}</div></div><div className="flex gap-3">{shell.socialLinks.filter(x=>x.isVisible).map(x=><a key={x.itemKey} href={x.url} {...targetProps(x.target)} aria-label={x.platformName}><i className={`fa-brands ${x.iconKey}`}/></a>)}</div></aside></div>
    {shell.history?.length > 0 && <section className="rounded-2xl border bg-white p-5"><h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Revision history</h2><div className="mt-3 space-y-2">{shell.history.map((revision) => <div key={revision.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">{revision.change_summary || revision.summary || 'Saved Site Shell revision'}</span><span className="text-slate-500">v{revision.version_number || revision.revisionNumber} · {new Date(revision.created_at || revision.createdAt).toLocaleString()}</span></div>)}</div></section>}
    {mediaPicker && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-7xl"><MediaLibrary isModal resourceTypeFilter="image" onSelectAsset={selectMedia} onCloseModal={() => setMediaPicker(null)} /></div></div>}
  </div>;
}
