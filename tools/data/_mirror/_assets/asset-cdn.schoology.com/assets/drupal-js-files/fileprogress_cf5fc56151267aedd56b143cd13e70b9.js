/*
	A simple class for displaying file information and progress
	Note: Some have had problems adapting this class in IE7. It may not be suitable for your application.
*/

// Constructor
// file is a plUpload file object
// targetID is the HTML element id attribute that the FileProgress HTML structure will be added to.
// Instantiating a new FileProgress object with an existing file will reuse/update the existing DOM elements
function FileProgress(file, targetID) {
	this.fileProgressID = file.id;

	this.opacity = 100;
	this.height = 0;

	this.fileProgressWrapper = document.getElementById(this.fileProgressID);

	if (!this.fileProgressWrapper) {
		this.fileProgressWrapper = document.createElement("div");
		this.fileProgressWrapper.className = "progressWrapper";
		this.fileProgressWrapper.id = this.fileProgressID;

		this.fileProgressElement = document.createElement("div");
		this.fileProgressElement.className = "progressContainer";

		var progressCancel = document.createElement("a");
		progressCancel.className = "progressCancel";
		progressCancel.href = "#";
		progressCancel.style.display = "none";
		progressCancel.appendChild(document.createTextNode(" "));

		var progressDelete = document.createElement("a");
		progressDelete.className = "progressDelete";
		progressDelete.href = "#";
		progressDelete.style.display = "none";
		progressDelete.appendChild(document.createTextNode(" "));

		var progressText = document.createElement("span");
		progressText.className = "progressName";
		progressText.appendChild(document.createTextNode(file.name));

    var progressShowHide = document.createElement("span");
    progressShowHide.className = "progressShowHide";
    progressShowHide.appendChild(document.createTextNode(Drupal.t('Edit Details')));

    var progressTitleInput = document.createElement('input');
    progressTitleInput.id = this.fileProgressID + '-title';
    progressTitleInput.className = "progressTitleInput hidden pre-fill";

		var progressBar = document.createElement("div");
		progressBar.className = "progressBarInProgress";

		var progressStatus = document.createElement("div");
		progressStatus.className = "progressBarStatus";
		progressStatus.innerHTML = "&nbsp;";

    var progressShowHideContent = document.createElement("div");
    progressShowHideContent.className = "file-details-content clearfix";
    progressShowHideContent.appendChild(document.createElement('div')); //wrapper for possible thumbnail preview
    progressShowHideContent.childNodes[0].className = 'thumb-preview-wrapper';
    progressShowHideContent.appendChild(document.createElement('div').appendChild(progressTitleInput));

    var fileExtensionIcon = document.createElement("span");
    fileExtensionIcon.className = "default-icon inline-icon";

		this.fileProgressElement.appendChild(progressCancel); //0
		this.fileProgressElement.appendChild(progressDelete); //1
    this.fileProgressElement.appendChild(progressShowHide); //2
    this.fileProgressElement.appendChild(fileExtensionIcon);//3
		this.fileProgressElement.appendChild(progressText); //5 - 4
		this.fileProgressElement.appendChild(progressStatus);//6 - 5
		this.fileProgressElement.appendChild(progressBar); //7 - 6
    this.fileProgressElement.appendChild(progressShowHideContent) //8 - 7

		this.fileProgressWrapper.appendChild(this.fileProgressElement);

		document.getElementById(targetID).appendChild(this.fileProgressWrapper);
	} else {
		this.fileProgressElement = this.fileProgressWrapper.firstChild;
		this.reset();
	}

	this.height = this.fileProgressWrapper.offsetHeight;
	this.setTimer(null);
	sFileProgressResizePopup();
}

FileProgress.prototype.setExtension = function(ext){
  var extensionMap = {
    'zip' : 'zip-icon',
    'xls' : 'xls-icon',
    'xlsx' : 'xls-icon',
    'doc' : 'doc-icon',
    'docx' : 'doc-icon',
    'pdf' : 'pdf-icon',
    'ppt' : 'ppt-icon',
    'pptx' : 'ppt-icon',
    'txt' : 'txt-icon',

    'jpg' : 'image-icon',
    'png' : 'image-icon',
    'gif' : 'image-icon',
    'jpeg' : 'image-icon',

    'flv' : 'video-icon',
    'avi' : 'video-icon',
    'mpg' : 'video-icon',
    'mov' : 'video-icon',
    'm4v' : 'video-icon',
    'm2v' : 'video-icon',
    'wmv' : 'video-icon',
    'wm' : 'video-icon',
    'mp4' : 'video-icon',
    '3g2' : 'video-icon',
    '3gp' : 'video-icon',
    'asf' : 'video-icon',
    'qt' : 'video-icon',
    'ram' : 'video-icon',
    'rm' : 'video-icon',
    'rpm' : 'video-icon',
    'rv' : 'video-icon',
    'smi' : 'video-icon',
    'webm' : 'video-icon',

    'm4a' : 'music-icon',
    'mp3' : 'music-icon',
    'aac' : 'music-icon',
    'caf' : 'music-icon',
    'wma' : 'music-icon',
    'ra' : 'music-icon',
    'wav' : 'music-icon',

    'psd': 'psd-icon',
    'ai' : 'ai-icon',
    'indd' : 'indd-icon'
  }
  if(extensionMap.hasOwnProperty(ext)){
    this.fileProgressElement.childNodes[3].className = 'inline-icon ' + extensionMap[ext];
  }
  else{
    this.fileProgressElement.childNodes[3].className = 'inline-icon default-icon';
  }
}

FileProgress.prototype.setTimer = function (timer) {
	this.fileProgressElement["FP_TIMER"] = timer;
};

FileProgress.prototype.getTimer = function (timer) {
	return this.fileProgressElement["FP_TIMER"] || null;
};

FileProgress.prototype.reset = function () {
	this.fileProgressElement.className = "progressContainer";

	this.fileProgressElement.childNodes[5].innerHTML = "&nbsp;";
	this.fileProgressElement.childNodes[5].className = "progressBarStatus";

	this.fileProgressElement.childNodes[6].className = "progressBarInProgress";
	this.fileProgressElement.childNodes[6].style.width = "0%";

	this.appear();
};

FileProgress.prototype.setProgress = function (percentage) {
	this.fileProgressElement.className = "progressContainer orange";
	this.fileProgressElement.childNodes[6].className = "progressBarInProgress";
	this.fileProgressElement.childNodes[6].style.width = percentage + "%";

	this.appear();
};

FileProgress.prototype.setComplete = function () {
	this.fileProgressElement.className = "progressContainer green";
	this.fileProgressElement.childNodes[6].className = "progressBarComplete";
	this.fileProgressElement.childNodes[6].style.width = "";

	this.fileProgressElement.childNodes[1].style.display = "block";
	var progressElement = this;

	this.fileProgressElement.childNodes[1].onclick = function () {
	    var popup = new Popups.Popup();
	    popup.extraClass = 'save-changes-popup';

	    var body = Drupal.t('Are you sure you want to remove this attachment?');
      var options = {'hideActive':false};
	    var buttons = {
        'popup_submit': {
          title: Drupal.t('Remove'), func: function() {
            var fid = progressElement.fileProgressElement.childNodes[4].id.replace(/^file-/i,'');
            removeFileFromUploads(fid);
            progressElement.setDeleted();
            progressElement.setStatus(Drupal.t('Removed'));
            progressElement.fileProgressElement.childNodes[1].style.display = "none";
            sPopupsResizeCenter();
            popup.close();
            $('#' + progressElement.fileProgressID).trigger('removed');
            // this is a recording, remove the disabled class from record button
            if( !fid.match(/^[0-9]+$/) ) {
              $('#recording-selector a').removeClass('disabled');
            }
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

FileProgress.prototype.setError = function () {
	this.fileProgressElement.className = "progressContainer red";
	this.fileProgressElement.childNodes[6].className = "progressBarError";
	this.fileProgressElement.childNodes[6].style.width = "";
};

FileProgress.prototype.setCancelled = function () {
	this.fileProgressElement.className = "progressContainer";
	this.fileProgressElement.childNodes[6].className = "progressBarError";
	this.fileProgressElement.childNodes[6].style.width = "";

	var oSelf = this;
	this.setTimer(setTimeout(function () {
		oSelf.disappear();
    sPopupsResizeCenter();
	}, 2000));
};

FileProgress.prototype.setDeleted = function () {
	this.fileProgressElement.className = "progressContainer";
	this.fileProgressElement.childNodes[6].className = "progressBarError";
	this.fileProgressElement.childNodes[6].style.width = "";

	var oSelf = this;
  oSelf.disappear();
};

FileProgress.prototype.setStatus = function (status) {
	this.fileProgressElement.childNodes[5].innerHTML = status;
};

// Show/Hide the cancel button
FileProgress.prototype.toggleCancel = function (show) {
	this.fileProgressElement.childNodes[0].style.display = show ? "block" : "none";
};

FileProgress.prototype.appear = function () {
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

// Disappear the FileProgress box.
FileProgress.prototype.disappear = function () {
  this.fileProgressWrapper.style.display = "none";
  this.fileProgressWrapper.style.opacity = 0;
  this.fileProgressWrapper.style.height = "0px";
};

function sFileProgressResizePopup(){
  if(typeof(Popups) == 'undefined') {
    return;
  }
	var popup = Popups.activePopup();
	if(popup != null){
		Popups.resizeAndCenter(popup);
	}
}
