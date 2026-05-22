Drupal.behaviors.sGradingScaleAutocomplete = function (context) {
  
  Drupal.sGradingScaleJSAC = function (input, db, opts) {
    var ac = this;
    this.input = input;
    this.db = db;
    this.timeout;
    this.mouseIsDown = false;
    this.inputMethod = null;

    opts = typeof opts == 'object' ? opts : {};
    this.opts = $.extend({
      blur_delay: 200
    }, opts);

    this.clickHandler = function (event) { ac.onclick(this, event); };
    this.keyDownHandler = function (event) { return ac.onkeydown(this, event); };
    this.keyUpHandler = function (event) { ac.onkeyup(this, event); };
    this.blurHandler = function (event) { ac.onblur(this, event);  };

    $(this.input)
      .click(this.clickHandler)
      .keydown(this.keyDownHandler)
      .keyup(this.keyUpHandler)
      .blur(this.blurHandler);
  };

  // keeping a reference to the parent "class" so the parent functions can be called without duplicating code
  Drupal.sGradingScaleJSAC.prototype = jQuery.extend({_parent: Drupal.jsAC.prototype}, Drupal.jsAC.prototype);
  //Hides popup after keydown callback is executed
  Drupal.sGradingScaleJSAC.prototype.onblur = function (input, e) {
    var ac = this;
    if(this.mouseIsDown === false) {
      clearTimeout(this.timeout);
      if(this.opts.blur_delay){
        this.timeout = setTimeout(function(){
            ac.hidePopup();
            ac.db.cancel();
        }, this.opts.blur_delay);
      }
      else{
        ac.hidePopup();
        ac.db.cancel();
      }
    }
  };

  Drupal.sGradingScaleJSAC.prototype.unmount = function() {
    $(this.input).off("click", this.clickHandler);
    $(this.input).off("keydown", this.keyDownHandler);
    $(this.input).off("keyup", this.keyUpHandler);
    $(this.input).off("blur", this.blurHandler);
  };

  Drupal.sGradingScaleJSAC.prototype.setMouseDownState = function (e, state) {
    this.mouseIsDown = state;
  };
  
  Drupal.sGradingScaleJSAC.prototype.onclick = function (input, e) {
    if (this.input.value.search(/^[0-9]/) != 0) {
        this.populatePopup();
        return true;
    }
    return false;
  };
  
  Drupal.sGradingScaleJSAC.prototype.onkeyup = function (input, e) {
    //just overload parent method
    return true;
  };

  Drupal.sGradingScaleJSAC.prototype.onkeydown = function (input, e) {
    var KEY_ENTER = 13,
      KEY_ESC = 27,
      KEY_UP = 38,
      KEY_DOWN = 40;
    switch (e.which) {
      case KEY_DOWN:
        this.selectDown();
        this.inputMethod = 'select';
        return false;
      case KEY_UP:
        this.selectUp();
        this.inputMethod = 'select';
        return false;
      case KEY_ESC:
        this.selected = null;
        return true;
      case KEY_ENTER:
        this.save();
        return true;
      default:
        this.inputMethod = 'direct';
        return true;
    }
    return true;
  };

  Drupal.sGradingScaleJSAC.prototype.hidePopup = function () {
    // Hide popup
    var popup = this.popup;
    if (popup) {
      this.popup = null;
      $(popup).fadeOut('fast', function() { $(popup).remove(); });
    }
  };

  Drupal.sGradingScaleJSAC.prototype.save = function () {
    if (this.selected && this.selected.autocompleteValue !== undefined && this.inputMethod === 'select') {
      this.input.value = this.selected.autocompleteValue;
    }
    this.selected = false;

    $(this.input).triggerHandler('sGradingScaleSelectionMade');
  };
  
  Drupal.sGradingScaleJSAC.prototype.populatePopup = function () {
    // Show popup
    if (this.popup) {
      $(this.popup).remove();
    }
    var ac = this;
    this.selected = false;
    this.popup = document.createElement('div');
    this.popup.id = 'autocomplete';
    this.popup.owner = this;
    
    var inputObj = $(this.input);
    var offset = inputObj.offset();
    var popupTop = offset.top + inputObj.get(0).offsetHeight;
    var popupWidth = (inputObj.outerWidth() - parseInt(inputObj.css('border-left-width')) - parseInt(inputObj.css('border-right-width')));
    $(this.popup).css({
      position: 'absolute',
      zIndex: '9999999',
      top: popupTop,
      left: offset.left,
      minWidth: popupWidth,
      width: 'auto',
      display: 'none'
    });
    $(this.popup).addClass('grading-scale-ac-popup').addClass('ac_results');
    $(document.body).append(this.popup);
    $(this.popup).mousedown(function(event) {
      if($(event.target).hasClass('grading-scale-ac-popup')) {
          ac.setMouseDownState(event, true);
      }
    });

    // Do search
    this.db.owner = this;
    this.db.search($(this.input).data('grading-scale-id'));
  };

  Drupal.sGradingScaleJSAC.prototype.found = function (matches) {
    // filter matches based on input.value
    var matches = jQuery.extend({}, matches);
    const sortedScaleScores = Object.keys(matches).sort((a, b) => Number(a) - Number(b));
    // Prepare matches
    var ul = document.createElement('ul');
    ul.className = 'grading-scale-acc-popup_body';
    var ac = this;
    sortedScaleScores.forEach((score) => {
      var html = '<span class="grading-scale-ac-popup__key">' + htmlentities(score) + '</span>';
      if (matches[score]) {
        html += '<span class="grading-scale-ac-popup__value">' + matches[score] + '</span>';
      }
      var li = document.createElement('li');
      li.className = 'grading-scale-ac-popup__item';
      $(li)
        .html(html)
        .mousedown(function () {
            ac.select(this);
            ac.mouseIsDown = false;
            ac.inputMethod = 'select';
            ac.save();
        })
        .mouseover(function () { ac.highlight(this); })
        .mouseout(function () { ac.unhighlight(this); });
      li.autocompleteValue = score;
      
      var pattn = this.input.value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      var regex = new RegExp('^'+pattn+'$','i');
      if(score.search(regex) == 0) {
          ac.highlight(li);
      }
      
      $(ul).append(li);
    });
    
    // Show popup with matches, if any
    if (this.popup) {
      if (ul.childNodes.length > 0) {
        $(this.popup).empty().append(ul).show();
        // show popup above input field if the window is not tall enough
        var inputObj = $(this.input);
        var offset = inputObj.offset();
        var popupTop = offset.top + inputObj.get(0).offsetHeight;
        var popupHeight = $(ul).parent().height();
        var windowHeight = $(window).height();
        if((popupTop + popupHeight) > windowHeight) {
            $(ul).parent().css({
                top:  $(ul).parent().css('top').replace(/px$/, '') - popupHeight - inputObj.get(0).offsetHeight
            });
        }
      }
      else {
        $(this.popup).css({visibility: 'hidden'});
        this.hidePopup();
      }
    }
  };

  Drupal.sGradingScaleJSAC.prototype.highlight = function (node) {
    this._parent.highlight.call(this, node);

    // adding a hook to support additional behavior when the element highlighted has been changed
    $(this.input).trigger('sGradingScaleJSAC.onHighlight', [node]);
  };
  
  var sGradingScaleDatabase;
  $('input.grading-scale-ac:not(.sGradingScaleAutocomplete-processed)', context).each(function () {
    var input = this;
    var uri = '/grading_scale/' + $(input).data('course-nid');
    
    if (sGradingScaleDatabase === undefined) {
      sGradingScaleDatabase = new Drupal.ACDB(uri);
    }
    
    $(input.form).submit(Drupal.autocompleteSubmit);
    $(input).data('grading-scale', new Drupal.sGradingScaleJSAC(input, sGradingScaleDatabase));
    $(input).addClass('sGradingScaleAutocomplete-processed');
  });
};
