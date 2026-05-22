Drupal.behaviors.sCourseIframeResize = function(context) {
  $("#main iframe:not(.sCourseIframeResized-processed)", context).addClass('sCourseIframeResized-processed').each(function(){
      // Resize the iframe so it takes up the maximum height remaining in the viewport after
      // taking into account the header (#header), breadcrumbs area (#center-top), etc
      var iframeObj = $(this);
      $(window).resize(function() {
        var newHeight = $(this).height();
        $('#header, #center-top:visible').each(function() {
          newHeight -= $(this).outerHeight();
        });
        newHeight -= parseInt(iframeObj.css('margin-top'));
        iframeObj.height(newHeight);
      }).trigger('resize');
  });
}

