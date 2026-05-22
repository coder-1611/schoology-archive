// Sticky Plugin v1.0.2 for jQuery
// =============
// Author: Anthony Garand
// Improvements by German M. Bravo (Kronuz) and Ruud Kamphuis (ruudk)
// Improvements by Leonardo C. Daronco (daronco)
// Created: 2/14/2011
// Date: 16/04/2015
// Website: http://labs.anthonygarand.com/sticky
// Description: Makes an element on the page stick on the screen as you scroll
//       It will only set the 'top' and 'position' of your element, you
//       might need to adjust the width in some cases.

(function($) {
    var slice = Array.prototype.slice; // save ref to original slice()
    var splice = Array.prototype.splice; // save ref to original slice()

  var defaults = {
      topSpacing: 0,
      bottomSpacing: 0,
      className: 'is-sticky',
      wrapperClassName: 'sticky-wrapper',
      center: false,
      getWidthFrom: '',
      bindToBottomOf: false,
      widthFromWrapper: true, // works only when .getWidthFrom is empty
      responsiveWidth: false,
      scrollCallback: null
    },
    $window = $(window),
    $document = $(document),
    sticked = [],
    windowHeight = $window.height(),
    scroller = function() {
      var scrollTop = $window.scrollTop(),
        scrollLeft = $window.scrollLeft(),
        documentHeight = $document.height(),
        dwh = documentHeight - windowHeight,
        extra = (scrollTop > dwh) ? dwh - scrollTop : 0;

      for (var i = 0; i < sticked.length; i++) {
        var s = sticked[i],
          sOffset = s.stickyWrapper.offset(),
          elementTop = sOffset.top,
          elementLeft = sOffset.left,
          topSpacing = s.topSpacingComputed(),
          etse = elementTop - topSpacing - extra,
          isSticky = scrollTop > etse;

        if (!isSticky) {
          if (s.currentTop !== null) {
            s.stickyElement
              .css({
                'width': '',
                'position': '',
                'top': '',
                'left': ''
              });
            s.stickyElement.parent().removeClass(s.className);
            s.stickyElement.trigger('sticky-end', [s]);
            s.currentTop = null;
          }
          s.currentLeft = null;
        }
        else {
          var newTop = documentHeight - s.stickyElement.outerHeight()
            - topSpacing - s.bottomSpacing - scrollTop - extra;
          if (newTop < 0) {
            newTop = newTop + topSpacing;
          } else {
            newTop = topSpacing;
          }
          if (s.currentTop != newTop) {
            var newWidth = null;
            if ( s.getWidthFrom ) {
                newWidth = $(s.getWidthFrom).width() || null;
            }
            else if(s.widthFromWrapper) {
                newWidth = s.stickyWrapper.width();
            }
            if ( newWidth == null ) {
                newWidth = s.stickyElement.width();
            }
            s.stickyElement
              .css('width', newWidth)
              .css('position', 'fixed')
              .css('top', newTop);

            s.stickyElement.parent().addClass(s.className);

            if (s.currentTop === null) {
              s.stickyElement.trigger('sticky-start', [s]);
            } else {
              // sticky is started but it have to be repositioned
              s.stickyElement.trigger('sticky-update', [s]);
            }

            if (s.currentTop === topSpacing && s.currentTop > newTop || s.currentTop === null && newTop < topSpacing) {
              // just reached bottom || just started to stick but bottom is already reached
              s.stickyElement.trigger('sticky-bottom-reached', [s]);
            } else if(s.currentTop !== null && newTop === topSpacing && s.currentTop < newTop) {
              // sticky is started && sticked at topSpacing && overflowing from top just finished
              s.stickyElement.trigger('sticky-bottom-unreached', [s]);
            }
            s.currentTop = newTop;
          }

          var newLeft = elementLeft - scrollLeft;
          if(newLeft != s.currentLeft){
            s.stickyElement.css('left', elementLeft - scrollLeft);
            s.currentLeft = newLeft;
          }
        }
        if (s.scrollCallback) s.scrollCallback(isSticky);
      }
    },
    resizer = function() {
      windowHeight = $window.height();

      for (var i = 0; i < sticked.length; i++) {
        var s = sticked[i];
        var newWidth = null;
        if ( s.getWidthFrom ) {
            if ( s.responsiveWidth === true ) {
                newWidth = $(s.getWidthFrom).width();
            }
        }
        else if(s.widthFromWrapper) {
            newWidth = s.stickyWrapper.width();
        }
        if ( newWidth != null ) {
           s.stickyElement.css('width', newWidth);
        }
      }
      scroller();
    },
    methods = {
      init: function(options) {
        var o = $.extend({}, defaults, options);
        return this.each(function() {
          var stickyElement = $(this);

          // Check to see if they are already sticky
          if(stickyElement.parent().hasClass(o.className)) return;

          var stickyId = stickyElement.attr('id');
          var stickyHeight = stickyElement.outerHeight();
          var wrapperId = stickyId ? stickyId + '-' + defaults.wrapperClassName : defaults.wrapperClassName
          var wrapper = $('<div></div>')
            .attr('id', wrapperId)
            .addClass(o.wrapperClassName);

          stickyElement.wrapAll(wrapper);

          var stickyWrapper = stickyElement.parent();

          if (o.center) {
            stickyWrapper.css({width:stickyElement.outerWidth(),marginLeft:"auto",marginRight:"auto"});
          }

          if (stickyElement.css("float") == "right") {
            stickyElement.css({"float":"none"}).parent().css({"float":"right"});
          }

          stickyWrapper.css('height', stickyHeight);

          o.stickyElement      = stickyElement;
          o.stickyWrapper      = stickyWrapper;
          o.currentTop         = null;
          o.currentLeft        = null;

          // Resolve Bind To Bottom option
          if(o.bindToBottomOf !== false){
            var i = sticked.length;
            while ( i-- > 0 ){
              if(sticked[i].stickyElement.get(0) === o.bindToBottomOf.get(0)){
                o.bindToBottomOf = sticked[i];
                break;
              }
            }
            if(i == -1) o.bindToBottomOf = false;
          }

          o.topSpacingComputed = function(){
              if(o.bindToBottomOf === false) return o.topSpacing;
              return o.topSpacing + o.bindToBottomOf.stickyElement.outerHeight() + o.bindToBottomOf.topSpacingComputed();
          }

          sticked.push(o);
        });
      },
      update: scroller,
      updateHeight: function(){
        return $(sticked).each(function(){
          this.stickyWrapper.css('height', this.stickyElement.outerHeight());
        });
      },
      unstick: function(options) {
        return this.each(function() {
          var that = this;
          var unstickyElement = $(that);

          var removeIdx = -1;
          var i = sticked.length;
          while ( i-- > 0 )
          {
            if (sticked[i].stickyElement.get(0) === that)
            {
                splice.call(sticked,i,1);
                removeIdx = i;
            }
          }
          if(removeIdx != -1)
          {
            unstickyElement.unwrap();
            unstickyElement
              .css({
                'width': '',
                'position': '',
                'top': '',
                'float': ''
              })
            ;
          }
        });
      }
    };

  // should be more efficient than using $window.scroll(scroller) and $window.resize(resizer):
  if (window.addEventListener) {
    window.addEventListener('scroll', scroller, false);
    window.addEventListener('resize', resizer, false);
  } else if (window.attachEvent) {
    window.attachEvent('onscroll', scroller);
    window.attachEvent('onresize', resizer);
  }

  $.fn.sticky = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, slice.call(arguments, 1));
    } else if (typeof method === 'object' || !method ) {
      return methods.init.apply( this, arguments );
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.sticky');
    }
  };

  $.fn.unstick = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, slice.call(arguments, 1));
    } else if (typeof method === 'object' || !method ) {
      return methods.unstick.apply( this, arguments );
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.sticky');
    }

  };
  $(function() {
    setTimeout(scroller, 0);
  });
})(jQuery);
