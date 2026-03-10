@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
set MSVC_BIN=%VCToolsInstallDir%bin\HostX64\x64
C:\mozilla-build\msys2\usr\bin\bash.exe -lc "cd /c/Windows_software/bluegriffon/gecko-dev && msvc_bin=$(cygpath -u \"$MSVC_BIN\") && export PATH=$msvc_bin:/c/mozilla-build/msys2/mingw64/bin:/c/mozilla-build/msys2/usr/bin:$PATH && rm -f opt64/config/external/icu/data/icudata.obj && /c/mozilla-build/msys2/mingw64/bin/mingw32-make.exe -C opt64/config/external/icu/data icudata.obj V=1"
