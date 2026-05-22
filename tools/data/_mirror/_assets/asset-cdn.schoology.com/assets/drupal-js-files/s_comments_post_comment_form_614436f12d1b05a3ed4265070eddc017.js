Drupal.behaviors.sCommentsPostCommentForm = function( context ){
  // Comment form wrapper
  $("#s-comments-post-comment-form:not(.sCommentsPostCommentForm-processed), .post-comment-form:not(.sCommentsPostCommentForm-processed)", context).addClass('sCommentsPostCommentForm-processed').each(function(){

    var form = $(this);
    var rtePlaceholder = $('#comment-placeholder', form);
    var rteActualWrapper = $('.form-to-hide', form);
    var submitButton = $('.form-submit', form);
    var submitSpan = submitButton.parent('.submit-span-wrapper:first', form);
    var cancelButton = $('#edit-cancel', form);
    var editComment = $(".form-textarea", form);
    var submitEnabledForm = (form.hasClass('submit-enabled'));
    var focusableElementsString = "a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]";
    var focusableItems = form.find('*').filter(focusableElementsString);
    var isEdgeFeed = form.closest('.edge-main-wrapper').length > 0;
    var isRichText = editComment.hasClass('s-tinymce-load-editor');

    function toggleSubmit(show){
      submitButton.prop('disabled', !show);
      submitSpan.toggleClass('disabled', !show);
    }

    function processInput(editor){
      editor.onChange.add(function(){
        var hasContent = !!$(editor.getBody().innerHTML).text().length;
        toggleSubmit(hasContent);
      });
      editor.onInit.add(function(){
        // tinymce might take some time to set up...
        setTimeout(function(){
          tinyMCE.execCommand('mceFocus', true, editor.id);
        }, 0);

        if(isEdgeFeed){
          // on the feeds, space is limited so when the user focus out of an empty input
          // the RTE is disabled and reverts back to a good ol' textarea
          tinyMCE.dom.Event.add(editor.getWin(), "blur", function(){
            // bubble up the form focusout defined below when the box has no content
            if(!editor.getContent().length){
              tinyMCE.execCommand('mceRemoveControl', true, editor.id);
              editComment.val(editComment.attr('defaulttext')).trigger('blur');
            }
          });
        }
      });
    }

    if(window.tinyMCE){
      if (tinyMCE.activeEditor != null) {
        processInput(tinyMCE.activeEditor);
      }
      else if(!submitEnabledForm && isRichText) {
        tinyMCE.onAddEditor.add(function (tme, editor) {
          if (editor.id == editComment.attr('id')) {
            processInput(editor);
          }
        });
      }
    }

    form
      .on('focusin', function(e) {
        // for non-threaded comment areas like blog, show/hide profile picture/submit button
        // and resize the comment textarea accordingly
        $("div.author-picture.threadless",form).show();
        $("div.author-picture.threadless",form).siblings('span.submit-span-wrapper').show();
        form.addClass('mouse-focus');

        var textareaObj = form.find('.s-tinymce-load-editor');
        if(textareaObj.length){
          var editorId = textareaObj.attr('id'),
              editor = tinymce.get(editorId);
          if(editor){
            tinyMCE.execCommand('mceAddControl', true, editorId);
          }
          else{
            textareaObj.val('');
            sTinymceInit({
              elements: editorId,
              toolbar: 'basic_comment'
            });
          }
        }
      })
      .on('focusout', function(e) {
        // since nothing is actually in focus on "focusout", using a setTimeout to jump this code to the end of the current execution stack
        // after the execution stack, the next item will be focused and the $(':focus') selector will work
        setTimeout(function() {
          var focusedItem = $(':focus'),
              focusedItemIndex = focusableItems.index(focusedItem);

          // if the currently focused item is outside of the form and the text in textarea is blank or the default text, change it back to the "slim" view
          if(focusedItemIndex === -1 && editComment.val() == editComment.attr('defaulttext')) {
            $("div.author-picture.threadless",form).hide();
            $("div.author-picture.threadless",form).siblings('span.submit-span-wrapper').hide();
            form.removeClass('mouse-focus');

            if( editComment.hasClass('threadless') ) {
              editComment.removeClass('add-comment-resize');
            }
          }
        }, 0);
      });
    
    if(!isRichText){
      editComment
        .on('focus', function() {
          if(editComment.val() == editComment.attr('defaulttext') && editComment.hasClass('pre-fill')) {
            editComment.val('').removeClass('pre-fill');
          }
          if( editComment.hasClass('threadless') ) {
            editComment.addClass('add-comment-resize');
          }
          $(this).trigger("resize");//necessary to get jquery-elastic to know of change in size if textarea changes when we add a avatar icon to next to textarea
        })
        .on('blur', function() {
          if(editComment.val() == '') {
            editComment.val( editComment.attr('defaulttext') ).not('.is-locked').addClass('pre-fill');
          }
        })
        .on('keyup', function(){
          toggleSubmit(editComment.val().length);
        })
        .trigger('blur')
        .elastic();
    }

    function togglePlaceholderForm(){
      if(rtePlaceholder.css('display') == 'none'){
        rtePlaceholder.show();
        rteActualWrapper.hide();
      } else {
        rtePlaceholder.hide();
        rteActualWrapper.show();
        tinyMCE.activeEditor.focus();
        tinyMCE.activeEditor.getBody().focus();
      }
    }
    rtePlaceholder.on('click', togglePlaceholderForm);

    $(cancelButton, form).on('click', function(e){
      e.preventDefault();
      togglePlaceholderForm();
    });

  });
}
