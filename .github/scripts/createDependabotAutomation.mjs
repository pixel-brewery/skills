// #region Imports
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
 * @public
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
            !/^[a-f0-9]{64}$/u.test(configuration.reviewedCiSha256 ?? '') ||
            !Array.isArray(configuration.requiredJobs) || !configuration.requiredJobs.length)
            throw new Error('Invalid trusted Dependabot configuration.');
        return configuration;
    }

    async function workflow(file) {
        const c = await config();
        const value = await request('GET', `repos/${c.repository}/actions/workflows/${file}`);
        if (!Number.isSafeInteger(value?.id) || value.id <= 0 || value.path !== `.github/workflows/${file}` ||
            value.state !== 'active' || (file === c.workflowFile && value.name !== c.workflowName))
            throw new Error('Unexpected workflow identity.');
        return value;
    }

    async function workflowRuns(file, sha) {
        const c = await config();
        const runs = [];
        for (let page = 1; page <= 10; page++) {
            const response = await request('GET', `repos/${c.repository}/actions/workflows/${file}/runs?head_sha=${sha}&per_page=100${page === 1 ? '' : `&page=${page}`}`);
            if (!Array.isArray(response?.workflow_runs) || response.workflow_runs.length > 100)
                throw new Error('Invalid workflow inventory.');
            runs.push(...response.workflow_runs);
            if (response.workflow_runs.length < 100) return runs;
        }
        throw new Error('Workflow inventory exceeds its bound.');
    }

    function runIdentity(run, selected, c, branch, sha) {
        return Number.isSafeInteger(run?.id) && run.id > 0 && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0 &&
            run.workflow_id === selected.id && run.path === selected.path && run.name === selected.name &&
            run.head_sha === sha && run.head_branch === branch && sameRepository(run.repository, c) && sameRepository(run.head_repository, c);
    }

    async function dispatch(file, ref, sha, inputKey = 'expected_head_sha', onlyIfBlocked = false, pull) {
        const c = await config();
        const selected = await workflow(file);
        const runs = await workflowRuns(file, sha);
        const matches = (run) => runIdentity(run, selected, c, ref, sha);
        if (runs.some((run) => matches(run) && (run.event === 'workflow_dispatch' || (ref === 'main' && run.event === 'push')))) return;
        if (onlyIfBlocked && runs.some((run) => matches(run) && run.event === 'pull_request' &&
            run.conclusion !== 'action_required' && run.status !== 'waiting')) return;
        // Diagnostics are never branch-check proof. Every continuation remains bound
        // to a fresh live PR or the confirmed current merge before its only POST.
        if (ref === 'main') {
            const current = pull && await request('GET', `repos/${c.repository}/pulls/${pull.number}`);
            const main = await request('GET', `repos/${c.repository}/branches/main`);
            if (!eligiblePull(current, c, false) || current.merge_commit_sha !== sha || main?.commit?.sha !== sha) return;
        } else {
            const current = pull && await request('GET', `repos/${c.repository}/pulls/${pull.number}`);
            if (!eligiblePull(current, c) || current.head.ref !== ref || current.head.sha !== sha) return;
            const proof = await sourceProof(current, selected);
            if (!proof || !(await liveRefs(current, proof))) return;
        }
        await request('POST', `repos/${c.repository}/actions/workflows/${file}/dispatches`, { ref, inputs: { [inputKey]: sha } });
    }

    async function continueMerge(pull, files) {
        const c = await config();
        const root = `repos/${c.repository}`;
        if (!eligiblePull(pull, c, false) || !shaPattern.test(pull.merge_commit_sha ?? '')) return { status: 'skipped', reason: 'missing-merge-sha' };
        const main = await request('GET', `${root}/branches/main`);
        if (main?.commit?.sha !== pull.merge_commit_sha) return { status: 'skipped', reason: 'superseded-merge' };
        const associated = await request('GET', `${root}/commits/${pull.merge_commit_sha}/pulls?per_page=100`);
        if (!Array.isArray(associated) || associated.filter((item) => mergedAssociation(item, c, pull.merge_commit_sha)).length !== 1 ||
            !associated.some((item) => item.number === pull.number && mergedAssociation(item, c, pull.merge_commit_sha)))
            return { status: 'skipped', reason: 'ambiguous-merge-association' };
        for (const next of c.postMergeWorkflows ?? []) {
            if (!next.paths || files.some((file) => next.paths.some((prefix) => file.filename.startsWith(prefix))))
                await dispatch(next.file, 'main', pull.merge_commit_sha, next.inputKey, false, pull);
        }
        return { status: 'continued', sha: pull.merge_commit_sha };
    }

    function sameRepository(repo, c) {
        return repo?.full_name === c.repository && repo.id === c.repositoryId;
    }

    function ownPull(pull, c) {
        return Number.isSafeInteger(pull?.number) && pull.number > 0 &&
            pull.user?.login === bot && pull.user?.type === 'Bot' && pull.user.id === 49699333 &&
            sameRepository(pull.base?.repo, c) && sameRepository(pull.head?.repo, c) &&
            pull.base.ref === 'main' && pull.draft === false &&
            shaPattern.test(pull.head.sha ?? '') &&
            /^dependabot\/[a-zA-Z0-9_./-]+$/u.test(pull.head.ref ?? '') &&
            !pull.head.ref.includes('..') && !pull.head.ref.includes('//');
    }

    function eligiblePull(pull, c, open = true) {
        return ownPull(pull, c) && (open ? pull.state === 'open' && pull.merged !== true && pull.merged_at == null :
            pull.state === 'closed' && pull.merged === true && typeof pull.merged_at === 'string' && Number.isFinite(Date.parse(pull.merged_at)));
    }

    function mergedAssociation(pull, c, sha) {
        // Commit-association responses intentionally omit the full Pull DTO's
        // merged boolean. They select a candidate; GET /pulls/N still confirms
        // merged === true before any continuation can be dispatched.
        return ownPull(pull, c) && pull.state === 'closed' && pull.merged !== false && typeof pull.merged_at === 'string' &&
            Number.isFinite(Date.parse(pull.merged_at)) && pull.merge_commit_sha === sha;
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

    function nativeActor(actor) {
        return actor?.type === 'Bot' && ((actor.login === bot && actor.id === 49699333) ||
            (actor.login === 'github-actions[bot]' && actor.id === 41898282));
    }

    function pinInvariant(text) {
        return text.split('\n').map((line) => {
            const match = /^([ ]*(?:-\s+)?uses:\s+)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*)@([a-f0-9]{40})(?:[ ]+#\s*v?\d+(?:\.\d+)*(?:[.+-][a-zA-Z0-9_.-]+)?)?[ ]*$/u.exec(line);
            return match ? `${match[1]}${match[2]}@PIN` : line;
        }).join('\n');
    }

    function isReadonlyPullRequestWorkflow(mainSource, pullRequestSource, reviewedCiSha256) {
        if (typeof mainSource !== 'string' || typeof pullRequestSource !== 'string' || !/^[a-f0-9]{64}$/u.test(reviewedCiSha256 ?? '')) return false;
        const reviewed = pinInvariant(mainSource);
        return createHash('sha256').update(reviewed, 'utf8').digest('hex') === reviewedCiSha256 && reviewed === pinInvariant(pullRequestSource);
    }

    async function workflowSource(ref, path) {
        const c = await config();
        const file = await request('GET', `repos/${c.repository}/contents/${path}?ref=${ref}`);
        if (file?.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' || !shaPattern.test(file.sha ?? '')) return;
        const bytes = Buffer.from(file.content, 'base64');
        if (!bytes.length || bytes.length > 65_536 || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== file.sha) return;
        const text = bytes.toString('utf8');
        return Buffer.from(text, 'utf8').equals(bytes) ? text : undefined;
    }

    async function sourceProof(pull, selected) {
        const c = await config();
        if (!eligiblePull(pull, c)) return;
        const prefix = `repos/${c.repository}`;
        const main = await request('GET', `${prefix}/branches/main`);
        const M = main?.commit?.sha, B = pull.head.sha, C = pull.merge_commit_sha;
        if (!shaPattern.test(M ?? '') || pull.base.sha !== M || !shaPattern.test(C ?? '') || pull.mergeable !== true) return;
        const branch = await request('GET', `${prefix}/git/ref/heads/${pull.head.ref}`);
        const mergeRef = await request('GET', `${prefix}/git/ref/pull/${pull.number}/merge`);
        if (branch?.object?.type !== 'commit' || branch.object.sha !== B || mergeRef?.object?.type !== 'commit' || mergeRef.object.sha !== C) return;
        const comparison = await request('GET', `${prefix}/compare/${M}...${B}`);
        if (comparison?.behind_by !== 0 || comparison.merge_base_commit?.sha !== M) return;
        const candidate = await request('GET', `${prefix}/git/commits/${B}`);
        const merge = await request('GET', `${prefix}/git/commits/${C}`);
        if (candidate?.sha !== B || merge?.sha !== C || merge.parents?.length !== 2 || merge.parents[0].sha !== M || merge.parents[1].sha !== B ||
            !shaPattern.test(candidate.tree?.sha ?? '') || merge.tree?.sha !== candidate.tree.sha) return;
        const baseline = await workflowSource(M, selected.path);
        const proposed = await workflowSource(B, selected.path);
        if (!baseline || !proposed) return;
        // The attestation belongs to protected main after complete CI review.
        // It is never learned from pull-request configuration or API metadata.
        if (!isReadonlyPullRequestWorkflow(baseline, proposed, c.reviewedCiSha256)) return;
        return { M, B, C };
    }

    async function liveRefs(pull, proof) {
        const c = await config();
        const prefix = `repos/${c.repository}`;
        const current = await request('GET', `${prefix}/pulls/${pull.number}`);
        if (!eligiblePull(current, c) || current.base.sha !== proof.M || current.head.sha !== proof.B || current.head.ref !== pull.head.ref ||
            current.merge_commit_sha !== proof.C || current.mergeable !== true) return false;
        const main = await request('GET', `${prefix}/branches/main`);
        const branch = await request('GET', `${prefix}/git/ref/heads/${current.head.ref}`);
        const merge = await request('GET', `${prefix}/git/ref/pull/${current.number}/merge`);
        return main?.commit?.sha === proof.M && branch?.object?.type === 'commit' && branch.object.sha === proof.B &&
            merge?.object?.type === 'commit' && merge.object.sha === proof.C;
    }

    function nativeRun(run, selected, pull, c) {
        if (!Number.isSafeInteger(run?.actor?.id) || run.actor.id <= 0 || typeof run.actor.login !== 'string' || !['Bot', 'User'].includes(run.actor.type) ||
            !runIdentity(run, selected, c, pull.head.ref, pull.head.sha) || run.event !== 'pull_request' || !Array.isArray(run.pull_requests) || run.pull_requests.length !== 1) return false;
        const linked = run.pull_requests[0];
        return linked.number === pull.number && linked.base?.ref === 'main' && linked.base.sha === pull.base.sha && linked.base.repo?.id === c.repositoryId &&
            linked.head?.sha === pull.head.sha && linked.head.ref === pull.head.ref && linked.head.repo?.id === c.repositoryId;
    }

    async function selectedNativeRun(pull, selected) {
        const c = await config();
        const runs = (await workflowRuns(c.workflowFile, pull.head.sha)).filter((run) => nativeRun(run, selected, pull, c)).sort((a, b) => b.id - a.id);
        if (!runs.length) return;
        // Approval updates the attempt on the same run ID. A later diagnostic
        // dispatch cannot shadow this native run, and a stale list attempt cannot win.
        const current = await request('GET', `repos/${c.repository}/actions/runs/${runs[0].id}`);
        if (current?.id !== runs[0].id || !nativeRun(current, selected, pull, c)) return;
        return current;
    }

    async function uniqueAssociation(pull) {
        const c = await config();
        const associated = await request('GET', `repos/${c.repository}/commits/${pull.head.sha}/pulls?per_page=100`);
        return Array.isArray(associated) && associated.filter((item) => eligiblePull(item, c) && item.head.sha === pull.head.sha).length === 1 &&
            associated.some((item) => item.number === pull.number && eligiblePull(item, c) && item.head.sha === pull.head.sha);
    }

    async function verifiedRun(pull, authorize = false) {
        const c = await config();
        const prefix = `repos/${c.repository}`;
        const selected = await workflow(c.workflowFile);
        const proof = await sourceProof(pull, selected);
        if (!proof || !(await uniqueAssociation(pull))) return;
        const run = await selectedNativeRun(pull, selected);
        if (!run) return;
        if (run.status === 'completed' && run.conclusion === 'action_required') {
            if (!nativeActor(run.actor) || !nativeActor(run.triggering_actor)) return;
            if (!authorize) return { approvalRequired: true, id: run.id, run_attempt: run.run_attempt };
            const current = await request('GET', `${prefix}/pulls/${pull.number}`);
            const fresh = await sourceProof(current, selected);
            if (!fresh || fresh.M !== proof.M || fresh.B !== proof.B || fresh.C !== proof.C || !(await uniqueAssociation(current))) return;
            const latest = await selectedNativeRun(current, selected);
            if (!latest || latest.id !== run.id || latest.run_attempt !== run.run_attempt || latest.status !== 'completed' || latest.conclusion !== 'action_required' ||
                !nativeActor(latest.actor) || !nativeActor(latest.triggering_actor)) return;
            if (!(await protectedMain()) || !(await liveRefs(current, proof))) return;
            // The run is real, read-only and still tied to these exact live refs.
            // GitHub's normal required checks, not this approval, decide the merge.
            await request('POST', `${prefix}/actions/runs/${latest.id}/approve`);
            return { approval: true, id: latest.id, run_attempt: latest.run_attempt };
        }
        if (run.status !== 'completed' || run.conclusion !== 'success') return;
        const jobs = await request('GET', `${prefix}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
        if (jobs?.total_count !== c.requiredJobs.length || !Array.isArray(jobs.jobs) || jobs.jobs.length !== c.requiredJobs.length) return;
        const remaining = new Set(c.requiredJobs);
        if (!jobs.jobs.every((job) => remaining.delete(job.name) && job.run_id === run.id && job.head_sha === pull.head.sha && job.status === 'completed' && job.conclusion === 'success')) return;
        if (remaining.size) return;
        return { ...run, proof, selected };
    }

    async function authorize(number) {
        const c = await config();
        const pull = await request('GET', `repos/${c.repository}/pulls/${number}`);
        if (!eligiblePull(pull, c) || pull.number !== number) return { status: 'skipped', reason: 'ineligible-pull-request' };
        if (!(await dependencyOnly(pull, await pullFiles(pull)))) return { status: 'skipped', reason: 'non-dependency-change' };
        if (!(await protectedMain())) return { status: 'skipped', reason: 'protection-required' };
        const run = await verifiedRun(pull, true);
        return run?.approval ? { status: 'approved', number, runId: run.id, attempt: run.run_attempt } : { status: 'waiting', reason: 'native-authorization-not-required' };
    }

    async function reconcile(number) {
        const c = await config();
        const prefix = `repos/${c.repository}`;
        let pull = await request('GET', `${prefix}/pulls/${number}`);
        const files = await pullFiles(pull);
        if (eligiblePull(pull, c, false)) {
            if (!(await dependencyOnly(pull, files))) return { status: 'skipped', reason: 'non-dependency-change' };
            return continueMerge(pull, files);
        }
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
            await dispatch(c.workflowFile, pull.head.ref, pull.head.sha, 'expected_head_sha', false, pull);
            return { status: 'updated', head: pull.head.sha };
        }
        if (!(await dependencyOnly(pull, await pullFiles(pull)))) return { status: 'skipped', reason: 'non-dependency-change' };
        const run = await verifiedRun(pull);
        if (run?.approvalRequired) return { status: 'approval-required', number, runId: run.id, attempt: run.run_attempt };
        if (!run) {
            await dispatch(c.workflowFile, pull.head.ref, pull.head.sha, 'expected_head_sha', true, pull);
            return { status: 'waiting', reason: 'verification-required' };
        }
        const currentPull = await request('GET', `${prefix}/pulls/${number}`);
        const currentRun = await selectedNativeRun(currentPull, run.selected);
        const freshProof = await sourceProof(currentPull, run.selected);
        main = await request('GET', `${prefix}/branches/main`);
        comparison = await request('GET', `${prefix}/compare/${main.commit.sha}...${pull.head.sha}`);
        if (!(await protectedMain()) || !(await uniqueAssociation(currentPull)) || !eligiblePull(currentPull, c) || currentPull.head.sha !== pull.head.sha ||
            !freshProof || freshProof.M !== run.proof.M || freshProof.B !== run.proof.B || freshProof.C !== run.proof.C ||
            currentRun?.id !== run.id || currentRun.head_sha !== pull.head.sha || currentRun.head_branch !== pull.head.ref || currentRun.workflow_id !== run.workflow_id || currentRun.run_attempt !== run.run_attempt ||
            currentRun.status !== 'completed' || currentRun.conclusion !== 'success' ||
            comparison?.behind_by !== 0 || comparison?.merge_base_commit?.sha !== main.commit.sha || !(await liveRefs(currentPull, run.proof)))
            return { status: 'skipped', reason: 'verification-changed' };
        const merged = await request('PUT', `${prefix}/pulls/${number}/merge`, { sha: pull.head.sha, merge_method: 'squash' });
        if (merged?.merged !== true || !shaPattern.test(merged.sha ?? '')) throw new Error('GitHub did not confirm the dependency merge.');
        const confirmed = await request('GET', `${prefix}/pulls/${number}`);
        if (!eligiblePull(confirmed, c, false) || confirmed.merge_commit_sha !== merged.sha) throw new Error('Dependency merge confirmation changed.');
        await continueMerge(confirmed, files);
        return { status: 'merged', number, sha: merged.sha };
    }

    async function runFromEnvironment(mode = 'reconcile') {
        if (!['reconcile', 'authorize'].includes(mode)) throw new Error('Unsupported Dependabot controller mode.');
        const c = await config();
        if (process.env.GITHUB_REPOSITORY !== c.repository || process.env.GITHUB_REPOSITORY_ID !== String(c.repositoryId) || process.env.GITHUB_REF !== 'refs/heads/main' ||
            !['workflow_run', 'schedule', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))
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
        if (mode === 'reconcile') {
            const closed = await request('GET', `repos/${c.repository}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=20`);
            if (!Array.isArray(closed)) throw new Error('Invalid continuation inventory.');
            for (const pull of closed) {
                if (pull.user?.login === bot && typeof pull.merged_at === 'string' && Date.parse(pull.merged_at) > Date.now() - 7 * 24 * 60 * 60 * 1000)
                    numbers.add(pull.number);
            }
            // Recover the current merge directly as well: unrelated issue activity
            // cannot evict it from the recent-closed inventory used by scheduled retries.
            const main = await request('GET', `repos/${c.repository}/branches/main`);
            if (!shaPattern.test(main?.commit?.sha ?? '')) throw new Error('Invalid continuation source.');
            const current = await request('GET', `repos/${c.repository}/commits/${main.commit.sha}/pulls?per_page=100`);
            if (!Array.isArray(current)) throw new Error('Invalid current-merge association.');
            for (const pull of current) if (mergedAssociation(pull, c, main.commit.sha)) numbers.add(pull.number);
        }
        const results = [];
        for (const number of [...numbers].slice(0, 30)) {
            try { results.push(await (mode === 'authorize' ? authorize(number) : reconcile(number))); }
            catch (error) { results.push({ status: 'failed', number, reason: error instanceof Error ? error.message.slice(0, 512) : 'reconciliation-failed' }); }
        }
        console.log(JSON.stringify(results));
        const failed = results.filter((result) => result.status === 'failed');
        if (failed.length) throw new Error(`Dependabot reconciliation failed for pull requests: ${failed.map((result) => result.number).join(', ')}. Other pull requests were still processed.`);
        return results;
    }

    return { reconcile, authorize, runFromEnvironment };
}

function requestGitHub(method, endpoint, body) {
    if (!process.env.GH_TOKEN) throw new Error('Missing workflow token.');
    let status;
    try {
        const output = execFileSync('gh', ['api', '--hostname', 'github.com', '--method', method,
            '--header', 'Accept: application/vnd.github+json', '--header', 'X-GitHub-Api-Version: 2022-11-28',
            endpoint, ...(body === undefined ? [] : ['--input', '-'])], {
            encoding: 'utf8', input: body === undefined ? undefined : JSON.stringify(body),
            maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
        });
        return output.trim() ? JSON.parse(output) : undefined;
    } catch (error) {
        status = String(error?.stderr ?? '').match(/\bHTTP (\d{3})\b/u)?.[1] ?? 'unknown';
    }
    // Translate the command failure after discarding its raw response-bearing cause.
    throw new Error(`Dependabot GitHub request failed: ${method} ${endpoint} (HTTP ${status}).`);
}
