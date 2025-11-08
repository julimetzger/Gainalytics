export interface Task {
  id: string;
  title: string;
  priority: number;
  status: TaskStatus;
  estimate: string;
  owners: string[];
  components: string[];
  description: string;
  acceptanceCriteria: string[];
  constraints: string[];
  dependencies: string[];
  testPlan: string[];
}

type TaskStatus = 'ready' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';

interface TasksConfig {
  tasks: Task[];
}
