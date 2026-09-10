import { ProjectResourceControlView } from "@/components/ProjectResourceControlView";

interface ResourcePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ResourcePage({
  params,
}: ResourcePageProps) {
  const { id } =
    await params;

  return (
    <ProjectResourceControlView
      projectId={id}
    />
  );
}
