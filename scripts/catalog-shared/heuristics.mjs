export function matchesAny(haystack, patterns) {
  return patterns.some((pattern) => haystack.includes(pattern));
}

export function matchingRules(haystack, rules) {
  return rules.filter((rule) => matchesAny(haystack, rule.patterns));
}

export function collectMatchingTags(haystack, tagRules) {
  return tagRules.filter((rule) => matchesAny(haystack, rule.patterns)).map((rule) => rule.tag);
}

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function unique(values) {
  return [...new Set(values)];
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2);
}

export function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, sortValue(inner)]),
    );
  }
  return value;
}
