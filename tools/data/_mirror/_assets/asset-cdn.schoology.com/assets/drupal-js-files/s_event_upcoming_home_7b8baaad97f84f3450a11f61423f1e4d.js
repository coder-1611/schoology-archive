Drupal.behaviors.sEventUpcoming = function(context){
  let counters = {
    overdue_submissions: 0,
    upcoming_events: 0,
    upcoming_submissions: 0,
    total_overdue: 0
  };
  const EXCEPTION_MISSING = 3;

  let upcomingWrapper = $('.upcoming-submissions-wrapper');
  let overdueWrapper = $('.overdue-submissions-wrapper');
  let todoWrapper = $('.todo-wrapper');

  // Filters out past events (or not yet overdue submissions) and excess future events.
  // This allows HTTP caching to be used while still displaying the correct upcoming events.
  $('.upcoming-list .date-header:not(.sEventUpcoming-processed)', context)
    .addClass('sEventUpcoming-processed')
    .each(function () {
      let dateHeader = $(this);
      let eventType = dateHeader.attr('id');

      let isOverdueSubmissionsList = eventType === 'overdue_submissions';
      let isUpcomingEventsList = eventType === 'upcoming_events';

      // Per requirements of SGY-10439:
      // The events are grouped by days - the last day returned should contain all of the events of that day
      // even if this exceeds the number of events that should normally be returned.
      let maxEvents = 7;

      if (isOverdueSubmissionsList) {
        maxEvents = 3;
      }

      let showEventsForDay = false;

      if (!isOverdueSubmissionsList && counters[eventType] >= maxEvents) {
        return;
      }

      let now = convertJsTimestampToPhp(Date.now());
      let event = dateHeader.next('.upcoming-event');

      while (event.length) {
        let start = event.data('start');
        let locked = event.data('locked');
        let exception = event.data('exception');

        if (isOverdueSubmissionsList) {
          if ((start === '' || start <= now || (start > now && Number(exception) === EXCEPTION_MISSING)) && (!locked || now < locked)) {
            counters["total_overdue"] += 1;
            if (counters[eventType] < maxEvents) {
              showEventsForDay = true;
            }

            if (showEventsForDay) {
              event.removeClass('hidden-important');
              overdueWrapper.removeClass('hidden');
              todoWrapper.removeClass('hidden');

              counters[eventType] += 1;
            }
          }
        } else if (start === '' || start > now) {
          if (isUpcomingEventsList) {
            dateHeader.removeClass('hidden');
          } else {
            upcomingWrapper.removeClass('hidden');
            todoWrapper.removeClass('hidden');
          }

          event.removeClass('hidden-important');

          counters[eventType] += 1;
        }

        event = event.next('.upcoming-event');
      }
    });

  $('.upcoming-list .upcoming-events-popup:not(.sEventUpcoming-processed)', context)
    .addClass('sEventUpcoming-processed')
    .each(function () {
      let moreOverdue = $(this);
      let moreOverdueText = counters["total_overdue"] - counters['overdue_submissions'];
      if (moreOverdueText > 0) {
        moreOverdue.text(moreOverdueText + " " + Drupal.settings.more_overdue);
        moreOverdue.removeClass('hidden-important');
      }
    });

  $('.upcoming-list-popup .date-header', context)
    .each(function () {
      let dateHeader = $(this);

      let now = convertJsTimestampToPhp(Date.now());
      let event = dateHeader.next('.upcoming-event');

      while (event.length) {
        let start = event.data('start');
        let locked = event.data('locked');
        let exception = event.data('exception');

        if ((start === '' || start <= now || (start > now && Number(exception) === EXCEPTION_MISSING)) && (!locked || now < locked)) {
          event.removeClass('hidden-important');
        }

        event = event.next('.upcoming-event');
      }
    });

  function convertJsTimestampToPhp(timestamp) {
    return timestamp / 1000;
  }
}
