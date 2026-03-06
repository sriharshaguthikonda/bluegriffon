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
echo "uname: $(uname -a || true)"

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
echo "Listing .github/scripts:"
ls -la .github/scripts || true

# Ensure "python" is executable for mach (prefer Python 2.7 for this Gecko revision).
shim_dir="$PWD/.build-tools"
py_dir=""
mkdir -p "$shim_dir"
echo "PYTHON2_EXE (env): ${PYTHON2_EXE:-}"
echo "python2.7 on PATH: $(command -v python2.7 || true)"
echo "python2 on PATH: $(command -v python2 || true)"

PYTHON_EXE_CAND=""
if [ -n "${PYTHON2_EXE:-}" ]; then
  PYTHON_EXE_CAND="$PYTHON2_EXE"
fi
if [ -z "$PYTHON_EXE_CAND" ]; then
  for p in /c/Python27/python.exe /c/Python27/python2.exe /c/Python27/python2.7.exe; do
    if [ -x "$p" ]; then
      PYTHON_EXE_CAND="$p"
      break
    fi
  done
fi
if [ -z "$PYTHON_EXE_CAND" ]; then
  if command -v python2.7 >/dev/null 2>&1; then
    PYTHON_EXE_CAND="$(command -v python2.7)"
  elif command -v python2 >/dev/null 2>&1; then
    PYTHON_EXE_CAND="$(command -v python2)"
  fi
fi
if [ -z "$PYTHON_EXE_CAND" ]; then
  PYTHON_EXE_CAND="${PYTHON_EXE:-/c/mozilla-build/python3/python.exe}"
fi
if [[ "$PYTHON_EXE_CAND" =~ ^[A-Za-z]: ]]; then
  PYTHON_EXE_CAND="$(cygpath -u "$PYTHON_EXE_CAND" 2>/dev/null || true)"
fi
if [ -x "$PYTHON_EXE_CAND" ]; then
  cat >"$shim_dir/python" <<EOF
#!/usr/bin/env bash
exec "$PYTHON_EXE_CAND" "\$@"
EOF
  chmod +x "$shim_dir/python"
  py_dir="$(dirname "$PYTHON_EXE_CAND")"
  export PATH="$shim_dir:$py_dir:$py_dir/Scripts:$PATH"
  export PYTHON="$PYTHON_EXE_CAND"
  echo "Using python: $PYTHON_EXE_CAND"
else
  echo "WARNING: Python executable not found; mach may fail."
fi
echo "python on PATH: $(command -v python || true)"
python --version || true

# Ensure MSVC bin is early in PATH so link/cl resolve correctly.
msvc_bin_u=""
if [ -n "${MSVC_BIN:-}" ]; then
  msvc_bin_u="$(cygpath -u "$MSVC_BIN" 2>/dev/null || true)"
  if [ -n "$msvc_bin_u" ] && [ -d "$msvc_bin_u" ]; then
    export PATH="$msvc_bin_u:$PATH"
    echo "MSVC_BIN (path): $msvc_bin_u"
  else
    echo "MSVC_BIN not found: $MSVC_BIN"
  fi
fi

# Prefer MSYS2 tools over Strawberry Perl (without breaking MSVC link).
msys_usr="/c/mozilla-build/msys2/usr/bin"
msys_mingw="/c/mozilla-build/msys2/mingw64/bin"
moz_bin="/c/mozilla-build/bin"

sanitize_path() {
  local input="$1"
  local seen=""
  local out=()
  IFS=':' read -r -a parts <<< "$input"
  for p in "${parts[@]}"; do
    [ -z "$p" ] && continue
    if echo "$p" | grep -qi '^/c/Strawberry'; then
      continue
    fi
    if [[ ":$seen:" != *":$p:"* ]]; then
      out+=("$p")
      seen="$seen:$p"
    fi
  done
  IFS=':'; echo "${out[*]}"
}

base_path="$(sanitize_path "$PATH")"
priority_path=""
for p in "$shim_dir" "$py_dir" "$py_dir/Scripts" "$msvc_bin_u" "$moz_bin" "$msys_usr" "$msys_mingw"; do
  if [ -n "$p" ] && [ -d "$p" ]; then
    if [ -z "$priority_path" ]; then
      priority_path="$p"
    else
      priority_path="$priority_path:$p"
    fi
  fi
done
PATH="$(sanitize_path "${priority_path:+$priority_path:}$base_path")"
export PATH
echo "PATH (sanitized): $PATH"

export MSYS2_PATH_TYPE=inherit

if [ -n "$msvc_bin_u" ] && [ -x "$msvc_bin_u/link.exe" ]; then
  cat >"$shim_dir/link" <<EOF
#!/usr/bin/env bash
exec "$msvc_bin_u/link.exe" "\$@"
EOF
  chmod +x "$shim_dir/link"
  echo "link shim: $shim_dir/link -> $msvc_bin_u/link.exe"
fi

if command -v pacman >/dev/null 2>&1; then
  pacman -Sy --noconfirm || true
  pacman -S --noconfirm --needed \
    pkgconf mingw-w64-x86_64-pkgconf \
    yasm mingw-w64-x86_64-yasm \
    zip mingw-w64-x86_64-zip || true
  pacman -Q pkgconf mingw-w64-x86_64-pkgconf yasm mingw-w64-x86_64-yasm zip mingw-w64-x86_64-zip || true
else
  echo "WARNING: pacman not found; MSYS2 packages not installed."
fi

PKG_CONFIG_CAND=""
for p in /c/mozilla-build/msys2/mingw64/bin/pkg-config.exe \
         /c/mozilla-build/msys2/mingw64/bin/pkgconf.exe \
         /c/mozilla-build/msys2/usr/bin/pkg-config.exe \
         /c/mozilla-build/msys2/usr/bin/pkgconf.exe \
         /c/mozilla-build/msys2/usr/bin/pkg-config \
         /c/mozilla-build/msys2/usr/bin/pkgconf \
         /usr/bin/pkg-config \
         /usr/bin/pkgconf; do
  if [ -x "$p" ]; then
    PKG_CONFIG_CAND="$p"
    break
  fi
done
if [ -n "$PKG_CONFIG_CAND" ]; then
  export PKG_CONFIG="$PKG_CONFIG_CAND"
  cat >"$shim_dir/pkg-config" <<EOF
#!/usr/bin/env bash
exec "$PKG_CONFIG_CAND" "\$@"
EOF
  chmod +x "$shim_dir/pkg-config"
  echo "pkg-config shim: $shim_dir/pkg-config -> $PKG_CONFIG_CAND"
fi
export PKG_CONFIG_PATH="/c/mozilla-build/msys2/mingw64/lib/pkgconfig:/c/mozilla-build/msys2/mingw64/share/pkgconfig:/c/mozilla-build/msys2/usr/lib/pkgconfig:/c/mozilla-build/msys2/usr/share/pkgconfig"

echo "pkg-config env: ${PKG_CONFIG:-}"
echo "pkg-config on PATH: $(command -v pkg-config || true)"
pkg-config --version || true
echo "pkgconf on PATH: $(command -v pkgconf || true)"
pkgconf --version || true

echo "cl on PATH: $(command -v cl || true)"
echo "clang-cl on PATH: $(command -v clang-cl || true)"
echo "gcc on PATH: $(command -v gcc || true)"
echo "link on PATH: $(command -v link || true)"
if [ -n "$msvc_bin_u" ] && [ -x "$msvc_bin_u/link.exe" ]; then
  export LINK="$msvc_bin_u/link.exe"
  export LD="$msvc_bin_u/link.exe"
  echo "LINK forced to: $LINK"
fi

echo "make on PATH: $(command -v make || true)"
echo "mozmake on PATH: $(command -v mozmake || true)"
echo "zip on PATH: $(command -v zip || true)"
if ! command -v zip >/dev/null 2>&1 && [ -x "$moz_bin/zip.exe" ]; then
  export PATH="$moz_bin:$PATH"
  echo "Added mozilla-build zip to PATH"
  echo "zip on PATH (after): $(command -v zip || true)"
fi
echo "yasm on PATH: $(command -v yasm || true)"

MOZMAKE_CAND=""
if command -v mozmake >/dev/null 2>&1; then
  MOZMAKE_CAND="$(command -v mozmake)"
elif command -v make >/dev/null 2>&1; then
  MOZMAKE_CAND="$(command -v make)"
fi
if [ -z "$MOZMAKE_CAND" ]; then
  for p in /c/mozilla-build/mozmake.exe \
           /c/mozilla-build/mozmake \
           /c/mozilla-build/bin/mozmake.exe \
           /c/mozilla-build/bin/make.exe \
           /c/mozilla-build/msys2/usr/bin/mozmake.exe \
           /c/mozilla-build/msys2/usr/bin/make.exe \
           /c/mozilla-build/msys2/mingw64/bin/make.exe \
           /c/mingw64/bin/make.exe \
           /c/mingw64/bin/mozmake.exe \
           /c/Program\ Files/Git/mingw64/bin/make.exe \
           /c/Program\ Files/Git/usr/bin/make.exe \
           /usr/bin/make \
           /mingw64/bin/make; do
    if [ -x "$p" ]; then
      MOZMAKE_CAND="$p"
      break
    fi
  done
fi
if [[ "$MOZMAKE_CAND" =~ ^[A-Za-z]: ]]; then
  MOZMAKE_CAND="$(cygpath -u "$MOZMAKE_CAND" 2>/dev/null || true)"
fi
if [ -n "$MOZMAKE_CAND" ] && [ -x "$MOZMAKE_CAND" ]; then
  export MOZBUILD_MOZMAKE="$MOZMAKE_CAND"
  export MAKE="$MOZMAKE_CAND"
  echo "Using make: $MOZMAKE_CAND"
else
  echo "WARNING: make/mozmake not found; mach may fail."
fi
echo "PATH (after make selection): $PATH"

# Avoid CRLF checkouts that break client.mk (force LF).
git -c core.autocrlf=false -c core.eol=lf clone https://github.com/mozilla/gecko-dev gecko-dev
git -c core.autocrlf=false -c core.eol=lf clone --local . gecko-dev/bluegriffon

cd gecko-dev
git config core.autocrlf false
git config core.eol lf
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
