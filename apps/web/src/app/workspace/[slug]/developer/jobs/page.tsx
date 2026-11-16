import { DeveloperJobs } from "@/components/developer/developer-jobs";
export default async function DeveloperJobsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperJobs slug={slug} />;
}
