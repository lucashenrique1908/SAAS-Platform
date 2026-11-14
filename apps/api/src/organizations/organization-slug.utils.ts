export const ORGANIZATION_SLUG_MAX_LENGTH = 100;

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ORGANIZATION_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug || 'workspace';
}

export function appendOrganizationSlugSuffix(
  slug: string,
  suffix: number,
): string {
  const suffixText = `-${suffix}`;
  return `${slug.slice(0, ORGANIZATION_SLUG_MAX_LENGTH - suffixText.length)}${suffixText}`;
}

export function isValidPortugueseTaxId(taxId: string): boolean {
  const value = taxId.replace(/\D/g, '');
  if (!/^\d{9}$/.test(value) || !'125689'.includes(value[0]!)) {
    return false;
  }
  const sum = value
    .slice(0, 8)
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (9 - index), 0);
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return Number(value[8]) === check;
}
