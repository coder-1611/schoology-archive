// $Id: autocomplete.js,v 1.23 2008/01/04 11:53:21 goba Exp $

/**
 * Attaches the autocomplete behavior to all required fields
 */
Drupal.behaviors.autocomplete = function (context) {
  var acdb = [];
  $('input.autocomplete:not(.autocomplete-processed)', context).each(function () {
    var uri = this.value;
    if (!acdb[uri]) {
      acdb[uri] = new Drupal.ACDB(uri);
    }
    var input = $('#' + this.id.substr(0, this.id.length - 13))
      .attr('autocomplete', 'OFF')[0];
    $(input.form).submit(Drupal.autocompleteSubmit);
    new Drupal.jsAC(input, acdb[uri]);
    $(this).addClass('autocomplete-processed');
  });
};

/**
 * Prevents the form from submitting if the suggestions popup is open
 * and closes the suggestions popup when doing so.
 */
Drupal.autocompleteSubmit = function () {
  return $('.drupal-ac-results-popup, #autocomplete').each(function () {
    if (this.owner) {
      this.owner.hidePopup();
    }
  }).size() == 0;
};

/**
 * An AutoComplete object
 */
Drupal.jsAC = function (input, db) {
  var ac = this;
  this.input = input;
  this.db = db;

  // Unique ID counter for the results listbox element (the inner <ul>).
  // The outer popup container keeps the historical fixed id "autocomplete"
  // so that existing CSS/JS that targets #autocomplete is not broken.
  Drupal.jsAC._idCounter = (Drupal.jsAC._idCounter || 0) + 1;
  this.listboxId = 'drupal-ac-listbox-' + Drupal.jsAC._idCounter;

  // Add ARIA combobox attributes to the input
  $(this.input).attr({
    'role': 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-haspopup': 'listbox',
    'aria-controls': this.listboxId
  });

  // Use a single shared live region for all Drupal jsAC instances.
  // Screen readers (especially JAWS) require live regions to be present in the
  // DOM before the user interacts with the field. A shared region created on
  // first use persists across popup open/close cycles.
  if (!$('#' + Drupal.jsAC.ANNOUNCER_ID).length) {
    $('<div/>')
      .attr({
        'id': Drupal.jsAC.ANNOUNCER_ID,
        'role': 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true'
      })
      .addClass('visually-hidden')
      .appendTo(document.body);
  }
  this.$status = $('#' + Drupal.jsAC.ANNOUNCER_ID);

  $(this.input)
    .keydown(function (event) { return ac.onkeydown(this, event); })
    .keyup(function (event) { ac.onkeyup(this, event); })
    .blur(function () { ac.hidePopup(); ac.db.cancel(); });

};

// ID of the single shared live region used by all jsAC instances to announce
// result counts to screen readers.
Drupal.jsAC.ANNOUNCER_ID = 'drupal-ac-announcer';

/**
 * Handler for the "keydown" event
 */
Drupal.jsAC.prototype.onkeydown = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 40: // down arrow
      this.selectDown();
      return false;
    case 38: // up arrow
      this.selectUp();
      return false;
    default: // all other keys
      return true;
  }
};

/**
 * Handler for the "keyup" event
 */
Drupal.jsAC.prototype.onkeyup = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 16: // shift
    case 17: // ctrl
    case 18: // alt
    case 20: // caps lock
    case 33: // page up
    case 34: // page down
    case 35: // end
    case 36: // home
    case 37: // left arrow
    case 38: // up arrow
    case 39: // right arrow
    case 40: // down arrow
      return true;

    case 9:  // tab
    case 13: // enter
    case 27: // esc
      this.hidePopup(e.keyCode);
      return true;

    default: // all other keys
      if (input.value.length > 0)
        this.populatePopup();
      else
        this.hidePopup(e.keyCode);
      return true;
  }
};

/**
 * Puts the currently highlighted suggestion into the autocomplete field
 */
Drupal.jsAC.prototype.select = function (node) {
  this.input.value = node.autocompleteValue;
};

/**
 * Highlights the next suggestion
 */
Drupal.jsAC.prototype.selectDown = function () {
  if (this.selected && this.selected.nextSibling) {
    this.highlight(this.selected.nextSibling);
  }
  else {
    var lis = $('li', this.popup);
    if (lis.size() > 0) {
      this.highlight(lis.get(0));
    }
  }
};

/**
 * Highlights the previous suggestion
 */
Drupal.jsAC.prototype.selectUp = function () {
  if (this.selected && this.selected.previousSibling) {
    this.highlight(this.selected.previousSibling);
  }
};

/**
 * Highlights a suggestion
 */
Drupal.jsAC.prototype.highlight = function (node) {
  if (this.selected) {
    $(this.selected).removeClass('selected').attr('aria-selected', 'false');
  }
  $(node).addClass('selected').attr('aria-selected', 'true');
  this.selected = node;
  // Track the focused option for assistive technologies
  if (node && node.id) {
    $(this.input).attr('aria-activedescendant', node.id);
  } else {
    $(this.input).removeAttr('aria-activedescendant');
  }
};

/**
 * Unhighlights a suggestion
 */
Drupal.jsAC.prototype.unhighlight = function (node) {
  $(node).removeClass('selected').attr('aria-selected', 'false');
  this.selected = false;
  $(this.input).removeAttr('aria-activedescendant');
};

/**
 * Hides the autocomplete suggestions
 */
Drupal.jsAC.prototype.hidePopup = function (keycode) {
  // Select item if the right key or mousebutton was pressed
  if (this.selected && ((keycode && keycode != 46 && keycode != 8 && keycode != 27) || !keycode)) {
    this.input.value = this.selected.autocompleteValue;
  }
  // Hide popup
  var popup = this.popup;
  if (popup) {
    this.popup = null;
    $(popup).fadeOut('fast', function() { $(popup).remove(); });
  }
  this.selected = false;
  $(this.input).attr('aria-expanded', 'false').removeAttr('aria-activedescendant');
  if (this.$status) {
    this.$status.text('');
  }
};

/**
 * Positions the suggestions popup and starts a search
 */
Drupal.jsAC.prototype.populatePopup = function () {
  // Show popup
  if (this.popup) {
    $(this.popup).remove();
  }
  this.selected = false;
  this.popup = document.createElement('div');
  this.popup.id = 'autocomplete';
  this.popup.owner = this;
  $(this.popup).addClass('drupal-ac-results-popup').css({
    marginTop: this.input.offsetHeight +'px',
    width: (this.input.offsetWidth - 4) +'px',
    display: 'none'
  });
  $(this.input).before(this.popup);

  // Do search
  this.db.owner = this;
  this.db.search(this.input.value);
};

/**
 * Fills the suggestion popup with any matches received
 */
Drupal.jsAC.prototype.found = function (matches) {
  // If no value in the textfield, do not show the popup.
  if (!this.input.value.length) {
    return false;
  }

  // Prepare matches
  var $ul = $(document.createElement('ul')).attr({'role': 'listbox', 'id': this.listboxId});
  var ac = this;
  $ul.on('mousedown', 'li', function() {ac.select(this);})
    .on('mouseover', 'li', function() {ac.highlight(this);})
    .on('mouseout', 'li', function() {ac.unhighlight(this);});

  var optionIndex = 0;
  var appendToUl = function(value, label) {
    var li = document.createElement('li');
    li.autocompleteValue = value;
    li.id = ac.listboxId + '-option-' + (optionIndex++);
    $(li).html('<div>' + label + '</div>').attr({'role': 'option', 'aria-selected': 'false'});
    $ul.append(li);
  };

  // err msg returned from PHP array (e.g) 0 => 'error msg' will be consider as array
  // but we want to handle it in our object loop block
  if ($.isArray(matches) && typeof matches[0] === 'object') {
    for(var i = 0; i < matches.length; i++) {
      var eachMatch = matches[i];
      appendToUl(eachMatch.value, eachMatch.label);
    }
  } else {
    for (var key in matches) {
      appendToUl(key, matches[key]);
    }
  }

  // Show popup with matches, if any
  if (this.popup) {
    if ($ul.children().length > 0) {
      $(this.popup).empty().append($ul).show();
      $(this.input).attr('aria-expanded', 'true');
      var count = $ul.children().length;
      var statusText = (typeof Drupal.formatPlural === 'function')
        ? Drupal.formatPlural(count, '1 result available', '@count results available')
        : count + (count === 1 ? ' result available' : ' results available');
      if (this.$status) {
        this.$status.text(statusText);
      }
    }
    else {
      $(this.popup).css({visibility: 'hidden'});
      this.hidePopup();
    }
  }
};

Drupal.jsAC.prototype.setStatus = function (status) {
  switch (status) {
    case 'begin':
      $(this.input).addClass('throbbing');
      break;
    case 'cancel':
    case 'error':
    case 'found':
      $(this.input).removeClass('throbbing');
      break;
  }
};

/**
 * An AutoComplete DataBase object
 */
Drupal.ACDB = function (uri) {
  this.uri = uri;
  this.delay = 300;
  this.cache = {};
};

/**
 * Performs a cached and delayed search
 */
Drupal.ACDB.prototype.search = function (searchString) {
  var db = this;
  this.searchString = searchString;

  // See if this key has been searched for before
  if (this.cache[searchString]) {
    return this.owner.found(this.cache[searchString]);
  }

  // Initiate delayed search
  if (this.timer) {
    clearTimeout(this.timer);
  }
  this.timer = setTimeout(function() {
    db.owner.setStatus('begin');

    // Ajax GET request for autocompletion
    $.ajax({
      type: "GET",
      url: Drupal.sanitizeAjaxUrl(db.uri + '/' + Drupal.encodeURIComponent(searchString)),
      dataType: 'json',
      jsonp: false,
      success: function (matches) {
        if (typeof matches['status'] == 'undefined' || matches['status'] != 0) {
          db.cache[searchString] = matches;
          // Verify if these are still the matches the user wants to see
          if (db.searchString == searchString) {
            db.owner.found(matches);
          }
          db.owner.setStatus('found');
        }
      },
      error: function (xmlhttp) {
        alert(Drupal.ahahError(xmlhttp, db.uri));
      }
    });
  }, this.delay);
};

/**
 * Cancels the current autocomplete request
 */
Drupal.ACDB.prototype.cancel = function() {
  if (this.owner) this.owner.setStatus('cancel');
  if (this.timer) clearTimeout(this.timer);
  this.searchString = '';
};
