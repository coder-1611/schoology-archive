
var wait_image = '/sites/all/themes/schoology_theme/images/ajax-loader.gif';
var wait_image_width = 43;
var wait_image_height = 11;

Drupal.behaviors.s_comment = function(context){
	sCommentEnableCommentJump();

  var attachmentEnabled = $('#edit-allow-attachments-1').val() == 1,
      pageIsAssignment = $('body').hasClass('s_grade_item_assignment'),
      pageIsAssessment = $('body').hasClass('s_grade_item_assessment'),
      richTextEnabled = typeof tinyMCE != 'undefined';

  /**
   * Helper function to show/hide the reply form.
   * Manages the bootstrapping of the rich text editor
   *
   * @param object commentReplyForm
   * @param bool show
   */
  function toggleReplyForm(commentReplyForm, show, toolbar){
    show ? commentReplyForm.show() : commentReplyForm.hide();

    if(typeof toolbar == 'undefined' || !toolbar){
      toolbar = 'basic_comment';
    }

    var editorId = commentReplyForm.data('editor_id');
    if(show){
      if(richTextEnabled){
        if(editorId){
          // refresh the editor
          tinyMCE.execCommand('mceAddControl', true, editorId);
          tinyMCE.execCommand('mceFocus', false, editorId);
        }
        else{
          editorId = commentReplyForm.find('.s-tinymce-load-editor').attr('id');
          sTinymceInit({
            elements: editorId,
            toolbar: toolbar
          });
          commentReplyForm.data('editor_id', editorId);
          tinyMCE.execCommand('mceFocus', false, editorId);
        }
      }
      else{
        commentReplyForm.find('#edit-reply').trigger('focus');
        var textareaObj = commentReplyForm.find('textarea:not(.sComment-processed)');
        if(textareaObj.length){
          textareaObj.addClass('sComment-processed')
                     .elastic();
        }
      }
      if(attachmentEnabled) {
        if(!sAttachmentMoveForm(commentReplyForm, '.submit-span-wrapper', 'before')){
          resetAttachmentForm();
        }
      }
    }
    else{
      if(editorId){
        tinyMCE.execCommand('mceRemoveControl', true, editorId);
      }
    }
  }

  $('#s_comments:not(.sCommentProcessed)', context).addClass('sCommentProcessed').each(function(){
    var commentsWrapper = $(this);
    commentsWrapper.on('click', '.expander-link-expanded, .expander-link-collapsed', function(e){
      var targetObj = $(e.target);
      var targetWrapper = targetObj.closest('.expander-bar');
      var childrenWrapper = targetWrapper.nextAll('.s_comments_level:first');
      var rootComment = targetWrapper.prevAll('.comment:first');

      if (!targetObj.hasClass('clickable')) {
        targetObj = targetObj.parent();
      }
      var wasExpanded = targetObj.hasClass('expander-link-expanded');
      if(wasExpanded){
        //currently expanded
        var otherObj = $('.expander-link-collapsed', targetWrapper);
        childrenWrapper.addClass('hidden');
      }
      else{
        //currently collapsed
        var otherObj = $('.expander-link-expanded', targetWrapper);
        childrenWrapper.removeClass('hidden');
      }
      targetObj.addClass('hidden');
      otherObj.removeClass('hidden');

      //save the expanded/collapsed state
      var objNid = $('.comment-nid', commentsWrapper).text();
      var cookieName = 'collapsedThreads-' + objNid;
      var curCookie = $.cookie(cookieName);
      if(typeof curCookie == 'undefined' || !curCookie){
        curCookie = [];
      }
      else{
        curCookie = curCookie.split(',');
      }
      var threadID = rootComment.attr('id');
      threadID = threadID.split('-')[1];
      if(wasExpanded){
        if(curCookie.indexOf(threadID) == -1){
          curCookie.push(threadID);
        }
      }
      else{
        curCookie = searchAndRemove(curCookie, threadID);
      }
      curCookie = curCookie.join(',');
      $.cookie(cookieName, curCookie, {expires : 30});
    });
  });

  // comment reply form that is rendered at the end of the page outside of the comment tree
  // the form is moved throughout the page depending on where the user hits the reply link
  $('#s-comment-reply-form:not(.sCommentProcessed)', context).addClass('sCommentProcessed').each(function(){
    var formObj = $(this);
    var editReply = $('#edit-reply', formObj); // post new reply textarea
    var editComment = $('#edit-comment'); // post new comment textarea
    var submitButton = $('.form-submit', formObj);
    var submitSpan = submitButton.parent('.submit-span-wrapper:first');

    function enableButton(enable){
      submitButton.prop('disabled', !enable);
      submitSpan.toggleClass('disabled', !enable);
    }

    if(richTextEnabled){
      var rteInit = true;
      tinyMCE.onAddEditor.add(function(tme, editor){
        // Add hook for when a new rich text editor has been added.
        // Determine if the new editor is the comment reply, if so binds a keyup event so the "Post Reply" button is only
        // enabled when there is content in the editor.
        if(editor.id == editReply.attr('id')){
          editor.onChange.add(function(){
            var hasContent = !!$(editor.getBody().innerHTML).text().length;
            enableButton(hasContent);
          });
          if(rteInit){
            enableButton(false);
            rteInit = false;
          }
          if(attachmentEnabled){
            editor.onActivate.add(function(){
              sAttachmentMoveForm(editReply.closest('form'), '.submit-span-wrapper', 'before');
            });
          }
        }

        // When the edit comment editor is focused, grab the attachment form
        if(editor.id == editComment.attr('id')){
          if(attachmentEnabled){
            editor.onActivate.add(function(){
              sAttachmentMoveForm(editComment.closest('form'), '.submit-span-wrapper', 'before');
            });
          }
        }
      });
    }
    else{
      editReply.on('keyup focus', function(){
        enableButton(editReply.val().length);
      });
    }
  });

  // move the reply comment form to the clicked reply link
  $(".reply-comment:not(.sComment-processed)", context).addClass('sComment-processed').each(function(){
    var comment = $(this).parents('.comment').eq(0);
    var commentFooter = comment.children('.comment-footer');
    var isBlog = comment.closest('.blog-comments').length > 0;
    var isDiscussion = comment.closest('.discussion-view').length > 0;
    var toolbar = isDiscussion ? 'discussion' : 'basic_comment';
    var commentNestedLevel = comment.parents('.s_comments_level').length;
    $(this).click(function(e){
      e.preventDefault();
      var commentReplyForm = $("#comment-reply-form-wrapper");

      if(commentReplyForm.is(':visible') && comment.has(commentReplyForm).length){
        toggleReplyForm(commentReplyForm, false, toolbar);
      }
      else{
        // move and show reply form
        toggleReplyForm(commentReplyForm, false, toolbar);

        if(pageIsAssignment || pageIsAssessment || isBlog){
          // the placement of the reply form on assignment page is different
          commentReplyForm.insertAfter(commentFooter);
        }
        else{
          // inside the footer if discussion
          commentReplyForm.appendTo(commentFooter);
        }
        $("input[type=hidden][name=pid]", commentReplyForm).val(comment.attr('id').split('-')[1]);
        $("input[type=hidden][name=nested_level]", commentReplyForm).val(commentNestedLevel + 1);
        toggleReplyForm(commentReplyForm, true, toolbar);
      }
    });
  });

  // Rendering after a reply
  if(context !== document) {
    sAttachActionLinkBehavior(context);
  } else {
    $('.discussion-content:not(.sComment-processed)', context).addClass('sComment-processed').each(function(){
      var commentsContainer = this;

      sAttachActionLinkBehavior(commentsContainer);

      $(document).on('popups_open_path_done', function(e, element, href, popup) {
        var activePopup = $('#' + popup.id);
        var popupEditId = '';
        // the attachment form is a singleton, move it to/from popup as needed
        if(activePopup.hasClass('s-js-comment-popup-edit')) {
          popupEditId = popup.id;
          $('#attachments', activePopup).remove();
          sAttachmentMoveForm( $('#s-comment-edit-comment-form') , '#edit-comment-body-wrapper' );

          $(document).bind('popups_before_remove',function(e, popup, nextPopup){
            if(popupEditId == popup.id) {
              sAttachmentMoveForm( $('#s-comments-post-comment-form') , '#edit-comment-wrapper' );
            }
          });
        }
      });
    });
  }

  $('#s-comment-edit-comment-form:not(.sComment-processed)', context).addClass('sComment-processed').each(function(){
    var thisForm = $(this);
    var editComment = $(".form-textarea", thisForm);
    var submitBtn = $('.form-submit', thisForm);
    var submitBtnWrapper = submitBtn.parent('.submit-span-wrapper:first', thisForm);

    editComment
      .elastic()
      .on('keyup', function(){
        var enableSave = editComment.val().length > 0 ? true : false;
        submitBtn.prop('disabled', !enableSave);
        submitBtnWrapper.toggleClass('disabled', !enableSave);
    });

    // update popup size on-elastic-update
    $(document).off('jq_elastic_update_done').on('jq_elastic_update_done', function(textarea, twin){
      sPopupsResizeCenter();
    });
  });

  $('#s_comments:not(.sComment-processed)', context).addClass('.sComment-processed').each(function(){
    var commentsWrapper = $(this);
    commentsWrapper.on('click', '.comment-more-toggle:not(.loading)', function(e){
      var linkObj = $(e.target);
      var commentID = linkObj.siblings('.comment-id').text();
      var moreWrapper = linkObj.closest('.comment-comment').find('.comment-more-wrapper');
      var lessWrapper = linkObj.closest('.comment-comment').find('.comment-less-wrapper');

      var performToggle = function(){
        var isLess = linkObj.hasClass('less');
        moreWrapper.toggleClass('hidden', isLess);
        lessWrapper.toggleClass('hidden', !isLess);

        // Store in Cookie
        var cookieName = 'collapsedTruncatedComment-' + commentID;
        var curCookie = $.cookie(cookieName);
        if(typeof curCookie == 'undefined' || !curCookie){
          curCookie = null;
        }
        curCookie = isLess;
        $.cookie(cookieName, curCookie, {expires : 30});
      };

      if(!linkObj.hasClass('comment-more-loading')) {
        if (!moreWrapper.length) {
          linkObj.addClass('comment-more-loading');
          $.ajax({
            url: '/comment/' + commentID + '/show_more',
            method: 'get',
            dataType: 'json',
            success: function (data) {
              lessWrapper.after($(data.comment));
              moreWrapper = linkObj.closest('.comment-comment').find('.comment-more-wrapper');
              performToggle();
              linkObj.removeClass('comment-more-loading');
            }
          });
        }
        else {
          linkObj.addClass('comment-more-loading');
          performToggle();
          linkObj.removeClass('comment-more-loading');
        }
      }
    });
  });

};

function sCommentEnableCommentJump(){

	$(".go-to-reply").click(function() {
		var clickedReplyLink = $(this);
		var el = $(this).parent().parent().parent().parent();
		if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
			var target = $(this.hash);
			target.effect("highlight", {color: "#f9b974"}, 3000);

			// create a "return to post" link
			// remove other return-links
			$(".return-link").remove();
			var replyName = clickedReplyLink.parent().prev().text().split(' ');
			var returnLink = $('<div class="return-link">' + Drupal.t('Return to reply', {'@name': replyName[0]}) + '</div>');
			returnLink.click(function(){
				var replyOffset = clickedReplyLink.offset().top-20;
				$('html,body').animate({scrollTop: replyOffset}, 500);
				clickedReplyLink.parent().parent().parent().parent().effect("highlight", {color: "#f9b974"}, 3000);
				$(this).fadeOut();
			});
			target.prepend(returnLink);
			returnLink.fadeIn();

			target = target.length && target || $('[name=' + this.hash.slice(1) +']');
			if (target.length) {
				var targetOffset = target.offset().top-20;
				$('html,body').animate({scrollTop: targetOffset}, 500);
				return false;show
			}
		}
	});
}

function sCommentDeleteCallback(data, options, element){
  var isDiscussion = $(element.closest('.discussion-card')).length > 0;
  if(isDiscussion){
    location.reload();
    return false;
  }
  var newComment = Drupal.t('This comment has been deleted.');
  var markDeletion = function (element) {
    var comment = $(element).parents(".comment");
    comment.empty().addClass('deleted').append(newComment);
    if (comment.hasClass('no-children') && comment.parent().hasClass('discussion-card')) {
      comment.unwrap();
    }
  };

  if(typeof data.ajax_output != 'undefined'){
    newComment = data.ajax_output;
    markDeletion(element);
  }
  else{
    markDeletion(element);
  }


  // not sure this is right but it works
  var nextActivePopup = Popups.activePopup();
  if( nextActivePopup ) {
    Popups.removeLoading();
	nextActivePopup.show();
	nextActivePopup.refocus();
  } else {
    Popups.close();
  }

  return false;
}

function sCommentApproveCallback(data, options, element){
  $(element).parents(".comment").empty().addClass('deleted').append(Drupal.t('This comment has been approved.'));
  Popups.close();
  return false;
}

function sCommentEditCallback(data, options, element){
  var commentObj = data.content.comment;
  var commentEditedTs = data.content.comment_edited_timestamp;
  var commentAttachments = data.content.comment_attachments;

  var editLink = $(element);
  var commentWrapper = editLink.parents('#comment-' + commentObj.cid);
  var commentBodyWrapper = $('.comment-body-wrapper', commentWrapper);
  var commentTimeWrapper = $('.comment-time-wrapper', commentWrapper);
  var commentAttachmentWrapper = $('.comment-attachments', commentWrapper);

  if(commentObj.richtext && !commentBodyWrapper.hasClass('s-rte')) {
    commentBodyWrapper.addClass('s-rte');
  }

  if(typeof data.content.is_discussion != 'undefined' && data.content.is_discussion){
    commentBodyWrapper.replaceWith(commentObj.comment);
  }
  else{
    commentBodyWrapper.html(commentObj.comment);
    commentTimeWrapper.replaceWith(commentEditedTs);
  }
  if(commentAttachmentWrapper.length > 0) {
    commentAttachmentWrapper.replaceWith(commentAttachments);
  }
  else {
    $('.comment-comment', commentWrapper).append(commentAttachments);
  }

  sAttachBehaviors(['sCommonInfotip'], commentWrapper);

  Popups.close();
  return false;
}

function sAttachActionLinkBehavior(selectorContext) {
    $('.s-js-comment-wrapper:not(.has-action-link-behavior)', selectorContext).each(function(){
      $(this)
        .addClass('has-action-link-behavior')
        .sActionLinks({hidden: true, wrapper: '.s-js-comment-action-links', rowClass: '.comment-contents'});

    });
    sCommentAttachActions(selectorContext);
}


function sCommentAttachActions(commentsContainer) {
  var popups = {
    '.delete-comment': {extraClass: 'popups-small s-js-comment-popup-delete', updateMethod: 'callback', onUpdate: 'sCommentDeleteCallback', doneTest: '.+'},
    '.edit-comment': {extraClass: 'popups-medium s-js-comment-popup-edit', updateMethod: 'callback', onUpdate: 'sCommentEditCallback', hijackDestination: false, doneTest: '.+'}
  };

  $.each(popups, function (link, options) {
    $(commentsContainer).on('click', link, options, function(event){
      return Popups.clickPopupElement(this, Popups.options(event.data));
    });
  });
}

function sCommentScrollToNewComment(newComment, duration, bodySelector){
  var isDiscussion = $('body').hasClass('discussion-view'),
      targetOffset = newComment.offset().top,
      bodySelector = bodySelector || "",
      duration = duration || 750;

  if(isDiscussion){
    var outerHeight = 0,
        commentMargin = 20;
    $('.sticky-wrapper').each(function() {
      outerHeight += $(this).outerHeight();
    });
    targetOffset -= commentMargin;
    targetOffset -= outerHeight;
    bodySelector = "";
  }

  $('html, body' + bodySelector).animate({scrollTop: targetOffset}, duration);
}
