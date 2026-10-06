import { ProjectPeriodControlView } from "@/components/ProjectPeriodControlView";

interface PeriodControlPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PeriodControlPage({
  params,
}: PeriodControlPageProps) {
  const { id } =
    await params;

  return (
    <ProjectPeriodControlView
      projectId={id}
    />
  );
}
