#!/usr/bin/env bash
set -euo pipefail

# Ensure core MSYS tools are available before any external command (mkdir/cat/chmod).
export PATH="/c/mozilla-build/msys2/usr/bin:/c/mozilla-build/msys2/mingw64/bin:/usr/bin:/bin:$PATH"

cd /c/Windows_software/bluegriffon/gecko-dev

msvc_bin="$(cygpath -u "$MSVC_BIN")"
nsis_bin="/c/Windows_software/bluegriffon/.tools/nsis-3.11/Bin"
shim_dir="/c/Windows_software/bluegriffon/.build-tools-local"
mkdir -p "$shim_dir"
cat > "$shim_dir/link" <<EOF
#!/usr/bin/env bash
exec "$msvc_bin/link.exe" "\$@"
EOF
chmod +x "$shim_dir/link"

export PATH="$shim_dir:$nsis_bin:$msvc_bin:/c/Python27_18:/c/Python27_18/Scripts:/c/mozilla-build/msys2/mingw64/bin:/c/mozilla-build/msys2/usr/bin:$PATH"
export PYTHON=/c/Python27_18/python.exe
export MOZBUILD_MOZMAKE=/c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe
export MAKE=/c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe

# VS 2022's ml64 fails ctypes assembler probes on this legacy tree.
# Force-disable ctypes in local builds to unblock executable/installer packaging.
if ! grep -Fq -- "--disable-ctypes" .mozconfig; then
  echo "ac_add_options --disable-ctypes" >> .mozconfig
fi

# Clear stale configure caches when changing mozconfig options.
rm -f opt64/config.cache opt64/js/src/config.cache

echo "Using MSVC_BIN: $msvc_bin"
echo "Using NSIS_BIN: $nsis_bin"
echo "Using shim dir: $shim_dir"
command -v cl || true
command -v link || true
command -v python || true
python --version || true
command -v makensis || true
makensis -VERSION || true

./mach build 2>&1 | tee /c/Windows_software/bluegriffon/local-build-for-installer.log
build_rc=${PIPESTATUS[0]}
if [ "$build_rc" -ne 0 ]; then
  echo "mach build failed: $build_rc"
  exit "$build_rc"
fi

./mach package 2>&1 | tee /c/Windows_software/bluegriffon/local-package.log
pkg_rc=${PIPESTATUS[0]}
if [ "$pkg_rc" -ne 0 ]; then
  echo "mach package failed: $pkg_rc"
  exit "$pkg_rc"
fi

./mach build installer 2>&1 | tee /c/Windows_software/bluegriffon/local-installer.log
inst_rc=${PIPESTATUS[0]}
if [ "$inst_rc" -ne 0 ]; then
  echo "mach build installer failed: $inst_rc"
  exit "$inst_rc"
fi

echo "Installer commands completed successfully."
