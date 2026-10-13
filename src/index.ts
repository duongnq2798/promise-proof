export { verify } from './runner.js';
export {
  parseSpec,
  parseConfig,
  specSchema,
  configSchema,
  ConfigurationError,
} from './spec.js';
export { aggregate, exitCode } from './result.js';
export { renderReport } from './reporter.js';
export type { Spec, Step, Config } from './spec.js';
export type { RunResult, StepResult, Status } from './result.js';
