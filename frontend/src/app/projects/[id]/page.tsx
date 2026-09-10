import { ProjectCommandCenterView } from "@/components/ProjectCommandCenterView";

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectPage({
  params,
}: ProjectPageProps) {
  const { id } = await params;

  return (
    <ProjectCommandCenterView
      projectId={id}
    />
  );
}
