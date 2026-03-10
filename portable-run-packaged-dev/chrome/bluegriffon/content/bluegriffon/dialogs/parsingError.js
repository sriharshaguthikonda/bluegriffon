function Startup()
{
  GetUIElements();
  var message = window.arguments[0];
  var error   = window.arguments[1];
  gDialog.message.setAttribute("value", message);
  gDialog.error.textContent = error;

//@line 10 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\parsingError.js"
  CenterDialogOnOpener();
//@line 12 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\dialogs\parsingError.js"
}