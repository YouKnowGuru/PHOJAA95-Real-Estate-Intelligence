export const WORKFLOW_STEPS = [
  { id: 1, label: "Property Info", description: "Enter property details and owner information" },
  { id: 2, label: "Buyer & Agreement", description: "Enter buyer details, commission and the total amount paid" },
  { id: 3, label: "Documents", description: "Upload the property agreement and all required documents at once" },
  { id: 4, label: "Verification", description: "Update lagthram and loan verification status" },
  { id: 5, label: "Completion", description: "Upload final documents for completion" },
] as const;

export const STEP_LABELS: Record<number, string> = {
  1: "Property Info",
  2: "Buyer & Agreement",
  3: "Documents",
  4: "Verification",
  5: "Completion",
};

export const STEP_BADGE_LABELS = [
  "Property Info",
  "Buyer & Agreement",
  "Documents",
  "Verification",
  "Final",
];

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
