# Scheduled data job standard

Every scheduled job is a small, independently buildable Docker service under `jobs/`. It must have a focused collector, explicit source-contract validation, transactional and idempotent persistence, run-history monitoring, tests, and documented operations.

## Required states

- `running`: run record committed before collection begins, so a crash or failure always leaves evidence
- `success`: valid data changed persisted state
- `unchanged`: valid data produced no database change
- `skipped`: intentional non-error skip
- `advisory`: completed with a documented non-blocking concern
- `failed`: blocking error recorded after rolling back the partial work; original exit code is preserved

One `dataset_key` = one upstream file/grain/cadence = one source registry row
(`app.external_data_sources`) = one run history (`app.external_data_runs`) = one
schedule decision. One runner may pull several datasets when the extraction
logic is shared, but each keeps its own key and run history.

## Wrapper contract

Cron calls `scripts/run_<job>_job.sh`, never Python, Docker, Compose, or an HTTP endpoint. The wrapper must use strict Bash mode, resolve the repository independently of the caller, require `.env`, use `scripts/run_job.sh` (add the service name to its `ALLOWED_JOBS`), prevent overlaps with a dataset-specific lock that reclaims a lock left by a dead process, append operational stages to a monthly ignored log, and emit no more than one failure alert. Copy `scripts/run_example_job.sh` as the template.

Never source `.env`. Read only explicitly allowlisted keys through `scripts/lib/safe_env.sh`; treat all values as inert data. Explicitly exported test values may override `.env`.

An overlap is a successful silent skip. Success, unchanged, skipped, and advisory results do not send a failure notification. A notification failure must not replace the job’s original exit code.

## Job acceptance checklist

- [ ] Official source and dataset grain documented
- [ ] Contract validation rejects empty, duplicate, or structurally changed data
- [ ] Natural key and source version are explicit
- [ ] Writes occur in one transaction and reruns are safe
- [ ] Source and run rows are registered
- [ ] All result states have clear meanings
- [ ] Docker image builds from a clean context
- [ ] Focused tests run inside the job container
- [ ] Local launcher and production wrapper work from any directory
- [ ] Lock, monthly log, and failure-code preservation verified
- [ ] Cron example calls only the wrapper

