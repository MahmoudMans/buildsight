import { ProjectRecoveryView } from "@/components/ProjectRecoveryView";

interface RecoveryPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RecoveryPage({
  params,
}: RecoveryPageProps) {
  const { id } =
    await params;

  return (
    <ProjectRecoveryView
      projectId={id}
    />
  );
}
