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
  procurementRisk: ProcurementRiskLevel;
  riskLevel: RiskIntelligenceLevel;
  productionRisk: ProductionRiskLevel;
  informationRisk: InformationRiskLevel;
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
  procurementScore: number;
  riskScore: number;
  productionScore: number;
  informationScore: number;
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

export type SupplierType =
  | "SUPPLIER"
  | "SUBCONTRACTOR"
  | "CONSULTANT";

export type SupplierQualificationStatus =
  | "PENDING"
  | "QUALIFIED"
  | "CONDITIONAL"
  | "SUSPENDED"
  | "REJECTED";

export type ProcurementPackageStatus =
  | "PLANNING"
  | "TENDERING"
  | "EVALUATION"
  | "AWARDED"
  | "CLOSED"
  | "CANCELLED";

export type ProcurementBidStatus =
  | "RECEIVED"
  | "SHORTLISTED"
  | "REJECTED"
  | "SELECTED";

export type ProcurementRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface Supplier {
  id: string;
  code: string;
  name: string;
  supplierType: SupplierType;
  trade: string | null;
  country: string | null;
  contactPerson: string | null;
  email: string | null;
  qualificationStatus: SupplierQualificationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementPackage {
  id: string;
  projectId: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  reference: string;
  title: string;
  description: string | null;
  estimatedValue: number;
  plannedIssueDate: string;
  actualIssueDate: string | null;
  bidDueDate: string;
  awardDueDate: string;
  forecastAwardDate: string;
  requiredOnSiteDate: string;
  status: ProcurementPackageStatus;
  awardedSupplierId: string | null;
  awardedSupplierName: string | null;
  awardedValue: number | null;
  awardDate: string | null;
  commitmentId: string | null;
  commitmentReference: string | null;
  bidCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementBid {
  id: string;
  procurementPackageId: string;
  packageReference: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierQualificationStatus: SupplierQualificationStatus;
  bidAmount: number;
  submittedDate: string;
  technicalScore: number;
  commercialScore: number;
  combinedScore: number;
  deliveryDays: number;
  status: ProcurementBidStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPerformanceEvaluation {
  id: string;
  projectId: string;
  supplierId: string;
  supplierName: string;
  procurementPackageId: string | null;
  packageReference: string | null;
  evaluationDate: string;
  qualityScore: number;
  deliveryScore: number;
  safetyScore: number;
  commercialScore: number;
  overallScore: number;
  comments: string | null;
  createdAt: string;
}

export interface ProcurementIntelligence {
  totalPackages: number;
  openPackages: number;
  awardedPackages: number;
  delayedPackages: number;
  conditionalAwards: number;
  lowPerformanceEvaluations: number;
  packagesWithCompetitiveCoverage: number;
  totalEstimatedValue: number;
  totalAwardedValue: number;
  competitionCoveragePercentage: number;
  averageSupplierPerformance: number;
  maximumAwardDelayDays: number;
  procurementScore: number;
  procurementRisk: ProcurementRiskLevel;
  explanation: string;
}

export interface ProcurementControl {
  project: Project;
  intelligence: ProcurementIntelligence;
  costCodes: CostCode[];
  suppliers: Supplier[];
  packages: ProcurementPackage[];
  bids: ProcurementBid[];
  evaluations: SupplierPerformanceEvaluation[];
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  supplierType: SupplierType;
  trade: string;
  country: string;
  contactPerson: string;
  email: string;
  qualificationStatus: SupplierQualificationStatus;
}

export interface UpdateSupplierInput {
  version: number;
  name: string;
  supplierType: SupplierType;
  trade: string;
  country: string;
  contactPerson: string;
  email: string;
  qualificationStatus: SupplierQualificationStatus;
}

export interface CreateProcurementPackageInput {
  costCodeId: string;
  reference: string;
  title: string;
  description: string;
  estimatedValue: number;
  plannedIssueDate: string;
  bidDueDate: string;
  awardDueDate: string;
  forecastAwardDate: string | null;
  requiredOnSiteDate: string;
}

export interface UpdateProcurementPackageInput {
  version: number;
  title: string;
  description: string;
  estimatedValue: number;
  plannedIssueDate: string;
  bidDueDate: string;
  awardDueDate: string;
  forecastAwardDate: string;
  requiredOnSiteDate: string;
  status: ProcurementPackageStatus;
}

export interface CreateProcurementBidInput {
  supplierId: string;
  bidAmount: number;
  submittedDate: string;
  technicalScore: number;
  commercialScore: number;
  deliveryDays: number;
  notes: string;
}

export interface UpdateProcurementBidInput {
  version: number;
  bidAmount: number;
  submittedDate: string;
  technicalScore: number;
  commercialScore: number;
  deliveryDays: number;
  status: ProcurementBidStatus;
  notes: string;
}

export interface AwardProcurementPackageInput {
  version: number;
  selectedBidId: string;
  awardedValue: number;
  awardDate: string;
}

export interface CreateSupplierPerformanceEvaluationInput {
  supplierId: string;
  procurementPackageId: string | null;
  evaluationDate: string;
  qualityScore: number;
  deliveryScore: number;
  safetyScore: number;
  commercialScore: number;
  comments: string;
}

export type RiskCategory =
  | "COST"
  | "SCHEDULE"
  | "TECHNICAL"
  | "COMMERCIAL"
  | "PROCUREMENT"
  | "SAFETY"
  | "QUALITY"
  | "OTHER";

export type RiskStatus =
  | "OPEN"
  | "MITIGATING"
  | "ACCEPTED"
  | "CLOSED";

export type RiskExposureBand =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type RiskIntelligenceLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export type IssueSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type IssueStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type ChangeEventStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "IMPLEMENTED";

export type DelayCause =
  | "CLIENT"
  | "DESIGN"
  | "PROCUREMENT"
  | "SUBCONTRACTOR"
  | "WEATHER"
  | "SITE_CONDITION"
  | "REGULATORY"
  | "OTHER";

export type DelayStatus =
  | "OPEN"
  | "MITIGATING"
  | "RESOLVED";

export interface ProjectRisk {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  category: RiskCategory;
  ownerName: string | null;
  probability: number;
  impact: number;
  inherentScore: number;
  residualProbability: number;
  residualImpact: number;
  residualScore: number;
  exposureBand: RiskExposureBand;
  mitigationPlan: string | null;
  mitigationDueDate: string;
  status: RiskStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIssue {
  id: string;
  projectId: string;
  sourceRiskId: string | null;
  sourceRiskReference: string | null;
  reference: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  ownerName: string | null;
  targetResolutionDate: string;
  status: IssueStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectChangeEvent {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  originator: string | null;
  requestedDate: string;
  decisionDate: string | null;
  costImpact: number;
  scheduleImpactDays: number;
  status: ChangeEventStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDelayEvent {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  cause: DelayCause;
  ownerName: string | null;
  startDate: string;
  endDate: string | null;
  forecastDelayDays: number;
  excusable: boolean;
  compensable: boolean;
  status: DelayStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskIntelligence {
  totalRisks: number;
  openRisks: number;
  highExposureRisks: number;
  overdueMitigations: number;
  maximumResidualExposure: number;
  averageResidualExposure: number;
  openIssues: number;
  criticalOpenIssues: number;
  overdueIssues: number;
  pendingChanges: number;
  approvedChanges: number;
  approvedChangeCostImpact: number;
  approvedChangeScheduleImpactDays: number;
  activeDelays: number;
  forecastDelayDays: number;
  riskScore: number;
  riskLevel: RiskIntelligenceLevel;
  explanation: string;
}

export interface RiskControl {
  project: Project;
  intelligence: RiskIntelligence;
  risks: ProjectRisk[];
  issues: ProjectIssue[];
  changes: ProjectChangeEvent[];
  delays: ProjectDelayEvent[];
}

export interface CreateRiskInput {
  reference: string;
  title: string;
  description: string;
  category: RiskCategory;
  ownerName: string;
  probability: number;
  impact: number;
  residualProbability: number;
  residualImpact: number;
  mitigationPlan: string;
  mitigationDueDate: string;
}

export interface UpdateRiskInput {
  version: number;
  title: string;
  description: string;
  category: RiskCategory;
  ownerName: string;
  probability: number;
  impact: number;
  residualProbability: number;
  residualImpact: number;
  mitigationPlan: string;
  mitigationDueDate: string;
  status: RiskStatus;
}

export interface CreateIssueInput {
  sourceRiskId: string | null;
  reference: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  ownerName: string;
  targetResolutionDate: string;
}

export interface UpdateIssueInput {
  version: number;
  sourceRiskId: string | null;
  title: string;
  description: string;
  severity: IssueSeverity;
  ownerName: string;
  targetResolutionDate: string;
  status: IssueStatus;
}

export interface CreateChangeEventInput {
  reference: string;
  title: string;
  description: string;
  originator: string;
  requestedDate: string;
  costImpact: number;
  scheduleImpactDays: number;
}

export interface UpdateChangeEventInput {
  version: number;
  title: string;
  description: string;
  originator: string;
  requestedDate: string;
  decisionDate: string | null;
  costImpact: number;
  scheduleImpactDays: number;
  status: ChangeEventStatus;
}

export interface CreateDelayEventInput {
  reference: string;
  title: string;
  description: string;
  cause: DelayCause;
  ownerName: string;
  startDate: string;
  forecastDelayDays: number;
  excusable: boolean;
  compensable: boolean;
}

export interface UpdateDelayEventInput {
  version: number;
  title: string;
  description: string;
  cause: DelayCause;
  ownerName: string;
  startDate: string;
  endDate: string | null;
  forecastDelayDays: number;
  excusable: boolean;
  compensable: boolean;
  status: DelayStatus;
}

export type WorkPackageStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";

export type SiteReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED";

export type WeatherCondition =
  | "CLEAR"
  | "CLOUDY"
  | "RAIN"
  | "WIND"
  | "EXTREME_HEAT"
  | "EXTREME_COLD"
  | "OTHER";

export type ProductionRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface WorkPackage {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  plannedQuantity: number;
  plannedLaborHours: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  status: WorkPackageStatus;
  blockReason: string | null;
  actualQuantity: number;
  completionPercentage: number;
  expectedProgressPercentage: number;
  expectedQuantity: number;
  quantityVariance: number;
  actualLaborHours: number;
  actualEquipmentHours: number;
  plannedProductivityRate: number;
  actualProductivityRate: number;
  productivityIndex: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiteReport {
  id: string;
  projectId: string;
  reference: string;
  reportDate: string;
  weatherCondition: WeatherCondition;
  generalNotes: string | null;
  status: SiteReportStatus;
  entryCount: number;
  totalLaborHours: number;
  totalEquipmentHours: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionEntry {
  id: string;
  siteReportId: string;
  siteReportReference: string;
  reportDate: string;
  workPackageId: string;
  workPackageCode: string;
  workPackageName: string;
  unit: string;
  quantityCompleted: number;
  laborHours: number;
  equipmentHours: number;
  crewSize: number;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionIntelligence {
  totalPackages: number;
  activePackages: number;
  blockedPackages: number;
  completedPackages: number;
  totalSiteReports: number;
  acceptedSiteReports: number;
  approvedSiteReports: number;
  latestAcceptedReportDate: string | null;
  reportingStale: boolean;
  averagePackageCompletionPercentage: number;
  averageExpectedProgressPercentage: number;
  productionVariancePoints: number;
  totalLaborHours: number;
  totalEquipmentHours: number;
  overallProductivityIndex: number;
  weeklyProductionTrendPercentage: number;
  productionScore: number;
  productionRisk: ProductionRiskLevel;
  explanation: string;
}

export interface ProductionControl {
  project: Project;
  intelligence: ProductionIntelligence;
  workPackages: WorkPackage[];
  siteReports: SiteReport[];
  productionEntries: ProductionEntry[];
}

export interface CreateWorkPackageInput {
  code: string;
  name: string;
  description: string;
  unit: string;
  plannedQuantity: number;
  plannedLaborHours: number;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface UpdateWorkPackageInput {
  version: number;
  name: string;
  description: string;
  unit: string;
  plannedQuantity: number;
  plannedLaborHours: number;
  plannedStartDate: string;
  plannedEndDate: string;
  status: WorkPackageStatus;
  blockReason: string;
}

export interface CreateSiteReportInput {
  reference: string;
  reportDate: string;
  weatherCondition: WeatherCondition;
  generalNotes: string;
}

export interface UpdateSiteReportInput {
  version: number;
  reportDate: string;
  weatherCondition: WeatherCondition;
  generalNotes: string;
  status: SiteReportStatus;
}

export interface CreateProductionEntryInput {
  workPackageId: string;
  quantityCompleted: number;
  laborHours: number;
  equipmentHours: number;
  crewSize: number;
  notes: string;
}

export interface UpdateProductionEntryInput {
  version: number;
  quantityCompleted: number;
  laborHours: number;
  equipmentHours: number;
  crewSize: number;
  notes: string;
}

export type DocumentType =
  | "DRAWING"
  | "SPECIFICATION"
  | "REPORT"
  | "CONTRACT"
  | "PROCEDURE"
  | "SCHEDULE"
  | "OTHER";

export type DocumentDiscipline =
  | "ARCHITECTURAL"
  | "STRUCTURAL"
  | "CIVIL"
  | "MEP"
  | "COMMERCIAL"
  | "PLANNING"
  | "HSE"
  | "QUALITY"
  | "GENERAL";

export type DocumentRevisionStatus =
  | "DRAFT"
  | "FOR_REVIEW"
  | "ISSUED"
  | "APPROVED"
  | "SUPERSEDED";

export type RfiPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RfiStatus =
  | "OPEN"
  | "ANSWERED"
  | "CLOSED"
  | "VOID";

export type TransmittalStatus =
  | "DRAFT"
  | "ISSUED";

export type InformationRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface ProjectDocument {
  id: string;
  projectId: string;
  documentNumber: string;
  title: string;
  documentType: DocumentType;
  discipline: DocumentDiscipline;
  ownerName: string | null;
  revisionCount: number;
  latestRevisionCode: string | null;
  latestRevisionStatus: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRevision {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  revisionCode: string;
  revisionStatus: DocumentRevisionStatus;
  issuedDate: string;
  fileName: string;
  contentType: string | null;
  fileSize: number;
  sha256: string;
  extractedCharacterCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRfi {
  id: string;
  projectId: string;
  reference: string;
  subject: string;
  question: string;
  response: string | null;
  raisedBy: string | null;
  assignedTo: string | null;
  raisedDate: string;
  dueDate: string;
  respondedDate: string | null;
  priority: RfiPriority;
  status: RfiStatus;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTransmittal {
  id: string;
  projectId: string;
  reference: string;
  recipient: string;
  purpose: string;
  transmittalDate: string;
  issuedDate: string | null;
  notes: string | null;
  status: TransmittalStatus;
  revisionIds: string[];
  revisionReferences: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSearchResult {
  resultType: "DOCUMENT" | "RFI";
  entityId: string;
  parentId: string;
  reference: string;
  title: string;
  snippet: string;
  score: number;
}

export interface DocumentIntelligence {
  totalDocuments: number;
  totalRevisions: number;
  drawingDocuments: number;
  extractedTextRevisions: number;
  openRfis: number;
  overdueRfis: number;
  criticalOpenRfis: number;
  draftTransmittals: number;
  staleDraftTransmittals: number;
  issuedTransmittals: number;
  informationScore: number;
  informationRisk: InformationRiskLevel;
  explanation: string;
}

export interface DocumentControl {
  project: Project;
  intelligence: DocumentIntelligence;
  documents: ProjectDocument[];
  revisions: DocumentRevision[];
  rfis: ProjectRfi[];
  transmittals: ProjectTransmittal[];
}

export interface CreateDocumentInput {
  documentNumber: string;
  title: string;
  documentType: DocumentType;
  discipline: DocumentDiscipline;
  ownerName: string;
}

export interface CreateRfiInput {
  reference: string;
  subject: string;
  question: string;
  raisedBy: string;
  assignedTo: string;
  raisedDate: string;
  dueDate: string;
  priority: RfiPriority;
}

export interface UpdateRfiInput {
  version: number;
  subject: string;
  question: string;
  response: string;
  assignedTo: string;
  dueDate: string;
  priority: RfiPriority;
  status: RfiStatus;
}

export interface CreateTransmittalInput {
  reference: string;
  recipient: string;
  purpose: string;
  transmittalDate: string;
  notes: string;
  revisionIds: string[];
}

export type AiSourceType =
  | "PROJECT_FACT"
  | "DOCUMENT_REVISION"
  | "RFI";

export interface AiStatus {
  ollamaReachable: boolean;
  chatModel: string;
  chatModelAvailable: boolean;
  embeddingModel: string;
  embeddingModelAvailable: boolean;
  embeddingDimensions: number;
  indexedChunks: number;
  lastIndexedAt: string | null;
  ready: boolean;
  message: string;
}

export interface AiIndexResult {
  indexedSources: number;
  indexedChunks: number;
  embeddingModel: string;
  embeddingDimensions: number;
  indexedAt: string;
}

export interface AiSourceCitation {
  citation: string;
  sourceType: AiSourceType;
  sourceId: string;
  sourceParentId: string | null;
  reference: string;
  title: string;
  snippet: string;
  similarity: number;
}

export interface AiAnswer {
  interactionId: string;
  question: string;
  answer: string;
  grounded: boolean;
  chatModel: string;
  embeddingModel: string;
  sources: AiSourceCitation[];
  createdAt: string;
}

export interface AiHistoryItem {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  sourceCount: number;
  createdAt: string;
}

export type PortfolioExceptionSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM";

export type PortfolioExceptionDomain =
  | "OVERALL"
  | "SCHEDULE"
  | "COST"
  | "PROCUREMENT"
  | "RISK"
  | "PRODUCTION"
  | "INFORMATION";

export type SupplierConcentrationRisk =
  | "LOW"
  | "MODERATE"
  | "HIGH";

export interface PortfolioProjectSnapshot {
  projectId: string;
  code: string;
  name: string;
  clientName: string;
  location: string;
  status: ProjectStatus;
  healthScore: number;
  healthBand: ProjectHealthBand;
  scheduleVarianceDays: number;
  approvedBudget: number;
  revisedCostPlan: number;
  forecastAtCompletion: number;
  actualCosts: number;
  outstandingCommitments: number;
  varianceAtCompletion: number;
  costScore: number;
  delayedProcurementPackages: number;
  procurementScore: number;
  highExposureRisks: number;
  criticalOpenIssues: number;
  forecastDelayDays: number;
  riskScore: number;
  blockedWorkPackages: number;
  productionScore: number;
  productivityIndex: number;
  overdueRfis: number;
  criticalOpenRfis: number;
  informationScore: number;
  attentionScore: number;
  healthRank: number;
}

export interface PortfolioSummary {
  totalProjects: number;
  planningProjects: number;
  activeProjects: number;
  onHoldProjects: number;
  completedProjects: number;
  healthyProjects: number;
  watchProjects: number;
  atRiskProjects: number;
  totalApprovedBudget: number;
  totalRevisedCostPlan: number;
  totalForecastAtCompletion: number;
  totalActualCosts: number;
  totalOutstandingCommitments: number;
  portfolioVarianceAtCompletion: number;
  weightedPortfolioHealthScore: number;
  portfolioHealthBand: ProjectHealthBand;
  delayedProcurementPackages: number;
  highExposureRisks: number;
  criticalOpenIssues: number;
  blockedWorkPackages: number;
  overdueRfis: number;
  totalExceptions: number;
}

export interface PortfolioBenchmarks {
  averageHealthScore: number;
  averageCostScore: number;
  averageProcurementScore: number;
  averageRiskScore: number;
  averageProductionScore: number;
  averageInformationScore: number;
  averageProductivityIndex: number;
  bestHealthProjectCode: string | null;
  worstHealthProjectCode: string | null;
}

export interface PortfolioException {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  severity: PortfolioExceptionSeverity;
  domain: PortfolioExceptionDomain;
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  route: string;
  priorityScore: number;
}

export interface SupplierConcentration {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierType: string;
  awardedPackages: number;
  awardedValue: number;
  portfolioAwardSharePercentage: number;
  concentrationRisk: SupplierConcentrationRisk;
}

export interface PortfolioExecutive {
  calculationDate: string;
  summary: PortfolioSummary;
  benchmarks: PortfolioBenchmarks;
  projects: PortfolioProjectSnapshot[];
  exceptions: PortfolioException[];
  supplierConcentration: SupplierConcentration[];
}

export interface PortfolioComparisonMetric {
  metric: string;
  projectValue: number;
  portfolioAverage: number;
  delta: number;
  unit: string;
  higherIsBetter: boolean;
  favorable: boolean;
}

export interface PortfolioProjectComparison {
  projectId: string;
  projectCode: string;
  projectName: string;
  healthRank: number;
  totalProjects: number;
  healthPercentile: number;
  metrics: PortfolioComparisonMetric[];
}

export interface PortfolioAiStatus {
  ollamaReachable: boolean;
  chatModel: string;
  chatModelAvailable: boolean;
  ready: boolean;
  message: string;
}

export interface PortfolioAiSource {
  citation: string;
  projectId: string | null;
  projectCode: string;
  projectName: string;
  evidence: string;
}

export interface PortfolioAiBrief {
  answer: string;
  grounded: boolean;
  chatModel: string;
  sources: PortfolioAiSource[];
  generatedAt: string;
}
