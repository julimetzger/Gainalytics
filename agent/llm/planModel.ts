// types/plan.ts
export interface PlanStep {
  stepId: string;
  action: 'create' | 'modify' | 'delete';
  file: string;
  description: string;
  dependencies: string[];
}

export interface Plan {
  planId: string;
  taskId: string;
  title: string;
  description: string;
  steps: PlanStep[];
  estimatedFiles: number;
  complexity: 'low' | 'medium' | 'high';
}
