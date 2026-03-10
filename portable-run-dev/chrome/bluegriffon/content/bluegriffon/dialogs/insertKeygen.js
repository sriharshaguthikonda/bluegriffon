Components.utils.import("resource://gre/modules/editorHelper.jsm");

var gNode = null;
var gEditor = null;

function Startup()
{
  gNode = window.arguments[0];
  gEditor = EditorUtils.getCurrentEditor();
  GetUIElements();

  InitDialog();
//@line 14 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertKeygen.js"
  CenterDialogOnOpener();
//@line 16 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertKeygen.js"
}

function onAccept()
{
  gEditor.beginTransaction();

  var doc = EditorUtils.getCurrentDocument();
  if (!gNode) {
    gNode = doc.createElement("keygen");
    gEditor.insertElementAtSelection(gNode, true);
  }

  ApplyAttributes();

  gEditor.endTransaction();
  gEditor.selection.collapse(gNode, 0);
}
