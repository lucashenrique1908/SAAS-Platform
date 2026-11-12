/**
 * Responsabilidade: validar as variáveis de ambiente necessárias para conectar ao PostgreSQL.
 *
 * Funcionamento: verifica presença, conteúdo e formato das configurações antes de inicializar a API ou o CLI.
 *
 * Arquitetura: centraliza regras reutilizadas pelo módulo NestJS e pelo DataSource do TypeORM.
 */
const managedEnvironments = new Set(['staging', 'production']);

export interface PostgresEnvironment {
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  FRONTEND_BASE_URL: string;
  CORS_ORIGINS: string;
  EMAIL_FROM: string;
  RESEND_API_KEY: string;
}

export function shouldLoadLocalEnvFile(nodeEnv: string | undefined): boolean {
  return !managedEnvironments.has(nodeEnv?.toLowerCase() ?? '');
}

export function validatePostgresEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> & PostgresEnvironment {
  function requiredString(name: keyof PostgresEnvironment): string {
    const value = config[name];
    if (value === undefined || value === null) {
      throw new Error(`A variável de ambiente ${name} está ausente.`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`A variável de ambiente ${name} está vazia ou inválida.`);
    }
    return value;
  }

  const host = requiredString('POSTGRES_HOST');
  const portValue = requiredString('POSTGRES_PORT');
  if (!/^\d+$/.test(portValue)) {
    throw new Error('POSTGRES_PORT deve ser um inteiro entre 1 e 65535.');
  }

  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('POSTGRES_PORT deve ser um inteiro entre 1 e 65535.');
  }

  const environment =
    typeof config.NODE_ENV === 'string'
      ? config.NODE_ENV.toLowerCase()
      : process.env.NODE_ENV?.toLowerCase();
  const isLocalConfiguration = [undefined, 'development', 'test'].includes(
    environment,
  );
  function localDefault(
    name: keyof PostgresEnvironment,
    value: string,
  ): string {
    const configured = config[name];
    if (configured === undefined && isLocalConfiguration) {
      return value;
    }
    return requiredString(name);
  }

  const frontendBaseUrl = localDefault(
    'FRONTEND_BASE_URL',
    'http://localhost:3000',
  );
  try {
    const parsedUrl = new URL(frontendBaseUrl);
    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      (managedEnvironments.has(environment ?? '') &&
        parsedUrl.protocol !== 'https:')
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'FRONTEND_BASE_URL deve ser um URL HTTPS válido em staging/production.',
    );
  }

  const corsOrigins = localDefault('CORS_ORIGINS', 'http://localhost:3000');
  for (const origin of corsOrigins.split(',')) {
    try {
      const parsedOrigin = new URL(origin.trim());
      if (
        parsedOrigin.origin !== origin.trim() ||
        (managedEnvironments.has(environment ?? '') &&
          parsedOrigin.protocol !== 'https:')
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        'CORS_ORIGINS deve conter origens válidas separadas por vírgulas e usar HTTPS em staging/production.',
      );
    }
  }

  const emailFrom = localDefault(
    'EMAIL_FROM',
    'SaaS Platform <onboarding@resend.dev>',
  );
  if (!/^.+<[^<>@\s]+@[^<>@\s]+>$/.test(emailFrom)) {
    throw new Error('EMAIL_FROM deve usar o formato Nome <email@dominio>.');
  }

  const resendApiKey = config.RESEND_API_KEY;
  if (
    typeof resendApiKey !== 'string' &&
    resendApiKey !== undefined &&
    resendApiKey !== null
  ) {
    throw new Error('RESEND_API_KEY está vazia ou inválida.');
  }
  const normalizedResendApiKey =
    typeof resendApiKey === 'string' ? resendApiKey.trim() : '';
  if (!normalizedResendApiKey && managedEnvironments.has(environment ?? '')) {
    throw new Error('A variável de ambiente RESEND_API_KEY está ausente.');
  }
  const database = requiredString('POSTGRES_DB');
  if (environment === 'test') {
    const normalizedHost = host.toLowerCase().replace(/^\[|\]$/g, '');
    if (!['localhost', '127.0.0.1', '::1'].includes(normalizedHost)) {
      throw new Error(
        'POSTGRES_HOST deve apontar para loopback no ambiente de testes.',
      );
    }
    if (!database.toLowerCase().endsWith('_test')) {
      throw new Error(
        'POSTGRES_DB deve terminar em _test no ambiente de testes.',
      );
    }
  }

  return {
    ...config,
    POSTGRES_HOST: host,
    POSTGRES_PORT: port,
    POSTGRES_USER: requiredString('POSTGRES_USER'),
    POSTGRES_PASSWORD: requiredString('POSTGRES_PASSWORD'),
    POSTGRES_DB: database,
    FRONTEND_BASE_URL: frontendBaseUrl,
    CORS_ORIGINS: corsOrigins,
    EMAIL_FROM: emailFrom,
    RESEND_API_KEY: normalizedResendApiKey,
  };
}
