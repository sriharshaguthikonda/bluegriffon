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
- For faster routine CI on dedicated portable/installer branches, diagnostic log-tail/artifact-scan/ci-logs upload steps may stay disabled.
- If a run fails or triage needs more context, re-enable those diagnostic steps temporarily, re-run, and collect evidence before applying fixes.

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

## Verified local build + link playbook (Windows x64)
Use this exact flow when the goal is to produce and verify a locally linked executable.

1) Work on a local-only branch (do not mix with remote CI branch):
```
git checkout local-build-rebuild-verify
```

2) Confirm Defender exclusions are present (reduces file-lock failures during link):
```
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
```
Expected to include at least:
- `C:\mozilla-build`
- `C:\Python27_18`
- `C:\Users\deletable\.cargo`
- `C:\Windows_software\bluegriffon`
- `C:\Windows_software\bluegriffon\gecko-dev`
- `C:\Windows_software\bluegriffon\gecko-dev\opt64`

3) Prepare source tree (clean Gecko + local BlueGriffon source):
```
git -c core.autocrlf=false -c core.eol=lf clone https://github.com/mozilla/gecko-dev gecko-dev
git -c core.autocrlf=false -c core.eol=lf clone --local . gecko-dev/bluegriffon
cd gecko-dev
git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
patch -p1 < bluegriffon/config/gecko_dev_content.patch
patch -p1 < bluegriffon/config/gecko_dev_idl.patch
cp bluegriffon/config/mozconfig.win .mozconfig
```

4) Required local compatibility fixes before build:
- Keep display name without spaces to avoid `jar_maker.py` argument split errors:
  - `MOZ_APP_DISPLAYNAME=BlueGriffonDev` in `confvars.sh`.
- Keep retry-on-lock delete in `gecko-dev/config/expandlibs_exec.py` (`os.remove` retry loop for Windows Error 32).

5) Build with VS x64 toolchain + Python 2.7 + Rust 1.19:
```
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
set PYTHON=C:\Python27_18\python.exe
set PATH=C:\Python27_18;C:\Python27_18\Scripts;%PATH%
set RUSTUP_TOOLCHAIN=1.19.0-x86_64-pc-windows-msvc
set MSYS2_PATH_TYPE=inherit
set CHERE_INVOKING=1
set MSVC_BIN=%VCToolsInstallDir%bin\HostX64\x64
C:\mozilla-build\msys2\usr\bin\bash.exe -lc "cd /c/Windows_software/bluegriffon/gecko-dev && msvc_bin=$(cygpath -u \"$MSVC_BIN\") && export PATH=$msvc_bin:/c/Python27_18:/c/Python27_18/Scripts:/c/mozilla-build/msys2/mingw64/bin:/c/mozilla-build/msys2/usr/bin:$PATH && export PYTHON=/c/Python27_18/python.exe && export MOZBUILD_MOZMAKE=/c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe && export MAKE=/c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe && ./mach build 2>&1 | tee /c/Windows_software/bluegriffon/local-rebuild-verify.log"
```

6) Link success criteria (must all be true):
- Log contains final success line: `your build finally finished successfully`.
- Log shows executable link line: `bluegriffondev.exe`.
- Output file exists:
```
Get-Item C:\Windows_software\bluegriffon\gecko-dev\opt64\dist\bin\bluegriffondev.exe
```

7) Portable run validation:
- Run from `gecko-dev\opt64\dist\bin` (DLLs/resources colocated).
- Prefer a launcher batch file in portable folder when testing outside build tree.

## Branch progress snapshot (local-build-rebuild-verify)
Status captured on 2026-03-09 for handoff to remote-CI validation.

- Branch: `local-build-rebuild-verify`
- Build status: local x64 build completes and links successfully (`mach build` success).
- Output produced: `gecko-dev\opt64\dist\bin\bluegriffondev.exe`
- Portable folders prepared:
  - `portable-run\bluegriffondev.exe`
  - `portable-run-packaged\bluegriffondev.exe`
  - `portable-run-dev\bluegriffondev.exe`
  - `portable-run-packaged-dev\bluegriffondev.exe`

### Runtime failure observed
- App exits immediately on launch with crash dump.
- Windows event log (`Application Error`, id `1000`) shows:
  - faulting module: `xul.dll`
  - exception code: `0xc0000005`
  - fault offset: `0x0000000002232cf2`
- Crash dump symbolization maps offset to `vp8_six_tap_x86` (libvpx path).

### Evidence links (local paths)
- Build log: `local-rebuild-verify.log`
- Crash dumps:
  - `C:\Users\deletable\AppData\Local\CrashDumps\bluegriffondev.exe.10272.dmp`
  - `C:\Users\deletable\AppData\Local\CrashDumps\bluegriffondev.exe.45804.dmp`
- Portable test target:
  - `C:\Windows_software\bluegriffon\portable-run-packaged-dev\bluegriffondev.exe`

### What to do next (remote branch)
1) Keep local branch focused on runtime debugging only.
2) On remote build branch, build fresh Windows x64 artifact without local-only experiments.
3) Download artifact and run portable launch test; confirm whether same early crash occurs.
4) If crash reproduces remotely, treat as branch/toolchain/runtime issue (not local machine packaging).
5) Capture remote commit SHA + run/job URL in `ci-logs/metadata.txt` and continue fix loop there.

## Feature development phase (post remote installer validation)
This phase starts after validating that `Remote-build-portable-and-installer` can install side-by-side locally.

- Prior phases completed:
  - local build phase
  - remote build phase
  - remote installer build phase
  - `Remote-build-portable-and-installer` validation phase
- Baseline for new feature branches:
  - branch from `exp-yasm-c` for mixed feature development
  - keep changes small and isolated per branch/hypothesis
  - continue remote Windows x64 CI validation for each branch

### Feature objective: reclaim vertical UI space
- Reduce wasted vertical real estate in the application UI.
- Add flexibility to move/re-dock toolbars.
- Add ability to disable/enable title bar.
- Add ability to reposition status bar (horizontal and vertical layout options).
- Keep behavior configurable so users can choose compact vs classic layout.

### Remote CI workflow split policy
- If a single workflow building both portable and installer artifacts is too slow, split into two workflows:
  - portable-only workflow
  - installer-only workflow
- Portable workflow should not include redundant packaged outputs that are not needed for portable testing.
- Keep artifact names explicit (`portable`, `installer`) so run outcomes are easy to triage.
- Continue logging to `ci-logs` and sharing clickable run/job URLs for every completed run.
