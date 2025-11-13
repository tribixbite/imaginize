# Manual Actions Required for v2.6.2 Release

**Status:** 1 action requires manual intervention via GitHub web UI

## ⚠️ GitHub Actions NPM_TOKEN Refresh

### Issue Description

**Problem:** Automated npm publishing workflow fails with ENEEDAUTH error

**Root Cause:** NPM_TOKEN secret expired in GitHub repository settings

**Evidence:**
```
Run npm publish
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
npm error need auth You need to authorize this machine using `npm adduser`
```

**Workaround Used:** Manual `npm publish` from CLI succeeded for v2.6.1 and v2.6.2

---

### Required Action

**Location:** GitHub Repository Settings → Secrets and variables → Actions

**Steps:**

1. **Generate new NPM token:**
   ```bash
   # Login to npm if not already
   npm login

   # Generate automation token (recommended for CI/CD)
   npm token create --type=automation
   ```

   **Token Type:** Automation (not legacy)
   **Permissions:** Publish access to `imaginize` package
   **Copy the token** - it will only be shown once

2. **Update GitHub secret:**
   - Navigate to: https://github.com/tribixbite/imaginize/settings/secrets/actions
   - Find `NPM_TOKEN` secret (or create if missing)
   - Click "Update" (or "New repository secret")
   - **Name:** `NPM_TOKEN`
   - **Value:** Paste the automation token from step 1
   - Click "Update secret" (or "Add secret")

3. **Verify workflow:**
   - Navigate to: https://github.com/tribixbite/imaginize/actions
   - Find most recent failed "Publish to npm" workflow
   - Click "Re-run failed jobs"
   - Verify workflow completes successfully

---

### Current Status

**v2.6.2 Publication:**
- ✅ Manually published to npm: https://www.npmjs.com/package/imaginize
- ✅ Version 2.6.2 live on npm registry
- ✅ Git tag v2.6.2 created and pushed
- ⚠️ GitHub Actions workflow: BLOCKED (requires NPM_TOKEN refresh)

**Workflow File:** `.github/workflows/publish.yml` (if exists)

---

### Impact Assessment

**Severity:** Low - Manual workaround available

**Impact:**
- Automated releases require manual `npm publish` step
- GitHub Releases may not be created automatically
- No impact on package functionality or availability
- Minor inconvenience for maintainers

**Frequency:** Only affects new version releases

---

### Alternative Approaches

#### Option 1: Use npm automation token (Recommended)

As described above. Best for CI/CD environments.

**Pros:**
- Purpose-built for automation
- Can be scoped to specific packages
- Revocable without affecting account

**Cons:**
- Requires npm account with publish permissions

#### Option 2: Use npm legacy token

```bash
npm token create --type=legacy
```

**Pros:**
- Simpler to create

**Cons:**
- Less secure (full account access)
- Not recommended for CI/CD by npm

#### Option 3: Continue manual publishing

Keep using manual `npm publish` for all releases.

**Pros:**
- No GitHub secrets needed
- Full control over publishing

**Cons:**
- Manual step required
- Potential for human error
- Not scalable for frequent releases

---

### Verification Steps

After updating NPM_TOKEN, verify with a test push:

1. Make a trivial change (e.g., add comment to README)
2. Update version in package.json to 2.6.3-test
3. Commit and push
4. Trigger workflow manually or via push
5. Verify workflow succeeds
6. Delete test version: `npm unpublish imaginize@2.6.3-test`
7. Revert version change

---

### Documentation References

- **npm tokens:** https://docs.npmjs.com/about-access-tokens
- **GitHub secrets:** https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **V2.6.2_ROADMAP.md:** Line 248-252 (GitHub Actions NPM_TOKEN Refresh)
- **RELEASE_NOTES_v2.6.2.md:** Known Issues section

---

### Timeline

**Issue Discovered:** November 12, 2025 (v2.6.1 publication)
**Workaround Applied:** Manual publishing for v2.6.1 and v2.6.2
**Status:** Documented, awaiting manual token refresh
**Priority:** Low (manual workaround functional)

---

## Summary

v2.6.2 is fully published and functional. The only remaining item is refreshing the GitHub Actions NPM_TOKEN secret to re-enable automated publishing for future releases. This is a one-time action that requires GitHub repository admin access via web UI.

**Action Owner:** Repository administrator with GitHub Settings access
**Estimated Time:** 5 minutes
**Required Access:** GitHub repo settings, npm account with publish permissions

---

Last Updated: November 12, 2025
Status: Awaiting manual GitHub UI action
