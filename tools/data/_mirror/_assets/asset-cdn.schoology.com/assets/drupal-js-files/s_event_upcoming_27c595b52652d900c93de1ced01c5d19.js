Drupal.behaviors.sEventUpcoming = function(context){
  let overdueWrapper = $('.overdue-submissions-wrapper');

  $('.upcoming-events-wrapper:not(.sEventUpcoming-processed)' , context ).addClass('sEventUpcoming-processed').each(function(){

    $(this).on('click', 'a.expander', function(e){
      var subeventObj = $( ".events-hidden" , $(this).closest('.upcoming-event'));
      if(subeventObj.is(":hidden"))
        subeventObj.show();
      else
        subeventObj.hide();

      e.preventDefault();
    });
  });

  // Filters out past events (or not yet overdue submissions) and excess future events.
  // This allows HTTP caching to be used while still displaying the correct upcoming events.
  $('.upcoming-list .date-header:not(.sEventUpcoming-processed)', context)
    .addClass('sEventUpcoming-processed')
    .each(function () {
      let isOverdueSubmissionsList = context.attr !== undefined && context.attr('id') === 'overdue-submissions';

      // Per requirements of SGY-10439:
      // The events are grouped by days - the last day returned should contain all of the events of that day
      // even if this exceeds the number of events that should normally be returned.
      const maxEvents = 10;
      if (!isOverdueSubmissionsList && $('.upcoming-event:not(.hidden):not(.nested)', context).length >= maxEvents) {
        return;
      }

      let now = convertJsTimestampToPhp(Date.now());
      let dateHeader = $(this);
      let event = dateHeader.next('.upcoming-event');
      while (event.length) {
        let start = event.data('start');
        let locked = event.data('locked');
        if (isOverdueSubmissionsList) {
          if ((start === '' || start <= now) && (!locked || now < locked)) {
            overdueWrapper.removeClass('hidden');
            dateHeader.removeClass('hidden');
            event.removeClass('hidden');
          }
        } else {
          if (start === '' || start > now) {
            dateHeader.removeClass('hidden');
            event.removeClass('hidden');
          }
        }
        event = event.next('.upcoming-event');
      }
    });

  function convertJsTimestampToPhp(timestamp) {
    return timestamp / 1000;
  }
}
