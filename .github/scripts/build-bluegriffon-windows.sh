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

if command -v tee >/dev/null 2>&1; then
  # Keep full worker output in file and stream it to parent process logs.
  exec > >(tee -a "$log_path") 2>&1
else
  exec >>"$log_path" 2>&1
fi
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
  for p in /c/Python27_18/python.exe /c/Python27/python.exe /c/Python27/python2.exe /c/Python27/python2.7.exe; do
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
if [[ "$PYTHON_EXE_CAND" =~ ^[A-Za-z]: ]]; then
  PYTHON_EXE_CAND="$(cygpath -u "$PYTHON_EXE_CAND" 2>/dev/null || true)"
fi
if [ -z "$PYTHON_EXE_CAND" ] || [ ! -x "$PYTHON_EXE_CAND" ]; then
  echo "ERROR: Python 2.7 executable not found. Set PYTHON2_EXE or install Python 2.7."
  exit 11
fi
if ! "$PYTHON_EXE_CAND" - <<'PY'
import __builtin__
print("python2_ok")
PY
then
  echo "ERROR: Selected python is not Python 2 compatible (__builtin__ missing): $PYTHON_EXE_CAND"
  exit 12
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
fi
echo "python on PATH: $(command -v python || true)"
python --version || true

# Ensure MSVC bin is early in PATH so link/cl resolve correctly.
msvc_bin_u=""
if [ -n "${MSVC_BIN:-}" ]; then
  msvc_bin_u="$(cygpath -u "$MSVC_BIN" 2>/dev/null || true)"
fi
if [ -z "$msvc_bin_u" ] || [ ! -d "$msvc_bin_u" ]; then
  cl_path="$(command -v cl 2>/dev/null || true)"
  if [ -n "$cl_path" ]; then
    msvc_bin_u="$(dirname "$cl_path")"
  fi
fi
if [ -n "$msvc_bin_u" ] && [ -d "$msvc_bin_u" ]; then
  export PATH="$msvc_bin_u:$PATH"
  echo "MSVC_BIN (path): $msvc_bin_u"
else
  echo "MSVC_BIN not found (env or cl): ${MSVC_BIN:-}"
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
for p in "$shim_dir" "$py_dir" "$py_dir/Scripts" "$msvc_bin_u" "$moz_bin" "$msys_usr" "$msys_mingw" "$HOME/.cargo/bin" "/c/Users/${USERNAME:-}/.cargo/bin" "/c/Users/runneradmin/.cargo/bin"; do
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

pkg_cache="$PWD/.build-tools/msys2-pkgs"
pkg_root="$PWD/.build-tools/msys2-root"
mkdir -p "$pkg_cache" "$pkg_root"

extract_pkg_tar() {
  local pkg_file="$1"
  local out_dir="$2"
  if [ -x /c/mozilla-build/bin/7z.exe ]; then
    /c/mozilla-build/bin/7z.exe x -y "$pkg_file" -o"$pkg_cache" >/dev/null || return 1
    local tmp_tar="$pkg_cache/$(basename "$pkg_file" .zst)"
    /c/mozilla-build/bin/7z.exe x -y "$tmp_tar" -o"$out_dir" >/dev/null || return 1
    return 0
  fi
  local win_tar="/c/Windows/System32/tar.exe"
  if [ -x "$win_tar" ] && "$win_tar" --help 2>/dev/null | grep -qi zstd; then
    "$win_tar" --zstd -xf "$pkg_file" -C "$out_dir" || return 1
    return 0
  fi
  if command -v zstd >/dev/null 2>&1; then
    local tmp_tar="$pkg_cache/$(basename "$pkg_file" .zst)"
    zstd -d -f -o "$tmp_tar" "$pkg_file" || return 1
    if [ -x "$win_tar" ]; then
      "$win_tar" -xf "$tmp_tar" -C "$out_dir" || return 1
    else
      tar -xf "$tmp_tar" -C "$out_dir" || return 1
    fi
    return 0
  fi
  if tar --help 2>/dev/null | grep -qi zstd; then
    tar --zstd -xf "$pkg_file" -C "$out_dir" || return 1
    return 0
  fi
  return 1
}

download_msys2_pkg() {
  local pkg="$1"
  local url=""
  local py3="/c/mozilla-build/python3/python.exe"
  if [ ! -x "$py3" ]; then
    py3="$(command -v python3 || true)"
  fi
  if [ -z "$py3" ]; then
    echo "WARNING: python3 not found; cannot query MSYS2 API for $pkg"
    return 1
  fi
  url="$("$py3" - "$pkg" <<'PY'
import json, sys, urllib.request
pkg = sys.argv[1]
with urllib.request.urlopen(f"https://packages.msys2.org/api/search?query={pkg}") as f:
    data = json.load(f)
exact = (data.get("results") or {}).get("exact") or {}
if exact.get("name") != pkg:
    print("")
    sys.exit(0)
repo = (exact.get("repos") or [None])[0]
arch = (exact.get("arches") or [None])[0]
ver = exact.get("version")
if not (repo and arch and ver):
    print("")
    sys.exit(0)
if repo == "msys":
    base = "https://mirror.msys2.org/msys/x86_64"
elif repo.startswith("mingw"):
    base = "https://mirror.msys2.org/mingw/x86_64"
else:
    base = f"https://mirror.msys2.org/{repo}/x86_64"
print(f"{base}/{pkg}-{ver}-{arch}.pkg.tar.zst")
PY
)"
  if [ -z "$url" ]; then
    echo "WARNING: Could not resolve MSYS2 package URL for $pkg via API"
    return 1
  fi
  local pkg_file="$pkg_cache/$(basename "$url")"
  if [ ! -f "$pkg_file" ]; then
    echo "Downloading $pkg from $url"
    curl -fsSL -o "$pkg_file" "$url" || return 1
  fi
  extract_pkg_tar "$pkg_file" "$pkg_root" || return 1
  return 0
}

pacman_bin=""
for p in /c/mozilla-build/msys2/usr/bin/pacman.exe /c/mozilla-build/msys2/usr/bin/pacman; do
  if [ -x "$p" ]; then
    pacman_bin="$p"
    break
  fi
done

if [ -n "$pacman_bin" ]; then
  "$pacman_bin" -Sy --noconfirm || true
  "$pacman_bin" -S --noconfirm --needed \
    pkgconf mingw-w64-x86_64-pkgconf \
    yasm mingw-w64-x86_64-yasm \
    zip mingw-w64-x86_64-zip \
    autoconf2.13 || true
  "$pacman_bin" -Q pkgconf mingw-w64-x86_64-pkgconf yasm mingw-w64-x86_64-yasm zip mingw-w64-x86_64-zip autoconf2.13 || true
else
  echo "WARNING: pacman not found; downloading MSYS2 packages directly."
  if ! command -v autoconf-2.13 >/dev/null 2>&1 && ! command -v autoconf213 >/dev/null 2>&1; then
    download_msys2_pkg autoconf2.13 || true
  fi
  if ! command -v pkg-config >/dev/null 2>&1 && ! command -v pkgconf >/dev/null 2>&1; then
    download_msys2_pkg pkgconf || true
  fi
  if ! command -v yasm >/dev/null 2>&1; then
    download_msys2_pkg mingw-w64-x86_64-yasm || download_msys2_pkg yasm || true
  fi
fi

if [ -d "$pkg_root/mingw64/bin" ]; then
  # Prefer mingw64 tools over msys variants when both are present.
  PATH="$(sanitize_path "$PATH:$pkg_root/mingw64/bin")"
  export PATH
  echo "Added msys2-root mingw64/bin to PATH (fallback): $pkg_root/mingw64/bin"
fi
if [ -d "$pkg_root/usr/bin" ]; then
  # Keep bundled MozillaBuild tools first; use extracted tools only as fallback.
  PATH="$(sanitize_path "$PATH:$pkg_root/usr/bin")"
  export PATH
  echo "Added msys2-root usr/bin to PATH (fallback): $pkg_root/usr/bin"
fi
PATH="$(sanitize_path "$shim_dir:$PATH")"
export PATH

PKG_CONFIG_CAND=""
for p in /c/mozilla-build/msys2/mingw64/bin/pkg-config.exe \
         /c/mozilla-build/msys2/mingw64/bin/pkgconf.exe \
         /c/mozilla-build/msys2/usr/bin/pkg-config.exe \
         /c/mozilla-build/msys2/usr/bin/pkgconf.exe \
         /c/mozilla-build/msys2/usr/bin/pkg-config \
         /c/mozilla-build/msys2/usr/bin/pkgconf \
         "$pkg_root/usr/bin/pkg-config" \
         "$pkg_root/usr/bin/pkgconf" \
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
echo "autoconf-2.13 on PATH: $(command -v autoconf-2.13 || true)"
echo "autoconf213 on PATH: $(command -v autoconf213 || true)"
AUTOCONF_CAND=""
AUTOCONF_MACRODIR=""
for p in /c/mozilla-build/msys2/usr/bin/autoconf-2.13 \
         /usr/bin/autoconf-2.13 \
         /c/mozilla-build/msys2/usr/bin/autoconf213 \
         /usr/bin/autoconf213 \
         "$pkg_root/usr/bin/autoconf-2.13" \
         "$pkg_root/usr/bin/autoconf213"; do
  if [ -x "$p" ]; then
    AUTOCONF_CAND="$p"
    break
  fi
done
if [ -n "$AUTOCONF_CAND" ]; then
  if [[ "$AUTOCONF_CAND" == "$pkg_root/"* ]] && [ -d "$pkg_root/usr/share/autoconf-2.13" ]; then
    AUTOCONF_MACRODIR="$pkg_root/usr/share/autoconf-2.13"
  fi
  cat >"$shim_dir/autoconf-2.13" <<EOF
#!/usr/bin/env bash
if [ -n "$AUTOCONF_MACRODIR" ]; then
  export AC_MACRODIR="$AUTOCONF_MACRODIR"
fi
exec "$AUTOCONF_CAND" "\$@"
EOF
  chmod +x "$shim_dir/autoconf-2.13"
  cat >"$shim_dir/autoconf213" <<EOF
#!/usr/bin/env bash
if [ -n "$AUTOCONF_MACRODIR" ]; then
  export AC_MACRODIR="$AUTOCONF_MACRODIR"
fi
exec "$AUTOCONF_CAND" "\$@"
EOF
  chmod +x "$shim_dir/autoconf213"
  export AUTOCONF="$shim_dir/autoconf-2.13"
  echo "Using autoconf: $AUTOCONF_CAND"
  echo "AUTOCONF env: $AUTOCONF"
  if [ -n "$AUTOCONF_MACRODIR" ]; then
    echo "Using AC_MACRODIR: $AUTOCONF_MACRODIR"
  fi
fi

echo "cl on PATH: $(command -v cl || true)"
echo "clang-cl on PATH: $(command -v clang-cl || true)"
echo "gcc on PATH: $(command -v gcc || true)"
echo "link on PATH: $(command -v link || true)"

echo "make on PATH: $(command -v make || true)"
echo "mozmake on PATH: $(command -v mozmake || true)"
echo "zip on PATH: $(command -v zip || true)"
if ! command -v zip >/dev/null 2>&1 && [ -x "$moz_bin/zip.exe" ]; then
  export PATH="$moz_bin:$PATH"
  echo "Added mozilla-build zip to PATH"
  echo "zip on PATH (after): $(command -v zip || true)"
fi

yasm_smoke_test() {
  local yasm_bin="$1"
  local yasm_test_dir="$PWD/.build-tools/yasm-test"
  [ -x "$yasm_bin" ] || return 1
  mkdir -p "$yasm_test_dir"
  cat >"$yasm_test_dir/test.asm" <<'EOF'
global _bg_yasm_smoke
section .text
_bg_yasm_smoke:
  ret
EOF
  "$yasm_bin" -f x64 -o "$yasm_test_dir/test.obj" "$yasm_test_dir/test.asm" >/dev/null 2>&1 || return 1
  [ -s "$yasm_test_dir/test.obj" ]
}

YASM_CAND=""
for p in /c/ProgramData/chocolatey/lib/yasm/tools/yasm.exe \
         /c/mozilla-build/msys2/mingw64/bin/yasm.exe \
         /c/mozilla-build/msys2/usr/bin/yasm.exe \
         "$pkg_root/mingw64/bin/yasm.exe" \
         "$pkg_root/usr/bin/yasm.exe" \
         /c/ProgramData/chocolatey/bin/yasm.exe \
         /c/ProgramData/chocolatey/bin/yasm \
         "$(command -v yasm 2>/dev/null || true)"; do
  [ -n "$p" ] || continue
  if yasm_smoke_test "$p"; then
    YASM_CAND="$p"
    break
  fi
done
if [ -n "$YASM_CAND" ]; then
  yasm_real="$YASM_CAND"
  if [[ "$YASM_CAND" == /c/ProgramData/chocolatey/bin/* ]]; then
    if [ -x /c/ProgramData/chocolatey/lib/yasm/tools/yasm.exe ] && yasm_smoke_test /c/ProgramData/chocolatey/lib/yasm/tools/yasm.exe; then
      yasm_real="/c/ProgramData/chocolatey/lib/yasm/tools/yasm.exe"
    fi
  fi
  yasm_dir="$(dirname "$yasm_real")"
  PATH="$(sanitize_path "$yasm_dir:$PATH")"
  export PATH
  cp -f "$yasm_real" "$shim_dir/yasm.exe"
  cp -f "$yasm_real" "$shim_dir/yasm"
  chmod +x "$shim_dir/yasm" || true
  chmod +x "$shim_dir/yasm.exe" || true
  if [ -d /c/mozilla-build/bin ]; then
    cp -f "$yasm_real" /c/mozilla-build/bin/yasm.exe || true
    cp -f "$yasm_real" /c/mozilla-build/bin/yasm || true
    chmod +x /c/mozilla-build/bin/yasm /c/mozilla-build/bin/yasm.exe || true
  fi
  if [ -d /c/mozilla-build/msys2/usr/bin ]; then
    cp -f "$yasm_real" /c/mozilla-build/msys2/usr/bin/yasm.exe || true
    cp -f "$yasm_real" /c/mozilla-build/msys2/usr/bin/yasm || true
    chmod +x /c/mozilla-build/msys2/usr/bin/yasm /c/mozilla-build/msys2/usr/bin/yasm.exe || true
  fi
  export YASM="$shim_dir/yasm.exe"
  echo "Using yasm: $yasm_real"
  echo "YASM env: $YASM"
else
  echo "ERROR: No working yasm binary found."
  exit 13
fi
echo "yasm on PATH: $(command -v yasm || true)"
yasm --version || true

RUST_TOOLCHAIN_CAND="${RUST_TOOLCHAIN:-1.19.0-x86_64-pc-windows-msvc}"
echo "Requested Rust toolchain: $RUST_TOOLCHAIN_CAND"
echo "rustup on PATH: $(command -v rustup || true)"
if command -v rustup >/dev/null 2>&1; then
  rust_selected=""
  for tc in "$RUST_TOOLCHAIN_CAND" 1.19.0-x86_64-pc-windows-msvc 1.19.0; do
    [ -n "$tc" ] || continue
    rustup toolchain install "$tc" --profile minimal || true
    if rustup run "$tc" rustc --version >/dev/null 2>&1; then
      rust_selected="$tc"
      break
    fi
  done
  if [ -n "$rust_selected" ]; then
    export RUSTUP_TOOLCHAIN="$rust_selected"
    rustc_path="$(rustup which --toolchain "$rust_selected" rustc 2>/dev/null || true)"
    cargo_path="$(rustup which --toolchain "$rust_selected" cargo 2>/dev/null || true)"
    if [ -n "$rustc_path" ] && [ -x "$rustc_path" ]; then
      export RUSTC="$rustc_path"
      rust_bin_dir="$(dirname "$rustc_path")"
      PATH="$(sanitize_path "$rust_bin_dir:$PATH")"
      export PATH
    fi
    if [ -n "$cargo_path" ] && [ -x "$cargo_path" ]; then
      export CARGO="$cargo_path"
    fi
    echo "Using Rust toolchain: $RUSTUP_TOOLCHAIN"
  else
    echo "WARNING: Could not activate Rust 1.19 toolchain. Continuing with default rustc."
  fi
else
  echo "WARNING: rustup not available. Continuing with default rustc."
fi
echo "RUSTUP_TOOLCHAIN env: ${RUSTUP_TOOLCHAIN:-}"
echo "RUSTC env: ${RUSTC:-}"
echo "CARGO env: ${CARGO:-}"
echo "rustc on PATH: $(command -v rustc || true)"
echo "cargo on PATH: $(command -v cargo || true)"
rustc --version || true
cargo --version || true

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
patch -p1 < bluegriffon/config/gecko_dev_local_build_fixes.patch

cp bluegriffon/config/mozconfig.win .mozconfig
# Keep YASM visible to old-configure sub-configures (e.g. js/src).
echo "mk_add_options YASM=$YASM" >> .mozconfig
echo "Injected into .mozconfig: mk_add_options YASM=$YASM"
export BLUEGRIFFON_YASM="$YASM"
echo "BLUEGRIFFON_YASM: $BLUEGRIFFON_YASM"
objdir_line="$(awk -F= '/^mk_add_options MOZ_OBJDIR=/{print $2}' .mozconfig | tail -1 | tr -d '\"')"
objdir="${objdir_line//@TOPSRCDIR@/$PWD}"
if [ -z "$objdir" ]; then
  objdir="$PWD/obj"
fi

set +e
./mach build
build_rc=$?
set -e

if [ "$build_rc" -ne 0 ]; then
  echo "mach build failed with exit code: $build_rc"
  icu_src="$PWD/config/external/icu/data"
  icu_obj="$objdir/config/external/icu/data"
  echo "ICU source dir: $icu_src"
  ls -la "$icu_src" || true
  echo "ICU obj dir: $icu_obj"
  ls -la "$icu_obj" || true
  if [ -f "$icu_obj/backend.mk" ]; then
    echo "==== ICU backend.mk ===="
    sed -n '1,200p' "$icu_obj/backend.mk" || true
  fi
  if [ -f "$icu_obj/Makefile" ] && command -v make >/dev/null 2>&1; then
    echo "==== make -n icudata.obj (diagnostic) ===="
    make -C "$icu_obj" -n icudata.obj || true
  fi
  exit "$build_rc"
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
