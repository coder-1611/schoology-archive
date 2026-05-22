Drupal.behaviors.sUpdate = function(context){
  $("#s-update-create-form:not(.sUpdate-processed), #s-update-create-combined-form:not(.sUpdate-processed)", context).addClass('sUpdate-processed').each(function(){
    var formObj = $(this);

    $("#toggle-copy", formObj).click(function(){
    	if($("div#attachment-links").length > 0){
        $("#attachment-file").hide();
        $("#attachment-link").hide();
        $("ul#attachment-selector li#link-selector").removeClass('active');
        $("ul#attachment-selector li#file-selector").removeClass('active');
      }

     if($("#toggle-copy").hasClass('active')){
        $('#copy-to-courses .form-checkboxes:first').hide();
        $("#toggle-copy").removeClass('active')
      }
      else {
        $('#copy-to-courses .form-checkboxes:first').show();
        $("#toggle-copy").addClass('active')
      }

      return false;
    });

    if (window.sTinymce) {
      sTinymce.cancelSubmitIfPendingImageUploads(context);
    }
  });

  $('.s-edge-type-update-post:not(.sUpdate-processed),.s-edge-type-update-post-parent:not(.sUpdate-processed),.s-edge-type-update-poll:not(.sUpdate-processed), .update-comments:not(.sUpdate-processed)', context).addClass('sUpdate-processed').each(function(){
    var updatePost = $(this);
    $('.s-comments-post-form' , updatePost ).each(function(){
      var commentFormObj = $(this);
      $('textarea', commentFormObj).each(function(){
        var textareaObj = $(this);
        textareaObj.removeClass('add-comment-resize');
      });
    });

    $('.show-more-link', updatePost).click(function (e) {
      e.preventDefault();
      var linkObj = $(this);
      var linkId = linkObj.attr('id');
      var isComment = linkObj.hasClass('comment-link');

      $.ajax({
        url: linkObj.attr('href'),
        method: 'post',
        dataType: 'json',
        success: function (data) {
          if (isComment) {
            var parentObj = linkObj.parents('.comment-comment');
            // grab the user span and add it back in
            var userSpan = $('.comment-author', parentObj);
            parentObj.empty().append(userSpan).append(' ' + data.comment);
          } else {
            var parentObj = linkObj.parents('.update-sentence-inner:first');
            var bodyObj = $('.update-body', parentObj);
            bodyObj.empty().html(data.update);
          }
          linkObj.remove();
          sUpdateDispatchShowMoreLinkAjaxCompleteEvent(linkId, true);
        },
        error: function () {
          sUpdateDispatchShowMoreLinkAjaxCompleteEvent(linkId, false);
        }
      });
    });

    $('span.ajax-post-comment', updatePost).each(function(){
      var footerComments = $(this).parents('li').find(".feed-comments");

      sUpdateDisplayPostComments( footerComments, false, false );

      $(this).bind('click', function(){
        sUpdateDisplayPostComments(footerComments, true , true , true );
        return false;
      });

      // if you click into the reply textfield very quickly before the above functionality attaches to the onfocus
      // event of the textfield, you won't see the post button, etc appear. So check if it has focus
      $('textarea:focus',footerComments).trigger('focus');
    });

    $('span.feed-comments-viewall', updatePost).each(function(){
      var footerComments = $(this).parents('li').find(".feed-comments");
      var commentElementID = $(this).attr('id');
      var spliced = commentElementID.split('-');
      var post_id = spliced[3];
      var numComments = spliced[5];

      $(this).bind('click',function(){
        var edge_settings = Drupal.settings.s_edge;

        if( numComments > edge_settings.update_max_comments_show && numComments <= edge_settings.update_max_comments_ajax) {
          sUpdateAjaxGetComment(post_id, footerComments );
          return false;
        }

        if(numComments > edge_settings.update_max_comments_ajax){
          var popup_options = {
            extraClass: 'popups-large update-comments-popup no-buttons',
            href: '/update_post/' + String(post_id) + '/comments',
            hijackDestination: false,
            disableCursorMod: true,
            disableAttachBehaviors: false,
            disableInputFocus: true
          };

          Popups.openPath(this, popup_options, window);
          return false;
        }
      });
    });

    updatePost.sActionLinks({
     hidden: true,
     wrapper: '.update-post-action-links',
     rowClass: '.edge-item'
    });


    $('.like-btn', updatePost ).each(function(){
      $(this).bind('click',function(){
        $('.feed-comments',$(this).parents('.edge-footer')).removeClass('s-update-edge-hide-comments-form');
      });
    });

    $('a.delete-update-post' , updatePost ).bind('click',function(e){
      e.preventDefault();
      var linkObj = $(this);
      var deleteHref = linkObj.attr('href');

      sCommonConfirmationPopup({
       title: Drupal.t('Delete Post'),
       body: Drupal.t('Are you sure you want to delete this update?'),
       extraClass: 'popups-small',
       element: this,
       confirm: {
         text: Drupal.t('Delete'),
         func: function(){
          sPopupsClose();
          Popups.addLoading();

           $.ajaxSecure({
             url: deleteHref,
             success: function( response , status , xhr ){
               Popups.removeLoading();
               var parentObjs = linkObj.parents(".s-edge-type-update-post,.s-edge-type-update-poll");
               parentObjs.empty().addClass('deleted').append(Drupal.t('This update has been deleted'));
             }
           });
         }
       }
      });
    });

    $('.s-js-comment-wrapper', updatePost).each(function(){
      $(this).sActionLinks({hidden: true, wrapper: '.s-js-comment-action-links', rowClass: '.comment-contents'});
    });
    sCommentAttachActions(updatePost);
  });
}

function sUpdateAjaxGetComment(post_id, footerComments ){

  if( $('.feed-comments-viewall-container',footerComments).data('comments_loading') ) return;

  $.ajax({
	  url: "/comment/ajax/" + String(post_id) + "&context=updates",
	  dataType: 'json',
	  beforeSend: function(){
      $('.comments-loading',footerComments).css('display','inline-block');
      $('.feed-comments-viewall-container',footerComments).data('comments_loading',true);
	  },
	  success: function( data , status , xhr ){
	    $('.feed-comments-viewall-container',footerComments).remove();
	    var sComments = $(data.comments).html();
      $("#s_comments",footerComments).replaceWith(sComments);
      var updatePost = footerComments.closest('.s-edge-type-update-post');
      updatePost.removeClass('sUpdate-processed');
      Drupal.attachBehaviors(updatePost.parent());
	  }
  });
}

function sUpdateDisplayPostComments( footerComments, toggleSComments, toggleSCommentsPostForm , focus_input ){
  if(footerComments==null)
    var footerComments = $(".s-comments-post-form");

  if(toggleSComments)
    $("#s_comments",footerComments).show();

  if(toggleSCommentsPostForm) {
    $(footerComments).show();
    $("div.s-comments-post-form",footerComments).show();
    $("div.feed-comments-top",footerComments).show();
    $("div.feed-comments-viewall-container",footerComments).show();
  }

  var input = footerComments.find("textarea");
  if(input.length){
    var preFilledText = input.attr('defaulttext');

    if(input.val() == '' || input.val() == preFilledText)
      input.val(preFilledText).addClass('pre-fill');

    if( focus_input ) {
      var form = footerComments.is('form') ? footerComments : footerComments.find('form');
      form.trigger('focusin'); // see s_comments_post_comment_form.js for focusin event
      input.trigger('focus');
    }
  }
}

function sUpdateGetShowMoreLinkAjaxCompleteEventType(linkId) {
  return linkId + '-ajax-complete';
}

function sUpdateDispatchShowMoreLinkAjaxCompleteEvent(linkId, success) {
  var eventType = sUpdateGetShowMoreLinkAjaxCompleteEventType(linkId);
  var event = new CustomEvent(eventType, { detail: { success: success } });
  window.dispatchEvent(event);
}

$(document).ajaxComplete(function () {
  let form = document.querySelector('#s-event-add-form');
  if (form) {
    setTimeout(function () {
      if (typeof focusFirstErrorField === 'function') {
        focusFirstErrorField(form);
      }
    }, 0);
  }
});
