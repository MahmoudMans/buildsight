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

export async function getProjectDocuments(
  projectId: string,
): Promise<
  import("@/types/project").DocumentControl
> {
  return request<
    import("@/types/project").DocumentControl
  >(
    `/projects/${projectId}/documents`,
  );
}

export async function createProjectDocument(
  projectId: string,
  input: import("@/types/project").CreateDocumentInput,
): Promise<
  import("@/types/project").ProjectDocument
> {
  return request<
    import("@/types/project").ProjectDocument
  >(
    `/projects/${projectId}/documents`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function uploadProjectDocumentRevision(
  projectId: string,
  documentId: string,
  revisionCode: string,
  status: import("@/types/project").DocumentRevisionStatus,
  issuedDate: string,
  file: File,
): Promise<
  import("@/types/project").DocumentRevision
> {
  const formData =
    new FormData();

  formData.append(
    "revisionCode",
    revisionCode,
  );

  formData.append(
    "status",
    status,
  );

  formData.append(
    "issuedDate",
    issuedDate,
  );

  formData.append(
    "file",
    file,
  );

  const response =
    await fetch(
      `${API_BASE_URL}/projects/${projectId}/documents/${documentId}/revisions`,
      {
        method: "POST",
        body: formData,
      },
    );

  if (!response.ok) {
    let body: ApiErrorBody =
      {};

    try {
      body =
        (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }

    throw new BuildSightApiError(
      response.status,
      body.message ??
        `Upload failed with status ${response.status}.`,
      body.fieldErrors ??
        {},
    );
  }

  return (
    await response.json()
  ) as import("@/types/project").DocumentRevision;
}

export async function updateProjectDocumentRevisionStatus(
  projectId: string,
  documentId: string,
  revisionId: string,
  version: number,
  status: import("@/types/project").DocumentRevisionStatus,
): Promise<
  import("@/types/project").DocumentRevision
> {
  return request<
    import("@/types/project").DocumentRevision
  >(
    `/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/status`,
    {
      method: "PUT",
      body: JSON.stringify({
        version,
        status,
      }),
    },
  );
}

export function projectDocumentDownloadUrl(
  projectId: string,
  documentId: string,
  revisionId: string,
): string {
  return `${API_BASE_URL}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/content`;
}

export async function createProjectRfi(
  projectId: string,
  input: import("@/types/project").CreateRfiInput,
): Promise<
  import("@/types/project").ProjectRfi
> {
  return request<
    import("@/types/project").ProjectRfi
  >(
    `/projects/${projectId}/documents/rfis`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectRfi(
  projectId: string,
  rfiId: string,
  input: import("@/types/project").UpdateRfiInput,
): Promise<
  import("@/types/project").ProjectRfi
> {
  return request<
    import("@/types/project").ProjectRfi
  >(
    `/projects/${projectId}/documents/rfis/${rfiId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectTransmittal(
  projectId: string,
  input: import("@/types/project").CreateTransmittalInput,
): Promise<
  import("@/types/project").ProjectTransmittal
> {
  return request<
    import("@/types/project").ProjectTransmittal
  >(
    `/projects/${projectId}/documents/transmittals`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function issueProjectTransmittal(
  projectId: string,
  transmittalId: string,
  version: number,
): Promise<
  import("@/types/project").ProjectTransmittal
> {
  return request<
    import("@/types/project").ProjectTransmittal
  >(
    `/projects/${projectId}/documents/transmittals/${transmittalId}/issue`,
    {
      method: "POST",
      body: JSON.stringify({
        version,
      }),
    },
  );
}

export async function searchProjectDocuments(
  projectId: string,
  query: string,
): Promise<
  import("@/types/project").DocumentSearchResult[]
> {
  return request<
    import("@/types/project").DocumentSearchResult[]
  >(
    `/projects/${projectId}/documents/search?q=${encodeURIComponent(
      query,
    )}`,
  );
}

export async function getProjectAiStatus(
  projectId: string,
): Promise<
  import("@/types/project").AiStatus
> {
  return request<
    import("@/types/project").AiStatus
  >(
    `/projects/${projectId}/ai/status`,
  );
}

export async function rebuildProjectAiIndex(
  projectId: string,
): Promise<
  import("@/types/project").AiIndexResult
> {
  return request<
    import("@/types/project").AiIndexResult
  >(
    `/projects/${projectId}/ai/index/rebuild`,
    {
      method: "POST",
    },
  );
}

export async function askProjectAi(
  projectId: string,
  question: string,
): Promise<
  import("@/types/project").AiAnswer
> {
  return request<
    import("@/types/project").AiAnswer
  >(
    `/projects/${projectId}/ai/ask`,
    {
      method: "POST",
      body: JSON.stringify({
        question,
      }),
    },
  );
}

export async function getProjectAiAttentionBrief(
  projectId: string,
): Promise<
  import("@/types/project").AiAnswer
> {
  return request<
    import("@/types/project").AiAnswer
  >(
    `/projects/${projectId}/ai/attention-brief`,
    {
      method: "POST",
    },
  );
}

export async function getProjectAiHistory(
  projectId: string,
): Promise<
  import("@/types/project").AiHistoryItem[]
> {
  return request<
    import("@/types/project").AiHistoryItem[]
  >(
    `/projects/${projectId}/ai/history`,
  );
}

export async function getPortfolioExecutive(): Promise<
  import("@/types/project").PortfolioExecutive
> {
  return request<
    import("@/types/project").PortfolioExecutive
  >(
    "/portfolio/executive",
  );
}

export async function getPortfolioProjectComparison(
  projectId: string,
): Promise<
  import("@/types/project").PortfolioProjectComparison
> {
  return request<
    import("@/types/project").PortfolioProjectComparison
  >(
    `/portfolio/projects/${projectId}/comparison`,
  );
}

export async function getPortfolioAiStatus(): Promise<
  import("@/types/project").PortfolioAiStatus
> {
  return request<
    import("@/types/project").PortfolioAiStatus
  >(
    "/portfolio/ai/status",
  );
}

export async function generatePortfolioAiBrief(): Promise<
  import("@/types/project").PortfolioAiBrief
> {
  return request<
    import("@/types/project").PortfolioAiBrief
  >(
    "/portfolio/ai/brief",
    {
      method: "POST",
    },
  );
}

export async function getProjectQuality(
  projectId: string,
): Promise<
  import("@/types/project").QualityControl
> {
  return request<
    import("@/types/project").QualityControl
  >(
    `/projects/${projectId}/quality`,
  );
}

export async function createQualityInspection(
  projectId: string,
  input: import("@/types/project").CreateQualityInspectionInput,
): Promise<
  import("@/types/project").QualityInspection
> {
  return request<
    import("@/types/project").QualityInspection
  >(
    `/projects/${projectId}/quality/inspections`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateQualityInspection(
  projectId: string,
  inspectionId: string,
  input: import("@/types/project").UpdateQualityInspectionInput,
): Promise<
  import("@/types/project").QualityInspection
> {
  return request<
    import("@/types/project").QualityInspection
  >(
    `/projects/${projectId}/quality/inspections/${inspectionId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createProjectNcr(
  projectId: string,
  input: import("@/types/project").CreateNcrInput,
): Promise<
  import("@/types/project").ProjectNcr
> {
  return request<
    import("@/types/project").ProjectNcr
  >(
    `/projects/${projectId}/quality/ncrs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectNcr(
  projectId: string,
  ncrId: string,
  input: import("@/types/project").UpdateNcrInput,
): Promise<
  import("@/types/project").ProjectNcr
> {
  return request<
    import("@/types/project").ProjectNcr
  >(
    `/projects/${projectId}/quality/ncrs/${ncrId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createPunchItem(
  projectId: string,
  input: import("@/types/project").CreatePunchItemInput,
): Promise<
  import("@/types/project").PunchItem
> {
  return request<
    import("@/types/project").PunchItem
  >(
    `/projects/${projectId}/quality/punch-items`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updatePunchItem(
  projectId: string,
  punchItemId: string,
  input: import("@/types/project").UpdatePunchItemInput,
): Promise<
  import("@/types/project").PunchItem
> {
  return request<
    import("@/types/project").PunchItem
  >(
    `/projects/${projectId}/quality/punch-items/${punchItemId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createHandoverItem(
  projectId: string,
  input: import("@/types/project").CreateHandoverItemInput,
): Promise<
  import("@/types/project").HandoverItem
> {
  return request<
    import("@/types/project").HandoverItem
  >(
    `/projects/${projectId}/quality/handover-items`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateHandoverItem(
  projectId: string,
  handoverItemId: string,
  input: import("@/types/project").UpdateHandoverItemInput,
): Promise<
  import("@/types/project").HandoverItem
> {
  return request<
    import("@/types/project").HandoverItem
  >(
    `/projects/${projectId}/quality/handover-items/${handoverItemId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectSafety(
  projectId: string,
): Promise<
  import("@/types/project").SafetyControl
> {
  return request<
    import("@/types/project").SafetyControl
  >(
    `/projects/${projectId}/safety`,
  );
}

export async function createSafetyIncident(
  projectId: string,
  input: import("@/types/project").CreateSafetyIncidentInput,
): Promise<
  import("@/types/project").SafetyIncident
> {
  return request<
    import("@/types/project").SafetyIncident
  >(
    `/projects/${projectId}/safety/incidents`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateSafetyIncident(
  projectId: string,
  incidentId: string,
  input: {
    version: number;
    incidentType: import("@/types/project").SafetyIncidentType;
    severity: import("@/types/project").SafetySeverity;
    title: string;
    description: string;
    location: string;
    peopleAffected: number;
    lostTimeDays: number;
    immediateAction: string;
    rootCause: string;
    investigationNotes: string;
    status: import("@/types/project").SafetyIncidentStatus;
  },
): Promise<
  import("@/types/project").SafetyIncident
> {
  return request<
    import("@/types/project").SafetyIncident
  >(
    `/projects/${projectId}/safety/incidents/${incidentId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createSafetyObservation(
  projectId: string,
  input: import("@/types/project").CreateSafetyObservationInput,
): Promise<
  import("@/types/project").SafetyObservation
> {
  return request<
    import("@/types/project").SafetyObservation
  >(
    `/projects/${projectId}/safety/observations`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateSafetyObservation(
  projectId: string,
  observationId: string,
  input: {
    version: number;
    observationType: import("@/types/project").SafetyObservationType;
    hazardCategory: import("@/types/project").HazardCategory;
    severity: import("@/types/project").SafetySeverity;
    title: string;
    description: string;
    location: string;
    ownerName: string;
    dueDate: string | null;
    status: import("@/types/project").SafetyObservationStatus;
  },
): Promise<
  import("@/types/project").SafetyObservation
> {
  return request<
    import("@/types/project").SafetyObservation
  >(
    `/projects/${projectId}/safety/observations/${observationId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createSafetyAction(
  projectId: string,
  input: import("@/types/project").CreateSafetyActionInput,
): Promise<
  import("@/types/project").SafetyAction
> {
  return request<
    import("@/types/project").SafetyAction
  >(
    `/projects/${projectId}/safety/actions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateSafetyAction(
  projectId: string,
  actionId: string,
  input: {
    version: number;
    title: string;
    actionDescription: string;
    ownerName: string;
    dueDate: string;
    status: import("@/types/project").SafetyActionStatus;
    verificationNotes: string;
  },
): Promise<
  import("@/types/project").SafetyAction
> {
  return request<
    import("@/types/project").SafetyAction
  >(
    `/projects/${projectId}/safety/actions/${actionId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createWorkPermit(
  projectId: string,
  input: import("@/types/project").CreateWorkPermitInput,
): Promise<
  import("@/types/project").WorkPermit
> {
  return request<
    import("@/types/project").WorkPermit
  >(
    `/projects/${projectId}/safety/permits`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateWorkPermit(
  projectId: string,
  permitId: string,
  input: {
    version: number;
    permitType: import("@/types/project").WorkPermitType;
    title: string;
    location: string;
    issuerName: string;
    receiverName: string;
    validFrom: string;
    validUntil: string;
    controls: string;
    status: import("@/types/project").WorkPermitStatus;
  },
): Promise<
  import("@/types/project").WorkPermit
> {
  return request<
    import("@/types/project").WorkPermit
  >(
    `/projects/${projectId}/safety/permits/${permitId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectCommercial(
  projectId: string,
): Promise<
  import("@/types/project").CommercialControl
> {
  return request<
    import("@/types/project").CommercialControl
  >(
    `/projects/${projectId}/commercial`,
  );
}

export async function createCommercialChangeOrder(
  projectId: string,
  input: import("@/types/project").CreateCommercialChangeOrderInput,
): Promise<
  import("@/types/project").CommercialChangeOrder
> {
  return request<
    import("@/types/project").CommercialChangeOrder
  >(
    `/projects/${projectId}/commercial/change-orders`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateCommercialChangeOrder(
  projectId: string,
  changeOrderId: string,
  input: Record<string, unknown>,
): Promise<
  import("@/types/project").CommercialChangeOrder
> {
  return request<
    import("@/types/project").CommercialChangeOrder
  >(
    `/projects/${projectId}/commercial/change-orders/${changeOrderId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createCommercialClaim(
  projectId: string,
  input: import("@/types/project").CreateCommercialClaimInput,
): Promise<
  import("@/types/project").CommercialClaim
> {
  return request<
    import("@/types/project").CommercialClaim
  >(
    `/projects/${projectId}/commercial/claims`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateCommercialClaim(
  projectId: string,
  claimId: string,
  input: Record<string, unknown>,
): Promise<
  import("@/types/project").CommercialClaim
> {
  return request<
    import("@/types/project").CommercialClaim
  >(
    `/projects/${projectId}/commercial/claims/${claimId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createPaymentCertificate(
  projectId: string,
  input: import("@/types/project").CreatePaymentCertificateInput,
): Promise<
  import("@/types/project").PaymentCertificate
> {
  return request<
    import("@/types/project").PaymentCertificate
  >(
    `/projects/${projectId}/commercial/payment-certificates`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updatePaymentCertificate(
  projectId: string,
  certificateId: string,
  input: Record<string, unknown>,
): Promise<
  import("@/types/project").PaymentCertificate
> {
  return request<
    import("@/types/project").PaymentCertificate
  >(
    `/projects/${projectId}/commercial/payment-certificates/${certificateId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createCashflowPeriod(
  projectId: string,
  input: import("@/types/project").CreateCashflowPeriodInput,
): Promise<
  import("@/types/project").CashflowPeriod
> {
  return request<
    import("@/types/project").CashflowPeriod
  >(
    `/projects/${projectId}/commercial/cashflow-periods`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateCashflowPeriod(
  projectId: string,
  periodId: string,
  input: Record<string, unknown>,
): Promise<
  import("@/types/project").CashflowPeriod
> {
  return request<
    import("@/types/project").CashflowPeriod
  >(
    `/projects/${projectId}/commercial/cashflow-periods/${periodId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}
