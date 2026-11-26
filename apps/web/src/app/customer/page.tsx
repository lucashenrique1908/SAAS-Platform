import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type Customer = {
  fullName: string;
  phone: string;
  email: string | null;
  createdAt: string;
};

export default async function CustomerPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl p-8">
          <p role="status">A carregar a área do cliente…</p>
        </main>
      }
    >
      <CustomerContent />
    </Suspense>
  );
}

async function CustomerContent() {
  await connection();
  const session = (await cookies()).get("saas_session")?.value;
  if (!session) redirect("/login");
  let response: Response;
  try {
    response = await fetch(
      new URL(
        "/barber-customer/me",
        process.env.API_BASE_URL ?? "http://localhost:3001",
      ),
      { headers: { cookie: `saas_session=${session}` }, cache: "no-store" },
    );
  } catch {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Área do cliente</h1>
        <p className="mt-3" role="alert">
          Serviço indisponível neste momento.
        </p>
      </main>
    );
  }
  if (response.status === 401) redirect("/login");
  if (response.status === 404)
    return (
      <main className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Área do cliente</h1>
        <p>
          Esta conta não está associada a uma ficha de cliente da barbearia.
        </p>
        <Link className="underline" href="/">
          Voltar ao início
        </Link>
      </main>
    );
  if (!response.ok)
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Área do cliente</h1>
        <p role="alert" className="mt-3">
          Não foi possível carregar os seus dados.
        </p>
      </main>
    );
  const customer = (await response.json()) as Customer;
  return (
    <main className="mx-auto max-w-xl space-y-5 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Barber</p>
          <h1 className="text-3xl font-semibold">Os meus dados</h1>
        </div>
        <Link className="text-sm underline" href="/profile">
          Conta e terminar sessão
        </Link>
      </header>
      <section className="rounded-xl border bg-card p-5">
        <p>
          <b>Nome:</b> {customer.fullName}
        </p>
        <p className="mt-2">
          <b>Telefone:</b> {customer.phone}
        </p>
        <p className="mt-2">
          <b>Email:</b> {customer.email ?? "Não indicado"}
        </p>
      </section>
      <p className="text-sm text-muted-foreground">
        Esta conta só pode consultar a sua própria ficha. A área não permite
        acesso ao painel interno nem agendamentos.
      </p>
    </main>
  );
}
