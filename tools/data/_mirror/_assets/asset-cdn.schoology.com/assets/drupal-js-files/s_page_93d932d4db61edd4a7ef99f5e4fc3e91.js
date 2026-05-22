Drupal.behaviors.sPage = function(context){
    var document = $(document);
    $('.s-page-container:not(.sPage-processed)', context).addClass('sPage-processed').each(function(){
      var container = $(this);
      //fix the actual view of a page to keep cell padding and spacing
      $('table', container).each(function(){
        var thisTable = $(this);
        var cellpadding = thisTable.attr('cellpading');
        var cellspacing = thisTable.attr('cellspacing');
        $('td', thisTable).each(function(){
          var cell = $(this);
          if(cellpadding > 0){
            cell.css({'padding' : cellpadding+'px'});
          }
          if(cellspacing > 0){
            cell.css("padding", cellspacing+'px');
          }
        });
      });

      $('.s-page-mini-toc-select', container).bind('click', function(){
        var wrapper = $(this).parent();
        var linkbtn = $(this);
        var toc = $('.s-page-mini-toc', wrapper);
        if(toc.length){
          toc.toggle();
          linkbtn.toggleClass('active');
        }
        else{
          var id = $(this).attr('id');
          var spliced = id.split('-');
          var pageid = spliced[1];
          $.ajax({
             type: 'GET',
             url: '/page/'+pageid+'/toc',
             dataType: 'json',
             success: function(json){
            wrapper.append(json.html);
            linkbtn.addClass('active');
             }
          });
        }
      });

      $('.table-of-contents .reorder-btn', container).bind('click', function(){
        var wrapper = $(this).parent();
        var tabledrags = $('#s-page-subpage-list .tabledrag-handle', wrapper);
        var saveBtn = $('#s-page-subpages-form .submit-span-wrapper', wrapper);
        if(tabledrags.is(":visible")){
          tabledrags.hide();
          saveBtn.hide();
        }
        else{
          tabledrags.show();
          saveBtn.css('display', 'inline-block');
        }
      });
    });

    $('.s-page-actions-links:not(.sPage-processed)', context).addClass('sPage-processed').each(function(){
      $(this).sActionLinks(
          {
            hidden: false,
            wrapper: '.action-links-wrapper'
          }
        );
    });

    $('td.indented-row:not(.sPage-processed)', context).addClass('sPage-processed').each(function(){
      var cell = $(this);
      var table = $("#s-page-nav-form");
      addPageActionLinkBehavior(cell, table);
      fixRowSpacing(table);
    });

    $('td.root-row:not(.sPage-processed)', context).addClass('sPage-processed').each(function(){
      var cell = $(this);
      var table = $("#s-page-nav-form");
      addPageActionLinkBehavior(cell, table);
      fixRowSpacing(table);
    });

    $('#s-page-subpage-list:not(.sPage-processed)', context).addClass('sPage-processed').each(function(){
      $('tr', $(this)).each(function(){
        $('.action-links-wrapper', $(this)).sActionLinks(
          {
            hidden: false,
            wrapper: '.action-links-wrapper'
          }
        );
      });
    });
}

if(Drupal.tableDrag){
  Drupal.tableDrag.prototype.row.prototype.markChanged = function() {
    var changedRow = $(this.element);
    var table = $(this.table);
    $("td", changedRow).each(function(){
      var cell = $(this);
      var indentation = $(".indentation", cell).length;
      adjustRowClasses(cell, indentation, changedRow);
    });
  //  var form = $("#s-page-nav-form");
  //  form.submit();
    $(".save-menu").show();
    return false;
  };
}

function addPageActionLinkBehavior(cell, table){
  $(".s-page-nav-links-unfold", cell).bind('click', function(){
    var wrapper = $(this).parent();
    var link = $(this);

    $(".s-page-nav-link-items", table).not($(".s-page-nav-link-items", wrapper)).each(function(){
      $(this).hide();
    });

    $(".s-page-nav-link-items", wrapper).toggle();
    if($(".s-page-nav-link-items", wrapper).is(":visible")){
      link.addClass('active');
      $(".s-page-nav-links-unfold", table).not($(".s-page-nav-links-unfold", wrapper)).removeClass('active');
    }
    else{
      link.removeClass('active');
    }
  });

  $(".s-page-nav-link-items a", cell).bind('click', function(){
    $(".s-page-nav-link-items", table).hide();
    $(".s-page-nav-links-unfold", table).removeClass('active');
  });

  $('body').bind('click',function(event){
    var target = $(event.target);

    //if we click outside the table or rows
    var foundRow = target.parents("tr");
    if(foundRow.length == 0){
      $(".s-page-nav-link-items", table).hide();
      $(".s-page-nav-links-unfold").removeClass('active');
    }
    else{ //look at the element and see if its showing
      var visible = $(".s-page-nav-link-items", foundRow).is(":visible");
      if(!visible){
        $(".s-page-nav-link-items").hide();
        $(".s-page-nav-links-unfold").removeClass('active');
      }
    }
  });

}

function remPageActionLinksBehavior(changedRow){
  $(".s-page-nav-links-unfold", changedRow).unbind();
}

function adjustRowClasses(cell, indentation, changedRow){
  if(indentation == 0 && !cell.hasClass('row-weight')){
    if(cell.hasClass('indented-row')){
      cell.removeClass('indented-row');
      cell.addClass('root-row');
      cell.removeClass('sPage-processed');
      remPageActionLinksBehavior(changedRow);
      actionLinks = sPageWrapActionLinks(createPageActionLinks(cell, changedRow, 1), 'junior');
      $(".s-page-action-links", cell).remove();
      $("a.tabledrag-handle", cell).after(actionLinks);
      Drupal.attachBehaviors(changedRow);
    }
  }
  else{
    if(!cell.hasClass('row-weight')){
      if(cell.hasClass('root-row')){
        cell.removeClass('root-row');
        cell.addClass('indented-row');
        cell.removeClass('sPage-processed');
        remPageActionLinksBehavior(changedRow);
        actionLinks = sPageWrapActionLinks(createPageActionLinks(cell, changedRow, 0), 'junior');
        $(".s-page-action-links", cell).remove();
        cell.prepend(actionLinks);
        Drupal.attachBehaviors(changedRow);
      }
    }
  }
}

function fixRowSpacing(table){
  $(".root-row", table).each(function(){
    var cell = $(this);
    var row = cell.parents("tr");
    var prevRow = row.prev();
    $(".row-data", prevRow).css('padding-bottom', '10px');
  });
  $(".indented-row", table).each(function(){
    var cell = $(this);
    var row = cell.parents("tr");
    var prevRow = row.prev();
    $(".row-data", prevRow).css('padding-bottom', '0px');
  });
}

function createPageActionLinks(cell, changedRow, r){
  var formClass = $("#s-page-nav-form").attr('class');
  var split = formClass.split("-");
  var realm = split[2];
  var realm_id = split[3];
  var pageID = $(".page-pageid", changedRow).val();
  var weight = parseInt($(".page-weight", changedRow).val());

  var html = '';
  if(r == 0){
    var prevRow = null;
    var prevRowFound = false;
    changedRow.prevAll().each(function(){
      if(!prevRowFound){
        var prevRowTemp = $(this);
        var rootRowTemp = $('.root-row', prevRowTemp);
        if(rootRowTemp.length){
          prevRow = prevRowTemp;
          prevRowFound = true;
        }
      }
    });
    var prevPageID = $(".page-pageid", prevRow).val();
    html+= '<li class="action-create-page-above"><a href="/'+realm+'/'+realm_id+'/materials/pages/create?r=0&p='+prevPageID+'&w='+weight+'">'+Drupal.t('Create page above')+'</a></li>';
    html+= '<li class="action-create-page-below"><a href="/'+realm+'/'+realm_id+'/materials/pages/create?r=0&p='+prevPageID+'&w='+(weight+1)+'">'+Drupal.t('Create page below')+'</a></li>';
    html+= '<li class="action-delete"><a href="/page/'+pageID+'/delete">'+Drupal.t('Delete page')+'</a></li>';
    return html;
  }
  else{
    html+= '<li class="action-create-page-above"><a href="/'+realm+'/'+realm_id+'/materials/pages/create?r=0&p=0&w='+weight+'">'+Drupal.t('Create page above')+'</a></li>';
    html+= '<li class="action-create-page-below"><a href="/'+realm+'/'+realm_id+'/materials/pages/create?r=0&p=0&w='+(weight+1)+'">'+Drupal.t('Create page below')+'</a></li>';
    html+= '<li class="action-create-subpage-below"><a href="/'+realm+'/'+realm_id+'/materials/pages/create?r=0&p='+pageID+'&w='+weight+'">'+Drupal.t('Create subpage below')+'</a></li>';
    html+= '<li class="action-delete"><a href="/page/'+pageID+'/delete">'+Drupal.t('Delete page')+'</a></li>';
    return html;
  }
}

function sPageWrapActionLinks(content, size){
  var html = '<div class="s-page-action-links s-page-action-links-wrapper-'+size+'">';
    html+= '<div tabindex="0" role="button" class="s-page-nav-links-unfold" href="#"><span class="action-links-unfold-text"><span class="visually-hidden">' + Drupal.t('Click to toggle options.') + '</span></span></div>';
    html+= '<ul class="s-page-nav-link-items" style="display: none;">';
    html+= content;
    html+= '</ul>';
    html+= '</div>';
  return html;
}

function sPageOnDeleteCallback( data , options ,element ){
  window.location.href = "/" + data.path;
  return false;
}