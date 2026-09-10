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

export async function getProjectProcurement(
  projectId: string,
): Promise<
  import("@/types/project").ProcurementControl
> {
  return request<
    import("@/types/project").ProcurementControl
  >(
    `/projects/${projectId}/procurement`,
  );
}

export async function createSupplier(
  input: import("@/types/project").CreateSupplierInput,
): Promise<
  import("@/types/project").Supplier
> {
  return request<
    import("@/types/project").Supplier
  >(
    "/suppliers",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateSupplier(
  supplierId: string,
  input: import("@/types/project").UpdateSupplierInput,
): Promise<
  import("@/types/project").Supplier
> {
  return request<
    import("@/types/project").Supplier
  >(
    `/suppliers/${supplierId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProcurementPackage(
  projectId: string,
  input: import("@/types/project").CreateProcurementPackageInput,
): Promise<
  import("@/types/project").ProcurementPackage
> {
  return request<
    import("@/types/project").ProcurementPackage
  >(
    `/projects/${projectId}/procurement/packages`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProcurementPackage(
  projectId: string,
  packageId: string,
  input: import("@/types/project").UpdateProcurementPackageInput,
): Promise<
  import("@/types/project").ProcurementPackage
> {
  return request<
    import("@/types/project").ProcurementPackage
  >(
    `/projects/${projectId}/procurement/packages/${packageId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProcurementBid(
  projectId: string,
  packageId: string,
  input: import("@/types/project").CreateProcurementBidInput,
): Promise<
  import("@/types/project").ProcurementBid
> {
  return request<
    import("@/types/project").ProcurementBid
  >(
    `/projects/${projectId}/procurement/packages/${packageId}/bids`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProcurementBid(
  projectId: string,
  packageId: string,
  bidId: string,
  input: import("@/types/project").UpdateProcurementBidInput,
): Promise<
  import("@/types/project").ProcurementBid
> {
  return request<
    import("@/types/project").ProcurementBid
  >(
    `/projects/${projectId}/procurement/packages/${packageId}/bids/${bidId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function awardProcurementPackage(
  projectId: string,
  packageId: string,
  input: import("@/types/project").AwardProcurementPackageInput,
): Promise<
  import("@/types/project").ProcurementPackage
> {
  return request<
    import("@/types/project").ProcurementPackage
  >(
    `/projects/${projectId}/procurement/packages/${packageId}/award`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createSupplierPerformanceEvaluation(
  projectId: string,
  input: import("@/types/project").CreateSupplierPerformanceEvaluationInput,
): Promise<
  import("@/types/project").SupplierPerformanceEvaluation
> {
  return request<
    import("@/types/project").SupplierPerformanceEvaluation
  >(
    `/projects/${projectId}/procurement/performance-evaluations`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectRiskControl(
  projectId: string,
): Promise<
  import("@/types/project").RiskControl
> {
  return request<
    import("@/types/project").RiskControl
  >(
    `/projects/${projectId}/risk-control`,
  );
}

export async function createProjectRisk(
  projectId: string,
  input: import("@/types/project").CreateRiskInput,
): Promise<
  import("@/types/project").ProjectRisk
> {
  return request<
    import("@/types/project").ProjectRisk
  >(
    `/projects/${projectId}/risk-control/risks`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectRisk(
  projectId: string,
  riskId: string,
  input: import("@/types/project").UpdateRiskInput,
): Promise<
  import("@/types/project").ProjectRisk
> {
  return request<
    import("@/types/project").ProjectRisk
  >(
    `/projects/${projectId}/risk-control/risks/${riskId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectIssue(
  projectId: string,
  input: import("@/types/project").CreateIssueInput,
): Promise<
  import("@/types/project").ProjectIssue
> {
  return request<
    import("@/types/project").ProjectIssue
  >(
    `/projects/${projectId}/risk-control/issues`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectIssue(
  projectId: string,
  issueId: string,
  input: import("@/types/project").UpdateIssueInput,
): Promise<
  import("@/types/project").ProjectIssue
> {
  return request<
    import("@/types/project").ProjectIssue
  >(
    `/projects/${projectId}/risk-control/issues/${issueId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectChangeEvent(
  projectId: string,
  input: import("@/types/project").CreateChangeEventInput,
): Promise<
  import("@/types/project").ProjectChangeEvent
> {
  return request<
    import("@/types/project").ProjectChangeEvent
  >(
    `/projects/${projectId}/risk-control/changes`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectChangeEvent(
  projectId: string,
  changeId: string,
  input: import("@/types/project").UpdateChangeEventInput,
): Promise<
  import("@/types/project").ProjectChangeEvent
> {
  return request<
    import("@/types/project").ProjectChangeEvent
  >(
    `/projects/${projectId}/risk-control/changes/${changeId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectDelayEvent(
  projectId: string,
  input: import("@/types/project").CreateDelayEventInput,
): Promise<
  import("@/types/project").ProjectDelayEvent
> {
  return request<
    import("@/types/project").ProjectDelayEvent
  >(
    `/projects/${projectId}/risk-control/delays`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectDelayEvent(
  projectId: string,
  delayId: string,
  input: import("@/types/project").UpdateDelayEventInput,
): Promise<
  import("@/types/project").ProjectDelayEvent
> {
  return request<
    import("@/types/project").ProjectDelayEvent
  >(
    `/projects/${projectId}/risk-control/delays/${delayId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectProduction(
  projectId: string,
): Promise<
  import("@/types/project").ProductionControl
> {
  return request<
    import("@/types/project").ProductionControl
  >(
    `/projects/${projectId}/production`,
  );
}

export async function createWorkPackage(
  projectId: string,
  input: import("@/types/project").CreateWorkPackageInput,
): Promise<
  import("@/types/project").WorkPackage
> {
  return request<
    import("@/types/project").WorkPackage
  >(
    `/projects/${projectId}/production/work-packages`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateWorkPackage(
  projectId: string,
  workPackageId: string,
  input: import("@/types/project").UpdateWorkPackageInput,
): Promise<
  import("@/types/project").WorkPackage
> {
  return request<
    import("@/types/project").WorkPackage
  >(
    `/projects/${projectId}/production/work-packages/${workPackageId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createSiteReport(
  projectId: string,
  input: import("@/types/project").CreateSiteReportInput,
): Promise<
  import("@/types/project").SiteReport
> {
  return request<
    import("@/types/project").SiteReport
  >(
    `/projects/${projectId}/production/site-reports`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateSiteReport(
  projectId: string,
  siteReportId: string,
  input: import("@/types/project").UpdateSiteReportInput,
): Promise<
  import("@/types/project").SiteReport
> {
  return request<
    import("@/types/project").SiteReport
  >(
    `/projects/${projectId}/production/site-reports/${siteReportId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProductionEntry(
  projectId: string,
  siteReportId: string,
  input: import("@/types/project").CreateProductionEntryInput,
): Promise<
  import("@/types/project").ProductionEntry
> {
  return request<
    import("@/types/project").ProductionEntry
  >(
    `/projects/${projectId}/production/site-reports/${siteReportId}/entries`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProductionEntry(
  projectId: string,
  siteReportId: string,
  entryId: string,
  input: import("@/types/project").UpdateProductionEntryInput,
): Promise<
  import("@/types/project").ProductionEntry
> {
  return request<
    import("@/types/project").ProductionEntry
  >(
    `/projects/${projectId}/production/site-reports/${siteReportId}/entries/${entryId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}
