var sTinymceOpts = {};

function sTinyMceIsIE10(){
  // TRUE if user is using IE10
  var t = tinymce, d = document, na = navigator, ua = na.userAgent;
  return !t.isWebKit && !t.isOpera && (/MSIE/gi).test(ua) && /MSIE [10]/.test(ua) && (/Explorer/gi).test(na.appName);
}

Drupal.behaviors.s_tinymce = function(context) {
  // no settings
  if(!Drupal.settings.s_tinymce)
    return;

  var tinymce_settings = Drupal.settings.s_tinymce;
  // no editors
  if(!tinymce_settings.editors || typeof tinymce_settings.editors != 'object')
    return;

  // already loaded
  if( tinyMCE.activeEditor ){
    var activeEditorId = tinyMCE.activeEditor.editorId;
    // active editor is in the list of currently configured editors, no need to load it
    if( activeEditorId && activeEditorId != 'edit-tme-textarea' ){
      var needs_config = false;
      $.each( tinymce_settings.editors , function( obj_id , editors ){
        if( $.inArray( activeEditorId , editors ) == -1 )
          needs_config = true;
      });

      if(!needs_config)
        return;
    }
  }

  //if the html button is active, don't reload this, we don't need it
  if($('#tinymce-toggle-html', context).hasClass('tinymce-toggle-active'))
    return;

  // setup tinymce and load
  var textFieldIds = [];
  $.each( tinymce_settings.editors , function( form_id , editors ){
    $.each( editors , function( index , field_id ){
      var richTextField = $('#' + field_id);
      if(!richTextField.hasClass('sTinymce-processed')){
        textFieldIds.push(field_id);
        richTextField.addClass('sTinymce-processed');
      }
    });
  });

  // if all of the potential rich text fields have been processed, then we don't need/want to process them again
  if(!textFieldIds.length){
    return;
  }

  // attach the editor toggle to our custom buttons
  var htmlToggleBtn = $(".tinymce-html-btn",context),
      visualToggleBtn = $(".tinymce-visual-btn",context);
  htmlToggleBtn.each(function() {
    var htmlToggleButton = $(this);
    bindToggleActions(htmlToggleButton, handleHtmlToggleEvent);
  
    function handleHtmlToggleEvent(e) {
      if (tinyMCE.activeEditor == null) return;
  
      var editor_id = $(this).attr('editor_id');
      var form = $(this).parents('form');
      var editorTextarea = $("textarea#" + editor_id, form);
  
      //tinyMCE.get(editor_id).save();
      tinyMCE.execCommand('mceRemoveControl', false, editor_id);
      $('#' + editor_id).focus();
  
      $("#tinymce-toolbar-placeholder", form).css('display', 'block');
      editorTextarea.css('visibility', 'visible').focus();
      $(".tinymce-ext-buttons", form).hide();
      $("#topic-content-select-wrapper", form).hide();
  
      if (editorTextarea.closest('.s-tme-with-attachments')) {
        // if the rich text has an associated attachment row, add a filler div for the HTML editor
        var attachmentRow = editorTextarea.siblings('.s-tme-attachment-row');
        if (!attachmentRow.length) {
          attachmentRow = $('<div/>').addClass('s-tme-attachment-row');
          attachmentRow.insertAfter(editorTextarea);
        }
        attachmentRow.show();
      }
  
      $(this).addClass('tinymce-toggle-active');
      $(this).siblings(".tinymce-visual-btn").removeClass('tinymce-toggle-active');
      sPopupsResizeCenter();
  
      // Prevent default action for keydown events
      if (e.type === 'keydown') {
        e.preventDefault();
      }
    }
  });

  visualToggleBtn.each(function() {
    var visualToggleButton = $(this);
    bindToggleActions(visualToggleButton, handleVisualToggleEvent);
  
    function handleVisualToggleEvent(e) {
      var editor_id = $(this).attr('editor_id');
      var form = $(this).parents('form');
  
      if (tinyMCE.activeEditor && tinyMCE.activeEditor.editorId == editor_id)
        return;
  
      var editorTextarea = $("textarea#" + editor_id, form);
  
      tinyMCE.execCommand('mceAddControl', true, editor_id);
  
      $("#tinymce-toolbar-placeholder", form).hide();
      editorTextarea.css('visibility', 'hidden');
      $(".tinymce-ext-buttons", form).show();
      $("#topic-content-select-wrapper", form).show();
  
      if (editorTextarea.closest('.s-tme-with-attachments')) {
        // if the rich text has an associated attachment row, add a filler div for the HTML editor
        editorTextarea.siblings('.s-tme-attachment-row').hide();
      }
  
      sTinymcePopup.updateEditorHeight();
  
      $(this).addClass('tinymce-toggle-active');
      $(this).siblings(".tinymce-html-btn").removeClass('tinymce-toggle-active');
      sPopupsResizeCenter();
  
      // Prevent default action for keydown events
      if (e.type === 'keydown') {
        e.preventDefault();
      }
    }
  });

  htmlToggleBtn.add(visualToggleBtn).tipsy({
    gravity: 's',
    title: function(){
      return $(this).attr('original-title');
    }
  });

  // bind to the custom content buttons
  $(".scontent-image-insert",context).each(function(){
    $(this)
      .unbind('click')
      .bind('click',function(){
        tinyMCE.activeEditor.execCommand('sContentImageInsert');
      });
  });

  $(".scontent-media-insert",context).each(function(){
    $(this)
      .unbind('click')
      .bind('click',function(){
      tinyMCE.activeEditor.execCommand('sContentMediaInsert');
    });
  });

  $(".scontent-formula-insert",context).each(function(){
    $(this)
      .unbind('click')
      .bind('click',function(){
      tinyMCE.activeEditor.execCommand('sContentFormulaInsert');
    });
  });

  $(".scontent-latex-insert",context).each(function(){
    $(this)
      .unbind('click')
      .bind('click',function(){
      tinyMCE.activeEditor.execCommand('sContentLatexInsert');
    });
  });

  // remove the loader
  $(".s-tinymce-loader",context).each(function(){
    $(this).remove();
  });

  /// for popups
  if($('#'+textFieldIds[0] , context ).parents('.popups-box').length > 0) {

    $(document).data('sTinymcePopupActiveEditors',textFieldIds.join(","));

    sTinymceInit({mode: 'none'});

    $(document).unbind('popups_open_path_done.s_tinymce').bind('popups_open_path_done.s_tinymce',function() {
      var active_editor_id = $(document).data('sTinymcePopupActiveEditors');
      if(!active_editor_id)
        return;

      var popup = Popups.activePopup();
      var tme_popup_parent = $('#'+active_editor_id).parents('.popups-box');

      // active editor is not in this popup
      if(popup && popup.id && popup.id != tme_popup_parent.attr('id')){
        return;
      }

      tinyMCE.onAddEditor.add(function(tmce, ed){
        if(ed.id == active_editor_id){
          ed.onInit.add(function(){
            sPopupsResizeCenter();
          });
        }
      });

      // make sure the in-page editor is disabled
      tinyMCE.execCommand('mceRemoveControl',false, 'edit-tme-textarea');

      // enable the active editor in the popup
      tinyMCE.execCommand('mceAddControl', false , active_editor_id );

      sTinymcePopup.initializeEditors(textFieldIds, context);
    });

    $(document).bind('popups_before_submit',function( event , formData, $form, options ){

      // get the active editor ids, match then with the name attributes
      // and then inject editor content into the formData array

      tinyMCE.triggerSave();

      var editor_ids = new Array();
      var editor_names = new Array();

      $.each( tinyMCE.editors , function( index , val ){
        editor_ids.push(val.editorId);
      });

      if(editor_ids.length==0)
        return;

      $('textarea',$form).each(function(){
        var txt_id = $(this).attr('id');
        if( $.inArray( txt_id , editor_ids ) != -1 ){
          var txt_name = $(this).attr('name');
          editor_names.push(txt_name);
        }
      });

      if(editor_names.length==0)
        return;

      // this is singleton but works for now
      // note that at this point all the nice tinyMCE 'get' functions don't work
      var editor_content = tinyMCE.activeEditor.getContent();

      $.each( formData , function( index , form_field ){
        if( $.inArray( form_field.name , editor_names ) != -1 )
          formData[ index ].value = editor_content;
      });

      var active_editor_id = $(document).data('sTinymcePopupActiveEditors');
      tinyMCE.execCommand('mceRemoveControl', true, active_editor_id );
    });


    $(document).bind('popups_form_success_notdone',function(e,p,d){
      // In this flow the popup has been destroyed and recreated, so we need to reintialize behaviors on editors within the popup
      sTinymcePopup.initializeEditors(textFieldIds, context);

      var active_editor_id = $(document).data('sTinymcePopupActiveEditors');
      if(!active_editor_id)
        return;

      tinyMCE.execCommand('mceAddControl', true , active_editor_id );


    });

    $(document).bind('popups_before_remove',function(event,popup,nextActivePopup) {
      // only destroy if active editor is in currently closing popup
      if( typeof popup =='object' && popup.id && typeof tinyMCE == 'object' && tinyMCE.activeEditor
           && tinyMCE.activeEditor.s_tinymce_popup == popup.id) {
        var editor_id = tinyMCE.activeEditor.editorId;
        tinyMCE.activeEditor.execCommand('sContentRemovePopups');
        tinyMCE.execCommand('mceFocus', false, editor_id );
        tinyMCE.execCommand('mceRemoveControl', false, editor_id );
        tinyMCE.activeEditor = undefined;
        $(document).data('sTinymcePopupActiveEditors',false);
        Drupal.settings.s_tinymce = {};
      }
    });

  } else {
    // in-page loading

    // remove existing text fields with the same ids.
    // this needs to happen when partial-page redraw happens (creating page breaks, deleting assessment components)
    // and another textfield with the same id gets include leaving the old ones dangling
    $.each(textFieldIds, function(k, id){
      var existing = tinyMCE.get(id);
      if(typeof existing == 'object'){
        tinyMCE.remove(existing);
      }
    });

    sTinymceInit( { elements: textFieldIds.join(",") } );
  }
}
//var oldVal = 0;
/*
 * Note that the oldVal declaration above is intentionally commented out
 * It is initiated to 0 in s_assessment_component_fitb.js.  The value needs
 * to be kept track of between Visual and HTML modes in the editor.
 */
// initialize the editor
var sTinymceInit = function(localOpts) {
  var altOpts = typeof Drupal.settings.s_tinymce_alt_opts != 'undefined' ? Drupal.settings.s_tinymce_alt_opts : {};
  var tme_lang = typeof Drupal.settings.s_tinymce != 'undefined' && typeof Drupal.settings.s_tinymce.language != 'undefined' ? Drupal.settings.s_tinymce.language : 'en';
  var toolbarStyle = 'full';
  const isRtl = $(document).attr('dir') === 'rtl';
  if(typeof altOpts.toolbar != 'undefined'){
    toolbarStyle = altOpts.toolbar;
  }
  else if(typeof localOpts.toolbar != 'undefined'){
    toolbarStyle = localOpts.toolbar;
  }
  if(typeof toolbarStyle == 'object'){
    toolbarStyle = toolbarStyle[0];
  }

  sTinymceOpts = {
    mode: 'exact',
    theme: 'advanced',
    language: tme_lang,
    cache_string: Drupal.settings.s_tinymce && Drupal.settings.s_tinymce.cache ? Drupal.settings.s_tinymce.cache : '',
    content_css: Drupal.settings.s_tinymce?.content_css || '',
    elements: '',
    file_upload_url: Drupal.settings.s_tinymce?.file_upload_url || '',
    relative_urls : false,
    remove_script_host : false,
    convert_urls: true,
    paste_retain_style_properties : "all",
    paste_remove_styles_if_webkit: false,
    sgy_domain: Drupal.settings.s_tinymce?.sgy_domain || '',
    setup: function(ed){
      ed.onInit.add(function(editor){
        $('.mceButton', '#' + editor.id + '_tbl').tipsy({
          gravity: 's',
          title: function(){
            return $(this).attr('original-title');
          }
        });

        var tinymce_popup_parent = $('#' + ed.editorId).parents('.popups-box');
        ed.s_tinymce_popup = tinymce_popup_parent.attr('id');

        // Fix TinyMCE keyboard trap in popups.
        // TinyMCE inserts hidden focus shim anchors that cause an infinite tab loop.
        // Remove only those shim anchors from the tab order; keep toolbar buttons tabbable.
        if (tinymce_popup_parent.length) {
          var $editorTable = $('#' + ed.editorId + '_tbl');

          // Shim anchor inside toolbar
          $editorTable.find('a[accesskey="z"]').attr('tabindex', '-1');

          // Shim anchor appended after editor container
          var $editorParent = $('#' + ed.editorId + '_parent');
          $editorParent.nextAll('a').each(function () {
            var $a = $(this);
            var text = $a.text().trim();

            if (
              $a.attr('href') === '#' &&
              !text &&
              !$a.attr('class') &&
              !$a.attr('role')
            ) {
              $a.attr('tabindex', '-1');
            }
          });
        }

        // Set TinyMce Directionality
        if(isRtl){
          tinyMCE.activeEditor.execCommand('mceDirectionRTL');
        }else{
          tinyMCE.activeEditor.execCommand('mceDirectionLTR');
        }

        var textareaId = editor.id;

        if (textareaId === 'edit-description') {
          var iframeId = textareaId + '_ifr';
          var $iframe = $('#' + iframeId);
          var $label = $('label[for="' + textareaId + '"]');

          if ($iframe.length && $label.length) {
            var labelId = $label.attr('id');

            if (!labelId) {
              labelId = textareaId + '-label';
              $label.attr('id', labelId);
            }

            $iframe.attr('aria-labelledby', labelId);
          }
        }

      });
    },

    // toolbars
    theme_advanced_layout_manager: "SimpleLayout",
    theme_advanced_buttons1: "",
    theme_advanced_buttons2: "",
    theme_advanced_buttons3: "",
    theme_advanced_toolbar_location : "top",
    theme_advanced_toolbar_align : "left",
    theme_advanced_statusbar_location: "bottom",
    theme_advanced_resizing: true,
    theme_advanced_resize_horizontal: false,

    // tinyMCE normally uses a cookie to remember the users' resized dimensions, which we do not want
    theme_advanced_resizing_use_cookie: false,

    // plugins
    plugins: "",

    apply_source_formatting: true,
    extended_valid_elements: 'label[id|class|style],span[id|class|style|cluetip],' +
      'object[classid|codebase|width|height|align],' +
      'param[name|value],' +
      'embed[quality|type|pluginspage|width|height|src|align],' +
      'iframe[src|width|height|name|align|scrolling|frameborder|style|allowfullscreen|aria-labelledby],' +
      'img[src|alt|width|height|style|id|name|formula|class|align|title|border|cluetip],' +
      // custom td entry so cells don't inherit the paddEmpty option, which puts &nbsp; inside empty cells when saving
      'td[id|class|style|title|lang|dir|onclick|ondblclick|onmousedown|onmouseup|onmouseover|onmousemove|onmouseout|onkeypress|onkeydown|onkeyup|abbr|axis|headers|scope|rowspan|colspan|align|char|charoff|valign|nowrap|bgcolor|width|height]',

    // for plugins that handle images,embeds,etc.
    media_strict: false,
    s_dropmenu_menus: {},

    //SGY-12656 - Workaround for bizarre pasting of text in Webkit browsers
    paste_postprocess: function(pl, o) {
      if (tinyMCE.isWebKit) {
        var lineHeightRegex = new RegExp('style="line-height: [0-9]*.[0-9]{10,}px;"', 'ig');
        o.node.innerHTML = o.content.replace(lineHeightRegex, '');
      }
    }
  };

  // SGY-12389 : If user is using IE10, enable browser spellcheck
  // SGY-10594 : Also, if the user is using an iDevice (iPad|iPhone)
  if (sTinyMceIsIE10() || tinymce.isIDevice){
    sTinymceOpts.browser_spellcheck = true;
  }

  let newInlineLinkPlugin = ',inlineLink';
  let newInlineLinkButton = ',inlineLinkButton';
  let accessibilityCheckerPlugin = ',accessibilityChecker';
  let accessibilityCheckerPluginButton = ',accessibilityCheckerButton';

  var promptBankPluginIsEnabled = (typeof Drupal.settings.s_tinymce != 'undefined' &&
    typeof Drupal.settings.s_tinymce.promptBankPluginIsEnabled != 'undefined') ?
    Drupal.settings.s_tinymce.promptBankPluginIsEnabled : false;

  let promptBankPlugin = '';
  let promptBankPluginButton = '';

  let showGeneratePassagePlugin = $('#s-discussion-create-form').length || $('#s-discussion-edit-discussion-form').length || $('#s-grade-item-add-form.course-material-type-assignment').length || $('#s-page-create-page-form').length;

  if (promptBankPluginIsEnabled && !!showGeneratePassagePlugin) {
    promptBankPlugin = ',promptBank';
    promptBankPluginButton = ',promptBankButton';
  }

  var fontSizes = false;
  switch(toolbarStyle){
    // used on updates, discussion posts
    case 'discussion':
      sTinymceOpts.theme_advanced_resizing_min_height = sTinymceOpts.min_height = 60;
      sTinymceOpts.theme_advanced_buttons1 = "bold,italic,underline,bullist,numlist,indent,outdent" +newInlineLinkButton + ",spellchecker,fontsizeselect,insert_content,removeformat" + accessibilityCheckerPluginButton;
      sTinymceOpts.plugins = "-s_dropmenu,-s_content,-s_image_hover,spellchecker,-paste,inlinepopups,-s_embedded_image_uploader" + newInlineLinkPlugin + accessibilityCheckerPlugin;
      fontSizes = [11, 12, 13, 14];
      sTinymceOpts.s_dropmenu_menus = {
        insert_content: {
          title: Drupal.t('Insert Content'),
          items: sTinymce.getDropMenu(',s_insert_symbol,s_insert_equation')
        }
      };

      if ($('body').hasClass('s-enable-mathml')) {
        sTinymceOpts.theme_advanced_buttons1 += ',tiny_mce_wiris_formulaEditor';
        sTinymceOpts.plugins += ',tiny_mce_wiris';
      }

      break;
    case 'basic_update':
      sTinymceOpts.theme_advanced_buttons1 = "bold,italic,underline,bullist,numlist,indent,outdent" + newInlineLinkButton + ",spellchecker,fontsizeselect,insert_content,removeformat" + accessibilityCheckerPluginButton;
      sTinymceOpts.plugins = "-s_dropmenu,-s_content,-s_image_hover,spellchecker,-paste,inlinepopups,-s_embedded_image_uploader" + newInlineLinkPlugin + accessibilityCheckerPlugin;
      fontSizes = [11, 12, 13, 14];
      sTinymceOpts.s_dropmenu_menus = {
        insert_content: {
          title: Drupal.t('Insert Content'),
          items: sTinymce.getDropMenu('s_insert_imagemedia,s_insert_symbol,s_insert_equation')
        }
      };
      break;
    case 'basic_comment':
      sTinymceOpts.theme_advanced_resizing_min_height = sTinymceOpts.min_height = 60;
      sTinymceOpts.theme_advanced_buttons1 = "bold,italic,underline,bullist,numlist,indent,outdent,spellchecker";
      sTinymceOpts.plugins = "spellchecker,paste,-s_embedded_image_uploader" + accessibilityCheckerPlugin;
      sTinymceOpts.theme_advanced_buttons1 = "bold,italic,underline,bullist,numlist,indent,outdent,spellchecker" + accessibilityCheckerPluginButton;
      break;

    // SGY-8174 basic folder description for rich-text enabled schools
    case 'basic_folder_description':
      sTinymceOpts.theme_advanced_buttons1 = "bold,italic,underline,bullist,numlist,forecolor,formatting,indent,outdent" + newInlineLinkButton + ",justifyleft,justifycenter,justifyright,insert_content,spellchecker" + accessibilityCheckerPluginButton;
      sTinymceOpts.plugins = "-s_dropmenu,-s_content,-s_image_hover,spellchecker,media,-paste,inlinepopups,-s_embedded_image_uploader" + newInlineLinkPlugin + accessibilityCheckerPlugin;
      sTinymceOpts.s_dropmenu_menus = {
        insert_content: {
          title: Drupal.t('Insert Content'),
          items: sTinymce.getDropMenu('s_insert_image,s_insert_symbol,s_insert_equation,s_insert_latex')
        },
        formatting: {
          title: Drupal.t('Formatting'),
          items: sTinymce.getDropMenu('strikethrough,sup,sub,separator,s_format_remove')
        }
      };

      // prevent tinymce advanced theme from leaving off space in the bottom for a status bar
      sTinymceOpts.theme_advanced_resizing = false;
      sTinymceOpts.theme_advanced_statusbar_location = '';
      break;

    default:
    case 'full':
      sTinymceOpts.plugins = "-s_dropmenu,-s_content,-s_image_hover,-s_cluetip,-s_table,spellchecker,media,-paste,table,inlinepopups,-s_embedded_image_uploader" + newInlineLinkPlugin + accessibilityCheckerPlugin + promptBankPlugin;
      sTinymceOpts.theme_advanced_buttons1 = "bold,italic,underline,bullist,numlist,forecolor,backcolor,formatting,indent,outdent" + newInlineLinkButton + ",justifyleft,justifycenter,justifyright,insert_content,s_table_button,spellchecker,formatselect,fontsizeselect" + accessibilityCheckerPluginButton + promptBankPluginButton;
      sTinymceOpts.theme_advanced_buttons2 = "s_table_border,row_before,row_after,delete_row,col_before,col_after,delete_col,merge_cells,split_cells,delete_table";
      sTinymceOpts.s_dropmenu_menus = {
        insert_content: {
          title: Drupal.t('Insert Content'),
          items: sTinymce.getDropMenu('s_insert_imagemedia,s_insert_symbol,s_insert_equation,s_insert_latex,s_cluetip_toggle_note')
        },
        formatting: {
          title: Drupal.t('Formatting'),
          items: sTinymce.getDropMenu('strikethrough,sup,sub,separator,s_format_remove')
        }
      };

      if ($('body').hasClass('s-enable-mathml')) {
        sTinymceOpts.theme_advanced_buttons1 += ',tiny_mce_wiris_formulaEditor';
        sTinymceOpts.plugins += ',tiny_mce_wiris';
      }

      break;
  }
  sTinymceOpts.plugins = sTinymceOpts.plugins + ',directionality';
  sTinymceOpts.theme_advanced_buttons1 = sTinymceOpts.theme_advanced_buttons1 + ',ltr,rtl';
  /*
   Include resource content menu items if allowed
   */
  var sContentInsertMenuItems = sCommonGetSetting('s_tinymce', 's_content_menu_items');
  if(sContentInsertMenuItems && (toolbarStyle == 'basic_folder_description' || toolbarStyle == 'full')) {
    sContentInsertMenuItems = sTinymceOpts.s_dropmenu_menus.insert_content.items.concat(sContentInsertMenuItems);
    sTinymceOpts.s_dropmenu_menus.insert_content.items = sContentInsertMenuItems;
    sTinymceOpts.s_dropmenu_menus.insert_content.isMegaDropdown = true;
  }

  // generate custom font size declaration
  sTinymceOpts.theme_advanced_font_sizes = {};
  if(fontSizes === false){
    fontSizes = [11, 12, 13, 14, 16, 18, 24];
  }
  $.each(fontSizes, function(k, size){
    sTinymceOpts.theme_advanced_font_sizes[size] = {
      fontSize: size + 'px'
    };
  });

  sTinymceOpts = $.extend({}, sTinymceOpts, localOpts, altOpts);

  tinyMCE.init(sTinymceOpts);
}

if(typeof sTinymce == 'undefined'){
  /**
   * Contains general utility methods to help deal with TinyMCE instances.
   */
  var sTinymce = (function(){
    var obj = {};

    var dropMenuItems = {
      s_insert_imagemedia: {
        id: 's_insert_imagemedia',
        title: Drupal.t('Image/Media'),
        cmd: 'sContentMediaInsert'
      },
      s_insert_image: {
        id: 's_insert_image',
        title: Drupal.t('Image'),
        cmd: 'sContentImageInsert'
      },
      s_insert_link: {
        id: 's_insert_link',
        title: Drupal.t('Link'),
        cmd: 'mceLink'
      },
      s_insert_symbol: {
        id: 's_insert_symbol',
        title: Drupal.t('Symbol'),
        cmd: 'mceCharMap'
      },
      s_insert_equation: {
        id: 's_insert_equation',
        title: Drupal.t('Equation'),
        cmd: 'sContentFormulaInsert'
      },
      s_insert_latex: {
        id: 's_insert_latex',
        title: Drupal.t('LaTeX'),
        cmd: 'sContentLatexInsert'
      },
      s_cluetip_toggle_note: {
        id: 's_cluetip_toggle_note',
        title: Drupal.t('Tooltip'),
        cmd: 'sCluetipToggleNote',
        disabled: true // disabled by default and enabled when highlighting texts and such
      },
      strikethrough: {
        id: 'strikethrough',
        title: Drupal.t('Strikethrough'),
        cmd: 'strikethrough'
      },
      sup: {
        id: 'sup',
        title: Drupal.t('Superscript'),
        cmd: 'superscript'
      },
      sub: {
        id: 'sub',
        title: Drupal.t('Subscript'),
        cmd: 'subscript'
      },
      separator: {
        type: 'separator'
      },
      s_format_remove: {
        id: 's_format_remove',
        title: Drupal.t('Clear Formatting'),
        cmd: 'removeformat'
      }
    };

    /**
     * Allow textareas to properly retrieve the rich text contents before a submit event
     *
     * @param object context
     */
    obj.updateRichtextContent = function(context){
      var editorId = tinyMCE && tinyMCE.activeEditor ? tinyMCE.activeEditor.editorId : null;
      if(editorId){
        var editorObj = $('#' + editorId, context);
        if(editorObj.length){
          // there is a rich text editor in the form, we need to pull its contents out before submitting
          var richTextContent = tinyMCE.get( tinyMCE.activeEditor.editorId ).getContent();
          editorObj.val(richTextContent);
        }
      }
    };

    /**
     * Parse the menu list config and return a list of menu item objects
     *
     * @param string menuListConfig  comma separated list of menu item ids
     */
    obj.getDropMenu = function(menuListConfig){
      var list = [];

      $.each(menuListConfig.split(','), function(i, id){
        if(typeof dropMenuItems[id] != 'undefined'){
          list.push(dropMenuItems[id]);
        }
      });

      return list;
    };

    /**
     * Get dom element in editor content body
     *
     * @param {string} jquerySelector
     * @returns {HTMLElement}
     */
    obj.findContentBody = function(jquerySelector) {
      var tinyMceBody = tinyMCE && tinyMCE.activeEditor && tinyMCE.activeEditor.getBody();
      if (!tinyMceBody) {
        return;
      }
      return $(jquerySelector, tinyMceBody);
    };

    /**
     * Prevent submission if any images are being actively uploaded
     * @param formContext
     */
    obj.cancelSubmitIfPendingImageUploads = function(formContext) {
      $('input[type=submit]:not(.sTinymce-img-pending-check-processed)', formContext).addClass('sTinymce-img-pending-check-processed').each(function() {
        const $el = $(this);
        $el.data('beforeSubmitHandler', function (e) {
          if (!e) {
            return;
          }

          const editor = tinyMCE?.activeEditor;
          if (!editor) {
            return;
          }

          const $activeUploads = $(editor.getDoc()).find('.sgy-pending');
          if ($activeUploads.length > 0) {
            e.preventDefault();
          }
        });
      });
    };

    return obj;
  }());
}

if(typeof sTinymcePopup == 'undefined'){
  /**
   * Contains utility methods to help deal with TinyMCE instances within a popup.
   */
  var sTinymcePopup = (function(){
    var obj = {};

    // defined heights for when toggling between different modes
    // this cannot be done in CSS because tinymce has to mathematically determine the size of iframes
    // depending on whether certain menus are showing
    obj.viewModeHeights = {
      'edit-description-wrapper':          { lite: 128, standard: 228 }, // assignment description
      'edit-post-wrapper':                 { lite: 128, standard: 228 }, // discussion description
      'edit-template-fields-body-wrapper': { lite: 128, standard: 228 } // resource assignment & discussion description
    };

    /**
     * Initializes behaviors on editors contained within the popup
     * @param {Array} textFieldIds An array of strings that are the ids of each RTE
     * @param {Element} context
     */
    obj.initializeEditors = function(textFieldIds, context) {
      //# Initialize the view mode toggle 'lite' | 'standard'
      var richTextView = sUserGetUISettings('rte', 'view_mode') == 'standard' ? 'standard' : 'lite';
      var supportViewModes = false;
      $.each(textFieldIds, function(k, textFieldId){
        var textField = $('#' + textFieldId, context);
        if(textField.hasClass('s-tinymce-view-modes')){
          supportViewModes = true;
          var toggleBtn = $('<span class="s-tinymce-toggle-view" />'),
              expandText = Drupal.t('Expand'),
              minimizeText = Drupal.t('Minimize');
          toggleBtn.appendTo(textField.parent());
          function toggleView() {
            const currentView = sTinymcePopup.getView();
            const newView = currentView === 'standard' ? 'lite' : 'standard';
            sTinymcePopup.setView(newView);
            const ariaLabel = newView === 'standard' ? minimizeText : expandText;
            toggleBtn.attr("aria-label", ariaLabel);
            toggleBtn.focus();
          }

          // Click event for mouse users
          toggleBtn.click(function() {
            toggleView();
          });

          // Keydown event for keyboard users
          toggleBtn.on("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleView();
            }
          });

          toggleBtn.tipsy({
            gravity: "s",
            title: function() {
              return sTinymcePopup.getView() == 'standard' ? minimizeText : expandText;
            }
          });
        }
      });

      // determine if the user should see the lite version of tinymce
      if(supportViewModes){
        sTinymcePopup.setView(richTextView, false);
      }
    }

    /**
     * Set the popup view to the specified mode.
     *
     * @param string mode  possible values: standard (default), lite
     * @param bool update_settings  whether to update the user's preference
     */
    obj.setView = function(mode, update_settings){
      var possibleValues = {standard: true, lite: true},
          popupContainer = this.getPopupContainer();
      if(popupContainer){
        $.each(possibleValues, function(m, setting){
          var className = 's-tinymce-view-' + m;
          if(mode == m){
            popupContainer.addClass(className);
          }
          else{
            popupContainer.removeClass(className);
          }
        });

        if(typeof update_settings == 'undefined' || update_settings){
          sUserSetUISettings('rte', 'view_mode', mode);
        }

        obj.updateEditorHeight(mode);

        sPopupsResizeCenter();
      }
    };

    /**
     * Get the current popup view mode
     *
     * @param string mode
     */
    obj.getView = function(){
      var mode = null,
          popupContainer = this.getPopupContainer();
      if(popupContainer){
        var match = /s-tinymce-view-([^\s]+)/.exec(popupContainer.attr('class'));
        if(match.length > 1){
          mode = match[1];
        }
      }

      return mode;
    };

    /**
     * Update the editor height with a preset value when the view mode changes.
     *
     * @param string mode  possible values: standard (default), lite
     */
    obj.updateEditorHeight = function(mode){
      var ed = tinyMCE.activeEditor;
      if(ed){
        if(typeof mode == 'undefined'){
          mode = obj.getCurrentViewMode();
        }
        var formItemId = $(ed.contentAreaContainer).closest('.form-item').attr('id'),
            newHeight = null;
        if(typeof obj.viewModeHeights[formItemId] == 'object' && typeof obj.viewModeHeights[formItemId][mode] != 'undefined'){
          ed.theme.resizeTo(null, obj.viewModeHeights[formItemId][mode]);
        }
      }
    };

    /**
     * Get the popup of the current container.
     *
     * @return object  the jquery object of the popup element.
     */
    obj.getPopupContainer = function(){
      var active_editor_id = $(document).data('sTinymcePopupActiveEditors'),
          ret = null;
      if(active_editor_id) {
        var popup = Popups.activePopup();
        ret = $('#'+active_editor_id).parents('.popups-box');
      }

      return ret;
    };

    /**
     * Get the view mode of the current popup container
     *
     * @return string
     */
    obj.getCurrentViewMode = function(){
      // if the mode is not provided, get the current mode
      var popupContainer = this.getPopupContainer(),
          matches = null,
          mode = null;
      if(popupContainer){
        matches = /s-tinymce-view-(\w+)/.exec(popupContainer.attr('class'));
        if(matches){
          mode = matches[1];
        }
      }

      return mode;
    };

    return obj;
  }());
}

/**
 * Binds click and keydown events to a toggle button and associates them with a toggle function.
 *
 * @param {jQuery} toggleButton - The jQuery object representing the toggle button.
 * @param {Function} toggleFunction - The function to be called when the toggle button is clicked or activated via keyboard.
 */
function bindToggleActions(toggleButton, toggleFunction) {
  toggleButton.unbind('click keydown');

  toggleButton.bind('click', function(e) {
    toggleFunction.call(this, e);
  });

  toggleButton.bind('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      toggleFunction.call(this, e);
    }
  });
}
