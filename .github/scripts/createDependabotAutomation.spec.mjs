// #region Imports
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDependabotAutomation } from './createDependabotAutomation.mjs';
// #endregion

const mainSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const refreshedSha = 'c'.repeat(40);
const mergeSha = 'd'.repeat(40);
const testMergeSha = 'e'.repeat(40);
const refreshedMergeSha = '9'.repeat(40);
const treeSha = 'f'.repeat(40);
const actor = { login: 'github-actions[bot]', type: 'Bot', id: 41898282 };
const ciSource = `name: Verify\non:\n  pull_request:\npermissions:\n  contents: read\n  pull-requests: read\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${'1'.repeat(40)} # v1.0.0\n      - run: npm test\n`;
function sourceFile(text) {
    const bytes = Buffer.from(text);
    return { type: 'file', encoding: 'base64', content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') };
}
const repo = { id: 123, full_name: 'pixel-brewery/example' };
const configuration = { repository: repo.full_name, repositoryId: repo.id, workflowFile: 'ci.yml', workflowName: 'Verify', requiredJobs: ['verify'], postMergeWorkflows: [{ file: 'ci.yml' }] };

function fixture(change = {}) {
    const calls = [];
    let pull = { number: 7, state: 'open', draft: false, merged: false, merged_at: null, user: { login: 'dependabot[bot]', type: 'Bot', id: 49699333 }, merge_commit_sha: testMergeSha, mergeable: true, head: { repo, sha: headSha, ref: 'dependabot/npm_and_yarn/major' }, base: { repo, sha: mainSha, ref: 'main' } };
    const run = { id: 22, run_attempt: 1, workflow_id: 11, name: 'Verify', event: 'pull_request', status: 'completed', conclusion: 'success', head_sha: headSha, head_branch: pull.head.ref, repository: repo, head_repository: repo, actor, triggering_actor: actor, path: '.github/workflows/ci.yml', pull_requests: [{ number: 7, base: { repo, ref: 'main', sha: mainSha }, head: { repo, ref: pull.head.ref, sha: headSha } }] };
    const jobs = { total_count: 1, jobs: [{ name: 'verify', run_id: 22, head_sha: headSha, status: 'completed', conclusion: 'success' }] };
    const rules = [{ type: 'pull_request' }, { type: 'required_status_checks', parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: 'verify', integration_id: 15368 }] } }];
    Object.assign(pull, change.pull);
    Object.assign(run, change.run);
    const files = (change.files ?? [{ filename: 'yarn.lock', status: 'modified' }]).map((file) => file.patch ? { additions: file.patch.split('\n').filter((line) => line.startsWith('+')).length, deletions: file.patch.split('\n').filter((line) => line.startsWith('-')).length, ...file } : file);
    let merged = pull.state === 'closed' && pull.merged === true;
    let refreshed = false;
    let runReads = 0;
    const request = async (method, endpoint, body) => {
        calls.push({ method, endpoint, body });
        if (change.onRequest) change.onRequest({ method, endpoint, body, calls, pull, run });
        const route = endpoint.replace('repos/pixel-brewery/example/', '');
        if (route === 'pulls/7') {
            if (change.onPullRead) change.onPullRead(pull, calls);
            return structuredClone(pull);
        }
        if (route.startsWith('pulls/7/files?')) return files;
        if (route === 'rules/branches/main') return change.rules ?? rules;
        if (route === 'branches/main') return { commit: { sha: merged ? mergeSha : mainSha } };
        if (route.startsWith('compare/')) return { behind_by: change.stale && !refreshed ? 1 : 0, merge_base_commit: { sha: mainSha } };
        if (route === 'pulls/7/update-branch' && method === 'PUT') { assert.equal(body.expected_head_sha, headSha); refreshed = true; pull.head.sha = refreshedSha; pull.merge_commit_sha = refreshedMergeSha; return {}; }
        if (route === 'actions/workflows/ci.yml') return { id: 11, path: '.github/workflows/ci.yml', name: 'Verify', state: 'active' };
        if (route.startsWith('actions/workflows/ci.yml/runs?')) {
            if (route.includes(refreshedSha) || route.includes(mergeSha)) return { workflow_runs: change.continuationRuns ?? [] };
            return { workflow_runs: [run, ...(change.additionalRuns ?? []).map((item) => ({ ...run, ...item }))] };
        }
        if (route === 'actions/workflows/ci.yml/dispatches') return {};
        if (/^actions\/runs\/\d+\/approve$/u.test(route) && method === 'POST') return {};
        if (route === `git/ref/heads/${pull.head.ref}`) return { object: { type: 'commit', sha: change.branchSha ?? pull.head.sha } };
        if (route === 'git/ref/pull/7/merge') return { object: { type: 'commit', sha: change.mergeRefSha ?? pull.merge_commit_sha } };
        if ([`git/commits/${testMergeSha}`, `git/commits/${refreshedMergeSha}`].includes(route)) return { sha: pull.merge_commit_sha, parents: change.parents ?? [{ sha: mainSha }, { sha: pull.head.sha }], tree: { sha: change.mergeTree ?? treeSha } };
        if (route.startsWith('contents/.github/workflows/ci.yml?')) {
            if (change.workflowBlob) return change.workflowBlob;
            return sourceFile(route.endsWith(mainSha) ? (change.mainCiSource ?? ciSource) : (change.ciSource ?? ciSource));
        }
        if (route === `commits/${mergeSha}/pulls?per_page=100`) {
            const association = structuredClone(pull);
            delete association.merged;
            return change.mergeAssociations ?? [association];
        }
        if (route === `commits/${mainSha}/pulls?per_page=100`) return [];
        if (route === `commits/${headSha}/pulls?per_page=100`) return change.associations ?? [structuredClone(pull)];
        if (route.startsWith('actions/runs/22/attempts/') && route.includes('/jobs?')) return change.jobs ?? jobs;
        if (route === 'actions/runs/22') return { ...run, ...(++runReads > 1 ? change.finalRun : {}) };
        if (/^actions\/runs\/\d+$/u.test(route)) {
            const id = Number(route.split('/').at(-1));
            const additional = change.additionalRuns?.find((item) => item.id === id);
            if (additional) return { ...run, ...additional };
        }
        if (route === 'pulls/7/merge' && method === 'PUT') {
            assert.equal(body.sha, headSha); assert.equal(body.merge_method, 'squash');
            merged = true; pull.state = 'closed'; pull.merged = true; pull.merged_at = new Date().toISOString(); pull.merge_commit_sha = mergeSha;
            return { merged: true, sha: mergeSha };
        }
        if (change.metadata && route.startsWith('contents/')) {
            const value = route.startsWith('contents/package.json') ? change.metadata.manifest : change.metadata.lock;
            return { encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') };
        }
        if ([`git/commits/${headSha}`, `git/commits/${refreshedSha}`].includes(route)) return { sha: route.split('/').at(-1), tree: { sha: treeSha } };
        if (route === 'git/trees' && method === 'POST') return { sha: mainSha };
        if (route === 'git/commits' && method === 'POST') return { sha: refreshedSha };
        if (route.startsWith('git/refs/heads/') && method === 'PATCH') { assert.equal(body.force, false); pull.head.sha = refreshedSha; pull.merge_commit_sha = refreshedMergeSha; return {}; }
        if (route.startsWith('contents/package.json')) return { encoding: 'base64', content: Buffer.from(JSON.stringify({ scripts: { test: route.includes(headSha) ? 'modified' : 'original' } })).toString('base64') };
        throw new Error('Unexpected test route: ' + method + ' ' + route);
    };
    return { calls, request, controller: createDependabotAutomation({ ...configuration, ...change.configuration }, { request, wait: async () => {} }) };
}

test('merges only exact-head native PR proof including major updates and dispatches main verification', async () => {
    const f = fixture();
    assert.equal((await f.controller.reconcile(7)).status, 'merged');
    assert(f.calls.some((call) => call.endpoint.endsWith('/dispatches') && call.body.inputs.expected_head_sha === mergeSha));
});

test('refreshes a stale branch and requires a fresh explicit read-only verification', async () => {
    const f = fixture({ stale: true });
    assert.equal((await f.controller.reconcile(7)).status, 'updated');
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
    assert(f.calls.some((call) => call.endpoint.endsWith('/dispatches') && call.body.ref.startsWith('dependabot/') && call.body.inputs.expected_head_sha === refreshedSha));
});

test('an approval-pending PR run does not suppress the explicit dispatch after a token-authored refresh', async () => {
    const f = fixture({ stale: true, continuationRuns: [{ event: 'pull_request', head_sha: refreshedSha }] });
    await f.controller.reconcile(7);
    assert.equal(f.calls.filter((call) => call.endpoint.endsWith('/dispatches')).length, 1);
});

test('never repeats an already dispatched continuation', async () => {
    const f = fixture({ stale: true, continuationRuns: [{ id: 40, run_attempt: 1, workflow_id: 11, name: 'Verify', path: '.github/workflows/ci.yml', repository: repo, head_repository: repo, event: 'workflow_dispatch', head_sha: refreshedSha, head_branch: 'dependabot/npm_and_yarn/major' }] });
    await f.controller.reconcile(7);
    assert.equal(f.calls.filter((call) => call.endpoint.endsWith('/dispatches')).length, 0);
});

test('approves the real readonly native run without manufacturing branch-check proof', async () => {
    const f = fixture({ run: { conclusion: 'action_required' } });
    assert.equal((await f.controller.reconcile(7)).status, 'approved');
    assert(f.calls.some((call) => call.endpoint.endsWith('/actions/runs/22/approve')));
    assert(!f.calls.some((call) => call.endpoint.endsWith('/dispatches')));
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
});

test('waits for ordinary verification without creating a duplicate run', async () => {
    const f = fixture({ run: { status: 'in_progress', conclusion: null } });
    await f.controller.reconcile(7);
    assert(!f.calls.some((call) => call.endpoint.endsWith('/dispatches')));
});

test('never uses diagnostic dispatch proof instead of a blocked native PR run', async () => {
    const f = fixture({ run: { event: 'workflow_dispatch' }, additionalRuns: [{ id: 23, event: 'pull_request', conclusion: 'action_required' }] });
    assert.notEqual((await f.controller.reconcile(7)).status, 'merged');
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
});

test('a later failed ordinary PR attempt still blocks an earlier successful dispatch', async () => {
    const f = fixture({ run: { event: 'workflow_dispatch' }, additionalRuns: [{ id: 23, event: 'pull_request', conclusion: 'failure' }] });
    assert.equal((await f.controller.reconcile(7)).reason, 'verification-required');
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
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
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
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
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
});

test('refuses an unexpected Mosaik root rewrite', async () => {
    const f = fixture({ files: [{ filename: 'package-lock.json', status: 'modified' }], configuration: { normalizeMosaikLockRoot: true }, metadata: { manifest: { dependencies: { '@pixel-brewery/mosaik-icons': 'latest' } }, lock: { lockfileVersion: 3, packages: { '': { dependencies: { '@pixel-brewery/mosaik-icons': '^1.0.0' } } } } } });
    await assert.rejects(f.controller.reconcile(7), /Unexpected Mosaik/u);
    assert(!f.calls.some((call) => call.method !== 'GET'));
});

test('resumes a confirmed current merge without merging twice', async () => {
    const f = fixture({ pull: { state: 'closed', merged: true, merged_at: new Date().toISOString(), merge_commit_sha: mergeSha } });
    assert.equal((await f.controller.reconcile(7)).status, 'continued');
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
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
    const values = { GITHUB_REPOSITORY: repo.full_name, GITHUB_REPOSITORY_ID: String(repo.id), GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: eventPath };
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


test('a human-authored compatibility fix on the bot PR retains native merge eligibility', async () => {
    // Arrange
    const f = fixture({ run: { actor: { login: 'maintainer', id: 42, type: 'User' }, triggering_actor: { login: 'maintainer', id: 42, type: 'User' } } });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'merged');
});

test('a later diagnostic does not shadow approved same-ID attempt two', async () => {
    // Arrange
    const f = fixture({ run: { run_attempt: 2 }, additionalRuns: [{ id: 99, event: 'workflow_dispatch', conclusion: 'success' }] });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'merged');
    assert(f.calls.some((call) => call.endpoint.includes('/runs/22/attempts/2/jobs?')));
    assert(!f.calls.some((call) => call.endpoint.endsWith('/runs/99')));
});

test('reads current same-ID attempt instead of a stale inventory attempt', async () => {
    // Arrange
    const f = fixture({ finalRun: { run_attempt: 2 }, onRequest({ endpoint, run }) {
        if (endpoint.endsWith('/actions/runs/22')) run.run_attempt = 2;
    } });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'merged');
    assert(f.calls.some((call) => call.endpoint.includes('/runs/22/attempts/2/jobs?')));
});

test('allows only full SHA action-pin and version-comment edits to the approved CI', async () => {
    // Arrange
    const f = fixture({ run: { conclusion: 'action_required' }, ciSource: ciSource.replace('1'.repeat(40), '2'.repeat(40)).replace('# v1.0.0', '# v2.1.0') });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'approved');
    assert.equal(f.calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/approve')).length, 1);
});

for (const [name, change] of [
    ['human approval actor', { run: { actor: { login: 'maintainer', id: 42, type: 'User' } } }],
    ['spoofed bot actor ID', { run: { actor: { ...actor, id: 7 } } }],
    ['spoofed triggering actor', { run: { triggering_actor: { ...actor, id: 7 } } }],
    ['diagnostic event', { run: { event: 'workflow_dispatch' } }],
    ['foreign workflow path', { run: { path: '.github/workflows/other.yml' } }],
    ['foreign workflow ID', { run: { workflow_id: 12345 } }],
    ['foreign run repository', { run: { repository: { ...repo, id: 456 } } }],
    ['foreign head repository', { run: { head_repository: { ...repo, full_name: 'pixel-brewery/other' } } }],
    ['wrong PR association', { run: { pull_requests: [{ number: 8 }] } }],
    ['ambiguous PR association', { run: { pull_requests: [] } }],
    ['spoofed bot PR author', { pull: { user: { login: 'dependabot[bot]', type: 'Bot', id: 7 } } }],
    ['different branch ref', { branchSha: refreshedSha }],
    ['different merge ref', { mergeRefSha: mergeSha }],
    ['reversed test-merge parents', { parents: [{ sha: headSha }, { sha: mainSha }] }],
    ['extra test-merge parent', { parents: [{ sha: mainSha }, { sha: headSha }, { sha: refreshedSha }] }],
    ['different test-merge tree', { mergeTree: mergeSha }],
    ['unresolved mergeability', { pull: { mergeable: null } }],
    ['different base SHA', { pull: { base: { repo, ref: 'main', sha: refreshedSha } } }],
    ['CI command change', { ciSource: ciSource.replace('npm test', 'echo pass') }],
    ['CI action owner change', { ciSource: ciSource.replace('actions/checkout', 'attacker/checkout') }],
    ['CI non-SHA ref', { ciSource: ciSource.replace('1'.repeat(40), 'main') }],
    ['changed readonly scopes', { ciSource: ciSource.replace('  contents: read', '  contents: read\n  actions: read') }],
    ['root write permission', { ciSource: ciSource.replace('contents: read', 'contents: write') }],
    ['job write permission', { ciSource: ciSource.replace('    runs-on:', '    permissions:\n      contents: write\n    runs-on:') }],
    ['inline write permission', { ciSource: ciSource.replace('    runs-on:', '    permissions: { contents: write }\n    runs-on:') }],
    ['read-all shorthand', { ciSource: ciSource.replace('permissions:\n  contents: read\n  pull-requests: read', 'permissions: read-all') }],
    ['custom secret', { ciSource: ciSource.replace('      - run: npm test', '      - run: npm test\n        env:\n          TOKEN: ${{ secrets.PUBLISH_TOKEN }}') }],
    ['secret inheritance', { ciSource: ciSource.replace('    runs-on:', '    secrets: inherit\n    runs-on:') }],
    ['YAML alias', { ciSource: ciSource.replace('    runs-on: ubuntu-latest', '    runs-on: &runner ubuntu-latest') }],
    ['YAML merge', { ciSource: ciSource.replace('    runs-on:', '    <<: *defaults\n    runs-on:') }],
    ['YAML tagged scalar', { ciSource: ciSource.replace('contents: read', 'contents: !!str write') }],
    ['missing root permissions', { ciSource: ciSource.replace('permissions:\n  contents: read\n  pull-requests: read\n', '') }],
    ['corrupt workflow blob', { workflowBlob: { ...sourceFile(ciSource), sha: '0'.repeat(40) } }],
]) test(`never approves ${name}`, async () => {
    // Arrange
    const f = fixture({ ...change, run: { conclusion: 'action_required', ...change.run } });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.notEqual(result.status, 'approved');
    assert(!f.calls.some((call) => call.method === 'POST' && call.endpoint.endsWith('/approve')));
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
});

test('accepts explicit read-only job scopes and only the native GITHUB_TOKEN alias', async () => {
    // Arrange
    const source = ciSource.replace('    runs-on:', '    permissions:\n      contents: read\n      checks: read\n    runs-on:').replace('      - run: npm test', '      - run: npm test\n        env:\n          TOKEN: ${{ secrets.GITHUB_TOKEN }}');
    const f = fixture({ run: { conclusion: 'action_required' }, mainCiSource: source, ciSource: source });
    // Act and Assert
    assert.equal((await f.controller.reconcile(7)).status, 'approved');
});

test('rechecks live refs after the last run read before approval', async () => {
    // Arrange
    let reads = 0;
    const f = fixture({ run: { conclusion: 'action_required' }, onRequest({ endpoint, pull }) {
        if (endpoint.endsWith('/actions/runs/22') && ++reads === 2) pull.head.sha = refreshedSha;
    } });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.notEqual(result.status, 'approved');
    assert(!f.calls.some((call) => call.method === 'POST' && call.endpoint.endsWith('/approve')));
});

test('does not suppress current-main continuation with a foreign dispatch inventory entry', async () => {
    // Arrange
    const f = fixture({ pull: { state: 'closed', merged: true, merged_at: new Date().toISOString(), merge_commit_sha: mergeSha }, continuationRuns: [{ id: 40, run_attempt: 1, workflow_id: 11, path: '.github/workflows/ci.yml', name: 'Verify', head_sha: mergeSha, head_branch: 'main', event: 'workflow_dispatch', repository: { ...repo, id: 999 }, head_repository: repo }] });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'continued');
    assert.equal(f.calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/dispatches')).length, 1);
});

test('retains a genuine failed main continuation without blindly retrying it', async () => {
    // Arrange
    const f = fixture({ pull: { state: 'closed', merged: true, merged_at: new Date().toISOString(), merge_commit_sha: mergeSha }, continuationRuns: [{ id: 40, run_attempt: 2, workflow_id: 11, path: '.github/workflows/ci.yml', name: 'Verify', head_sha: mergeSha, head_branch: 'main', event: 'workflow_dispatch', status: 'completed', conclusion: 'failure', repository: repo, head_repository: repo }] });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'continued');
    assert(!f.calls.some((call) => call.method === 'POST' && call.endpoint.endsWith('/dispatches')));
});


for (const [name, source] of [
    ['reusable workflow', ciSource.replace('    runs-on: ubuntu-latest', `    uses: owner/repo/.github/workflows/build.yml@${'1'.repeat(40)}`)],
    ['environment secrets', ciSource.replace('    runs-on:', '    environment: production\n    runs-on:')],
    ['escaped permission key', ciSource.replace('    runs-on:', '    "\\x70ermissions": write-all\n    runs-on:')],
    ['explicit complex key', ciSource.replace('    runs-on:', '    ? permissions\n    : write-all\n    runs-on:')],
    ['escaped flow-map job', ciSource + '  second: { "\\x70ermissions": write-all }\n'],
]) test(`refuses unproven ${name} even in the trusted baseline`, async () => {
    // Arrange
    const f = fixture({ run: { conclusion: 'action_required' }, mainCiSource: source, ciSource: source });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.notEqual(result.status, 'approved');
    assert(!f.calls.some((call) => call.method === 'POST' && call.endpoint.endsWith('/approve')));
});

test('accepts the actual maintained repository CI as a readonly source baseline', async () => {
    // Arrange
    let directory = new URL('.', import.meta.url);
    let policy;
    for (;;) {
        try { policy = JSON.parse(await readFile(new URL('.github/dependabot-automation.json', directory), 'utf8')); break; }
        catch (error) {
            const parent = new URL('..', directory);
            if (parent.href === directory.href || error.code !== 'ENOENT') throw error;
            directory = parent;
        }
    }
    const source = await readFile(new URL('.github/workflows/' + policy.workflowFile, directory), 'utf8');
    const f = fixture({ run: { conclusion: 'action_required' }, mainCiSource: source, ciSource: source });
    // Act and Assert
    assert.equal((await f.controller.reconcile(7)).status, 'approved');
});


for (const kind of ['schedule', 'workflow_dispatch']) test(`reuses the full native merge proof during ${kind} catch-up`, async () => {
    // Arrange
    const f = fixture({ run: { run_attempt: 2 }, additionalRuns: [{ id: 99, event: 'workflow_dispatch' }] });
    const directory = await mkdtemp(join(tmpdir(), 'dependabot-catchup-'));
    const eventPath = join(directory, 'event.json');
    await writeFile(eventPath, '{}');
    const values = { GITHUB_REPOSITORY: repo.full_name, GITHUB_REPOSITORY_ID: String(repo.id), GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: kind, GITHUB_EVENT_PATH: eventPath };
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    const controller = createDependabotAutomation(configuration, { request: async (method, endpoint, body) => {
        if (endpoint === `repos/${repo.full_name}/pulls?state=open&base=main&per_page=100`) return [{ number: 7, user: { login: 'dependabot[bot]' } }];
        if (endpoint.startsWith(`repos/${repo.full_name}/pulls?state=closed`)) return [];
        return f.request(method, endpoint, body);
    } });
    try {
        // Act
        const result = await controller.runFromEnvironment();
        // Assert
        assert.equal(result[0].status, 'merged');
        assert(f.calls.some((call) => call.endpoint.includes('/runs/22/attempts/2/jobs?')));
        assert.equal(f.calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/dispatches')).length, 1);
    } finally {
        for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
        await rm(directory, { recursive: true, force: true });
    }
});

test('scheduled continuation recovers the exact current merge even outside the recent-closed window', async () => {
    // Arrange
    const f = fixture({ pull: { state: 'closed', merged: true, merged_at: new Date().toISOString(), merge_commit_sha: mergeSha } });
    const directory = await mkdtemp(join(tmpdir(), 'dependabot-current-merge-'));
    const eventPath = join(directory, 'event.json');
    await writeFile(eventPath, '{}');
    const values = { GITHUB_REPOSITORY: repo.full_name, GITHUB_REPOSITORY_ID: String(repo.id), GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'schedule', GITHUB_EVENT_PATH: eventPath };
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    const controller = createDependabotAutomation(configuration, { request: async (method, endpoint, body) => {
        if (endpoint.startsWith(`repos/${repo.full_name}/pulls?state=`)) return [];
        return f.request(method, endpoint, body);
    } });
    try {
        // Act
        const result = await controller.runFromEnvironment();
        // Assert
        assert.equal(result[0].status, 'continued');
        assert.equal(f.calls.filter((call) => call.method === 'POST' && call.endpoint.endsWith('/dispatches')).length, 1);
        assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
    } finally {
        for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
        await rm(directory, { recursive: true, force: true });
    }
});


for (const state of ['queued', 'success', 'failure', 'cancelled', 'skipped']) test(`retains the original ${state} push after a human merges the bot PR`, async () => {
    // Arrange
    const f = fixture({ pull: { state: 'closed', merged: true, merged_by: { login: 'maintainer', id: 42, type: 'User' }, merged_at: new Date().toISOString(), merge_commit_sha: mergeSha }, continuationRuns: [{ id: 40, run_attempt: 1, workflow_id: 11, path: '.github/workflows/ci.yml', name: 'Verify', head_sha: mergeSha, head_branch: 'main', event: 'push', status: state === 'queued' ? 'queued' : 'completed', conclusion: state === 'queued' ? null : state, actor: { login: 'maintainer', id: 42, type: 'User' }, repository: repo, head_repository: repo }] });
    // Act
    const result = await f.controller.reconcile(7);
    // Assert
    assert.equal(result.status, 'continued');
    assert(!f.calls.some((call) => call.method === 'POST' && call.endpoint.endsWith('/dispatches')));
    assert(!f.calls.some((call) => call.method === 'POST' && call.endpoint.includes('/rerun')));
});


for (const stale of [false, true]) test(`never dispatches unsafe identical main/candidate CI after branch refresh=${stale}`, async () => {
    // Arrange
    const source = ciSource.replace('contents: read', 'contents: write');
    const f = fixture({ stale, run: { conclusion: 'action_required' }, mainCiSource: source, ciSource: source });
    // Act
    await f.controller.reconcile(7);
    // Assert
    assert(!f.calls.some((call) => call.method === 'POST' && (call.endpoint.endsWith('/approve') || call.endpoint.endsWith('/dispatches'))));
    assert(!f.calls.some((call) => call.method === 'PUT' && call.endpoint.endsWith('/merge')));
});

test('rejects case-insensitive custom secret context names even in the trusted baseline', async () => {
    // Arrange
    const source = ciSource.replace('      - run: npm test', '      - run: npm test\n        env:\n          TOKEN: ${{ SECRETS.PUBLISH_TOKEN }}');
    const f = fixture({ run: { conclusion: 'action_required' }, mainCiSource: source, ciSource: source });
    // Act
    await f.controller.reconcile(7);
    // Assert
    assert(!f.calls.some((call) => call.method === 'POST'));
});
