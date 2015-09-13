var MobileDragAndDropPolyfill;
(function (MobileDragAndDropPolyfill) {
    var detectedFeatures;
    function detectFeatures() {
        var detectedFeatures = {
            draggable: ('draggable' in document.documentElement),
            dragEvents: ('ondragstart' in document.documentElement),
            touchEvents: ('ontouchstart' in document.documentElement),
            isBlinkEngine: !!(window.chrome) || /chrome/i.test(navigator.userAgent),
            userAgentNotSupportingNativeDnD: false,
            transitionEnd: ('WebkitTransition' in document.documentElement.style) ? 'webkitTransitionEnd' : 'transitionend'
        };
        detectedFeatures.userAgentNotSupportingNativeDnD = (/iPad|iPhone|iPod|Android/.test(navigator.userAgent)
            ||
                detectedFeatures.touchEvents && (detectedFeatures.isBlinkEngine));
        if (DEBUG) {
            Object.keys(detectedFeatures).forEach(function (key) {
                console.log("dnd-poly: detected feature '" + key + " = " + detectedFeatures[key] + "'");
            });
        }
        return detectedFeatures;
    }
    var config = {
        iterationInterval: 150,
        scrollThreshold: 50,
        scrollVelocity: 10
    };
    function Initialize(override) {
        detectedFeatures = detectFeatures();
        if (detectedFeatures.userAgentNotSupportingNativeDnD === false
            && detectedFeatures.draggable
            && detectedFeatures.dragEvents) {
            return;
        }
        if (override) {
            Object.keys(override).forEach(function (key) {
                config[key] = config[key];
            });
        }
        console.log("dnd-poly: Applying mobile drag and drop polyfill.");
        document.addEventListener("touchstart", onTouchstart);
    }
    MobileDragAndDropPolyfill.Initialize = Initialize;
    var activeDragOperation;
    function onTouchstart(e) {
        console.log("dnd-poly: global touchstart");
        if (activeDragOperation) {
            console.log("dnd-poly: drag operation already active");
            return;
        }
        var dragTarget = tryFindDraggableTarget(e);
        if (!dragTarget) {
            return;
        }
        e.preventDefault();
        try {
            activeDragOperation = new DragOperationController(config, dragTarget, e, dragOperationEnded);
        }
        catch (err) {
            dragOperationEnded(e, 3);
            throw err;
        }
    }
    function tryFindDraggableTarget(event) {
        //1. Determine what is being dragged, as follows:
        var el = event.target;
        do {
            if (el.draggable === false) {
                continue;
            }
            if (el.getAttribute && el.getAttribute("draggable") === "true") {
                return el;
            }
        } while ((el = el.parentNode) && el !== document.body);
    }
    function dragOperationEnded(event, state) {
        activeDragOperation = null;
        if (state === 0) {
            var target = event.target;
            var targetTagName = target.tagName;
            var mouseEventType;
            switch (targetTagName) {
                case "SELECT":
                    mouseEventType = "mousedown";
                    break;
                case "INPUT":
                case "TEXTAREA":
                    target.focus();
                default:
                    mouseEventType = "click";
            }
            console.log("dnd-poly: No movement on draggable. Dispatching " + mouseEventType + " on " + targetTagName + " ..");
            var defaultEvent = createMouseEventFromTouch(target, event, mouseEventType);
            target.dispatchEvent(defaultEvent);
        }
    }
    var ALLOWED_EFFECTS = ["none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all"];
    var DROP_EFFECTS = ["none", "copy", "move", "link"];
    var TRANSFORM_CSS_VENDOR_PREFIXES = ["", "-webkit-"];
    var CLASS_PREFIX = "dnd-poly-";
    var CLASS_DRAG_IMAGE = CLASS_PREFIX + "drag-image";
    var CLASS_DRAG_IMAGE_SNAPBACK = CLASS_PREFIX + "snapback";
    var CLASS_DRAG_OPERATION_ICON = CLASS_PREFIX + "icon";
    var DragOperationController = (function () {
        function DragOperationController(_config, _sourceNode, _initialEvent, _dragOperationEndedCb) {
            this._config = _config;
            this._sourceNode = _sourceNode;
            this._dragOperationEndedCb = _dragOperationEndedCb;
            this._dragOperationState = 0;
            this._immediateUserSelection = null;
            this._currentDropTarget = null;
            console.log("dnd-poly: setting up potential drag operation..");
            this._lastTouchEvent = _initialEvent;
            this._initialTouchId = _initialEvent.changedTouches[0].identifier;
            this._touchMoveHandler = this._onTouchMove.bind(this);
            this._touchEndOrCancelHandler = this._onTouchEndOrCancel.bind(this);
            document.addEventListener("touchmove", this._touchMoveHandler);
            document.addEventListener("touchend", this._touchEndOrCancelHandler);
            document.addEventListener("touchcancel", this._touchEndOrCancelHandler);
        }
        DragOperationController.prototype._setup = function () {
            var _this = this;
            console.log("dnd-poly: starting drag and drop operation");
            this._dragOperationState = 1;
            this._currentDragOperation = DROP_EFFECTS[0];
            this._dragDataStore = new DragDataStore();
            this._dataTransfer = new DataTransfer(this._dragDataStore);
            this._currentHotspotCoordinates = {
                x: null,
                y: null
            };
            this._dragImagePageCoordinates = {
                x: null,
                y: null
            };
            updateCentroidCoordinatesOfTouchesIn("page", this._lastTouchEvent, this._dragImagePageCoordinates);
            this._dragImage = createDragImage(this._sourceNode);
            translateDragImage(this._dragImage, this._dragImagePageCoordinates);
            document.body.appendChild(this._dragImage);
            this._dragDataStore._mode = 2;
            this._dataTransfer.dropEffect = DROP_EFFECTS[0];
            if (dispatchDragEvent("dragstart", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer)) {
                console.log("dnd-poly: dragstart cancelled");
                this._dragOperationState = 3;
                this._cleanup();
                return;
            }
            this._scrollIntention = {
                x: null,
                y: null
            };
            this._scrollAnimationFrameHandler = this._scrollAnimation.bind(this);
            this._iterationIntervalId = setInterval(function () {
                if (_this._iterationLock) {
                    console.log("dnd-poly: iteration skipped because previous iteration hast not yet finished.");
                    return;
                }
                _this._iterationLock = true;
                _this._dragAndDropProcessModelIteration();
                _this._iterationLock = false;
            }, this._config.iterationInterval);
        };
        DragOperationController.prototype._cleanup = function () {
            console.log("dnd-poly: cleanup");
            if (this._iterationIntervalId) {
                clearInterval(this._iterationIntervalId);
                this._iterationIntervalId = null;
            }
            document.removeEventListener("touchmove", this._touchMoveHandler);
            document.removeEventListener("touchend", this._touchEndOrCancelHandler);
            document.removeEventListener("touchcancel", this._touchEndOrCancelHandler);
            if (this._dragImage) {
                this._dragImage.parentNode.removeChild(this._dragImage);
                this._dragImage = null;
            }
            this._dragOperationEndedCb(this._lastTouchEvent, this._dragOperationState);
        };
        DragOperationController.prototype._onTouchMove = function (event) {
            if (isTouchIdentifierContainedInTouchEvent(event, this._initialTouchId) === false) {
                return;
            }
            if (this._dragOperationState === 0) {
                this._setup();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this._lastTouchEvent = event;
            updateCentroidCoordinatesOfTouchesIn("client", event, this._currentHotspotCoordinates);
            updateCentroidCoordinatesOfTouchesIn("page", event, this._dragImagePageCoordinates);
            this._scrollIntention.x = determineScrollIntention(this._currentHotspotCoordinates.x, document.documentElement.clientWidth, this._config.scrollThreshold);
            this._scrollIntention.y = determineScrollIntention(this._currentHotspotCoordinates.y, document.documentElement.clientHeight, this._config.scrollThreshold);
            var horizontalScrollEndReached = scrollEndReached(0, this._scrollIntention.x);
            var verticalScrollEndReached = scrollEndReached(1, this._scrollIntention.y);
            if (!horizontalScrollEndReached || !verticalScrollEndReached) {
                if (!this._scrollAnimationId) {
                    this._scrollAnimationId = window.requestAnimationFrame(this._scrollAnimationFrameHandler);
                }
            }
            else {
                translateDragImage(this._dragImage, this._dragImagePageCoordinates);
            }
        };
        DragOperationController.prototype._onTouchEndOrCancel = function (event) {
            if (isTouchIdentifierContainedInTouchEvent(event, this._initialTouchId) === false) {
                return;
            }
            this._scrollIntention.x = this._scrollIntention.y = 0;
            if (this._dragOperationState === 0) {
                this._cleanup();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this._lastTouchEvent = event;
            this._dragOperationState = (event.type === "touchcancel") ? 3 : 2;
        };
        DragOperationController.prototype._scrollAnimation = function () {
            var horizontalScrollEndReached = scrollEndReached(0, this._scrollIntention.x);
            var verticalScrollEndReached = scrollEndReached(1, this._scrollIntention.y);
            if (horizontalScrollEndReached && verticalScrollEndReached) {
                console.log("dnd-poly: scroll end reached");
                this._scrollAnimationId = null;
                return;
            }
            if (!horizontalScrollEndReached) {
                var horizontalScroll = this._scrollIntention.x * this._config.scrollVelocity;
                getSetScroll(0, horizontalScroll);
                this._dragImagePageCoordinates.x += horizontalScroll;
            }
            if (!verticalScrollEndReached) {
                var verticalScroll = this._scrollIntention.y * this._config.scrollVelocity;
                getSetScroll(1, verticalScroll);
                this._dragImagePageCoordinates.y += verticalScroll;
            }
            translateDragImage(this._dragImage, this._dragImagePageCoordinates);
            this._scrollAnimationId = window.requestAnimationFrame(this._scrollAnimationFrameHandler);
        };
        DragOperationController.prototype._dragAndDropProcessModelIteration = function () {
            var _this = this;
            if (DEBUG) {
                var debug_class = CLASS_PREFIX + "debug", debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection", debug_class_drop_target = CLASS_PREFIX + "current-drop-target";
            }
            this._dragDataStore._mode = 3;
            this._dataTransfer.dropEffect = DROP_EFFECTS[0];
            var dragCancelled = dispatchDragEvent("drag", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer);
            if (dragCancelled) {
                console.log("dnd-poly: drag event cancelled.");
                this._currentDragOperation = DROP_EFFECTS[0];
            }
            if (dragCancelled || this._dragOperationState === 2 || this._dragOperationState === 3) {
                var dragFailed = this._dragOperationEnded(this._dragOperationState);
                if (dragFailed) {
                    var sourceNodeComputedStyle = window.getComputedStyle(this._sourceNode, null);
                    var visiblity = sourceNodeComputedStyle.getPropertyValue("visibility");
                    var display = sourceNodeComputedStyle.getPropertyValue("display");
                    if (visiblity === "hidden" || display === "none") {
                        console.log("dnd-poly: source node is not visible. skipping snapback transition.");
                        this._finishDragOperation();
                    }
                    else {
                        triggerDragImageSnapback(detectedFeatures.transitionEnd, this._sourceNode, this._dragImage, function () {
                            _this._finishDragOperation();
                        });
                    }
                    return;
                }
                this._finishDragOperation();
                return;
            }
            var newUserSelection = document.elementFromPoint(this._currentHotspotCoordinates.x, this._currentHotspotCoordinates.y);
            console.log("dnd-poly: new immediate user selection is: " + newUserSelection);
            var previousTargetElement = this._currentDropTarget;
            if (newUserSelection !== this._immediateUserSelection && newUserSelection !== this._currentDropTarget) {
                if (DEBUG) {
                    if (this._immediateUserSelection) {
                        this._immediateUserSelection.classList.remove(debug_class_user_selection);
                    }
                    if (newUserSelection) {
                        newUserSelection.classList.add(debug_class);
                        newUserSelection.classList.add(debug_class_user_selection);
                    }
                }
                this._immediateUserSelection = newUserSelection;
                if (this._currentDropTarget !== null) {
                    this._dragDataStore._mode = 3;
                    this._dataTransfer.dropEffect = DROP_EFFECTS[0];
                    dispatchDragEvent("dragexit", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
                }
                if (this._immediateUserSelection === null) {
                    this._currentDropTarget = this._immediateUserSelection;
                    console.log("dnd-poly: current drop target changed to null");
                }
                else {
                    this._dragDataStore._mode = 3;
                    this._dataTransfer.dropEffect = determineDropEffect(this._dragDataStore._effectAllowed, this._sourceNode);
                    if (dispatchDragEvent("dragenter", this._immediateUserSelection, this._lastTouchEvent, this._dragDataStore, this._dataTransfer)) {
                        console.log("dnd-poly: dragenter default prevented");
                        this._currentDropTarget = this._immediateUserSelection;
                        this._currentDragOperation = determineDragOperation(this._dataTransfer.effectAllowed, this._dataTransfer.dropEffect);
                    }
                    else {
                        if (this._immediateUserSelection !== document.body) {
                            this._currentDropTarget = document.body;
                        }
                    }
                }
            }
            if (previousTargetElement !== this._currentDropTarget && (isDOMElement(previousTargetElement))) {
                if (DEBUG) {
                    previousTargetElement.classList.remove(debug_class_drop_target);
                }
                console.log("dnd-poly: current drop target changed.");
                this._dragDataStore._mode = 3;
                this._dataTransfer.dropEffect = DROP_EFFECTS[0];
                dispatchDragEvent("dragleave", previousTargetElement, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false, this._currentDropTarget);
            }
            if (isDOMElement(this._currentDropTarget)) {
                if (DEBUG) {
                    this._currentDropTarget.classList.add(debug_class);
                    this._currentDropTarget.classList.add(debug_class_drop_target);
                }
                this._dragDataStore._mode = 3;
                this._dataTransfer.dropEffect = determineDropEffect(this._dragDataStore._effectAllowed, this._sourceNode);
                if (dispatchDragEvent("dragover", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer) === false) {
                    console.log("dnd-poly: dragover not prevented on possible drop-target.");
                    this._currentDragOperation = DROP_EFFECTS[0];
                }
                else {
                    console.log("dnd-poly: dragover prevented.");
                    this._currentDragOperation = determineDragOperation(this._dataTransfer.effectAllowed, this._dataTransfer.dropEffect);
                }
            }
            console.log("dnd-poly: d'n'd iteration ended. current drag operation: " + this._currentDragOperation);
            for (var i = 0; i < DROP_EFFECTS.length; i++) {
                this._dragImage.classList.remove(CLASS_PREFIX + DROP_EFFECTS[i]);
            }
            this._dragImage.classList.add(CLASS_PREFIX + this._currentDragOperation);
        };
        DragOperationController.prototype._dragOperationEnded = function (state) {
            console.log("dnd-poly: drag operation end detected with " + this._currentDragOperation);
            if (DEBUG) {
                var debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection", debug_class_drop_target = CLASS_PREFIX + "current-drop-target";
                if (this._currentDropTarget) {
                    this._currentDropTarget.classList.remove(debug_class_drop_target);
                }
                if (this._immediateUserSelection) {
                    this._immediateUserSelection.classList.remove(debug_class_user_selection);
                }
            }
            var dragFailed = (this._currentDragOperation === DROP_EFFECTS[0]
                || this._currentDropTarget === null
                || state === 3);
            if (dragFailed) {
                if (isDOMElement(this._currentDropTarget)) {
                    this._dragDataStore._mode = 3;
                    this._dataTransfer.dropEffect = DROP_EFFECTS[0];
                    dispatchDragEvent("dragleave", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
                }
            }
            else {
                if (isDOMElement(this._currentDropTarget)) {
                    this._dragDataStore._mode = 1;
                    this._dataTransfer.dropEffect = this._currentDragOperation;
                    if (dispatchDragEvent("drop", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer) ===
                        true) {
                        this._currentDragOperation = this._dataTransfer.dropEffect;
                    }
                    else {
                        this._currentDragOperation = DROP_EFFECTS[0];
                    }
                }
            }
            return dragFailed;
        };
        DragOperationController.prototype._finishDragOperation = function () {
            console.log("dnd-poly: dragimage snap back transition ended");
            this._dragDataStore._mode = 3;
            this._dataTransfer.dropEffect = this._currentDragOperation;
            dispatchDragEvent("dragend", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
            this._dragOperationState = 2;
            this._cleanup();
        };
        return DragOperationController;
    })();
    var DataTransfer = (function () {
        function DataTransfer(_dataStore) {
            this._dataStore = _dataStore;
            this._dropEffect = DROP_EFFECTS[0];
        }
        Object.defineProperty(DataTransfer.prototype, "files", {
            get: function () {
                return null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "items", {
            get: function () {
                return null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "types", {
            get: function () {
                if (this._dataStore._mode === 0) {
                    return null;
                }
                return Object.freeze(this._dataStore._types);
            },
            enumerable: true,
            configurable: true
        });
        DataTransfer.prototype.setData = function (type, data) {
            if (this._dataStore._mode !== 2) {
                return;
            }
            if (type.indexOf(" ") > -1) {
                throw new Error("illegal arg: type contains space");
            }
            this._dataStore._data[type] = data;
            if (this._dataStore._types.indexOf(type) === -1) {
                this._dataStore._types.push(type);
            }
        };
        DataTransfer.prototype.getData = function (type) {
            if (this._dataStore._mode === 0
                || this._dataStore._mode === 3) {
                return null;
            }
            return this._dataStore._data[type] || "";
        };
        DataTransfer.prototype.clearData = function (format) {
            if (this._dataStore._mode !== 2) {
                return;
            }
            if (format && this._dataStore._data[format]) {
                delete this._dataStore._data[format];
                var index = this._dataStore._types.indexOf(format);
                if (index > -1) {
                    this._dataStore._types.splice(index, 1);
                }
                return;
            }
            this._dataStore._data = {};
            this._dataStore._types = [];
        };
        DataTransfer.prototype.setDragImage = function (image, x, y) {
            if (this._dataStore._mode === 0) {
                return;
            }
        };
        Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
            get: function () {
                return this._dataStore._effectAllowed;
            },
            set: function (value) {
                if (this._dataStore._mode === 0
                    || ALLOWED_EFFECTS.indexOf(value) === -1) {
                    return;
                }
                this._dataStore._effectAllowed = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "dropEffect", {
            get: function () {
                return this._dropEffect;
            },
            set: function (value) {
                if (this._dataStore._mode === 0
                    || ALLOWED_EFFECTS.indexOf(value) === -1) {
                    return;
                }
                this._dropEffect = value;
            },
            enumerable: true,
            configurable: true
        });
        return DataTransfer;
    })();
    var DragDataStore = (function () {
        function DragDataStore() {
            this._mode = 3;
            this._data = {};
            this._types = [];
        }
        return DragDataStore;
    })();
    function average(array) {
        if (array.length === 0) {
            return 0;
        }
        return array.reduce((function (s, v) {
            return v + s;
        }), 0) / array.length;
    }
    function isDOMElement(object) {
        return object && object.tagName;
    }
    function once(el, eventType, callback) {
        el.addEventListener(eventType, function (e) {
            e.target.removeEventListener(e.type, arguments.callee);
            return callback(e);
        });
    }
    function isTouchIdentifierContainedInTouchEvent(newTouch, touchIdentifier) {
        for (var i = 0; i < newTouch.changedTouches.length; i++) {
            var touch = newTouch.changedTouches[i];
            if (touch.identifier === touchIdentifier) {
                return true;
            }
        }
        return false;
    }
    function createMouseEventFromTouch(targetElement, e, typeArg, cancelable, window, relatedTarget) {
        if (cancelable === void 0) { cancelable = true; }
        if (window === void 0) { window = document.defaultView; }
        if (relatedTarget === void 0) { relatedTarget = null; }
        var mouseEvent = document.createEvent("MouseEvents");
        var touch = e.changedTouches[0];
        mouseEvent.initMouseEvent(typeArg, true, cancelable, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, relatedTarget);
        var targetRect = targetElement.getBoundingClientRect();
        mouseEvent.offsetX = mouseEvent.clientX - targetRect.left;
        mouseEvent.offsetY = mouseEvent.clientY - targetRect.top;
        return mouseEvent;
    }
    function createDragEventFromTouch(targetElement, e, typeArg, cancelable, window, dataTransfer, relatedTarget) {
        if (relatedTarget === void 0) { relatedTarget = null; }
        var touch = e.changedTouches[0];
        var dndEvent = document.createEvent("Event");
        dndEvent.initEvent(typeArg, true, cancelable);
        dndEvent.dataTransfer = dataTransfer;
        dndEvent.relatedTarget = relatedTarget;
        dndEvent.screenX = touch.screenX;
        dndEvent.screenY = touch.screenY;
        dndEvent.clientX = touch.clientX;
        dndEvent.clientY = touch.clientY;
        var targetRect = targetElement.getBoundingClientRect();
        dndEvent.offsetX = dndEvent.clientX - targetRect.left;
        dndEvent.offsetY = dndEvent.clientY - targetRect.top;
        return dndEvent;
    }
    function updateCentroidCoordinatesOfTouchesIn(coordinateProp, event, outPoint) {
        var pageXs = [], pageYs = [];
        for (var i = 0; i < event.touches.length; i++) {
            var touch = event.touches[i];
            pageXs.push(touch[coordinateProp + "X"]);
            pageYs.push(touch[coordinateProp + "Y"]);
        }
        outPoint.x = average(pageXs);
        outPoint.y = average(pageYs);
    }
    function prepareNodeCopyAsDragImage(srcNode, dstNode) {
        if (srcNode.nodeType === 1) {
            var cs = window.getComputedStyle(srcNode);
            for (var i = 0; i < cs.length; i++) {
                var csName = cs[i];
                dstNode.style.setProperty(csName, cs.getPropertyValue(csName), cs.getPropertyPriority(csName));
            }
            dstNode.style["pointer-events"] = "none";
            dstNode.removeAttribute("id");
            dstNode.removeAttribute("class");
            dstNode.removeAttribute("draggable");
        }
        if (srcNode.hasChildNodes()) {
            for (var i = 0; i < srcNode.childNodes.length; i++) {
                prepareNodeCopyAsDragImage(srcNode.childNodes[i], dstNode.childNodes[i]);
            }
        }
    }
    function createDragImage(sourceNode) {
        var dragImage = sourceNode.cloneNode(true);
        prepareNodeCopyAsDragImage(sourceNode, dragImage);
        dragImage.style["position"] = "absolute";
        dragImage.style["left"] = "0px";
        dragImage.style["top"] = "0px";
        dragImage.style["z-index"] = "999999";
        dragImage.classList.add(CLASS_DRAG_IMAGE);
        dragImage.classList.add(CLASS_DRAG_OPERATION_ICON);
        return dragImage;
    }
    function translateDragImage(dragImage, pnt, centerOnCoordinates) {
        if (centerOnCoordinates === void 0) { centerOnCoordinates = true; }
        var x = pnt.x, y = pnt.y;
        if (centerOnCoordinates) {
            x -= (parseInt(dragImage.offsetWidth, 10) / 2);
            y -= (parseInt(dragImage.offsetHeight, 10) / 2);
        }
        var translate = "translate3d(" + x + "px," + y + "px, 0)";
        for (var i = 0; i < TRANSFORM_CSS_VENDOR_PREFIXES.length; i++) {
            var transformProp = TRANSFORM_CSS_VENDOR_PREFIXES[i] + "transform";
            dragImage.style[transformProp] = translate;
        }
    }
    function triggerDragImageSnapback(transitionEndEvent, sourceEl, dragImage, transitionEndCb) {
        console.log("dnd-poly: starting dragimage snap back");
        var rect = sourceEl.getBoundingClientRect();
        var pnt = {
            x: rect.left,
            y: rect.top
        };
        var scrollLeft = getSetScroll(0);
        var scrollTop = getSetScroll(1);
        pnt.x += scrollLeft;
        pnt.y += scrollTop;
        var cs = window.getComputedStyle(sourceEl, null);
        var leftPadding = parseInt(cs.getPropertyValue("padding-left"), 10);
        var topPadding = parseInt(cs.getPropertyValue("padding-top"), 10);
        pnt.x -= leftPadding;
        pnt.y -= topPadding;
        once(dragImage, transitionEndEvent, transitionEndCb);
        dragImage.classList.add(CLASS_DRAG_IMAGE_SNAPBACK);
        translateDragImage(dragImage, pnt, false);
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
    function getSetScroll(axis, scroll) {
        var prop = (axis === 0) ? "scrollLeft" : "scrollTop";
        if (arguments.length === 1) {
            return document.documentElement[prop] || document.body[prop];
        }
        document.documentElement[prop] += scroll;
        document.body[prop] += scroll;
    }
    function scrollEndReached(axis, scrollIntention) {
        var scrollSizeProp = "scrollHeight", clientSizeProp = "clientHeight", scroll = getSetScroll(axis);
        if (axis === 0) {
            scrollSizeProp = "scrollWidth";
            clientSizeProp = "clientWidth";
        }
        if (scrollIntention > 0) {
            var scrollSize = document.documentElement[scrollSizeProp] || document.body[scrollSizeProp];
            return (scroll + document.documentElement[clientSizeProp]) >= (scrollSize);
        }
        else if (scrollIntention < 0) {
            return (scroll <= 0);
        }
        return true;
    }
    function determineDropEffect(effectAllowed, sourceNode) {
        if (!effectAllowed) {
            if (sourceNode.nodeType === 3 && sourceNode.tagName === "A") {
                return DROP_EFFECTS[3];
            }
            return DROP_EFFECTS[1];
        }
        if (effectAllowed === ALLOWED_EFFECTS[0]) {
            return DROP_EFFECTS[0];
        }
        if (effectAllowed.indexOf(ALLOWED_EFFECTS[1]) === 0 || effectAllowed === ALLOWED_EFFECTS[7]) {
            return DROP_EFFECTS[1];
        }
        if (effectAllowed.indexOf(ALLOWED_EFFECTS[4]) === 0) {
            return DROP_EFFECTS[3];
        }
        if (effectAllowed === ALLOWED_EFFECTS[6]) {
            return DROP_EFFECTS[2];
        }
        return DROP_EFFECTS[1];
    }
    function dispatchDragEvent(dragEvent, targetElement, touchEvent, dataStore, dataTransfer, cancelable, relatedTarget) {
        if (cancelable === void 0) { cancelable = true; }
        if (relatedTarget === void 0) { relatedTarget = null; }
        console.log("dnd-poly: dispatching " + dragEvent);
        if (DEBUG) {
            var debug_class = CLASS_PREFIX + "debug", debug_class_event_target = CLASS_PREFIX + "event-target", debug_class_event_related_target = CLASS_PREFIX + "event-related-target";
            targetElement.classList.add(debug_class);
            targetElement.classList.add(debug_class_event_target);
            if (relatedTarget) {
                relatedTarget.classList.add(debug_class);
                relatedTarget.classList.add(debug_class_event_related_target);
            }
        }
        var leaveEvt = createDragEventFromTouch(targetElement, touchEvent, dragEvent, cancelable, document.defaultView, dataTransfer, relatedTarget);
        var cancelled = !targetElement.dispatchEvent(leaveEvt);
        dataStore._mode = 0;
        if (DEBUG) {
            targetElement.classList.remove(debug_class_event_target);
            if (relatedTarget) {
                relatedTarget.classList.remove(debug_class_event_related_target);
            }
        }
        return cancelled;
    }
    function determineDragOperation(effectAllowed, dropEffect) {
        if (!effectAllowed || effectAllowed === ALLOWED_EFFECTS[7]) {
            return dropEffect;
        }
        if (dropEffect === DROP_EFFECTS[1]) {
            if (effectAllowed.indexOf(DROP_EFFECTS[1]) === 0) {
                return DROP_EFFECTS[1];
            }
        }
        else if (dropEffect === DROP_EFFECTS[3]) {
            if (effectAllowed.indexOf(DROP_EFFECTS[3]) === 0 || effectAllowed.indexOf("Link") > -1) {
                return DROP_EFFECTS[3];
            }
        }
        else if (dropEffect === DROP_EFFECTS[2]) {
            if (effectAllowed.indexOf(DROP_EFFECTS[2]) === 0 || effectAllowed.indexOf("Move") > -1) {
                return DROP_EFFECTS[2];
            }
        }
        return DROP_EFFECTS[0];
    }
})(MobileDragAndDropPolyfill || (MobileDragAndDropPolyfill = {}));
//# sourceMappingURL=mobile-drag-and-drop-polyfill.js.map