Drupal.behaviors.sEdgeFilter = function(context){

    $("#edge-filters:not(.sEdgeFilterProcessed)").addClass("sEdgeFilterProcessed").each(function(){
        const filtersBtn = document.getElementById('edge-filters-btn');
        const filtersMenu = document.getElementById('edge-filters-menu');
        const filterOptions = filtersMenu.querySelectorAll('.edge-filter-option');

        // Add event listeners for keyboard navigation on the filters button
        filtersBtn.addEventListener('keydown', function(e) {
            if (isNotEnterOrSpaceKeyEvent(e)) return;
            e.preventDefault();
            filtersBtn.click();
            filterOptions[0].focus();
        });
      
        // Add event listeners for keyboard navigation on filter options
        filterOptions.forEach(option => {
            option.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusNextOption(option, filterOptions);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusPreviousOption(option, filterOptions);
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    focusNextOption(option, filterOptions);
                } else if (e.key === 'Escape') {
                    filtersBtn.click();
                }
            });
        });

        $("#edge-filters-btn").bind('click',function(){
            var menu = $("#edge-filters-menu");
            menu.toggle();
            var f = menu.css('display')=='block' ? $(this).addClass('active') : $(this).removeClass('active');
        })

        $(document).bind('click keydown',function(e){
            if($(e.target).attr('id')=='edge-filters-btn') return;
            if (isNotEnterOrSpaceKeyEvent(e)) return;
            $("#edge-filters-menu").hide();
            $("#edge-filters-btn").removeClass('active');
        });

        $(".edge-filter-option").each(function(){
            $(this).bind('click keydown',function(event){
                if (isNotEnterOrSpaceKeyEvent(event)) return;
                // $('.s-edge-feed-more-link a').attr('href').replace(/page=[0-9]+/gi,"page=0") +
                var url = Drupal.settings.s_edge_filter.url + "&filter=" + $(this).attr('id').replace(/^filter-option-/gi,"");
                $(document).data("sEdgeLoadingType",$(this).html());

                $(".edge-filter-option").each(function(){
                    $(this).removeClass('active');
                });

                $(this).addClass('active');

                $.ajax({
                    type: "GET",
                    url: url,
                    dataType: "json",
                    beforeSend: function(){
                        $("#edge-filters-menu").hide();
                        $('ul.s-edge-feed').empty().append('<li><img src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" alt="' + Drupal.t('Loading') + '" class="more-loading" /></li>');
                    },
                    success: function(json){

                        $("#edge-filters-btn").html($(document).data("sEdgeLoadingType"));

                        // add externals
                        sEdgeMoreAddCSS(json.css);
                        sEdgeMoreAddJS(json.js, function(){
                          // add feed items
                          var newEntries = $(json.output);
                          Drupal.attachBehaviors(newEntries);
                          $('ul.s-edge-feed').html( $('ul.s-edge-feed', newEntries).contents()  );
                        });
                    }
                });
            });
        });
    });

    //setup notifications filter for both notif page filter and notif popup filter
    $('.notif-filter:not(.sEdgeFilterProcessed)').addClass("sEdgeFilterProcessed").each(function(){
        var notifFilter = $(this);
        var notifPopup = notifFilter.hasClass('notif-popup'); //was called from popup
        var context = notifPopup ? $('div.notification-wrapper') : $('div.notif-page-wrapper'); //ensure proper context (ie. page or popup when user is in page and then opens the popup)

        //setup fake dropdown
        notifFilter.selectmenu({
            style: 'dropdown',
            align: ((notifPopup) ? 'right' : 'left')
        });

        var qParams = getQueryParams();
        var filterArray = ['all', 'direct-replies', 'discussion-responses', 'content-created', 'grade-posted', 'dropbox-submission-comment', 'assessment-submission-comment', 'enrollment-change'];
        var activeFilter = (typeof qParams['filter'] == 'undefined') ? 'all' : qParams['filter'];
        var aFilterIndex = $.inArray(activeFilter, filterArray);
        if(!notifPopup && aFilterIndex > -1){
            //if user refresh the page, reset to the current active filter
            notifFilter.selectmenu('value', aFilterIndex);
        }

        //handle the case in which user changes the filter value
        notifFilter.change(function(){
            var filter = $(this).val();
            var notifList = $('.s-notifications-mini', context);
            notifList.empty();
            notifList.append('<img src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" alt="' + Drupal.t('Loading') + '" class="filter-loading" />');
            var baseURL = notifPopup? '/notifications/ajax' : '/home/notifications';

            //load the filtered objects
            $.ajax({
                url: baseURL + '?filter=' + filter,
                dataType: 'json',
                type: 'GET',
                success: function(response, status){
                    sEdgeMoreAddCSS(response.css);
                    sEdgeMoreAddJS(response.js, function(){
                      notifList.empty();
                      notifList.append($('.s-notifications-mini',response.output).html());
                      Drupal.attachBehaviors(notifList);
                    });
                }
            });
        });
    });
      
    /**
     * Focuses on the next option in the list of filter options.
     *
     * @param {HTMLElement} currentOption - The currently focused option element.
     * @param {HTMLElement[]} filterOptions - An array of all filter option elements.
     */
    function focusNextOption(currentOption, filterOptions) {
        const nextOption = currentOption.nextElementSibling || filterOptions[0];
        nextOption.focus();
    }
  
    /**
     * Focuses on the previous option in a list of filter options.
     *
     * @param {HTMLElement} currentOption - The currently focused option element.
     * @param {HTMLElement[]} filterOptions - An array of all filter option elements.
     */
    function focusPreviousOption(currentOption, filterOptions) {
        const previousOption = currentOption.previousElementSibling || filterOptions[filterOptions.length - 1];
        previousOption.focus();
    }

    /**
     * Checks if the event is a 'keydown' event and the key pressed is neither 'Enter' nor 'Space'.
     *
     * @param {Event} event - The event object to be checked.
     * @returns {boolean} - Returns true if the event is a 'keydown' event and the key is not 'Enter' or 'Space', otherwise false.
     */
    function isNotEnterOrSpaceKeyEvent(event) {
        return event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ';
    }

}