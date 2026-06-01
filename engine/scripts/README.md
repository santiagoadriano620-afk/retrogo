# Engine Scripts

This folder contains utility scripts for building and maintaining the TibiaJS server.

## Active Scripts

### `build-client.js`
- **Purpose**: Bundles and optimizes client-side JavaScript code
- **Usage**: `node build-client.js`
- **Status**: ✅ **ACTIVELY USED** - Part of build pipeline
- **Description**: Processes client source files and outputs optimized bundles for web delivery

## Historical / Archived Scripts

Migration and data conversion scripts have been moved to `./migrations/` folder. These are one-time scripts that were used during development phases. See `./migrations/README.md` for more information.

Archived scripts:
- `convert-monsters.js` → `./migrations/convert-monsters.js`
- `import-houses.js` → `./migrations/import-houses.js`
- `migrate-monsters.js` → `./migrations/migrate-monsters.js`

## Deployment Scripts

The following shell scripts are environment-specific and have been deprecated:
- `build-and-deploy.sh` - Legacy deployment (specific to original hosting)
- `update-nginx-ips.sh` - Nginx configuration tool (specific to original setup)

These are kept for reference but should not be used in production. Modern deployments should use:
- Docker containers
- Kubernetes manifests
- CI/CD pipelines (GitHub Actions, GitLab CI, etc.)

---

**Last updated**: 2024  
**Maintenance notes**: Keep build-client.js synced with actual client build requirements
