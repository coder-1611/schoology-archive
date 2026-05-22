Drupal.behaviors.sPageNav = function(context){
	$('.s-page-nav-wrapper .slide-toggler:not(.sPage-processed)', context).addClass('sPage-processed').each(function(){
		var toggler = $("a", $(this));
		toggler.bind('click', function(){
			var wrapper = $(this).parent().parent().parent();
			if(wrapper.width() == '20'){
				wrapper.animate({width: '250px'}, 400, 'easeInOutQuint', function(){
					wrapper.addClass('open');
				});
			}
			else{
				wrapper.animate({width: '20px'}, 400, 'easeInOutQuint', function(){
					wrapper.removeClass('open');
				});
			}
			return false;
		});
	});
	
	$('.page-menu .action-links-wrapper:not(.sPage-processed)', context).addClass('sPage-processed').each(function () {
		$(this).sActionLinks(
				{
					hidden: false,
					wrapper: '.action-links-wrapper'
				}
		);
	});
	
	$('.s-page-nav .action-links-wrapper:not(.sPage-processed)', context).addClass('sPage-processed').each(function () {
		$(this).sActionLinks(
				{
					hidden: false,
					wrapper: '.action-links-wrapper'
				}
		);
	});
}