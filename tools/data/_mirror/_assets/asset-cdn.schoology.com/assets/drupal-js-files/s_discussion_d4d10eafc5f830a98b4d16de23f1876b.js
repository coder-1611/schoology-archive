Drupal.behaviors.s_discussion = function(context) {

  var stickyLibLoaded = !!$.fn.sticky,
      hasMutationObserver = typeof MutationObserver !== "undefined",
      isMobile = !!$('.discussion-is-mobile').val(),
      isAnonymous = $('body').hasClass('anonymous'),
      supportSticky = stickyLibLoaded && hasMutationObserver && !isMobile && !isAnonymous;

  $('h2.page-title').addClass('sDiscussion-processed').each(function(){
    var hasDiscussion = !$('.no-discussion').length;
    if(supportSticky){
      if(hasDiscussion){
        $(this).sticky();
      } else {
        $(this).sticky('unstick');
      }
    }
  });

  var entryFormSelector = $('.s-comments-post-form-new').length ? '.s-comments-post-form-new' : '.s-comments-post-form';
  $(entryFormSelector + ":not(.sDiscussion-processed)", context).addClass('sDiscussion-processed').each(function(){
    var hasDiscussion = !$('.no-discussion').length;
    if(supportSticky && hasDiscussion){
      var entryForm = $(this);
      var scrollCallback = function(isSticky){
        if(isSticky){
          $('.mceButton,.infotip', entryForm).each(function(){ if($(this).data('tipsy')) $(this).tipsy('hide'); });
        }
      }
      entryForm.sticky({bindToBottomOf:$('h2.page-title.sDiscussion-processed'), scrollCallback:scrollCallback});
      var target = document.querySelector(entryFormSelector),
          config = { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter:['style']};

      var observer = new MutationObserver(function(mutations) {
        entryForm.sticky('updateHeight');
        entryForm.sticky('update');
      });
      observer.observe(target, config);
    }
  });

  $('.discussion-action-bar:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function(){
    var barObj = $(this);

    if(!barObj.hasClass('disabled')) {
      barObj.on('click', '.scroll-to-top', function(){
        $("html, body").animate({ scrollTop: 0}, 200);
      });

      barObj.on('click', '.collapse-all', function() {
        $('.comment-more-toggle.less').click();
        $('.expander-link-expanded:not(.hidden)').click();
      });

      barObj.on('click', '.expand-all', function(){
        $('.expander-link-collapsed:not(.hidden)').click();
        $('.comment-more-toggle:not(.less)').click();
      });
    }

    var hasDiscussion = !$('.no-discussion').length;
    if(supportSticky && hasDiscussion){
      var scrollCallback = function(isSticky){
        if(isSticky){
          $('.infotip', barObj).each(function(){ if($(this).data('tipsy')) $(this).tipsy('hide'); });
        }
      }

      barObj.sticky({
        bindToBottomOf:$(entryFormSelector + ".sDiscussion-processed"),
        scrollCallback:scrollCallback,
        wrapperClassName:'sticky-wrapper action-bar-wrapper'
      });
    }
  });

	$('.grade-item-action-links:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function () {
		$(this).sActionLinks( { hidden: false, wrapper: '.action-links-wrapper' });
	});

	$('.info-container .view-info:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function () {
		var linkBtn = $(this);

		linkBtn.bind('click', function(){
			var wrapper = $(this).parent();
			$('.grading-info', wrapper).toggle();
			linkBtn.toggleClass('active');
			return false;
		}).tipsy({
	  'gravity': (document.dir == "rtl") ? 'sw' : 'se'
	  });
	});

	$('body').unbind('click.sGradeViewInfo').bind('click.sGradeViewInfo', function(e){
	  var linkBtn = $('.info-container .view-info', context);
	  var target = $(e.target);
	  if(linkBtn.hasClass('active') && target.not('.grading-info') && target.parents('.grading-info').length == 0){
	    linkBtn.click();
	  }
	});

	$('.info-container .link-btn:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function () {
	  $(this).tipsy({
      'gravity': (document.dir == "rtl") ? 'sw' : 'se'
    });
	});

  $('td.discussion-row .action-links-wrapper:not(.s_discussion-processed)').addClass('s_discussion-processed').each(function(){
    $(this).sActionLinks({hidden: false,wrapper: '.action-links-wrapper'});
  });

  // Discussion edit form
  $('#s-discussion-edit-discussion-form:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function(){
    var form = $(this);
    $('#edit-edit-body',form).elastic();

    sPopupsResizeCenter();

    $(document).bind('popups_before_remove',function(){
      sAttachmentMoveForm( $('#s-comments-post-comment-form') , '#edit-comment-wrapper' );
    });
  });

  $('span.reorder:not(.sDiscussion-processed)').addClass('sDiscussion-processed').each(function(){
    $(this).bind('click',function(){
      $('table a.tabledrag-handle').show();
      $('table div.handle').show();
      $('.reorder-submit-buttons').show();
    });
  });

  $('#s-discussion-copy-discussion-form:not(.sDiscussion-processed)').addClass('sDiscussion-processed').each(function(){
	  var form = $(this);
	  sDiscussionSetupDates(form);
  });

  // Discussion create form
  $("#s-discussion-create-form:not(.sDiscussion-processed)", context).addClass('sDiscussion-processed').each(function(){

	  var form = $(this);
    sDiscussionSetGradingOptionsDisplay($('.enable-grading'), $('#copy-to-courses', form));

    $("input.pre-fill-title", form).focus(function(){
      if($(this).val()=='Title (required)'){
        if($(this).hasClass('pre-fill-title'))
          $(this).removeClass('pre-fill-title');
        $(this).val('');
      }
    }).blur(function(){
      if($(this).val()==''){
        $(this).addClass('pre-fill-title');
        $(this).val(Drupal.t('Title (required)'));
      }
    });

    $('.enable-grading').click(function(){
    	sDiscussionSetGradingOptionsDisplay($(this), form);
    });

    sDiscussionSetupDates(form);

    //fix the title
    $("#edit-title-wrapper input.pre-fill-title", form).focus(function(){
      if($(this).val()=='Title (required)'){
        if($(this).hasClass('pre-fill-title'))
          $(this).removeClass('pre-fill-title');
        $(this).val('');
      }
    }).blur(function(){
      if($(this).val()==''){
        $(this).addClass('pre-fill-title');
        $(this).val(Drupal.t('Title (required)'));
      }
    });

    //fix the body
    $("#edit-post-wrapper textarea.pre-fill-body", form).each(function(){
      var defaultPost = $(this).attr('title');
      $(this).elastic().focus(function(){
        if($(this).val()==defaultPost){
          if($(this).hasClass('pre-fill-body'))
            $(this).removeClass('pre-fill-body');
          $(this).val('');
        }
      }).blur(function(){
        if($(this).val()==''){
          $(this).val(defaultPost);
          $(this).addClass('pre-fill-body');
        }
      });
    });

    var copyToCourseBtn = $('.toggle-copy', form),
        shareToggle = $(".toggle-shared", form),
        shareCheckbox = $('.adv-option-shared', form),
        shareDetails = $('#shared-details', form),
        shareCheckboxes = $('.form-checkbox', shareDetails),
        copyCheckboxes = $('#addl-courses input.addl-realm-enabled-checkbox', form);

    copyCheckboxes.bind('click',function(){
      var disp = $(this).is(':checked') ? "block" : "none";
      $('.addl-course-options' , $(this).parents('.addl-course')).css('display',disp);
    });

    // disable shared discussion if copying to any courses
    $("#copy-to-courses input.addl-realm-enabled-checkbox", form).each(function(){
      $(this).click(function(){
        var checkedCopy = $("input.addl-realm-enabled-checkbox:checked", $(this).parents("#copy-to-courses"));
        if(checkedCopy.length > 0){
          $("#edit-shared-wrapper, #shared-details").each(function(){
            $('input', $(this)).attr('disabled', 'disabled');
          });
          shareToggle.removeClass('adv-option-on').addClass('disabled').attr('disabled-title', Drupal.t('You cannot share a copied discussion'));
          shareCheckbox.prop('checked', false);
        }
        else {
          $("#edit-shared-wrapper, #shared-details").each(function(){
            $('input', $(this)).attr('disabled', false);
          });
          shareToggle.removeClass('disabled');
        }

        sPopupsResizeCenter();
      });
    });

    // hide the shared details box when clicking elsewhere on the form
    form.bind('click', function(e){
      var target = $(e.target);
      if(!target.is('#shared-details') &&
        !target.is('.toggle-shared') &&
        target.closest('#shared-details').length == 0 &&
        target.closest('.toggle-shared').length == 0 &&
        shareDetails.is(':visible')){
        shareDetails.hide();
      }
    });

    // disable copy to courses when enabling shared discussion
    var sharedFields = $('.shared-fields', form);
    var csmNodeAssign = $('.csm-node-assign-wrapper', form);
    shareCheckboxes.bind('click', function(){
      var shareEnabled;
      if(shareCheckboxes.is(':checked')){
        copyToCourseBtn.addClass('disabled').attr('disabled-title', Drupal.t('You cannot copy a shared discussion'));
        shareToggle.addClass('adv-option-on');
        copyCheckboxes.prop('disabled', true);
        shareEnabled = true;
      }
      else{
        copyToCourseBtn.removeClass('disabled');
        shareToggle.removeClass('adv-option-on');
        copyCheckboxes.prop('disabled', false);
        shareEnabled = false;
      }

      if(shareEnabled != !sharedFields.hasClass('hidden')){
        sharedFields.toggleClass('hidden', !shareEnabled);
        csmNodeAssign.toggleClass('hidden', shareEnabled);
        sPopupsResizeCenter();
      }

      shareCheckbox.prop('checked', shareToggle.hasClass('adv-option-on'));
    });

    shareToggle.click(function(){
      if(!$(this).hasClass('disabled')){
        if(shareDetails.is(':visible')){
          shareDetails.hide();
        } else {
          shareDetails.show();
        }

        sPopupsResizeCenter();
      }
    });

    $('.shared-close-btn' , $(this) ).bind('click',function(){
      shareDetails.hide();
    });

    // remove time value for all-day due event
    if( $('#edit-has-time', form).val() == '0' )
      $( 'input[name="due_date[time]"]' , $('#edit-due-date-wrapper' , form)).val("");
  });

  // tags dropdown for discussions list
  $('.tag-selector:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function(){
    var tagSelector = $(this);
    var tagList = $('.item-list .action-links', tagSelector);
    $('.tag-filter-select', tagSelector).bind('click', function(){
      tagList.toggle();
    });
    $('body:not(.s-discussion-tag-selector-processed)').addClass('s-discussion-tag-selector-processed').click(function(e){
      var clickTarget = $(e.target);
      if(!clickTarget.hasClass('tag-filter-select') && clickTarget.parents('.tag-filter-select').length == 0){
        tagList.hide();
      }
    });
  });

  // share courses for single course discussion view
  $(".course-discussion #share-courses-toggle:not(.sDiscussion-processed)", context).addClass('sDiscussion-processed').each(function(){
    $("#s-discussion-share-realms-form").hide();
    $(this).click(function(){
      $("#s-discussion-share-realms-form").toggle();
      return false;
    });
  });


  $("#s-discussion-edit-tags-form span.cancel-btn:not(.sDiscussion-processed)").addClass('sDiscussion-processed').each(function(){
    $(this).bind('click',function(){
      var popup = Popups.activePopup();
      if(popup) popup.close();
    });
  });

  // tags autocomplete
  $("form #edit-tags-wrapper:not(.sDiscussion-processed)", context).addClass('sDiscussion-processed').each(function(){
    var wrapper = $(this);
    var selectedTags = [];
    // autocomplete
    $("#edit-tags", wrapper).autocomplete(Drupal.settings.s_private_taxonomy.avail_terms, {
      minChars: 0,
      width: 310,
      mustMatch: false,
      matchContains: true,
      scroll: false,
      multiple: true
    });

    $(".recent-terms .term", wrapper).each(function(){
      $(this).click(function(){
        var clickedTag = $(this).text();
        // check to make sure that the tag wasn't already added
        var terms = $("#edit-tags", wrapper).val().split(',');
        var newTerms = []
        for(var i in terms){
          var term = terms[i].replace(/^\s+|\s+$/g,"");
          if(term == clickedTag)
            return;
          if(term.length > 0)
            newTerms.push(term);
        }
        newTerms.push(clickedTag);
        var joinedTerms = newTerms.join(', ');
        joinedTerms.replace(', ,',',');
        $("#edit-tags", wrapper).val(joinedTerms);
      });
    });
  });

  if(typeof tinyMCE != 'undefined'){
    // the comment input usually initialize when the user focuses on the textarea
    // since there are many of these on the homepage
    // but the one on the discussion page can be initialized on page load since there is only one of them
    $('.discussion-content #edit-comment.s-tinymce-load-editor:not(.sDiscussion-processed), .s-comments-post-form-new #edit-comment.s-tinymce-load-editor:not(.sDiscussion-processed)', context).addClass('sDiscussion-processed').each(function(){
      var textareaObj = $(this),
          id = textareaObj.attr('id'),
          editor = tinyMCE.get(id);
      if(!editor){
        sTinymceInit({
          elements: id,
          toolbar: 'discussion'
        });
      }
    });
  }

  $("#comment-navigator:not(.sDiscussion-processed)", context).addClass('sDiscussion-processed').each(function(){
    var wrapper     = $(this);
    var numComments = $('.num-comments', wrapper).text();
    isDeleted       = isCommentDeleted(numComments); //(SGY-355)

    // initialize to display the info for the last comment
    populateNavInfo(extractCommentInfo(numComments), false, isDeleted);
    $("#comment-navigator .next").addClass('disabled');
    wrapper.fadeIn();

    var timelineExpanded = sUserGetUISettings('s_discussion', 'timeline_expanded');
    wrapper.data('hidden', !timelineExpanded);
    var bodyObj = $(body);
    if(!bodyObj.data('wrapperAnimateXDist')){
      var wrapperAnimateXDist = 0;
      wrapperAnimateXDist += parseInt(wrapper.css('right'));
      wrapperAnimateXDist += parseInt(wrapper.css('padding-right'));
      wrapperAnimateXDist += $("td:eq(1)", wrapper).width();
      bodyObj.data('wrapperAnimateXDist', wrapperAnimateXDist);
    }
    else{
      wrapperAnimateXDist = bodyObj.data('wrapperAnimateXDist');
    }

    var hideTimeline = function(toggleObj, animate){
      if(animate){
        wrapper.animate({"right": "-="+wrapperAnimateXDist+"px"}, 'slow');
      }
      else{
        wrapper.css("right", "-="+wrapperAnimateXDist+"px");
      }
      toggleObj
        .removeClass('show')
        .addClass('hide')
        .find('.visually-hidden')
        .text(Drupal.t('Hide Comment Navigator.'));
    };

    var showTimeline = function(toggleObj, animate){
      if(animate){
        wrapper.animate({"right": "+="+wrapperAnimateXDist+"px"}, 'slow');
      }
      else{
        wrapper.css("right", "+="+wrapperAnimateXDist+"px");
      }
      toggleObj
        .removeClass('hide')
        .addClass('show')
        .find('.visually-hidden')
        .text(Drupal.t('Show Comment Navigator.'));
    };

    var sliderToggler = $(".slide-toggler-cell a", wrapper);
    if(!timelineExpanded){
      hideTimeline(sliderToggler, false);
    }
    sliderToggler.click(function(){
      var wrapperHidden = wrapper.data('hidden');
      if(wrapperHidden){
        showTimeline(wrapper, true);
        wrapper.data('hidden', false);
      } else {
        hideTimeline(wrapper, true);
        wrapper.data('hidden', true);
      }
      //use wrapperHidden since if wrapperHidden was true it'll now be expanded
      sUserSetUISettings('s_discussion', 'timeline_expanded', wrapperHidden);
      return false;
    });


    if(numComments < 2){
      $("#comment-navigator .prev").addClass('disabled');
      return;
    }

    $(".nav-buttons", wrapper).click(function(e){
      var target = $(e.target).parent();
      var commentNum = wrapper.data('selectedCommentNum');
      if(target.hasClass('next')){
        commentNum++;
      } else if(target.hasClass('prev')){
        commentNum--;
      } else {
        return false;
      }
      if(commentNum <= 1){
        $("#comment-navigator .prev").addClass('disabled');
      } else {
        $("#comment-navigator .prev").removeClass('disabled');
      }
      if(commentNum >= numComments){
        $("#comment-navigator .next").addClass('disabled');
      } else {
        $("#comment-navigator .next").removeClass('disabled');
      }
      if(commentNum == 0 || commentNum > numComments){
        return false;
      }
      isDeleted = isCommentDeleted(commentNum);
      populateNavInfo(extractCommentInfo(commentNum), true, isDeleted);

      return false;
    });

    $(".highlight-comment", wrapper).click(function(){
      var selectedCommentNum = wrapper.data('selectedCommentNum');
      highlightCommentNum(selectedCommentNum);
      return false;
    });
  });

  $('#s_comments:not(.sDiscussion-processed)', context).addClass('.sDiscussion-processed').each(function(){
	  	var commentContext = this;
	  	var loader = '<img src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" class="loader" alt="' + Drupal.t('Loading') + '" />';
      var removeException = function(el) {
        var form = el.closest('#s-discussion-grade-post-form');
        form.find('#edit-exception').val(0);
        form.find('.grade-exception-icon').remove();
        form.find('.grade-exception-wrapper').remove();
        form.removeClass('has-exception');
      };
      $(document).on('keydown', '#edit-full-credit', function(e) {
        removeException($(e.target));
      });
      $(document).on('gradingRubricTotalGradeUpdate', function(e, el) {
        removeException($(el));
      });
	    $('a.comment-grade', this).each(function(){
	    	var button = $(this);
	    	var cgWrapper = button.parents('.comment-grade-wrapper');
	    	$(this).click(function(e){
                  $('.comment-grade').removeClass('active');
                  var href = $(this).attr('href');
                  var parent = $(this).parents('.comment:first');
                  /*
                    * Old tactic was to move the form once retrieved.  That was not playing nicely with the rubric form.
                    * Since user still had to go back to server to retrieve the info, we were not saving that much (except some bandwidth on small form)
                    * I am removing the form moving tactic
                    */
                  if(!$('.fake-menu-wrapper', parent).length){
                    cgWrapper.after('<div class="fake-menu-wrapper">' + loader + '</div>');
                    var fMenu = $('.fake-menu-wrapper', parent);
                    $.ajax({
                      type: 'GET',
                      url: href,
                      dataType: 'json',
                      success: function(data){
                        sAngular.extractThemeData(data);
                        fMenu.append(data.output);
                        $('.loader', parent).hide();
                        $('body').bind('click', function(e){
                          var bodyTarget = $(e.target);
                          if(!(bodyTarget.parents('.rubric-grades-edit').length > 0) && !(bodyTarget.parents('.grading-scale-ac-popup').length > 0) && !(bodyTarget.parents('.fake-menu-wrapper:first').length > 0) && !(bodyTarget.parents('.comment-grade').length > 0) && !bodyTarget.is('.comment-grade')){
                            fMenu.hide();
                            $('.comment-grade.active').removeClass('active');
                          }
                        });
                        $('#grade-discussion-close-button', fMenu).click(function(e){
                          fMenu.hide();
                          $('a.comment-grade.active', commentContext).removeClass('active');
                          e.preventDefault();
                        });
                        $('.cancel-btn', fMenu).click(function(e){
                          fMenu.hide();
                          $('a.comment-grade.active', commentContext).removeClass('active');
                          e.preventDefault();
                        });
                        button.addClass('active');
                        Drupal.attachBehaviors(fMenu);
                        $('.grade-exception-icon').tipsy({
                          gravity: 's',
                          title: function() {
                            return $(this).attr('alt');
                          }
                        });
                        $('#edit-full-credit').unbind('sGradingScaleSelectionMade').bind('sGradingScaleSelectionMade', function (e) {
                          removeException($(e.target));
                        });
                      }
                    });
                  }
                  else{
                    var fMenu = $('.fake-menu-wrapper', parent);
                    fMenu.toggle();
                    if(fMenu.is(':visible')){
                      button.addClass('active');
                    }
                    else{
                      button.removeClass('active');
                    }

                  }
                  e.preventDefault();
	    	});
	    });
  });

  $("#highlight-user-wrapper .dropdown-wrapper:not(.disabled,.sDiscussion-processed)", context).addClass('sDiscussion-processed').each(function(){
    // not supported in IE7
    if ($.browser.msie && ($.browser.version == '6.0' || $.browser.version == '7.0')) {
      $(this).remove();
      return;
    }
    else {
      $(this).show();
    }

    var wrapper = $(this);
    var infotipObj = $('.infotip', wrapper);
    $(".dropdown-toggle:not(.bound)", wrapper).addClass('bound').click(function(){
      if($(wrapper).hasClass('open')){
        $(wrapper).removeClass('open');
      }
      else{
        $(wrapper).addClass('open');
        infotipObj.tipsy('hide');
      }
    });

    var comments = $("#s_comments");
    var userFiltered = false;
    var blueBar = $('.discussion-action-bar', context);
    var postCount = $('.post-count', blueBar);
    var defPostCount = parseInt(postCount.text());
    var defPostCount = Drupal.formatPlural(defPostCount, '1 Post', '@count Posts');
    var unreadCount = $('.discussion-unread-counter', blueBar);
    var defUnreadCount = parseInt(unreadCount.text());

    function closeDropdown(filterWrapper){
      var authorID = filterWrapper.attr('id').split('-')[3];

      return function(){
          $('.comment-by-' + authorID, comments).removeClass('on-top');;
          filterWrapper.removeClass('on-top');

          $('.user-stats-clear-filter', filterWrapper).empty();
          userFiltered = false;
          postCount.html(defPostCount);
          unreadCount.html(defUnreadCount);

          $('.x-button', blueBar).remove();
          $('.profile-preview', blueBar).remove();
          $('.dropdown-toggle-text', blueBar).text(Drupal.t('Highlight User'));
          $('.profile-picture-placeholder', blueBar).show();
          infotipObj.removeClass('enabled');
          infotipObj.tipsy('hide');
      }
    }

    var bodyObj = $('body');
    var dropdownWrapper = $('.dropdown-wrapper', bodyObj);
    bodyObj.on('click', function(e){
      var targetObj = $(e.target);
      if(dropdownWrapper.hasClass('open') && !targetObj.closest('.dropdown-wrapper, .dropdown-menu,.discussion-user-filter').length){
        dropdownWrapper.removeClass('open');
      }
    });


    $(".discussion-user-filter:not(.unclickable)", wrapper).click(function(){
      var filterWrapper = $(this);
      var authorID = filterWrapper.attr('id').split('-')[3];
      var overlay = $("#discussion-overlay");

      // we are overriding our highlight so lets very quickly undo the current highlighting
      if(userFiltered){
        var xButton = $('.x-button', blueBar);
        if(xButton.length){
          xButton.click();
        }
      }

      var doc = $(document);
      $('.comment-by-' + authorID, comments).addClass('on-top');
      filterWrapper.addClass('on-top');
      $('.user-stats-clear-filter', filterWrapper).html(' - ' + Drupal.t('clear filter'));
      userFiltered = true;

      //set the post and unread counter in the blue bar to user's post count and unread count
      var userPostCount = $('.user-stats-num', filterWrapper).attr('count');
      userPostCount = Drupal.formatPlural(userPostCount, '1 Post', '@count Posts');
      var userUnreadCount = $('.user-unread-num', filterWrapper).attr('count');
      postCount.html(userPostCount);
      unreadCount.html(userUnreadCount);

      //expand all threads containing user as a reply
      var commentsWrapper = $('#s_comments');
      $('.expander-link-collapsed:not(.hidden)', commentsWrapper).each(function(e){
        var linkObj = $(this);
        var threadWrapper = linkObj.closest('.discussion-card');
        var hasUser = $('.comment-by-' + authorID, threadWrapper).length > 0;
        if(hasUser){
          linkObj.click();
        }
      });

      // Adjust dropdown to reflect selected user
      var userFullName = $(".on-top .user-stats-name", blueBar).text();
      $(".dropdown-toggle-text", blueBar).text(userFullName);
      $(".dropdown-wrapper", blueBar).removeClass('open');
      var xButton = $('<div class="x-button"></div>');
      xButton.click(closeDropdown(filterWrapper));
      $('.dropdown-wrapper', blueBar).after(xButton);

      var profilePreview = $('.profile-picture', filterWrapper).clone().addClass('profile-preview');
      $('#highlight-user-wrapper .profile-picture-placeholder', blueBar).hide();
      $('#highlight-user-wrapper .dropdown-toggle', blueBar).prepend(profilePreview);
      infotipObj.addClass('enabled');
    });

    infotipObj.mouseover(function(){
      if(infotipObj.hasClass('enabled')){
        infotipObj.tipsy('show');
      }
      else{
        infotipObj.tipsy('hide');
      }
    }).mouseout(function(){
      infotipObj.tipsy('hide');
    });

    $(window).keydown(function(e){
      if (!e) {
          e = window.event;
      }
      if(e.keyCode == 27){
        var filteredUserName = $("#discussion-user-stats .on-top");
        if(filteredUserName.length){
          filteredUserName.trigger('click');
        }
      }
    });
  });

  // prompt to post pending changes
  window.onbeforeunload = function(){
    var pendingPost = $('#s-comments-post-comment-form  .form-to-hide:visible .submit-span-wrapper').not('.disabled');
    var pendingReply = $('#comment-reply-form-wrapper:visible #s-comment-reply-form .submit-span-wrapper').not('.disabled');
    if ( pendingPost.length + pendingReply.length == 0 ) {
      return;
    }
    return Drupal.t('You haven\'t finished your post yet. If you navigate away from this page, your post will be deleted.');
  };

  if ($('body').hasClass('s-enable-mathml')) {
    s_renderMath();
  }
}

// Navigator helper functions

//determine if deleted comment, leads to different display (SGY-355)
function isCommentDeleted(commentNum) {
  commentClass = ".comment-num-" + commentNum;
  comment      = $(commentClass, $('#s_comments'));
  if(comment.hasClass('deleted')) {
    return true;
  }
  return false;
}

function extractCommentInfo(commentNum){

  var commentClass = ".comment-num-" + commentNum;
  var comment      = $(commentClass, $('#s_comments'));
  var commentInfo  = new Object();
  var authorName   = $(".comment-top .comment-author", comment).children().eq(0).clone();
  var commentDate  = $(".comment-time .gray", comment).text();

  if(authorName.length == 0) {
    authorName  = $('.deleted-comment:only-child', comment).clone();
  }

  commentInfo.commentNum  = commentNum;
  commentInfo.authorLink  = authorName;
  commentInfo.commentDate = commentDate;
  return commentInfo;
}

// @param deleted boolean
function populateNavInfo(info, scroll, deleted){
  var wrapper     = $("#comment-navigator");
  var commentText = Drupal.t('Posted by ');
  if(deleted) {
    commentText = '';
  }
  $("span.comment-num", wrapper).html(info.commentNum);
  $('span.comment-meta').html(commentText); //empty str if deleted
  $("span.comment-author", wrapper).empty().append(info.authorLink);
  $("span.comment-date", wrapper).html(info.commentDate); //empty str if deleted
  wrapper.data('selectedCommentNum', info.commentNum);

  if(scroll)
    highlightCommentNum(info.commentNum);
}

function highlightCommentNum(commentNum){
  var commentClass=".comment-num-" + commentNum;
  var comment = $(commentClass, $('#s_comments'));

  var targetOffset = comment.offset().top-300;
  $('html,body').stop();
  $('html,body').animate({scrollTop: targetOffset}, 500);
  comment.effect("highlight", {color: "#f9b974"}, 3000);
}

function sDiscussionEditThreadCallback(data, options, element){
  window.location.reload();
}

function sDiscussionSetGradingOptionsDisplay(input, context){

  if($(input).is(':checked')) {
    $('div.addl-grading-options-wrapper').each(function(){
      $(this).removeClass('hidden');
    });

    $('.grading-options-wrapper').show();
    $('.grading-scale-select-grouping').show();
    $('.toggle-shared').hide();
    $('.toggle-count-in-grade').show();

    sDiscussionEnableCCInfotip(context);
  }
  else {
    $('div.addl-grading-options-wrapper').each(function(){
      $(this).addClass('hidden');
    });

    $('.grading-options-wrapper').hide();
    $('.grading-scale-select-grouping').hide();
    $('.toggle-shared').show();
    $('.toggle-count-in-grade').hide();

    sDiscussionDisableCCInfotip(context);
  }
  sPopupsResizeCenter();
}

function sDiscussionSetupDates(form){
    $('.due-date, .csm-due-date', form).each(function(){
    	var timeContext = $(this);
    	var parent = $(this).parents('.discussion-date-wrapper:first,.csm-node-assign-section:first');
    	timeContext.blur(function(){
			setTimeout(function(){
				var timeInput = $('div.time-input input', parent);
				if(timeContext.val() != '' && timeInput.val() == ''){
          let date_strings = Drupal.date_t_strings();
          let am_pm_long = date_strings.ampm.slice(2, 4);
					timeInput.val('11:59' + am_pm_long[1]);
				}
			},200);
    	});
    });
}

/**
 * Reenable the infotip for copy to course courses without categories if enable grading is checked
 */
function sDiscussionEnableCCInfotip(context) {
  $("span.infotip:not(.rule-infotip)", context).each(function () {
    var item = $(this);
    var parent = item.parents('.addl-course:first');
    var checkbox = $('.form-checkbox', parent);

    checkbox.attr('checked', false);
    // Courses without categories cannot be selected for copying to
    if (item.hasClass('no-category-cluetip')) {
      checkbox.attr('disabled', 'disabled');
    }
    $('.addl-course-options', parent).hide();
    if (item.hasClass('infotip-disabled')) {
      item.removeClass('infotip-disabled');
    }
    //rebind the tipsy
    item.tipsy({
      html: true,
      gravity: item.attr('tipsygravity'),
      title: function () {
        return $('.infotip-content', item).html();
      }
    });
  });
}

/**
 * Disable copy to course infotip for courses without categories and allow user to copy to those courses if enable grading is unchecked
 */
function sDiscussionDisableCCInfotip(context){
	$("span.infotip:not(.rule-infotip)", context).each(function(){
		var item = $(this);
		var checkbox = $('.form-checkbox', item.parents('.addl-course:first'));
		checkbox.attr('disabled', false);
		item.unbind('mouseenter mouseleave');
		item.addClass('infotip-disabled');
	});
}
