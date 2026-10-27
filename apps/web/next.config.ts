/**
 * Responsabilidade: definir as configurações do Next.js.
 *
 * Funcionamento: ajusta opções do framework que influenciam o desenvolvimento e a compilação.
 *
 * Arquitetura: é lido pelo Next.js ao executar os comandos da aplicação frontend.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ativa a composição de componentes com cache e a pré-busca parcial de rotas.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Encaminha arquivos CSS ao carregador do Tailwind durante o uso do Turbopack.
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
