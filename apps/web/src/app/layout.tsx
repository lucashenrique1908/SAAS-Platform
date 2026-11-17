/**
 * Responsabilidade: definir o layout principal da aplicação Next.js.
 *
 * Funcionamento: envolve as páginas, configura metadados, fontes e elementos globais do documento.
 *
 * Arquitetura: compartilha a estrutura visual entre as rotas da aplicação.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Platform",
  description: "Secure access to the SaaS Platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full w-full min-w-0 flex flex-col">
        {children}
      </body>
    </html>
  );
}
