// Due to current testing limitations, the test for this function
// will not run automatically with each build.
// If changes are made, manually run the test and update as necessary.
// See sUpdateImmersiveReader.spec.js within bundle/common for details.
function sUpdateImmersiveReaderBeforeLaunch(showMoreLinkId) {
  var element = document.getElementById(showMoreLinkId);

  return new Promise(function (resolve, reject) {
    if (!element) {
      return resolve();
    }

    var type = sUpdateGetShowMoreLinkAjaxCompleteEventType(showMoreLinkId);
    var listener = function (event) {
      if (event.detail.success) {
        return resolve();
      } else {
        return reject();
      }
    };
    var options = { once: true };
    window.addEventListener(type, listener, options);

    element.click();
  });
}

function sUpdateImmersiveReaderGetCustomContent(contentSelectorPath, pollTranslation) {
  // constants:
  var selectorPathConfig = {
    body: ".update-sentence-inner > .update-body",
    pollContainer: ".s-polls-poll-option-wrapper",
    pollTitle: ".s-poll-option-title",
    pollVote: ".s-polls-number-of-votes"
  };

  // utils:
  var querySelectAndGetHtml = function (parentElement, selectorPath) {
    var selectedElement = parentElement.querySelector(selectorPath);
    return selectedElement ? selectedElement.innerHTML : "";
  };

  var getData = function (contentElement) {
    if (!contentElement) {
      return null;
    }
    var body = querySelectAndGetHtml(contentElement, selectorPathConfig.body);
    var pollElements = contentElement.querySelectorAll(selectorPathConfig.pollContainer);

    var polls = Array.from(pollElements).map(function (pollElement) {
      return {
        pollTitle: querySelectAndGetHtml(pollElement, selectorPathConfig.pollTitle).trim(),
        pollVote: querySelectAndGetHtml(pollElement, selectorPathConfig.pollVote)
      };
    });

    return {
      body: body,
      polls: polls
    };

  };
  var getFormattedResult = function (data) {
    if (!data) {
      return null;
    }
    var formattedPolls = data.polls && data.polls.length > 0 ? data.polls.reduce(function (result, poll) {
      result += "<br /> -" + poll.pollTitle;
      if (poll.pollVote) {
        result += " (" + poll.pollVote + ")";
      }
      return result;
    }, pollTranslation) : "";

    var result = data.body;
    if (formattedPolls && formattedPolls.length > 0) {
      result += formattedPolls + "<br />"
    }
    return result;
  }
  var contentElement = document.querySelector(contentSelectorPath);
  var formattedResult = getFormattedResult(getData(contentElement));
  return formattedResult || (contentElement ? contentElement.innerHTML : "");
}
