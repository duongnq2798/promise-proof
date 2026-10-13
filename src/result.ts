export type Status = 'PASS' | 'FAIL' | 'NOT_VERIFIED' | 'ERROR';
export interface StepResult {
  id: string;
  type: string;
  description: string;
  context: string;
  assertion: boolean;
  phase: 'workflow' | 'cleanup';
  status: Status;
  expected: unknown;
  observed: unknown;
  durationMs: number;
  startedAt: string;
  attempts: number;
  screenshot?: string;
}
export interface RunResult {
  schemaVersion: '1';
  runnerVersion: string;
  runId: string;
  specId: string;
  revision: number;
  specDigest: string;
  goal: string;
  baseUrl: string;
  environment: string;
  preconditions: string[];
  status: Status;
  startedAt: string;
  durationMs: number;
  steps: StepResult[];
  errors: string[];
  consoleErrors: Record<string, string[]>;
  network: { context: string; url: string; status: number; actionId: string }[];
  traces: string[];
  evidenceClasses: string[];
  summary: Record<Status, number>;
}
export function aggregate(statuses: Status[]): Status {
  if (statuses.includes('ERROR')) return 'ERROR';
  if (statuses.includes('FAIL')) return 'FAIL';
  if (!statuses.length || statuses.includes('NOT_VERIFIED'))
    return 'NOT_VERIFIED';
  return 'PASS';
}
export function exitCode(status: Status): number {
  return status === 'PASS' ? 0 : status === 'ERROR' ? 3 : 1;
}
