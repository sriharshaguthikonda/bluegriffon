#!/usr/bin/env bash
set -euo pipefail

log_path=""
if [ -n "${BUILD_LOG:-}" ]; then
  log_path="$(cygpath -u "$BUILD_LOG" 2>/dev/null || true)"
fi
if [ -z "$log_path" ]; then
  log_path="$(pwd)/build.log"
fi

if ! ( : >>"$log_path" ) 2>/dev/null; then
  log_path="$(pwd)/build-worker.log"
fi

exec >>"$log_path" 2>&1
set -x

echo "Build log: $log_path"
echo "PWD (start): $(pwd)"

if [ -n "${BUILD_WORKDIR:-}" ]; then
  workdir="$(cygpath -u "$BUILD_WORKDIR" 2>/dev/null || true)"
  if [ -n "$workdir" ]; then
    echo "Changing to BUILD_WORKDIR: $workdir"
    cd "$workdir"
  else
    echo "WARNING: Failed to resolve BUILD_WORKDIR via cygpath; staying in $(pwd)"
  fi
fi
echo "PWD (after): $(pwd)"

# Ensure "python" is executable for mach.
PYTHON_EXE="/c/mozilla-build/python3/python.exe"
if [ -x "$PYTHON_EXE" ]; then
  shim_dir="$PWD/.build-tools"
  mkdir -p "$shim_dir"
  cat >"$shim_dir/python" <<'EOF'
#!/usr/bin/env bash
exec /c/mozilla-build/python3/python.exe "$@"
EOF
  chmod +x "$shim_dir/python"
  export PATH="$shim_dir:/c/mozilla-build/python3:/c/mozilla-build/python3/Scripts:$PATH"
  export PYTHON="$PYTHON_EXE"
fi
echo "python on PATH: $(command -v python || true)"
python --version || true

git clone https://github.com/mozilla/gecko-dev gecko-dev
git clone --local . gecko-dev/bluegriffon

cd gecko-dev
git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
patch -p1 < bluegriffon/config/gecko_dev_content.patch
patch -p1 < bluegriffon/config/gecko_dev_idl.patch

cp bluegriffon/config/mozconfig.win .mozconfig
./mach build

objdir_line="$(awk -F= '/^mk_add_options MOZ_OBJDIR=/{print $2}' .mozconfig | tail -1 | tr -d '\"')"
objdir="${objdir_line//@TOPSRCDIR@/$PWD}"
if [ -z "$objdir" ]; then
  objdir="$PWD/obj"
fi

dist_bin="$objdir/dist/bin"
echo "Resolved objdir: $objdir"
echo "Listing dist/bin (if it exists): $dist_bin"
if [ -d "$dist_bin" ]; then
  ls -la "$dist_bin"
else
  echo "dist/bin not found."
fi

exe_path="$(find "$objdir" -path "*/dist/bin/*" -iname "*griffon*.exe" -print -quit || true)"
if [ -z "$exe_path" ]; then
  echo "ERROR: BlueGriffon executable not found in $objdir."
  exit 2
fi
echo "Found executable: $exe_path"
