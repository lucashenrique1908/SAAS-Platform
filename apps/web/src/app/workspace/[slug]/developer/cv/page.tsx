import { DeveloperCv } from "@/components/developer/developer-cv";

export default async function DeveloperCvPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DeveloperCv slug={slug} />;
}
