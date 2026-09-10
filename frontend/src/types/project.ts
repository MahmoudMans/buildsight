export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

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
