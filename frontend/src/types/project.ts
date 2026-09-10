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
  qualityRisk: QualityRiskLevel;
  safetyRisk: SafetyRiskLevel;
  commercialRisk: CommercialRiskLevel;
  resourceRisk: ResourceRiskLevel;
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
  qualityScore: number;
  safetyScore: number;
  commercialScore: number;
  resourceScore: number;
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
  | "INFORMATION"
  | "SAFETY"
  | "COMMERCIAL"
  | "RESOURCE";

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
  openSafetyIncidents: number;
  criticalSafetyIncidents: number;
  overdueSafetyActions: number;
  expiredWorkPermits: number;
  safetyScore: number;
  pendingChangeOrders: number;
  overdueChangeDecisions: number;
  openClaims: number;
  overdueClaimResponses: number;
  overdueCertifications: number;
  overduePayments: number;
  outstandingCertifiedAmount: number;
  forecastCashflowVariance: number;
  commercialScore: number;
  laborUtilizationPercentage: number;
  overtimePercentage: number;
  averageLaborProductivityIndex: number;
  lowProductivityWorkPackages: number;
  equipmentUtilizationPercentage: number;
  idleEquipment: number;
  workerDemandGap: number;
  equipmentDemandGap: number;
  resourceScore: number;
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
  openSafetyIncidents: number;
  criticalSafetyIncidents: number;
  overdueSafetyActions: number;
  expiredWorkPermits: number;
  pendingChangeOrders: number;
  overdueChangeDecisions: number;
  openClaims: number;
  overdueClaimResponses: number;
  overdueCertifications: number;
  overduePayments: number;
  outstandingCertifiedAmount: number;
  workerDemandGap: number;
  equipmentDemandGap: number;
  idleEquipment: number;
  lowProductivityWorkPackages: number;
  resourceAtRiskProjects: number;
  totalExceptions: number;
}

export interface PortfolioBenchmarks {
  averageHealthScore: number;
  averageCostScore: number;
  averageProcurementScore: number;
  averageRiskScore: number;
  averageProductionScore: number;
  averageInformationScore: number;
  averageCommercialScore: number;
  averageResourceScore: number;
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

export type QualityInspectionType =
  | "INTERNAL"
  | "CLIENT"
  | "CONSULTANT"
  | "REGULATORY"
  | "TEST";

export type QualityDiscipline =
  | "CIVIL"
  | "STRUCTURAL"
  | "ARCHITECTURAL"
  | "MEP"
  | "HSE"
  | "QUALITY"
  | "GENERAL";

export type QualityInspectionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type QualityInspectionResult =
  | "NOT_ASSESSED"
  | "PASS"
  | "PASS_WITH_OBSERVATIONS"
  | "FAIL";

export type NcrCategory =
  | "WORKMANSHIP"
  | "MATERIAL"
  | "DESIGN"
  | "INSTALLATION"
  | "DOCUMENTATION"
  | "TEST_FAILURE"
  | "OTHER";

export type NcrSeverity =
  | "MINOR"
  | "MAJOR"
  | "CRITICAL";

export type NcrStatus =
  | "OPEN"
  | "CORRECTIVE_ACTION_IN_PROGRESS"
  | "READY_FOR_VERIFICATION"
  | "CLOSED"
  | "VOID";

export type PunchPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type PunchStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "READY_FOR_INSPECTION"
  | "CLOSED"
  | "VOID";

export type HandoverCategory =
  | "OM_MANUAL"
  | "AS_BUILT"
  | "CERTIFICATE"
  | "WARRANTY"
  | "TEST_RECORD"
  | "TRAINING"
  | "OTHER";

export type HandoverStatus =
  | "NOT_STARTED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "NOT_REQUIRED";

export type QualityRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface QualityInspection {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  inspectionType: QualityInspectionType;
  discipline: QualityDiscipline;
  plannedDate: string;
  actualDate: string | null;
  inspectorName: string | null;
  status: QualityInspectionStatus;
  result: QualityInspectionResult;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNcr {
  id: string;
  projectId: string;
  inspectionId: string | null;
  inspectionReference: string | null;
  reference: string;
  title: string;
  description: string;
  category: NcrCategory;
  severity: NcrSeverity;
  raisedDate: string;
  dueDate: string;
  ownerName: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  verificationNotes: string | null;
  status: NcrStatus;
  closedDate: string | null;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PunchItem {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  location: string | null;
  trade: string | null;
  priority: PunchPriority;
  raisedDate: string;
  dueDate: string;
  ownerName: string | null;
  status: PunchStatus;
  closedDate: string | null;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverItem {
  id: string;
  projectId: string;
  code: string;
  title: string;
  category: HandoverCategory;
  ownerName: string | null;
  dueDate: string;
  receivedDate: string | null;
  approvedDate: string | null;
  status: HandoverStatus;
  notes: string | null;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface QualityIntelligence {
  totalInspections: number;
  completedInspections: number;
  passedInspections: number;
  failedInspections: number;
  inspectionPassRatePercentage: number;
  openNcrs: number;
  criticalOpenNcrs: number;
  overdueNcrs: number;
  recurringDefectCategories: number;
  openPunchItems: number;
  overduePunchItems: number;
  requiredHandoverItems: number;
  approvedHandoverItems: number;
  overdueHandoverItems: number;
  handoverReadinessPercentage: number;
  qualityScore: number;
  qualityRisk: QualityRiskLevel;
  explanation: string;
}

export interface QualityControl {
  project: Project;
  intelligence: QualityIntelligence;
  inspections: QualityInspection[];
  ncrs: ProjectNcr[];
  punchItems: PunchItem[];
  handoverItems: HandoverItem[];
}

export interface CreateQualityInspectionInput {
  reference: string;
  title: string;
  inspectionType: QualityInspectionType;
  discipline: QualityDiscipline;
  plannedDate: string;
  inspectorName: string;
  notes: string;
}

export interface UpdateQualityInspectionInput {
  version: number;
  title: string;
  inspectionType: QualityInspectionType;
  discipline: QualityDiscipline;
  plannedDate: string;
  actualDate: string | null;
  inspectorName: string;
  status: QualityInspectionStatus;
  result: QualityInspectionResult;
  notes: string;
}

export interface CreateNcrInput {
  inspectionId: string | null;
  reference: string;
  title: string;
  description: string;
  category: NcrCategory;
  severity: NcrSeverity;
  raisedDate: string;
  dueDate: string;
  ownerName: string;
}

export interface UpdateNcrInput {
  version: number;
  inspectionId: string | null;
  title: string;
  description: string;
  category: NcrCategory;
  severity: NcrSeverity;
  dueDate: string;
  ownerName: string;
  rootCause: string;
  correctiveAction: string;
  verificationNotes: string;
  status: NcrStatus;
}

export interface CreatePunchItemInput {
  reference: string;
  title: string;
  description: string;
  location: string;
  trade: string;
  priority: PunchPriority;
  raisedDate: string;
  dueDate: string;
  ownerName: string;
}

export interface UpdatePunchItemInput {
  version: number;
  title: string;
  description: string;
  location: string;
  trade: string;
  priority: PunchPriority;
  dueDate: string;
  ownerName: string;
  status: PunchStatus;
}

export interface CreateHandoverItemInput {
  code: string;
  title: string;
  category: HandoverCategory;
  ownerName: string;
  dueDate: string;
  notes: string;
}

export interface UpdateHandoverItemInput {
  version: number;
  title: string;
  category: HandoverCategory;
  ownerName: string;
  dueDate: string;
  status: HandoverStatus;
  notes: string;
}

export type SafetyIncidentType =
  | "NEAR_MISS"
  | "FIRST_AID"
  | "MEDICAL_TREATMENT"
  | "LOST_TIME_INJURY"
  | "PROPERTY_DAMAGE"
  | "ENVIRONMENTAL"
  | "OTHER";

export type SafetySeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type SafetyIncidentStatus =
  | "REPORTED"
  | "UNDER_INVESTIGATION"
  | "ACTION_IN_PROGRESS"
  | "CLOSED"
  | "VOID";

export type SafetyObservationType =
  | "SAFE_ACT"
  | "UNSAFE_ACT"
  | "UNSAFE_CONDITION"
  | "GOOD_PRACTICE";

export type HazardCategory =
  | "PPE"
  | "HOUSEKEEPING"
  | "WORK_AT_HEIGHT"
  | "ELECTRICAL"
  | "LIFTING"
  | "EXCAVATION"
  | "ACCESS_EGRESS"
  | "TOOLS_EQUIPMENT"
  | "FIRE"
  | "ENVIRONMENTAL"
  | "TRAFFIC"
  | "OTHER";

export type SafetyObservationStatus =
  | "OPEN"
  | "ACTION_IN_PROGRESS"
  | "CLOSED"
  | "VOID";

export type SafetyActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "READY_FOR_VERIFICATION"
  | "CLOSED"
  | "VOID";

export type WorkPermitType =
  | "HOT_WORK"
  | "WORK_AT_HEIGHT"
  | "CONFINED_SPACE"
  | "EXCAVATION"
  | "ELECTRICAL_ISOLATION"
  | "LIFTING"
  | "GENERAL";

export type WorkPermitStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "CLOSED"
  | "CANCELLED";

export type SafetyRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface SafetyIncident {
  id: string;
  projectId: string;
  reference: string;
  incidentType: SafetyIncidentType;
  severity: SafetySeverity;
  title: string;
  description: string;
  location: string | null;
  occurredDate: string;
  reportedDate: string;
  peopleAffected: number;
  lostTimeDays: number;
  immediateAction: string | null;
  rootCause: string | null;
  investigationNotes: string | null;
  status: SafetyIncidentStatus;
  closedDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyObservation {
  id: string;
  projectId: string;
  reference: string;
  observationType: SafetyObservationType;
  hazardCategory: HazardCategory;
  severity: SafetySeverity;
  title: string;
  description: string;
  location: string | null;
  observedDate: string;
  observerName: string | null;
  ownerName: string | null;
  dueDate: string | null;
  status: SafetyObservationStatus;
  closedDate: string | null;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyAction {
  id: string;
  projectId: string;
  incidentId: string | null;
  incidentReference: string | null;
  observationId: string | null;
  observationReference: string | null;
  reference: string;
  title: string;
  actionDescription: string;
  ownerName: string | null;
  dueDate: string;
  status: SafetyActionStatus;
  verificationNotes: string | null;
  closedDate: string | null;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkPermit {
  id: string;
  projectId: string;
  reference: string;
  permitType: WorkPermitType;
  title: string;
  location: string | null;
  issuerName: string | null;
  receiverName: string | null;
  validFrom: string;
  validUntil: string;
  controls: string | null;
  status: WorkPermitStatus;
  closedDate: string | null;
  expired: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyIntelligence {
  totalIncidents: number;
  openIncidents: number;
  recordableIncidents: number;
  lostTimeIncidents: number;
  criticalOpenIncidents: number;
  totalObservations: number;
  unsafeObservations: number;
  positiveObservations: number;
  openActions: number;
  overdueActions: number;
  activePermits: number;
  expiredPermits: number;
  recurringHazardCategories: number;
  daysSinceLastRecordableIncident: number | null;
  safetyScore: number;
  safetyRisk: SafetyRiskLevel;
  explanation: string;
}

export interface SafetyControl {
  project: Project;
  intelligence: SafetyIntelligence;
  incidents: SafetyIncident[];
  observations: SafetyObservation[];
  actions: SafetyAction[];
  permits: WorkPermit[];
}

export interface CreateSafetyIncidentInput {
  reference: string;
  incidentType: SafetyIncidentType;
  severity: SafetySeverity;
  title: string;
  description: string;
  location: string;
  occurredDate: string;
  reportedDate: string;
  peopleAffected: number;
  lostTimeDays: number;
  immediateAction: string;
}

export interface CreateSafetyObservationInput {
  reference: string;
  observationType: SafetyObservationType;
  hazardCategory: HazardCategory;
  severity: SafetySeverity;
  title: string;
  description: string;
  location: string;
  observedDate: string;
  observerName: string;
  ownerName: string;
  dueDate: string | null;
}

export interface CreateSafetyActionInput {
  incidentId: string | null;
  observationId: string | null;
  reference: string;
  title: string;
  actionDescription: string;
  ownerName: string;
  dueDate: string;
}

export interface CreateWorkPermitInput {
  reference: string;
  permitType: WorkPermitType;
  title: string;
  location: string;
  issuerName: string;
  receiverName: string;
  validFrom: string;
  validUntil: string;
  controls: string;
}

export type CommercialChangeOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "VOID";

export type CommercialClaimType =
  | "EXTENSION_OF_TIME"
  | "LOSS_AND_EXPENSE"
  | "VARIATION"
  | "DISRUPTION"
  | "DELAY"
  | "OTHER";

export type CommercialClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "PARTIALLY_APPROVED"
  | "APPROVED"
  | "REJECTED"
  | "SETTLED"
  | "VOID";

export type PaymentCertificateStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CERTIFIED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "REJECTED"
  | "VOID";

export type CashflowPeriodStatus =
  | "OPEN"
  | "CLOSED";

export type CommercialRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface CommercialChangeOrder {
  id: string;
  projectId: string;
  reference: string;
  sourceChangeReference: string | null;
  title: string;
  description: string;
  submittedAmount: number;
  assessedAmount: number | null;
  approvedAmount: number | null;
  submittedDate: string | null;
  decisionDueDate: string | null;
  decisionDate: string | null;
  status: CommercialChangeOrderStatus;
  overdueDecision: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialClaim {
  id: string;
  projectId: string;
  reference: string;
  claimType: CommercialClaimType;
  title: string;
  basis: string;
  claimedAmount: number;
  assessedAmount: number | null;
  awardedAmount: number | null;
  claimedDays: number;
  awardedDays: number;
  submittedDate: string | null;
  responseDueDate: string | null;
  decisionDate: string | null;
  status: CommercialClaimStatus;
  overdueResponse: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCertificate {
  id: string;
  projectId: string;
  reference: string;
  periodStart: string;
  periodEnd: string;
  applicationDate: string;
  certificationDueDate: string;
  applicationAmount: number;
  certifiedAmount: number | null;
  retentionAmount: number | null;
  netCertifiedAmount: number;
  certifiedDate: string | null;
  paymentDueDate: string | null;
  amountPaid: number;
  outstandingAmount: number;
  lastPaymentDate: string | null;
  status: PaymentCertificateStatus;
  overdueCertification: boolean;
  overduePayment: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CashflowPeriod {
  id: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  plannedInflow: number;
  forecastInflow: number;
  actualInflow: number;
  plannedOutflow: number;
  forecastOutflow: number;
  actualOutflow: number;
  plannedNetCashflow: number;
  forecastNetCashflow: number;
  actualNetCashflow: number;
  forecastVariance: number;
  status: CashflowPeriodStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialIntelligence {
  totalChangeOrders: number;
  pendingChangeOrders: number;
  overdueChangeDecisions: number;
  submittedChangeValue: number;
  approvedChangeValue: number;
  totalClaims: number;
  openClaims: number;
  overdueClaimResponses: number;
  claimedValue: number;
  awardedClaimValue: number;
  claimedDays: number;
  awardedDays: number;
  totalPaymentCertificates: number;
  awaitingCertification: number;
  overdueCertifications: number;
  certifiedValue: number;
  retentionHeld: number;
  amountPaid: number;
  outstandingCertifiedAmount: number;
  overduePayments: number;
  cashflowPeriods: number;
  plannedNetCashflow: number;
  forecastNetCashflow: number;
  actualNetCashflow: number;
  forecastCashflowVariance: number;
  commercialScore: number;
  commercialRisk: CommercialRiskLevel;
  explanation: string;
}

export interface CommercialControl {
  project: Project;
  intelligence: CommercialIntelligence;
  changeOrders: CommercialChangeOrder[];
  claims: CommercialClaim[];
  paymentCertificates: PaymentCertificate[];
  cashflowPeriods: CashflowPeriod[];
}

export interface CreateCommercialChangeOrderInput {
  reference: string;
  sourceChangeReference: string;
  title: string;
  description: string;
  submittedAmount: number;
}

export interface CreateCommercialClaimInput {
  reference: string;
  claimType: CommercialClaimType;
  title: string;
  basis: string;
  claimedAmount: number;
  claimedDays: number;
}

export interface CreatePaymentCertificateInput {
  reference: string;
  periodStart: string;
  periodEnd: string;
  applicationDate: string;
  certificationDueDate: string;
  applicationAmount: number;
}

export interface CreateCashflowPeriodInput {
  periodStart: string;
  periodEnd: string;
  plannedInflow: number;
  forecastInflow: number;
  actualInflow: number;
  plannedOutflow: number;
  forecastOutflow: number;
  actualOutflow: number;
}

export type WorkforcePlanStatus =
  | "DRAFT"
  | "APPROVED"
  | "CLOSED";

export type EquipmentOwnership =
  | "OWNED"
  | "RENTED"
  | "SUBCONTRACTOR";

export type EquipmentStatus =
  | "AVAILABLE"
  | "DEPLOYED"
  | "IDLE"
  | "MAINTENANCE"
  | "OFF_HIRE";

export type ResourceDemandType =
  | "LABOR"
  | "EQUIPMENT";

export type ResourceForecastStatus =
  | "OPEN"
  | "CLOSED";

export type ResourceRiskLevel =
  | "NO_DATA"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK";

export interface WorkforcePlan {
  id: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  trade: string;
  workPackageId: string | null;
  plannedWorkers: number;
  plannedRegularHours: number;
  plannedProductiveHours: number;
  plannedProductivityRate: number | null;
  status: WorkforcePlanStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkforceDeployment {
  id: string;
  projectId: string;
  workDate: string;
  trade: string;
  workPackageId: string | null;
  workers: number;
  regularHours: number;
  overtimeHours: number;
  totalLaborHours: number;
  productiveHours: number;
  quantityCompleted: number;
  plannedProductivityRate: number | null;
  actualProductivityRate: number;
  productivityIndex: number;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectEquipment {
  id: string;
  projectId: string;
  code: string;
  description: string;
  category: string;
  ownership: EquipmentOwnership;
  status: EquipmentStatus;
  dailyCost: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentUsage {
  id: string;
  projectId: string;
  equipmentId: string;
  equipmentCode: string;
  workPackageId: string | null;
  workDate: string;
  availableHours: number;
  operatingHours: number;
  idleHours: number;
  downtimeHours: number;
  utilizationPercentage: number;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceForecast {
  id: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  resourceType: ResourceDemandType;
  resourceKey: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortage: number;
  notes: string | null;
  status: ResourceForecastStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceIntelligence {
  workforcePlans: number;
  workforceDeployments: number;
  plannedLaborHours: number;
  actualLaborHours: number;
  productiveLaborHours: number;
  overtimeHours: number;
  overtimePercentage: number;
  laborUtilizationPercentage: number;
  averageProductivityIndex: number;
  lowProductivityWorkPackages: number;
  equipmentCount: number;
  idleEquipment: number;
  equipmentAvailableHours: number;
  equipmentOperatingHours: number;
  equipmentDowntimeHours: number;
  equipmentUtilizationPercentage: number;
  openResourceForecasts: number;
  workerDemandGap: number;
  equipmentDemandGap: number;
  resourceScore: number;
  resourceRisk: ResourceRiskLevel;
  explanation: string;
}

export interface ResourceControl {
  project: Project;
  intelligence: ResourceIntelligence;
  workforcePlans: WorkforcePlan[];
  deployments: WorkforceDeployment[];
  equipment: ProjectEquipment[];
  equipmentUsage: EquipmentUsage[];
  forecasts: ResourceForecast[];
}

export interface CreateWorkforcePlanInput {
  periodStart: string;
  periodEnd: string;
  trade: string;
  workPackageId: string | null;
  plannedWorkers: number;
  plannedRegularHours: number;
  plannedProductiveHours: number;
  plannedProductivityRate: number | null;
}

export interface CreateWorkforceDeploymentInput {
  workDate: string;
  trade: string;
  workPackageId: string | null;
  workers: number;
  regularHours: number;
  overtimeHours: number;
  productiveHours: number;
  quantityCompleted: number;
  plannedProductivityRate: number | null;
  notes: string;
}

export interface CreateEquipmentInput {
  code: string;
  description: string;
  category: string;
  ownership: EquipmentOwnership;
  dailyCost: number;
}

export interface CreateEquipmentUsageInput {
  equipmentId: string;
  workPackageId: string | null;
  workDate: string;
  availableHours: number;
  operatingHours: number;
  idleHours: number;
  downtimeHours: number;
  notes: string;
}

export interface CreateResourceForecastInput {
  periodStart: string;
  periodEnd: string;
  resourceType: ResourceDemandType;
  resourceKey: string;
  requiredQuantity: number;
  availableQuantity: number;
  notes: string;
}

export type ScheduleBaselineStatus =
  | "DRAFT"
  | "APPROVED"
  | "SUPERSEDED";

export type ScheduleActivityStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED";

export type ScheduleDependencyType =
  | "FS"
  | "SS"
  | "FF"
  | "SF";

export type ScheduleConstraintType =
  | "DESIGN_INFORMATION"
  | "MATERIAL"
  | "ACCESS"
  | "LABOR"
  | "EQUIPMENT"
  | "APPROVAL"
  | "PERMIT"
  | "PREDECESSOR"
  | "OTHER";

export type ScheduleConstraintStatus =
  | "OPEN"
  | "RESOLVED"
  | "WAIVED";

export interface ScheduleActivity {
  id: string;
  projectId: string;
  activityCode: string;
  name: string;
  discipline: string | null;
  workPackageId: string | null;
  currentStart: string;
  currentFinish: string;
  originalDurationDays: number;
  remainingDurationDays: number;
  actualStart: string | null;
  actualFinish: string | null;
  progressPercentage: number;
  status: ScheduleActivityStatus;
  earlyStartDay: number;
  earlyFinishDay: number;
  lateStartDay: number;
  lateFinishDay: number;
  totalFloatDays: number;
  critical: boolean;
  nearCritical: boolean;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleDependency {
  id: string;
  projectId: string;
  predecessorActivityId: string;
  predecessorCode: string;
  successorActivityId: string;
  successorCode: string;
  dependencyType: ScheduleDependencyType;
  lagDays: number;
  createdAt: string;
}

export interface ScheduleConstraint {
  id: string;
  projectId: string;
  activityId: string;
  activityCode: string;
  constraintType: ScheduleConstraintType;
  title: string;
  ownerName: string | null;
  dueDate: string;
  status: ScheduleConstraintStatus;
  resolutionNotes: string | null;
  resolvedDate: string | null;
  overdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleBaseline {
  id: string;
  projectId: string;
  name: string;
  dataDate: string;
  status: ScheduleBaselineStatus;
  approvedAt: string | null;
  activityCount: number;
  baselineFinishDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleIntelligence {
  dataDate: string;
  networkValid: boolean;
  networkError: string | null;
  activityCount: number;
  completedActivities: number;
  inProgressActivities: number;
  overdueActivities: number;
  criticalActivities: number;
  nearCriticalActivities: number;
  criticalPathLengthDays: number;
  averageTotalFloatDays: number;
  openConstraints: number;
  overdueConstraints: number;
  constrainedCriticalActivities: number;
  lookahead14DayActivities: number;
  lookahead28DayActivities: number;
  lookahead42DayActivities: number;
  approvedBaselineName: string | null;
  baselineFinishDate: string | null;
  cpmForecastFinishDate: string | null;
  baselineFinishVarianceDays: number;
  projectFinishVarianceDays: number;
  scheduleScore: number;
  scheduleRisk: ScheduleRiskLevel;
  criticalPathActivityCodes: string[];
  explanation: string;
}

export interface ScheduleLookaheadActivity {
  activityId: string;
  activityCode: string;
  name: string;
  discipline: string | null;
  currentStart: string;
  currentFinish: string;
  progressPercentage: number;
  totalFloatDays: number;
  critical: boolean;
  nearCritical: boolean;
  openConstraints: number;
  constrained: boolean;
}

export interface ScheduleLookahead {
  weeks: number;
  fromDate: string;
  toDate: string;
  activityCount: number;
  criticalActivities: number;
  constrainedActivities: number;
  activities: ScheduleLookaheadActivity[];
}

export interface ScheduleControl {
  project: Project;
  intelligence: ScheduleIntelligence;
  baselines: ScheduleBaseline[];
  activities: ScheduleActivity[];
  dependencies: ScheduleDependency[];
  constraints: ScheduleConstraint[];
}

export interface CreateScheduleActivityInput {
  activityCode: string;
  name: string;
  discipline: string;
  workPackageId: string | null;
  currentStart: string;
  currentFinish: string;
  originalDurationDays: number;
}

export interface CreateScheduleDependencyInput {
  predecessorActivityId: string;
  successorActivityId: string;
  dependencyType: ScheduleDependencyType;
  lagDays: number;
}

export interface CreateScheduleConstraintInput {
  activityId: string;
  constraintType: ScheduleConstraintType;
  title: string;
  ownerName: string;
  dueDate: string;
}
