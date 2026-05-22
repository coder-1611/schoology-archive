/*
	A simple class for displaying file information and progress
*/

// Constructor
// file is a plUpload file object
// targetID is the HTML element id attribute that the FileProgress HTML structure will be added to.
// Instantiating a new FileProgress object with an existing file will reuse/update the existing DOM elements
function AnnotationAttachmentProgress(file, targetID) {
  this.fileProgressID = file.id;
  this.opacity = 100;
  this.height = 0;
  this.wrapperId = "#" + this.fileProgressID;

  this.fileProgressWrapper = $(this.wrapperId)[0];
  if (!this.fileProgressWrapper) {
    const progressWrapper = $(`<div id='${this.fileProgressID}' class='progressWrapper'></div>`);
    const container = $(`<div class="s-grade-item-annotation-attachment-progress-container"></div>`);

    progressWrapper.append(container);
    container.append(`
      <a class='progressCancel s-grade-item-annotation-attachment-cancel' href='#' style='display: none;'> </a>
      <a class='s-grade-item-annotation-attachment-delete' href='#' style='display: none;'> </a>
      <span class='s-grade-item-annotation-attachment-text'>${Drupal.settings.student_annotate_their_own_copy}</span>
      <span class='default-icon inline-icon s-grade-item-annotation-attachment-icon'></span>
      <span class='s-grade-item-annotation-attachment-progress-name'>${file.name}</span>
      <span class='s-grade-item-annotation-attachment-status'>&nbsp;</span>
      <div class='progressBarInProgress s-grade-item-annotation-attachment-progress-bar'></div>
    `);

    $('#' + targetID).append(progressWrapper);

    this.fileProgressWrapper = $(this.wrapperId)[0];
    this.fileProgressElement = $(this.wrapperId + ' .s-grade-item-annotation-attachment-progress-container')[0];
    this.fileProgressStatus = $(this.wrapperId + ' .progressBarStatus')[0];
    this.fileProgressBar = $(this.wrapperId + ' .s-grade-item-annotation-attachment-progress-bar')[0];
    this.progressDelete = $(this.wrapperId + ' .s-grade-item-annotation-attachment-delete')[0];
    this.progressStatus = $(this.wrapperId + " .s-grade-item-annotation-attachment-status")[0];
    this.progressCancel = $(this.wrapperId + " .s-grade-item-annotation-attachment-cancel")[0];
  } else {
    this.fileProgressElement = $('.s-grade-item-annotation-attachment-progress-container')[0];
    this.reset();
  }

  this.height = this.fileProgressWrapper.offsetHeight;
  this.setTimer(null);

  this.toggleInformationMessage(false);
  this.toggleSubmissionOptions();

  sFileProgressResizePopup();
}
AnnotationAttachmentProgress.prototype.setExtension = function(ext){
  const extensionMap = {
    'doc' : 'doc-icon',
    'docx' : 'doc-icon',
    'pdf' : 'pdf-icon',
    'jpg' : 'image-icon',
    'png' : 'image-icon',
    'jpeg' : 'image-icon',
  }
  let fileExtensionIcon = $(".s-grade-item-annotation-attachment-icon");
  if(extensionMap.hasOwnProperty(ext)){
    fileExtensionIcon.removeClass("default-icon").addClass(extensionMap[ext]);
  }
  else{
    fileExtensionIcon.className = 's-grade-item-annotation-attachment-icon inline-icon default-icon';
  }
}

AnnotationAttachmentProgress.prototype.setTimer = function (timer) {
  this.fileProgressElement["FP_TIMER"] = timer;
};

AnnotationAttachmentProgress.prototype.getTimer = function (timer) {
  return this.fileProgressElement["FP_TIMER"] || null;
};

AnnotationAttachmentProgress.prototype.reset = function () {
  this.fileProgressElement.addClass("progressBarInProgress");
  this.fileProgressStatus.html("&nbsp;");
  this.fileProgressStatus.attr( "class", "progressBarStatus" );
  this.fileProgressBar.attr("class", "progressBarInProgress s-grade-item-annotation-attachment-progress-bar");
  this.fileProgressBar.style.width = "0%";
  this.appear();
};

AnnotationAttachmentProgress.prototype.setProgress = function (percentage) {
  this.fileProgressElement.className = "s-grade-item-annotation-attachment-progress-container orange";
  this.fileProgressBar.className = "progressBarInProgress s-grade-item-annotation-attachment-progress-bar";
  this.fileProgressBar.style.width = percentage + "%";
  this.appear();
};

AnnotationAttachmentProgress.prototype.setComplete = function () {
  const TYPE_ANNOTATION_FILE = 'A';
  this.fileProgressElement.className = "s-grade-item-annotation-attachment-progress-container green";
  this.fileProgressBar.className = "progressBarComplete s-grade-item-annotation-attachment-progress-bar";
  this.fileProgressBar.style.width = "";

  $(this.progressDelete).show();
  var progressElement = this;

  this.progressDelete.onclick = function () {
    let popup = new Popups.Popup();
    popup.extraClass = 'save-changes-popup';

    var body = Drupal.t('Are you sure you want to remove this attachment?');
    var options = {'hideActive':false};
    var buttons = {
      'popup_submit': {
        title: Drupal.t('Remove'), func: function() {
          var fid = $(".s-grade-item-annotation-attachment-progress-name")[0].id.replace(/^file-/i,'');
          removeFileFromUploads(fid, TYPE_ANNOTATION_FILE);
          progressElement.setDeleted();
          progressElement.setStatus(Drupal.t('Removed'));
          $('.s-grade-item-annotation-attachment-delete').hide();
          sPopupsResizeCenter();
          popup.close();
          $('#' + progressElement.fileProgressID).trigger('removed');
          progressElement.toggleInformationMessage(true);
          progressElement.toggleSubmissionOptions();
        }
      },
      'popup_cancel': {title: Drupal.t('Cancel'), func: function(){popup.close();}}
    };
    popup.extraClass = 'popups-small remove-attachment-dialog';
    Popups.open(popup, Drupal.t('Remove Attachment'), body, buttons, null, options);
    sFileProgressResizePopup();

    return false;
  };
};

AnnotationAttachmentProgress.prototype.setError = function () {
  this.fileProgressElement.className = "s-grade-item-annotation-attachment-progress-container red";
  this.fileProgressBar.className = "progressBarError s-grade-item-annotation-attachment-progress-bar";
  this.fileProgressBar.style.width = "";
};

AnnotationAttachmentProgress.prototype.setCancelled = function () {
  this.fileProgressElement.className = "s-grade-item-annotation-attachment-progress-container";
  this.fileProgressBar.className = "progressBarError s-grade-item-annotation-attachment-progress-bar";
  this.fileProgressBar.style.width = "";

  var oSelf = this;
  this.setTimer(setTimeout(function () {
    oSelf.disappear();
    sPopupsResizeCenter();
  }, 2000));
};

AnnotationAttachmentProgress.prototype.setDeleted = function () {
  this.fileProgressElement.className = "s-grade-item-annotation-attachment-progress-container";
  this.fileProgressBar.className = "progressBarError s-grade-item-annotation-attachment-progress-bar";
  this.fileProgressBar.style.width = "";

  var oSelf = this;
  oSelf.disappear();
};

AnnotationAttachmentProgress.prototype.setStatus = function (status) {
  $(this.progressStatus).html(status);
};

// Show/Hide the cancel button
AnnotationAttachmentProgress.prototype.toggleCancel = function (show) {
  $(this.progressCancel).toggle(show);
};

AnnotationAttachmentProgress.prototype.toggleInformationMessage = function (isVisible) {
  $('.s-grade-item-assignment-submission-information').toggle(isVisible);
};

AnnotationAttachmentProgress.prototype.toggleSubmissionOptions = function () {
  $('.submission-options-wrapper').toggle();
};

AnnotationAttachmentProgress.prototype.appear = function () {
  if (this.getTimer() !== null) {
    clearTimeout(this.getTimer());
    this.setTimer(null);
  }

  if (this.fileProgressWrapper.filters) {
    try {
      this.fileProgressWrapper.filters.item("DXImageTransform.Microsoft.Alpha").opacity = 100;
    } catch (e) {
      // If it is not set initially, the browser will throw an error.  This will set it if it is not set yet.
      this.fileProgressWrapper.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=100)";
    }
  } else {
    this.fileProgressWrapper.style.opacity = 1;
  }

  this.fileProgressWrapper.style.height = "";

  this.height = this.fileProgressWrapper.offsetHeight;
  this.opacity = 100;
  this.fileProgressWrapper.style.display = "";

};

AnnotationAttachmentProgress.prototype.disappear = function () {
  this.fileProgressWrapper.style.display = "none";
  this.fileProgressWrapper.style.opacity = "0";
  this.fileProgressWrapper.style.height = "0px";
};

function sFileProgressResizePopup() {
  if (typeof(Popups) == 'undefined') {
    return;
  }

  const popup = Popups.activePopup();

  if (popup != null) {
    Popups.resizeAndCenter(popup);
  }
}
