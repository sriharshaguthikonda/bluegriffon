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
6) Continue this loop until the workflow is `success` and the Windows x64 executable artifact upload succeeds.

## A/B branch protocol for stubborn blockers
- Start with 2 branches per blocker (`exp/<blocker>-a`, `exp/<blocker>-b`).
- If both fail without clear progress, expand fanout for that blocker (3+ branches is allowed).
- Each branch must contain one distinct hypothesis (no mixed fixes).
- Push all experiment branches and monitor all runs to completion with long polling:
  - `Start-Sleep -Seconds 100` (increase while `Build BlueGriffon executable` runs).
- Compare results and pick one winner by farthest progress:
  1) `Build BlueGriffon executable` step health/duration
  2) absence of previous blocker signature in `ci-logs/build.log`
  3) lower severity/new failure if still failing
  4) tie-breaker: smaller/safer diff
- Promote only the winner into `local-build-setup` (fast-forward or cherry-pick).
- Keep loser branch for reference during the cycle, then delete after promotion.
- For every completed run, always share a clickable job URL:
  - `https://github.com/sriharshaguthikonda/bluegriffon/actions/runs/<RUN_ID>/job/<JOB_ID>`

## Notes
- Always build Windows x64.
- Do not build locally unless explicitly requested.

## Local build workflow (Windows)
Use this when the user asks to build locally.
1) Run a preflight check (PowerShell) and only install missing components:
```
$checks = [ordered]@{}
$checks['git'] = (Get-Command git -ErrorAction SilentlyContinue)?.Source
$checks['python3 (MozillaBuild)'] = (Test-Path 'C:\mozilla-build\python3\python.exe')
$checks['python2.7'] = (Test-Path 'C:\Python27_18\python.exe')
$checks['rustup'] = (Get-Command rustup -ErrorAction SilentlyContinue)?.Source
$checks['vcvars64'] = (Test-Path 'C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat')
$checks['mozillabuild'] = (Test-Path 'C:\mozilla-build\start-shell.bat')
$checks['msys2 bash'] = (Test-Path 'C:\mozilla-build\msys2\usr\bin\bash.exe')
$checks
```
2) Install missing items (admin PowerShell preferred):
```
choco install -y mozillabuild visualstudio2022buildtools visualstudio2022-workload-vctools
rustup toolchain install 1.19.0
```
3) Create a Python venv with system site packages:
```
C:\mozilla-build\python3\python.exe -m venv .venv --system-site-packages
.\.venv\Scripts\activate
```
4) Ensure MSYS2 build tools are present (from MozillaBuild shell):
```
pacman -S --needed autoconf2.13 yasm pkgconf make zip unzip
```
5) Run build (VS 2022 C++ env + Rust 1.19.0):
```
git -c core.autocrlf=false -c core.eol=lf clone https://github.com/mozilla/gecko-dev gecko-dev
git -c core.autocrlf=false -c core.eol=lf clone --local . gecko-dev/bluegriffon
cd gecko-dev
git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
patch -p1 < bluegriffon/config/gecko_dev_content.patch
patch -p1 < bluegriffon/config/gecko_dev_idl.patch
patch -p1 < bluegriffon/config/gecko_dev_local_build_fixes.patch
cp bluegriffon/config/mozconfig.win .mozconfig
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
set RUSTUP_TOOLCHAIN=1.19.0
set RUSTC=C:\Users\<you>\.rustup\toolchains\1.19.0-x86_64-pc-windows-msvc\bin\rustc.exe
set CARGO=C:\Users\<you>\.rustup\toolchains\1.19.0-x86_64-pc-windows-msvc\bin\cargo.exe
C:\mozilla-build\msys2\usr\bin\bash.exe -lc "cd /c/Windows_software/bluegriffon/gecko-dev && ./mach build"
```
6) Output: `gecko-dev\opt64\dist\bin\bluegriffondev.exe` (x64).
7) Do not uninstall automatically; provide cleanup instructions only if asked.
