/*
 * The intention of this file is to have common angular/ui patterns always available to other one of 
 * angular template files. For instance, if you are building an Angular template that needs an enrollment 
 * dropdown, instead of having to go back to the server and remember to include the necessary enrollment chooser
 * js files, all you need to do is go 
 * 
 * output += Drupal.theme.s_common_enrollment_chooser('course', 12345);
 */

Drupal.theme.s_common_enrollment_chooser = function(realm, realm_id, default_enrollment_id){
  var output = '';
  output += '<div class="s-enrollment-chooser" realm="' + realm + '" realm-id="' + realm_id + '" default-id="' + default_enrollment_id + '">';
    output += '<input class="enrollment-chooser-pl" style="width:200px">';
  output += '</div>';
  return output;
}