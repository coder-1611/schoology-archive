Drupal.behaviors.sGradesItemAddForm = function (context) {

  let date_strings = Drupal.date_t_strings();
  let am_pm_long = date_strings.ampm.slice(2, 4);

  var form = $('#home-feed-container #s-grade-item-add-combined-form'); // Look only inside home-feed-container

  if (form.length) {  
    var cancelButton = $('#edit-cancel'); 

    if (cancelButton.length) {  
      form.prepend(cancelButton);
    }
  }

  $('#s-discussion-create-form:not(.sGradesItemAddForm-processed), #s-grade-item-add-form:not(.sGradesItemAddForm-processed), #s-assessment-question-edit-form:not(.sGradesItemAddForm-processed), #s-grade-item-edit-grades-form:not(.sGradesItemAddForm-processed)', context).addClass('sGradesItemAddForm-processed').each(function () {

    var form = $(this);
    var dateField = $("input[name='due_date[date]'], .csm-due-date", form);
    var timeField = $("input[name='due_date[time]']", form);

    if (dateField.prop('disabled')) {
      timeField.prop('disabled', true);
    }

    // when the popups close, close any opened rubrics editor opened
    $(document).bind('popups_before_remove', function (event, popup) {
      var formIds = [
        's-discussion-create-form',
        's-grade-item-add-form',
        's-grade-item-edit-grades-form'
      ];

      var formId = $('form', $('#' + popup.id)).attr('id');

      if (formIds.indexOf(formId) !== -1) {
        // legacy mastery
        $('.s-grading-rubric .close-btn').click();
        // district mastery
        $('.rubric-grades-edit .cancel-btn').click();
      }
    });

    form.on('click', '.factor-toggler', function () {
      $('.factor-wrapper', form).removeClass('hidden');
      $(this).addClass('hidden');
      sPopupsResizeCenter();
    });

    $('.s-grade-item-addl-course-due, .addl-course-options', form).each(function () {
      if ($('.due-date', this).prop('disabled')) {
        $('.time-input input', this).prop('disabled', true);
      }
    });

    dateField.blur(function () {
      var dropboxField = $('#edit-dropbox-enabled');
      dropboxEnabled = dropboxField.is(':checked') || !dropboxField.length;
      dateFieldContext = $(this);
      if (dateFieldContext.hasClass('csm-due-date')) {
        timeFieldContext = dateFieldContext.closest('.container-inline-date').find('.time-input').find('input');
      }
      else {
        timeFieldContext = timeField;
      }
      setTimeout(function () {
        if (dateFieldContext.val() != '' && timeFieldContext.val() == '' && dropboxEnabled) {
          timeFieldContext.val('11:59' + am_pm_long[1]);
        }
      }, 200);
    });

    var toggleDateWarning = function () {
      if ($("#edit-grading-task-id").length == 1) {
        $(".max-points-wrapper").css({'top': '-105px'})
      }
      if (sGradeItemShouldShowDueDateWarning(form)) {
        sGradeItemAddDueDateWarning(form);
        // Expand the grading options when an alert is shown if it's not shown already
        $('.category-options-wrapper, .grading-options-wrapper', form).toggle(true);
      } else {
        sCommonDateRemoveDueDateWarning(form);
      }
      sPopupsResizeCenter();
    };

    toggleDateWarning();
    dateField.change(toggleDateWarning);
    $("select[name='grading_period_id'], select[name='grading_period_id_final']", form).change(toggleDateWarning);
    $(".section-selection input", form).change(toggleDateWarning);
    $("input[name='enable_grading']", form).change(toggleDateWarning);

    $('#edit-dropbox-enabled', form).change(function () {
      dropboxEnabled = $(this).is(':checked');
      if ($("input[name='due_date[date]']").val() != '' && $("input[name='due_date[time]']").val() == '' && dropboxEnabled) {
        $("input[name='due_date[time]']").val('11:59' + am_pm_long[1]);
      }
      context = $('#copy-to-courses');
      $('.due-date', context).each(function () {
        if ($(this).val() != '' && dropboxEnabled) {
          parent = $(this).parents('.addl-course').filter(':first');
          if ($('.time-input input', parent).val() == '') {
            $('.time-input input', parent).val('11:59' + am_pm_long[1]);
          }
        }
      });
    });

    $(document).bind('popups_before_serialize', function (e, $form) {
      $('#edit-max-points', form).removeClass('disabled');
      $('#edit-max-points', form).prop('disabled', false);
    });


    sGradeScaleProcessRubricDropdown(form);

    // advanced options show/hide
    var advancedWrapper = $('.advanced-options-wrapper', form);
    $(".toggle-advanced-options", form).click(function () {
      sPopupsResizeCenter();
      if (advancedWrapper.is(':visible')) {
        $(this).removeClass('active');
        advancedWrapper.hide();
      }
      else {
        $(this).addClass('active');
        advancedWrapper.show();
      }
      return false;
    });

    $('body').click(function (e) {
      var target = $(e.target);
      if (advancedWrapper.is(':visible') && !target.hasClass('advanced-options-wrapper') && target.parents('.advanced-options-wrapper').length == 0)
        $(".toggle-advanced-options", form).click();
    });

    sGradesApplyHoverListener(form, '#category-wrapper .form-select');

    // create new category
    $("#edit-new-category-wrapper input").focus(function () {
      var defaultText = Drupal.t('e.g. Homework');
      var el = $(this);
      if (el.val() == defaultText) {
        el.val('');
        el.removeClass('pre-fill');
      }
    }).blur(function () {
      var defaultText = Drupal.t('e.g. Homework');
      var el = $(this);
      if (el.val() == '') {
        el.val(defaultText);
        el.addClass('pre-fill');
      }
    });

    var categorySelect = $('select[name=grading_category_id]', form),
      newCategoryInput = categorySelect.parent().siblings('#edit-new-category-wrapper'),
      newCategoryCancel = categorySelect.parent().siblings('.edit-new-category-cancel');

    // fill in defaults for selected category
    newCategoryInput.hide();
    newCategoryCancel.hide();
    categorySelect.change(function () {
      var category = $(this).val();
      // sites/all/modules/schoology_core/s_grades/s_grade_item/s_grade_item.module#S_GRADING_CATEGORY_NEW
      if (category == 'new') {
        newCategoryInput.show();
        newCategoryCancel.show();
        categorySelect.hide();
      }
      else {
        newCategoryInput.hide();
        newCategoryCancel.hide();
        categorySelect.show();
      }
      sPopupsResizeCenter();
      return true;
    });

    // cancel new category input
    newCategoryCancel.click(function () {
      categorySelect.val('').triggerHandler('change');
    });

    // copy to courses
    var addlCoursesCheckboxes = $('#addl-courses .addl-course input[type=checkbox][name$="[enabled]"]', form),
      copyToCoursesBtn = $('.adv-option-btn.toggle-copy', form);
    addlCoursesCheckboxes.each(function () {
      var addlElements = $(this).parent().parent().siblings();
      $(this).click(function () {
        var checked = $(this).is(':checked'),
          contextForm = $(this).parents('.addl-course').filter(':first');
        if (checked) {
          var mainDueWrapper = $("#edit-due-date-wrapper", form);
          var dueDate = $("input:first", mainDueWrapper).val();
          var hasTime = $("input[type=checkbox]", mainDueWrapper).is(":checked");
          var dueTime = $("input:last", mainDueWrapper).val();
          var addlCourseDueWrapper = $('.container-inline-date', addlElements);
          $("input:first", addlCourseDueWrapper).val(dueDate);
          $("input[type=checkbox]", addlCourseDueWrapper).attr('checked', hasTime);
          $("input:last", addlCourseDueWrapper).val(dueTime);
          if (!hasTime) {
            $("input[type=checkbox]", addlCourseDueWrapper).next().hide();
            $("input[type=checkbox]", addlCourseDueWrapper).next().val('');
          }
          addlElements.show();
        }
        else {
          addlElements.hide();
        }

        $('.due-date', contextForm).blur(function () {
          context = this;
          parent = $(this).parents('.addl-course').filter(':first');
          setTimeout(function () {
            dropboxEnabled = $('#edit-dropbox-enabled').is(':checked');
            if ($(context).val() != '' && $('.time-input input', parent).val() == '' && dropboxEnabled) {
              $('.time-input input', parent).val('11:59' + am_pm_long[1]);
            }
          }, 200);
        });

        sPopupsResizeCenter();

        // set the copy-to-courses button active based on whether any of the addition courses is selected
        if (addlCoursesCheckboxes.is(':checked')) {
          copyToCoursesBtn.addClass('active');
        }
        else {
          copyToCoursesBtn.removeClass('active');
        }
      });

      $(this).attr('checked', false);
      addlElements.hide();

    });

    $('#s-grade-item-add-enable-time', form).click(function () {
      var checked = $(this).is(':checked');
      if (checked) {
        $("#edit-due-date-timeEntry-popup-1-wrapper").show();
      }
      else {
        $("#edit-due-date-timeEntry-popup-1-wrapper").hide();
        $("#edit-due-date-timeEntry-popup-1").val('');
      }
    })
    if ($('#s-grade-item-add-enable-time', form).is(':checked'))
      $("#edit-due-date-timeEntry-popup-1-wrapper").show();

    $('.s-grade-item-addl-courses-enable-time', form).click(function () {
      var checked = $(this).is(':checked');
      if (checked) {
        $(this).next().show();
      }
      else {
        $(this).next().hide();
        $("input", $(this).next()).val('');
      }
    });

    $('#edit-is-final', form).click(function () {
      sGradeItemResolveIndAssign(form, $(this));
      sPopupsResizeCenter();
      toggleDateWarning();
    });


    if ($('#edit-is-final', form).is(':checked')) {
      form.addClass('s-grade-item-is-final');
      $("#category-wrapper", form).hide();
      $(".grading-period-leaf-periods-wrapper", form).hide();
      $('.grading-period-all-periods-wrapper', form).show();
      //Lock down individual assignments for existing grade items
      sGradeItemResolveIndAssign(form, $('#edit-is-final', form));
      sPopupsResizeCenter();
    }

    // Prompt when enabling collected-only for existing assignment, assessment, discussion and grade column material
    if ($('#edit-title').val() !== '') {
      let elEnableGrading = $('#edit-enable-grading'); // Only available to discussion
      let elCollected = $('#edit-option-collected-only');
      let prevIsCollected = elCollected.is(':checked');
      // Clicked "Save Changes"
      $('.course-material-form .submit-buttons .form-submit').bind('click', function (ev) {
        // When grading is enabled, did we switch from not collected to collected?
        let isGradingEnabled = elEnableGrading.is(':visible') ? elEnableGrading.is(':checked') : true; // Some materials do not have this option so default to true
        if (isGradingEnabled && !prevIsCollected && elCollected.is(':visible') && elCollected.is(':checked')) {
          ev.preventDefault();
          sCommonConfirmationPopup({
            title: $('#edit-title').val(),
            body: '<p>' + Utils.i18n.t(Drupal.settings.s_grades.is_district_mastery ? 'core.collected_only_mastery_prompt.message' :'core.collected_only_prompt.message') + '</p>',
            confirm: {
              func: function () {
                Popups.removePopup();
                $('form.course-material-form').submit();
              }
            }
          });
        }
      });
    }
  });

  $("#s-library-template-copy-form:not(.sGradeItemAddForm-processed), #s-library-import-template-form:not(.sGradeItemAddForm-processed)", context).addClass('sGradesItemAddForm-processed').each(function () {
    var form = $(this);
    // "is final" checkbox behavior
    $('.addl-is-final input:not(.sGradeItemAddForm-processed)', form).addClass('sGradeItemAddForm-processed').each(function () {
      var finalBox = $(this);
      finalBox.click(function () {
        var checkbox = $(this);
        var checkboxWrapper = checkbox.parents('.addl-is-final');

        if (checkbox.is(':checked')) {
          checkboxWrapper.siblings(".addl-grading-category").hide();
          checkboxWrapper.siblings(".addl-grading-period").hide();
          checkboxWrapper.siblings('.grading-period-all-periods-wrapper').show();
          sPopupsResizeCenter();
        }
        else {
          checkboxWrapper.siblings(".addl-grading-category").show();
          checkboxWrapper.siblings(".addl-grading-period").show();
          checkboxWrapper.siblings('.grading-period-all-periods-wrapper').hide();
          sPopupsResizeCenter();
        }
      });
    });
    //date picker behavior
    $('.s-grade-item-addl-course-due:not(.sGradeItemAddForm-processed)', form).addClass('sGradeItemAddForm-processed').each(function () {
      var datePicker = $(this);
      var dateInputs = $('input', datePicker);

      if (dateInputs.length > 1) {
        //first input is date
        var day = $(dateInputs[0]);
        //second is time
        var time = $(dateInputs[1]);
        day.blur(function () {
          var dropboxEnableWrapper = datePicker.siblings('.dropbox-enable-wrapper');
          var dropboxEnabledInput = $('input.dropbox-enable', dropboxEnableWrapper);
          var autoAddTime = true;

          //if there is a dropbox and it is not enabled, don't autoAddTime
          if (dropboxEnabledInput.length > 0 && !dropboxEnabledInput.is(':checked')) {
            autoAddTime = false;
          }

          if (autoAddTime) {
            setTimeout(function () {
              if (day.val() != '' && time.val() == '') {
                time.val('11:59' + am_pm_long[1]);
              }
            }, 200);
          }
        });
      }
    });
  });

  //$('#s-library-template-copy-form:not(.sGradeItemAddForm-processed)').addClass('sGradesItemAddForm-processed').each(function(){
  var form = $(this);
  //})

  // homepage smartbox form
  $('#s-grade-item-add-combined-form:not(.sGradesItemAddCombinedForm-processed)').addClass('sGradesItemAddCombinedForm-processed').each(function () {
    var form = $(this);
    var realmChooser = $('#edit-realms', form);
    var courses = $('#addl-courses', form);
    // advanced options show/hide
    var advancedWrapper = $('.advanced-options-wrapper', form);
    $(".toggle-advanced-options", form).click(function () {
      sPopupsResizeCenter();
      if (advancedWrapper.is(':visible')) {
        $(this).removeClass('active');
        advancedWrapper.hide();
      }
      else {
        $(this).addClass('active');
        advancedWrapper.show();
      }
      return false;
    });
    $('body').click(function (e) {
      var target = $(e.target);
      if (advancedWrapper.is(':visible') && !target.hasClass('advanced-options-wrapper') && target.parents('.advanced-options-wrapper').length == 0)
        $(".toggle-advanced-options", form).click();
    });

    realmChooser.bind('sHomeSmartBoxRealmSelectionUpdate', function (e, selected) {
      $('.addl-course', courses).each(function () {
        var course = $(this);
        var courseId = course.attr('id').replace(/^assignment-/, '');
        if ($.inArray(courseId, selected) == -1) {
          course.filter(':visible').hide();
        }
        else {
          courses.show();
          course.filter(':not(:visible)').appendTo(courses).show();
          sGradesApplyHoverListener(course, '#category-wrapper .form-select');
        }
      });

      $('.addl-course-first', courses).removeClass('addl-course-first');
      if (selected.length > 1)
        $('.addl-course:visible:eq(0)', courses).addClass('addl-course-first');

      $('#edit-dropbox-enabled').change(function () {
        $('.due-date').each(function () {
          if ($(this).val() != '') {
            parent = $(this).parents('.addl-course').filter(':first');
            if ($('.time-input input', parent).val() == '') {
              $('.time-input input', parent).val('11:59' + am_pm_long[1]);
            }
          }
        });
      });

      $(".due-date").each(function () {
        $(this).unbind('blur');
        $(this).blur(function () {
          var parent = $(this).parents('.addl-course').filter(':first');
          var context = this;

          setTimeout(function () {
            if ($(context).val() != '' && $('.time-input input', parent).val() == '' && $('#edit-dropbox-enabled').is(':checked')) {
              $(".time-input input", parent).val('11:59' + am_pm_long[1]);
            }
          }, 500);
        });
      });

    });

    // "copy settings" behavior"
    $('.copy-settings', courses).click(function () {
      // clear option-not-found warnings
      $('.option-not-found', courses).remove();

      // gather data
      var addlCourse = $(this).parents('.addl-course');
      var dueDate = $("input[id*=due-due-date-datepicker-popup]", addlCourse).val();
      var dueTime = $("input[id*=due-due-date-timeEntry-popup]", addlCourse).val();
      var categoryTitle = $('.addl-grading-category select option:selected', addlCourse).text();
      var scaleTitle = $('.addl-grading-scale select option:selected', addlCourse).text();

      //Select text from the grading hierarchy input if available, otherwise default to the regular grading period input
      if ($('.grading-period-all-periods-wrapper select option:selected', addlCourse).is(':visible')) {
        var periodTitle = $('.grading-period-all-periods-wrapper select option:selected', addlCourse).text();
        var periodFieldClass = '.grading-period-all-periods-wrapper ';
      }
      else {
        var periodTitle = $('.addl-grading-period select option:selected', addlCourse).text();
        var periodFieldClass = '.addl-grading-period ';
      }

      var optionLock = $('.lock-form-container select', addlCourse).val();
      var optionLockDate = $('.lock-form-container input:eq(0)', addlCourse).val();
      var optionLockTime = $('.lock-form-container input:eq(1)', addlCourse).val();

      // set data
      addlCourse.siblings(':visible').each(function () {
        var addlCourseDest = $(this);
        $("input[id*=due-due-date-datepicker-popup]", addlCourseDest).val(dueDate);
        $("input[id*=due-due-date-timeEntry-popup]", addlCourseDest).val(dueTime);

        var categoryOption = $('.addl-grading-category select option:contains("' + categoryTitle + '")', addlCourseDest);
        if (categoryOption.length) {
          categoryOption.attr('selected', 'selected');
        }
        else {
          sGradeItemAddWarning($('.addl-grading-category select', addlCourseDest), categoryTitle);
        }

        var scaleOption = $('.addl-grading-scale select option:contains("' + scaleTitle + '")', addlCourseDest);
        if (scaleOption.length) {
          scaleOption.attr('selected', 'selected');
        }
        else {
          sGradeItemAddWarning($('.addl-grading-scale select', addlCourseDest), scaleTitle);
        }

        var periodOption = $(periodFieldClass + 'select option:contains("' + periodTitle + '")', addlCourseDest);

        if (periodOption.length) {
          periodOption.attr('selected', 'selected');
        }
        else {
          sGradeItemAddWarning($(periodFieldClass + 'select', addlCourseDest), periodTitle);
        }

        $('.lock-form-container select', addlCourseDest).val(optionLock);
        if (optionLock == 1) {
          $('.lock-form-container input:eq(0)', addlCourseDest).val(optionLockDate);
          $('.lock-form-container input:eq(1)', addlCourseDest).val(optionLockTime);
          $('.lock-form-date-selector-container', addlCourseDest).removeClass('hidden');
        }
        else {
          $('.lock-form-date-selector-container', addlCourseDest).addClass('hidden');
        }
      });
    })

    function sGradeItemAddWarning(object, option) {
      var output = '<span class="option-not-found"><span></span></span>';

      var $output = $(output);
      $output.tipsy({
        html: true,
        title: function () {
          return Drupal.t('%option was not found', {'%option': option});
        }
      });

      object.after($output);
    }

    // "is final" checkbox behaviors
    $('#edit-is-final', form).click(function () {
      if ($(this).is(':checked')) {
        $(".addl-grading-category", courses).hide();
        $(".addl-grading-period", courses).hide();
        $('.grading-period-all-periods-wrapper').show();
      }
      else {
        $(".addl-grading-category", courses).show();
        $(".addl-grading-period", courses).show();
        $('.grading-period-all-periods-wrapper').hide();
      }
    });
  });

  $(document).bind('sAlignmentAlignmentBtnProcessed', function () {
    var selectedRubric = $('#edit-selected-rubric').val();
    if (selectedRubric && selectedRubric != '') {
      sAlignmentDisableAlignmentButton();
    }
    $(document).unbind('sAlignmentAlignmentBtnProcessed');
  });

  $('.availability-section:not(.sGradesItemAddForm-processed)').addClass('sGradesItemAddForm-processed').each(function() {
    var $availabilitySection = $(this);
    var $availability = $('select', $availabilitySection);
    var availability = $availability.val();
    sGradeItemProcessAvailability(availability, $availabilitySection);
    sPopupsResizeCenter();

    $availability.change(function(){
      var availability = $('select', $availabilitySection).val();
      sGradeItemProcessAvailability(availability, $availabilitySection);
      sPopupsResizeCenter();
    });
  });

  $('.password-section:not(.sGradesItemAddForm-processed)').addClass('sGradesItemAddForm-processed').each(function() {
    var $passwordSection = $(this);
    var $passwordSelect = $('select', $passwordSection);
    sGradeItemProcessPassword($passwordSelect.val(), $passwordSection);

    $passwordSelect.change(function(){
      sGradeItemProcessPassword($passwordSelect.val(), $passwordSection);
    });
  });

  if ($('.submission-options-wrapper').length) {
    const COLOR_ERROR_RED = '#E21707';
    const COLOR_WHITE = '#FFFFFF';
    const COLOR_BORDER_BLACK = '#C4C9CA';
    const COLOR_TEXT_GREY = '#677583';
    const COLOR_BACKGROUND_BLUE = '#BAD7FF';

    var submissionOptions = [
      {
        id: '#edit-submission-options-submit-photo-wrapper',
        valueProp: 'submit_photo',
      },
      {
        id: '#edit-submission-options-submit-audio-wrapper',
        valueProp: 'submit_audio',
      },
      {
        id: '#edit-submission-options-submit-video-wrapper',
        valueProp: 'submit_video',
      },
      {
        id: '#edit-submission-options-submit-upload-wrapper',
        valueProp: 'submit_upload',
      },
      {
        id: '#edit-submission-options-submit-type-wrapper',
        valueProp: 'submit_type',
      }
    ];

    var addSubmissionOptionEventIconDiv = function () {
      for (var i = 0; i < submissionOptions.length; i++) {
        if (!$(submissionOptions[i].id).find('.submission-option-event-icon').length) {
          $(submissionOptions[i].id).prepend('<span class="submission-option-event-icon"></span>');
        }
      }
    }

    addSubmissionOptionEventIconDiv();

    var setCheckBoxBackgroundColor = function (checkbox, color) {
      if (!checkbox) return;
      checkbox.css('background-color', color);
    }

    var setSubmissionOptionEventIcon = function (element, iconType) {
      if (!element) return;
      var iconUrl;
      switch (iconType) {
        case 'check':
          iconUrl = '/sites/all/themes/schoology_theme/images/modern_icons/check-mark.svg';
          break;
        case 'add':
          iconUrl = '/sites/all/themes/schoology_theme/images/modern_icons/add-mark.svg';
          break;
        default:
          iconUrl = '';
      }
      element.css('background-image', 'url(' + iconUrl + ')');
    }

    var updateErrorElement = function (element, borderColor, backgroundColor, textColor) {
      if (!element) return;
      element.css({
        'border-color': borderColor,
        'background-color': backgroundColor,
        'color': textColor,
      });
    }

    var toggleSubmissionOptionWarning = function () {
      var isAtleastOneChecked = false;

      for (var i = 0; i < submissionOptions.length; i++) {
        if ($("input[name='submission_options[" + submissionOptions[i].valueProp + "]']").is(':checked')) {
          setCheckBoxBackgroundColor($(submissionOptions[i].id), COLOR_BACKGROUND_BLUE);
          setSubmissionOptionEventIcon($(submissionOptions[i].id + ' .submission-option-event-icon'), 'check');
          isAtleastOneChecked = true;
        } else {
          setCheckBoxBackgroundColor($(submissionOptions[i].id), COLOR_WHITE);
          setSubmissionOptionEventIcon($(submissionOptions[i].id + ' .submission-option-event-icon'), 'add');
        }
      }

      if (!isAtleastOneChecked) {
        updateErrorElement($('#submission-option-required'), COLOR_ERROR_RED, COLOR_ERROR_RED, COLOR_WHITE);
      } else {
        updateErrorElement($('#submission-option-required'), COLOR_BORDER_BLACK, COLOR_WHITE, COLOR_TEXT_GREY);
      }
    }

    toggleSubmissionOptionWarning();

    var handleSubmissionOptionDivClicked = function () {
      for (let i = 0; i < submissionOptions.length; i++) {
        // First unbind any existing click handlers
        $(submissionOptions[i].id).off('click');

        // Then attach the new click handler
        $(submissionOptions[i].id).click(function () {
          let $wrapper = $(this);
          let checkbox = $wrapper.find('input[type="checkbox"]');
          if (!checkbox || !checkbox.length) return;
          let eventIconElement = $wrapper.find('.submission-option-event-icon');

          // Toggle checkbox state
          checkbox.prop('checked', !checkbox.prop('checked'));

          // Update visual state based on new checkbox value
          if (checkbox.is(':checked')) {
            setCheckBoxBackgroundColor($wrapper, COLOR_BACKGROUND_BLUE);
            setSubmissionOptionEventIcon(eventIconElement, 'check');
          } else {
            setCheckBoxBackgroundColor($wrapper, COLOR_WHITE);
            setSubmissionOptionEventIcon(eventIconElement, 'add');
          }

          // Update validation state
          toggleSubmissionOptionWarning();
        });
      }
    }

    handleSubmissionOptionDivClicked();

    /*
     * Trigger the gainsight event when the save button is clicked
     * Send info regarding the Submission types selected by the user
     * This would be sent only for Elementary theme
    */
    $('[id^=edit-submit]').click(function () {
      if (!window._gainsightInitialized || !window.aptrinsic) {
        return;
      }
      let noOfSubmissionTypesEnabled = 0;
      for (var i = 0; i < submissionOptions.length; i++) {
        const isSubmissionTypeChecked = $("input[name='submission_options[" + submissionOptions[i].valueProp + "]']").is(':checked');
        if (isSubmissionTypeChecked) {
          noOfSubmissionTypesEnabled++;
        }
      }
      if (noOfSubmissionTypesEnabled) {
        window.aptrinsic('track', 'elementaryThemeSubmissionTypes', { noOfSubmissionTypesEnabled });
      }
    });
  }
}

function sGradeItemPopupsCallback(data, options, element) {
  if (data.testQuiz) {
    return sTestQuizPopupCallback(data);
  }

  var nid = data.assignment_nid;
  window.location.href = '/assignment/' + nid;
  return false;
}

function sTestQuizPopupCallback(data) {
  window.location.href = '/course/' + data.section_id + '/assessments/' + data.assignment_nid;
  return false;
}

function sGradeItemResolveIndAssign(form, itemIsFinal) {
  //Helper function to ensure correct individual assignment/"set as midterm/final" form behavior
  if (itemIsFinal.is(':checked')) {
    form.addClass('s-grade-item-is-final');
    $("#category-wrapper", form).hide();
    $(".category-wrapper", form).hide();
    $(".addl-grading-category", form).hide();
    $(".grading-period-leaf-periods-wrapper", form).hide();
    $('.grading-period-all-periods-wrapper', form).show();
    // If individual assignments are already active set a warning message
    if ($('#ind-assign-container', form).hasClass('active')) {
      form.parents('.popups-body').first().prepend('<div id="ind-assign-warn" class="messages warning">' + Drupal.t("Midterm and final grade items cannot be individually assigned") + '</div>');
    }
    // Hide the individual Assign button and clear out any individual assignees
    $('#ind-assign-wrapper', form).addClass('disabled').removeClass('active').attr('disabled-title', Drupal.t('Midterm and final grade items cannot be individually assigned'));
    $('#ind-assign-container.active', form).addClass('hidden').removeClass('active');
    $('.selected-enrollment').remove();
    $('#edit-selected-eids,#edit-selected-gg-ids').val('');
  }
  else {
    form.removeClass('s-grade-item-is-final');
    $("#category-wrapper", form).show();
    $(".category-wrapper", form).show();
    $(".addl-grading-category", form).show();
    $(".grading-period-leaf-periods-wrapper", form).show();
    $('.grading-period-all-periods-wrapper', form).hide();
    //Un-disable the individual assign button but don't un-hide the individual assign textfield container
    //This should reset the visual elements for individual assign to a clean state (button is not active, field is hidden)
    $('#ind-assign-wrapper', form).removeClass('disabled');
    // Remove the finals/individual assign conflict warning message
    $('#ind-assign-warn').remove();
  }
}

function sGradeItemProcessAvailability(availability, $availabilitySection) {
  var startDatepicker = $('.availability-datepicker-row:eq(0)', $availabilitySection);
  var endDatepicker = $('.availability-datepicker-row:eq(1)', $availabilitySection);

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

function sGradeItemProcessPassword(passwordSelectValue, $passwordSection) {
  var $passwordField = $('.password-value-wrapper', $passwordSection)
  switch(passwordSelectValue) {
    case '4': // S_GRADE_ITEM_PASSWORD_DISABLE
      $passwordField.hide();
      sPopupsResizeCenter();
      break;
    case '5': // S_GRADE_ITEM_PASSWORD_ENABLE
      $passwordField.show();
      sPopupsResizeCenter();
      break;
  }
}

/**
 * Grading period elements are different based on whether the grading options is checked or not.
 *
 * @param {jQuery|HTMLElement} form
 * @return {jQuery|HTMLElement}
 */
function sGradeItemGetGradingPeriodElement(form) {
  if ($("input[name='is_final']").is(":checked")) {
    return $("select[name='grading_period_id_final'] :selected", form);
  }
  return $("select[name='grading_period_id'] :selected", form);
}

/**
 * Helper to check if grade item form should show due date warning
 *
 * @param {jQuery} form
 * @return {boolean}
 */
function sGradeItemShouldShowDueDateWarning(form) {
  // This would mean s_common_date_helper.js wasn't imported, make sure the date picker still works.
  if (typeof sCommonDateInRange === "undefined") {
    return false;
  }

  return sCommonShouldShowDueDateWarning(
    $("input[name='enable_grading']", form),
    sGradeItemGetGradingPeriodElement(form),
    $("input[name='due_date[date]']:visible, .csm-due-date:visible", form)
  );
}

/**
 * Helper to add the due date warning
 *
 * @param {object} form
 */
function sGradeItemAddDueDateWarning(form) {
  var gradePeriodField = sGradeItemGetGradingPeriodElement(form);
  var siblingElement = $(".grading-period-leaf-periods-wrapper", form).first();
  var warningText = sCommonDateDueDateWarningText(gradePeriodField);
  sCommonDateAddDueDateWarning(warningText, siblingElement, form);
}

/**
 * Clear error fields for all input elements
 */
function clearErrorFields() {
  $("input").each(function (){
    if ($(this).attr('id') == 'edit-realms') {
      let containerDiv = $(this).closest("#realms-container");
      if (containerDiv.length) {
        containerDiv.removeClass('error');
      }
    } else {
      $(this).removeClass('error');
    }
    $(this).removeAttr("aria-invalid");
  });
}
