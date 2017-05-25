(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.DragDropPolyfill = global.DragDropPolyfill || {})));
}(this, (function (exports) { 'use strict';

    var ScrollIntention;
    (function (ScrollIntention) {
        ScrollIntention[ScrollIntention["NONE"] = 0] = "NONE";
        ScrollIntention[ScrollIntention["LEFT_OR_TOP"] = -1] = "LEFT_OR_TOP";
        ScrollIntention[ScrollIntention["RIGHT_OR_BOTTOM"] = 1] = "RIGHT_OR_BOTTOM";
    })(ScrollIntention || (ScrollIntention = {}));
    var ScrollAxis;
    (function (ScrollAxis) {
        ScrollAxis[ScrollAxis["HORIZONTAL"] = 0] = "HORIZONTAL";
        ScrollAxis[ScrollAxis["VERTICAL"] = 1] = "VERTICAL";
    })(ScrollAxis || (ScrollAxis = {}));
    function isTopLevelEl(el) {
        return (el === document.body || el === document.documentElement);
    }
    function getElementViewportOffset(el, axis) {
        var offset;
        if (isTopLevelEl(el)) {
            offset = (axis === ScrollAxis.HORIZONTAL) ? el.clientLeft : el.clientTop;
        }
        else {
            var bounds = el.getBoundingClientRect();
            offset = (axis === ScrollAxis.HORIZONTAL) ? bounds.left : bounds.top;
        }
        return offset;
    }
    function getElementViewportSize(el, axis) {
        var size;
        if (isTopLevelEl(el)) {
            size = (axis === ScrollAxis.HORIZONTAL) ? window.innerWidth : window.innerHeight;
        }
        else {
            size = (axis === ScrollAxis.HORIZONTAL) ? el.clientWidth : el.clientHeight;
        }
        return size;
    }
    function getSetElementScroll(el, axis, scroll) {
        var prop = (axis === ScrollAxis.HORIZONTAL) ? "scrollLeft" : "scrollTop";
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
            return ScrollIntention.LEFT_OR_TOP;
        }
        else if (size - currentCoordinate < threshold) {
            return ScrollIntention.RIGHT_OR_BOTTOM;
        }
        return ScrollIntention.NONE;
    }
    function determineDynamicVelocity(scrollIntention, currentCoordinate, size, threshold) {
        if (scrollIntention === ScrollIntention.LEFT_OR_TOP) {
            return Math.abs(currentCoordinate - threshold);
        }
        else if (scrollIntention === ScrollIntention.RIGHT_OR_BOTTOM) {
            return Math.abs(size - currentCoordinate - threshold);
        }
        return 0;
    }
    function isScrollEndReached(axis, scrollIntention, scrollBounds) {
        var currentScrollOffset = (axis === ScrollAxis.HORIZONTAL) ? (scrollBounds.scrollX) : (scrollBounds.scrollY);
        if (scrollIntention === ScrollIntention.RIGHT_OR_BOTTOM) {
            var maxScrollOffset = (axis === ScrollAxis.HORIZONTAL) ? (scrollBounds.scrollWidth - scrollBounds.width) : (scrollBounds.scrollHeight -
                scrollBounds.height);
            return currentScrollOffset >= maxScrollOffset;
        }
        else if (scrollIntention === ScrollIntention.LEFT_OR_TOP) {
            return (currentScrollOffset <= 0);
        }
        return true;
    }
    var _options = {
        threshold: 75,
        velocityFn: function (velocity, threshold) {
            var multiplier = velocity / threshold;
            var easeInCubic = multiplier * multiplier * multiplier;
            return easeInCubic * threshold;
        }
    };
    var _scrollIntentions = {
        horizontal: ScrollIntention.NONE,
        vertical: ScrollIntention.NONE
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
        if (_scrollIntentions.horizontal !== ScrollIntention.NONE) {
            scrollDiffX = Math.round(_options.velocityFn(_dynamicVelocity.x, _options.threshold) * _scrollIntentions.horizontal);
            getSetElementScroll(_scrollableParent, ScrollAxis.HORIZONTAL, scrollDiffX);
        }
        if (_scrollIntentions.vertical !== ScrollIntention.NONE) {
            scrollDiffY = Math.round(_options.velocityFn(_dynamicVelocity.y, _options.threshold) * _scrollIntentions.vertical);
            getSetElementScroll(_scrollableParent, ScrollAxis.VERTICAL, scrollDiffY);
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
            x: getElementViewportOffset(scrollableParent, ScrollAxis.HORIZONTAL),
            y: getElementViewportOffset(scrollableParent, ScrollAxis.VERTICAL),
            width: getElementViewportSize(scrollableParent, ScrollAxis.HORIZONTAL),
            height: getElementViewportSize(scrollableParent, ScrollAxis.VERTICAL),
            scrollX: getSetElementScroll(scrollableParent, ScrollAxis.HORIZONTAL),
            scrollY: getSetElementScroll(scrollableParent, ScrollAxis.VERTICAL),
            scrollWidth: scrollableParent.scrollWidth,
            scrollHeight: scrollableParent.scrollHeight
        };
        var currentCoordinatesOffset = {
            x: currentCoordinates.x - scrollableParentBounds.x,
            y: currentCoordinates.y - scrollableParentBounds.y
        };
        scrollIntentions.horizontal = determineScrollIntention(currentCoordinatesOffset.x, scrollableParentBounds.width, threshold);
        scrollIntentions.vertical = determineScrollIntention(currentCoordinatesOffset.y, scrollableParentBounds.height, threshold);
        if (scrollIntentions.horizontal && isScrollEndReached(ScrollAxis.HORIZONTAL, scrollIntentions.horizontal, scrollableParentBounds)) {
            scrollIntentions.horizontal = ScrollIntention.NONE;
        }
        else if (scrollIntentions.horizontal) {
            dynamicVelocity.x = determineDynamicVelocity(scrollIntentions.horizontal, currentCoordinatesOffset.x, scrollableParentBounds.width, threshold);
        }
        if (scrollIntentions.vertical && isScrollEndReached(ScrollAxis.VERTICAL, scrollIntentions.vertical, scrollableParentBounds)) {
            scrollIntentions.vertical = ScrollIntention.NONE;
        }
        else if (scrollIntentions.vertical) {
            dynamicVelocity.y = determineDynamicVelocity(scrollIntentions.vertical, currentCoordinatesOffset.y, scrollableParentBounds.height, threshold);
        }
        return !!(scrollIntentions.horizontal || scrollIntentions.vertical);
    }
    var scrollBehaviourDragImageTranslateOverride = handleDragImageTranslateOverride;

    exports.scrollBehaviourDragImageTranslateOverride = scrollBehaviourDragImageTranslateOverride;

    Object.defineProperty(exports, '__esModule', { value: true });

})));

//# sourceMappingURL=drag-drop-polyfill-scroll-behaviour.js.map