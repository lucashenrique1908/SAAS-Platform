import { DeveloperSearch } from "@/components/developer/developer-search";

export default async function DeveloperSearchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperSearch slug={slug} />;
}
