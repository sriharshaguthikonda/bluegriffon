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
- If the latest run is `in_progress`, poll until it becomes `completed`:
  - Use longer waits for this repo’s build times, e.g.:
    ```
    Start-Sleep -Seconds 100
    ```
  - If the build is in the `Build BlueGriffon executable` step, assume it can take longer; increase sleep accordingly.
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

## Local build workflow (Windows)
Use this when the user asks to build locally.
1) Run a preflight check (PowerShell) and only install missing components:
```
$checks = [ordered]@{}
$checks['git'] = (Get-Command git -ErrorAction SilentlyContinue)?.Source
$checks['hg'] = (Get-Command hg -ErrorAction SilentlyContinue)?.Source
$checks['python3'] = (Get-Command python -ErrorAction SilentlyContinue)?.Source
$checks['python2.7'] = (Test-Path 'C:\Python27\python.exe')
$checks['vcvars64'] = (Test-Path 'C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat')
$checks['mozillabuild'] = (Test-Path 'C:\mozilla-build\start-shell.bat')
$checks['autoconf-2.13'] = (Get-Command autoconf-2.13 -ErrorAction SilentlyContinue)?.Source
$checks['yasm'] = (Get-Command yasm -ErrorAction SilentlyContinue)?.Source
$checks['pkg-config'] = (Get-Command pkg-config -ErrorAction SilentlyContinue)?.Source
$checks['zip'] = (Get-Command zip -ErrorAction SilentlyContinue)?.Source
$checks
```
2) Install missing items (admin PowerShell preferred):
```
choco install -y mozillabuild python2 visualstudio2022buildtools visualstudio2022-workload-vctools
```
3) Create a Python venv with system site packages:
```
C:\Python311\python.exe -m venv .venv --system-site-packages
.\.venv\Scripts\activate
```
4) Run build from MozillaBuild shell:
```
C:\mozilla-build\start-shell.bat
git -c core.autocrlf=false -c core.eol=lf clone https://github.com/mozilla/gecko-dev gecko-dev
git -c core.autocrlf=false -c core.eol=lf clone --local . gecko-dev/bluegriffon
cd gecko-dev
git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
patch -p1 < bluegriffon/config/gecko_dev_content.patch
patch -p1 < bluegriffon/config/gecko_dev_idl.patch
cp bluegriffon/config/mozconfig.win .mozconfig
./mach build
```
5) Do not uninstall automatically; provide cleanup instructions only if asked.
