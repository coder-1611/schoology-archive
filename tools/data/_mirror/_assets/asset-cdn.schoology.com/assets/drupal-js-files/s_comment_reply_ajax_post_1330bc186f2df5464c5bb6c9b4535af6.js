// JavaScript Document

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
Drupal.Ajax.plugins.s_comment_reply = function(hook, args) {
  switch(hook){
    case 'submit': // submitting the form
      // disable the submit button
      var submitter = args.submitter;
      submitter.attr('disabled', 'disabled').parent().addClass('disabled');
      break;
    case 'message': // response received, return false to hide messages
      var submitter = args.local.submitter;
      var form = submitter.parents('form');
      if(form.attr('id') == 's-comment-reply-form'){
        if(typeof args.redirect == 'string' && args.redirect.length > 0){
          window.location.href = args.redirect;
        }
        else{
          // reenable the submit button
          submitter.attr('disabled', false).parent().removeClass('disabled');

          var validateOutput = args.ajax_validate_output;
          var submitOutput = args.ajax_submit_output;

          var content = '';
          // Display the submit output if set, otherwise display validate output
          if(submitOutput != undefined){
            // clear the rich text or input text area
            var inputObj = form.find('textarea');
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

            content = submitOutput;

            var parentComment = submitter.parents('.comment').eq(0);
            var replyLevel = parentComment.next('.s_comments_level');
            // if the next level of replies does not yet exist, create it
            if(replyLevel.length == 0){
              replyLevel = $('<div class="s_comments_level"></div>');

              // Add nested class if needed
              var parentCommentLevel = parentComment.parent('.s_comments_level');
              if(parentCommentLevel && parentCommentLevel.hasClass('nested-threshold-exceeded')) {
                replyLevel.addClass('nested-threshold-exceeded');
              }

              parentComment.after(replyLevel);
            }
            var newComment = $(content);
            replyLevel.append(newComment);
            form.parent().hide();

            // Discussion only behavior
            var isDiscussion = $('body').hasClass('discussion-view');
            var colorString = "#f9b974";
            sCommentScrollToNewComment(newComment, 500);
            if(isDiscussion){
              colorString = "rgba(213,227, 241, 0.6)";
            }
            newComment.effect("highlight", {color: colorString}, 3000);

            Drupal.attachBehaviors(replyLevel);
          } else if(validateOutput != undefined) {
            content = validateOutput;
          }

          //increment the thread counter and show the hide link if exists
          var threadRoot = submitter.closest('.thread-root');
          var expanderBar = threadRoot.prev();
          //ensure its not a pending comment
          var contentObj = $(content);
          var isPending = $('.pending-comment', contentObj).length > 0;
          if(expanderBar.hasClass('expander-bar') && !isPending){
            var numRepliesWrapper = $('.num-replies', expanderBar);
            var numReplies = numRepliesWrapper.text();
            var expandText = $('.expander-text', expanderBar);
            var hideText = $('.expander-hide-text', expanderBar);
            numReplies = parseInt(numReplies);
            numReplies++;
            numRepliesWrapper.html(numReplies);
            expandText.html(Drupal.formatPlural(numReplies, '1 Reply', '@count Replies'));
            hideText.html(Drupal.formatPlural(numReplies, 'Hide 1 reply', 'Hide All @count Replies'));
            if (numReplies == 1) {
              $('.expander-link-expanded', expanderBar).removeClass('hidden');
            }
          }
        }
      }
      break;
  }
}
