/**
 * Verifica a validação das configurações do PostgreSQL e a política de carregamento do arquivo local.
 */
import {
  shouldLoadLocalEnvFile,
  validatePostgresEnvironment,
} from './env.validation.js';

const validConfig = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'test-user',
  POSTGRES_PASSWORD: 'test-password',
  POSTGRES_DB: 'test-database',
};

describe('validatePostgresEnvironment', () => {
  it('returns the required connection values with a numeric port', () => {
    expect(validatePostgresEnvironment(validConfig)).toMatchObject({
      ...validConfig,
      POSTGRES_PORT: 5432,
    });
  });

  it.each([
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
  ] as const)('reports when %s is missing', (name) => {
    const config = { ...validConfig };
    delete config[name];

    expect(() => validatePostgresEnvironment(config)).toThrow(
      `${name} está ausente`,
    );
  });

  it.each([
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
  ] as const)('reports when %s is empty', (name) => {
    expect(() =>
      validatePostgresEnvironment({ ...validConfig, [name]: '  ' }),
    ).toThrow(`${name} está vazia ou inválida`);
  });

  it.each(['0', '65536', '5432.5', 'not-a-port'])(
    'rejects invalid port %s',
    (port) => {
      expect(() =>
        validatePostgresEnvironment({ ...validConfig, POSTGRES_PORT: port }),
      ).toThrow('POSTGRES_PORT deve ser um inteiro entre 1 e 65535');
    },
  );
});

describe('shouldLoadLocalEnvFile', () => {
  it.each(['staging', 'production', 'STAGING', 'PRODUCTION'])(
    'does not load a local env file in %s',
    (environment) => {
      expect(shouldLoadLocalEnvFile(environment)).toBe(false);
    },
  );

  it.each([undefined, 'development', 'test'])(
    'loads a local env file for %s',
    (environment) => {
      expect(shouldLoadLocalEnvFile(environment)).toBe(true);
    },
  );
});
