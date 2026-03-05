#!/usr/bin/env bash
set -euo pipefail

git clone https://github.com/mozilla/gecko-dev gecko-dev
git clone --local . gecko-dev/bluegriffon

cd gecko-dev
git reset --hard "$(cat bluegriffon/config/gecko_dev_revision.txt)"
patch -p1 < bluegriffon/config/gecko_dev_content.patch
patch -p1 < bluegriffon/config/gecko_dev_idl.patch

cp bluegriffon/config/mozconfig.win .mozconfig
./mach build
