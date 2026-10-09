# Display masters at 4096 px

The image worker (`infra/image-worker`) now keeps display masters up to
4096 px on the long side (was 2560) so the website's full-screen view stays
sharp when zoomed. The change is in the repository; the VPS runs whatever
was last shipped, so it needs one deployment and one re-queue.

## 1. Deploy the worker (on a machine with SSH access to the VPS)

From the repository root, following `infra/README.md` §6b:

```sh
tar cz infra/image-worker | ssh root@<vps> 'tar xz -C /opt/jvb'
ssh root@<vps> 'cd /opt/jvb/infra/compose && docker compose build image-worker && docker compose up -d image-worker && docker compose logs --tail=20 image-worker'
```

The log line `maxDimensionPx: 4096` confirms the new build is running.

## 2. Re-derive the published masters that were capped

Run `docs/ops/requeue-4096.sql` against the database (postgres-meta
`/pg/query`, or `docker compose exec -T db psql -U postgres -d postgres`).
It forgets the Sanity asset of each capped master and queues the image; the
worker rewrites the master in place from the original, and its status write
re-enqueues the piece so the website sync uploads the new pixels and renders
a fresh square tile for objects. 35 masters qualified on 9 October 2026.
Originals smaller than 2560 px are left alone: nothing would change.
