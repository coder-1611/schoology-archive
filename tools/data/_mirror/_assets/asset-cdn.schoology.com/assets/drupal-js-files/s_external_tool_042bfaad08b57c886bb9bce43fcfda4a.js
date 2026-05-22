Drupal.behaviors.sExternalTool = function(context){

  let date_strings = Drupal.date_t_strings();
  let am_pm_long = date_strings.ampm.slice(2, 4);

	$('#s-external-tool-provider-create-form:not(.sExternalTool-processed)').addClass('sExternalTool-processed').each(function(){
		var form = $(this);
		var configTypeEl = $('#edit-config-type', form);
    //depending on the config type we need to either show the URL/XML block or the manual block
		if(configTypeEl.length){
      //if someone changes the config type, grab the wrapper and hide/unhide accordingly
			configTypeEl.bind('change', function(){
				var newClass = 'option-' + $(this).val();
				$('.config-option-item', form).hide();
				$('.'+newClass, form).show();
                                sPopupsResizeCenter();
			});

			//trigger upon load to initialize the form with the proper config wrapper showing/hidden
			configTypeEl.trigger('change');
      sPopupsResizeCenter();
		}
		else{
			$('.config-option-item', form).hide();
			$('.option-1', form).show();
      sPopupsResizeCenter();
		}

        $('#clear_shared_secret_button', form).click(function(e) {
            $("#edit-clear-shared-secret", form).val(true);
            $("#edit-shared-secret", form).attr('placeholder', '').val('');
        });
	});

	$('#s-external-tool-add-link-form:not(.sExternalTool-processed)').addClass('sExternalTool-processed').each(function(){
		var form = $(this);
        var sharedSecretField = $("#edit-external-tool-shared-secret", form);
        var clearSharedSecretButton = $("#clear_shared_secret_button", form);
        clearSharedSecretButton.click(function(e) {
            $("#edit-external-tool-clear-shared-secret", form).val(true);
            sharedSecretField.attr('placeholder', '').val('');
        });
    var tpField = $('#edit-external-tool-tp-nid', form);

    var toggleDateWarning = function() {
      if (sExternalToolShouldShowDueDateWarning(form)) {
        sExternalToolAddDueDateWarning(form);
      } else {
        sCommonDateRemoveDueDateWarning(form);
      }
    };

    toggleDateWarning();
    $("input[name='external_tool[grading][due_date][date]'], .csm-due-date", form).change(toggleDateWarning);
    $("select[name='external_tool[grading][grading_period]']", form).change(toggleDateWarning);
    $(".section-selection input", form).change(toggleDateWarning);

    //make sure both date and time inputs disabled if we are disabling due date
    $('.due-disabled input', form).each(function() {
      $(this).prop('disabled', true);
    });
    //For duedate field, auto-populate 11:59PM if date is selected and no time is entered
    form.on('change', '.hasDatepicker', function() {
      var $dueTimeInput = $(this.parentNode).siblings('.time-input').find('input');
      if (!this.value) {
        $dueTimeInput.val('');
      }
      else if (!$dueTimeInput.val()) {
        $dueTimeInput.val('11:59' + am_pm_long[1]);
      }
    });
    form.on('blur', '.time-input input', function(){
      //not looking for class hasDatepicker because only added if user has already clicked date input
      var $dueDateInput = $(this).parents('.container-inline-date').find('input').first();
      if (!$(this).val() && $dueDateInput.val()) {
        $(this).val('11:59' + am_pm_long[1]);
      }
    });
    //when someone selects an external tool, instead of using the auto-find, do the following
		tpField.bind('change', function(){
      sExternalToolProviderAutoFill(form, $(this));
		});

    if(tpField.val() != 0) {
      sExternalToolProviderAutoFill(form, tpField);
    }

    addClearButtonClass(sharedSecretField, clearSharedSecretButton, tpField.val(), form);

    // Ensure the toggle-chatbot button is always shown if it exists
    if ($('.toggle-chatbot').length > 0) {
      $('.toggle-chatbot').show();
    }

    //if user enables grading, show/hide the form
		$('#edit-external-tool-grading-enabled', form).bind('change', function(){
			if($(this).is(":checked")){
				$('.grading-options-wrapper, .csm-node-assign-wrapper.csm-node-assign-due-and-available', form).show();
        $('.csm-node-assign-wrapper.csm-node-assign-available-only', form).hide();
        // Show grade count in button if check box is checked
        $('.adv-option-group-toggle .toggle-count-in-grade').show();
			}
			else{
				$('.grading-options-wrapper, .csm-node-assign-wrapper.csm-node-assign-due-and-available', form).hide();
        $('.csm-node-assign-wrapper.csm-node-assign-available-only', form).show();
        // Hide grade count in button if check box is not checked
        $('.adv-option-group-toggle .toggle-count-in-grade').hide();

			}
			sPopupsResizeCenter();
		});

    // Prompt when enabling collected-only for existing external tool material
    if ($('#edit-item-nid').val() !== '') {
      let elEnableGrading = $('#edit-external-tool-grading-enabled'); // Always available for External Tool
      let elCollected = $('#edit-external-tool-grading-option-collected-only');
      let prevIsCollected = elCollected.is(':checked');
      // Clicked "Save Changes"
      $('#s-external-tool-add-link-form .submit-buttons .form-submit').on('click', function (ev) {
        // When grading is enabled, did we switch from not collected to collected?
        if (elEnableGrading.is(':checked') && !prevIsCollected && elCollected.is(':checked')) {
          ev.preventDefault();
          sCommonConfirmationPopup({
            title: $('#edit-external-tool-title').val(),
            body: '<p>' + Utils.i18n.t(Drupal.settings.s_grades.is_district_mastery ? 'core.collected_only_mastery_prompt.message' : 'core.collected_only_prompt.message') + '</p>',
            confirm: {
              func: function () {
                Popups.removePopup();
                $('#s-external-tool-add-link-form').submit();
              }
            }
          });
        }
      });
    }

    //sGradesApplyHoverListener is defined for pages with grading, may not be defined here. This isn't defined when
    //adding an external tool to a page.
    if(typeof(sGradesApplyHoverListener) == "function") {
      sGradesApplyHoverListener(form, '.grading-category-field')
    }

    //if the user overrides an auto-populated field, either revert or show the new entry
		$('.auto-populate-allowed', form).bind('blur', function(){
      var thisEl = $(this);
			var formItem = thisEl.parents('.form-item').eq(0);
			var selectedTool = tpField.val();
			var autoPopulateText = $('.auto-populate-disabled-field-text', formItem);
			if(selectedTool > 0 && thisEl.val() == '' && autoPopulateText.length){
				autoPopulateText.show();
				thisEl.hide();
				sPopupsResizeCenter();
			}
		});

		sPopupsResizeCenter();
		$('#edit-external-tool-grading-enabled', form).trigger('change');

    // this field is not required, if the selected tool provider has a launch url
    // append fake span.form-required
    var urlLabel = $('#edit-external-tool-url-wrapper label:first', form);
    if(urlLabel.html().indexOf('form-required') == -1) {
      urlLabel.append(' <span title="' + Drupal.t('This field is required.') + '" class="form-required">*</span>');
    }

    sFormSelectInput( $('.grading-category-wrapper', form) );
	});

  //upon launching a tool, let's resize the window to be as tall as possible
  $('#external-tool-iframe:not(.sExternalTool-processed)').addClass('sExternalTool-processed').each(function(){
    sExternalToolResizeLaunchWindow($(this));
    // Listen for LTI app return redirect message
    sAppLauncherAddEventListenerForLtiFrameMessages();
  });

  // Attachment Form for External Tool
  $('.s-external-tool-attachment-wrapper:not(.sExternalTool-processed)', context).addClass('sExternalTool-processed').each(function(){
    if(Drupal.settings.s_external_tool_form == undefined && window.sExternalToolFormSettings == undefined) {
      return;
    }

    if(window.sExternalToolFormSettings == undefined) {
      window.sExternalToolFormSettings = {
        'sExternalToolForm': Drupal.settings.s_external_tool_form,
        'sExternalToolProviderSettings': Drupal.settings.s_external_tool_provider_settings,
        'attachments': {}
      };
    }

    var attachmentFormWrapper = $(this);
    attachmentFormWrapper.html( window.sExternalToolFormSettings.sExternalToolForm );
    sAttachBehaviors(['sExternalTool'], attachmentFormWrapper);
		sPopupsResizeCenter();

    // Close popup, attach External Tool
    $('.form-submit, .cancel-btn', attachmentFormWrapper).click(function(e){
      e.preventDefault();
      var thisBtn = $(this);
      var validParams = true;
      if(!thisBtn.hasClass('form-submit')) {
        sPopupsClose();
      }
      else {
        // See ExternalToolLinkBll::CUSTOM_PARAMETER_CHARACTER_MAX also if value changes
        const customParameterCharacterMax = 25000;
        var etlForm = thisBtn.parents('form:first');
        var etlFormData = {
          'tp_nid': $('#edit-external-tool-tp-nid', etlForm).val(),
          'title': $('#edit-external-tool-title', etlForm).val(),
          'url': $('#edit-external-tool-url', etlForm).val(),
          'launch_type': $('#edit-external-tool-launch-type', etlForm).val(),
          'consumer_key': $('#edit-external-tool-consumer-key', etlForm).val(),
          'shared_secret': $('#edit-external-tool-shared-secret', etlForm).val(),
          'custom_parameters': $('#edit-external-tool-custom-parameters', etlForm).val()
        };
        // Remove error messages
        $('.popups-body').find('.messages.error').remove();

        // Check if title is required based on app LTI gradable status
        var isLtiGradableApp = false;
        if (etlFormData.tp_nid && window.sExternalToolFormSettings && window.sExternalToolFormSettings.sExternalToolProviderSettings) {
          var toolSettings = window.sExternalToolFormSettings.sExternalToolProviderSettings[etlFormData.tp_nid];
          isLtiGradableApp = toolSettings && toolSettings.lti_gradable_enabled;
        }

        // Focus the first invalid field and mark it aria-invalid for screen readers.
        var firstErrorField = null;
        var $titleField = $('#edit-external-tool-title', etlForm);
        var $customParamsField = $('#edit-external-tool-custom-parameters', etlForm);
        $titleField.removeAttr('aria-invalid');
        $customParamsField.removeAttr('aria-invalid');

        // Only require title for non-LTI gradable apps (legacy LTI flow)
        if (!isLtiGradableApp && (!etlFormData.title || !etlFormData.title.trim())) {
          validParams = false;
          displayErrorMessage(Utils.i18n.t('core.title_required'));
          if (!firstErrorField) {
            firstErrorField = $titleField;
            firstErrorField.attr('aria-invalid', '1');
          }
        }

        if (etlFormData.custom_parameters.length > customParameterCharacterMax) {
          validParams = false;
          displayErrorMessage(Utils.i18n.t(
            'core.custom_parameters_character_limit',
            {
              length: etlFormData.custom_parameters.length,
              max_length: customParameterCharacterMax
            }
          ));
          if (!firstErrorField) {
            firstErrorField = $customParamsField;
            firstErrorField.attr('aria-invalid', '1');
          }
        }

        if (!validParams) {
          if (firstErrorField) {
            firstErrorField.focus();
          }
          return;
        }

        sExternalToolAddAttachmentObj(etlFormData);
        sPopupsClose();
      }
    });
  });

  // LTI launch failed
  $('.s-js-no-lti:not(.sExternalTool-processed)').addClass('sExternalTool-processed').each(function(){
    // if this an admin, open link in parent window and close
    $('a', $(this)).bind('click', function(e){
      window.opener.location.href = $(this).attr('href');
      window.close();
    });
  });

  $("#s-lti-launch-frame-wrapper:not(.sLti-processed)", context).addClass('sLti-processed').each(function(){
      $('.fullscreen-option span', this).bind('click', function(){
          body = $('body');
          body.toggleClass('lti-full-screen');

          $(window).resize();
          // A problem in Chrome is preventing the contents of the iframe from redrawing and expanding to the new size of the iframe, causing undesirable empty space between the edge of the iframe and its contents.
          // Implementing a variation of the fix described at: http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
          body.hide();
          body.outerHeight();
          body.show();

          return false; //TODO: Find out where the double bind occurs
      });
  });

  // Handle assignment fullscreen buttons with proper container targeting
  $('.assignment-fullscreen-btn[data-assignment-lti-fullscreen="true"]:not(.sExternalTool-processed)', context).addClass('sExternalTool-processed').bind('click', function(){
      var body = $('body');
      var isFullscreen = body.hasClass('assignment-fullscreen-mode');

      body.toggleClass('assignment-fullscreen-mode');

      var $button = $(this);
      var $centerTop = $('#center-top', body);

      if (!isFullscreen) {
        if ($centerTop.length) {
          $centerTop.append($button);
        }
      } else {
        var $headerButtons = $('.content-top-wrapper .info-container .grade-item-header-buttons', body);
        if ($headerButtons.length) {
          // Place the button after the Immersive Reader button to maintain proper order
          var $immersiveReaderButton = $headerButtons.find('.immersive-reader-button-container');
          if ($immersiveReaderButton.length) {
            $immersiveReaderButton.after($button);
          } else {
            $headerButtons.prepend($button);
          }
        }

        $(window).resize();
        body.hide();
        body.outerHeight();
        body.show();
      }

      return false;
  });

  $(".lti-autofill-time-form:not(.ltiTime-processed)", context).addClass('ltiTime-processed').each(function(){
    var $form = $(this);
    //make sure both date and time inputs disabled if we are disabling due date
    $('.due-disabled input', $form).each(function() {
      $(this).prop('disabled', true);
    });
    $form.on('change', '.due-date', function() {
      var $dueTimeInput = $(this.parentNode).siblings('.time-input').find('input');
      if (!this.value) {
        $dueTimeInput.val('');
      }
      else if (!$dueTimeInput.val()) {
        $dueTimeInput.val('11:59' + am_pm_long[1]);
      }
    });
    $form.on('blur', '.time-input input', function(){
      var $dueDateInput = $(this).parents('.time-input').siblings().find('.due-date');
      if (!$(this).val() && $dueDateInput.val()) {
        $(this).val('11:59' + am_pm_long[1]);
      }
    });
  });
  /*
  * When user selects 'Launch in Schoology' ('1') on the external tool link
  * edit form in Resources (template) or Courses, show the launch warning
  */
  var launchOptionsTemplateFieldId = '#edit-template-fields-launch-type';
  var launchOptionsFieldId = '#edit-external-tool-launch-type';
  var launchOptionsWarningId = '#edit-external-tool-launch-type-warning';

  var launchOptionsTemplateField = $(launchOptionsTemplateFieldId, context);
  var launchOptionsField = $(launchOptionsFieldId, context);
  var launchOptionsWarning = $(launchOptionsWarningId, context);

  function toggleLaunchOptionsWarning() {
    if (launchOptionsField.val() == '1' || launchOptionsTemplateField.val() == '1') {
      launchOptionsWarning.css('display', 'block');
    } else {
      launchOptionsWarning.css('display', 'none');
    }

    sPopupsResizeCenter();
  }

  toggleLaunchOptionsWarning();
  launchOptionsField.change(toggleLaunchOptionsWarning);
  $(launchOptionsFieldId, context).change(toggleLaunchOptionsWarning);
  $(launchOptionsTemplateFieldId, context).change(toggleLaunchOptionsWarning);
}

//simple resize function to make the window max height
function sExternalToolResizeLaunchWindow(windowObj){
	// Resize the iframe that contains the app so it takes up the maximum height remaining in the viewport affter
    // taking into account the header (#header) and the breadcrumbs area (#center-top)
    var appWindowObj = windowObj;
    var body = $('body');
    $(window).resize(function() {
      var new_height = $(this).get(0).outerHeight;
      $('#header:visible, #center-top:visible', body).each(function() {
        new_height -= $(this).outerHeight();
      });
      appWindowObj.height(new_height);
    }).trigger('resize');
}

//toggle auto-populate fields by selected tool provider
function sExternalToolProviderAutoFill(formElm, tp) {
  $('div.form-item .auto-populate-disabled-field-text', formElm).remove();
  $('.auto-populate-allowed', formElm).show();
  var isLti13ToolProvider = false;
  var toolSettings;
  var clearSharedSecretButton = $("#clear_shared_secret_button", formElm);
  clearSharedSecretButton.appendTo('#edit-external-tool-shared-secret-wrapper', formElm);
  if(tp.val() > 0){
    //since not everything is required, and some fields are derived from the chosen provider
    //we can look at the settings values for each provider and let the user know what we found and what they
    //need to provide
    if(Drupal.settings.s_external_tool_provider_settings != undefined) {
      toolSettings = Drupal.settings.s_external_tool_provider_settings[tp.val()];
    }
    // if this is an attachment popup, get settings from cache
    else {
      toolSettings = window.sExternalToolFormSettings.sExternalToolProviderSettings[tp.val()];
    }
    isLti13ToolProvider = toolSettings['13'];
    var autoPopulateWrapper = $('#auto-populate-disabled-field-wrapper', formElm);
    $.each(toolSettings, function(key, element){
      var relFieldElm = $('.auto-populate-allowed.key-'+key, formElm);
      // the 's' is for the secret, the settings have k for key and s for secret
      if(key === 's' && relFieldElm.attr('placeholder')) {
        relFieldElm.addClass('with-clear-button');
        clearSharedSecretButton.before(relFieldElm).show();
        return;
      }
      if(relFieldElm.val() != '') {
        return;
      }

      var clonedItem = $('.auto-populate-disabled-field-text', autoPopulateWrapper).clone();
      clonedItem.bind('click', function(){
        var formItem = $(this).parents('.form-item').eq(0);
        $(this).hide();
        $('.auto-populate-allowed', formItem).show().trigger('focus');
        sPopupsResizeCenter();
      });

      if(element){
        relFieldElm.hide().before(clonedItem.show());
      }
    });
  }

  var tpInputValue = tp.val();
  sExternalToolHandleConsumerKeySecret(formElm, isLti13ToolProvider, clearSharedSecretButton, tpInputValue);
  sPopupsResizeCenter();
}

function addClearButtonClass(sharedSecretField, clearSharedSecretButton, selectProviderInputValue, formElm) {
    if(formElm) {
        clearSharedSecretButton.appendTo('#edit-external-tool-shared-secret-wrapper', formElm);
    }
    if(sharedSecretField.attr('placeholder') && selectProviderInputValue == 0) {
        sharedSecretField.addClass('with-clear-button');
        clearSharedSecretButton.show();
    }
}

//deprecated, but leaving in because will need shortly
function sExternalToolAddContent(data){
	if(data.embed_type == 'basic_lti'){
		var form = $('#s-generic-post-new-add-link-form');
		$('#edit-link-wrapper input', form).val(data.url);
		$('#edit-link-title-wrapper input', form).val(data.text);
	}
	else if(data.embed_type == 'link'){
		var form = $('#s-page-create-page-form');
		if( tinyMCE.activeEditor ){
			html = '<a href="'+data.url+'" alt="'+data.text+'">'+data.text+'</a>';
		    var activeEditorId = tinyMCE.activeEditor.editorId;
		    tinyMCE.execInstanceCommand(activeEditorId,"mceInsertContent",false,html);
		}
	}
	else if(data.embed_type == 'iframe'){
		var form = $('#s-page-create-page-form');
		if( tinyMCE.activeEditor ){
			html = '<iframe src="'+data.url+'"></iframe>';
		    var activeEditorId = tinyMCE.activeEditor.editorId;
		    tinyMCE.execInstanceCommand(activeEditorId,"mceInsertContent",false,html);
		}
	}
	else if(data.embed_type == 'oembed'){
		var form = $('#s-page-create-page-form');
		if( tinyMCE.activeEditor ){
			var html = '';
			$.ajax({
			  url: data.endpoint+'?url='+data.url+'&format=json',
			  success: function(json){
				html = json.html;
				var activeEditorId = tinyMCE.activeEditor.editorId;
			    tinyMCE.execInstanceCommand(activeEditorId,"mceInsertContent",false,html);
			  },
			  dataType: 'jsonp'
			});
		}
	}
	var popup = Popups.activePopup();
	if(popup != undefined){
		popup.close();
	}
}

// Add external tool to attachment container
function sExternalToolAddAttachmentObj(obj) {
  var i = sExternalToolAddAttachmentObj.counter = ++sExternalToolAddAttachmentObj.counter || 1;
  window.sExternalToolFormSettings.attachments['et-' + i] = obj;

  var attachmentContainer = $('#attachments-added-container');
  var displayObject = '';
  displayObject += '<div class="external-tool-attachment resource-attachment">';
    displayObject += '<span class="delete-link"></span>';
    displayObject += '<span class="external-tool-value">';
      displayObject += '<span class="inline-icon external-tool-icon"><span class="icon-placeholder"></span></span>';
      displayObject += '<span class="external-tool-title"></span>';
      displayObject += '<span></span>';
    displayObject += '</span>';
  displayObject += '</div>';
  attachmentContainer.append(displayObject);
  $('.external-tool-attachment:last .external-tool-title', attachmentContainer).text(obj.title);

  $('.external-tool-attachment:last .delete-link', attachmentContainer).click(function(){
    delete window.sExternalToolFormSettings.attachments['et-' + i];
    $('#edit-external-tools').val( JSON.stringify(window.sExternalToolFormSettings.attachments) );
    $(this).parents('.external-tool-attachment:first').remove();
    sPopupsResizeCenter();
  });
  $('#edit-external-tools').val( JSON.stringify(window.sExternalToolFormSettings.attachments) );
}

/**
 * Helper to check if grade item form should show due date warning
 *
 * @param {object} form
 * @return {boolean}
 */
function sExternalToolShouldShowDueDateWarning(form) {
  // This would mean s_common_date_helper.js wasn't imported, make sure the date picker still works.
  if (typeof sCommonShouldShowDueDateWarning === "undefined") {
    return false;
  }

  return sCommonShouldShowDueDateWarning(
    $("input[name='external_tool[grading_enabled]']", form),
    $("select[name='external_tool[grading][grading_period]']", form),
    $("input[name='external_tool[grading][due_date][date]'], .csm-due-date:visible", form)
  );
}

/**
 * Helper to add the due date warning
 *
 * @param {object} form
 */
function sExternalToolAddDueDateWarning(form) {
  var gradePeriodField = $("select[name='external_tool[grading][grading_period]'] :selected", form);
  var siblingElement = $("#edit-external-tool-grading-grading-period-wrapper", form).first();
  var warningText = sCommonDateDueDateWarningText(gradePeriodField);
  sCommonDateAddDueDateWarning(warningText, siblingElement, form);
}

/**
 * Helper to hide/show Consumer Key & Shared Secret based on whether Tool Provider
 *  is linked to an LTI 1.3 app or not
 * @param formElm
 * @param isLti13ToolProvider
 * @param clearSharedSecretButton
 * @param selectProviderInputValue
 */
function sExternalToolHandleConsumerKeySecret(formElm, isLti13ToolProvider, clearSharedSecretButton, selectProviderInputValue) {
  var consumerKeyWrapper = $("#edit-external-tool-consumer-key-wrapper", formElm);
  var secretKeyWrapper = $("#edit-external-tool-shared-secret-wrapper", formElm);
  if(isLti13ToolProvider) {
    consumerKeyWrapper.hide();
    secretKeyWrapper.hide();
  } else {
    consumerKeyWrapper.show();
    secretKeyWrapper.show();
    var sharedSecretField = $("#edit-external-tool-shared-secret", formElm);
    addClearButtonClass(sharedSecretField, clearSharedSecretButton, selectProviderInputValue);
  }
}

function displayErrorMessage(message) {
  var errorMessage = Drupal.theme.sAjaxMessage(Drupal.t(message), 'error');
  $('.s-external-tool-attachment-wrapper').before(errorMessage);
  sPopupsResizeCenter();
}
