import { ProjectDocumentControlView } from "@/components/ProjectDocumentControlView";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DocumentPage({
  params,
}: DocumentPageProps) {
  const { id } =
    await params;

  return (
    <ProjectDocumentControlView
      projectId={id}
    />
  );
}
