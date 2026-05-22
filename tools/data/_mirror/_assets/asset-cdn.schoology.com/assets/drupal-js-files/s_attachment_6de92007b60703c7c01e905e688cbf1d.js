Drupal.behaviors.sAttachment = function(context){
  $('.attachments-video-thumbnails-play:not(.sAttachment-processed)', context).addClass('sAttachment-processed').each(function(){
      var btn = $(this);
      btn.bind('click', function(){
        var wrapper = btn.parents(".attachments-video");
        var video = $(".video-video", wrapper);
        wrapper.after(video);
        video.show();
        wrapper.hide();
        thePopup = Popups.activePopup();
        if(thePopup != null){
			Popups.resizeAndCenter(thePopup);
        }
        return false;
      });
  });

  $('.embed-cover:not(.sAttachment-processed)', context).addClass('sAttachment-processed').each(function(){
    $(this).click(function(){
      var cover = $(this),
          embedContentObj = cover.siblings('.embed-content:first');
      cover.hide();
      cover.siblings('.embed-title').hide();

      var youtubeDisclaimer = document.getElementById('youtube-disclaimer');
      if (youtubeDisclaimer) {
        // show youtube disclaimer
        youtubeDisclaimer.style.display = 'block';
      }

      // iframes get wrapped in comments to prevent autoloading
      if(embedContentObj.length){
        var embedNode = embedContentObj.get(0),
            embedContentHTML = null;
        embedContentObj.show();
        $.each(embedNode.childNodes, function(k, node){
          // 8 is COMMENT_NODE (the constants are not properly named as document.COMMENT_NODE in every browser)
          if(node.nodeType == 8){
            embedContentHTML = node.nodeValue;
          }
        });
        if(embedContentHTML){
          embedContentObj.html(embedContentHTML);
        }
      }
    });
  });

  $('.attachments-link:not(.sAttachment-processed)', context).addClass('sAttachment-processed').each(function(){
      var link = $(this);
      var intPopup = $('.attachment-link-popup', link);
      link.bind('mouseenter', function(){
	      if(intPopup.length)
	    	  intPopup.show();
      }).bind('mouseleave', function(){
    	  if(intPopup.length)
    	    intPopup.hide();
      });
      //hide the popup if the user goes from the tip arrow in
      intPopup.bind('mouseenter', function(){
        $(this).hide();
      });
  });

  $('.s-app-lti-window-launch:not(.sAttachment-processed)', context).addClass('sAttachment-processed').each(function(){
    var link = $(this);
    link.attr("target", "_blank");
  });
}

