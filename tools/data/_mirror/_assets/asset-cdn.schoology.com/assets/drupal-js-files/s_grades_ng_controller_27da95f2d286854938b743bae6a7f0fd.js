// Controller that acts as interface between jquery form and angular rubric selector
sAngular.addController('s_grading_rubric_form_launch', ['$scope', 'gradingRubrics', function($scope, gradingRubrics){
  // A new rubric has been made and saved
  $scope.$on('gradingRubricSelect', function(event, rubric){
    if(typeof sGradeItemSelectScaleChange == 'undefined'){
      return;
    }

    var scaleSelectorWrapper = $('.grading-scale-select-grouping.is-launch-wrapper');
    var selectorObj = $('select', scaleSelectorWrapper);
    var existingRubric = $('option[value="' + rubric.id + '"]', selectorObj);
    if(existingRubric.length){
      var optionList = $('option', selectorObj);
      for(var i = 0; i < optionList.length; i++){
        var optionObj = $(optionList[i]);
        var optionVal = optionObj.attr('value');
        if(optionVal == rubric.id){
          selectorObj.selectmenu('value', i);
          break;
        }
      }
      sGradeItemSelectScaleChange(selectorObj.parents('form'), optionObj, false);
    }
    else {
      Drupal.settings.s_grading_rubrics[rubric.id] = {id : rubric.id, total_points : rubric.total_points};
      var rubricTitle = rubric.title;
      var addRubricOption = $('.select-custom-rubric-title');
      // change title and ID of "Create New" to newly created rubric
      addRubricOption.text(rubricTitle);
      $('[value=r]', selectorObj).val(rubric.id);
      addRubricOption.val(rubric.id);
      addRubricOption.addClass('rubric-title-' + rubric.id);
      $('#edit-max-points').val(rubric.total_points);
      Drupal.settings.s_grading_rubrics[rubric.id] = rubric.total_points;
      sGradeItemSelectScaleChange(selectorObj.parents('form'), addRubricOption, false);
    }
  });

  // An existing rubric has been updated
  $scope.$on('gradingRubricSelectModify', function(event, rubric){
    // Update all the titles associated with this rubric
    if(angular.isDefined(Drupal.settings.s_grading_rubrics)){
      $('.rubric-title-' + rubric.id + ',.title .grading-rubric-launch[rubric-id="' + rubric.id + '"]').text(rubric.title);
      $('#edit-max-points, .total-points').val(rubric.total_points);
      Drupal.settings.s_grading_rubrics[rubric.id] = rubric.total_points;
      sAlignmentRubricUpdate(rubric);
    }
  });
}]);

sAngular.addDirective('gradingRubricLaunch', ['$compile', '$timeout', 'gradingRubrics', function($compile, $timeout, gradingRubrics){
  return {
    restrict : 'C',
    link : function(scope, element, attrs){

      var isDistrictMasteryEnabled = attrs.isDistrictMasteryEnabled === 'true';
      var isDistrictMasteryCourseRubricsEnabled = attrs.isDistrictMasteryCourseRubricsEnabled === 'true';
      var isUSMStandardsSelectorEnabled = attrs.isUsmStandardsSelectorEnabled === 'true';
      var isGradeItemCollectedOnly = attrs.isGradeItemCollectedOnly === 'true';

      // to facilitate the Rubric Editor to work as a stand alone component in React
      element.on('ReactInit', function(event, rubric, saveHandler, cancelHandler, addAlignmentRowClickHandler, activeRubricUpdateHandler, isReadOnly){

        if($('.s-grading-rubric-edit-slider').length == 0) {
          // Compile Rubric Editor markup
          var rubricOutput = Drupal.theme.s_grades_grading_rubric_edit(false, true, false, isDistrictMasteryEnabled, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled);
          $compile(rubricOutput)(scope).prependTo($('body'));
        }

        // Set state to open, and launch with special React options
        sAngular.rootScopeBroadcast('gradingRubricChangeState', 'opened');
        sAngular.rootScopeBroadcast('gradingRubricLaunch', {
          isReactComponent: true,
          rubric: rubric,
          saveHandler: saveHandler,
          cancelHandler: cancelHandler,
          addAlignmentRowClickHandler: addAlignmentRowClickHandler,
          activeRubricUpdateHandler: activeRubricUpdateHandler,
          isReadOnly: isReadOnly
        });

      });

      element.on('ReactCancelAndClose', function(){
        sAngular.rootScopeBroadcast('gradingRubricChangeState', 'closed-skip-cancel');
      });

      element.on('ReactAddAlignment', function(event, alignments){
        // figure difference
        $.each(alignments, function(idx, alignment){
          sAngular.rootScopeBroadcast('sAlignmentAdd', alignment);
        });
      });

      element.on('ReactRemoveAlignment', function(event, alignment){
        sAngular.rootScopeBroadcast('sAlignmentRemove', alignment);
      });

      var KEY_ENTER = 13;
      var KEY_SPACE = 32;
      var keydownHandler = function (e) {
        var key = e.which || e.keyCode;
        if (key === KEY_ENTER || key === KEY_SPACE) {
          e.preventDefault();
          element.trigger('click');
        }
      };
      element.on('keydown.gradingRubricLaunch', keydownHandler);
      scope.$on('$destroy', function () {
        element.off('keydown.gradingRubricLaunch', keydownHandler);
      });

      element.click(function(event){
        var realm = attrs.realm;
        var realm_id = attrs.realmId;
        var itemNid = attrs.itemNid;
        var rubricId = attrs.rubricId;
        var isGradeItem = attrs.isGradeItem === 'true';
        var isResource = attrs.isResource === 'true';
        var isResourceMaterial = attrs.isResourceMaterial === 'true';
        var isReadOnly = attrs.isReadOnly === 'true';
        var wrapperClass = attrs.wrapperClass !== 'false' ? attrs.wrapperClass : false;

        var broadCastItemNid = false;
        if(isResourceMaterial || isGradeItem && angular.isDefined(itemNid) && itemNid != null ){
          broadCastItemNid = itemNid;
        }
        // If There is a rubric editor present in the DOM we should detach it so it can be recompiled and replaced.
        var rubricDomElement = $('#grading-rubric-edit-slider');
        if (rubricDomElement.length !== 0) {
          rubricDomElement.detach();
        }
        // Right now on a page, the grading rubric editor will either have grade item context or not.  This decision can be made when editing
        var rubricOutput = Drupal.theme.s_grades_grading_rubric_edit(isGradeItem, isResource, isReadOnly, isDistrictMasteryEnabled, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled);
        $compile(rubricOutput)(scope).prependTo(document.body);

        if(gradingRubrics.opened == false){
          gradingRubrics.opened = true;
        }
        else{
          sAngular.rootScopeBroadcast('gradingRubricChangeState', 'opened');
        }

        var rubric = false;
        if (isResourceMaterial){
          var form = $(sLibraryRubricForms().join(', '));
          var jsonRubric = $('[name=resource_rubric]', form).val();
          if(wrapperClass){
            form = $('.' + wrapperClass, form);
            jsonRubric = $('input', form).val();
          }

          if(!jsonRubric) {
            var resourceRubricItem = $('#resource_rubric_' + itemNid);
            if (resourceRubricItem.length) {
              jsonRubric = resourceRubricItem[0].textContent;
            }
          }

          if (jsonRubric){
            rubric = JSON.parse(jsonRubric);
          } else {
            rubric = true;
          }
        }

        var createNew = $.inArray($('#edit-grading-scale-id').val(), ['e', 'r']) != -1;
        var gsSelectArea = $('#edit-grading-scale-id').parents('.grading-scale-select-grouping');

        // If there is a specific rubric let the rubric controller know
        var broadCastId = (angular.isDefined(rubricId) && rubricId != null) ? rubricId : false;
        sAngular.rootScopeBroadcast('rubricActiveIdChange', broadCastId);
        // Let the rubric know what realm/realm_id we care about
        sAngular.rootScopeBroadcast('gradingRubricLaunch', {
          'realm' : realm,
          'realmId': realm_id,
          'isReadOnly': isReadOnly,
          'itemNid' : broadCastItemNid,
          'isGradeItem': isGradeItem,
          'isResource': isResource,
          'rubric': rubric,
          'createNew': createNew,
          'gsSelectArea': gsSelectArea
        });
        // pre-populate rubric form
        var selectedRubricId = $('#edit-selected-rubric').val();
        if (selectedRubricId){
          if (Drupal.settings.s_grading_rubrics_info && Drupal.settings.s_grading_rubrics_info[selectedRubricId]){
            $.each(Drupal.settings.s_grading_rubrics_info[selectedRubricId]['rubric'].rows, function(idx, tagObj){
              sAngular.rootScopeBroadcast('sAlignmentAdd', tagObj)
            });
          }
          if (createNew) {
            // If this will be a new rubric, save the pre-populated information into Drupal.settings
            Drupal.settings.s_grading_rubrics_info.e = {rubric : { rows : Drupal.settings.s_grading_rubrics_info[selectedRubricId]['rubric'].rows } };
          }
        }
        if(angular.isDefined(Drupal.settings.s_alignment) && angular.isDefined(Drupal.settings.s_alignment.attached_tags)){
          $.each(Drupal.settings.s_alignment.attached_tags, function(tid, tagObj){
            if(isResourceMaterial || angular.isUndefined(itemNid) || tagObj.item_id == itemNid || tagObj.grade_item_nid == itemNid){
              sAngular.rootScopeBroadcast('sAlignmentAdd', tagObj);
            }
          });
        }
        scope.$apply();
        if (isDistrictMasteryCourseRubricsEnabled) {
          setTimeout(() => {
            sAttachBehavior('sAlignment', $('#grading-rubric-edit-slider')[0]);
          });
        }
        $timeout(function () {
          var rubricSlider = $('#grading-rubric-edit-slider, #district-mastery-grading-rubric-edit-slider').filter(':visible').first();
          if (!rubricSlider.length) {
            rubricSlider = $('#grading-rubric-edit-slider, #district-mastery-grading-rubric-edit-slider').first();
          }
          if (rubricSlider.length) {
            var closeButton = rubricSlider.find('.controls .close-btn:visible').first();
            if (closeButton.length) {
              closeButton.focus();
            }
          }
        });
      });
    }
  }
}]);

sAngular.addDirective('sGradingRubricEditSlider', function(){
  return {
    restrict : 'C', // bind this behavior to the s-grading-rubric-edit-slider class name
    link: function (scope, element, attrs) {

      const DESIRED_MIN_WIDTH = 750;
      const DESIRED_MIN_HEIGTH = 250;
      const STARTING_HEIGHT = 400;

      // Setting the min- and max-limited height and width of the element and its internal structures
      function _adjustHeight(newHeight){
        var docHeight = $(window).height();
        var minHeight = DESIRED_MIN_HEIGTH;
        var isReadOnly = scope.isReadOnly;
        // these offsets prevent whitespace from appearing between the bottom of the rubric rows and the top of the bottom-ctrls-wrapper
        var rightOffset = isReadOnly ? 0 : 40;
        var scrollOffset = isReadOnly ? 0 : 89;
        // scroll offset must account for any error messages
        var errorOffset = 0;
        $('.right-column .error.messages:visible').each(function() {
          errorOffset += $(this).outerHeight();
        });
        scrollOffset += errorOffset;
        var heightOffset = isReadOnly ? 69 : 89;
        newHeight = (newHeight > docHeight) ? docHeight : (newHeight < minHeight) ? minHeight : newHeight;
        element.css({
          'height': newHeight
        });
        $('.right-column', element).css({
          'height' : newHeight - rightOffset
        });
        $('.rubric-scroll', element).css({
          'height' : newHeight - scrollOffset
        });
        $('#grading-rubric-edit-slider .ui-resizable-w').css({
          'height': newHeight + heightOffset
        });
        $('#grading-rubric-edit-slider .ui-resizable-e').css({
          'height': newHeight + heightOffset
        });
      }

      scope.$on('gradingRubricLaunch', function(){
        _adjustHeight(STARTING_HEIGHT);
      });

      element.resizable({
        handles:(document.dir === 'rtl') ? 'e,se,s' : 'w,sw,s',
        'minHeight': DESIRED_MIN_HEIGTH,
        'minWidth': DESIRED_MIN_WIDTH,
        resize: function( event, ui ) {
          _adjustHeight(ui.size.height);
        },
        stop: function( event, ui ) {
          element.css({
            'right': (document.dir === 'rtl') ? 'auto' : 0,     // Ensure to fix to the right
            'left': (document.dir === 'rtl') ? 0 : 'auto', // Let this adjust since width and right attributes are set
            'width': Math.min(ui.size.width, $(window).width())
          });
          _adjustHeight(ui.size.height);
        },
        create: function( event, ui ) {
          element.css({
            'max-width': 9999, // limited based on the document width
            'max-height': 9999,
            'width': Math.min(DESIRED_MIN_WIDTH, $(window).width()) // Need to set this initially so when you collapse the bottom bar will not show the buttons
          });
          _adjustHeight(STARTING_HEIGHT);
        }
      });
    }
  }
});


// CONTROLLER FOR THE GRADING RUBRIC EDIT SLIDER
sAngular.addController('s_grading_rubric_edit',
  ['$http', '$scope', '$timeout', '$q', 'gradingRubrics', function($http, $scope, $timeout, $q, gradingRubrics) {
    var KEY_ENTER = 13;
    var KEY_SPACE = 32;
    var rubricSliders = $('#grading-rubric-edit-slider, #district-mastery-grading-rubric-edit-slider');
    rubricSliders.off('keydown.sRubricKeyboardAccess');
    rubricSliders.on('keydown.sRubricKeyboardAccess', '[role="button"]', function (e) {
      var key = e.which || e.keyCode;
      if (key === KEY_ENTER || key === KEY_SPACE) {
        e.preventDefault();
        $(this).trigger('click');
      }
    });
    $scope.$on('$destroy', function () {
      rubricSliders.off('keydown.sRubricKeyboardAccess');
    });

    $scope.activeRubricId = 'e';
    $scope.rubricTable = null;
    $scope.saving = false;
    $scope.state = 'opened';
    $scope.defaultTitle = '';
    $scope.rubricSort = 'created';
    $scope.rubrics = {};
    $scope.hasAlignments = false;
    $scope.hasTitleError = false;
    $scope.hasInvalidObjectiveAlignmentAttempt = false;
    $scope.errorMessage = '';
    $scope.dirtyRubrics = [];
    $scope.rubricSliderContext = null;
    $scope.ptsErrorCells = [];
    $scope.expandedClass = '';
    $scope.gradingScales = {};
    $scope.queuedObjectives = [];
    $scope.courseNid = null;
    $scope.lodash = null;
    //The lodash.js is loaded from platorm-ui which is loaded when using district mastery. We only potentially need
    //lodash when mastery is enabled, so we can safely override lodash with a no-op if it's not already loaded.
    if (typeof _ === 'undefined' || typeof _.debounce !== 'function') {
      $scope.lodash = {
        debounce: function(){}
      };
    }
    else {
      $scope.lodash = _; //_ is the library reference for lodash
    }

    $scope.selectGradingScale = function($event) {
      var $button = $($event.currentTarget);
      //differentiate between DM aligned objectives and teacher-defined ones
      var hasDMObjectives = false;
      var hasCustomObjectives = false;
      $.each($scope.rubrics[$scope.activeRubricId].rows, function() {
        if (this.is_mastery_objective_aligned) {
          hasDMObjectives = true;
        } else {
          hasCustomObjectives = true;
        }
      });

      var popupText;
      if (hasCustomObjectives) {
        //there has to be at least one custom objective for this to actually do anything
        if (hasDMObjectives) {
          popupText = Drupal.settings.body_mixed;
        } else {
          popupText = Drupal.settings.body_no_dm;
        }
        sCommonConfirmationPopup({
          title : Drupal.settings.title_confirm,
          body : popupText,
          extraClass : "apply-grading-scale-popup",
          confirm : {
            func : function() {
              $scope.$apply(function() {
                var tempRow;
                var totalPoints = 0,
                  newRows = [],
                  newRubric = angular.copy($scope.rubrics[$scope.activeRubricId]),
                  scaleInfo = $button.data("scale-info");

                sPopupsClose();

                $.each($scope.rubrics[$scope.activeRubricId].rows, function(idx, obj) {
                  if (this.is_mastery_objective_aligned) {
                    //mastery aligned objectives are not editable. skip this one
                    tempRow = obj;
                  } else {
                    tempRow = angular.copy(templateRubricRow);
                    totalPoints += scaleInfo.max_points;
                    tempRow.max_points = scaleInfo.max_points;
                    tempRow.columns = angular.copy(scaleInfo.columns);
                    tempRow.title = this.title || "";
                    tempRow.is_published = obj.is_published;
                    tempRow.description = this.description || "";
                    tempRow.tid = obj.tid;
                    tempRow.guid = obj.guid;
                    tempRow.weight = obj.weight;
                  }
                  newRows.push(tempRow);
                });

                newRubric.total_points = totalPoints;

                newRubric.rows = newRows;
                $scope.rubrics[$scope.activeRubricId] = angular.copy(newRubric);
              });
            }
          }
        });

      } else {
        //there are no custom objectives... this will do nothing
        sCommonConfirmationPopup({
          title : Drupal.settings.title_confirm,
          body : Drupal.settings.body_only_dm,
          extraClass : "apply-grading-scale-popup",
          confirm : {
            func : function() {
              $scope.$apply(function() {
                sPopupsClose();
              });
            }
          }
        });
      }
    };

    $scope.rubricSortOptions = [
      {
        title : 'Recently Added',
        field : '-created'
      },

      {
        title : 'Most Used',
        field : '-num_assigned_gi'
      }
    ];
    $scope.savedRubricsList = []; // ng-repeat does not like filtering on objects.  Save a list for our left menu ng-repeat
    $scope.sortableOptions = {
      handle : '.sort-handle'
    }
    /*
     * This isGradeItem flag is extremely important. Behavior diverges greatly between the rubric slider that interacts with
     * a grade item form and the rubric slider that is in the grade setup page.  This flag is what helps us with that behavior
     */
    $scope.$watch('isGradeItem', function(newVal, oldVal){
      $scope.defaultTitle = newVal ? Drupal.t('Custom Rubric') : Drupal.t('New Rubric');
      if (newVal) {
        $scope.rubrics.e.title = '';
      }
    })

    var templateRubricRow = {
      id : null, // Everything is done by ID out here in the DOM, but back on the server each row has an id
      title : '',
      description : '',
      tid : null,
      guid : null,
      max_points : 4,
      is_mastery_objective_aligned : false,
      columns : [
        {
          pts : 4,
          description : Drupal.t('Excellent')
        },
        {
          pts : 3,
          description : Drupal.t('Good')
        },
        {
          pts : 2,
          description : Drupal.t('Satisfactory')
        },
        {
          pts : 1,
          description : Drupal.t('Needs Improvement')
        }
      ]
    };

    var templateRubric = {
      id : 'd', // 'd' for our default template.  This id should never be seen outside of here
      title : $scope.defaultTitle,
      total_points : 4,
      realm_id : null,
      realm : null,
      rows : []
    };
    templateRubric.rows.push(templateRubricRow);

    $scope.makeEditRubric = function(){
      // Clone our default so user is editing that one
      var editTemplate = angular.copy(templateRubric);
      editTemplate.realm_id = gradingRubrics.realmId;
      editTemplate.realm = gradingRubrics.realm;
      editTemplate.id = 'e'; // 'e' for the template that is being edited.  Once saved it will get an ID from the server
      $scope.rubrics.e = editTemplate;
      if(!$scope.isGradeItem){
        $scope.rubrics.e.title = '';
      }
    }

    // Make our initial editing rubric
    $scope.makeEditRubric();

    $scope.addSavedRubric = function(rubric){
      var savedRubObj = {
        id : rubric.id,
        title : rubric.title,
        total_points : rubric.total_points,
        created : rubric.created,
        num_assigned_gi : rubric.num_assigned_gi
      }

      savedRubObj.num_assigned_infotip = (savedRubObj.num_assigned_gi > 0) ? Drupal.formatPlural(rubric.num_assigned_gi, 'This rubric is being used on 1 item', 'This rubric is being used on @count items') : '';

      $scope.savedRubricsList.push(savedRubObj);
    }

    $scope.$on('gradingRubricChangeState', function(event, newState){
      $scope.changeState(newState);
    });

    $scope.submitButtonText = function(){
      return ($scope.activeRubricId == 'e') ? Drupal.t('Create') : Drupal.t('Save');
    };

    $scope.toggleLoading = function(addOverlay){
      if(addOverlay){
        // #grading-rubric-edit-slider while it is the container for the dialog, is not the full height of the dialog
        // rather than retool this whole dialog, we'll figure out if it contains dom elements that should expand
        // footprint of the overlay the entire thing
        var jQueryDialogHandle = $('#grading-rubric-edit-slider');
        var jQueryControlsHandle = jQueryDialogHandle.find('div.bottom-ctrls-wrapper');
        var jQueryButtonBarHandle = jQueryDialogHandle.find('div.large-submit-buttons');
        var opts = {
          width: jQueryDialogHandle.outerWidth(),
          height: jQueryDialogHandle.outerHeight()
        };
        if (jQueryControlsHandle.length){
          opts.height += jQueryControlsHandle.outerHeight()/2;
        }
        if (jQueryButtonBarHandle.length){
          opts.height += jQueryButtonBarHandle.outerHeight();
        }

        sToggleActiveLoader('grading-rubric-panel', jQueryDialogHandle, opts);
      }
      else{
        sToggleActiveLoader('grading-rubric-panel');
      }
    }

    $scope.getSaveRubricClass = function(rubricId){
      var classStr = '';
      if(rubricId == $scope.activeRubricId){
        classStr += ' active';
      }
      if($scope.hasAlignments){
        classStr += ' disabled';
      }
      return classStr;
    }
    $scope.setRubricSort = function(sort){
      $scope.rubricSort = sort.field;
    }

    $scope.$on('rubricActiveIdChange', function(event, newId){
      if (newId && newId != 'e') {
        sAlignmentResetAttachedAlignments();
      }
      if(newId !== false && ($.isNumeric(newId) || newId == 'e')){
        $scope.activeRubricId = newId;
      }
      else if(newId === false){
        $scope.makeEditRubric();
        $scope.activeRubricId = 'e';
        if (angular.isUndefined(Drupal.settings.s_alignment)) {
          Drupal.settings.s_alignment = {attached_tags: {}};
        }
      }
      if(!$scope.$$phase){
        $scope.$apply();
      }
      $scope.rubricAlignmentSanity();
    });

    $scope.$on('gradingRubricLaunch', function(event, data){
      var $defaultGradingScaleWrapper = $('#default-grading-scale-wrapper');
      $scope.isReactComponent = data.isReactComponent;
      $scope.resetErrors();

      if ($scope.isReactComponent === true) {
        $scope.saveHandler = data.saveHandler;
        $scope.cancelHandler = data.cancelHandler;
        $scope.activeRubricUpdateHandler = data.activeRubricUpdateHandler;
        $scope.addAlignmentRowClickHandler = data.addAlignmentRowClickHandler;
        $scope.isReadOnly = data.isReadOnly;
        if (data.rubric === null){
          $scope.makeEditRubric();
        } else {
          $scope.rubrics.e = data.rubric;
          $scope.activeRubricId = 'e';
        }
        $scope.rubricAlignmentSanity();
        $scope.focusTitleInput();
        $scope.calculateNewTotalPoints();
        $scope.toggleLoading(false);
      } else {
        $scope.toggleLoading(true);
        $scope.realm = data.realm;
        $scope.realmId = data.realmId;
        $scope.isReadOnly = data.isReadOnly;
        $scope.ptsErrorCells = [];
        $scope.isGradeItem = data.isGradeItem;
        $scope.isResource = data.isResource;
        $scope.rubric_handled_manually = false;
        $scope.createNew = data.createNew;
        $scope.gsSelectArea = data.gsSelectArea;

        // Scope Variables to handle

        // if a rubric is passed in, user will be responsible for responding to triggered events
        if (data.rubric) {
          $scope.rubric_handled_manually = true;
        }
        if ($scope.rubric_handled_manually && angular.isObject(data.rubric)) {
          $scope.rubrics.e = data.rubric;
          $scope.activeRubricId = 'e';
          $scope.rubricAlignmentSanity();
          $scope.focusTitleInput();
          $scope.toggleLoading(false);
        }
        else if ($scope.isResource) {
          $scope.savedRubricsList = [];
          if (data.itemNid != 'e') {
            gradingRubrics.getResourceRubricById($scope.realmId, data.itemNid, function (rubric) {
              $scope.savedRubricsList = [];
              var rubricCopy = angular.copy(rubric);
              $scope.addSavedRubric(rubric);
              $scope.rubrics[rubric.nid] = rubric;
              $scope.activeRubricId = rubric.nid;
              $scope.rubricAlignmentSanity();
              $scope.toggleLoading(false);
              $scope.focusTitleInput();
            });
          } else {
            $scope.rubricAlignmentSanity();
            $scope.toggleLoading(false);
            $scope.focusTitleInput();
          }

        }
        // editor view is read only
        else if ($scope.isReadOnly && $scope.activeRubricId) {
          gradingRubrics.getRubricById($scope.activeRubricId, function (rubric) {
            $scope.rubrics[rubric.id] = angular.copy(rubric);
            $scope.toggleLoading(false);
          });
        } else {
          gradingRubrics.getRubricsByCourse($scope.realmId, data.itemNid, function (rubrics) {
            $scope.savedRubricsList = [];
            var rubricsCopy = angular.copy(rubrics);
            $.each(rubricsCopy, function (k, rubric) {
              $scope.addSavedRubric(rubric);
              $scope.rubrics[k] = rubric;
            });
            $scope.rubricAlignmentSanity();
            $scope.toggleLoading(false);
            $scope.focusTitleInput();
          });
        }
      }

      $defaultGradingScaleWrapper.sActionLinks({
        hidden: false
      });

      $defaultGradingScaleWrapper.tipsy({
        title : function() {
          return Drupal.t("Select a scale if you want to replace your current grading scale(s). This action cannot be undone.");
        },
        gravity : function() {
          return document.dir === 'rtl' ? 'w' : 'e';
        }
      });

      $('#default-grading-scale-wrapper-disabled').tipsy({
        title : function() {
          return Drupal.t("To enable, first create a point-based scale in your gradebook setup.");
        },
        gravity : function() {
          return document.dir === 'rtl' ? 'w' : 'e';
        }
      });

      $scope.rubricTable = $('.rubric-table');

      $('.control-btn').tipsy({
        gravity : function() {
          if ($scope.state === 'slide-closed') {
            return document.dir === 'rtl' ? 'nw' : 'ne';
          }
          return $scope.expandedClass === '' ? 'n' : 'nw';
        },
        title : function() {
          var $button = $(this);
          var isEditor = $button.parents('.readonly').length == 0;
          if ($button.hasClass('close-btn')) {
            if (isEditor) {
              return Drupal.t('Close Rubric Editor');
            } else {
              return Drupal.t('Close Rubric');
            }
          }
          if ($button.hasClass('slide-btn')) {
            if (isEditor) {
              return $scope.state === 'slide-closed' ? Drupal.t('Show Rubric Editor') : Drupal.t('Hide Rubric Editor');
            } else {
              return $scope.state === 'slide-closed' ? Drupal.t('Show Rubric') : Drupal.t('Hide Rubric');
            }
          }
          if ($button.hasClass('expand-btn')) {
            return $scope.expandedClass === '' ? Drupal.t('Show Expanded Rubric Editor') : Drupal.t('Show Normal Rubric Editor');
          }
          return '';
        }
      });
    });

    $scope.updateResourcesMainContent = function(){
      if ($scope.isReactComponent === true) {
        return;
      }
      if ($scope.isResource){
        // if in Resources, reload the main content
        var libraryWrapper = $('#library-wrapper');
        var currentUrl = sLibraryGetHash();
        sLibraryUpdateMainContent(libraryWrapper, currentUrl, false, false);
      }
    };

    $scope.$on('gradingRubricSaveSuccess', function(event, rubric, isNew){
      if ($scope.isReactComponent === true) {
        return;
      }
      $scope.updateResourcesMainContent();
      if(isNew){
        if(!$scope.isResources && sIsset(Drupal.settings.s_grading_rubrics_info)){
          Drupal.settings.s_grading_rubrics_info[rubric.id] = sAlignmentRubricInfo(rubric);
        }
        if($scope.isGradeItem){
          $scope.activeRubricId = rubric.id;
          $scope.rubrics[rubric.id] = rubric;
          $scope.addSavedRubric(rubric);
          $scope.makeEditRubric();
        } else {
          $scope.activeRubricId = rubric.id;
          $scope.rubrics[rubric.id] = rubric;
          delete $scope.rubrics.e;
          if ($scope.realm == 'course') {
            sAngular.rootScopeBroadcast('gradingRubricSelect', rubric);
          }
        }
        sAngular.rootScopeBroadcast('gradingRubricSelect', rubric);
      }
      else{
        // In a save, expect an array of edited rubrics
        $.each(rubric, function(k, v){
          if(!sIsset(Drupal.settings.s_grading_rubrics_info)) {
            Drupal.settings.s_grading_rubrics_info = {};
          }
          Drupal.settings.s_grading_rubrics_info[v.id] = sAlignmentRubricInfo(v);
          sAngular.rootScopeBroadcast('gradingRubricSelectModify', v);
        })
      }
      $scope.changeState('closed');
      $scope.saving = false;
      $scope.toggleLoading(false);
    });

    /**
     * Adds to the rubrics dialog come via individual events broadcast in a loop. So muiltiple events from the alignment
     * UI can come in rapid succession. This debounce function wraps the lookup so that we can collect all of the
     * grading scale ids, fetch them all in one request, then handle adding the objectives to the dialog
     * */
    $scope.debouncedFetchAndAddRow = $scope.lodash.debounce(function() {
      processObjectiveScaleLookup($scope.queuedObjectives).then(function(success){
        if (success) {
          $.each($scope.queuedObjectives, function (key, objective) {
            var is_published = (typeof objective.is_published == 'undefined' || objective.is_published > 0);
            updateOrRejectRowFromObjective(objective, is_published);
          });
        }
        //clear the queue
        $scope.queuedObjectives = [];
        $timeout(function() {
          $scope.$apply();
          //kill the loader
          $scope.toggleLoading(false);
        },0);
      });
    }, 200);

    /**
     * Async AngularJS Promise function.
     * Given a collection of objectives, pull the unique set of grading_scale_ids and fetch the grading scales. Once
     * fetched, insert the grading scales into an associative array as a quick lookup.
     * @param {Object []} queuedObjectives
     * @return {Promise<Boolean>} - true on success, false on invalid params or response failure
     * */
    let processObjectiveScaleLookup = function(queuedObjectives) {
      //get the unique set of grading_scale_ids from the list (they could all be different or the same)
      var uniqueIds = [...new Set(queuedObjectives.map(item => item.grading_scale_id))];
      if (uniqueIds.length === 0) {
        return $q.when(false);
      }
      var scaleIdsString = '?grading_scale_ids=' + uniqueIds.join(',');

      return $http.get('/iapi2/district-mastery/course/' + $scope.courseNid + '/grading-scales' + scaleIdsString)
        .then(function (gradeScalesResponse) {
          if (gradeScalesResponse == null || gradeScalesResponse.data == null || gradeScalesResponse.data.data == null) {
            return false;
          }
          $.each(gradeScalesResponse.data.data, function (scaleKey, gradingScale) {
            //shouldn't exist yet but let's double-check
            if ($scope.gradingScales[gradingScale.id] == null) {
              var _columns = [];
              $.each(gradingScale.scale, function (scaleItemPts, scaleItemDesc) {
                //pts should never be anything other than points, but better to check than display NaN
                _columns.push({'pts': Number(scaleItemPts) != NaN ? Number(scaleItemPts) : scaleItemPts, 'description': scaleItemDesc});
              });
              //make sure the columns are sorted descending
              _columns.sort((a,b) => (a.pts > b.pts) ? -1 : ((b.pts > a.pts) ? 1 : 0));
              gradingScale._columns = _columns;
              //stuff this object into the local lookup
              $scope.gradingScales[gradingScale.id] = gradingScale;
            }
          });
          return true;
        }, function(err) {
          console.log(err);
          return false;
        });
    };

    /**
     * Given an objective, this function will validate that the grading scale exists in our local lookup
     * as we expect and that it is of type POINTS. If validation passes the row will be inserted. If validation
     * fails a warning flag will be set and the objective will not be added.
     * @param {Object} objective
     * @param {Boolean} is_published
     * */
    let updateOrRejectRowFromObjective = function(objective, is_published) {
      var scaleForObjective = $scope.gradingScales[objective.grading_scale_id];
      if (scaleForObjective == null ||
        (scaleForObjective.original_type != null && scaleForObjective.original_type !== 3) ||
        (scaleForObjective.original_type == null && scaleForObjective.type !== 3)) {
        //If we don't have a lookup for this grading_scale_id or the type is not 3 (POINTS)
        $scope.hasInvalidObjectiveAlignmentAttempt = true;
        sAlignmentRemoveItem(objective.guid, false);
        $scope.removeMasteryItem(objective.guid);
      } else {
        //good to add
        var newRowIndex = $scope.addRow(true, objective.grading_scale_id);
        updateRowFromObjective(objective, is_published, newRowIndex);
      }
    }

    /**
     * Decodes safe HTML entities from a string. Right now this is only decoding ampersands. XSS is a concern
     * which is why we are not decoding all HTML entities.
     *
     * TODO: Remove with the real fix in PE-127424
     *
     * @param {string} stringValue - The string that may contain elements to decode.
     * @returns {string} The partially decoded string.
     */
    let partialDecode = function(stringValue) {
      //look for encoded ampersands and replace with &
      stringValue = stringValue.replace(/&amp;/g, '&');
      return stringValue;
    }

    /**
     * Given an objective and it's row number index, this function will update the rubric row with data from the objective
     * @param {Object} objective
     * @param {Boolean} is_published
     * @param {Number} newRowIndex
     * */
    let updateRowFromObjective = function(objective, is_published, newRowIndex) {
      if(newRowIndex != undefined) {
        let newRow = $scope.rubrics[$scope.activeRubricId].rows[newRowIndex];
        newRow.description = partialDecode(objective.description);
        newRow.title = partialDecode(objective.title ? objective.title : objective.name);
        newRow.guid = objective.usm_id || objective.guid || '';
        newRow.mastery_objective_id = objective.mastery_objective_id ? objective.mastery_objective_id : '';
        newRow.is_published = is_published;
      }
      $scope.rubricAlignmentSanity();
    };

    /**
     * Event handler for additional rows coming from the mastery objective alignment UI
     * */
    $scope.$on('sAlignmentAdd', function(event, objective){
      if ($scope.isReactComponent === true) {
        $.each($scope.rubrics[$scope.activeRubricId].rows, function (k, v) {
          // search to see if the alignment is already on the rubric
          if (v.tid && v.tid == objective.guid) {
            // use TID
            alignmentExists = true;
          } else if (v.guid && v.guid == objective.guid) {
            // use GUID
            alignmentExists = true;
          }
        });
        if (alignmentExists){
          return;
        }
        var alignmentExists = false;
        var newRowIndex = $scope.addRow(true);

        if(newRowIndex != undefined) {
          // currently always published when incoming from isReactComponent
          $scope.rubrics[$scope.activeRubricId].rows[newRowIndex].description = objective.description;
          $scope.rubrics[$scope.activeRubricId].rows[newRowIndex].title = objective.name;
          $scope.rubrics[$scope.activeRubricId].rows[newRowIndex].guid = objective.guid;
          $scope.rubrics[$scope.activeRubricId].rows[newRowIndex].is_published = true;
        }
        if ($scope.activeRubricUpdateHandler){
          // update pending rubric
          $scope.activeRubricUpdateHandler($scope.rubrics[$scope.activeRubricId]);
        }
        return;
      } //END React block

      var alignmentExists = false;
      var is_published = (typeof objective.is_published == 'undefined' || objective.is_published > 0);
      if($scope.rubrics[$scope.activeRubricId] == undefined) {
        // no-op
      } else if (is_published) {
        $.each($scope.rubrics[$scope.activeRubricId].rows, function (k, v) {
          if (v.guid == objective.guid) {
            alignmentExists = true;
            return false;
          }
        });
      } else if ($scope.queuedObjectives.length > 0) {
        //doesn't strictly exist YET, but is already queued to be created
        $.each($scope.queuedObjectives, function (k, v) {
          if (v.guid == objective.guid) {
            alignmentExists = true;
            return false;
          }
        });

      } else {
        $.each($scope.rubrics[$scope.activeRubricId].rows, function (k, v) {
          if (v.title == objective.title && v.description == objective.description) {
            alignmentExists = true;
            return false;
          }
        });
      }
      if(alignmentExists){
        return;
      }

      //If this has a grading_scale_id - then this is an objective. Lets get that column data to add to the page
      if (objective.grading_scale_id != null && objective.grading_scale_id > 0) {
        //see if we have it locally first
        if ($scope.gradingScales[objective.grading_scale_id] != null) {
          updateOrRejectRowFromObjective(objective, is_published);
        }
        else {
          // This objective has a grading scale we dont have yet.
          // Push this objective (mastery objective alignment) on the queue
          $scope.queuedObjectives.push(objective);
          if ($scope.queuedObjectives.length == 1) {
            //this block introduces some asynchronous activity. throw out a loader
            $scope.toggleLoading(true);
          }
          //will need this when debounce function gets invoked for the rest call
          $scope.courseNid = event.currentScope.realmId;
          $scope.debouncedFetchAndAddRow();
        }
      } else {
        //no grading scale? push a generic row
        var newRowIndex = $scope.addRow(true);
        updateRowFromObjective(objective, is_published, newRowIndex);
      }

      $timeout(function() {
        $scope.$apply();
      },0);
    });

    $scope.$on('sAlignmentRemove', function(event, objective){
      if ($scope.isReactComponent === true) {
        $.each($scope.rubrics[$scope.activeRubricId].rows, function (i, row) {
          var tidOrGuid = row.guid ? row.guid : row.tid;
          if (tidOrGuid == objective.guid) {
            $scope.removeRow(i);
            return false;
          }
        });
        if ($scope.activeRubricUpdateHandler){
          // update pending rubric
          $scope.activeRubricUpdateHandler($scope.rubrics[$scope.activeRubricId]);
        }
      } else {
        $.each($scope.rubrics[$scope.activeRubricId].rows, function (i, row) {
          if (angular.isDefined(row.guid) && row.guid == objective.guid) {
            $scope.removeRow(i);
            return false;
          }
        });
      }
      $scope.rubricAlignmentSanity();

      $timeout(function() {
        $scope.$apply();
      },0)
    });

    $scope.getExpandButtonClass = function() {
      return $scope.state === 'slide-closed' ? 'ng-cloak' : '';
    }

    $scope.rubricBodyClass = function(){
      var classStr = $scope.state;
      if($scope.state == 'closed'){
        classStr += ' hidden';
      }
      classStr += ($scope.isGradeItem ? ' grade-item-rubric-edit' : ' grade-setup-rubric-edit');
      if(!$scope.isGradeItem){
        classStr += $scope.activeRubricId == 'e' ? ' new-rubric-edit' : ' existing-rubric-edit';
      }

      if ($scope.expandedClass) {
        classStr += " " + $scope.expandedClass;
      }

      if ($scope.isReadOnly) {
        classStr += " read-only";
      }

      return classStr;
    }

    /*
     * To edit they must either be on the grade setup page OR on assignment page and editing the 'edit' rubric
     */
    $scope.isEditable = function(){
      return !$scope.isReadOnly;
    };

    $scope.focusTitleInput = function(){
      $('#rubric-title-input').focus();
    }

    $scope.rubricItemClick = function(event, rubricId){
      // Non Alignment rubrics only selectable
      if($scope.isGradeItem){
        return;
      }
      $scope.activeRubricId = rubricId;
      $scope.focusTitleInput();
    }

    // Run sanity on the state of the rubric to make sure that it has either all custom rows or all alignment rows
    // Having alignments trumps custom criteria
    $scope.rubricAlignmentSanity = function(){
      if(angular.isUndefined($scope.rubrics[$scope.activeRubricId]) || angular.isUndefined($scope.rubrics[$scope.activeRubricId].rows)){
        return;
      }
      var tempHasAlignments = false; // assume no alignments
      $.each($scope.rubrics[$scope.activeRubricId].rows, function(i, row){
        if(angular.isDefined(row) && angular.isDefined(row.guid) && row.guid != null && row.guid != ''){
          tempHasAlignments = true;
        }
        //alignment sanity is a convenient place to shorthand a mastery_objective alignment boolean
        if (row != null) {
          row.is_mastery_objective_aligned = (row.mastery_objective_id != null && row.mastery_objective_id != '');
        }
      });
      $scope.hasAlignments = tempHasAlignments;
    }

    $scope.$watch('rubrics', function(newVal, oldVal){
      if(angular.isUndefined($scope.rubrics[$scope.activeRubricId])){
        return;
      }

      if($scope.rubricSliderContext === null){
        $scope.rubricSliderContext = $('.grade-setup-rubric-edit');
      }

      // Collect a list of the IDs that have been dirtied
      if($scope.rubrics[$scope.activeRubricId].title != ''){
        if($.inArray($scope.activeRubricId, $scope.dirtyRubrics) === -1){
          $scope.dirtyRubrics.push($scope.activeRubricId);
        }
      }
      sGradesResizeInnerTable($scope.rubricSliderContext);
    },true);

    /**
     * @deprecated this is not used anywhere
     */
    $scope.$on('gradingRubricRowReorder', function(event, startIndex, stopIndex){
      $scope.$apply(function(){
        var movedRow = $scope.rubrics[$scope.activeRubricId].rows[startIndex];
        if(angular.isUndefined(movedRow)){
          return;
        }
        $scope.rubrics[$scope.activeRubricId].rows.splice(startIndex, 1);
        $scope.rubrics[$scope.activeRubricId].rows.splice(stopIndex, 0, movedRow);
      })
    });

    $scope.hasNumericPointsError = function(){
      var hasError = false;
      $.each($scope.ptsErrorCells, function(rowIndex, columnErrors){
        if(typeof columnErrors == 'object' && columnErrors.length > 0){
          hasError = true;
          return false;
        }
      })
      return hasError;
    }

    $scope.cellHasError = function(rowIndex, columnIndex){
      if(angular.isDefined($scope.ptsErrorCells[rowIndex]) && typeof $scope.ptsErrorCells[rowIndex] == 'object' && $scope.ptsErrorCells[rowIndex][columnIndex] == 1){
        return true;
      }
      return false;
    }

    $scope.rowPointsChange = function(rowIndex){
      var row = $scope.rubrics[$scope.activeRubricId].rows[rowIndex];
      // Find our new max points when this changes
      var newMaxPoints = 0;
      var hasError = false;
      $.each(row.columns, function(k,v){
        if(angular.isUndefined($scope.ptsErrorCells[rowIndex])){
          $scope.ptsErrorCells[rowIndex] = [];
        }
        if(!$.isNumeric(v.pts)){
          $scope.ptsErrorCells[rowIndex][k] = 1;
          hasError = true;
        }
        else{
          $scope.ptsErrorCells[rowIndex][k] = 0;
        }
        v = sGradesRoundNumber(v.pts);
        if(v > newMaxPoints){
          newMaxPoints = v;
        }
      });

      if(hasError){
        $scope.errorMessage = Drupal.t('Grading Scale point values must be strictly numeric');
      }
      else{
        // No error in the row then make sure the ptsErrorCells error tracker is empty
        $scope.ptsErrorCells[rowIndex] = [];
      }

      // If there was a title error but it has since been resolved, make sure to indicate this
      if($scope.hasTitleError && $scope.rubrics[$scope.activeRubricId].title != ''){
        $scope.hasTitleError = false;
      }

      $scope.rubrics[$scope.activeRubricId].rows[rowIndex].max_points = sGradesRoundNumber(newMaxPoints);
      $scope.calculateNewTotalPoints();
    }
    $scope.calculateNewTotalPoints = function(){
      // Calculate our new totalpoints
      var newTotalPoints = 0;
      var rubric = $scope.rubrics[$scope.activeRubricId];
      $.each(rubric.rows, function(k,row){
        var pts = sGradesRoundNumber(row.max_points);
        if($.isNumeric(pts)){
          newTotalPoints += pts;
        }
      });
      if(newTotalPoints != null){
        $scope.rubrics[$scope.activeRubricId].total_points = sGradesRoundNumber(newTotalPoints);
      }
    }

    $scope.sortColumns = function(rowIndex){
      $scope.rubrics[$scope.activeRubricId].rows[rowIndex].columns = $scope.rubrics[$scope.activeRubricId].rows[rowIndex].columns.sort(function(a,b){
        return b.pts - a.pts;
      });
    }

    $scope.addColumn = function(rowIndex, colIndex, adjust){
      if(!$scope.isEditable()){
        return;
      }
      adjust = parseInt(adjust);
      var columns = $scope.rubrics[$scope.activeRubricId].rows[rowIndex].columns;
      var targetCell = columns[colIndex];
      var newTargetCell = angular.copy(targetCell);
      if((colIndex + adjust >= 0) && (colIndex + adjust) <= (columns.length - 1)){
        newTargetCell.pts = Math.min(columns[colIndex].pts, columns[colIndex + adjust].pts) + Math.floor(Math.abs(columns[colIndex].pts - columns[colIndex + adjust].pts)/2);
      }
      $scope.rubrics[$scope.activeRubricId].rows[rowIndex].columns.push(newTargetCell);
      $scope.sortColumns(rowIndex);

      // the tooltip is hanging around, this will remove all active tooltips
      $('.tipsy-e').remove();
    }

    $scope.removeColumn = function(rowIndex, colIndex){
      if(!$scope.isEditable() || $scope.rubrics[$scope.activeRubricId].rows[rowIndex].columns.length == 1){
        return;
      }
      $scope.rubrics[$scope.activeRubricId].rows[rowIndex].columns.splice(colIndex,1);
      $scope.calculateNewTotalPoints();
      $scope.rowPointsChange(rowIndex);
    }

    $scope.addRowClick = function(){
      return $scope.addRow(false);
    }

    // return markup for a row styled as an element for the selected-container
    $scope.selectedElementRow = function (row){
      return $('<div class="selected-item active visually-hidden" id="' + row.guid + '"><input type="checkbox" class="std-selector"><span class="title">' + row.title + '</span> · <span class="meta small gray">' + row.description + '</span></div>');
    }

    $scope.fillSelectedBox = function(){
      if ($scope.isReactComponent === true) {
        return;
      }
      sAlignmentRubricUpdate($scope.rubrics[$scope.activeRubricId]);
      sAlignmentUpdateSelectedCount();
      $.each($scope.rubrics[$scope.activeRubricId].rows, function(idx, obj){
        if (obj.is_published){
          // add this to the selected box
          var el = $scope.selectedElementRow(obj);
          $('.selected-container').append(el);
          sAlignmentAddItem(el, true);
        }
      });
    }

    function standardsSelectorCallback(event) {
      const { removedStandards,selectedStandards } = event.context;
      $.each(removedStandards, function(idx, standard){
        sAngular.rootScopeBroadcast('sAlignmentRemove', { guid: standard.uid });
      });
      $.each(selectedStandards, function(idx, standard){
        const alignment = {
          'guid': standard.uid,
          'name': standard.code,
          'description': standard.description,
        };
        sAngular.rootScopeBroadcast('sAlignmentAdd', alignment);
      });
    }

    $scope.addAlignmentRowClick = function(useDistrictMasteryPicker, useUSMStandardsSelector) {
      $scope.hasInvalidObjectiveAlignmentAttempt = false;
      if ($scope.isReactComponent === true) {
        if ($scope.activeRubricUpdateHandler){
          // update pending rubric
          $scope.activeRubricUpdateHandler($scope.rubrics[$scope.activeRubricId]);
        }
        $scope.addAlignmentRowClickHandler();
        return;
      }
      // attempt to get the active form
      var form = sAlignmentGetActiveForm();
      if (!form) {
        // default to the old method of form retrieval
        form = $('.alignment-btn').parents('form').eq(0);
      }
      var alignmentFormContainer = $('.alignment-form-container');
      alignmentFormContainer.attr('id', 'form_'+form.attr('id'));

      $scope.fillSelectedBox();
      if (useUSMStandardsSelector) {
        let preSelectedStandards = $scope.rubrics[$scope.activeRubricId].rows.filter(rubric => rubric.is_published).map(standard => ({
          uid: standard.guid,
          description: standard.description,
          code: standard.title,
          name: standard.description,
        }));
        window.openUSMMfe('rubric', preSelectedStandards, standardsSelectorCallback);
      }
      else {
        // This method is called when the Learning Objectives button is clicked in the rubric modal.
        // This line of code finds the Assignment modal that launched the Rubrics modal and clicks
        // the Align button.
        let clickInput = useDistrictMasteryPicker ? {
          'force_district_mastery': true,
        } : {
          'override': true,
          'force_classic_mastery': true,
        };
        $('.alignment-btn:not(.disabled), .alignment-btn.disabled-rubric-selected', form).trigger('click', clickInput);
      }
      return;
    }

    // Add a rubric row and return the index - if alignmentID is provided,
    // pull the gradescale columns from local
    $scope.addRow = function(isAlignment, alignmentID){
      if ($scope.isReactComponent === true) {
        if ($scope.activeRubricUpdateHandler){
          // update pending rubric
          $scope.activeRubricUpdateHandler($scope.rubrics[$scope.activeRubricId]);
        }
      }

      if(!$scope.isEditable()){
        return;
      }
      var newRowIndex;
      // If adding an alignment
      if (isAlignment) {
        var newRow;
        if ($scope.rubrics[$scope.activeRubricId].rows.length === 1 &&
          angular.equals($scope.rubrics[$scope.activeRubricId].rows[0], templateRubric.rows[0])) {
          //there is only one placeholder row and it hasn't been altered - we will replace it
          newRowIndex = 0;
          newRow = $scope.rubrics[$scope.activeRubricId].rows[0];
        } else {
          newRow = angular.copy(templateRubric.rows[0]);
        }

        //Add gradescales from lookup if there's a valid ID and lookup value - otherwise add default row
        if (alignmentID && $scope.gradingScales[alignmentID]) {
          var columns = $scope.gradingScales[alignmentID]._columns;
          newRow.columns = angular.copy(columns);
        }

      } else {
        //regular rubric row
        var newRow = angular.copy(templateRubric.rows[0]);
        if($scope.rubrics[$scope.activeRubricId].rows.length > 0){
          //new rubric rows copy their gradescales from the last row in the rubric
          var lastRow = $scope.rubrics[$scope.activeRubricId].rows[$scope.rubrics[$scope.activeRubricId].rows.length - 1];
          if (!lastRow.is_mastery_objective_aligned){
            newRow.columns = angular.copy(lastRow.columns);
          }
          //else adding a plain rubric after an aligned objective - dont copy the lastRow.columns, just use default columns
        }
      }

      if (newRowIndex != 0) {
        $scope.rubrics[$scope.activeRubricId].rows.push(newRow);
        newRowIndex = ($scope.rubrics[$scope.activeRubricId].rows.length - 1);
      }
      $scope.calculateNewTotalPoints();
      $scope.rowPointsChange(newRowIndex);

      return newRowIndex;
    }
    $scope.removeRow = function(rowIndex){

      if(!$scope.isEditable()){
        return;
      }

      var row = $scope.rubrics[$scope.activeRubricId].rows[rowIndex];
      var guid;
      // If this is an alignment row and the form function exists, remove from form
      if(!$scope.isReactComponent && angular.isDefined(row.guid) && row.guid != null && typeof sAlignmentRemoveItem == 'function'){
        guid = row.guid;
        sAlignmentRemoveItem(row.guid, false);
      }

      $scope.rubrics[$scope.activeRubricId].rows.splice(rowIndex,1);
      if($scope.rubrics[$scope.activeRubricId].rows.length == 0){
        $scope.addRow(false);
        $scope.rubricAlignmentSanity(); // Could have changed if this is an alignment rubric if all tags deleted
      }
      $scope.calculateNewTotalPoints();
      $scope.fillSelectedBox();

      // the tooltip is hanging around, this will remove all active tooltips
      $('.tipsy-e').remove();

      if (guid) {
        $scope.removeMasteryItem(guid);
      }

      if ($scope.isReactComponent === true && $scope.activeRubricUpdateHandler) {
        // update pending rubric
        $scope.activeRubricUpdateHandler($scope.rubrics[$scope.activeRubricId]);
      }
    }

    $scope.removeMasteryItem = function(guid) {
      var districtMasteryInput = $('input[name="district-mastery-aligned-objectives"]');
      if (districtMasteryInput.length === 0) {
        return;
      }

      var alignedObjectives = JSON.parse(districtMasteryInput.val());
      var updatedItems = alignedObjectives.filter(e => e.id !== guid);
      districtMasteryInput.val(JSON.stringify(updatedItems));
      districtMasteryInput.trigger('change');
    }

    $scope.setTitleError = function(){
      $scope.errorMessage = Drupal.t('Rubrics must have a title');
      $scope.hasTitleError = true;
    }

    $scope.removeAngularElementsFromObject = function(object){
      // removes angular elements like $$haskKey
      var json = angular.toJson(object);
      return JSON.parse(json);
    };

    $scope.setCriteriaError = function(row_idx){
      if (!$scope.errorCriteriaRows){
        $scope.errorCriteriaRows = {};
      }
      $scope.errorCriteriaRows[row_idx] = true;
      $scope.criteriaErrorMessage = Drupal.t('All criteria must have a title');
      $scope.hasCriteriaError = true;
    }

    $scope.resetErrors = function(){
      $scope.hasTitleError = false;
      $scope.hasCriteriaError = false;
      $scope.errorCriteriaRows = {};
      $scope.hasInvalidObjectiveAlignmentAttempt = false;
    }

    $scope.rubricFormSubmit = function(isSubmit, isUSMStandardsSelectorEnabled){
      if(isSubmit){
        if($scope.hasNumericPointsError()){
          return;
        }

        $scope.resetErrors();

        // check for title error
        if($scope.rubrics[$scope.activeRubricId].title == ''){
          $scope.setTitleError();
        }
        // check for criteria title error
        $.each($scope.rubrics[$scope.activeRubricId].rows, function(idx, row){
          if (!row.is_published && row.title == '') {
            $scope.setCriteriaError(idx);
          }
        });

        if ($scope.hasCriteriaError || $scope.hasTitleError){
          return;
        }

        $scope.toggleLoading(true);

        if ($scope.isReactComponent === true) {
          if ($scope.saveHandler) {
            $scope.saveHandler($scope.removeAngularElementsFromObject($scope.rubrics.e));
          }
          return;
        }
        if ($scope.rubric_handled_manually){
          var form = $(sLibraryRubricForms().join(', '));
          form.trigger('sLibraryResourceMaterialRubricUpdated', $scope.rubrics.e);
          $scope.toggleLoading(false);
          $scope.changeState('closed');
        }
        // interacting with grade item form, behave differently
        else if($scope.isGradeItem){
          $scope.saving = true;
          if($scope.activeRubricId == 'e'){
            gradingRubrics.createRubric($scope.realm, $scope.realmId, $scope.rubrics.e);
          }
          else{
            var editRubrics = [$scope.rubrics[$scope.activeRubricId]];
            gradingRubrics.saveRubrics($scope.realm, $scope.realmId, editRubrics);
          }
        }
        else{
          var editRubrics = [];
          if($scope.dirtyRubrics.length > 0){
            $.each($scope.dirtyRubrics, function(i, rubId){
              if(rubId == 'e' && $scope.rubrics.e.title != ''){
                gradingRubrics.createRubric($scope.realm, $scope.realmId, $scope.rubrics.e);
              }
              else{
                editRubrics.push($scope.rubrics[rubId]);
              }
            });

            if(editRubrics.length > 0){
              gradingRubrics.saveRubrics($scope.realm, $scope.realmId, editRubrics);
            }
          }
          $scope.dirtyRubrics = [];
        }
        sAlignmentResetAttachedAlignments();
      }
      else{
        if ($scope.isReactComponent === true) {
          if ($scope.cancelHandler) {
            $scope.cancelHandler();
          }
          $scope.toggleLoading(false);
          $scope.changeState('closed');
          return;
        }
        sAlignmentClearPendingAlignments($scope.createNew);
        $scope.changeState('closed');
        if($scope.createNew && $scope.isResource){
          $('select#edit-grading-scale-id').selectmenu('value', 0);
          sGradeScaleClearRubricSelection($scope.gsSelectArea);
        }
      }
      sAlignmentResetAttachedAlignments(true, isUSMStandardsSelectorEnabled);
      $scope.makeEditRubric();
      $scope.activeRubricId = 'e';
    };

    $scope.$on('gradingRubricDeleteSuccess', function(event, rubricId){
      $scope.updateResourcesMainContent();
      // If they somehow found a way to delete the rubric they are currently editing
      if($scope.activeRubricId == rubricId){
        $scope.makeEditRubric();
        $scope.activeRubricId = 'e';
      }

      delete $scope.rubrics[rubricId];
    });

    $scope.changeState = function(newState){
      if ($scope.isReactComponent === true && (newState === 'closed' || newState === 'closed-skip-cancel')) {
        if (newState !== 'closed-skip-cancel') {
          if ($scope.cancelHandler) {
            $scope.cancelHandler();
          }
        } else {
          // The legacy editor does not support the state 'closed-skip-cancel', so revert to close after skipping the cancel
          newState = 'closed';
        }
      }
      var oldState = $scope.state;
      if(oldState == 'slide-closed' && newState == 'slide-closed'){
        newState = 'opened';
      }
      $scope.state = newState;
      if(!$scope.$$phase){
        $scope.$apply();
      }
    };

    $scope.toggleExpandedState = function() {
      $scope.expandedClass = $scope.expandedClass === '' ? 'grading-rubric-edit-slider--expanded' : '';
    };

    $scope.canAddAlignments = function(){
      // Only allow alignments on grade item impromptu forms
      if(!$scope.isGradeItem || angular.isUndefined($scope.rubrics[$scope.activeRubricId])){
        return false;
      }
      var ret = ($scope.hasAlignments || angular.isUndefined($scope.rubrics[$scope.activeRubricId].rows) || $scope.rubrics[$scope.activeRubricId].rows.length == 1);
      return ret;
    };

    $scope.alignmentHidden = function(isUSMEnabled){
      if (isUSMEnabled){
        return (!$('.usm-align-button').length) && !$scope.isReactComponent;
      } else {
        return (!$('.alignment-btn:not(.disabled), .alignment-btn.disabled-rubric-selected').length && !$scope.isReactComponent);
      }
    };
  }]);

sAngular.addController('s_grades_grading_rubrics_block', ['$scope','gradingRubrics', function($scope, gradingRubrics){
  $scope.rubrics = null;
  // This will be set by the page we are on, that is why we will not listen for the event transmitted
  $scope.realm = Drupal.settings.s_realm_info.realm;
  $scope.realmId = Drupal.settings.s_realm_info.realm_id;

  $scope.addPopupsBehavior = function(){
    setTimeout(function(){
      sAttachBehavior('popups', $(document));
    }, 0);
  }

  gradingRubrics.getRubricsByCourse($scope.realmId, false, function(rubrics){
    var filteredRubrics = [];
    $.each(rubrics, function(i, rubric){
      if(rubric.is_tracked != true) {
        rubric.num_assigned_infotip = (rubric.num_assigned_gi > 0) ? Drupal.formatPlural(rubric.num_assigned_gi, 'This rubric is being used on 1 item', 'This rubric is being used on @count items') : '';
        //apply to drupal settings
        if (!sIsset(Drupal.settings.s_grading_rubrics)) {
          Drupal.settings.s_grading_rubrics = {};
        }
        Drupal.settings.s_grading_rubrics[rubric.id] = rubric.total_points;
      } else {
        filteredRubrics.push(rubric.id);
      }
    })
    for(var i in filteredRubrics) {
      var rubricId = filteredRubrics[i];
      delete rubrics[rubricId];
    }

    // Need to make sure server response is not an empty array
    $scope.rubrics = (typeof rubrics == 'object' && angular.isUndefined(rubrics.length)) ? rubrics : {};
    if(!$scope.$$phase){
      $scope.$apply();
    }
    $scope.addPopupsBehavior();
  });

  $scope.$on('gradingRubricSaveSuccess', function(event, rubric, isNew){
    if(isNew){
      $scope.rubrics[rubric.id] = rubric;
      $scope.activeRubricId = rubric.id;
      sAlignmentRubricUpdate(rubric);
      if(!$scope.$$phase){
        $scope.$apply();
      }
      $scope.addPopupsBehavior();
    }
  });

  $scope.$on('gradingRubricDeleteSuccess', function(event, rubricId){
    delete $scope.rubrics[rubricId];
  });
}]);

sAngular.addDirective('gradingRubricGradingLaunch', ['$compile', 'gradingRubrics', function($compile, gradingRubrics){
  return {
    scope : {},
    restrict : 'C',
    link : function(scope, element, attrs){
      scope.rubricId = attrs.rubricId;
      scope.enrollmentId = attrs.enrollmentId;
      scope.itemId = attrs.itemId;
      scope.opened = false;
      scope.editable = attrs.editable == 1;
      scope.isComponent = attrs.isComponent == 1;
      scope.submissionId = attrs.submissionId;
      scope.totalRubricPoints = parseFloat(attrs.totalRubricPoints);
      scope.textOnly = (attrs.textOnly === 'true');
      scope.isGradeItemCollectedOnly = (attrs.isGradeItemCollectedOnly === 'true');

      // When a grade is saved, update if this is the pertinent scope
      scope.$on('gradingRubricTotalGradeUpdate', function(event, data){
        if (data.isDistrictMasteryGrading) {
          return;
        }
        if(parseInt(data.enrollmentId) == parseInt(scope.enrollmentId) && parseInt(data.itemId) == parseInt(scope.itemId) && parseInt(data.rubricId) == parseInt(scope.rubricId) && (data.submissionId == scope.submissionId)){
          var rubricFakeInput = $('.rubric-fake-grade-disp .grade-val', element);
          var gradeScoreObj = rubricFakeInput.parents('.grade-score');
          var override = gradeScoreObj.children('.input-override').children('input');
          var maxPoints = sGradesRoundNumber(gradeScoreObj.children('.input-max-points').children('input').val());
          var rubric_score = gradeScoreObj.children('.input-rubric-score').children('input');
          var score = gradeScoreObj.children('.input-score').children('.form-item').children('input');
          var questionPoints = $('#question-points-total-' + scope.itemId, gradeScoreObj);
          var rubricTotalPoints = $('#rubric-total-points-' + scope.itemId, gradeScoreObj);

          questionPoints.tipsy({
            title : function() {
              return Drupal.t("This score contributes to the cumulative test score");
            },
            gravity : "s"
          });
          rubricTotalPoints.tipsy({
            title : function() {
              return Drupal.t("This rubric score is used to calculate the question score");
            },
            gravity : "n"
          });

          if (scope.isComponent) {

            // Calculate rubric score ratio
            var rubric_score_ratio = (data.grade / scope.totalRubricPoints);

            // Apply rubric score ratio to question score
            var question_score = (rubric_score_ratio * maxPoints)
            if (data.grade == ''){
              questionPoints.text(' /' + maxPoints);
            } else {
              questionPoints.text(sGradesRoundNumber(question_score) + '/' + maxPoints);
            }

            // inject the score into the form
            score.val(rubric_score_ratio * maxPoints);

            // inject the rubric score into the form
            rubric_score.val(data.grade);

            // take into account 0
            if ($.isNumeric(data.grade)) {
              override.val('1');
            } else {
              // if the score is blank, clear the override
              override.val('0');
            }
          }

          // Interface with discussion page ajax grade form
          var discussionAjaxForm = rubricFakeInput.parents('form.grade-post-form:first');
          if(discussionAjaxForm.length > 0 && typeof sDiscussionAjaxPostMarkGraded == 'function'){
            var discUid = $('input.uid', discussionAjaxForm).val();
            sDiscussionAjaxPostMarkGraded(discUid);
          }
          // Interface with the dropbox submissions list
          var dropBoxGradeForm = rubricFakeInput.parents('#s-grade-item-edit-enrollment-grade-form:first');
          if (dropBoxGradeForm.length > 0) {
            if (data.grade > 0 && scope.textOnly) {
              sDropItemUpdateStudentDetails(dropBoxGradeForm, "<span class='inline-icon mini rubric-icon'></span>", 0);
            } else {
              sDropItemUpdateStudentDetails(dropBoxGradeForm, data.grade, 0);
            }
          }
          if (!scope.textOnly) {
            rubricFakeInput.text(data.grade);
            // When using rubric scale
            var editGradesForm = $('#s-grade-item-edit-grades-form');
            if (editGradesForm.length > 0) {
              // Only clear exception icon if persistence is NOT enabled
              var isPersistenceEnabled = Drupal.settings.sGrader && Drupal.settings.sGrader.isPersistenceOfFlagsInGradebookEnabled;
              if (!isPersistenceEnabled) {
                $(element).closest('.edit-grade-grade').find('.grade-exception-icon').remove();
              }
            }
          }
          $(document).trigger('gradingRubricTotalGradeUpdate', [element]);
        }
      });

      if (scope.isComponent){
        // trigger the grade update when loading assessment component grader to process the extra visuals
        var gradeValText = $('.rubric-fake-grade-disp .grade-val', element).text();
        var rubric_score = gradeValText;
        if ($.isNumeric(gradeValText)) {
          rubric_score = sGradesRoundNumber(gradeValText);
        }

        data = {
          enrollmentId: scope.enrollmentId,
          itemId: scope.itemId,
          rubricId: scope.rubricId,
          submissionId: scope.submissionId,
          grade: rubric_score,
          isDistrictMasteryGrading: false
        };
        sAngular.rootScopeBroadcast('gradingRubricTotalGradeUpdate', data);
      }

      element.click(function(){
        // Remove existing editor
        var existingEditor = $('#grading-rubric-edit-grades-slider');
        if (existingEditor.length == 0 && !scope.opened) {
          scope.opened = true;
          // Compile a new one
          var rubricOutput = Drupal.theme.s_grades_rubric_grading();
          Drupal.sAccessibility.setInitialFocusPopup($compile(rubricOutput)(scope).prependTo($('body')));
        }
        Drupal.sAccessibility.setLastFocus(element);
        sAngular.rootScopeBroadcast('gradingRubricGradesVars', {
          rubric_id : scope.rubricId,
          enrollment_id : scope.enrollmentId,
          item_id : scope.itemId,
          editable: scope.editable,
          isComponent: scope.isComponent,
          submissionId: scope.submissionId,
          isGradeItemCollectedOnly: scope.isGradeItemCollectedOnly
        });
      });

      element.on('ReactInit', function(event, rubric, gradeInfo, overrideInfo, saveHandler, cancelHandler, readOnly){
        var existingEditor = $('#grading-rubric-edit-grades-slider');
        if (existingEditor.length == 0 && !scope.opened) {
          scope.opened = true;
          // Compile a new one
          var rubricOutput = Drupal.theme.s_grades_rubric_grading();
          Drupal.sAccessibility.setInitialFocusPopup($compile(rubricOutput)(scope).prependTo($('body')));
        }
        Drupal.sAccessibility.setLastFocus(element);
        sAngular.rootScopeBroadcast('ReactInit', {
          rubric: rubric,
          gradeInfo: gradeInfo,
          overrideInfo: overrideInfo,
          saveHandler: saveHandler,
          cancelHandler: cancelHandler,
          readOnly: readOnly
        });
      });
    }
  }
}]);

sAngular.addController('grading_rubric_edit_grades', ['$scope', 'gradingRubrics', function($scope, gradingRubrics){
  $scope.rubric = null;
  $scope.enrollmentId = null;
  $scope.itemId = null;
  $scope.gradeInfo = {};
  $scope.requiredLoads = []; // array to watch, when it is filled with everything needing loading we can remove ajax loader
  $scope.loadInProgress = false;
  $scope.state = 'opened';
  $scope.minimized = false;
  $scope.activeCommentBubbleRowId = false;
  $scope.gradeInfoDirty = false;
  $scope.overrideEditActive = false;
  $scope.manualOverride = false; // set when a user types a number into a rubric that is not equal to the score
  $scope.overrideCleared = false; // Keep a flag for when an override has been cleared out so we know something is dirty
  $scope.overrideInfo = {
    grade : null
  };

  $scope.trapTabKey = function(el, e) {
    Drupal.sAccessibility.trapTabKey(el, e);
  }

  $scope.toggleLoading = function(addOverlay){
    if(addOverlay){
      sToggleActiveLoader('grading-rubric-grading-panel', $('#grading-rubric-edit-grades-slider'));
    }
    else{
      sToggleActiveLoader('grading-rubric-grading-panel');
    }
  }

  // This is a utility function to check to see if it is even worth sending data to the server and triggering an angular grade save event
  $scope.hasInfoToSave = function(){
    if(!$scope.gradeInfoDirty){
      return false;
    }

    if($scope.gradeIsOverridden()){
      return true;
    }

    if($scope.overrideCleared){
      return true;
    }

    // Since grades are defaulted to empty strings, ensure that they have set something before saving (any of the grades is numeric)
    var hasValidGrade = false;
    $.each($scope.gradeInfo, function(i, gInfo){
      if($.isNumeric(gInfo.grade) || gInfo.comment != '' || (gInfo.grade == '' && angular.isUndefined(gInfo.initPlaceholder))){
        hasValidGrade = true;
        return false;
      }
    });
    return hasValidGrade;
  }

  $scope.$on('sEnrollmentChooserChange', function(event, newEnrollmentId, isDistrictMasteryGrading){
    if (isDistrictMasteryGrading) {
      return;
    }
    if($scope.enrollmentId == newEnrollmentId || $scope.rubric == null || $scope.isReactComponent){
      return;
    }
    if($scope.hasInfoToSave()){
      // Fire off a save request and hope for the best.  We are going to keep trucking and update the DOM anyway
      var gradingCategoryId = $scope.grading_category ? $scope.grading_category.id : undefined;
      gradingRubrics.saveRubricGradeInfo($scope.rubric.id, $scope.enrollmentId, $scope.itemId, $scope.gradeInfo, $scope.overrideInfo.grade, false, false, function(request, response){
        sAngular.rootScopeBroadcast('gradingRubricTotalGradeUpdateComplete', request, response);
      }, false, gradingCategoryId, $scope.isGradeItemCollectedOnly);
      $scope.rubricGradeUpdate($scope.rubric.id, $scope.enrollmentId, $scope.itemId, $scope.gradeInfo);
    }
    $scope.setRubricVars($scope.rubric.id, newEnrollmentId, $scope.itemId);
  })

  $scope.$on('gradingRubricGradesVars', function(event, data) {
    if ($scope.isReactComponent === true) {
      return;
    }
    var rubricId = data.rubric_id;
    var enrollmentId = data.enrollment_id;
    var itemId = data.item_id;
    var readOnly = !data.editable;
    var isComponent = data.isComponent;
    var submissionId = data.submissionId;
    var isGradeItemCollectedOnly = data.isGradeItemCollectedOnly;

    $scope.setRubricVars(rubricId, enrollmentId, itemId, readOnly, isComponent, submissionId, isGradeItemCollectedOnly);
  });

  $scope.$on('ReactInit', function(event, data){
    $scope.isReactComponent = true;
    $scope.rubric = data.rubric;
    $scope.gradeInfo = data.gradeInfo;
    $scope.overrideInfo = data.overrideInfo;
    $scope.saveHandler = data.saveHandler;
    $scope.cancelHandler = data.cancelHandler;
    $scope.gradeInfoDirty = false; // always clean on init
    $scope.readOnly = data.readOnly;
    $scope.changeState('opened');
  });

  $scope.setRubricVars = function(rubricId, enrollmentId, itemId, readOnly, isComponent, submissionId, isGradeItemCollectedOnly){
    if ($scope.isReactComponent === true) {
      return;
    }
    if($scope.loadInProgress){
      return;
    }
    $scope.loadInProgress = true;
    $scope.enrollmentId = enrollmentId;
    $scope.itemId = itemId;
    $scope.gradeInfo = {}; // Reset grade info for the launch
    if (angular.isDefined(readOnly)) {
      $scope.readOnly = readOnly;
    }
    if (angular.isDefined(isComponent)) {
      $scope.isComponent = isComponent;
    }
    if (angular.isDefined(submissionId)) {
      $scope.submissionId = submissionId;
    }
    if (angular.isDefined(isGradeItemCollectedOnly)) {
      $scope.isGradeItemCollectedOnly = isGradeItemCollectedOnly;
    }

    gradingRubrics.getRubricById(rubricId, function(rubric){
      $scope.rubric = angular.copy(rubric);
      $scope.requiredLoads.push('rubric');
    });
    gradingRubrics.loadRubricGradeInfo(rubricId, enrollmentId, itemId, isComponent, submissionId, function (body) {
      $scope.gradeInfo = body.gradeInfo;
      $scope.overrideInfo.grade = body.overrideGrade;
      $scope.overrideEditActive = true;
      $scope.toggleOverrideEdit();
      $scope.requiredLoads.push('gradeInfo');
    });

    $scope.toggleLoading(true);
    // Add the loader when this is opened
    $scope.changeState('opened');
  }

  $scope.canEditGrade = function(){
    return !$scope.readOnly;
  }


  // Bind click on document so if user clicks anywhere but bubble we can remove bubble
  $(document).click(function(e){
    var evTarget = $(e.target);
    var commentBubbleClick = evTarget.hasClass('inline-popup-wrapper') || evTarget.hasClass('active-comment-bubble') || evTarget.parents('.inline-popup-wrapper').length > 0;
    if($scope.activeCommentBubbleRowId == false || commentBubbleClick){
      return;
    }
    $scope.setActiveCommentBubble(false);
    if(!$scope.$$phase){
      $scope.$apply();
    }
  });

  $scope.setActiveCommentBubble = function(rowId, event){
    if ($scope.activeCommentBubbleRowId == rowId){
      return;
    }
    $scope.activeCommentBubbleRowId = rowId;
    if(typeof event != 'undefined'){
      event.stopPropagation();
      event.preventDefault();
    }
    if(rowId != false){
      var bubbleObj = $('#comment-area-' + rowId);
      var plObj = $('#rubric-grading-row-area-' + rowId);
      var plPos = plObj.position();
      var newTop = plPos.top + 38;
      var newLeft = plPos.left - 10;
      bubbleObj.offset({top : newTop});
    }
    return false;

  }
  $scope.$watch('gradeInfo', function(newVal, oldVal){
    if(angular.isArray(newVal)){ // Sometimes when this is initialized as an empty object, angular is turning it into an empty array - Make sure it is object
      $scope.gradeInfo = {};
    }
    if ($scope.isReactComponent === true) {
      // for react component, ensure that there is always an object for every rubric row in gradeInfo
      if (typeof($scope.gradeInfo) != 'object'){
        $scope.gradeInfo = {};
      }
      $.each($scope.rubric.rows, function(idx, obj){
        if (angular.isUndefined($scope.gradeInfo[obj.id])) {
          $scope.gradeInfo[obj.id] = {
            comment: '',
            grade: null,
          };
        }
      });
    }
    $scope.gradeInfoDirty = true;
  },true)

  $scope.$watch('overrideInfo.grade', function(newVal, oldVal){
    $scope.gradeInfoDirty = true;
  })

  // Watch for when both ajax loads are complete
  $scope.$watch('requiredLoads', function(newVal, oldVal){
    if ($scope.isReactComponent === true) {
      return;
    }
    if($.inArray('rubric', newVal) !== -1 && $.inArray('gradeInfo', newVal) !== -1){
      $scope.toggleLoading();
      $scope.loadInProgress = false;
      // Place default values in gradeInfo if no grades or incomplete grades
      if(!angular.isObject($scope.gradeInfo)){
        $scope.gradeInfo = {};
      }
      $.each($scope.rubric.rows, function(i, row){
        if(angular.isUndefined($scope.gradeInfo[row.id])){
          var objAttr = row.id.toString();
          // Make sure to always cast as string so JS does not thing this should be an array
          $scope.gradeInfo[objAttr] = {
            grade : '',
            comment : '',
            initPlaceholder : true // When we are deciding whether to save grades, we want to indicate that this grade was filled in by us and maybe shouldn't be saved to server
          }
        }
      });
      // we just possibly dirtied our dirty flag so set it back to false
      $scope.gradeInfoDirty = false;
      sAngular.rootScopeBroadcast('sEnrollmentChooserChangeValue', $scope.enrollmentId);
      $scope.requiredLoads = [];// Empty out required loads in anticipation of next load
      sGradesResizeInnerTable($('.rubric-grades-edit'));

    }
  }, true);

  $scope.$on('sEnrollmentChooserLoadComplete', function(event, isDistrictMasteryGrading){
    if (isDistrictMasteryGrading) {
      return;
    }
    if ($scope.isReactComponent === true) {
      return;
    }
    if($scope.enrollmentId != null){
      sAngular.rootScopeBroadcast('sEnrollmentChooserChangeValue', $scope.enrollmentId);
    }
  });

  $scope.toggleOverrideEdit = function(){
    if(!$scope.canEditGrade()){
      return;
    }

    if($scope.overrideEditActive == false){
      $scope.overrideEditActive = true;
      if(!$scope.gradeIsOverridden()){
        $scope.overrideInfo.grade = $scope.calculatedTotalPoints();
      }
    }
    else{
      $scope.overrideEditActive = false;
      $scope.manualOverride = true;
      if(!$scope.gradeIsOverridden()){
        $scope.overrideInfo.grade = null;
        $scope.manualOverride = false;
      }
    }
  }

  $scope.clearGradeOverride = function(){
    $scope.overrideInfo.grade = null;
    $scope.overrideCleared = true;
  }

  $scope.calculatedTotalPoints = function(){
    var gradesTotal = null;
    if($scope.rubric == null || $scope.gradeInfo == null){
      return;
    }
    $.each($scope.gradeInfo, function(i, info){
      if(info.grade != null && info.grade != ''){
        gradesTotal = gradesTotal == null ? 0 : gradesTotal;
        gradesTotal += sGradesRoundNumber(info.grade);
      }
    });
    gradesTotal = $.isNumeric(gradesTotal) ? sGradesRoundNumber(gradesTotal) : gradesTotal;

    return gradesTotal;
  }

  $scope.totalPoints = function(){
    // We do not want total points when rubric is null or when the grade item is collected only
    if($scope.rubric == null || $scope.isGradeItemCollectedOnly){
      return;
    }
    if($scope.gradeIsOverridden()){
      return $scope.overrideInfo.grade;
    }
    var gradesTotal = $scope.calculatedTotalPoints();
    if (gradesTotal === null){
      return 0;
    }
    return gradesTotal;
  };

  $scope.gradeOverrideError = function(){
    // Do not allow empty string or non-numeric value as an override
    if ($scope.overrideInfo.grade === '' || ($scope.overrideInfo.grade !== null && !$.isNumeric($scope.overrideInfo.grade))) {
      return true;
    }

    return false;
  }

  $scope.gradeIsOverridden = function(){
    if((!$scope.manualOverride && $scope.isComponent) || typeof $scope.overrideInfo.grade == 'undefined' || $scope.overrideInfo.grade == null || $scope.gradeOverrideError()){
      return false;
    }

    return $scope.calculatedTotalPoints() !== $scope.overrideInfo.grade;
  }

  $scope.changeState = function(newState){
    var oldState = $scope.state;
    if(oldState == 'slide-closed' && newState == 'slide-closed'){
      newState = 'opened';
    }
    $scope.state = newState;
    if ($scope.isReactComponent === true && $scope.state === 'closed') {
      $scope.cancelHandler();
      return;
    }
    sAngular.rootScopeBroadcast('sEnrollmentChooserClose');
  };

  $scope.getState = function(){
    return $scope.state;
  }

  $scope.getBubbleIconClass = function(rowId){
    if(angular.isUndefined($scope.gradeInfo[rowId])){
      return '';
    }
    var classStr = '';
    if($scope.gradeInfo[rowId].comment.length > 0){
      classStr += ' hasComment';
    }
    if($scope.activeCommentBubbleRowId == rowId){
      classStr += ' active';
    }
    return classStr;
  }

  $scope.rubricGradesBodyClass = function(){
    var classStr = $scope.state;
    if($scope.state == 'closed'){
      classStr += ' hidden';
    }
    if($scope.readOnly){
      classStr += ' view-only';
    }
    classStr += $scope.minimized ? ' minimized' : '';
    return classStr;
  }

  $scope.minimize = function(){
    $scope.minimized = !$scope.minimized;
  }

  $scope.isMinimized = function(){
    return $scope.minimized;
  }

  $scope.ratingSelect = function(rowId, points){
    // If this is a react component, check that gradeInfo has been defined
    if ($scope.isReactComponent && angular.isUndefined($scope.gradeInfo[rowId.toString()])) {
      $scope.gradeInfo[rowId.toString()] = {
        grade: null,
        comment: '',
      }
    }
    // Make sure to cast as string so JS does not think this is array
    $scope.gradeInfo[rowId.toString()].grade = $scope.gradeInfo[rowId.toString()].grade == points ? 0 : points;
  }

  $scope.rubricGradeFormSubmit = function(isSubmit){
    if ($scope.isReactComponent === true) {
      if(isSubmit && $scope.hasInfoToSave()){
        $scope.saveHandler($scope.gradeInfo, $scope.overrideInfo);
      } else {
        $scope.cancelHandler();
      }
      $scope.changeState('closed');
      return;
    }

    if(isSubmit){
      if($scope.loadInProgress){
        return;
      }
      if(!$scope.hasInfoToSave()){
        $scope.changeState('closed');
        return;
      }
      $scope.loadInProgress = true;
      $scope.toggleLoading(true);
      sAngular.rootScopeBroadcast('gradingRubricTotalGradeUpdateSubmit', {
        itemId : $scope.itemId,
        enrollmentId : $scope.enrollmentId,
        rubricId : $scope.rubric.id,
        gradeInfo : $scope.gradeInfo,
        isCollectedOnly : $scope.isGradeItemCollectedOnly
      });
      // get submission comment
      questionReviewObj = $('[rubric-id="' + $scope.rubricId + '"][enrollment-id="' + $scope.enrollmentId + '"][submission-id="' + $scope.submissionId + '"]').parents('.question-review').eq(0);
      comment = $('.question-comment-wrapper textarea', questionReviewObj).val()
      var gradingCategoryId = $scope.grading_category ? $scope.grading_category.id : undefined;
      gradingRubrics.saveRubricGradeInfo(
        $scope.rubric.id,
        $scope.enrollmentId,
        $scope.itemId,
        $scope.gradeInfo,
        $scope.overrideInfo.grade,
        $scope.isComponent,
        $scope.submissionId,
        function(request, response) {
          $scope.rubricGradeUpdate($scope.rubric.id, $scope.enrollmentId, $scope.itemId, $scope.gradeInfo, $scope.submissionId, $scope.isGradeItemCollectedOnly);
          $scope.toggleLoading();
          $scope.loadInProgress = false;
          $scope.overrideCleared = false;
          $scope.changeState('closed');
          sAngular.rootScopeBroadcast('gradingRubricTotalGradeUpdateComplete', request, response);
        },
        comment,
        gradingCategoryId,
        $scope.isGradeItemCollectedOnly
      );
    }
    else{
      $scope.changeState('closed');
    }
  }

  $scope.rubricGradeUpdate = function(rubricId, enrollmentId, itemId, gradeInfo, submissionId, isGradeItemCollectedOnly){
    if ($scope.isReactComponent === true) {
      return;
    }
    var newGrade = '';
    if (!isGradeItemCollectedOnly) {
      newGrade = $scope.totalPoints();
    }
    var eventData = {
      itemId : itemId,
      enrollmentId : enrollmentId,
      rubricId : rubricId,
      grade : newGrade,
      submissionId : submissionId,
      isDistrictMasteryGrading: false,
      isCollectedOnly: isGradeItemCollectedOnly
    };
    sAngular.rootScopeBroadcast('gradingRubricTotalGradeUpdate', eventData);
  }

}]);

function sGradesResizeInnerTable(context){
  $('.rubric-row', context).each(function(){
    var rowHeight = $(this).height();
    $('.rubric-row-rating table td .rating-item', $(this)).css('min-height', rowHeight - 1);
  })
}

function sGradesRoundNumber(val){
  if(!$.isNumeric(val)){
    return 0;
  }

  return (Math.round(parseFloat(val) * 100) / 100);
}

// trap the tab key inside the popup
sAngular.addDirective('sJsTab', function() {
  return function(scope, element, attrs) {
    element.bind('keydown', function(e){
      if(e.which === 9) {
        if(typeof scope[attrs.sJsTab] === 'function') {
          scope.$apply(function() {
            scope[attrs.sJsTab](element, e);
          });
        }
      }
    });
  };
});

// set the focus to the first tabable item when opened
sAngular.addDirective('sJsManageFocus', function(){
  return {
    restrict : 'C', // bind this behavior to the s-js-manage-focus class name
    link: function(scope, element, attrs) {
      scope.$watch('state', function(newState, oldState) {
        if(newState === 'opened' && oldState === 'closed') { // check specifically for opened and closed (to avoid resetting on slide-open and slide-closed)
          Drupal.sAccessibility.setInitialFocusPopup(element);
          Drupal.sAccessibility.revealToAT(element);
          Drupal.sAccessibility.hideFromAT($('#body'));
        } else if(newState === 'opened') {
          Drupal.sAccessibility.revealToAT(element);
          Drupal.sAccessibility.hideFromAT($('#body'));
        } else if(newState === 'closed') { // return focus to original item when the popup is closed
          Drupal.sAccessibility.returnFocus();
          Drupal.sAccessibility.hideFromAT(element);
          Drupal.sAccessibility.revealToAT($('#body'));
        }
      });
    }
  }
});
