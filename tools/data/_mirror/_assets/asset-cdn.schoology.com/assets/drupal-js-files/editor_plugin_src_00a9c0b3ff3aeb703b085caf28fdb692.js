/**
 * Create a way of creating buttons that show/hide DropMenus
 */
(function() {
  var menuConfig = {};

  tinymce.create('tinymce.plugins.SDropMenu', {
    init : function(ed, url) {
      var t = this;
      menuConfig = typeof ed.settings.s_dropmenu_menus == 'object' ? ed.settings.s_dropmenu_menus : {};
    },

    /**
     * Create Control hook for when TinyMCE need to determine what to create
     *
     * @param string n
     * @param object cm
     */
    createControl: function(n, cm){
      var t = this;
      if(typeof menuConfig[n] != 'undefined'){
        var config = menuConfig[n], button = null, ccMenuButton = null, ccDropMenu = null;

        // use optional control class to modify default menu ui
        if(config.isMegaDropdown === true) {
          ccMenuButton = tinymce.ui.SMenuButton;
          ccDropMenu = tinymce.ui.SMegaDropMenu;
        }

        button = cm.createMenuButton(n, {
          title : config.title,
          label: config.label,
          icons : false,
          ccDropMenu : ccDropMenu
        }, ccMenuButton);

        button.onRenderMenu.add(function(c, m){
          t._createSubMenu(c.editor, m, config.items);
        });

        button.renderMenu();

        return button;
      }
    },

    /**
     * Helper method in recursively populating a menu list.
     *
     * @param object ed
     * @param object menu
     * @param object items
     */
    _createSubMenu: function(ed, menu, items){
      var t = this;
      $.each(items, function(k, item){
        if(typeof item.items != 'undefined'){
          var submenu = menu.addMenu({
            title: item.title
          });
          t._createSubMenu(ed, submenu, item.items);
        }
        else if(typeof item.type != 'undefined'){
          if(item.type == 'separator'){
            menu.addSeparator();
          }
        }
        else{
          var newItem = {title: item.title},
              menuItem = null;
          if(typeof item.onclick == 'function'){
            // execute a custom onclick handler
            newItem.onclick = function(e){
              item.onclick(e, ed);
            };
          }
          else if(typeof item.cmd == 'string'){
            // execute a tinymce command
            newItem.cmd = item.cmd;
          }

          if(typeof item.id != 'undefined'){
            newItem.id = item.id;
          }

          if(typeof item.value != 'undefined'){
            newItem.value = item.value;
          }

          if(typeof item.icon_src != 'undefined'){
            newItem.icon_src = item.icon_src;
          }

          if(typeof item['class'] != 'undefined'){
            newItem['class'] = item['class'];
          }

          menuItem = menu.add(newItem);

          if(typeof item.disabled != 'undefined' && item.disabled){
            menuItem.setDisabled(true);
          }

          // by registering with the control mananger, the item will be like a button that's accessible without digging into the menu buttons
          ed.controlManager.add(menuItem);
        }
      });
    },

    getInfo : function() {
      return {
        longname : 'S_DropMenu',
        author : 'Schoology, Inc.',
        authorurl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        infourl : 'http://' + sCommonGetDefaultDomain() + '.schoology.com',
        version : tinymce.majorVersion + "." + tinymce.minorVersion
      };
    }
  });

  // Register plugin
  tinymce.PluginManager.add('s_dropmenu', tinymce.plugins.SDropMenu);
})();



/**
 * Optional control class for tinymce.ui.MenuButton
 */
(function() {
  var DOM = tinymce.DOM, Event = tinymce.dom.Event, each = tinymce.each;

  tinymce.create('tinymce.ui.SMenuButton:tinymce.ui.MenuButton', {
    SMenuButton : function(id, s, ed) {
      this.parent(id, s, ed);

      this.onRenderMenu = new tinymce.util.Dispatcher(this);

      s.menu_container = s.menu_container || DOM.doc.body;
    },

    /**
     * Use settings object to pass in option control class for DropMenu ui
     */
    renderMenu : function() {
      var t = this, m;

      m = t.settings.control_manager.createDropMenu(t.id + '_menu', {
        menu_line : 1,
        'class' : this.classPrefix + 'Menu',
        icons : t.settings.icons
      }, t.settings.ccDropMenu);

      m.onHideMenu.add(function() {
        t.hideMenu();
        t.focus();
      });

      t.onRenderMenu.dispatch(t, m);
      t.menu = m;
    }
  });
})();



/**
 * Optional control class for tinymce.ui.DropMenu
 */
(function() {
  var is = tinymce.is, DOM = tinymce.DOM, each = tinymce.each, Event = tinymce.dom.Event, Element = tinymce.dom.Element;
  const isRtl = $(document).attr('dir') === 'rtl';

  tinymce.create('tinymce.ui.SMegaDropMenu:tinymce.ui.DropMenu', {
    SMegaDropMenu : function(id, s) {
      s = s || {};
      s.container = s.container || DOM.doc.body;
      s.offset_x = s.offset_x || 0;
      s.offset_y = s.offset_y || 0;
      s.vp_offset_x = s.vp_offset_x || 0;
      s.vp_offset_y = s.vp_offset_y || 0;

      if (is(s.icons) && !s.icons)
        s['class'] += ' mceNoIcons';

      this.parent(id, s);
      this.onShowMenu = new tinymce.util.Dispatcher(this);
      this.onHideMenu = new tinymce.util.Dispatcher(this);
      this.classPrefix = 'mceMenu';
    },

    createMenu : function(s) {
      var t = this, cs = t.settings, m;

      s.container = s.container || cs.container;
      s.parent = t;
      s.constrain = s.constrain || cs.constrain;
      s['class'] = s['class'] || cs['class'];
      s.vp_offset_x = s.vp_offset_x || cs.vp_offset_x;
      s.vp_offset_y = s.vp_offset_y || cs.vp_offset_y;
      s.keyboard_focus = cs.keyboard_focus;
      m = new tinymce.ui.SMegaDropMenu(s.id || DOM.uniqueId(), s);

      m.onAddItem.add(t.onAddItem.dispatch, t.onAddItem);

      return m;
    },

    /**
     * Dropmen showmenu callback
     */
    showMenu : function(x, y, px) {
      var t = this, s = t.settings, co, vp = DOM.getViewPort(), w, h, mx, my, ot = 2, dm, tb, cp = t.classPrefix;

      t.collapse(1);

      if (t.isMenuVisible)
        return;

      if (!t.rendered) {
        co = DOM.add(t.settings.container, t.renderNode());

        each(t.items, function(o) {
          o.postRender();
        });

        t.element = new Element('menu_' + t.id, {blocker : 1, container : s.container});
      } else
        co = DOM.get('menu_' + t.id);

      // Move layer out of sight unless it's Opera since it scrolls to top of page due to an bug
      if (!tinymce.isOpera)
        DOM.setStyles(co, {left : -0xFFFF , top : -0xFFFF});

      DOM.show(co);
      t.update();

      x += s.offset_x || 0;
      y += s.offset_y || 0;
      vp.w -= 4;
      vp.h -= 4;

      // Move inside viewport if not submenu
      if (s.constrain) {
        w = co.clientWidth - ot;
        h = co.clientHeight - ot;
        mx = vp.x + vp.w;
        my = vp.y + vp.h;

        if ((x + s.vp_offset_x + w) > mx)
          x = px ? px - w : Math.max(0, (mx - s.vp_offset_x) - w);

        if ((y + s.vp_offset_y + h) > my)
          y = Math.max(0, (my - s.vp_offset_y) - h);
      }

      if (isRtl) {
        const idStrings = t.id.split("_");
        // we get 4 elements majorly as per it's format and we need second and third for parent id
        // default width = 45
        const dropDownElemWidth = (idStrings.length == 4 && DOM.get(idStrings[1] + '_' + idStrings[2]).clientWidth) ? DOM.get(idStrings[1] + '_' + idStrings[2]).clientWidth : 45;
        // incase of table dropdown, since the element is expandable due to number of cells selected, adding the initial size of dropdown
        var leftOffest = co.clientWidth == 0 ? 120 : co.clientWidth;
        DOM.setStyles(co, {left : x-leftOffest+dropDownElemWidth , top : y});
      }
      else {
        DOM.setStyles(co, {left : x , top : y});
      }
      t.element.update();

      t.isMenuVisible = 1;
      t.mouseClickFunc = Event.add(co, 'click', function(e) {
        var m;

        e = e.target;

        if (e && (e = DOM.getParent(e, 'td')) && !DOM.hasClass(e, cp + 'ItemSub') && !DOM.hasClass(e, 's-js-resource-items-empty')) {
          m = t.items[e.id];

          if (m.isDisabled())
            return;

          dm = t;

          while (dm) {
            if (dm.hideMenu)
              dm.hideMenu();

            dm = dm.settings.parent;
          }

          if (m.settings.onclick)
            m.settings.onclick(e);

          return false; // Cancel to fix onbeforeunload problem
        }
      });

      if (t.hasMenus()) {
        t.mouseOverFunc = Event.add(co, 'mouseover', function(e) {
          var m, r, mi;

          e = e.target;
          if (e && (e = DOM.getParent(e, 'td'))) {
            m = t.items[e.id];

            if (t.lastMenu)
              t.lastMenu.collapse(1);

            if (m.isDisabled())
              return;

            if (e && DOM.hasClass(e, cp + 'ItemSub')) {
              //p = DOM.getPos(s.container);
              r = DOM.getRect(e);
              m.showMenu((r.x + r.w - ot), r.y - ot, r.x);
              t.lastMenu = m;
              DOM.addClass(DOM.get(m.id).firstChild, cp + 'ItemActive');
            }
          }
        });
      }

      Event.add(co, 'keydown', t._keyHandler, t);

      t.onShowMenu.dispatch(t);

      if (s.keyboard_focus) {
        t._setupKeyboardNav();
      }
    },

    /**
     * Render dropmenu
     *
     * @returns {div}
     */
    renderNode : function() {
      var t = this, s = t.settings, n, tb, co, w;

      w = DOM.create('div', {role: 'listbox', id : 'menu_' + t.id, 'class' : s['class'], 'style' : 'position:absolute;left:0;top:0;z-index:200000;outline:0'});
      if (t.settings.parent) {
        DOM.setAttrib(w, 'aria-parent', 'menu_' + t.settings.parent.id);
      }
      co = DOM.add(w, 'div', {role: 'presentation', id : 'menu_' + t.id + '_co', 'class' : t.classPrefix + (s['class'] ? ' ' + s['class'] : '')});
      t.element = new Element('menu_' + t.id, {blocker : 1, container : s.container});

      var mWrapper = DOM.add(co, 'div', {'class' : 's-content-resources-menu'});

      n = DOM.add(mWrapper, 'table', {role: 'presentation', id : 'menu_' + t.id + '_tbl', border : 0, cellPadding : 0, cellSpacing : 0});
      tb = DOM.add(n, 'tbody');

      // we need a 2-column layout for dropmenu
      var mChunked = [[], []], i;
      each(t.items, function(o) {
        i = o.settings['class'] &&
            o.settings['class'].search(/s\-js\-resources\-insert\-item/) != -1
        ? 1 : 0;
        mChunked[i].push(o);
      });

      // use extra class to toggle 2-col styles
      DOM.addClass(mWrapper, 's-content-resources-menu-col-' + (mChunked[1].length ? 2 : 1));

      // render our 2-column drop menu
      var rItems, mRowLen = mChunked[0].length, mColLen = mChunked.length, r, j;

      if(mChunked[1].length > mRowLen) {
        mRowLen = mChunked[1].length;
      }

      for(r = 0; r < mRowLen; r++) {
        rItems = [];
        for(j = 0; j < mColLen; j++) {
          rItems.push( (mChunked[j][r] != undefined ? mChunked[j][r] : null) );
        }
        t._add(tb, rItems);
      }

      t.rendered = true;

      return w;
    },

    /**
     * Render menu rows
     *
     * @param tb    table body node
     * @param ri    an array of menu items
     */
    _add : function(tb, ri) {
      var n, s, a, ro, it, cp = this.classPrefix, ic, is;

      ro = DOM.add(tb, 'tr');

      each(ri, function(o){
        if(o != null) {
          s = o.settings;
          it = DOM.add(ro, 'td', {id: o.id, 'class': s['class'] + ' ' + cp + 'Item ' + cp + 'ItemEnabled'});
          a = DOM.add(it, 'a', {id: o.id + '_aria',  role: s.titleItem ? 'presentation' : 'option', href : 'javascript:;', onclick : "return false;", onmousedown : 'return false;'});
          if(s.icon_src) {
            is = DOM.add(a, 'span', {'class' : 'mceIcon'});
            DOM.add(is, 'img', {'src' : s.icon_src});
          }
          DOM.add(a, 'span', {'class' : 'mceText', title : o.settings.title}, o.settings.title);
        }
        else {
          it = DOM.add(ro, 'td', {'class' : 's-js-resource-items-empty'});
        }
      });

      if (tb.childNodes.length == 1) {
        DOM.addClass(ro, 'mceFirst');
      }

      if (n = ro.previousSibling) {
        DOM.removeClass(n, 'mceLast');
      }

      DOM.addClass(ro, 'mceLast');
    }

  });
})();
