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

# Ensure "python" is executable for mach (prefer Python 3.9+ for this Gecko revision).
shim_dir="$PWD/.build-tools"
py_dir=""
mkdir -p "$shim_dir"
echo "PYTHON3_EXE (env): ${PYTHON3_EXE:-}"
echo "python3 on PATH: $(command -v python3 || true)"

PYTHON_EXE_CAND=""
if [ -n "${PYTHON3_EXE:-}" ]; then
  PYTHON_EXE_CAND="$PYTHON3_EXE"
fi
if [ -z "$PYTHON_EXE_CAND" ]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_EXE_CAND="$(command -v python3)"
  fi
fi
if [ -z "$PYTHON_EXE_CAND" ]; then
  echo "ERROR: Python 3 executable not found. Set PYTHON3_EXE or install Python 3.9+."
  exit 11
fi
# Verify Python 3 compatibility
if ! "$PYTHON_EXE_CAND" - <<'PY'
import sys
if sys.version_info[0] < 3:
  print("ERROR: Python 3+ required, found: " + sys.version)
  exit(1)
print("python3_ok")
PY
then
  echo "ERROR: Selected python is not Python 3 compatible: $PYTHON_EXE_CAND"
  exit 12
fi
if [ -x "$PYTHON_EXE_CAND" ]; then
  # Legacy Gecko scripts may still resolve python2/python2.7 names.
  # Prefer a verified Python 2.7 interpreter and use it for mach.
  PYTHON2_EXE_CAND=""
  PYTHON2_ENV_CAND="${PYTHON2_EXE:-}"
  if [[ "$PYTHON2_ENV_CAND" =~ ^[A-Za-z]:\\ ]]; then
    PYTHON2_ENV_CAND="$(cygpath -u "$PYTHON2_ENV_CAND" 2>/dev/null || true)"
  fi
  echo "PYTHON2_EXE (env): ${PYTHON2_EXE:-}"
  for p in "$PYTHON2_ENV_CAND" \
           "$shim_dir/msys2-root/usr/bin/python2.7.exe" \
           /c/mozilla-build/python2/python.exe \
           /c/mozilla-build/python27/python.exe \
           "$(command -v python2.7 2>/dev/null || true)" \
           "$(command -v python2 2>/dev/null || true)"; do
    [ -n "$p" ] || continue
    if [ -x "$p" ]; then
      if "$p" - <<'PY' >/dev/null 2>&1
import __builtin__
PY
      then
        PYTHON2_EXE_CAND="$p"
        break
      fi
    fi
  done

  MACH_PYTHON_EXE_CAND="$PYTHON_EXE_CAND"
  if [ -z "$PYTHON2_EXE_CAND" ]; then
    PYTHON2_EXE_CAND="$PYTHON_EXE_CAND"
    echo "WARNING: Python 2.7 interpreter not found/usable; shims will use Python 3."
  else
    echo "Using python2 shim target: $PYTHON2_EXE_CAND"
    MACH_PYTHON_EXE_CAND="$PYTHON2_EXE_CAND"
  fi

  cat >"$shim_dir/python" <<EOF
#!/usr/bin/env bash
exec "$MACH_PYTHON_EXE_CAND" "\$@"
EOF
  chmod +x "$shim_dir/python"
  for legacy_py in python2 python2.7; do
    cat >"$shim_dir/$legacy_py" <<EOF
#!/usr/bin/env bash
exec "$PYTHON2_EXE_CAND" "\$@"
EOF
    chmod +x "$shim_dir/$legacy_py"
  done
  py_dir="$(dirname "$PYTHON_EXE_CAND")"
  export PATH="$shim_dir:$py_dir:$py_dir/Scripts:$PATH"
  export PYTHON="$MACH_PYTHON_EXE_CAND"
  echo "Using mach python: $MACH_PYTHON_EXE_CAND"
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

mt_bin_u=""
for p in /c/Program\ Files\ \(x86\)/Windows\ Kits/10/bin/*/x64/mt.exe \
         /c/Program\ Files\ \(x86\)/Windows\ Kits/10/bin/x64/mt.exe \
         /c/Program\ Files\ \(x86\)/Windows\ Kits/10/bin/*/x86/mt.exe \
         /c/Program\ Files\ \(x86\)/Windows\ Kits/10/bin/x86/mt.exe; do
  if [ -x "$p" ]; then
    mt_bin_u="$p"
    break
  fi
done
mt_dir_u=""
if [ -n "$mt_bin_u" ]; then
  mt_dir_u="$(dirname "$mt_bin_u")"
  export MT="$mt_bin_u"
  echo "MT_BIN (path): $mt_bin_u"
else
  echo "WARNING: mt.exe not found in Windows SDK default locations."
fi

win_system32="/c/Windows/System32"
if [ -x "$win_system32/makecab.exe" ]; then
  export MAKECAB="$win_system32/makecab.exe"
  echo "MAKECAB (path): $MAKECAB"
else
  echo "WARNING: makecab.exe not found at $win_system32/makecab.exe"
fi

# Prefer MSYS2 tools over Strawberry Perl (without breaking MSVC link).
msys_usr="/c/mozilla-build/msys2/usr/bin"
msys_mingw="/c/mozilla-build/msys2/mingw64/bin"
msys_ucrt="/c/mozilla-build/msys2/ucrt64/bin"
msys_clang="/c/mozilla-build/msys2/clang64/bin"
msys_mingw32="/c/mozilla-build/msys2/mingw32/bin"
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

strip_ambient_mingw_path() {
  local input="$1"
  local out=()
  IFS=':' read -r -a parts <<< "$input"
  for p in "${parts[@]}"; do
    [ -n "$p" ] || continue
    case "$p" in
      /c/mingw64/bin|/mingw64/bin|/c/mozilla-build/msys2/usr/bin|/c/mozilla-build/msys2/mingw64/bin|/c/mozilla-build/msys2/ucrt64/bin|/c/mozilla-build/msys2/clang64/bin|/c/mozilla-build/msys2/mingw32/bin)
        continue
        ;;
    esac
    out+=("$p")
  done
  IFS=':'; echo "${out[*]}"
}

build_path_from_dirs() {
  local out=""
  local p=""
  for p in "$@"; do
    [ -n "$p" ] || continue
    [ -d "$p" ] || continue
    if [ -z "$out" ]; then
      out="$p"
    else
      out="$out:$p"
    fi
  done
  sanitize_path "$out"
}

base_path="$(sanitize_path "$PATH")"
priority_path=""
for p in "$shim_dir" "$py_dir" "$py_dir/Scripts" "$msvc_bin_u" "$mt_dir_u" "$moz_bin" "$msys_usr" "$msys_mingw" "$msys_ucrt" "$msys_clang" "$msys_mingw32" "$win_system32"; do
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
export MSYS2_FORK_RETRY="${MSYS2_FORK_RETRY:-20}"
echo "MSYS2_FORK_RETRY: $MSYS2_FORK_RETRY"

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
  local mirror_url=""
  local downloaded=0
  local pkg_file=""
  local candidate=""
  local paths_seen=":"
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
  if [[ "$url" == https://mirror.msys2.org/* ]]; then
    mirror_url="https://repo.msys2.org/${url#https://mirror.msys2.org/}"
  fi
  pkg_file="$pkg_cache/$(basename "$url")"
  if [ ! -f "$pkg_file" ]; then
    for candidate in "$url" "$mirror_url"; do
      [ -n "$candidate" ] || continue
      if [[ "$paths_seen" == *":$candidate:"* ]]; then
        continue
      fi
      paths_seen="$paths_seen$candidate:"
      echo "Downloading $pkg from $candidate"
      if curl -fL --retry 6 --retry-delay 5 --retry-all-errors --connect-timeout 20 --max-time 300 -o "$pkg_file" "$candidate"; then
        downloaded=1
        break
      fi
      rm -f "$pkg_file" || true
      echo "WARNING: Download failed for $candidate"
    done
    if [ "$downloaded" -ne 1 ]; then
      return 1
    fi
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

# Last-resort GNU make from Chocolatey (native Windows binary, avoids MSYS fork issues).
choco_make="/c/ProgramData/chocolatey/bin/make.exe"
if [ ! -x "$choco_make" ]; then
  choco_bin=""
  for p in /c/ProgramData/chocolatey/bin/choco.exe /c/ProgramData/chocolatey/bin/choco /c/ProgramData/Chocolatey/bin/choco.exe /c/ProgramData/Chocolatey/bin/choco; do
    if [ -x "$p" ]; then
      choco_bin="$p"
      break
    fi
  done
  if [ -n "$choco_bin" ]; then
    "$choco_bin" install -y make --no-progress || true
  fi
fi

if [ -n "$pacman_bin" ]; then
  "$pacman_bin" -Sy --noconfirm || true
  for pkg in \
    mingw-w64-x86_64-make mingw-w64-ucrt-x86_64-make mingw-w64-clang-x86_64-make mingw-w64-i686-make \
    pkgconf mingw-w64-x86_64-pkgconf mingw-w64-ucrt-x86_64-pkgconf mingw-w64-clang-x86_64-pkgconf \
    yasm mingw-w64-x86_64-yasm mingw-w64-ucrt-x86_64-yasm mingw-w64-clang-x86_64-yasm \
    zip mingw-w64-x86_64-zip mingw-w64-ucrt-x86_64-zip mingw-w64-clang-x86_64-zip \
    autoconf2.13; do
    "$pacman_bin" -S --noconfirm --needed "$pkg" || true
  done
  "$pacman_bin" -Q | grep -E '(^| )(mingw-w64-.*-(make|pkgconf|yasm|zip)|pkgconf|yasm|zip|autoconf2.13)( |$)' || true
else
  echo "WARNING: pacman not found; downloading MSYS2 packages directly."
  if ! command -v autoconf-2.13 >/dev/null 2>&1 && ! command -v autoconf213 >/dev/null 2>&1; then
    download_msys2_pkg autoconf2.13 || true
  fi
  if ! command -v pkg-config >/dev/null 2>&1 && ! command -v pkgconf >/dev/null 2>&1; then
    download_msys2_pkg pkgconf || true
  fi
  if ! command -v yasm >/dev/null 2>&1; then
    download_msys2_pkg mingw-w64-x86_64-yasm || download_msys2_pkg mingw-w64-yasm || download_msys2_pkg yasm || true
  fi
  if [ ! -x /c/mozilla-build/msys2/usr/bin/make.exe ] && [ ! -x /c/mozilla-build/msys2/usr/bin/make ]; then
    if download_msys2_pkg make; then
      make_pkg="$(ls -t "$pkg_cache"/make-*.pkg.tar.zst 2>/dev/null | head -1 || true)"
      if [ -n "$make_pkg" ] && [ -d /c/mozilla-build/msys2 ]; then
        extract_pkg_tar "$make_pkg" /c/mozilla-build/msys2 || true
      fi
    fi
  fi
  pkg_make_found=0
  for p in \
    "$pkg_root/mingw64/bin/mingw32-make.exe" "$pkg_root/mingw64/bin/mingw32-make" \
    "$pkg_root/ucrt64/bin/mingw32-make.exe" "$pkg_root/ucrt64/bin/mingw32-make" \
    "$pkg_root/clang64/bin/mingw32-make.exe" "$pkg_root/clang64/bin/mingw32-make" \
    "$pkg_root/mingw32/bin/mingw32-make.exe" "$pkg_root/mingw32/bin/mingw32-make"; do
    if [ -x "$p" ]; then
      pkg_make_found=1
      break
    fi
  done
  if [ "$pkg_make_found" -ne 1 ]; then
    download_msys2_pkg mingw-w64-x86_64-make || \
      download_msys2_pkg mingw-w64-ucrt-x86_64-make || \
      download_msys2_pkg mingw-w64-clang-x86_64-make || \
      download_msys2_pkg mingw-w64-i686-make || \
      download_msys2_pkg mingw-w64-make || \
      download_msys2_pkg make || true
  fi
fi

for tool_dir in "$pkg_root/mingw64/bin" "$pkg_root/ucrt64/bin" "$pkg_root/clang64/bin" "$pkg_root/mingw32/bin"; do
  [ -d "$tool_dir" ] || continue
  # Prefer downloaded mingw-family tools over msys variants when both are present.
  PATH="$(sanitize_path "$PATH:$tool_dir")"
  export PATH
  echo "Added msys2-root tool bin to PATH (fallback): $tool_dir"
  ls -la "$tool_dir" | grep -Ei '(^|[ /])((mingw32-)?g?make|mozmake)(\.exe)?$' || true
done
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
echo "mingw32-make on PATH: $(command -v mingw32-make || true)"
echo "mozmake on PATH: $(command -v mozmake || true)"
echo "zip on PATH: $(command -v zip || true)"
if ! command -v zip >/dev/null 2>&1 && [ -x "$moz_bin/zip.exe" ]; then
  export PATH="$moz_bin:$PATH"
  echo "Added mozilla-build zip to PATH"
  echo "zip on PATH (after): $(command -v zip || true)"
fi
if ! command -v zip >/dev/null 2>&1; then
  ZIP_CAND=""
  for p in "$pkg_root/usr/bin/zip.exe" \
           "$pkg_root/usr/bin/zip" \
           /c/Program\ Files/Git/usr/bin/zip.exe \
           /c/Program\ Files/Git/mingw64/bin/zip.exe \
           /c/ProgramData/chocolatey/bin/zip.exe \
           /c/ProgramData/chocolatey/bin/zip; do
    if [ -x "$p" ]; then
      ZIP_CAND="$p"
      break
    fi
  done
  if [ -n "$ZIP_CAND" ]; then
    cat >"$shim_dir/zip" <<EOF
#!/usr/bin/env bash
exec "$ZIP_CAND" "\$@"
EOF
    chmod +x "$shim_dir/zip"
    cp -f "$ZIP_CAND" "$shim_dir/zip.exe" || true
    export PATH="$shim_dir:$PATH"
    echo "zip shim: $shim_dir/zip -> $ZIP_CAND"
    echo "zip on PATH (after shim): $(command -v zip || true)"
  fi
fi

yasm_smoke_test() {
  local yasm_bin="$1"
  local yasm_ver=""
  local yasm_major=0
  local yasm_minor=0
  local yasm_test_dir="$PWD/.build-tools/yasm-test"
  [ -x "$yasm_bin" ] || return 1
  yasm_ver="$("$yasm_bin" --version 2>/dev/null | awk 'NR==1{print $2}')"
  yasm_major="${yasm_ver%%.*}"
  yasm_minor="${yasm_ver#*.}"
  yasm_minor="${yasm_minor%%.*}"
  if ! [[ "$yasm_major" =~ ^[0-9]+$ && "$yasm_minor" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  if [ "$yasm_major" -lt 1 ] || { [ "$yasm_major" -eq 1 ] && [ "$yasm_minor" -lt 3 ]; }; then
    return 1
  fi
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
for p in /c/mozilla-build/msys2/mingw64/bin/yasm.exe \
         /c/mozilla-build/msys2/usr/bin/yasm.exe \
         "$pkg_root/mingw64/bin/yasm.exe" \
         "$pkg_root/usr/bin/yasm.exe" \
         /c/ProgramData/chocolatey/lib/yasm/tools/yasm.exe \
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
  if [ -d "$pkg_root/usr/bin" ]; then
    cp -f "$yasm_real" "$pkg_root/usr/bin/yasm.exe" || true
    cp -f "$yasm_real" "$pkg_root/usr/bin/yasm" || true
    chmod +x "$pkg_root/usr/bin/yasm" "$pkg_root/usr/bin/yasm.exe" || true
  fi
  if [ -d "$pkg_root/mingw64/bin" ]; then
    cp -f "$yasm_real" "$pkg_root/mingw64/bin/yasm.exe" || true
    cp -f "$yasm_real" "$pkg_root/mingw64/bin/yasm" || true
    chmod +x "$pkg_root/mingw64/bin/yasm" "$pkg_root/mingw64/bin/yasm.exe" || true
  fi
  yasm_wrapper_cmd="$shim_dir/yasm-wrapper.cmd"
  cat >"$yasm_wrapper_cmd" <<'EOF'
@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "REAL_YASM=%~dp0yasm.exe"
if not exist "%REAL_YASM%" (
  echo ERROR: yasm wrapper cannot find "%REAL_YASM%"
  exit /b 2
)
set "HAS_SRC=0"
for %%I in (%*) do (
  set "EXT=%%~xI"
  if /I "!EXT!"==".s" set "HAS_SRC=1"
  if /I "!EXT!"==".asm" set "HAS_SRC=1"
)
if "!HAS_SRC!"=="0" (
  if exist "icudata.s" (
    "%REAL_YASM%" %* icudata.s
    exit /b %ERRORLEVEL%
  )
  if not "%BLUEGRIFFON_ICUDATA_SRC_WIN%"=="" if exist "%BLUEGRIFFON_ICUDATA_SRC_WIN%" (
    "%REAL_YASM%" %* "%BLUEGRIFFON_ICUDATA_SRC_WIN%"
    exit /b %ERRORLEVEL%
  )
)
"%REAL_YASM%" %*
exit /b %ERRORLEVEL%
EOF
  export YASM="$yasm_real"
  YASM_FOR_MOZCONFIG="$yasm_wrapper_cmd"
  if [[ "$YASM_FOR_MOZCONFIG" == /* ]]; then
    YASM_FOR_MOZCONFIG="$(cygpath -m "$YASM_FOR_MOZCONFIG" 2>/dev/null || echo "$YASM_FOR_MOZCONFIG")"
  fi
  echo "Using yasm: $yasm_real"
  echo "YASM env: $YASM"
  echo "YASM mozconfig: $YASM_FOR_MOZCONFIG"
else
  echo "ERROR: No working yasm binary found."
  exit 13
fi
echo "yasm on PATH: $(command -v yasm || true)"
yasm --version || true

make_smoke_test() {
  local make_bin="$1"
  [ -x "$make_bin" ] || return 1
  "$make_bin" --version >/dev/null 2>&1
}

MOZMAKE_CAND=""
is_untrusted_make_candidate() {
  case "$1" in
    /c/mingw64/bin/*|/mingw64/bin/*)
      return 0
      ;;
  esac
  return 1
}

PATH="$(strip_ambient_mingw_path "$(sanitize_path "$PATH")")"
export PATH
echo "PATH (without ambient mingw64): $PATH"

# Prefer non-MSYS make binaries first; keep MSYS make only as final fallback.
for p in /c/mozilla-build/mozmake.exe \
         /c/mozilla-build/mozmake \
         /c/mozilla-build/bin/mingw32-make.exe \
         /c/mozilla-build/bin/mingw32-make \
         /c/mozilla-build/bin/gmake.exe \
         /c/mozilla-build/bin/gmake \
         /c/mozilla-build/bin/make.exe \
         /c/mozilla-build/bin/make \
         /c/ProgramData/chocolatey/bin/make.exe \
         /c/ProgramData/chocolatey/bin/make \
         /c/ProgramData/Chocolatey/bin/make.exe \
         /c/ProgramData/Chocolatey/bin/make \
         /c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe \
         /c/mozilla-build/msys2/mingw64/bin/mingw32-make \
         /c/mozilla-build/msys2/mingw64/bin/gmake.exe \
         /c/mozilla-build/msys2/mingw64/bin/gmake \
         /c/mozilla-build/msys2/mingw64/bin/make.exe \
         /c/mozilla-build/msys2/mingw64/bin/make \
         /c/mozilla-build/msys2/ucrt64/bin/mingw32-make.exe \
         /c/mozilla-build/msys2/ucrt64/bin/mingw32-make \
         /c/mozilla-build/msys2/ucrt64/bin/gmake.exe \
         /c/mozilla-build/msys2/ucrt64/bin/gmake \
         /c/mozilla-build/msys2/ucrt64/bin/make.exe \
         /c/mozilla-build/msys2/ucrt64/bin/make \
         /c/mozilla-build/msys2/clang64/bin/mingw32-make.exe \
         /c/mozilla-build/msys2/clang64/bin/mingw32-make \
         /c/mozilla-build/msys2/clang64/bin/gmake.exe \
         /c/mozilla-build/msys2/clang64/bin/gmake \
         /c/mozilla-build/msys2/clang64/bin/make.exe \
         /c/mozilla-build/msys2/clang64/bin/make \
         /c/mozilla-build/msys2/mingw32/bin/mingw32-make.exe \
         /c/mozilla-build/msys2/mingw32/bin/mingw32-make \
         /c/mozilla-build/msys2/mingw32/bin/gmake.exe \
         /c/mozilla-build/msys2/mingw32/bin/gmake \
         /c/mozilla-build/msys2/mingw32/bin/make.exe \
         /c/mozilla-build/msys2/mingw32/bin/make \
         "$pkg_root/mingw64/bin/mingw32-make.exe" \
         "$pkg_root/mingw64/bin/mingw32-make" \
         "$pkg_root/mingw64/bin/gmake.exe" \
         "$pkg_root/mingw64/bin/gmake" \
         "$pkg_root/mingw64/bin/make.exe" \
         "$pkg_root/mingw64/bin/make" \
         "$pkg_root/ucrt64/bin/mingw32-make.exe" \
         "$pkg_root/ucrt64/bin/mingw32-make" \
         "$pkg_root/ucrt64/bin/gmake.exe" \
         "$pkg_root/ucrt64/bin/gmake" \
         "$pkg_root/ucrt64/bin/make.exe" \
         "$pkg_root/ucrt64/bin/make" \
         "$pkg_root/clang64/bin/mingw32-make.exe" \
         "$pkg_root/clang64/bin/mingw32-make" \
         "$pkg_root/clang64/bin/gmake.exe" \
         "$pkg_root/clang64/bin/gmake" \
         "$pkg_root/clang64/bin/make.exe" \
         "$pkg_root/clang64/bin/make" \
         "$pkg_root/mingw32/bin/mingw32-make.exe" \
         "$pkg_root/mingw32/bin/mingw32-make" \
         "$pkg_root/mingw32/bin/gmake.exe" \
         "$pkg_root/mingw32/bin/gmake" \
         "$pkg_root/mingw32/bin/make.exe" \
         "$pkg_root/mingw32/bin/make" \
         /c/mozilla-build/msys2/usr/bin/mingw32-make.exe \
         /c/mozilla-build/msys2/usr/bin/mingw32-make \
         /c/mozilla-build/msys2/usr/bin/gmake.exe \
         /c/mozilla-build/msys2/usr/bin/gmake \
         /c/mozilla-build/msys2/usr/bin/make.exe \
         /c/mozilla-build/msys2/usr/bin/make; do
  if make_smoke_test "$p"; then
    MOZMAKE_CAND="$p"
    break
  fi
done

if [ -z "$MOZMAKE_CAND" ]; then
  for p in "$(command -v mingw32-make 2>/dev/null || true)" \
           "$(command -v gmake 2>/dev/null || true)" \
           "$(command -v make 2>/dev/null || true)" \
           "$(command -v mozmake 2>/dev/null || true)" \
           /c/Program\ Files/Git/mingw64/bin/make.exe \
           /c/Program\ Files/Git/usr/bin/make.exe \
           /usr/bin/make; do
    [ -n "$p" ] || continue
    if [[ "$p" =~ ^[A-Za-z]: ]]; then
      p="$(cygpath -u "$p" 2>/dev/null || echo "$p")"
    fi
    make_smoke_test "$p" || continue
    if is_untrusted_make_candidate "$p"; then
      echo "Skipping untrusted make candidate: $p"
      continue
    fi
    MOZMAKE_CAND="$p"
    break
  done
fi
if [[ "$MOZMAKE_CAND" =~ ^[A-Za-z]: ]]; then
  MOZMAKE_CAND="$(cygpath -u "$MOZMAKE_CAND" 2>/dev/null || true)"
fi
if [ -n "$MOZMAKE_CAND" ] && [ -x "$MOZMAKE_CAND" ]; then
  make_dir="$(dirname "$MOZMAKE_CAND")"
  git_bin="$(command -v git 2>/dev/null || true)"
  git_dir=""
  rustc_bin="$(command -v rustc 2>/dev/null || true)"
  cargo_bin="$(command -v cargo 2>/dev/null || true)"
  rust_dir=""
  if [ -n "$git_bin" ]; then
    git_dir="$(dirname "$git_bin")"
  fi
  if [ -n "$rustc_bin" ]; then
    rust_dir="$(dirname "$rustc_bin")"
  elif [ -n "$cargo_bin" ]; then
    rust_dir="$(dirname "$cargo_bin")"
  fi
  if [ -z "$rust_dir" ]; then
    for p in "$HOME/.cargo/bin" /c/Users/runneradmin/.cargo/bin; do
      if [ -x "$p/rustc.exe" ] || [ -x "$p/rustc" ] || [ -x "$p/cargo.exe" ] || [ -x "$p/cargo" ]; then
        rust_dir="$p"
        break
      fi
    done
  fi
  PATH="$(build_path_from_dirs \
    "$make_dir" \
    "$shim_dir" \
    "$py_dir" \
    "$py_dir/Scripts" \
    "$msvc_bin_u" \
    "$mt_dir_u" \
    "$rust_dir" \
    "$moz_bin" \
    "$msys_usr" \
    "$msys_mingw" \
    "$msys_ucrt" \
    "$msys_clang" \
    "$msys_mingw32" \
    "$win_system32" \
    "$git_dir" \
    "$pkg_root/mingw64/bin" \
    "$pkg_root/ucrt64/bin" \
    "$pkg_root/clang64/bin" \
    "$pkg_root/mingw32/bin")"
  export PATH
  if [ -n "$rust_dir" ]; then
    if [ -x "$rust_dir/rustc.exe" ]; then
      export RUSTC="$rust_dir/rustc.exe"
    elif [ -x "$rust_dir/rustc" ]; then
      export RUSTC="$rust_dir/rustc"
    fi
    if [ -x "$rust_dir/cargo.exe" ]; then
      export CARGO="$rust_dir/cargo.exe"
    elif [ -x "$rust_dir/cargo" ]; then
      export CARGO="$rust_dir/cargo"
    fi
  fi
  MOZMAKE_FOR_MACH="$MOZMAKE_CAND"
  if [[ "$MOZMAKE_FOR_MACH" == /* ]]; then
    MOZMAKE_FOR_MACH="$(cygpath -m "$MOZMAKE_FOR_MACH" 2>/dev/null || echo "$MOZMAKE_FOR_MACH")"
  fi
  export MOZBUILD_MOZMAKE="$MOZMAKE_FOR_MACH"
  export MAKE="$MOZMAKE_FOR_MACH"
  export GNUMAKE="$MOZMAKE_FOR_MACH"
  export MOZ_MAKE="$MOZMAKE_FOR_MACH"
  # Mach on Windows may only probe command names (mozmake/make/gmake) from PATH.
  # Mirror the selected trusted binary to those names in our shim directory.
  for make_name in mozmake make gmake mingw32-make; do
    cp -f "$MOZMAKE_CAND" "$shim_dir/$make_name.exe" || true
    cp -f "$MOZMAKE_CAND" "$shim_dir/$make_name" || true
    chmod +x "$shim_dir/$make_name" "$shim_dir/$make_name.exe" || true
  done
  echo "Using make: $MOZMAKE_CAND"
else
  echo "ERROR: Trusted make/mozmake not found. Refusing ambient runner make."
  for d in /c/mozilla-build/msys2/usr/bin /c/mozilla-build/msys2/mingw64/bin /c/mozilla-build/bin "$pkg_root/mingw64/bin" "$pkg_root/usr/bin"; do
    [ -d "$d" ] || continue
    echo "Listing make candidates in $d"
    ls -la "$d" | grep -Ei '(^|[ /])(g?make|mingw32-make|mozmake)(\.exe)?$' || true
  done
  exit 14
fi
echo "PATH (after make selection): $PATH"

# Avoid CRLF checkouts that break client.mk (force LF).
clone_ok=0
for attempt in 1 2 3 4 5; do
  rm -rf gecko-dev || true
  if git -c core.autocrlf=false -c core.eol=lf -c http.version=HTTP/1.1 -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 clone https://github.com/mozilla/gecko-dev gecko-dev; then
    clone_ok=1
    break
  fi
  sleep_seconds=$((attempt * 20))
  echo "WARNING: gecko-dev clone attempt $attempt failed; retrying in ${sleep_seconds}s"
  sleep "$sleep_seconds"
done
if [ "$clone_ok" -ne 1 ]; then
  echo "ERROR: Unable to clone gecko-dev after retries."
  exit 21
fi
git -c core.autocrlf=false -c core.eol=lf clone --local . gecko-dev/bluegriffon

cd gecko-dev
git config core.autocrlf false
git config core.eol lf
export BLUEGRIFFON_ICUDATA_SRC_WIN="$(cygpath -m "$PWD/config/external/icu/data/icudata.s" 2>/dev/null || true)"
echo "BLUEGRIFFON_ICUDATA_SRC_WIN: $BLUEGRIFFON_ICUDATA_SRC_WIN"
git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
patch -p1 < bluegriffon/config/gecko_dev_content.patch
patch -p1 < bluegriffon/config/gecko_dev_idl.patch
patch -p1 < bluegriffon/config/gecko_dev_local_build_fixes.patch
# Gecko's Windows make validation rejects MSYS make explicitly.
# CI runners in this workflow do not provide classic mozmake, so allow
# the vetted fallback make candidate selected above.
sed -i 's/\$(error MSYS make is not supported)/# allow MSYS make in CI/' config/baseconfig.mk

cp bluegriffon/config/mozconfig.win .mozconfig
echo "mk_add_options MOZ_MAKE_FLAGS=-j1" >> .mozconfig
echo "Injected into .mozconfig: mk_add_options MOZ_MAKE_FLAGS=-j1"
# Keep YASM visible to old-configure sub-configures (e.g. js/src).
echo "mk_add_options YASM=$YASM_FOR_MOZCONFIG" >> .mozconfig
echo "Injected into .mozconfig: mk_add_options YASM=$YASM_FOR_MOZCONFIG"
export BLUEGRIFFON_YASM="$YASM_FOR_MOZCONFIG"
echo "BLUEGRIFFON_YASM: $BLUEGRIFFON_YASM"
objdir_line="$(awk -F= '/^mk_add_options MOZ_OBJDIR=/{print $2}' .mozconfig | tail -1 | tr -d '\"')"
objdir="${objdir_line//@TOPSRCDIR@/$PWD}"
if [ -z "$objdir" ]; then
  objdir="$PWD/obj"
fi
icu_src="$PWD/config/external/icu/data"
icu_obj="$objdir/config/external/icu/data"
icu_data_file="$(basename "$(ls "$icu_src"/icudt*l.dat 2>/dev/null | head -1)")"
icu_data_symbol=""
if [[ "$icu_data_file" =~ ^icudt([0-9]+)l\.dat$ ]]; then
  icu_data_symbol="icudt${BASH_REMATCH[1]}_dat"
fi
if [ -n "$icu_data_file" ] && [ -n "$icu_data_symbol" ] && [ -f "$icu_src/icudata.s" ]; then
  echo "Prebuilding icudata.obj with yasm before mach build."
  mkdir -p "$icu_obj"
  "$YASM_FOR_MOZCONFIG" \
    -o "$icu_obj/icudata.obj" \
    -f x64 -rnasm -pnasm -g cv8 \
    "-DICU_DATA_FILE=\"$icu_data_file\"" \
    "-DICU_DATA_SYMBOL=$icu_data_symbol" \
    "$icu_src/icudata.s" || true
  ls -la "$icu_obj/icudata.obj" || true
fi

export MOZ_PARALLEL_BUILD="${MOZ_PARALLEL_BUILD:-1}"
echo "MOZ_PARALLEL_BUILD: $MOZ_PARALLEL_BUILD"
export SHELL="/c/mozilla-build/msys2/usr/bin/sh.exe"
export CONFIG_SHELL="$SHELL"
echo "SHELL: $SHELL"
echo "CONFIG_SHELL: $CONFIG_SHELL"

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
  build_log_path=""
  if [ -n "${BUILD_LOG:-}" ]; then
    build_log_path="$(cygpath -u "$BUILD_LOG" 2>/dev/null || echo "$BUILD_LOG")"
  fi
  if [ -n "$build_log_path" ] && [ -f "$build_log_path" ] && grep -q "yasm: No input files specified" "$build_log_path"; then
    echo "Detected yasm missing-input failure; assembling icudata.obj manually and retrying once."
    icu_data_file="$(basename "$(ls "$icu_src"/icudt*l.dat 2>/dev/null | head -1)")"
    icu_data_symbol="$(echo "$icu_data_file" | sed -E 's/^icudt([0-9]+)l\\.dat$/icudt\\1_dat/')"
    if [ -n "$icu_data_file" ] && [ -n "$icu_data_symbol" ] && [ -f "$icu_src/icudata.s" ]; then
      mkdir -p "$icu_obj"
      "$YASM_FOR_MOZCONFIG" \
        -o "$icu_obj/icudata.obj" \
        -f x64 -rnasm -pnasm -g cv8 \
        "-DICU_DATA_FILE=\"$icu_data_file\"" \
        "-DICU_DATA_SYMBOL=$icu_data_symbol" \
        "$icu_src/icudata.s" || true
      ls -la "$icu_obj/icudata.obj" || true
      set +e
      ./mach build
      build_rc=$?
      set -e
      echo "mach retry exit code: $build_rc"
    fi
  fi
  if [ "$build_rc" -ne 0 ]; then
    exit "$build_rc"
  fi
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
