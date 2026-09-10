import type {
  ChangeProjectStatusInput,
  CreateMilestoneInput,
  CreateProjectInput,
  Milestone,
  Project,
  ProjectCommandCenter,
  RecordProgressInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
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
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );

  if (!response.ok) {
    let body: ApiErrorBody = {};

    try {
      body =
        (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }

    throw new BuildSightApiError(
      response.status,
      body.message ??
        `Request failed with status ${response.status}.`,
      body.fieldErrors ?? {},
    );
  }

  return (await response.json()) as T;
}

export async function getProjects(): Promise<
  Project[]
> {
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

export async function getProjectCommandCenter(
  projectId: string,
): Promise<ProjectCommandCenter> {
  return request<ProjectCommandCenter>(
    `/projects/${projectId}/command-center`,
  );
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  return request<Project>(
    `/projects/${projectId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function changeProjectStatus(
  projectId: string,
  input: ChangeProjectStatusInput,
): Promise<Project> {
  return request<Project>(
    `/projects/${projectId}/status`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function recordProjectProgress(
  projectId: string,
  input: RecordProgressInput,
): Promise<Project> {
  return request<Project>(
    `/projects/${projectId}/progress`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectMilestone(
  projectId: string,
  input: CreateMilestoneInput,
): Promise<Milestone> {
  return request<Milestone>(
    `/projects/${projectId}/milestones`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<Milestone> {
  return request<Milestone>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectCostControl(
  projectId: string,
): Promise<
  import("@/types/project").CostControl
> {
  return request<
    import("@/types/project").CostControl
  >(
    `/projects/${projectId}/cost-control`,
  );
}

export async function createProjectCostCode(
  projectId: string,
  input: import("@/types/project").CreateCostCodeInput,
): Promise<
  import("@/types/project").CostCode
> {
  return request<
    import("@/types/project").CostCode
  >(
    `/projects/${projectId}/cost-control/cost-codes`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectBudgetLine(
  projectId: string,
  input: import("@/types/project").CreateBudgetLineInput,
): Promise<
  import("@/types/project").BudgetLine
> {
  return request<
    import("@/types/project").BudgetLine
  >(
    `/projects/${projectId}/cost-control/budget-lines`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectBudgetLine(
  projectId: string,
  budgetLineId: string,
  input: import("@/types/project").UpdateBudgetLineInput,
): Promise<
  import("@/types/project").BudgetLine
> {
  return request<
    import("@/types/project").BudgetLine
  >(
    `/projects/${projectId}/cost-control/budget-lines/${budgetLineId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectCommitment(
  projectId: string,
  input: import("@/types/project").CreateCommitmentInput,
): Promise<
  import("@/types/project").Commitment
> {
  return request<
    import("@/types/project").Commitment
  >(
    `/projects/${projectId}/cost-control/commitments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectCommitment(
  projectId: string,
  commitmentId: string,
  input: import("@/types/project").UpdateCommitmentInput,
): Promise<
  import("@/types/project").Commitment
> {
  return request<
    import("@/types/project").Commitment
  >(
    `/projects/${projectId}/cost-control/commitments/${commitmentId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectActualCost(
  projectId: string,
  input: import("@/types/project").CreateActualCostInput,
): Promise<
  import("@/types/project").ActualCost
> {
  return request<
    import("@/types/project").ActualCost
  >(
    `/projects/${projectId}/cost-control/actual-costs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
