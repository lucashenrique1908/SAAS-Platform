import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">SaaS Platform</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Secure access to your account and organizations.
      </p>
      <nav className="mt-8 flex gap-4">
        <Link
          className="rounded-md bg-primary px-5 py-3 text-primary-foreground"
          href="/login"
        >
          Sign in
        </Link>
        <Link className="rounded-md border px-5 py-3" href="/register">
          Create account
        </Link>
      </nav>
    </main>
  );
}
