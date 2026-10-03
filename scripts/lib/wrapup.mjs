#!/usr/bin/env node
/* Is this checkout safe to archive? Collects the facts a session needs before it says yes.

   node scripts/lib/wrapup.mjs [--json] [--worktrees]

   Checks, for the checkout in the current directory:
     uncommitted   modified, staged or untracked files (git status)
     unpushed      commits on this branch that no remote has
     pr            this branch's pull request and its state, via gh when available
     scratch       ignored scratch folders (.tmp/) that removing this worktree would delete
     running       dev servers and automation browsers started from this repository
     worktrees     other worktrees of this repository: merged ones are cleanup candidates,
                   dirty or unpushed ones hold work
   Prints BLOCKED with the reasons, or READY. Exit code 0 either way; 2 when not a git checkout.
   Read-only: changes nothing. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from './servers.mjs';

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 32 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const git = (args, cwd) => run('git', args, cwd);

function dirStats(dir) {
  let files = 0, bytes = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(p);
      else { files++; try { bytes += fs.statSync(p).size; } catch {} }
    }
  };
  try { walk(dir); } catch {}
  return { files, bytes };
}

function defaultBranch(cwd) {
  const r = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], cwd);
  return r.ok ? r.out.replace(/^origin\//, '') : 'main';
}

/* Commits on `ref` that no remote-tracking branch has. */
function unpushedCount(ref, cwd) {
  const r = git(['rev-list', '--count', ref, '--not', '--remotes'], cwd);
  return r.ok ? +r.out : null;
}

function prFor(branch, cwd) {
  if (!run('gh', ['--version']).ok) return { unavailable: 'gh not installed' };
  const r = run('gh', ['pr', 'list', '--head', branch, '--state', 'all', '--limit', '1', '--json', 'number,state,url,isDraft,mergeStateStatus'], cwd);
  if (!r.ok) return { unavailable: r.err.split('\n')[0] || 'gh failed' };
  const pr = JSON.parse(r.out || '[]')[0];
  return pr || null;
}

/* Branch -> head commits of its merged pull requests. Squash merges leave the branch's own
   commits off main, so "merged" means the worktree sits exactly on a merged PR head. */
function mergedPrHeads(cwd) {
  const r = run('gh', ['pr', 'list', '--state', 'merged', '--limit', '300', '--json', 'headRefName,headRefOid'], cwd);
  const heads = new Map();
  if (!r.ok) return heads;
  try {
    for (const p of JSON.parse(r.out)) heads.set(p.headRefName, [...(heads.get(p.headRefName) || []), p.headRefOid]);
  } catch {}
  return heads;
}

function worktrees(cwd, here, base) {
  const r = git(['worktree', 'list', '--porcelain'], cwd);
  if (!r.ok) return [];
  const merged = new Set(git(['branch', '--format=%(refname:short)', '--merged', `origin/${base}`], cwd).out.split('\n').filter(Boolean));
  const prHeads = mergedPrHeads(cwd);
  return r.out.split(/\r?\n\r?\n/).slice(1).map((block) => {
    const wt = { path: '', branch: null };
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) wt.path = path.normalize(line.slice(9));
      if (line.startsWith('branch ')) wt.branch = line.slice(7).replace('refs/heads/', '');
      if (line === 'prunable' || line.startsWith('prunable ')) wt.prunable = true;
    }
    return wt;
  }).filter((wt) => wt.path && path.resolve(wt.path).toLowerCase() !== path.resolve(here).toLowerCase()).map((wt) => {
    if (wt.prunable || !fs.existsSync(wt.path)) return { ...wt, state: 'missing folder (git worktree prune)' };
    const dirty = git(['status', '--porcelain'], wt.path).out.split('\n').filter(Boolean).length;
    const head = git(['rev-parse', 'HEAD'], wt.path).out;
    const isMerged = !!wt.branch && (merged.has(wt.branch) || (prHeads.get(wt.branch) || []).includes(head));
    const unpushed = wt.branch && !isMerged ? unpushedCount(wt.branch, cwd) : 0;
    const state = dirty ? `${dirty} uncommitted` : unpushed ? `${unpushed} unpushed` : isMerged ? 'merged, removable' : 'clean';
    return { ...wt, dirty, unpushed, state };
  });
}

export function wrapup(cwd = process.cwd()) {
  const top = git(['rev-parse', '--show-toplevel'], cwd);
  if (!top.ok) return null;
  const here = path.normalize(top.out);
  git(['fetch', '--quiet', 'origin'], here);
  const base = defaultBranch(here);
  const branch = git(['branch', '--show-current'], here).out || null;
  const status = git(['status', '--porcelain'], here).out.split('\n').filter(Boolean);
  const unpushed = branch ? unpushedCount(branch, here) : unpushedCount('HEAD', here);
  const pr = branch && branch !== base ? prFor(branch, here) : null;
  const scratch = ['.tmp'].map((d) => ({ dir: d, ...dirStats(path.join(here, d)) })).filter((s) => s.files);
  let running = [];
  let runningError = null;
  try {
    const common = path.dirname(path.resolve(here, git(['rev-parse', '--git-common-dir'], here).out));
    running = scan().filter((r) => r.worktree && path.resolve(r.worktree).toLowerCase().startsWith(common.toLowerCase()));
  } catch (err) { runningError = err.message; }
  const others = worktrees(here, here, base);

  const blockers = [];
  const notes = [];
  if (status.length) blockers.push(`${status.length} uncommitted change(s) in ${here}`);
  if (unpushed && pr?.state === 'MERGED') notes.push(`${unpushed} local commit(s) are not on a remote, but PR #${pr.number} merged; check they were part of it`);
  else if (unpushed) blockers.push(`${unpushed} commit(s) on ${branch || 'HEAD'} not on any remote`);
  if (!branch) notes.push('detached HEAD');
  if (pr?.state === 'OPEN') notes.push(`PR #${pr.number} is open, not merged (${pr.url})`);
  if (pr?.unavailable) notes.push(`PR check unavailable: ${pr.unavailable}`);
  for (const s of scratch) notes.push(`${s.dir}/ holds ${s.files} file(s), ${(s.bytes / 1e6).toFixed(1)} MB; removing this worktree deletes them`);
  const mine = running.filter((r) => path.resolve(r.worktree).toLowerCase().startsWith(here.toLowerCase()));
  if (mine.length) blockers.push(`${mine.length} server(s)/browser(s) still running from this checkout`);
  else if (running.length) notes.push(`${running.length} server(s)/browser(s) running from other worktrees of this repo`);
  if (runningError) notes.push(`running-process check failed: ${runningError}`);
  const holding = others.filter((w) => w.dirty || w.unpushed);
  const removable = others.filter((w) => w.state.startsWith('merged') || w.state.startsWith('missing'));
  if (holding.length) notes.push(`${holding.length} other worktree(s) hold uncommitted or unpushed work`);
  if (removable.length) notes.push(`${removable.length} other worktree(s) are merged or missing and can be removed`);

  return { checkout: here, branch, base, verdict: blockers.length ? 'BLOCKED' : 'READY', blockers, notes, uncommitted: status, unpushed, pr, scratch, running, worktrees: others };
}

function main(argv) {
  const r = wrapup();
  if (!r) { console.error('wrapup: not inside a git checkout'); return 2; }
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return 0; }
  console.log(`${r.verdict}: ${r.checkout} (${r.branch || 'detached'} -> ${r.base})`);
  for (const b of r.blockers) console.log(`  blocker: ${b}`);
  for (const n of r.notes) console.log(`  note: ${n}`);
  if (r.uncommitted.length) console.log(`  uncommitted:\n${r.uncommitted.slice(0, 20).map((s) => `    ${s}`).join('\n')}`);
  for (const s of r.running) console.log(`  running: ${s.ports.length ? ':' + s.ports.join(',:') : s.kind} pid ${s.pid} ${s.worktree}${s.purpose ? ` "${s.purpose}"` : ''}`);
  if (argv.includes('--worktrees')) for (const w of r.worktrees.filter((w) => w.state !== 'clean')) console.log(`  worktree: ${w.path} [${w.branch || 'detached'}] ${w.state}`);
  else if (r.worktrees.some((w) => w.state !== 'clean')) console.log('  (--worktrees lists the other worktrees)');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
