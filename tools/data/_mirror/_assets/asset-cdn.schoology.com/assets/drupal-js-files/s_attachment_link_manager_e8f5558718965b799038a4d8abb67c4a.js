function sLinkManager(){
  this.full = {};
  this.empty = [];
  for(var i = 0; $('#edit-link-' + i).length > 0; i++){
    var linkElement = $('#edit-link-' + i);
    this.empty[i]={'index' : i, 'hiddenEl' : linkElement, 'displayEl' : ''};
  }
  this.addLink = function(linkInfo){
    var data = $.toJSON(linkInfo);
    var obj = this.empty.shift();
    if(obj){
      obj['hiddenEl'].val(data);
      var index = obj['index'];
      full[index] = obj;
      return index;
    }
    else{
      return 'full';
    }
  };
  this.removeLink = function(index){
    var obj = full[index];
    delete full[index];
    obj['hiddenEl'].val('');
    obj['displayEl'].remove();
    obj['displayEl'] = '';
    this.empty.push(obj);
    sPopupsResizeCenter();
  };
  this.getDisplay = function(index, favUrl){
    var obj = full[index];
    var curr = $.parseJSON(obj['hiddenEl'].val());
    var link = curr.link;
    var linkTitle = curr.title;
    var id = "link-display-" + index;
    var isEmbed = false;
    var prevButton = "";
    if(sCommonIsEmbed(link)){
      isEmbed = true;
      link = "Embedded Media";
      if(linkTitle != ''){
        link = linkTitle + ': ' + link;
      }
      prevButton = '<span class="embed-preview-button" id="preview-button-'+index+'">Preview</span>';
      var favImg = '<span class="embed-icon inline-icon"></span>';
      var prevArea = '';

    }
    else{
      if(linkTitle != ''){
        linkTitle = linkTitle + ': ';
      }
      var favImg = '<span class="inline-icon link-icon"><span class="icon-placeholder"></span></span>';
      link = '<span class="link-title">' + linkTitle + '</span><span>' + link + '</span>';
      prevButton = '<span class="link-add-details-button" id="preview-button-'+index+'">' + Drupal.t("Get Preview") + '</span>';
      var prevArea = '<div class="link-preview-area" id="preview-area-'+index+'"></div>';
    }
    var insertElement = $('<div class="link-attachment" id="' + id + '"><span class="delete-link"></span>' + prevButton + '<span class="link-value">' + favImg + link + '</span>' + prevArea + '</div>');
    $('.delete-link',insertElement).data('linkManagerIndex', index);
    if(favUrl != null){
      var icon = $('.icon-placeholder', insertElement);
      icon.css('background', 'url("'+favUrl+'") no-repeat');
      icon.removeClass('icon-placeholder');
      icon.addClass('with-fav');
    }

    if(isEmbed){
      sAttachEmbedPreview(insertElement);
    }
    else{
      sAttachAddDetailsBehavior(insertElement);
    }

    obj['displayEl'] = insertElement;
    return insertElement;
  }
  this.updateDisplay = function(index, favUrl){
    var obj = full[index];
    var curr = $.parseJSON(obj['hiddenEl'].val());
    var link = curr.link;
    var linkTitle = curr.title;
    if(linkTitle != ''){
      linkTitle = linkTitle + ': ';
    }
    var display = obj['displayEl'];
    if(obj['displayEl']){
      if(favUrl != null){
        if($('.icon-placeholder', display).length > 0){
          var icon =$('.icon-placeholder', display);
          icon.css('background', 'url("'+favUrl+'") no-repeat');
          icon.removeClass('icon-placeholder');
          icon.addClass('with-fav');
        }
      }
      if($('.link-title', display).html() == ''){
        $('.link-title', display).html(linkTitle);
      }
    }

  }
  this.updateLink = function(linkInfo, index){
    var link = linkInfo.link;
    var favFilePath = linkInfo.sFavPath;
    var linkTitle = linkInfo.title;
    var favUrl = linkInfo.favUrl
    var faviconId = linkInfo.faviconId;
    var obj = full[index];
    if(obj){
      var curr = $.parseJSON(obj['hiddenEl'].val());
      curr.link = link;
      curr.sFavPath = favFilePath;
      curr.favUrl = favUrl;
      curr.faviconId = faviconId;
      //only update if it is empty
      if(curr.title == ''){
        curr.title = linkTitle;
      }
      obj['hiddenEl'].val($.toJSON(curr));
      var index = obj['index'];
      full[index] = obj;
      return index;
    }
    else{
      return false;
    }
  }
  this.reset = function(){
    full = {};
    this.empty = [];
    for(var i = 0; $('#edit-link-' + i).length > 0; i++){
      //empty out the fields
      $('#edit-link-' + i).val('');
      //rebuild linkManager
      var linkElement = $('#edit-link-' + i);
      this.empty[i]={'index' : i, 'hiddenEl' : linkElement, 'displayEl' : ''};
    }
  }
  this.getCurrentInfo = function(index){
    var obj = full[index];
    if(obj){
      var curr = $.parseJSON(obj['hiddenEl'].val());
      return curr;
    }
    else{
      return false;
    }
  }
  this.updateThumbnail = function(index, newThumb){
    var obj = full[index];
    if(obj){
      var curr = $.parseJSON(obj['hiddenEl'].val());
      curr.thumb = newThumb;
      obj['hiddenEl'].val($.toJSON(curr));
    }
    else{
      return false;
    }
  }
  this.updateDescription = function(index, newDesc){
    var obj = full[index];
    if(obj){
      var curr = $.parseJSON(obj['hiddenEl'].val());
      curr.description = newDesc;
      obj['hiddenEl'].val($.toJSON(curr));
    }
    else{
      return false;
    }
  }
  this.updateTitle = function(index, newTitle){
    var obj = full[index];
    if(obj){
      var curr = $.parseJSON(obj['hiddenEl'].val());
      curr.title = newTitle;
      obj['hiddenEl'].val($.toJSON(curr));
    }
    else{
      return false;
    }
  }
  this.setPostprocessAndType = function(index, postprocess, type){
    var obj = full[index];
    if(obj){
      var curr = $.parseJSON(obj['hiddenEl'].val());
      curr.postprocess = postprocess;
      curr.type = type;
      obj['hiddenEl'].val($.toJSON(curr));
    }
    else{
      return false;
    }
  }
}

function sAttachAddDetailsBehavior(insertElement, sendDataOverride){
  var prevButton = $('.link-add-details-button:not(.sDetailsButton-processed)', insertElement);
  prevButton.addClass('.sDetailsButton-processed');
  prevButton.click(function(){
    var index = $(this).attr('id').split('-');
    index = index[2];
    var prevArea = $('#preview-area-' + index);
    if($(this).hasClass('link-fetched')){
      if($(this).hasClass('active')){
        prevArea.hide();
        $(this).removeClass('active');
        sPopupsResizeCenter()
      }
      else{
        $(this).addClass('active');
        prevArea.show();
        sPopupsResizeCenter()
      }
    }
    else{
      $(this).addClass('link-fetched');
      $(this).addClass('active');
      prevArea.addClass('fetching-data');
      prevArea.append('<img src="/sites/all/themes/schoology_theme/images/ajax-loader.gif" alt="' + Drupal.t('Loading') + '" />');
      sPopupsResizeCenter();
      var curr = lm.getCurrentInfo(index);
      if(typeof sendDataOverride == 'undefined'){
      	var sendData = {'link' : escape(curr.link), 'index' : index};
      }
      else{
    	  var sendData = sendDataOverride;
      }

      var sendData = $.toJSON(sendData);

      $.ajax({
        type: 'POST',
        url: '/link_get_details',
        dataType: 'json',
        data: "data=" + sendData,
        success: function( result ){
          prevArea.empty();
          prevArea.removeClass('fetching-data');
          if(result.status){
            prevArea.append(result.data);
            sAttachPreviewAreaBehavior(prevArea);
          }
          else{
            prevArea.append('<div class="link-preview-error">' + Drupal.t('No preview found') + '</div>');
          }
          sPopupsResizeCenter();
        },
        error: function(){
          prevArea.empty();
          prevArea.removeClass('fetching-data');
          prevArea.append('<div class="link-preview-error">' + Drupal.t('No preview found') + '</div>');
          sPopupsResizeCenter();
        }
      });
    }
  });
}

function sAttachPreviewAreaBehavior(context){
  //get postprocess and type
  var id = context.attr('id').split('-');
  id = id[2];
  var postprocess = $('input.postprocess', context).val();
  var type = $('input.type',context).val();
  lm.setPostprocessAndType(id, postprocess, type);
  $(".prev-link-title:not(.sAttachmentForm-processed)", context).each(function(){
    var index = $(this).attr('id').split('-');
    index = index[2];
    var dispTitle = $('.link-title', '#link-display-'+index);
    $(this).addClass('sAttachmentForm-processed');
    var span = $('span', $(this));
    var input = $('input', $(this));
    var curr = lm.getCurrentInfo(index);
    span.html(curr.title);
    input.val(curr.title);
    span.click(function(){
      $(this).hide();
      $(this).siblings().show();
      dispTitle.addClass('active');
      $(this).siblings().focus();
      sPopupsResizeCenter();
      return false;
    });

    span.siblings().blur(function(){
      $(this).hide();
      $(this).siblings().text($(this).val());
      $(this).siblings().show();
      lm.updateTitle(index, $(this).val())
      dispTitle.removeClass('active');
      sPopupsResizeCenter();
    });
    input.keyup(function(){
      dispTitle.text($(this).val());
    })
  });

  $(".link-summary:not(.sAttachmentForm-processed)", context).each(function(){
    $(this).addClass('sAttachmentForm-processed');
    var para = $('p', $(this));
    var summaryEdit = $('textarea', para.parent());
    var index = summaryEdit.attr('id').split('-');
    index = index[3];
    lm.updateDescription(index, summaryEdit.val());
    para.click(function(){
      para.hide();
      summaryEdit.show();
      summaryEdit.focus();
      sPopupsResizeCenter();
      return false;
    });

    summaryEdit.blur(function(){
      var index = summaryEdit.attr('id').split('-');
      index = index[3];
      summaryEdit.hide();
      para.text(summaryEdit.val());
      para.show();
      lm.updateDescription(index, summaryEdit.val());
      sPopupsResizeCenter();
    });
  });

  $(".link-thumbnail-selector:not(.sAttachmentForm-processed)", context).each(function(){
    $(this).addClass('sAttachmentForm-processed');
    var index = $(this).attr('id').split('-');
    index = index[3];
    var thumbnails = $(this).siblings('.link-thumbnails').children();
    var currThumb = $(thumbnails[0]);
    lm.updateThumbnail(index, currThumb.attr('src'));
    $("a.next").click(function(){
      var thumbnailsWrapper = $(this).parent().siblings('.link-thumbnails');
      var index = thumbnailsWrapper.attr('id').split('-');
      index = index[2];
      var thumbnails = thumbnailsWrapper.children();
      var currThumb = thumbnails.filter(':visible');
      currThumb.hide();
      var next = currThumb.next();
      if(next.length == 0)
        next = thumbnails.eq(0);
      lm.updateThumbnail(index, next.attr('src'));
      next.show();
      $(this).siblings('.edit-link-thumbnail').val(next.attr('src'));
      var counter = $(this).siblings('.curr-thumbnail');
      var currIndex = parseInt(counter.text());
      counter.text(currIndex%(thumbnails.length) + 1);
      sPopupsResizeCenter();
      return false;
    });

    $("a.prev").click(function(){
      var thumbnailsWrapper = $(this).parent().siblings('.link-thumbnails');
      var index = thumbnailsWrapper.attr('id').split('-');
      index = index[2];
      var thumbnails = thumbnailsWrapper.children();
      var currThumb = thumbnails.filter(':visible');
      currThumb.hide();
      var prev = currThumb.prev();
      if(prev.length == 0)
        prev = thumbnails.eq(thumbnails.length - 1);
      lm.updateThumbnail(index, prev.attr('src'));
      prev.show();
      $(this).siblings('.edit-link-thumbnail').val(prev.attr('src'));
      var counter = $(this).siblings('.curr-thumbnail');
      var currIndex = parseInt(counter.text());
      currIndex = (currIndex-1)%(thumbnails.length);
      if(currIndex == 0)
        currIndex = thumbnails.length;
      counter.text(currIndex);
      sPopupsResizeCenter();
      return false;
    });

    $(".edit-link-no-thumbnail").click(function(){
      if($(this).is(':checked')){
        $(".link-thumbnails").hide();
        $(".link-thumbnail-selector").hide();
        lm.updateThumbnail(index, '');
        sPopupsResizeCenter();
      } else {
        $(".link-thumbnails").show();
        $("link-thumbnail-selector").show();
        sPopupsResizeCenter();
      }
    });
  });
}

function sAttachEmbedPreview(insertElement){
  var prevButton = $('.embed-preview-button:not(.sPreviewButton-processed)', insertElement);
  prevButton.addClass('.sPreviewButton-processed');
  prevButton.click(function(){
    var index = $(this).attr('id').split('-');
    index = index[2];
    var curr = lm.getCurrentInfo(index);
    var popup = new Popups.Popup();
    var body = curr.link;
    var options = {'hideActive':false};
    popup.extraClass = 'embed-preview-popup';
    Popups.open(popup, Drupal.t('Embed Preview'), body, '', '500', options);
  });
}

