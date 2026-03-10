/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services", "resource://gre/modules/Services.jsm");

this.EXPORTED_SYMBOLS = ["AppConstants"];

// Immutable for export.
this.AppConstants = Object.freeze({
  // See this wiki page for more details about channel specific build
  // defines: https://wiki.mozilla.org/Platform/Channel-specific_build_defines
  NIGHTLY_BUILD:
//@line 20 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 24 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  RELEASE_OR_BETA:
//@line 29 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 31 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  ACCESSIBILITY:
//@line 34 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 38 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  // Official corresponds, roughly, to whether this build is performed
  // on Mozilla's continuous integration infrastructure. You should
  // disable developer-only functionality when this flag is set.
  MOZILLA_OFFICIAL:
//@line 46 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 48 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_OFFICIAL_BRANDING:
//@line 53 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 55 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_DEV_EDITION:
//@line 60 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 62 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_SERVICES_HEALTHREPORT:
//@line 67 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 69 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_DATA_REPORTING:
//@line 74 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 76 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_SANDBOX:
//@line 81 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 83 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_CONTENT_SANDBOX:
//@line 88 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 90 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_TELEMETRY_REPORTING:
//@line 95 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 97 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_TELEMETRY_ON_BY_DEFAULT:
//@line 102 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 104 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_SERVICES_CLOUDSYNC:
//@line 109 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 111 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_UPDATER:
//@line 116 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 118 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_SWITCHBOARD:
//@line 123 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 125 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_WEBRTC:
//@line 130 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 132 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_WIDGET_GTK:
//@line 137 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 139 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

//@line 141 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  MOZ_B2G:
//@line 145 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 147 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  XP_UNIX:
//@line 152 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 154 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

//@line 157 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  platform:
//@line 161 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  "win",
//@line 173 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  isPlatformAndVersionAtLeast(platform, version) {
    let platformVersion = Services.sysinfo.getProperty("version");
    return platform == this.platform &&
           Services.vc.compare(platformVersion, version) >= 0;
  },

  isPlatformAndVersionAtMost(platform, version) {
    let platformVersion = Services.sysinfo.getProperty("version");
    return platform == this.platform &&
           Services.vc.compare(platformVersion, version) <= 0;
  },

  MOZ_CRASHREPORTER:
//@line 190 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 192 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_VERIFY_MAR_SIGNATURE:
//@line 197 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 199 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_MAINTENANCE_SERVICE:
//@line 204 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 206 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  E10S_TESTING_ONLY:
//@line 209 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 213 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  DEBUG:
//@line 218 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 220 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  ASAN:
//@line 225 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 227 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_B2G_RIL:
//@line 232 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 234 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_GRAPHENE:
//@line 239 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 241 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_SYSTEM_NSS:
//@line 246 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 248 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_PLACES:
//@line 253 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 255 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_REQUIRE_SIGNING:
//@line 260 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 262 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  INSTALL_COMPACT_THEMES:
//@line 265 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 269 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MENUBAR_CAN_AUTOHIDE:
//@line 272 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 276 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  CAN_DRAW_IN_TITLEBAR:
//@line 279 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 283 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_ANDROID_HISTORY:
//@line 288 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 290 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_TOOLKIT_SEARCH:
//@line 293 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 297 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_GECKO_PROFILER:
//@line 300 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  true,
//@line 304 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  MOZ_ANDROID_ACTIVITY_STREAM:
//@line 309 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  false,
//@line 311 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  DLL_PREFIX: "",
  DLL_SUFFIX: ".dll",

  MOZ_APP_NAME: "bluegriffondev",
  MOZ_APP_VERSION: "3.2",
  MOZ_APP_VERSION_DISPLAY: "3.2",
  MOZ_BUILD_APP: "bluegriffon",
  MOZ_MACBUNDLE_NAME: "BlueGriffonDev.app",
  MOZ_UPDATE_CHANNEL: "default",
  INSTALL_LOCALE: "en-US",
  MOZ_WIDGET_TOOLKIT: "windows",
  ANDROID_PACKAGE_NAME: "org.mozilla.bluegriffondev",
  MOZ_B2G_VERSION: "1.0.0",
  MOZ_B2G_OS_NAME: "",

  DEBUG_JS_MODULES: "",

  // URL to the hg revision this was built from (e.g.
  // "https://hg.mozilla.org/mozilla-central/rev/6256ec9113c1")
  // On unofficial builds, this is an empty string.
//@line 335 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
  SOURCE_REVISION_URL: "",

  HAVE_USR_LIB64_DIR:
//@line 341 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
    false,
//@line 343 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"

  HAVE_SHELL_SERVICE:
//@line 346 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
    true,
//@line 350 "C:\Windows_software\bluegriffon\gecko-dev\toolkit\modules\AppConstants.jsm"
});
