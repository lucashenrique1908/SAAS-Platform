import { DeveloperRecordEditor } from "@/components/developer/developer-record-editor";

export default async function DeveloperProjectsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperRecordEditor slug={slug} kind="projects" />;
}
