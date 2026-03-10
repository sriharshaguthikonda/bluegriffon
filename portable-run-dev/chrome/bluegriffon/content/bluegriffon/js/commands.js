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
 *   EVENTRIC LLC.
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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/editorHelper.jsm");
Components.utils.import("resource://gre/modules/urlHelper.jsm");

const kBASE_COMMAND_CONTROLLER_CID = "@mozilla.org/embedcomp/base-command-controller;1";

const nsIControllerContext = interfaces.nsIControllerContext;
const nsIInterfaceRequestor = interfaces.nsIInterfaceRequestor;
const nsIControllerCommandTable = interfaces.nsIControllerCommandTable;

var ComposerCommands = {

  mComposerJSCommandControllerID: null,
  mSelectionTimeOutId: null,

  mLastSelectedElement: null,
  mLastSelectedElementPath: null,

  getComposerCommandTable: function getComposerCommandTable()
  {
    var controller;
    if (this.mComposerJSCommandControllerID)
    {
      try { 
        controller = GetWindowContent().controllers.getControllerById(this.mComposerJSCommandControllerID);
      } catch (e) {}
    }
    if (!controller)
    {
      //create it
      controller = Components.classes[kBASE_COMMAND_CONTROLLER_CID].createInstance();
  
      var editorController = controller.QueryInterface(nsIControllerContext);
      editorController.init(null);
      editorController.setCommandContext(null);
      window.controllers.insertControllerAt(0, controller);
    
      // Store the controller ID so we can be sure to get the right one later
      this.mComposerJSCommandControllerID = window.controllers.getControllerId(controller);
    }
  
    if (controller)
    {
      var interfaceRequestor = controller.QueryInterface(nsIInterfaceRequestor);
      return interfaceRequestor.getInterface(nsIControllerCommandTable);
    }
    return null;
  },

  goUpdateComposerMenuItems: function goUpdateComposerMenuItems(commandset)
  {
    for (var i = 0; i < commandset.childNodes.length; i++)
    {
      var commandNode = commandset.childNodes[i];
      var commandID = commandNode.id;
      if (commandID)
      {
       if (EditorUtils.getCurrentEditorElement() &&
           EditorUtils.isDocumentEditable() &&
           EditorUtils.isEditingRenderedHTML() &&
           !EditorUtils.activeViewActive  &&
           (commandID == "cmd_viewModeEnabler" || EditorUtils.isWysiwygMode()))
          commandNode.removeAttribute("disabled");
        else
          commandNode.setAttribute("disabled", "true");

        this.goUpdateCommand(commandID);  // enable or disable
        if (commandNode.hasAttribute("state"))
          this.goUpdateCommandState(commandID);
      }
    }
  },

  goUpdateCommand: function(aCommand)
  {
    try {
      var controller = EditorUtils.getCurrentEditorElement()
                       ? EditorUtils.getCurrentEditorElement().contentWindow.controllers.getControllerForCommand(aCommand)
                       : null;
      if (!controller)
        controller = top.document.commandDispatcher.getControllerForCommand(aCommand)
      var enabled = false;
      if (controller)
        enabled = controller.isCommandEnabled(aCommand);
  
      goSetCommandEnabled(aCommand, enabled);
    }
    catch (e) {
      Components.utils.reportError("An error occurred updating the " +
                                   aCommand + " command: " + e);
    }
  },

  goUpdateCommandState: function goUpdateCommandState(command)
  {
    try
    {
      var controller = top.document.commandDispatcher.getControllerForCommand(command);
      if (!(controller instanceof Components.interfaces.nsICommandController))
        return;

      var params = this.newCommandParams();
      if (!params) return;

      controller.getCommandStateWithParams(command, params);

      switch (command)
      {
        case "cmd_bold":
        case "cmd_italic":
        case "cmd_underline":
        case "cmd_strong":
        case "cmd_em":
        case "cmd_code":
        case "cmd_strikethrough":
        case "cmd_superscript":
        case "cmd_subscript":
        case "cmd_nobreak":
        case "cmd_var":
        case "cmd_samp":
        case "cmd_code":
        case "cmd_acronym":
        case "cmd_abbr":
        case "cmd_cite":
        case "cmd_tt":

        case "cmd_ul":
        case "cmd_ol":

        case "cmd_dd":
        case "cmd_dt":
          this.pokeStyleUI(command, params.getBooleanValue("state_all"));
          break;

        case "cmd_paragraphState":
        case "cmd_align":
        case "cmd_fontFace":
        case "cmd_class":
        case "cmd_id":
        case "cmd_ariaRole":
        case "cmd_bgFontColor":
        case "cmd_bgBackgroundColor":
          this.pokeMultiStateUI(command, params);
          break;

        case "cmd_indent":
        case "cmd_outdent":
          break;

        default: break;
      }
    }
    catch (e) {  }
  },

  pokeStyleUI: function pokeStyleUI(uiID, aDesiredState)
  {
   try {
    var commandNode = top.document.getElementById(uiID);
    if (!commandNode)
      return;

    var uiState = ("true" == commandNode.getAttribute("state"));
    if (aDesiredState != uiState)
    {
      var newState;
      if (aDesiredState)
        newState = "true";
      else
        newState = "false";
      commandNode.setAttribute("state", newState);
    }
   } catch(e) {  }
  },

  newCommandParams: function newCommandParams()
  {
    try {
      return Components.classes["@mozilla.org/embedcomp/command-params;1"].createInstance(Components.interfaces.nsICommandParams);
    }
    catch(e) {  }
    return null;
  },

  pokeMultiStateUI: function pokeMultiStateUI(uiID, cmdParams)
  {
    try
    {
      var commandNode = document.getElementById(uiID);
      if (!commandNode)
        return;

      var isMixed = cmdParams.getBooleanValue("state_mixed");
      var desiredAttrib;
      if (isMixed)
        desiredAttrib = "mixed";
      else
        desiredAttrib = cmdParams.getCStringValue("state_attribute");

      var uiState = commandNode.getAttribute("state");
      if (desiredAttrib != uiState)
      {
        commandNode.setAttribute("state", desiredAttrib);
      }
    } catch(e) {}
  },

  doStyleUICommand: function doStyleUICommand(cmdStr)
  {
    try
    {
      var cmdParams = this.newCommandParams();
      this.goDoCommandParams(cmdStr, cmdParams);
      if (cmdParams)
        this.pokeStyleUI(cmdStr, cmdParams.getBooleanValue("state_all"));
    } catch(e) {}
  },

  doStatefulCSSCommand: function doStatefulCSSCommand(commandID, newState)
  {
    var editor = EditorUtils.getCurrentEditor();
    var isCSSEnabled = editor.isCSSEnabled;
    editor.isCSSEnabled = true;
    this.doStatefulCommand(commandID, newState);
    editor.isCSSEnabled = isCSSEnabled;
  },

  doStatefulCommand: function doStatefulCommand(commandID, newState)
  {
    var commandNode = document.getElementById(commandID);
    if (commandNode)
        commandNode.setAttribute("state", newState);

    try
    {
      var cmdParams = this.newCommandParams();
      if (!cmdParams) return;

      cmdParams.setCStringValue("state_attribute", newState);
      this.goDoCommandParams(commandID, cmdParams);

      this.pokeMultiStateUI(commandID, cmdParams);

    } catch(e) {  }
  },

  doCommandWithValue: function doCommandWithValueFromAttribute(commandID, aValue)
  {
    try
    {
      var cmdParams = this.newCommandParams();
      if (!cmdParams) return;

      cmdParams.setCStringValue("type", aValue);
      this.goDoCommandParams(commandID, cmdParams);

      this.pokeMultiStateUI(commandID, cmdParams);

    } catch(e) { }
  },

  goDoCommandParams: function goDoCommandParams(command, params)
  {
    try
    {
      var controller = top.document.commandDispatcher.getControllerForCommand(command);
      if (controller && controller.isCommandEnabled(command))
      {
        if (controller instanceof Components.interfaces.nsICommandController)
        {
          controller.doCommandWithParams(command, params);

          // the following two lines should be removed when we implement observers
          if (params)
            controller.getCommandStateWithParams(command, params);
        }
        else
        {
          controller.doCommand(command);
        }
      }
    }
    catch (e) { }
  },

  setupMainCommands: function setupMainCommands()
  {
    var commandTable = this.getComposerCommandTable();
    if (!commandTable)
      return;

    commandTable.registerCommand("cmd_BGcopy",       cmdBGCopyCommand);
    commandTable.registerCommand("cmd_BGcut",        cmdBGCutCommand);
    commandTable.registerCommand("cmd_BGpaste",      cmdBGPasteCommand);
    commandTable.registerCommand("cmd_BGundo",       cmdBGUndoCommand);
    commandTable.registerCommand("cmd_BGredo",       cmdBGRedoCommand);
    commandTable.registerCommand("cmd_BGselectAll",  cmdBGselectAllCommand);
    commandTable.registerCommand("cmd_BGpasteNoFormatting",  cmdBGpasteNoFormattingCommand);
    commandTable.registerCommand("cmd_BGdelete",     cmdBGdeleteCommand);

    commandTable.registerCommand("cmd_stopLoading", cmdStopLoading);
    commandTable.registerCommand("cmd_open",        cmdOpen);
    commandTable.registerCommand("cmd_openFile",    cmdOpenFile);
    commandTable.registerCommand("cmd_save",        cmdSave);
    commandTable.registerCommand("cmd_saveAs",      cmdSaveAs);
    commandTable.registerCommand("cmd_print",       cmdPrint);
    commandTable.registerCommand("cmd_printSettings", cmdPrintSetup);
    commandTable.registerCommand("cmd_saveAs",      cmdSaveAs);
    commandTable.registerCommand("cmd_closeEbook",  cmdCloseEbook);
    commandTable.registerCommand("cmd_closeTab",    cmdCloseTab);
    commandTable.registerCommand("cmd_toggleView",  cmdToggleView);
    commandTable.registerCommand("cmd_fullScreen",  cmdFullScreen);
    commandTable.registerCommand("cmd_new",         cmdNew);
    commandTable.registerCommand("cmd_newEbook",    cmdNewEbook);
    commandTable.registerCommand("cmd_newWindow",   cmdNewWindow);
    commandTable.registerCommand("cmd_newWizard",   cmdNewWizard);
    commandTable.registerCommand("cmd_renderedHTMLEnabler",    cmdDummyHTML);
    commandTable.registerCommand("cmd_renderedSourceEnabler",  cmdDummySource);
    commandTable.registerCommand("cmd_renderedAllEnabler",     cmdDummyAll);
    commandTable.registerCommand("cmd_viewModeEnabler", cmdViewModeEnabler);
    commandTable.registerCommand("cmd_cleanup",     cmdMarkupCleaner);
    commandTable.registerCommand("cmd_browse",      cmdBrowseCommand);

    commandTable.registerCommand("cmd_list",                 cmdEditListCommand);

    commandTable.registerCommand("cmd_table",                cmdInsertOrEditTableCommand);
    commandTable.registerCommand("cmd_editTable",            bgEditTableCommand);
    commandTable.registerCommand("cmd_SelectTable",          bgSelectTableCommand);
    commandTable.registerCommand("cmd_SelectTableCaption",   bgSelectTableCaptionCommand);
    commandTable.registerCommand("cmd_SelectRow",            bgSelectTableRowCommand);
    commandTable.registerCommand("cmd_SelectColumn",         bgSelectTableColumnCommand);
    commandTable.registerCommand("cmd_SelectCell",           bgSelectTableCellCommand);
    commandTable.registerCommand("cmd_SelectAllCells",       bgSelectAllTableCellsCommand);
    commandTable.registerCommand("cmd_InsertTable",          bgInsertTableCommand);
    commandTable.registerCommand("cmd_InsertTableCaption",   bgInsertTableCaptionCommand);
    commandTable.registerCommand("cmd_InsertRowAbove",       bgInsertTableRowAboveCommand);
    commandTable.registerCommand("cmd_InsertRowBelow",       bgInsertTableRowBelowCommand);
    commandTable.registerCommand("cmd_InsertColumnBefore",   bgInsertTableColumnBeforeCommand);
    commandTable.registerCommand("cmd_InsertColumnAfter",    bgInsertTableColumnAfterCommand);
    commandTable.registerCommand("cmd_InsertCellBefore",     bgInsertTableCellBeforeCommand);
    commandTable.registerCommand("cmd_InsertCellAfter",      bgInsertTableCellAfterCommand);
    commandTable.registerCommand("cmd_DeleteTable",          bgDeleteTableCommand);
    commandTable.registerCommand("cmd_DeleteTableCaption",   bgDeleteTableCaptionCommand);
    commandTable.registerCommand("cmd_DeleteRow",            bgDeleteTableRowCommand);
    commandTable.registerCommand("cmd_DeleteColumn",         bgDeleteTableColumnCommand);
    commandTable.registerCommand("cmd_DeleteCell",           bgDeleteTableCellCommand);
    commandTable.registerCommand("cmd_DeleteCellContents",   bgDeleteTableCellContentsCommand);
    commandTable.registerCommand("cmd_JoinTableCells",       bgJoinTableCellsCommand);
    commandTable.registerCommand("cmd_SplitTableCell",       bgSplitTableCellCommand);
    commandTable.registerCommand("cmd_NormalizeTable",       bgNormalizeTableCommand);
    commandTable.registerCommand("cmd_ConvertToTable",       bgConvertToTable);
    commandTable.registerCommand("cmd_ConvertClipboardToTable", bgConvertClipboardToTable);

    commandTable.registerCommand("cmd_image",       cmdInsertImageCommand);
    commandTable.registerCommand("cmd_anchor",      cmdInsertAnchorCommand);
    commandTable.registerCommand("cmd_link",        cmdInsertLinkCommand);
    commandTable.registerCommand("cmd_hr",          cmdInsertHRCommand);
    commandTable.registerCommand("cmd_html",        cmdInsertHTMLCommand);
    commandTable.registerCommand("cmd_form",        cmdInsertFormCommand);
    commandTable.registerCommand("cmd_formInput",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_fieldset",    cmdInsertFieldsetCommand);
    commandTable.registerCommand("cmd_label",       cmdInsertLabelCommand);
    commandTable.registerCommand("cmd_button",      cmdInsertButtonCommand);
    commandTable.registerCommand("cmd_select",      cmdInsertSelectCommand);
    commandTable.registerCommand("cmd_textarea",    cmdInsertTextareaCommand);
    commandTable.registerCommand("cmd_keygen",      cmdInsertKeygenCommand);
    commandTable.registerCommand("cmd_output",      cmdInsertOutputCommand);
    commandTable.registerCommand("cmd_progress",    cmdInsertProgressCommand);
    commandTable.registerCommand("cmd_meter",       cmdInsertMeterCommand);
    commandTable.registerCommand("cmd_datalist",    cmdInsertDatalistCommand);
    commandTable.registerCommand("cmd_rebuildTOC",  cmdRebuildTOCCommand);

    commandTable.registerCommand("cmd_formInputHidden",  cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputHidden",  cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputText",    cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputSearch",  cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputTel",     cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputUrl",     cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputEmail",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputPassword",cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputDatetime",cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputDate",    cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputMonth",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputWeek",    cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputTime",    cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputDatetimelocal",cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputNumber",  cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputRange",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputColor",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputCheckbox",cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputRadio",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputFile",    cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputSubmit",  cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputImage",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputReset",   cmdInsertFormInputCommand);
    commandTable.registerCommand("cmd_formInputButton",  cmdInsertFormInputCommand);

    commandTable.registerCommand("cmd_css",         cmdCssPanelCommand);
    commandTable.registerCommand("cmd_domexplorer", cmdDomExplorerPanelCommand);
    commandTable.registerCommand("cmd_video",       cmdInsertVideoCommand);
    commandTable.registerCommand("cmd_audio",       cmdInsertAudioCommand);

    commandTable.registerCommand("cmd_class",       cmdClass);
    commandTable.registerCommand("cmd_id",          cmdId);
    commandTable.registerCommand("cmd_ariaRole",    cmdAriaRole);

    commandTable.registerCommand("cmd_bgFontColor",       cmdBgFontColorCommand);
    commandTable.registerCommand("cmd_bgBackgroundColor", cmdBgBackgroundColorCommand);

    commandTable.registerCommand("cmd_bgfind",      cmdBgFindCommand);
    commandTable.registerCommand("cmd_bgfindagain", cmdBgFindAgainCommand);
    commandTable.registerCommand("cmd_replace",     cmdBgFindCommand);

    commandTable.registerCommand("cmd_span",        cmdSpanCommand);
    commandTable.registerCommand("cmd_blockquote",  cmdBlockquoteCommand);

    commandTable.registerCommand("cmd_pageProperties", cmdPagePropertiesCommand);

    commandTable.registerCommand("cmd_spellCheck",  bgSpellingCommand);

    commandTable.registerCommand("cmd_copyHTMLCode", cmdCopyHTMLCodeCommand);
    commandTable.registerCommand("cmd_gotoLink",    cmdGotoLinkCommand);
    commandTable.registerCommand("cmd_editLink",    cmdEditLinkCommand);

    commandTable.registerCommand("cmd_structureClimb", cmdStructureClimbCommand);
    commandTable.registerCommand("cmd_structureFirstChild", cmdStructureFirstChildCommand);
    commandTable.registerCommand("cmd_structureNext", cmdStructureNextCommand);
    commandTable.registerCommand("cmd_structurePrevious", cmdStructurePreviousCommand);

    commandTable.registerCommand("cmd_commentOrPI",  cmdCommentOrPICommand);
  },

  setupFormatCommands: function setupFormatCommands()
  {
    try {
      var commandManager = EditorUtils.getCurrentCommandManager();

      commandManager.addCommandObserver(gEditorDocumentObserver, "obs_documentCreated");
      commandManager.addCommandObserver(gEditorDocumentObserver, "cmd_setDocumentModified");
      commandManager.addCommandObserver(gEditorDocumentObserver, "obs_documentWillBeDestroyed");
      commandManager.addCommandObserver(gEditorDocumentObserver, "obs_documentLocationChanged");

      // cmd_bold is a proxy, that's the only style command we add here
      commandManager.addCommandObserver(gEditorDocumentObserver, "cmd_bold");
    } catch (e) { alert(e); }
  },

  updateSelectionBased: function updateSelectionBased(aDontNotify)
  {
    try {
      var mixed = EditorUtils.getSelectionContainer();
      if (!mixed) return;
      var element = mixed.node;
      var oneElementSelected = mixed.oneElementSelected;

      if (!element) return;

      if (this.mSelectionTimeOutId)
        clearTimeout(this.mSelectionTimeOutId);

      this.mSelectionTimeOutId = setTimeout(this._updateSelectionBased, 100, element, oneElementSelected, aDontNotify);
    }
    catch(e) {}
  },

  _updateSelectionBased: function _updateSelectionBased(aElement, aOneElementSelected, aDontNotify)
  {
    NotifierUtils.notify("selection_strict", aElement, aOneElementSelected);

    var path = "";
    var node = aElement;
    while (node && node.nodeType == Node.ELEMENT_NODE) {
      path += node.nodeName.toLowerCase() + ":";
      var child = node;
      var j = 0;
      while (child.previousElementSibling) {
        j++;
        child = child.previousElementSibling;
      }
      path += j;
      for (var i = 0; i < node.attributes.length; i++) {
        path += "[" + node.attributes[i].nodeName + "=" +
                      node.attributes[i].nodeValue + "]";
      }
  
      node = node.parentNode;
      path += " ";
    }

    // trivial case
    if (ComposerCommands.mLastSelectedElement != aElement) {
      ComposerCommands.mLastSelectedElement = aElement;
      ComposerCommands.mLastSelectedElementPath = path;
      if (!aDontNotify)
        NotifierUtils.notify("selection", aElement, aOneElementSelected);
    }

    if (ComposerCommands.mLastSelectedElementPath != path) {
      // now we're sure something changed in the selection, element or attribute
      // on the selected element
      if (!aDontNotify)
        NotifierUtils.notify("selection", aElement, aOneElementSelected);
      ComposerCommands.mLastSelectedElementPath = path;
    }
  },

  onStateButtonUpdate: function onStateButtonUpdate(button, commmandID, onState)
  {
    var commandNode = document.getElementById(commmandID);
    var state = commandNode.getAttribute("state");
  
    button.checked = state == onState;
  },

  selectionListener: {
    //Interfaces this component implements.
    interfaces: [Components.interfaces.nsIEditorObserver,
                 Components.interfaces.nsIEditorMouseObserver,
                 Components.interfaces.nsISelectionListener,
                 Components.interfaces.nsITransactionListener,
                 Components.interfaces.nsISupports],
  
    // nsISupports
  
    QueryInterface: function(iid) {
      if (!this.interfaces.some( function(v) { return iid.equals(v) } ))
        throw Components.results.NS_ERROR_NO_INTERFACE;
  
      return this;
    },
  
    getInterface: function(iid) {
      return this.QueryInterface(iid);
    },

    notifySelectionChanged: function(doc, sel, reason)
    {
      ComposerCommands.updateSelectionBased(false);
    },

    EditAction: function()
    {
      ComposerCommands.updateSelectionBased(false);
    },

    MouseDown: function(aClientX, aClientY, aTarget, aIsShiftKey) {
      return TableResizer.MouseDown(aClientX, aClientY, aTarget, aIsShiftKey);
    },

    MouseMove: function(aClientX, aClientY, aTarget, aIsShiftKey) {
      return TableResizer.MouseMove(aClientX, aClientY, aTarget, aIsShiftKey);
    },

    MouseUp: function(aClientX, aClientY, aTarget, aIsShiftKey) {
      return TableResizer.MouseUp(aClientX, aClientY, aTarget, aIsShiftKey);
    },

    willDo: function(aManager, aTransaction) { return false; },
    didDo: function(aManager, aTransaction, aDoResult) { },
    willUndo: function(aManager, aTransaction) { return false; },
    didUndo: function(aManager, aTransaction, aDoResult) {
      ComposerCommands.updateSelectionBased(false);
      if ("ResponsiveRulerHelper" in window)
        setTimeout(function() { ResponsiveRulerHelper.refresh() }, 100);
    },
    willRedo: function(aManager, aTransaction) { return false; },
    didRedo: function(aManager, aTransaction, aDoResult) {
      ComposerCommands.updateSelectionBased(false);
      if ("ResponsiveRulerHelper" in window)
        setTimeout(function() { ResponsiveRulerHelper.refresh() }, 100);
    },
    willBeginBatch: function(aManager) { return false; },
    didBeginBatch: function(aManager, aResult) {},
    willEndBatch: function(aManager) { return false; },
    didEndBatch: function(aManager, aResult) {},
    willMerge: function(aManager, aTopTransaction, aTransactionToMerge) { return false; },
    didMerge: function(aManager, aTopTransaction, aTransactionToMerge, aDidMerge, aMergeResult) {}
  }
};


var cmdStopLoading =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var res = false;
    try {
      var tab = document.getElementById("tabeditor").selectedTab;
      if (tab)
        res = tab.hasAttribute("busy");
    }
    catch(e) {}
    return res;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    document.getElementById("tabeditor").stopWebNavigation();
  }
};

var cmdTabeditor =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return document.getElementById("tabeditor").mTabpanels.hasChildNodes();
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},
  doCommand: function(aCommand) {}
};

var cmdNew =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},
  doCommand: function(aCommand)
  {
    var url = GetPreferredNewDocumentURL();
    OpenFile(url, true);
  }
};

var cmdNewWindow =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},
  doCommand: function(aCommand)
  {
    OpenNewWindow("");
  }
};

var cmdNewWizard =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},
  doCommand: function(aCommand)
  {
    OpenAppModalWindow(window,
                       "chrome://bluegriffon/content/dialogs/newPageWizard.xul",
                       "newPageWizard", false);
  }
};
var cmdNewEbook =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},
  doCommand: function(aCommand)
  {
    var rv = { cancelled: true };
    window.openDialog("chrome://epub/content/epub/newEbook.xul",
                      "_blank",
                      "all,chrome,dialog=no,modal=no",
                      rv);
  }
};

var cmdOpen =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;    // we can always do this
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    window.openDialog("chrome://bluegriffon/content/dialogs/openLocation.xul","_blank",
                      "chrome,modal,titlebar", "tab");
  }
};

var cmdOpenFile =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;    // we can always do this
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
      fp.init(window,
              gDialog.bundleOpenLocation.getString("chooseFileDialogTitle"),
              Components.interfaces.nsIFilePicker.modeOpen);
      
      var ebmAvailable = ("EBookManager" in window);
      if (ebmAvailable)
        fp.appendFilter(document.getElementById("bundleEbookManager").getString("HTMLorEPUBBooks"),
                        "*.html; *.htm; *.shtml; *.xhtml; *.epub");
      fp.appendFilters(Components.interfaces.nsIFilePicker.filterHTML);
      fp.appendFilter(gDialog.bundleOpenLocation.getString("PHPfiles"), "*.php");
      fp.appendFilters(Components.interfaces.nsIFilePicker.filterText);
      if (ebmAvailable)
        fp.appendFilter(document.getElementById("bundleEbookManager").getString("EPUBbooks"),
                        "*.epub");
      fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
  
      if (fp.show() == Components.interfaces.nsIFilePicker.returnOK
          && fp.fileURL.spec
          && fp.fileURL.spec.length > 0)
      {
        if (ebmAvailable && fp.fileURL.spec.toLowerCase().endsWith(".epub")) {
          var windowEnumerator = Services.wm.getEnumerator("bluegriffon");
          var win = null;
          while (windowEnumerator.hasMoreElements()) {
            var w = windowEnumerator.getNext();
            var ebookElt = w.document.querySelector("epub2,epub3,epub31");
            if (ebookElt) {
              var ebook = ebookElt.getUserData("ebook");
              if (fp.file.equals(ebook.packageFile)) {
                w.focus();
                return;
              }
            }
            else if (!win)
              win = w;
          }
    
          if (win && !win.EditorUtils.getCurrentEditor()) {
            win.focus();
            win.EBookManager.showEbook(fp.file, fp.fileURL.spec);
            win.updateCommands("style");
            return;
          }
          OpenNewWindow(UrlUtils.getIOService().newFileURI(fp.file).QueryInterface(Components.interfaces.nsIURL).spec);
        }
        else {
          if (!ebmAvailable || !EBookManager.isUrlSpecInBook(fp.fileURL.spec))
            StoreUrlInLocationDB(fp.fileURL.spec);
          OpenFile(fp.fileURL.spec, true);
        }
      }
    }
    catch(ex) {
    }
  }
};

var cmdSave =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    // Always allow saving when editing a remote document,
    //  otherwise the document modified state would prevent that
    //  when you first open a remote file.
    try {
      var docUrl = EditorUtils.getDocumentUrl();
      return EditorUtils.isDocumentEditable()
              && (!EditorUtils.isWysiwygMode()
                  || EditorUtils.isDocumentModified()
                  || UrlUtils.isUrlOfBlankDocument(docUrl));
    } catch (e) {return false;}
  },
  
  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var result = false;
    var editor = EditorUtils.getCurrentEditor();
    if (editor)
      try {
        var mode = EditorUtils.isWysiwygMode();
        if (!mode) {
          var editorElement = EditorUtils.getCurrentEditorElement();
          var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
          var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
          var source = sourceEditor.getValue();

          result = BGFileHelper.saveSourceDocument(source,
                     UrlUtils.isUrlOfBlankDocument(EditorUtils.getDocumentUrl()),
                     false,
                     EditorUtils.getCurrentDocumentMimeType());
          if (result) { 
            // we must update the original source to detect if the document has
            // changed when we leave source mode; b=479
            sourceIframe.setUserData("lastSaved", source, null);
          }
          sourceIframe.focus();
          sourceEditor.focus();
        }
        else {
          EditorUtils.cleanup();
          result = BGFileHelper.saveDocument(
                     UrlUtils.isUrlOfBlankDocument(EditorUtils.getDocumentUrl()),
                     false,
                     EditorUtils.getCurrentDocumentMimeType());
          GetWindowContent().focus();
        }
        NotifierUtils.notify("fileSaved", EditorUtils.getDocumentUrl());
        window.updateCommands("style");
        if (result)
          StoreUrlInLocationDB(EditorUtils.getDocumentUrl());
      }
      catch (e) {}
    return result;
  }
}

var cmdSaveAs =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return EditorUtils.isDocumentEditable();
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var result = false;
    var editor = EditorUtils.getCurrentEditor();
    if (editor)
      try {
        var mode = EditorUtils.isWysiwygMode();
        if (!mode) {
          var editorElement = EditorUtils.getCurrentEditorElement();
          var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
          var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
          var source = sourceEditor.getValue();

          result = BGFileHelper.saveSourceDocument(source,
                     true,
                     false,
                     EditorUtils.getCurrentDocumentMimeType());
          if (result) { 
            // we must update the original source to detect if the document has
            // changed when we leave source mode; b=479
            sourceIframe.setUserData("lastSaved", source, null);
          }
        }
        else {
          EditorUtils.cleanup();
          result = BGFileHelper.saveDocument(
                     true,
                     false,
                     EditorUtils.getCurrentDocumentMimeType());
        }
        GetWindowContent().focus();
        if (result) {
          StoreUrlInLocationDB(EditorUtils.getDocumentUrl());
        }
      }
      catch (e) {}
    return result;
  }
}

var cmdCloseTab =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;
  },
  
  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var editorElement = EditorUtils.getCurrentEditorElement();
    if (!editorElement) { // sanity check
      var ebook = document.querySelector("epub2,epub3,epub31");
      if (!ebook)
        window.close();
      return;
    }

    switch (EditorUtils.getCurrentViewMode()) {
      case "source":
      case "liveview":
        if (!ToggleViewMode(gDialog.wysiwygModeButton))
          return;
        break;
      default: break;
    }

    if (EditorUtils.isDocumentModified()) {
      var rv = PromptUtils.confirmWithTitle(
                             L10NUtils.getString("FileNotSaved"),
                             L10NUtils.getString("SaveFileBeforeClosing"),
                             L10NUtils.getString("YesSaveFile"),
                             L10NUtils.getString("DontCloseTab"),
                             L10NUtils.getString("NoDiscardChanges"));
       switch(rv) {
         case 1:
           return rv;
         case 0:
           if (!cmdSave.doCommand()) {
             return 1;
           }
         default: break;
       }
    }
    doCloseTab(EditorUtils.getCurrentTabEditor().selectedTab);
    return rv;
  }
}

var cmdCloseEbook =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (null != document.querySelector("epub2,epub3,epub31"));
  },
  
  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var ebook = document.querySelector("epub2,epub3,epub31");
    if (ebook) // sanity check
      ebook.closeBookOnSave();
  }
}

function StoreUrlInLocationDB(url)
{
  RecentPagesHandler.saveRecentFilesPrefs();
  RecentPagesHandler.buildRecentPagesMenu();
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties)
                       .get("ProfD", Components.interfaces.nsIFile);
  file.append("bgLocations.sqlite");
  
  var storageService = Components.classes["@mozilla.org/storage/service;1"]
                          .getService(Components.interfaces.mozIStorageService);
  var dbConn = storageService.openDatabase(file);
  try {
    var statement = dbConn.createStatement(
      "INSERT INTO 'bgLocations' ('query','querydate') VALUES(?1,?2)");
  
    statement.bindUTF8StringParameter(0, url);
    statement.bindInt64Parameter(1, Date.parse(new Date()));
  
    statement.execute();
    statement.finalize();

    dbConn.close();
  }
  catch (e) {} // already exists in table
}
var cmdFullScreen =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return true;    // we can always do this
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    window.fullScreen = !window.fullScreen;
    if (window.fullScreen)
    {
      window.document.documentElement.setAttribute("fullscreen", "true");

      gDialog["fullscr-grabber"].addEventListener("mousemove", function(){cmdFullScreen.showToolbars(true)}, false);
      gDialog.maincontainer.addEventListener("mousemove", function(){cmdFullScreen.showToolbars(false)}, false);
    }
    else
      window.document.documentElement.removeAttribute("fullscreen");
  },

  showToolbars: function(aShow)
  {
    if (aShow)
      window.document.documentElement.setAttribute("forcetoolbars", "true");
    else
      window.document.documentElement.removeAttribute("forcetoolbars");
  }
};


var cmdBrowseCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML());
  },
  
  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var rv = cmdSave.doCommand();
    if (rv)
      loadExternalURL(EditorUtils.getDocumentUrl());
    return rv;
  }
};


var cmdToggleView =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var nextMode = EditorUtils.isWysiwygMode()
                   ? 'source'
                   : 'wysiwyg';
    ToggleViewMode(gDialog[nextMode + 'ModeButton']);
  }
};

//-----------------------------------------------------------------------------------
var cmdDummyHTML =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    // do nothing
  }

};

var cmdDummySource =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive  &&
            (EditorUtils.getCurrentViewMode() == "source" ||
             EditorUtils.getCurrentViewMode() == "liveview"));
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    // do nothing
  }

};

var cmdDummyAll =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive);
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    // do nothing
  }

};

var cmdViewModeEnabler =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive &&
            gDialog.sourceModeButton.getAttribute("busy") != "true");
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    // do nothing
  }
};

var cmdMarkupCleaner =
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
    try {
      window.openDialog("chrome://bluegriffon/content/dialogs/markupCleaner.xul", "_blank",
              "chrome,close,titlebar,modal");
    }
    catch(ex) {}
    GetWindowContent().focus();
  }
};

var cmdGotoLinkCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    if (EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode()) {
      var element = EditorUtils.getObjectForProperties(["a"], "href");
      if (element) {
        var url = UrlUtils.makeRelativeUrl(element.getAttribute("href"));
        if (url.length && url[0] == "#")
          return true;
      }
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = EditorUtils.getObjectForProperties(["a"], "href");
    var target = UrlUtils.makeRelativeUrl(element.getAttribute("href"));
    if (target)
      target = target.substr(1);
    else
      return; // sanity check
    // first check ID...
    var doc = EditorUtils.getCurrentDocument();
    var targetElement = doc.getElementById(target) || doc.querySelector("a[name='" + target + "']");
    if (targetElement) {
      ScrollToElement(targetElement);
      EditorUtils.getCurrentEditor().selectElement(targetElement);
    }
  }
};

var cmdEditLinkCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    if (EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode()) {
      var element = EditorUtils.getObjectForProperties(["a"], "href");
      if (element) {
        var url = UrlUtils.makeAbsoluteUrl(element.getAttribute("href"));
        try {
          var uri = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService)
                              .newURI(url, null, null);
          if (uri.specIgnoringRef != EditorUtils.getDocumentUrl())
            return true;
        }
        catch(e) {}
      }
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = EditorUtils.getObjectForProperties(["a"], "href");
    var target = element.href;
    OpenFile(target, true);
  }
};

function GetSelectionContainerForNavigation()
{
  var s = EditorUtils.getCurrentEditor().selection;
  var r = s.getRangeAt(0);
  var sc = r.startContainer;
  if (s.isCollapsed ||
      (sc == s.getRangeAt(0).endContainer)) {
    if (sc.nodeType == Node.ELEMENT_NODE)
      return sc.childNodes.item(r.startOffset);
    return sc;
  }

  return s.getRangeAt(0).commonAncestorContainer;
}

var cmdStructureClimbCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive  &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = GetSelectionContainerForNavigation();
    var editor = EditorUtils.getCurrentEditor();
    if (element.parentNode && element.parentNode != element.ownerDocument.documentElement)
      editor.selectElement(element.parentNode)
  }

};

var cmdStructureFirstChildCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive  &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var s = EditorUtils.getCurrentEditor().selection;
    var element = GetSelectionContainerForNavigation();
    var editor = EditorUtils.getCurrentEditor();
    if (element && element.firstChild) {
      if (element.firstChild.nodeType == Node.ELEMENT_NODE)
        editor.selectElement(element.firstChild);
      else {
        var e = element.firstChild;
        while (e) {
          if (e.nodeType != Node.TEXT_NODE
              || e.data.match( /[^\s\r\n]/g )) {
            if (e.nodeType == Node.ELEMENT_NODE)
              editor.selectElement(e);
            else {
              s.removeAllRanges();
              var range = EditorUtils.getCurrentDocument().createRange();
              range.selectNode(e);
              s.addRange(range);
            }
            return;
          }
          e = e.nextSibling;
        }
      }
    }
   }

};

var cmdStructureNextCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive  &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var s = EditorUtils.getCurrentEditor().selection;
    var element = GetSelectionContainerForNavigation();
    var editor = EditorUtils.getCurrentEditor();
    if (element && element.nextSibling) {
      if (element.nextSibling.nodeType == Node.ELEMENT_NODE)
        editor.selectElement(element.nextSibling);
      else {
        s.removeAllRanges();
        var range = EditorUtils.getCurrentDocument().createRange();
        range.selectNode(element.nextSibling);
        s.addRange(range);
      }
    }
    else {
      // no next sibling, climb up until we find one
      var result = null;
      while (!result
             && element
             && element.parentNode != element.ownerDocument.documentElement) {
        if (element.nextSibling) {
          var e = element.nextSibling;
          while (e && !result) {
            if (e
                && (e.nodeType != Node.TEXT_NODE
                    || e.data.match( /[^\s\r\n]/g ))) {
              result = e;
            }

            e = e.nextSibling;
          }
        }

        element = element.parentNode;
      }

      if (result) {
        if (result.nodeType == Node.ELEMENT_NODE)
          editor.selectElement(result);
        else {
          s.removeAllRanges();
          var range = EditorUtils.getCurrentDocument().createRange();
          range.selectNode(result);
          s.addRange(range);
        }
      }
    }
   }

};

var cmdStructurePreviousCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive  &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var s = EditorUtils.getCurrentEditor().selection;
    var element = GetSelectionContainerForNavigation();
    var editor = EditorUtils.getCurrentEditor();
    if (element && element.previousSibling) {
      if (element.previousSibling.nodeType == Node.ELEMENT_NODE)
        editor.selectElement(element.previousSibling);
      else {
        s.removeAllRanges();
        var range = EditorUtils.getCurrentDocument().createRange();
        range.selectNode(element.previousSibling);
        s.addRange(range);
      }
    }
    else {
      // no next sibling, climb up until we find one
      var result = null;
      while (!result
             && element
             && element.parentNode != element.ownerDocument.documentElement) {
        if (element.previousSibling) {
          var e = element.previousSibling;
          while (e && !result) {
            if (e
                && (e.nodeType != Node.TEXT_NODE
                    || e.data.match( /[^\s\r\n]/g ))) {
              result = e;
            }

            e = e.previousSibling;
          }
        }

        element = element.parentNode;
      }

      if (result) {
        if (result.nodeType == Node.ELEMENT_NODE)
          editor.selectElement(result);
        else {
          s.removeAllRanges();
          var range = EditorUtils.getCurrentDocument().createRange();
          range.selectNode(result);
          s.addRange(range);
        }
      }
    }
   }

};

var cmdCommentOrPICommand = {
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            !EditorUtils.activeViewActive  &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    window.openDialog("chrome://bluegriffon/content/dialogs/insertCommentOrPI.xul", "_blank",
                      "chrome,close,titlebar,modal,resizable=yes", null);
  }
};

//-----------------------------------------------------------------------------------

function ApplyToNodesArray(aFunctor, aEditor)
{
  var nodes = [], node;
  if (aEditor
      && aEditor.selection.rangeCount > 1) {
    var selection = aEditor.selection;
    var count = selection.rangeCount;
    for (var i = 0; i < count; i++) {
      var range = selection.getRangeAt(i);
      if (range.startContainer == range.endContainer
          && range.startOffset + 1 == range.endOffset
          && range.startContainer.nodeType == Node.ELEMENT_NODE) {
        node = range.startContainer.childNodes[range.startOffset];
      }
      else
        node = selection.getRangeAt(i).commonAncestorContainer;
      nodes.push(node);
    }
  }
  else
    nodes.push(EditorUtils.getSelectionContainer().node);

  aEditor.beginTransaction();
  for (var k = 0 ; k < nodes.length; k++) {
    node = nodes[k];
    aFunctor(node, arguments);
  }
  aEditor.endTransaction();

  return nodes;
}

var cmdClass =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function (aCommandName, aParams, aRefcon)
  {
    var enabled = this.isCommandEnabled(aCommandName, aRefcon);
    aParams.setBooleanValue("state_enabled", enabled);
    aParams.setBooleanValue("state_mixed", false);
    var selContainer = EditorUtils.getSelectionContainer();
    if (selContainer && selContainer.node)
    {
      var classes = selContainer.node.className;
      if (classes)
      {
        aParams.setCStringValue("state_attribute", classes);
        return;
      }
    }

    aParams.setCStringValue("state_attribute", "");
  },

  doCommandParams: function(aCommandName, aParams, aRefCon)
  {
    var className = aParams.getCStringValue("state_attribute");

    function functor(aNode) {
      var editor = arguments[1][1];
      var cn = arguments[1][2];

      if (cn) {
        var classes = aNode.classList;
    
        var newList = cn;
        if (classes)
        {
          var found = false;
          newList = [];
          for (var i = 0; i < classes.length; i++)
          {
            if (classes[i] == cn)
              found = true;
            else
            newList.push(classes[i]);;
          }
          if (!found)
            newList.push(cn);
        }
        if (newList.length)
          editor.setAttribute(aNode, "class", newList.join(" "));
        else
          editor.removeAttribute(aNode, "class");
      }
      else
        editor.removeAttribute(aNode, "class");
    }

    var nodes = ApplyToNodesArray(functor,
                                  EditorUtils.getCurrentEditor(),
                                  className);

    // be kind with the rest of the world
    NotifierUtils.notify("selection", nodes[0], false);
  }
};

var cmdId =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function (aCommandName, aParams, aRefcon)
  {
    var enabled = this.isCommandEnabled(aCommandName, aRefcon);
    aParams.setBooleanValue("state_enabled", enabled);
    aParams.setBooleanValue("state_mixed", false);
    var selContainer = EditorUtils.getSelectionContainer();
    if (selContainer && selContainer.node)
    {
      var id = selContainer.node.id;
      if (id)
      {
        aParams.setCStringValue("state_attribute", id);
        return;
      }
    }

    aParams.setCStringValue("state_attribute", "");
  },

  doCommandParams: function(aCommandName, aParams, aRefCon)
  {
    var id = aParams.getCStringValue("state_attribute");
    var node = EditorUtils.getSelectionContainer().node;
    var editor = EditorUtils.getCurrentEditor();
    var elt = id ? EditorUtils.getCurrentDocument().getElementById(id) : null;
    var rv = 0;
    if (elt && elt != node)
      rv = PromptUtils.confirmWithTitle(
                             L10NUtils.getString("IdAlreadyTaken"),
                             L10NUtils.getString("RemoveIdFromElement"),
                             L10NUtils.getString("YesRemoveId"),
                             L10NUtils.getString("NoCancel"),
                             null);

    if (id && node.id != id) {
      // first, let's check another element does not already carry that id...
      if (rv == 1)
        return;
      editor.beginTransaction();
      if (elt)
        editor.removeAttribute(elt, "id");
      editor.setAttribute(node, "id", id);
      editor.endTransaction();
    }
    else
      editor.removeAttribute(node, "id");

    // be kind with the rest of the world
    NotifierUtils.notify("selection", node, false);
  }
};

//-----------------------------------------------------------------------------------

var cmdAriaRole =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function (aCommandName, aParams, aRefcon)
  {
    var enabled = this.isCommandEnabled(aCommandName, aRefcon);
    aParams.setBooleanValue("state_enabled", enabled);
    aParams.setBooleanValue("state_mixed", false);
    var selContainer = EditorUtils.getSelectionContainer();
    if (selContainer)
    {
      var hasRole = selContainer.node.hasAttribute("role");
      var role = "";
      if (hasRole)
        role = selContainer.node.getAttribute("role");
      else {
        var lookForEpubType = Services.prefs.getBoolPref("bluegriffon.aria.epub-type") &&
                              EditorUtils.isXHTMLDocument() &&
                              selContainer.node.hasAttributeNS("http://www.idpf.org/2007/ops", "type");
        if (lookForEpubType)
          role = selContainer.node.getAttributeNS("http://www.idpf.org/2007/ops", "type");
      }
      if (role)
      {
        aParams.setCStringValue("state_attribute", role);
        return;
      }
    }

    aParams.setCStringValue("state_attribute", "");
  },

  doCommandParams: function(aCommandName, aParams, aRefCon)
  {
    var role = aParams.getCStringValue("state_attribute");
    var dealWithEpubType = Services.prefs.getBoolPref("bluegriffon.aria.epub-type") &&
                           EditorUtils.isXHTMLDocument();
  
    function functor(aNode) {
      var editor = arguments[1][1];
      var r = arguments[1][2];
      if (r) {
        if (dealWithEpubType) {
          editor.beginTransaction();
          editor.setAttribute(aNode, "role", r);
  
          var docElt = EditorUtils.getCurrentDocument().documentElement;
          if (!docElt.hasAttributeNS("http://www.w3.org/2000/xmlns/", "epub")) {
            var txn = new diSetAttributeNSTxn(docElt, "xmlns:epub", "http://www.w3.org/2000/xmlns/", "http://www.idpf.org/2007/ops");
            editor.transactionManager.doTransaction(txn);
          }
          var txn = new diSetAttributeNSTxn(aNode, "type", "http://www.idpf.org/2007/ops", r);
          editor.transactionManager.doTransaction(txn);
  
          editor.endTransaction();
        }
        else
          editor.setAttribute(aNode, "role", r);
      }
      else {
        if (dealWithEpubType) {
          editor.beginTransaction();
  
          editor.removeAttribute(aNode, "role");
  
          var txn = new diRemoveAttributeNSTxn(aNode, "type", "http://www.idpf.org/2007/ops");
          editor.transactionManager.doTransaction(txn);
  
          editor.endTransaction();
        }
        else
          editor.removeAttribute(aNode, "role");
      }
    }
  
    var nodes = ApplyToNodesArray(functor,
                                  EditorUtils.getCurrentEditor(),
                                  role);
  
    // be kind with the rest of the world
    NotifierUtils.notify("selection_strict", nodes[0], false);
  
  }
};


var cmdPagePropertiesCommand =
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
    try {
      window.openDialog("chrome://bluegriffon/content/dialogs/pageProperties.xul", "_blank",
              "chrome,close,titlebar,modal");
    }
    catch(ex) {}
    GetWindowContent().focus();
  }
};

var cmdEditListCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["ul","ol"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    window.openDialog("chrome://bluegriffon/content/dialogs/listProperties.xul","_blank",
                      "chrome,modal,titlebar,resizable=no,dialog=yes");
   }
};

//-----------------------------------------------------------------------------------

var cmdBgFontColorCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function (aCommandName, aParams, aRefcon)
  {
    var selContainer = EditorUtils.getSelectionContainer();
    var isCommandEnabled = this.isCommandEnabled(aCommandName);
    if (selContainer && isCommandEnabled)
    {
      var node = selContainer.node;
      var doc = EditorUtils.getCurrentDocument();
      var color = doc.defaultView.getComputedStyle(node, "").getPropertyValue("color");
      if (color)
      {
        aParams.setCStringValue("state_attribute", color);
        document.getElementById("cmd_bgFontColor").setAttribute("state", color);
        return;
      }
    }

    aParams.setCStringValue("state_attribute", "");
    document.getElementById("cmd_bgFontColor").setAttribute("state", "");
  },

  doCommandParams: function(aCommandName, aParams, aRefCon)
  {
    var color = aParams.getCStringValue("state_attribute");
  
    function functor(aNode) {
      var editor = arguments[1][1];
      var c = arguments[1][2];

      editor.beginTransaction();
      editor.isCSSEnabled = true;
      editor.setInlineProperty('font', 'color', c)
      editor.isCSSEnabled = isCSSEnabled;
      editor.endTransaction();
    }
  
    var nodes = ApplyToNodesArray(functor,
                                  EditorUtils.getCurrentEditor(),
                                  color);
  
    // be kind with the rest of the world
    NotifierUtils.notify("selection_strict", nodes[0], false);
  
  }
};

var cmdBgBackgroundColorCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function (aCommandName, aParams, aRefcon)
  {
    var selContainer = EditorUtils.getSelectionContainer();
    var isCommandEnabled = this.isCommandEnabled(aCommandName);
    if (selContainer && isCommandEnabled)
    {
      var node = selContainer.node;
      var doc = EditorUtils.getCurrentDocument();
      var color = "";
      while (node && 
             node.nodeType == Node.ELEMENT_NODE &&
             (color == "transparent" ||
              color == "rgba(0, 0, 0, 0)" ||
              !color)) {
        color = doc.defaultView.getComputedStyle(node, "").getPropertyValue("background-color");
        node = node.parentNode;
      }
      if (node && node.nodeType == Node.ELEMENT_NODE && color)
      {
        aParams.setCStringValue("state_attribute", color);
        document.getElementById("cmd_bgBackgroundColor").setAttribute("state", color);
        return;
      }
    }

    // we default to Gecko's default
    color = Services.prefs.getCharPref("browser.display.background_color");
    aParams.setCStringValue("state_attribute", color);
    document.getElementById("cmd_bgBackgroundColor").setAttribute("state", color);
  },

  doCommandParams: function(aCommandName, aParams, aRefCon)
  {
    var color = aParams.getCStringValue("state_attribute");
  
    function functor(aNode) {
      var editor = arguments[1][1];
      var c = arguments[1][2];

      editor.beginTransaction();
      editor.isCSSEnabled = true;
      editor.setBackgroundColor(c);
      editor.isCSSEnabled = isCSSEnabled;
      editor.endTransaction();
    }
  
    var nodes = ApplyToNodesArray(functor,
                                  EditorUtils.getCurrentEditor(),
                                  color);
  
    // be kind with the rest of the world
    NotifierUtils.notify("selection_strict", nodes[0], false);
  
  }
};

var cmdInsertOrEditTableCommand =
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
    if (EditorUtils.isWysiwygMode()) {
      var element = EditorUtils.getObjectForProperties(
            ["table", "thead", "tfoot", "tbody", "tr", "th", "td", "caption"]);
      if (element) {
        window.openDialog("chrome://bluegriffon/content/dialogs/insertTable.xul","_blank",
                          "chrome,modal,titlebar,resizable=yes,dialog=no", element);
        return;
      }
    }

    // reset the table insertion panel
    AutoInsertTable.reset();
    gDialog.AutoInsertTableSheetPopup.openPopup(gDialog["tableButton"], "after_start", 0, 0, false);
  }
};


var cmdInsertImageCommand =
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
    var element = (EditorUtils.isWysiwygMode())
                  ? EditorUtils.getObjectForProperties(["img"])
                  : null;
    window.openDialog("chrome://bluegriffon/content/dialogs/insertImage.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element, null);
  }
};

var cmdInsertAnchorCommand =
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
    var element = (EditorUtils.isWysiwygMode())
                  ? EditorUtils.getObjectForProperties(["a"])
                  : null;
    window.openDialog("chrome://bluegriffon/content/dialogs/insertAnchor.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertLinkCommand =
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
    var element = EditorUtils.getObjectForProperties(["a"], "href");
    window.openDialog("chrome://bluegriffon/content/dialogs/insertLink.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdCssPanelCommand =
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
    start_panel(gDialog["panel-cssproperties-menuitem"]);
  }
};

var cmdDomExplorerPanelCommand =
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
    start_panel(gDialog["panel-domexplorer-menuitem"]);
  }
};

var cmdInsertVideoCommand =
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
    var element = EditorUtils.getObjectForProperties(["video"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertVideo.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element, null);
  }
};

var cmdInsertAudioCommand =
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
    var element = EditorUtils.getObjectForProperties(["audio"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertAudio.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element, null);
  }
};

var cmdInsertHRCommand = 
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
    var element = EditorUtils.getObjectForProperties(["hr"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertHR.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertHTMLCommand =
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
    window.openDialog("chrome://bluegriffon/content/dialogs/insertHTML.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes");
  }
};

var cmdInsertFormCommand =
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
    var element = EditorUtils.getObjectForProperties(["form"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertForm.xul","_blank",
                      "chrome,modal,titlebar,resizable=no,dialog=yes", element);
  }
};

var cmdInsertFormInputCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {
    var type = aParams.getCStringValue("type");
    var element = EditorUtils.getObjectForProperties(["input"]);
    if (element) {
      if (!type || type != element.getAttribute("type"))
        element = null;
    }
    window.openDialog("chrome://bluegriffon/content/dialogs/insertFormInput.xul","_blank",
                      "chrome,modal,titlebar,resizable=no,dialog=yes", element, type);
  },

  doCommand: function(aCommand) {}
};

var cmdInsertFieldsetCommand =
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
    var element = EditorUtils.getObjectForProperties(["fieldset"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertFieldset.xul","_blank",
                      "chrome,modal,titlebar,resizable=no,dialog=yes", element);
  }
};

var cmdInsertLabelCommand =
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
    var element = EditorUtils.getObjectForProperties(["label"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertLabel.xul","_blank",
                      "chrome,modal,titlebar,resizable=no,dialog=yes", element);
  }
};

var cmdInsertButtonCommand =
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
    var element = EditorUtils.getObjectForProperties(["button"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertButton.xul","_blank",
                      "chrome,modal,titlebar,resizable=no,dialog=yes", element);
  }
};

var cmdInsertSelectCommand =
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
    var element = EditorUtils.getObjectForProperties(["select"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertSelect.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertTextareaCommand =
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
    var element = EditorUtils.getObjectForProperties(["textarea"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertTextarea.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertKeygenCommand =
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
    var element = EditorUtils.getObjectForProperties(["keygen"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertKeygen.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertOutputCommand =
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
    var element = EditorUtils.getObjectForProperties(["output"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertOutput.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertProgressCommand =
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
    var element = EditorUtils.getObjectForProperties(["progress"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertProgress.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertMeterCommand =
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
    var element = EditorUtils.getObjectForProperties(["meter"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertMeter.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdInsertDatalistCommand =
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
    var element = EditorUtils.getObjectForProperties(["datalist"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertDatalist.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=yes", element);
  }
};

var cmdStylesheetsCommand =
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
    OpenAppModalWindow(window, "chrome://bluegriffon/content/dialogs/insertStylesheet.xul", "", true); 
  }
};

var cmdSpanCommand =
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
    EditorUtils.setTextProperty("span", null, null);
    ComposerCommands.updateSelectionBased(false);
  }
};

var cmdBlockquoteCommand =
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
    var editor = EditorUtils.getCurrentEditor();
    var isCSSEnabled = editor.isCSSEnabled;
    editor.isCSSEnabled = false;
    editor.indent("indent");
    editor.isCSSEnabled = isCSSEnabled;
  }
};

var cmdRebuildTOCCommand =
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
    if (EditorUtils.getCurrentDocument().getElementById("mozToc"))
      TOCrebuilder.rebuild();
    else
      CreateOrUpdateTableOfContents();
  }
};
var cmdBgFindCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var isSource = !EditorUtils.isWysiwygMode();
    WysiwygShowFindBar();
    gDialog.bespinLineLabel.hidden = !isSource;
    gDialog.bespinLineTextbox.hidden = !isSource;
  }
};

var cmdBgFindAgainCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    BespinFind(true, false);
  }
};

var bgSpellingCommand =
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
    window.cancelSendMessage = false;
    try {
      OpenAppModalWindow(window,
                         "chrome://bluegriffon/content/dialogs/spellCheck.xul",
                         "Spell Check",
                         false); 
    }
    catch(ex) {}
    GetWindowContent().focus();
  }
};

var cmdCopyHTMLCodeCommand = {
  isCommandEnabled: function(aCommand, dummy)
  {
    var isHTMLView = (EditorUtils.getCurrentEditorElement() &&
                      EditorUtils.isDocumentEditable() &&
                      EditorUtils.isEditingRenderedHTML() &&
                      EditorUtils.isWysiwygMode());
    if (isHTMLView) {
      var editor = EditorUtils.getCurrentEditor();
      var selection = editor.selection;
      if (selection.rangeCount == 1)
      {
        // We have a "normal" single-range selection
        if (!selection.isCollapsed) {
           return true;
         }
      }
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var editor    = EditorUtils.getCurrentEditor();
    var selection = editor.selection;
    selection instanceof Components.interfaces.nsISelectionPrivate;
    var mimeType = EditorUtils.getCurrentDocument().contentType;

    var flags = 1 << 1; // OutputFormatted
    flags |= 1 << 5; // OutputWrap
    flags |= 1 << 10; // OutputLF

    var source = selection.toStringWithFormat(mimeType,
                                              flags,
                                              0);

    var clipboardSvc = Components.classes["@mozilla.org/widget/clipboard;1"]
                         .getService(Components.interfaces.nsIClipboard);
    var xferable = Components.classes["@mozilla.org/widget/transferable;1"]
                     .createInstance(Components.interfaces.nsITransferable);
    xferable.addDataFlavor("text/unicode");
    var s = Components.classes["@mozilla.org/supports-string;1"]
              .createInstance(Components.interfaces.nsISupportsString);
    s.data = source;
    xferable.setTransferData("text/unicode", s, source.length * 2);
    clipboardSvc.setData(xferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
  }
};

var cmdBGCopyCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()) {
        if (!EditorUtils.isWysiwygMode()) {
          var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
          var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
          return sourceEditor.somethingSelected();
        }
        var editor = EditorUtils.getCurrentEditor();
        editor instanceof Components.interfaces.nsIEditor;
        return editor.canCopy();
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canCopy = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canCopy);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (!EditorUtils.isWysiwygMode()) {
      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
      var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
      var text = sourceEditor.getSelection();

      var clipboardSvc = Components.classes["@mozilla.org/widget/clipboard;1"]
                           .getService(Components.interfaces.nsIClipboard);
      var xferable = Components.classes["@mozilla.org/widget/transferable;1"]
                       .createInstance(Components.interfaces.nsITransferable);
      xferable.addDataFlavor("text/unicode");
      var s = Components.classes["@mozilla.org/supports-string;1"]
                .createInstance(Components.interfaces.nsISupportsString);
      s.data = text;
      xferable.setTransferData("text/unicode", s, text.length * 2);
      clipboardSvc.setData(xferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
    }
    else {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.copy();
    }
  }
};

var cmdBGCutCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()) {
        if (!EditorUtils.isWysiwygMode()) {
          var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
          var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
          return sourceEditor.somethingSelected();
        }
        var editor = EditorUtils.getCurrentEditor();
        editor instanceof Components.interfaces.nsIEditor;
        return editor.canCut();
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canCut = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canCut);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (!EditorUtils.isWysiwygMode()) {
      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
      var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
      var text = sourceEditor.getSelection();

      var clipboardSvc = Components.classes["@mozilla.org/widget/clipboard;1"]
                           .getService(Components.interfaces.nsIClipboard);
      var xferable = Components.classes["@mozilla.org/widget/transferable;1"]
                       .createInstance(Components.interfaces.nsITransferable);
      xferable.addDataFlavor("text/unicode");
      var s = Components.classes["@mozilla.org/supports-string;1"]
                .createInstance(Components.interfaces.nsISupportsString);
      s.data = text;
      xferable.setTransferData("text/unicode", s, text.length * 2);
      clipboardSvc.setData(xferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);

      sourceEditor.replaceSelection("");
    }
    else {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.cut();
    }
  }
};

var cmdBGPasteCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()) {
        var editor = EditorUtils.getCurrentEditor();
        editor instanceof Components.interfaces.nsIEditor;
        return editor.canPaste(Components.interfaces.nsIClipboard.kGlobalClipboard);
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canPaste = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canPaste);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (!EditorUtils.isWysiwygMode()) {
      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
      var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
      var text = sourceEditor.getSelection();

      var clipboardSvc = Components.classes["@mozilla.org/widget/clipboard;1"]
                           .getService(Components.interfaces.nsIClipboard);
      var xferable = Components.classes["@mozilla.org/widget/transferable;1"]
                       .createInstance(Components.interfaces.nsITransferable);
      xferable.addDataFlavor("text/unicode");
      clipboardSvc.getData(xferable, Components.interfaces.nsIClipboard.kGlobalClipboard);

      var data = {};
      var dataLen = {};
      xferable.getTransferData("text/unicode", data, dataLen);
  
      var text = ""
      if (data) {
        data = data.value.QueryInterface(Components.interfaces.nsISupportsString);
        text = data.data.substring(0, dataLen.value / 2);
      }
      sourceEditor.replaceSelection(text, "end");
    }
    else {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.paste(Components.interfaces.nsIClipboard.kGlobalClipboard);
    }
  }
};

var cmdBGUndoCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()) {
        if (!EditorUtils.isWysiwygMode()) {
          var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
          var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
          return (0 < sourceEditor.historySize().undo);
        }
        var editor = EditorUtils.getCurrentEditor();
        editor instanceof Components.interfaces.nsIEditor;
        var isEnabled = {}, canUndo = {};
        editor.canUndo(isEnabled, canUndo);
        return isEnabled.value && canUndo.value;
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canUndo = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canUndo);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (!EditorUtils.isWysiwygMode()) {
      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
      var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
      sourceEditor.undo();
    }
    else {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.undo(1);
    }
  }
};

var cmdBGRedoCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()) {
        if (!EditorUtils.isWysiwygMode()) {
          var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
          var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
          return (0 < sourceEditor.historySize().redo);
        }
        var editor = EditorUtils.getCurrentEditor();
        editor instanceof Components.interfaces.nsIEditor;
        var isEnabled = {}, canRedo = {};
        editor.canRedo(isEnabled, canRedo);
        return isEnabled.value && canRedo.value;
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canRedo = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canRedo);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (!EditorUtils.isWysiwygMode()) {
      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
      var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
      sourceEditor.redo();
    }
    else {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.redo(1);
    }
  }
};

var cmdBGselectAllCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement()
            && EditorUtils.isDocumentEditable()
            && EditorUtils.isEditingRenderedHTML());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canRedo = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canRedo);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (!EditorUtils.isWysiwygMode()) {
      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
      var sourceEditor = sourceIframe.contentWindow.wrappedJSObject.gEditor;
      sourceEditor.selectAll();
    }
    else {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.selectAll();
    }
  }
};

var cmdBGpasteNoFormattingCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()
          && EditorUtils.isWysiwygMode()) {
        var editor = EditorUtils.getCurrentEditor();
        editor instanceof Components.interfaces.nsIEditor;
        return editor.canPaste(Components.interfaces.nsIClipboard.kGlobalClipboard);
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canPaste = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canPaste);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (EditorUtils.isWysiwygMode()) {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.pasteNoFormatting(Components.interfaces.nsIClipboard.kGlobalClipboard);
    }
  }
};

var cmdBGdeleteCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    if (EditorUtils.getCurrentEditorElement()
        && EditorUtils.isDocumentEditable()
        && EditorUtils.isEditingRenderedHTML()
        && EditorUtils.isWysiwygMode()) {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      return editor.canCut();
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {
    var canDelete = this.isCommandEnabled();
    aParams.setBooleanValue("state_enabled", canDelete);
  },
  doCommandParams: function(aCommand, aParams, aRefCon) {
    this.doCommand();
  },

  doCommand: function(aCommand)
  {
    if (EditorUtils.isWysiwygMode()) {
      var editor = EditorUtils.getCurrentEditor();
      editor instanceof Components.interfaces.nsIEditor;
      editor.deleteSelection(Components.interfaces.nsIEditor.ePrevious, Components.interfaces.nsIEditor.eStrip);
    }
  }
};
var bgInsertTableCommand =
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
    // reset the table insertion panel
    AutoInsertTable.reset();
    gDialog.AutoInsertTableSheetPopup.openPopup(EditorUtils.getCurrentTabEditor(), "at_pointer", 0, 0, false);
  }
};

var bgEditTableCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    window.openDialog("chrome://bluegriffon/content/dialogs/insertTable.xul","_blank",
                      "chrome,modal,titlebar,resizable=yes,dialog=no", element);
  }
};

var bgSelectTableCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().selectTable();
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgSelectTableCaptionCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    if (element &&
        EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode()) {
      // but do we already have a caption?
      return  (element.firstElementChild
               && element.firstElementChild.nodeName == "caption");
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    try {
      EditorUtils.getCurrentEditor().selectElement(element.firstElementChild);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgSelectTableRowCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().selectTableRow();
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgsSelectTableColumnCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().selectTableColumn();
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgSelectTableCellCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().selectTableCell();
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgSelectAllTableCellsCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().selectAllTableCells();
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableCaptionCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    if (element &&
        EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode()) {
      // but do we already have a caption?
      return  (!element.firstElementChild
               || element.firstElementChild.nodeName != "caption");
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    try {
      var caption = EditorUtils.getCurrentEditor().createElementWithDefaults("caption");
      var brNode = EditorUtils.getCurrentDocument().createElement("br");
      caption.appendChild(brNode);
      EditorUtils.getCurrentEditor().insertNode(caption, element, 0);
      EditorUtils.getCurrentEditor().selectElement(brNode);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableRowAboveCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().insertTableRow(1, false);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableRowBelowCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().insertTableRow(1, true);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableColumnBeforeCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().insertTableColumn(1, false);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableColumnAfterCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().insertTableColumn(1, true);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableCellBeforeCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().insertTableCell(1, false);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgInsertTableCellAfterCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().insertTableCell(1, true);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgDeleteTableCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().deleteTable();
    } catch(e) {}
    GetWindowContent().focus();
  }
};

var bgDeleteTableCaptionCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    if (element &&
        EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode()) {
      // but do we already have a caption?
      return  (element.firstElementChild
               && element.firstElementChild.nodeName == "caption");
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    try {
      EditorUtils.getCurrentEditor().deleteNode(element.firstElementChild);
    } catch(e) {}
    GetWindowContent().focus();
  }
};

function GetNumberOfContiguousSelectedRows()
{
  var rows = 0;
  try {
    var editor = EditorUtils.getCurrentTableEditor();
    var rowObj = { value: 0 };
    var colObj = { value: 0 };
    var cell = editor.getFirstSelectedCellInTable(rowObj, colObj);
    if (!cell)
      return 0;

    // We have at least one row
    rows++;

    var lastIndex = rowObj.value;
    do {
      cell = editor.getNextSelectedCell({value:0});
      if (cell)
      {
        editor.getCellIndexes(cell, rowObj, colObj);
        var index = rowObj.value;
        if (index == lastIndex + 1)
        {
          lastIndex = index;
          rows++;
        }
      }
    }
    while (cell);
  } catch (e) {}

  return rows;
}

function GetNumberOfContiguousSelectedColumns()
{
  var columns = 0;
  try {
    var editor = EditorUtils.getCurrentTableEditor();
    var colObj = { value: 0 };
    var rowObj = { value: 0 };
    var cell = editor.getFirstSelectedCellInTable(rowObj, colObj);
    if (!cell)
      return 0;

    // We have at least one column
    columns++;

    var lastIndex = colObj.value;
    do {
      cell = editor.getNextSelectedCell({value:0});
      if (cell)
      {
        editor.getCellIndexes(cell, rowObj, colObj);
        var index = colObj.value;
        if (index == lastIndex +1)
        {
          lastIndex = index;
          columns++;
        }
      }
    }
    while (cell);
  } catch (e) {}

  return columns;
}

var bgDeleteTableRowCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var rows = GetNumberOfContiguousSelectedRows();
    // Delete at least one row
    if (rows == 0)
      rows = 1;

    try {
      var editor = EditorUtils.getCurrentTableEditor();
      editor.beginTransaction();

      // Loop to delete all blocks of contiguous, selected rows
      while (rows)
      {
        editor.deleteTableRow(rows);
        rows = GetNumberOfContiguousSelectedRows();
      }
    } finally { editor.endTransaction(); }
    GetWindowContent().focus();
  }
};

var bgDeleteTableColumnCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    var columns = GetNumberOfContiguousSelectedColumns();
    // Delete at least one column
    if (columns == 0)
      columns = 1;

    try {
      var editor = EditorUtils.getCurrentTableEditor();
      editor.beginTransaction();

      // Loop to delete all blocks of contiguous, selected columns
      while (columns)
      {
        editor.deleteTableColumn(columns);
        columns = GetNumberOfContiguousSelectedColumns();
      }
    } finally { editor.endTransaction(); }
    GetWindowContent().focus();
  }
};

var bgDeleteTableCellCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().deleteTableCell(1);   
    } catch (e) {}
    GetWindowContent().focus();
  }
};

var bgDeleteTableCellContentsCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().deleteTableCellContents();   
    } catch (e) {}
    GetWindowContent().focus();
  }
};

var bgNormalizeTableCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["table"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    // Use nsnull to let editor find table enclosing current selection
    try {
      EditorUtils.getCurrentTableEditor().normalizeTable(null);   
    } catch (e) {}
    GetWindowContent().focus();
  }
};

var bgJoinTableCellsCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    if (EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode())
    {
      try {
        var editor = EditorUtils.getCurrentTableEditor();
        var tagNameObj = { value: "" };
        var countObj = { value: 0 };
        var cell = editor.getSelectedOrParentTableElement(tagNameObj, countObj);

        // We need a cell and either > 1 selected cell or a cell to the right
        //  (this cell may originate in a row spanned from above current row)
        // Note that editor returns "td" for "th" also.
        // (this is a pain! Editor and gecko use lowercase tagNames, JS uses uppercase!)
        if( cell && (tagNameObj.value == "td"))
        {
          // Selected cells
          if (countObj.value > 1) return true;

          var colSpan = cell.getAttribute("colspan");

          // getAttribute returns string, we need number
          // no attribute means colspan = 1
          if (!colSpan)
            colSpan = Number(1);
          else
            colSpan = Number(colSpan);

          var rowObj = { value: 0 };
          var colObj = { value: 0 };
          editor.getCellIndexes(cell, rowObj, colObj);

          // Test if cell exists to the right of current cell
          // (cells with 0 span should never have cells to the right
          //  if there is, user can select the 2 cells to join them)
          return (colSpan && editor.getCellAt(null, rowObj.value,
                                              colObj.value + colSpan));
        }
      } catch (e) {}
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    // Param: Don't merge non-contiguous cells
    try {
      EditorUtils.getCurrentTableEditor().joinTableCells(false);
    } catch (e) {alert(e)}
    GetWindowContent().focus();
  }
};

function IsSelectionInOneCell()
{
  try {
    var editor = EditorUtils.getCurrentEditor();
    var selection = editor.selection;

    if (selection.rangeCount == 1)
    {
      // We have a "normal" single-range selection
      if (!selection.isCollapsed &&
         selection.anchorNode != selection.focusNode)
      {
        // Check if both nodes are within the same cell
        var anchorCell = editor.getElementOrParentByTagName("td", selection.anchorNode);
        var focusCell = editor.getElementOrParentByTagName("td", selection.focusNode);
        return (focusCell != null && anchorCell != null && (focusCell == anchorCell));
      }
      // Collapsed selection or anchor == focus (thus must be in 1 cell)
      return true;
    }
  } catch (e) {}
  return false;
}

var bgSplitTableCellCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    if (EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode())
    {
      var tagNameObj = { value: "" };
      var countObj = { value: 0 };
      var cell;
      try {
        cell = EditorUtils.getCurrentTableEditor().getSelectedOrParentTableElement(tagNameObj, countObj);
      } catch (e) {}

      // We need a cell parent and there's just 1 selected cell 
      // or selection is entirely inside 1 cell
      if ( cell && (tagNameObj.value == "td") && 
           countObj.value <= 1 &&
           IsSelectionInOneCell() )
      {
        var colSpan = cell.getAttribute("colspan");
        var rowSpan = cell.getAttribute("rowspan");
        if (!colSpan) colSpan = 1;
        if (!rowSpan) rowSpan = 1;
        return (colSpan > 1  || rowSpan > 1 ||
                colSpan == 0 || rowSpan == 0);
      }
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().splitTableCell();
    } catch (e) {}
    GetWindowContent().focus();
  }
};

function GetParentTableCell(element)
{
  var node = element;
  while (node)
  {
    if (node.nodeName.toLowerCase() == "td" || node.nodeName.toLowerCase() == "th")
      return node;

    node = node.parentNode;
  }
  return node;
}

var bgConvertToTable =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    if (EditorUtils.getCurrentEditorElement() &&
        EditorUtils.isDocumentEditable() &&
        EditorUtils.isEditingRenderedHTML() &&
        EditorUtils.isWysiwygMode())
    {
      var selection;
      var editor = EditorUtils.getCurrentEditor();
      try {
        selection = editor.selection;
      } catch (e) {}

      if (selection && !selection.isCollapsed)
      {
        // Don't allow if table or cell is the selection
        var element;
        try {
          element = editor.getSelectedElement("");
        } catch (e) {}
        if (element)
        {
          var name = element.nodeName.toLowerCase();
          if (name == "td" ||
              name == "th" ||
              name == "caption" ||
              name == "table")
            return false;
        }

        // Selection start and end must be in the same cell
        //   in same cell or both are NOT in a cell
        if ( GetParentTableCell(selection.focusNode) !=
             GetParentTableCell(selection.anchorNode) )
          return false
      
        return true;
      }
    }
    return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    window.openDialog("chrome://bluegriffon/content/dialogs/convertToTable.xul","_blank", "chrome,close,titlebar,modal")
    GetWindowContent().focus();
  }
};

var bgConvertClipboardToTable =
{
  isCommandEnabled: function(aCommand, dummy)
  {
      if (EditorUtils.getCurrentEditorElement()
          && EditorUtils.isDocumentEditable()
          && EditorUtils.isEditingRenderedHTML()) {
        var flavors = ["text/unicode"];
        var hasData =
          Services.clipboard.hasDataMatchingFlavors(flavors, flavors.length, Services.clipboard.kGlobalClipboard);
        if (hasData) {
          let trans = Components.classes["@mozilla.org/widget/transferable;1"].
                        createInstance(Components.interfaces.nsITransferable);
          trans.init(null);
          flavors.forEach(trans.addDataFlavor);

          Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
          var data = {};
          var dataLen = {};
          trans.getTransferData(flavors[0], data, dataLen);

          if (data) {
            data = data.value.QueryInterface(Components.interfaces.nsISupportsString);
            str = data.data.substring(0, dataLen.value / 2);
            if (str && str.replace( /\s/g, ""))
              return true;
          }
        }
      }
      return false;
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    window.openDialog("chrome://bluegriffon/content/dialogs/convertClipboardToTable.xul","_blank", "chrome,close,titlebar,modal")
    GetWindowContent().focus();
  }
};

var bgSelectTableColumnCommand =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    var element = EditorUtils.getObjectForProperties(["td", "th"]);
    return (element &&
            EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML() &&
            EditorUtils.isWysiwygMode());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    try {
      EditorUtils.getCurrentTableEditor().selectTableColumn();
    } catch(e) {}
    GetWindowContent().focus();
  }
};


/* ***** BEGIN LICENSE BLOCK *****
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * The Original Code is BlueGriffon
 *
 * Contributor(s):
 *   EVENTRIC LLC.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/printHelper.jsm");

//-----------------------------------------------------------------------------------
var cmdPrint =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    if (EditorUtils.isWysiwygMode())
      PrintHelper.print(EditorUtils.getCurrentEditorElement().contentWindow);
    else {
	    var editorElement = EditorUtils.getCurrentEditorElement();
	    if (editorElement) {
	      var sourceIframe = EditorUtils.getCurrentSourceEditorElement();
	      var sourceWindow = sourceIframe.contentWindow;

        PrintHelper.print(sourceWindow);
      }
    }
  }
};

//-----------------------------------------------------------------------------------
var cmdPrintSetup =
{
  isCommandEnabled: function(aCommand, dummy)
  {
    return (EditorUtils.getCurrentEditorElement() &&
            EditorUtils.isDocumentEditable() &&
            EditorUtils.isEditingRenderedHTML());
  },

  getCommandStateParams: function(aCommand, aParams, aRefCon) {},
  doCommandParams: function(aCommand, aParams, aRefCon) {},

  doCommand: function(aCommand)
  {
    PrintHelper.showPageSetup(window);
  }
};
//@line 628 "C:\Windows_software\bluegriffon\gecko-dev\bluegriffon\base\content\bluegriffon\js\commands.js"

function goDoNoCSSCommand(aCommand)
{
  try {
    var controller = top.document.commandDispatcher
                        .getControllerForCommand(aCommand);
    if (controller && controller.isCommandEnabled(aCommand)) {
      var editor = EditorUtils.getCurrentEditor();
      var isCSSEnabled = editor.isCSSEnabled;
      editor.isCSSEnabled = false;
      controller.doCommand(aCommand);
      editor.isCSSEnabled = isCSSEnabled;
    }
  }
  catch (e) {
    Components.utils.reportError("An error occurred executing the " +
                                 aCommand + " command: " + e);
  }
}
