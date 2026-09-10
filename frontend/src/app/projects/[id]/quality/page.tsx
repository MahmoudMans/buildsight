import { ProjectQualityControlView } from "@/components/ProjectQualityControlView";

interface QualityPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QualityPage({
  params,
}: QualityPageProps) {
  const { id } =
    await params;

  return (
    <ProjectQualityControlView
      projectId={id}
    />
  );
}
