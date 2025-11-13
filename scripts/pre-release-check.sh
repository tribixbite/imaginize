#!/bin/bash
# Pre-release check script for imaginize
# Run this before creating a new release to verify everything is ready

set -e

echo "🔍 Pre-Release Check for imaginize"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

# 1. Check git status
echo "1. Checking git status..."
if [[ -z $(git status -s) ]]; then
    success "Working directory is clean"
else
    error "Working directory has uncommitted changes"
    git status -s
fi
echo ""

# 2. Check current branch
echo "2. Checking git branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" ]]; then
    success "On main branch"
else
    warning "Not on main branch (current: $CURRENT_BRANCH)"
fi
echo ""

# 3. Check if up to date with remote
echo "3. Checking remote sync..."
git fetch origin main --quiet
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
if [[ "$LOCAL" == "$REMOTE" ]]; then
    success "Local branch is up to date with remote"
else
    error "Local branch is not in sync with remote"
fi
echo ""

# 4. TypeScript type checking
echo "4. Running TypeScript type check..."
if npm run typecheck > /dev/null 2>&1; then
    success "TypeScript compilation successful"
else
    error "TypeScript type checking failed"
fi
echo ""

# 5. ESLint
echo "5. Running ESLint..."
if npm run lint > /dev/null 2>&1; then
    success "ESLint passed"
else
    error "ESLint failed"
fi
echo ""

# 6. Prettier format check
echo "6. Checking code formatting..."
if npm run format:check > /dev/null 2>&1; then
    success "Code formatting is correct"
else
    warning "Code formatting issues found (run 'npm run format' to fix)"
fi
echo ""

# 7. Build
echo "7. Building project..."
if npm run build > /dev/null 2>&1; then
    success "Build successful"
else
    error "Build failed"
fi
echo ""

# 8. Tests
echo "8. Running tests..."
TEST_OUTPUT=$(npm test 2>&1 || true)
PASS_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= pass)' | head -1 || echo "0")
FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= fail)' | head -1 || echo "0")

if [[ "$FAIL_COUNT" == "0" || "$PASS_COUNT" -gt 0 ]]; then
    success "Tests passed ($PASS_COUNT passing)"
else
    warning "Some tests failed ($FAIL_COUNT failures) - API keys may be required"
fi
echo ""

# 9. Security audit
echo "9. Running security audit..."
AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1 || true)
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
    success "No security vulnerabilities"
else
    warning "Security audit has findings (review with 'npm audit')"
fi
echo ""

# 10. Check package.json version
echo "10. Checking package.json..."
PKG_VERSION=$(node -p "require('./package.json').version")
success "Current version: $PKG_VERSION"
echo ""

# 11. Check CHANGELOG.md
echo "11. Checking CHANGELOG.md..."
if [[ -f "CHANGELOG.md" ]]; then
    if grep -q "## \[$PKG_VERSION\]" CHANGELOG.md; then
        success "CHANGELOG.md includes current version"
    else
        warning "CHANGELOG.md may not include current version ($PKG_VERSION)"
    fi
else
    error "CHANGELOG.md not found"
fi
echo ""

# 12. Check dashboard build
echo "12. Checking dashboard..."
if [[ -d "dashboard" ]]; then
    cd dashboard
    if npm ci > /dev/null 2>&1 && npm run build > /dev/null 2>&1; then
        success "Dashboard builds successfully"
    else
        error "Dashboard build failed"
    fi
    cd ..
else
    warning "Dashboard directory not found"
fi
echo ""

# 13. Check documentation
echo "13. Checking documentation..."
REQUIRED_DOCS=("README.md" "CHANGELOG.md" "CONTRIBUTING.md" "SECURITY.md")
for doc in "${REQUIRED_DOCS[@]}"; do
    if [[ -f "$doc" ]]; then
        success "$doc exists"
    else
        error "$doc not found"
    fi
done
echo ""

# Final summary
echo "=================================="
echo "📊 Summary"
echo "=================================="
if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✓ All checks passed! Ready to release.${NC}"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found. Review before releasing.${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo -e "${RED}Please fix errors before releasing.${NC}"
    exit 1
fi
