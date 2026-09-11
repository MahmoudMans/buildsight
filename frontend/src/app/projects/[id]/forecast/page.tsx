import { ProjectForecastControlView } from "@/components/ProjectForecastControlView";

interface ForecastPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ForecastPage({
  params,
}: ForecastPageProps) {
  const { id } =
    await params;

  return (
    <ProjectForecastControlView
      projectId={id}
    />
  );
}
