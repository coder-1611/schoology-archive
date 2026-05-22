/**
 * This is necessary in booting up the baseURL of the tinyMCE object.
 * It normally looks up all script tags to determine the base url to fetch extra files from.
 * This does not work well when using a bundle since the path of the bundle will differ greatly from the path of the tinyMCE core files.
 */
window.tinyMCEPreInit = {
  suffix: '',
  base: window.location.protocol + '//' + window.location.host + '/sites/all/libraries/tinymce/jscripts/tiny_mce',
  query: ''
};
