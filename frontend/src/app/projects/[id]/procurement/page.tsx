import { ProjectProcurementView } from "@/components/ProjectProcurementView";

interface ProcurementPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProcurementPage({
  params,
}: ProcurementPageProps) {
  const { id } =
    await params;

  return (
    <ProjectProcurementView
      projectId={id}
    />
  );
}
