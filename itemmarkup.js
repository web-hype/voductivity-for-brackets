/*global define, $, document, brackets */

define(function (require, exports, module) {
    
    "use strict";

    this.elementForItem = function(item, opts = {}) {
        
        let PlaylistItemType = require('./playlist').PlaylistItemType;
        
        let src = item.link,
            iframeTag = 'iframe';
        
        var tag, el;

        switch(item.type) {
            case PlaylistItemType.embed:
                el = $(src).find(iframeTag)
                    .addBack(iframeTag)
                    .addClass('voductivity media');
                
                if (!!opts.sandbox) {
                    el.attr('sandbox','allow-scripts');
                }
                
                break;
            case PlaylistItemType.video:
                var source = $(document.createElement('source')).attr('src', src);
                el = $(document.createElement('video'))
                    .addClass('voductivity media')
                    .append(source);
                
                if (!!opts.controls) {
                    el.attr('controls', '');
                }
                if (!!opts.preview) {
                    let previewSrc = $(source).attr('src') + '#t=,30';
                    $(source).attr('src', previewSrc);
                    
                    el.attr({
                        loop: '',
                        muted: ''
                    });
                    
                    opts['autoplay'] = true;
                }
                if (!!opts.autoplay) {
                    el.attr('autoplay', '');
                }
                
                break;
            case PlaylistItemType.image:
                tag = 'img'
                break;
            case PlaylistItemType.url:
            default:
                tag = 'iframe';
                break;
        }

        if (!el) {
            var el = $(document.createElement(tag))
                    .addClass('voductivity media')
                    .attr('src', src);
        }
        
        if ($(el).is('iframe')) {
            $(el).attr({
                width: "100%",
                height: "100%"
            });
        }

        return el[0];
    }
    
    exports = this;
});