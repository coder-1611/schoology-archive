var sFCalendarSmartBox;
var sFCalendarEventForm;
var sFCalendarAssignmentForm;
var sFCalendarForceReloadOnClose = false;
var sFCalendarDayClickIsAllDay;
var sFCalendarFilterMenu;
var sFCalendarEventFormSettings;
var sFCalendarAssignmentFormSettings;

Drupal.behaviors.sFCalendarMonth = function(context){
  // smart box popup
  $('#calendar-page-smartbox:not(.sFCalendarMonth-processed)', context).addClass('sFCalendarMonth-processed').each(function(){
      var smBox = $(this);
      if($(this).hasClass('no-access')){
        $('body').addClass('no-event-create-tabs');
      }

      sFCalendarSmartBox = $(this).remove();
      sFCalendarSmartBox.removeClass('hidden');
    });

  // edit event popup
  $('.edit-calendar-event:not(.sFCalendarMonth-processed)', context).addClass('sFCalendarMonth-processed').each(function(){
       $(this).click(function(event){
         event.preventDefault();

         // this might not be the best place for it, but we don't re-apply 'view-modes' if the popup is notdone (eg, validation error)
         $(document).unbind('popups_form_success_notdone.s_event_fcalendar').bind('popups_form_success_notdone.s_event_fcalendar',function(){
           $(document).trigger('popups_open_path_done.s_tinymce');
         });

        // Focus the error element after TinyMCE finishes initialising so AT announces it.
        // role="presentation" on list elements prevents VoiceOver from saying "N more items".
        $(document).unbind('popups_form_success_notdone.s_event_aria').bind('popups_form_success_notdone.s_event_aria', function(event, updatedPopup) {
          var popupId = updatedPopup && updatedPopup.id;
          if (!popupId) { return; }

          var done = false;
          function focusErrors() {
            if (done) { return; }
            var $target = $('#' + popupId).find('.message-text[aria-invalid="true"]').first();
            if (!$target.length) { return; }
            done = true;
            $target.find('ul, ol').attr('role', 'presentation');
            $target.find('li').attr('role', 'presentation');
            $target.attr('aria-label', $target.text().replace(/\s+/g, ' ').trim());
            $target.focus();
          }

          var active_editor_id = $(document).data('sTinymcePopupActiveEditors');
          if (typeof tinyMCE !== 'undefined' && active_editor_id) {
            // sTinymcePopupActiveEditors is a comma-separated list of editor ids.
            var editorIds = active_editor_id.split(',');
            var onAddEditorHandler = function(mgr, ed) {
              if (editorIds.indexOf(ed.id) !== -1) {
                ed.onInit.add(function() {
                  tinyMCE.onAddEditor.remove(onAddEditorHandler);
                  focusErrors();
                });
              }
            };
            tinyMCE.onAddEditor.add(onAddEditorHandler);
            setTimeout(function() {
              tinyMCE.onAddEditor.remove(onAddEditorHandler);
              focusErrors();
            }, 1000);
          } else {
            focusErrors();
          }
        });

         let calendarPopUpAdd = '';

         if($('.template-title .event-icon').length){
           calendarPopUpAdd = 'calendar-popup-add';
         }

         var dest = sFCalendarGetEventSourceUrl();
         var options = Popups.options({
           disableInputFocus: true,
           href: $(this).attr('href')+'?calendar_realm='+ sFCalendarGetRealmPath().realm +'&calendar_realm_id='+ String(sFCalendarGetRealmPath().realm_id) +'&destination='+dest,
           extraClass: 'popups-large ' + calendarPopUpAdd,
           hijackDestination: false,
           updateMethod: 'callback',
           onUpdate: 'sFCalendarPopupOnUpdate',
           doneTest: new RegExp(dest,'g')
         });
         // for the realm profile pages, the calendar is in a popup
         if(Popups.activePopup()) {
           Popups.openPath($(this), options, Popups.activePopup());
         }
         else {
           Popups.openPath($(this), options, window);
         }
       });
    });

  // This should be done everytime a smartbox popup is opened
  $('#calender-smartbox-tabs:not(.sFCalendarMonth-processed)', context).addClass('sFCalendarMonth-processed').each(function(){
      if($('body').hasClass('no-event-create-tabs')){
        return;
      }
      $('.calendar-form-tab', $(this)).each(function(){
        $(this).click(function(){
          var tabObj = $(this);
          var tabIdParsed = tabObj.attr('id').split('-');
          var itemType = tabIdParsed[3];
          var formNum = tabIdParsed[4];
          $('.calendar-form-tab.active').removeClass('active');
          tabObj.addClass('active');
          sFCalendarLoadForm(formNum, itemType);
          $('.popups-title .title' , tabObj.closest('.popups-box') ).text( itemType == 'event' ? Drupal.t('Create Event') : Drupal.t('Create Assignment'));
        });
      })
    });
  // Realm (user/group/course/school) FullCalendar
  $('#fcalendar:not(.fcalendar-advisor,.sFCalendarMonth-processed)', context).addClass('sFCalendarMonth-processed').each(function(){
        // Calendar is already present
        if($('#fcalendar').fullCalendar('getView').title != undefined) {
            return;
        }

        // Did we set year and month for the calendar on the server?
        var y = $(this).attr('data-year');
        var m = $(this).attr('data-month');

        // If not, just use right meow
        if(y == undefined || m == undefined){
          var now = new Date();
          y = y == undefined ? now.getFullYear() : y;
          m = m == undefined ? now.getMonth() : m;
        }

        var getRealmPathURI = sFCalendarGetRealmPath();
        if(getRealmPathURI.realm == 'user' && sFCalendarFilterMenu == undefined && Drupal.settings.s_event != undefined) {
          sFCalendarFilterMenu = Drupal.settings.s_event.filter_menu;
        }

        $('#fcalendar').fullCalendar({
                header: {
                    left: 'prev,next today',
                    center: 'title',
                    //right: 'month,basicWeek,basicDay'
                    right: 'month,agendaWeek,agendaDay'
                },

                viewDisplay: function(view) {
                    $('.fc-day-number').unbind('click', sFCalendarGoToDayView);
                    $('.fc-day-number').bind('click', sFCalendarGoToDayView);
                    $('#fcalendar .fc-day-number').addClass('clickable');
                    $('.fc-agenda-divider').next().addClass('calendar-agenda-body');
                    sPopupsResizeCenter();
                },
                year: y,
                month: m,
                timeFormat: 'h:mm tt',
                defaultEventMinutes: 60,
                weekMode: 'variable',
                monthNames: [Drupal.date_t('January', 'month_name'),Drupal.date_t('February', 'month_name'),Drupal.date_t('March', 'month_name'),Drupal.date_t('April', 'month_name'),Drupal.date_t('May', 'month_name'),Drupal.date_t('June', 'month_name'),Drupal.date_t('July', 'month_name'),Drupal.date_t('August', 'month_name'),Drupal.date_t('September', 'month_name'),Drupal.date_t('October', 'month_name'),Drupal.date_t('November', 'month_name'),Drupal.date_t('December', 'month_name')],
                monthNamesShort: [Drupal.date_t('January', 'month_abbr'),Drupal.date_t('February', 'month_abbr'),Drupal.date_t('March', 'month_abbr'),Drupal.date_t('April', 'month_abbr'),Drupal.date_t('May', 'month_abbr'),Drupal.date_t('June', 'month_abbr'),Drupal.date_t('July', 'month_abbr'),Drupal.date_t('August', 'month_abbr'),Drupal.date_t('September', 'month_abbr'),Drupal.date_t('October', 'month_abbr'),Drupal.date_t('November', 'month_abbr'),Drupal.date_t('December', 'month_abbr')],
                dayNames: [Drupal.date_t('Sunday', 'day_name'),Drupal.date_t('Monday', 'day_name'),Drupal.date_t('Tuesday', 'day_name'),Drupal.date_t('Wednesday', 'day_name'),Drupal.date_t('Thursday', 'day_name'),Drupal.date_t('Friday', 'day_name'),Drupal.date_t('Saturday', 'day_name')],
                dayNamesShort: [Drupal.date_t('Sunday', 'day_abbr'),Drupal.date_t('Monday', 'day_abbr'),Drupal.date_t('Tuesday', 'day_abbr'),Drupal.date_t('Wednesday', 'day_abbr'),Drupal.date_t('Thursday', 'day_abbr'),Drupal.date_t('Friday', 'day_abbr'),Drupal.date_t('Saturday', 'day_abbr')],
                buttonText: {
                    prev: '<span class="hidden-accessible">Previous</span><span aria-hidden="true">&nbsp;&#9668;&nbsp;</span>',
                    next: '<span class="hidden-accessible">Next</span><span aria-hidden="true">&nbsp;&#9658;&nbsp;</span>',
                    prevYear: '<span class="hidden-accessible">Previous</span><span aria-hidden="true">&nbsp;&lt;&lt;&nbsp;</span>',
                    nextYear: '<span class="hidden-accessible">Next</span><span aria-hidden="true">&nbsp;&gt;&gt;&nbsp;</span>',
                    today: Drupal.date_t('Today', 'date_nav'),
                    month: Drupal.date_t('Month', 'datetime'),
                    week: Drupal.date_t('Week', 'datetime'),
                    day: Drupal.date_t('Day', 'datetime'),
                },
                dayClick: sFCalendarEventAdd,
                eventClick: sFCalendarEventPreview,
                eventRender: sFCalendarEventRender,
                eventAfterRender: sFCalendarEventAfterRender,
                eventDrop: sFCalendarEventDrop,
                eventResize: sFCalendarEventResize,
                allDayText: Drupal.t('all-day'),

                events: '/'+ sFCalendarGetEventSourceUrl(y, m) + "?ajax=1"

        });

        sPopupsResizeCenter();

        // append filter menu to calendar header cell
        $('.s-event-fcalendar-filter-menu').appendTo('.fc-header-center');
    });

  // Advisor FullCalendar FullCalendar
  $('#fcalendar.fcalendar-advisor:not(.sFCalendarMonth-processed)', context).addClass('sFCalendarMonth-processed').each(function(){

      var y = $('#fcalendar').data('year');
      var m = $('#fcalendar').data('month');

      $('#fcalendar').fullCalendar({
        header: {
          left: 'prev,next today',
          center: 'title',
          right: 'month,agendaWeek,agendaDay'
        },
        viewDisplay: function(view) {
          $('.fc-day-number').unbind('click', sFCalendarAdvisorGoToDayView);
          $('.fc-day-number').bind('click', sFCalendarAdvisorGoToDayView);
          $('#fcalendar .fc-day-number').addClass('clickable');
          sPopupsResizeCenter();
        },
        year: y,
        month: m,
        timeFormat: 'h:mm tt',
        defaultEventMinutes: 60,
        weekMode: 'variable',
        monthNames: [Drupal.date_t('January', 'month_name'),Drupal.date_t('February', 'month_name'),Drupal.date_t('March', 'month_name'),Drupal.date_t('April', 'month_name'),Drupal.date_t('May', 'month_name'),Drupal.date_t('June', 'month_name'),Drupal.date_t('July', 'month_name'),Drupal.date_t('August', 'month_name'),Drupal.date_t('September', 'month_name'),Drupal.date_t('October', 'month_name'),Drupal.date_t('November', 'month_name'),Drupal.date_t('December', 'month_name')],
        monthNamesShort: [Drupal.date_t('January', 'month_abbr'),Drupal.date_t('February', 'month_abbr'),Drupal.date_t('March', 'month_abbr'),Drupal.date_t('April', 'month_abbr'),Drupal.date_t('May', 'month_abbr'),Drupal.date_t('June', 'month_abbr'),Drupal.date_t('July', 'month_abbr'),Drupal.date_t('August', 'month_abbr'),Drupal.date_t('September', 'month_abbr'),Drupal.date_t('October', 'month_abbr'),Drupal.date_t('November', 'month_abbr'),Drupal.date_t('December', 'month_abbr')],
        dayNames: [Drupal.date_t('Sunday', 'day_name'),Drupal.date_t('Monday', 'day_name'),Drupal.date_t('Tuesday', 'day_name'),Drupal.date_t('Wednesday', 'day_name'),Drupal.date_t('Thursday', 'day_name'),Drupal.date_t('Friday', 'day_name'),Drupal.date_t('Saturday', 'day_name')],
        dayNamesShort: [Drupal.date_t('Sunday', 'day_abbr'),Drupal.date_t('Monday', 'day_abbr'),Drupal.date_t('Tuesday', 'day_abbr'),Drupal.date_t('Wednesday', 'day_abbr'),Drupal.date_t('Thursday', 'day_abbr'),Drupal.date_t('Friday', 'day_abbr'),Drupal.date_t('Saturday', 'day_abbr')],
        buttonText: {
          prev: '&nbsp;&#9668;&nbsp;',
          next: '&nbsp;&#9658;&nbsp;',
          prevYear: '&nbsp;&lt;&lt;&nbsp;',
          nextYear: '&nbsp;&gt;&gt;&nbsp;',
          today: Drupal.date_t('Today', 'date_nav'),
          month: Drupal.date_t('Month', 'datetime'),
          week: Drupal.date_t('Week', 'datetime'),
          day: Drupal.date_t('Day', 'datetime'),
        },

        eventClick: sFCalendarAdvisorEventPreview,
        eventRender: sFCalendarAdvisorEventRender,
        eventAfterRender: sFCalendarAdvisorEventAfterRender,
        allDayText: Drupal.t('all-day'),

        events: "?ajax=1"
      });

    });
}


//
// Custom popup events (popups.js)
//


$(document).bind('popups_before_close', function(){
    var activePopup = Popups.activePopup();
    if(activePopup != null && $('#' + activePopup.id).hasClass('calendar-popup-mini') && sFCalendarForceReloadOnClose) {
        location.reload();
    }
    // Let's store the share-option-buttons in the DOM for later use, if not the will be removed from the DOM onPopupClose
    if(activePopup != null && $('#' + activePopup.id).hasClass('calendar-popup-mini')) {
      $(".share-calendar-option", $('#' + activePopup.id)).appendTo("#share-calendar-option-containter");
    }
});

$(document).bind('popups_open_done', function(){
    var activePopup = Popups.activePopup();
    var activePopupBody = $('#' + activePopup.id + ' .popups-body');
    if(activePopup.extraClass == 'browse-realm-popup') {
        var checkedRealmInputs = activePopupBody.find('input:checked');
        checkedRealmInputs.each(function(){
            if($('#' + $(this).attr('id').replace(/browse-realm-checkbox/, 'selected-realm')).length == 0) {
                $(this).attr('checked' , false);
            }
        });
    }
    // make sure popup resizes properly for large images
    if(activePopupBody.length) {
      $('img', activePopupBody).bind('load',function(){
        var popup = Popups.activePopup();
        Popups.resizeAndCenter(popup);
      });
    }
});


//
// Realm (user/group/course/school) FullCalendar callbacks
//


// Triggered while an event is being rendered. [workaround: HTML needed for title]
var sFCalendarEventRender = function (event, element) {
    var elmHTMLTitle = element.find('.fc-event-title');
    elmHTMLTitle.html(event.titleHTML);
    element.find('.fc-event-time').insertAfter(elmHTMLTitle);

    var getRealmPathURI = sFCalendarGetRealmPath();
    if(getRealmPathURI.realm == 'user') {
      var realm_key = event.realm + '-' + (event.realm != 'user' ? event.realm_id : getRealmPathURI.realm_id); // treat invites as Personal
      var selected_realmsData = sFCalendarFilterMenu.selected_filter_realms;
      var selected_realms = (selected_realmsData != '') ? selected_realmsData : [];
      var realmSelected = $.inArray(realm_key, selected_realms) != -1 ? true : false;
      element.css('display', (selected_realms.length > 0 && !realmSelected) ? 'none' : '');

      var selected_colorsData = sFCalendarFilterMenu.selected_filter_colors;
      var selected_colors = (selected_colorsData != '') ? selected_colorsData : {};
      element.removeClass(function (index, css) {
          return (css.match (/\bcolor-([0-9]+|default-personal|default-school|default-groups|default-courses|dark-[0-9]+|light-[0-9]+)/g) || []).join(' ');
      });
      if(selected_colors[realm_key] != undefined) {
        element.addClass(selected_colors[realm_key]);
      }
    }
}

// Triggered after an event has been placed on the calendar in its final position.
var sFCalendarEventAfterRender = function (event, element) {
  if(event.hasOwnProperty('minute_adjustment') && event.minute_adjustment != 0){
    var eventTime = $('.fc-event-time', element);
    var adjustment = (event.minute_adjustment * -1).toString();
    eventTime.text(eventTime.text().toString().replace(/:[0-9]+ /gi, ':' + adjustment + ' '));
  }
  var elmHTMLTitle = element.find('.fc-event-title');
  sAttachBehavior('sCommonInfotip' , elmHTMLTitle );
  sPopupsResizeCenter();
  element.disableResizing = $('#fcalendar').fullCalendar('getView').name != 'month' ? false : true;
  // infotip popup bubble sticks sometimes after drag; remove active infotips from the DOM
  $('.tipsy-e').remove();
}

/**
 * Given a dateObj in the user's timezone, convert the time to a unix timestamp.
 *
 * @param Date dateObj
 */
var sFCalendarToTimestamp = function(dateObj){
  // use Date.UTC to not allow the browser to coerce into the local timezone
  var utcDate = Date.UTC(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    dateObj.getHours(),
    dateObj.getMinutes(),
    dateObj.getSeconds()
  );

  offset = sCommonGetSetting('s_common', 'timezone');

  // create a new time with
  return parseInt(new Date(utcDate - (offset * 1000)).getTime() / 1000);
}

// Triggered when dragging stops and the event has moved to a different day/time.
var sFCalendarEventDrop = function(event, dayDelta, minuteDelta, allDay, revertFunc, jsEvent, ui, view) {
    var realmPathURI = sFCalendarGetRealmPath();

    if(event.e_type == 'folder'){
      var url = '/course/'+ event.realm_id +'/materials/folder/' + event.content_id + '/edit_dates';
    }
    else {
      var url = '/event-calendar/'+ realmPathURI.realm +'/'+ realmPathURI.realm_id +'/' + event.id + '/move';
    }
    var startTs = sFCalendarToTimestamp(event.start);

    var endTs = '';
    if(event.end != undefined){
      endTs = sFCalendarToTimestamp(event.end);
    }

    var postData = {
      'start' : startTs,
      'end' : endTs,
      'allDay' : Number(allDay),
      'eventView' : view.name
    };

    if(event.hasOwnProperty('minute_adjustment')){
      postData.minute_adjustment = event.minute_adjustment;
    }

    // disable editing temporarily
    var pendingClassName = 'pending';
    event.editable = false;
    event.className.push(pendingClassName);
    $('#fcalendar').fullCalendar('updateEvent', event);
    $.ajaxSecure({
        url: url,
        type: 'POST',
        data: postData,
        success: function(){
            if(minuteDelta > 0){
              event.minute_adjustment = 0;
            }

            // enable editing
            event.editable = true;
            var pendingClassIndex = $.inArray(pendingClassName, event.className);
            if(pendingClassIndex != -1) {
                event.className.splice(pendingClassIndex, 1);
            }

            $('#fcalendar').fullCalendar('updateEvent', event);
            sPopupsResizeCenter();

            if(sFCalendarEventProfileForceReloadOnUpdate(event.id)) {
              sFCalendarForceReloadOnClose = true;
            }
        }
    });
};

// Triggered when resizing stops and the event has changed in duration.
var sFCalendarEventResize = function(event, dayDelta, minuteDelta, revertFunc, jsEvent, ui, view) {
    var realmPathURI = sFCalendarGetRealmPath();

    if(event.e_type == 'folder'){
      var url = '/course/'+ event.realm_id +'/materials/folder/' + event.content_id + '/edit_dates';
    }
    else {
      var url = '/event-calendar/'+ realmPathURI.realm +'/'+ realmPathURI.realm_id +'/' + event.id + '/resize';
    }

    var startTs = sFCalendarToTimestamp(event.start);

    var endTs = '';
    if(event.end != undefined){
      var endTs = sFCalendarToTimestamp(event.end);
    }

    var postData = {
      'start' : startTs,
      'end' : endTs,
      'eventView' : view.name
    };

    if(event.hasOwnProperty('minute_adjustment')){
      postData.minute_adjustment = event.minute_adjustment;
    }

    // disable editing temporarily
    var pendingClassName = 'pending';
    event.editable = false;
    event.className.push(pendingClassName);
    $('#fcalendar').fullCalendar('updateEvent', event);
    $.ajaxSecure({
        url: url,
        type: 'POST',
        data: postData,
        success: function(){
          event.minute_adjustment = 0;

          // enable editing
          event.editable = true;
          var pendingClassIndex = $.inArray(pendingClassName, event.className);
          if(pendingClassIndex != -1) {
            event.className.splice(pendingClassIndex, 1);
          }

          $('#fcalendar').fullCalendar('updateEvent', event);
          sPopupsResizeCenter();

          if(sFCalendarEventProfileForceReloadOnUpdate(event.id)) {
            sFCalendarForceReloadOnClose = true;
          }
        }
    });

};

// Triggered when the user clicks on a day.
var sFCalendarEventAdd = function(date, allDay, jsEvent, view) {
  if($('body').hasClass('no-event-create-tabs')){
    return;
  }

  sFCalendarDayClickIsAllDay = allDay;
  Popups.saveSettings();

  var body = '';
  var realmInfo = sFCalendarGetRealmPath();

  var popup = new Popups.Popup();
  popup.element = jsEvent.target;
  popup.extraClass = 'popups-large calendar-popup-add smart-box';
  popup.disableInputFocus = true;

  popup.open(Drupal.t('Create Event'), body);

  var tempSmartBox = $(sFCalendarSmartBox.html());

  var activePopup = Popups.activePopup();
  var activePopupBody = $('#' + activePopup.id + ' .popups-body');
  activePopupBody.prepend(tempSmartBox);
  activePopupBody.attr('this-date', date.toString());

  var eventTab = $('.add-event');
  eventTab.addClass("active");

  $('.calendar-popup-mini').removeClass('hidden').addClass('calendar-popup-inactive');

  if(realmInfo.realm != 'course' && realmInfo.realm != 'user') {
    var formNum = eventTab.attr('id').split('-').pop();
    $('.calendar-form-tab').remove();
    sFCalendarLoadForm(formNum, 'event');
  }
  else {
    var formNum = eventTab.attr('id').split('-').pop();
    sFCalendarLoadForm(formNum, 'event');
  }

  $(document).bind('popups_close.s_event_add_combined_form', function(){
    $('.calendar-popup-mini').removeClass('calendar-popup-inactive');
  });

}

// Triggered when the user clicks an event.
var sFCalendarEventPreview = function(event, jsEvent, view) {
    jsEvent.preventDefault();
    var eventStart = event.start;
    var frenchDateFormat = "dddd d MMMM yyyy";

    if(event.hasOwnProperty('minute_adjustment')){
      eventStart = eventStart.setMinutes((event.minute_adjustment * -1));
    }
    var eStartDueDate = eDisplayDate = '';

    // flip day/month for UK date-format
    var date_format_str = "dddd, MMM d, yyyy";
    if(Drupal.settings.s_common.date_format_language != undefined) {
      date_format_str = Drupal.settings.s_common.date_format_language != 'en-GB' ? date_format_str : "dddd, d MMM, yyyy";
      date_format_str = Drupal.settings.s_common.language === 'fr-corp' ? frenchDateFormat : date_format_str;
    }

    let comma = Utils.i18n.t("core.char_comma");
    // prepare the time format first
    let start_date_format = "";
    let end_date_format = "";

    if ($(document).attr("dir") === "rtl" || Drupal.settings?.datepicker?.hijri?.enableHijriDates) {
      start_date_format = end_date_format = "!dddd" + comma + " !d !MMMM !yyyy";

      if (!event.allDay) {
        start_date_format += " " + Utils.i18n.t("core.at") + " !h:!mm !tt";
      }
      eStartDueDate = getTranslatedDate(event.start, start_date_format);
      if (event.end) {
        if (
          $.fullCalendar.formatDate(event.start, "MM-dd-yyyy") ===
          $.fullCalendar.formatDate(event.end, "MM-dd-yyyy")
        ) {
          end_date_format = " - !h:!mm !tt";
        } else {
          end_date_format += " !h:!mm !tt";
        }
        eStartDueDate += " - " + getTranslatedDate(event.end, end_date_format);
      }
    } else {
      eStartDueDate = $.fullCalendar.formatDate(
        event.start,
        event.allDay
          ? date_format_str
          : date_format_str + Drupal.t(" 'at' !time", { "!time": "h:mm tt" })
      );
      if (Drupal.settings.s_common.date_format_language == "th") {
        eStartDueDate = getTranslatedThaiDate(event.start);
      }

      if (event.end) {
        //var eEndDate = $.fullCalendar.formatDate(event.end, event.allDay ? 'MMM d, yyyy' : 'MMM d, yyyy at h:mm tt');
        var sameDay =
          $.fullCalendar.formatDate(event.start, "MM-dd-yyyy") ===
          $.fullCalendar.formatDate(event.end, "MM-dd-yyyy");
        if (sameDay) {
          endDate = $.fullCalendar.formatDate(event.end, "h:mm tt");
        } else {
          var endTimeFormat =
            date_format_str +
            (!event.allDay
              ? Drupal.t(" 'at' !time", { "!time": "h:mm tt" })
              : "");
          endDate =
            getTranslatedThaiDate(event.end) ||
            $.fullCalendar.formatDate(event.end, endTimeFormat);
        }
        eStartDueDate += " - " + endDate;
      }
    }

    /**
     * Translates a date into Thai format, like, "วันอาทิตย์ที่ 7 เม.ย. ค.ศ.2024".
     *
     * @param {Date} translationDate - The date to be translated.
     * @returns {string|undefined} - The translated date in Thai language format using internal function processDate, or undefined if the date format language is not "th".
     */
    function getTranslatedThaiDate(translationDate) {
      if (Drupal.settings.s_common.date_format_language == "th") {
        var date = new Date(translationDate);
        var translateStrings = Drupal.date_t_strings();
        var days = translateStrings["day_name"];
        var months = translateStrings["month_name"];
        var dayOfWeek = days[date.getDay()];
        var month = months[date.getMonth() + 1];
        var translated_date =
          dayOfWeek +
          Utils.i18n.t("core.at") +
          " " +
          date.getDate() +
          " " +
          month +
          " " +
          Utils.i18n.t("core.year_AD") +
          date.getFullYear();
        var endTimeFormat =
          date_format_str +
          (!event.allDay
            ? Drupal.t(" 'at' !time", { "!time": "h:mm tt" })
            : "");
        var endDate = $.fullCalendar.formatDate(event.end, endTimeFormat);
        function processDate(date, translated_date) {
          if (date.includes(Drupal.t("Time"))) {
            var arr = date.split(Drupal.t("Time"));
            return translated_date + " " + Drupal.t("Time") + arr[1];
          }
          return translated_date;
        }

        if (translationDate == event.start) {
          return processDate(eStartDueDate, translated_date);
        } else if (translationDate == event.end) {
          return processDate(endDate, translated_date);
        }
      }
    }

    if(event['rule_definition']){
      var recurrenceText = getRecurrenceRuleDisplayText(event['rule_definition'], eventStart);
    }

    if(event.realm == 'user') {
        event.content_title = Drupal.t('Personal');
    }

    if(event.e_type == 'discussion') {
        var contentURI = '/course/' + event.realm_id + '/materials/discussion/view/' + event.content_id;
        eDisplayDate += '<tr class="odd"><th>'+Drupal.t('Due Date')+'</th><td>'+ eStartDueDate +'</td> </tr>';
        var editEventURI = '/course/' + event.realm_id + '/materials/discussion/' + event.content_id + '/edit';
    }
    else if(event.e_type == 'folder') {
        var contentURI = '/course/' + event.realm_id + '/materials?f=' + event.content_id;
        eDisplayDate += '<tr class="odd"><th>'+Drupal.t('Dates')+'</th><td>'+ eStartDueDate +'</td> </tr>';
        var editEventURI = '/course/' + event.realm_id + '/materials/folder/' + event.content_id + '/edit';
    }
    else if(event.e_type == 'external_tool') {
        var contentURI = '/external_tool/' + event.external_tool_link_id + '/launch';
        eDisplayDate += '<tr class="odd"><th>'+ Drupal.t('Due Date') + '</th><td>' + eStartDueDate + '</td> </tr>';
        var editEventURI = '/external_tool/course/' + event.realm_id + '/link/' + event.external_tool_link_id;
    }
    else if(event.e_type != 'event') {
        var contentURI = '/assignment/' + event.content_id;
        var borderlessClass = event.e_type === 'grade_column' ? 's-event-fcalendar-borderless-row' : '';
        eDisplayDate += '<tr class="odd ' + borderlessClass + '"><th>'+Drupal.t('Due date')+'</th><td>'+ eStartDueDate +'</td> </tr>';
        var editEventURI = '/assignment/edit/'  + event.realm_id + '/' + event.content_id + '/basic';
    }
    else {
        var contentURI = '/event/' + event.id + '/profile';
        eDisplayDate += '<tr class="odd"><th>'+Drupal.t('Time')+'</th><td>'+ eStartDueDate;
        if(recurrenceText){
          eDisplayDate += '<div class="recurrence">' + recurrenceText + '</div>';
        }
        eDisplayDate += '</td> </tr>';
        var editEventURI = '/'+ event.realm +'/'+ event.realm_id +'/event/'+ event.id;
    }

    var icon = '';
    var customIconHtml = '';

    switch(event.e_type) {
      case 'external_tool':
        icon = 'external-tool-icon';
        break;
      case 'grade_column':
        icon = 'grade-item-icon';
        break;
      default:
        icon = event.e_type + '-icon';
    }

    // Check for custom icon URL (external tool links with custom icons)
    if (event.icon_url) {
      icon = 'external-tool-custom-icon';
      var imgElement = $('<img>').attr('alt', Drupal.t('External tool icon')).attr('src', event.icon_url);
      customIconHtml = imgElement.prop('outerHTML');
    }

    var body = '';
    body += '<div class="template-wrapper parent-template">';
    body += '<div class="template-title"><span class="' + icon + ' day-'+$.fullCalendar.formatDate(event.start, "dd")+'">' + customIconHtml + '</span> '+ event.titleLink +'</div>';
    body += '<div class="template-meta">';
    if(event.child_name) {
      body += '<span class="child-name">'+ event.child_name +'</span>&middot;';
    }
    body += '<a href="/'+ event.realm +'/'+ event.realm_id +'">'+ (event.content_title  === undefined ? htmlentities(event.realm_title) : htmlentities(event.content_title)) +'</a></span>';
    body += '</div>';
    body += '<div class="template-fields"><table class="info-tab"><tbody id="">';
    body += eDisplayDate;
    if(event.body != ''){
      body += '<tr class="odd"><th>'+Drupal.t('Description')+'</th><td><div class="s-rte">'+ event.body +'</div></td> </tr>';
    }
    body += '</tbody></table>';
    body += '</div>';
    if(event.e_type === 'grade_column') {
      body += '<div class="s-event-fcalendar-not-available-note">' + Drupal.t('Note: This material is not available within Schoology') + '</div>';
    }
    body += '</div>';
    body += '<div class="submit-buttons">';
    if (event.e_type !== 'grade_column') {
      body += '<a href="' + contentURI + '" class="submit-btn">' + Drupal.t('View Item') + '</a>';
    }
    if(event.editable) {
        body += '<a href="' + editEventURI + '" class="submit-btn edit-calendar-event">' + Drupal.t('Edit Item') + '</a>';
    }
    var buttonTitle = event.editable ? Drupal.t('Cancel') : Drupal.t('Close');
    body += '<span role="button" tabindex="0" class="cancel-btn">' + buttonTitle + '</span>';
    body += '</div>';

    var popup = new Popups.Popup();
    popup.element = jsEvent.target;
    popup.extraClass = 'popups-large calendar-popup-preview';
    popup.open(event.titleText, body, {});


    var activePopup = Popups.activePopup();
    var activePopupBody = $('#' + activePopup.id + ' .popups-body');

    Drupal.attachBehaviors( activePopupBody );
};

// handler for clickable day numbers, goto clicked date / change calendar view to agendaDay
var sFCalendarGoToDayView = function(e) {
    e.stopPropagation();

    var d = $('#fcalendar').fullCalendar('getDate');
    var d = $.fullCalendar.formatDate(d, 'yyyy-MM');

    var dCell = $(this).parent().parent();
    var clickedDay = new Date(d.split('-')[0], d.split('-')[1]-1, $(this).text());

    if(!dCell.hasClass('fc-other-month')) {
        $('#fcalendar').fullCalendar('gotoDate', clickedDay);
        $('#fcalendar').fullCalendar('changeView', 'agendaDay');
    }
};


//
// Advisor FullCalendar callbacks
//


// Triggered while an event is being rendered. [workaround: HTML needed for title]
var sFCalendarAdvisorEventRender = function (event, element) {
  var elmHTMLTitle = element.find('.fc-event-title');
  elmHTMLTitle.html(event.titleHTML);
  element.find('.fc-event-time').insertAfter(elmHTMLTitle);
}

// Triggered after an event has been placed on the calendar in its final position.
var sFCalendarAdvisorEventAfterRender = function (event, element) {
  var elmHTMLTitle = element.find('.fc-event-title');
  sAttachBehavior('sCommonInfotip' , elmHTMLTitle );
  if(event.hasOwnProperty('minute_adjustment') && event.minute_adjustment != 0){
    var eventTime = $('.fc-event-time', element);
    var adjustment = (event.minute_adjustment * -1).toString();
    eventTime.text(eventTime.text().toString().replace(/:[0-9]+ /gi, ':' + adjustment + ' '));
  }
}

// handler for clickable day numbers, goto clicked date / change calendar view to agendaDay
var sFCalendarAdvisorGoToDayView = function(e) {
  e.stopPropagation();

  var d = $('#fcalendar').fullCalendar('getDate');
  var d = $.fullCalendar.formatDate(d, 'yyyy-MM');

  var dCell = $(this).parent().parent();
  var clickedDay = new Date(d.split('-')[0], d.split('-')[1]-1, $(this).text());

  if(!dCell.hasClass('fc-other-month')) {
    $('#fcalendar').fullCalendar('gotoDate', clickedDay);
    $('#fcalendar').fullCalendar('changeView', 'agendaDay');
  }
};

// Triggered when the user clicks an event.
var sFCalendarAdvisorEventPreview = function(event, jsEvent, view) {
  jsEvent.preventDefault();
  /*
   * reuse realm calendar js-template for folder previews.
   * we can do the same for the other event types but additional info
   * is needed (ie. max pts, dropbox submissions ...etc) and possibly additional
   * perm checks to show/hide view button
   */
  if(event.e_type == 'folder') {
    sFCalendarEventPreview(event, jsEvent, view);
    return;
  }

  var advisorType = $('#fcalendar').hasClass('advisor-type-1') ? 'parent' : 'advisor';
  var advisorUser = event.child_uid;
  var advisorContentId = event.content_id;
  var popupHref = '/advisor/'+advisorUser+'/' + advisorType + '/'+advisorContentId+'/content';
  var options = Popups.options({
    'href' : popupHref,
    'extraClass': 'popups-large calendar-popup-preview'
  });

  Popups.openPath($(this), options);
};


//
// Common utility functions
//

// parse url, get realm, realm id and date
function sFCalendarGetRealmPath() {
    var path = window.location.pathname.substring(1);

    var realm = path.split('/')[0];
    if(realm.search(/-calendar/) != -1) {
        realm = path.split('/')[0].split('-')[0];
    }

    if(realm == 'calendar') {
        realm = 'user';
    }

    var realm_id = path.split('/')[1];
    var calDate = path.split('/')[2];

    // check Drupal.settings for realm info if not in path
    if($.inArray(realm, ['user', 'group', 'course', 'school']) == -1 && Drupal.settings.s_event != undefined){
      realm = Drupal.settings.s_event.realm;
      realm_id = Drupal.settings.s_event.realm_id;
    }

    return {
        realm: realm,
        realm_id: realm_id,
        calDate: calDate
    };
}

function sFCalendarLoadForm(formNum, formType) {
  $('#calendar-form-container').prepend('<img class="gif-loader" src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" alt="' + Drupal.t('Loading') + '" />');

  sPopupsResizeCenter();

  // form already loaded
  var context_form = formType == 'event' ? sFCalendarEventForm : sFCalendarAssignmentForm;
  if( typeof context_form != 'undefined' ) {
    sFCalendarUnloadRichtextEditor();
    sFCalendarShowCalendarAddForm(formType, formNum, true);
    return;
  }

  switch(formType){
    case 'event':

      var _success_callback = function( response , status, xhr ){
        sFCalendarEventForm = response.data;
        sFCalendarEventFormSettings = response.js;
        sFCalendarShowCalendarAddForm(formType, formNum);
      }

      break;

    case 'assignment':
      $("#s-event-add-combined-form").addClass("active-loading");

      var _success_callback = function( response , status , xhr ){
        sFCalendarAssignmentForm = response.data;
        sFCalendarAssignmentFormSettings = response.js;
        sFCalendarShowCalendarAddForm(formType, formNum);
        $("#s-event-add-combined-form").removeClass("active-loading");
      }

      break;
  }

  var ajax_url = '/home/tabsjs/' + formNum;

  // set a querystring parameter that will indicate server-side that required external js/css should be sent back via ajax
  if((!Drupal.settings.s_event_fcalendar_smartbox || !Drupal.settings.s_event_fcalendar_smartbox.externals_loaded) &&
    (!sFCalendarAssignmentForm && !sFCalendarEventForm)){
    ajax_url += '?le';
  }

  var success_callback = function( response , status , xhr ){
    if( response.js && response.js.fcalendar_popup )
      Popups.addJS( { 'fcalendar_popup': response.js.fcalendar_popup , 'setting': response.js.setting } );
    if( response.css )
      Popups.addCSS( response.css );

    _success_callback( response , status , xhr );
  }

  sFCalendarUnloadRichtextEditor();

  $.ajax({
      url: ajax_url,
      dataType: 'json',
      type: 'GET',
      data : 'calendar_realm='+  sFCalendarGetRealmPath().realm + '&calendar_realm_id=' + String(sFCalendarGetRealmPath().realm_id),
      success: success_callback,
      error: function(response, status){
        alert(Drupal.t('There was an internal problem. Please try again in a few moments.'));
      }
  });
}

function sFCalendarShowCalendarAddForm(itemType, formNum, isCached) {
  if(isCached !== undefined){

    var context_form_settings = itemType == 'event' ? sFCalendarEventFormSettings : sFCalendarAssignmentFormSettings;
    if(context_form_settings) {
      Popups.addJS( {'setting': context_form_settings.setting } );
    }

  }

   // since the attachment form is currently singleton, remove attachments form from the page if it already exists;
   if( $('div#attachments').length > 0 ){
     sFCalendarForceReloadOnClose = true;
     $('div#attachments').remove();
   }

   var activePopup = Popups.activePopup();
   var activePopupBody = $('#' + activePopup.id + ' .popups-body');

   /*
    * Build out the string that our date popup likes
    */
   var date = new Date(activePopupBody.attr('this-date'));
   var day = date.getDate();
   if(day < 10){
     day = '0' + day.toString();
   }
   var year = date.getFullYear().toString().substring(2);
   var month = (date.getMonth()+1);
   var dateFormatLanguage = Drupal.settings.s_common.date_format_language;
   var dayStr;

   // format date string based on language
   if ($(document).attr('dir') === 'rtl') {
     dayStr = year + '/' + month  + '/' + day;
   } else if (dateFormatLanguage === 'en-GB' || dateFormatLanguage === 'th') {
     dayStr = day + '/' + month  + '/' + year;
   } else {
     dayStr = month + '/' + day + '/' + year;
   }

   var formWrapper = $('#calendar-form-container' , activePopupBody );
   formWrapper.empty();
   var behavior_funcs = ['sFCalendarMonth','sAttachmentForm','date_popup','sHomeSmartBoxRealmSelection','popups','Ajax',
    'sCommonAdvancedOptions', // assignment advanced options buttons
    'sCommonInfotip', // assignment attachment cluetips
    'sCourseMaterialsLock' // assignment lock form
  ];

   switch(itemType){
     case 'event':
       behavior_funcs.push('sEventAddForm');
       behavior_funcs.push('s_event');
       formWrapper.prepend(sFCalendarEventForm);
       // Set the defaultdate before calling Drupal.attachBehaviors
       var dateStartInput = $('#edit-start-wrapper input:eq(0)', formWrapper);
       dateStartInput.attr('defaultdate', dayStr);

       if($('#fcalendar').fullCalendar('getView').name != 'month' && !sFCalendarDayClickIsAllDay) {
           var hour = date.getHours();
           var minutes = date.getMinutes();
           var meridiem = (hour > 11) ? 'PM' : 'AM';
           minutes = (minutes < 10) ? '0' + String(minutes) : String(minutes);

           if(hour == 0) {
             hour = 12;
           }
           else if(hour > 12) {
             hour = hour - 12;
           }
           hour = (hour < 10) ? '0' + String(hour) : String(hour);
           var timeStr = hour + ':' + minutes + meridiem;

           $('#edit-start-wrapper input', formWrapper).eq(1).val(timeStr);
        }
       break;
     case 'assignment':
       behavior_funcs.push('sGradesItemAddForm');
       behavior_funcs.push('sAlignment');
       formWrapper.prepend(sFCalendarAssignmentForm);
       break;
   }

   var selectedRealm = $("#browse-realms", activePopupBody).find("input:checked");

   sAttachBehaviors( behavior_funcs , activePopupBody );
   sFCalendarLoadRichtextEditor(activePopupBody);

   if( selectedRealm.length ) {
    var realmChooser = $('#edit-realms', activePopupBody);
    var id = selectedRealm.attr('id').replace('browse-realm-checkbox-', '');
    sHomeSmartBoxRealmSelectionAddPlaceholder(realmChooser, id, htmlentities(selectedRealm.attr('realmtitle')));
    sHomeSmartBoxRealmSelectionUpdateSelected(realmChooser, [id]);
    realmChooser.focus().blur();
    Popups.activePopup().refocus(); // blur moves focus out of the popup; refocus to return focus to the popup
   }

   // trigger event for form loaded
   $(document).trigger('s_event_add_combined_form_loaded', [activePopupBody]);
   sPopupsResizeCenter();
}

function sFCalendarEventProfileForceReloadOnUpdate(event_id) {
    var path = window.location.pathname.substring(1);
    // check if this is the event profile
    return (path.search(/^event\/[0-9]+\/profile$/) == 0 && path.split('/')[1] == event_id) ? true : false;
}

function sFCalendarUnloadRichtextEditor(context){
  var editorId = tinyMCE && tinyMCE.activeEditor ? tinyMCE.activeEditor.editorId : null;
  if(editorId && $('#' + editorId).length){
    tinyMCE.execCommand('mceRemoveControl', false, editorId);
  }
}

function sFCalendarLoadRichtextEditor(context){
  sAttachBehaviors(['s_tinymce'], context);

  // since the popup doesn't actually open a path we need to manually trigger the initialization of tinymce
  $(document).trigger('popups_open_path_done.s_tinymce');
}

function sFCalendarPopupOnUpdate(data, options, element) {
  var realmInfo = sFCalendarGetRealmPath();
  sFCalendarUpdateEvents(data.content, realmInfo);
  Popups.removeLoading();
  if (Popups.activePopup()) {
    sPopupsClose();
  }
  else {
    Popups.removeOverlay();
    Popups.restorePage();
  }
  // Broadcast an event that popup form was done and successful.
  $(document).trigger('popups_form_success', [null, data]);
  return false;
}

function sFCalendarGetEventSourceUrl(year, month) {
  var getRealmPathURI = sFCalendarGetRealmPath();
  if(getRealmPathURI.realm == 'user') {
    // User Calendar
    var eventSourceJSON = 'calendar/'+getRealmPathURI.realm_id;
  }
  else {
    var eventSourceJSON = getRealmPathURI.realm+'-calendar/'+getRealmPathURI.realm_id;
  }
  /*
   * Note the URL being passed into the event calendar object has a third argument which is the month and year requested on the original page load,
   * but the real decider of the time period requested is from GET arguments passed by the calendar object.  In other words, if user loads
   * 2012-12 URL, subsequent requests by the calendar for events will still pass 2012-12, but that is not what server will use to decide time period.
   */
  if(year != undefined && month != undefined) {
    eventSourceJSON += '/' + year.toString() + '-' + (month+1).toString();
  }
  else {
    var now = new Date();
    eventSourceJSON += '/' + now.getFullYear().toString() + '-' + (now.getMonth()+1).toString();
  }
  return eventSourceJSON
}

function sFCalendarUpdateEvents(events, realmInfo) {
  var fCalendar = $('#fcalendar');

  if(!events.length || !fCalendar.length) {
    return;
  }

  for(i = 0; i < events.length; i++) {
    /**
     * replace the event if it is already loaded
     */
    var loadedEvents = fCalendar.fullCalendar( 'clientEvents', events[i].id);
    if(loadedEvents.length == 1) {
      fCalendar.fullCalendar( 'removeEvents', events[i].id);
      if(sFCalendarEventProfileForceReloadOnUpdate(events[i].id)) {
        sFCalendarForceReloadOnClose = true;
      }
    }

    if(realmInfo.realm == 'user') {
      fCalendar.fullCalendar( 'renderEvent', events[i] );
    }
    else if(realmInfo.realm == events[i].realm && realmInfo.realm_id == events[i].realm_id) {
      fCalendar.fullCalendar( 'renderEvent', events[i] );
    }
  }
}

/**
 * @param rule $event['rule_definition']
 * @param stringDate iso format string
 * @returns string e.g. 'Every Thursday' or 'Third Sunday of every Month'
 */
function getRecurrenceRuleDisplayText(rule, stringDate) {
  // get translated day of week
  var date = new Date(stringDate);
  var days = (Drupal.date_t_strings())['day_name'];
  var translatedDayOfWeek = days[date.getDay()];

  switch(rule['FREQ']) {
    case 'DAILY':
      return rule['BYDAY'] ? Utils.i18n.t("core.calender.every_weekday") : Utils.i18n.t("core.calender.every_day");
    case 'WEEKLY':
      return Utils.i18n.t('core.every_day_of_week', { day: translatedDayOfWeek });
    case 'MONTHLY':
      return rule['BYMONTHDAY'] ?
        getRecurrenceRuleDisplayTextForDateOfMonth(rule) :
        getRecurrenceRuleDisplayTextForDayOfWeekOfMonth(rule, translatedDayOfWeek)
  }
}

function getRecurrenceRuleDisplayTextForDateOfMonth(rule) {
  var dateOfMonth = (rule['BYMONTHDAY'].split(','))[0];
  return dateOfMonth === '31' ?
    Utils.i18n.t('core.last_day_of_month') :
    Utils.i18n.t('core.calender.day_of_every_month', { date:dateOfMonth });
}

function getRecurrenceRuleDisplayTextForDayOfWeekOfMonth(rule, translatedDayOfWeek) {
  // $rule['BYDAY'] value should look like '1SU' or '4WE'
  var weekOfMonth = rule['BYDAY'] ? parseInt((rule['BYDAY'].split(''))[0]) : null;
  if(0 < weekOfMonth && weekOfMonth < 6) {
    var ordinals = (Drupal.date_t_strings())['date_order'];
    var ordinal = ordinals[weekOfMonth];
    return Utils.i18n.t('core.calender.ordinal_day_of_week_of_every_month', {
      ordinal_count: ordinal, day_of_week: translatedDayOfWeek
    });
  }
  return '';
}
