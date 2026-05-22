/**
 * Parses out and uploads embedded images to the file service
 *
 * $Id: editor_plugin_src.js 001 2023-07-17 $
 *
 * @author PowerSchool
 * @copyright Copyright 2023, PowerSchool, All rights reserved.
 *
 * Partially based on noneditable plugin
 */

(function() {
  var sgyPendingClass = 'sgy-pending';
  var sgyUploadClass = 'sgy-upload';
  var itemPasted = false;
  var editingDisabled = false;

  tinymce.create('tinymce.plugins.SEmbeddedImageUploader', {
    init: function(editor) {
      var self = this;

      // only execute this plugin when pasting
      editor.onPaste.add(function() {
        itemPasted = true;
      });

      // when content is pasted, looks for embedded image and start uploading them
      editor.onChange.add(function (editor) {
        if (!itemPasted) {
          return;
        }
        itemPasted = false;

        var $editorDoc = $(editor.getDoc());

        ['jpeg', 'png', 'tiff', 'gif', 'bmp', 'webp', 'avif']
          .forEach(function (imgType) {
            $editorDoc.find('img[src^="data:image/' + imgType + '"]:not(.' + sgyUploadClass + ')').each(function () {
              var $img = $(this);
              $img.addClass(sgyUploadClass);
              $img.wrap('<span class="' + sgyPendingClass + '"></span>');

              self._uploadImageAndGetUrl($img, editor)
                .then(function (imgUrl) {
                  $img.attr('src', imgUrl).attr('data-mce-src', imgUrl).unwrap();
                })
                .catch(function (err) {
                  console.error(err);
                  //if something goes wrong, just remove the image
                  $img.unwrap().remove();
                });
            })
          });
      });

      // watch for content selection, if it includes an image being uploaded disable most editing actions
      editor.onNodeChange.addToTop(function (editor) {
        var selectStart = editor.dom.getParent(editor.selection.getStart(), function(element) {
          return editor.dom.hasClass(element, sgyPendingClass);
        });

        var selectEnd = editor.dom.getParent(editor.selection.getEnd(), function(element) {
          return editor.dom.hasClass(element, sgyPendingClass);
        });

        // Block or unblock
        if (selectStart || selectEnd) {
          self._setEditingDisabled(true, editor);
          return false;
        } else {
          self._setEditingDisabled(false, editor);
        }
      });
    },

    getInfo: function() {
      return {
        longname : 'S_Embedded_Image_Uploader',
        author : 'PowerSchool',
        authorurl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        infourl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        version : tinymce.majorVersion + "." + tinymce.minorVersion,
      };
    },

    _uploadImageAndGetUrl: function ($img, editor) {
      var dataUri = $img.attr('src');

      var typeAndContents = /data:image\/(\w*);base64,([a-zA-Z0-9+\/=]*)/.exec(dataUri);
      var type = typeAndContents[1];
      var contents = typeAndContents[2];

      //convert to bytes
      var contentsBin = atob(contents);
      var contentsBytes = Uint8Array.from(contentsBin, function(m) { return m.codePointAt(0); });
      var contentBlob = new Blob([contentsBytes], {type: 'image/' + type});

      return new Promise(function (resolve, reject) {
        //get token
        $.get('/uploads/token')
          .done(function (tokenResponse) {
            //upload img
            var form = new FormData();
            form.append('file', contentBlob);
            form.append('name', 'image.' + type);
            return $.ajax({
              url: editor.getParam('file_upload_url'),
              type: 'post',
              headers: {
                authorization: 'Bearer ' + tokenResponse.data.token,
              },
              data: form,
              processData: false,
              contentType: false,
            }).done(function (uploadResponse) {
              var imgUrl = editor.getParam('sgy_domain') + '/file_download/' + uploadResponse.fileMetadataId;
              resolve(imgUrl);
            }).fail(function () {
              reject('Unable to upload image');
            });
          })
          .fail(function () {
            reject('Unable to get token');
          });
      });
    },

    _setEditingDisabled: function(disabled, editor) {
      tinymce.each(editor.controlManager.controls, function(c) {
        c.setDisabled(disabled);
      });

      if (disabled !== editingDisabled) {
        if (disabled) {
          editor.onKeyDown.addToTop(this._blockKeys);
          editor.onKeyPress.addToTop(this._blockKeys);
          editor.onKeyUp.addToTop(this._blockKeys);
          editor.onPaste.addToTop(this._blockKeys);
          editor.onContextMenu.addToTop(this._blockKeys);
        } else {
          editor.onKeyDown.remove(this._blockKeys);
          editor.onKeyPress.remove(this._blockKeys);
          editor.onKeyUp.remove(this._blockKeys);
          editor.onPaste.remove(this._blockKeys);
          editor.onContextMenu.remove(this._blockKeys);
        }

        editingDisabled = disabled;
      }
    },

    _blockKeys: function(_, e) {
      var key = e.keyCode;

      // allowed keys
      if (
          key === 8 || // backspace
          (key >= 33 && key <= 40) || //arrow keys, page up/down
          (key >= 112 && key <= 123) // F1-F12
        ) {
        return;
      }

      // block all other keys
      return tinymce.dom.Event.cancel(e);
    },
  });

  // Register plugin
  tinymce.PluginManager.add('s_embedded_image_uploader', tinymce.plugins.SEmbeddedImageUploader );
})();
