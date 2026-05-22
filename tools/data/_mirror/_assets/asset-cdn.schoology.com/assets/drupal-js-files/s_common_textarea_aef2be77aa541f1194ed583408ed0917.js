Drupal.behaviors.sCommonTextarea = function(context) {
  $('textarea.elastic:not(.sCommonTextarea-processed)', context).each(function() {
    $(this).elastic();
  });
  
  $('textarea.title-infield:not(.sCommonTextarea-processed)', context).each(function() {
    var input = $(this);
    var preFilledText = input.attr('defaulttext');
    if(input.val() == '' || input.val() == preFilledText){
      input.val(preFilledText).addClass('pre-fill');
    }
    input.focus(function(){
      if(input.val() == preFilledText){
        input.val('');
        input.removeClass('pre-fill');
      }
    }).blur(function(){
      if(input.val() == ''){
        input.addClass('pre-fill');
        input.val(preFilledText);
      }
    });
    
    input.parents('form').submit(function(){
      if(input.val() == preFilledText){
        input.val(''); 
      }
    });
  });
};
