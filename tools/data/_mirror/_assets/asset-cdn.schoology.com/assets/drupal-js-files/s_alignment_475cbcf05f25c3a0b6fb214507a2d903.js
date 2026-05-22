var loading = false;
var alignmentContainerState = 'closed';

// see MasteryLibraryBll::getAllMasteryLibrariesForUser
const CLASSIC_MASTERY_LIBRARY_KEY = 'legacy';

Drupal.behaviors.sAlignment = function (context) {
  var alignmentContainer = $('.alignment-form-container');
  var masteryLibrarySelectorContainer = $('.alignment-mastery-library-selector');

  /*
   * This is used to process the district mastery LO container when the dialog is loaded. This code is called multiple
   * times so we are attempting to make sure this code isn't called multiple times by adding a processed class
   * @see `DistrictMasteryController::ALIGNMENT_INPUT_NAME`
   */
  $('input[name="district-mastery-aligned-objectives"]:not(.sMasteryProcessed)', context).addClass('sMasteryProcessed').each(function() {
    const hasClassicAlignments = getAddedClassicMasteryIds().length;
    const hasDistrictMasteryAlignments = getAddedDistrictMasteryItems().length;
    const hasRubricAlignments = $('.tag-item-from-rubric').length > 0;

    // the hasClassicAlignments check is needed when display_type === MASTERY_LIST_VIEW_BOTH
    // the hasRubricAlignments check tells us if we are using a rubric (possibly with aligned objectives)
    // see DistrictMasteryBll::determineAlignmentsToDisplay
    // we prevent this logic block from executing when material has classic objectives or rubrics alignments
    // otherwise they do not render when in edit view
    if (!hasClassicAlignments && !hasRubricAlignments && hasDistrictMasteryAlignments) {
      const districtMasteryInput = $(this);
      const districtMasteryContainer = $('.alignment-item-container', context);
      const gradingScaleAndRubricOptionsWrapper = $('.grading-scale-select-grouping', context);
      const districtMasteryScaleList = $('#edit-district-mastery-grading-scale-id-wrapper', context);

      sAlignmentRenderDistrictMasteryObjectives(districtMasteryInput, districtMasteryContainer);

      if (gradingScaleAndRubricOptionsWrapper.length) {
        sAlignmentToggleRubricListVisibility(districtMasteryInput, gradingScaleAndRubricOptionsWrapper, districtMasteryScaleList);
      }
    }
  });

  $('input[name="district-mastery-aligned-objectives"]', context).each(function() {
      const districtMasteryInput = $(this);
      const districtMasteryContainer = $('.alignment-item-container', context);
      const gradingScaleAndRubricOptionsWrapper = $('.grading-scale-select-grouping', context);
      const districtMasteryScaleList = $('#edit-district-mastery-grading-scale-id-wrapper', context);

      // return alignments from alignments1 that are not found in alignments2
      const findMissingAlignments = function(alignments1, alignments2) {
        return alignments1.filter(a => {
          return !alignments2.find(e => a.id === e.id);
        });
      }

      const mapAlignmentToMasteryModel = function(a) {
        //used for other types of alignments as well
        a.guid = a.id ? a.id : '';
        //only used here for Mastery Objective alignments
        a.mastery_objective_id = a.id ? a.id : '';
        return a;
      }

      //should be set to 1 if enabled
      const districtMasteryMode = $('input[name="district-mastery-rubric-enabled"]', context).val();
      let existingAlignments = getAddedDistrictMasteryItems();
      districtMasteryInput.on('change', function (e) {
        e.preventDefault();

        if (districtMasteryMode) {
          let updatedAlignments = getAddedDistrictMasteryItems();
          let addedAlignments = findMissingAlignments(updatedAlignments, existingAlignments);
          let removedAlignments = findMissingAlignments(existingAlignments, updatedAlignments);
          existingAlignments = updatedAlignments;
          addedAlignments.forEach(a => {
            sAngular.rootScopeBroadcast('sAlignmentAdd', mapAlignmentToMasteryModel(a));
          });
          removedAlignments.forEach(a => {
            const mastery_objective_obj = mapAlignmentToMasteryModel(a);
            $.each(Drupal.settings.s_alignment.attached_tags, (idx, obj) => {
              if (obj.guid == mastery_objective_obj.guid) {
                delete Drupal.settings.s_alignment.attached_tags[idx];
              }
            });
            sAngular.rootScopeBroadcast('sAlignmentRemove', mastery_objective_obj);
          });
        } else {
          sAlignmentRenderDistrictMasteryObjectives(districtMasteryInput, districtMasteryContainer);
          if (gradingScaleAndRubricOptionsWrapper.length) {
            sAlignmentToggleRubricListVisibility(districtMasteryInput, gradingScaleAndRubricOptionsWrapper, districtMasteryScaleList);
          }
        }
      });
  });

  $('.alignment-form-container:not(.sAlignmentProccessed)', context).addClass('sAlignmentProccessed').each(function () {
    var container = $(this);
    sAlignmentLoadGuids();

    $('.selected-btn', container).bind('click', function () {
      $('.selected-container', container).show();
      $('.alignment-breadcrumbs', container).hide();
      $('.browse-container', container).hide();
      $('.search-container', container).hide();
      $('.search-block input', container).val('');
      $(this).addClass('active').attr('aria-checked', 'true');
      $('.browse-btn', container).removeClass('active').attr('aria-checked', 'false');
      sPopupsResizeCenter();
    });

    $('.browse-btn', container).bind('click', function () {
      $('.browse-container', container).show();
      $('.alignment-breadcrumbs', container).show();
      $('.selected-container', container).hide();
      $('.search-container', container).hide();
      $('.search-block input', container).val('');
      $(this).addClass('active').attr('aria-checked', 'true');
      $('.selected-btn', container).removeClass('active').attr('aria-checked', 'false');
      sPopupsResizeCenter();
    });

    $('#edit-alignment-search-field', container).bind('keydown', function (e) {
      var code = (e.keyCode ? e.keyCode : e.which);
      if (code == 13) {
        var input = $(this);
        sAlignmentSearch(input.val(), input.parents('.alignment-form-container'));
        return false; //dont submit
      }
    });

    $('.mag-glass', container).bind('click', function (e) {
      e.preventDefault();
      var input = $(this);
      var searchQ = input.siblings('#edit-alignment-search-field').val();
      if (!searchQ) {
        return;
      }
      sAlignmentSearch(searchQ, input.parents('.alignment-form-container'));
      return false;
    });

    // see `DistrictMasteryController::ALIGNMENT_INPUT_NAME`
    var $districtMasteryAlignmentInput = $('input[name="district-mastery-aligned-objectives"]', context);

    // hook for moving the alignment form back to the origin form.
    $(document).unbind('popups_before_close.s_alignment').bind('popups_before_close.s_alignment', function (e, popup) {
      $('.selected-container div.selected-item').remove();

      if ($('#alignments-wrapper-form').length) {
        // if there is an alignment-wrapper-form present, it is the singleton version of the alignment form, move the container back to that wrapper
        alignmentContainer.attr('id', '');
        $('#alignments-wrapper-form').append(alignmentContainer.hide());
      }

      // when a user clicks 'x' on a popup - move the mastery library container back to the template form
      if (masteryLibrarySelectorContainer.length) {
        masteryLibrarySelectorContainer.attr('id', '');
        $('#s-library-collection-template-form').append(masteryLibrarySelectorContainer).hide();
      }

      var containerId = container.attr('id');
      if (containerId) {
        var formId = containerId.split('_')[1];
        $('#' + formId).append(container.hide());
      }
      alignmentContainerState = 'closed';

      // remove change listener on district mastery input when this window is closed
      // (ignore other popup windows)
      var $popup = popup && popup.$popup();
      if (
        $popup &&
        $popup.length > 0 &&
        $districtMasteryAlignmentInput.length > 0 &&
        $.contains($popup.get(0), $districtMasteryAlignmentInput.get(0))
      ) {
        $districtMasteryAlignmentInput.off();
      }
    });
  });

  $('.alignment-btn:not(.sAlignmentProccessed):not(.sDistrictMastery)', context).addClass('sAlignmentProccessed').each(function () {

    var form = $(this).parents('form').eq(0);
    if (typeof Drupal.settings.s_alignment == 'undefined') {
      Drupal.settings.s_alignment = {};
    }
    Drupal.settings.s_alignment.activeForm = form;

    $(this).bind('click', function (e, data) {
      if (typeof (data) == 'undefined' || data == null) {
        data = {};
      }

      if (alignmentContainerState == 'open' || $(this).hasClass('disabled') && !data.override) {
        return false;
      }
      sAlignmentUpdateSelectedCount(true);
      var form = sAlignmentGetActiveForm();
      if (!form) {
        form = $(this).parents('form').eq(0);
      }

      if (!alignmentContainer.length) {
        // check for an alignment-wrapper-form
        alignmentContainer = $('#alignments-wrapper-form .alignment-form-container');
      }

      const hasClassicAlignments = getAddedClassicMasteryIds().length;
      const hasDistrictAlignments = getAddedDistrictMasteryItems().length;

      let masteryMode;
      if (alignmentContainer.length) {
        if (Drupal.settings.s_alignment
          && Drupal.settings.s_alignment.hasOwnProperty('show_mastery_library_selector')
          && !hasClassicAlignments
          && !hasDistrictAlignments
        ) {
          masteryMode = 'mixed';
        } else if (hasDistrictAlignments) {
          masteryMode = 'district';
        } else {
          masteryMode = 'classic';
        }

        if (data.force_classic_mastery) {
          masteryMode = 'classic';
        } else if (data.force_district_mastery) {
          masteryMode = 'district';
        }
      }

      switch (masteryMode) {
        case 'mixed':
          renderMasteryLibrarySelectorPopup(form, masteryLibrarySelectorContainer);
          break;
        case 'district':
          window.renderSgyMasteryAlignmentUi(true);
          break;
        case 'classic':
          renderClassicMasteryUiPopup(form, alignmentContainer);
          break;
        default:
          //no op
      }
    });
  });
  $(document).trigger('sAlignmentAlignmentBtnProcessed');

  $('.selected-item:not(.sAlignmentProccessed)', context).addClass('sAlignmentProccessed').each(function () {
    $(this).bind('click', function () {
      sAlignmentRemoveItem($(this).attr('id').split('_').pop(), true);
    });
  });

  $('.alignment-inline-item:not(.sAlignmentProccessed)', context).addClass('sAlignmentProccessed').each(function () {
    $('.delete-btn', $(this)).bind('click', function () {
      var itemId = $(this).parent().attr('id').split('_').pop();
      sAlignmentRemoveItem(itemId);
    });
  });

  $('.search-result:not(.sAlignmentProccessed)', context).addClass('sAlignmentProccessed').each(function () {
    $(this).bind('click', function () {
      var srObj = $(this);
      var cbObj = $('input[type=checkbox].std-selector', srObj);
      var cbObjChecked = cbObj.is(":checked");
      cbObj.prop('checked', !cbObjChecked);

      if (cbObjChecked) {
        sAlignmentRemoveItem(srObj.attr('id').split('_').pop(), true);
      } else {
        sAlignmentAddItem(srObj);
      }
    });
  });

  $('.guid-container:not(.sAlignmentProccessed)', context).addClass('sAlignmentProccessed').each(function () {
    var wrapper = $(this);
    $('.guid-item', wrapper).bind('click keydown', function (e) {
      if (isSelectionEvent(e)) {
        var item = $(this);
        var cbObj = $('input[type=checkbox].std-selector', item);
        var cbObjChecked = cbObj.is(":checked");

        // we need to fetch from the api
        if (item.hasClass('has-children')) {
          sAlignmentLoadId(item, wrapper, alignmentContainer);
          return;
        }

        cbObj.prop('checked', !cbObjChecked);

        if (cbObjChecked)
          sAlignmentRemoveItem(item.attr('id').split('_').pop(), true);
        else
          sAlignmentAddItem(item);
      }
    });
  });

  $('.breadcrumb-item:not(.sAlignmentProccessed)', context).addClass('sAlignmentProccessed').each(function () {
    var itemObj = $(this);
    var containerObj = itemObj.parents('.alignment-form-container').eq(0);

    itemObj.bind('click keydown', function (e) {
      if (isSelectionEvent(e)) {
        if (!$(this).hasClass('enabled'))
          return;
        $('.guid-container', containerObj).hide();
        itemId = $(this).attr('id').split('_')[1];
        selectedItem = $('#container_' + itemId + '.guid-container', containerObj);
        //show the proper container
        selectedItem.show();
        //remove everything in the breadcrumb after the pressed button
        itemObj.nextAll('span').remove();
        // Update aria-current for accessibility - remove from all items and add to clicked item
        $('.breadcrumb-item', itemObj.parent()).removeAttr('aria-current');
        itemObj.attr('aria-current', 'true');
        $('.browse-btn', containerObj).trigger('click');
      }
    });
  });

  // if there are alignments selected by default, set the alignment button to active
  var idStore = sAlignmentGetActiveIdStore();
  var selectedAlignments = idStore.val();
  if (selectedAlignments && selectedAlignments.length) {
    $('#s-alignment-align-button.alignment-btn:not(.disabled)', context).addClass('active');
  }
}

function getAddedClassicMasteryIds() {
  var idStore = $('input[name="selected_ids"]');
  return idStore.val() && idStore.val().length ? idStore.val().split(',') : [];
}

function getAddedDistrictMasteryItems() {
  var districtMasteryInput = $('input[name="district-mastery-aligned-objectives"]');
  var alignedObjectives = [];
  try {
    alignedObjectives = JSON.parse(districtMasteryInput.val());
  } catch (err) {
  }
  return alignedObjectives;
}

function renderClassicMasteryUiPopup(form, alignmentContainer) {
  const popup = new Popups.Popup();
  popup.extraClass = 'popups-large add-alignment-popup';

  const popup_params = {
    popup: popup,
    options: {hideActive: false},
    buttons: {
      'close': {
        title: Drupal.t('Add Learning Objectives'),
        func: function (e) {
          var popup = Popups.activePopup();
          if (popup != null) {
            // we need to move the alignment form back into the DOM
            var popupObj = $('#' + popup.id);
            form.append($('.alignment-form-container', popupObj).hide());
            Popups.close(popup);
          }
        }
      }
    }
  };

  //If only one learning objective exists - select it
  if ($(".guids-container .guid-container .guid-item").length === 1) {
    $(".guids-container .guid-container .guid-item").click();
  }

  Popups.open(popup_params.popup, Drupal.t('Add Learning Objectives'), '<div id="popup-alignment-form-wrapper"></div>', popup_params.buttons, popup_params.width, popup_params.options);
  alignmentContainer.attr('id', 'form_' + form.attr('id'));
  alignmentContainer.prependTo($('#popup-alignment-form-wrapper', popup_params.popup.$popupBody())).show();
  $('.alignment-form-container.classic-mastery').css("display", "block");

  alignmentContainerState = 'open';
  Popups.resizeAndCenter(popup);
}

function renderMasteryLibrarySelectorPopup(form, alignmentContainer) {
  const popup = new Popups.Popup();
  popup.extraClass = 'popups-small popup-choose-mastery-library';

  const popup_params = {
    popup: popup,
    options: { hideActive: false },
    buttons: {
      'close': {
        title: Drupal.t('Select'),
        func: function (e) {
          e.preventDefault();

          // first store library id
          var libraryId = $('#select-mastery-library-form-select').val();

          // then close current active pop
          var popup = Popups.activePopup();
          if (popup != null) {
            // we need to move the alignment form back into the DOM
            var popupObj = $('#' + popup.id);
            form.append($('.alignment-form-container', popupObj).hide());
            Popups.close(popup);
          }

          // then load mastery ui
          if(libraryId !== CLASSIC_MASTERY_LIBRARY_KEY) {
            window.renderSgyMasteryAlignmentUi(true);
          } else {
            renderClassicMasteryUiPopup(form, $('#alignments-wrapper-form .alignment-form-container'));
            sPopupsResizeCenter();
          }
        }
      }
    }
  };

  Popups.open(
    popup_params.popup,
    Drupal.t('Select Mastery Library'),
    '<div id="popup-alignment-form-wrapper"></div>',
    popup_params.buttons,
    popup_params.width,
    popup_params.options
  );

  alignmentContainer.attr('id', 'form_' + form.attr('id'));
  alignmentContainer.prependTo($('#popup-alignment-form-wrapper', popup_params.popup.$popupBody())).show();
  Popups.resizeAndCenter(popup);
}

function sAlignmentLoadGuids(form) {
  if (loading)
    return;

  var container = $('.guids-container', form);
  loading = true;

  var enableOutcomes = $('#edit-enable-outcomes', form).val();

  $.ajax({
    url: '/alignment/browse?enable_outcomes=' + enableOutcomes,
    dataType: 'json',
    success: function (data, status, xhr) {
      html = $(data.html);
      container.append(html);
      $('.loader', form).hide();
      sAttachBehavior('sAlignment', container);
      loading = false;
    }
  });
}

function sAlignmentLoadId(item, container, form) {
  var guid = item.data('guid');
  var facet = item.data('facet');
  var facetPath = facet ? '&facet=' + facet : '';
  var url = 'guid=' + guid + facetPath;
  if (!$('#container_' + guid, form).length && !loading) {
    loading = true;
    sAlignmentShowLoader(form, $('.guids-container', form));
    $.ajax({
      url: '/alignment/browse',
      data: url,
      dataType: 'json',
      success: function (data, status, xhr) {
        var html = $(data.html);
        $('.guids-container', form).append(html).show();
        sAlignmentUpdateSelectedCount();
        container.hide();
        sAlignmentAddBreadcrumb(item);
        Drupal.attachBehaviors(form);
        $('.authorities-container', form).hide();
        loading = false;
        sAlignmentHideLoader(form);
        sPopupsResizeCenter();
      }
    });
  } else {
    $('.guid-container', form).hide();
    $('#container_' + guid, form).show();
    $('.authorities-container', form).hide();
    sAlignmentAddBreadcrumb(item);
  }
}

function sAlignmentShowLoader(form, container) {
  if (container != null) container.hide();
  var loader = $('.loader', form);
  loader.show();
  sPopupsResizeCenter();
}

function sAlignmentHideLoader(form) {
  var loader = $('.loader', form);
  loader.hide();
  sPopupsResizeCenter();
}

function sAlignmentAddBreadcrumb(item) {
  var container = $('.alignment-breadcrumbs');
  var html = $('<span tabindex="0" class="breadcrumb-item" id="' + item.attr('id') + '"><span class="arrow"></span>' + $('.title', item).html() + '</span>');
  container.append(html);
  sAttachBehavior('sAlignment', container);
  $('.breadcrumb-item', container).removeClass('enabled').removeAttr('aria-current').not(html).addClass('enabled');
  // Add aria-current="true" to the current (last) breadcrumb item for accessibility
  html.attr('aria-current', 'true');
}

function sAlignmentResetSelectedItems() {
  var container = $('.alignment-form-container');
  $('li', container).removeClass('active');
  $('input[type=checkbox]', container).prop('checked', false);
}

function sAlignmentResetAttachedAlignments(clear_alignments, isUSMStandardsSelectorEnabled) {
  if (typeof clear_alignments == 'undefined') {
    clear_alignments = false;
  }

  if (typeof Drupal.settings.s_alignment == 'undefined') {
    Drupal.settings.s_alignment = {attached_tags: {}};
  } else if (typeof Drupal.settings.s_alignment.attached_tags == 'undefined') {
    Drupal.settings.s_alignment.attached_tags = {};
  }
  if (clear_alignments) {
    sAlignmentResetSelectedItems();
    Drupal.settings.s_alignment.attached_tags = {};
    sAlignmentGetActiveIdStore(isUSMStandardsSelectorEnabled).val('');
  }
}

function sAlignmentAddItem(item, from_rubric) {
  if (typeof from_rubric == 'undefined') {
    from_rubric = false;
  }

  var container = $('.alignment-form-container');
  var form = sAlignmentGetActiveForm();
  if (!form) {
    var formId = container.attr('id').split('_').pop();
    form = $('form#' + formId);
  }
  var itemId = item.attr('id').split('_').pop();
  var itemTitle = $('.title', item).html();
  var itemDescription = $('.meta', item).html();
  var idStore = sAlignmentGetActiveIdStore();

  var itemNid = $('#edit-item-nid').val();
  var idStoredVals = idStore.val() && idStore.val().length ? idStore.val().split(',') : [];

  if ($.inArray(itemId, idStoredVals) == -1) {
    idStoredVals.push(itemId);
    var html = $('<div id="selected_' + itemId + '" class="selected-item active">' + item.html() + '</div>');
    $('.selected-container', container).append(html);
    // allow the user to deselect from the "Selected" page
    sAttachBehavior('sAlignment', $('.selected-container', container));
    var form = sAlignmentGetActiveForm();
    if (!form) {
      var form = $('#' + container.attr('id').split('_').pop());
    }
    if (!from_rubric) {
      var alignmentEl = alignmentElement(itemId, itemTitle);
      $('.alignment-inline-wrapper .alignment-container .alignment-item-container', form).append(alignmentEl);
      // allow the user to deselect by clicking the "X" in the origin form
      sAttachBehavior('sAlignment', $('.alignment-inline-wrapper', form));
    }
  }

  idStore.val(idStoredVals);

  if (idStoredVals.length) {
    $('.alignment-inline-wrapper', form).show();
    $('#s-alignment-align-button.alignment-btn:not(.disabled)', form).addClass('active');
    sPopupsResizeCenter();
  }
  item.addClass('active');

  var broadcastObj = {
    guid: itemId,
    name: itemTitle,
    description: itemDescription,
    item_id: itemNid
  };

  sAlignmentResetAttachedAlignments();
  Drupal.settings.s_alignment.attached_tags[broadcastObj.guid] = broadcastObj;
  sAngular.rootScopeBroadcast('sAlignmentAdd', broadcastObj);

  sAlignmentUpdateSelectedCount();
  sPopupsResizeCenter(0);
}

function sAlignmentRemoveItem(itemId, transmit, idStore) {
  // want to be able to use this function to remove form tags when a rubric alignment is removed,
  // unfortunately that could get us in an infinite loop because transmitting an alignment remove causes angular to call this function,
  // which triggers another alignment remove and so on.
  if (typeof transmit == 'undefined') {
    transmit = true;
  }

  var idStore = sAlignmentGetActiveIdStore();
  var idStoredVals = idStore.val() && idStore.val().split(',');
  var idStoreIndex = $.inArray(itemId, idStoredVals);
  if (idStoreIndex === -1) {
    return;
  }
  idStoredVals.splice(idStoreIndex, 1);
  idStore.val(idStoredVals);

  $('#selected_' + itemId).remove();

  // for browse lis
  var liObj = $('#item_' + itemId);
  $('input[type=checkbox]', liObj).prop('checked', false);
  liObj.removeClass('active');

  // for search result lis
  var srObj = $('#searchresult_' + itemId);
  $('input[type=checkbox]', srObj).prop('checked', false);
  srObj.removeClass('active');

  $('#formitem_' + itemId).remove();

  // count of alignments showing from a selected rubric
  var rubric_alignment_count = $('.tag-item-from-rubric').length;

  if (rubric_alignment_count + idStoredVals.length == 0) {
    $('#s-alignment-align-button.alignment-btn:not(.disabled)').removeClass('active');
    sPopupsResizeCenter();
  }

  sAlignmentUpdateSelectedCount();
  if (transmit) {
    $.each(Drupal.settings.s_alignment.attached_tags, function (idx, obj) {
      if (obj.guid == itemId) {
        delete Drupal.settings.s_alignment.attached_tags[idx];
      }
    });
    sAngular.rootScopeBroadcast('sAlignmentRemove', {guid: itemId});
  }

  sPopupsResizeCenter();
  sPopupsResizeCenter(0);
}

function sAlignmentUpdateSelectedCount(initial) {

  if (typeof initial == 'undefined') {
    initial = false;
  }
  var alignmentContainer = $('.alignment-form-container');
  var selectedContainer = $('.selected-container', alignmentContainer);
  $('div.selected-item.active.visually-hidden', selectedContainer).remove();
  var selectedItems = $('div', selectedContainer);
  var selectedCount = selectedItems.length;

  // if this is the initial selected count update, load selected items if the server has not already.
  // When there is a singleton alignment popup on a page, the server is not sending "selected" markup
  if (initial && selectedCount == 0) {
    var idStore = sAlignmentGetActiveIdStore().val('');
    sAlignmentResetAttachedAlignments();
    $.each(Drupal.settings.s_alignment.attached_tags, function (idx, obj) {
      var el = $('<div class="selected-item active" id="' + obj.guid + '"><input type="checkbox" class="std-selector"><span class="title">' + obj.name + '</span> · <span class="meta small gray">' + obj.description + '</span></div>');
      //$('.selected-container').append(el);
      sAlignmentAddItem(el, true);
      selectedCount = selectedCount + 1;
    });
  }

  var html = (selectedCount) ? ('&nbsp;(' + selectedCount + ')') : '';
  $('.header .selected-count', alignmentContainer).html(html);
  // ensure only selected LO are marked as active
  $('.guid-item', alignmentContainer).each(function () {
    $(this).removeClass('active');
    $('input[type=checkbox].std-selector', $(this)).prop('checked', false);
  });
  var idStore = sAlignmentGetActiveIdStore();
  var idStoredVals = idStore.val() && idStore.val().length ? idStore.val().split(',') : new Array();
  $.each(idStoredVals, function (idx, item_id) {
    var item = $('#item_' + item_id);
    item.addClass('active');
    $('input[type=checkbox].std-selector', item).prop('checked', true);
  });
}

function sAlignmentGetActiveIdStore(isUSMStandardsSelectorEnabled) {
  if (typeof Drupal.settings.s_alignment != 'undefined') {
    var activeForm = Drupal.settings.s_alignment.activeForm
  }

  if (activeForm) {
    return idStore = $('#edit-selected-ids', activeForm);
  } else {
    if (isUSMStandardsSelectorEnabled) {
      return idStore = $('input[name="selected_ids"][id="edit-selected-ids"]');
    }
    return idStore = $('#edit-selected-ids');
  }
}

function sAlignmentGetActiveForm() {
  var activeForm;
  if (typeof Drupal.settings.s_alignment != 'undefined') {
    var activeForm = Drupal.settings.s_alignment.activeForm
  }
  return activeForm;
}

function sAlignmentSearch(term, context) {
  $('.browse-container', context).hide();
  $('.selected-container', context).hide();
  var $searchContainer = $('.search-container', context).empty().show(),
    $firstBreadcrumb = $searchContainer.siblings(".alignment-breadcrumbs").children().eq(0);

  $firstBreadcrumb.removeClass('enabled') //Disable "Learning Objectives" breadcrumb until search is completed to avoid mess up UI
    .siblings().remove(); //Reset existing breadcrumb

  $('.search-block-filters input', context).each(function () {
    if ($(this).is(":checked") && !loading) {
      loading = true;
      var itemId = $(this).attr('id').split('_')[1];
      var url = 't=' + term + '&guid=' + itemId;
      var containerWrapper = $(this).parents('.alignment-form-container').eq(0);
      $searchContainer.show();
      sAlignmentShowLoader(containerWrapper, null);
      $.ajax({
        url: '/alignment/search',
        data: url,
        dataType: 'json',
        success: function (json) {
          $('.browse-container', context).hide();
          $('.selected-container', context).hide();
          var $searchContainer = $('.search-container', context).empty().show(),
            $firstBreadcrumb = $searchContainer.siblings(".alignment-breadcrumbs").children().eq(0);
          var html = $(json.html);
          $('.selected-container .selected-item').each(function () {
            selItemId = $(this).attr('id').split('_')[1];
            if ($('#searchresult_' + selItemId, html).length) {
              $('#searchresult_' + selItemId + ' input', html).attr('checked', 'checked');
              $('#searchresult_' + selItemId, html).addClass('active');
            }
          });
          $firstBreadcrumb.addClass("enabled");
          $searchContainer.html(html).show();
          Drupal.attachBehaviors($searchContainer);
          sAlignmentHideLoader(containerWrapper);
          loading = false;
        }
      });
    }
  });
}

function alignmentElement(id, title, is_from_rubric) {
  var rubric_class = (is_from_rubric) ? 'tag-item-from-rubric' : '';
  var delete_btn = (is_from_rubric) ? '' : '<span class="delete-btn"></span>';
  return $('<span class="alignment-inline-item tag-item ' + rubric_class + '" id="formitem_' + id + '">' + title + delete_btn + '</span>');
}

function sAlignmentClearAlignments(rubric_only) {
  // clear current alignment bubbles
  var alignmentContainer = $('.alignment-container');
  if (rubric_only) {
    $('.tag-item-from-rubric', alignmentContainer).remove();
  } else {
    $.each($('.tag-item:not(.tag-item-from-rubric)'), function (idx, obj) {
      sAlignmentRemoveItem(obj.id.replace('formitem_', ''), false);
    });
    $('.tag-item', alignmentContainer).remove();
  }
  var idStore = sAlignmentGetActiveIdStore();
  idStore.val('');
  $('.selected-container div.selected-item').remove();
  if ($('.tag-item', alignmentContainer).length == 0) {
    $('#s-alignment-align-button.alignment-btn:not(.disabled)').removeClass('active');
    sPopupsResizeCenter();
  }
}

//To be called when clearing a rubric from an assignment. Clears the form input
//containing the json of the selected alignments. Alignments would only be present
//for rubrics aligned to objectives.
function sAlignmentClearRubricAlignmentsInput() {
  $('input[name="district-mastery-aligned-objectives"]').each(function() {
    $(this).val('');
  });
}

function sAlignmentClearPendingAlignments(isNew) {
  var alignmentContainer = $('.alignment-container');
  $.each($('.tag-item:not(.tag-item-from-rubric)'), function (idx, obj) {
    sAlignmentRemoveItem(obj.id.replace('formitem_', ''), true);
  });

  if (isNew) {
    $('.tag-item-from-rubric').remove();
  }
}

// update Learning Objective bubbles if attached rubric is edited
function sAlignmentRubricUpdate(rubric) {
  sAlignmentClearAlignments(false);

  // make bubbles for each rubric row
  $.each(rubric.rows, function (idx, row) {
    if (row.title) {
      var $rubric_alignment_element = alignmentElement(row.id, htmlentities(row.title), true);
      $('.alignment-inline-wrapper .alignment-container .alignment-item-container').append($rubric_alignment_element);
    }
  });

  sPopupsResizeCenter();
}

// Accepts a rubric, and creates rubric_info entry for Drupal.settings.s_grading_rubrics_info
function sAlignmentRubricInfo(rubric) {
  var has_published_criteria = false;
  $.each(rubric.rows, function (idx, row) {
    if (row.is_published) {
      has_published_criteria = true;
    }
  });
  return {
    has_published_criteria: has_published_criteria,
    rubric: rubric
  }
}

function sAlignmentDisableAlignmentButton() {
  var alignment_btn = $('#s-alignment-align-button.alignment-btn, #usm-align-button');

  // disable
  // mark as disabled becuase a rubric is selected
  alignment_btn.addClass('disabled disabled-rubric-selected').removeClass('active').attr('disabled', true);

  // Disable Label
  $('.s-common-adv-options-label').addClass('disabled');

  $('.alignment-inline-wrapper .alignment-container').addClass('is-from-rubric');
}

function sAlignmentEnableAlignmentButton() {
  var alignment_btn = $('#s-alignment-align-button.alignment-btn, #usm-align-button');

  // enable
  alignment_btn.removeClass('disabled disabled-rubric-selected').removeAttr('disabled');
  $('.s-common-adv-options-label').removeClass('disabled');

  $('.alignment-inline-wrapper .alignment-container').removeClass('is-from-rubric');
}

/**
 * Renders tags for aligned district mastery learning objectives.
 *
 * @param {jQuery} $input - The hidden input of aligned objectives for district mastery.
 * @param {jQuery} $container - The alignment text container.
 */
function sAlignmentRenderDistrictMasteryObjectives($input, $container) {
  var alignedObjectives = [];
  try {
    alignedObjectives = JSON.parse($input.val());
  } catch (err) {
  }

  var $tags = alignedObjectives.map(function (objective) {
    return alignmentElement(objective.id, objective.title);
  });

  $container.text(''); // clear all content
  for (var i = 0; i < $tags.length; i++) {
    $container.append($tags[i]);
  }

  $('.delete-btn', $container).bind('click', function () {
    sAlignmentRemoveDistrictMasteryObjective($input, $(this).parent());
  });

  sPopupsResizeCenter();
}

/**
 * Removes an objective from the UI tags and from the hidden form field.
 * If count === 0, also triggers an onchange event to force the rubric visibility toggle.
 *
 * @param {jQuery} $input - The hidden input of aligned objectives for district mastery.
 * @param {jQuery} $tag - The tag to be removed.
 */
function sAlignmentRemoveDistrictMasteryObjective($input, $tag) {
  var alignedObjectives = [];
  try {
    alignedObjectives = JSON.parse($input.val());
  } catch (err) {
  }

  var id = $tag.attr('id').split('_').pop();
  alignedObjectives = alignedObjectives.filter(function (objective) {
    return objective.id !== id;
  });
  $input.val(JSON.stringify(alignedObjectives));

  $tag.remove();

  if (alignedObjectives.length === 0) {
    // we only need to do this if we are toggling rubric visibility - all other UI and form changes are done above.
    $input.trigger('change');
  }
}

/**
 * Filters and titles the grading scale list based on whether district mastery alignments are found.
 *
 * If alignments exist, use filtered scale.
 * If no alignments, use default scale/rubric.
 *
 * Special case: when editing an Essay question, the user will not have any dropdown, if alignments exist.
 * @see sites/all/modules/schoology_core/s_grades/s_grade_item/s_assessment/s_assessment.css
 *
 * @param {jQuery} $input - The hidden input of aligned objectives for district mastery.
 * @param {jQuery} $selectContainer - The visible scale.
 * @param {jQuery} $districtMasteryScaleWrapper - The filtered/hidden scale to use if alignments exist. If this element
 * is missing the $selectContainer will be hidden instead.
 */
function sAlignmentToggleRubricListVisibility($input, $selectContainer, $districtMasteryScaleWrapper) {
  var DISTRICT_MASTERY_SCALE_CLASS = 'district_mastery_gradebook_scale';

  var $label = $('#edit-grading-scale-id-wrapper label', $selectContainer);
  var $select = $('#edit-grading-scale-id', $selectContainer);
  var selectValue = $select.val();

  var $districtMasteryLabel = $('label', $districtMasteryScaleWrapper);
  var $districtMasteryList = $('select', $districtMasteryScaleWrapper);
  // When we have a DM scale wrapper we will use its contents as the template for the rubric selector
  // when LOs are selected. If we do not have a wrapper then we hide the rubric selector instead.
  var hasDistrictMasteryScaleWrapper = $districtMasteryScaleWrapper && $districtMasteryScaleWrapper.length > 0;

  var hasSelectChanged = false;
  var alignments = [];

  try {
    alignments = JSON.parse($input.val());
  } catch (err) {
  }

  if (alignments.length) {
    if (!hasDistrictMasteryScaleWrapper) {
      hasSelectChanged = true;
      $selectContainer.hide();
      sPopupsResizeCenter();
    }
    else if (!$selectContainer.districtMasteryScaleVisibility) {
      hasSelectChanged = true;
      $selectContainer.districtMasteryScaleVisibility = true;
      // store old values
      $selectContainer.oldLabel = $label.html();
      $selectContainer.oldList = $select.html();
      // use district mastery values
      $selectContainer.addClass(DISTRICT_MASTERY_SCALE_CLASS);
      $label.html($districtMasteryLabel.html());
      $select.html($districtMasteryList.html());
    }
  } else {
    if (!hasDistrictMasteryScaleWrapper) {
      hasSelectChanged = true;
      $selectContainer.show();
      sPopupsResizeCenter();
    }
    else if ($selectContainer.districtMasteryScaleVisibility) {
      hasSelectChanged = true;
      $selectContainer.districtMasteryScaleVisibility = false;
      // revert to old values
      $selectContainer.removeClass(DISTRICT_MASTERY_SCALE_CLASS);
      $label.html($selectContainer.oldLabel);
      $select.html($selectContainer.oldList);
    }
  }

  if (hasSelectChanged) {
    var selectValueIndex = 0;

    // try to use the same selected value
    $('option', $select).each(function (index) {
      if ($(this).val() === selectValue) {
        selectValueIndex = index;
      }
    });

    $select.selectmenu('value', selectValueIndex);
    sGradeScaleProcessRubricDropdown($select.parents('form:first'), true);
  }
}

/**
 * Determines if the event is a selection event.
 *
 * A selection event is defined as either a click event or a keydown event
 * where the key pressed is either 'Enter' or the spacebar (' ').
 *
 * @param {Event} e - The event to check.
 * @returns {boolean} - True if the event is a selection event, false otherwise.
 */
function isSelectionEvent(e) {
  return e.type === 'click' || (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' '));
}

/**
 * Dynamically checks for the is-from-rubric class and enables/disables the alignment button accordingly
 * This function should be called when the page loads and when rubric selection changes
 */
function sAlignmentCheckRubricState() {
  var $alignmentContainer = $('.alignment-inline-wrapper .alignment-container');
  var $alignmentBtn = $('#s-alignment-align-button.alignment-btn, #usm-align-button');

  if ($alignmentContainer.hasClass('is-from-rubric')) {
    // Disable the button if rubric class is present
    $alignmentBtn.addClass('disabled disabled-rubric-selected').removeClass('active').attr('disabled', true);
    $('.s-common-adv-options-label').addClass('disabled');
  } else {
    // Enable the button if rubric class is not present
    $alignmentBtn.removeClass('disabled disabled-rubric-selected').removeAttr('disabled');
    $('.s-common-adv-options-label').removeClass('disabled');
  }
}

// Initialize rubric state checking when document is ready
$(document).ready(function() {
  // Check rubric state on page load
  sAlignmentCheckRubricState();

  // Set up a MutationObserver to watch for changes to the alignment container
  var $alignmentContainer = $('.alignment-inline-wrapper .alignment-container');
  if ($alignmentContainer.length > 0) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          sAlignmentCheckRubricState();
        }
      });
    });

    observer.observe($alignmentContainer[0], {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Also listen for rubric selection changes via existing events
  $(document).on('rubricSelected', function() {
    sAlignmentCheckRubricState();
  });

  $(document).on('rubricDeselected', function() {
    sAlignmentCheckRubricState();
  });

  // Listen for specific rubric events used in the codebase
  $(document).on('sLibraryResourceMaterialRubricUpdated', function() {
    sAlignmentCheckRubricState();
  });

  // Listen for grading scale changes that might affect rubric selection
  $(document).on('change', '#edit-grading-scale-id', function() {
    setTimeout(function() {
      sAlignmentCheckRubricState();
    }, 100); // Small delay to ensure DOM updates are complete
  });
});

