Drupal.behaviors.sHome = function(context){
  var settingsHome = Drupal.settings.s_home;
  var DEFER_LOADING = 'defer';
  var DISABLE_LOADING = 'disable';

  $('#smart-box:not(.sHome-processed)' , context ).addClass('sHome-processed').each(function(){
    var smartBoxObj = $(this);
    var _s_home_smartbox_tab_clicked = false;

    // Handle cancel buttons and clicking on 'active' button
    smartBoxObj.bind('click', function(e){
      var wrapper = $(this);
      var contentWrapper = $("#smart-box-content", wrapper);
      var target = $(e.target);
      if(target.attr('id') == 'edit-cancel' || target.parents('#edit-cancel').length > 0){
        sHomeResetSmartBox();
        return false;
      }
    });

    $('#smart-box-more-wrapper' , smartBoxObj ).sActionLinks({hidden: false, wrapper: '.action-links-wrapper'});

    $('.filter-block li', smartBoxObj).removeClass('active');
    $('.filter-block li span', smartBoxObj).removeClass('active');
    $('#smart-box-content' , smartBoxObj).children().not(':nth-child(1)').hide();

    $('.filter-block li .smartbox-boxtab', smartBoxObj ).click(function(e){
      if(_s_home_smartbox_tab_clicked)
        return true;
      e.preventDefault();

      $(this).sActionLinks({hide_all: true});

      var links = $(this).parents('.filter-block');
      var currSelectedIndex = links.data('selected');

      if(currSelectedIndex == undefined)
        currSelectedIndex = -1;

	    var tab_id = $(this).attr('id').replace(/[^0-9]/gi,'');
      var newIndex = parseInt(tab_id);

      // if selecting a new tab
      if(newIndex != currSelectedIndex) {
         links.data('selected', newIndex);

        // remove active class from the old link and hide its associated content
        links.children().eq(currSelectedIndex).removeClass('active');
        $('#smart-box-tab-content-' + String(currSelectedIndex)).empty().hide();

        // add the 'active' class to the new link and show assoc. content
        var newContainer = $('#smart-box-tab-content-' + String(newIndex));
        newContainer.html('<div id="smart-box-loader"><span class="throbber"></span></div>').show();

        links.children().eq(newIndex).addClass('active').data('selected', newIndex);

        // Update aria-label on the newly active tab button to indicate cancel action
        var newButton = links.children().eq(newIndex).find('.smartbox-boxtab');
        if (newButton.length && newButton.data('tab-title')) {
          newButton.attr('aria-label', window.sgyModules.Utils.i18n.t('core.cancel_title', {title: newButton.data('tab-title')}));
        }

        _s_home_smartbox_tab_clicked = true;

        var tab_exclude = Drupal.settings.s_smart_box && Drupal.settings.s_smart_box.exclude ? Drupal.settings.s_smart_box.exclude : '';

        $.ajax({
          url: '/home/tabsjs/' + String(newIndex) + '/' + String(tab_exclude),
          dataType: 'json',
          type: 'GET',
          success: function(response, status){
            newContainer.hide().empty().prepend(response.data);
            links.children().not('.active').addClass('inactive');
            // trigger event for form loaded
            $(document).trigger('s_event_add_combined_form_loaded', [newContainer]);
          },
          error: function(response, status){
            newContainer.hide().empty().prepend('<div class="messages error">' + Drupal.t('There was an error loading this tab.  Please check your connection and try again.') + '</div>');
          },
          complete: function(response, status){
            newContainer.fadeIn('fast');
            _s_home_smartbox_tab_clicked = false;
            Drupal.attachBehaviors(newContainer);
          }
        });
      }
      else {
        sHomeResetSmartBox();
      }
    });
  });

  $('#smart-box textarea:not(.sHome-processed)' , context ).addClass('sHome-processed').each(function(){
    $(this).elastic();
  });

  // Right Column
  $('#right-column:not(.sHome-processed)', context).addClass('sHome-processed').each(function() {
    var $rightColumn = $(this);
    var $remindersWrapper = $('.reminders-wrapper', $rightColumn);

    var reminders = settingsHome && settingsHome.reminders;
    switch (reminders) {
      case DEFER_LOADING:
        $remindersWrapper.show();
        var $remindersRefreshWrapper = $remindersWrapper.find('.reminders-content .refresh-wrapper');
        $remindersRefreshWrapper.find('.refresh-button').on('click', function() {
          $remindersWrapper.find('.more-loading').show();
          $remindersRefreshWrapper.find('> p').each(function() {
            var $element = $(this);
            if (!$element.hasClass('more-loading')) {
              $element.hide();
            }
          });
          getCourseReminders($remindersWrapper, 0);
        });
        break;
      case DISABLE_LOADING:
        $remindersWrapper.show();
        break;
      default:
        $remindersWrapper.find('.more-loading').show();
        getCourseReminders($remindersWrapper, 0, true);
        break;
    }

    var upcoming = settingsHome && settingsHome.upcoming;
    switch (upcoming) {
      case DEFER_LOADING:
        var $upcomingRefreshWrapper = $rightColumn.find('.upcoming-list .refresh-wrapper');
        $upcomingRefreshWrapper.find('.refresh-button').on('click', function() {
          $upcomingRefreshWrapper.find('> p').each(function() {
            var $element = $(this);
            if (!$element.hasClass('more-loading')) {
              $element.hide();
            }
          });
          $rightColumn.find('.upcoming-list .more-loading').show();
          loadUpcomingEvents($rightColumn);
          loadUpcomingSubmissions($rightColumn);
          loadOverdueItems($rightColumn);
        });
        break;
      case DISABLE_LOADING:
        break;
      default:
        $rightColumn.find('.upcoming-list .more-loading').show();
        loadUpcomingEvents($rightColumn);
        loadUpcomingSubmissions($rightColumn);
        loadOverdueItems($rightColumn);
        break;
    }

    var recentlyCompleted = settingsHome && settingsHome.recentlyCompleted;
    var $recentlyCompletedWrapper = $('.recently-completed-wrapper', $rightColumn);
    var $recentlyCompletedRefreshWrapper = $rightColumn.find('.recently-completed-list .refresh-wrapper');
    switch (recentlyCompleted) {
      case DEFER_LOADING:
        $recentlyCompletedWrapper.show();
        $recentlyCompletedRefreshWrapper.find('.refresh-button').on('click', function() {
          $recentlyCompletedRefreshWrapper.find('> p').each(function() {
            var $element = $(this);
            if (!$element.hasClass('more-loading')) {
              $element.hide();
            }
          });
          $recentlyCompletedRefreshWrapper.find('.more-loading').show();
          loadRecentlyCompleted($recentlyCompletedWrapper, false);
        });
        break;
      case DISABLE_LOADING:
        $recentlyCompletedWrapper.show();
        break;
      default:
        loadRecentlyCompleted($recentlyCompletedWrapper, true);
        break;
    }
  });

  $('.profile-picture-wrapper.own-picture:not(.sHome-processed)', context).addClass('sHome-processed').each(function() {
    var wrapper = $(this);
    var pic = $('.profile-picture', wrapper);
    pic.bind('s_profile_picture_uploaded', function(e, path){
      $('img', $(this)).attr('src', path).removeAttr('height');
    });
  });

  var $moreButton = $('#smart-box-more-wrapper span[role="button"]');
  if ($moreButton.length) {
    // Helper function to check if button is active and escape key is pressed
    function isActiveButtonEscapePressed($button, event) {
      return $button.hasClass('active') && isEscapeKeyEvent(event);
    }
    
    // Helper function to handle the escape key action
    function handleEscapeAction(shouldFocus) {
      return function(event) {
        if (isActiveButtonEscapePressed($moreButton, event)) {
          if (shouldFocus) {
            $moreButton.focus();
          }
          $moreButton.click();
        }
      };
    }

    // Add keydown handler to the more button
    $moreButton.on('keydown', handleEscapeAction(false));

    // Find and handle keydown events on the action links
    var $ul = $moreButton.next('ul.action-links');
    if ($ul.length) {
      $ul.on('keydown', handleEscapeAction(true));
    }
  }
};

/**
 * Used to fetch and attach the course reminders block (ungraded submissions, resubmissions, etc.) to the home page.
 *
 * @param {jQuery} $remindersWrapper
 * @param {number} retry - The number of times we want to retry the AJAX.
 * @param {boolean} [removeIfEmpty] - Whether the reminders block should be removed if empty.
 */
function getCourseReminders($remindersWrapper, retry, removeIfEmpty) {
  $.ajax({
    url: '/home/course_reminders_ajax' + (retry ? '?retry=' + retry : ''),
    dataType: 'json',
    type: 'GET',
    success: function(response) {
      if (response.retry_in) {
        // after the specified retry time, retry getting the course reminders
        setTimeout(function() {
          getCourseReminders($remindersWrapper, retry + 1, removeIfEmpty);
        }, response.retry_in);
      } else if (response.html) {
        $remindersWrapper.show();
        $remindersWrapper.html(response.html);
        Drupal.attachBehaviors($remindersWrapper);
        sCourseSetupTodoList($remindersWrapper);
      } else {
        if (removeIfEmpty) {
          $remindersWrapper.remove();
        } else {
          $remindersWrapper.show();
          $remindersWrapper.find('.reminders-content').html('<div class="empty">' + Drupal.t('No current reminders') + '</div>');
        }
      }
    }
  });
}


/**
 * Fetch and attach overdue items to the home page
 *
 * @param {jQuery} $rightColumn
 */
function loadOverdueItems($rightColumn) {
  var $overdueSubmissionsWrapper = $('.overdue-submissions-wrapper', $rightColumn);

  if ($overdueSubmissionsWrapper.length) {
    $.ajax({
      url: '/home/overdue_submissions_ajax',
      dataType: 'json',
      type: 'GET',
      success: function(response) {
        if (response.html.length > 0) {
          $overdueSubmissionsWrapper.html($(response.html).children());
          Drupal.attachBehaviors($overdueSubmissionsWrapper);
        }
      }
    });
  }
}

/**
 * Fetch and attach upcoming submissions to the home page
 *
 * @param {jQuery} $rightColumn
 */
function loadUpcomingSubmissions($rightColumn) {
  var toDoSubmissionsWrapper = $('.todo-wrapper', $rightColumn);
  var upcomingWrapper = $('.upcoming-submissions-wrapper', $rightColumn);

  if (upcomingWrapper.length > 0) {
    $.ajax({
      url: '/home/upcoming_submissions_ajax',
      dataType: 'json',
      type: 'GET',
      success: function (response) {
        if (response.html.length > 0) {
          upcomingWrapper.html($(response.html).children());
          Drupal.attachBehaviors(upcomingWrapper);
        }
      }
    });
  }
}

/**
 * Fetch and attach upcoming events to the home page
 *
 * @param {jQuery} $rightColumn
 */
function loadUpcomingEvents($rightColumn) {
  var upcomingWrapper = $('.upcoming-events', $rightColumn);
  if (upcomingWrapper.length > 0) {
    $.ajax({
      url: '/home/upcoming_ajax',
      dataType: 'json',
      type: 'GET',
      success: function (response) {
        upcomingWrapper.html($(response.html).children());
        Drupal.attachBehaviors(upcomingWrapper);
      }
    });
  }
}

/**
 * Fetch and attach Recently Completed items to the home page
 *
 * @param {jQuery} $recentlyCompletedWrapper
 * @param {boolean} $enabled true when recently completed block is enabled(default) and false otherwise
 */
function loadRecentlyCompleted($recentlyCompletedWrapper, $enabled) {
  var $recentlyCompletedList = $('.recently-completed-list', $recentlyCompletedWrapper);
  if ($recentlyCompletedWrapper.length) {
    $.ajax({
      url: '/home/recently_completed_ajax',
      dataType: 'json',
      type: 'GET',
      success: function(response) {
        if (response.html.length > 0) {
          // when recently completed items are available
          $recentlyCompletedWrapper.show();
          $recentlyCompletedList.html(response.html);
          Drupal.attachBehaviors($recentlyCompletedWrapper);
        }
        // when no recently completed items are available
        else {
          if($enabled) {
            // when RC block is enabled(default) remove it if no recently completed items are available
            $recentlyCompletedWrapper.remove();
          }
          else {
            // when RC block is deferred and there are no recently completed items available show the placeholder message
            $recentlyCompletedWrapper.show();
            $recentlyCompletedWrapper.find('.recently-completed-list').html('<br><div class="empty">' + Drupal.t('No recently completed items') + '</div>');
          }
        }
      }
    });
  }
}

function unloadSmartBoxRichtext(context){
  var editorId = tinyMCE && tinyMCE.activeEditor ? tinyMCE.activeEditor.editorId : null;
  if(editorId){
    var editorObj = $('#' + editorId, context);
    if(editorObj.length){
      tinyMCE.execCommand('mceRemoveControl', false, editorId);
    }
  }
}

function sHomeResetSmartBox() {
  var smartboxObj = $('#smart-box');
  unloadSmartBoxRichtext(smartboxObj);
  $('#smart-box-content .smart-box-tab-content', smartboxObj).empty().hide();
  var filterBlock = $("#smart-box .filter-block");
  $("li", filterBlock).removeClass('active').removeClass('inactive');
  filterBlock.data('selected', -1);
  // Reset aria-label on all tab buttons back to their original titles
  $(".smartbox-boxtab", filterBlock).each(function() {
    var $btn = $(this);
    if ($btn.data('tab-title')) {
      $btn.attr('aria-label', $btn.data('tab-title'));
    }
  });
}
