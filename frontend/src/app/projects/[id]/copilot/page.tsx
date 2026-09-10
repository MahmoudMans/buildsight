import { ProjectAiCopilotView } from "@/components/ProjectAiCopilotView";

interface CopilotPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CopilotPage({
  params,
}: CopilotPageProps) {
  const { id } =
    await params;

  return (
    <ProjectAiCopilotView
      projectId={id}
    />
  );
}
