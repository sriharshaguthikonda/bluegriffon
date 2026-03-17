/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is BlueGriffon.
 *
 * The Initial Developer of the Original Code is
 * Disruptive Innovations SARL.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Glazman <daniel.glazman@disruptive-innovations.com>, Original author
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// we store all globals in a gDialog object for convenience
Components.utils.import("resource://gre/modules/Services.jsm");

var gDialog = {};

function GetUIElements()
{
  var elts = document.getElementsByAttribute("id", "*");
  for (var i = 0; i < elts.length; i++)
  {
    var elt = elts.item(i);
    gDialog[ elt.getAttribute("id") ] = elt;
  }
}

document.documentElement
        .setAttribute("rtl",
                      Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                        .getService(Components.interfaces.nsIXULChromeRegistry)
                        .isLocaleRTL("global"));

function GetWysiwygThemePrefValue()
{
  try {
    return Services.prefs.getCharPref("bluegriffon.wysiwyg.theme");
  } catch (e) {}
  return "black";
}

function SystemThemeIsDark()
{
  try {
    if (window && typeof window.matchMedia == "function")
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (e) {}
  try {
    return Services.prefs.getIntPref("ui.systemUsesDarkTheme") == 1;
  } catch (e) {}
  return false;
}

function ResolveWysiwygTheme(aValue)
{
  if (aValue == "dark")
    return "black";
  if (aValue == "system")
    return SystemThemeIsDark() ? "black" : "light";
  return aValue;
}

function ApplyWysiwygThemeToRoot(aRoot, aValue)
{
  if (!aRoot)
    return;
  if (aValue == "black" &&
      aRoot.getAttribute("forcecleartheme") != "true")
    aRoot.removeAttribute("cleartheme");
  else
    aRoot.setAttribute("cleartheme", "true");
}

function ApplyWysiwygThemeChange(aDocument, aValue)
{
  var resolvedValue = ResolveWysiwygTheme(aValue);
  var iframes = aDocument.querySelectorAll("iframe");
  for (var i = 0; i < iframes.length; i++) {
    var root = iframes[i].contentDocument.documentElement;
    ApplyWysiwygThemeToRoot(root, resolvedValue);
    if (root.id)
      iframes[i].contentDocument.persist(root.id, "cleartheme");

    ApplyWysiwygThemeChange(iframes[i].contentDocument, resolvedValue)
  }
}

function ApplyWysiwygThemeFromPrefs(aDocument)
{
  var resolvedValue = ResolveWysiwygTheme(GetWysiwygThemePrefValue());
  var root = aDocument.documentElement;
  ApplyWysiwygThemeToRoot(root, resolvedValue);
  if (root && root.id)
    aDocument.persist(root.id, "cleartheme");
  ApplyWysiwygThemeChange(aDocument, resolvedValue);
}

function ApplySystemThemeIfNeeded()
{
  if (GetWysiwygThemePrefValue() != "system")
    return;
  ApplyWysiwygThemeFromPrefs(window.document);
}

function InstallSystemThemeWatcher()
{
  try {
    if (window && typeof window.matchMedia == "function") {
      var mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        ApplySystemThemeIfNeeded();
      };
      if (mediaQuery.addEventListener)
        mediaQuery.addEventListener("change", onChange);
      else if (mediaQuery.addListener)
        mediaQuery.addListener(onChange);
    }
  } catch (e) {}
  window.addEventListener("focus", ApplySystemThemeIfNeeded, false);
}

ApplyWysiwygThemeFromPrefs(window.document);
InstallSystemThemeWatcher();

function GetWindowContent()
{
  return EditorUtils.getCurrentEditorElement().contentWindow;
}
