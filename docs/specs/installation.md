# Installation Specification

Platform-specific installation guides and setup procedures for imaginize.

## Overview

imaginize can be installed via:
1. **npm** - Package manager installation (recommended)
2. **npx** - One-time execution without installation
3. **Source** - Git clone for development

**Supported Platforms**:
- macOS (10.15+)
- Linux (Ubuntu 20.04+, Debian 11+, Fedora 36+)
- Windows (10/11 with WSL2 recommended)
- Termux (Android ARM64)

---

## System Requirements

### Core Requirements

**Node.js**:
- Version: 18.0.0 or higher
- Recommended: 20.x LTS
- Check: `node --version`

**npm**:
- Version: 9.0.0 or higher
- Included with Node.js
- Check: `npm --version`

**Disk Space**:
- Installation: ~50 MB
- Dependencies: ~150 MB
- Output files: Variable (depends on book size)

**Memory**:
- Minimum: 512 MB RAM
- Recommended: 2 GB RAM (for concurrent processing)

### API Requirements

**API Keys** (at least one required):

1. **OpenAI API Key**:
   - Format: `sk-...` (56+ characters)
   - Sign up: https://platform.openai.com/
   - Paid tier with usage-based pricing

2. **OpenRouter API Key** (free tier available):
   - Format: `sk-or-v1-...` (64+ characters)
   - Sign up: https://openrouter.ai/
   - Free tier: 1 request/minute

3. **Custom Endpoint**:
   - Self-hosted LLM (Ollama, LM Studio)
   - OpenAI-compatible API

---

## Installation Methods

### Method 1: npm Install (Recommended)

**Global Installation**:
```bash
npm install -g imaginize
```

**Benefits**:
- Available as `imaginize` command globally
- Automatic PATH configuration
- Easy updates with `npm update -g imaginize`

**Verification**:
```bash
imaginize --version
# Output: imaginize v2.7.0
```

**Local Installation** (project-specific):
```bash
npm install imaginize
npx imaginize --help
```

### Method 2: npx (One-Time Execution)

**Direct Execution**:
```bash
npx imaginize path/to/book.epub
```

**Benefits**:
- No installation required
- Always uses latest version
- No global npm pollution

**Drawbacks**:
- Slower first run (downloads package)
- Requires internet connection

### Method 3: Source Installation (Development)

**Clone Repository**:
```bash
git clone https://github.com/tribixbite/imaginize.git
cd imaginize
npm install
npm run build
```

**Link Globally**:
```bash
npm link
```

**Benefits**:
- Development access
- Modify source code
- Run tests locally

---

## Platform-Specific Installation

### macOS

**Prerequisites**:
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js via Homebrew
brew install node
```

**Install imaginize**:
```bash
npm install -g imaginize
```

**Troubleshooting**:

**Issue**: Permission denied during global install

**Solution**:
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g imaginize

# Option 2: Configure npm prefix (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
npm install -g imaginize
```

---

### Linux (Ubuntu/Debian)

**Prerequisites**:
```bash
# Update package lists
sudo apt update

# Install Node.js 20.x (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

**Install imaginize**:
```bash
npm install -g imaginize
```

**Troubleshooting**:

**Issue**: EACCES permission errors

**Solution**:
```bash
# Configure npm to use home directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g imaginize
```

---

### Linux (Fedora/RHEL)

**Prerequisites**:
```bash
# Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version
npm --version
```

**Install imaginize**:
```bash
npm install -g imaginize
```

---

### Windows

**Prerequisites**:

**Option 1: WSL2 (Recommended)**:
1. Install WSL2:
   ```powershell
   wsl --install
   ```
2. Install Ubuntu from Microsoft Store
3. Follow Linux installation steps in WSL2 terminal

**Option 2: Native Windows**:
1. Download Node.js installer: https://nodejs.org/
2. Run installer (select "Add to PATH")
3. Open Command Prompt or PowerShell

**Install imaginize**:
```powershell
npm install -g imaginize
```

**Troubleshooting**:

**Issue**: Command not found after installation

**Solution**:
- Restart terminal/Command Prompt
- Verify PATH: `echo $env:PATH` (PowerShell)
- Reinstall with admin privileges

**Issue**: Long path errors

**Solution**:
```powershell
# Enable long paths (admin PowerShell)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

---

### Termux (Android)

**Prerequisites**:
```bash
# Update packages
pkg update && pkg upgrade

# Install Node.js
pkg install nodejs

# Verify installation
node --version
npm --version
```

**Install imaginize**:
```bash
npm install -g imaginize
```

**Storage Access**:
```bash
# Grant storage permissions
termux-setup-storage

# Access files in ~/storage/shared/
imaginize ~/storage/shared/Download/book.epub
```

**Troubleshooting**:

**Issue**: Write permission errors

**Solution**:
```bash
# Use Termux home directory
mkdir -p ~/books
cp ~/storage/shared/Download/book.epub ~/books/
imaginize ~/books/book.epub
```

---

## Configuration

### Environment Variables

**Set API Key**:

**macOS/Linux**:
```bash
# OpenAI
export OPENAI_API_KEY="sk-..."
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc

# OpenRouter
export OPENROUTER_API_KEY="sk-or-v1-..."
echo 'export OPENROUTER_API_KEY="sk-or-v1-..."' >> ~/.bashrc
```

**Windows (PowerShell)**:
```powershell
$env:OPENAI_API_KEY="sk-..."
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-...", "User")
```

**Termux**:
```bash
export OPENAI_API_KEY="sk-..."
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc
```

### Configuration File

**Generate Template**:
```bash
imaginize --init-config
```

**Creates**: `.imaginize.config`

**Edit**:
```json
{
  "apiKey": "sk-...",
  "baseURL": "https://api.openai.com/v1",
  "model": {
    "text": "gpt-4o-mini",
    "image": "dall-e-3"
  },
  "concurrent": false,
  "maxConcurrency": 3
}
```

---

## Verification

### Test Installation

**Check Version**:
```bash
imaginize --version
# Expected: imaginize v2.7.0
```

**Check Help**:
```bash
imaginize --help
# Should display command usage
```

**Test Run** (dry-run mode):
```bash
imaginize path/to/book.epub --dry-run
```

**Expected Output**:
```
🔍 DRY RUN MODE - No API calls will be made

📚 Book Information:
   Title: The Hobbit
   Author: J.R.R. Tolkien
   Chapters: 19

✅ Configuration Valid
✅ API Key Detected (OpenAI)
✅ Ready to Process
```

---

## Common Issues

### Installation Failures

**Issue**: `npm ERR! EACCES: permission denied`

**Solution**:
- Use npm prefix configuration (see platform-specific guides)
- Avoid `sudo npm install -g` (security risk)

**Issue**: `node: command not found`

**Solution**:
- Verify Node.js installation: `which node`
- Reinstall Node.js for your platform
- Check PATH configuration

**Issue**: `npm ERR! network timeout`

**Solution**:
```bash
# Increase npm timeout
npm config set fetch-timeout 60000

# Retry installation
npm install -g imaginize
```

### Configuration Issues

**Issue**: `Error: No API key configured`

**Solution**:
- Set environment variable: `export OPENAI_API_KEY="sk-..."`
- Create config file: `imaginize --init-config`
- Use CLI flag: `imaginize --api-key sk-... book.epub`

**Issue**: `Error: Invalid API key format`

**Solution**:
- Verify key format:
  - OpenAI: `sk-...` (56+ chars)
  - OpenRouter: `sk-or-v1-...` (64+ chars)
- Remove quotes/whitespace
- Regenerate key if corrupted

### Runtime Issues

**Issue**: `ENOMEM: out of memory`

**Solution**:
- Reduce concurrency: `--max-concurrency 1`
- Close other applications
- Increase system RAM

**Issue**: `ENOENT: no such file or directory`

**Solution**:
- Use absolute paths: `/full/path/to/book.epub`
- Check file exists: `ls -lh book.epub`
- Verify file permissions: `chmod 644 book.epub`

---

## Updating

### Update Global Installation

**Check Current Version**:
```bash
imaginize --version
```

**Update to Latest**:
```bash
npm update -g imaginize
```

**Update to Specific Version**:
```bash
npm install -g imaginize@2.7.0
```

### Update Source Installation

**Pull Latest Changes**:
```bash
cd imaginize
git pull origin main
npm install
npm run build
```

---

## Uninstallation

### Remove Global Installation

**npm**:
```bash
npm uninstall -g imaginize
```

**Verify Removal**:
```bash
which imaginize
# Should output nothing
```

### Clean Configuration

**Remove Config Files**:
```bash
rm -rf ~/.imaginize
rm .imaginize.config
rm -rf illustrate_*/
```

**Remove Environment Variables**:
```bash
# Edit ~/.bashrc or ~/.zshrc
# Remove lines containing OPENAI_API_KEY or OPENROUTER_API_KEY
```

---

## Development Setup

### Prerequisites

**Build Tools**:
```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt install build-essential

# Fedora
sudo dnf groupinstall "Development Tools"
```

**Clone and Install**:
```bash
git clone https://github.com/tribixbite/imaginize.git
cd imaginize
npm install
```

**Build Project**:
```bash
npm run build
```

**Run Tests**:
```bash
npm test
```

**Link for Development**:
```bash
npm link
# Now 'imaginize' command uses local build
```

---

## Docker Installation (Optional)

**Dockerfile** (future feature):
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENTRYPOINT ["node", "dist/cli.js"]
```

**Build Image**:
```bash
docker build -t imaginize .
```

**Run Container**:
```bash
docker run -v $(pwd):/data -e OPENAI_API_KEY="sk-..." imaginize /data/book.epub
```

---

## Related Documentation

- [CLI Interface](./cli-interface.md) - Command-line usage
- [Configuration](./configuration.md) - Configuration options
- [Provider Detection](./provider-detection.md) - API setup

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Supported Platforms**: 5 (macOS, Linux, Windows, Termux, Docker)
