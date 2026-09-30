# Bislig Hub — Release Checklist (feature fixes)

Follow in order. Stop at the first failing step.

## 1. Scope lock
- [ ] Change matches the declared task scope and `docs/protected-system-contract.md`
- [ ] No protected-area edits unless explicitly approved (see `npm run guardrails` warnings)
- [ ] No `bislig-ride`, no other Vercel project, no unrelated UI touched

## 2. Validate
- [ ] `npx tsc -b` — 0 errors
- [ ] `npm run lint` — 0 warnings/errors
- [ ] `npm run build` — succeeds
- [ ] `npm run guardrails` — passes (warnings reviewed, if any)

## 3. Review
- [ ] `git status --short` — only intended files (+ intended new files)
- [ ] `git diff --stat` — no out-of-scope files
- [ ] Applied migrations never modified (guardrails enforces this)
- [ ] New migration, if any: additive, idempotent, scoped; old ones untouched

## 4. Commit + push
- [ ] Focused commit message describing the fix
- [ ] No secrets, passwords, temp credentials, or `.env` content in the diff
- [ ] `git push origin master`; verify `HEAD == origin/master`

## 5. Deploy (existing project only)
- [ ] Project is `bislig-hub-app` (CLI link verified; never create/select another)
- [ ] `vercel --prod` completes; note the deployment ID
- [ ] Deployment status ● Ready, target production, alias on `bislig-hub-app.vercel.app`
- [ ] If the CLI stream drops, confirm via `vercel ls` / `vercel inspect` — do not assume failure

## 6. Live verify
- [ ] Required routes return HTTP 200
- [ ] Production bundle contains the change (chunk markers, never assumptions)
- [ ] If a migration was part of the release: verify live objects via read-only
      probes (anon 401 = exists-but-denied; 404 = absent) before calling it done

## 7. Report
- [ ] Files changed, commit hash, push result
- [ ] Deployment ID/URL/status, production URL
- [ ] Verification results (exact statuses, not summaries)
- [ ] Anything left for owner-side testing (credentials-gated flows)
