# SQLite Backup & Restore Runbook

Production SQLite lives in a Docker named volume (`myband_be_db_data`).

---

## Manual Snapshot

Create a timestamped compressed archive of the entire volume:

```bash
docker run --rm \
  -v myband_be_db_data:/data \
  -v /backup:/backup \
  alpine \
  tar czf /backup/db-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

Store backups off-host (S3, NFS, or similar). Keep at least 7 daily snapshots.

## Restore from Snapshot

Stop the stack, extract the tarball back into the volume, then restart:

```bash
docker compose down
docker run --rm \
  -v myband_be_db_data:/data \
  -v /backup:/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/db-<TIMESTAMP>.tar.gz"
docker compose up -d
```

## Recommended Schedule

Add to the host's crontab (`crontab -e`):

```cron
0 3 * * * docker run --rm -v myband_be_db_data:/data -v /backup:/backup alpine tar czf /backup/db-$(date +\%Y\%m\%d).tar.gz -C /data .
```

This runs at 03:00 nightly. Pair with a rotation script to prune archives older than 30 days.

## Continuous Replication (optional)

[Litestream](https://litestream.io) streams SQLite WAL frames to S3 (or compatible) in near-real-time, giving point-in-time recovery with minimal data loss.

Add a Litestream sidecar to `docker-compose.yml`:

```yaml
litestream:
  image: litestream/litestream:latest
  volumes:
    - db_data:/data
  environment:
    LITESTREAM_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
    LITESTREAM_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  command: replicate /data/app.db s3://your-bucket/myband/db
```

Restore with:

```bash
litestream restore -o /data/app.db s3://your-bucket/myband/db
```

## Verify Integrity

After any restore, confirm the database is not corrupt:

```bash
docker compose exec backend npx prisma db push --skip-generate
# or directly:
sqlite3 /path/to/app.db "PRAGMA integrity_check;"
```
