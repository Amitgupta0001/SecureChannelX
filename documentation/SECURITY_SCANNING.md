# Automated Security Scanning Setup

## Overview

This guide sets up **automated security scanning** for your SecureChannelX project using GitHub Actions. Scans run automatically on every push, pull request, and weekly.

---

## What Gets Scanned?

### Backend (Python)
- ✅ **pip-audit**: Known vulnerabilities in dependencies
- ✅ **Bandit**: Python security issues (SQL injection, hardcoded secrets, etc.)
- ✅ **Safety**: Security vulnerabilities database
- ✅ **Semgrep**: SAST (Static Application Security Testing)

### Frontend (JavaScript/React)
- ✅ **npm audit**: Known vulnerabilities in npm packages
- ✅ **ESLint Security**: Security-focused linting
- ✅ **Semgrep**: React security patterns
- ✅ **Snyk**: Comprehensive dependency scanning

### General
- ✅ **TruffleHog**: Secret detection (API keys, passwords in code)
- ✅ **Trivy**: Container and filesystem scanning
- ✅ **License Checker**: License compliance

---

## Setup (5 Minutes)

### 1. GitHub Actions (Already Created!)
The workflow file is already in `.github/workflows/security-scan.yml`

It will run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Weekly on Mondays at 9 AM

### 2. Optional: Add Snyk Token (Free)

Snyk provides better vulnerability detection:

1. Sign up at https://snyk.io/ (free)
2. Get your API token from Account Settings
3. Add to GitHub:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SNYK_TOKEN`
   - Value: Your Snyk API token

### 3. Enable GitHub Security Features

1. Go to your repo → Settings → Security
2. Enable:
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Code scanning (CodeQL)
   - ✅ Secret scanning

---

## Running Scans Locally

### Backend Security Scan
```bash
cd backend

# Install security tools
pip install pip-audit bandit safety

# Run vulnerability scan
pip-audit

# Run security linter
bandit -r app/

# Check for known vulnerabilities
safety check
```

### Frontend Security Scan
```bash
cd frontend

# Run npm audit
npm audit

# Fix automatically (if possible)
npm audit fix

# Install security linter
npm install --save-dev eslint-plugin-security

# Run security lint
npx eslint . --ext .js,.jsx --plugin security
```

### Secret Scanning
```bash
# Install TruffleHog
pip install trufflehog

# Scan for secrets
trufflehog filesystem . --json
```

---

## Understanding Results

### Severity Levels
- 🔴 **Critical**: Fix immediately
- 🟠 **High**: Fix soon (within days)
- 🟡 **Medium**: Fix in next sprint
- 🟢 **Low**: Fix when convenient
- ⚪ **Info**: Awareness only

### Common Findings

#### 1. Outdated Dependencies
**Finding**: Package X has known vulnerability
**Fix**: 
```bash
# Backend
pip install --upgrade package-name

# Frontend
npm update package-name
```

#### 2. Hardcoded Secrets
**Finding**: Possible API key in code
**Fix**: Move to environment variables
```python
# Bad
API_KEY = "sk-1234567890"

# Good
API_KEY = os.getenv("API_KEY")
```

#### 3. SQL Injection Risk
**Finding**: Potential SQL injection
**Fix**: Use parameterized queries (you're already using MongoDB, so this is less likely)

#### 4. XSS Vulnerability
**Finding**: Potential XSS in React
**Fix**: React auto-escapes, but avoid `dangerouslySetInnerHTML`

---

## Viewing Scan Results

### GitHub Actions
1. Go to your repo → Actions tab
2. Click on latest "Security Scanning" workflow
3. View results for each job:
   - Backend Security Scan
   - Frontend Security Scan
   - Secret Detection
   - SAST Analysis

### Security Tab
1. Go to your repo → Security tab
2. View:
   - Dependabot alerts
   - Code scanning alerts
   - Secret scanning alerts

### Download Reports
Scan reports are saved as artifacts:
1. Go to Actions → Latest run
2. Scroll to "Artifacts"
3. Download:
   - `bandit-security-report`
   - `npm-audit-report`

---

## Automated Fixes

### Dependabot (Automatic PRs)
Dependabot will automatically create PRs to update vulnerable dependencies.

**To enable**:
1. Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # Backend dependencies
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  # Frontend dependencies
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

2. Dependabot will create PRs automatically
3. Review and merge PRs

---

## Security Badges

Add security badges to your README:

```markdown
![Security Scan](https://github.com/yourusername/SecureChannelX/workflows/Security%20Scanning/badge.svg)
![Snyk Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/yourusername/SecureChannelX)
```

---

## Best Practices

### 1. Review Scan Results Weekly
- Check GitHub Security tab
- Review Dependabot PRs
- Fix critical/high vulnerabilities

### 2. Keep Dependencies Updated
```bash
# Backend
pip list --outdated
pip install --upgrade package-name

# Frontend
npm outdated
npm update
```

### 3. Never Commit Secrets
- Use `.env` files (add to `.gitignore`)
- Use environment variables
- Use Azure Key Vault for production

### 4. Monitor Security Advisories
- GitHub will email you about new vulnerabilities
- Subscribe to security mailing lists
- Follow CVE databases

---

## Integration with Azure DevOps (Optional)

If you prefer Azure Pipelines:

Create `azure-pipelines-security.yml`:
```yaml
trigger:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.10'

- script: |
    pip install pip-audit bandit safety
    cd backend
    pip-audit || true
    bandit -r app/ || true
    safety check || true
  displayName: 'Backend Security Scan'

- task: NodeTool@0
  inputs:
    versionSpec: '18.x'

- script: |
    cd frontend
    npm ci
    npm audit || true
  displayName: 'Frontend Security Scan'
```

---

## Cost

All tools used are **FREE** for open-source projects:
- ✅ GitHub Actions: 2,000 minutes/month free
- ✅ Snyk: Free for open source
- ✅ Dependabot: Free
- ✅ CodeQL: Free for public repos
- ✅ All scanning tools: Free

---

## Summary

✅ **Automated scanning**: Runs on every commit  
✅ **Multiple tools**: Comprehensive coverage  
✅ **Zero cost**: All tools are free  
✅ **Easy setup**: Already configured!  

**Your project now has enterprise-grade automated security scanning!**

Just push your code and GitHub Actions will automatically scan for vulnerabilities.
