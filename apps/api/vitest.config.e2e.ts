/**
 * Configura o Vitest para executar os testes end-to-end da API,
 * identificados pelos arquivos com o padrão *.e2e-spec.ts.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
