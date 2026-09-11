import { ProjectGovernanceView } from "@/components/ProjectGovernanceView";

interface GovernancePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function GovernancePage({
  params,
}: GovernancePageProps) {
  const { id } =
    await params;

  return (
    <ProjectGovernanceView
      projectId={id}
    />
  );
}
