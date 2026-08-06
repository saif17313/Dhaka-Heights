'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AboutPageClient from '@/components/AboutPageClient';
import MediaLibrary from './MediaLibrary';
import { publishAboutPageDraft, saveAboutPageDraft } from '@/lib/aboutPageActions';

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#C5A880] focus:ring-2 focus:ring-[#C5A880]/20';
const LABEL = 'mb-1 block text-[11px] font-bold text-slate-700';
const TABS = ['Content', 'Media', 'Pillars', 'Team', 'Concerns', 'Accreditations', 'Preview', 'Advanced'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function payload(about) {
  return {
    id: about.id,
    pageId: about.pageId,
    sectionKey: 'about-page',
    isVisible: about.isVisible,
    content: about.content,
    media: about.media.map(({ role, mediaId, imageAlt, isVisible = true }) => ({
      role,
      mediaId,
      imageAlt,
      isVisible,
    })),
    pillars: about.pillars.map(
      ({ itemKey, title, description, iconKey, mediaId, imageAlt, isVisible }) => ({
        itemKey,
        title,
        description,
        iconKey,
        mediaId,
        imageAlt,
        isVisible,
      }),
    ),
    teamCategories: (about.teamCategories || []).map(
      ({ itemKey, title, description, isVisible }) => ({
        itemKey,
        title,
        description,
        isVisible,
      }),
    ),
    teamMembers: (about.teamMembers || []).map(
      ({ itemKey, categoryKey, name, role, biography, mediaId, imageAlt, isVisible }) => ({
        itemKey,
        categoryKey,
        name,
        role,
        biography,
        mediaId: mediaId || null,
        imageAlt,
        isVisible,
      }),
    ),
    concerns: about.concerns.map(
      ({ canonicalId, title, description, ctaLabel, mediaId, isVisible }) => ({
        canonicalId,
        title,
        description,
        ctaLabel,
        mediaId,
        isVisible,
      }),
    ),
    accreditations: about.accreditations.map(({ itemKey, title, iconKey, isVisible }) => ({
      itemKey,
      title,
      iconKey,
      isVisible,
    })),
    updatedAt: about.updatedAt,
  };
}

function comparable(value) {
  return JSON.stringify(payload(value));
}

function newKey(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function orders(items) {
  return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}

function move(items, index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return orders(next);
}

function Field({ label, value, onChange, multiline = false, type = 'text', placeholder = '' }) {
  const Control = multiline ? 'textarea' : 'input';
  return (
    <label>
      <span className={LABEL}>{label}</span>
      <Control
        type={type}
        rows={multiline ? 5 : undefined}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
      />
    </label>
  );
}

function Controls({ index, count, onMove, onRemove, minimum = 1 }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={!index}
        className="h-8 w-8 rounded-lg border disabled:opacity-30"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        className="h-8 w-8 rounded-lg border disabled:opacity-30"
        aria-label="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={count <= minimum}
        className="h-8 w-8 rounded-lg border border-red-200 text-red-600 disabled:opacity-30"
        aria-label="Remove"
      >
        ×
      </button>
    </div>
  );
}

export default function AboutPageEditor({ initialAbout }) {
  const router = useRouter();
  const initial = useMemo(() => clone(initialAbout), [initialAbout]);
  const [about, setAbout] = useState(initial);
  const [baseline, setBaseline] = useState(comparable(initial));
  const [tab, setTab] = useState('Content');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('neutral');
  const [picker, setPicker] = useState(null);
  const [advanced, setAdvanced] = useState(() => JSON.stringify(payload(initial), null, 2));
  const dirty = comparable(about) !== baseline;

  const update = (patch) => {
    setAbout((current) => ({ ...current, ...patch }));
    setMessage('');
  };

  const updateContent = (section, key, value) =>
    update({
      content: {
        ...about.content,
        [section]: { ...about.content[section], [key]: value },
      },
    });

  const updateRepeated = (field, index, patch) =>
    update({
      [field]: about[field].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });

  const choose = (asset) => {
    const mapped = {
      id: asset.id,
      secureUrl: asset.secure_url || asset.secureUrl || asset.url,
      displayName: asset.display_name || asset.displayName || asset.filename,
      altText: asset.alt_text || asset.altText || '',
      format: asset.format,
    };

    if (picker.type === 'media') {
      updateRepeated('media', picker.index, { mediaId: asset.id, media: mapped });
    } else if (picker.type === 'pillar') {
      updateRepeated('pillars', picker.index, { mediaId: asset.id, media: mapped });
    } else if (picker.type === 'team') {
      updateRepeated('teamMembers', picker.index, {
        mediaId: asset.id,
        media: mapped,
        imageAlt:
          about.teamMembers[picker.index].imageAlt ||
          mapped.altText ||
          `${about.teamMembers[picker.index].name || 'Team member'} portrait`,
      });
    } else {
      updateRepeated('concerns', picker.index, { mediaId: asset.id, media: mapped });
    }
    setPicker(null);
  };

  const save = async () => {
    setBusy('save');
    try {
      const result = await saveAboutPageDraft(payload(about));
      if (!result?.ok) {
        setTone('error');
        setMessage(result?.error || 'Draft save failed.');
        return;
      }
      const saved = {
        ...clone(result.data),
        availableConcerns: about.availableConcerns,
        history: about.history,
      };
      setAbout(saved);
      setBaseline(comparable(saved));
      setTone('success');
      setMessage('About page draft saved. Public content remains unchanged.');
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    setBusy('publish');
    try {
      const result = await publishAboutPageDraft({
        id: about.id,
        expectedUpdatedAt: about.updatedAt,
      });
      if (!result?.ok) {
        setTone('error');
        setMessage(result?.error || 'Publish failed.');
        return;
      }
      const published = {
        ...clone(result.data),
        availableConcerns: about.availableConcerns,
        history: about.history,
      };
      setAbout(published);
      setBaseline(comparable(published));
      setTone('success');
      setMessage('About page published and revalidated.');
      router.refresh();
    } finally {
      setBusy('');
    }
  };

  const applyAdvanced = () => {
    try {
      const parsed = JSON.parse(advanced);
      setAbout((current) => ({
        ...current,
        ...parsed,
        id: current.id,
        pageId: current.pageId,
        updatedAt: current.updatedAt,
        availableConcerns: current.availableConcerns,
        history: current.history,
      }));
      setTone('success');
      setMessage('Structured About content applied locally.');
    } catch (error) {
      setTone('error');
      setMessage(`Invalid structured content: ${error.message}`);
    }
  };

  const paragraphEditor = (section) => (
    <div className="space-y-3">
      {about.content[section].paragraphs.map((paragraph, index) => (
        <div className="flex gap-2" key={index}>
          <textarea
            value={paragraph}
            rows={4}
            onChange={(event) =>
              updateContent(
                section,
                'paragraphs',
                about.content[section].paragraphs.map((item, itemIndex) =>
                  itemIndex === index ? event.target.value : item,
                ),
              )
            }
            className={INPUT}
          />
          <button
            type="button"
            disabled={about.content[section].paragraphs.length <= 1}
            onClick={() =>
              updateContent(
                section,
                'paragraphs',
                about.content[section].paragraphs.filter((_, itemIndex) => itemIndex !== index),
              )
            }
            className="h-9 w-9 shrink-0 rounded-lg border border-red-200 text-red-600 disabled:opacity-30"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={about.content[section].paragraphs.length >= 6}
        onClick={() =>
          updateContent(section, 'paragraphs', [
            ...about.content[section].paragraphs,
            'New paragraph',
          ])
        }
        className="rounded-lg border px-3 py-2 text-xs font-bold"
      >
        + Paragraph
      </button>
    </div>
  );

  const addTeamCategory = () => {
    update({
      teamCategories: orders([
        ...(about.teamCategories || []),
        {
          itemKey: newKey('team-category'),
          title: 'New Team Category',
          description: '',
          isVisible: true,
        },
      ]),
    });
  };

  const removeTeamCategory = (index) => {
    const categories = about.teamCategories || [];
    if (categories.length <= 1) return;
    const removed = categories[index];
    const remaining = categories.filter((_, itemIndex) => itemIndex !== index);
    const fallbackKey = remaining[0].itemKey;
    update({
      teamCategories: orders(remaining),
      teamMembers: orders(
        (about.teamMembers || []).map((member) =>
          member.categoryKey === removed.itemKey
            ? { ...member, categoryKey: fallbackKey }
            : member,
        ),
      ),
    });
  };

  const addTeamMember = (categoryKey = about.teamCategories?.[0]?.itemKey) => {
    const next = orders([
      ...(about.teamMembers || []),
      {
        itemKey: newKey('team'),
        categoryKey,
        name: 'New Team Member',
        role: 'Designation',
        biography: '',
        mediaId: null,
        media: null,
        imageAlt: '',
        isVisible: false,
      },
    ]);
    update({ teamMembers: next });
  };

  const moveTeamMemberInCategory = (memberKey, categoryKey, direction) => {
    const memberIndexes = (about.teamMembers || []).reduce((indexes, member, index) => {
      if (member.categoryKey === categoryKey) indexes.push(index);
      return indexes;
    }, []);
    const position = memberIndexes.findIndex(
      (index) => about.teamMembers[index].itemKey === memberKey,
    );
    const destination = position + direction;
    if (position < 0 || destination < 0 || destination >= memberIndexes.length) return;
    const next = [...about.teamMembers];
    const currentIndex = memberIndexes[position];
    const destinationIndex = memberIndexes[destination];
    [next[currentIndex], next[destinationIndex]] = [next[destinationIndex], next[currentIndex]];
    update({ teamMembers: orders(next) });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#B59410]">
            Phase 2 · Full-page workflow
          </p>
          <h1 className="font-serif text-2xl font-bold text-[#0B1B3D]">About Page Editor</h1>
          <p className="text-xs text-slate-500">
            Version {about.versionNumber} · {about.status} · {dirty ? 'Unsaved changes' : 'Up to date'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin-preview/about-page"
            target="_blank"
            className="rounded-xl border px-4 py-2 text-xs font-bold"
          >
            Saved Preview
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy}
            className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {busy === 'save' ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={dirty || busy || about.status !== 'draft'}
            className="rounded-xl bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </header>

      {message && (
        <div
          className={`rounded-xl border p-3 text-xs font-semibold ${
            tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message}
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        {TABS.map((name) => (
          <button
            type="button"
            key={name}
            onClick={() => {
              setTab(name);
              if (name === 'Advanced') setAdvanced(JSON.stringify(payload(about), null, 2));
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${
              tab === name ? 'bg-[#0B1B3D] text-white' : 'border bg-white text-slate-600'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      <section className="rounded-2xl border bg-white p-5">
        {tab === 'Content' && (
          <div className="space-y-7">
            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Hero</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Title"
                  value={about.content.hero.title}
                  onChange={(value) => updateContent('hero', 'title', value)}
                />
                <Field
                  label="Subtitle"
                  value={about.content.hero.subtitle}
                  onChange={(value) => updateContent('hero', 'subtitle', value)}
                />
              </div>
            </div>

            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Corporate overview</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <Field
                  label="Tag"
                  value={about.content.overview.tag}
                  onChange={(value) => updateContent('overview', 'tag', value)}
                />
                <Field
                  label="Heading"
                  value={about.content.overview.heading}
                  onChange={(value) => updateContent('overview', 'heading', value)}
                />
                <Field
                  label="Highlighted phrase"
                  value={about.content.overview.highlight}
                  onChange={(value) => updateContent('overview', 'highlight', value)}
                />
              </div>
              <div className="mt-3">{paragraphEditor('overview')}</div>
            </div>

            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Sustainability</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <Field
                  label="Tag"
                  value={about.content.sustainability.tag}
                  onChange={(value) => updateContent('sustainability', 'tag', value)}
                />
                <Field
                  label="Heading"
                  value={about.content.sustainability.heading}
                  onChange={(value) => updateContent('sustainability', 'heading', value)}
                />
                <Field
                  label="Highlighted phrase"
                  value={about.content.sustainability.highlight}
                  onChange={(value) => updateContent('sustainability', 'highlight', value)}
                />
              </div>
              <div className="my-3">{paragraphEditor('sustainability')}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  multiline
                  label="Quote"
                  value={about.content.sustainability.quote}
                  onChange={(value) => updateContent('sustainability', 'quote', value)}
                />
                <Field
                  label="Quote author"
                  value={about.content.sustainability.quoteAuthor}
                  onChange={(value) => updateContent('sustainability', 'quoteAuthor', value)}
                />
              </div>
            </div>

            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Leadership</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Tag"
                  value={about.content.leadership.tag}
                  onChange={(value) => updateContent('leadership', 'tag', value)}
                />
                <Field
                  label="Author"
                  value={about.content.leadership.authorName}
                  onChange={(value) => updateContent('leadership', 'authorName', value)}
                />
                <Field
                  multiline
                  label="Primary quote"
                  value={about.content.leadership.primaryQuote}
                  onChange={(value) => updateContent('leadership', 'primaryQuote', value)}
                />
                <Field
                  multiline
                  label="Secondary quote"
                  value={about.content.leadership.secondaryQuote}
                  onChange={(value) => updateContent('leadership', 'secondaryQuote', value)}
                />
                <Field
                  label="Author title"
                  value={about.content.leadership.authorTitle}
                  onChange={(value) => updateContent('leadership', 'authorTitle', value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {['concernsSection', 'accreditationsSection'].map((section) => (
                <div key={section}>
                  <h2 className="mb-3 font-serif text-lg font-bold">
                    {section === 'concernsSection'
                      ? 'Concerns heading'
                      : 'Accreditations heading'}
                  </h2>
                  <Field
                    label="Tag"
                    value={about.content[section].tag}
                    onChange={(value) => updateContent(section, 'tag', value)}
                  />
                  <div className="mt-2">
                    <Field
                      label="Heading"
                      value={about.content[section].heading}
                      onChange={(value) => updateContent(section, 'heading', value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="mb-3 font-serif text-lg font-bold">Page SEO</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['title', 'Title'],
                  ['description', 'Description'],
                  ['canonicalUrl', 'Canonical URL'],
                  ['ogTitle', 'Social title'],
                  ['ogDescription', 'Social description'],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    multiline={key === 'description' || key === 'ogDescription'}
                    label={label}
                    value={about.content.seo[key]}
                    onChange={(value) => updateContent('seo', key, value)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Media' && (
          <div className="grid gap-4 md:grid-cols-2">
            {about.media.map((item, index) => (
              <div key={item.role} className="rounded-xl border p-4">
                <h3 className="text-sm font-bold capitalize">{item.role.replaceAll('-', ' ')}</h3>
                {item.media?.secureUrl && (
                  <img
                    src={item.media.secureUrl}
                    alt=""
                    className="my-3 h-48 w-full rounded-lg object-cover"
                  />
                )}
                <Field
                  label="Accessible image description"
                  value={item.imageAlt}
                  onChange={(value) => updateRepeated('media', index, { imageAlt: value })}
                />
                <button
                  type="button"
                  onClick={() => setPicker({ type: 'media', index })}
                  className="mt-3 rounded-lg bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white"
                >
                  Choose media
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Pillars' && (
          <div className="space-y-4">
            {about.pillars.map((item, index) => (
              <article key={item.itemKey} className="space-y-3 rounded-xl border p-4">
                <div className="flex justify-between">
                  <strong>{item.title}</strong>
                  <Controls
                    index={index}
                    count={about.pillars.length}
                    onMove={(direction) =>
                      update({ pillars: move(about.pillars, index, direction) })
                    }
                    onRemove={() =>
                      confirm('Remove this pillar?') &&
                      update({
                        pillars: orders(about.pillars.filter((_, itemIndex) => itemIndex !== index)),
                      })
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="Title"
                    value={item.title}
                    onChange={(value) => updateRepeated('pillars', index, { title: value })}
                  />
                  <Field
                    label="Icon key"
                    value={item.iconKey}
                    onChange={(value) => updateRepeated('pillars', index, { iconKey: value })}
                  />
                  <Field
                    multiline
                    label="Description"
                    value={item.description}
                    onChange={(value) =>
                      updateRepeated('pillars', index, { description: value })
                    }
                  />
                  <Field
                    label="Image alt"
                    value={item.imageAlt}
                    onChange={(value) => updateRepeated('pillars', index, { imageAlt: value })}
                  />
                </div>
                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={item.isVisible}
                    onChange={(event) =>
                      updateRepeated('pillars', index, { isVisible: event.target.checked })
                    }
                  />{' '}
                  Visible
                </label>
                <button
                  type="button"
                  onClick={() => setPicker({ type: 'pillar', index })}
                  className="ml-3 rounded-lg border px-3 py-2 text-xs font-bold"
                >
                  Replace image
                </button>
              </article>
            ))}
            <button
              type="button"
              disabled={about.pillars.length >= 6}
              onClick={() =>
                update({
                  pillars: [
                    ...about.pillars,
                    {
                      itemKey: newKey('pillar'),
                      title: 'New Pillar',
                      description: 'Add pillar description',
                      iconKey: 'fa-star',
                      mediaId: about.media[0].mediaId,
                      media: about.media[0].media,
                      imageAlt: 'Architectural feature',
                      isVisible: true,
                    },
                  ],
                })
              }
              className="rounded-lg border px-3 py-2 text-xs font-bold"
            >
              + Pillar
            </button>
          </div>
        )}

        {tab === 'Team' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#C5A880]/40 bg-[#C5A880]/5 p-4">
              <h2 className="font-serif text-lg font-bold text-[#0B1B3D]">Our Team section</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Categories appear publicly in this exact order. Each category contains its own
                ordered members. Hiding a category hides every member assigned to it without
                deleting their information. If a category heading matches the section heading
                (including “&” versus “and”), the public page shows that heading only once.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field
                  label="Section label"
                  value={about.content.teamSection.tag}
                  onChange={(value) => updateContent('teamSection', 'tag', value)}
                  placeholder="OUR TEAM"
                />
                <Field
                  label="Section heading"
                  value={about.content.teamSection.heading}
                  onChange={(value) => updateContent('teamSection', 'heading', value)}
                  placeholder="Meet Our Leadership"
                />
                <Field
                  multiline
                  label="Section introduction"
                  value={about.content.teamSection.intro}
                  onChange={(value) => updateContent('teamSection', 'intro', value)}
                />
                <Field
                  label="Default profile window heading"
                  value={about.content.teamSection.modalHeading || ''}
                  onChange={(value) => updateContent('teamSection', 'modalHeading', value)}
                  placeholder="OUR TEAM"
                />
              </div>
            </div>

            {(about.teamCategories || []).map((category, categoryIndex) => {
              const categoryMembers = (about.teamMembers || [])
                .map((member, memberIndex) => ({ member, memberIndex }))
                .filter(({ member }) => member.categoryKey === category.itemKey);

              return (
                <section
                  key={category.itemKey}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B59410]">
                        Category {categoryIndex + 1}
                      </p>
                      <h3 className="font-serif text-lg font-bold text-[#0B1B3D]">
                        {category.title || 'Unnamed category'}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {categoryMembers.length} member{categoryMembers.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Controls
                      index={categoryIndex}
                      count={about.teamCategories.length}
                      minimum={1}
                      onMove={(direction) =>
                        update({
                          teamCategories: move(about.teamCategories, categoryIndex, direction),
                        })
                      }
                      onRemove={() => {
                        const assigned = categoryMembers.length;
                        const detail = assigned
                          ? ` ${assigned} assigned member${assigned === 1 ? '' : 's'} will be moved to the first remaining category.`
                          : '';
                        if (confirm(`Delete ${category.title || 'this category'}?${detail}`)) {
                          removeTeamCategory(categoryIndex);
                        }
                      }}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field
                      label="Category heading"
                      value={category.title}
                      onChange={(value) =>
                        updateRepeated('teamCategories', categoryIndex, { title: value })
                      }
                      placeholder="Leadership and Management"
                    />
                    <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={category.isVisible}
                        onChange={(event) =>
                          updateRepeated('teamCategories', categoryIndex, {
                            isVisible: event.target.checked,
                          })
                        }
                      />
                      Show this category publicly
                    </label>
                    <div className="md:col-span-2">
                      <Field
                        multiline
                        label="Category description (optional)"
                        value={category.description}
                        onChange={(value) =>
                          updateRepeated('teamCategories', categoryIndex, { description: value })
                        }
                        placeholder="Optional short introduction for this team group."
                      />
                    </div>
                  </div>

                  <div className="mt-6 space-y-4 rounded-xl bg-slate-50 p-3 md:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-[#0B1B3D]">Team members</h4>
                        <p className="text-[11px] text-slate-500">
                          Members below are serialized only inside this category.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addTeamMember(category.itemKey)}
                        className="rounded-lg bg-[#0B1B3D] px-4 py-2 text-xs font-bold text-white"
                      >
                        + Add Member
                      </button>
                    </div>

                    {categoryMembers.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">
                        No members are assigned to this category yet.
                      </div>
                    )}

                    {categoryMembers.map(({ member, memberIndex }, memberPosition) => (
                      <article key={member.itemKey} className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B59410]">
                              Member {memberPosition + 1}
                            </p>
                            <strong className="text-sm text-[#0B1B3D]">
                              {member.name || 'Unnamed member'}
                            </strong>
                          </div>
                          <Controls
                            index={memberPosition}
                            count={categoryMembers.length}
                            minimum={0}
                            onMove={(direction) =>
                              moveTeamMemberInCategory(member.itemKey, category.itemKey, direction)
                            }
                            onRemove={() =>
                              confirm(`Delete ${member.name || 'this team member'}?`) &&
                              update({
                                teamMembers: orders(
                                  about.teamMembers.filter(
                                    (_, itemIndex) => itemIndex !== memberIndex,
                                  ),
                                ),
                              })
                            }
                          />
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
                          <div>
                            <div className="aspect-[4/5] overflow-hidden rounded-xl border bg-slate-100">
                              {member.media?.secureUrl ? (
                                <img
                                  src={member.media.secureUrl}
                                  alt=""
                                  className="h-full w-full object-cover object-top"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
                                  No portrait selected
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPicker({ type: 'team', index: memberIndex })}
                              className="mt-3 w-full rounded-lg bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white"
                            >
                              {member.media?.secureUrl ? 'Replace portrait' : 'Choose portrait'}
                            </button>
                            <p className="mt-2 text-[10px] leading-4 text-slate-500">
                              Recommended: vertical 4:5 portrait, at least 800 × 1000 px. Uploading
                              and selection use the existing Media Library and Cloudinary workflow.
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <Field
                              label="Full name"
                              value={member.name}
                              onChange={(value) =>
                                updateRepeated('teamMembers', memberIndex, { name: value })
                              }
                            />
                            <Field
                              label="Designation"
                              value={member.role}
                              onChange={(value) =>
                                updateRepeated('teamMembers', memberIndex, { role: value })
                              }
                            />
                            <label>
                              <span className={LABEL}>Category</span>
                              <select
                                value={member.categoryKey}
                                onChange={(event) =>
                                  updateRepeated('teamMembers', memberIndex, {
                                    categoryKey: event.target.value,
                                  })
                                }
                                className={INPUT}
                              >
                                {about.teamCategories.map((option) => (
                                  <option key={option.itemKey} value={option.itemKey}>
                                    {option.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={member.isVisible}
                                onChange={(event) =>
                                  updateRepeated('teamMembers', memberIndex, {
                                    isVisible: event.target.checked,
                                  })
                                }
                              />
                              Visible on public About page
                            </label>
                            <div className="md:col-span-2">
                              <Field
                                multiline
                                label="Full biography"
                                value={member.biography}
                                onChange={(value) =>
                                  updateRepeated('teamMembers', memberIndex, {
                                    biography: value,
                                  })
                                }
                                placeholder="Use a blank line to separate paragraphs."
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Field
                                label="Portrait alt text"
                                value={member.imageAlt}
                                onChange={(value) =>
                                  updateRepeated('teamMembers', memberIndex, {
                                    imageAlt: value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}

            <button
              type="button"
              onClick={addTeamCategory}
              disabled={(about.teamCategories || []).length >= 12}
              className="rounded-lg border border-[#0B1B3D] px-4 py-2 text-xs font-bold text-[#0B1B3D] disabled:opacity-40"
            >
              + Add Team Category
            </button>
          </div>
        )}

        {tab === 'Concerns' && (
          <div className="space-y-4">
            {about.concerns.map((item, index) => (
              <article key={item.canonicalId} className="space-y-3 rounded-xl border p-4">
                <div className="flex justify-between">
                  <strong>{item.title}</strong>
                  <Controls
                    index={index}
                    count={about.concerns.length}
                    onMove={(direction) =>
                      update({ concerns: move(about.concerns, index, direction) })
                    }
                    onRemove={() =>
                      confirm('Remove this concern placement?') &&
                      update({
                        concerns: orders(
                          about.concerns.filter((_, itemIndex) => itemIndex !== index),
                        ),
                      })
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="Display title"
                    value={item.title}
                    onChange={(value) => updateRepeated('concerns', index, { title: value })}
                  />
                  <Field
                    label="CTA label"
                    value={item.ctaLabel}
                    onChange={(value) => updateRepeated('concerns', index, { ctaLabel: value })}
                  />
                  <Field
                    multiline
                    label="Description"
                    value={item.description}
                    onChange={(value) =>
                      updateRepeated('concerns', index, { description: value })
                    }
                  />
                  <div>
                    {item.media?.secureUrl && (
                      <img
                        src={item.media.secureUrl}
                        alt=""
                        className="h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setPicker({ type: 'concern', index })}
                      className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold"
                    >
                      Replace image
                    </button>
                  </div>
                </div>
                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={item.isVisible}
                    onChange={(event) =>
                      updateRepeated('concerns', index, { isVisible: event.target.checked })
                    }
                  />{' '}
                  Visible
                </label>
              </article>
            ))}
            <select
              value=""
              onChange={(event) => {
                const concern = about.availableConcerns.find(
                  (item) => item.id === event.target.value,
                );
                if (concern) {
                  update({
                    concerns: [
                      ...about.concerns,
                      {
                        canonicalId: concern.id,
                        slug: concern.slug,
                        title: concern.name,
                        description: concern.overview,
                        ctaLabel: 'View Subsidiary',
                        mediaId: about.media[0].mediaId,
                        media: about.media[0].media,
                        isVisible: true,
                      },
                    ],
                  });
                }
              }}
              className={INPUT}
            >
              <option value="">+ Add published concern…</option>
              {about.availableConcerns
                .filter(
                  (item) =>
                    !about.concerns.some((concern) => concern.canonicalId === item.id),
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {tab === 'Accreditations' && (
          <div className="space-y-3">
            {about.accreditations.map((item, index) => (
              <div
                key={item.itemKey}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1fr_auto]"
              >
                <Field
                  label="Title"
                  value={item.title}
                  onChange={(value) =>
                    updateRepeated('accreditations', index, { title: value })
                  }
                />
                <Field
                  label="Icon key"
                  value={item.iconKey}
                  onChange={(value) =>
                    updateRepeated('accreditations', index, { iconKey: value })
                  }
                />
                <Controls
                  index={index}
                  count={about.accreditations.length}
                  onMove={(direction) =>
                    update({
                      accreditations: move(about.accreditations, index, direction),
                    })
                  }
                  onRemove={() =>
                    confirm('Remove this accreditation?') &&
                    update({
                      accreditations: orders(
                        about.accreditations.filter((_, itemIndex) => itemIndex !== index),
                      ),
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              disabled={about.accreditations.length >= 10}
              onClick={() =>
                update({
                  accreditations: [
                    ...about.accreditations,
                    {
                      itemKey: newKey('accreditation'),
                      title: 'New Accreditation',
                      iconKey: 'fa-award',
                      isVisible: true,
                    },
                  ],
                })
              }
              className="rounded-lg border px-3 py-2 text-xs font-bold"
            >
              + Accreditation
            </button>
          </div>
        )}

        {tab === 'Preview' && (
          <div className="max-h-[760px] overflow-auto rounded-xl border">
            <AboutPageClient about={about} previewMode />
          </div>
        )}

        {tab === 'Advanced' && (
          <div>
            <p className="mb-3 text-xs text-slate-500">
              Complete structured editor for all About fields. Server and database validation still
              apply.
            </p>
            <textarea
              value={advanced}
              onChange={(event) => setAdvanced(event.target.value)}
              rows={32}
              spellCheck={false}
              className={`${INPUT} font-mono leading-5`}
            />
            <button
              type="button"
              onClick={applyAdvanced}
              className="mt-3 rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white"
            >
              Apply structured content
            </button>
          </div>
        )}
      </section>

      {about.history?.length > 0 && (
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-serif text-lg font-bold">Revision history</h2>
          {about.history.map((item) => (
            <div
              key={item.id}
              className="mt-2 flex justify-between rounded-lg bg-slate-50 p-3 text-xs"
            >
              <span>{item.change_summary || 'Saved About revision'}</span>
              <span>
                v{item.version_number} · {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </section>
      )}

      {picker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-7xl">
            <MediaLibrary
              isModal
              resourceTypeFilter="image"
              onSelectAsset={choose}
              onCloseModal={() => setPicker(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
