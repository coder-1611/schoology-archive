Drupal.behaviors.sGradeItemAssignmentSubmission = function(context) {
  const ANNOTATION_ASSIGNMENT_NID = -1;

  // Cache Drupal settings to prevent loss during popup interactions
  var translations = Drupal.settings.s_grade_item_assignment_translations || {};
  var cachedSettings = {
    s_assignment_submission_app_whitelist: Drupal.settings.s_assignment_submission_app_whitelist || {},
    default_icon_size: Drupal.settings.s_grade_item_assignment_submission_default_icon_size || 32,
    lti_copy_message: translations.lti_copy_message || '',
    lti_copy_created_message: translations.lti_copy_created_message || '',
    lti_gradable_schoology_grading_message: translations.lti_gradable_schoology_grading_message || '',
    lti_gradable_app_grading_message: translations.lti_gradable_app_grading_message || '',
    student_annotate_their_own_copy: translations.student_annotate_their_own_copy || ''
  };

  // Process assignment submission containers that haven't been processed yet
  $('.s-grade-item-assignment-submission-container:not(.sGradeItemAssignmentSubmission-processed)', context)
    .addClass('sGradeItemAssignmentSubmission-processed')
    .each(function() {
      setupAssignmentPopup();
    });

  // Process LTI app containers that haven't been processed yet
  $('#s-grade-item-assignment-submission-lti-app-container:not(.sGradeItemLtiApp-processed)', context)
    .addClass('sGradeItemLtiApp-processed')
    .each(function() {
      launchLtiApplicationPopup();
    });

  /**
   * Set up the popup where the assignment form is displayed
   */
  function setupAssignmentPopup() {
    var assignmentSubmissionContainer = $('.s-grade-item-assignment-submission-container', context);

    //this method is required for handling embed error messages from lti app content selectors
    window.sPopupPushStatusMessages = sPopupPushStatusMessagesHandler;

    if (!assignmentSubmissionContainer.length) {
      return;
    }

    // Skip processing for read-only library template displays
    var wrapper = assignmentSubmissionContainer.closest('#s-grade-item-assignment-submission-wrapper');
    if (wrapper.hasClass('s-grade-item-assignment-submission-readonly')) {
      return;
    }

    assignmentSubmissionContainer
      .closest('.popups-box')
      .addClass('s-has-assignment-submission-content');

    if (hasContentAttached()) {
      setContentReadonlyMode();
    } else {
      initializeHandlers();
    }

    prePopulateContent();
  }

  /**
   * Launch the application if the application-run popup has been successfully openend.
   */
  function launchLtiApplicationPopup() {
    var appContainer = $('#s-grade-item-assignment-submission-lti-app-container', context);
    if (!appContainer.length) {
      return;
    }

    var app = {
      'type': appContainer.data('app-type'),
      'url': appContainer.data('app-url')
    };

    sAppLauncher(appContainer, app);
  }

  /**
   * Add click handlers to the assignment submission application buttons
   */
  function initializeHandlers() {
    // Add click handlers to app buttons
    $('.s-grade-item-lti-app', context).each(function() {
      var $button = $(this);
      $button.click(openApplicationPopupHandler);
    });
    
    // Add click handlers to content remove buttons that haven't been processed yet
    $('.s-grade-item-assignment-submission-content-remove', context).each(function() {
      var $button = $(this);
      if (!$button.data('sgy-remove-handler-processed')) {
        $button.data('sgy-remove-handler-processed', true);
        $button.click(removeContentHandler);
      }
    });

    // Fix annotation button accessibility: initialize tipsy directly on the
    // button so the tooltip appears immediately on keyboard focus.
    var $annotationButton = $('#annotatable-file', context);
    if ($annotationButton.length) {
      var $tooltipWrapper = $annotationButton.closest('.infotip');
      if ($tooltipWrapper.length) {
        var gravity = $tooltipWrapper.attr('tipsygravity') || 's';

        // Detach the tooltip content before restructuring the DOM.
        var $tooltipContent = $tooltipWrapper.find('.infotip-content').detach();

        // Replace the outer wrapper span with the button directly.
        // This removes the extra tab stop the wrapper was creating while also
        // putting the button at the correct position in the DOM.
        $tooltipWrapper.replaceWith($annotationButton);

        // Insert the tooltip content as a sibling *after* the button (not inside it).
        // Keeping it outside the button prevents its text from being included in the
        // button's accessible name computation by screen readers.
        $annotationButton.after($tooltipContent);

        // Wire up aria-describedby so screen readers still announce the tooltip text.
        // Append to any existing aria-describedby value rather than replacing it.
        var tooltipId = $tooltipContent.attr('id');
        if (tooltipId) {
          var existingDescribedBy = $annotationButton.attr('aria-describedby');
          if (existingDescribedBy) {
            var ids = existingDescribedBy.split(/\s+/);
            if (ids.indexOf(tooltipId) === -1) {
              ids.push(tooltipId);
            }
            $annotationButton.attr('aria-describedby', ids.join(' '));
          } else {
            $annotationButton.attr('aria-describedby', tooltipId);
          }
        }

        // Expose as a button so screen readers announce it correctly (not as "group").
        $annotationButton.attr('role', 'button');
        var buttonLabel = $annotationButton.find('.app-title').text().trim() || $annotationButton.text().trim();
        if (buttonLabel) {
          $annotationButton.attr('aria-label', buttonLabel);
        }

        // Initialize tipsy directly on the button with delayIn:0 so the tooltip
        // shows immediately when the button receives keyboard focus (no hover delay).
        $annotationButton.tipsy({
          html: true,
          gravity: gravity,
          trigger: 'hover',
          delayIn: 0,
          title: function() {
            var $button = $(this);
            var $content = $button.nextAll('.infotip-content').first();
            return $content.length ? $content.html() : '';
          }
        });
      }

      // Handle keyboard interactions for the annotation file-picker button
      $annotationButton.on('keydown', function(e) {
        if (isEscapeKeyEvent(e)) {
          $annotationButton.tipsy('hide');
          e.preventDefault();
          e.stopPropagation();
        } else if (isEnterOrSpaceKeyEvent(e)) {
          e.preventDefault();
          this.click();
        }
      });

      // On focus, push tooltip text into an aria-live region so screen readers
      // announce the description immediately without relying on aria-describedby.
      $annotationButton.on('focus', function() {
        var $liveRegion = $('#annotation-button-live-region');
        if (!$liveRegion.length) {
          $liveRegion = $('<div>', {
            id: 'annotation-button-live-region',
            'aria-live': 'polite',
            'aria-atomic': 'true',
            'class': 'visually-hidden'
          });
          $('body').append($liveRegion);
        }
        var tooltipText = $annotationButton.next('.infotip-content').text().trim();
        $liveRegion.text(tooltipText);
      }).on('blur', function() {
        $('#annotation-button-live-region').text('');
      });
    }

    // Expose the content insertion handler to the global scope
    window.sGradeItemAssignmentSubmissionInsertSelectionHandler = insertSelectionHandler;
    window.sPopupPushStatusMessages = sPopupPushStatusMessagesHandler;
  }

  /**
   * Click Event Handler
   * Open a popup when the assignment submission application item is clicked
   *
   * @returns {void}
   */
  function openApplicationPopupHandler() {
    var appNid = $(this).data('app-nid');
    var isActive = $(this).hasClass('active');

    if (isActive || !appNid) {
      return;
    }

    var openPopupCallback = createApplicationPopupOpenCallback(this, appNid);
    var cookiePreloadCallback = createApplicationCookiePreloadCallback(appNid);

    cookiePreloadCallback(openPopupCallback);
  }

  /**
   * Return the function that preloads the application cookies.
   * After the cookies have been preloaded the specified callback will be executed.
   *
   * @param {number} appNid
   * @returns {Function}
   */
  function createApplicationCookiePreloadCallback(appNid) {
    var cookiePreloadUrl = sCommonGetSetting('s_app', 'cookie_preload_urls', appNid);

    return function (callback) {
      if (cookiePreloadUrl) {
        // Launch the cookie preload popup first, then execute the callback
        sAppMenuCookiePreloadRun(appNid, cookiePreloadUrl, function() {

          // Clear cached launch data since we store cookie preload attempts in session
          sAppLauncherClearCache(appNid);
          sAppMenuCookiePreloadDelete(appNid);

          callback();
        });
      } else {
        // execute the callback immediately as there is no cookie preload URL
        callback();
      }
    };

  }

  /**
   * Create a callback which opens application popup
   *
   * @param {HTMLElement} element
   * @param {number} appNid
   * @returns {Function}
   */
  function createApplicationPopupOpenCallback(element, appNid) {
    Popups.saveSettings();

    // The parent of the new popup is the currently active popup.
    var parentPopup = Popups.activePopup();

    var popupOptions = Popups.options({
      ajaxForm: false,
      extraClass: 'popups-extra-large s-grade-item-assignment-submission-popup',
      updateMethod: 'none',
      href: buildApplicationPopupUrl(appNid),
      hijackDestination: false,
      disableCursorMod: true,
      disableAttachBehaviors: false
    });

    return function() {
      Popups.openPath(element, popupOptions, parentPopup);
    };
  }

  /**
   * Build URL address for the application popup
   *
   * @param {number} appNid
   * @returns {string}
   */
  function buildApplicationPopupUrl(appNid) {
    var realm = getCurrentRealm();

    var queryString = $.param({
      realm: realm.name,
      realm_id: realm.id,
      app_nid: appNid
    });

    return '/assignment_submission_app?' + queryString;
  }

  /**
   * Get realm name ('course') and its id
   *
   * @returns {{id: string, name: string}}
   */
  function getCurrentRealm() {
    return {
      id: $('#edit-assign-course-nid', context).val(),
      name: 'course'
    };
  }

  /**
   * The handler called by server when the selection result is returned by LTI app
   * This handler is eventually accessible from the global scope via
   *    window.sGradeItemAssignmentSubmissionInsertSelectionHandler()
   *
   * @see s_app_content_insert_page_helper() PHP server function
   *
   * @param {object} selection
   * @returns {void}
   */
  function insertSelectionHandler(selection) {
    var content = selection && selection.content && selection.content[0];
    var messages = selection && selection.messages;

    if (messages) {
      $.each(messages, function(i, message) {
        console.log(message);
      });
    }

    console.log('Assignment submission content selected: %o', content);

    if (isValidContent(content)) {
      addContentHandler(content);
    }

    // The popup should be closed always even in the case when insertContentItemHandler is not called
    Popups.close(Popups.activePopup());
  }

  /**
   * The handler called by server when selection messages are returned by LTI app
   * (Expects the messages already converted to html, for consistency with the drupal theme)
   * This handler is eventually accessible from the global scope via
   *    window.sCommonPushStatusMessages()
   *
   * @see s_app_content_insert_page_helper() PHP server function
   *
   * @param {string} messages
   * @returns {void}
  */
  function sPopupPushStatusMessagesHandler(messages) {
    if (messages) {
        const popupWindowIdentifier = '.popups-body';
        $('<div class="s-js-pushed-messages-wrapper closable">' + messages + '</div>').prependTo(popupWindowIdentifier);
        processMessages(popupWindowIdentifier); // adds close button
    }
  }

  /**
   * Check if the content has all the required fields
   *
   * @param {object} content
   * @returns {boolean}
   */
  function isValidContent(content) {
    if (content.app_nid == ANNOTATION_ASSIGNMENT_NID) {
      return content && content.title;
    }
    // Check if this app supports LTI gradable assignments
    var isLtiGradableAppResult = isLtiGradableApp(content.app_nid);
    // For LTI gradable apps, title is not required
    if (isLtiGradableAppResult) {
      return (
        content
        && content.launch_url
        && content.app_nid
      );
    }
    // For non-LTI gradable apps, title is required (legacy behavior)
    return (
      content
      && content.launch_url
      && content.title
      && content.app_nid
    );
  }

  /**
   * Handle UI for existing content on the edit form
   *
   * @returns {void}
   */
  function prePopulateContent() {
    var content = {
      launch_url: $('#edit-assignment-submission-launch-url', context).val(),
      title: $('#edit-assignment-submission-title', context).val(),
      custom: $('#edit-assignment-submission-custom-parameters', context).val(),
      grading_choice: $('#edit-assignment-submission-grading-choice', context).val(),
      icon: {
        url: $('#edit-assignment-submission-icon-url', context).val(),
        width: $('#edit-assignment-submission-icon-width', context).val(),
        height: $('#edit-assignment-submission-icon-height', context).val(),
      },
      app_nid: $('input[name=assignment_submission_app_nid]:checked', context).val()
    };

    if (isValidContent(content)) {
      showContentUI(content);
    }
  }

  /**
   * Check if the given app_nid is an LTI gradable app
   *
   * @param {number} appNid
   * @returns {boolean}
   */
  function isLtiGradableApp(appNid) {
    if (appNid && cachedSettings.s_assignment_submission_app_whitelist) {
      return cachedSettings.s_assignment_submission_app_whitelist[appNid] || false;
    }
    return false;
  }

  /**
   * Handle title display for LTI gradable apps vs legacy apps
   *
   * @param {object} content
   * @returns {void}
   */
  function handleTitleElement(content) {
    var titleElement = $('.s-grade-item-assignment-submission-content-title', context);
    var contentElement = $('.s-grade-item-assignment-submission-content', context);

    if (isLtiGradableApp(content.app_nid) || (content.grading_choice && content.grading_choice !== '')) {
      // Show no title for lti gradable app (either via whitelist or presence of grading choice)
      titleElement.hide();
      contentElement.addClass('no-title');
    } else if (content.title && content.title.trim()) {
      // For legacy LTI apps, show title normally
      titleElement.text(content.title).show();
      contentElement.removeClass('no-title');
    } else {
      // For legacy LTI apps with no title, hide the title element
      titleElement.hide();
      contentElement.addClass('no-title');
    }
  }

  /**
   * Handle content hint message based on grading choice
   *
   * @param {object} content
   * @returns {void}
   */
  function handleContentHint(content) {
    var hintElement = $('.s-grade-item-assignment-submission-content-hint', context);
    var hintMessage;

    // Special handling for annotation assignments
    if (content.app_nid == ANNOTATION_ASSIGNMENT_NID) {
      // For annotation assignments, check if content has a title (indicates existing assignment/edit form)
      if (content.title && content.title.trim()) {
        hintMessage = cachedSettings.lti_copy_created_message;
      } else {
        hintMessage = cachedSettings.student_annotate_their_own_copy;
      }
    } else {
      // Get grading choice from form field first (most current) or content as fallback
      var gradingChoice = $('#edit-assignment-submission-grading-choice', context).val() || content.grading_choice;

      // See AssignmentLtiGradableBll::GRADING_CHOICE_SCHOOLOGY and AssignmentLtiGradableBll::GRADING_CHOICE_APP
      // Check if this is LTI gradable content (either via whitelist or presence of grading choice)
      if (isLtiGradableApp(content.app_nid) || (gradingChoice && gradingChoice !== '')) {
        if (gradingChoice === 'app') {
          // Get the app name from the active app button
          var appName = $('.s-grade-item-assignment-submission-app.active .app-title', context).text();
          hintMessage = cachedSettings.lti_gradable_app_grading_message.replace(/%\{app_name\}/g, appName);
        } else {
          // For schoology grading choice or no choice set, use schoology message
          hintMessage = cachedSettings.lti_gradable_schoology_grading_message;
        }
      } else {
        // For legacy apps, check if edit form (existing content) vs add form
        if (hasContentAttached()) {
          hintMessage = cachedSettings.lti_copy_created_message;
        } else {
          hintMessage = cachedSettings.lti_copy_message;
        }
      }
    }

    hintElement.text(hintMessage);
  }

  /**
   * Check if the content is already attached to the assignment
   *
   * @returns {boolean}
   */
  function hasContentAttached() {
    return $('#edit-assignment-submission-id', context).val() !== '';
  }

  /**
   * Set content readonly mode
   * Hide all buttons and make content not editable
   *
   * @returns {void}
   */
  function setContentReadonlyMode() {
    // Hide all app buttons except the active one
    $('.s-grade-item-assignment-submission-app', context).each(function() {
      var appButton = $(this);
      var appNid = appButton.data('app-nid');
      var checkedAppNid = $('input[name=assignment_submission_app_nid]:checked', context).val();

      if (appNid == checkedAppNid) {
        appButton.addClass('active').show();
      } else {
        appButton.hide();
      }
    });

    // Hide remove button in edit mode
    $('.s-grade-item-assignment-submission-content-remove', context).hide();

    // Disable form fields
    $('#edit-assignment-submission-launch-url, #edit-assignment-submission-title, #edit-assignment-submission-custom-parameters', context).prop('readonly', true);
  }

  /**
   * Show or hide the information message below the assignment submission options
   */
  function toggleInformationMessage(isVisible) {
    $('.s-grade-item-assignment-submission-information', context).toggle(isVisible);
  }

  /**
   * Toggle the visibility of submission options for assignments in the Elementary UI
   */
  function toggleSubmissionOptions() {
    $('.submission-options-wrapper', context).toggle();
  }

  /**
   * Insert content item information to DOM
   *
   * @param {object} content
   * @returns {void}
   */
  function addContentHandler(content) {
    setFormFields(content);
    showContentUI(content);
  }

  /**
   * Remove content item information from DOM
   *
   * @returns {void}
   */
  function removeContentHandler(e) {
    resetFormFields();
    hideContentUI();
    e.preventDefault();
  }

  /**
   * Set values for the form fields related to the content item selection
   *
   * @param {object} content
   * @returns {void}
   */
  function setFormFields(content) {
    $('#edit-assignment-submission-launch-url', context).val(content.launch_url);
    $('#edit-assignment-submission-title', context).val(content.title);
    $('#edit-assignment-submission-custom-parameters', context).val(content.custom);

    // For LTI gradable apps, ensure proper grading choice handling
    if (isLtiGradableApp(content.app_nid)) {
      // Default to 'schoology' grading choice when none is set
      // NOTE: This default is also set in PHP (s_grade_item.module)
      // If changing this default, update both locations
      if (!content.grading_choice) {
        content.grading_choice = 'schoology';
      }
    }

    $('#edit-assignment-submission-grading-choice', context).val(content.grading_choice);
    $('#edit-assignment-submission-icon-url', context).val(content.icon?.url ?? '');
    $('#edit-assignment-submission-icon-width', context).val(content.icon?.width ?? '');
    $('#edit-assignment-submission-icon-height', context).val(content.icon?.height ?? '');
    $('input[name=assignment_submission_app_nid][value=' + content.app_nid + ']', context).prop('checked', true);
  }

  /**
   * Reset (empty) the form fields related to the content item selection
   *
   * @returns {void}
   */
  function resetFormFields() {
    $('#edit-assignment-submission-launch-url', context).val('');
    $('#edit-assignment-submission-title', context).val('');
    $('#edit-assignment-submission-custom-parameters', context).val('');
    $('#edit-assignment-submission-grading-choice', context).val('');
    $('#edit-assignment-submission-icon-url', context).val('');
    $('#edit-assignment-submission-icon-width', context).val('');
    $('#edit-assignment-submission-icon-height', context).val('');
    $('input[name=assignment_submission_app_nid]', context).prop('checked', false);

    // Reset title visibility state
    $('.s-grade-item-assignment-submission-content-title', context).show();
    $('.s-grade-item-assignment-submission-content', context).removeClass('no-title');
  }

  /**
   * Display content item UI where the selected file is shown
   * Toggle the visibility of the submission options
   *
   * @param {object} content
   * @returns {void}
   */
  function showContentUI(content) {
    // Handle app button states
    $('.s-grade-item-assignment-submission-app', context).each(function() {
      var appButton = $(this);

      if (appButton.data('app-nid') == content.app_nid) {
        appButton.addClass('active');
      } else {
        appButton.hide();
      }
    });

    // Set up content container
    var contentElement = $('.s-grade-item-assignment-submission-content', context);
    contentElement.hide();

    // Handle icon
    var iconElement = $('.s-grade-item-assignment-submission-content-icon', context);
    if (iconElement.length > 0) {
      // Reset icon styles to ensure clean state when switching between content selections
      iconElement.css('background-image', '').removeClass('assignment-icon').hide();

      if (content.icon && content.icon.url) {
        iconElement.css("background-image", "url(" + content.icon.url + ")");

        // Set icon dimensions, with fallback to default size if width/height are 0 or missing
        // Default size is defined in PHP: S_GRADE_ITEM_ASSIGNMENT_SUBMISSION_DEFAULT_ICON_SIZE
        var iconWidth = content.icon.width && content.icon.width !== '0' ? content.icon.width : cachedSettings.default_icon_size;
        var iconHeight = content.icon.height && content.icon.height !== '0' ? content.icon.height : cachedSettings.default_icon_size;

        iconElement.css({
          width: iconWidth + "px",
          height: iconHeight + "px"
        });
        iconElement.show();
      } else if (isLtiGradableApp(content.app_nid)) {
        iconElement.addClass('assignment-icon').css({
          width: cachedSettings.default_icon_size + 'px',
          height: cachedSettings.default_icon_size + 'px'
        }).show();
      }
    }

    // Handle title and hint message
    handleTitleElement(content);
    handleContentHint(content);

    // Show content after all styles are applied
    contentElement.show();

    // Handle submission options
    const isAnnotationAssignment = content.app_nid == ANNOTATION_ASSIGNMENT_NID;
    if (!isAnnotationAssignment) {
      hideSubmissionEnabledOption();
      hideCommentsEnabledOption();
    }

    toggleInformationMessage(false);
    toggleSubmissionOptions();
  }

  /**
   * Hide content item UI where the selected file is shown
   * Toggle the visibility of the submission options
   *
   * @returns {void}
   */
  function hideContentUI() {
    $('.s-grade-item-assignment-submission-content', context).hide().removeClass('no-title');
    $('.s-grade-item-assignment-submission-app', context).show().removeClass('active');
    showSubmissionEnabledOption();
    showCommentsEnabledOption();
    toggleInformationMessage(true);
    toggleSubmissionOptions();
  }

  /**
   * Adjust the title's max width based on the new icon size
   *
   * @param {object} content
   */
  function adjustTitleAndIconSizes(content) {
    var contentIcon = $('.s-grade-item-assignment-submission-content-icon', context);
    var contentTitle = $('.s-grade-item-assignment-submission-content-title', context);
    var contentTitleMaxWidth = parseInt(contentTitle.css('max-width'), 10);
    var expectedIconWidth = parseInt(contentIcon.css('width'), 10);
    var actualIconWidth = +content.icon.width;

    contentTitle.css('max-width', contentTitleMaxWidth + expectedIconWidth - actualIconWidth + 'px');
    contentIcon.css('width', content.icon.width + 'px');
    contentIcon.css('height', content.icon.height + 'px');
  }

  /**
   * Show "Submission Enabled" advanced option button if it was hidden before
   *
   * @returns {void}
   */
  function showSubmissionEnabledOption() {
    $('.adv-option-btn.toggle-dropbox').show();
  }

  /**
   * Hide "Submission Enabled" advanced option button.
   * If it was disabled then we should enable the option before hiding the button
   *
   * @returns {void}
   */
  function hideSubmissionEnabledOption() {
    var button = $('.adv-option-btn.toggle-dropbox');

    if (!button.hasClass('adv-option-on')) {
      button.click();
    }

    button.hide();
  }

    /**
     * Show "Comments Enabled" advanced option button if it was hidden before
     * If it was disabled then we should enable the option before showing the button
     *
     * @returns {void}
     */
    function showCommentsEnabledOption() {
        var button = $('.adv-option-btn.toggle-comments');

        if (!button.hasClass('adv-option-on')) {
            button.click();
        }

        button.show();
    }

    /**
     * Hide "Comments Enabled" advanced option button.
     * If it was enabled then we should disable the option before hiding the button
     *
     * @returns {void}
     */
    function hideCommentsEnabledOption() {
        var button = $('.adv-option-btn.toggle-comments');

        if (button.hasClass('adv-option-on')) {
            button.click();
        }

        button.hide();
    }
};
