// grading category tooltip
function sGradesApplyHoverListener($form, selectors) {
  var tipsyEnabled = false;
  var $dropdown = $(selectors, $form);
  var selectedValue;
  $dropdown.change(function () {
    selectedValue = $dropdown.val();
  });

  $dropdown.on('mouseover', function () {
    var $select = $(this);
    if (selectedValue === '0') {
     $select.tipsy({
       html: true,
       gravity: 's',
       trigger: 'manual',
       title: function () {
         return Drupal.t('Ungraded items cannot be scored and do not appear in the default view of the gradebook. To view this item from your gradebook, use the Ungraded filter in the All Categories drop-down menu.');
       }
     });
     tipsyEnabled = true;
     $select.tipsy('show');
    }
    else if (tipsyEnabled) {
      $select.tipsy('hide');
      tipsyEnabled = false;
    }
  });
  $form.on('mouseout', selectors, function () {
    var $select = $(this);
    if (tipsyEnabled){
      $select.tipsy('hide');
      tipsyEnabled = false;
    }
  });
}