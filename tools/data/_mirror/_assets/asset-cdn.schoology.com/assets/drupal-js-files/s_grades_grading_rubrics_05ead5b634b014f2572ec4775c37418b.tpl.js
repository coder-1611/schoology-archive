Drupal.theme.s_grades_grading_rubrics_launch_btn = function(realm, realm_id, itemNid, rubricId, isGradeItem, text, isResource, is_action_edit_link, isResourceMaterial, isReadOnly, wrapperClass, isDistrictMasteryEnabled, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled){
  if(angular.isUndefined(text) || text == null){
    text = '';
  }
  if(angular.isUndefined(isGradeItem) || isGradeItem == null){
    isGradeItem = false;
  }
  if(angular.isUndefined(isResource) || isResource == null){
	  isResource = false;
  }
  if(angular.isUndefined(isResourceMaterial) || isResourceMaterial == null){
    isResourceMaterial = false;
  }
  if(angular.isUndefined(isReadOnly) || isReadOnly == null){
    isReadOnly = false;
  }
  if(angular.isUndefined(wrapperClass) || wrapperClass == null){
    wrapperClass = false;
  }
  if(angular.isUndefined(isDistrictMasteryEnabled) || isDistrictMasteryEnabled == null){
    isDistrictMasteryEnabled = false;
  }
  if(angular.isUndefined(isDistrictMasteryCourseRubricsEnabled) || isDistrictMasteryCourseRubricsEnabled == null){
    isDistrictMasteryCourseRubricsEnabled = false;
  }
  if(angular.isUndefined(isUSMStandardsSelectorEnabled) || isUSMStandardsSelectorEnabled == null){
    isUSMStandardsSelectorEnabled = false;
  }

  var directiveAttrs = 'realm-id="' + realm_id + '"';
  directiveAttrs += ' realm="' + realm + '"';
  if(angular.isDefined(rubricId) && rubricId != null){
    directiveAttrs += ' rubric-id="' + rubricId + '"';
  }

  if(angular.isDefined(itemNid) && itemNid != null){
    directiveAttrs += ' item-nid="' + itemNid + '"';
  }

  directiveAttrs += ' is-grade-item="' + (isGradeItem == true ? 'true' : 'false') + '"';
  directiveAttrs += ' is-resource="' + (isResource == true ? 'true' : 'false') + '"';
  directiveAttrs += ' is-resource-material="' + (isResourceMaterial == true ? 'true' : 'false') + '"';
  directiveAttrs += ' is-read-only="' + (isReadOnly == true ? 'true' : 'false') + '"';
  directiveAttrs += ' wrapper-class="' + wrapperClass + '"';
  directiveAttrs += ' is-district-mastery-enabled="' + isDistrictMasteryEnabled + '"';
  directiveAttrs += ' is-district-mastery-course-rubrics-enabled="' + isDistrictMasteryCourseRubricsEnabled + '"';
  directiveAttrs += ' is-usm-standards-selector-enabled="' + isUSMStandardsSelectorEnabled + '"';

  var output = '';
  var action_edit_link_class = is_action_edit_link ? 'class="action-edit" ' : '';
  var title_class = !is_action_edit_link ? 'item-title ' : '';
  var clickable_class = (!is_action_edit_link && itemNid != 'e') ? 'clickable ' : '';
  var launch_a11y_attrs = (!is_action_edit_link && itemNid != 'e') ? 'role="button" tabindex="0" ' : '';
  output += '<div ng:controller="s_grading_rubric_form_launch"' + action_edit_link_class + '>';
  output += '<span id="grading-rubric-launch-btn" class="grading-rubric-launch-icon grading-rubric-launch ' + title_class + clickable_class + '" ' + launch_a11y_attrs + directiveAttrs + '>' + text + '</span>';
  output += '</div>';
  return output;
}

Drupal.theme.s_grades_grading_rubric_edit = function(isGradeItem, isResource, isReadOnly, isDistrictMasteryEnabled, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled){
  var output = '';
  output += '<div class="s-slider s-grading-rubric-edit-slider s-grading-rubric" id="grading-rubric-edit-slider" ng:controller="s_grading_rubric_edit" ng:class="rubricBodyClass()" ng:init="isGradeItem=' + isGradeItem + '; isResource=' + isResource + '">';
    output += '<div class="controls">';
      output += '<span class="control-btn close-btn" role="button" tabindex="0" aria-label="' + Drupal.t('Close') + '" ng:click="changeState(\'closed\')"></span>';
      output += '<span class="control-btn slide-btn" role="button" tabindex="0" aria-label="' + Drupal.t('Minimize') + '" ng:click="changeState(\'slide-closed\')"></span>';
    output += '</div>';
    output += '<div class="left-column">';
      // Treat the one we are editing differently than the ones we have saved
      output += '<div class="rubric-item-custom" ng:class="{active : activeRubricId==\'e\'}" role="button" tabindex="0" ng:click="rubricItemClick($event, \'e\')">'
        output += '<span class="title"><span></span>{{defaultTitle}}</span>';
      output += '</div>';
      output += '<div class="rubric-list-header">';
        var actionLinks = [
          '<li ng:class="{active : rubricSort==sortOpt.field}" ng-repeat="sortOpt in rubricSortOptions" role="menuitem" tabindex="-1" ng-click="setRubricSort(sortOpt)">{{sortOpt.title}}</li>'
        ];
        output += Drupal.theme.sActionLinks(actionLinks, {size : 'junior', wrapperClass : 'rubric-sort-opts'});
        output += '<span>' + Drupal.t('Edit Rubrics') + '</span>';
      output += '</div>';
      output += '<ul class="rubric-list">';
        // The ones we have saved live in a different object
        output += '<li class="rubric-item" ng:class="getSaveRubricClass(savedRubric.id)" ng:repeat="savedRubric in savedRubricsList | orderBy:rubricSort" role="button" tabindex="0" ng:click="rubricItemClick($event, savedRubric.id)">';
          output += '<span class="title"><span></span>{{savedRubric.title}}</span>';
          output += '<div class="meta">';
            output += '<span class="num-assignments s-infotip" text="savedRubric.num_assigned_infotip" enabled="true" gravity="\'s\'"><span></span>{{savedRubric.num_assigned_gi}}</span> &middot; <span class="total-points">{{savedRubric.total_points}}' + Drupal.t('pts') + '</span>';
          output += '</div>';
        output += '</li>';
      output += '</ul>';
    output += '</div>';
    output += '<div class="right-column">';
      output += '<div ng-if="isEditable()" class="error messages no-bg" ng:show="rubrics[activeRubricId].num_assigned_gi > 0">' + Drupal.t('Note : Rubric is used by other assignments. Any changes here will be updated across all.') + '</div>';
      output += '<div ng-if="isEditable()" class="error messages no-bg" ng:show="rubrics[activeRubricId].num_printed_gi > 0">' + Drupal.t('Note : This test has been printed. If you edit the test or associated rubrics it will invalidate the previously printed tests.') +'</div>';
      output += '<div class="error messages no-bg" ng:show="hasTitleError || hasNumericPointsError()">{{errorMessage}}</div>';
      output += '<div class="error messages no-bg" ng:show="hasCriteriaError">{{criteriaErrorMessage}}</div>';
      output += '<div class="error messages no-bg" ng:show="hasInvalidObjectiveAlignmentAttempt">' + Drupal.settings.filtered_objective_warning + '</div>';
      output += '<div ng-if="isEditable()" class="save-for-reuse">';
        output += '<input ng-disabled="!isEditable()" type="text" ng:class="{error : hasTitleError}" class="s-prefill" prefill-text="' + Drupal.t('Rubric Title') + '" id="rubric-title-input" type="text" ng:model="rubrics[activeRubricId].title"/>';
                if(undefined == Drupal.settings.point_based_grading_scale_options) {
                  Drupal.settings.point_based_grading_scale_options = '';
                }
        output += '<span ng-if="isEditable()" >' + Drupal.settings.point_based_grading_scale_options + '</span>' || "";
        output += '<span class="form-required rubric-title-required">*</span>';
      output += '</div>';
      output += '<div class="rubric-scroll s-scroll" s-scroll><table class="rubric-table">';
        output += '<thead>';
          output += '<tr class="header-row">';
            output += '<th ng:hide="!isEditable()" class="sort-header " data-noresize></th>';
            output += '<th scope="col" class="criteria-header header ">';
              output += '<span>' + Drupal.t('Criteria') + '</span>';
            output += '</th>';
            output += '<th scope="col" class="ratings-header header "><span>' + Drupal.t('Grading Scale') + '</span></th>';
            var pts_header_copy = (isReadOnly ? Drupal.t('Points') : Drupal.t('Pts'));
            output += '<th scope="col" class="points-header header " data-noresize><abbr title="' + Drupal.t('Points') + '">' + pts_header_copy + '</abbr></th>';
          output += '</tr>';
        output += '</thead>';
        output += '<tbody>';
        output += '</tbody>';
        output += '<tbody ui-sortable="{handle : \'.sort-handle\'}" ng:model="rubrics[activeRubricId].rows">';
          output += '<tr class="rubric-row" ng:repeat="(i, row) in rubrics[activeRubricId].rows">';
            output += '<td ng:hide="!isEditable()" class="sort-handle "><span></span></td>';
            output += '<td  class="rubric-row-title ">';
              output += '<div class="rubric-row-relative">';
                output += '<input ng-if="isEditable() && !row.is_published && !row.is_mastery_objective_aligned" class="s-prefill input-top" type="text" prefill-text="' + Drupal.t('Add Title') + '" ng:model="row.title" ng:class="{error : errorCriteriaRows[i]}" ui-event="{ blur : \'fillSelectedBox()\' }"/>';
                output += '<span ng-if="!isEditable() || row.is_published || row.is_mastery_objective_aligned" class="input-top">{{row.title}}</span>';
                output += '<div class="rating-item-overflow-y">';
                  output += '<textarea ng-if="isEditable() && !row.is_published && !row.is_mastery_objective_aligned" prefill-text="' + Drupal.t('Add Description') + '" class="s-prefill input-bottom text-autogrow" ng:model="row.description"></textarea>';
                  output += '<p ng-if="!isEditable() || row.is_published || row.is_mastery_objective_aligned" class="input-bottom">{{row.description}}</p>';
                output += '</div>';
              output += '</div>';
            output += '</td>';
            output += '<td class="rubric-row-rating"><table class="rating-table"><tbody><tr>';
              output += '<td class="rating-wrapper" ng:repeat="(j, column) in row.columns">';
                output += '<div class="rating-item">';
                  output += '<span ng-if="isEditable() && !row.is_mastery_objective_aligned" class="s-infotip" selector="\'.add-column-btn\'" gravity="\'s\'" text="\'' + Drupal.t('Add Grading Scale Cell') + '\'">';
                    output += '<span class="add-column-btn left" role="button" tabindex="0" aria-label="' + Drupal.t('Add Grading Scale Cell') + '" ng:click="$parent.addColumn($parent.i, $parent.j, -1)"></span>';
                  output += '</span>';
                  output += '<input ng-if="isEditable() && !row.is_mastery_objective_aligned" class="input-top" type="text" ui-event="{ blur : \'sortColumns(i)\' }" ng:model="column.pts" ng:change="rowPointsChange(i)" ng:class="{error : cellHasError(i, j)}"/>';
                  output += '<span ng-if="!isEditable() || row.is_mastery_objective_aligned" class="input-top">{{column.pts}}</span>';
                  output += '<span ng-if="isEditable() && !row.is_mastery_objective_aligned" class="s-infotip" selector="\'.add-column-btn\'" gravity="\'se\'" text="\'' + Drupal.t('Add Grading Scale Cell') + '\'">';
                    output += '<span class="add-column-btn right" role="button" tabindex="0" aria-label="' + Drupal.t('Add Grading Scale Cell') + '" ng:click="$parent.addColumn($parent.i, $parent.j, -1)"></span>';
                  output += "</span >";
                  output += '<span ng-if="isEditable() && !row.is_mastery_objective_aligned" class="delete-btn" role="button" tabindex="0" aria-label="' + Drupal.t('Delete column') + '" ng:click="removeColumn(i,j)"></span>';
                  output += '<div class="rating-item-overflow-y">';
                    output += '<textarea ng-if="isEditable() && !row.is_mastery_objective_aligned" class="input-bottom text-autogrow" ng:model="column.description"></textarea>';
                    output += '<p ng-if="!isEditable() || row.is_mastery_objective_aligned" class="input-bottom">{{column.description}}</p>';
                  output += '</div>';
                output += '</div>';
              output += '</td>';
            output += '</tr></tbody></table></td>';
            output += '<td class="rubric-row-pts ">';
              output += '<span>{{row.max_points}}</span>';
              let toolTipGravity = document.dir == 'rtl' ? 'w' : 'e';
              output += '<span ng-if="isEditable()" class="s-infotip" gravity="\'' + toolTipGravity + '\'" text="\'' + Drupal.t('Delete Criteria Row') + '\'">';
                output += '<span class="delete-btn" role="button" tabindex="0" aria-label="' + Drupal.t('Delete row') + '" ng:click="$parent.removeRow($parent.i)"></span>';
              output += '</span>';
            output += '</td>';
          output += '</tr>';
        output += '</tbody>';
      output += '</table></div>';
    output += '</div>';
    output += '<div class="bottom-ctrls-wrapper">';
      output += '<span class="total-pts">' + Drupal.t('TOTAL POINTS') + ': {{rubrics[activeRubricId].total_points}}</span>';
      output += '<span ng-if="isEditable()">';
        output += '<div class="rubric-editor-add-criteria" role="button" tabindex="0" ng:click="addRowClick()">';
          output += '<span class="add-criteria-text">' + Drupal.t('Criteria') + '</span>';
        output += '</div>';
      output += '</span>';
      if (!isDistrictMasteryEnabled) {
        output += '<span ng-if="isEditable()" ng:class="{hidden: alignmentHidden(' + isUSMStandardsSelectorEnabled + ')}">';
          output += '<div class="rubric-editor-add-objectives" role="button" tabindex="0" ng:click="addAlignmentRowClick(false, ' + isUSMStandardsSelectorEnabled + ')" >';
            output += '<span class="add-criteria-text">' + Drupal.t('Learning Objectives') + '</span>';
          output += '</div>';
        output += '</span>';
      } else if (isDistrictMasteryCourseRubricsEnabled) {
        output += '<span ng-if="isEditable()" ng:class="{hidden: alignmentHidden(false)}">';
          output += '<div class="rubric-editor-add-objectives" role="button" tabindex="0" ng:click="addAlignmentRowClick(true, false)">';
            output += '<span class="add-criteria-text">' + Drupal.t('Learning Objectives') + '</span>';
          output += '</div>';
        output += '</span>';
      }
    output += '</div>';
    output += '<div ng-if="isEditable()" class="large-submit-buttons">';
    if (isDistrictMasteryEnabled && isDistrictMasteryCourseRubricsEnabled) {
      output += '<input type="hidden" name="district-mastery-rubric-enabled" value="1">';
      output += '<input type="hidden" name="district-mastery-aligned-objectives">';
      output += '<input type="hidden" name="district-mastery-aligned-objectives-existing">';
    }
      output += '<span ng-if="isEditable()" ng:click="rubricFormSubmit(false)" class="btn cancel" role="button" tabindex="0">' + Drupal.t('Cancel') + '</span>';
      output += '<button ng-if="isEditable()" ng:disabled="saving || !isEditable()" ng:click="rubricFormSubmit(true,' + isUSMStandardsSelectorEnabled + ')" class="btn submit" ng-class="{\'disabled\': !isEditable()}">{{submitButtonText()}}</button>';
    output += '</div>';
  output += '</div>';
  if (isReadOnly){
    output = '<div class="readonly">' + output + "</div>";
  }
  return output;
};

/**
 * @param {boolean} isReadOnly
 * @param {boolean} isDistrictMasteryEnabled
 * @param {boolean} isPrintingRubricsEnabledForUser
 * @param {boolean} isDistrictMasteryCourseRubricsEnabled
 * @param {boolean} isUSMStandardsSelectorEnabled
 * @returns {string}
 */
Drupal.theme.s_grades_grading_rubrics_block = function(isReadOnly, isDistrictMasteryEnabled, isPrintingRubricsEnabledForUser, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled) {
  var output = '<div ng:controller="s_grades_grading_rubrics_block">';
    output += '<ul id="rubrics-block-right-list">';
      output += '<li ng-repeat="rubricItem in rubrics">';
        var editLink = '<li class="rubric-edit action-edit">' + Drupal.theme.s_grades_grading_rubrics_launch_btn('{{realm}}', '{{realmId}}', null, '{{rubricItem.id}}', false, Drupal.t('Edit'), null, null,null, null, null, isDistrictMasteryEnabled, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled) + '</li>';
        var copyToCourseLink = '<li class="rubric-edit action-copy"><a role="menuitem" tabindex="-1" class="copy-rubric" href="/grading_scale/rubric/{{rubricItem.id}}/copy">' + Drupal.t('Copy To Course') + '</a></li>';
        var deleteLink = '<li class="rubric-delete action-delete">';
        // Can delete the rubric
        deleteLink += '<div ng-if="rubricItem.num_assigned_gi == 0" role="menuitem" tabindex="-1" class="s-popup popups-small" client-popup="1" client-popup-handler="sCommonAngularDeletePopup" client-popup-text="' + Drupal.t('Are you sure you want to delete this rubric?') + '" client-popup-arg="{{rubricItem.id}}" client-popup-submit="gradingRubricDelete"> <span>' +  Drupal.t('Delete') + '</span></div>';
        // Cannot delete the rubric
        var tipsyGravity = document.dir === 'rtl' ? 'nw' : 'ne';
        deleteLink += '<span class="s-infotip" enabled="1" gravity="\'' + tipsyGravity + '\'" text="\'' + Drupal.t('This rubric is in use') + '\'" ng-if="rubricItem.num_assigned_gi > 0">' + Drupal.t('Delete') + '</span>';
        deleteLink += '</li>';
        var saveToResourcesLink = '<li class="rubric-save action-library-save">' + Drupal.l(Drupal.t('Save to Resources'), '/grade_setup/{{realm}}/{{realmId}}/rubric/{{rubricItem.id}}/save', { "attributes": { "class" : "save-rubric", "role": "menuitem", "tabindex": "-1" }}) + '</li>';
        var actionLinks = [
          editLink,
          copyToCourseLink,
          deleteLink,
          saveToResourcesLink
        ];
        // TODO: PE-58978 remove FF check
        if (isPrintingRubricsEnabledForUser) {
          var printRubricLink = '<li class="action-print">' + Drupal.l(Utils.i18n.t('gradebook.print_rubric'), '/grading-scales/{{rubricItem.id}}/print-page', { attributes: { target: '_blank', role: 'menuitem', tabindex: '-1' } }) + '</li>';
          actionLinks.push(printRubricLink);
        }
      	output += Drupal.theme.sActionLinks(actionLinks, {size : 'junior', wrapperClass : 'aligned-right'});
        output += '<div class="rubric-info">';
          output += '<span class="title">' + Drupal.theme.s_grades_grading_rubrics_launch_btn('{{realm}}', '{{realmId}}', null, '{{rubricItem.id}}', false, '{{rubricItem.title}}', null, null, null, isReadOnly, null, isDistrictMasteryEnabled, isDistrictMasteryCourseRubricsEnabled, isUSMStandardsSelectorEnabled
          ) + '</span>';
          output += '<div class="meta">';
            output += '<span class="num-assignments s-infotip" text="rubricItem.num_assigned_infotip" enabled="true" gravity="\'s\'"><span></span>{{rubricItem.num_assigned_gi}}</span> &middot; <span class="total-points">{{rubricItem.total_points}}' + Drupal.t('pts') + '</span>';
          output += '</div>';
        output += '</div>';
      output += '</li>';
    output += '</div>';
  output += '</div>';
  return output;
}

/*
 * Directive to compile and launch the s_grades_rubric_grading
 */
Drupal.theme.s_grades_rubric_grading_launch_btn = function(
  rubric_id,
  enrollment_id,
  item_id,
  dispGrade,
  editable,
  isComponent,
  submissionId,
  totalRubricPoints,
  textOnly,
  isGradeItemCollectedOnly
){
  if (rubric_id === 'reactRubricScoreInput') {
    return '<span class="grading-rubric-grading-launch" is-react-component="true"></span>';
  }

  if(angular.isUndefined(isComponent) || isComponent == null){
    isComponent = false;
  }
  if(angular.isUndefined(submissionId) || submissionId == null){
    submissionId = false;
  }
  var attrs = 'rubric-id="' + rubric_id
    + '" enrollment-id="' + enrollment_id
    + '" item-id="' + item_id
    + '" editable="' + editable
    + '" is-component="' + isComponent
    + '" submission-id="' + submissionId
    + '" total-rubric-points="' + totalRubricPoints
    + '" text-only="' + textOnly + '"'
    + '" is-grade-item-collected-only="' + !!isGradeItemCollectedOnly + '"';
  var output = '';
  if (isComponent) {
    output += '<div id="question-points-total-' + item_id + '" class="question-points-total"></div>';
  }
  output += '<span tabindex="0" role="button" class="grading-rubric-launch-icon grading-rubric-grading-launch" ' + attrs + ' aria-label="Click to launch rubrics popup">'
   output += '<img src="/sites/all/themes/schoology_theme/images/icons_sprite_new.png" class="grading-rubric-image" alt="Rubric icon. Opens a dialog.">';
  if(!isGradeItemCollectedOnly) {
   output += '<div class="rubric-fake-grade-disp">' + dispGrade + '</div>';
  }
   output += '<span class="visually-hidden">' + Drupal.t('Click to launch rubrics popup.') + '</span>';
  output += '</span>';
  if (isComponent) {
    output += '<span id="rubric-total-points-' + item_id + '" class="rubric-total-points" value="' + totalRubricPoints + '"> /' + totalRubricPoints + '</span>';
  }
  return output;
}

Drupal.theme.s_grades_rubric_grading = function(){
  var output = '';
  output += '<div s-js-tab="trapTabKey" class="s-slider s-js-manage-focus rubric-grades-edit" ng:class="rubricGradesBodyClass()" ng:controller="grading_rubric_edit_grades" id="grading-rubric-edit-grades-slider" role="dialog" aria-label="' + Drupal.t('Rubrics Grade Dialog') + '" aria-describedby="grading-rubric-info">';
    output += '<div role="document">';
      output += '<div id="grading-rubric-info" class="visually-hidden" aria-hidden="true">';
        output += '<p>' + Drupal.t('This dialog details the grading criteria for the associated assignment and displays the points awarded for each grading criteria.') + '</p>'
      output += '</div>';
      output += '<div class="controls">';
        output += '<span role="button" tabindex="0" class="control-btn close-btn" ng:click="changeState(\'closed\')">' + '<span class="visually-hidden">' + Drupal.t('Close') + '</span>' + '</span>';
        output += '<span role="button" tabindex="0" class="slide-btn" ng:click="changeState(\'slide-closed\')">';
          output += '<span ng-if="getState() == \'opened\'" class="visually-hidden">' + Drupal.t('Slide Close') + '</span>';
          output += '<span ng-if="getState() == \'slide-closed\'" class="visually-hidden">' + Drupal.t('Slide Open') + '</span>';
        output += '</span>';
        output += '<span role="button" tabindex="0" class="minimize-btn" ng:click="minimize()">';
          output += '<span ng-if="!isMinimized()" class="visually-hidden">' + Drupal.t('Minimize') + '</span>';
          output += '<span ng-if="isMinimized()" class="visually-hidden">' + Drupal.t('Maximize') + '</span>';
        output += '</span>';
      output += '</div>';


      output += '<div ng-if="canEditGrade()" class="rubric-comment-bubble-holder editable">';
        output += '<div ng:repeat="rubricRow in rubric.rows" id="comment-area-{{rubricRow.id}}" ng:show="activeCommentBubbleRowId == rubricRow.id" class="inline-popup-wrapper"><span class="arrow-top"></span>';
          output += '<textarea prefill-text="' + Drupal.t('Add Comment') + '" maxlength="4096" class="s-prefill" ng:model="gradeInfo[rubricRow.id].comment"></textarea>';
        output += '</div>';
      output += '</div>';
      if (angular.isDefined(Drupal.theme.s_common_enrollment_chooser) && angular.isDefined(Drupal.settings.s_realm_info)) {
        output += '<div ng-if="canEditGrade() && !isComponent" class="top" >';
          output += Drupal.theme.s_common_enrollment_chooser('course', Drupal.settings.s_realm_info.realm_id);
        output += '</div>';
      }

      output += '<div class="right-column">';
        output += '<div class="rubric-grades-edit-top">';
        output += '</div>';
        output += '<table class="rubric-table rubric-grading-table" >';
          output += '<thead>';
            output += '<tr class="header-row">';
              output += '<th scope="col" class="criteria-header header">' + Drupal.t('Criteria') + '</th>';
              output += '<th scope="col" class="ratings-header header">' + Drupal.t('Rating') + '</th>';
              output += '<th scope="col" class="points-header header"><abbr title="' + Drupal.t('Points') + '">' + Drupal.t('Pts') + '</abbr></th>';
            output += '</tr>';
          output += '</thead>';
          output += '<tbody>';
            output += '<tr class="rubric-row" ng:repeat="rubricRow in rubric.rows">';
              // CRITERIA CELL
              output += '<th scope="row" class="rubric-row-title">';
                output += '<span class="input-top">{{rubricRow.title}}</span>';
                output += '<p class="input-bottom">{{rubricRow.description}}</p>';
              output += '</th>';
              // RATINGS CELL
              output += '<td class="rubric-row-rating">';
                output += '<table class="rating-table" role="presentation">';
                  output += '<tbody>';
                    output += '<tr>';
                      output += '<td class="rating-wrapper" ng:repeat="rubricColumn in rubricRow.columns" ng:class="{ selected: rubricColumn.pts == gradeInfo[rubricRow.id].grade && (gradeInfo[rubricRow.id].grade.trim() != \'\')}" ng:click="!canEditGrade() || ratingSelect(rubricRow.id, rubricColumn.pts)">';
                      output += '<div ng-if="rubricColumn.pts == gradeInfo[rubricRow.id].grade">';
                          output += '<span class="visually-hidden">' + Drupal.t('This item is selected.') + '</span>';
                        output += '</div>';
                        output += '<div class="rating-item">';
                          output += '<span class="input-top">{{rubricColumn.pts}}</span>';
                          output += '<p class="input-bottom">{{rubricColumn.description}}</p>';
                        output += '</div>';
                      output += '</td>';
                    output += '</tr>';
                  output += '</tbody>';
                output += '</table>';
              output += '</td>';
              // PTS CELL
              output += '<td class="rubric-row-pts">';
                output += '<div class="rubric-row-pts-wrapper" id="rubric-grading-row-area-{{rubricRow.id}}">';
                    //edit grade
                    output += '<input ng-if="canEditGrade()" class="criteria-grade editable" type="text" ng:model="gradeInfo[rubricRow.id].grade"/>';
                    output += '<span ng-if="canEditGrade()" class="active-comment-bubble editable" ng:click="setActiveCommentBubble(rubricRow.id, $event)" ng:class="getBubbleIconClass(rubricRow.id)"></span>';
                    //can not edit grades
                    output += '<div ng-if="!canEditGrade()" ng:class="getBubbleIconClass(rubricRow.id)">';
                      output += '<span class="criteria-grade s-infotip" text="gradeInfo[rubricRow.id].comment" enabled="true" gravity="\'ne\'">{{gradeInfo[rubricRow.id].grade}}</span>';
                    output += '</div>';
                    output += '<p ng-if="!canEditGrade() && gradeInfo[rubricRow.id].comment.length > 0" class="visually-hidden">';
                      output += '<span>' + Drupal.t('Comments: ') + '{{gradeInfo[rubricRow.id].comment}}</span>';
                    output += '</p>';
                output += '</div>';
              output += '</td>';
            output += '</tr>';
          output += '</tbody>';
        output += '</table>';
      output += '</div>';
      output += '<div class="bottom">';
        if (angular.isDefined(Drupal.settings.s_realm_info)) {
          output += '<a ng-if="canEditGrade()" class = "editable" href="/course/' + Drupal.settings.s_realm_info.realm_id + '/gradesetup' + '" target="_blank">' + Drupal.t('Manage Rubrics') + '</a>';
        }
        output += '<p ng-if="!isGradeItemCollectedOnly" class="total-points" ng:class="{\'grade-overridden\' : gradeIsOverridden()}">';
          output += '<span class="total-points-text"><abbr title="' + Drupal.t("Total Points") + '">' + Drupal.t('Total pts: ') + '</abbr></span>';
          output += '<bdi><span class="assigned-grades-total" ng:click="toggleOverrideEdit()" ng:show="!overrideEditActive || readOnly">';
            output += '<span>{{totalPoints()}}</span>';
          output += '</span>';
          output += '<span ng-if="canEditGrade()" ng:show="overrideEditActive" class="override-score">';
            output += '<input type="text" id="rubric-score-override" hidden-input hidden-input-sync="overrideEditActive" hidden-input-update="toggleOverrideEdit()" type="text" ng:model="overrideInfo.grade"/>';
          output += '</span>';
          output += '/{{rubric.total_points}}';
          output += '</bdi>';
        output += '</p>';
        output += '<span ng-if="canEditGrade()" class="override-lock" ng:show="gradeIsOverridden()" ng:click="clearGradeOverride()">' + Drupal.t('clear override') + '</span>';
        output += '<span ng-if="canEditGrade()" class="override-lock override-lock-error-message" ng:show="gradeOverrideError()">' + Drupal.t('To override the rubric score you must enter a number') + '</span>';
      output += '</div>';
      output += '<div ng-if="canEditGrade()" class="submit-buttons editable">';
        output += '<button ng:click="rubricGradeFormSubmit(true)" class="submit-btn">' + Drupal.t('Save') + '</button>';
        output += '<span ng:click="rubricGradeFormSubmit(false)" class="cancel-btn">' + Drupal.t('Cancel') + '</span>';
      output += '</div>';
    output += '</div>';
  output += '</div>';
  return output;
}
