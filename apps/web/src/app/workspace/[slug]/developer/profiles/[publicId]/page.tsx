import { OrganizationDeveloperProfile } from "@/components/developer/organization-profile";

export default async function OrganizationDeveloperProfilePage({
  params,
}: {
  params: Promise<{ slug: string; publicId: string }>;
}) {
  const { slug, publicId } = await params;
  return <OrganizationDeveloperProfile slug={slug} publicId={publicId} />;
}
