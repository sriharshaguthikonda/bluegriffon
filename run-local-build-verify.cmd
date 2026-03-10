@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
set PYTHON=C:\Python27_18\python.exe
set PATH=C:\Python27_18;C:\Python27_18\Scripts;%PATH%
set RUSTUP_TOOLCHAIN=1.19.0-x86_64-pc-windows-msvc
set MSYS2_PATH_TYPE=inherit
set CHERE_INVOKING=1
set MSVC_BIN=%VCToolsInstallDir%bin\HostX64\x64
C:\mozilla-build\msys2\usr\bin\bash.exe -lc "cd /c/Windows_software/bluegriffon/gecko-dev && msvc_bin=$(cygpath -u \"$MSVC_BIN\") && export PATH=$msvc_bin:/c/Python27_18:/c/Python27_18/Scripts:/c/mozilla-build/msys2/mingw64/bin:/c/mozilla-build/msys2/usr/bin:$PATH && export PYTHON=/c/Python27_18/python.exe && export MOZBUILD_MOZMAKE=/c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe && export MAKE=/c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe && command -v link && ./mach build 2>&1 | tee /c/Windows_software/bluegriffon/local-rebuild-verify.log"
exit /b %errorlevel%
