var s_assessment_fill_disable_unload_prompt = false;

//quiz autosaving variables
//only allow a maximum of 3 POST calls every 5 seconds to prevent rate-limiting error
//any further calls will be queued for the next 5 seconds
var sAssessmentAutosaveErrorCount = 0; // display a dialog when this hits max
var sAssessmentAutosaveErrorCountMax = 3;
var sAssessmentDisableAutosave = false;

var sAssessmentAutosaveQueue = {
  autoSaveQueue: [],
  autoSaveEnabled: false,

  reset: function() {
    this.autoSaveQueue = [];
    this.autoSaveEnabled = false;
    this.pendingPromise = null;
  },

  /**
   * Replace data attribute if ncid exist in the queue
   *
   * @param ncid
   * @param data
   * @returns {number}
   */
  findAndReplace: function(ncid, data) {
    var queue = this.autoSaveQueue;
    var index = -1;
    for(var i = 0; i < queue.length; i++) {
      if (ncid == queue[i].ncid) {
        queue[i].data = data;
        index = i;
        break;
      }
    }
    return index;
  },

  push: function(ncid, data) {
    if (this.findAndReplace(ncid, data) < 0) {
      this.autoSaveQueue.push({
        ncid: ncid,
        data: data
      });
    }
  },

  unshift: function(ncid, data) {
    if (this.findAndReplace(ncid, data) < 0) {
      this.autoSaveQueue.unshift({
        ncid: ncid,
        data: data
      });
    }
  },

  getAutoSaveInterval: function() {
    // trigger next batch with interval to stay under API limit threshold
    var form_opts  = Drupal.settings.s_assessment_autosave_settings;
    var autosave_interval = 30000; // default to 30 seconds
    if (form_opts && form_opts.autosave_interval && !!parseInt(form_opts.autosave_interval)) {
      autosave_interval = parseInt(form_opts.autosave_interval);
    }

    return autosave_interval;
  },

  /**
   * Process batch autosave items from the queue
   */
  process: function() {
    if (this.pendingPromise) {
      return;
    }

    var self = this;
    var autosave_interval = self.getAutoSaveInterval();
    // Auto save is disabled for first question update, because it reduces
    // DB load.
    if (!self.autoSaveEnabled) {
      setTimeout(function() {
        self.autoSaveEnabled = true;
        self.process();
      }, autosave_interval);
      return;
    }

    var data = {};
    while(1) {
      // dequeue items from autoSaveQueue
      var task = this.autoSaveQueue.shift();
      if (!task) {
        break;
      }
      data[task.ncid] = {data: task.data};
    }

    if ($.isEmptyObject(data)) {
      return;
    }

    var processNext = function() {
      setTimeout(function() {
        self.pendingPromise = null;
        self.process();
      }, autosave_interval);
    };

    this.pendingPromise = sAssessmentQueuedAutosaveAjax(data);
    $(self).trigger('saving', data);
    this.pendingPromise.then(function() {
      $(self).trigger('saved', data);
      processNext();
    }, function(err) {
      $(self).trigger('error', err);
      processNext();
    });
  }
};

/**
 * For Assessment T/F and M/C questions:
 *
 * To ensure that users are not unknowingly selecting
 * answers with the arrow keys, the following will prevent the
 * arrow keys from selecting radio buttons while still moving focus appropriately.
 *
 */
$(':radio').on('keydown', function(e) {
  var arrow_keys = new Array(37, 38, 39, 40),
      selected_key = e.which,
      $radioGroup = $(e.target).closest('.form-radios'),
      $formItem = $(e.target).closest('.form-item'),
      $formRadiosTable = $(e.target).closest('.form-radios-table');

  if($.inArray(selected_key, arrow_keys) > -1) {
    e.preventDefault(); // prevent default behavior

    // overwrite default behavior with focus changing
    if($formRadiosTable.length) { // multiple choice
      var $prevFormItem = $formItem.closest('tr').prev('tr'),
          $nextFormItem = $formItem.closest('tr').next('tr');

    } else { // true/false
      var $prevFormItem = $formItem.prev('.form-item'),
          $nextFormItem = $formItem.next('.form-item');
    }

    switch(selected_key) {
      case 37:
      case 38:
        if($prevFormItem.length) {
          $prevFormItem.find('.form-radio').trigger('focus');
        }
        break;
      case 39:
      case 40:
        if($nextFormItem.length) {
          $nextFormItem.find('.form-radio').trigger('focus');
        }
        break;
    }
  }
});

Drupal.behaviors.sAssessmentFill = function(context){
  reEnableTestQuizStartButtons(context);

  $('.s-assessment-question-fill-form:not(.sAssessmentFill-processed)').addClass('sAssessmentFill-processed').each(function(){
    var form = $(this);
    var form_opts = Drupal.settings.s_assessment_question_fill_form;

    var buttons = $('.form-submit', form); // All 'submit' buttons, including 'back'

    $(sAssessmentAutosaveQueue).on('saving', function() {
      // disable form submit until auto-save request is complete
      buttons.attr('disabled', true);
    }).on('saved error', function() {
      buttons.attr('disabled', false);
    });

    form.bind('submit', function(){
      // We need the timeout since we want the buttons to be disabled only
      // after it's sent back to the server; otherwise, Drupal won't process the button
      setTimeout(function(){
        buttons.attr('disabled', 'disabled').parent().addClass('disabled');
        //prevent further autosave calls
        sAssessmentAutosaveQueue.reset();
        sAssessmentDisableAutosave = true;
      }, 1);
      // this renders the password modal and determines whether or not the form
      // submits and renders the delivery forms for test/quiz.
      return renderPasswordModal(form, form_opts);
    });

    // When the screen is touched, attempt to close the rubrics editor
    if ($('[name=is_mobile]', form).val()) {
      $('body').bind('touchend', function (event) {
        if (!$(event.target).parents('.s-grading-rubric').length) {
          $('.s-grading-rubric .control-btn.close-btn').click();
        }
      });
    }

    //Setup Autosave form bindings
    if(typeof form_opts != 'undefined'){
      var curTime = new Date().getTime()/1000;
      curTime = Math.round(curTime);
      form_opts.access_timestamp = curTime;
      if(!form_opts.preview){
        sid = form_opts.sid;
        asIndicator = $('.autosave_indicator', form);
        buildID = $('input[name="form_build_id"]', form).val();
      }
    }

    window.onbeforeunload = function(){
      if(s_assessment_fill_disable_unload_prompt || !form_opts) return;
      return form_opts.resume != 1 ? Drupal.t('Your assessment cannot be resumed and will be submitted unfinished.') : Drupal.t('Your assessment is unfinished, but you can resume it later.');
    };

    var returnButtons = $('.review-page input[type="submit"]', $(this));
    returnButtons.each(function(){
      $(this).click(function(){
        var desiredPage = returnButtons.index($(this)) + 1;
        $("#edit-goto-page").val(desiredPage);
      });
    });

    $("#instructions-toggle").click(function(){
      $("#assessment-instructions").toggle();
      return false;
    });


    $('#edit-submit', form).bind('click',function(){
      var submitButton = $(this); // The one 'forward' button
      if(form_opts && form_opts.confirm_submit) {
        var popup = new Popups.Popup();
        popup.disableInputFocus = true;
        var popup_buttons = {
          'popup_confirm' : {
           title: Drupal.t('Yes'),
           func: function(){
             Drupal.settings.s_assessment_question_fill_form.confirm_submit = false;
             submitButton.trigger('click');
             popup.close();
           }
          },
          'popup_cancel': {
           title: Drupal.t('No'),
           func: function(){
             popup.close();
           }
          }
        };

        popup.extraClass = 'popups-small';
        var popup_content = Drupal.t("Are you sure you want to submit the assessment?");
        popup.open(Drupal.t('Confirm Submission'), popup_content, popup_buttons);
        return false;
      }

      return true;
    });

    var beginTestQuizBtn = $('.s-app-ldb-js-launch-action-btn', form);
    var ldb_enabled = sCommonGetSetting('s_app_ldb_js', 'ldb_enabled') == 1;
    var ldb_is_valid = sAppLdbIsStarted();

    // LockDown Browser "first-step" view
    if(ldb_is_valid && beginTestQuizBtn.length > 0) {
      Popups.addOverlay();
      Popups.addLoading();
      renderPasswordModal.password_is_correct = true;
      // see click handler below, given one of the launch_urls below we will auto-start the quiz using the clicked button
      var btnClassSelector = '.s-app-ldb-js-launch-action-' + sCommonGetSetting('s_app_ldb_env_js', 'assessment_type');
      $('.s-app-ldb-js-launch-action-btn' + btnClassSelector, form).click();
    }
    // LockDown Browser quiz view
    else if(ldb_is_valid) {
      sAppLdbStartHideNav();
    }

    // Normal browser, launch screen "first-step" view
    if (ldb_enabled && !ldb_is_valid) {
      // move action buttons to LDB block before showing first-step wrapper
      var hasActionBtns = false;
      var firstStepWrapper = $('#assessment-first-step-info', form);
      var firstStepLdbNoticeWrapper = $('.s-assessment-ldb-assessment-first-step-notice-wrapper', firstStepWrapper);
      $('.s-app-ldb-js-launch-content', firstStepWrapper).each(function(){
        hasActionBtns = true;
        var btnWrapper = $(this).parent('.submit-span-wrapper');
        $('#s-assessment-ldb-action-button-wrapper', form).append(btnWrapper);
      });
      // no action buttons? hide ldb_notice
      if(!hasActionBtns) {
        firstStepLdbNoticeWrapper.addClass('hidden');
      }
      firstStepWrapper.removeClass('hidden');

      // Handle LockDown Browser launch test
      beginTestQuizBtn.bind('click', function() {
        if (form_opts && !renderPasswordModal.password_is_correct) {
          renderPasswordModal(form, form_opts);
          return false;
        }

        var actionBtn = $(this);
        var allActionBtns = $('.s-app-ldb-js-launch-action-btn', firstStepLdbNoticeWrapper);

        // launch failed, user should install LockDown Browser, then refresh page
        if(allActionBtns.hasClass('disabled')) {
          return false;
        }

        // determine which server-side generated launch link we should use
        var ldb_launch_url = sCommonGetSetting('s_app_ldb_js', 'ldb_launch_url');
        if(actionBtn.hasClass('s-app-ldb-js-launch-action-submit')) {
          ldb_launch_url = ldb_launch_url['submit'];
        }
        else if(actionBtn.hasClass('s-app-ldb-js-launch-action-restart')) {
          ldb_launch_url = ldb_launch_url['restart'];
        }
        else if(actionBtn.hasClass('s-app-ldb-js-launch-action-resume')) {
          ldb_launch_url = ldb_launch_url['resume'];
        }

        // attempt LockDown Browser launch
        sToggleActiveLoader('ldb-test-install', form.parent());
        $('#lock-down-attempted', form).val('1');
        sAppLdbLaunchBrowser(ldb_launch_url, function(status) {
          sToggleActiveLoader('ldb-test-install');
          if(status == 'success') {
            $('p:eq(0) strong', firstStepLdbNoticeWrapper).html(Drupal.t('You\'ve successfully launched the LockDown Browser'));
            $('p:eq(1)', firstStepLdbNoticeWrapper).html(Drupal.t('If you have any attempts left, refresh this page to take the test/quiz again'));
            allActionBtns.addClass('disabled');
          }
          else if(status == 'failed') {
            $('p:eq(0) strong', firstStepLdbNoticeWrapper).html(Drupal.t('LockDown Browser is required to take this test'));
            $('p:eq(1)', firstStepLdbNoticeWrapper).html(Drupal.t('If you have not already installed LockDown Browser, please use the button below.'));
            $('#lock-down-failure', form).val('1');
            allActionBtns.addClass('disabled');
          }
        });

        return false;
      });
    }

    $('.assessment-nav').each(function(){
      $(this).bind('click',function(){
        s_assessment_fill_disable_unload_prompt = true;
      });
    });

  });
}

/**
 * Autosave Test/Quiz
 */
function sAssessmentAutosave(ncid, data){
  if(sAssessmentDisableAutosave){
    return;
  }

  //if attempts to autosave after form expires display error
  sAssessmentCheckFormExpiration();
  sAssessmentAutosaveQueue.push(ncid, data);
  sAssessmentAutosaveQueue.process();
}

function sAssessmentQueuedAutosaveAjax(data){
  var postData = {
    'form_build_id' : buildID,
    'queue' : data
  };
  var ajaxUrl = '/assessment/' + sid + '/autosave';
  return sAssessmentAutosaveAjaxExec(ajaxUrl, postData);
}

function sAssessmentAutosaveAjaxExec(ajaxUrl, postData){
  sToggleActiveLoader('quiz_autosave', asIndicator);
  jsonPostData = JSON.stringify(postData);
  return $.ajax({
    url: ajaxUrl,
    dataType: 'json',
    type: 'POST',
    data: {'json' : jsonPostData},
    success: function(json){
      sAssessmentAutosaveErrorCount = 0;
      if(json.error){
        sAssessmentFormExpirationPopup(json.error);
        var err_msg = 'Successful assessment autosave ajax request but server responded with an error: ' + json.error;
        sAssessmentLogClientError(err_msg);
      }
      else{
        sToggleActiveLoader('quiz_autosave');
        asIndicator.html(json.output);
      }
    },
    error: function(response) {
      if('queue' in postData) {
        for(var ncid in postData['queue']) {
          var data = postData['queue'][ncid]['data'];
          sAssessmentAutosaveQueue.unshift(ncid, data);
        }
      }
      sAssessmentAutosaveError();
      var err_msg = 'Failed assessment autosave ajax request. Status Code: ' + response.status;
      sAssessmentLogClientError(err_msg);
    }
  });
}

function sAssessmentAutosaveError() {
  sAssessmentAutosaveErrorCount++;
  if(sAssessmentAutosaveErrorCount >= sAssessmentAutosaveErrorCountMax) {
    sAssessmentAutosaveErrorCount = 0;
    sAssessmentFormExpirationPopup('unknown_error');
  }
}

function sAssessmentAllowRadioDeselect(context){
  var inputVal = false;
  //allow user to deselect a radio button by clicking a checked radiobutton
  $('input[type=radio]', context).each(function(){
    var inputObj = $(this);
    inputObj.click(function(e){
      if(inputVal === inputObj.val()){
        inputVal = false;
        inputObj.attr('checked', false);
      }
      else{
        inputVal = inputObj.val();
        inputObj.attr('checked', 'checked');
      }
      e.stopPropagation(); //prevent click event from firing twice since the radiobutton is also a label and clicking a label will trigger an additional click event
    });
  });
}

function sAssessmentCheckFormExpiration(){
  var form_opts = Drupal.settings.s_assessment_question_fill_form;

  //if 6 hours have passed since the user opens the form, display an exit message
  if(typeof form_opts.access_timestamp != "undefined" && typeof form_opts.timeout != "undefined"){
    var openTimestamp = form_opts.access_timestamp;
    var curTime = new Date().getTime()/1000;
    curTime = Math.round(curTime);
    if(curTime - openTimestamp > form_opts.timeout){
      sAssessmentFormExpirationPopup('expired');
    }
  }
}

function sAssessmentLogClientError(msg){
  var uid = 0;
  if(typeof Drupal.settings.s_common != 'undefined' && typeof Drupal.settings.s_common.user != 'undefined'){
    uid = Drupal.settings.s_common.user.uid;
  }

  var data = {
    msg : msg,
    uid : uid,
    error_type : 'assessment_client'
  };

  $.post('/popups_error', data);
}

function sAssessmentFormExpirationPopup(type){
  s_assessment_fill_disable_unload_prompt = true;

  switch(type){
    case 'unknown_error':
      var restorePopupBody = Drupal.t('An unknown connection error occurred.  Please refresh the page.');
      break;
    case 'component_submitted':
      var restorePopupBody = Drupal.t('This question has already been submitted.');
      break;
    case 'submitted':
      var restorePopupBody = Drupal.t('This attempt has already been submitted.');
      break;
    case 'expired':
    default:
      var restorePopupBody = Drupal.t('The test/quiz that you are attempting to resume has expired. In order to continue, you must exit the test/quiz and resume progress (please note: some quizzes are not resumable). Your previous work has been saved.');
      break;
  }

  //open popup for exiting
  var buttons = {
    'close_exit': {
      title: Drupal.t('Close & Exit Test/Quiz'),
      func: function(){
        Popups.activePopup().close();
      }
    }
  };
  var exitPopup = new Popups.Popup();
  exitPopup.extraClass = 'popups-small expired-test';
  Popups.open(exitPopup, Drupal.t('Expired Test/Quiz'), restorePopupBody, buttons);
  Popups.resizeAndCenter(exitPopup);

  $(document).bind('popups_close.s_assessment_fill_form',function(e , popup) {
    if( typeof popup != 'object' || !popup.extraClass )
      return;

    if( String(popup.extraClass).indexOf('expired-test') == -1 )
      return;

    // Exits user from test/quiz
    $(document).unbind('popups_close.s_assessment_fill_form');
    window.location.href = '';
  });
}

/**
 * Test/quiz start buttons are disabled when the password modal is enabled to
 * disallow someone from clicking the start button before the JS has attached
 */
function reEnableTestQuizStartButtons(context) {
  var s_assessment = Drupal.settings.s_assessment;
  var test_quiz = s_assessment ? s_assessment.test_quiz : {};
  var disable_test_quiz_attempt = (test_quiz && test_quiz.disable_test_quiz_attempt) || false;
  $('#begin-test-quiz, #edit-resume-1, #edit-submit-1', context)
    .not('.sTestQuizStartButton-processed ')
    .prop('disabled', disable_test_quiz_attempt) // .prop instead of .attr for Edge/IE11
    .click(function () {
      $(this).addClass('is-start-or-resume');
    })
    .addClass('sTestQuizStartButton-processed');
}

function renderPasswordModal(form, form_opts) {
  var passwordIsRequired = typeof form_opts != 'undefined' && form_opts.load_password_modal;
  var start_or_resume_clicked = $('.is-start-or-resume', form).length > 0;

  if (renderPasswordModal.password_is_correct || !passwordIsRequired || !start_or_resume_clicked) {
    return true;
  }
  // need to get settings for title, section_nid, grade_item_nid.
  var $passwordModal = $('<div id="test-quiz-password-modal-wrapper"></div>');
  $('body').append($passwordModal);
  try {
    ReactDOM.render(React.createElement(caAssessmentDeliveryLanding.TestQuizPasswordModal, {
      handleDelivery: function () {
        renderPasswordModal.password_is_correct = true;
        // Restart the interrupted test/quiz start flow.
        $('.is-start-or-resume', form).prop('disabled', false).click();
      },
      handleClosePasswordModal: function() {
        ReactDOM.unmountComponentAtNode($passwordModal.get(0));
        $passwordModal.remove();
        $('.is-start-or-resume', form)
          .removeClass('sTestQuizStartButton-processed')
          .removeClass('is-start-or-resume');

        $('.submit-span-wrapper', form)
          .removeClass('disabled')
          .children().removeAttr('disabled');
      },
      initialization: form_opts.initialization,
      title: form_opts.title,
    }), $passwordModal.get(0));
    return false;
  } catch(error) {
    var err_msg = 'renderPasswordModal encountered the following error: ' + error;
    sAssessmentLogClientError(err_msg);
    // if the password modal fails to load, we don't want the user to be
    // passed on to the delivery page.
    return false;
  }
}
