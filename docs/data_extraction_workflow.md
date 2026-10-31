# Data extraction workflow

Use a stage gate rather than beginning with schema or code.

1. Define the user decision and questions the source can and cannot answer.
2. Review official documentation, access limits, licensing, cadence, revisions, and geography.
3. Inspect representative real records, including missing and not-applicable cases.
4. Build a field decision matrix: present, future, raw-only, exclude, or investigate.
5. Approve the smallest valuable extraction phase.
6. Design natural keys, raw evidence, versioning, idempotency, indexes, and expected queries.
7. Implement the focused collector, validation, persistence, monitoring, Docker service, and tests.
8. Validate live counts, representative records, reruns, source version, and missing-data behavior.
9. Schedule only after the job is reproducible, observable, and safe to rerun.
10. Present evidence without changing its geography, period, source meaning, or uncertainty.

Scale rigor to risk, but never omit source understanding, idempotency, monitoring, or semantic verification.

