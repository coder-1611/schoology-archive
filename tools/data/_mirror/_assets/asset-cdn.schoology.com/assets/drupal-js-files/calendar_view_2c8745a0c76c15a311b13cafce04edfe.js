Drupal.behaviors.sCalendarView = function(context){
	
	var iCalInfoWrapper = $('#ical-feed-info');
	var iCalOptions = $('.ical-options', iCalInfoWrapper);
	var iCalLink = $('.ical-feed-link', iCalInfoWrapper);
	$('.subscribe .enabled', iCalInfoWrapper).bind('click', function(){
		iCalOptions.hide();
		iCalLink.show();
	});
	
	$('.back-btn', iCalLink).bind('click', function(){
		iCalLink.hide();
		iCalOptions.show();
	});
	
	$('.week-view:not(.sCalendarView-processed)', context).addClass('sCalendarView-processed').each(function(){
	  var weekView = $(this);
	  
	  if(weekView.height() < 450){
	    // don't add top scrollbar if too short
	    return; 
	  }
	  
	  $('.calendar-calendar').addClass('has-upper-scroll');
	  
	  var weekViewTopScroll = $('<div></div>').addClass('week-view-top-scrollbar');
	  // insert a table and match the width of the main table
	  weekViewTopScrollTbl = $('<table></table>').width($('table', weekView).width()).prepend($('table thead', weekView).eq(0).clone());
	  weekViewTopScroll.append(weekViewTopScrollTbl);
	  weekView.before(weekViewTopScroll);
	  
	  weekViewTopScroll.scroll(function(){
	    weekView.scrollLeft(weekViewTopScroll.scrollLeft());
	  });
	  
	  weekView.scroll(function(){
      weekViewTopScroll.scrollLeft(weekView.scrollLeft());
      
    });

	  function getScrollBarWidth () {
	    var inner = document.createElement('p');
	    inner.style.width = "100%";
	    inner.style.height = "200px";

	    var outer = document.createElement('div');
	    outer.style.position = "absolute";
	    outer.style.top = "0px";
	    outer.style.left = "0px";
	    outer.style.visibility = "hidden";
	    outer.style.width = "200px";
	    outer.style.height = "150px";
	    outer.style.overflow = "hidden";
	    outer.appendChild (inner);

	    document.body.appendChild (outer);
	    var w1 = inner.offsetWidth;
	    outer.style.overflow = 'scroll';
	    var w2 = inner.offsetWidth;
	    if (w1 == w2) w2 = outer.clientWidth;

	    document.body.removeChild (outer);

	    return (w1 - w2);
	  };
	});
	// Trigger click on Space for Import and Export
	$('.ical-popup, .ical-popup-import', context).on('keydown', function(event) {
		if (isSpaceKeyEvent(event)) {
		  event.preventDefault();
		  $(this).trigger('click');
		}
	});
}