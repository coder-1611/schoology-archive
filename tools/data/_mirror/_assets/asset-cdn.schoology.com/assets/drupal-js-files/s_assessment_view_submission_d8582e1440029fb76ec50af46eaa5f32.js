Drupal.behaviors.sAssessmentViewSubmission = function(context){
  $('#s-assessment-view-submission-form:not(.sAssessmentViewSubmission-processed)').addClass('sAssessmentViewSubmission-processed').each(function(){

    $('#view-student-info-btn' , $(this)).bind('click',function(){
      $('#student-info-table-wrapper').toggle();
    });

    if(sAppLdbIsStarted()) {
      sAppLdbStartHideNav();
    }
  });
}

Drupal.behaviors.sAssessmentViewSingleStudentStatsStudent = function(context){
  $('#s-assessment-view-single-student-stats-student-form:not(.sAssessmentViewStats-processed)').addClass('sAssessmentViewStats-processed').each(function(){
    $('.ldb-enabled', context).bind('click', function (e) {
      e.preventDefault();
      var viewSubmissionsBtn = $(this);

      if ($('#lock-down-failure', viewSubmissionsBtn.parent()).val()){
        return true;
      }

      // attempt LockDOwn Browser launch
      var a = $('a', viewSubmissionsBtn);
      var downloadUrl = sCommonGetSetting('s_app_ldb_js', 'ldb_download_url');
      var ldbConfigs = sCommonGetSetting('s_app_ldb_js', 'ldb_configs');
      var orgText = a.html();

      // IGN-1242 - disable assessment on mobile if LDB is required
      if(a.hasClass('disabled')) {
        return;
      }

      $('#lock-down-attempted', viewSubmissionsBtn.parent()).val('1');
      a.html('&nbsp;');
      sToggleActiveLoader('ldb-test-install', $('a', viewSubmissionsBtn));
      $('img', viewSubmissionsBtn).css({ top: '4px' });

      sAppLdbLaunchBrowser(a.prop('href'), function(status) {
        sToggleActiveLoader('ldb-test-install');
        if(status == 'success') {
          $('a', viewSubmissionsBtn).html(orgText);
        }
        else if(status == 'failed') {
          $('a', viewSubmissionsBtn).html(Drupal.t('Download LockDown Browser'));
          $('a', viewSubmissionsBtn).attr("href", downloadUrl);
          $('a', viewSubmissionsBtn).attr("target", "_blank");
          var ldbMessage = ldbConfigs.required_monitor
            ? Drupal.t('LockDown Browser and a webcam are required to view this test.')
            : Drupal.t('LockDown Browser is required to view this test.');
          ldbMessage += ' ' + Drupal.t('Download and install LockDown Browser to view your test.<br><br>After installing the LockDown Browser, refresh this page');
          $('span', viewSubmissionsBtn).html(ldbMessage);
          $('#lock-down-failure', viewSubmissionsBtn.parent()).val('1');
        }
      });

      return false;
    });
  });
}