# Bluegriffon

The Open Source next-generation Web Editor based on the rendering engine of Firefox

## To prepare the build USING MERCURIAL

* make sure to have installed the environment to build Mozilla: [windows](https://developer.mozilla.org/En/Developer_Guide/Build_Instructions/Windows_Prerequisites), [MacOS X](https://developer.mozilla.org/En/Developer_Guide/Build_Instructions/Mac_OS_X_Prerequisites), [linux](https://developer.mozilla.org/En/Developer_Guide/Build_Instructions/Linux_Prerequisites)
* get mozilla-central from Mozilla through Mercurial:

  `hg clone http://hg.mozilla.org/mozilla-central bluegriffon-source`

  Warning: on Windows, it's HIGHLY recommended to have both Windows and Visual Studio in the same locale, preferably en-US. If for instance you have a fr-FR Windows10 and a en-US VS, build will miserably fail...

* get BlueGriffon's tree through:

  `cd bluegriffon-source`

  `git clone https://github.com/therealglazou/bluegriffon`

* update the mozilla tree

  ```hg update -r `cat bluegriffon/config/mozilla_central_revision.txt` ```

  `patch -p 1 < bluegriffon/config/gecko_dev_content.patch`

  `patch -p 1 < bluegriffon/config/gecko_dev_idl.patch`

* create a `.mozconfig` file inside your `bluegriffon-source` directory. The  settings I am using on a daily basis on OS X (Sierra) can be found in `bluegriffon/config/mozconfig.macosx`

## To prepare the build USING GIT

* make sure to have installed the environment to build Mozilla: [windows](https://developer.mozilla.org/En/Developer_Guide/Build_Instructions/Windows_Prerequisites), [MacOS X](https://developer.mozilla.org/En/Developer_Guide/Build_Instructions/Mac_OS_X_Prerequisites), [linux](https://developer.mozilla.org/En/Developer_Guide/Build_Instructions/Linux_Prerequisites)
* get gecko-dev from github through git:

  `git clone https://github.com/mozilla/gecko-dev bluegriffon-source`

  Warning: on Windows, it's HIGHLY recommended to have both Windows and Visual Studio in the same locale, preferably en-US. If for instance you have a fr-FR Windows10 and a en-US VS, build will miserably fail...

* get BlueGriffon's tree through:

  `cd bluegriffon-source`

  `git clone https://github.com/therealglazou/bluegriffon`

* update the mozilla tree

  ```git reset --hard `cat bluegriffon/config/gecko_dev_revision.txt` ```

  `patch -p 1 < bluegriffon/config/gecko_dev_content.patch`

  `patch -p 1 < bluegriffon/config/gecko_dev_idl.patch`

* create a `.mozconfig` file inside your `bluegriffon-source` directory. The  settings I am using on a daily basis on OS X (Sierra) can be found in `bluegriffon/config/mozconfig.macosx`

## My own builds

* OS X: OS X 10.12.6 with Xcode version 9.0 (9A235)
* Windows: Windows 10 Pro with Visual Studio Community 2015
* Linux: Ubuntu 16.04.1 LTS

## Build BlueGriffon

`./mach build`

## Run BlueGriffon in a temporary profile

`./mach run`

## Package the build

`./mach package`

## Local Windows build (check first, install only if missing)

### Quick prerequisite check (PowerShell)
```
$checks = [ordered]@{}
$checks['git'] = (Get-Command git -ErrorAction SilentlyContinue)?.Source
$checks['hg'] = (Get-Command hg -ErrorAction SilentlyContinue)?.Source
$checks['python3'] = (Get-Command python -ErrorAction SilentlyContinue)?.Source
$checks['python2.7'] = (Test-Path 'C:\Python27\python.exe')
$checks['vswhere'] = (Test-Path 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe')
$checks['vcvars64'] = (Test-Path 'C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat')
$checks['mozillabuild'] = (Test-Path 'C:\mozilla-build\start-shell.bat')
$checks['msys2 bash'] = (Test-Path 'C:\mozilla-build\msys2\usr\bin\bash.exe')
$checks['autoconf-2.13'] = (Get-Command autoconf-2.13 -ErrorAction SilentlyContinue)?.Source
$checks['yasm'] = (Get-Command yasm -ErrorAction SilentlyContinue)?.Source
$checks['pkg-config'] = (Get-Command pkg-config -ErrorAction SilentlyContinue)?.Source
$checks['zip'] = (Get-Command zip -ErrorAction SilentlyContinue)?.Source
$checks
```

### Install missing items (Windows)
Use admin PowerShell if possible.

**Chocolatey (preferred if admin):**
```
choco install -y mozillabuild python2 visualstudio2022buildtools visualstudio2022-workload-vctools
```

**Manual installs (non-admin friendly):**
- MozillaBuild: install to `C:\mozilla-build` (keeps MSYS2, make, perl, zip).
- Python 2.7: install to `C:\Python27` (required by this Gecko revision).
- Visual Studio 2022 Build Tools with C++ workload (provides `vcvars64.bat`, `cl`, `link`).

### Create a virtualenv with system-site-packages
Use Python 3 (system install) and keep system packages visible:
```
C:\Python311\python.exe -m venv .venv --system-site-packages
.\.venv\Scripts\activate
python -V
```

### Local build (Windows, Git)
1. Open MozillaBuild shell:
   `C:\mozilla-build\start-shell.bat`
2. From the repo root:
   ```
   git -c core.autocrlf=false -c core.eol=lf clone https://github.com/mozilla/gecko-dev gecko-dev
   git -c core.autocrlf=false -c core.eol=lf clone --local . gecko-dev/bluegriffon
   cd gecko-dev
   git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
   patch -p1 < bluegriffon/config/gecko_dev_content.patch
   patch -p1 < bluegriffon/config/gecko_dev_idl.patch
   cp bluegriffon/config/mozconfig.win .mozconfig
   ./mach build
   ```

### Easy cleanup
- Remove `C:\mozilla-build` if you want to reclaim space.
- Remove `C:\Python27` if you want to remove Python 2.7.
- Delete `.venv` in the repo.

## Want to contribute to BlueGriffon?

There are two ways to contribute:

1. Contribute code. That's just another OSS project, we're waiting for your Pull Requests!
2. Contribute L10N. All happens only in the 'locales' directory. You can review the existing locales and proposed changes/fixes or submit a new locale in a Pull Request. In that case, you need to translate everything from en-US into a new locale beforeI can accept the PR.
