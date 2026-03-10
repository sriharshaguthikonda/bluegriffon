Components.utils.import("resource://gre/modules/editorHelper.jsm");

var gNode = null;
var gEditor = null;

function Startup()
{
  gNode = window.arguments[0];
  gEditor = EditorUtils.getCurrentEditor();
  GetUIElements();

  var doc = EditorUtils.getCurrentDocument();
  var elts = doc.querySelectorAll("*[id]");
  var ids = [];
  for (var i = 0; i < elts.length; i++)
    ids.push(elts[i].id);
  ids.sort;
  for (var i = 0; i < ids.length; i++)
    gDialog.forMenulist.appendItem(ids[i], ids[i]);

  InitDialog();

//@line 24 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertOutput.js"
  CenterDialogOnOpener();
//@line 26 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertOutput.js"
}

function onAccept()
{
  gEditor.beginTransaction();

  var doc = EditorUtils.getCurrentDocument();
  if (!gNode) {
    gNode = doc.createElement("output");
    gEditor.insertElementAtSelection(gNode, true);
  }

  ApplyAttributes();

  gEditor.endTransaction();
  gEditor.selection.collapse(gNode, 0);
}
