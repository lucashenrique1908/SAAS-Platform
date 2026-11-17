/**
 * Responsabilidade: definir as configurações do Next.js.
 *
 * Funcionamento: ajusta opções do framework que influenciam o desenvolvimento e a compilação.
 *
 * Arquitetura: é lido pelo Next.js ao executar os comandos da aplicação frontend.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
