function Shutdown()
{
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
    if ("SavePinnedTabsState" in window)
      SavePinnedTabsState();
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
  try {
    if ("SavePinnedTabsState" in window)
      SavePinnedTabsState();
  } catch(e) {}
  if (doSaveTabsBeforeQuit()) {
    Shutdown();
    return true;
  }
  return false;
}
