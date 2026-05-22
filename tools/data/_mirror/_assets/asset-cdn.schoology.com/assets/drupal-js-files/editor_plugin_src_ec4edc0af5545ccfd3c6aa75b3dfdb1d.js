/*
 *
 * Table Dropdown Plugin for TinyMCE
 *
 * Copyright 2011 Cory LaViska for A Beautiful Site, LLC. — www.abeautifulsite.net
 *
 * Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
 *
 * Modified to include table creation widget.
 *
 */
(function() {
  var menuObjCache = {};

  function openTablePicker(createTableMenu){
    var menuObj = null,
        minRows = 4,
        minCols = 4,
        maxRows = 15,
        maxCols = 10,
        cellWidth = 25,
        cellHeight = 17;
    if(typeof menuObjCache[createTableMenu.id] == 'object' && menuObjCache[createTableMenu.id].closest('body').length){
      // the menu object has already been created and is still in the DOM
      menuObj = menuObjCache[createTableMenu.id];
    }
    else{
      menuObj = menuObjCache[createTableMenu.id] = $('#menu_' + createTableMenu.id + '_co');
    }
    if(!menuObj.children('.table-picker-wrapper').length){
      var tablePicker = '<div class="table-picker-wrapper">'
                        + '<div class="table-picker-cells">'
                          + '<div class="picker table-picker-selected-cell"></div>'
                        + '</div>'
                        + '<p class="table-picker-desc"></p>'
                      + '</div>';
      menuObj.append(tablePicker);
      var selectedCell = menuObj.find('.table-picker-selected-cell'),
          cellGrid = menuObj.find('.table-picker-cells');

      menuObj.resetSelection = function(){
        menuObj.updateSelection(1, 1);
      };

      const isRtl = $(document).attr('dir') === 'rtl';

      if (isRtl) {
        menuObj.getColsRows = function(mouseX, mouseY){
          var offset = cellGrid.offset(),
            x = offset.left + cellGrid.width() - mouseX, // calculate from the right
            y = mouseY - offset.top,
            numCols = Math.min(Math.max(Math.ceil(x / cellWidth), 1), maxCols),
            numRows = Math.min(Math.max(Math.ceil(y / cellHeight), 1), maxRows);
          return [numCols, numRows];
        };
      } else {
        menuObj.getColsRows = function(mouseX, mouseY){
          var offset = cellGrid.offset(),
            x = mouseX - offset.left,
            y = mouseY - offset.top,
            numCols = Math.min(Math.max(Math.ceil(x / cellWidth), 1), maxCols),
            numRows = Math.min(Math.max(Math.ceil(y / cellHeight), 1), maxRows);
          return [numCols, numRows];
        };

      }

      menuObj.updateSelection = function(numCols, numRows){
        var gridCols = Math.max(numCols, minCols),
            gridRows = Math.max(numRows, minRows);

        if (isRtl) {
          selectedCell.css({
            width: numCols * cellWidth + 1,
            height: numRows * cellHeight + 1,
            direction: 'rtl'
          });

          cellGrid.css({
            width: gridCols * cellWidth + 1,
            height: gridRows * cellHeight + 1,
            direction: 'rtl'
          });

          menuObj.css({
            left: 'auto',
          });
        } else {
          selectedCell.css({
            width: numCols * cellWidth + 1,
            height: numRows * cellHeight + 1
          });

          cellGrid.css({
            width: gridCols * cellWidth + 1,
            height: gridRows * cellHeight + 1
          });
        }

        menuObj.find('.table-picker-desc').text(numCols + ' x ' + numRows);
      };

      cellGrid.bind('mousemove.tablepicker', function(e){
        e.stopPropagation();
        var colsRows = menuObj.getColsRows(e.pageX, e.pageY);
        menuObj.updateSelection(colsRows[0], colsRows[1]);
      }).bind('mouseleave.tablepicker', function(e){
        $('body').bind('mousemove.tablepicker', function(e2){
          if(menuObj.is(':visible')){
            var colsRows = menuObj.getColsRows(e2.pageX, e2.pageY);
            menuObj.updateSelection(colsRows[0], colsRows[1]);
          }
        });
      }).bind('mouseenter.tablepicker', function(e){
        $('body').unbind('mousemove.tablepicker');
      }).bind('click.tablepicker', function(e){
        var colsRows = menuObj.getColsRows(e.pageX, e.pageY),
            i = 0,
            html = '<table class="s_table s_table_border">';
        for(i = 0; i < colsRows[1]; i++){
          html += '<tr>';
          for(j = 0; j < colsRows[0]; j++){
            html += '<td><br/></td>';
          }
          html += '</tr>';
        }
        html += '</table>';
        tinyMCE.activeEditor.execCommand('mceInsertContent', false, html);
        createTableMenu.hideMenu();
      });
    }

    if(typeof menuObj.resetSelection == 'function'){
      menuObj.resetSelection();
    }
  }

	tinymce.create('tinymce.plugins.STablePlugin', {
    init: function(ed, url){
      var t = this,
          createTableMenu = null,
          createTableButton = null,
          editTableToolbarMenu = null;

      ed.addCommand('mceTablePicker', function(){
        if(createTableButton){
          const isRtl = $(document).attr('dir') === 'rtl';
          var cm = tinyMCE.activeEditor.controlManager;
              button = $('#' + createTableButton.id),
              offset = button.offset(),
              y = offset.top + button.height();
          if (isRtl) {
            var x = offset.left + 120;
          } else {
            var x = offset.left;
          }
          if(createTableMenu.isMenuVisible){
            createTableMenu.hideMenu();
          }
          else{
            createTableMenu.showMenu(x, y);
            openTablePicker(createTableMenu);
          }
        }
      });

      // toggle border by toggling the s_table_border class on the table
      ed.addCommand('mceToggleTableBorder', this.toggleTableBorder, this);

      ed.onInit.add(function(){
        var cm = ed.controlManager;
        createTableButton = cm.get(cm.prefix + 's_table_button');
        createTableMenu = cm.createDropMenu('createtable');
        createTableMenu.onHideMenu.add(function(){
          $('body').unbind('mousemove.tablepicker');
          tinyMCE.dom.Event.unbind(tinyMCE.DOM.doc, 'mousedown');
        });
        createTableMenu.onShowMenu.add(function(){
          tinyMCE.dom.Event.bind(tinyMCE.DOM.doc, 'mousedown', function(e){
            // close when clicking anywhere but the button and the menu
            if(!$(e.target).closest('#' + createTableButton.id + ', #menu_' + createTableMenu.id).length){
              createTableMenu.hideMenu();
            }
          });
        });

        editTableToolbarMenu = $('#' + ed.editorId + '_delete_table').closest('.mceToolbar');
        if(editTableToolbarMenu){
          t.isVisible = false;
          t._resizeIframe(ed, 31);
          sPopupsResizeCenter();
        }
      });

      ed.onNodeChange.add(function(ed, cm, n, co, o) {
        var tableNode = ed.dom.getParent(ed.selection.getStart(), 'table');

        if(createTableButton){
          createTableButton.setActive(tableNode);
        }
        if(editTableToolbarMenu){
          // decide whether or not to show the edit table context menu
          if(tableNode){
            if(!t.isVisible){
              t.isVisible = true;
              editTableToolbarMenu.show();
              t._resizeIframe(ed, -31);
            }
          }
          else{
            if(t.isVisible){
              t.isVisible = false;
              editTableToolbarMenu.hide();
              t._resizeIframe(ed, 31);
            }
          }
        }

        // check if the table has class s_table_border to determine if the button should be active
        if(c = cm.get('s_table_border')){
          var tableObj = $(tableNode);
          c.setActive(tableObj.hasClass('s_table_border'));
          c.setDisabled(!tableNode);
        }
      });

      ed.onClick.add(function(){
        if(createTableMenu){
          createTableMenu.hideMenu();
        }
      });

      t.isVisible = false;
    },

    toggleTableBorder: function(){
      var ed = tinymce.activeEditor,
          tableObj = $(ed.dom.getParent(ed.selection.getStart(), 'table'));
      tableObj.toggleClass('s_table_border');
    },

    createControl: function(n, cm) {
      switch( n ) {
        case 's_table_button':
          var createTableButton = cm.createButton(n, {
            title : Drupal.settings.table_desc,
            'class': 'mce_table',
            onclick: function() {
              tinymce.activeEditor.execCommand('mceTablePicker');
            }
          });

          return createTableButton;

        case 's_table_border':
          var tableBorderButton = cm.createButton(n, {
            title : Drupal.t('Border'),
            'class': 'mce_table_border',
            cmd: 'mceToggleTableBorder'
          });

          return tableBorderButton;
      }

      return null;

    },

    /**
     * Taken from PDW plugin's PDW toggle mechanism
     *
     * @param object ed
     * @param int diff
     */
    _resizeIframe: function(ed, diff){
      var frameObj = $(ed.getContentAreaContainer().firstChild);
      frameObj.height(frameObj.height() + diff);

      ed.theme.deltaHeight += diff;
    }
  });

	// Register plugin
	tinymce.PluginManager.add('s_table', tinymce.plugins.STablePlugin);

})();
