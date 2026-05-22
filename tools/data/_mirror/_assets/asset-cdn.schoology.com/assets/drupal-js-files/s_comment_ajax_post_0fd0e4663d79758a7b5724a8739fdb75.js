
var wait_image = '/sites/all/themes/schoology_theme/images/ajax-loader.gif';
var wait_image_width = 43;
var wait_image_height = 11;

/**
 * Ajax plugins callback
 *
 * @param {String} hook
 * @param {Object} args
 * @return {Bool}
 */
Drupal.Ajax.plugins.s_comment = function(hook, args) {

  switch( hook ) {
    case 'submit':
      var submitter = args.submitter,
          formObj = submitter.closest('form'),
          editorObj = formObj.find('.s-tinymce-load-editor');
      if(formObj.hasClass('post-comment-form')){
        submitter.attr('disabled', 'disabled').parent().addClass('disabled');
      }
      if(editorObj.length){
        var ed = tinyMCE.get(editorObj.attr('id'));
        if(ed){
          ed.save();
        }
      }
    break;

    case 'message':
      var submitter = args.local.submitter;
      var commentForm = submitter.parents('form');
      if(!submitter.parents('form').hasClass('post-comment-form')){
        return;
      }

      // reenable the submit button if the form's disable_submit flag is set to FALSE
      var submitEnabledForm = (submitter.parents('.submit-enabled').length > 0);
      if(submitEnabledForm){
      	submitter.attr('disabled', false).parent().removeClass('disabled');
      }

      var validateOutput = args.ajax_validate_output;
      var submitOutput;
      var allComments;
      if(typeof(args.ajax_submit_output) == 'object') {
        submitOutput = args.ajax_submit_output.newComment;
        allComments = args.ajax_submit_output.allComments;
      }
      else {
        submitOutput = args.ajax_submit_output;
      }
      var footerComments = submitter.closest(":has(.feed-comments, .blog-comments, .discussion-content, .album-comments, .update-comments)")
          .find('.feed-comments, .blog-comments, .discussion-content, .album-comments, .update-comments');
      var feedContent = footerComments.parent();
      var content = '';
      var isDiscussion = $('body').hasClass('discussion-view');

      // Display the submit output if set, otherwise display validate output
      if(submitOutput != undefined)
        content = submitOutput;
      else if(validateOutput != undefined)
        content = validateOutput;

      // discussion comments, hide the 'no comments' message
      $("p.no-discussion",$(".discussion-content")).hide()

      //Post comment gets added to end of discussion thread in this block
      if(footerComments.find("#s_comments").length > 0) {
        footerComments.find("#s_comments").fadeIn(5000, function(){
          var contentObj = $("<div class='discussion-card'></div>");
          contentObj.append(content);

          if(isDiscussion) {
            $(this).prepend(contentObj);
          } else {
            $(this).append(contentObj);
          }
          Drupal.attachBehaviors(contentObj);
          // submission failed (ie, discussion is locked)
          var is_locked = false;
          for (i = 0; i < args.messages_error.length; ++i) {
            if(args.messages_error[i].value == 'This discussion is locked') {
              is_locked = true;
            }
          }
          if(is_locked) {
            footerComments.find("textarea")
              .attr('defaulttext', footerComments.find("textarea").val())
              .addClass('is-locked');
          }
          sCommentScrollToNewComment(contentObj, 750, ":has(.s-comments-post-form-new)");
          if(isDiscussion){
            var colorString = "rgba(213,227, 241, 0.6)";
            contentObj.effect("highlight", {color: colorString}, 3000);
          }
        });
      }
      else {
        var contentObj = $('<div id="s_comments"><div class="discussion-card">'+content+'</div></div>');
        if(isDiscussion){
          var colorString = "rgba(213,227, 241, 0.6)";
          footerComments.find(".s-comments-post-form").after(contentObj);
          contentObj.effect("highlight", {color: colorString}, 3000);
        } else {
          footerComments.find(".s-comments-post-form").before(contentObj);
        }
        Drupal.attachBehaviors(contentObj);
      }

      // clear the user input
      var inputObj = commentForm.find('textarea');
      if(inputObj.length){
        if(inputObj.hasClass('s-tinymce-load-editor')){
          var ed = tinyMCE.get(inputObj.attr('id'));
          if(ed){
            ed.setContent('');
            ed.save();
          }
        }
        else{
          inputObj.val('').trigger('blur');
        }
      }

      // show all comments; remove disabled classes
      // activate stats filter
      if(allComments) {
        for(var cid in allComments) {
          var commentWrapper = footerComments.find("#comment-" + cid);
          var commentBodyWrapper = $(".comment-body-wrapper", commentWrapper);
          var commentTopWrapper = $(".comment-top", commentWrapper);
          commentBodyWrapper.removeClass('disabled');

          // The html is encoded because of check_plain, so we need to decode it.
          // Textarea is used since no html elements are allowed in a textarea, making it safer against XSS.
          // If there happens to be html elements, it will be encoded by the browser.
          var commentBody = $('<textarea/>').html(allComments[cid].body).val();
          commentBodyWrapper.html(commentBody);
          $(allComments[cid].attachments).insertAfter(commentTopWrapper);
          commentWrapper.removeClass('disabled');
          $(".comment-reply", commentWrapper).removeClass('disabled').show();
        }
        Drupal.attachBehaviors(footerComments);
        footerComments.prev('.discussion-require-post-notice').remove();
        var courseInfo = footerComments.parents('.course-discussion');
        $('#discussion-user-stats-wrapper', courseInfo).removeClass('disabled');
        sAttachBehaviors(['s_discussion'], courseInfo);
      }

      // for update commment popup, resize and center
      if( footerComments.hasClass('update-comments') ){
        popup = Popups.activePopup();
        if(popup) Popups.resizeAndCenter(popup);
      }

      var numCommentsLink = feedContent.find(".feed-footer").find("span.ajax-post-comment");
      var text = numCommentsLink.text();
      var splice = text.split(" ");
      var comments = splice[0];
      var suffix = splice[1];

      if(comments == 1)
        suffix = splice[1]+"s";

      ++comments;
      numCommentsLink.text(comments+ " "+suffix);
      //resize textarea back to default size of 32 pixels
      $('#edit-comment-wrapper #edit-comment', commentForm).css('height', '32px');
    break;

    case 'afterMessage':
      // reset attachment form
      if(!args.ajax_submit_output)
        return;

      if ($('#attachments').length > 0){
        resetAttachmentForm();
      }

      if ($('li#file-selector').hasClass('active')){
        $('li#file-selector').removeClass('active');
      }

      break;
  }
}

