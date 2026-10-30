"use strict";

/* ==========================================================================
   eGuardian Service Portal — client application
   Vanilla ES2021, no eval/Function, all dynamic HTML passes through escapeHTML.
   ========================================================================== */

const PORTAL_CONFIG = Object.freeze({
  repoUrl: "https://github.com/KVKMadithya/eguardian-service-portal",
  actionsUrl: "https://github.com/KVKMadithya/eguardian-service-portal/actions",
  liveUrl: "https://kvkmadithya.github.io/eguardian-service-portal/",
  slaThresholdDays: 7,
});

const TODAY = "2026-10-30";
const STORAGE_KEY = "eguardian_requests_v1";
const THEME_STORAGE_KEY = "eguardian_theme_v1"; // also read by theme-init.js before first paint
const THEMES = Object.freeze(["light", "dark"]);

const DEPARTMENTS = Object.freeze(["IT", "Facilities", "HR", "Finance", "Operations", "Security"]);
const REQUEST_TYPES = Object.freeze([
  "IT Access",
  "Hardware & Equipment",
  "Facilities & Maintenance",
  "Software License",
  "Cloud Infrastructure",
]);
const PRIORITIES = Object.freeze(["Low", "Medium", "High", "Critical"]);
const STATUSES = Object.freeze(["Submitted", "Under Review", "Approved", "Rejected", "Completed"]);
const OPEN_STATUSES = Object.freeze(["Submitted", "Under Review", "Approved"]);
const ROLES = Object.freeze(["Staff", "Manager", "Leadership"]);
const TABS = Object.freeze(["dashboard", "workflow", "dataset", "requirements", "security", "ai-log"]);

const VALID_TRANSITIONS = Object.freeze({
  Submitted: Object.freeze(["Under Review"]),
  "Under Review": Object.freeze(["Approved", "Rejected"]),
  Approved: Object.freeze(["Completed"]),
  Rejected: Object.freeze([]),
  Completed: Object.freeze([]),
});

const TRANSITION_LABELS = Object.freeze({
  "Under Review": "Move to Review",
  Approved: "Approve",
  Rejected: "Reject",
  Completed: "Mark Completed",
});

const ROLE_PERMISSIONS = Object.freeze({
  Staff: Object.freeze({ canSubmit: true, canTransition: false }),
  Manager: Object.freeze({ canSubmit: true, canTransition: true }),
  Leadership: Object.freeze({ canSubmit: false, canTransition: false }),
});

// What each role sees: home tab on switch, default queue scope, banner copy.
const ROLE_PROFILES = Object.freeze({
  Staff: Object.freeze({
    home: "workflow",
    scope: "mine",
    summary: "Submit service requests and track your own requests through approval.",
    toast: "showing your requests.",
    can: Object.freeze(["Submit new requests", "Track your requests & history", "View dashboard figures"]),
    cannot: Object.freeze(["Change request status"]),
  }),
  Manager: Object.freeze({
    home: "workflow",
    scope: "action",
    summary: "Review, approve or reject requests and confirm completion — every decision is audit-logged.",
    toast: "showing requests that need action.",
    can: Object.freeze(["Move requests through the approval path", "Add decision notes", "Submit on behalf of staff"]),
    cannot: Object.freeze([]),
  }),
  Leadership: Object.freeze({
    home: "dashboard",
    scope: "all",
    summary: "Read-only oversight of workload, approval speed and SLA breaches across departments.",
    toast: "read-only dashboard with SLA breaches.",
    can: Object.freeze(["Filter KPIs & charts", "Review SLA breaches by department", "Export data"]),
    cannot: Object.freeze(["Submit requests", "Change request status"]),
  }),
});
const QUEUE_SCOPES = Object.freeze(["mine", "action", "all"]);
const DEFAULT_STAFF_IDENTITY = "EMP-130";
const MONTH_ABBR = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);

const STATUS_COLORS = Object.freeze({
  Submitted: "#64748b",
  "Under Review": "#f59e0b",
  Approved: "#3b82f6",
  Rejected: "#ef4444",
  Completed: "#10b981",
});

const EMPLOYEE_ID_PATTERN = /^EMP-\d{3,5}$/;
const CSV_FORMULA_PATTERN = /^[=+\-@\t\r]/;

/* --------------------------------------------------------------------------
   Synthetic dataset — 36 anonymized records (EMP-101 … EMP-136)
   -------------------------------------------------------------------------- */

const INITIAL_REQUESTS = Object.freeze([
  {
    id: "REQ-1001",
    title: "VPN access for remote audit team",
    requesterId: "EMP-101",
    department: "IT",
    type: "IT Access",
    priority: "High",
    status: "Completed",
    createdAt: "2026-09-01",
    approvedAt: "2026-09-03",
    description: "External auditors need VPN connectivity to the audit file share for the Q3 review window.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-01T09:11:00Z", actor: "EMP-101", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-02T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-03T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-05T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1002",
    title: "Replace failing laptop battery",
    requesterId: "EMP-102",
    department: "Finance",
    type: "Hardware & Equipment",
    priority: "Medium",
    status: "Completed",
    createdAt: "2026-09-02",
    approvedAt: "2026-09-04",
    description: "Laptop battery drains within 40 minutes and the device shuts down during month-end reconciliations.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-02T09:12:00Z", actor: "EMP-102", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-03T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-04T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-06T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1003",
    title: "HVAC repair in server room annex",
    requesterId: "EMP-103",
    department: "Facilities",
    type: "Facilities & Maintenance",
    priority: "Critical",
    status: "Completed",
    createdAt: "2026-09-03",
    approvedAt: "2026-09-03",
    description: "Server room annex temperature exceeded 29C overnight; cooling unit compressor is failing.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-03T09:13:00Z", actor: "EMP-103", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-03T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-03T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-05T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1004",
    title: "Adobe Acrobat Pro license renewal",
    requesterId: "EMP-104",
    department: "HR",
    type: "Software License",
    priority: "Low",
    status: "Rejected",
    createdAt: "2026-09-04",
    approvedAt: null,
    description: "Renewal of Acrobat Pro for policy document editing; existing enterprise PDF tooling may cover this need.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-04T09:14:00Z", actor: "EMP-104", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-05T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Rejected", timestamp: "2026-09-07T15:00:00Z", actor: "Manager", note: "Rejected: existing tooling or budget does not support this request." },
    ],
  },
  {
    id: "REQ-1005",
    title: "Provision staging Kubernetes namespace",
    requesterId: "EMP-105",
    department: "IT",
    type: "Cloud Infrastructure",
    priority: "High",
    status: "Completed",
    createdAt: "2026-09-05",
    approvedAt: "2026-09-08",
    description: "Dedicated staging namespace with resource quotas is required for the service portal release pipeline.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-05T09:15:00Z", actor: "EMP-105", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-06T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-08T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-10T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1006",
    title: "Badge access to finance archive room",
    requesterId: "EMP-106",
    department: "Security",
    type: "IT Access",
    priority: "Medium",
    status: "Completed",
    createdAt: "2026-09-08",
    approvedAt: "2026-09-10",
    description: "Security officer requires badge access to the finance archive room for quarterly physical audits.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-08T09:16:00Z", actor: "EMP-106", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-09T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-10T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-12T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1007",
    title: "Dual monitor setup for payroll analyst",
    requesterId: "EMP-107",
    department: "HR",
    type: "Hardware & Equipment",
    priority: "Low",
    status: "Completed",
    createdAt: "2026-09-09",
    approvedAt: "2026-09-14",
    description: "Second monitor and adapter needed to compare payroll registers side by side during validation.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-09T09:17:00Z", actor: "EMP-107", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-10T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-14T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-16T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1008",
    title: "Leaking pipe in level 3 pantry",
    requesterId: "EMP-108",
    department: "Facilities",
    type: "Facilities & Maintenance",
    priority: "High",
    status: "Completed",
    createdAt: "2026-09-10",
    approvedAt: "2026-09-11",
    description: "Water leak under the level 3 pantry sink is spreading toward the adjacent electrical cabinet.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-10T09:18:00Z", actor: "EMP-108", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-11T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-11T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-13T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1009",
    title: "Tableau Creator license for reporting",
    requesterId: "EMP-109",
    department: "Finance",
    type: "Software License",
    priority: "Medium",
    status: "Rejected",
    createdAt: "2026-09-11",
    approvedAt: null,
    description: "Request for a Tableau Creator seat to build variance dashboards for the finance leadership pack.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-11T09:19:00Z", actor: "EMP-109", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-12T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Rejected", timestamp: "2026-09-14T15:00:00Z", actor: "Manager", note: "Rejected: existing tooling or budget does not support this request." },
    ],
  },
  {
    id: "REQ-1010",
    title: "Increase S3 bucket retention policy",
    requesterId: "EMP-110",
    department: "Operations",
    type: "Cloud Infrastructure",
    priority: "Medium",
    status: "Completed",
    createdAt: "2026-09-12",
    approvedAt: "2026-09-16",
    description: "Extend object retention on the operations logs bucket from 90 to 365 days to meet audit requirements.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-12T09:20:00Z", actor: "EMP-110", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-13T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-16T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-18T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1011",
    title: "SIEM read-only access for analyst",
    requesterId: "EMP-111",
    department: "Security",
    type: "IT Access",
    priority: "High",
    status: "Completed",
    createdAt: "2026-09-15",
    approvedAt: "2026-09-17",
    description: "Newly onboarded SOC analyst needs read-only SIEM access to triage alerts on the day shift.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-15T09:21:00Z", actor: "EMP-111", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-16T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-17T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-19T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1012",
    title: "Ergonomic chair replacement",
    requesterId: "EMP-112",
    department: "Operations",
    type: "Facilities & Maintenance",
    priority: "Low",
    status: "Approved",
    createdAt: "2026-09-16",
    approvedAt: "2026-09-24",
    description: "Current chair has a broken gas lift; replacement ergonomic chair recommended by the workplace assessment.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-16T09:22:00Z", actor: "EMP-112", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-17T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-24T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
    ],
  },
  {
    id: "REQ-1013",
    title: "Docking station for hybrid workstation",
    requesterId: "EMP-113",
    department: "IT",
    type: "Hardware & Equipment",
    priority: "Low",
    status: "Rejected",
    createdAt: "2026-09-17",
    approvedAt: null,
    description: "USB-C docking station requested for a hot desk used on in-office days.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-17T09:23:00Z", actor: "EMP-113", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-18T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Rejected", timestamp: "2026-09-20T15:00:00Z", actor: "Manager", note: "Rejected: existing tooling or budget does not support this request." },
    ],
  },
  {
    id: "REQ-1014",
    title: "JetBrains IDE licenses for dev team",
    requesterId: "EMP-114",
    department: "IT",
    type: "Software License",
    priority: "Medium",
    status: "Completed",
    createdAt: "2026-09-18",
    approvedAt: "2026-09-22",
    description: "Five JetBrains All Products licenses for the internal tools development squad.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-18T09:24:00Z", actor: "EMP-114", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-19T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-22T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-24T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1015",
    title: "Dedicated RDS instance for HR analytics",
    requesterId: "EMP-115",
    department: "HR",
    type: "Cloud Infrastructure",
    priority: "High",
    status: "Approved",
    createdAt: "2026-09-19",
    approvedAt: "2026-09-25",
    description: "Isolated PostgreSQL instance for anonymized workforce analytics, separate from the transactional HRIS database.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-19T09:25:00Z", actor: "EMP-115", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-20T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-25T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
    ],
  },
  {
    id: "REQ-1016",
    title: "Shared drive access for quarter-end close",
    requesterId: "EMP-116",
    department: "Finance",
    type: "IT Access",
    priority: "Critical",
    status: "Completed",
    createdAt: "2026-09-22",
    approvedAt: "2026-09-22",
    description: "Temporary write access to the quarter-end close shared drive for the consolidation team.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-22T09:26:00Z", actor: "EMP-116", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-22T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-22T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-24T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1017",
    title: "Replace faulty CCTV camera at loading dock",
    requesterId: "EMP-117",
    department: "Security",
    type: "Hardware & Equipment",
    priority: "High",
    status: "Completed",
    createdAt: "2026-09-23",
    approvedAt: "2026-09-24",
    description: "Loading dock camera feed drops intermittently, leaving a blind spot during deliveries.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-23T09:27:00Z", actor: "EMP-117", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-24T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-24T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-26T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1018",
    title: "Repaint meeting room 4B",
    requesterId: "EMP-118",
    department: "Facilities",
    type: "Facilities & Maintenance",
    priority: "Low",
    status: "Rejected",
    createdAt: "2026-09-24",
    approvedAt: null,
    description: "Walls in meeting room 4B are scuffed; cosmetic repaint requested ahead of client visits.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-24T09:28:00Z", actor: "EMP-118", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-25T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Rejected", timestamp: "2026-09-27T15:00:00Z", actor: "Manager", note: "Rejected: existing tooling or budget does not support this request." },
    ],
  },
  {
    id: "REQ-1019",
    title: "Microsoft Visio license for process mapping",
    requesterId: "EMP-119",
    department: "Operations",
    type: "Software License",
    priority: "Low",
    status: "Under Review",
    createdAt: "2026-09-25",
    approvedAt: null,
    description: "Visio license needed to document warehouse fulfilment processes for the lean improvement program.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-25T09:29:00Z", actor: "EMP-119", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-26T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
    ],
  },
  {
    id: "REQ-1020",
    title: "Auto-scaling group for customer portal",
    requesterId: "EMP-120",
    department: "IT",
    type: "Cloud Infrastructure",
    priority: "Critical",
    status: "Completed",
    createdAt: "2026-09-26",
    approvedAt: "2026-09-28",
    description: "Configure auto-scaling for the customer portal web tier ahead of the October billing cycle peak.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-26T09:30:00Z", actor: "EMP-120", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-27T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-09-28T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-09-30T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1021",
    title: "ERP approver role for new cost center",
    requesterId: "EMP-121",
    department: "Finance",
    type: "IT Access",
    priority: "Medium",
    status: "Under Review",
    createdAt: "2026-09-29",
    approvedAt: null,
    description: "Assign ERP purchase order approver role for the newly created logistics cost center.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-29T09:31:00Z", actor: "EMP-121", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-09-30T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
    ],
  },
  {
    id: "REQ-1022",
    title: "Rugged tablets for warehouse inventory",
    requesterId: "EMP-122",
    department: "Operations",
    type: "Hardware & Equipment",
    priority: "Medium",
    status: "Approved",
    createdAt: "2026-09-30",
    approvedAt: "2026-10-06",
    description: "Three rugged tablets with barcode scanners for cycle counting in the main warehouse.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-09-30T09:32:00Z", actor: "EMP-122", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-01T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-10-06T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
    ],
  },
  {
    id: "REQ-1023",
    title: "Emergency lighting inspection",
    requesterId: "EMP-123",
    department: "Facilities",
    type: "Facilities & Maintenance",
    priority: "High",
    status: "Completed",
    createdAt: "2026-10-01",
    approvedAt: "2026-10-02",
    description: "Annual emergency lighting inspection is due; two exit signs on level 2 are not illuminating.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-01T09:33:00Z", actor: "EMP-123", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-02T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-10-02T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-10-04T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1024",
    title: "Vulnerability scanner license expansion",
    requesterId: "EMP-124",
    department: "Security",
    type: "Software License",
    priority: "High",
    status: "Approved",
    createdAt: "2026-10-02",
    approvedAt: "2026-10-07",
    description: "Expand vulnerability scanner licensing from 500 to 800 assets to cover new cloud workloads.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-02T09:34:00Z", actor: "EMP-124", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-03T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-10-07T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
    ],
  },
  {
    id: "REQ-1025",
    title: "HRIS admin access for onboarding lead",
    requesterId: "EMP-125",
    department: "HR",
    type: "IT Access",
    priority: "Medium",
    status: "Submitted",
    createdAt: "2026-10-05",
    approvedAt: null,
    description: "Onboarding lead requires HRIS admin rights to configure new hire workflows and checklists.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-05T09:35:00Z", actor: "EMP-125", note: "Request submitted via service portal." },
    ],
  },
  {
    id: "REQ-1026",
    title: "Backup vault for finance data lake",
    requesterId: "EMP-126",
    department: "Finance",
    type: "Cloud Infrastructure",
    priority: "High",
    status: "Rejected",
    createdAt: "2026-10-06",
    approvedAt: null,
    description: "Separate cross-region backup vault requested for the finance data lake snapshots.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-06T09:36:00Z", actor: "EMP-126", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-07T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Rejected", timestamp: "2026-10-09T15:00:00Z", actor: "Manager", note: "Rejected: existing tooling or budget does not support this request." },
    ],
  },
  {
    id: "REQ-1027",
    title: "Replace broken desk phone",
    requesterId: "EMP-127",
    department: "Operations",
    type: "Hardware & Equipment",
    priority: "Low",
    status: "Completed",
    createdAt: "2026-10-07",
    approvedAt: "2026-10-09",
    description: "Desk phone handset is cracked and the speaker no longer works for the dispatch desk.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-07T09:37:00Z", actor: "EMP-127", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-08T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-10-09T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-10-11T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1028",
    title: "Access control panel firmware upgrade",
    requesterId: "EMP-128",
    department: "Security",
    type: "Facilities & Maintenance",
    priority: "Critical",
    status: "Under Review",
    createdAt: "2026-10-08",
    approvedAt: null,
    description: "Vendor advisory recommends urgent firmware upgrade on building access control panels.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-08T09:38:00Z", actor: "EMP-128", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-09T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
    ],
  },
  {
    id: "REQ-1029",
    title: "Zoom Webinar add-on for townhall",
    requesterId: "EMP-129",
    department: "HR",
    type: "Software License",
    priority: "Medium",
    status: "Completed",
    createdAt: "2026-10-09",
    approvedAt: "2026-10-13",
    description: "Webinar add-on required to host the quarterly all-hands townhall for more than 500 attendees.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-09T09:39:00Z", actor: "EMP-129", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-10T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-10-13T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
      { status: "Completed", timestamp: "2026-10-15T16:45:00Z", actor: "Manager", note: "Fulfilment confirmed with requester." },
    ],
  },
  {
    id: "REQ-1030",
    title: "Git repository access for contractor",
    requesterId: "EMP-130",
    department: "IT",
    type: "IT Access",
    priority: "Medium",
    status: "Submitted",
    createdAt: "2026-10-13",
    approvedAt: null,
    description: "Time-boxed read and write access to two repositories for a contracted integration developer.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-13T09:40:00Z", actor: "EMP-130", note: "Request submitted via service portal." },
    ],
  },
  {
    id: "REQ-1031",
    title: "Air purifier for open office zone",
    requesterId: "EMP-131",
    department: "Facilities",
    type: "Facilities & Maintenance",
    priority: "Low",
    status: "Submitted",
    createdAt: "2026-10-15",
    approvedAt: null,
    description: "Air quality sensor in the open office zone reports elevated particulate levels in the afternoons.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-15T09:41:00Z", actor: "EMP-131", note: "Request submitted via service portal." },
    ],
  },
  {
    id: "REQ-1032",
    title: "WAF rule set for public APIs",
    requesterId: "EMP-132",
    department: "Security",
    type: "Cloud Infrastructure",
    priority: "Critical",
    status: "Approved",
    createdAt: "2026-10-19",
    approvedAt: "2026-10-21",
    description: "Deploy managed WAF rule set in front of public APIs following a spike in injection attempts.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-19T09:42:00Z", actor: "EMP-132", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-20T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
      { status: "Approved", timestamp: "2026-10-21T14:30:00Z", actor: "Manager", note: "Business justification accepted." },
    ],
  },
  {
    id: "REQ-1033",
    title: "Laptop for new finance analyst",
    requesterId: "EMP-133",
    department: "Finance",
    type: "Hardware & Equipment",
    priority: "High",
    status: "Under Review",
    createdAt: "2026-10-22",
    approvedAt: null,
    description: "Standard finance build laptop required before the new analyst start date next month.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-22T09:43:00Z", actor: "EMP-133", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-23T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
    ],
  },
  {
    id: "REQ-1034",
    title: "Power BI Pro licenses for ops leads",
    requesterId: "EMP-134",
    department: "Operations",
    type: "Software License",
    priority: "Medium",
    status: "Submitted",
    createdAt: "2026-10-26",
    approvedAt: null,
    description: "Four Power BI Pro licenses so operations leads can publish shift performance reports.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-26T09:44:00Z", actor: "EMP-134", note: "Request submitted via service portal." },
    ],
  },
  {
    id: "REQ-1035",
    title: "Read-only prod DB access for incident review",
    requesterId: "EMP-135",
    department: "IT",
    type: "IT Access",
    priority: "High",
    status: "Under Review",
    createdAt: "2026-10-27",
    approvedAt: null,
    description: "Temporary read-only production database access to complete a post-incident root cause review.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-27T09:45:00Z", actor: "EMP-135", note: "Request submitted via service portal." },
      { status: "Under Review", timestamp: "2026-10-28T11:00:00Z", actor: "Manager", note: "Assigned for manager review." },
    ],
  },
  {
    id: "REQ-1036",
    title: "Increase EC2 quota for batch processing",
    requesterId: "EMP-136",
    department: "Operations",
    type: "Cloud Infrastructure",
    priority: "Medium",
    status: "Submitted",
    createdAt: "2026-10-28",
    approvedAt: null,
    description: "Raise the EC2 vCPU quota to support the nightly batch reconciliation jobs.",
    statusHistory: [
      { status: "Submitted", timestamp: "2026-10-28T09:46:00Z", actor: "EMP-136", note: "Request submitted via service portal." },
    ],
  },
]);

/* --------------------------------------------------------------------------
   Utilities
   -------------------------------------------------------------------------- */

const HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
});

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch]);
}

function byId(id) {
  return document.getElementById(id);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toUTCDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(fromIso, toIso) {
  return Math.round((toUTCDate(toIso) - toUTCDate(fromIso)) / 86400000);
}

function nowTimestamp() {
  return `${TODAY}T${new Date().toISOString().slice(11, 19)}Z`;
}

function formatTimestamp(ts) {
  return String(ts).replace("T", " ").replace("Z", " UTC");
}

function weekStart(isoDate) {
  const date = new Date(toUTCDate(isoDate));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(isoDate) {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTH_ABBR[m - 1]}`;
}

function isOpen(request) {
  return OPEN_STATUSES.includes(request.status);
}

function isOverdue(request) {
  return isOpen(request) && daysBetween(request.createdAt, TODAY) > PORTAL_CONFIG.slaThresholdDays;
}

function statusBadge(status) {
  const slug = String(status).toLowerCase().replace(/\s+/g, "-");
  return `<span class="badge badge-status badge-${escapeHTML(slug)}">${escapeHTML(status)}</span>`;
}

function priorityBadge(priority) {
  return `<span class="badge badge-priority badge-${escapeHTML(String(priority).toLowerCase())}">${escapeHTML(priority)}</span>`;
}

/* --------------------------------------------------------------------------
   State & persistence
   -------------------------------------------------------------------------- */

const state = {
  requests: [],
  role: "Staff",
  activeTab: "dashboard",
  selectedRequestId: null,
  staffIdentity: DEFAULT_STAFF_IDENTITY,
  queueScope: "mine",
  queueSearch: "",
  queueStatus: "",
  charts: { deptChart: null, trendChart: null, statusChart: null },
};

function isValidRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    STATUSES.includes(record.status) &&
    DEPARTMENTS.includes(record.department) &&
    REQUEST_TYPES.includes(record.type) &&
    PRIORITIES.includes(record.priority) &&
    typeof record.createdAt === "string" &&
    Array.isArray(record.statusHistory)
  );
}

function loadRequests() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidRecord)) {
        return parsed;
      }
    }
  } catch (_err) {
    // Storage unavailable or corrupted — fall back to the seed dataset.
  }
  return deepClone(INITIAL_REQUESTS);
}

function saveRequests() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.requests));
  } catch (_err) {
    showToast("Could not persist changes to local storage.", "warning");
  }
}

function resetDemoData() {
  state.requests = deepClone(INITIAL_REQUESTS);
  state.selectedRequestId = null;
  saveRequests();
  closeModal();
  renderAll();
  showToast(`Demo data restored (${INITIAL_REQUESTS.length} records).`, "success");
}

function findRequest(id) {
  return state.requests.find((r) => r.id === id) || null;
}

/* --------------------------------------------------------------------------
   Toast notifications
   -------------------------------------------------------------------------- */

function showToast(message, variant = "info") {
  let container = byId("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("toast-leave");
    window.setTimeout(() => toast.remove(), 250);
  }, 3500);
}

/* --------------------------------------------------------------------------
   Theme engine (light / dark)
   -------------------------------------------------------------------------- */

function cssVar(name, fallback) {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function storedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch (_err) {
    return null;
  }
}

function currentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyChartTheme() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.color = cssVar("--chart-text", "#64748b");
  Chart.defaults.borderColor = cssVar("--chart-grid", "rgba(148, 163, 184, 0.15)");
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.plugins.tooltip.backgroundColor = cssVar("--tooltip-bg", "#0f172a");
  Chart.defaults.plugins.tooltip.titleColor = cssVar("--tooltip-text", "#f8fafc");
  Chart.defaults.plugins.tooltip.bodyColor = cssVar("--tooltip-text", "#f8fafc");
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

function syncThemeToggle() {
  const toggle = byId("themeToggle");
  if (!toggle) return;
  const dark = currentTheme() === "dark";
  toggle.setAttribute("aria-pressed", dark ? "true" : "false");
  toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

function applyTheme(theme, persist) {
  if (!THEMES.includes(theme)) return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_err) {
      // Preference simply won't survive a reload; the theme still applies.
    }
  }
  syncThemeToggle();
  applyChartTheme();
  if (state.activeTab === "dashboard") renderDashboard();
}

function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
}

/* --------------------------------------------------------------------------
   Role switcher
   -------------------------------------------------------------------------- */

function permissions() {
  return ROLE_PERMISSIONS[state.role];
}

function setRole(role) {
  if (!ROLES.includes(role) || role === state.role) return;
  const profile = ROLE_PROFILES[role];
  state.role = role;
  state.queueScope = profile.scope;
  state.queueStatus = "";
  applyRoleUI();
  renderAll();
  if (state.selectedRequestId) renderModal();
  switchTab(profile.home);
  const banner = byId("roleBanner");
  if (banner) {
    banner.classList.remove("role-banner-enter");
    void banner.offsetWidth; // restart the entrance animation
    banner.classList.add("role-banner-enter");
  }
  showToast(`${role} View — ${profile.toast}`, "info");
}

function setStaffIdentity(id) {
  const value = String(id || "").toUpperCase();
  if (!EMPLOYEE_ID_PATTERN.test(value)) return;
  state.staffIdentity = value;
  applyRoleUI();
  renderAll();
}

function requesterIds() {
  const ids = new Set(state.requests.map((r) => r.requesterId));
  ids.add(state.staffIdentity);
  return Array.from(ids).sort();
}

function renderRoleBanner(profile) {
  const banner = byId("roleBanner");
  if (banner) banner.className = `card role-banner role-banner-${state.role.toLowerCase()}`;
  const icon = byId("roleBannerIcon");
  if (icon) icon.textContent = state.role.charAt(0);
  const title = byId("roleBannerTitle");
  if (title) {
    title.textContent = state.role === "Staff" ? `Staff View · acting as ${state.staffIdentity}` : `${state.role} View`;
  }
  const text = byId("roleBannerText");
  if (text) text.textContent = profile.summary;
  const perms = byId("roleBannerPerms");
  if (perms) {
    perms.innerHTML = [
      ...profile.can.map((p) => `<li class="perm-chip perm-yes">${escapeHTML(p)}</li>`),
      ...profile.cannot.map((p) => `<li class="perm-chip perm-no">${escapeHTML(p)}</li>`),
    ].join("");
  }
}

function applyRoleUI() {
  const perms = permissions();
  const profile = ROLE_PROFILES[state.role];
  const badge = byId("roleBadge");
  if (badge) {
    badge.textContent = state.role;
    badge.className = `badge badge-role badge-role-${state.role.toLowerCase()}`;
  }
  const switcher = byId("roleSwitcher");
  if (switcher && switcher.value !== state.role) switcher.value = state.role;

  // Generic visibility: any element with data-roles="Staff,Manager" shows only for those roles.
  document.querySelectorAll("[data-roles]").forEach((el) => {
    const roles = String(el.getAttribute("data-roles")).split(",").map((r) => r.trim());
    el.hidden = !roles.includes(state.role);
  });
  document.querySelectorAll("[data-requires-transition]").forEach((el) => {
    el.hidden = !perms.canTransition;
  });

  populateSelect("staffIdentity", requesterIds());
  const identity = byId("staffIdentity");
  if (identity) identity.value = state.staffIdentity;

  const form = byId("requestForm");
  if (form) {
    Array.from(form.elements).forEach((el) => {
      el.disabled = !perms.canSubmit;
    });
    const requester = form.elements.namedItem("requesterId");
    if (requester) {
      const isStaff = state.role === "Staff";
      requester.readOnly = isStaff;
      if (isStaff) requester.value = state.staffIdentity;
    }
  }
  const identityNote = byId("formIdentityNote");
  if (identityNote) {
    identityNote.textContent =
      state.role === "Staff"
        ? `Submitting as ${state.staffIdentity}. Change identity in the banner above.`
        : "Submitting on behalf of an employee — enter their EMP ID.";
  }

  renderRoleBanner(profile);
}

/* --------------------------------------------------------------------------
   Finite state machine
   -------------------------------------------------------------------------- */

function canTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

function transitionRequest(id, toStatus, note) {
  if (!permissions().canTransition) {
    showToast(`${state.role} role cannot change request status.`, "error");
    return false;
  }
  const request = findRequest(id);
  if (!request) {
    showToast(`Request ${id} not found.`, "error");
    return false;
  }
  if (!STATUSES.includes(toStatus) || !canTransition(request.status, toStatus)) {
    showToast(`Blocked: ${request.status} → ${toStatus} is not a valid transition.`, "error");
    return false;
  }
  const trimmedNote = String(note || "").trim().slice(0, 300);
  request.status = toStatus;
  if (toStatus === "Approved") request.approvedAt = TODAY;
  request.statusHistory.push({
    status: toStatus,
    timestamp: nowTimestamp(),
    actor: state.role,
    note: trimmedNote || `Moved to ${toStatus}.`,
  });
  saveRequests();
  renderAll();
  if (state.selectedRequestId === id) renderModal();
  showToast(`${id} moved to ${toStatus}.`, "success");
  return true;
}

/* --------------------------------------------------------------------------
   New request submission & validation
   -------------------------------------------------------------------------- */

const FORM_FIELDS = Object.freeze(["title", "requesterId", "department", "type", "priority", "description"]);

function validateRequestInput(input) {
  const errors = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const requesterId = input.requesterId.trim().toUpperCase();

  if (!title) errors.title = "Title is required.";
  else if (title.length < 5 || title.length > 100) errors.title = "Title must be 5 to 100 characters.";

  if (!requesterId) errors.requesterId = "Requester Employee ID is required.";
  else if (!EMPLOYEE_ID_PATTERN.test(requesterId)) errors.requesterId = "Use the format EMP-123 (3 to 5 digits).";

  if (!DEPARTMENTS.includes(input.department)) errors.department = "Select a valid department.";
  if (!REQUEST_TYPES.includes(input.type)) errors.type = "Select a valid request type.";
  if (!PRIORITIES.includes(input.priority)) errors.priority = "Select a valid priority.";

  if (!description) errors.description = "Description is required.";
  else if (description.length < 15 || description.length > 500) {
    errors.description = "Description must be 15 to 500 characters.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    clean: { title, requesterId, department: input.department, type: input.type, priority: input.priority, description },
  };
}

function showFieldErrors(form, errors) {
  FORM_FIELDS.forEach((field) => {
    const message = errors[field] || "";
    const errorEl = byId(`err-${field}`);
    if (errorEl) errorEl.textContent = message;
    const inputEl = form.elements.namedItem(field);
    if (inputEl) {
      inputEl.classList.toggle("is-invalid", Boolean(message));
      inputEl.setAttribute("aria-invalid", message ? "true" : "false");
    }
  });
}

function nextRequestId() {
  const max = state.requests.reduce((acc, r) => {
    const num = Number.parseInt(String(r.id).replace("REQ-", ""), 10);
    return Number.isFinite(num) && num > acc ? num : acc;
  }, 1000);
  return `REQ-${max + 1}`;
}

function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!permissions().canSubmit) {
    showToast(`${state.role} role cannot submit requests.`, "error");
    return;
  }
  const read = (name) => {
    const el = form.elements.namedItem(name);
    return el ? String(el.value) : "";
  };
  const result = validateRequestInput({
    title: read("title"),
    requesterId: read("requesterId"),
    department: read("department"),
    type: read("type"),
    priority: read("priority"),
    description: read("description"),
  });
  showFieldErrors(form, result.errors);
  if (!result.valid) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }
  const request = {
    id: nextRequestId(),
    ...result.clean,
    status: "Submitted",
    createdAt: TODAY,
    approvedAt: null,
    statusHistory: [
      {
        status: "Submitted",
        timestamp: nowTimestamp(),
        actor: result.clean.requesterId,
        note: "Request submitted via service portal.",
      },
    ],
  };
  state.requests.unshift(request);
  saveRequests();
  form.reset();
  applyRoleUI(); // re-fill the locked Staff Employee ID and refresh the identity list
  renderAll();
  showToast(`${request.id} submitted successfully.`, "success");
}

/* --------------------------------------------------------------------------
   Dashboard filters & KPIs
   -------------------------------------------------------------------------- */

function readFilters() {
  const val = (id) => {
    const el = byId(id);
    return el ? String(el.value) : "";
  };
  return {
    department: val("filterDepartment"),
    status: val("filterStatus"),
    priority: val("filterPriority"),
    dateFrom: val("filterFrom"),
    dateTo: val("filterTo"),
  };
}

function applyFilters(requests, filters) {
  return requests.filter((r) => {
    if (filters.department && r.department !== filters.department) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.priority && r.priority !== filters.priority) return false;
    if (filters.dateFrom && r.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && r.createdAt > filters.dateTo) return false;
    return true;
  });
}

function computeKPIs(requests) {
  const openCount = requests.filter(isOpen).length;

  const approvedSet = requests.filter(
    (r) => (r.status === "Approved" || r.status === "Completed") && r.approvedAt
  );
  const totalDays = approvedSet.reduce((sum, r) => sum + daysBetween(r.createdAt, r.approvedAt), 0);
  const avgDays = approvedSet.length > 0 ? totalDays / approvedSet.length : 0;

  const approvedOrCompleted = requests.filter((r) => r.status === "Approved" || r.status === "Completed").length;
  const rejected = requests.filter((r) => r.status === "Rejected").length;
  const decided = approvedOrCompleted + rejected;
  const approvalRate = decided > 0 ? (approvedOrCompleted / decided) * 100 : 0;

  const overdue = requests.filter(isOverdue).length;

  return {
    openRequests: openCount,
    avgDaysToApproval: avgDays.toFixed(1),
    approvalRate: `${approvalRate.toFixed(1)}%`,
    overdueRequests: overdue,
  };
}

function renderKPIs(requests) {
  const kpis = computeKPIs(requests);
  const set = (id, value) => {
    const el = byId(id);
    if (el) el.textContent = String(value);
  };
  set("kpiOpen", kpis.openRequests);
  set("kpiAvgApproval", kpis.avgDaysToApproval);
  set("kpiApprovalRate", kpis.approvalRate);
  set("kpiOverdue", kpis.overdueRequests);
  set("kpiRecordCount", `${requests.length} of ${state.requests.length} requests`);
}

/* --------------------------------------------------------------------------
   Chart.js engine
   -------------------------------------------------------------------------- */

function destroyChart(key) {
  const existing = state.charts[key];
  if (existing) {
    existing.destroy();
    state.charts[key] = null;
  }
}

function createChart(key, config) {
  destroyChart(key);
  const canvas = byId(key);
  if (!canvas || typeof Chart === "undefined") return;
  state.charts[key] = new Chart(canvas, config);
}

function renderCharts(requests) {
  const deptCounts = DEPARTMENTS.map((d) => requests.filter((r) => r.department === d).length);
  createChart("deptChart", {
    type: "bar",
    data: {
      labels: DEPARTMENTS.slice(),
      datasets: [
        {
          label: "Requests",
          data: deptCounts,
          backgroundColor: "rgba(99, 102, 241, 0.75)",
          hoverBackgroundColor: "#6366f1",
          borderRadius: 6,
          maxBarThickness: 44,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  const weekly = new Map();
  requests.forEach((r) => {
    const wk = weekStart(r.createdAt);
    weekly.set(wk, (weekly.get(wk) || 0) + 1);
  });
  const weeks = Array.from(weekly.keys()).sort();
  createChart("trendChart", {
    type: "line",
    data: {
      labels: weeks.map(formatWeekLabel),
      datasets: [
        {
          label: "Requests created",
          data: weeks.map((w) => weekly.get(w)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.14)",
          pointBackgroundColor: "#10b981",
          pointBorderColor: cssVar("--chart-surface", "#ffffff"),
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.35,
          cubicInterpolationMode: "monotone", // smooth curve that never dips below/above real values
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  createChart("statusChart", {
    type: "doughnut",
    data: {
      labels: STATUSES.slice(),
      datasets: [
        {
          data: STATUSES.map((s) => requests.filter((r) => r.status === s).length),
          backgroundColor: STATUSES.map((s) => STATUS_COLORS[s]),
          borderColor: cssVar("--chart-surface", "#ffffff"),
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14 } } },
    },
  });
}

function renderDashboard() {
  const filtered = applyFilters(state.requests, readFilters());
  renderKPIs(filtered);
  renderRolePanel(filtered);
  renderCharts(filtered);
}

/* --------------------------------------------------------------------------
   Role-specific dashboard panels
   -------------------------------------------------------------------------- */

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value);
}

function ageDays(request) {
  return daysBetween(request.createdAt, TODAY);
}

function lastUpdated(request) {
  const last = request.statusHistory[request.statusHistory.length - 1];
  return last ? String(last.timestamp).slice(0, 10) : request.createdAt;
}

function oldestFirst(a, b) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function overdueBadge(request) {
  return isOverdue(request) ? ' <span class="badge badge-overdue">Overdue</span>' : "";
}

function historyButton(id) {
  return `<button type="button" class="btn btn-sm btn-ghost" data-action="open-history" data-id="${escapeHTML(id)}">History</button>`;
}

function renderStaffPanel() {
  const mine = state.requests.filter((r) => r.requesterId === state.staffIdentity);
  setText("staffPanelSub", `Requests raised by ${state.staffIdentity} · personal view, not affected by filters`);
  setText("myOpen", mine.filter(isOpen).length);
  setText("myOverdue", mine.filter(isOverdue).length);
  setText("myClosed", mine.filter((r) => r.status === "Completed" || r.status === "Rejected").length);
  const tbody = byId("staffPanelBody");
  if (!tbody) return;
  if (mine.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No requests yet for ${escapeHTML(state.staffIdentity)}. Use “Submit a request”.</td></tr>`;
    return;
  }
  tbody.innerHTML = mine
    .map(
      (r) => `<tr class="${isOverdue(r) ? "row-overdue" : ""}">
        <td><code>${escapeHTML(r.id)}</code></td>
        <td>${escapeHTML(r.title)}</td>
        <td>${statusBadge(r.status)}${overdueBadge(r)}</td>
        <td class="mono">${escapeHTML(lastUpdated(r))}</td>
        <td class="actions-cell">${historyButton(r.id)}</td>
      </tr>`
    )
    .join("");
}

function renderManagerPanel(requests) {
  const open = requests.filter(isOpen).sort(oldestFirst);
  setText("mgrSubmitted", open.filter((r) => r.status === "Submitted").length);
  setText("mgrReview", open.filter((r) => r.status === "Under Review").length);
  setText("mgrApproved", open.filter((r) => r.status === "Approved").length);
  setText("managerPanelSub", `${open.length} open · ${open.filter(isOverdue).length} past SLA · oldest first`);
  const shown = open.slice(0, 8);
  setText("managerPanelMore", open.length > shown.length ? `+${open.length - shown.length} more in Workflow` : "");
  const tbody = byId("managerPanelBody");
  if (!tbody) return;
  if (shown.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nothing waiting — the queue is clear.</td></tr>';
    return;
  }
  tbody.innerHTML = shown
    .map(
      (r) => `<tr class="${isOverdue(r) ? "row-overdue" : ""}">
        <td><code>${escapeHTML(r.id)}</code></td>
        <td>${escapeHTML(r.title)}</td>
        <td>${escapeHTML(r.department)}</td>
        <td>${statusBadge(r.status)}${overdueBadge(r)}</td>
        <td class="mono">${escapeHTML(ageDays(r))}d</td>
        <td class="actions-cell">${VALID_TRANSITIONS[r.status].map((s) => transitionButton(r.id, s, "btn-sm")).join(" ")} ${historyButton(r.id)}</td>
      </tr>`
    )
    .join("");
}

function renderLeadershipPanel(requests) {
  const open = requests.filter(isOpen);
  const overdue = open.filter(isOverdue).sort(oldestFirst);
  setText(
    "leadershipSummary",
    `${overdue.length} of ${open.length} open requests breach the ${PORTAL_CONFIG.slaThresholdDays}-day SLA`
  );
  const deptBody = byId("leadershipDeptBody");
  if (deptBody) {
    deptBody.innerHTML = DEPARTMENTS.map((dept) => {
      const deptOpen = open.filter((r) => r.department === dept);
      const deptOverdue = deptOpen.filter(isOverdue).length;
      const rate = deptOpen.length > 0 ? (deptOverdue / deptOpen.length) * 100 : 0;
      const oldest = deptOpen.length > 0 ? Math.max(...deptOpen.map(ageDays)) : null;
      return `<tr>
        <td class="font-semibold">${escapeHTML(dept)}</td>
        <td>${escapeHTML(deptOpen.length)}</td>
        <td class="${deptOverdue > 0 ? "text-breach" : ""}">${escapeHTML(deptOverdue)}</td>
        <td class="${rate >= 50 ? "text-breach" : ""}">${escapeHTML(rate.toFixed(0))}%</td>
        <td class="mono">${oldest === null ? "—" : `${escapeHTML(oldest)}d`}</td>
      </tr>`;
    }).join("");
  }
  const overdueBody = byId("leadershipOverdueBody");
  if (!overdueBody) return;
  if (overdue.length === 0) {
    overdueBody.innerHTML = '<tr><td colspan="5" class="empty">No SLA breaches in the current filter.</td></tr>';
    return;
  }
  overdueBody.innerHTML = overdue
    .slice(0, 10)
    .map(
      (r) => `<tr>
        <td><code>${escapeHTML(r.id)}</code></td>
        <td>${escapeHTML(r.title)}</td>
        <td>${escapeHTML(r.department)}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="mono text-breach">${escapeHTML(ageDays(r))}d</td>
      </tr>`
    )
    .join("");
}

function renderRolePanel(filtered) {
  if (state.role === "Staff") renderStaffPanel();
  else if (state.role === "Manager") renderManagerPanel(filtered);
  else renderLeadershipPanel(filtered);
}

/* --------------------------------------------------------------------------
   Workflow table & dataset preview
   -------------------------------------------------------------------------- */

function transitionButton(id, toStatus, sizeClass) {
  const slug = toStatus.toLowerCase().replace(/\s+/g, "-");
  return `<button type="button" class="btn btn-transition btn-to-${escapeHTML(slug)} ${escapeHTML(sizeClass)}"
    data-action="transition" data-id="${escapeHTML(id)}" data-to="${escapeHTML(toStatus)}">${escapeHTML(
      TRANSITION_LABELS[toStatus] || toStatus
    )}</button>`;
}

// "mine" only makes sense for Staff and "action" only for Manager; anything else falls back to "all".
function effectiveScope() {
  if (state.queueScope === "mine" && state.role === "Staff") return "mine";
  if (state.queueScope === "action" && state.role === "Manager") return "action";
  return "all";
}

function filteredQueue() {
  const scope = effectiveScope();
  const term = state.queueSearch.trim().toLowerCase();
  const rows = state.requests.filter((r) => {
    if (scope === "mine" && r.requesterId !== state.staffIdentity) return false;
    if (scope === "action" && !isOpen(r)) return false;
    if (state.queueStatus && r.status !== state.queueStatus) return false;
    if (!term) return true;
    return [r.id, r.title, r.requesterId, r.department, r.type, r.priority, r.status].some((v) =>
      String(v).toLowerCase().includes(term)
    );
  });
  return scope === "action" ? rows.sort(oldestFirst) : rows;
}

function renderWorkflowTable() {
  const scope = effectiveScope();
  const togglePills = (action, attr, current) => {
    document.querySelectorAll(`[data-action="${action}"]`).forEach((pill) => {
      const active = (pill.getAttribute(attr) || "") === current;
      pill.classList.toggle("active", active);
      pill.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };
  togglePills("queue-status", "data-status", state.queueStatus);
  togglePills("queue-scope", "data-scope", scope);
  const tbody = byId("workflowTableBody");
  if (!tbody) return;
  const rows = filteredQueue();
  const scopeLabel = { mine: `raised by ${state.staffIdentity}`, action: "needing action, oldest first", all: "" }[scope];
  setText("queueCount", `Showing ${rows.length} of ${state.requests.length} requests ${scopeLabel}`.trim());
  if (rows.length === 0) {
    const message =
      scope === "mine" && !state.queueSearch && !state.queueStatus
        ? `No requests yet for ${state.staffIdentity}. Submit one with the form.`
        : "No requests match the current view.";
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${escapeHTML(message)}</td></tr>`;
    return;
  }
  const canAct = permissions().canTransition;
  tbody.innerHTML = rows
    .map((r) => {
      const overdue = isOverdue(r);
      const transitions = canAct ? VALID_TRANSITIONS[r.status].map((s) => transitionButton(r.id, s, "btn-sm")) : [];
      return `<tr class="${overdue ? "row-overdue" : ""}">
        <td><code>${escapeHTML(r.id)}</code></td>
        <td>${escapeHTML(r.title)}</td>
        <td>${escapeHTML(r.requesterId)}</td>
        <td>${escapeHTML(r.department)}</td>
        <td>${priorityBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}${overdue ? ' <span class="badge badge-overdue">Overdue</span>' : ""}</td>
        <td class="nowrap">${escapeHTML(r.createdAt)}</td>
        <td class="actions-cell">
          ${transitions.join(" ")}
          <button type="button" class="btn btn-sm btn-ghost" data-action="open-history" data-id="${escapeHTML(r.id)}">History</button>
        </td>
      </tr>`;
    })
    .join("");
}

function renderDatasetPreview() {
  const tbody = byId("datasetTableBody");
  if (tbody) {
    tbody.innerHTML = state.requests
      .map(
        (r) => `<tr>
        <td><code>${escapeHTML(r.id)}</code></td>
        <td>${escapeHTML(r.title)}</td>
        <td>${escapeHTML(r.requesterId)}</td>
        <td>${escapeHTML(r.department)}</td>
        <td>${escapeHTML(r.type)}</td>
        <td>${escapeHTML(r.priority)}</td>
        <td>${escapeHTML(r.status)}</td>
        <td class="nowrap">${escapeHTML(r.createdAt)}</td>
        <td>${escapeHTML(r.approvedAt || "—")}</td>
        <td>${escapeHTML(r.statusHistory.length)}</td>
      </tr>`
      )
      .join("");
  }
  const count = byId("datasetCount");
  if (count) count.textContent = `${state.requests.length} records`;
}

function renderAll() {
  renderDashboard();
  renderWorkflowTable();
  renderDatasetPreview();
}

/* --------------------------------------------------------------------------
   Status history modal
   -------------------------------------------------------------------------- */

function openModal(id) {
  if (!findRequest(id)) {
    showToast(`Request ${id} not found.`, "error");
    return;
  }
  state.selectedRequestId = id;
  renderModal();
  const modal = byId("historyModal");
  if (modal) {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    const note = byId("managerNote");
    if (note) note.value = "";
  }
}

function closeModal() {
  state.selectedRequestId = null;
  const modal = byId("historyModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
}

function renderModal() {
  const request = findRequest(state.selectedRequestId);
  if (!request) return;

  const title = byId("modalTitle");
  if (title) title.textContent = `${request.id} — ${request.title}`;

  const meta = byId("modalMeta");
  if (meta) {
    meta.innerHTML = `${statusBadge(request.status)} ${priorityBadge(request.priority)}
      <span>${escapeHTML(request.department)} · ${escapeHTML(request.type)} · ${escapeHTML(request.requesterId)}</span>
      <p>${escapeHTML(request.description)}</p>`;
  }

  const history = byId("modalHistory");
  if (history) {
    const entries = request.statusHistory
      .slice()
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    history.innerHTML = entries
      .map(
        (h) => `<li class="timeline-item">
          ${statusBadge(h.status)}
          <time datetime="${escapeHTML(h.timestamp)}">${escapeHTML(formatTimestamp(h.timestamp))}</time>
          <span class="timeline-actor">${escapeHTML(h.actor)}</span>
          <p class="timeline-note">${escapeHTML(h.note)}</p>
        </li>`
      )
      .join("");
  }

  const actions = byId("modalActions");
  if (actions) {
    const nextSteps = VALID_TRANSITIONS[request.status];
    if (nextSteps.length === 0) {
      actions.innerHTML = `<p class="muted">${escapeHTML(request.status)} is a terminal state — no further transitions.</p>`;
    } else if (!permissions().canTransition) {
      actions.innerHTML = `<p class="muted">Switch to the Manager role to move this request to ${escapeHTML(nextSteps.join(" or "))}.</p>`;
    } else {
      actions.innerHTML = nextSteps.map((s) => transitionButton(request.id, s, "")).join(" ");
    }
  }

  const noteWrap = byId("managerNoteWrap");
  if (noteWrap) noteWrap.hidden = !permissions().canTransition || VALID_TRANSITIONS[request.status].length === 0;
}

/* --------------------------------------------------------------------------
   Exporters & SQL copy
   -------------------------------------------------------------------------- */

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJSON() {
  downloadFile(`eguardian-requests-${TODAY}.json`, JSON.stringify(state.requests, null, 2), "application/json");
  showToast(`Exported ${state.requests.length} records as JSON.`, "success");
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (CSV_FORMULA_PATTERN.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCSV() {
  const headers = [
    "id",
    "title",
    "requesterId",
    "department",
    "type",
    "priority",
    "status",
    "createdAt",
    "approvedAt",
    "description",
    "statusHistory",
  ];
  const rows = state.requests.map((r) =>
    [
      r.id,
      r.title,
      r.requesterId,
      r.department,
      r.type,
      r.priority,
      r.status,
      r.createdAt,
      r.approvedAt,
      r.description,
      r.statusHistory.map((h) => `${h.timestamp} ${h.status} by ${h.actor}: ${h.note}`).join(" | "),
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = [headers.map(csvCell).join(","), ...rows].join("\r\n");
  downloadFile(`eguardian-requests-${TODAY}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
  showToast(`Exported ${state.requests.length} records as CSV.`, "success");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSQL() {
  const schema = `CREATE TABLE requests (
  id            VARCHAR(12)  PRIMARY KEY,
  title         VARCHAR(100) NOT NULL,
  requester_id  VARCHAR(10)  NOT NULL,
  department    VARCHAR(20)  NOT NULL,
  type          VARCHAR(40)  NOT NULL,
  priority      VARCHAR(10)  NOT NULL,
  status        VARCHAR(20)  NOT NULL,
  created_at    DATE         NOT NULL,
  approved_at   DATE,
  description   VARCHAR(500) NOT NULL
);`;
  const inserts = state.requests.map(
    (r) =>
      `INSERT INTO requests VALUES (${[
        r.id,
        r.title,
        r.requesterId,
        r.department,
        r.type,
        r.priority,
        r.status,
        r.createdAt,
        r.approvedAt,
        r.description,
      ]
        .map(sqlValue)
        .join(", ")});`
  );
  return [schema, "", ...inserts].join("\n");
}

async function copySQL(targetId) {
  const target = targetId ? byId(targetId) : null;
  const text = target ? target.textContent : buildSQL();
  try {
    await navigator.clipboard.writeText(text);
    showToast("SQL copied to clipboard.", "success");
  } catch (_err) {
    showToast("Clipboard unavailable — select the SQL and copy it manually.", "warning");
  }
}

/* --------------------------------------------------------------------------
   Tabs
   -------------------------------------------------------------------------- */

function switchTab(tab) {
  if (!TABS.includes(tab)) return;
  state.activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    const active = btn.getAttribute("data-tab") === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  TABS.forEach((name) => {
    const panel = byId(`section-${name}`);
    if (panel) panel.hidden = name !== tab;
  });
  if (window.location.hash !== `#${tab}`) {
    try {
      window.history.replaceState(null, "", `#${tab}`);
    } catch (_err) {
      // Some file:// contexts disallow history updates; tab switching still works.
    }
  }
  if (tab === "dashboard") renderDashboard();
}

function tabFromHash() {
  const hash = window.location.hash.replace("#", "");
  return TABS.includes(hash) ? hash : null;
}

/* --------------------------------------------------------------------------
   Wiring
   -------------------------------------------------------------------------- */

function populateSelect(id, options, placeholder) {
  const select = byId(id);
  if (!select) return;
  const current = select.value;
  const first = placeholder !== undefined ? `<option value="">${escapeHTML(placeholder)}</option>` : "";
  select.innerHTML =
    first + options.map((o) => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join("");
  if (current && options.includes(current)) select.value = current;
}

function applyConfigLinks() {
  const links = { repo: PORTAL_CONFIG.repoUrl, actions: PORTAL_CONFIG.actionsUrl, live: PORTAL_CONFIG.liveUrl };
  document.querySelectorAll("[data-link]").forEach((el) => {
    const href = links[el.getAttribute("data-link")];
    if (href) {
      el.setAttribute("href", href);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  });
  const sla = byId("slaThreshold");
  if (sla) sla.textContent = String(PORTAL_CONFIG.slaThresholdDays);
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target.closest("[data-action], [data-tab]") : null;
  if (!target) return;

  const tab = target.getAttribute("data-tab");
  if (tab && !target.hasAttribute("data-action")) {
    switchTab(tab);
    return;
  }

  const id = target.getAttribute("data-id");
  switch (target.getAttribute("data-action")) {
    case "open-history":
      if (id) openModal(id);
      break;
    case "close-modal":
      closeModal();
      break;
    case "toggle-theme":
      toggleTheme();
      break;
    case "transition": {
      const note = byId("managerNote");
      const useNote = note && state.selectedRequestId === id;
      if (id) transitionRequest(id, target.getAttribute("data-to"), useNote ? note.value : "");
      break;
    }
    case "queue-status": {
      const status = target.getAttribute("data-status") || "";
      state.queueStatus = STATUSES.includes(status) ? status : "";
      renderWorkflowTable();
      break;
    }
    case "queue-scope": {
      const scope = target.getAttribute("data-scope");
      state.queueScope = QUEUE_SCOPES.includes(scope) ? scope : "all";
      renderWorkflowTable();
      break;
    }
    case "goto-tab":
      switchTab(target.getAttribute("data-goto"));
      break;
    case "export-json":
      exportJSON();
      break;
    case "export-csv":
      exportCSV();
      break;
    case "copy-sql":
      copySQL(target.getAttribute("data-target"));
      break;
    case "reset-demo":
      if (window.confirm("Restore the original 36 demo records? Local changes will be lost.")) resetDemoData();
      break;
    case "reset-filters":
      ["filterDepartment", "filterStatus", "filterPriority", "filterFrom", "filterTo"].forEach((fid) => {
        const el = byId(fid);
        if (el) el.value = "";
      });
      renderDashboard();
      break;
    default:
      break;
  }
}

function init() {
  state.requests = loadRequests();

  populateSelect("filterDepartment", DEPARTMENTS, "All departments");
  populateSelect("filterStatus", STATUSES, "All statuses");
  populateSelect("filterPriority", PRIORITIES, "All priorities");
  populateSelect("department", DEPARTMENTS, "Select department");
  populateSelect("type", REQUEST_TYPES, "Select request type");
  populateSelect("priority", PRIORITIES, "Select priority");

  applyChartTheme();
  syncThemeToggle();
  if (typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
      if (!storedTheme()) applyTheme(event.matches ? "dark" : "light", false);
    });
  }

  applyConfigLinks();

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedRequestId) closeModal();
  });

  const roleSwitcher = byId("roleSwitcher");
  if (roleSwitcher) roleSwitcher.addEventListener("change", (e) => setRole(e.target.value));

  const staffIdentity = byId("staffIdentity");
  if (staffIdentity) staffIdentity.addEventListener("change", (e) => setStaffIdentity(e.target.value));

  const queueSearch = byId("queueSearch");
  if (queueSearch) {
    queueSearch.addEventListener("input", (e) => {
      state.queueSearch = String(e.target.value).slice(0, 100);
      renderWorkflowTable();
    });
  }

  ["filterDepartment", "filterStatus", "filterPriority", "filterFrom", "filterTo"].forEach((fid) => {
    const el = byId(fid);
    if (el) el.addEventListener("change", renderDashboard);
  });

  const form = byId("requestForm");
  if (form) form.addEventListener("submit", handleSubmit);

  const modal = byId("historyModal");
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  }

  window.addEventListener("hashchange", () => {
    const tab = tabFromHash();
    if (tab && tab !== state.activeTab) switchTab(tab);
  });

  applyRoleUI();
  state.activeTab = tabFromHash() || state.activeTab;
  renderAll();
  switchTab(state.activeTab);

  // Enable theme cross-fade transitions only after the first paint, so the initial load never animates.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
