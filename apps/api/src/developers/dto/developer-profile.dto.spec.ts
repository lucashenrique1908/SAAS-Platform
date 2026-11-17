import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DeveloperProfileDto } from './developer-profile.dto.js';

describe('DeveloperProfileDto years of experience', () => {
  function errorsFor(yearsExperience: unknown) {
    const dto = plainToInstance(DeveloperProfileDto, {
      displayName: 'Ada Developer',
      yearsExperience,
    });
    return validateSync(dto).map((error) => error.property);
  }

  it('accepts an empty value and whole years from zero to eighty', () => {
    expect(errorsFor('')).toEqual([]);
    expect(errorsFor('0')).toEqual([]);
    expect(errorsFor('12')).toEqual([]);
    expect(errorsFor('80')).toEqual([]);
  });

  it.each(['-1', '81', '1.5', 'invalid'])(
    'rejects invalid years value %j',
    (yearsExperience) => {
      expect(errorsFor(yearsExperience)).toContain('yearsExperience');
    },
  );
});
