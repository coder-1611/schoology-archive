var wait_image = '/sites/all/themes/schoology_theme/images/ajax-loader.gif';
var wait_image_width = 43;
var wait_image_height = 11;

/**
 * Ajax plugins callback
 *
 *
 * @param {String} hook
 * @param {Object} args
 * @return {Bool}
 */
Drupal.Ajax.plugins.s_update = (function(){
  var updateCounters = {};

  // posting an update will render the new update with an associated form
  // unfortunately, the id of the form will most likely clash with an existing form so this will need to be updated
  function getUpdateId(baseId){
    if(typeof updateCounters[baseId] == 'undefined'){
      updateCounters[baseId] = 1;

      var container = $('.s-edge-feed');

      // find the id with the highest number appended to the base id
      while(container.find('#' + baseId + '-' + updateCounters[baseId]).length > 0){
        updateCounters[baseId]++;
      }
    }

    return baseId + '-' + (updateCounters[baseId]++);
  }

  return function(hook, args) {
    switch(hook) {
      case 'submit':
        var submitter = args.submitter;
        var parentElement = submitter.parents().filter('#s-update-create-form, #s-update-create-combined-form');
        if(parentElement.length == 1) {
          var editor = tinymce.activeEditor;
          if(editor && parentElement.has(editor.getElement())){
            editor.save();
          }
          sUpdateDisableElement(submitter);
          sUpdateDisableElement(parentElement);
          sUpdateShowLoader(parentElement);
        }
      break;

      case 'message':

        // response received, return false to hide messages
        var submitter = args.local.submitter;
        var parentElement = submitter.parents().filter('#s-update-create-form, #s-update-create-combined-form');

        if(parentElement.length != 1)
          break;

        var validateOutput = args.ajax_validate_output;
        var submitOutput = args.ajax_submit_output;

        sUpdateEnableElement(submitter);
        sUpdateEnableElement(parentElement);
        sUpdateRemoveLoader(parentElement);

        var content = '';
        var announcement = '';

        // Display the submit output if set, otherwise display validate output
        if(submitOutput != undefined) {
          if(submitOutput.feeds){
            content = submitOutput.feeds;
            if(submitOutput.announcement) {
              announcement = submitOutput.announcement;
            }
            if(submitOutput.css) {
              sEdgeMoreAddCSS(submitOutput.css);
            }
            if(submitOutput.js) {
              sEdgeMoreAddJS(submitOutput.js);
            }
          }
          else{
            content = submitOutput;
          }
          sPollHidePollInterface();
        }
        else if(validateOutput != undefined) {
          content = validateOutput;
        }

        //append the new feed
        if(content.length > 0) {
          var contentObj = $(content);
          $('ul.s-edge-feed', contentObj).contents('li').each(function() {
            var item = $(this),
                itemForm = item.find('.post-comment-form'),
                newFormId = getUpdateId(itemForm.attr('id')),
                editComment = item.find('#edit-comment'),
                newCommentId = getUpdateId(editComment.attr('id'));
            itemForm.attr('id', newFormId);
            editComment.attr('id', newCommentId);

            //  make sure that any comment forms have the correct destination
            $('.s-comments-post-form>form', item).attr('action', Drupal.settings.basePath + Drupal.settings.s_edge.feed_url );

            // if the feed is empty, remove the empty message
            $("#feed-empty-message",$(".s-edge-feed")).remove();

            $(".s-edge-feed").prepend(item);
            item.effect("highlight", {color: "#e3ffd8"}, 3000);
          });

          Drupal.attachBehaviors($('.s-edge-feed'));
        }

        //append the announcement
        if(announcement){
          var contentTop = $('.content-top-wrapper');
          $('#important-post', contentTop).remove();
          var schoolName = $('.school-name', contentTop);
          schoolName.append(announcement);
          Drupal.attachBehaviors(schoolName);
        }

        // no validation errors
        if(args.status) {
          // reset form
          resetAttachmentForm();
          $("#toggle-copy").removeClass('active').siblings().hide();
          $("#edit-important").attr('checked', false);

          // for combined
          $("#edit-selected-realms").val('');
          $("#realms-container .selected-realm").remove();

          // not needed/available for non-combined
          if( Drupal.settings.s_home && Drupal.settings.s_home.valid_realms_list )
            $("#edit-realms").data('selected', []).setOptions({data: Drupal.settings.s_home.valid_realms_list});

          // unset all checked copy to courses
          $("#copy-to-courses input[type='checkbox']",parentElement).attr('checked',false);

          // set parent edge checkbox back to default which is checked
          $('#edit-parent-edge', parentElement).attr('checked', true);

          // reset the textarea
          var editor = tinymce.activeEditor;
          if(editor && parentElement.has(editor.getElement())){
            editor.setContent('');
            editor.save();
            editor.focus();
          }
          else{
            $('#edit-body', parentElement).val('').focus();
          }
        }

        if($('.s-polls-create-poll', parentElement)){
          sPollClearPollFields(parentElement);
        }

        if(sIsset(window.sHomeSmartBoxRealmSelectionSetDefaults)){
          var selectedRealm = $("#browse-realms", parentElement).find("input:checked");
          var realmChooser = $('#edit-realms', parentElement);
          sHomeSmartBoxRealmSelectionSetDefaults(selectedRealm, realmChooser);
        }
      break;
    }

    return true;
  }
}());

//Display the given element
function sUpdateDisableElement(element){
  // for some reason messes up in IE7
  if(!element.is('input')) sUpdateSetOpacity(element, .3);

  element.addClass('disabled-element');
  element.attr('disabled', 'disabled');
}

// Enable the given element
function sUpdateEnableElement(element) {
  // for some reason messes up in IE7
  if(!element.is('input')) sUpdateSetOpacity(element, 1);

  element.removeClass('disabled-element');
  element.attr('disabled', false);
}

// Set cross-browser opacity (0-1)
function sUpdateSetOpacity(element, alpha) {
  element.css({
   'filter' : 'alpha(opacity='+(alpha*100)+')',
   '-moz-opacity' : alpha,
   '-khtml-opacity' : alpha,
   'opacity' : alpha
  });
}

// Show the ajax loader
function sUpdateShowLoader(element) {
  var left = ( element.width() / 2 ) - ( wait_image_width / 2 );
  var top = ( element.height() / 2 ) - ( wait_image_height / 2 );
  element.before('<div id="ajax_loader" style="position:relative"><div style="position:absolute; left:' + left +'px; top:' + top +'px; "><img src="' + wait_image + '" alt="' + Drupal.t('Loading') + '" /></div></div>');
}

// Remove the ajax loader
function sUpdateRemoveLoader(){
  $('#ajax_loader').remove();
}
