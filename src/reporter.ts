import { readFileSync } from 'node:fs';
import { runGuidance, stepGuidance } from './report-guidance.js';
import type { RunResult, Status, StepResult } from './result.js';
import { icon, type ReportIcon } from './report-icons.js';
import { reportStyles } from './report-styles.js';

const font = readFileSync(
  new URL('../assets/geist-latin-variable.woff2', import.meta.url),
).toString('base64');
const labels: Record<Status, string> = {
  PASS: 'Passed',
  FAIL: 'Failed',
  NOT_VERIFIED: 'Not verified',
  ERROR: 'Errors',
};
const statusIcons: Record<Status, ReportIcon> = {
  PASS: 'check',
  FAIL: 'cross',
  NOT_VERIFIED: 'minus',
  ERROR: 'alert',
};

export function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
const e = escapeHtml;
const detail = (value: unknown) =>
  e(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const duration = (ms: number) =>
  ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(2) + ' s';
const badge = (status: Status) =>
  '<span class="badge ' +
  e(status) +
  '">' +
  e(status.replace('_', ' ')) +
  '</span>';
function artifact(file?: string): string | undefined {
  return file && /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|zip)$/.test(file)
    ? encodeURIComponent(file)
    : undefined;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function valueText(value: unknown): string {
  const input = record(value);
  if ('env' in input) return 'environment reference ' + String(input.env);
  if ('variable' in input)
    return 'captured reference ' + String(input.variable);
  return typeof value === 'string'
    ? '“' + value + '”'
    : (JSON.stringify(value) ?? 'not provided');
}
function expectedText(step: StepResult): string {
  const input = record(step.expected);
  switch (step.type) {
    case 'text':
      return 'Text equals ' + valueText(input.equals);
    case 'url':
      return 'URL equals ' + valueText(input.equals);
    case 'visible':
      return input.expected === false
        ? 'The element is hidden or absent.'
        : 'The element is visible.';
    case 'api': {
      const json = record(input.json);
      return (
        'HTTP ' +
        String(input.status) +
        (input.json
          ? ' · ' +
            String(json.path || 'response body') +
            ' equals ' +
            valueText(json.equals)
          : '')
      );
    }
    case 'response':
      return (
        'HTTP ' + String(input.status) + ' after action ' + String(input.after)
      );
    case 'noErrors':
      return 'No console errors or uncaught page errors observed up to this step.';
    case 'property':
      return String(input.property) + ' equals ' + valueText(input.equals);
    case 'validation':
      return 'Form validity equals ' + String(input.valid);
    case 'navigate':
      return 'Navigate to ' + valueText(input.url);
    case 'click':
      return 'The selected element can be clicked.';
    case 'fill':
      return 'The input accepts the configured value.';
    case 'select':
      return 'Select option ' + valueText(input.value);
    case 'check':
      return input.checked
        ? 'The control is checked.'
        : 'The control is unchecked.';
    case 'wait':
      return 'The element reaches state ' + String(input.state);
    case 'unverified':
      return 'Required evidence is available for this condition.';
    default:
      return step.description;
  }
}
function observedText(step: StepResult): string {
  if (typeof step.observed === 'string') {
    const clean = step.observed.replace(
      new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'),
      '',
    );
    return clean.length > 500
      ? (clean.split('\n').find((line) => line.trim()) ?? clean.slice(0, 500))
      : clean;
  }
  const observed = record(step.observed);
  if ('text' in observed) return valueText(observed.text);
  if ('path' in observed)
    return (
      String(observed.path || 'response body') +
      ' = ' +
      valueText(observed.value)
    );
  if ('url' in observed)
    return (
      String(observed.url) +
      ('status' in observed ? ' · HTTP ' + String(observed.status) : '')
    );
  if ('visible' in observed)
    return observed.visible
      ? 'The element is visible.'
      : 'The element is hidden or absent.';
  if (
    'errors' in observed &&
    Array.isArray(observed.errors) &&
    !observed.errors.length
  )
    return 'No browser errors observed.';
  return JSON.stringify(step.observed) ?? 'No observation recorded.';
}
function renderStep(
  step: StepResult,
  index: number,
  result: RunResult,
): string {
  const screenshot = artifact(step.screenshot);
  const expanded = step.status === 'FAIL' || step.status === 'ERROR';
  return (
    '<details class="step status-' +
    e(step.status) +
    '" id="step-' +
    e(step.id) +
    '" data-status="' +
    e(step.status) +
    '"' +
    (expanded ? ' open' : '') +
    '><summary>' +
    '<span class="step-marker">' +
    icon(statusIcons[step.status]) +
    '</span><div class="step-label"><h3>' +
    e(step.description) +
    '</h3><div class="step-meta"><span class="type-label">' +
    (step.assertion ? 'Assertion' : 'Action') +
    '</span><span>·</span><span>' +
    e(step.type) +
    '</span>' +
    (step.context !== 'default'
      ? '<span>·</span><span>' + e(step.context) + '</span>'
      : '') +
    (step.phase === 'cleanup' ? '<span>·</span><span>cleanup</span>' : '') +
    '<span>·</span><span class="step-id">' +
    String(index + 1).padStart(2, '0') +
    ' / ' +
    e(step.id) +
    '</span><span>·</span><span>' +
    e(labels[step.status]) +
    '</span></div></div><span class="step-duration">' +
    duration(step.durationMs) +
    '</span>' +
    icon('chevron').replace('<svg ', '<svg class="disclosure-arrow" ') +
    '</summary>' +
    '<div class="step-content"><div class="observation"><div><span class="observation-label">Expected</span><p>' +
    e(expectedText(step)) +
    '</p></div><div><span class="observation-label">Observed</span><p>' +
    e(observedText(step)) +
    '</p></div></div>' +
    renderStepGuidance(result, index) +
    '<details class="technical"><summary>' +
    icon('chevron') +
    'Technical details</summary><div class="technical-grid"><div><div class="eyebrow">Executed specification</div><pre>' +
    detail(step.expected) +
    '</pre></div><div><div class="eyebrow">Full observation</div><pre>' +
    detail(step.observed) +
    '</pre></div></div><p class="panel-note">' +
    step.attempts +
    ' execution attempt' +
    (step.attempts === 1 ? '' : 's') +
    ' · ' +
    e(step.startedAt) +
    '</p></details>' +
    (screenshot
      ? '<div class="step-links"><a class="text-link" href="' +
        screenshot +
        '">' +
        icon('image') +
        'Open captured evidence ' +
        icon('arrow') +
        '</a></div>'
      : '') +
    '</div></details>'
  );
}
function renderStepGuidance(result: RunResult, index: number): string {
  const guide = stepGuidance(result, index);
  if (!guide) return '';
  return (
    '<div class="step-guidance"><h4>Next check · ' +
    e(guide.title) +
    '</h4><p>' +
    e(guide.check) +
    '</p>' +
    guide.dependencies
      .map(
        (dependency) =>
          '<a class="text-link" href="#step-' +
          e(dependency.id) +
          '">Inspect prerequisite: ' +
          e(dependency.description) +
          ' ' +
          icon('arrow') +
          '</a>',
      )
      .join('') +
    (guide.runtime
      ? '<a class="text-link" href="#runtime-observations">Review runtime observations ' +
        icon('arrow') +
        '</a>'
      : '') +
    '</div>'
  );
}

function renderNextSteps(result: RunResult): string {
  const guide = runGuidance(result);
  if (!guide) return '';
  const href = guide.runtime
    ? '#runtime-observations'
    : guide.focus
      ? '#step-' + e(guide.focus.id)
      : '#run-details';
  const focusLabel = guide.runtime
    ? 'Runtime observations'
    : guide.focus
      ? guide.focus.description
      : 'Run details';
  const trace = result.traces.find(
    (name) => artifact(name) && name.endsWith('.zip'),
  );
  return (
    '<section class="next-steps" id="next-steps" aria-labelledby="next-steps-title"><div class="section-header"><h2 id="next-steps-title">Next steps</h2><span class="hint">Recommended checks</span></div><div class="guide-panel"><ol class="guide-actions">' +
    '<li><span class="guide-number">1</span><div><h3>Inspect the observation</h3><p>Start with the recorded evidence for this run.</p><a class="guide-focus-link text-link" href="' +
    href +
    '">' +
    e(focusLabel) +
    ' ' +
    icon('arrow') +
    '</a></div></li>' +
    '<li><span class="guide-number">2</span><div><h3>' +
    e(guide.title) +
    '</h3><p>' +
    e(guide.check) +
    '</p></div></li>' +
    '<li><span class="guide-number">3</span><div><h3>Recheck the original outcome</h3><p>Restore test data and required environment variables, then rerun the recorded specification. A changed requirement needs a new source revision.</p></div></li></ol>' +
    '<details class="guide-tools"><summary>' +
    icon('terminal') +
    'Commands and trace tools ' +
    icon('chevron') +
    '</summary><div class="guide-tool-content"><p>Run from the evidence bundle with PromiseProof installed. Replace &lt;policy.json&gt; with the policy path for the same authorized test environment.</p><span class="observation-label">Check setup</span><pre>promiseproof doctor --spec spec.json --config &lt;policy.json&gt;</pre><span class="observation-label">Verify the original specification</span><pre>promiseproof verify spec.json --config &lt;policy.json&gt;</pre>' +
    (trace
      ? '<span class="observation-label">Inspect the saved trace locally</span><pre>npm exec --offline -- playwright show-trace ' +
        e(trace) +
        '</pre><p>Use a project with Playwright installed; keep the ZIP with this bundle.</p>'
      : '') +
    '</div></details><p class="guide-note">These are investigation steps. The recorded failure does not establish a root cause or justify weaker expectations.</p></div></section>'
  );
}
function renderEvidence(result: RunResult): string {
  const captures = result.steps.filter((step) => artifact(step.screenshot));
  const focus =
    result.steps.find((step) => step.status !== 'PASS') ??
    [...result.steps]
      .reverse()
      .find((step) => step.assertion && step.type === 'api') ??
    result.steps.at(-1);
  const screenshotStep =
    focus && artifact(focus.screenshot) && focus.status !== 'PASS'
      ? focus
      : ([...captures]
          .reverse()
          .find((step) => ['text', 'visible'].includes(step.type)) ??
        captures.at(-1));
  const image = artifact(screenshotStep?.screenshot);
  return (
    '<section class="evidence-section" id="evidence"><div class="section-header"><h2>Evidence spotlight</h2><span class="hint">Captured in this run</span></div><div class="spotlight">' +
    (image && screenshotStep
      ? '<div class="capture-bar"><span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="filename">' +
        e(screenshotStep.screenshot) +
        '</span><a href="' +
        image +
        '" aria-label="Open full-size screenshot">' +
        icon('arrow') +
        '</a></div><div class="capture-image"><a href="' +
        image +
        '"><img src="' +
        image +
        '" alt="Browser evidence after ' +
        e(screenshotStep.description) +
        '"></a></div><div class="capture-caption">Captured after <strong>' +
        e(screenshotStep.description) +
        '</strong> · context ' +
        e(screenshotStep.context) +
        '</div>'
      : '<div class="empty-evidence">' +
        icon('image') +
        '<p>No screenshots collected.</p><p>Assertion observations are recorded below.</p></div>') +
    (focus
      ? '<div class="observation-card"><div class="eyebrow">' +
        (focus.type === 'api'
          ? 'Independent API observation'
          : 'Recorded observation') +
        '</div><div class="focus-title"><span class="status-dot status-' +
        e(focus.status) +
        '"></span><span>' +
        e(focus.description) +
        '</span></div><p class="focus-message">' +
        e(observedText(focus)) +
        '</p><div class="focus-data"><span class="observation-label">Expected outcome</span><p class="focus-message">' +
        e(expectedText(focus)) +
        '</p></div><a class="failure-summary-link" style="margin-top:12px" href="#step-' +
        e(focus.id) +
        '">Inspect workflow step ' +
        icon('arrow') +
        '</a></div>'
      : '') +
    '<div class="evidence-note">' +
    icon('shield') +
    '<span>Screenshots show browser state. API assertions establish only the specific response or field checked.</span></div></div>' +
    (captures.length
      ? '<details class="capture-list"><summary>' +
        icon('chevron') +
        'All captures <span class="muted">· ' +
        captures.length +
        '</span></summary><div class="capture-grid">' +
        captures
          .map(
            (step) =>
              '<a class="capture-thumb" href="' +
              artifact(step.screenshot) +
              '"><img loading="lazy" src="' +
              artifact(step.screenshot) +
              '" alt="Browser evidence after ' +
              e(step.description) +
              '"><p>' +
              e(step.description) +
              '</p></a>',
          )
          .join('') +
        '</div></details>'
      : '') +
    '</section>'
  );
}
function renderSidebar(result: RunResult): string {
  return (
    '<aside class="sidebar" aria-label="Report navigation"><a class="brand" href="#overview"><span class="brand-mark">' +
    icon('check') +
    '</span>PromiseProof</a><div class="workspace-label"><span class="dot"></span>Verification workspace</div><nav class="navigation"><a class="nav-primary" href="#overview">' +
    icon('grid') +
    'Overview</a><a href="#workflow">' +
    icon('workflow') +
    'Workflow<span class="nav-count">' +
    result.steps.length +
    '</span></a><a href="#evidence">' +
    icon('image') +
    'Evidence<span class="nav-count">' +
    result.steps.filter((s) => artifact(s.screenshot)).length +
    '</span></a><a href="#run-details">' +
    icon('document') +
    'Run details</a></nav><div class="run-reference"><div class="eyebrow">Current specification</div><span class="spec-id mono">' +
    e(result.specId) +
    '</span><span class="revision">Revision ' +
    result.revision +
    '</span></div><div class="sidebar-bottom"><div class="local-note">' +
    icon('shield') +
    'Local evidence bundle</div><p>AI built it.<br>Prove it works.</p></div></aside>'
  );
}
function renderThemes(): string {
  return (
    '<div class="theme-picker" role="group" aria-label="Report theme">' +
    (['system', 'light', 'dark'] as const)
      .map(
        (theme, index) =>
          '<label class="theme-choice" title="' +
          theme.charAt(0).toUpperCase() +
          theme.slice(1) +
          ' theme"><input type="radio" name="theme" id="theme-' +
          theme +
          '" aria-label="' +
          theme.charAt(0).toUpperCase() +
          theme.slice(1) +
          ' theme"' +
          (index === 0 ? ' checked' : '') +
          '><span>' +
          icon(
            theme === 'system' ? 'monitor' : theme === 'light' ? 'sun' : 'moon',
          ) +
          '</span></label>',
      )
      .join('') +
    '</div>'
  );
}
function renderStats(result: RunResult): string {
  const total = Object.values(result.summary).reduce((sum, n) => sum + n, 0);
  return (
    '<div class="stats" aria-label="Assertion results">' +
    (Object.keys(labels) as Status[])
      .map(
        (status) =>
          '<div class="stat"><div class="stat-label"><span class="status-dot status-' +
          status +
          '"></span>' +
          labels[status] +
          '</div><div class="stat-value"><strong>' +
          result.summary[status] +
          '</strong><small>of ' +
          total +
          '</small></div></div>',
      )
      .join('') +
    '</div>'
  );
}
function renderDetails(result: RunResult): string {
  return (
    '<section class="run-details" id="run-details"><div class="section-header"><h2>Run details</h2><span class="hint">Reproducible. Inspectable. Local.</span></div><dl class="details-grid"><div class="detail-field"><dt>Target application</dt><dd class="mono">' +
    e(result.baseUrl) +
    '</dd></div><div class="detail-field"><dt>Environment</dt><dd>' +
    e(result.environment) +
    '</dd></div><div class="detail-field"><dt>Started at</dt><dd>' +
    e(result.startedAt) +
    '</dd></div></dl><div class="secondary-panels"><div class="panel"><div class="panel-title">' +
    icon('layers') +
    'Evidence bundle</div><div class="artifactlinks"><a class="button" href="result.json">Result JSON ' +
    icon('arrow') +
    '</a><a class="button" href="spec.json">Specification ' +
    icon('arrow') +
    '</a>' +
    result.traces
      .filter((t) => artifact(t))
      .map(
        (t) =>
          '<a class="button" href="' +
          artifact(t) +
          '">Trace · ' +
          e(t.replace('trace-', '').replace('.zip', '')) +
          ' ' +
          icon('arrow') +
          '</a>',
      )
      .join('') +
    '</div><div class="evidence-classes">' +
    result.evidenceClasses
      .map((c) => '<span class="evidence-class">' + e(c) + '</span>')
      .join('') +
    '</div><p class="panel-note">Open trace ZIPs with the local Playwright trace viewer. Verdicts are recorded in this report and result.json.</p><details class="compact-details"><summary>' +
    icon('chevron') +
    'Specification digest</summary><p class="digest mono">SHA-256 ' +
    e(result.specDigest) +
    '</p></details></div><div class="panel"><div class="panel-title">' +
    icon('terminal') +
    'Reproduce this run</div><pre>promiseproof verify spec.json --config &lt;policy.json&gt;</pre><p class="panel-note">Run from the evidence bundle against the same test environment. Restore fixture data and required environment variables first.</p>' +
    (result.preconditions.length
      ? '<details class="compact-details"><summary>' +
        icon('chevron') +
        'Required preconditions · ' +
        result.preconditions.length +
        '</summary><p class="panel-note">Declared by the specification author; not independently certified unless encoded as assertions.</p><ul class="preconditions-list">' +
        result.preconditions.map((p) => '<li>' + e(p) + '</li>').join('') +
        '</ul></details>'
      : '') +
    '</div></div><div class="secondary-panels"><details class="panel"><summary class="panel-title">' +
    icon('terminal') +
    'Browser error observations</summary><pre>' +
    detail(result.consoleErrors) +
    '</pre></details><details class="panel"><summary class="panel-title">' +
    icon('workflow') +
    'Selected network responses</summary><pre>' +
    detail(result.network) +
    '</pre></details></div></section>'
  );
}

export function renderReport(result: RunResult): string {
  const verdictTitle: Record<Status, string> = {
    PASS: 'Outcome verified',
    FAIL: 'Outcome not verified',
    NOT_VERIFIED: 'Verification incomplete',
    ERROR: 'Run encountered an error',
  };
  const verdictCopy =
    result.status === 'PASS'
      ? 'All declared actions and assertions passed in this execution.'
      : result.status === 'ERROR'
        ? 'Review the recorded runtime and workflow observations below.'
        : result.summary.FAIL +
          ' failed assertion' +
          (result.summary.FAIL === 1 ? '' : 's') +
          ' · ' +
          result.summary.NOT_VERIFIED +
          ' not verified. Review the observations below.';
  const runtimeErrors = result.errors.length
    ? '<div class="runtime-errors" id="runtime-observations"><div class="eyebrow">Runtime observations</div>' +
      result.errors.map((error) => '<p>' + e(error) + '</p>').join('') +
      '</div>'
    : '';
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'self\' data:; font-src data:; base-uri \'none\'; form-action \'none\'"><title>' +
    e(result.status) +
    ' · ' +
    e(result.goal) +
    ' · PromiseProof</title><style>@font-face{font-family:Geist;font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,' +
    font +
    ') format("woff2")}' +
    reportStyles +
    '</style></head><body><a href="#overview" class="skip-link">Skip to report</a>' +
    renderSidebar(result) +
    '<div class="app"><header class="topbar"><div class="breadcrumbs"><span>Verification runs</span>' +
    icon('chevron') +
    '<strong>' +
    e(result.specId) +
    '</strong></div>' +
    renderThemes() +
    '</header><main class="content" id="overview"><div class="intro"><div class="intro-title"><div class="eyebrow">Outcome verification</div><h1>' +
    e(result.goal) +
    '</h1><div class="intro-description"><span class="environment"><span class="dot"></span>' +
    e(result.environment) +
    '</span><span class="separator">/</span><span class="mono">' +
    e(result.specId) +
    '</span><span class="separator">/</span><span>Revision ' +
    result.revision +
    '</span></div></div><div class="top-actions"><a class="button" href="spec.json">' +
    icon('document') +
    'Specification</a><a class="button" href="result.json">Result JSON ' +
    icon('arrow') +
    '</a></div></div><div class="verdict"><span class="verdict-symbol status-' +
    e(result.status) +
    '">' +
    icon(statusIcons[result.status]) +
    '</span><div><div class="verdict-title">' +
    verdictTitle[result.status] +
    ' ' +
    badge(result.status) +
    '</div><p class="verdict-copy">' +
    e(verdictCopy) +
    '</p>' +
    (result.status !== 'PASS'
      ? '<a class="verdict-guide-link text-link" href="#next-steps">View next steps ' +
        icon('arrow') +
        '</a>'
      : '') +
    '</div><div class="verdict-meta"><span>' +
    icon('clock') +
    duration(result.durationMs) +
    '</span><span class="revision-meta">' +
    result.steps.length +
    ' steps</span></div></div>' +
    renderStats(result) +
    runtimeErrors +
    '<div class="review-grid"><section id="workflow"><div class="section-header"><h2>Workflow<span class="count">' +
    result.steps.length +
    ' steps</span></h2><span class="hint">Expand to inspect</span></div><div class="workflow-list">' +
    result.steps
      .map((step, index) => renderStep(step, index, result))
      .join('') +
    '</div></section>' +
    renderEvidence(result) +
    '</div>' +
    renderNextSteps(result) +
    renderDetails(result) +
    '<footer class="footer"><p>These observations cover the declared assertions in this run. Evidence is local, unsigned and mutable; it is not exhaustive correctness or third-party attestation.</p><span class="version">PromiseProof ' +
    e(result.runnerVersion) +
    '</span></footer><p class="digest mono">Run ' +
    e(result.runId) +
    '</p></main></div></body></html>'
  );
}
