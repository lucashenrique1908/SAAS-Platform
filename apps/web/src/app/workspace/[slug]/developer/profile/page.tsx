import { DeveloperProfileEditor } from "@/components/developer/developer-profile-editor";

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperProfileEditor slug={slug} />;
}
