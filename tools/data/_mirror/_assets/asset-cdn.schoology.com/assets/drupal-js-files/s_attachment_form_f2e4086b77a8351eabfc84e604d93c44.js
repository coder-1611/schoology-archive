var uploads = [];
var lm = new sLinkManager();
const TYPE_ANNOTATION_FILE = 'A';

/**
 * Attach media recording in the WYSIWYG
 * This function is used by platform-ui/media-recorder
 * @param fid - file id from the attached file
 * @param type - "audio" or "video"
 * @param length - media length
 * @param size - size of the file
 */
function sAttachmentRecordingMediaRecorder(fid, type, length, size){
  var default_name = type === 'video' ? Drupal.t('Video Recording') : Drupal.t('Audio Recording');
  default_name += '.webm';
  var fileObj = { id: fid , name: default_name , title: default_name };

  var progress = new FileProgress(fileObj, "attachments-added-container");
  progress.setComplete();

  var progressWrapper = $('div#' + fid + '.progressWrapper');
  $('.progressName', progressWrapper).attr('id', 'file-' + fid);
  $('span.inline-icon.default-icon',progressWrapper).addClass('video-icon').removeClass('default-icon');

  sAttachmentSetupEditDetails(fid, fid);
  addFileToUploadField(fid, $('#attachments-added-container').closest('form'));
  addFileDetails(fid, default_name, undefined, undefined, type, length, size);
}

Drupal.behaviors.sAttachmentForm = function(context){
  window.uploads = [];

  //bind click event on delete attachment button
  $('#attachments:not(.sAttachmentDelete-processed)', context).addClass('sAttachmentDelete-processed').on('click', '.delete-attachment', function() {
    var $delEl = $(this);
    var aid = $delEl.attr('id').split('-').pop();
    $('.attachment-delete-' + aid, context).val(1);
    $delEl.closest('.attachment-block').remove();
    sPopupsResizeCenter();
  });

  $('.attachment-action-links:not(.sAttachmentForm-processed)', context).addClass('sAttachmentForm-processed').each(function(){

    $('.attachment-action-links', context).sActionLinks({
      hidden: true,
      wrapper: '.attachment-links-action-links',
      rowClass: '.attachment-links'
    });
  });

  $('.attachment-file-chunked:not(.sAttachmentFormChunked-processed)', context).addClass('sAttachmentFormChunked-processed').each(function(){
    //setup variables
    var uploadContainer = $(this);

    var getFormObj = function() {
      var formObj = uploadContainer.closest('form');
      return formObj.length ? formObj : uploadContainer;
    };

    var progressTargetID = '';

    if ($('.attachments-added-container', getFormObj())) {
      progressTargetID = $('.attachments-added-container', getFormObj()).attr('id');
    }

    progressTargetID = progressTargetID ? progressTargetID : 'attachments-added-container';


    var maxUploads = Drupal.settings.s_attachment.max_num_uploads;
    var customErrorMessages = Drupal.settings.s_attachment.custom_error_messages;
    var progress = {};
    var formSubmit = $('#edit-submit' , getFormObj());
    var spanSubmit = $('.submit-span-wrapper' , getFormObj());
    var cancelBtn;
    var deleteBtn;
    var hasError = {};
    var ulFilters = {
      max_file_size : Drupal.settings.s_attachment.max_filesize + 'mb'
    };
    var dropElementID = Drupal.settings.s_attachment.drop_element != undefined && Drupal.settings.s_attachment.drop_element.length > 0 ? Drupal.settings.s_attachment.drop_element : '';
    var encodeVideoID = 'edit-encode-video';

    //setup filters
    if(typeof Drupal.settings.s_attachment.file_types != 'undefined' && Drupal.settings.s_attachment.file_types){
      ulFilters.mime_types = [];
      ulFilters.mime_types[0] = {};
      ulFilters.mime_types[0].title = Drupal.t('Allowed Types');
      ulFilters.mime_types[0].extensions = Drupal.settings.s_attachment.file_types;
    }

    // Bind behaviors to remove underlying attachment form when we bring the popup messaging form out before we initialize this new element
    if(typeof Drupal.behaviors.sAttachmentMessageForm == 'function'){
      Drupal.behaviors.sAttachmentMessageForm();
    }

    // Drupal does not send the settings through an ajax call, so we have to look in a hidden field to get the button id
    var hiddenTargetDOM = $('#edit-target-DOM-id', context);
    if (hiddenTargetDOM.length) {
      Drupal.settings.s_attachment.target_DOM_id = hiddenTargetDOM.val();
    }

    //setup Uploader object
    var uploader = new plupload.Uploader({
      runtimes : 'html5, html4',
      browse_button : (Drupal.settings.s_attachment.target_DOM_id) ? Drupal.settings.s_attachment.target_DOM_id : 'upload-btn',
      url : Drupal.settings.s_attachment.upload_url,
      headers: {
        'X-Csrf-Token' : Drupal.settings.s_common.csrf_token,
        'X-Csrf-Key'   : Drupal.settings.s_common.csrf_key,
      },
      drop_element: dropElementID,
      filters : ulFilters,
      multi_selection : maxUploads > 1,
      init: {
        FilesAdded: function(up, files) {
          var numFiles = uploader.files.length;
          //if number of added files exceed the limit throw an error
          if(numFiles > maxUploads){
            var errorMsg = Drupal.t("You have attempted to queue too many files.") + "\n";
            if(maxUploads > 1){
              errorMsg += Drupal.t("You may select up to !max_uploads files.", {'!max_uploads' : maxUploads});
            }
            else{
              errorMsg += Drupal.t("You may select one file.");
            }

            alert(errorMsg);
            var diff = numFiles - maxUploads;
            uploader.splice(numFiles - diff, diff);
          }
          else{
            //else start queueing the uploaded files
            for (i in files){
              var fileObj = files[i];

              //setup UI
              progress[fileObj.id] = new FileProgress(fileObj, progressTargetID);
              progress[fileObj.id].setStatus(Drupal.t('Uploading' + '...'));

              //bind event such that when an attachment is removed, get rid of the file from the uploader files array
              var progressElement = $('#' + progress[fileObj.id].fileProgressID, getFormObj());
              progressElement.on('removed', function(){
                getFormObj().trigger('sAttachmentUploader.fileRemoved', [up, files]);
                uploader.removeFile(fileObj);
              });
            }

            //setup cancel buttons
            cancelBtn = $('.progressCancel', getFormObj());
            cancelBtn.show();
            cancelBtn.on('click', function(){
              var clickedBtn = $(this);
              var fileID = clickedBtn.parents('.progressWrapper:first').attr('id');
              clickedBtn.hide();
              progress[fileID].setStatus(Drupal.t('Canceled'));
              progress[fileID].setCancelled();
              uploader.removeFile(fileID);
            });

            //disable form submit button
            formSubmit.attr('disabled', 'true').addClass('disabled');

            //Start the upload
            uploader.start();
          }
        },
        BeforeUpload: function(up, file){
          var multParam = uploader.getOption('multipart_params');
          multParam = multParam ? multParam : {};
          multParam.use_plain = 1;
          //Make sure we don't send old fids or encode instructions to the server while we work through the upload queue
          delete multParam.fid;
          delete multParam.encode_video;

          var encode_video = sAttachmentChunkedUploadCheckEncode(encodeVideoID, getFormObj());

          if (encode_video !== false) {
            $.extend(multParam, {
              encode_video : encode_video
            });
          }

          //reset the multipart parameter so that it'll use empty fid at the beginning of the next queued file's upload
          //setting use_plain for response Content-Type to be in plain instead of json because of an IE9 issue
          uploader.setOption('multipart_params', multParam);
        },
        UploadProgress: function(up, file) {
          if(!hasError[file.id]){
            progress[file.id].setProgress(file.percent);
          }
        },
        ChunkUploaded: function(up, file, info){
          response = $.parseJSON(info.response);
          if(!hasError[file.id]){
            hasError[file.id] = sAttachmentChunkedUploadCheckError(uploader, file, response, progress);
          }
          if(!hasError[file.id]){
            //modify the multi_part param so that it passess in the newly created fid on the next upload chunks
            var multParam = uploader.getOption('multipart_params');
            if(typeof multParam.fid == 'undefined' || multParam.fid != response.file.fid){
              uploader.setOption('multipart_params', $.extend(multParam, {
                use_plain: 1,
                fid : response.file.fid
              }));
            }
            if(typeof response.final_phase != 'undefined' && response.final_phase){
              progress[file.id].setStatus(Drupal.t('Finalizing Upload') + ' <img class="loading-img" src="/sites/all/themes/schoology_theme/images/ajax-loader-small.gif" height="10" width="10" alt="' + Drupal.t('processing') + '" />');
            }
          }
        },
        FileUploaded : function(up, file, response){
          var multParam = {
            use_plain: 1
          };
          getFormObj().trigger('sAttachmentUploader.fileUploaded', arguments);

          var encode_video = sAttachmentChunkedUploadCheckEncode(encodeVideoID, getFormObj());

          if (encode_video !== false) {
            $.extend(multParam, {
              encode_video : encode_video
            });
          }

          //Reset the POST parameters so we don't send old fids to the upload endpoint
          uploader.setOption('multipart_params', multParam);

          var responseText = response.response;

          // IE9 somehow tacks on <pre> tags around the response on its own...very bizarre
          responseText = responseText.replace(/(^<pre>|<\/pre>$)/g, '');

          //check for errors
          response = $.parseJSON(responseText);
          if(!hasError[file.id]){
            hasError[file.id] = sAttachmentChunkedUploadCheckError(uploader, file, response, progress);
          }
          if(!hasError[file.id]){
            if((typeof response.file == 'undefined' || typeof response.file.fid == 'undefined' || !response.file.fid)
              && typeof response.fileMetadataId != 'undefined' && response.fileMetadataId) {
              if(typeof response.file == 'undefined'){
                response.file = {};
              }
              response.file.fid = response.fileMetadataId;
            }

            //no error alter UI to indicate that upload has completed
            progress[file.id].setStatus(Drupal.t('Complete'));
            progress[file.id].setComplete();
            deleteBtn = $('.progressDelete');
            cancelBtn.hide();
            deleteBtn.show();
            addFileToUploadField(response.file.fid, getFormObj()); //add the fid to the form's list of fids
            //use original file name as title by default, our file upload endpoint will convert file name to latin
            //see ticket SGY-11010
            addFileDetails(response.file.fid, htmlentities(file.name), null, response.file.file_metadata_id);
            sAttachmentSetupEditDetails(file.id, response.file.fid, response.file.can_skip_encode);
            $('#'+file.id).children().children('.progressName').attr('id', 'file-' + response.file.fid);
            formSubmit.removeAttr('disabled').removeClass('disabled');
            if (spanSubmit.length) {
              spanSubmit.removeClass('disabled');
            }

            if (response.sAfu_insert_content && typeof sAfu != "undefined") {
              sAfu.onUpload(response.file);
            }

            if (typeof Drupal.settings.postSuccessFunction == 'string'){
              var postSuccessFunction = Drupal.settings.postSuccessFunction;
              window[postSuccessFunction](response.file.destination);
            }
          }

        },
        PostInit: function (up, err){
          var dropElement = $('#' + dropElementID);
          //if we're running in html5, let's update the droptarget css
          if(up.runtime === 'html5' && dropElement.length > 0){
            dropElement.bind('dragenter', function(){
              sAttachmentChunkedUploadToggleDropzone(dropElementID, true, getFormObj());
            }).bind('dragleave dragend drop', function(){
              sAttachmentChunkedUploadToggleDropzone(dropElementID, false, getFormObj());
            });
          }
        }
      }
    });

    uploader.init();

    function hideAnnotationAttachment() {
      annotatationFile = $('.s-grade-item-annotation-attachment', getFormObj());
      annotatationFile.hide();
      $('.s-grade-item-assignment-submission-app', getFormObj()).each(function() {
        var appButton = $(this);
        appButton.show();
      });
    }

    function showAnnotationAttachment() {
      annotatationFile = $('.s-grade-item-annotation-attachment', getFormObj());
      annotatationFile.show();
      $('.s-grade-item-assignment-submission-app', getFormObj()).each(function() {
        var appButton = $(this);
        appButton.hide();
      });
    }

    var annotationFilters = {
      max_file_size : Drupal.settings.s_attachment.max_filesize + 'mb',
      mime_types: [{
        title: Drupal.t('Allowed Types'),
        extensions: 'doc,docx,html,jpeg,jpg,pdf,png,ppt,pptx,rtf,txt,xls,xlsx,xml',
      }],
    };

    //setup Uploader for Annotation assignments
    var annotationFileUploader = new plupload.Uploader({
      runtimes : 'html5, html4',
      browse_button : 'annotatable-file',
      url : Drupal.settings.s_attachment.upload_url,
      headers: {
        'X-Csrf-Token' : Drupal.settings.s_common.csrf_token,
        'X-Csrf-Key'   : Drupal.settings.s_common.csrf_key,
      },
      container: 'annotation-attachment-file',
      drop_element: 'annotatable-file',
      filters: annotationFilters,
      multi_selection : false,
      init: {
        Init: function() {
          const annotationsFileInput = sAttachmentGetAnnotationInputDom();
          // check if annotations file already exists from a form re-render and display it (validation error for example)
          if (annotationsFileInput.length && annotationsFileInput[0].value) {
            const annotationsFileDetail = JSON.parse(annotationsFileInput[0].value);
            const fid = Object.keys(annotationsFileDetail)[0];
            const filename = annotationsFileDetail[fid].title;

            showAnnotationAttachment();
            progress[fid] = new AnnotationAttachmentProgress({id: fid, name: filename}, 'annotation-attachment-file');
          }
        },
        FilesAdded: function(up, files) {
          var numFiles = annotationFileUploader.files.length;
          //if number of added files exceed the limit throw an error
          if (numFiles > 1){
            var errorMsg = Drupal.t("You may only select one file for annotation.");
            alert(errorMsg);
            var diff = numFiles - 1;
            annotationFileUploader.splice(numFiles - diff, diff);
          } else {
            //else queue the uploaded file
            var fileObj = files[0];

            progress[fileObj.id] = new AnnotationAttachmentProgress(fileObj, 'annotation-attachment-file');
            progress[fileObj.id].setStatus(Drupal.t('Uploading' + '...'));
            let fileExt = fileObj.name.match(/[0-9a-z]+$/i);
            progress[fileObj.id].setExtension(fileExt);

            showAnnotationAttachment();

            //bind event such that when an attachment is removed, get rid of the file from the annotationFileUploader files array
            var progressElement = $('#' + progress[fileObj.id].fileProgressID, getFormObj());
            progressElement.on('removed', function(){
              getFormObj().trigger('sAttachmentUploader.fileRemoved', [up, files]);
              annotationFileUploader.removeFile(fileObj);
            });

            //setup cancel buttons
            cancelBtn = $('.progressCancel', getFormObj());
            cancelBtn.show();
            cancelBtn.on('click', function(){
              var clickedBtn = $(this);
              var fileID = clickedBtn.parents('.progressWrapper:first').attr('id');
              clickedBtn.hide();
              progress[fileID].setStatus(Drupal.t('Canceled'));
              progress[fileID].setCancelled();
              annotationFileUploader.removeFile(fileID);
              hideAnnotationAttachment();
            });

            //disable form submit button
            formSubmit.attr('disabled', 'true').addClass('disabled');

            //Start the upload
            annotationFileUploader.start();
          }
        },
        BeforeUpload: function(up, file) {
          var multParam = annotationFileUploader.getOption('multipart_params') || {};
          multParam.use_plain = 1;
          //Make sure we don't send old fids or encode instructions to the server while we work through the upload queue
          delete multParam.fid;

          //reset the multipart parameter so that it'll use empty fid at the beginning of the next queued file's upload
          //setting use_plain for response Content-Type to be in plain instead of json because of an IE9 issue
          annotationFileUploader.setOption('multipart_params', multParam);
        },
        FilesRemoved: function(up, file) {
          hideAnnotationAttachment();
        },
        UploadProgress: function(up, file) {
          if (!hasError[file.id]) {
            progress[file.id].setProgress(file.percent);
          }
        },
        ChunkUploaded: function(up, file, info) {
          response = $.parseJSON(info.response);
          if (!hasError[file.id]) {
            hasError[file.id] = sAttachmentChunkedUploadCheckError(annotationFileUploader, file, response, progress);
          }
          if (!hasError[file.id]) {
            //modify the multi_part param so that it passess in the newly created fid on the next upload chunks
            var multParam = annotationFileUploader.getOption('multipart_params');
            if (typeof multParam.fid == 'undefined' || multParam.fid != response.file.fid) {
              annotationFileUploader.setOption('multipart_params', $.extend(multParam, {
                use_plain: 1,
                fid : response.file.fid
              }));
            }
            if (typeof response.final_phase != 'undefined' && response.final_phase) {
              progress[file.id].setStatus(Drupal.t('Finalizing Upload') + ' <img class="loading-img" src="/sites/all/themes/schoology_theme/images/ajax-loader-small.gif" height="10" width="10" alt="' + Drupal.t('processing') + '" />');
            }
          }
        },
        FileUploaded: function(up, file, response) {
          var multParam = {
            use_plain: 1
          };
          getFormObj().trigger('sAttachmentUploader.fileUploaded', arguments);

          var encode_video = sAttachmentChunkedUploadCheckEncode(encodeVideoID, getFormObj());

          if (encode_video !== false) {
            $.extend(multParam, {
              encode_video : encode_video
            });
          }

          //Reset the POST parameters so we don't send old fids to the upload endpoint
          annotationFileUploader.setOption('multipart_params', multParam);

          var responseText = response.response;

          //check for errors
          response = $.parseJSON(responseText);
          if (!hasError[file.id]) {
            hasError[file.id] = sAttachmentChunkedUploadCheckError(annotationFileUploader, file, response, progress);
          }
          if (!hasError[file.id]) {
            if (
              (typeof response.file == 'undefined' || typeof response.file.fid == 'undefined' || !response.file.fid)
              && typeof response.fileMetadataId != 'undefined' && response.fileMetadataId
            ) {
              if (typeof response.file == 'undefined') {
                response.file = {};
              }
              response.file.fid = response.fileMetadataId;
            }

            //no error alter UI to indicate that upload has completed
            progress[file.id].setStatus(Drupal.t('Complete'));
            progress[file.id].setComplete();
            deleteBtn = $('.progressDelete');
            cancelBtn.hide();
            deleteBtn.show();
            addFileToUploadField(response.file.fid, getFormObj(), TYPE_ANNOTATION_FILE); //add the fid to the form's list of fids
            //use original file name as title by default, our file upload endpoint will convert file name to latin
            //see ticket SGY-11010
            addFileDetails(response.file.fid, htmlentities(file.name), null, response.file.file_metadata_id, TYPE_ANNOTATION_FILE);
            sAttachmentSetupEditDetails(file.id, response.file.fid, response.file.can_skip_encode);
            $('#'+file.id).children().children('.s-grade-item-annotation-attachment-progress-name').attr('id', 'file-' + response.file.fid);
            formSubmit.removeAttr('disabled').removeClass('disabled');
            if (spanSubmit.length) {
              spanSubmit.removeClass('disabled');
            }

            if (response.sAfu_insert_content && typeof sAfu != "undefined") {
              sAfu.onUpload(response.file);
            }

            if (typeof Drupal.settings.postSuccessFunction == 'string'){
              var postSuccessFunction = Drupal.settings.postSuccessFunction;
              window[postSuccessFunction](response.file.destination);
            }
          }
        },
        PostInit: function (up, err) {
          var dropElement = $('#' + dropElementID);
          //if we're running in html5, let's update the droptarget css
          if (up.runtime === 'html5' && dropElement.length > 0) {
            dropElement.bind('dragenter', function(){
              sAttachmentChunkedUploadToggleDropzone(dropElementID, true, getFormObj());
            }).bind('dragleave dragend drop', function(){
              sAttachmentChunkedUploadToggleDropzone(dropElementID, false, getFormObj());
            });
          }
        }
      }
    });

    annotationFileUploader.bind('error', (uploader, event) => {
      if (event.code === plupload.FILE_EXTENSION_ERROR) {
        alert('File extension invalid: ' + ((event.file && event.file.type) || 'unknown'));
      }
    });
    if(!(uploadContainer.hasClass('featured-image-upload'))) {
      annotationFileUploader.init();
    }


    function errorSchoologyCore(up, err) {
      var errCode = err.code;
      var customErrMsg = customErrorMessages && customErrorMessages[errCode];
      getFormObj().trigger('sAttachmentUploader.error', arguments);
      if (customErrMsg) {
        sAttachmentChunkedUploadCheckError(uploader, err.file, {
          error: {
            code: '',
            message: customErrMsg
          },
          file: err.file,
          status: err.status
        }, progress);
        // custom message could cause the dialog size to change.
        sPopupsResizeCenter();
        return;
      }

      if(errCode == -601){
        var msg = Drupal.t("Only files of the following extensions are accepted: !ext", {'!ext' : Drupal.settings.s_attachment.file_types});
        alert(msg);
      }
      else if(errCode == -200){
        var response = {
          error: {
            code: '',
            message: Drupal.t('Unsupported file or directory uploaded')
          },
          file: err.file,
          status: err.status
        };
        sAttachmentChunkedUploadCheckError(uploader, err.file, response, progress);
      }
      else{
        alert(sgyModules.Utils.i18n.t('core.error_code_message', {code: errCode, message: err.message }));
      }
    }

    function beforeUploadServiceUploadSetToken(up, file){
      //subracting 30 seconds over here in case the user's clock is a little off
      if(Drupal.settings.s_attachment.file_service_upload.token_expire - 30 < (new Date).getTime()/1000){
        $.ajax('/uploads/token',{
          success: function (data, textStatus, jqXHR) {
            Drupal.settings.s_attachment.file_service_upload.token = data.token;
            Drupal.settings.s_attachment.file_service_upload.token_expire = data.expiration;
            up.start();
          },
          error: function () {
            //try to fallback to the schoology-core upload
            errorFileService(up, null);
          }
        });
        return false; //need to wait until tokens are updated before proceeding
      }
      uploader.setOption('headers', {'Authorization' : 'Bearer ' + Drupal.settings.s_attachment.file_service_upload.token});
      return true;
    }

    function errorFileService (up, err) {
      up.stop();
      if (up.settings.url == Drupal.settings.s_attachment.file_service_upload_url) {
        up.settings.url = Drupal.settings.s_attachment.upload_url;
        up.files.forEach(function (item) {
          if (item.status == plupload.FAILED) {
            item.loaded = 0;
            item.status = plupload.QUEUED;
          }

          window.setTimeout(function () {
            uploader.setOption('chunk_size', Drupal.settings.s_attachment.chunk_size + 'kb');
            uploader.unbind('Error', errorFileService);
            uploader.unbind('BeforeUpload', beforeUploadServiceUploadSetToken );
            uploader.bind('Error', errorSchoologyCore);
            up.start();
          }, 1000);
        });
        return;
      }
    }

    if(Drupal.settings.s_attachment.file_service_upload.enabled){
      //set url
      uploader.setOption('url', Drupal.settings.s_attachment.file_service_upload.url);
      uploader.setOption('chunk_size', 0);

      //bind a check to set token and update it if it is old
      uploader.bind('Error', errorFileService );
      uploader.bind('BeforeUpload', beforeUploadServiceUploadSetToken );
    } else {
      uploader.bind('Error', errorSchoologyCore);
      uploader.setOption('chunk_size', Drupal.settings.s_attachment.chunk_size + 'kb');
    }

    //If uploader event callbacks are specified in the Drupal settings and they actually exist in the behavior, bind them to this uploader instance
    //Note that the uploader calls these functions first (prior to the basic functions above) when triggering listeners attached to an event
    $.each(Drupal.settings.s_attachment.additional_behaviors, function(behaviorName, behaviorProperty){
      if (typeof Drupal.behaviors[behaviorName][behaviorProperty] !== 'undefined') {
        $.each(Drupal.behaviors[behaviorName][behaviorProperty], function(eventName, eventCallback) {
          if (typeof eventName === 'string' && typeof eventCallback === 'function') {
            uploader.bind(eventName, eventCallback);
          }
        });
      }
    });
  });

  /**
   * Javascript Behavior For resource Imports
   */

  // Handle submission of the form.
  $('#s-resource-attachments:not(.sAttachmentForm-processed)', context).addClass('sAttachmentForm-processed').each(function(){
    resourceIds = [];

    // If this popup gets closed, empty out resourceIds.  Make sure to only do this once
    $(document).unbind('popups_before_close.s_resource_attach');
    $(document).bind('popups_before_close.s_resource_attach', function(e, popup){
      if(popup != null && popup.hasOwnProperty('extraClass') && popup.extraClass.indexOf('s-resource-import-attachment') != -1){
        resourceIds = [];
      }
    });

    $('.submit-buttons .form-submit', $(this)).click(function(){
      var existingNids = sAttachmentGetAddedResources();
      var templateNids = [];
      if(resourceIds.length > 0){
        var deleteClass = '';
        var hasLTI = 0;
        $.each(resourceIds, function(i, v){
          // Make sure we don't add templates twice
          var successfulAdd = false;
          if(v.type == 'template' && $.inArray(v.nid, existingNids.templates) === -1){
            existingNids.templates.push(v.nid);
            successfulAdd = true;
            deleteClass = 'template-delete';
          }
          else if(v.type == 'contentAppImport') {
            existingNids.contentAppImports.push(v.nid);
            successfulAdd = true;
            deleteClass = 'content-import-delete';
          }

          // If we found a place for this, add it to DOM
          if(successfulAdd){
            var displayObject = '<div class="resource-attachment">';
            displayObject += '<span class="delete-link ' + deleteClass + '" id="delete-' + v.nid + '"></span>';
            displayObject += '<div class="resource-value"><div class="resource-icon">' + v.icon + '</div><div class="resource-title"></div></div>';
            displayObject += '</div>';
            displayObject = $(displayObject);

            // Leverage the fact that jquery's text function escapes markup and other harmful things for us
            $('.resource-title', displayObject).text(v.title);
            $('#attachments-added-container').append(displayObject);

            // Handle deleting a resource attachment
            $('.delete-link', displayObject).click(function(){
              var existingNids = sAttachmentGetAddedResources();
              if($(this).hasClass('template-delete')){
                var delId = parseInt($(this).attr('id').split('-').pop());
                var index = $.inArray(delId, existingNids.templates);
                if(index !== -1){
                  existingNids.templates.splice(index,1);
                }
              }
              else if($(this).hasClass('content-import-delete')){
                var delId = parseInt($(this).attr('id').split('-').pop());
                var index = $.inArray(delId, existingNids.contentAppImports);
                if(index !== -1){
                  existingNids.contentAppImports.splice(index,1);
                }
              }
              sAttachmentSetAddedResources(existingNids);
              $(this).parents('.resource-attachment:first').remove();
              sPopupsResizeCenter();
            });

            if(v.isLTI) {
              hasLTI++;
            }
          }
        });
        sAttachmentSetAddedResources(existingNids);
      }
      var popup = Popups.activePopup();

      // add warning to parent popup for LTI
      if(popup.parent != undefined && hasLTI > 0) {
        var parentPopupElm = $('#'+ popup.parent.id);
        if($('.s-js-external-tool-warning', parentPopupElm).length == 0) {
          addMessages([{'value': Drupal.t('Warning: LTI content may not load properly until the correct configurations are set. You can edit these configurations in External Tool Providers under Course Options, or edit the items individually from the gear menu.')}], 'warning s-js-external-tool-warning', $('.popups-body', parentPopupElm));
        }
      }

      Popups.close(popup);
      sPopupsResizeCenter();
    });
  });

  // Bind clicks to checkboxes inside the resources and add to resource Ids.  This is ajaxed in frequently by the actual resource browser
  $('#collection-view-contents.s-resource-attachment-form tr td.collection-item-checkbox input:not(.sAttachmentForm-processed)',context).addClass('sAttachmentForm-processed').each(function(){

    $(this).click(function(){
      var cbox = $(this);
      // Values of template checkboxes are of the form t_12345.  Validate that this is a template checkbox
      var checkboxValParts = cbox.val().split('_');
      var templateId = 0;
      if(isNaN(templateId = parseInt(checkboxValParts.pop())) === false && checkboxValParts.pop() == 't'){
        if(cbox.is(':checked')){
          // Grab the title so we can display this when the box gets closed
          var row = cbox.parents('.collection-row-template:first');
          var title = $('.collection-item-title span.item-title', row).text();
          var icon = $('.collection-item-icon', row).html();
          var isLTI = $('.collection-item-icon span:first', row).hasClass('external-tool-icon');
          resourceIds.push({'title' : title, 'icon' : icon, 'nid' : templateId, 'type' : 'template', isLTI : isLTI});
        }
        else{
          resourceIds = $.grep(resourceIds, function(v, i){
            return v.nid != templateId;
          })
        }
      }
      // Or might it be a google doc?
      else if(cbox.hasClass('gdoc')){
        var gdocId = cbox.val();
        if(cbox.is(':checked')){
          // Grab the title so we can display this when the box gets closed
          var row = cbox.closest('.collection-row-external');
          var title = $('.collection-item-title a.item-title', row).text();
          var icon = $('.collection-item-icon span.inline-icon', row)[0].outerHTML;
          resourceIds.push({'title' : title, 'icon' : icon, 'nid' : gdocId, 'type' : 'gdoc'});
        }
        else{
          resourceIds = $.grep(resourceIds, function(v, i){
            return v.nid != gdocId;
          })
        }
      }
    });
  });


  $("#attachment-link:not(.sAttachmentForm-processed)", context).addClass('sAttachmentForm-processed').each(function(){
    //rebuild link manager incase we are in popup
    lm.reset();
    var body = $(this).html();
    var body = '<fieldset>' + body + '</fieldset>';
    var buttons = {
      'linkAttach': {
        title: Drupal.t('Attach')
      },
      'linkPopupCancel': {
        title: Drupal.t('Close'),
        func: function(){popupLinkSelectorClose('#attachment-links ul#attachment-selector li#link-selector');}
      }
    }
    $(this).empty();
    var linkSelector = $('#attachment-links ul#attachment-selector li#link-selector:not(.sAttachmentForm-processed)', context);
    linkSelector.addClass('sAttachmentForm-processed');
    linkSelector.click(function(){
      if($(this).hasClass('active')){
        $(this).removeClass('active');
        return false;
      }
      else{
        $(this).data('popupOpen', 1);
        $(this).addClass('active');
        var popup = new Popups.Popup();
        popup.disableInputFocus = true; // make sure the close button is focused instead of the first input so the helper text will be visible
        popup.element = linkSelector.find('a')[0];
        var options = {'hideActive':false};
        popup.extraClass = 'popups-small add-link-popup';
        Popups.open(popup, Drupal.t('Attach Link/Embed'), body, buttons, '400', options);
        var popupContext = $('#' + popup.id);
        //attach all the behaviors
        var attachLinkBtn = $('#linkAttach', popupContext);
        var linkInput =$('#edit-link-url', popupContext);
        //when the box opens
        var preFilledText = linkInput.attr('defaulttext');
        var titleInput = $('#edit-link-title', popupContext);

        var errors = {
          linkLimit : {
            val : '<div id="too-many-links" class="messages error"><div class="message-text">' + Drupal.t("You can only attach ") + Drupal.settings.s_attachment.max_links + Drupal.t(" links.") + '</div></div>',
            isActive : false
          },
          ajaxError : {
            val : '<div class="messages error"><div class="message-text">' + Drupal.t("Sorry, no title was found") + '</div></div>',
            isActive : false
          },
          validUrl : {
            val : '<div id="not-valid-value" class="messages error"><div class="message-text">' + Drupal.t("Please enter a valid URL or Embed Code") + '</div></div>',
            isActive : false
          },
          embedTitle : {
            val : '<div class="messages error"><div class="message-text">' + Drupal.t("Titles for embedded media must be manually enterred") + '</div></div>',
            isActive : false
          }
        }

        var errorArea = $('.popups-body', popupContext);
        errorArea.bind('linkLimit', function(){
          if(errors.linkLimit.isActive == false){
            $('.messages.error', $(this)).remove();
            $(this).prepend(errors.linkLimit.val);
            errors.linkLimit.isActive = true;
          }
          sPopupsResizeCenter();
        })

        // reattach infotip
        $('span.infotip', popupContext).each(function(){
          $(this).removeClass('sCommonInfotip-processed');
        });

        sAttachBehavior('sCommonInfotip' , popupContext );

        linkInput.data('linkInfo', false);
        linkInput.data('linkInfoLastUpdate', '');
        linkInput.data('updatingInfo', false);

        if(linkInput.val() == '' || linkInput.val() == preFilledText){
          linkInput.val(preFilledText).addClass('pre-fill');
        }
        linkInput.focus(function(){
          if(linkInput.val() == preFilledText){
            linkInput.val('');
            linkInput.removeClass('pre-fill');
          }
        }).blur(function(){
          if(linkInput.val() == ''){
            linkInput.val(preFilledText);
            linkInput.addClass('pre-fill');
          }
        });

        linkInput.bind('keypress', function(e){
          if(e.which == 13){
            return false;
          }
        });
        linkInput.bind('addLink', function(){
          var currValue = $(this).val();
          var lastUpdate = $(this).data('linkInfoLastUpdate');
          var linkInfo = $(this).data('linkInfo');
          if(linkInfo == false){
            linkInfo ={};
          }
          linkInfo.title = htmlentities(titleInput.val());
          // No need to entity-encode link string
          // If it contains HTML we handle that on the server
          // SGY-22693
          linkInfo.link = currValue;
          var index = lm.addLink(linkInfo);
          if(index == 'full'){
            errorArea.trigger('linkLimit');
          }
          if(linkInfo != false && currValue == lastUpdate){
            var display = lm.getDisplay(index, linkInfo.favUrl);
            $('#attachments-added-container').append(display);
            sPopupsResizeCenter();
            $('.delete-link', display).click(function(){
              lm.removeLink($(this).data('linkManagerIndex'));
              sPopupsResizeCenter();
            });
          }
          else{
            var display = lm.getDisplay(index);
            $('#attachments-added-container').append(display);
            sPopupsResizeCenter();
            $('.delete-link', display).click(function(){
              lm.removeLink($(this).data('linkManagerIndex'));
              sPopupsResizeCenter();
            });
          }
        });

        attachLinkBtn.click(function(){
          if(!isLinkOrEmbed(linkInput.val())){
            if(errors.validUrl.isActive == false){
              $('.messages.error', errorArea).remove();
              errorArea.prepend(errors.validUrl.val);
              sPopupsResizeCenter();
              errors.validUrl.isActive = true;
            }
            return;
          }
          linkInput.trigger('addLink');
          linkInput.blur();
          linkInput.val('');
          titleInput.val('');
          linkInput.data('linkInfo', false);
          linkInput.data('linkInfoLastUpdate', '');
          popupLinkSelectorClose('#attachment-links ul#attachment-selector li#link-selector');
        });

        //lastly attach listener to popups-close
        $('.popups-close a', popupContext).click(function(e){
          // prevent parent (.popups-close) from calling default close behavior
          e.preventDefault();
          e.stopPropagation();
          popupLinkSelectorClose('#attachment-links ul#attachment-selector li#link-selector');
        });
        return false;
      }
    });


    $('#attachment-links ul#attachment-selector li#external-tool-selector:not(.sAttachmentForm-processed)', context).addClass('sAttachmentForm-processed').each(function(){
      $(this).click(function(){
        if(window.sExternalToolFormSettings == undefined) {
          Popups.saveSettings();
          var parentPopup = Popups.activePopup();
          var options = Popups.options({
            href: $('a', this).attr('href'),
            extraClass: 'popups-large popups-add-external-tool-link',
            disableInputFocus: true
          });
          Popups.openPath($('a', this), options, parentPopup);
        }
        else {
          var externalToolPopupBody = '<div class="s-external-tool-attachment-wrapper"></div>';
          var popup = new Popups.Popup();
          popup.parent = Popups.activePopup();
          popup.element = this;
          popup.extraClass = 'popups-large popups-add-external-tool-link';
          var externalToolPopup = Popups.open(popup, Drupal.t('Add External Tool'), externalToolPopupBody, null, null, null);
          sAttachBehaviors(['sExternalTool'], $('#' + externalToolPopup.id));
        }
        return false;
      });
      // clear attachemnts
      if(window.sExternalToolFormSettings != undefined) {
        window.sExternalToolFormSettings.attachments = {};
      }
    });


    if(typeof Drupal.settings.s_attachment != 'undefined' && typeof Drupal.settings.s_attachment.existing_links != 'undefined'){
      var attachCont = $('#attachments-added-container');
      var existingLinks = Drupal.settings.s_attachment.existing_links;
      for(i in existingLinks){
        var editLink = $('#edit-link-' + i);
        editLink.val(String(existingLinks[i]));
        var linkInfo = $.parseJSON(existingLinks[i]);
        var attachmentContext = $('#link-display-' + i);
        lm.addLink(linkInfo);
        var display = lm.getDisplay(i, linkInfo.favUrl);
        attachCont.append(display);
        sPopupsResizeCenter();
        $('.delete-link', display).click(function(){
          lm.removeLink($(this).data('linkManagerIndex'));
          sPopupsResizeCenter();
        });
      }
      sPopupsResizeCenter();
    }
  });
}

$(document).ready(function() {
  //block default browser action when drag and dropping files into the browser (e.g. don't load the drag/dropped file)
  $(window).bind("dragover", function (e) {
    e = e || event;
    e.preventDefault();
  });
  $(window).bind("drop", function (e) {
    e = e || event;
    e.preventDefault();
  });
});

function attachmentSelectorHandler(menuItem){
  var selector = $(menuItem).attr('id');
  if($("#copy-to-courses div").length > 0){
    $("#toggle-copy").siblings().hide();
    $("#toggle-copy").removeClass('active');
  }
  return false;
}

function addFileToUploadField(fid, context, type = null){
  uploads.push(fid);

  const $fileInputDom = type === TYPE_ANNOTATION_FILE
    ? sAttachmentGetAnnotationInputDom(context)
    : sAttachmentGetFileInputDom(context);
  let files = {};

  // add prior files for regular attachments (annotation only allows one file)
  const priorValue = $fileInputDom.val();
  if (priorValue && type !== TYPE_ANNOTATION_FILE ) {
    files = $.parseJSON(priorValue);
  }

  // add latest file
  files[fid] = '';
  $fileInputDom.val($.toJSON(files));

}

function isRecordedFile( fid ){
  if( !fid )
    return false;
  var recFileObj = $('#edit-file-recording');
  var recFileVal = recFileObj.val();

  if(!recFileVal || recFileVal == '')
    return false;

  if( recFileVal == fid )
    return true;
  var recFile = $.parseJSON(recFileVal);
  return recFile.id == fid;
}

function addFileDetails(fid, title, encode, fileMetadataId, type, length, size){
  // is this an audio/video recording? use the alternate hidden input
  if( isRecordedFile( fid ) ){
    var recFile = {'fid': fid , 'title': title};
    $('#edit-file-recording').val( $.toJSON(recFile) );
    return true;
  }
  title = htmlentities(title);
  const $fileInputDom = type === TYPE_ANNOTATION_FILE
    ? sAttachmentGetAnnotationInputDom()
    : sAttachmentGetFileInputDom();
  const files = $.parseJSON($fileInputDom.val() || '{}');

  if (files.hasOwnProperty(fid)) {
    if (typeof files[fid] != 'object') {
      files[fid] = {title: '', encode: true};
    }

    if (typeof title == 'string') {
      files[fid].title = title;
    }

    if (typeof encode == 'boolean') {
      files[fid].encode = encode;
    }

    if (fileMetadataId) {
      files[fid].file_metadata_id = fileMetadataId;
    }

    if (type) {
      files[fid].type = type;
    }

    files[fid].length = length;
    files[fid].size = size;
  }

  $fileInputDom.val($.toJSON(files))
}

function removeFileFromUploads(fid, type='') {
  // is this an audio/video recording? use the alternate hidden input
  if( isRecordedFile(fid) ){
    $('#edit-file-recording').val('');
  } else {

    uploads.splice(jQuery.inArray(fid, uploads), 1);

    const $fileInputDom = type === TYPE_ANNOTATION_FILE
      ? sAttachmentGetAnnotationInputDom()
      : sAttachmentGetFileInputDom();
    let files = {};

    // keep prior files for regular attachments (annotation only allows one file)
    const priorValue = $fileInputDom.val();
    if (priorValue && type !== TYPE_ANNOTATION_FILE ) {
      files = $.parseJSON(priorValue);
      delete files[fid];
    }

    $fileInputDom.val($.toJSON(files));
  }
}

function removeTitleFromUploads(fid){
  var $fileInputDom = sAttachmentGetFileInputDom();
  var val = $fileInputDom.val();
  if(val != ''){
    var titles = $.parseJSON(val);
  }
  else{
    return false;
  }
  if(titles.hasOwnProperty(fid)){
    delete titles[fid];
  }
  $fileInputDom.val($.toJSON(titles));
}

function resetAttachmentForm(){
  // hide both tabs
  $("#attachment-link").hide();
  $("#attachment-file").hide();
  $("#attachment-info").hide()

  $("#attach-selector").click();
  sAttachmentGetFileInputDom().val('');
  $('#edit-file-recording').val('');
  $('#recording-selector a').removeClass('disabled');
  $('#mediarecorder-selector a').removeClass('disabled');
  $('#edit-file-resources').val('');
  $(".progressWrapper").remove();

  var alpha = 1.0;
  $('.url-submit a', $('#attachment-link')).css({
    'filter' : 'alpha(opacity='+(alpha*100)+')',
    '-moz-opacity' : alpha,
    '-khtml-opacity' : alpha,
    'opacity' : alpha
  });

  $('#attachments-added-container').empty();
  lm.reset();

  sPopupsResizeCenter();
}

// since the attachment form is currently singleton, use this function to
// move the attachment form to another form on the same page
function sAttachmentMoveForm( formObj , sibling_selector , add_method ){
  // already has the form
  if( $('div#attachments',formObj).length > 0 ) return false;

  resetAttachmentForm();

  var attachment_form = $('div#attachments');

  switch( add_method ){
    case 'append':$( sibling_selector , formObj ).append( attachment_form );break;
    case 'before':$( sibling_selector , formObj ).before( attachment_form );break;
    default:$( sibling_selector , formObj ).after( attachment_form );break;
  }

  // undo sHideObjectEmbed if moving an attachment form from the page to a popup
  var hideObjPl = $('.sHideObjectEmbedPlaceholder' , formObj );
  if(hideObjPl.length > 0){
    hideObjPl.remove();
  }

  return true;
}


function popupLinkSelectorClose(selector){
  var ls = $(selector);
  if(ls.data('popupOpen') == 1){
    Popups.close();
    ls.data('popupOpen', 0);
  }
  ls.removeClass('active');
}

function sAttachmentSetupEditDetails(fileID, fileFID, canSkipEncode ) {
  canSkipEncode = typeof canSkipEncode == 'boolean' ? canSkipEncode : false;
  var fileContainerObj = $('#' + String(fileID));
  var parentObj = $('.file-details-content',fileContainerObj);
  var titleInput = parentObj.children('.progressTitleInput');

  titleInput.attr('id', 'file-title-' + String(fileFID)).removeClass('hidden').val(Drupal.t('Add Title'));

  titleInput.focus(function() {
    var titleContext = $(this);
    if(titleContext.hasClass('pre-fill')) {
      titleContext.removeClass('pre-fill');
      titleContext.val('');
    }
  });
  titleInput.blur(function() {
    var titleContext = $(this);
    if(titleContext.val() == '') {
      titleContext.val(Drupal.t('Add Title'));
      titleContext.addClass('pre-fill');
    }
    else {
      var fid = titleContext.attr('id').replace(/^file-title-/i,'');
    }
    addFileDetails(fid, titleContext.val() );
  });

  // Add the skip-encoding checkbox and infotip
  if( canSkipEncode && $('input.encode-cb',parentObj).length == 0 ){
    var cbHTML = '<input type="checkbox" name="" id="file-encode-'+String(fileFID)+'" class="encode-cb" CHECKED/> <span id="file-encode-infotip-'+String(fileFID)+'" class="infotip" tipsygravity="w">' + Drupal.t('Encode video');
    cbHTML += '<span class="infotip-content">' + Drupal.t('If you uncheck this box, the uploaded file will be used for playback instead of a converted version.') + '</span></span>';
    parentObj.append( cbHTML );

    $('input.encode-cb',parentObj).bind('change',function(){
      var fid = $(this).attr('id').split('-')[2];
      addFileDetails( fid , null , $(this).is(':checked') );
    });

    // if they click the text, click the checkbox
    $('input.encode-cb',parentObj).siblings('span.infotip').bind('click',function(){
      var cbObj = $(this).siblings('input.encode-cb');
      cbObj.trigger('click');
      var fid = $(this).attr('id').split('-')[3];
      addFileDetails( fid , null , cbObj.is(':checked') );
    });

    // enable infotip
    Drupal.attachBehaviors( parentObj );
  }

  var showHideObj = $('.progressShowHide', fileContainerObj);
  parentObj.hide();

  showHideObj.click(function() {
    var linkContextObj = $(this);
    var parentObj = linkContextObj.parents('.progressWrapper:first');
    var contentObj = $('.file-details-content', parentObj);

    contentObj.toggle();
    linkContextObj.toggleClass('active');

    sPopupsResizeCenter();
  });
}

function sAttachmentGetAddedResources(){
  var existingVal = $('#edit-file-resources').val();
  var existingNids = existingVal == '' ? {} : $.parseJSON($('#edit-file-resources').val());
  if(!existingNids.hasOwnProperty('templates')){
    existingNids.templates = [];
  }
  if(!existingNids.hasOwnProperty('contentAppImports')){
    existingNids.contentAppImports = [];
  }
  return existingNids;
}

function sAttachmentSetAddedResources(existingNids){
  var string = $.toJSON(existingNids);
  $('#edit-file-resources').val(string);
}

/**
 * Handler for when schoology PHP backend returns error
 */
function sAttachmentChunkedUploadCheckError(uploader, file, response, progress){
  var hasError = false;
  //ensure that no error occured and moreover that file fid is set properly
  if(typeof response == 'undefined' || response == 'null' || response.error
    || ((typeof response.file == 'undefined' || typeof response.file.fid == 'undefined' || !response.file.fid)
      && (typeof response.fileMetadataId == 'undefined' || !response.fileMetadataId))
  ) {
    hasError = true;


    //set error messages
    var msg;
    if(response.error){
      if (response.error.code) {
        msg = Drupal.t('Error !code: !message', {'!code': response.error.code, '!message': response.error.message});
      }
      else if (response.error.message) {
        msg = Drupal.t('!message', {'!message': response.error.message});
      }
    }
    else{
      msg = Drupal.t('An unexpected error occured.');
    }
    progress[file.id].setStatus(msg);
    progress[file.id].setError();
    uploader.removeFile(file, false);
  }

  return hasError;
}

function sAttachmentChunkedUploadToggleDropzone(dropZoneId, hoverStateActive, context) {
  if (dropZoneId) {
    var dropElement = $('#' + dropZoneId, context);
    hoverStateActive = (hoverStateActive) ? true : false;
    if (dropElement) {
      dropElement.toggleClass('drag-hover', hoverStateActive);
    }
  }
}

function sAttachmentChunkedUploadCheckEncode(encodeVideoID, context) {
  var encodeCheckbox = $('#' + encodeVideoID, context);
  if (encodeCheckbox.length > 0) {
    return (encodeCheckbox.is(':checked') ? "1" : "0");
  }
  return false;
}

/**
 * Get DOM reference for input element that's storing uploaded file info
 *
 * @param {DOMNode} context
 * @returns {jQueryElement}
 */
function sAttachmentGetFileInputDom(context) {
  // in case of multi-steps form the Dom Id will be edit-file-files-#{stepNumber}
  var selector = '[id^=edit-file-files]';
  return context
    ? $(selector, context)
    : $(selector);
}

/**
 * Get DOM reference for input element that's storing annotation info
 *
 * @param {DOMNode} context
 * @returns {jQueryElement}
 */
function sAttachmentGetAnnotationInputDom(context) {
  // in case of multi-steps form the Dom Id will be edit-file-files-#{stepNumber}
  const selector = '[id^=edit-annotation-files]';
  return context
    ? $(selector, context)
    : $(selector);
}

let eventHandlersAddedForAttachmentForm = false;

/**
 * Add focus, blur, and keydown event handlers for attachment form.
 * Handles 'Enter'/'Space' key presses to trigger appropriate click events.
 */
function addEventHandlersForAttachmentForm() {
  const attachmentSelectorSpans = $("#attachment-selector li a span");
  // handle focus events for attachment form
  attachmentSelectorSpans.on('focus', function() {
    $(this).parent().addClass('on-focussed');
  });

  // handle blur events for attachment form
  attachmentSelectorSpans.on('blur', function() {
    $("#attachment-selector").find('a').removeClass('on-focussed');
  });

  // handle keyboard events for attachment form
  attachmentSelectorSpans.on('keydown', function(e) {
    if (isEnterOrSpaceKeyEvent(e)) {
      e.preventDefault();

      const parentLi = $(this).closest('li');
      // if the parent is the file selector, click the file input
      if (parentLi.attr('id') === 'file-selector') {
        parentLi.find('input[type="file"]').click();
      } else {
        $(this).parent().click();
      }
    }
  });

  const attachmentSelectorAnch = $("#attachment-selector li a");
  attachmentSelectorAnch.on('focus', function() {
    // Remove focus from the current element
    $(this).blur();

    // Focus on the child span tag
    $(this).find('span').focus();
  });
}

// listen for s_event_add_combined_form_loaded event to add event handlers
$(document).on('s_event_add_combined_form_loaded', function( event, context ) {
  if (!eventHandlersAddedForAttachmentForm) {
    addEventHandlersForAttachmentForm();
    eventHandlersAddedForAttachmentForm = true;
  }
});

// reset the eventHandlersAddedForAttachmentForm flag when popups are closed
$(document).on('popups_close', function() {
  eventHandlersAddedForAttachmentForm = false;
});
