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

  return {
    ...config,
    POSTGRES_HOST: host,
    POSTGRES_PORT: port,
    POSTGRES_USER: requiredString('POSTGRES_USER'),
    POSTGRES_PASSWORD: requiredString('POSTGRES_PASSWORD'),
    POSTGRES_DB: requiredString('POSTGRES_DB'),
  };
}
