import { ProjectSafetyControlView } from "@/components/ProjectSafetyControlView";

interface SafetyPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SafetyPage({
  params,
}: SafetyPageProps) {
  const { id } =
    await params;

  return (
    <ProjectSafetyControlView
      projectId={id}
    />
  );
}
