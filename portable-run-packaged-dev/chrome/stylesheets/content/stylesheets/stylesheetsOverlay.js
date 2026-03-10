var cmdStyleSheetsCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
//@line 25 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\sidebars\stylesheets\content\stylesheetsOverlay.js"
    var panel = gDialog["panel-stylesheets"];
    panel.openPanel(null, false);
    NotifierUtils.notify("redrawPanel", panel.id);
//@line 29 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\sidebars\stylesheets\content\stylesheetsOverlay.js"

  }
};

// LINUX ONLY :-(
function start_stylesheets()
{
  var w = null;
  try {
    var windowManager = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService();
    w = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator).getMostRecentWindow("BlueGriffon:StyleSheets");
  }
  catch(e){}
  if (w)
    w.focus();
  else
    window.open('chrome://stylesheets/content/stylesheets.xul',"_blank",
               "chrome,resizable,scrollbars=yes");
}

var StyleSheetsHelper = {

  startup: function()
  {
    window.removeEventListener("load", StyleSheetsHelper.startup, false);
    var commandTable = ComposerCommands.getComposerCommandTable();
    commandTable.registerCommand("cmd_stylesheets", cmdStyleSheetsCommand);
  }
};

window.addEventListener("load", StyleSheetsHelper.startup, false);
