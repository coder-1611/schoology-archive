/**
 * @file
 * JavaScript for iframe security functionality.
 * 
 * Provides the schoologyIframeSecurityAllow function that allows users to
 * unblock blocked iframes by replacing the blocked message with the actual iframe.
 */

(function() {
    'use strict';

    if (typeof window.schoologyIframeSecurityAllow === "undefined") {
        window.schoologyIframeSecurityAllow = function(button) {
            var $button = jQuery(button);
            var $blockedDiv = $button.closest(".s-iframe-blocked");
            var iframeSrc = $blockedDiv.data("iframe-src");

            if (!iframeSrc) {
                return;
            }

            var $iframe = jQuery("<iframe>", {
                src: iframeSrc,
                frameborder: "0",
                allowfullscreen: "true",
                sandbox: "allow-scripts allow-same-origin"
            });
            $iframe.addClass("s-iframe-allowed");

            $blockedDiv.replaceWith($iframe);
        };
    }
})();

