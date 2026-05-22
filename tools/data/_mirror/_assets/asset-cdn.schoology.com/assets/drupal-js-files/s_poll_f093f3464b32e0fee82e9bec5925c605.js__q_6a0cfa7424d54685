
var sPollHiddenPollWrappers = 'form .s-polls-poll-option-wrapper.hidden';
var sPollVisiblePollWrappers = 'form .s-polls-poll-option-wrapper:not(.hidden)';
var sPollHiddenPollTextFields = sPollHiddenPollWrappers + ' .s-polls-poll-option-field';
var sPollVisiblePollTextFields = sPollVisiblePollWrappers + ' .s-polls-poll-option-field';

Drupal.behaviors.sPoll = function(context) {
    //Bind the "Poll" button to reveal the poll dialog (first two) and set the hidden poll value to 1(.s-polls-create-poll)
    $('.s-polls-create-poll a:not(.sPoll-processed)', context).addClass('sPoll-processed').bind('click', function(e) {
      e.preventDefault();
      if($('#edit-has-poll', context).val() == 1) {
        sPollHidePollInterface(context);
      } else {
        sPollShowPollInterface(context);
      }
      sPollCheckCanDelete($('.polls-fields-wrapper', context));
      sPopupsResizeCenter();
    });

    $('.s-polls-poll-add-option:not(.sPoll-processed)', context).addClass('sPoll-processed').bind('click', function() {
      var pollObject = $(sPollHiddenPollWrappers, context).eq(0);
      pollObject.removeClass('hidden');
      sPollCheckCanDelete($('.polls-fields-wrapper', context));

      sPollUpdateFocus(pollObject);
      //Update the add/remove buttons
      sPollCorrectOptsButtons(context);
      sPopupsResizeCenter();
    });

    //Bind the "Refresh" button so it will refresh the polls
    $('.s-polls-refresh-poll:not(.sPoll-processed)', context).addClass('sPoll-processed').bind('click', function() {
      var post_nid = $(this).attr('name').split('-').pop();

      $.ajax({
        url: '/polls/counts/' + post_nid,
        dataType: 'json',
        success: function(data) {
          sPollRefreshAnswers(data, context);
        }
      });
    });

    // When we click on one of our radio buttons, we need to select that answer in the DB and update the poll view.
    $('.s-polls-option-radio:not(.sPoll-processed)', context).addClass('sPoll-processed').bind('click', function() {
            // Extract the poll ID and poll option ID
           var option = $(this);
           var pollId = option.attr('name').substring(5);
           var pollOptId = option.val();

           // AJAX the answer call
           $.ajaxSecure({
                url: '/polls/answer/'+pollId+'/'+pollOptId,
                dataType: 'json',
                type: 'POST',
                success: function(data) {
                    var hasVoted = false;
                    $.each(data.opts, function(pollOptId, pollOpt){
                      if(pollOpt.my_choice == true){
                        hasVoted = true;
                      }
                    })

                    //if they have now voted, calculate then show
                    if(hasVoted){
                      sPollRefreshAnswers(data, context);
                      //remove the no-vote class so that answers will display
                      option.parents('.s-polls-update-poll-wrapper:first').removeClass('no-vote');
                    }
                    //otherwise hide then calculate
                    else{
                      option.parents('.s-polls-update-poll-wrapper:first').addClass('no-vote');
                      sPollRefreshAnswers(data, context);
                    }
                }
            });
        });

  $('.polls-fields-wrapper:not(.sPoll-processed)', context).addClass('sPoll-processed').each(function(){
    var pollFieldsWrapper = $(this);
    pollFieldsWrapper.on('click', '.delete-btn', function(e){
      sPollDeleteOption($(e.target), pollFieldsWrapper);
    });

    sPollCheckCanDelete(pollFieldsWrapper);
  });

  sPollResetAnswerCounts(context);
}

function sPollCheckCanDelete(context){
  if($('.s-polls-poll-option-wrapper:visible', context).length > 2){
    $('.delete-btn-disabled', context).removeClass('delete-btn-disabled').addClass('delete-btn').removeClass('hidden');
  }
  else if(($('.s-polls-poll-option-wrapper:visible', context).length <= 2)){
    $('.delete-btn', context).removeClass('delete-btn').addClass('delete-btn-disabled').addClass('hidden');
  }
}

function sPollCorrectOptsButtons(context) {
  var moreBtn = $('.s-polls-poll-add-option', context);

  if($(sPollHiddenPollWrappers, context).length == 0) {
    moreBtn.addClass('hidden');
    return;
  }

  moreBtn.removeClass('hidden');
}

function sPollShowPollInterface(context) {
  $('.s-polls-create-poll', context).addClass('active');
  $('#edit-has-poll', context).val(1);
  var pollWrapperObj = $(sPollHiddenPollWrappers, context);

  //ensure that all options up until the last non-empty option gets shown
  var lastFilled = 1;
  for(i = 2; i < 10; i++){
    if($('.form-text', pollWrapperObj.eq(i)).val().length){
      lastFilled = i;
    }
  }
  for(i = 0; i <= lastFilled; i++){
    pollWrapperObj.eq(i).removeClass('hidden');
  }

  $('.s-polls-poll-add-option', context).removeClass('hidden');

  sPollUpdateFocus(pollWrapperObj.eq(0));
  sPopupsResizeCenter();
}

function sPollHidePollInterface(context) {
  $('.s-polls-create-poll', context).removeClass('active');
  $('#edit-has-poll', context).val(0);

  $(sPollVisiblePollWrappers, context).addClass('hidden');
  $('.s-polls-poll-add-option', context).addClass('hidden');
}

function sPollClearPollFields(context) {
    //Reset all fields whether visible or not to be blank
    $(sPollHiddenPollTextFields, context).val('');
    $(sPollVisiblePollTextFields, context).val('');
}

function sPollResetAnswerCounts(context) {
    $('.s-polls-results-overlay', context).each(
        function() {
            var max = $(this).attr('max_answers');
            var ans = $(this).attr('this_answers');
            var width = 0;
            if(max != 0) {
                width = (100 * (ans / max));
            }
            $(this).css('width', width + '%');
        }
        );
}

function sPollRefreshAnswers(data, context) {
    //Target the wrapper for the specific poll we're refreshing
    var targetWrapper = '.s-polls-update-poll-wrapper.' + data.nid;

    //Go through every property in data.opts
    $.each(data.opts, function(pollOptId, pollOpt) {

        var radioBtnObj = $('.s-polls-option-radio.' + pollOptId);
        radioBtnObj.attr('checked', pollOpt.my_choice?true:false);

        if(!pollOpt.my_choice)
          radioBtnObj.removeAttr('checked');

        var targetsPollOverlay = $(targetWrapper + ' .s-polls-results-overlay.' + pollOptId);
        var targetsPollVoteCount = $(targetWrapper + ' .s-polls-vote-count.' + pollOptId);
        targetsPollOverlay.attr('max_answers', data.max_response_count).attr('this_answers', pollOpt.count);

        var newVoteText = '';

        if(pollOpt.count > 0) {
            newVoteText = Drupal.formatPlural(pollOpt.count, '1 vote', '@count votes');
        }
        targetsPollVoteCount.text(newVoteText);
    });

    //Animate our bars after AJAX'd data is all set
    sPollResetAnswerCounts(targetWrapper);
}

function sPollUpdateFocus(pollObject) {
  pollObject.find('.s-polls-poll-option-field').trigger('focus');
}

function sPollDeleteOption(deleteBtnObj, context) {
  var pollWrapper = deleteBtnObj.closest('.s-polls-poll-option-wrapper');
  var addObj = $('.s-polls-poll-add-option', context);

  //record the removal on the form so that the form submit can get rid of them from the DB
  var removedID = deleteBtnObj.attr('id');
  if(removedID){
    var removedObj = $('input#edit-removed-options', pollWrapper.closest('form'));
    var removedOpts = String(removedObj.val()).split(',');
    if(!removedOpts){
      removedOpts = [];
    }
    removedOpts.push(removedID);
    removedObj.val(removedOpts.join(','));
  }

  //remove markup
  pollWrapper.fadeOut('fast',function(){
    // manage the focus
    if(pollWrapper.next().is(':visible')) {
      pollWrapper.next().find('.form-text').trigger('focus');
    } else {
      pollWrapper.parent().find('.s-polls-poll-add-option').trigger('focus');
    }

    //hide the delete button if only 1 left
    sPollCheckCanDelete(context);

    pollWrapper.addClass('hidden');
    var pollInput = $('input', pollWrapper);
    pollInput.val('');
    //move this option at the end so that you can still add up to 10 poll options
    pollWrapper.insertBefore(addObj);
    pollWrapper.removeAttr('style');
    //redisplay the "Add Option" link if it became hidden
    if(addObj.hasClass('hidden')){
      addObj.removeClass('hidden');
    }
    sPopupsResizeCenter();
  });
}