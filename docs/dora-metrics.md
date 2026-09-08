# DORA metrics

PR8 creates a logical deployment record; it does not deploy to a server. A successful
CD run uses the GitHub environment `dora`, uploads an artifact named with the commit
SHA and workflow run ID, and stores `release/deployment-record.json` with the run
metadata.

## Data sources

- Pull requests provide the change, merge time, author, labels, and commit reference.
- CD workflow runs provide start time, completion time, outcome, and run ID.
- GitHub deployment records for `dora` identify successful deployment events.
- Artifacts preserve the exact backend and frontend outputs for each successful event.
- Incident or rollback labels and their timestamps identify recovery events.

## Calculations

- Deployment frequency: count successful `dora` deployment records per week or month.
- Lead time for changes: measure from the first commit in a merged pull request to the
  successful `dora` deployment record for that commit. Report the median for the period.
- Change failure rate: divide CD runs that fail after accepting a change, or deployments
  followed by an incident/rollback label, by all deployment attempts in the period.
- Mean time to restore: measure from the failed deployment or incident timestamp to the
  next successful `dora` record that contains the fix or rollback, then average the values.

These are measurement conventions for this artifact-only workflow. They should be
replaced or supplemented with hosting-provider deployment and incident data if the
project later gains a real runtime environment.
