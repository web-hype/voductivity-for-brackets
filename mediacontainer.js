/*global define, $, document, brackets */

define(function (require, exports, module) {
    
    "use strict";
    
    let EventDispatcher = brackets.getModule("utils/EventDispatcher"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        extPreferences = PreferencesManager.getExtensionPrefs('voductivity');
    let DisplayModePrefKey = 'displayMode';
    let ContainerID = 'voductivity-media-container';
    let ContainerSelector = '#' + ContainerID;
    let MediaSeletor = ContainerSelector + ' .media';
    let HandleSelector = ContainerSelector + ' .handle';
    let FloatingClass = 'pip';
    let ResizeClass = 'resize';
    let ActiveClass = 'active';
    let TransformingClass = 'transforming';
    
    let PreferenceKey = {
        displayMode: 'displayMode',
        floatingTransform: 'floatingTransform'
    }
    
    let DisplayMode = {
        background: 'bkg',
        floating: 'flt'
    }
    
    var _instance, _activeResizer, _x, _y;
    
    function MediaContainer() {
        
        this.element = $(document.createElement('div'))
                        .attr('id', ContainerID)[0];
        
        let $topleftResizer = $(document.createElement('div'))
                                .addClass('handle tl')
                                .mousedown(startResize);
        $(this.element).append($topleftResizer[0]);
        
        if (!extPreferences.get(PreferenceKey.floatingTransform)) {
            extPreferences.set(PreferenceKey.displayMode, 'object', {});
        }
        
        if (!extPreferences.get(PreferenceKey.displayMode)) {
            extPreferences.set(PreferenceKey.displayMode, 'string', DisplayMode.background);
        }
        
        switch (extPreferences.get(PreferenceKey.displayMode)) {
            case DisplayMode.floating:
                makeFloating(this.element);
                break;
            case DisplayMode.background:
            default:
                makeBackground(this.element);
                break;
        }
    }
    EventDispatcher.makeEventDispatcher(MediaContainer.prototype);
    
    
    function updateDisplayModePref(mode) {
        extPreferences.set(PreferenceKey.displayMode, mode);
        extPreferences.save();
    }
    
    function updateFloatingTransformPref() {
        let $container = $(ContainerSelector);
        
        if (!$container.hasClass(FloatingClass)) return;
        
        let transform = {
            offset: $container.offset(),
            width: $container.css('width'),
            height: $container.css('height')
        }
        
        extPreferences.set(PreferenceKey.floatingTransform, transform);
        extPreferences.save();
    }
    
    function makeFloating(container) {
        let $container = $(container);
        $container.addClass(FloatingClass);
        
        let transform = extPreferences.get(PreferenceKey.floatingTransform);
        
        if (!transform) return;
        
        if (!!transform.offset) {
            $container.offset(transform.offset);
        }
        
        if (!!transform.width) {
            $container.width(transform.width);
        }
        
        if (!!transform.height) {
            $container.height(transform.height);
        }
    }
    
    function makeBackground(container) {
        let $container = $(container);
        $container.removeClass(FloatingClass)
            .offset({top: 0, left: 0})
            .width("100%")
            .height("100%");
    }
    
    function handleResize(ev) {
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        
        let $resizer = $(_activeResizer);
        let $container = $(ContainerSelector);
        var adjustPosition = true,
            delta, updatedVal, minVal;
        
        if ($resizer.hasClass('tl') || $resizer.hasClass('bl')) {
            adjustPosition = true;
            
            if (ev.altKey) {
                delta = _x - ev.clientX;
                updatedVal = $container.width() + delta;
                $container.width(updatedVal + 'px');
                
                minVal = parseFloat($container.css('min-width'));
                adjustPosition = updatedVal > minVal;
            }
            
            if (adjustPosition) {
                $container.offset({left: ev.clientX});
            }
            
            _x = ev.clientX;
        }
        
        if ($resizer.hasClass('tl') || $resizer.hasClass('tr')) {
            adjustPosition = true;
            
            if (ev.altKey) {
                delta = _y - ev.clientY;
                updatedVal = $container.height() + delta;
                $container.height(updatedVal + 'px');
                
                minVal = parseFloat($container.css('min-height'));
                adjustPosition = updatedVal > minVal;
            }
            
            if (adjustPosition) {
                $container.offset({top: ev.clientY});
            }
            
            _y = ev.clientY;
        }
    }
    
    function endResize() {
        _activeResizer = null;
        $('body').off('mousemove');
        
        $(HandleSelector).removeClass(ActiveClass);
        $(ContainerSelector).removeClass(TransformingClass);
        
        updateFloatingTransformPref();
    }
    
    function startResize(ev) {
        _activeResizer = ev.target;
        _x = ev.clientX;
        _y = ev.clientY;
        $('body').mousemove(handleResize)
            .mouseup(endResize);
        
        $(HandleSelector).addClass(ActiveClass);
        $(ContainerSelector).addClass(TransformingClass);
    }
    
    MediaContainer.prototype.display = function (element) {
        $(MediaSeletor).remove();
        $(ContainerSelector).prepend(element);
    }
    
    MediaContainer.prototype.makeFloating = function () {
        makeFloating(this.element);
        updateDisplayModePref(DisplayMode.floating);
    }
    
    MediaContainer.prototype.makeBackground = function () {
        makeBackground(this.element);
        updateDisplayModePref(DisplayMode.background);
    }
    
    MediaContainer.prototype.currentDisplayMode = function () {
        let displayMode = extPreferences.get(PreferenceKey.displayMode);
        if (displayMode === DisplayMode.floating) {
            return DisplayMode.floating;
        }
        
        return DisplayMode.background;
    }
    
    $(window).keydown(ev => {
        if (ev.altKey) {
            $(HandleSelector).addClass(ResizeClass);
        }
    }).keyup(ev => {
        if (ev.keyCode == 18) {
            $(HandleSelector).removeClass(ResizeClass);
        }
    });
    
    function sharedInstance() {
        if (!_instance) {
            _instance = new MediaContainer();
        }
        
        return _instance;
    }
    
    exports.instance = sharedInstance();
    exports.DisplayMode = DisplayMode
});