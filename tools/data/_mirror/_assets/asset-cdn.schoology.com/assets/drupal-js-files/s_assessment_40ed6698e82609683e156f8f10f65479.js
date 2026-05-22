
Drupal.behaviors.sAssessment = function(context) {

  var asmtForms = [
    '#s-assessment-question-edit-form:not(.sAssessment-processed)',
    '#s-assessment-question-fill-form:not(.sAssessment-processed)',
    '#s-library-assessment-question-fill-form:not(.sAssessment-processed)',
    '#s-library-assessment-question-edit-form:not(.sAssessment-processed)'
  ];
  $(asmtForms.join(', ')).addClass('sAssessment-processed').each(function(){
    var formObj = $(this);
    var isAsmtEdit = formObj.attr('id') == 's-assessment-question-edit-form';

    if(isAsmtEdit){
      $('.locked-title-view', formObj).resizable({handles : 'se'});
    }

    //Setup language keyboards
    sAssessmentSetupLanguageKeyboard('.s-js-language-keyboard', formObj);
    //if this is an individual question, "reveal" the keyboard automatically
    if($('.question-wrapper').length == 1){
      $('.s-js-language-keyboard:first', formObj).trigger('focus');
    }
  });

  $(document).bind('popups_open_path_done',function(event,element, href, p){

    $('.cancel-btn' , $('#'+String(p.id)) ).each(function(){
      $(this).css('cursor','pointer');
      $(this).bind('click',function(){
        Popups.close();
      });
    });

    if($( 'form' , $('#'+String(p.id))).attr('id') != 's-assessment-question-edit-form' )
      return;

    if(Drupal.settings.hasOwnProperty('s_assessment_question') && Drupal.settings.s_assessment_question.disable_rich_text) {
      $('#edit-title').css('visibility','visible');
      return;
    }
  });

}

/**
 * Function to setup Language Keyboard on Assessment inputs
 * @param kbClass - classname attached to the input
 * @param wrapper - any limiting wrapper
 */
function sAssessmentSetupLanguageKeyboard(kbClass, wrapper){
  isMCE = (kbClass == '.mceIframeContainer');
  if(typeof Drupal.settings.s_assessment_setup_language_keyboard != 'undefined'){
    var keyboardLang = Drupal.settings.s_assessment_setup_language_keyboard.lang;
    if(sJQueryKeyboardLayouts[keyboardLang]){
      var kbElem = $(kbClass, wrapper);
      var kbOpts = {
        layout: 'custom',
        customLayout: sJQueryKeyboardLayouts[keyboardLang],
        usePreview : false,
        autoAccept : true,
        stayOpen: true,
        useCombos : false, //ensures that typing special characters (http://www.forlang.wsu.edu/help/keyboards2.asp) still work on mac
        position: { //see http://jqueryui.com/position/
          // null = attach to input/textarea;
          // use $(sel) to attach elsewhere
          of: null,
          my: 'left top',
          at: 'right+10 top',
          // used when "usePreview" is false
          at2: 'right+10 top'
        },
        visible: function (e, keyboard, el) {
          //make the keyboard draggable within the question area
          var keyboardObj = keyboard.$keyboard;
          var hasDraggable = $('.keyboard-draggable', keyboardObj).length > 0;
          if(!hasDraggable && typeof keyboardObj.prepend == 'function'){
            var parentWrapper = $(el).parents('.question-wrapper:first, .blanks-answer-wrapper:first, #edit-fill-words-wrapper:first');
            var parentOffset = parentWrapper.offset();
            var mainInner = $('#content-wrapper');
            var mainOffset = mainInner.offset();
            keyboardObj.prepend('<div class="keyboard-draggable"></div>')
              .draggable({
                handle: ".keyboard-draggable",
                containment:[mainOffset.left, parentOffset.top, mainOffset.left + mainInner.width() - keyboardObj.width(), parentOffset.top + parentWrapper.height() - 35]
              });
          }
        },
        change : function (e, keyboard, el) {
          var IEInsert = $.browser.msie && keyboard.lastKey; //as usual IE messes up and requires haxx
          if(el.value || IEInsert){
            var elObj = $(el);
            var isRichText = elObj.hasClass('mceIframeContainer');
            var textID = $('textarea', elObj.parents('.essay-wrapper:first,.essay-question-wrapper:first')).attr('id');
            var qWrapper = elObj.parents('.question-wrapper:first');
            var value = el.value ? el.value : keyboard.lastKey;
            if(isRichText && (!IEInsert || elObj.hasClass('revealed'))){
              //need to manually append to tinyMCE for rich text
              tinyMCE.execInstanceCommand(textID,"mceInsertContent",false,value);
            }
            if(typeof sAssessmentCheckCharLimit == 'function' && qWrapper.hasClass('question-essay')){
              sAssessmentCheckCharLimit($('#' + textID, qWrapper), isRichText);
            }
          }
          if($.browser.msie && isRichText){
            el.value = null;
          }
        }
      };

      //virtual keyboard performs some crazy scroll to top on initialization...
      //do this prior to initialization so that it won't perform this scroll to the top
      var bodyObj = $('body');
      bodyObj.on('focus.sAssessmentSetupLanguageKeyboard', 'input', function(e){
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      kbElem.keyboard(kbOpts);
      bodyObj.off('focus.sAssessmentSetupLanguageKeyboard');
    }

    //if any input that is not a fitb input gets focused, close any active keyboard
    $('input:not(.blank, .s-js-blank-answer)', wrapper).on('focus', function(){
      var activeKB = sAssessmentActiveKeyboard();
      if(typeof activeKB == 'object' && activeKB){
        activeKB.accept();
      }
    });
  }
}

function sAssessmentActiveKeyboard(){
  if(typeof $.keyboard != 'undefined'){
    return $($.keyboard.currentKeyboard).getkeyboard();
  }

  return false;
}

/**
 * Renders the score for assessment view.
 *
 * @param {jQuery} $input
 */
function sAssessmentUpdateScoreView($input) {
  var $cell = $input.parents().filter('.grade-score');
  var $override = $cell.find('.input-override input');
  var $grade;

  var isDistrictMastery = $cell.find('.district-mastery-grading-rubric-grading-launch').length;
  var hasRubric = $cell.find('.s-grades-rubric-grading-launch-btn').length;

  if (hasRubric) {
    $grade = $cell.find('.grade-val');
    // use points input rather than rubric score input for district mastery rubric grader
    $input = isDistrictMastery ? $cell.find('.input-score input') : $cell.find('.input-rubric-score input');
  } else {
    $grade = $cell.find('.score-grade .score-grade-score span');
  }

  var newScore;
  if (isDistrictMastery) {
    newScore = $input.val();
  } else {
    newScore = $input.val() || '*';

    var hasOverride = $override.val() === '1';
    var isSubjective = $override.hasClass('subjective');
    var isPrinted = $override.hasClass('printed');

    // for ungraded subjective questions & printed questions, mark it with a star to avoid confusion
    if ((isSubjective || isPrinted) && !hasOverride && !isDistrictMastery) {
      newScore = hasRubric ? '' : '*';
    }
  }
  $grade.html(newScore);

  $cell.find('.score-grade').show();
  $cell.find('.input-score').hide();

  if (hasOverride && !hasRubric) {
    $cell.addClass('override');
  } else {
    $cell.removeClass('override');
  }
}
