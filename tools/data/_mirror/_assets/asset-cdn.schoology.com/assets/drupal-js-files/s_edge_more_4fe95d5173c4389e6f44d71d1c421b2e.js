
Drupal.behaviors.sEdgeMore = function(context) {
  var sEdgeInitialClick = false;
  $('.s-edge-feed-more-link a:not(.sEdgeMore-processed)', context).addClass('sEdgeMore-processed').each(function() {
	  var moreLink = $(this);
	  var moreLi = moreLink.parent();
	  sEdgeSetupMoreLink(moreLink, moreLi, 's-edge-feed');

    // if no items loaded initially but there ARE items
    // to be loaded, then click the "more" link automatically
    if(!sEdgeInitialClick && moreLi.prevAll().length == 0){
      moreLi.closest('.s-edge-feed').addClass('initial-load');
      sEdgeInitialClick = true;
      moreLink.click();
    }
  });

  $('.notif-more a:not(.sEdgeMore-processed)', context).addClass('sEdgeMore-processed').each(function(){
	 var moreLink = $(this);
	 var moreLi = moreLink.parent();
	 sEdgeSetupMoreLink(moreLink, moreLi, 's-notifications-mini');
  });

}

function sEdgeSetupMoreLink(moreLink, moreLi, ulClass) {
  var $lastEdgeItem = moreLi.prev(),
      $feed = moreLi.closest('.' + ulClass);

  moreLi.hide();

  moreLink.bind('click', function(){
    var href = moreLink.attr('href');
    moreLink.replaceWith('<img tabindex="0" src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" alt="' + Drupal.t('Loading') + '" class="more-loading" />');
    moreLi.find('img').trigger('focus');

    $.ajax({
      url: href,
      dataType: 'json',
      success: function( json , status , xhr ){
        // Add additional CSS to the page.
        sEdgeMoreAddCSS(json.css);

        // when loading from the cdn, IE's XDomainRequest object does not allow for synchronous requests
        // as a result, we need to provide a callback to be executed when all the js files have been loaded
        sEdgeMoreAddJS(json.js, function(){
          var edgeWrapperObj = moreLi.closest('.edge-wrapper');
          edgeWrapperObj.show();

          var newEdgeItems = $('ul.' + ulClass, json.output).html();
          moreLi.replaceWith( newEdgeItems );

          // Test to see if this is the initial load or not
          if(!$feed.hasClass('initial-load')) {
            // Focus the first focusable item in the newly added items
            $lastEdgeItem.next().find('*').filter(Drupal.sAccessibility.focusableElementsString).filter(':visible').eq(0).trigger('focus');
          } else {
            $feed.removeClass('initial-load');
          }

          Drupal.attachBehaviors( edgeWrapperObj );
          if($('.s-notifications-mini').length > 0){
            Drupal.attachBehaviors( '.s-notifications-mini' );
          }
        });
      },
      error: function (jqXHR, textStatus, errorThrown) {
        if (jqXHR.status === 429) {
          moreLi.html('<li id="feed-empty-message" class="first last"><div class="small gray">' + Drupal.t('There are no posts') + '</div></li>');
        }
      }
    });

    return false;
  });

  moreLi.show();
}
