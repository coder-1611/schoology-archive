/**
 * @note
 * Workarounds:
 * - An issue with the click handler not firing in IE. Used mousedown instead.
 *   There was most likely another click event registered in tinyMCE that was taking precedence and causing the popup to close
 *   before our custom event fired.
 * - Using Firefox (tried in 16.0.x) in multiple choice rich text popup for choices:
 *   A removeClass call or a css call to alter 'display' on the popupObj in showPopup() was causing the selection from being deselected.
 *   A nodeChange event will fire soon after from mceToggleFormat, which will then hide the popup since the selection is no longer
 *   on the annotated text. Workaround by using an incredibly negative top offset (S_CLUETIP_HIDDEN).
 */
(function() {
  var highlightClass = 's_cluetip_highlight';
  var highlightSelector = '.' + highlightClass;
  var highlightTmpClass = highlightClass + '_tmp';
  var highlightTmpSelector = '.' + highlightTmpClass;
  var lastNode = null;

  var S_CLUETIP_HIDDEN = '-10000px';

  function popupIsShowing(){
    var ed = tinymce.activeEditor,
        editorContainerObj = $('#' + ed.editorContainer),
        popupObj = $('.add-note-popup', editorContainerObj);
    return (popupObj.css('top') != S_CLUETIP_HIDDEN);
  }

  /**
   * Adjust the popup position to the elements
   *
   * The popup box will stay within the boundary on the left and right side.
   */
  function repositionPopup(elementObjs){
    var newY = 0,
        newX,
        newXLeft = null,
        newXRight = null,
        xAnchor = null,
        ed = tinymce.activeEditor,
        editorContainerObj = $('#' + ed.editorContainer),
        contentContainerObj = $(ed.contentAreaContainer),
        menuHeight = contentContainerObj.offset().top - editorContainerObj.offset().top,
        popupObj = $('.add-note-popup', editorContainerObj),
        arrowObj = $('.arrow-n', popupObj),
        popupWidth = popupObj.outerWidth(),
        popupHeight = popupObj.outerHeight(),
        boundaryPadding = 5;

    elementObjs.each(function(i, el){
      var elementObj = $(el);
      var offset = elementObj.offset();
      if(!newXLeft || offset.left < newXLeft){
        newXLeft = offset.left;
      }
      if(!newXRight || (offset.left + elementObj.outerWidth()) > newXRight){
        newXRight = offset.left + elementObj.outerWidth();
      }
      if(offset.top + elementObj.outerHeight() > newY){
        newY = offset.top + elementObj.outerHeight();
      }
    });

    xAnchor = (newXLeft + newXRight) / 2;
    newX = xAnchor - (popupWidth / 2);
    if(newX < 0){
      // going out of boundary to the left
      newX = boundaryPadding;
      arrowObj.css('margin-left', (xAnchor - (arrowObj.innerWidth() / 2) - boundaryPadding) + 'px');
    }
    else if(newX + popupWidth > contentContainerObj.outerWidth()){
      // going out of boundary to the right
      newX = contentContainerObj.outerWidth() - popupWidth - boundaryPadding;
      arrowObj.css('margin-left', (xAnchor - newX - (arrowObj.innerWidth() / 2)) + 'px');
    }
    else {
      arrowObj.css('margin-left', '47%');
    }
    // the offset cannot be higher than the viewport (an image that extends below the viewport)
    var maxY = editorContainerObj.height() - popupHeight - arrowObj.outerHeight();
    newY = Math.min(newY - $(ed.contentDocument).scrollTop() + menuHeight, maxY);

    popupObj.css({
      left: newX + 'px',
      top: newY + 'px'
    });
  }

  /**
   * Shows the "add note" popup below the specified element
   */
  function showPopup(elementObjs){
    var ed = tinymce.activeEditor,
        editorContainerObj = $('#' + ed.editorContainer),
        popupObj = $('.add-note-popup', editorContainerObj);

    var default_value = elementObjs.attr('cluetip');
    if(Base64.is_encoded(default_value)){
      default_value = Base64.decode(default_value);
    }
    $('.cluetip_text', popupObj).val(default_value);

    // issue in IE where the click event wasn't triggering.
    $('.check-mark-icon', popupObj).unbind('mousedown').bind('mousedown', function(e){
      e.stopPropagation();
      var newNoteText = $('.cluetip_text', popupObj).val();
      if(newNoteText.length > 0){
        newNoteText = Base64.encode(newNoteText);
        elementObjs.each(function(i, el){
          $(el).attr('cluetip', newNoteText).removeClass(highlightTmpClass);
        });
      }
      lastNode = null;
      hidePopup();
    });

    if(default_value && default_value.length > 0){
      $('.delete-icon', popupObj).unbind('mousedown').bind('mousedown', function(e){
        e.stopPropagation();
        unHighlightElements(elementObjs);
        lastNode = null;
        hidePopup();
      }).show();
    }
    else{
      $('.delete-icon', popupObj).unbind('mousedown').hide();
    }

    repositionPopup(elementObjs);
  }

  function unHighlightElements(elements){
    var formatter = tinymce.activeEditor.formatter;
    elements.each(function(i, el){
      // the tinymce formatter can get screwy and apply the format to a descendent because of element boundaries
      // we need to check if there is a descendent that's also highlighted to avoid having it removed from the DOM via the replaceWith
      var elObj = $(el),
          childrenObj = elObj.children(),
          childHighlights = elObj.find(highlightTmpSelector);
      if(childrenObj.length && !childHighlights.length){
        elObj.replaceWith(elObj.html());
      }
      else{
        formatter.toggle('highlight', null, elObj.get(0));
      }
    });
  }

  /**
   * Hides the "add note" popup and reset the text.
   */
  function hidePopup(){
    var ed = tinymce.activeEditor,
        popupObj = $('.add-note-popup', $('#' + ed.editorContainer));

    popupObj.css('top', S_CLUETIP_HIDDEN);
    popupObj.find('.cluetip_text').val('');

    // unhighlight any untagged notes (the user highlighted something but didn't fill it out)
    unHighlightElements($(highlightTmpSelector, $(ed.contentDocument)));
  }

  /**
   * Save the contents of the annotation.
   */
  function saveOpenedPopup(){
    var ed = tinymce.activeEditor,
        popupObj = $('.add-note-popup', $('#' + ed.editorContainer)),
        cluetipText = popupObj.find('.cluetip_text').val();
    if(cluetipText && cluetipText.length > 0){
      $('.check-mark-icon', popupObj).trigger('mousedown');
    }
  }

  tinymce.create('tinymce.plugins.SCluetipPlugin', {
    init : function(ed, url) {
      ed.addCommand('sCluetipToggleNote', this._toggleNote);

      ed.onNodeChange.add(this._nodeChanged, this);

      ed.onBeforeGetContent.add(this._beforeGetContent, this);

      ed.onInit.add(function(ed){
        ed.formatter.register({
          highlight: {
            inline: 'span',
            classes: [highlightClass, highlightTmpClass],
            attributes: {'cluetip': ''},
            onmatch: function(node, format, item_name){
              // the default matchItems() check will fail because the value of cluetip being an empty string
              // fails the !value part of the if(similar && !value && !format.exact) conditional
              var nodeObj = $(node);
              return (nodeObj.hasClass(highlightClass) && nodeObj.hasClass(highlightTmpClass));
            }
          }
        });

        var editorContainerObj = $('#' + ed.editorContainer);
        var popupBox = $('<div></div>').css('position', 'absolute').addClass('add-note-popup').prependTo(editorContainerObj);
        $('<div></div>').addClass('arrow-n').appendTo(popupBox);
        var popupContent = $('<div></div>').addClass('add-note-popup-content').appendTo(popupBox);
        $('<input type="text"/>').addClass('cluetip_text').appendTo(popupContent);
        $('<span></span>').addClass('inline-icon mini check-mark-icon').appendTo(popupContent);
        $('<span></span>').addClass('inline-icon mini delete-icon').appendTo(popupContent);

        var popupParent = editorContainerObj.closest('.popups-box');
        if(popupParent.length > 0){
          popupParent.addClass('allow-overflow');
        }

        hidePopup();
      });
    },

    /**
     * Remove the annotation when the caret is in a highlighted node. Otherwise, add the annotation using the tinymce formatter
     */
    _toggleNote: function() {
      var ed = tinymce.activeEditor,
          nodeObj = $(ed.selection.getNode()),
          parentHighlighted = nodeObj.parents(highlightSelector),
          highlightedElements = null;

      if(nodeObj.hasClass(highlightClass)){
        // unhighlight selected element
        unHighlightElements(nodeObj);
      }
      else if(parentHighlighted.length > 0){
        // unhighlight the highlighted parent element
        parentHighlighted.eq(-1);
        unHighlightElements(parentHighlighted);
      }
      else{
        // apply the highlighting
        ed.execCommand('mceToggleFormat', false, 'highlight');
        if(!nodeObj.is(':visible')){
          // mceToggleFormat removed our previously selected node from the DOM, so we need to reselect the new selection
          nodeObj = $(ed.selection.getNode());
        }
        highlightedElements = nodeObj.find(highlightTmpSelector);
        if(!highlightedElements.length){
          highlightedElements = nodeObj.addClass(highlightTmpClass).addClass(highlightClass);
        }
        showPopup(highlightedElements);
      }
    },

    _nodeChanged: function(ed, cm, n, co, ob) {
      var nodeObj = $(n);
      var nodeHighlighted = nodeObj.hasClass(highlightClass);
      var parentHighlighted = nodeObj.parents(highlightSelector);
      var isHighlighted = nodeHighlighted || parentHighlighted.length > 0;

      if(c = cm.get('s_cluetip_toggle_note')){
        // disable the button if it's not a highlighted and the selection is collapsed
        c.setDisabled(!isHighlighted && co);
        c.setActive(isHighlighted);
      }

      if(isHighlighted){
        // show the popup for the highlighted elemented
        var highlightedElements = nodeHighlighted ? nodeObj : parentHighlighted;
        if(lastNode != n){
          saveOpenedPopup();
          showPopup(highlightedElements);
        }
      }
      else{
        if(popupIsShowing()){
          saveOpenedPopup();
          hidePopup();
        }
      }
      lastNode = n;
    },

    /**
     * Clean up any empty annotations before getting the content to be saved.
     */
    _beforeGetContent: function(ed){
      var popupObj = $('.add-note-popup', $('#' + ed.editorContainer));
      if(popupObj.length > 0 && popupIsShowing()){
        saveOpenedPopup();
        hidePopup();
      }
    },

    getInfo : function() {
      return {
        longname : 'S_Cluetip',
        author : 'Schoology, Inc.',
        authorurl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        infourl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        version : tinymce.majorVersion + "." + tinymce.minorVersion
      };
    }
  });

  // Register plugin
  tinymce.PluginManager.add('s_cluetip', tinymce.plugins.SCluetipPlugin);
})();