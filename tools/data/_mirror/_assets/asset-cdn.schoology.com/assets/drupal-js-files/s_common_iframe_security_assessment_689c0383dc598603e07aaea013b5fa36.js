const LEARNOSITY_ASSESSMENT_SELECTOR = '#learnosity_assess .lrn_stimulus_content';
const IFRAME_VERIFICATION_ENDPOINT = '/iapi2/iframe-security/verify';
const CLASS_IFRAME_BLOCKED = 's-iframe-blocked';
const CLASS_IFRAME_BLOCKED_MESSAGE = 's-iframe-blocked-message';
const CLASS_IFRAME_URL_CONTAINER = 's-iframe-url-container';
const CLASS_IFRAME_URL_LABEL = 's-iframe-url-label';
const CLASS_IFRAME_URL = 's-iframe-url';
const CLASS_IFRAME_BUTTON_CONTAINER = 's-iframe-button-container';
const CLASS_IFRAME_ALLOW_BUTTON = 's-iframe-allow-button';
const CLASS_IFRAME_LOADER = 's-iframe-verification-loader';
const LOADER_IMAGE_SRC = '/sites/all/themes/schoology_theme/images/ajax-loader.gif';
const consentedSrcs = new Set();
const verificationCache = new Map();

/**
 * Checks if iframes within Learnosity assessments are from recognized sources.
 * Collects all iframe URLs, verifies them in a single batch API call, then handles each iframe.
 */
async function verifyStimulusIframes(doc = document) {
  const stimulusElements = doc.querySelectorAll(LEARNOSITY_ASSESSMENT_SELECTOR);

  // Collect all pending iframes and their srcs
  const pendingIframes = [];
  [...stimulusElements].forEach((stimulusElement) => {
    stimulusElement.querySelectorAll('iframe').forEach((iframe) => {
      if (iframe.dataset.sgyIframeVerificationStarted === 'true' || iframe.dataset.sgyIframeUserConsented === 'true') {
        return;
      }
      const src = (iframe.getAttribute('src') || '').trim();
      if (src) {
        iframe.style.display = 'none';
        const loaderDiv = doc.createElement('div');
        loaderDiv.className = CLASS_IFRAME_LOADER;
        const loaderImg = doc.createElement('img');
        loaderImg.src = LOADER_IMAGE_SRC;
        loaderImg.alt = '';
        loaderDiv.appendChild(loaderImg);
        iframe.insertAdjacentElement('afterend', loaderDiv);
        pendingIframes.push({ iframe, src });
      }
    });
  });

  if (pendingIframes.length === 0) {
    return;
  }

  // Determine which URLs are not already cached or consented
  const urlsToFetch = [...new Set(
    pendingIframes
      .map(({ src }) => src)
      .filter((src) => !consentedSrcs.has(src) && !verificationCache.has(src)),
  )];

  // Fetch all uncached URLs in a single batch API call
  if (urlsToFetch.length > 0) {
    const batchResults = await verifyEndpointUrls(urlsToFetch);
    Object.entries(batchResults).forEach(([url, verified]) => verificationCache.set(url, verified));
  }

  // Handle each iframe using the pre-populated cache
  pendingIframes.forEach(({ iframe, src }) => verifyAndHandleIframe(iframe, src, doc));
}

/**
 * Handles a single iframe based on pre-fetched verification results in the cache.
 *
 * @param {HTMLIFrameElement} iframe - The iframe element to handle.
 * @param {string} src - The source URL of the iframe.
 * @param {Document} doc - The document context used to create DOM elements for the warning UI.
 */
function verifyAndHandleIframe(iframe, src, doc) {
  if (!iframe || iframe.dataset.sgyIframeVerificationStarted === 'true' || iframe.dataset.sgyIframeUserConsented === 'true') {
    return;
  }

  if (consentedSrcs.has(src)) {
    iframe.dataset.sgyIframeUserConsented = 'true';
    applySandboxAttributes(iframe);
    return;
  }

  iframe.dataset.sgyIframeVerificationStarted = 'true';

  const isVerified = verificationCache.get(src) ?? false;
  if (isVerified) {
    applySandboxAttributes(iframe);
    return;
  }

  renderUnrecognizedIframeWarning(iframe, src, doc);
}

/**
 * Makes a single batch API call to verify multiple URLs against the iframe whitelist.
 *
 * @param {string[]} urls - The list of URLs to verify.
 * @returns {Promise<Object>} - A map of URL to verified boolean.
 */
async function verifyEndpointUrls(urls) {
  try {
    const queryString = urls.map((url) => `urls[]=${encodeURIComponent(url)}`).join('&');
    const result = await fetch(`${IFRAME_VERIFICATION_ENDPOINT}?${queryString}`);
    if (!result.ok) {
      return {};
    }
    const data = await result.json();
    return (data && data.data && data.data.results) ? data.data.results : {};
  } catch (e) {
    Sentry.captureException(e);
    return {};
  }
}

/**
 * Renders a warning message for an unrecognized iframe and provides an option for the user to allow it.
 *
 * @param {HTMLIFrameElement} iframe - The iframe element to render the warning for.
 * @param {string} src - The source URL of the iframe.
 * @returns {void}
 */
function renderUnrecognizedIframeWarning(iframe, src, doc) {
  if (!iframe || !iframe.parentNode) {
    return;
  }

  const t = window.Utils.i18n.t;

  const blockedDiv = doc.createElement('div');
  blockedDiv.className = CLASS_IFRAME_BLOCKED;
  blockedDiv.setAttribute('data-iframe-src', src);

  const message = doc.createElement('div');
  message.className = CLASS_IFRAME_BLOCKED_MESSAGE;
  const blockedMessage = doc.createElement('div');
  blockedMessage.appendChild(doc.createTextNode(t('core.iframe_blocked_message')));
  const blockedInstruction = doc.createElement('div');
  blockedInstruction.appendChild(doc.createTextNode(t('core.iframe_blocked_instruction')));
  message.appendChild(blockedMessage);
  message.appendChild(blockedInstruction);
  blockedDiv.appendChild(message);

  const urlContainer = doc.createElement('div');
  urlContainer.className = CLASS_IFRAME_URL_CONTAINER;

  const urlLabel = doc.createElement('div');
  urlLabel.className = CLASS_IFRAME_URL_LABEL;
  urlLabel.appendChild(doc.createTextNode(t('core.iframe_source_url_label')));

  const urlDisplay = doc.createElement('div');
  urlDisplay.className = CLASS_IFRAME_URL;
  urlDisplay.appendChild(doc.createTextNode(src));

  urlContainer.appendChild(urlLabel);
  urlContainer.appendChild(urlDisplay);
  blockedDiv.appendChild(urlContainer);

  const buttonContainer = doc.createElement('div');
  buttonContainer.className = CLASS_IFRAME_BUTTON_CONTAINER;

  const allowButton = doc.createElement('button');
  allowButton.className = CLASS_IFRAME_ALLOW_BUTTON;
  allowButton.type = 'button';
  allowButton.setAttribute('tabindex', '0');
  allowButton.setAttribute('role', 'button');
  allowButton.setAttribute('aria-label', `${t('core.allow_iframe_button')} - ${t('core.iframe_blocked_message')} ${t('core.iframe_blocked_instruction')}`);
  allowButton.appendChild(doc.createTextNode(t('core.allow_iframe_button')));
  allowButton.addEventListener('click', () => {
    if (blockedDiv.parentNode) {
      consentedSrcs.add(src);
      const parent = blockedDiv.parentNode;
      window.schoologyIframeSecurityAllow(allowButton);
      const allowedIframe = parent.querySelector('iframe.s-iframe-allowed');
      if (allowedIframe) {
        applySandboxAttributes(allowedIframe);
      }
    }
  });

  buttonContainer.appendChild(allowButton);
  blockedDiv.appendChild(buttonContainer);

  removeVerificationLoader(iframe);
  iframe.parentNode.replaceChild(blockedDiv, iframe);
}

/**
 * Removes the verification loader div that was inserted as the next sibling of an iframe.
 *
 * @param {HTMLIFrameElement} iframe - The iframe whose loader sibling should be removed.
 */
function removeVerificationLoader(iframe) {
  const loaderSibling = iframe.nextElementSibling;
  if (loaderSibling && loaderSibling.classList.contains(CLASS_IFRAME_LOADER)) {
    loaderSibling.remove();
  }
}

/**
 * Applies sandbox, referrerpolicy, and frameborder attributes to a verified iframe,
 * matching the protections applied by IframeSecurityBll::applySandboxAttributes().
 *
 * @param {HTMLIFrameElement} iframe - The verified iframe element to sandbox.
 */
function applySandboxAttributes(iframe) {
  removeVerificationLoader(iframe);
  iframe.style.display = '';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation');
  if (!iframe.hasAttribute('referrerpolicy')) {
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
  }
  if (!iframe.hasAttribute('frameborder')) {
    iframe.setAttribute('frameborder', '0');
  }
}

window['sgyVerifyStimulusIframes'] = verifyStimulusIframes;
