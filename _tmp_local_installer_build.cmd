@echo off
setlocal
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b %errorlevel%
set PYTHON=C:\Python27_18\python.exe
set PATH=C:\Python27_18;C:\Python27_18\Scripts;%PATH%
set RUSTUP_TOOLCHAIN=1.19.0-x86_64-pc-windows-msvc
set MSYS2_PATH_TYPE=inherit
set CHERE_INVOKING=1
set MSVC_BIN=%VCToolsInstallDir%bin\HostX64\x64
C:\mozilla-build\msys2\usr\bin\bash.exe /c/Windows_software/bluegriffon/_tmp_local_installer_build.sh
exit /b %errorlevel%
