Drupal.behaviors.sGradingRubricView = function(context){
  $('.rubric-table', context)
  $('.rubric-table:not(.sGradingRubricView-processed)',context).addClass('sGradingRubricView-processed').each(function(){
    $('.rubric-row', context).each(function(){
      var rowHeight = $(this).height();
      $('.rubric-row-rating table td .rating-item', $(this)).css('min-height', rowHeight - 1);
    });
  })
}