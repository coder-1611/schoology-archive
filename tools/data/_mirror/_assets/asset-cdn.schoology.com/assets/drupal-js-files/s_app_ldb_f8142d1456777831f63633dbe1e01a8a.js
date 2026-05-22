var sAppLdbLaunchTimeout;

/**
 * Attach JS Behaviors for Dev LDB Realm Manager
 *
 * Page: apps/ldb/%/%
 */
Drupal.behaviors.sAppLdbRealmManager = function(context){

  $('#s-js-app-ldb-realm-manager-wrapper:not(.sAppLdbRealmManager-processed)').addClass('sAppLdbRealmManager-processed').each(function(){
    var wrapper = $(this);
    var managerTbl = $('#s-js-app-ldb-config-table', wrapper);
    $('.s-js-app-ldb-config-btn', wrapper).parent().addClass('s-js-app-ldb-config-row');

    // edit config cells
    wrapper.on('click', '.s-js-app-ldb-config-btn', function(){
      var btn = $(this), currentVal = btn.html(), newVal;
      if(btn.hasClass('s-js-app-ldb-config-field')) {
        newVal = window.prompt('Enter value:', currentVal);
        if(newVal != null) {
          btn.html(newVal);
        }
      }
      else if(currentVal == "1") {
        btn.html(0);
      }
      else if(currentVal == "0") {
        btn.html(1);
      }
    });

    // save configs for all realm items
    wrapper.on('click', '#s-js-app-ldb-config-save-btn', function(){
      var dataRows = $('.s-js-app-ldb-config-row', managerTbl), data = [], row = [];
      dataRows.each(function(k, v) {
        row = [];
        $('.s-js-app-ldb-config-btn', $(this)).each(function() {
          row.push( $(this).html() );
        });
        data.push(row);
      });

      Popups.addOverlay();
      Popups.addLoading();
      $.post(window.location, {configs: data}, function(res) {
        window.location.reload();
        Popups.removeLoading();
        Popups.removeOverlay();
      });
    });

    // add config row
    wrapper.on('click', '#s-js-app-ldb-config-add-btn', function(){
      var firstRow = $('.s-js-app-ldb-config-row:first', managerTbl).clone();
      firstRow.appendTo(managerTbl);
    });

  });

};

Drupal.behaviors.sAppLdbStart = function(context){

  $('.s-app-ldb-js-assessment-next:not(.sAppLdbStart-processed)').addClass('sAppLdbStart-processed').each(function(){
    var nextBtn = $(this);
    var assessmentForm = nextBtn.parents('.s-assessment-question-fill-form');
    nextBtn.bind('click', function() {
      assessmentForm.attr('action', setQueryParamsQ(assessmentForm.attr('action'),  'rldbqn', '1'));
    });
  });

  $('.s-js-app-ldb-ldb-submit-wrapper:not(.sAppLdbStart-processed)').addClass('sAppLdbStart-processed').each(function(){
    sAppLdbStartHideNav();
  });

};




/**
 * Attempt LockDown Browser launch
 *
 * @param string url
 * @param callback cb
 */
function sAppLdbLaunchBrowser(url, cb) {
  if($.cookie('s_app_ldb_launch_force_error') == 1) {
    sAppLdbLaunchSetTimeout(cb);
    return;
  }

  if($.cookie('sgy_app_ldb_fakebrowser') == 1) {
    window.open(url);
  }
  else if(sCommonGetSetting('s_app_ldb_js', 'is_user_on_chromebook_device') === 1 && url != '') {
    var hiddenFrame = {
      'id': '#ldb-launch-window',
      'html': '<iframe id="ldb-launch-window" style="display: none;"></iframe>'
    };
    $(hiddenFrame.id).remove();
    $(body).prepend(hiddenFrame.html);
    $(hiddenFrame.id).attr('src', url);
  }
  else if (url != '') {
    location.href = url;
    return;
  }
  sAppLdbLaunchSetTimeout(cb);
}

function sAppLdbLaunchSetTimeout(cb) {
  sAppLdbLaunchTimeout = setTimeout(function(){
    cb('failed');
  }, 3000);
  /*
   Note: use the special cookie "s_app_ldb_launch_force_error" to
   force the error view. You can set the debug cookie using the browser's
   javascript console or a browser extension for cookie management.

   $.cookie('s_app_ldb_launch_force_error', 1);
   $.removeCookie('s_app_ldb_launch_force_error');
   */
  if($.cookie('s_app_ldb_launch_force_error') != 1) {
    $(window).bind('blur.s_app_ldb_launch', function() {
      sAppLdbLaunchClearTimeout(cb);
    });
  }
}

function sAppLdbLaunchClearTimeout(cb) {
  clearTimeout(sAppLdbLaunchTimeout);
  sAppLdbLaunchTimeout = null;
  $(window).unbind('blur.s_app_ldb_launch');
  cb('success');
}

function sAppLdbIsStarted() {
  return $.cookie('rldbci') == 1;
}

function sAppLdbGetSecurityLevel() {
  return $.cookie('s_app_ldb_security_level');
}

/**
 * Hide various page elements for assessment view
 */
function sAppLdbStartHideNav() {
  var bannerText = Drupal.t('You are currently in LockDown Browser');
  $('.s-app-ldb-view-hide-nav #header').html('<div class="s-app-ldb-banner-wrapper">' + bannerText + '</div');
  $('.s-app-ldb-view-hide-nav #header').show();

  // toggle close btns
  var centerTop = $('.s-app-ldb-view-hide-nav.s-app-ldb-view-show-close-btns #center-top');
  if(centerTop.length == 1) {
    var closeBtn = '<a href="/apps/ldb/exit?src=assignment/709259/assessment/view" class="link-btn">' + Drupal.t('Close Browser') + '</a>';
    centerTop.addClass('.clearfix');
    centerTop.append('<div class="s-assessment-ldb-close-btn-wrapper-top">' + closeBtn + '</div>');
    centerTop.parents('#container').append('<div class="s-assessment-ldb-close-btn-wrapper-bottom">' + closeBtn + '</div>');
  }

  // show current language but disable language switcher
  $('#s-common-language-selector-form').remove();

  // force the bg for center-top (page title)
  $('.s-app-ldb-view-hide-nav .with-tabs #center-top').css('background', '#f2f2f2 url(\'/images/bg-tile.jpg\') repeat');

  // disable user profile link
  $('.s-app-ldb-view-hide-nav .submission-info .student-name a').unbind('click').bind('click', function (e){
    e.preventDefault();
  });

  // show main content wrapper
  $('.s-app-ldb-view').removeClass('s-app-ldb-view');
}
