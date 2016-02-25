var MobileDragAndDropPolyfill;
(function (MobileDragAndDropPolyfill) {
    var _options = {
        threshold: 50,
        velocity: 10
    };
    var _scrollIntention = {
        x: 0,
        y: 0
    };
    var _scrollAnimationFrameId;
    function SetOptions(options) {
        Object.keys(options).forEach(function (key) {
            _options[key] = options[key];
        });
    }
    MobileDragAndDropPolyfill.SetOptions = SetOptions;
    function HandleDragImageTranslateOverride(currentCoordinates, hoveredElement, translateDragImageFn) {
        var performScrollAnimation = updateScrollIntention(currentCoordinates, _options.threshold, _scrollIntention);
        if (performScrollAnimation) {
            scheduleScrollAnimation(currentCoordinates, hoveredElement, translateDragImageFn);
        }
        else if (!!_scrollAnimationFrameId) {
            window.cancelAnimationFrame(_scrollAnimationFrameId);
            _scrollAnimationFrameId = undefined;
        }
        return performScrollAnimation;
    }
    MobileDragAndDropPolyfill.HandleDragImageTranslateOverride = HandleDragImageTranslateOverride;
    function scheduleScrollAnimation(currentCoordinates, hoveredElement, translateDragImageFn) {
        if (!!_scrollAnimationFrameId) {
            return;
        }
        _scrollAnimationFrameId = window.requestAnimationFrame(function () {
            scrollAnimation(currentCoordinates, hoveredElement, translateDragImageFn);
        });
    }
    function scrollAnimation(currentCoordinates, hoveredElement, translateDragImageFn) {
        var scrollDiffX = 0, scrollDiffY = 0;
        if (_scrollIntention.x) {
            scrollDiffX = _scrollIntention.x * _options.velocity;
            getSetScroll(0, scrollDiffX);
            currentCoordinates.x += scrollDiffX;
        }
        if (_scrollIntention.y) {
            scrollDiffY = _scrollIntention.y * _options.velocity;
            getSetScroll(1, scrollDiffY);
            currentCoordinates.y += scrollDiffY;
        }
        translateDragImageFn(scrollDiffX, scrollDiffY);
        _scrollAnimationFrameId = undefined;
        if (updateScrollIntention(currentCoordinates, _options.threshold, _scrollIntention)) {
            scheduleScrollAnimation(currentCoordinates, hoveredElement, translateDragImageFn);
        }
    }
    function determineScrollIntention(currentCoordinate, clientSize, threshold) {
        if (currentCoordinate < threshold) {
            return -1;
        }
        else if (clientSize - currentCoordinate < threshold) {
            return 1;
        }
        return 0;
    }
    function updateScrollIntention(currentCoordinates, threshold, scrollIntention) {
        if (!currentCoordinates) {
            return false;
        }
        scrollIntention.x = determineScrollIntention(currentCoordinates.x, window.innerWidth, threshold);
        scrollIntention.y = determineScrollIntention(currentCoordinates.y, window.innerHeight, threshold);
        if (scrollIntention.x && isScrollEndReached(0, scrollIntention.x)) {
            scrollIntention.x = 0;
        }
        if (scrollIntention.y && isScrollEndReached(1, scrollIntention.y)) {
            scrollIntention.y = 0;
        }
        return !!(scrollIntention.x || scrollIntention.y);
    }
    function isScrollEndReached(axis, scrollIntention) {
        var scrollSizeProp = "scrollHeight", clientSizeProp = "innerHeight", scroll = getSetScroll(axis);
        if (axis === 0) {
            scrollSizeProp = "scrollWidth";
            clientSizeProp = "innerWidth";
        }
        if (scrollIntention > 0) {
            var scrollSize = document.body[scrollSizeProp] || document.documentElement[scrollSizeProp];
            var clientSize = window[clientSizeProp];
            return (scroll + clientSize) >= (scrollSize);
        }
        else if (scrollIntention < 0) {
            return (scroll <= 0);
        }
        return true;
    }
    function getSetScroll(axis, scroll) {
        var prop = (axis === 0) ? "scrollLeft" : "scrollTop";
        if (arguments.length === 1) {
            return document.body[prop] || document.documentElement[prop];
        }
        document.documentElement[prop] += scroll;
        document.body[prop] += scroll;
    }
})(MobileDragAndDropPolyfill || (MobileDragAndDropPolyfill = {}));
//# sourceMappingURL=mobile-drag-and-drop-polyfill-scroll-behaviour.js.map