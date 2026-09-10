export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type MilestoneStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED";

export type ProjectHealthBand =
  | "HEALTHY"
  | "WATCH"
  | "AT_RISK";

export type ScheduleRiskLevel =
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clientName: string;
  location: string;
  contractValue: number;
  approvedBudget: number;
  plannedStartDate: string;
  plannedEndDate: string;
  forecastEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  status: ProjectStatus;
  physicalProgressPercentage: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description: string;
  clientName: string;
  location: string;
  contractValue: number;
  approvedBudget: number;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface UpdateProjectInput {
  version: number;
  name: string;
  description: string;
  clientName: string;
  location: string;
  contractValue: number;
  approvedBudget: number;
  plannedStartDate: string;
  plannedEndDate: string;
  forecastEndDate: string;
}

export interface ChangeProjectStatusInput {
  version: number;
  status: ProjectStatus;
}

export interface RecordProgressInput {
  version: number;
  progressPercentage: number;
  updateDate: string;
  note: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  plannedDate: string;
  forecastDate: string;
  actualDate: string | null;
  status: MilestoneStatus;
  weightPercentage: number;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneInput {
  name: string;
  description: string;
  plannedDate: string;
  forecastDate: string | null;
  weightPercentage: number;
  sortOrder: number;
}

export interface UpdateMilestoneInput {
  version: number;
  name: string;
  description: string;
  plannedDate: string;
  forecastDate: string;
  actualDate: string | null;
  status: MilestoneStatus;
  weightPercentage: number;
  sortOrder: number;
}

export interface ProgressUpdate {
  id: string;
  projectId: string;
  progressPercentage: number;
  updateDate: string;
  note: string | null;
  createdAt: string;
}

export interface ProjectHealthScore {
  calculationDate: string;
  score: number;
  healthBand: ProjectHealthBand;
  scheduleRisk: ScheduleRiskLevel;
  costRisk: CostRiskLevel;
  scheduleVarianceDays: number;
  expectedProgressPercentage: number;
  actualProgressPercentage: number;
  progressVariancePoints: number;
  overdueMilestones: number;
  blockedMilestones: number;
  scheduleScore: number;
  progressScore: number;
  milestoneScore: number;
  costScore: number;
  explanation: string;
}

export interface ProjectCommandCenter {
  project: Project;
  health: ProjectHealthScore;
  milestones: Milestone[];
  progressUpdates: ProgressUpdate[];
}

export type CostCodeCategory =
  | "PRELIMINARIES"
  | "STRUCTURE"
  | "ARCHITECTURAL"
  | "MEP"
  | "EXTERNAL_WORKS"
  | "PROFESSIONAL_FEES"
  | "CONTINGENCY"
  | "OTHER";

export type CommitmentStatus =
  | "DRAFT"
  | "APPROVED"
  | "CLOSED"
  | "CANCELLED";

export type CostRiskLevel =
  | "NO_BASELINE"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface CostCode {
  id: string;
  projectId: string;
  code: string;
  name: string;
  category: CostCodeCategory;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface BudgetLine {
  id: string;
  projectId: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  description: string | null;
  originalBudget: number;
  approvedChanges: number;
  revisedBudget: number;
  forecastCost: number;
  forecastVariance: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Commitment {
  id: string;
  projectId: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  reference: string;
  vendorName: string;
  description: string | null;
  committedAmount: number;
  status: CommitmentStatus;
  commitmentDate: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActualCost {
  id: string;
  projectId: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  commitmentId: string | null;
  commitmentReference: string | null;
  reference: string;
  supplierName: string;
  description: string | null;
  amount: number;
  costDate: string;
  createdAt: string;
}

export interface CostIntelligence {
  projectApprovedBudget: number;
  originalCostPlan: number;
  approvedChanges: number;
  revisedCostPlan: number;
  unallocatedBudget: number;
  totalApprovedCommitments: number;
  outstandingCommitments: number;
  actualCosts: number;
  forecastAtCompletion: number;
  varianceAtCompletion: number;
  overrunAmount: number;
  budgetUtilizationPercentage: number;
  committedExposurePercentage: number;
  forecastVariancePercentage: number;
  costScore: number;
  costRisk: CostRiskLevel;
  explanation: string;
}

export interface CostControl {
  project: Project;
  intelligence: CostIntelligence;
  costCodes: CostCode[];
  budgetLines: BudgetLine[];
  commitments: Commitment[];
  actualCosts: ActualCost[];
}

export interface CreateCostCodeInput {
  code: string;
  name: string;
  category: CostCodeCategory;
  description: string;
  sortOrder: number;
}

export interface CreateBudgetLineInput {
  costCodeId: string;
  description: string;
  originalBudget: number;
  approvedChanges: number;
  forecastCost: number | null;
}

export interface UpdateBudgetLineInput {
  version: number;
  description: string;
  originalBudget: number;
  approvedChanges: number;
  forecastCost: number;
}

export interface CreateCommitmentInput {
  costCodeId: string;
  reference: string;
  vendorName: string;
  description: string;
  committedAmount: number;
  status: CommitmentStatus;
  commitmentDate: string;
}

export interface UpdateCommitmentInput {
  version: number;
  vendorName: string;
  description: string;
  committedAmount: number;
  status: CommitmentStatus;
  commitmentDate: string;
}

export interface CreateActualCostInput {
  costCodeId: string;
  commitmentId: string | null;
  reference: string;
  supplierName: string;
  description: string;
  amount: number;
  costDate: string;
}
