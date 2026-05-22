/**
 * Ajax plugins callback
 *
 * @param {String} hook
 * @param {Object} args
 * @return {Bool}
 */

Drupal.Ajax.plugins.s_discussion = function(hook, args) {
  switch( hook ) {
    case 'submit':
      var submitter = args.submitter;
      var form = submitter.parents('form:first');
      if(form.hasClass('grade-post-form')){
        form.siblings('.loader:first').show();
        form.hide();
      }
      break;
    case 'message':
    	var submitter = args.local.submitter;
    	var form = submitter.parents('form:first');

      if(form.hasClass('grade-post-form')){
        // reenable the submit button
        submitter.attr('disabled', false).parent().removeClass('disabled');

        form.siblings('.loader:first').hide();
        $('a.comment-grade', form.parents('div.comment:first')).removeClass('active');
        form.show();

        //If there was an error, leave the form open so that the user can correct it.
        //This happens if an invalid grade was entered
        if(!args.status){
          break;
        } else {
          //Remove error class that may have been previously set so that
          //the input boxes don't indicate an error condition
          form.find('input').removeClass('error');
        }

        $('.fake-menu-wrapper').hide();
        var uid = $('#edit-uid', form).val();
        if($('.menu-grade').val() != ''){
          sDiscussionAjaxPostMarkGraded(uid);
        }
        else{
          sDiscussionAjaxPostMarkUngraded(uid);
        }
      }
    break;
  }
}

function sDiscussionAjaxPostMarkGraded(uid){
  $('div.comment-by-' + uid).each(function(){
    var commentRow = $(this);
    commentRow.removeClass('ungraded');
    $('a.comment-grade', commentRow).addClass('comment-graded');
  });
}

function sDiscussionAjaxPostMarkUngraded(uid){
  $('div.comment-by-' + uid).each(function(){
    var commentRow = $(this);
    commentRow.addClass('ungraded');
    $('a.comment-grade', $(this)).removeClass('comment-graded');
  });
}