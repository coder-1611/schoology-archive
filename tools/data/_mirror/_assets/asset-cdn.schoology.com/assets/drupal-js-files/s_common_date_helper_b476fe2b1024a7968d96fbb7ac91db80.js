// Common date helper methods
/**
 * Takes localized string, either UK or US format, and converts
 * to a Date() object.
 *
 * @param {string} localizedDate - Date in mm/dd/yy or dd/mm/yy format
 * @return {Date}
 */
function sCommonDateFromLocalizedString(localizedDate) {
  var dateFormatLanguage = sCommonGetDateFormat();
  var dateStartsWithMonth = dateFormatLanguage === 'en';
  var dateComponents = localizedDate.split('/');
  var month = dateStartsWithMonth ? dateComponents[0] : dateComponents[1];
  var day = dateStartsWithMonth ? dateComponents[1] : dateComponents[0];
  var year = '20' + dateComponents[2]; // Add '20' for 20xx years, otherwise Date() will assume it's 19xx
  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
}

/**
 * Gets a normalized date format language either: 'en-GB' or 'en'
 *
 * @returns {string}
 */
function sCommonGetDateFormat() {
  var ukFormat = 'en-GB';
  // backend / rest of SGY Core doesn't use standard date formatting, it's either 'en-GB' or 'US' format.
  if (Drupal.settings.s_common.date_format_language === undefined || Drupal.settings.s_common.date_format_language !== ukFormat) {
    return 'en';
  }
  return ukFormat;
}

/**
 * Checks if date is within range
 *
 * @param {object} dateRange - json object with start/end dates of grading period dates
 * @param {string} date - Current selected due date string in the format 'MM/DD/YY' or 'DD/MM/YY'
 * @returns {boolean}
 */
function sCommonDateInRange(dateRange, date) {
  if (dateRange === 'undefined' || dateRange == null) {
    return false;
  }
  var startDate = new Date(dateRange['start']);
  var endDate = new Date(dateRange['end']);
  var dateValue = sCommonDateFromLocalizedString(date);
  return dateValue >= startDate && dateValue <= endDate;
}

/**
 * Helper to check if grade item form should show due date warning
 *
 * @param {object} gradeEnabledField - Checkbox for enabling/disabling grade
 * @param {object} gradePeriodField - Grade period select field
 * @param {object} dueDateField - Due date input field
 * @return {boolean}
 */
function sCommonShouldShowDueDateWarning(gradeEnabledField, gradePeriodField, dueDateField) {
  // If no grading period dates were passed up, then the form we're showing has no grading period (such as creating
  // discussions within a group or school)
  if (Drupal.settings.grading_period_dates === undefined) {
    return false;
  }

  // If Grading is disabled, no need to validate due date
  if (gradeEnabledField.val() !== undefined && !gradeEnabledField.is(':checked')) {
    return false;
  }

  // If there's no grading period, don't show warning (there's no range)
  var gradingPeriodId = parseInt(gradePeriodField.val());
  if (gradingPeriodId === 0) {
    return false;
  }

  var gradingPeriodDates = Drupal.settings.grading_period_dates[gradingPeriodId];
  var showWarning = false;
  // Iterate through each due date field (CSL has a due date for each section)
  dueDateField.each(function () {
    var val = $(this).val();
    if (val !== "" && !sCommonDateInRange(gradingPeriodDates, val)) {
      showWarning = true;

      // Break the jquery each loop
      return false;
    }
  });

  return showWarning;
}

/**
 * Helper to get translated and formated date string in either
 * MMM DD, YYYY or DD MMM, YYYY
 *
 * @param {Date} date
 * @return {string}
 */
function sCommonDateFormatToString(date) {
  var dateOfMonth = date.getUTCDate();
  var month = date.toLocaleDateString('en',
    {
      month: "long",
      timeZone: 'UTC'
    });
  var monthTranslated = Drupal.date_t(month, 'month_abbr');
  var year = date.getUTCFullYear();

  if (sCommonGetDateFormat() === 'en-GB') {
    return dateOfMonth + " " + monthTranslated + ", " + year;
  }
  return monthTranslated + " " + dateOfMonth + ", " + year;
}

/**
 * Helper to get due date warning text if due date is out of range
 *
 * @param {object} gradePeriodField
 */
function sCommonDateDueDateWarningText(gradePeriodField) {
  var gradingPeriodId = parseInt(gradePeriodField.val());
  var gradingPeriodDates = Drupal.settings.grading_period_dates[gradingPeriodId];
  var gradingPeriodName = gradePeriodField.text();
  var startDate = sCommonDateFormatToString(new Date(gradingPeriodDates['start']));
  var endDate = sCommonDateFormatToString(new Date(gradingPeriodDates['end']));
  return Drupal.t('The due date falls outside the selected grading period: @gradingPeriodName: @startDate to @endDate',
    {
      '@gradingPeriodName': gradingPeriodName,
      '@startDate': startDate,
      '@endDate': endDate,
    });
}

/**
 * Add due date warning to form
 *
 * @param {string} warningText
 * @param {object} siblingElement
 * @param {object} form
 */
function sCommonDateAddDueDateWarning(warningText, siblingElement, form) {
  sCommonDateRemoveDueDateWarning(form);
  // SVG Comes from Backpack.
  var icon = '<svg class="due-date-warning-icon" viewBox="0 0 23 22" width="100%" height="100%">' +
    '<g fill="#fac901" fill-rule="evenodd">' +
    '<path stroke="#333" d="M9.636 2.006c.975-1.814 2.751-1.815 3.727 0l8.665 16.111c.967 1.798.02 3.383-2.027 3.383H2.998C.957 21.5.004 19.914.971 18.117L9.636 2.006z"></path>' +
    '<path fill="#333" fill-rule="nonzero" d="M10.748 13.66l-.219-3.275a24.374 24.374 0 0 1-.061-1.374c0-.379.099-.674.297-.886.198-.211.46-.317.783-.317.392 0 .654.135.786.406.132.272.198.662.198 1.173 0 .3-.016.606-.048.916l-.294 3.37c-.031.4-.1.709-.205.923a.537.537 0 0 1-.52.321c-.245 0-.416-.104-.512-.311-.096-.207-.164-.523-.205-.947zm.759 4.497c-.278 0-.52-.09-.728-.27-.208-.18-.311-.432-.311-.755 0-.283.099-.523.297-.721a.99.99 0 0 1 .728-.298c.287 0 .532.1.735.298a.971.971 0 0 1 .304.72c0 .32-.102.57-.307.753a1.047 1.047 0 0 1-.718.273z"></path>' +
    '</g>' +
    '</svg>';
  var output = '<div class="form-item due-date-warning-wrapper">' +
    '<div>' + icon + '</div>' +
    '<div class="due-date-warning-text">' + warningText + '</div>' +
    '</div>';
  siblingElement.after(output);
}

/**
 * Remove due date warning
 * @param {object} form
 */
function sCommonDateRemoveDueDateWarning(form) {
  $(".due-date-warning-wrapper", form).remove();
}



/**
 * Helper to get translated and formatted date string
 * @param date
 * @param format
 * @returns {string}
 */
function getTranslatedDate(date, format) {
  let comma = Utils.i18n.t('core.char_comma');
  let ad = '';

  let date_strings = Drupal.date_t_strings();
  let months_long = date_strings.month_name.slice(1, 13);
  let months_short = date_strings.month_abbr.slice(1, 13);
  let weekdays_long = date_strings.day_name;
  let weekdays_short = date_strings.day_abbr;
  let am_pm_long = date_strings.ampm.slice(0, 2);
  var am_pm_short = Utils.i18n.t('core.am_pm_short');
  am_pm_short = am_pm_short.split(new RegExp(comma + '|,'));

  // prepare all date numbers like year, month, date, week, etc
  let full_year = date.getFullYear();
  let month = date.getMonth();
  let day = date.getDate();
  let week = date.getDay();
  let hour = date.getHours();
  let minute = date.getMinutes();
  let second = date.getSeconds();

  // insert Hijri date if enabled
  if (typeof insertHijriDateIfApplicable === "function") {
    format = insertHijriDateIfApplicable(date, format);
  }
  // translate all date numbers and return
  // format reference: https://fullcalendar.io/docs/v1/formatDate

  if (document.documentElement.lang === 'th' && format.includes('!MMMM')) {
    ad = Utils.i18n.t('core.year_AD');
  }
  return format
    .replace("!yyyy", ad + full_year)
    .replace("!yy", full_year.toString().substring(2))
    .replace("!MMMM", months_long[month])
    .replace("!MMM", months_short[month])
    .replace("!MM", ("0" + (month + 1)).slice(-2))
    .replace("!M", (month + 1))
    .replace("!dddd", weekdays_long[week])
    .replace("!ddd", weekdays_short[week])
    .replace("!dd", ("0" + day).slice(-2))
    .replace("!d", day)
    .replace("!HH", ("0" + hour).slice(-2))
    .replace("!H", hour)
    .replace("!hh", ("0" + (hour % 12)).slice(-2))
    .replace("!h", (hour % 12 === 0 ? 12 : hour % 12))
    .replace("!mm", ("0" + minute).slice(-2))
    .replace("!m", minute)
    .replace("!ss", ("0" + second).slice(-2))
    .replace("!s", second)
    .replace("!tt", am_pm_long[hour >= 12 ? 1 : 0])
    .replace("!t", am_pm_short[hour >= 12 ? 1 : 0])
    .replace("!TT", am_pm_long[hour >= 12 ? 1 : 0].toUpperCase())
    .replace("!T", am_pm_short[hour >= 12 ? 1 : 0].toUpperCase());

}
window.getTranslatedDate = getTranslatedDate;
/**
 * This function is used to update the AM/PM indicators in the time input fields of a form.
 * It is called when the form with the class 'course-material-form' or 'sGradeItemManager-processed' is submitted or loaded.
 * It gets the class of the form and sets the query text accordingly.
 * It then selects all time input fields in the form and replaces the AM/PM indicators based on the action parameter.
 * If the action is 'submit', it replaces non-English AM/PM indicators with English ones.
 * If the action is 'load', it replaces English AM/PM indicators with non-English ones.
 *
 * @param {HTMLFormElement} form - The form that is being submitted or loaded.
 * @param {string} action - The action that is being performed on the form. Can be either 'submit' or 'load'.
 */
function updateAmPmForTimeField(form, action) {
  let formClass = form.className;
  let timeInputs = document.querySelectorAll('input[name="due_date[time]"]');

  if (timeInputs.length === 0) {
    timeInputs = document.querySelectorAll('input[name$="[due_date][time]"], input[name$="[time]"]');
  }

  let translatedAmPmLong = $.trim(Drupal.t('!ampm-abbreviation am|pm|AM|PM', {'!ampm-abbreviation' : ''})).split('|');
  translatedAmPmLong = translatedAmPmLong.slice(2, 4);
  let englishAmPmLong = ['AM', 'PM'];
  let replacements = {};

  if (action === 'submit') {
    for (let i = 0; i < translatedAmPmLong.length; i++) {
      replacements[translatedAmPmLong[i]] = englishAmPmLong[i];
    }
  } else if (action === 'load') {
    for (let i = 0; i < englishAmPmLong.length; i++) {
      replacements[englishAmPmLong[i]] = translatedAmPmLong[i];
    }
  }

  timeInputs.forEach(function(input) {
    var timeValue = input.value;

    for (var nonEnglish in replacements) {
      if (timeValue.includes(nonEnglish)) {
        timeValue = timeValue.replace(nonEnglish, replacements[nonEnglish]);
      }
    }

    input.value = timeValue;
  });
}

/**
 * This function is triggered when the form with the class 'course-material-form' or 'sGradeItemManager-processed' is submitted.
 * It gets the nearest form to the event target and calls the updateAmPmForTimeField function with the form and the action 'submit'.
 * The updateAmPmForTimeField function replaces non-English AM/PM indicators with English ones in the time input fields of the form.
 *
 * @param {Event} event - The submit event that triggered the function.
 */
function courseMaterialFormSubmit(event) {
  // get the nearest form
  let form = event.target.closest('form');
  updateAmPmForTimeField(form, 'submit');
}

/**
 * This function is triggered when the form with the class 'course-material-form' or 'sGradeItemManager-processed' is loaded.
 * It calls the updateAmPmForTimeField function with the form and the action 'load'.
 * The updateAmPmForTimeField function replaces English AM/PM indicators with non-English ones in the time input fields of the form.
 *
 * @param {HTMLFormElement} form - The form that is being loaded.
 */
function courseMaterialFormLoad(form) {
  updateAmPmForTimeField(form, 'load');
}

// Create an array of languages
var languages = ['ar', 'th'];

// Get the current language of the document
var lang = document.documentElement.lang;

// Check if the language is in the array
if (languages.includes(lang)) {
// Attach click event listeners to submit buttons of 'course-material-form' and 's-grade-item-manager-form'
  $(document).on('click', '.course-material-form .submit-buttons .form-submit', courseMaterialFormSubmit);
  $(document).on('click', '#s-grade-item-manager-form .submit-buttons .form-submit', courseMaterialFormSubmit);
  $(document).on('click', '#s-event-add-form .submit-buttons .form-submit', courseMaterialFormSubmit);

// On AJAX completion, load the 'course-material-form'
  $(document).ajaxComplete(function () {
    let form = document.querySelector('.course-material-form, .sEventAddForm-processed');
    if (form) {
      courseMaterialFormLoad(form);
    }
  });

// On DOM content loaded, load the 'sGradeItemManager-processed' form
  document.addEventListener('DOMContentLoaded', function () {
    let form = document.querySelector('.sGradeItemManager-processed');
    if (form) {
      courseMaterialFormLoad(form);
    }
  });

// On 's-grade-item-manager-form' submission, load the form after a delay
  $('#s-grade-item-manager-form').on('submit', function (event) {
    setTimeout(function () {
      courseMaterialFormLoad(event.target);
    }, 0);
  });
}

// On AJAX completion, scroll the popup content to the top and focus the
// first error field so keyboard and screen-reader users land on it directly.
$(document).ajaxComplete(function () {
  var form = document.querySelector(
    '#s-grade-item-add-form,' +
    '#s-event-add-combined-form.ajax-form,' +
    '#s-external-tool-add-link-form,' +
    '#s-discussion-create-form,' +
    '#s-page-create-page-form,' +
    '#s-grade-item-add-combined-form,' +
    '#s-course-materials-folder-create-form,' +
    '#s-library-collection-template-form,' +
    '#s-library-collection-add-external-tool-form,' +
    '#s-generic-post-new-add-link-form,' +
    '#s-library-collection-add-link-form'
  );
  if (form) {
    scrollPopupContentToTop(form);
    setTimeout(function () {
      if (typeof focusFirstErrorField === 'function') {
        focusFirstErrorField(form);
      }
    }, 0);
  }

  // For popup forms with TinyMCE editors, the editor initializes
  // asynchronously and steals focus after it lands on the error field.
  // Retry at staggered intervals to reclaim focus once TinyMCE is done.
  $('.popups-box:visible .popups-body form').each(function () {
    var popupForm = this;

    if (!$(popupForm).find('.form-item.error, [aria-invalid]:not([aria-invalid="false"])').length) {
      return;
    }

    [0, 10].forEach(function (ms) {
      setTimeout(function () {
        if (!$(popupForm).find(':focus').length && typeof focusFirstErrorField === 'function') {
          focusFirstErrorField(popupForm);
        }
      }, ms);
    });
  });
});

/**
 * Scrolls the content of the popup to the top
 * @param {HTMLFormElement} form - The form inside the popup
 */
function scrollPopupContentToTop(form) {
  let popup = $(form).parents(".popups-body-inner")
  if (popup.length > 0) {
    popup.scrollTop(0);
  } else {
    $(form).scrollTop(0);
  }
}
