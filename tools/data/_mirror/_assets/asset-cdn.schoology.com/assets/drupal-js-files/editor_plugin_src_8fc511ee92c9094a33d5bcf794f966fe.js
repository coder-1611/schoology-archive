/**
 * $Id: editor_plugin_src.js 001 2010-07-01 $
 *
 * @author Schoology, Inc.
 * @copyright Copyright 2010, Schoology, Inc., All rights reserved.
 */

(function() {

  var Event = tinymce.dom.Event;
  var _enabledImage = false;

  tinymce.create('tinymce.plugins.SImageHoverPlugin', {

    init : function(ed, url) {

      var t = this;

      ed.onInit.add(function(ed){
    	  t._createBtns();

    	  Event.add(ed.getWin(), 'scroll', function(e){
		    if(!tinyMCE.activeEditor){
              Event.remove(ed, 'scroll');
              return true;
            }

            tinyMCE.activeEditor.execCommand('sImageHover_removeModBtns',false,false,{skip_focus: true});
    	  });
      });

      ed.addCommand('sImageHover_removeModBtns' , this._removeBtns, this);
      ed.addCommand('sImageHover_positionModBtns' , this._positionBtns, this);
      ed.addCommand('sImageHover_getEnabledImage' , this._getEnabledImage , this);
      ed.addCommand('sImageHover_setEnabledImage' , this._setEnabledImage , this);

      $('body').bind('mousedown',function(e){
        if(typeof tinyMCE == 'undefined' || typeof tinyMCE.activeEditor == 'undefined'){
          $(this).unbind(e);
          return true;
        }

        var targetObj = $(e.target);
        var targetId = String(targetObj.attr('id'));
        if( targetId == 'undefined' )
          targetId = targetObj.parent().attr('id');
        if( targetId == 'undefined' || targetId == 'tme_imgModBtn' || targetId == 'tme_imgDelBtn' )
          return;
        tinyMCE.activeEditor.execCommand('sImageHover_removeModBtns',false,false,{skip_focus: true});
      });

      ed.onRemove.add(function(ed){
        // the following would be nice, but causes mac safari to crash
        //ed.execCommand('sImageHover_removeModBtns');
        $('#tme_imgModEnabled').attr('id','');
        $('#tme_modBtnContainer').hide();
      });

      ed.onClick.add( function(ed,e){
        var enabledImage = tinyMCE.activeEditor.execCommand('sImageHover_getEnabledImage');
        if(typeof enabledImage == 'undefined' || (enabledImage!=false && $(e.target)[0] == enabledImage[0]))
          return;
        tinyMCE.activeEditor.execCommand('sImageHover_removeModBtns');
      });

      ed.onMouseUp.add(function(ed,e) {
          if( e.target.nodeName == 'IMG'){
            var img = $(e.target);
            var img_class = String(img.attr('class'));
            var imgSpan = $("span",$("#tme_imgModBtn"));

            var hover_type = img_class.match(/^.*(mceItemQuickTime|mceItemMedia|mceItemFlash|mceItemWindowsMedia|mceItemRealMedia).*$/gi) ? "media" : false;

            // latex formula png?
            if(!hover_type)
              hover_type = img_class.match(/^.*latex-formula.*$/gi) ? "latex-formula" : false;

            if(!hover_type)
              hover_type = img_class.match(/^.*mathquill-formula.*$/gi) ? 'mathquill-formula': false;

            switch( hover_type ){
              case 'media':
                imgSpan.css('background-image',"url(/sites/all/libraries/tinymce/jscripts/tiny_mce/themes/advanced/img/icons.gif)");
                imgSpan.css({'background-position':'-323px -24px','background-repeat':'no-repeat'});
                imgSpan.data('mceMethod','mceMedia');
              break;

              case 'tt-formula':
                imgSpan.css('background-image',"url(/sites/all/themes/schoology_theme/images/math-icon.png)");
                imgSpan.css({'background-position':'1px 1px','background-repeat':'no-repeat'});
                imgSpan.data('mceMethod','sContentFormulaInsert');
                imgSpan.data('mceParams', img );
              break;

              case 'latex-formula':
                imgSpan.css('background-image',"url(/sites/all/themes/schoology_theme/images/math-icon.png)");
                imgSpan.css({'background-position':'-1px -16px','background-repeat':'no-repeat'});
                imgSpan.data('mceMethod','sContentLatexInsert');
                imgSpan.data('mceParams', img );
              break;

              case 'mathquill-formula':
                imgSpan.css('background-image',"url(/sites/all/themes/schoology_theme/images/math-icon.png)");
                imgSpan.css({'background-position':'1px 1px','background-repeat':'no-repeat'});
                imgSpan.data('mceMethod','sContentFormulaInsert');
                imgSpan.data('mceParams', img );
                break;

              default:
                imgSpan.css('background-image',"url(/sites/all/libraries/tinymce/jscripts/tiny_mce/themes/advanced/img/icons.gif)");
                imgSpan.css({'background-position':'-384px -4px','background-repeat':'no-repeat'});
                imgSpan.data('mceMethod','mceImage');
              break;
            }

            ed.execCommand('sImageHover_setEnabledImage',e.target);
            ed.execCommand('sImageHover_positionModBtns');
          }
        });
    },

    _getEnabledImage: function(){
      return this._enabledImage;
    },

    _setEnabledImage: function(img){
      this._enabledImage = $(img);
      this._enabledImage.attr('id','tme_imgModEnabled');
    },

    _createBtns: function(){
      if ($('#tme_modBtnContainer').length) return;

      var modBtnContainer = $("<div></div>");
      modBtnContainer.attr('id','tme_modBtnContainer');

      var modBtn = $("<span></span>");
      modBtn.attr('id','tme_imgModBtn');
      modBtn.append($("<span></span>"));

      modBtn.bind('click',function(){
        var ed = tinyMCE.activeEditor;
        // otherwise the click deselects the image in ie
        if(jQuery.browser.msie) ed.selection.select(ed.dom.select('img#tme_imgModEnabled')[0]);
        var img = $("span",$(this));
        ed.execCommand('sImageHover_removeModBtns');
        ed.execCommand( img.data('mceMethod') , img.data("mceParams") );
      });

      var delBtn = $("<span></span>");
      delBtn.attr('id','tme_imgDelBtn');
      delBtn.append($("<span></span>"));

      delBtn.bind('click',function(){
        tinyMCE.activeEditor.execCommand('sImageHover_removeModBtns',true);
      });

      modBtnContainer.append(modBtn);
      modBtnContainer.append(delBtn);
      modBtnContainer.css('display','none');

      $('body').append(modBtnContainer);

      // for safari
      modBtnContainer.hide();
    },

    _removeBtns: function(delImage){
      if(typeof delImage != 'boolean') delImage = false;
      $(this._enabledImage).attr('id','');

      if(delImage) {
        tinyMCE.activeEditor.dom.remove(this._enabledImage);
        // would be nice but webkit no bueno
        //tinyMCE.activeEditor.execCommand('mceCleanup');
        tinyMCE.activeEditor.execCommand('sContentSaveLastNode');
      }

      if(tinyMCE.activeEditor==null) return;
      $('#tme_modBtnContainer').hide();

      this._enabledImage = false;
    },

    _positionBtns: function(showBtns){
      if( this._enabledImage == false ) return;
      if(typeof showBtns != 'boolean') showBtns = true;
      var iPos = $(this._enabledImage).position();
      var ifr = $('iframe',$(tinyMCE.activeEditor.contentAreaContainer));
      var ifPos = ifr.offset();

      var scrollOffset = tinyMCE.activeEditor.contentWindow.pageYOffset;

      if( typeof scrollOffset == 'undefined' ){
    	  scrollOffset = tinymce.DOM.getViewPort(tinymce.activeEditor.getWin()).y;
      }

      var mbc_top  = ifPos.top+iPos.top+5-scrollOffset;
      if( ifPos.top > mbc_top ) mbc_top = ifPos.top + 10;

      var mbc = $('#tme_modBtnContainer');
      mbc.css('left',String(ifPos.left+iPos.left+5)+"px");
      mbc.css('top',String(mbc_top)+"px");

      if( showBtns ) mbc.show();
    },

    getInfo : function() {
      return {
        longname : 'S_Image_Hover',
        author : 'Schoology, Inc.',
        authorurl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        infourl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        version : tinymce.majorVersion + "." + tinymce.minorVersion
      };
    }
  });

  // Register plugin
  tinymce.PluginManager.add('s_image_hover', tinymce.plugins.SImageHoverPlugin );
})();
