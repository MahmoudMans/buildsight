import { ProjectScheduleControlView } from "@/components/ProjectScheduleControlView";

interface SchedulePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SchedulePage({
  params,
}: SchedulePageProps) {
  const { id } =
    await params;

  return (
    <ProjectScheduleControlView
      projectId={id}
    />
  );
}
