# Git Ignore Configuration

## Overview

This project uses `.gitignore` and `.dockerignore` files to exclude unnecessary files from version control and Docker builds.

---

## Files Created

### 1. `.gitignore`
**Purpose:** Exclude files from Git version control

**Categories:**
- Node.js dependencies (`node_modules/`)
- Environment variables (`.env` files)
- Test coverage (`coverage/`)
- Docker volumes data
- Database data files
- IDE/Editor files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Logs and temporary files
- Build artifacts

### 2. `.dockerignore`
**Purpose:** Exclude files from Docker build context

**Benefits:**
- Faster Docker builds
- Smaller build context
- Reduced image size
- Better security (excludes sensitive files)

---

## What's Ignored

### Critical Files (Must Be Ignored)

✅ **Node Modules**
```
node_modules/
```
*Why:* Large, can be reinstalled, platform-specific

✅ **Environment Variables**
```
.env
.env.local
.env.production
```
*Why:* Contains secrets and sensitive configuration

✅ **Test Coverage**
```
coverage/
.nyc_output/
```
*Why:* Generated files, not source code

✅ **Docker Volume Data**
```
postgres_data/
redis_data/
prometheus_data/
grafana_data/
alertmanager_data/
```
*Why:* Runtime data, should not be in version control

✅ **IDE Files**
```
.vscode/
.idea/
*.iml
```
*Why:* Personal editor configuration

✅ **OS Files**
```
.DS_Store      # macOS
Thumbs.db      # Windows
```
*Why:* Operating system metadata

✅ **Logs**
```
logs/
*.log
```
*Why:* Generated at runtime

---

## What's NOT Ignored

### Files That Should Be Committed

✅ **Source Code**
- All `.js`, `.jsx`, `.ts`, `.tsx` files
- Service implementations

✅ **Configuration**
- `package.json`
- `docker-compose.yml`
- `Dockerfile`
- `jest.config.js`

✅ **Documentation**
- All `.md` files
- `README.md`
- Technical documentation

✅ **Docker Configs**
- Prometheus configuration
- Alertmanager configuration
- Grafana dashboards

✅ **Database Schemas**
- `init-db/*.sql`

---

## Special Cases

### Package Lock Files

The `.gitignore` includes commented sections for lock files:
```gitignore
# Uncomment if you want to ignore lock files
# package-lock.json
# yarn.lock
# pnpm-lock.yaml
```

**Recommendation:** 
- **Keep lock files** for production projects (ensures consistent dependencies)
- **Ignore lock files** only if working in a team with different package managers

---

## Docker Build Optimization

### .dockerignore Benefits

1. **Faster Builds**
   - Excludes `node_modules/` (reinstalled in container)
   - Excludes documentation and test files

2. **Smaller Context**
   - Only sends necessary files to Docker daemon
   - Reduces build time significantly

3. **Security**
   - Excludes `.env` files
   - Excludes `.git` directory

### Example Impact

Without `.dockerignore`:
```
Sending build context to Docker daemon: 500MB
```

With `.dockerignore`:
```
Sending build context to Docker daemon: 5MB
```

---

## Verification

### Check What's Ignored

```bash
# See what would be committed (excluding ignored files)
git status

# List all files Git sees (excluding ignored)
git ls-files

# Show ignored files
git status --ignored

# Check if a specific file is ignored
git check-ignore -v <file>
```

### Check Docker Context

```bash
# See what files are sent to Docker
docker build --no-cache --progress=plain . 2>&1 | grep "Sending build context"

# List files in build context (using a test build)
docker build --no-cache -f- . <<EOF
FROM scratch
COPY . /context
CMD ["ls", "-la", "/context"]
EOF
```

---

## Common Issues

### Issue 1: node_modules Still Tracked

**Problem:** `node_modules/` was committed before adding `.gitignore`

**Solution:**
```bash
# Remove from Git (but keep locally)
git rm -r --cached node_modules/

# Commit the change
git commit -m "Remove node_modules from git tracking"
```

### Issue 2: .env File Accidentally Committed

**Problem:** `.env` was committed with secrets

**Solution:**
```bash
# Remove from Git history (CAREFUL!)
git rm --cached .env
git commit -m "Remove .env from tracking"

# Rotate all secrets that were exposed!
```

### Issue 3: Coverage Folder Tracked

**Problem:** `coverage/` taking up repository space

**Solution:**
```bash
git rm -r --cached coverage/
git commit -m "Remove coverage from tracking"
```

---

## Best Practices

### 1. Add .gitignore Early
✅ Create `.gitignore` before first commit
✅ Use templates (e.g., GitHub's Node.js template)

### 2. Review Before Committing
```bash
# Always check what you're committing
git status
git diff --staged
```

### 3. Use .gitkeep for Empty Directories
```bash
# Create empty directory that Git will track
mkdir -p logs
touch logs/.gitkeep
```

### 4. Document Exceptions
If you need to commit a normally-ignored file:
```gitignore
# Ignore all .env files
.env*

# But keep the example
!.env.example
```

---

## Integration with CI/CD

### GitHub Actions Example

The `.gitignore` works automatically with CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      # node_modules/ is ignored, so must install
      - run: npm install
      - run: npm test
```

---

## Project-Specific Ignores

### Alert Ingestion Service

Ignored:
- `coverage/` - Jest test coverage reports
- `node_modules/` - npm dependencies
- `.env` - Environment configuration

Committed:
- `tests/` - Test files
- `src/` - Source code
- `package.json` - Dependencies list

### Docker Volumes

Ignored volume data (from `docker-compose.yml`):
```yaml
volumes:
  postgres_data:     # Ignored
  redis_data:        # Ignored
  prometheus_data:   # Ignored
  grafana_data:      # Ignored
  alertmanager_data: # Ignored
```

These contain runtime data and should not be in Git.

---

## Maintenance

### Periodic Review

```bash
# Check repository size
du -sh .git/

# Find large files
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print substr($0,6)}' | \
  sort --numeric-sort --key=2 | \
  tail -n 10
```

### Clean Up If Needed

```bash
# Remove all untracked files (CAREFUL!)
git clean -fd

# Dry run first
git clean -fdn
```

---

## Summary

✅ **`.gitignore`** - Comprehensive rules for all project types  
✅ **`.dockerignore`** - Optimized for Docker builds  
✅ **Best practices** - Security and performance  
✅ **Documentation** - Clear explanations  

**Files Excluded:**
- 🚫 Dependencies (`node_modules/`)
- 🚫 Environment variables (`.env`)
- 🚫 Test coverage (`coverage/`)
- 🚫 Docker data volumes
- 🚫 IDE files
- 🚫 OS files
- 🚫 Logs and temp files

**Files Included:**
- ✅ Source code
- ✅ Configuration
- ✅ Documentation
- ✅ Docker configs
- ✅ Database schemas

---

**Status:** ✅ Complete  
**Files Created:** `.gitignore`, `.dockerignore`  
**Lines:** ~250+ ignore rules  
**Coverage:** All common file types

