var gBlueGriffonShutdownDone = false;

function CaptureStableModeForShutdown()
{
  try {
    var editorElement = EditorUtils.getCurrentEditorElement();
    if (editorElement && editorElement.parentNode) {
      var deckMode = editorElement.parentNode.getAttribute("previousMode");
      if ("IsSupportedViewMode" in window && window.IsSupportedViewMode(deckMode))
        return deckMode;
    }
  } catch(e) {}

  try {
    if ("GetRememberedViewMode" in window)
      return GetRememberedViewMode();
  } catch(e) {}

  return "wysiwyg";
}

function Shutdown(aModeHint)
{
  if (gBlueGriffonShutdownDone)
    return;
  gBlueGriffonShutdownDone = true;

  NotifierUtils.removeNotifierCallback("selection_strict", BlueGriffon_lookForFileChanges, this);
  window.removeEventListener("blur", AutoSaveOnWindowBlur, false);

  try {
    var pbi = Services.prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
    pbi.removeObserver("bluegriffon.", BlueGriffonPrefsObserver, false);
  } catch(ex) {
  }

  gDialog.structurebar.shutdown();
  ResizeEventNotifier.shutdown();
  EditorScrolledNotifier.shutdown();
  BGZoomManager.shutdown();

  try {
    var modeToSave = aModeHint;
    if (!("IsSupportedViewMode" in window) || !window.IsSupportedViewMode(modeToSave))
      modeToSave = CaptureStableModeForShutdown();
    if ("IsSupportedViewMode" in window && window.IsSupportedViewMode(modeToSave))
      SaveRememberedViewMode(modeToSave);
  } catch(e) {}

  // persist floating panels' position
  var panels = document.querySelectorAll('panel[floating="true"]');
  for (var i = 0; i < panels.length; i++) {
    if (panels[i].popupBoxObject.popupState == "open") {
      panels[i].persistPosition();
      panels[i].setAttribute("open", "true");
      document.persist(panels[i].id, "open");
    }
    else {
      panels[i].setAttribute("open", "false");
      document.persist(panels[i].id, "open");
    }
  }
}

function onClose()
{
  var modeHint = CaptureStableModeForShutdown();
  if (doSaveTabsBeforeQuit()) {
    Shutdown(modeHint);
    return true;
  }
  return false;
}
