Components.utils.import("resource://gre/modules/editorHelper.jsm");

function Startup()
{
  GetUIElements();
//@line 7 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertHTML.js"
  CenterDialogOnOpener();
//@line 9 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\insertHTML.js"
}

function onAccept()
{
  var editor = EditorUtils.getCurrentEditor();

  editor.beginTransaction();
  editor.insertHTML(gDialog.htmlTextbox.value);
  window.opener.MakePhpAndCommentsVisible(EditorUtils.getCurrentDocument());
  editor.endTransaction();

  return true;
}
