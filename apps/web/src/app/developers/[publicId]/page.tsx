import { PublicDeveloperProfile } from "@/components/developer/public-profile";

export const instant = false;

export default async function PublicDeveloperPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <PublicDeveloperProfile publicId={publicId} />;
}
