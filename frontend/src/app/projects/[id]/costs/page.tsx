import { ProjectCostControlView } from "@/components/ProjectCostControlView";

interface CostPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CostPage({
  params,
}: CostPageProps) {
  const { id } =
    await params;

  return (
    <ProjectCostControlView
      projectId={id}
    />
  );
}
