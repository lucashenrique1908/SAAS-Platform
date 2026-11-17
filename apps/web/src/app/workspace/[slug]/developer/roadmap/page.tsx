import { DeveloperRoadmaps } from "@/components/developer/developer-roadmaps";
export default async function DeveloperRoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperRoadmaps slug={slug} />;
}
