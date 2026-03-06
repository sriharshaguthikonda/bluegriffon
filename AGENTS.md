# GitHub Actions Monitoring + Rinse/Repeat (BlueGriffon)

These instructions define how to monitor GitHub Actions runs after a push,
gather logs, and iterate until the Windows x64 build succeeds.

## Monitoring runs
- After each push, query the latest runs and capture the run id:
  - Command (PowerShell):
    ```
    $uri='https://api.github.com/repos/sriharshaguthikonda/bluegriffon/actions/runs?per_page=10'
    (Invoke-RestMethod -Headers @{ 'User-Agent'='codex' } -Uri $uri).workflow_runs |
      Select-Object -First 5 id,status,conclusion,head_branch,head_sha,html_url,created_at
    ```
- If the latest run is `in_progress`, poll every 10-20 seconds until it becomes `completed`.
- If the run is `completed` with `failure`, proceed to "Logs and failure triage".

## Get job id and step status
- Query jobs for a run:
  ```
  $runId=22754576861
  $jobsUri="https://api.github.com/repos/sriharshaguthikonda/bluegriffon/actions/runs/$runId/jobs?per_page=50"
  (Invoke-RestMethod -Headers @{ 'User-Agent'='codex' } -Uri $jobsUri).jobs |
    Select-Object id,name,status,conclusion,started_at,completed_at
  ```
- Query job steps to find the failing step:
  ```
  $jobId=65996070192
  $jobUri="https://api.github.com/repos/sriharshaguthikonda/bluegriffon/actions/jobs/$jobId"
  (Invoke-RestMethod -Headers @{ 'User-Agent'='codex' } -Uri $jobUri).steps |
    Select-Object name,status,conclusion,started_at,completed_at
  ```

## Provide clickable run/job link to user
- Always include the direct job URL in the response so the user can click it:
  ```
  https://github.com/sriharshaguthikonda/bluegriffon/actions/runs/<RUN_ID>/job/<JOB_ID>
  ```

## Logs and failure triage
- Primary source of logs is the `ci-logs` branch:
  - Fetch the latest commit and open `ci-logs/build.log`:
    ```
    git fetch origin ci-logs
    git log origin/ci-logs -1 --oneline
    git show origin/ci-logs:ci-logs/build.log
    git show origin/ci-logs:ci-logs/metadata.txt
    ```
- If `ci-logs` is missing or stale, add/extend logging in the workflow and
  re-push (do not try to download run logs via API if permissions fail).

## Rinse/Repeat loop
1) Push changes.
2) Monitor the run until completion.
3) If failed, read `ci-logs/build.log` and identify the error.
4) Implement a small, targeted fix (or add logging).
5) Push again.

## Notes
- Always build Windows x64.
- Do not build locally unless explicitly requested.
