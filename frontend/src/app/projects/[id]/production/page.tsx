import { ProjectProductionView } from "@/components/ProjectProductionView";

interface ProductionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductionPage({
  params,
}: ProductionPageProps) {
  const { id } =
    await params;

  return (
    <ProjectProductionView
      projectId={id}
    />
  );
}
