export const PROJECT_FILTER_GROUPS = [
  {
    key: 'status',
    title: 'Status',
    projectField: 'lifecycle',
    labelField: 'statusLabel',
    allLabelField: 'allStatusLabel',
    defaults: [
      { key: 'ongoing', labelField: 'ongoingLabel', fallbackLabel: 'Ongoing' },
      { key: 'completed', labelField: 'completedLabel', fallbackLabel: 'Completed' },
      { key: 'upcoming', labelField: 'upcomingLabel', fallbackLabel: 'Upcoming' },
    ],
  },
  {
    key: 'category',
    title: 'Category',
    projectField: 'propertyCategory',
    labelField: 'categoryLabel',
    allLabelField: 'allCategoryLabel',
    defaults: [
      { key: 'commercial', labelField: 'commercialLabel', fallbackLabel: 'Commercial Hub' },
      { key: 'residential', labelField: 'residentialLabel', fallbackLabel: 'Residential Suites' },
      { key: 'mixed-use', labelField: 'mixedUseLabel', fallbackLabel: 'Mixed-Use' },
      { key: 'hotel', fallbackLabel: 'Hotel' },
      { key: 'resort', fallbackLabel: 'Resorts' },
    ],
  },
  {
    key: 'location',
    title: 'Location',
    projectField: 'locationKey',
    labelField: 'locationLabel',
    allLabelField: 'allLocationLabel',
    defaults: [
      { key: 'bashundhara', labelField: 'bashundharaLabel', fallbackLabel: 'Bashundhara R/A' },
      { key: 'jolshiri', labelField: 'jolshiriLabel', fallbackLabel: 'Jolshiri Abashon' },
      { key: 'gulshan', labelField: 'gulshanLabel', fallbackLabel: 'Gulshan' },
      { key: 'banani', labelField: 'bananiLabel', fallbackLabel: 'Banani' },
    ],
  },
  {
    key: 'size',
    title: 'Size',
    projectField: 'sizeCategory',
    labelField: 'sizeLabel',
    allLabelField: 'allSizeLabel',
    defaults: [
      { key: 'small', labelField: 'smallLabel', fallbackLabel: 'Small (< 3000 SFT)' },
      { key: 'medium', labelField: 'mediumLabel', fallbackLabel: 'Medium (3000 - 4000 SFT)' },
      { key: 'large', labelField: 'largeLabel', fallbackLabel: 'Large (> 4000 SFT)' },
    ],
  },
];

export const PROJECT_FILTER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeProjectFilterOptions(listing = {}) {
  const configured = listing.filterOptions && typeof listing.filterOptions === 'object'
    ? listing.filterOptions
    : {};

  return Object.fromEntries(PROJECT_FILTER_GROUPS.map((group) => {
    const hasConfiguredOptions = Array.isArray(configured[group.key]);
    const sourceOptions = hasConfiguredOptions
      ? configured[group.key]
      : group.defaults.map((option) => ({
        key: option.key,
        label: listing[option.labelField] || option.fallbackLabel,
      }));
    const options = sourceOptions.map((option) => ({
      key: String(option?.key || '').trim(),
      label: String(option?.label || '').trim(),
    }));
    return [group.key, options];
  }));
}

export function getProjectFilterGroup(groupKey) {
  return PROJECT_FILTER_GROUPS.find((group) => group.key === groupKey) || null;
}

export function optionLabel(options, key, fallback = '') {
  return options.find((option) => option.key === key)?.label || fallback || key;
}

export function resolveProjectFilterValue(options, value) {
  if (!value || value === 'all') return 'all';
  return options.some((option) => option.key === value) ? value : 'all';
}

export function createUniqueFilterKey(options, prefix) {
  const used = new Set(options.map((option) => option.key));
  let index = options.length + 1;
  let candidate = `${prefix}-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
}
