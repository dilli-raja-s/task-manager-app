# Legacy Task Reassignment Playbook

This playbook reassigns tasks that were migrated to the fallback migration owner.

## Inputs

- Mapping JSON file with this shape:

```json
[
  { "taskId": 1, "ownerEmail": "alice@example.com" },
  { "taskId": 2, "ownerEmail": "bob@example.com" }
]
```

## Dry run

```bash
node server/scripts/reassign-legacy-owner.js --mapping ./docs/reassignment-map.json --dry-run
```

Expected output includes `updated`, `skipped`, and `total` counts.

## Apply changes

```bash
node server/scripts/reassign-legacy-owner.js --mapping ./docs/reassignment-map.json
```

## Rollback guidance

1. Stop application traffic.
2. Restore database from backup file created before migration.
3. Re-run dry-run to confirm expected reassignment set.
4. Re-apply with corrected mapping file.

## Audit evidence

Persist command output JSON as artifact evidence because it contains:

- `updated`: rows changed
- `skipped`: rows skipped due to missing user/task or invalid entry
- `total`: number of attempted mappings
- `mappingPath`: input source path used
- `databasePath`: target database file
