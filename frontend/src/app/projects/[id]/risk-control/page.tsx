import { ProjectRiskControlView } from "@/components/ProjectRiskControlView";

interface RiskControlPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RiskControlPage({
  params,
}: RiskControlPageProps) {
  const { id } =
    await params;

  return (
    <ProjectRiskControlView
      projectId={id}
    />
  );
}
