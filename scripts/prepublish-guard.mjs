#!/usr/bin/env node
/**
 * prepublishOnly guard for every published @openmascot/* package.
 *
 * `pnpm release` (what the release workflow runs) verifies the whole
 * workspace once — `pnpm check`, `pnpm build`, `pnpm smoke:pack` — and then
 * publishes with OPENMASCOT_RELEASE_VERIFIED=1. Any other publish (someone
 * running `pnpm publish` in a package by hand) runs that verification first,
 * so nothing reaches npm without passing the checks.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (process.env.OPENMASCOT_RELEASE_VERIFIED === '1') process.exit(0);

const root = fileURLToPath(new URL('..', import.meta.url));
if (!existsSync(`${root}/pnpm-workspace.yaml`)) {
  console.error('prepublish-guard: not inside the OpenMascot workspace');
  process.exit(1);
}
console.log(`prepublish-guard: verifying the workspace before publishing ${process.env.npm_package_name ?? ''}…`);
execSync('pnpm release:verify', { cwd: root, stdio: 'inherit' });
