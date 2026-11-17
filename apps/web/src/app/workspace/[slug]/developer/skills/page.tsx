import { DeveloperSkillsEditor } from "@/components/developer/developer-skills-editor";

export default async function DeveloperSkillsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperSkillsEditor slug={slug} />;
}
