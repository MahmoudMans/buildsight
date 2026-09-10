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
  scheduleVarianceDays: number;
  expectedProgressPercentage: number;
  actualProgressPercentage: number;
  progressVariancePoints: number;
  overdueMilestones: number;
  blockedMilestones: number;
  scheduleScore: number;
  progressScore: number;
  milestoneScore: number;
  explanation: string;
}

export interface ProjectCommandCenter {
  project: Project;
  health: ProjectHealthScore;
  milestones: Milestone[];
  progressUpdates: ProgressUpdate[];
}
