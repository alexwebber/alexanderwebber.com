// A static check of refresh.yml's fundraising steps (specs/002-fundraising/contracts/pipeline.md):
// the JustGiving key stays in one step, and no fundraising step can turn the run red.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../helpers/temp-repo.ts';

interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  'continue-on-error'?: boolean;
  'timeout-minutes'?: number;
}
interface Job {
  env?: Record<string, string>;
  steps?: Step[];
}
interface Workflow {
  env?: Record<string, string>;
  jobs: Record<string, Job>;
}

const KEY = 'JUSTGIVING_SUBSCRIPTION_KEY';
const text = readFileSync(join(REPO_ROOT, '.github/workflows/refresh.yml'), 'utf8');
const workflow = parse(text) as Workflow;
const steps = (job: string) => workflow.jobs[job]!.steps!;
const running = (job: string, command: string) => steps(job).findIndex((s) => s.run?.includes(`awingest ${command}`));

const everyStep = Object.entries(workflow.jobs).flatMap(([job, { steps: list }]) =>
  (list ?? []).map((step) => ({ job, step })),
);

describe('refresh.yml fundraising steps', () => {
  const read = steps('fetch')[running('fetch', 'fundraising-read')]!;
  const alert = steps('fetch')[running('fetch', 'fundraising-alert')]!;
  const publish = steps('publish')[running('publish', 'fundraising-publish')]!;

  it('has the three steps, in the two existing jobs', () => {
    expect([read, alert, publish].every(Boolean)).toBe(true);
  });

  it('keeps the JustGiving key in the read step alone', () => {
    const holders = everyStep.filter(({ step }) => JSON.stringify(step).includes(KEY));
    expect(holders.map(({ job, step }) => `${job}: ${step.name}`)).toEqual(['fetch: Read fundraising figures (JustGiving -> R2)']);
    expect(read.env?.[KEY]).toBe(`\${{ secrets.${KEY} }}`);
    expect(JSON.stringify(workflow.env ?? {})).not.toContain(KEY);
    for (const job of Object.values(workflow.jobs)) expect(JSON.stringify(job.env ?? {})).not.toContain(KEY);
  });

  it('names the key only in that step, and in comments', () => {
    const lines = text.split('\n').filter((line) => line.includes(KEY) && !line.trim().startsWith('#'));
    expect(lines).toHaveLength(1);
  });

  it('never lets a fundraising step turn the run red', () => {
    for (const step of [read, alert, publish]) expect(step['continue-on-error'], step.name).toBe(true);
  });

  it('gives each step its own short time limit', () => {
    expect([read['timeout-minutes'], alert['timeout-minutes'], publish['timeout-minutes']]).toEqual([2, 1, 2]);
  });

  it('reads before the intervals.icu fetch, so a stalled fetch can\'t stop it', () => {
    const fetch = steps('fetch').findIndex((s) => s.id === 'fetch');
    expect(fetch).toBeGreaterThan(-1);
    expect(running('fetch', 'fundraising-read')).toBeLessThan(fetch);
  });

  it('reads and alerts on main only, so a branch run can\'t write campaign state', () => {
    expect(read.if).toContain("github.ref == 'refs/heads/main'");
    expect(alert.if).toContain("github.ref == 'refs/heads/main'");
  });

  it('keeps the key and the GitHub token apart', () => {
    expect(alert.env).not.toHaveProperty(KEY);
    expect(alert.env).toHaveProperty('GITHUB_TOKEN');
    expect(read.env).not.toHaveProperty('GITHUB_TOKEN');
  });

  it('alerts after the running alert, whatever happened before it', () => {
    const running_alert = steps('fetch').findIndex((s) => s.name === 'Alert');
    expect(running('fetch', 'fundraising-alert')).toBeGreaterThan(running_alert);
    expect(alert.if).toContain('always()');
  });

  it('publishes after process and before publish-check', () => {
    expect(running('publish', 'fundraising-publish')).toBeGreaterThan(running('publish', 'process --archive'));
    expect(running('publish', 'fundraising-publish')).toBeLessThan(running('publish', 'publish-check'));
  });

  it('publishes with no JustGiving access', () => {
    expect(Object.keys(publish.env ?? {}).sort()).toEqual(['R2_ACCESS_KEY_ID', 'R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_SECRET_ACCESS_KEY']);
  });

  it('never sets the staging realm', () => {
    expect(text).not.toContain('JUSTGIVING_REALM');
  });

  it('adds no job', () => {
    expect(Object.keys(workflow.jobs).sort()).toEqual(['commit', 'deploy', 'fetch', 'guard', 'publish']);
  });

  it('publishes when the figures changed, after the daily catch-all, and survives a missing summary', () => {
    const decide = steps('fetch').find((s) => s.id === 'decide')!.run!;
    const [catchAll, figures, idle] = [
      "reason='the daily catch-all'",
      "reason='fundraising figures changed'",
      'elif ! idle=$(jq',
    ].map((marker) => decide.indexOf(marker));
    expect(catchAll).toBeGreaterThan(-1);
    expect(figures).toBeGreaterThan(catchAll);
    expect(idle).toBeGreaterThan(figures);
    expect(decide).toContain(`jq -e '(.changed // 0) > 0' "$RUNNER_TEMP/fundraising-summary.json" >/dev/null 2>&1`);
  });

  it('publishes and deploys after a refresh whose deploy failed, so the live time never runs ahead of the site (SC-005, T108)', () => {
    // The read compares JustGiving with the repo, not the live site: after a commit whose deploy
    // failed it would move "Figures updated" on while the site still showed the older figures.
    const decide = steps('fetch').find((s) => s.id === 'decide')!.run!;
    expect(decide).toContain('echo "redeploy=$redeploy" >> "$GITHUB_OUTPUT"');
    expect(decide).toContain('skipped | \'\') continue ;;');
    expect(decide).toContain('failure | cancelled | timed_out) redeploy=true ;;');
    expect(decide.indexOf('reason="the last refresh\'s deploy didn\'t finish"')).toBeGreaterThan(decide.indexOf("reason='owner files changed'"));
    expect(decide.indexOf('reason="the last refresh\'s deploy didn\'t finish"')).toBeLessThan(decide.indexOf("reason='the daily catch-all'"));
    const fetch = workflow.jobs.fetch as Job & { outputs?: Record<string, string> };
    expect(fetch.outputs?.redeploy).toBe('${{ steps.decide.outputs.redeploy }}');
    const deploy = workflow.jobs.deploy as Job & { if?: string };
    expect(deploy.if).toContain("needs.fetch.outputs.redeploy == 'true'");
    expect(deploy.if).toContain("needs.publish.result == 'success'");
  });
});
