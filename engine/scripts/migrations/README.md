# Migration Scripts

This folder contains **historical one-time migration scripts** that were used during project development and data migration phases. These scripts are **no longer needed for regular server operation**.

## Scripts

### `convert-monsters.js`
- **Purpose**: Converts XML monster definitions to JSON format (740 version)
- **Status**: ✅ **COMPLETED** - Data migrated to `/data/monsters/definitions/`
- **Notes**: Used for initial monster data conversion. Kept for reference/audit purposes.

### `import-houses.js`
- **Purpose**: Imports house definitions from XML/data files
- **Status**: ✅ **COMPLETED** - Houses loaded into database
- **Notes**: One-time import script. Database now handles house persistence.

### `migrate-monsters.js`
- **Purpose**: Schema migration for monster data structures
- **Status**: ✅ **COMPLETED** - Schema migrated to current format
- **Notes**: Used to update monster schema to newer format during development iterations.

## How to Use

These scripts are **not part of regular server operations**. They are kept for:

1. **Reference**: Understanding historical data transformations
2. **Recovery**: In case a data rollback/re-import is needed
3. **Audit**: Tracking what transformations were applied to production data

If you need to run one of these scripts:

```bash
cd engine
node scripts/migrations/<script-name>.js
```

**Warning**: Only run these if you know what you're doing, as they may overwrite existing data.

## Removing Old Migrations

After confirming data integrity, old migration scripts can be safely deleted. The current server version uses:
- Database schema versioning
- Direct JSON file loading (in `/data/`)
- Entity definitions (in `/data/*/definitions/`)

## Active Scripts

The following scripts are **actively used** and should remain in `/scripts/`:
- `build-client.js` - Bundles client JavaScript
- Any future scripts for active maintenance/monitoring

---

**Last updated**: 2024  
**Archived migrations count**: 3
