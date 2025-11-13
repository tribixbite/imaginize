# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions of imaginize:

| Version | Supported          |
| ------- | ------------------ |
| 2.6.x   | :white_check_mark: |
| 2.5.x   | :white_check_mark: |
| 2.4.x   | :x:                |
| < 2.4   | :x:                |

**Current stable version:** 2.6.2

We recommend always using the latest version available on npm:
```bash
npm install imaginize@latest
```

---

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in imaginize, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues via one of these methods:

1. **GitHub Security Advisories** (Preferred)
   - Navigate to the [Security tab](https://github.com/tribixbite/imaginize/security/advisories)
   - Click "Report a vulnerability"
   - Fill out the advisory form with details

2. **Email**
   - Send details to the repository maintainers
   - Include "SECURITY" in the subject line
   - Check GitHub repository for contact information

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear description of the vulnerability
- **Impact**: What an attacker could achieve
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are affected
- **Proof of Concept**: Code, screenshots, or logs demonstrating the issue
- **Suggested Fix**: If you have ideas for how to fix it (optional)

### Example Report

```markdown
## Vulnerability: Command Injection in File Processing

**Severity:** High

**Affected Versions:** 2.5.0 - 2.6.1

**Description:**
The EPUB parsing functionality does not properly sanitize filenames,
allowing command injection when processing malicious EPUB files.

**Steps to Reproduce:**
1. Create EPUB with filename: `test$(whoami).epub`
2. Run: `imaginize --file test$(whoami).epub`
3. Observe command execution

**Impact:**
An attacker could execute arbitrary commands on the user's system
by providing a specially crafted EPUB file.

**Proof of Concept:**
[Attach malicious EPUB sample or code]

**Suggested Fix:**
Sanitize all filenames using path.basename() before processing.
```

---

## Response Timeline

When you report a security vulnerability, here's what to expect:

1. **Acknowledgment**: Within 48 hours of your report
2. **Initial Assessment**: Within 5 business days
3. **Status Update**: Weekly updates on progress
4. **Resolution**: Aim for fix within 30 days (varies by severity)
5. **Disclosure**: Public disclosure after patch is released

### Severity Levels

We assess vulnerabilities using the following severity levels:

- **Critical**: Remote code execution, authentication bypass
  - Response: Immediate (same day), patch within 7 days

- **High**: Privilege escalation, sensitive data exposure
  - Response: Within 2 days, patch within 14 days

- **Medium**: Denial of service, information disclosure
  - Response: Within 5 days, patch within 30 days

- **Low**: Minor information disclosure, low-impact issues
  - Response: Within 10 days, patch in next regular release

---

## Security Best Practices

### For Users

When using imaginize, follow these security best practices:

1. **API Keys**
   - Never commit API keys to version control
   - Use environment variables or config files (`.imaginize.config.json`)
   - Keep API keys in files listed in `.gitignore`
   - Rotate API keys periodically

2. **File Processing**
   - Only process EPUB/PDF files from trusted sources
   - Be cautious with files from unknown origins
   - Run in sandboxed environments when processing untrusted files

3. **Dependencies**
   - Keep imaginize updated: `npm update imaginize`
   - Run security audits: `npm audit`
   - Check for known vulnerabilities regularly

4. **Network Security**
   - Use HTTPS endpoints for API calls (default)
   - Be aware that API requests send book content to AI providers
   - Review OpenRouter/OpenAI privacy policies for your use case

### For Contributors

If you're contributing code:

1. **Input Validation**
   - Validate and sanitize all user inputs
   - Never execute user-provided strings as commands
   - Use parameterized queries/safe APIs

2. **Dependency Management**
   - Keep dependencies up to date
   - Audit new dependencies before adding: `npm audit`
   - Avoid dependencies with known vulnerabilities

3. **Secrets Management**
   - Never hardcode API keys or credentials
   - Don't log sensitive information
   - Use environment variables for secrets

4. **Code Review**
   - All PRs require review before merge
   - Security-sensitive changes require extra scrutiny
   - Test security implications of changes

---

## Known Security Considerations

### API Key Storage

**Issue:** imaginize stores API keys in `~/.imaginize.config.json`

**Mitigation:**
- File has restricted permissions (user-only read/write)
- Alternative: Use environment variables instead
- Keys are never logged or transmitted except to API endpoints

### File System Access

**Issue:** imaginize reads EPUB/PDF files and writes output files

**Mitigation:**
- All file operations use safe path resolution
- No arbitrary file system traversal
- Output directories are created with safe permissions

### Network Requests

**Issue:** imaginize sends book content to AI API providers

**Privacy Consideration:**
- Book text is sent to OpenRouter/OpenAI for processing
- Users should review provider privacy policies
- Consider sensitivity of book content before processing
- Use local LLM options when available (future feature)

### Dashboard WebSocket

**Issue:** Dashboard uses WebSocket for real-time updates (localhost only)

**Mitigation:**
- Default binding to localhost (127.0.0.1) only
- No authentication required (localhost trust model)
- Use `--dashboard-host 0.0.0.0` only on trusted networks
- No sensitive data transmitted over WebSocket

---

## Security Audits

We perform regular security reviews:

- **Code Reviews**: All PRs reviewed for security implications
- **Dependency Audits**: Weekly `npm audit` checks
- **SAST**: Static analysis on major releases
- **Penetration Testing**: Periodic security assessments

### Third-Party Security Tools

We use and recommend:

- **npm audit**: Dependency vulnerability scanning
- **Snyk**: Continuous security monitoring
- **Dependabot**: Automated dependency updates
- **GitHub Security Advisories**: Vulnerability database

---

## Security Updates

Security patches are released as follows:

1. **Critical/High**: Immediate patch release (e.g., 2.6.3)
2. **Medium**: Included in next minor release (e.g., 2.7.0)
3. **Low**: Included in next regular release

### Staying Informed

- **GitHub Security Advisories**: Subscribe for notifications
- **Release Notes**: Check CHANGELOG.md for security fixes
- **npm**: Watch the package for updates

---

## Disclosure Policy

### Coordinated Disclosure

We follow coordinated vulnerability disclosure:

1. **Private Reporting**: Report received privately
2. **Verification**: We confirm and assess the vulnerability
3. **Fix Development**: We develop and test a patch
4. **Release**: Patch released to npm and GitHub
5. **Public Disclosure**: Advisory published after users can update
6. **Credit**: Reporter credited (if desired) in advisory and changelog

### Public Disclosure

After a patch is released:

- GitHub Security Advisory published
- CHANGELOG.md updated with CVE (if assigned)
- Social media announcement (if critical)
- Credit given to reporter (unless they prefer anonymity)

---

## Scope

### In Scope

Security issues in:
- Core imaginize CLI code
- Dashboard web interface
- Dependency vulnerabilities
- Configuration handling
- File processing (EPUB/PDF parsing)
- API integration security

### Out of Scope

- Issues in third-party APIs (OpenRouter, OpenAI)
- User misconfiguration (e.g., committing API keys)
- Social engineering attacks
- Physical access to user's machine
- Issues requiring local code execution (user must run malicious code)

---

## Contact

For security concerns:

- **GitHub Security**: https://github.com/tribixbite/imaginize/security/advisories
- **General Issues**: https://github.com/tribixbite/imaginize/issues (non-security)

---

## Acknowledgments

We thank the security research community for helping keep imaginize secure. Security researchers who responsibly disclose vulnerabilities may be credited in:

- GitHub Security Advisory
- CHANGELOG.md
- Hall of Fame section (if we create one)

---

## Version History

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0     | 2025-11-13 | Initial security policy |

---

**Last Updated:** November 13, 2025
