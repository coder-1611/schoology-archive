var sCourseCSMSelectedSection = 0;
Drupal.behaviors.sCourseCSM = function(context) {

  // late creation of the Select2 object caused a formatting error, so we display everything after the select is ready
  $('.discussion-content').removeClass('hidden');

  // styling for the course section toggler
  $('.csm-toggle-sections:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function(){
    var courseToggler = $(this);
    var optionClass = sCommonGetSetting('s_course', 'csm_toggle_option_class');
    var optionSections = sCommonGetSetting('s_course', 'csm_toggle_option_sections');
    var firstSection = $('option:first', courseToggler).attr('value');
    courseToggler.select2({
      dropdownCssClass: 'select2-toggle s-course-csm-toggler',
      minimumResultsForSearch: -1,
      formatResultCssClass: function(opt){
        var selection = this.element.select2("val");
        var returnClass= '';
        if (opt.id == selection) {
          returnClass += 'select2-active ';
        }

        if(sIsset(optionSections) && optionSections.indexOf(String(opt.id)) != -1 && courseToggler.hasClass('csm-pending-review')){
          returnClass += optionClass + ' ';
        }
        return returnClass;
      },
      formatResult: function(result){
        return result.text;
      },
      formatSelection: function(result){
        var result = $('<div>' + result.text + '</div>');
        result.find('span.section-count, span.section-unread-count').remove();
        result = result.html();
        result = $.trim(result);
        return result;
      }
    });

    //function to modify the csm_section_nid param of the assessment "View by" links
    var asmtModNavLink = function(courseToggler, courseNid){
      courseToggler.closest('.assessment-results-nav-toggle').siblings('.results-students, .results-questions').each(function(){
        var linkObj = $(this);
        var linkHref = linkObj.attr('href');
        linkHref = linkHref.split('?');
        linkHref = linkHref[0];
        $(this).attr('href', linkHref + '?csm_section_nid=' + courseNid);
      });
    }

    var setupMembersArea = function(sectionNid){
      var rosterWrapper = $('#roster-wrapper', context);
      //replace course nids of the filter buttons
      $('.filter-btn, .action-invite, .enrollment-search input', rosterWrapper).each(function(){
        var filterBtn = $(this);
        var attrib = 'ajax';
        var linkHref = filterBtn.attr(attrib);
        if(!linkHref){
          attrib = 'href';
          linkHref = filterBtn.attr(attrib);
        }
        linkHref = setQueryParamsQ(linkHref, 'csm_section_nid', sectionNid);
        filterBtn.attr(attrib, linkHref);
      });
    };

    var notAjaxSwitch = ['csm-workload', 'csm-collaboration'];
    var ajaxSwitch = notAjaxSwitch.indexOf(courseToggler.attr('id')) == -1;
    var initHash = true;
    courseToggler.on('change', function(e){
      var pathName = location.pathname.split('/');
      var objID = pathName[2];
      switch(courseToggler.attr('id')){
        case 'assignment-comments':
          var subListToggler = $('#assignment-submissions-list');
          if(subListToggler.select2('val') != e.val) {
            subListToggler.select2('val', e.val, true);
          }
          sCourseCSMAjaxReplace('sCsmCommentsToggle', courseToggler, '.comment-container', '.comment-contents-container', e.val, 'assignment_comments', objID);
          break;
        case 'assignment-submissions-list':
          var commentToggler = $('#assignment-comments');
          if(commentToggler.select2('val') != e.val){
            commentToggler.select2('val', e.val, true);
          }
          var ltiGradableToggler = $('#assignment_lti_gradable_launch');
          if(ltiGradableToggler.length && ltiGradableToggler.select2('val') != e.val){
            ltiGradableToggler.select2('val', e.val, true);
          }
          sCourseCSMAjaxReplace('sCsmSubmissionsToggle', courseToggler, '.drop-items', '.csm-submissions-container', e.val, 'assignment_submissions_list', objID);
          break;
        case 'assignment-submissions':
          sDropItemSelectMenuChange(courseToggler);
          break;
        case 'assessment-results':
          asmtModNavLink(courseToggler, e.val);
          sCourseCSMAjaxReplace('sCsmAsmtResultsToggle', courseToggler, '.assessment-results-overlay-wrapper', '.assessment-results-content-wrapper', e.val, 'assessment_results', objID);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'assessment-stats':
          asmtModNavLink(courseToggler, e.val);
          sCourseCSMAjaxReplace('sCsmAsmtStatsToggle', courseToggler, '.assessment-stats-overlay-wrapper', '.assessment-stats-content-wrapper', e.val, 'assessment_stats', objID);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'assessment-question-responses':
          var ncidVal = pathName[5];
          var qparams = {key : 'ncid', val : ncidVal};
          asmtModNavLink(courseToggler, e.val);
          sCourseCSMAjaxReplace('sCsmAsmtQuestionResponsesToggle', courseToggler, '.assessment-question-responses-overlay-wrapper', '.assessment-question-responses-content-wrapper', e.val, 'assessment_question_responses', objID, qparams);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'album-content':
          sCourseCSMAjaxReplace('sCsmAlbumContent', courseToggler, '.album-overlay-wrapper', '.album-contents-wrapper', e.val, 'album_content', objID);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'discussion-content':
          if (e.val == sCourseCSMSelectedSection){
            return;
          }
          sCourseCSMSelectedSection = e.val;
          var objID = pathName[6];
          if(typeof tinymce != 'undefined'){
            tinymce.EditorManager.execCommand('mceRemoveControl',true, 'edit-comment');
          }
          sCourseCSMAjaxReplace('sCsmDiscussionToggle', courseToggler, '.discussion-overlay-wrapper', '.discussion-content', e.val, 'discussion_toggle', objID);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'csm-gradebook':
          sAngular.rootScopeBroadcast('sGraderFilterCsmSectionChanged', e.val);
          window.location.hash = 'csm_section_nid=' + e.val;
          initHash = false;
          break;
        case 'csm-competency':
          sAngular.rootScopeBroadcast('sCourseCompetencyCsmSectionChanged', e.val);
          sCourseCSMCompetencyModLinks(courseToggler, e.val);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'csm-attendance':
          sCourseCSMAjaxReplace('sCsmAttendance', courseToggler, '.csm-attendance-overlay-wrapper', '.csm-attendance-contents-wrapper', e.val, 'csm_attendance');
          var wrapperObj = $('#main-inner');
          $('.print-attendance-reports', wrapperObj).each(function(){
            var newHref = '/course/' + e.val + '/attendance/print';
            $(this).attr('href', newHref);
          });
          var prevObj = $('.prev', wrapperObj);
          var prevHref = prevObj.attr('href');

          prevHref = setQueryParams('csm_section_nid', e.val, false, false, prevHref);
          prevObj.attr('href', prevHref);
          var nextObj = $('.next', wrapperObj);
          var nextHref = nextObj.attr('href');
          nextHref = setQueryParams('csm_section_nid', e.val, false, false, nextHref);
          nextObj.attr('href', nextHref);
          Drupal.settings.s_common.week_chooser_uri_override = setQueryParams('csm_section_nid', e.val);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'csm-badges':
          sCourseCSMAjaxReplace('sCsmBadges', courseToggler, '.csm-badges-overlay-wrapper', '.csm-badges-contents-wrapper', e.val, 'csm_badges');
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'csm-learning-objectives':
          sCourseCSMAjaxReplace('sCsmLearningObjectives', courseToggler, '.csm-competency-overlay-wrapper', '.csm-learning-objectives-contents-wrapper', e.val, 'csm_learning_objectives');
          sCourseCSMCompetencyModLinks(courseToggler, e.val);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'csm-tag':
          sAngular.rootScopeBroadcast('sCourseCompetencyCsmSectionChanged', e.val);
          sCourseCSMCompetencyModLinks(courseToggler, e.val);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'message-content':
          courseToggler.closest('#s-messaging-send-to-group-form').find('#edit-csm-selected-section').val(e.val)
          sPopupsResizeCenter();
          break;
        case 'csm-members':
          setupMembersArea(e.val);
          var rosterWrapper = $('#roster-wrapper', context);
          var adminBtn = $('.filter-btn.active', rosterWrapper);
          if(!adminBtn.length){
            adminBtn = $('.all-filter', rosterWrapper);
          }
          sEnrollmentAjax(adminBtn, adminBtn.attr('ajax'));
          sAngular.rootScopeBroadcast('sCourseGradingGroupSectionChanged', e.val);
          window.location.hash = 'csm_section_nid=' + e.val;
          break;
        case 'csm-collaboration':
        case 'csm-analytics':
          //will perform reload and set the url section id
          setLocationPath(1, e.val);
          break;
        case 'csm-masquerade':
          var popupBody = $('.popups-body');
          $('.s-js-enrollment-preview-toggle span', popupBody).each(function(){
            var toggleObj = $(this);
            var ajaxUrl = toggleObj.attr('ajax');
            var ajaxUrl = setQueryParamsQ(ajaxUrl, 'csm_section_nid', e.val);
            toggleObj.attr('ajax', ajaxUrl);
            toggleObj.toggleClass('s-js-allow-active-ajax', true);
          });
          $('.active', popupBody).trigger('click');

        case 'event-comments':
          var guestToggler = $('#event-guestlist');
          if(guestToggler.select2('val') != e.val) {
            guestToggler.select2('val', e.val, true);
          }
          sCourseCSMAjaxReplace('sCsmEventComments', courseToggler, '.event-comments-overlay', '.event-comments-container', e.val, 'event_comments', objID);
          break;
        case 'event-guestlist':
          var commentToggler = $('#event-comments');
          if(commentToggler.select2('val') != e.val) {
            commentToggler.select2('val', e.val, true);
          }
          sCourseCSMAjaxReplace('sCsmEventGuestlist', courseToggler, '.event-guestlist-overlay', '.event-guestlist-container', e.val, 'event_guestlist', objID);
          $('.view-members,.invite').each(function(){
            var linkObj = $(this);
            var newHref = linkObj.attr('href');
            newHref = setQueryParamsQ(newHref, 'csm_section_nid', e.val);
            linkObj.attr('href', newHref);
          });
          courseToggler.on('ajax-complete', function(){
            var isUnpub = $('.unpub-event').length;
            var inviteBtn = $('a.invite');
            if(inviteBtn.hasClass('disabled') != isUnpub){
              inviteBtn.toggleClass('disabled', isUnpub);
            }
            courseToggler.unbind('ajax-complete');
          })
          break;
        case 'assignment_lti_gradable_launch':
          var subListToggler = $('#assignment-submissions-list');
          if(subListToggler.length && subListToggler.select2('val') != e.val){
            subListToggler.select2('val', e.val, true);
          }
          sCourseCSMAjaxReplace('sCsmLtiGradableLaunch', courseToggler, '#center-inner', '.s-lti-gradable-launch-wrapper', e.val, 'assignment_lti_gradable_launch', objID);
          break;
        default:
          //by default it'll use the GET ajax parameter to set the course_nid
          setQueryParams('csm_section_nid', e.val, true);
          break;
      }
    });

    var qParams = getQueryParams();
    if(qParams['csm_section_nid'] && courseToggler.attr('id') == 'csm-members'){
      setupMembersArea(qParams['csm_section_nid']);
    }

    //if hash is set with csm_section_nid and yet the hash parameter is not the same with the query parameter,
    //set the course toggle section nid to be the hash csm_section_nid parameter
    var hash = window.location.hash;
    if(hash){
      hash = hash.replace('#', '?');
      var hashParams = getQueryParams(hash);
      if(hashParams['csm_section_nid'] && hashParams['csm_section_nid'] != qParams['csm_section_nid']){
        if(initHash && (firstSection != hashParams['csm_section_nid'] || (qParams['csm_section_nid'] && firstSection != qParams['csm_section_nid']))){
          courseToggler.select2('val', hashParams['csm_section_nid'], true);
        }
      }
      else{
        window.location.hash = '';
      }
    }
    else if(qParams['csm_section_nid'] && ajaxSwitch && courseToggler.select2('val') != qParams['csm_section_nid']){
      courseToggler.select2('val', qParams['csm_section_nid'], true);
    }

    var modLinksArr = ['csm-tag', 'csm-learning-objectives', 'csm-competency'];
    if(qParams['csm_section_nid'] && modLinksArr.indexOf(courseToggler.attr('id')) != -1){
      sCourseCSMCompetencyModLinks(courseToggler, qParams['csm_section_nid']);
    }

    sPopupsResizeCenter();
  });

  $('#s-grade-item-manager:not(.sCourseCSM-processed)').addClass('sCourseCSM-processed').each(function(){
    var wrapperObj = $(this);
    sCourseCSMSetupStatusBtn(wrapperObj);
  });

  $('.csm-node-assign-wrapper:not(.sCourseCSM-processed), .shared-fields:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function(){
    var lastDate = false;

    var wrapperObj = $(this);
    var giDropBox = $('.adv-option-dropbox', wrapperObj.closest('form'));

    sCourseCSMSetupStatusBtn(wrapperObj);

    //setup locking
    $('.csm-item-assign-section', wrapperObj).each(function () {
      var rowWrapper = $(this);
      var lockBtn = $('.lock-btn', rowWrapper);
      sCourseMaterialsSetupLock(lockBtn, rowWrapper, giDropBox, false);
    });

    wrapperObj.on('click', '.lock-btn', function(e){
      var targetObj = $(e.target);
      var lockWrapper = targetObj.closest('.csm-item-assign-section');
      var lockedFieldsWrapper = $('.lock-form-container', lockWrapper);
      sCourseMaterialsToggleLock(lockWrapper, lockedFieldsWrapper, giDropBox, true);
    });

    $.datepicker.setDefaults({
      onClose : function(dateText, inst){
        lastDate = dateText;
        $(this).trigger('blur');
      }
    });

    wrapperObj.on('focus', '.csm-due-date', function(e){
      var dateField = $(e.target);
      if(lastDate){
        dateField.val(lastDate);
      }
    });

    sCourseCSMSetupFakePopup(wrapperObj);
  });

  $('.csm-folder-assign-wrapper:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function(){
    var wrapperObj = $(this);
    sCourseCSMSetupStatusBtn(wrapperObj, true);

    //If the "availability type" dropdown changes, modify the status indicator to be "on" or "off" based on the settings
    $(wrapperObj).on('change', '.csm-avail-type, .s-js-date-field, .time-input input', function(e){
      var dropdownRow = $(e.target).parents('.csm-item-assign-section');
      var dropdownObj = $('.csm-avail-type', dropdownRow);
      var statusIndicator = $('.adv-option-btn', dropdownRow);
      var statusHasClass = statusIndicator.hasClass('adv-option-on');
      switch(dropdownObj.val()) {
        case '1': // visible
          if(!statusHasClass){
            statusIndicator.addClass('adv-option-on');
          }
          break;
        case '4': //during
        case '3': //after
          var isDuring = dropdownObj.val() == '4';
          if(isDuring){
            $('.add-end-btn', dropdownRow).click();
          }


          var todayDate = $('.today-date').text() + 'T' + $('.today-time').text();
          var startDate = $('.form-row:not(.end-date-wrapper) .s-js-date-field', dropdownRow).val() + 'T' + $('.form-row:not(.end-date-wrapper) .time-input input', dropdownRow).val();
          var shouldHaveClass = todayDate > startDate;
          var statusIndicator = $('.adv-option-btn', dropdownRow);
          var statusHasClass = statusIndicator.hasClass('adv-option-on');
          if(isDuring){
            var endDate = $('.end-date-wrapper .s-js-date-field', dropdownRow).val() + 'T' + $('.end-date-wrapper .time-input input', dropdownRow).val();
            shouldHaveClass = shouldHaveClass && todayDate < endDate;
          }
          if(shouldHaveClass != statusHasClass){
            statusIndicator.toggleClass('adv-option-on', shouldHaveClass);
          }
          break;
        default: // invisible
          if(statusHasClass){
            statusIndicator.removeClass('adv-option-on');
          }
          break;
      }
    });

    //Add an end date if the "Add End Date" button is clicked
    wrapperObj.on('click', '.add-end-btn', function(e){
      var addObj = $(e.target);
      var adderWrapper = addObj.closest('.csm-item-assign-section');
      $('.end-date-wrapper', adderWrapper).removeClass('hidden');
      addObj.addClass('hidden');
      sPopupsResizeCenter();
    });

    $('.csm-avail-type').trigger('change');

    var endDateField = $('.end-date-wrapper .s-js-date-field', wrapperObj).each(function(){
      var endDateField = $(this);
      if(endDateField.val()){
        endDateField.closest('.csm-folder-assign-section').find('.add-end-btn').click();
      }
    });

    sCourseCSMSetupFakePopup(wrapperObj);
  });

  $('#s-course-unlink-sections-form-1:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function(){
    var formObj = $(this);
    var blueBoxTxt = $('#csm-bluebox-text', formObj);

    formObj.on('click', '.form-checkbox', function(){
      var checkedBox = $(this);
      var notChecked = !checkedBox.is(':checked');
      blueBoxTxt.html(sCourseGetCheckedList(formObj, true));
      sPopupsResizeCenter();
      var parentObj = checkedBox.closest('.csm-link-existing-section-row');
      $('.unlink-icon', parentObj).toggleClass('hidden', notChecked);
      $('.unlink-opts', parentObj).toggleClass('hidden', notChecked);
      sPopupsResizeCenter();
    });

    // fill the list of unchecked sections to start
    blueBoxTxt.html(sCourseGetCheckedList(formObj, true));
    sPopupsResizeCenter();
  });

  $('#s-course-link-existing-sections-form-1:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function(){
    var formObj = $(this);
    var blueBoxTxt = $('#csm-bluebox-text', formObj);
    var submitWrapper = $('.submit-span-wrapper', formObj);
    var submitButton = $('input', submitWrapper);

    function checkCluetipDisplay(rowObj){
      var rowCluetip = $('.infotip', rowObj);
      if(rowCluetip.length){
        var numMsg = $('.infotip-item:not(.hidden)', rowCluetip).length;
        if(numMsg){
          rowCluetip.tipsy('enable');
        }
        else{
          rowCluetip.tipsy('disable');
        }
      }
    }

    //initial check cluetip display on load
    $('.csm-link-existing-section-row', formObj).each(function(){
      checkCluetipDisplay($(this));
    });


    formObj.on('click', '.form-checkbox', function(){
      var checkboxObj = $(this);
      var sectionRow = checkboxObj.closest('.csm-link-existing-section-row');
      blueBoxTxt.html(sCourseGetCheckedList(formObj));

      //if there are overlapping enrollments with other sections, disable/enable the checkboxes of these other sections depending on whether or not the checkbox is checked
      var overlaps = $('.overlap-list', sectionRow);
      if(overlaps.length){
        overlaps = overlaps.text();
        overlaps = overlaps.split(',');
        var disable = checkboxObj.is(':checked');
        $.each(overlaps, function(index, val){
          var ovCheckbox = $('#edit-sections-' + val, formObj);
          ovCheckbox.attr('disabled', disable);
          var overlapRow = ovCheckbox.closest('.csm-link-existing-section-row');
          overlapRow.toggleClass('disabled', disable);
          $('.overlap-infotip', overlapRow).toggleClass('hidden', !disable);
          checkCluetipDisplay(overlapRow);
        });
      }
      sPopupsResizeCenter();
    });

    // fill the list of selected sections to start
    blueBoxTxt.html(sCourseGetCheckedList(formObj));

    // Finally, resize the popup to fit the content
    sPopupsResizeCenter();
  });

  $('.step2:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function(){

    setTimeout(function () {
      $focus = $(this).find('.csm-link-section-instructions');
      $focus.focus();
    }.bind(this), 0);

    $('label', this).on('keypress', function(e) {
      var ENTER_KEY = 13;
      var SPACE_KEY = 32;

      if (e.which === ENTER_KEY || e.which === SPACE_KEY) {
        $(e.target.children).attr('checked', true);
        $('.submit-span-wrapper', context).removeClass('disabled');
        $('input', context).removeAttr('disabled');
      }
    });

    $('#edit-submit.form-submit', this).on('click', function(e) {
      e.preventDefault();
      $(this).submit();
      setTimeout(function () {
        window.location = '/course/export/export_grades';
      }, 500)
    });

    $(this).on('click', '.form-radio', function() {
      $('.submit-span-wrapper', context).removeClass('disabled');
      $('input', context).removeAttr('disabled');
    });

    $(".csm-link-section-instructions-header .option[for='edit-export-type-gbook']", context).tipsy({
      gravity: 'w',
      title: function () {
        return Drupal.t('Select this option to download a CSV version of the section\'s gradebook. This spreadsheet is formatted similarly to how it is in Schoology, with the student names vertically and the material titles along the top.');
      },
    });

    $(".csm-link-section-instructions-header .option[for='edit-export-type-portable']", context).tipsy({
      gravity: 'w',
      title: function () {
        return Drupal.t('Select this option to download a CSV file with more detailed student data. This spreadsheet is separated by columns for mapping purposes to use to import into another system, such as an SIS gradebook.');
      },
    });
  });

  $('.csm-item-assign-section .availability-row:not(.sCourseCSM-processed)', context).addClass('sCourseCSM-processed').each(function() {
    var $availabilitySection = $(this);
    var $availability = $('select', $availabilitySection);
    var availability = $availability.val();

    sCourseCSMProcessAvailability(availability, $availabilitySection);
    $availability.change(function(){
      var availability = $('select', $availabilitySection).val();
      sCourseCSMProcessAvailability(availability, $availabilitySection);
    });
  });

  $('.csm-item-assign-section .password-row:not(.sCourseCSM-processed)').addClass('sCourseCSM-processed').each(function() {
    var $passwordSection = $(this);
    var $passwordSelect = $('select', $passwordSection);
    sCourseCSMProcessPassword($passwordSelect.val(), $passwordSection);

    $passwordSelect.change(function(){
      sCourseCSMProcessPassword($passwordSelect.val(), $passwordSection);
    });
  });
};

function sCourseCSMSetupFakePopup(wrapperObj){
  var fakePopup = $('.fake-popup-wrapper', wrapperObj);
  var addRuleBtn = $('.add-rule', wrapperObj);
  addRuleBtn.click(function(){
    if(!fakePopup.hasClass('hidden') || !addRuleBtn.hasClass('disabled-assign')){
      fakePopup.toggleClass('hidden');
    }
  });

  $('body').on('click', function(e){
    var targetObj = $(e.target);
    if(!targetObj.closest('.fake-popup-wrapper, .add-rule').length){
      fakePopup.toggleClass('hidden', true);
    }
  });

  var selectionInputs = $('input.section-selection', fakePopup);
  fakePopup.on('change', 'input', function(e, isDelete){
    var targetObj = $(e.target);
    var targetVal = targetObj.val();
    var isChecked = targetObj.is(':checked');
    var allElse = $('.all_else', fakePopup);
    var hasNotChecked = selectionInputs.not(':checked').length;
    if(!targetObj.hasClass('all_else')){
      var targetSectionWrapper = $('#' + targetVal + '.csm-item-assign-section', wrapperObj);
      targetSectionWrapper.toggleClass('hidden', !isChecked);
      if(!isChecked){
        allElse.prop('checked', false);
        if(isDelete){
          //if delete button is clicked, reset all fields to their default values
          $('input:not([type=hidden])', targetSectionWrapper).each(function () {
            var inputObj = $(this);
            if (inputObj.hasClass('.lock-date-dropdown')) {
              inputObj.val(0);
              inputObj.trigger('change');
            }
            else {
              inputObj.val('');
            }
          });
          var publishBtn = $('.toggle-publish', targetSectionWrapper);
          if(!publishBtn.hasClass('adv-option-on')){
            publishBtn.trigger('click');
          }
          var lockDropdown = $('.lock-date-dropdown', targetSectionWrapper);
          lockDropdown.val(0);
          lockDropdown.trigger('change');
          var lockBtn = $('.lock-btn', targetSectionWrapper);
          if(!lockBtn.hasClass('active')){
            lockBtn.trigger('click');
          }

          $('.end-date-wrapper', targetSectionWrapper).addClass('hidden');
          $('.add-end-btn', targetSectionWrapper).removeClass('hidden');
          sPopupsResizeCenter();
        }
      }
      else if(!hasNotChecked){
        allElse.prop('checked', true);
      }
    }
    else{
      $('input.section-selection', fakePopup).each(function(){
        var selectionInput = $(this);
        selectionInput.prop('checked', isChecked);
        selectionInput.trigger('change');
      });
    }

    sCourseToggleAllElse(selectionInputs, wrapperObj);
    if(typeof sCourseAssignSelectedSections != 'undefined' && !$.isEmptyObject(sCourseAssignSelectedSections)){
      sCourseCSMIndivAssignProcessAllElse();
    }
  });

  wrapperObj.on('click', '.delete-btn', function(e){
    var targetObj = $(e.target);
    if(!targetObj.hasClass('disabled-assign')){
      var sectionRow = targetObj.closest('.csm-item-assign-section');
      var sectionID = sectionRow.attr('id');
      var sectionCheckbox = $('input[value=' + sectionID + ']', fakePopup);
      sectionCheckbox.prop('checked', false);
      sectionCheckbox.trigger('change', true);
    }
  });

  sCourseToggleAllElse(selectionInputs, wrapperObj);


  if(typeof sCourseAssignCSMToggleCluetip != 'undefined'){
    $('.delete-btn, .add-rule', wrapperObj).each(function(){
      $(this).tipsy({
        gravity: 's',
        title: function(){
          return Drupal.t('This item is individually assigned');
        }
      });
    });

    sCourseAssignCSMToggleCluetip(true, wrapperObj);
  }
}

function sCourseCSMIndivAssignProcessAllElse() {
  if(typeof sCourseAssignSelectedSections == 'undefined'){
    return;
  }
  var csmWrapper = $('.csm-node-assign-wrapper');
  //process the enabling/disabling of the all_else fields
  var fakePopupWrapper = $('.fake-popup-wrapper', csmWrapper);
  var allElseWrapper = $('.csm-node-assign-section#all_else', csmWrapper);
  var hasAssigns = !$.isEmptyObject(sCourseAssignSelectedSections);
  //var hasUnchecked = $('input.section-selection:not(:checked)').length > 0;
  //hide the catch-all field if there are individual assignments
  allElseWrapper.toggleClass('hidden-assign', hasAssigns);
}

function sCourseToggleAllElse(selectionInputs, wrapperObj){
  var hasNotChecked = selectionInputs.not(':checked').length;
  var allElseSection = $('.csm-item-assign-section#all_else', wrapperObj);
  var allElseSectionLabel = $('label.all_else', allElseSection);
  if(!selectionInputs.filter(':checked').length){
    allElseSectionLabel.text(Drupal.t('All Sections'));
  }
  else{
    allElseSectionLabel.text(Drupal.t('Everyone else'));
  }
  allElseSection.toggleClass('hidden', !hasNotChecked);
  sPopupsResizeCenter();
  var formObj = wrapperObj.closest('form');
  formObj.scrollTop(Popups.windowHeight());
}


function sCourseGetCheckedList(formObj, unlink){
  var submitWrapper = $('.submit-span-wrapper', formObj);
  var submitButton = $('input', submitWrapper);
  var masterTitle = $('.parent-title', formObj).text();

  if (masterTitle) {
    masterTitle = htmlentities(masterTitle);
  }

  if(typeof unlink == 'undefined'){
    unlink = false;
  }

  var checkedList = '';
  var hasChecked = false;
  $('.form-checkbox', formObj).each(function(){
    var checkbox = $(this);
    var cbTitle = checkbox.siblings('.form-checkbox-title').find('.title').text();
    if (cbTitle) {
      cbTitle = htmlentities(cbTitle);
    }

    var append = checkbox.prop('checked');
    if(!hasChecked && append){
      hasChecked = true;
    }
    if(unlink){
      append = !append;
    }
    if(append){
      checkedList += ', ' + cbTitle;
    }
  });

  var returnStr = '<span class="inline-icon mini course-icon"></span>' + masterTitle;
  if(checkedList){
    returnStr += checkedList;
  }

  submitWrapper.toggleClass('disabled', !hasChecked);
  submitButton.attr('disabled', !hasChecked);

  return returnStr;
}

function sCourseCSMCompetencyModLinks(courseToggler, csmSectionNid){
  var links = [
    '.s-js-learning-objectives-toggle-link',
    '.s-js-student-achievement-toggle-link',
  ];
  var contextObj = courseToggler.closest('#s-js-competency-book-header');
  $(links.join(',')).each(function(){
    var linkObj = $(this);
    var hrefVal = linkObj.attr('href');
    hrefVal = hrefVal.split('?')[0];
    hrefVal += '?csm_section_nid=' + csmSectionNid;
    linkObj.attr('href', hrefVal);
  });

  $('#s-js-action-export-detail').each(function() {
    var linkObj = $(this);
    var hrefVal = linkObj.attr('href');
    hrefVal = hrefVal.replace(/export_.+/, 'export_detail/' + csmSectionNid);
    linkObj.attr('href', hrefVal);
  });

  $('#s-js-action-export-summary').each(function(){
    var linkObj = $(this);
    var hrefVal = linkObj.attr('href');
    hrefVal = hrefVal.replace(/export_.+/, 'export_summary/' + csmSectionNid);
    linkObj.attr('href', hrefVal);
  });
}

function sCourseCSMAjaxReplace(key, courseToggler, overlayClass, contentClass, courseNid, ajaxType, itemNid, qParams){
  if(typeof qParams != 'undefined'){
    qParams = setQueryParams(qParams.key, qParams.val, false, true);
  }
  else{
    qParams = window.location.search.substring(1);
    qParams = qParams ? '?' + qParams : '';
  }

  qParams += qParams ? '&' : '?';
  qParams += 'csm_section_nid=' + courseNid;

  var contentContainer = $(contentClass, overlayWrapper);
  var overlayWrapper = courseToggler.closest(overlayClass);
  hasItem = typeof itemNid != 'undefined';
  if(hasItem){
    var ajaxURL = '/course/' + courseNid + '/csm_material_ajax/' + itemNid + '/' + ajaxType + qParams;
  }
  else{
    var ajaxURL = '/course/' + courseNid + '/csm_page_ajax/' + ajaxType + qParams;
  }
  sToggleActiveLoader(key, overlayWrapper);
  $.ajax({
    url: ajaxURL,
    dataType: 'json',
    success: function(json){
      contentContainer.html(json.output);

      //see https://stackoverflow.com/questions/11681072/executing-a-javascript-function-returned-from-ajax-response-php
      contentContainer.find("script").each(function(i) {
        eval($(this).text());
      });

      if(json.settings){
        $.extend(Drupal.settings, json.settings);
      }
      Drupal.attachBehaviors(contentContainer);
      sToggleActiveLoader(key);
      courseToggler.trigger('ajax-complete');
    }
  });
}

function sCourseCSMSetupStatusBtn(wrapperObj, isFolder){
  if(!sIsset(isFolder)){
    isFolder = false;
  }

  $('.toggle-publish, .lock-btn', wrapperObj).each(function(){
    var btnObj = $(this);
    var onTitle = btnObj.attr('on-title'),
      offTitle = btnObj.attr('off-title');

    btnObj.tipsy({
      gravity: 's',
      title: function(){
        if(btnObj.hasClass('adv-option-on')){
          return onTitle;
        }
        else{
          return offTitle;
        }
      }
    });
  });

  wrapperObj.on('click', '.toggle-publish', function(e){
    var target = $(e.target);
    if(!target.hasClass('disabled')) {
      var className = 'adv-option-on';
      var hasClass = target.hasClass(className);
      target.toggleClass(className, !hasClass);
      if(isFolder){
        var availVal = !hasClass ? 1 : 2;
        target.closest('.csm-folder-assign-section').find('.csm-avail-type').val(availVal);
      }
      else{
        target.siblings('.csm-status:first').val(Number(!hasClass));
      }
    }
  });
}

function sCourseCSMProcessAvailability(availability, $availabilitySection) {
  // Include the dash as part of the start date because they should appear/hide together
  var startDatepicker = $('.container-inline-date.date-clear-block:eq(0), .availability-dash', $availabilitySection);
  var endDatepicker = $('.container-inline-date.date-clear-block:eq(1)', $availabilitySection);

  switch(availability) {
    case '0': // S_ASSESSMENT_AVAILABILITY_HIDE
    case '1': // S_ASSESSMENT_AVAILABILITY_SHOW
      startDatepicker.hide();
      endDatepicker.hide();
      break;
    case '2': // S_ASSESSMENT_AVAILABILITY_NOW_UNTIL
      startDatepicker.hide();
      endDatepicker.show();
      break;
    case '3': // S_ASSESSMENT_AVAILABILITY_FROM_UNTIL
      startDatepicker.show();
      endDatepicker.show();
      break;
  }
}

function sCourseCSMProcessPassword(passwordSelectValue, $passwordSection) {
  var $passwordField = $('.password-value-wrapper', $passwordSection)
    switch(passwordSelectValue) {
    case '4': // GradeItemDomain::PASSWORD_DISABLE
      $passwordField.hide();
      sPopupsResizeCenter();
      break;
    case '5': // GradeItemDomain::PASSWORD_ENABLE
      $passwordField.show();
      sPopupsResizeCenter();
      break;
  }
}
