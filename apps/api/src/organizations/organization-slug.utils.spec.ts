import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  appendOrganizationSlugSuffix,
  ORGANIZATION_SLUG_MAX_LENGTH,
  slugifyOrganizationName,
} from './organization-slug.utils.js';

const migrationPath = fileURLToPath(
  new URL(
    '../database/migrations/1762900000000-OrganizationWorkspace.ts',
    import.meta.url,
  ),
);
const migrationSource = readFileSync(migrationPath, 'utf8');

function slugifyAsMigration(name: string): string {
  const replacementLine = migrationSource.match(
    /base_slug := replace\(replace\(replace\(replace\(replace\(base_slug,[^\n]+/,
  )?.[0];
  const replacements = [
    ...(replacementLine ?? '').matchAll(/'([^']*)', '([^']*)'/g),
  ].map(([, from, to]) => [from!, to!] as const);
  const [, translateFrom, translateTo] =
    migrationSource.match(
      /translate\(base_slug,\s*'([^']*)',\s*'([^']*)'\)/s,
    ) ?? [];
  const maxLength = Number(
    migrationSource.match(/base_slug := left\(base_slug, (\d+)\)/)?.[1],
  );
  const fallback = migrationSource.match(
    /IF base_slug = '' THEN base_slug := '([^']+)'/,
  )?.[1];

  let slug = name.toLowerCase();
  for (const [from, to] of replacements) slug = slug.split(from).join(to);
  if (translateFrom && translateTo) {
    const destination = [...translateTo];
    slug = [...slug]
      .map((character) => {
        const index = [...translateFrom].indexOf(character);
        return index < 0 ? character : (destination[index] ?? '');
      })
      .join('');
  }
  slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (slug || fallback || '').slice(0, maxLength);
}

describe('organization slug normalization', () => {
  it.each([
    ['Acme Team', 'acme-team'],
    ['São João', 'sao-joao'],
    ['André & Ação', 'andre-acao'],
    ['Straße Ægir Łódź', 'strasse-aegir-lodz'],
    ['!!!', 'workspace'],
    ['', 'workspace'],
    ['A'.repeat(120), 'a'.repeat(100)],
  ])('normalizes %j to %j', (name, expected) => {
    expect(slugifyOrganizationName(name)).toBe(expected);
  });

  it('uses the database column limit and unique index expected by the migration', () => {
    expect(migrationSource).toContain('ADD COLUMN "slug" varchar(100)');
    expect(migrationSource).toContain(
      'CREATE UNIQUE INDEX "uq_organizations_slug" ON "organizations" ("slug")',
    );
    expect(ORGANIZATION_SLUG_MAX_LENGTH).toBe(100);
  });

  it.each([
    'Acme Team',
    'São João',
    'André & Ação',
    'Straße Ægir Łódź',
    '!!!',
    '',
    'A'.repeat(120),
  ])('matches the migration normalization for %j', (name) => {
    expect(slugifyAsMigration(name)).toBe(slugifyOrganizationName(name));
  });

  it('keeps duplicate slugs unique and within the column limit', () => {
    const first = slugifyOrganizationName('A'.repeat(120));
    const second = appendOrganizationSlugSuffix(first, 2);
    const third = appendOrganizationSlugSuffix(first, 3);

    expect(new Set([first, second, third]).size).toBe(3);
    expect(second).toBe(`${'a'.repeat(98)}-2`);
    expect(third).toBe(`${'a'.repeat(98)}-3`);
    expect(second.length).toBeLessThanOrEqual(ORGANIZATION_SLUG_MAX_LENGTH);
    expect(migrationSource).toContain(
      'WHILE EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = candidate) LOOP',
    );
    expect(migrationSource).toContain(
      "left(base_slug, 100 - length(suffix::text) - 1) || '-' || suffix::text",
    );
  });
});
