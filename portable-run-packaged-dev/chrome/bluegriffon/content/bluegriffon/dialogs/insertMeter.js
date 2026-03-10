Components.utils.import("resource://gre/modules/editorHelper.jsm");

var gNode = null;
var gEditor = null;

function Startup()
{
  gNode = window.arguments[0];
  gEditor = EditorUtils.getCurrentEditor();
  GetUIElements();

  if (gNode) {
    InitDialog();
  }

//@line 17 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertMeter.js"
  CenterDialogOnOpener();
//@line 19 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertMeter.js"
}

function onAccept()
{
  gEditor.beginTransaction();

  var doc = EditorUtils.getCurrentDocument();
  if (!gNode) {
    gNode = doc.createElement("meter");
    gEditor.insertElementAtSelection(gNode, true);
  }

  ApplyAttributes();

  gEditor.endTransaction();
  gEditor.selection.collapse(gNode, 0);
}
