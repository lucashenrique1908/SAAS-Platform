import { DeveloperIntegrations } from "@/components/developer/developer-integrations";

export default async function DeveloperIntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result =
    query.result === "connected" || query.result === "failed"
      ? query.result
      : undefined;
  return <DeveloperIntegrations slug={slug} result={result} />;
}
