// #region Imports
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDependabotAutomation } from './createDependabotAutomation.mjs';
// #endregion

const mainSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const refreshedSha = 'c'.repeat(40);
const mergeSha = 'd'.repeat(40);
const repo = { id: 123, full_name: 'pixel-brewery/example' };
const configuration = { repository: repo.full_name, repositoryId: repo.id, workflowFile: 'ci.yml', workflowName: 'Verify', requiredJobs: ['verify'], postMergeWorkflows: [{ file: 'ci.yml' }] };

function fixture(change = {}) {
    const calls = [];
    let pull = { number: 7, state: 'open', draft: false, merged: false, merged_at: null, user: { login: 'dependabot[bot]', type: 'Bot' }, head: { repo, sha: headSha, ref: 'dependabot/npm_and_yarn/major' }, base: { repo, sha: mainSha, ref: 'main' } };
    const run = { id: 22, run_attempt: 1, workflow_id: 11, name: 'Verify', event: 'pull_request', status: 'completed', conclusion: 'success', head_sha: headSha, head_branch: pull.head.ref, repository: repo, head_repository: repo };
    const jobs = { total_count: 1, jobs: [{ name: 'verify', run_id: 22, status: 'completed', conclusion: 'success' }] };
    const rules = [{ type: 'pull_request' }, { type: 'required_status_checks', parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: 'verify', integration_id: 15368 }] } }];
    Object.assign(pull, change.pull);
    Object.assign(run, change.run);
    const files = (change.files ?? [{ filename: 'yarn.lock', status: 'modified' }]).map((file) => file.patch ? { additions: file.patch.split('\n').filter((line) => line.startsWith('+')).length, deletions: file.patch.split('\n').filter((line) => line.startsWith('-')).length, ...file } : file);
    let merged = pull.state === 'closed' && pull.merged === true;
    let refreshed = false;
    const request = async (method, endpoint, body) => {
        calls.push({ method, endpoint, body });
        const route = endpoint.replace('repos/pixel-brewery/example/', '');
        if (route === 'pulls/7') return structuredClone(pull);
        if (route.startsWith('pulls/7/files?')) return files;
        if (route === 'rules/branches/main') return change.rules ?? rules;
        if (route === 'branches/main') return { commit: { sha: merged ? mergeSha : mainSha } };
        if (route.startsWith('compare/')) return { behind_by: change.stale && !refreshed ? 1 : 0, merge_base_commit: { sha: mainSha } };
        if (route === 'pulls/7/update-branch' && method === 'PUT') { assert.equal(body.expected_head_sha, headSha); refreshed = true; pull.head.sha = refreshedSha; return {}; }
        if (route === 'actions/workflows/ci.yml') return { id: 11, path: '.github/workflows/ci.yml', name: 'Verify' };
        if (route.startsWith('actions/workflows/ci.yml/runs?')) {
            if (route.includes(refreshedSha) || route.includes(mergeSha)) return { workflow_runs: change.continuationRuns ?? [] };
            return { workflow_runs: [run, ...(change.additionalRuns ?? []).map((item) => ({ ...run, ...item }))] };
        }
        if (route === 'actions/workflows/ci.yml/dispatches') return {};
        if (route === `commits/${headSha}/pulls?per_page=100`) return change.associations ?? [structuredClone(pull)];
        if (route.startsWith('actions/runs/22/attempts/1/jobs?')) return change.jobs ?? jobs;
        if (route === 'actions/runs/22') return { ...run, ...change.finalRun };
        if (route === 'pulls/7/merge' && method === 'PUT') {
            assert.equal(body.sha, headSha); assert.equal(body.merge_method, 'squash');
            merged = true; pull.state = 'closed'; pull.merged = true; pull.merged_at = new Date().toISOString(); pull.merge_commit_sha = mergeSha;
            return { merged: true, sha: mergeSha };
        }
        if (change.metadata && route.startsWith('contents/')) {
            const value = route.startsWith('contents/package.json') ? change.metadata.manifest : change.metadata.lock;
            return { encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') };
        }
        if (route === `git/commits/${headSha}`) return { tree: { sha: mainSha } };
        if (route === 'git/trees' && method === 'POST') return { sha: mainSha };
        if (route === 'git/commits' && method === 'POST') return { sha: refreshedSha };
        if (route.startsWith('git/refs/heads/') && method === 'PATCH') { assert.equal(body.force, false); pull.head.sha = refreshedSha; return {}; }
        if (route.startsWith('contents/package.json')) return { encoding: 'base64', content: Buffer.from(JSON.stringify({ scripts: { test: route.includes(headSha) ? 'modified' : 'original' } })).toString('base64') };
        throw new Error('Unexpected test route: ' + method + ' ' + route);
    };
    return { calls, request, controller: createDependabotAutomation({ ...configuration, ...change.configuration }, { request, wait: async () => {} }) };
}

for (const event of ['pull_request', 'workflow_dispatch']) test(`merges exact-head ${event} proof including major updates and dispatches main verification`, async () => {
    const f = fixture({ run: { event } });
    assert.equal((await f.controller.reconcile(7)).status, 'merged');
    assert(f.calls.some((call) => call.endpoint.endsWith('/dispatches') && call.body.inputs.expected_head_sha === mergeSha));
});

test('refreshes a stale branch and requires a fresh explicit read-only verification', async () => {
    const f = fixture({ stale: true });
    assert.equal((await f.controller.reconcile(7)).status, 'updated');
    assert(!f.calls.some((call) => call.endpoint.endsWith('/merge')));
    assert(f.calls.some((call) => call.endpoint.endsWith('/dispatches') && call.body.ref.startsWith('dependabot/') && call.body.inputs.expected_head_sha === refreshedSha));
});

test('an approval-pending PR run does not suppress the explicit dispatch after a token-authored refresh', async () => {
    const f = fixture({ stale: true, continuationRuns: [{ event: 'pull_request', head_sha: refreshedSha }] });
    await f.controller.reconcile(7);
    assert.equal(f.calls.filter((call) => call.endpoint.endsWith('/dispatches')).length, 1);
});

test('never repeats an already dispatched continuation', async () => {
    const f = fixture({ stale: true, continuationRuns: [{ event: 'workflow_dispatch', head_sha: refreshedSha }] });
    await f.controller.reconcile(7);
    assert.equal(f.calls.filter((call) => call.endpoint.endsWith('/dispatches')).length, 0);
});

test('dispatches read-only verification for an unchanged approval-blocked head', async () => {
    const f = fixture({ run: { conclusion: 'action_required' } });
    assert.equal((await f.controller.reconcile(7)).reason, 'verification-required');
    assert(f.calls.some((call) => call.endpoint.endsWith('/dispatches') && call.body.inputs.expected_head_sha === headSha));
    assert(!f.calls.some((call) => call.endpoint.endsWith('/merge')));
});

test('waits for ordinary verification without creating a duplicate run', async () => {
    const f = fixture({ run: { status: 'in_progress', conclusion: null } });
    await f.controller.reconcile(7);
    assert(!f.calls.some((call) => call.endpoint.endsWith('/dispatches')));
});

test('uses successful dispatch proof when a later PR attempt only requires approval', async () => {
    const f = fixture({ run: { event: 'workflow_dispatch' }, additionalRuns: [{ id: 23, event: 'pull_request', conclusion: 'action_required' }] });
    assert.equal((await f.controller.reconcile(7)).status, 'merged');
});

test('a later failed ordinary PR attempt still blocks an earlier successful dispatch', async () => {
    const f = fixture({ run: { event: 'workflow_dispatch' }, additionalRuns: [{ id: 23, event: 'pull_request', conclusion: 'failure' }] });
    assert.equal((await f.controller.reconcile(7)).reason, 'verification-required');
    assert(!f.calls.some((call) => call.endpoint.endsWith('/merge')));
});

for (const [name, change] of [
    ['human author', { pull: { user: { login: 'maintainer', type: 'User' } } }],
    ['foreign repository', { pull: { head: { repo: { ...repo, id: 456 }, sha: headSha, ref: 'dependabot/x' } } }],
    ['wrong base', { pull: { base: { repo, sha: mainSha, ref: 'release' } } }],
    ['draft', { pull: { draft: true } }],
    ['failed latest proof', { run: { conclusion: 'failure' } }],
    ['skipped required job', { jobs: { total_count: 1, jobs: [{ name: 'verify', run_id: 22, status: 'completed', conclusion: 'skipped' }] } }],
    ['missing required job', { jobs: { total_count: 0, jobs: [] } }],
    ['changed attempt', { finalRun: { run_attempt: 2 } }],
    ['unprotected main', { rules: [] }],
    ['unregistered source change', { files: [{ filename: 'src/runtime.ts', status: 'modified' }] }],
    ['modified npm script', { files: [{ filename: 'package.json', status: 'modified' }] }],
    ['workflow command injection', { files: [{ filename: '.github/workflows/ci.yml', status: 'modified', patch: '-run: npm test\n+run: echo pass' }] }],
    ['ambiguous commit association', { associations: [] }],
]) test(`refuses ${name}`, async () => {
    const f = fixture(change);
    assert.notEqual((await f.controller.reconcile(7)).status, 'merged');
    assert(!f.calls.some((call) => call.endpoint.endsWith('/merge')));
});

test('accepts only action-pin workflow changes', async () => {
    const f = fixture({ files: [{ filename: '.github/workflows/ci.yml', status: 'modified', patch: '- uses: actions/checkout@aaaa # v1\n+ uses: actions/checkout@bbbb # v2' }] });
    assert.equal((await f.controller.reconcile(7)).status, 'merged');
});


test('rejects replacement of an action owner even with a valid-looking ref', async () => {
    const f = fixture({ files: [{ filename: '.github/workflows/ci.yml', status: 'modified', patch: '- uses: actions/checkout@aaaa\n+ uses: attacker/action@bbbb' }] });
    assert.equal((await f.controller.reconcile(7)).reason, 'non-dependency-change');
});

test('repairs only Mosaik lockfile root metadata and verifies the new head', async () => {
    const lock = { lockfileVersion: 3, packages: { '': { dependencies: { '@pixel-brewery/mosaik-icons': '*', other: '1.0.0' } }, 'node_modules/@pixel-brewery/mosaik-icons': { version: '0.1.192', integrity: 'sha512-original' } } };
    const f = fixture({ files: [{ filename: 'package-lock.json', status: 'modified' }], configuration: { normalizeMosaikLockRoot: true }, metadata: { manifest: { dependencies: { '@pixel-brewery/mosaik-icons': 'latest', other: '1.0.0' } }, lock } });
    assert.equal((await f.controller.reconcile(7)).status, 'updated');
    const written = JSON.parse(f.calls.find((call) => call.endpoint.endsWith('/git/trees')).body.tree[0].content);
    assert.equal(written.packages[''].dependencies['@pixel-brewery/mosaik-icons'], 'latest');
    assert.equal(written.packages[''].dependencies.other, '1.0.0');
    assert.deepEqual(written.packages['node_modules/@pixel-brewery/mosaik-icons'], lock.packages['node_modules/@pixel-brewery/mosaik-icons']);
    assert(!f.calls.some((call) => call.endpoint.endsWith('/merge')));
});

test('refuses an unexpected Mosaik root rewrite', async () => {
    const f = fixture({ files: [{ filename: 'package-lock.json', status: 'modified' }], configuration: { normalizeMosaikLockRoot: true }, metadata: { manifest: { dependencies: { '@pixel-brewery/mosaik-icons': 'latest' } }, lock: { lockfileVersion: 3, packages: { '': { dependencies: { '@pixel-brewery/mosaik-icons': '^1.0.0' } } } } } });
    await assert.rejects(f.controller.reconcile(7), /Unexpected Mosaik/u);
    assert(!f.calls.some((call) => call.method !== 'GET'));
});

test('resumes a confirmed current merge without merging twice', async () => {
    const f = fixture({ pull: { state: 'closed', merged: true, merged_at: new Date().toISOString(), merge_commit_sha: mergeSha } });
    assert.equal((await f.controller.reconcile(7)).status, 'continued');
    assert(!f.calls.some((call) => call.endpoint.endsWith('/merge')));
    assert(f.calls.some((call) => call.endpoint.endsWith('/dispatches')));
});


test('rejects a truncated workflow patch', async () => {
    const f = fixture({ files: [{ filename: '.github/workflows/ci.yml', status: 'modified', patch: '- uses: actions/checkout@aaaa\n+ uses: actions/checkout@bbbb', additions: 10, deletions: 10 }] });
    assert.equal((await f.controller.reconcile(7)).reason, 'non-dependency-change');
});

test('reports one failed pull request after processing the remaining eligible updates', async () => {
    // Arrange
    const f = fixture();
    const directory = await mkdtemp(join(tmpdir(), 'dependabot-reconciliation-'));
    const eventPath = join(directory, 'event.json');
    await writeFile(eventPath, '{}');
    const values = { GITHUB_REPOSITORY: repo.full_name, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: eventPath };
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    const controller = createDependabotAutomation(configuration, { request: async (method, endpoint, body) => {
        if (endpoint === `repos/${repo.full_name}/pulls?state=open&base=main&per_page=100`)
            return [{ number: 8, user: { login: 'dependabot[bot]' } }, { number: 7, user: { login: 'dependabot[bot]' } }];
        if (endpoint.startsWith(`repos/${repo.full_name}/pulls?state=closed`)) return [];
        if (endpoint === `repos/${repo.full_name}/pulls/8`) throw new Error('Conflicted branch requires reconciliation.');
        return f.request(method, endpoint, body);
    } });
    try {
        // Act and Assert
        await assert.rejects(controller.runFromEnvironment(), /failed for pull requests: 8/u);
        assert(f.calls.some((call) => call.endpoint.endsWith('/pulls/7/merge')));
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        await rm(directory, { recursive: true, force: true });
    }
});
