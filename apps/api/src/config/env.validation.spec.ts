/**
 * Verifica a validação das configurações do PostgreSQL e a política de carregamento do arquivo local.
 */
import {
  shouldLoadLocalEnvFile,
  validatePostgresEnvironment,
} from './env.validation.js';

const validConfig = {
  NODE_ENV: 'development',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'test-user',
  POSTGRES_PASSWORD: 'test-password',
  POSTGRES_DB: 'test-database',
  FRONTEND_BASE_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
  EMAIL_FROM: 'SaaS Platform <auth@example.test>',
};
const managedConfig = {
  ...validConfig,
  FRONTEND_BASE_URL: 'https://app.example.test',
  CORS_ORIGINS: 'https://app.example.test',
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
    'FRONTEND_BASE_URL',
    'CORS_ORIGINS',
    'EMAIL_FROM',
  ] as const)('reports when %s is missing', (name) => {
    const config = {
      ...managedConfig,
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_test_mocked',
    };
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
    'FRONTEND_BASE_URL',
    'CORS_ORIGINS',
    'EMAIL_FROM',
  ] as const)('reports when %s is empty', (name) => {
    expect(() =>
      validatePostgresEnvironment({
        ...managedConfig,
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test_mocked',
        [name]: '  ',
      }),
    ).toThrow(`${name} está vazia ou inválida`);
  });

  it('rejects wildcard and invalid CORS origins', () => {
    expect(() =>
      validatePostgresEnvironment({ ...validConfig, CORS_ORIGINS: '*' }),
    ).toThrow('CORS_ORIGINS deve conter origens válidas');
    expect(() =>
      validatePostgresEnvironment({
        ...validConfig,
        CORS_ORIGINS: 'http://localhost:3000/path',
      }),
    ).toThrow('CORS_ORIGINS deve conter origens válidas');
  });

  it('requires HTTPS frontend URLs and origins in managed environments', () => {
    expect(() =>
      validatePostgresEnvironment({
        ...managedConfig,
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test_mocked',
        FRONTEND_BASE_URL: 'http://app.example.test',
      }),
    ).toThrow('FRONTEND_BASE_URL deve ser um URL HTTPS válido');
    expect(() =>
      validatePostgresEnvironment({
        ...managedConfig,
        NODE_ENV: 'staging',
        RESEND_API_KEY: 're_test_mocked',
        CORS_ORIGINS: 'http://app.example.test',
      }),
    ).toThrow('CORS_ORIGINS deve conter origens válidas');
  });

  it('allows the Resend key to be omitted for mocked delivery', () => {
    expect(validatePostgresEnvironment(validConfig).RESEND_API_KEY).toBe('');
  });

  it('rejects a whitespace-only Resend key in managed environments', () => {
    expect(() =>
      validatePostgresEnvironment({
        ...managedConfig,
        NODE_ENV: 'production',
        RESEND_API_KEY: '   ',
      }),
    ).toThrow('RESEND_API_KEY está ausente');
  });

  it('requires a dedicated database for end-to-end tests', () => {
    expect(() =>
      validatePostgresEnvironment({
        ...validConfig,
        NODE_ENV: 'test',
        POSTGRES_DB: 'saas_db',
      }),
    ).toThrow('POSTGRES_DB deve terminar em _test');
  });

  it('restricts end-to-end database connections to loopback hosts', () => {
    expect(() =>
      validatePostgresEnvironment({
        ...validConfig,
        NODE_ENV: 'test',
        POSTGRES_HOST: 'db.example.test',
        POSTGRES_DB: 'saas_auth_test',
      }),
    ).toThrow('POSTGRES_HOST deve apontar para loopback');
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
