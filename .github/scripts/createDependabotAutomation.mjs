// #region Imports
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
// #endregion

const shaPattern = /^[a-f0-9]{40}$/u;
const bot = 'dependabot[bot]';

/**
 * Creates the trusted, dependency-free Dependabot reconciliation controller.
 * The caller executes this default-branch module without installing pull-request code.
 * @param suppliedConfiguration - Fixed repository, verification and continuation policy.
 * @param dependencies - Injected REST and waiting boundaries for deterministic tests.
 * @returns Reconciliation and workflow-environment entry points.
 */
export function createDependabotAutomation(suppliedConfiguration, dependencies = {}) {
    const request = dependencies.request ?? requestGitHub;
    const wait = dependencies.wait ?? (() => delay(750));
    let configuration = suppliedConfiguration;

    async function config() {
        configuration ??= JSON.parse(await readFile('.github/dependabot-automation.json', 'utf8'));
        if (!/^pixel-brewery\/[a-z0-9-]+$/u.test(configuration.repository) ||
            !Number.isSafeInteger(configuration.repositoryId) || configuration.repositoryId <= 0 ||
            !/^[a-z0-9-]+\.yml$/u.test(configuration.workflowFile) ||
            !Array.isArray(configuration.requiredJobs) || !configuration.requiredJobs.length)
            throw new Error('Invalid trusted Dependabot configuration.');
        return configuration;
    }

    async function dispatch(file, ref, sha, inputKey = 'expected_head_sha', onlyIfBlocked = false) {
        const c = await config();
        const path = `repos/${c.repository}/actions/workflows/${file}`;
        const runs = await request('GET', `${path}/runs?head_sha=${sha}&per_page=100`);
        if (!Array.isArray(runs?.workflow_runs)) throw new Error('Unable to verify workflow continuation.');
        if (runs.workflow_runs.some((run) => run.head_sha === sha && run.event === 'workflow_dispatch')) return;
        if (onlyIfBlocked && runs.workflow_runs.some((run) => run.head_sha === sha && run.event === 'pull_request' &&
            run.conclusion !== 'action_required' && run.status !== 'waiting')) return;
        await request('POST', `${path}/dispatches`, { ref, inputs: { [inputKey]: sha } });
    }

    async function continueMerge(pull, files) {
        const c = await config();
        const root = `repos/${c.repository}`;
        if (!shaPattern.test(pull.merge_commit_sha ?? '')) return { status: 'skipped', reason: 'missing-merge-sha' };
        const main = await request('GET', `${root}/branches/main`);
        if (main?.commit?.sha !== pull.merge_commit_sha) return { status: 'skipped', reason: 'superseded-merge' };
        for (const workflow of c.postMergeWorkflows ?? []) {
            if (!workflow.paths || files.some((file) => workflow.paths.some((prefix) => file.filename.startsWith(prefix))))
                await dispatch(workflow.file, 'main', pull.merge_commit_sha, workflow.inputKey);
        }
        return { status: 'continued', sha: pull.merge_commit_sha };
    }

    function sameRepository(repo, c) {
        return repo?.full_name === c.repository && repo.id === c.repositoryId;
    }

    function eligiblePull(pull, c, open = true) {
        return Number.isSafeInteger(pull?.number) && pull.number > 0 &&
            pull.user?.login === bot && pull.user?.type === 'Bot' &&
            sameRepository(pull.base?.repo, c) && sameRepository(pull.head?.repo, c) &&
            pull.base.ref === 'main' && pull.draft === false &&
            shaPattern.test(pull.head.sha ?? '') &&
            /^dependabot\/[a-zA-Z0-9_./-]+$/u.test(pull.head.ref ?? '') &&
            !pull.head.ref.includes('..') && !pull.head.ref.includes('//') &&
            (open ? pull.state === 'open' && pull.merged !== true && pull.merged_at == null : pull.state === 'closed' && pull.merged === true);
    }

    async function pullFiles(pull) {
        const c = await config();
        const files = [];
        for (let page = 1; page <= 10; page++) {
            const batch = await request('GET', `repos/${c.repository}/pulls/${pull.number}/files?per_page=100&page=${page}`);
            if (!Array.isArray(batch) || batch.length > 100) throw new Error('Invalid pull-request file inventory.');
            files.push(...batch);
            if (batch.length < 100) return files;
        }
        throw new Error('Pull-request file inventory exceeds its bound.');
    }

    async function jsonAt(path, ref) {
        const c = await config();
        const file = await request('GET', `repos/${c.repository}/contents/${path}?ref=${ref}`);
        if (file?.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Invalid dependency metadata.');
        return { value: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), file };
    }

    async function dependencyOnly(pull, files) {
        const c = await config();
        if (!files.length || files.length > 100) return false;
        for (const file of files) {
            if (typeof file.filename !== 'string' || !['modified', 'added'].includes(file.status)) return false;
            if (file.filename.split('/').some((part) => !part || part === '.' || part === '..')) return false;
            if (/^(?:[^/]+\/)*package\.json$/u.test(file.filename)) {
                if (file.status !== 'modified') return false;
                const before = (await jsonAt(file.filename, pull.base.sha)).value;
                const after = (await jsonAt(file.filename, pull.head.sha)).value;
                for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'resolutions', 'overrides']) {
                    delete before[key]; delete after[key];
                }
                if (JSON.stringify(before) !== JSON.stringify(after)) return false;
            } else if (/^(?:[^/]+\/)*(?:package-lock\.json|yarn\.lock|npm-shrinkwrap\.json)$/u.test(file.filename)) {
                // Resolved dependency metadata is verified by the complete read-only CI.
            } else if (/^\.github\/workflows\/[a-zA-Z0-9_.-]+\.ya?ml$/u.test(file.filename)) {
                if (file.status !== 'modified' || typeof file.patch !== 'string') return false;
                const changes = file.patch.split('\n').filter((line) => /^[+-]/u.test(line) && !/^(?:---|\+\+\+)/u.test(line));
                if (!Number.isSafeInteger(file.additions) || !Number.isSafeInteger(file.deletions) || changes.length !== file.additions + file.deletions) return false;
                if (!changes.length || changes.some((line) => !/^[+-]\s*-?\s*uses:\s*[^\s]+@[a-zA-Z0-9._/-]+(?:\s*#.*)?$/u.test(line))) return false;
                const owners = (sign) => changes.filter((line) => line.startsWith(sign)).map((line) => line.match(/uses:\s*([^\s]+)@/u)?.[1]).sort();
                if (JSON.stringify(owners('-')) !== JSON.stringify(owners('+'))) return false;
            } else return false;
        }
        return c.repositoryId === pull.base.repo.id;
    }

    async function normalizeRoot(pull, files) {
        const c = await config();
        if (!c.normalizeMosaikLockRoot || !files.some((file) => file.filename === 'package-lock.json')) return pull;
        const manifest = (await jsonAt('package.json', pull.head.sha)).value;
        const locked = await jsonAt('package-lock.json', pull.head.sha);
        const root = locked.value.packages?.[''];
        if (!root || locked.value.lockfileVersion !== 3) throw new Error('Unsupported lockfile normalization.');
        let changed = false;
        for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
            for (const [name, value] of Object.entries(manifest[group] ?? {})) {
                if (!name.startsWith('@pixel-brewery/mosaik-') || value !== 'latest') continue;
                if (root[group]?.[name] === '*') { root[group][name] = value; changed = true; }
                else if (root[group]?.[name] !== value) throw new Error('Unexpected Mosaik root specification.');
            }
        }
        if (!changed) return pull;
        const prefix = `repos/${c.repository}`;
        const commit = await request('GET', `${prefix}/git/commits/${pull.head.sha}`);
        const tree = await request('POST', `${prefix}/git/trees`, {
            base_tree: commit.tree.sha,
            tree: [{ path: 'package-lock.json', mode: '100644', type: 'blob', content: JSON.stringify(locked.value, null, 2) + '\n' }],
        });
        const repaired = await request('POST', `${prefix}/git/commits`, {
            message: 'chore(deps): preserve Mosaik manifest specifications', tree: tree.sha, parents: [pull.head.sha],
        });
        if (!shaPattern.test(repaired?.sha ?? '')) throw new Error('Invalid reconciliation commit.');
        await request('PATCH', `${prefix}/git/refs/heads/${pull.head.ref}`, { sha: repaired.sha, force: false });
        return await request('GET', `${prefix}/pulls/${pull.number}`);
    }

    async function protectedMain() {
        const c = await config();
        const rules = await request('GET', `repos/${c.repository}/rules/branches/main`);
        if (!Array.isArray(rules) || !rules.some((rule) => rule.type === 'pull_request')) return false;
        const checks = rules.filter((rule) => rule.type === 'required_status_checks');
        return checks.some((rule) => rule.parameters?.strict_required_status_checks_policy === true &&
            (c.requiredChecks ?? c.requiredJobs).every((name) => rule.parameters.required_status_checks?.some((check) => check.context === name && check.integration_id === 15368)));
    }

    async function verifiedRun(pull) {
        const c = await config();
        const prefix = `repos/${c.repository}`;
        const workflow = await request('GET', `${prefix}/actions/workflows/${c.workflowFile}`);
        if (workflow?.name !== c.workflowName || workflow?.path !== `.github/workflows/${c.workflowFile}`) return;
        const response = await request('GET', `${prefix}/actions/workflows/${c.workflowFile}/runs?head_sha=${pull.head.sha}&per_page=100`);
        if (!Array.isArray(response?.workflow_runs)) throw new Error('Invalid verification inventory.');
        const runs = response.workflow_runs.filter((run) => run.workflow_id === workflow.id &&
            ['pull_request', 'workflow_dispatch'].includes(run.event) && run.head_sha === pull.head.sha && run.head_branch === pull.head.ref &&
            !(run.event === 'pull_request' && (run.conclusion === 'action_required' || run.status === 'waiting')) &&
            sameRepository(run.repository, c) && sameRepository(run.head_repository, c)).sort((a, b) => b.id - a.id);
        const run = runs[0];
        if (!run || run.status !== 'completed' || run.conclusion !== 'success' || !Number.isSafeInteger(run.run_attempt)) return;
        const associated = await request('GET', `${prefix}/commits/${run.head_sha}/pulls?per_page=100`);
        if (!Array.isArray(associated) || associated.filter((item) => eligiblePull(item, c) && item.head.sha === run.head_sha).length !== 1 ||
            !associated.some((item) => item.number === pull.number && eligiblePull(item, c))) return;
        const jobs = await request('GET', `${prefix}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
        if (jobs?.total_count !== c.requiredJobs.length || !Array.isArray(jobs.jobs) || jobs.jobs.length !== c.requiredJobs.length) return;
        const remaining = new Set(c.requiredJobs);
        if (!jobs.jobs.every((job) => remaining.delete(job.name) && job.run_id === run.id && job.status === 'completed' && job.conclusion === 'success')) return;
        if (remaining.size) return;
        return run;
    }

    async function reconcile(number) {
        const c = await config();
        const prefix = `repos/${c.repository}`;
        let pull = await request('GET', `${prefix}/pulls/${number}`);
        const files = await pullFiles(pull);
        if (eligiblePull(pull, c, false)) return continueMerge(pull, files);
        if (!eligiblePull(pull, c)) return { status: 'skipped', reason: 'ineligible-pull-request' };
        if (!(await dependencyOnly(pull, files))) return { status: 'skipped', reason: 'non-dependency-change' };
        if (!(await protectedMain())) return { status: 'skipped', reason: 'protection-required' };
        let main = await request('GET', `${prefix}/branches/main`);
        if (!shaPattern.test(main?.commit?.sha ?? '')) throw new Error('Invalid default branch.');
        let comparison = await request('GET', `${prefix}/compare/${main.commit.sha}...${pull.head.sha}`);
        const originalHead = pull.head.sha;
        if (comparison?.behind_by !== 0 || comparison?.merge_base_commit?.sha !== main.commit.sha) {
            await request('PUT', `${prefix}/pulls/${number}/update-branch`, { expected_head_sha: pull.head.sha });
            for (let attempt = 0; attempt < 8; attempt++) {
                await wait();
                pull = await request('GET', `${prefix}/pulls/${number}`);
                if (!eligiblePull(pull, c)) return { status: 'skipped', reason: 'pull-request-changed' };
                if (pull.head.sha !== originalHead) break;
            }
            if (pull.head.sha === originalHead) return { status: 'waiting', reason: 'branch-refresh-pending' };
        }
        pull = await normalizeRoot(pull, files);
        if (!eligiblePull(pull, c)) return { status: 'skipped', reason: 'pull-request-changed' };
        if (pull.head.sha !== originalHead) {
            await dispatch(c.workflowFile, pull.head.ref, pull.head.sha);
            return { status: 'updated', head: pull.head.sha };
        }
        const run = await verifiedRun(pull);
        if (!run) {
            await dispatch(c.workflowFile, pull.head.ref, pull.head.sha, 'expected_head_sha', true);
            return { status: 'waiting', reason: 'verification-required' };
        }
        const currentPull = await request('GET', `${prefix}/pulls/${number}`);
        const currentRun = await request('GET', `${prefix}/actions/runs/${run.id}`);
        main = await request('GET', `${prefix}/branches/main`);
        comparison = await request('GET', `${prefix}/compare/${main.commit.sha}...${pull.head.sha}`);
        if (!eligiblePull(currentPull, c) || currentPull.head.sha !== pull.head.sha ||
            currentRun?.head_sha !== pull.head.sha || currentRun.head_branch !== pull.head.ref || currentRun.workflow_id !== run.workflow_id || currentRun.run_attempt !== run.run_attempt ||
            currentRun.status !== 'completed' || currentRun.conclusion !== 'success' ||
            comparison?.behind_by !== 0 || comparison?.merge_base_commit?.sha !== main.commit.sha)
            return { status: 'skipped', reason: 'verification-changed' };
        const merged = await request('PUT', `${prefix}/pulls/${number}/merge`, { sha: pull.head.sha, merge_method: 'squash' });
        if (merged?.merged !== true || !shaPattern.test(merged.sha ?? '')) throw new Error('GitHub did not confirm the dependency merge.');
        const confirmed = await request('GET', `${prefix}/pulls/${number}`);
        if (!eligiblePull(confirmed, c, false) || confirmed.merge_commit_sha !== merged.sha) throw new Error('Dependency merge confirmation changed.');
        await continueMerge(confirmed, files);
        return { status: 'merged', number, sha: merged.sha };
    }

    async function runFromEnvironment() {
        const c = await config();
        if (process.env.GITHUB_REPOSITORY !== c.repository || !['workflow_run', 'schedule', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))
            throw new Error('Unsupported Dependabot controller context.');
        const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
        const numbers = new Set();
        if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
            const run = await request('GET', `repos/${c.repository}/actions/runs/${event.workflow_run.id}`);
            if (run.name !== c.workflowName || !sameRepository(run.repository, c) || !sameRepository(run.head_repository, c))
                throw new Error('Unexpected triggering workflow.');
            const associated = await request('GET', `repos/${c.repository}/commits/${run.head_sha}/pulls?per_page=100`);
            if (!Array.isArray(associated)) throw new Error('Invalid triggering association.');
            for (const pull of associated) if (pull.user?.login === bot) numbers.add(pull.number);
        }
        const open = await request('GET', `repos/${c.repository}/pulls?state=open&base=main&per_page=100`);
        if (!Array.isArray(open)) throw new Error('Invalid open-pull inventory.');
        for (const pull of open) if (pull.user?.login === bot) numbers.add(pull.number);
        const closed = await request('GET', `repos/${c.repository}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=20`);
        if (!Array.isArray(closed)) throw new Error('Invalid continuation inventory.');
        for (const pull of closed) {
            if (pull.user?.login === bot && typeof pull.merged_at === 'string' && Date.parse(pull.merged_at) > Date.now() - 7 * 24 * 60 * 60 * 1000)
                numbers.add(pull.number);
        }
        const results = [];
        for (const number of [...numbers].slice(0, 30)) {
            try { results.push(await reconcile(number)); }
            catch (error) { results.push({ status: 'failed', number, reason: error instanceof Error ? error.message.slice(0, 512) : 'reconciliation-failed' }); }
        }
        console.log(JSON.stringify(results));
        const failed = results.filter((result) => result.status === 'failed');
        if (failed.length) throw new Error(`Dependabot reconciliation failed for pull requests: ${failed.map((result) => result.number).join(', ')}. Other pull requests were still processed.`);
        return results;
    }

    return { reconcile, runFromEnvironment };
}

function requestGitHub(method, endpoint, body) {
    if (!process.env.GH_TOKEN) throw new Error('Missing workflow token.');
    try {
        const output = execFileSync('gh', ['api', '--hostname', 'github.com', '--method', method,
            '--header', 'Accept: application/vnd.github+json', '--header', 'X-GitHub-Api-Version: 2022-11-28',
            endpoint, ...(body === undefined ? [] : ['--input', '-'])], {
            encoding: 'utf8', input: body === undefined ? undefined : JSON.stringify(body),
            maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
        });
        return output.trim() ? JSON.parse(output) : undefined;
    } catch (error) {
        const status = String(error?.stderr ?? '').match(/\bHTTP (\d{3})\b/u)?.[1] ?? 'unknown';
        throw new Error(`Dependabot GitHub request failed: ${method} ${endpoint} (HTTP ${status}).`);
    }
}
