// JavaScript Document
var wait_image = '/sites/all/themes/schoology_theme/images/ajax-loader.gif';
var wait_image_width = 43;
var wait_image_height = 11;

Drupal.behaviors.sGradeItem = function(context){
	sGradeItemEnableCommentJump();

	// cluetip
  if($('#save-for-later-help', context).length){
	 $('#save-for-later-help', context).cluetip({splitTitle: '|', dropShadow: false, showTitle: false, positionBy: 'auto'});
  }

	$('.grade-item-action-links:not(.sGradeItem-processed)', context).addClass('sGradeItem-processed').each(function () {
		$(this).sActionLinks({hidden: false,	wrapper: '.action-links-wrapper'});
	});

	$('.info-container .view-info:not(.sGradeItem-processed)', context).addClass('sGradeItem-processed').each(function () {
		var linkBtn = $(this);
		linkBtn.bind('click', function(){
			var wrapper = $(this).parent();
			$('.grading-info', wrapper).toggle();
			linkBtn.toggleClass('active');
			return false;
		}).tipsy({
      'gravity': document.dir === 'rtl' ? 'sw' : 'se'
    });
	});
	$('body').unbind('click.sGradeViewInfo').bind('click.sGradeViewInfo', function(e){
	  var linkBtn = $('.info-container .view-info', context);
	  var target = $(e.target);
	  if(linkBtn.hasClass('active') && target.not('.grading-info') && target.parents('.grading-info').length == 0){
	    linkBtn.click();
	  }
	});

	$('.info-container .link-btn:not(.sGradeItem-processed):not([data-assignment-lti-fullscreen="true"]):not(.assignment-lti-fullscreen)', context).addClass('sGradeItem-processed').each(function () {
	  $(this).tipsy({
	    'gravity': document.dir === 'rtl' ? 'sw' : 'se'
	  });
	});


	$('.comment:not(.sGradeItem-processed)', context).addClass('sGradeItem-processed').each(function () {
	var comment = $(this);
			comment.bind('mouseenter', function(){
					$(".entry-links-view", comment).show();
			}).bind('mouseleave', function(){
				  $(".entry-links-view", comment).hide();
			});
	});

  if(typeof tinyMCE != 'undefined'){
    // the comment input usually initialize when the user focuses on the textarea
    // since there are many of these on the homepage
    // but the one on the assignment and assessment page can be initialized on page load since there is only one of them
    $('.s_grade_item_assignment #edit-comment.s-tinymce-load-editor:not(.sGradeItem-processed), .s_grade_item_assessment #edit-comment.s-tinymce-load-editor:not(.sGradeItem-processed)', context).addClass('sDiscussion-sGradeItem').each(function(){
      var textareaObj = $(this),
          id = textareaObj.attr('id'),
          editor = tinyMCE.get(id);
      if(!editor){
        sTinymceInit({
          elements: id,
          toolbar: 'basic_comment'
        });
      }
    });
  }

	$('#s-grade-item-add-attachment-form:not(.sGradeItem-processed)', context).addClass('sGradeItem-processed').each(function() {
		setTimeout(function(){
			$('#file-selector').click();
		},150);
	});

  var commentVal = "";
  $(".comment-area-toggle").on("click", function () {
    commentVal = $("#edit-comment-wrapper .title-infield").val();
  });

  $(".grade-submit-buttons .cancel-btn").on("click", function (el) {
    $("#edit-comment-wrapper .title-infield").val(commentVal);
    $(el.currentTarget).closest("#s-grade-item-edit-enrollment-grade-form").removeClass("active");
  });

  if ($('body').hasClass('s-enable-mathml')) {
    s_renderMath();
  }

  // Handle regular fullscreen buttons (non-LTI specific ones)
  // This extends the existing s_external_tool.js functionality for assignment pages
  $(".content-top .regular-fullscreen-btn:not(.sGradeItem-processed)").addClass('sGradeItem-processed').bind('click', function() {
    var body = $('body');
    body.toggleClass('assignment-fullscreen-mode');

    $(window).resize();
    // Chrome webkit redraw fix (matching s_external_tool.js implementation)
    body.hide();
    body.outerHeight();
    body.show();

    return false;
  });

  $('body:not(.sGradeItem-processed)', context).addClass('sGradeItem-processed').each(function() {
    var viewInfoClickHandlers;
    var viewStatsClickHandlers;

    $(this).on('grade-item-disable-top-controls', function() {
      $('.grade-item-action-links .action-links-unfold', context).addClass('disabled');

      var viewInfoLink = $('.link-btn.view-info', context);
      if (viewInfoLink.length) {
        if (viewInfoLink.data('events')) {
          viewInfoClickHandlers = viewInfoLink.data('events').click;
          viewInfoLink.data('events').click = null;
        }
        viewInfoLink.addClass('disabled');
        viewInfoLink.tipsy('disable');
      }

      var viewStatsLink = $('.link-btn.view-stats', context);
      if (viewStatsLink.length) {
        if (viewStatsLink.data('events')) {
          viewStatsClickHandlers = viewStatsLink.data('events').click;
          viewStatsLink.data('events').click = null;
        }

        viewStatsLink.addClass('disabled');
        viewStatsLink.tipsy('disable');
        viewStatsLink.click(function(e) { e.preventDefault(); });
      }

      $('.assessment-status-wrapper', context).addClass('disabled');
    });

    $(this).on('grade-item-enable-top-controls', function() {
      $('.grade-item-action-links .action-links-unfold', context).removeClass('disabled');

      var viewInfoLink = $('.link-btn.view-info', context);
      if (viewInfoLink.length) {
        viewInfoLink.removeClass('disabled').tipsy('enable');
        if (viewInfoLink.data('events')) {
          viewInfoLink.data('events').click = viewInfoClickHandlers;
        }
      }

      var viewStatsLink = $('.link-btn.view-stats', context);
      if (viewStatsLink.length) {
        viewStatsLink.removeClass('disabled').tipsy('enable');
        if (viewStatsLink.data('events')) {
          viewStatsLink.data('events').click = viewStatsClickHandlers;
        }
      }

      $('.assessment-status-wrapper', context).removeClass('disabled');
    });
  });
};

function sGradeItemEnableCommentJump(){

	$(".go-to-reply").click(function() {
    var el = $(this).parent().parent().parent().parent();
		if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
      var target = $(this.hash);
			$(target).effect("highlight", {color: "#f9b974"}, 3000);
      target = target.length && target || $('[name=' + this.hash.slice(1) +']');
      if (target.length) {
        var targetOffset = target.offset().top-20;
        $('html,body').animate({scrollTop: targetOffset}, 500);
       return false;
      }
    }
  });
}

/**
 * Ajax plugins callback
 *
 * @param {String} hook
 * @param {Object} args
 * @return {Bool}
 */

Drupal.Ajax.plugins.s_grade_item = function(hook, args) {
  if(hook == 'message') { // response received, return false to hide messages
    var submitter = args.local.submitter;
        formObj = submitter.closest('.post-comment-form');

    if(formObj.length){
      if(typeof args.redirect == 'string' && args.redirect.length > 0){
        window.location.href = args.redirect;
      }
      else{
        var validateOutput = args.ajax_validate_output;
        var submitOutput = args.ajax_submit_output;

        var id = 'comment-container';
        var content = '';
        // Display the submit output if set, otherwise display validate output
        if(submitOutput != undefined)
          content = submitOutput;
        else if(validateOutput != undefined)
          content = validateOutput;

        if($("."+id+" #s_comments").length > 0){ //append to existing comment wrapper
          $("."+id+" #s_comments").fadeIn(5000, function(){
            var contentObj = $(content);
            $("."+id+" #s_comments").append(contentObj);
            Drupal.attachBehaviors(contentObj);
          });
        }
        else{ //create own comment wrapper
          var html = '<div id="s_comments">'+content+'</div>';
          var contentObj = $(html);
          $(".no-comments").replaceWith(contentObj);
          Drupal.attachBehaviors(contentObj);
        }
        var editorObj = formObj.find('.s-tinymce-load-editor');
        if(editorObj.length){
          var ed = tinyMCE.get(editorObj.attr('id'));
          if(ed){
            ed.setContent('');
            ed.save();
          }
        }
        return false;
      }
    }
  }
  return false;
}
