/**
 * $Id: editor_plugin_src.js 001 2010-10-12 $
 *
 * @author Schoology, Inc.
 * @copyright Copyright 2010, Schoology, Inc., All rights reserved.
 */

(function() {
  var Event = tinymce.dom.Event;
  var LATEX_SERVICE_ENDPOINT = '/svc/latex/latex-to-svg?latex=';

  tinymce.create('tinymce.plugins.SContentPlugin', {

    init : function(ed, url) {
      var t = this;

      ed.addCommand('sContentMediaInsert', function(){
        t._mediaInsert();
      });
      ed.addCommand('sContentImageInsert', function(){
        t._mediaInsert({type: 'image'});
      });
      ed.addCommand('sContentFormulaInsert', this._formulaInsert);
      ed.addCommand('sContentLatexInsert', this._latexInsert);
      ed.addCommand('sContentInsert', this._insertContent);
      ed.addCommand('sContentSaveLastNode', this._saveLastNode);
      ed.addCommand('sContentToggleSubmitBtns', this._toggleSubmitButtons);
      ed.addCommand('sContentGetRealmFromUrl', this._getRealmFromUrl);
      ed.addCommand('sContentSetWmodeOpaque', this._setWmodeOpaque);
      ed.addCommand('sContentResourcesInsert', this._insertResourceContent);
      ed.addCommand('sContentResourcesInsertPopup', this._insertResourcesContentPopup);
      ed.addCommand('sContentRemovePopups', this._removePopups);
      ed.addCommand('sContentLatexImgTag', this._latexImgTag);

      // constant bookmarking
      ed.onEvent.add(function(ed,e){
          if( e.type == 'submit' )
            return;
          tinyMCE.activeEditor.execCommand('sContentSaveLastNode');
        });

      // Register buttons
      ed.addButton('sContentFormula', {
        title : Drupal.t('Equation'),
        cmd : 'sContentFormulaInsert'
      });

      ed.addButton('sContentImage', {
        title : Drupal.t('Image/Media'),
        cmd : 'sContentMediaInsert'
      });
    },

    createControl: function(n, cm){
      // button that doesn't get disabled when not selecting a link
      // can be used to insert new links
      if(n == 's_link'){
        return cm.createButton('s_link', {
          title: 'advlink.link_desc',
          cmd: 'mceLink'
        });
      }
    },

    /**
     * Generates the Latex image tag
     *
     * @param {string} latex
     * @param {string} imgClass
     * @returns {string}
     */
    _latexImgTag: function(latex, imgClass) {
      // prevent XSS
      var escapedFormula = htmlentities(latex);
      var svgUrl = LATEX_SERVICE_ENDPOINT + encodeURIComponent(latex);
      return '<img class="' + imgClass + '" src="' + svgUrl + '" alt="' + escapedFormula + '" formula="' + escapedFormula + '">'
    },

    //Clean up s_content import popups
    _removePopups: function() {
      var popups = Popups.popupStack;
      for (var i = 0; i < popups.length; i++) {
        var popup = popups[i];
        var cssClass = popup.extraClass;
        if (cssClass && cssClass.indexOf('tinymce') >= 0) {
          popup.close();
        }
      }
    },

    _saveLastNode : function( ) {
      var tmeNode = tinyMCE.activeEditor.selection.getNode();

      // the above selector sometimes targets the document, which cannot be appended to via jquery, so switch to the body
      if( typeof tmeNode == 'object' && tmeNode.nodeName == '#document' )
        tmeNode = tmeNode.body;

      $(document).data('tinymceLastNode', tmeNode );
    },

    _mediaInsert : function(opts) {
      if(typeof opts == 'undefined'){
        opts = {};
      }
      if(typeof opts.type == 'undefined'){
        opts.type = 'both';
      }

      sAfu.onUpload = function(file){
        if(!file.url || file.url == '' || !file.type)
          return;

        if(file.type == 'image'){
          var img = '<img src="' + file.url + '" alt="" title="" />';
          tinyMCE.activeEditor.execCommand( 'sContentInsert' , img );

          var popup = Popups.activePopup();
          Popups.close( popup );
          tinyMCE.activeEditor.focus();
        }
        else{
          var url = file.url;
          var fid = file.fid ? file.fid : '';

          if(sCommonIsEmbed(url)){
            Popups.close();
            // ensure that wmode=opage is set for all embeds
            url = tinyMCE.activeEditor.execCommand('sContentSetWmodeOpaque',url);
            tinyMCE.activeEditor.execCommand('sContentInsert' , url);
            return;
          }

          $.ajax({
            url: '/media/richtext/embedcode',
            data: { 'fid': fid , 'url': url },
            type: 'POST',
            dataType: 'json',
            success: function (data, status){
              var popup = Popups.activePopup();
              Popups.close( popup );
              tinyMCE.activeEditor.execCommand( 'sContentInsert' , data.embedCode );
            },
            error: function (data, status, e){
              alert(Drupal.t("There was an internal error. Please try again in a few moments."));
            }
          });
        }
      };

      var realm = tinyMCE.activeEditor.execCommand('sContentGetRealmFromUrl');
      var url = '/tinymceinsertmedia?r='+String(realm[0])+'&id='+String(realm[1]);
      if(opts.type == 'image'){
        url += '&type=image';
      }

      var popupOptions = {
        ajaxForm: false,
        extraClass: 'tinymce-insert-popup',
        updateMethod: 'none',
        href: url,
        hijackDestination: false,
        disableCursorMod: true,
        disableAttachBehaviors: false,
        formOnSubmit: function(){
          // using upload file form and there are no uploads
          if($('#mediaInsertTabURL').hasClass('active') && $('#edit-submit-upload').hasClass('disabled'))
            return false;

          var urlObj = $("#edit-media-url"),
              typeObj = $('.edit-media-type.active'),
              embedUrl = urlObj.val();

          if(embedUrl == ''){
            // using URL form and no URL specified
            if($('#mediaInsertTabUpload').hasClass('active')){
              alert(Drupal.t('Please enter either a URL or embed code.'));
              urlObj.focus();
              tinyMCE.activeEditor.execCommand('sContentToggleSubmitBtns');
              return false;
            }

            // file upload
            var sAfu_opts = {
              success: function (data, status){
                if( data.status != 0 ) {
                  tinyMCE.activeEditor.execCommand('sContentToggleSubmitBtns');
                  alert(Drupal.t("There was an internal error. Please try again in a few moments."));
                  return;
                }

                sAfu.onUpload(data.file);
              },
              error: function (data, status, e){
                tinyMCE.activeEditor.execCommand('sContentToggleSubmitBtns');
                alert(Drupal.t("There was an internal error. Please try again in a few moments."));
              },
              url: '/tinymceinsertmedia'
            };

            sAfu.uploadFormAjax({},sAfu_opts);

          }
          else {
            sAfu.onUpload({
              type: typeObj.hasClass('edit-media-type-image') ? 'image' : 'media',
              url: embedUrl
            });
            tinyMCE.activeEditor.focus();
          }

          return false;
        }
      };

      // make sure the active editor is the one where the picutre will be inserted
      tinyMCE.activeEditor.execCommand('sContentSaveLastNode');

      Popups.openPath(this, popupOptions, window);
    },

    _formulaInsert : function(img) {
      var realm = tinyMCE.activeEditor.execCommand('sContentGetRealmFromUrl');
      var formula = img ? $(img).attr('formula') : '';
      var use_mathquill = true;

      // formulas are base64 encoded to prevent TinyMCE from mangling them during html encoding/decoding
      // because base64 encoding for formula attributes of image tags was implemented later, some old image tags may not have base64 encoded formulas
      if( formula && Base64.is_encoded( formula ))
        formula = Base64.decode( formula );

      // save the image object so we can remove it later when updating an existing formula
      if(img){
        $(document).data('s_content_saved_formula_image',img);

        // only not use mathquill when it is an existing formula created with the old editor
        use_mathquill = img.hasClass('mathquill-formula');
      }

      if(use_mathquill){
        var href = '/tinymceinsertmathquill';
        var extraClass = ' tinymce-mathquill-formula-popup';
      }
      else{
        var href = '/tinymceinsertformula';
        var extraClass = ' tinymce-formula-popup';
      }
      var po = {
        ajaxForm: false,
        extraClass: 'tinymce-insert-popup popups-large' + extraClass,
        width: 550,
        updateMethod: 'none',
        href: href + '?r='+String(realm[0])+'&id='+String(realm[1])+'&formula=' + encodeURIComponent(formula),
        hijackDestination: false,
        disableCursorMod: true,
        disableAttachBehaviors: false,
        formOnSubmit: function(){
        }
      };

      // make sure the active editor is the one where the picutre will be inserted
      tinyMCE.activeEditor.execCommand('sContentSaveLastNode');

      Popups.openPath(this, po, window);
    },

    _latexInsert : function(img) {
      var realm = tinyMCE.activeEditor.execCommand('sContentGetRealmFromUrl');
      var formula = img ? $(img).attr('formula') : '';

      // save the image object so we can remove it later when updating an existing formula
      if(img) $(document).data('s_content_saved_latex_image',img);

      var po = {
        ajaxForm: false,
        extraClass: 'tinymce-insert-popup tinymce-latex-popup popups-large',
        width: 550,
        updateMethod: 'none',
        href: '/tinymceinsertlatex?r='+String(realm[0])+'&id='+String(realm[1])+'&formula=' + encodeURIComponent(formula),
        hijackDestination: false,
        disableCursorMod: true,
        disableAttachBehaviors: false,
        formOnSubmit: function(){
        }
      };

      // make sure the active editor is the one where the picutre will be inserted
      tinyMCE.activeEditor.execCommand('sContentSaveLastNode');

      Popups.openPath(this, po, window);
    },

    /**
     * A wrapper for TinyMCE's method of injecting new content into the editor DOM at the point of the cursor.
     * Optionally uses its own bookmark system (tinymceLastNode) if available and makes sense.
     *
     * @param string/object content  html string or a jquery object
     */
    _insertContent : function(content, opts) {
      var defaults = {
        use_native_insert: false // whether to use the tinyMCE native mceInsertContent to insert the content
      };
      if(typeof opts == 'undefined'){
        opts = {};
      }
      opts = $.extend({}, defaults, opts);

      var cHtml = typeof content == 'string' ? content : $('<div />').append(content.clone()).remove().html();
      var lastNode = $(document).data('tinymceLastNode');
      var lastNodeObj = $(lastNode);
      var ed = tinyMCE.activeEditor;

      try{
        if(!opts.use_native_insert && lastNodeObj.length > 0){
          // use JQuery to inject the new element into the DOM after our own bookmark
          var nodeName = lastNode.nodeName.toLowerCase();

          cHtml = new tinyMCE.html.Serializer().serialize(ed.parser.parse(cHtml));
          // SGY-25009 Make root of date-mce-json src URL /media if there is nothing before it except occurrences of "../"
          cHtml = cHtml.replace(/(['"])[\.\/]+media\/ifr/, "$1/media/ifr");

          if (!ed.settings.relative_urls) {
            // If ed.settings.relative_urls is FALSE, convert the value of data-mce-src to be absolute by removing any "../"
            cHtml = cHtml.replace(/data-mce-src="(\.+\/)+/, 'data-mce-src="/');
          }

          // the body tag and table cells cannot have other tags placed directly after them in the DOM hierarchy, use JQuery append instead of after
          if(nodeName == 'td' || nodeName == 'body' ){
            lastNodeObj.append(cHtml);
          }
          else {
            lastNodeObj.after(cHtml);
          }
        }
        else{
          // our own bookmark is not available or valid, use the standard TinyMCE method
          ed.execCommand('mceInsertContent' , false , '' ); // sgy-1761
          ed.execCommand('mceInsertContent' , false , cHtml );
        }
      }
      catch(e){}
    },

    _toggleSubmitButtons : function(){
      var submitBtn = $('#edit-submit-url');
      if(submitBtn.attr('disabled')==true){
        submitBtn.attr('disabled',false);
        submitBtn.parent().removeClass('disabled');
      }
      else{
        submitBtn.attr('disabled',true);
        submitBtn.parent().addClass('disabled');
      }

    },

    _getRealmFromUrl : function (){
      /// which piece is the realm? the number after that is the realm id
      var path_parts = String(window.location.pathname).split("/");
      var valid_realms = ['user','school','district','course','group','page','topic','assignment','event','message','scorm','resources','portfolios'];
      var path_part = '',
          upload_realm = null,
          upload_realmId = null;

      // template assessments
      var resourcesMatch = String(window.location.pathname).match(/^\/template\/([0-9]+)\/assessment\/(questions|settings|preview)/);
      if( resourcesMatch )
        path_parts = ['resources',resourcesMatch[1]];

      for(var i=0;i<path_parts.length;i++) {
        path_part = path_parts[i];
        if( $.inArray( path_part , valid_realms ) != -1) {
          upload_realm = path_part;
          upload_realmId = path_parts[i+1];
          break;
        }
      }

      if (upload_realm === 'portfolios') {
        upload_realm = 'user';
        upload_realmId = Drupal.settings.s_common.user.uid;
      }

      return [ upload_realm , upload_realmId ];
    },

    _setWmodeOpaque: function( html ){
      var domObj = $(html);
      // this is an iframe embed, append wmode=opaque to the iframe src
      if(html.match(/^<iframe.+/i)) {
        var iframe_src = domObj.attr('src');
        // only operate on youtu.be, youtube.com or vimeo.com links
        if( iframe_src.match(/^http(s?):\/\/.*((youtube\.com)|(youtu\.be)|(vimeo\.com)).+/gi) ) {
          // wmode already in querystring? replace
          if( iframe_src.match(/^.+(\&|\?).*wmode=.+$/i) ){
            iframe_src = iframe_src.replace(/^(.+(\&|\?).*wmode=)([^\&]+)(.*)$/i,'$1opaque$4');
            domObj.attr('src',iframe_src);
          } else {
            var append_str = iframe_src.indexOf('?') == -1 ? '?' : '&';
            domObj.attr('src',iframe_src + append_str + 'wmode=opaque');
          }
        }
      }

      // this in an object tag, set the param tag and the attribute
      if(html.match(/^<(object|embed).+/i)){
        $('param[name=wmode]' , domObj).remove();
        domObj.append('<param name="wmode" value="opaque"/>');
        domObj.attr('wmode','opaque');
      }

      return $('<div />').append( domObj ).html();
    },

    _insertResourceContent: function(data) {
      var html, width, height;

      $.each(data.content, function(k, content){
        html = '';
        if(content.type == 'link') {
          var linkClass = content['isLtiLaunch'] ? "s-content-insert s-app-lti-window-launch" : "s-content-insert";
          html = '<a href="' + content.href + '" class="' + linkClass + '" />' + content.title + '</a>';
        }
        else if(content.type == 'image') {
          html = '<img src="' + content.src + '" alt="' + content.title + '" title="' + content.title + '" />';
        }
        else if(content.type == 'iframe') {
          html = '<iframe src="' + content.src + '" width="' + content.width + '" height="' + content.height + '" frameborder="0" allowfullscreen></iframe>';
          html = tinyMCE.activeEditor.execCommand('sContentSetWmodeOpaque', html);
        }
        tinyMCE.activeEditor.execCommand('sContentInsert' , html);
      });

      var popup = Popups.activePopup();
      Popups.close( popup );
    },

    _insertResourcesContentPopup: function(ui, params) {
      var realm = tinyMCE.activeEditor.execCommand('sContentGetRealmFromUrl');
      var url = '/tinymceinsertresourcesapp?r='+String(realm[0])+'&id='+String(realm[1])+'&a='+String(params.nid);

      Popups.saveSettings();

      // The parent of the new popup is the currently active popup.
      var parentPopup = Popups.activePopup();

      var popupOptions = Popups.options({
        ajaxForm: false,
        extraClass: 'popups-extra-large popups-insert-library tinymce-resource-popup',
        updateMethod: 'none',
        href: url,
        hijackDestination: false,
        disableCursorMod: true,
        disableAttachBehaviors: false
      });

      // make sure the active editor is the one where the picutre will be inserted
      tinyMCE.activeEditor.execCommand('sContentSaveLastNode');

      // Launch the cookie preload popup first, then launch app
      var cookiePreloadUrl = sCommonGetSetting('s_app', 'cookie_preload_urls', params.nid);
      if(cookiePreloadUrl) {
        sAppMenuCookiePreloadRun(params.nid, cookiePreloadUrl, function(){
          // clear cached launch data since we store cookie preload attempts in session
          sAppLauncherClearCache(params.nid);
          sAppMenuCookiePreloadDelete(params.nid);
          Popups.openPath(this, popupOptions, parentPopup);
        });
      }
      // launch app popup
      else {
        Popups.openPath(this, popupOptions, parentPopup);
      }
    },

    getInfo : function() {
      return {
        longname : 'S_Content',
        author : 'Schoology, Inc.',
        authorurl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        infourl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        version : tinymce.majorVersion + "." + tinymce.minorVersion
      };
    }
  });

  // Register plugin
  tinymce.PluginManager.add('s_content', tinymce.plugins.SContentPlugin );
})();
