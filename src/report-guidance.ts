import type { RunResult, StepResult } from './result.js';

export interface ReportGuidance {
  title: string;
  check: string;
  dependencies: StepResult[];
  focus?: StepResult;
  runtime?: boolean;
}

function dependencies(result: RunResult, index: number): StepResult[] {
  const step = result.steps[index]!;
  if (step.status !== 'NOT_VERIFIED' || step.attempts !== 0) return [];
  const before = result.steps.slice(0, index);
  const expected =
    step.expected && typeof step.expected === 'object'
      ? (step.expected as Record<string, unknown>)
      : {};
  const previous = before
    .filter((candidate) => candidate.phase === step.phase)
    .at(-1);
  const ids = Array.isArray(expected.dependsOn)
    ? expected.dependsOn.filter((id): id is string => typeof id === 'string')
    : previous
      ? [previous.id]
      : [];
  return before.filter(
    (candidate) => ids.includes(candidate.id) && candidate.status !== 'PASS',
  );
}

export function stepGuidance(
  result: RunResult,
  index: number,
): ReportGuidance | undefined {
  const step = result.steps[index];
  if (!step || step.status === 'PASS') return undefined;
  const blockers = dependencies(result, index);
  const make = (title: string, check: string): ReportGuidance => ({
    title,
    check,
    dependencies: [],
  });
  if (
    step.attempts === 0 &&
    result.errors.length &&
    !result.steps.some((candidate) => candidate.attempts > 0)
  ) {
    return {
      ...make(
        'Restore the verification environment',
        'Review the recorded runtime observations and run doctor before attempting the workflow again.',
      ),
      runtime: true,
    };
  }
  if (blockers.length) {
    return {
      title: 'Inspect prerequisite observations',
      check:
        'This step was not executed because its prerequisite did not pass. Inspect that observation first, then restore the test state and rerun the original specification.',
      dependencies: blockers,
    };
  }
  if (step.phase === 'cleanup') {
    return make(
      'Inspect the cleanup result',
      'Review the cleanup observation and confirm the disposable test state has been restored before rerunning. Keep the workflow and cleanup results separate.',
    );
  }
  if (step.status === 'ERROR') {
    return make(
      'Inspect the runtime failure',
      'Review the recorded error for this action, its target and context. Run doctor to check setup; use the observation to decide which environment or application check to investigate next.',
    );
  }
  if (step.status === 'NOT_VERIFIED') {
    return make(
      'Provide observable evidence',
      'Review why the observation is missing. Supply an authorized, observable source or a supported assertion for the original requirement before treating the outcome as verified.',
    );
  }
  switch (step.type) {
    case 'api':
      return make(
        'Check the API evidence',
        'Compare the recorded HTTP status and any checked JSON field with the original expectation. Inspect the response and test data for this context; a successful UI message does not establish the API outcome.',
      );
    case 'response':
      return make(
        'Inspect the initiating request',
        'Review the response associated with the configured initiating action in this context. Compare its status with the expectation and inspect request timing in the recorded trace when available.',
      );
    case 'noErrors':
      return make(
        'Inspect browser error observations',
        'Review the recorded console and page errors and the application code involved. Fix or explain those observations before rerunning the unchanged browser-error assertion.',
      );
    case 'validation':
      return make(
        'Check the form validation state',
        'Inspect the selected form control, submitted test values and native validation state. Compare the recorded validity with the original requirement.',
      );
    default:
      return make(
        'Compare the recorded UI state',
        'Inspect the configured locator, context and expected state against the observation. Check the application behavior and test data before changing the acceptance criterion.',
      );
  }
}

export function runGuidance(result: RunResult): ReportGuidance | undefined {
  if (result.status === 'PASS') return undefined;
  if (result.errors.length) {
    return {
      title: 'Restore the verification environment',
      check:
        'Start with the recorded runtime observations. Use doctor to check setup, then inspect the reported error before rerunning the original specification.',
      dependencies: [],
      runtime: true,
    };
  }
  const focus = ['ERROR', 'FAIL', 'NOT_VERIFIED'].flatMap((status) =>
    result.steps.filter((step) => step.status === status),
  )[0];
  if (focus)
    return { ...stepGuidance(result, result.steps.indexOf(focus))!, focus };
  return {
    title: 'Collect the missing evidence',
    check:
      'Review the run details and declared assertions. Provide the observations needed to evaluate the original outcome, then run verification again.',
    dependencies: [],
  };
}
