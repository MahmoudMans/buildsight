import type {
  CreateProjectInput,
  Project,
} from "@/types/project";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080/api/v1";

interface ApiErrorBody {
  message?: string;
  fieldErrors?: Record<string, string>;
}

export class BuildSightApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "BuildSightApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};

    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }

    throw new BuildSightApiError(
      response.status,
      body.message ?? `Request failed with status ${response.status}.`,
      body.fieldErrors ?? {},
    );
  }

  return (await response.json()) as T;
}

export async function getProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
