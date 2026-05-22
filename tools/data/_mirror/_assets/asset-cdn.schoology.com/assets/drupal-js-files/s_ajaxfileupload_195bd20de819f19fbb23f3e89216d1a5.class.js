var s_ajaxFileUpload = function(){

  this.uploadFormAjax = function(d,param_opts){
    if( typeof d == 'undefined' ) d = {};

    var saveDocumentVal = ($('#edit-save-documents:checked').val() !== null) ? "1" : "0";

    var encodeCB = $('#edit-encode-video:checked');
    var encodeVideo = (encodeCB.length == 0 || encodeCB.is(':checked')) ? '1' : '0';

    $.extend(d , {'saveDocument':saveDocumentVal , 'encodeVideo': encodeVideo} );

    var path_parts = String(window.location.pathname).split("/");

    switch(path_parts){
      default:
        d.upload_realm = path_parts[1];
        d.upload_realmId = path_parts[2];
        break;
    }

    var ajax_opts = {};
    var default_opts = {
      url: '/s_ajaxfileupload',
      secureuri: false,
      fileElementId: 'edit-upload-file',
      data: d,
      dataType: 'json',
      success: function (data, status){
        if( data.status != 0 ) {
          alert(Drupal.t("There was an internal error. Please try again in a few moments."));
          return;
        }

        var new_url = data.message.replace(/\\/g, '');
        sAfu.onUpload(new_url);
      },
      error: function (data, status, e){
        alert(Drupal.t("There was an internal error. Please try again in a few moments."));
      }
    };

    $.extend( ajax_opts , default_opts , param_opts );
    $.ajaxFileUpload( ajax_opts );
  }

  /** should be overridden by whatever you want to do after the upload succeeds **/
  this.onUpload = function(new_url){
    //console.log('onUpload: '+String(new_url));
  };
}

window.sAfu = new s_ajaxFileUpload();
