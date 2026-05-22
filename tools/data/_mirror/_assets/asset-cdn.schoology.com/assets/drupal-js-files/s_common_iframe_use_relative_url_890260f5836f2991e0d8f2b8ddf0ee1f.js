Drupal.behaviors.sCommonMediaFileIframeUseRelativeUrl = function(context) {
  
  // Matches paths such as '/media/ifr/1026136881', '/media/ifr/1026132513', etc. in fully-qualified URLs only (SGY-23086)
  var $mediaFileRe = /^\/?media\/ifr\/\d+$/;

  // Matches paths such as '/media/ifr_ext?url=https%3A%2F%2Fiaabccontent.org%2Fdocs%2Fcourses%2Fvideos%2FDefensiveHandling-web.mp4' in fully-qualified URLs only (SGY-25009)
  var $mediaFileExtRe = /^\/?media\/ifr_ext$/;

  $("#main iframe:not(.sCommonMediaFileIframeUseRelativeUrl-processed), .s-page-container iframe:not(.sCommonMediaFileIframeUseRelativeUrl-processed)," +
    ".template-fields iframe:not(.sCommonMediaFileIframeUseRelativeUrl-processed)", context).addClass('sCommonMediaFileIframeUseRelativeUrl-processed').each(function(){

    // If the source of this iframe appears to be a Schoology media file, make the source URL relative.
    var iframeObj = $(this);
    var iframeSrc = iframeObj.attr('src');

    // Create an element to leverage URL parsing (https://gist.github.com/jlong/2428561)
    var parser = document.createElement('a');
    parser.href = iframeSrc;

    var pathName = parser.pathname;
    var $match = $mediaFileRe.exec(pathName);
    if (!$match){
      $match = $mediaFileExtRe.exec(pathName);
    }
    
    if($match){
      // In IE, the leading slash is not included in pathname, so we need to prepend
      // SGY-23250
      if(pathName[0] !== '/'){
        pathName = '/' + pathName;
      }

      // Add search string if present SGY-25009
      if(parser.search){
        pathName += parser.search;
      }
      iframeObj.attr('src', pathName);
    }
  });
}