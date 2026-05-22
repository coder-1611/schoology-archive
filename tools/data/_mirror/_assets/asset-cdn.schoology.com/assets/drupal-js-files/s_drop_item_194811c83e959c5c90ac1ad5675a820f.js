Drupal.behaviors.sDropItem = function(context){
  sDropUploads = [];
  sDropsel_ids = new Array();

  // ajax behavior for dropbox filter select
  $('.drop-items:not(.sDropItem-processed)', context).addClass('sDropItem-processed').each(function(){
    var wrapper = $(this);
    var dropbox = $('.drop-item-display-all', wrapper);

    $('.dropbox-download-all', dropbox).tipsy({
     gravity: 's'
    });
  });

  $('.item-list:not(.sDropItem-processed)', context).addClass('sDropItem-processed').each(function() {
    var reactElements = $('.portfolio-add-submission-btn-wrapper', this).toArray();
    if (reactElements.length) {
      window.sgyModules.bootstrapReactApp({appInstanceIndex: 'sgyPortfolioComponents'})
        .then(function() {
          $.each(window.addtoPFLBtnRenders, function(){this()});
          window.addtoPFLBtnRenders = null;
        });
    }

    $(this).on('click', 'a.dropbox-view-link', function() {
      Popups.removeLoading();
      window.scrollBy(0,-100000);
      Popups.addLoading();
    });
  });

  $('#dropbox-submitted-filter:not(.sDropItem-processed)', context).addClass('sDropItem-processed').each(function(){
    var filter = $(this);
    var wrapper = filter.closest('.drop-items');
    var dropbox = $('.drop-item-display-all', wrapper);
    var csmToggle = $('.csm-toggle-sections', wrapper);
    var dropdownMenu;
    if (document.dir === "rtl") {
      dropdownMenu = $(this).selectmenu({
        style: 'dropdown',
        align: 'left'
      });
    } else {
      dropdownMenu = $(this).selectmenu({
        style: 'dropdown',
        align: 'right'
      });
    }

    dropdownMenu.change(function(){
      $('.right-block-big', dropbox).html('<img src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" alt="' + Drupal.t('Loading...') + '" />');

      var ajaxUrl = '/assignment/'+(location.pathname.split('/')[2])+'/dropbox/users_ajax?submission_status=' + $(this).val();
      if(csmToggle.length){
        ajaxUrl += '&csm_section_nid=' + csmToggle.select2('data').id;
      }

      $.ajax({
        type: "GET",
        url: ajaxUrl,
        dataType: "json",
        success: function(json){
          var output = $(json);
          Drupal.attachBehaviors(output);
          $('.right-block-big', dropbox).empty().append(output);
        }
      });
    });
  });


  $('.drop-item-display-all ul:not(.sDropItem-processed), .dropbox-filter-ajax-response ul:not(.sDropItem-processed)', context).addClass('sDropItem-processed').each(function(){
    var wrapper = $(this);
    $('li', wrapper).tipsy({
      html: false,
      gravity: $(document).attr("dir") === 'rtl' ? 'w' : 'e'
    });
  });

  $('.drop-item-display-own ul:not(.sDropItem-processed)', context).addClass('sDropItem-processed').each(function(){
    var wrapper = $(this);
    $('li', wrapper).tipsy({
      html: false,
      gravity: $(document).attr("dir") === 'rtl' ? 'w' : 'e'
    });
  });

  // Submit Assignment behavior
  $('#s-drop-item-submit-wrapper:not(.sDropItem-processed)', context).addClass('sDropItem-processed').each(function(){
    var wrapper = $(this);

    $('.popups-tabs li', wrapper).each(function(){
      $(this).bind('click',function(){
        var selectedTab = $(this);
        var id = selectedTab.attr('id');

        if( id =='dropbox-submit-create-tab' )
          $('#edit-submission_tbl').css('width','100%');

        $('.popups-tabs li.active', wrapper).not(selectedTab).removeClass('active');
        selectedTab.addClass('active');

        var selectedContent = $('#' + id + '-content' , wrapper );

        $('.popups-tab-content', wrapper).not(selectedContent).removeClass('visible');
        selectedContent.addClass('visible');

        if( id =='dropbox-submit-create-tab' ) {
          var activeEditorId = tinyMCE.activeEditor.id;
          tinyMCE.execCommand('mceRemoveControl', true, activeEditorId);
          tinyMCE.execCommand('mceAddControl', true, activeEditorId);
        }

        popup = Popups.activePopup();
        var popupId = popup.id;
        $('#' + popupId + ' .popups-title .title').html(selectedTab.html());

        if(popup != null){
          var popupObj = popup.$popup();
          var classes = {
            'popups-compose': 'dropbox-submit-create-tab',
            'popups-library': 'dropbox-submit-resources-tab'
          };
          // only set the popupObj to have the class associated with the current tab, remove all other classes
          $.each(classes, function(className, tabId){
            if(id == tabId){
              popupObj.addClass(className);
            }
            else{
              popupObj.removeClass(className);
            }
          });
          Popups.resizeAndCenter(popup);
        }
      })
    });

    // remove embedding features from tinyMCE
    $('.tinymce-ext-buttons'  , wrapper).empty();

    // this is to allow the tinymce editor to steal focus for a quick moment;
    // otherwise, other textareas cannot be edited in IE
    setTimeout("$('#s-drop-item-submit-wrapper .popups-tabs li:eq(0)').click()", 1);

    //Fairly hacky way of ensuring we only rebind the Popups error handler once
    $('body:not(.sDropItem-processed)').addClass('sDropItem-processed').each(function(){
      var popupErrorFunc = Popups.errorMessage;
      Popups.errorPassthru = function ($form) {
        var formId = $form.attr('id');
        if (formId === "s-drop-item-submit-create-form") {
          Popups.message(
            Drupal.t('Submission Error'),
            '<p>' + Drupal.t('There was an error submitting your assignment. A draft of your assignment was saved in the Submissions panel.') + '</p>' +
            '<p>' + Drupal.t('Please try submitting again in a few minutes.') + '</p>'
          );
        }
        else {
          newArgs = Array.from(arguments);
          popupErrorFunc(...newArgs.slice(1));
        }
      }
    });

    //Hijack the popups "before submit" event to bind the form being submitted to the error handler closure
    //This allows us to display a custom error message for submissions created within the RTE
    $(document).one('popups_before_submit', function(event, formData, $form, options) {
      Popups.errorMessage = Popups.errorPassthru.bind(this, $form);
    });
  });
}

/**
 * Callback for drop item submission form.
 * Force the load of JavaScript from the response body.
 *
 * @param data
 * @param options
 * @param element
 */
function sDropItemSubmissionCallback(data, options, element) {
  Popups.addInlineJS(Popups.addJS(data.js));
}
