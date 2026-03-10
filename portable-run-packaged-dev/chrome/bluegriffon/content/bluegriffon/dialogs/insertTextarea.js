Components.utils.import("resource://gre/modules/editorHelper.jsm");

var gNode = null;
var gEditor = null;

function Startup()
{
  gNode = window.arguments[0];
  gEditor = EditorUtils.getCurrentEditor();
  GetUIElements();

  InitDialog();

//@line 15 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertTextarea.js"
  CenterDialogOnOpener();
//@line 17 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertTextarea.js"
}

function onAccept()
{
  gEditor.beginTransaction();

  var doc = EditorUtils.getCurrentDocument();
  if (!gNode) {
    gNode = doc.createElement("textarea");
    gNode.appendChild(doc.createTextNode(gEditor.selection.toString()));
    gEditor.insertElementAtSelection(gNode, true);
  }

  ApplyAttributes();

  gEditor.endTransaction();
  gEditor.selection.collapse(gNode, 0);
}
