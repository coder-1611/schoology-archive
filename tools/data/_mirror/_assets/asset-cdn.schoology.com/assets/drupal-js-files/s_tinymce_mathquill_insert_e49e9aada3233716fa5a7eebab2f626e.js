Drupal.behaviors.sTinymceMathquill = function(context){

  // initialize formula editor elements
  $('.s-formula-editable:not(.sTinymceMathquill-processed)', context).addClass('sTinymceMathquill-processed').each(function(){
    sMathquill.initMathquill(this);
  });

  var popup = Popups.activePopup();
  if(!popup || !$('#' + popup.id).hasClass('tinymce-mathquill-formula-popup')) return;

  $('.submit-btn', context).click(function(e){
    e.preventDefault();

    var latex = sMathquill.save();
    if(!latex || !latex.length) return;

    // remove the modded formula image
    var img = $(document).data('s_content_saved_formula_image');
    if(img) {
      $(img).remove();
      // clear out the lastNode value
      tinyMCE.activeEditor.execCommand('sContentSaveLastNode');
    }

    $(document).data('s_content_saved_formula_image', null);

    img = tinyMCE.activeEditor.execCommand('sContentLatexImgTag', latex, 'mathquill-formula');
    Popups.close();
    tinyMCE.activeEditor.execCommand('sContentInsert' , img, { use_native_insert: true });
  });
};

if(typeof sMathquill == 'undefined'){
  sMathquill = (function(){
    var obj = {};
    obj.editors = [];
    obj.activeEditor = null;
    obj.config = {};
    obj.menuItemList = {};

    /**
     * Initialize a new markup element to be placed in a menu bar
     *
     * @param object cfg
     */
    _newMarkup = function(cfg){
      return {
        type: 'markup',
        html: cfg.html
      };
    };

    /**
     * Initialize a new command button
     * Executes a command in Mathquill and triggers a refocus.
     *
     * @param object cfg
     */
    _newCommandButton = function(cfg){
      var cmd = typeof cfg.cmd == 'object' ? cfg.cmd.join('') : cfg.cmd;
      return {
        type: 'button',
        extraClass: 's-mq-btn s-mq-icon',
        label: cmd,
        tooltip: cmd.replace('\\', ''),
        fn: function(args){
          args.event.preventDefault();
          if(typeof cfg.cmd == 'object'){
            $.each(cfg.cmd, function(k, cmd){
              args.editor.mathquill('cmd', cmd);
            });
          }
          else{
            args.editor.mathquill('cmd', cfg.cmd);
          }
          args.editor.trigger('focus');
        }
      };
    };

    /**
     * Initialize a new text button
     * Executes a write in Mathquill and triggers a refocus.
     *
     * @param object cfg
     */
    _newTextButton = function(cfg){
      return {
        type: 'button',
        extraClass: 's-mq-btn s-mq-icon',
        label: cfg.text,
        tooltip: cfg.text,
        fn: function(args){
          args.event.preventDefault();
          args.editor.mathquill('write', cfg.text);
          args.editor.trigger('focus');
        }
      };
    };

    /**
     * Initialize a new menu toggle button that toggles visibility of sub menus and refocuses on the editor
     *
     * @param object cfg
     */
    _newMenuToggleButton = function(cfg){
      var menuClass = 's-mq-' + cfg.key.replace(/_/g, '-').toLowerCase();
      return {
        type: 'button',
        extraClass: 's-mq-btn s-mq-menu-toggle',
        label: cfg.label,
        tooltip: cfg.label,
        fn: function(args){
          var e = args.event,
              ed = args.editor;
          e.preventDefault();
          var btnObj = $(this);
          if(btnObj.hasClass('active')){
            //closing a menu
            btnObj.removeClass('active');
            ed.siblings('.s-mq-submenu.' + menuClass).addClass('hidden');
          }
          else{
            //opening a menu
            btnObj.addClass('active')
                  .siblings('.s-mq-menu-toggle')
                  .removeClass('active');
            var subMenus = ed.siblings('.s-mq-submenu');
            subMenus.not('.' + menuClass).addClass('hidden');
            subMenus.filter('.' + menuClass).removeClass('hidden');
          }
          obj.resize();
          ed.trigger('focus');
        }
      };
    };

    /**
     * Initialize a default button.
     * This just adds an element to the DOM, any bindings will be done externally.
     * Function may be passed in to the fn member of cfg.
     *
     * @param object cfg
     */
    _newDefaultButton = function(cfg){
      var btn = {
        type: 'button',
        label: cfg.label,
        extraClass: 's-mq-btn'
      };
      if(typeof cfg.fn == 'function'){
        btn.fn = cfg.fn;
      }
      return btn
    };

    /**
     * Initialize Mathquill editor on a given element
     *
     * @param string/object selector or DOM element
     * @param object opts
     */
    obj.initMathquill = function(element, opts){
      var menuBars = null;
      if(typeof opts == 'undefined'){
        var opts = {};
      }
      var defaults = {
        editable: true,
        autoHeight: false
      };
      opts = $.extend(defaults, opts);

      // initialize Mathquill on the given element
      var el = $(element);
      if(opts.editable){
        el.index = obj.editors.length;
        el.menuBars = [];
        el.hooks = {};
        el.opts = opts;

        _execAllHooks('onBeforeEditorCreate', [el]);

        el.mathquill('editable');

        el.initialHeight = el.innerHeight();

        // set this element as the active editor
        obj.activeEditor = el;

        // bind the focus event to help identify the current editor
        el.find('textarea').bind('focus', function(){
          obj.activeEditor = el;
        });

        // add a command bar with a bunch of default buttons
        if(typeof obj.config.menu_bars != 'undefined'){
          $.each(obj.config.menu_bars, function(name, cfg){
            cfg.name = name;
            obj.addMenuBar(cfg);
          });
          this.resize();
        }

        obj.editors.push(el);

        _execAllHooks('onEditorCreate', [el]);
      }
      else{
        el.mathquill();
      }
      return el;
    };

    /**
     * Add a command bar to the active editor
     *
     * @param object opts
     *   string menuItem  comma separated list of keys representing a menu item
     *
     * @return object
     */
    obj.addMenuBar = function(opts){
      var ed = obj.activeEditor,
          menuItems = [];
      if(!ed){
        return;
      }

      if(typeof opts == 'undefined'){
        var opts = {};
      }
      var defaults = {
        submenu: false,
        multiline: false
      };
      opts = $.extend(defaults, opts);
      if(typeof opts.menu_items == 'object'){
        opts.menu_items = opts.menu_items.join(',');
      }
      if(typeof opts.menu_items == 'string'){
        $.each(opts.menu_items.split(','), function(idx, key){
          if(new_item = obj.getMenuItem(key)){
            menuItems.push(new_item);
          }
        });
      }

      var newBarObj = $('<div/>').addClass('s-mq-menu-bar');
      // newBarObj.width(ed.outerWidth() - 2);

      if(typeof opts.name == 'string'){
        newBarObj.addClass('s-mq-menu-' + opts.name.replace(/_/g, '-').toLowerCase());
      }

      if(typeof opts.submenu != 'undefined' && opts.submenu){
        newBarObj.addClass('s-mq-submenu').addClass('hidden');
      }

      if(typeof opts.multiline != 'undefined' && opts.multiline){
        newBarObj.addClass('s-mq-menu-multiline');
      }

      // put the menuItems in the menu bar if there are any
      if(menuItems.length){
        $.each(menuItems, function(i, menuItem){
          var newMenuItem = null;
          switch(menuItem.type){
            case 'button':
              newMenuItem = obj.addButtonToMenuBar(newBarObj, menuItem);
              break;

            case 'markup':
              newBarObj.append(menuItem.html);
              break;
          }

          if(!opts.submenu && newMenuItem){
            newMenuItem.addClass('s-mq-menu-item');
          }
        });
      }

      if(typeof opts.extraClass == 'string'){
        newBarObj.addClass(opts.extraClass);
      }

      newBarObj.insertBefore(ed);

      ed.menuBars.push(newBarObj);

      return newBarObj;
    };

    /**
     * Add a button to the menu bar
     *
     * @param int/object menuBar  provide int to reference a menu bar in the active editor
     *                            provide object of the menu bar object
     * @param object btn
     *
     * @return object
     */
    obj.addButtonToMenuBar = function(menuBar, btn){
      var menuBarObj = null,
          ed = obj.activeEditor;

      // set the menuBarObj by determining whether an object was passed or an int to reference the menuBar in the current editor
      if(typeof menuBar == 'object'){
        if(menuBar.hasClass('s-mq-menu-bar')){
          menuBarObj = menuBar;
        }
      }
      else if(typeof menuBar == 'number') {
        if(ed && typeof ed.menuBars[menuBar] == 'object'){
          menuBarObj = ed.menuBars[menuBar];
        }
      }

      if(!menuBarObj){
        return null;
      }

      var defaults = {
        label: '',
        extraClass: '',
        size: 20,
        fn: function() {}
      };
      btn = $.extend(defaults, btn);

      var btnObj = $('<span/>').bind('click', function(e){
        btn.fn.apply(this, [{editor: ed, event: e}]);
      });
      btnLabel = $('<span/>').addClass('s-mq-label').appendTo(btnObj);

      if(btn.label.length){
        btnLabel.text(btn.label);
      }

      if(btn.tooltip.length){
        btnObj.attr('title', btn.tooltip);
      }

      if(btn.extraClass.length){
        btnObj.addClass(btn.extraClass);
      }

      btnObj.addClass('s-mq-size' + btn.size);

      if(btnObj.hasClass('s-mq-embed')){
        // has latex command embedded
        // need to run mathquill on the label text and render it
        var renderedHTML = $('<span/>').text(btnLabel.text()).mathquill('editable').mathquill('html');
        btnLabel.html(renderedHTML).addClass('mathquill-rendered-math');
      }
      else{
        // does an html entities decode
        btnLabel.html(btnLabel.text());
      }

      btnObj.appendTo(menuBarObj);

      if(typeof btn.onAdd == 'function'){
        btn.onAdd.apply(obj, [btnObj]);
      }

      return btnObj;
    };

    /**
     * Retrieve the menu item object given the key.
     *
     * @param string key  unique key that defines a menu item
     */
    obj.getMenuItem = function(key){
      var template = null,
          cfg = null;
      if(typeof this.menuItemList[key] == 'undefined'){
        if(key.length){
          // if there is no config for it, create a standard command button
          cfg = {
            key: key,
            cmd: '\\' + key
          };
        }
      }
      else {
        cfg = this.menuItemList[key];
      }

      if(cfg){
        cfg.key = key;
        if(typeof cfg.html != 'undefined'){
          template = _newMarkup(cfg);
        }
        else if(typeof cfg.cmd != 'undefined'){
          // command button will trigger a cmd and refocus on the editor
          template = _newCommandButton(cfg);
        }
        else if(typeof cfg.text == 'string'){
          // text button will trigger a text call and refocus on the editor
          template = _newTextButton(cfg);
        }
        else if(typeof cfg.menu_toggle != 'undefined'){
          template = _newMenuToggleButton(cfg);
        }
        else{
          template = _newDefaultButton(cfg);
        }

        if(typeof template == 'object' && template){
          if(typeof template.extraClass == 'undefined'){
            template.extraClass = '';
          }

          // give the menu item a class with its key
          template.extraClass += ' s-mq-' + cfg.key.replace(/_/g, '-').toLowerCase();

          // can set the compile_label to false to prevent mathquilling the contents
          if(typeof cfg.compile_label != 'boolean' || cfg.compile_label){
            template.extraClass += ' s-mq-embed';
          }

          if(typeof cfg.extraClass == 'string'){
            template.extraClass += ' ' + cfg.extraClass;
          }

          // the tooltip that appears on mouseover
          if(typeof cfg.tooltip != 'undefined'){
            // use the tooltip that is defined in the config
            template.tooltip = cfg.tooltip;
          }
          else if(typeof template.tooltip == 'undefined'){
            // use the label as a
            template.tooltip = typeof template.label != 'undefined' ? template.label : key;
          }

          // use the label that is defined in the config
          if(typeof cfg.label != 'undefined'){
            template.label = cfg.label;
          }
        }
      }

      return template;
    };


    /**
     * Adjust the size of the editor to fit the menu bars.
     */
    obj.resize = function(){
      var ed = obj.activeEditor;
      if(ed && typeof ed.initialHeight != 'undefined' && typeof ed.opts.autoHeight != 'undefined' && ed.opts.autoHeight){
        var height = ed.initialHeight;
        if(ed.menuBars.length){
          $.each(ed.menuBars, function(k, menuBar){
            if(menuBar.is(':visible')){
              height -= menuBar.outerHeight();
            }
          });

          ed.height(height);
        }
      }
    };

    /**
     * Execute a command on the active editor if there is one.
     *
     * @param string cmd
     * @param mixed,... args
     */
    obj.exec = function(){
      var ed;
      if(ed = this.activeEditor){
        var args = Array.prototype.slice.call(arguments);
        return ed.mathquill.apply(ed, args);
      }

      return null;
    };

    /**
     * Convenience method to write to the active editor
     *
     * @param string latex
     */
    obj.write = function(latex){
      return obj.exec('write', latex);
    };

    /**
     * Convenience method for executing a Mathquill command on the active editor.
     *
     * @param string cmd
     */
    obj.cmd = function(cmd){
      return obj.exec('cmd', cmd);
    };

    /**
     * Convenience method for resetting the contents of the active editor.
     */
    obj.reset = function(){
      return obj.exec('revert');
    };

    /**
     * Convenience method to retrieve the latex representation of the formula in the active editor
     */
    obj.getLatex = function(){
      return obj.exec('latex');
    };

    /**
     * Convenience method to retrieve the HTML representation of the formula in the active editor
     */
    obj.getHTML = function(){
      return obj.exec('html');
    };

    /**
     * Saves the content.
     * Returns the final LaTeX after hooks have been run
     */
    obj.save = function(){
      var output = { latex: obj.getLatex() };
      // passing output as object so it will be passed to all hooks by reference and not by value
      _execAllHooks('onSave', [obj.activeEditor, output]);
      return output.latex;
    };

    var hook_namespaces = {};

    /**
     * Register a hook to the provided namespace and event queue.
     * May also provide an argument list as an array
     *
     * @param string namespace
     * @param string event
     * @param function fn
     */
    _addHook = function(namespace, event, fn){
      if(typeof hook_namespaces[namespace] == 'undefined'){
        hook_namespaces[namespace] = {};
      }
      if(typeof hook_namespaces[namespace][event] == 'undefined'){
        hook_namespaces[namespace][event] = [fn];
      }
      else{
        hook_namespaces[namespace][event].push(fn);
      }
    };

    /**
     * Execute the hooks associated with the event.
     * May also provide an argument list as an array
     *
     * @param string namespace
     * @param string event
     * @param array args
     */
    _execHooks = function(namespace, event, args){
      if(typeof hook_namespaces[namespace] == 'undefined'){
        return;
      }

      if(typeof hook_namespaces[namespace][event] == 'undefined'){
        return;
      }

      var hook_queue = hook_namespaces[namespace][event];

      if(typeof args == 'undefined'){
        var args = [];
      }

      $.each(hook_queue, function(k, fn){
        fn.apply(obj, args);
      });
    };

    /**
     * Execute the hooks associated with the event in the global namespace.
     * May also provide an argument list as an array
     *
     * @param string event
     * @param array args
     */
    _execGlobalHooks = function(event, args){
      _execHooks('global', event, args);
    };

    /**
     * Execute the hooks associated with the event for the current editor.
     * May also provide an argument list as an array
     *
     * @param string event
     * @param array args
     */
    _execEditorHooks = function(event, args){
      var ed = obj.activeEditor;

      if(ed){
        _execHooks('editor_' + ed.index, event, args);
      }
    };

    /**
     * Execute the hooks in all namespces for the given event
     * May also provide an argument list as an array
     *
     * @param string event
     * @param array args
     */
    _execAllHooks = function(event, args){
      $.each(hook_namespaces, function(namespace, queues){
        _execHooks(namespace, event, args);
      });
    };

    /**
     * Register a hook to be called in an event that's not associated with an editor
     *
     * @param string event
     * @param function fn
     */
    obj.addGlobalHook = function(event, fn){
      _addHook('global', event, fn);
    };

    /**
     * Register a hook to be called in an event on the current active editor
     *
     * @param string event
     * @param function fn
     */
    obj.addEditorHook = function(event, fn){
      var ed = obj.activeEditor;
      if(ed){
        _addHook('editor_' + ed.index, event, fn);
      }
    };

    return obj;
  })();

  /**
   * Mathquill editor configuration
   */
  sMathquill.config = {
    menu_bars: {}
  };

  /**
   * a list of menu item definitions
   *
   * string html - an html markup that can be inserted into a menu bar
   * string cmd - a Mathquill command that runs as a result of clicking on the button. creates a command button
   * string text - a Mathquill "write" that runs as a result of clicking on the button. creates a text button
   *
   * bool menu_toggle - the button is treated as a toggle, creates a menu toggle button
   * bool compile_label - defaults true. set to false to prevent the label from being compiled in Mathquill
   *
   * string label - the text that appears on the control
   * string tooltip - the text that appears on mouseover
   */
  sMathquill.menuItemList = {
    // markup
    _line_break:        { html: '<br/>' },
    _separator:         { html: '<span class="s-mq-separator"></span>' }
  };

  /**
   * Main menu buttons and cluetip roll-over on the buttons
   */
  (function(obj){
    var mainMenuConfig = {
      // main menus
      main: {
        menu_items: [
          // 'menu_greek,menu_operators,menu_relationships,menu_equations,menu_arrows,menu_misc'
          'menu_operators,menu_relationships,menu_equations,menu_arrows,menu_misc,menu_greek'
        ]
      },

      // sub menus
      greek: {
        submenu: true,
        multiline: true,
        menu_items: [
          'alpha,beta,gamma,delta,epsilon,zeta,eta,theta,iota,kappa,lambda,mu,nu,xi,omicron,pi,rho,sigma,tau,upsilon,phi,chi,psi,omega',
          'digamma,varepsilon,varkappa,varphi,varpi,varrho,varsigma,vartheta',
          'Gamma,Delta,Theta,Lambda,Xi,Pi,Sigma,Upsilon,Phi,Psi,Omega'
        ]
      },
      operators: {
        submenu: true,
        multiline: true,
        menu_items: [
          'equal,plus,minus,ast,cdot,times,div,pm,mp,therefore,because',
          'bigcirc,diamond,amalg,odot,ominus,oplus,otimes,wr',
          'union,intersect,uplus,sqcap,sqcup,wedge,vee,dagger,ddagger',
          'lhd,rhd,bigtriangledown,bigtriangleup'
        ]
      },
      relationships: {
        submenu: true,
        multiline: true,
        menu_items: [
          'equiv,cong,neq,sim,simeq,approx,napprox,doteq,models',
          'leq,prec,preceq,lt,ll,subset,subseteq,nsubset,nsubseteq,sqsubset,sqsubseteq,dashv,in,notin',
          'geq,succ,succeq,gt,gg,supset,supseteq,nsupset,nsupseteq,sqsupset,sqsupseteq,vdash,ni,notni',
          'mid,parallel,nparallel,perp,bowtie,smile,frown,propto,exists,nexists,varnothing'
        ]
      },
      equations: {
        submenu: true,
        multiline: true,
        menu_items: [
          'frac,fprime,sqrt,nthroot,supscript,subscript,curly_braces,angle_brackets,lfloor,rfloor,lceil,rceil,slash',
          'sum,prod,coprod,limit,int,oint,binomial,vector,prime'
        ]
      },
      arrows: {
        submenu: true,
        multiline: true,
        menu_items: [
          'leftarrow,Leftarrow,rightarrow,Rightarrow,leftrightarrow,Leftrightarrow',
          'longleftarrow,Longleftarrow,longrightarrow,Longrightarrow,longleftrightarrow,Longleftrightarrow',
          'rightleftarrows,uparrow,Uparrow,downarrow,Downarrow,updownarrow,Updownarrow',
          'mapsto,hookleftarrow,leftharpoonup,leftharpoondown,hookrightarrow,rightharpoonup,rightharpoondown',
          'nearrow,searrow,swarrow,nwarrow'
        ]
      },
      misc: {
        submenu: true,
        multiline: true,
        menu_items: [
          'infty,nabla,partial,clubsuit,diamondsuit,heartsuit,spadesuit,cdots,vdots,ldots,ddots,imaginary,real',
          'forall,reals,complex,naturals,rationals,integers,ell,sharp,flat,natural,hbar,surd,wp',
          'angle,measuredangle,overline,overrightarrow,overleftrightarrow,triangle,top,bot,caret,underscore,backslash,vert,AA',
          'circ,bullet,setminus,neg,dots,aleph,deg'
        ]
      }
    };
    var mainMenuButtons = {
      menu_greek:         { menu_toggle: true,
                            label: '\\alpha \\pi \\Delta',
                            tooltip: Drupal.t('Greek'),
                            extraClass: 's-mq-embed' },
      menu_operators:     { menu_toggle: true,
                            label: '\\pm\\times=',
                            tooltip: Drupal.t('Operators'),
                            extraClass: 's-mq-embed' },
      menu_relationships: { menu_toggle: true,
                            label: '\\leq\\ne\\in',
                            tooltip: Drupal.t('Relationships'),
                            extraClass: 's-mq-embed' },
      menu_equations:     { menu_toggle: true,
                            compile_label: false,
                            label: '<var class="florin">ƒ</var>'
                                 + '<span>\'</span>'
                                 + '<span class="non-leaf">{ }</span>'
                                 + '<span class="non-leaf">'
                                   + '<span class="scaled sqrt-prefix">√</span>'
                                   + '<span class="non-leaf sqrt-stem">'
                                     + '<var>x</var>'
                                   + '</span>'
                                 + '</span>',
                            tooltip: Drupal.t('Equations'),
                            extraClass: 'mathquill-rendered-math' },
      menu_arrows:        { menu_toggle: true,
                            label: '\\Leftarrow\\updownarrow\\Rightarrow',
                            tooltip: Drupal.t('Arrows'),
                            extraClass: 's-mq-embed' },
      menu_misc:          { menu_toggle: true,
                            label: '\\infty\\angle\\partial',
                            tooltip: Drupal.t('Miscellaneous'),
                            extraClass: 's-mq-embed' },

      // common mathematical syntax
      limit:              { cmd: ['\\lim', '_'] },
      abs:                { cmd: '|' },

      // arithmetic
      plus:               { cmd: '+' },
      minus:              { cmd: '-' },
      equal:              { cmd: '=' },

      //greek letters
      omicron:            { text: 'o', compile_label: false },

      frac:               { cmd: '\\frac', label: '\\frac{x}{y}' },
      limit:              { cmd: ['\\lim', '_'], label: '\\lim', tooltip: Drupal.t('lim') },
      fprime:             { cmd: ['f', '\''] },
      sqrt:               { cmd: '\\sqrt',
                            compile_label: false,
                            label: '<span class="non-leaf">'
                                   + '<span class="scaled sqrt-prefix">√</span>'
                                   + '<span class="non-leaf sqrt-stem">'
                                     + '<var>x</var>'
                                   + '</span>'
                                 + '</span>',
                            extraClass: 'mathquill-rendered-math' },
      nthroot:            { cmd: '\\nthroot',
                            compile_label: false,
                            label: '<sup class="nthroot non-leaf">'
                                   + '<var>x</var>'
                                 + '</sup>'
                                 + '<span class="scaled">'
                                   + '<span class="sqrt-prefix scaled">√</span>'
                                   + '<span class="sqrt-stem non-leaf">'
                                     + '<var>y</var>'
                                   + '</span>'
                                 + '</span>',
                            extraClass: 'mathquill-rendered-math' },
      subscript:          { cmd: '_', label: 'x_y', tooltip: Drupal.t('subscript') },
      supscript:          { cmd: '^', label: 'x^y', tooltip: Drupal.t('superscript') },
      curly_braces:       { cmd: '{', label: '{ }', tooltip: '{ }', compile_label: false, extraClass: 'mathquill-rendered-math' },
      angle_brackets:     { cmd: '\\langle', label: '⟨ ⟩', compile_label: false, extraClass: 'mathquill-rendered-math' },
      binomial:           { cmd: '\\binomial',
                            compile_label: false,
                            label: '(<span class="non-leaf">'
                                   + '<span class="array non-leaf">'
                                     + '<span class="s-mq-var">x</span>'
                                     + '<span class="s-mq-var">y</span>'
                                   + '</span>'
                                 + '</span>)',
                            extraClass: 'mathquill-rendered-math' },
      vector:             { cmd: '\\vector', label: '\\vector{a} \\vector{b}{c}' },

      // geometric lines, rays, and line segments
      overline:           { cmd: '\\overline', label: '\\overline{AB}' },
      overrightarrow:     { cmd: '\\overrightarrow', label: '\\overrightarrow{AB}' },
      overleftrightarrow: { cmd: '\\overleftrightarrow', label: '\\overleftrightarrow{AB}' }
    };

    obj.config.menu_bars = $.extend(obj.config.menu_bars, mainMenuConfig);
    obj.menuItemList = $.extend(obj.menuItemList, mainMenuButtons);

    /**
     * Apply the cluetip effect on the menu items when the editor gets created
     */
    obj.addGlobalHook('onEditorCreate', function(ed){
      var mainMenu = ed.siblings('.s-mq-menu-main');
      mainMenu.children('.s-mq-menu-toggle').each(function(){
        var toggleBtn = $(this);
        toggleBtn.tipsy({
          gravity: 's',
          title: function(){
            return toggleBtn.attr('original-title');
          }
        });
      });
    });
  }(sMathquill));

  /**
   * Add a font re-sizing plugin
   *
   * LaTeX supports 10 different font sizes using certain commands listed in fontSizeMapping.
   * The font size index will be stored as an index to that mapping and is saved per editor.
   */
  (function(obj){
    var DEFAULT_SIZE = 5;
    var fontSizeMapping = [
      { cmd: '\\tiny', font_size: '10px' },
      { cmd: '\\scriptsize', font_size: '11px' },
      { cmd: '\\footnotesize', font_size: '12px' },
      { cmd: '\\small', font_size: '14px' },
      { font_size: '16px' },
      { cmd: '\\large', font_size: '18px' },
      { cmd: '\\Large', font_size: '24px' },
      { cmd: '\\LARGE', font_size: '28px' },
      { cmd: '\\huge', font_size: '34px' },
      { cmd: '\\Huge', font_size: '40px' }
    ];
    var mappingByCommand = {};
    $.each(fontSizeMapping, function(idx, size){
      if(typeof size.cmd != 'undefined'){
        mappingByCommand[size.cmd.substr(1)] = idx;
      }
    });

    // editor font sizes by editor index
    var editorSizes = [];

    _getEditorFontSize = function(ed){
      var ret = null;
      if(ed && typeof ed.index != 'undefined'){
        ret = editorSizes[ed.index];
      }
      return ret;
    };

    _setEditorFontSize = function(ed, size){
      if(ed && typeof ed.index != 'undefined' && typeof fontSizeMapping[size] != 'undefined'){
        editorSizes[ed.index] = size;
      }
    };

    /**
     * Given a LaTeX input, parse out a potential size command.
     *
     * @param string latex
     * @return string
     */
    _getSizeString = function(latex){
      var matches = latex.match(/\\(tiny|scriptsize|small|normalsize|large|Large|LARGE|huge|Huge)/);
      if(matches && typeof mappingByCommand[matches[1]] != 'undefined'){
        return matches[1];
      }
      return null;
    };

    /**
     * Attempt to update the font size to the provided size for the current editor
     *
     * @param int newSize
     * @return object
     */
    obj.updateFontSize = function(newSize){
      var ed = obj.activeEditor;

      if(!ed){
        return null;
      }

      // check to prevent out of bound sizes
      if(typeof fontSizeMapping[newSize] != 'undefined'){
        _setEditorFontSize(ed, newSize);
        ed.css('font-size', fontSizeMapping[_getEditorFontSize(ed)].font_size);
      }

      return fontSizeMapping[_getEditorFontSize(ed)];
    };

    /**
     * Increase the font size of the current editor by diff
     *
     * @param int diff
     * @return object
     */
    obj.increaseFontSize = function(diff){
      var ed = obj.activeEditor;

      if(!ed){
        return null;
      }

      return obj.updateFontSize(_getEditorFontSize(ed) + diff);
    };

    // Add a hook to extract any size string that is in the markup and set the default font size
    obj.addGlobalHook('onBeforeEditorCreate', function(element){
      var latex = element.text();
      if(latex.length){
        var sizeString = _getSizeString(latex);
        if(sizeString){
          element.text(latex.replace('\\' + sizeString + ' ', ''));
          _setEditorFontSize(element, mappingByCommand[sizeString]);
        }
      }
    });

    // Add a hook to set the default font size of the new editor
    obj.addGlobalHook('onEditorCreate', function(newEditor){
      if(!_getEditorFontSize(newEditor)){
        _setEditorFontSize(newEditor, DEFAULT_SIZE);
      }
      newEditor.css('font-size', fontSizeMapping[_getEditorFontSize(newEditor)].font_size);

      // tipsy for the font buttons
      var fontBtns = newEditor.siblings('.s-mq-menu-main').children('.s-mq-font-size-down, .s-mq-font-size-up');
      fontBtns.tipsy({
        gravity: 's',
        title: function(){
          return $(this).attr('original-title');
        }
      });
    });

    // Add a hook to prepend the latex output with the corresponding size command
    obj.addGlobalHook('onSave', function(ed, output){
      var editorFontSize = _getEditorFontSize(ed);
      if(typeof editorFontSize != 'undefined' && typeof fontSizeMapping[editorFontSize] != 'undefined'){
        var font = fontSizeMapping[editorFontSize];
        // if there's a command associated with this font size, prepend it to the latex output
        if(typeof font.cmd != 'undefined'){
          output.latex = font.cmd + ' ' + output.latex;
        }
      }
    });

    // Declare and input menu items
    obj.config.menu_bars.main.menu_items.push('font_size_down,font_size_up');
    obj.menuItemList.font_size_down = {
      label: 'A-',
      tooltip: Drupal.t('Decrease Font Size'),
      compile_label: false,
      fn: function(){
        obj.increaseFontSize(-1);
      }
    };
    obj.menuItemList.font_size_up = {
      label: 'A+',
      tooltip: Drupal.t('Increase Font Size'),
      compile_label: false,
      fn: function(){
        obj.increaseFontSize(1);
      }
    };
  }(sMathquill));

  /**
   * Custom help cluetip
   */
  (function(obj){
    var helpMessage = Drupal.t('Select symbols or type in LaTeX code');

    // bind the help cluetip
    obj.addGlobalHook('onEditorCreate', function(newEditor){
      var helpTipObj = newEditor.siblings('.s-mq-menu-main').children('.s-mq-help-tip');
      if(helpTipObj.length){
        helpTipObj.tipsy({
          gravity: 's',
          title: function(){
            return helpMessage;
          }
        });
      }
    });

    obj.config.menu_bars.main.menu_items.push('_help_cluetip');
    obj.menuItemList._help_cluetip = {
      html: '<span class="s-mq-help-tip"><span>?</span></span>'
    };
  }(sMathquill));
}
