function sGradeItemSelectScaleChange(form, gsSelectObj, show_dialog) {
  var gsSelectArea = gsSelectObj.parents('.grading-scale-select-grouping');

  var newVal = gsSelectObj.val();
  var rubric_objective_count = $('.tag-item-from-rubric').length;

  // Rubric selection
  if (Drupal.settings.s_grading_rubrics !== undefined && (Drupal.settings.s_grading_rubrics[newVal] !== undefined || newVal == 'r')) {

    // Show confirmation popup if action would clear existing learning objectives
    var aligned_objective_count = $('.tag-item:not(.tag-item-from-rubric)').length;
    // If learning objectives would be cleared by the action, show dialog
    if (show_dialog && (newVal != 'r' && rubric_objective_count + aligned_objective_count > 0)) {
      if (Drupal.settings.s_grading_rubrics_info[newVal] && 'rubric' in Drupal.settings.s_grading_rubrics_info[newVal]) {
        var rubric_title = Drupal.settings.s_grading_rubrics_info[newVal].rubric.title + ' ';
      } else {
        var rubric_title = "Current rubric ";
      }
      sReplaceLearningObjectivesPopup(form, gsSelectObj, rubric_title, function(result){
        if (result) {
          sGradeItemChangeRubric(form, gsSelectObj);
          $(document).data('previous_scale_selection', $(':selected', gsSelectArea));
        }
      });
    } else {
      sGradeItemChangeRubric(form, gsSelectObj);
      $(document).data('previous_scale_selection', $(':selected', gsSelectArea));
    }
  }
  // Scale selection
  else {
    // popup ?
    if (show_dialog && rubric_objective_count > 0) {
      sReplaceLearningObjectivesPopup(form, gsSelectObj, 0, function(result){
        if (result) {
          sGradeItemChangeScale(form, gsSelectObj);
          $(document).data('previous_scale_selection', $(':selected', gsSelectArea));
        }
      });
    } else {
      sGradeItemChangeScale(form, gsSelectObj);
      $(document).data('previous_scale_selection', $(':selected', gsSelectArea));
    }
  }

  sPopupsResizeCenter();
}

function sGradeItemChangeScale(form, gsSelectObj) {

  var gsSelectArea = gsSelectObj.parents('.grading-scale-select-grouping');
  var newVal = gsSelectObj.val();
  var maxPointsObj = $('#edit-max-points', form);

  $('.option-show-scale', gsSelectArea).addClass('hidden');
  $('#edit-chosen-rubric', gsSelectArea).addClass('hidden');
  $('#edit-selected-rubric').val('');

  // Is this a non-percentage grading scale? Then set the max points and disable the input
  var optionValObj = $($('option[value=' + String(newVal) + ']', gsSelectObj).text());
  var maxPointsSet = !optionValObj.hasClass('scale-type-scale');

  maxPointsObj.prop('disabled', maxPointsSet);
  if (maxPointsSet) {
    var maxPoints = optionValObj.attr('max');
    maxPointsObj.addClass('disabled');
    maxPointsObj.val(maxPoints);
  }
  else {
    maxPointsObj.removeClass('disabled');
  }
  sAlignmentEnableAlignmentButton();
  sPopupsResizeCenter();
}

function sGradeItemChangeRubric(form, gsSelectObj) {
  var gsSelectArea = gsSelectObj.parents('.grading-scale-select-grouping');
  var newVal = gsSelectObj.val();
  var maxPointsObj = $('#edit-max-points', form);
  var selectedRubric = $('#edit-selected-rubric');
  var clearSelection = newVal == "0";

  var newTotalPoints = 0;
  
  // Initialize settings object if not exists
  if (!Drupal.settings.s_grading_rubrics_info) {
    Drupal.settings.s_grading_rubrics_info = {};
  }

  if (newVal == 'r') {
    $('#grading-rubric-launch-btn', form).click();
    selectedRubric.val('e');
  }
  else if (!clearSelection) {
    newTotalPoints = Drupal.settings.s_grading_rubrics[newVal];
    
    // Check if rubric info is already cached
    if (Drupal.settings.s_grading_rubrics_info[newVal] && 'rubric' in Drupal.settings.s_grading_rubrics_info[newVal]) {
      sAlignmentRubricUpdate(Drupal.settings.s_grading_rubrics_info[newVal].rubric);
    } else if (Drupal.settings.s_grading_rubrics_lightweight_enabled === true) {
      $.get('/iapi/grades/rubric/' + newVal, function(response) {
        var currentlySelectedRubricId = gsSelectObj.val();
        if (currentlySelectedRubricId !== newVal) {
          // User changed selection while request was in flight - discard this response
          return;
        }
        if (response && response.body) {
          var has_published_criteria = false;
          if (response.body.rows) {
            $.each(response.body.rows, function(idx, row) {
              if (row.is_published) {
                has_published_criteria = true;
                return false;
              }
            });
          }
          Drupal.settings.s_grading_rubrics_info[newVal] = {
            has_published_criteria: has_published_criteria,
            rubric: response.body
          };
          sAlignmentRubricUpdate(Drupal.settings.s_grading_rubrics_info[newVal].rubric);
        }
      }).fail(function (jqXHR, textStatus, errorThrown) {
        if (window.console && typeof console.error === 'function') {
          console.error('Failed to load rubric info for id ' + newVal + ': ' + textStatus, errorThrown);
        }

        // Log to server for monitoring
        $.post('/popups_error', {
          'error': textStatus,
          'status': jqXHR.status,
          'response': jqXHR.responseText,
          'error_type': 'ajax'
        });
      });
    }
  }

  if (!clearSelection) {
    $('.option-show-scale', gsSelectArea).removeClass('hidden');
    $('#edit-chosen-rubric', gsSelectArea).removeClass('hidden');
    maxPointsObj.val(newTotalPoints);
    maxPointsObj.prop('disabled', true);
    maxPointsObj.addClass('disabled');
    if (newVal != 'r') {
      selectedRubric.val(newVal);
    }
    var broadCastId = newVal == 'r' ? 'e' : newVal;
    sAngular.rootScopeBroadcast('rubricActiveIdChange', broadCastId);
    sAlignmentDisableAlignmentButton();
  }
  else {
    sGradeScaleClearRubricSelection(gsSelectArea);
  }
  sPopupsResizeCenter();
}

/**
 * Creates the selectmenu dropdown for the scale/rubric list.
 *
 * @param form - the container form to search within
 * @param regenerate - if true, will destroy and recreate selectmenu if exists
 */
function sGradeScaleProcessRubricDropdown(form, regenerate) {
  $('.grading-scale-select-grouping', form).each(function() {
    var gsSelectArea = $(this);
    var selectMenuItem = $('select', gsSelectArea);

    if (gsSelectArea.hasClass('sGradesItemAddForm-processed')) {
      if (!regenerate) {
        return;
      } else {
        selectMenuItem.selectmenu('destroy');
      }
    } else {
      gsSelectArea.addClass('sGradesItemAddForm-processed')
    }

    if (!selectMenuItem.length){
      $('#edit-chosen-rubric', form).click(function () {
        $('#grading-rubric-launch-btn', form).click();
        sAngular.rootScopeBroadcast('rubricActiveIdChange', $('#edit-selected-rubric').val());
      });
      return;
    }

    // initiate the jQuery selectmenu for styling
    var selectMenu = $('.ui-selectmenu', gsSelectArea);
    if (!selectMenu.length) {
      selectMenuItem.selectmenu({style: 'dropdown'});
      var buttonId = selectMenuItem.attr('id') + '-button';
      var $label = $('label[for="' + buttonId + '"]', gsSelectArea);
      if ($label.length) {
        var labelId = $label.attr('id');
        if (!labelId) {
          labelId = buttonId.replace('-button', '-label');
          $label.attr('id', labelId);
        }
        $('#' + buttonId).attr('aria-labelledby', labelId);
      }
    }

    // Skip event handling if this selectbox is inside a nested "Copy To Courses" form
    var isCopyToCoursesForm = gsSelectArea.parents("div#copy-to-courses").length > 0;
    if (!isCopyToCoursesForm) {
      // restrict event handlers to first time initialization:
      if (!regenerate) {
        $('#edit-chosen-rubric', gsSelectArea).click(function () {
          $('#grading-rubric-launch-btn', form).click();
          sAngular.rootScopeBroadcast('rubricActiveIdChange', $('#edit-selected-rubric').val());
        });
        //trigger rubric editor when chosen
        selectMenuItem.change(function (e) {
          // store the current selection
          sGradeItemSelectScaleChange(form, $(this), true);
          e.preventDefault();
        });
      }
      // if a scale is selected
      if (selectMenuItem.val() != "0") {
        sGradeItemSelectScaleChange(form, selectMenuItem, false);
      }
    }
  });
}

function sGradeScaleClearRubricSelection(gsSelectArea){
  $('.option-show-scale', gsSelectArea).addClass('hidden');
  $('#edit-chosen-rubric:not(.display-only)', gsSelectArea).addClass('hidden');
  sAlignmentClearAlignments(true);
  sAlignmentEnableAlignmentButton();
}

/**
 * Helper that displays popup with warning message when changing from rubrics to LO's (learning objectives).
 *
 * @param {jQuery} form
 * @param {jQuery} gsSelectObj
 * @param {string} rubricTitle
 * @param {Function} fnOnResponse
 */
function sReplaceLearningObjectivesPopup(form, gsSelectObj, rubricTitle, fnOnResponse) {
  var message, buttonText, isAssessment = $('#s-assessment-question-edit-form').length;

  if (isAssessment && !rubricTitle){
    message = Drupal.t('Removing this rubric will remove all learning objectives aligned from this question. Would you like to remove this rubric?');
    buttonText = Drupal.t('Remove Rubric');
  } else {
    if (rubricTitle) {
      // sanitize rubric title to prevent XSS
      rubricTitle = htmlentities(rubricTitle);
      buttonText = Drupal.t('Select Rubric');
      message = rubricTitle + ' ' + Drupal.t('contains learning objectives that will replace the learning objectives attached to this assignment. Would you still like to select this rubric?')
    } else {
      message = Drupal.t('Selecting this scale will remove all of the learning objectives aligned to this assignment.  Would you like to select this scale?');
      buttonText = Drupal.t('Select Scale');
    }
  }

  var gsSelectArea = gsSelectObj.parents('.grading-scale-select-grouping');
  var popupSettings = {
    extraClass: 'popups-small',
    title: Drupal.t('Replace Learning Objectives'),
    body: message,
    confirm: {
      text: buttonText,
      func: function() {
        sPopupsClose();
        sAlignmentClearRubricAlignmentsInput();
        sAlignmentClearAlignments(false);
        sGradeItemChangeScale(form, gsSelectObj);
        $(document).data('previous_scale_selection', $(':selected', gsSelectArea));
        fnOnResponse(true);
      }
    },
    cancel: {
      func: function() {
        // do not change selection
        var previous_scale_selecton = $(document).data('previous_scale_selection');
        if (typeof previous_scale_selecton === 'undefined'){
          previous_scale_selecton = 0;
        }
        $('#edit-grading-scale-id').selectmenu('value', previous_scale_selecton.index());
        fnOnResponse(false);
      }
    }
  };

  sCommonConfirmationPopup(popupSettings);
}
