var DragDropPolyfill;
(function (DragDropPolyfill) {
    var _options = {
        threshold: 75,
        velocityFn: function (velocity, threshold) {
            var multiplier = velocity / threshold;
            var easeInCubic = multiplier * multiplier * multiplier;
            return easeInCubic * threshold;
        }
    };
    var _scrollIntentions = {
        horizontal: 0,
        vertical: 0
    };
    var _dynamicVelocity = {
        x: 0,
        y: 0
    };
    var _scrollAnimationFrameId;
    var _currentCoordinates;
    var _hoveredElement;
    var _scrollableParent;
    var _translateDragImageFn;
    function handleDragImageTranslateOverride(event, currentCoordinates, hoveredElement, translateDragImageFn) {
        _currentCoordinates = currentCoordinates;
        _translateDragImageFn = translateDragImageFn;
        if (_hoveredElement !== hoveredElement) {
            _hoveredElement = hoveredElement;
            _scrollableParent = findScrollableParent(_hoveredElement);
        }
        var performScrollAnimation = updateScrollIntentions(_currentCoordinates, _scrollableParent, _options.threshold, _scrollIntentions, _dynamicVelocity);
        if (performScrollAnimation) {
            scheduleScrollAnimation();
        }
        else if (!!_scrollAnimationFrameId) {
            window.cancelAnimationFrame(_scrollAnimationFrameId);
            _scrollAnimationFrameId = null;
        }
    }
    function scheduleScrollAnimation() {
        if (!!_scrollAnimationFrameId) {
            return;
        }
        _scrollAnimationFrameId = window.requestAnimationFrame(scrollAnimation);
    }
    function scrollAnimation() {
        var scrollDiffX = 0, scrollDiffY = 0, isTopLevel = isTopLevelEl(_scrollableParent);
        if (_scrollIntentions.horizontal !== 0) {
            scrollDiffX = Math.round(_options.velocityFn(_dynamicVelocity.x, _options.threshold) * _scrollIntentions.horizontal);
            getSetElementScroll(_scrollableParent, 0, scrollDiffX);
        }
        if (_scrollIntentions.vertical !== 0) {
            scrollDiffY = Math.round(_options.velocityFn(_dynamicVelocity.y, _options.threshold) * _scrollIntentions.vertical);
            getSetElementScroll(_scrollableParent, 1, scrollDiffY);
        }
        if (isTopLevel) {
            _translateDragImageFn(scrollDiffX, scrollDiffY);
        }
        else {
            _translateDragImageFn(0, 0);
        }
        _scrollAnimationFrameId = null;
        if (updateScrollIntentions(_currentCoordinates, _scrollableParent, _options.threshold, _scrollIntentions, _dynamicVelocity)) {
            scheduleScrollAnimation();
        }
    }
    function updateScrollIntentions(currentCoordinates, scrollableParent, threshold, scrollIntentions, dynamicVelocity) {
        if (!currentCoordinates || !scrollableParent) {
            return false;
        }
        var scrollableParentBounds = {
            x: getElementViewportOffset(scrollableParent, 0),
            y: getElementViewportOffset(scrollableParent, 1),
            width: getElementViewportSize(scrollableParent, 0),
            height: getElementViewportSize(scrollableParent, 1),
            scrollX: getSetElementScroll(scrollableParent, 0),
            scrollY: getSetElementScroll(scrollableParent, 1),
            scrollWidth: scrollableParent.scrollWidth,
            scrollHeight: scrollableParent.scrollHeight
        };
        var currentCoordinatesOffset = {
            x: currentCoordinates.x - scrollableParentBounds.x,
            y: currentCoordinates.y - scrollableParentBounds.y
        };
        scrollIntentions.horizontal = determineScrollIntention(currentCoordinatesOffset.x, scrollableParentBounds.width, threshold);
        scrollIntentions.vertical = determineScrollIntention(currentCoordinatesOffset.y, scrollableParentBounds.height, threshold);
        if (scrollIntentions.horizontal && isScrollEndReached(0, scrollIntentions.horizontal, scrollableParentBounds)) {
            scrollIntentions.horizontal = 0;
        }
        else if (scrollIntentions.horizontal) {
            dynamicVelocity.x = determineDynamicVelocity(scrollIntentions.horizontal, currentCoordinatesOffset.x, scrollableParentBounds.width, threshold);
        }
        if (scrollIntentions.vertical && isScrollEndReached(1, scrollIntentions.vertical, scrollableParentBounds)) {
            scrollIntentions.vertical = 0;
        }
        else if (scrollIntentions.vertical) {
            dynamicVelocity.y = determineDynamicVelocity(scrollIntentions.vertical, currentCoordinatesOffset.y, scrollableParentBounds.height, threshold);
        }
        return !!(scrollIntentions.horizontal || scrollIntentions.vertical);
    }
    function isTopLevelEl(el) {
        return (el === document.body || el === document.documentElement);
    }
    function getElementViewportOffset(el, axis) {
        var offset;
        if (isTopLevelEl(el)) {
            offset = (axis === 0) ? el.clientLeft : el.clientTop;
        }
        else {
            var bounds = el.getBoundingClientRect();
            offset = (axis === 0) ? bounds.left : bounds.top;
        }
        return offset;
    }
    function getElementViewportSize(el, axis) {
        var size;
        if (isTopLevelEl(el)) {
            size = (axis === 0) ? window.innerWidth : window.innerHeight;
        }
        else {
            size = (axis === 0) ? el.clientWidth : el.clientHeight;
        }
        return size;
    }
    function getSetElementScroll(el, axis, scroll) {
        var prop = (axis === 0) ? "scrollLeft" : "scrollTop";
        var isTopLevel = isTopLevelEl(el);
        if (arguments.length === 2) {
            if (isTopLevel) {
                return document.body[prop] || document.documentElement[prop];
            }
            return el[prop];
        }
        if (isTopLevel) {
            document.documentElement[prop] += scroll;
            document.body[prop] += scroll;
        }
        else {
            el[prop] += scroll;
        }
    }
    function isScrollable(el) {
        var cs = getComputedStyle(el);
        if (el.scrollHeight > el.clientHeight && (cs.overflowY === "scroll" || cs.overflowY === "auto")) {
            return true;
        }
        if (el.scrollWidth > el.clientWidth && (cs.overflowX === "scroll" || cs.overflowX === "auto")) {
            return true;
        }
        return false;
    }
    function findScrollableParent(el) {
        do {
            if (!el) {
                return undefined;
            }
            if (isScrollable(el)) {
                return el;
            }
            if (el === document.documentElement) {
                return null;
            }
        } while (el = el.parentNode);
        return null;
    }
    function determineScrollIntention(currentCoordinate, size, threshold) {
        if (currentCoordinate < threshold) {
            return -1;
        }
        else if (size - currentCoordinate < threshold) {
            return 1;
        }
        return 0;
    }
    function determineDynamicVelocity(scrollIntention, currentCoordinate, size, threshold) {
        if (scrollIntention === -1) {
            return Math.abs(currentCoordinate - threshold);
        }
        else if (scrollIntention === 1) {
            return Math.abs(size - currentCoordinate - threshold);
        }
        return 0;
    }
    function isScrollEndReached(axis, scrollIntention, scrollBounds) {
        var currentScrollOffset = (axis === 0) ? (scrollBounds.scrollX) : (scrollBounds.scrollY);
        if (scrollIntention === 1) {
            var maxScrollOffset = (axis === 0) ? (scrollBounds.scrollWidth - scrollBounds.width) : (scrollBounds.scrollHeight -
                scrollBounds.height);
            return currentScrollOffset >= maxScrollOffset;
        }
        else if (scrollIntention === -1) {
            return (currentScrollOffset <= 0);
        }
        return true;
    }
    function SetOptions(options) {
        Object.keys(options).forEach(function (key) {
            _options[key] = options[key];
        });
    }
    DragDropPolyfill.SetOptions = SetOptions;
    DragDropPolyfill.HandleDragImageTranslateOverride = handleDragImageTranslateOverride;
})(DragDropPolyfill || (DragDropPolyfill = {}));
//# sourceMappingURL=drag-drop-polyfill-scroll-behaviour.js.map