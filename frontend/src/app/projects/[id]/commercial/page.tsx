import { ProjectCommercialControlView } from "@/components/ProjectCommercialControlView";

interface CommercialPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CommercialPage({
  params,
}: CommercialPageProps) {
  const { id } =
    await params;

  return (
    <ProjectCommercialControlView
      projectId={id}
    />
  );
}
