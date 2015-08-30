var MobileDragAndDropPolyfill;
(function (MobileDragAndDropPolyfill) {
    var detectedFeatures;
    function detectFeatures() {
        var featureDetection = {
            draggable: ('draggable' in document.documentElement),
            dragEvents: ('ondragstart' in document.documentElement),
            touchEvents: ('ontouchstart' in document.documentElement),
            isBlinkEngine: !!(window.chrome) || /chrome/i.test(navigator.userAgent),
            userAgentNotSupportingNativeDnD: false,
            transitionEnd: ('WebkitTransition' in document.documentElement.style) ? 'webkitTransitionEnd' : 'transitionend'
        };
        featureDetection.userAgentNotSupportingNativeDnD = (/iPad|iPhone|iPod|Android/.test(navigator.userAgent)
            ||
                featureDetection.touchEvents && (featureDetection.isBlinkEngine));
        Object.keys(featureDetection).forEach(function (key) {
            console.log("dnd-poly: detected feature '" + key + " = " + featureDetection[key] + "'");
        });
        return featureDetection;
    }
    var config = {
        dragImageClass: null,
        iterationInterval: 150,
        scrollThreshold: 50,
        scrollVelocity: 10,
        debug: false
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
        //<spec>
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
    var transform_css_vendor_prefixes = ["", "-webkit-"];
    var class_prefix = "dnd-poly-";
    var class_drag_image = class_prefix + "drag-image";
    var class_drag_image_snapback = class_prefix + "snapback";
    var class_drag_operation_icon = class_prefix + "icon";
    var debug_class;
    var debug_class_user_selection;
    var debug_class_drop_target;
    var debug_class_event_target;
    var debug_class_event_related_target;
    var DragOperationController = (function () {
        function DragOperationController(config, sourceNode, initialEvent, dragOperationEndedCb) {
            this.config = config;
            this.sourceNode = sourceNode;
            this.dragOperationEndedCb = dragOperationEndedCb;
            this.dragOperationState = 0;
            this.immediateUserSelection = null;
            this.currentDropTarget = null;
            console.log("dnd-poly: setting up potential drag operation..");
            if (this.config.debug) {
                debug_class = class_prefix + "debug";
                debug_class_user_selection = class_prefix + "immediate-user-selection";
                debug_class_drop_target = class_prefix + "current-drop-target";
                debug_class_event_target = class_prefix + "event-target";
                debug_class_event_related_target = class_prefix + "event-related-target";
            }
            this.lastTouchEvent = initialEvent;
            this.initialTouchId = initialEvent.changedTouches[0].identifier;
            this.touchMoveHandler = this.onTouchMove.bind(this);
            this.touchEndOrCancelHandler = this.onTouchEndOrCancel.bind(this);
            document.addEventListener("touchmove", this.touchMoveHandler);
            document.addEventListener("touchend", this.touchEndOrCancelHandler);
            document.addEventListener("touchcancel", this.touchEndOrCancelHandler);
        }
        DragOperationController.prototype.setup = function () {
            var _this = this;
            console.log("dnd-poly: starting drag and drop operation");
            this.dragOperationState = 1;
            this.currentDragOperation = "none";
            this.dragDataStore = new DragDataStore();
            this.dataTransfer = new DataTransfer(this.dragDataStore);
            this.currentHotspotCoordinates = {
                x: null,
                y: null
            };
            this.dragImagePageCoordinates = {
                x: null,
                y: null
            };
            updateCentroidCoordinatesOfTouchesIn("page", this.lastTouchEvent, this.dragImagePageCoordinates);
            this.dragImage = createDragImage(this.sourceNode, this.config.dragImageClass);
            translateDragImage(this.dragImage, this.dragImagePageCoordinates.x, this.dragImagePageCoordinates.y);
            document.body.appendChild(this.dragImage);
            this.dragDataStore.mode = 2;
            this.dataTransfer.dropEffect = "none";
            if (dispatchDragEvent("dragstart", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer)) {
                console.log("dnd-poly: dragstart cancelled");
                this.dragOperationState = 3;
                this.cleanup();
                return;
            }
            this.scrollIntention = {
                x: null,
                y: null
            };
            this.scrollAnimationFrameHandler = this.scrollAnimation.bind(this);
            this.iterationIntervalId = setInterval(function () {
                if (_this.iterationLock) {
                    console.log("dnd-poly: iteration skipped because previous iteration hast not yet finished.");
                    return;
                }
                _this.iterationLock = true;
                _this.dragAndDropProcessModelIteration();
                _this.iterationLock = false;
            }, this.config.iterationInterval);
        };
        DragOperationController.prototype.cleanup = function () {
            console.log("dnd-poly: cleanup");
            if (this.iterationIntervalId) {
                clearInterval(this.iterationIntervalId);
                this.iterationIntervalId = null;
            }
            document.removeEventListener("touchmove", this.touchMoveHandler);
            document.removeEventListener("touchend", this.touchEndOrCancelHandler);
            document.removeEventListener("touchcancel", this.touchEndOrCancelHandler);
            if (this.dragImage) {
                this.dragImage.parentNode.removeChild(this.dragImage);
                this.dragImage = null;
            }
            this.dragOperationEndedCb(this.lastTouchEvent, this.dragOperationState);
        };
        DragOperationController.prototype.onTouchMove = function (event) {
            if (isTouchIdentifierContainedInTouchEvent(event, this.initialTouchId) === false) {
                return;
            }
            if (this.dragOperationState === 0) {
                this.setup();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            updateCentroidCoordinatesOfTouchesIn("client", event, this.currentHotspotCoordinates);
            updateCentroidCoordinatesOfTouchesIn("page", event, this.dragImagePageCoordinates);
            this.scrollIntention.x = determineScrollIntention(this.currentHotspotCoordinates.x, document.documentElement.clientWidth, this.config.scrollThreshold);
            this.scrollIntention.y = determineScrollIntention(this.currentHotspotCoordinates.y, document.documentElement.clientHeight, this.config.scrollThreshold);
            var horizontalScrollEndReached = scrollEndReached(0, this.scrollIntention.x);
            var verticalScrollEndReached = scrollEndReached(1, this.scrollIntention.y);
            if (!horizontalScrollEndReached || !verticalScrollEndReached) {
                if (!this.scrollAnimationId) {
                    this.scrollAnimationId = window.requestAnimationFrame(this.scrollAnimationFrameHandler);
                }
            }
            else {
                translateDragImage(this.dragImage, this.dragImagePageCoordinates.x, this.dragImagePageCoordinates.y);
            }
        };
        DragOperationController.prototype.onTouchEndOrCancel = function (event) {
            if (isTouchIdentifierContainedInTouchEvent(event, this.initialTouchId) === false) {
                return;
            }
            this.scrollIntention.x = this.scrollIntention.y = 0;
            if (this.dragOperationState === 0) {
                this.cleanup();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            this.dragOperationState = (event.type === "touchcancel") ? 3 : 2;
        };
        DragOperationController.prototype.scrollAnimation = function () {
            var horizontalScrollEndReached = scrollEndReached(0, this.scrollIntention.x);
            var verticalScrollEndReached = scrollEndReached(1, this.scrollIntention.y);
            if (horizontalScrollEndReached && verticalScrollEndReached) {
                console.log("dnd-poly: scroll end reached");
                this.scrollAnimationId = null;
                return;
            }
            if (!horizontalScrollEndReached) {
                var horizontalScroll = this.scrollIntention.x * this.config.scrollVelocity;
                getSetScroll(0, horizontalScroll);
                this.dragImagePageCoordinates.x += horizontalScroll;
            }
            if (!verticalScrollEndReached) {
                var verticalScroll = this.scrollIntention.y * this.config.scrollVelocity;
                getSetScroll(1, verticalScroll);
                this.dragImagePageCoordinates.y += verticalScroll;
            }
            translateDragImage(this.dragImage, this.dragImagePageCoordinates.x, this.dragImagePageCoordinates.y);
            this.scrollAnimationId = window.requestAnimationFrame(this.scrollAnimationFrameHandler);
        };
        DragOperationController.prototype.dragAndDropProcessModelIteration = function () {
            var _this = this;
            this.dragDataStore.mode = 3;
            this.dataTransfer.dropEffect = "none";
            var dragCancelled = dispatchDragEvent("drag", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer);
            if (dragCancelled) {
                console.log("dnd-poly: drag event cancelled.");
                this.currentDragOperation = "none";
            }
            if (dragCancelled || this.dragOperationState === 2 || this.dragOperationState === 3) {
                var dragFailed = this.dragOperationEnded(this.dragOperationState);
                if (dragFailed) {
                    var sourceNodeComputedStyle = window.getComputedStyle(this.sourceNode, null);
                    var visiblity = sourceNodeComputedStyle.getPropertyValue('visibility');
                    var display = sourceNodeComputedStyle.getPropertyValue('display');
                    if (visiblity === 'hidden' || display === 'none') {
                        console.log("dnd-poly: source node is not visible. skipping snapback transition.");
                        this.finishDragOperation();
                    }
                    else {
                        triggerDragImageSnapback(detectedFeatures.transitionEnd, this.sourceNode, this.dragImage, function () {
                            _this.finishDragOperation();
                        });
                    }
                    return;
                }
                this.finishDragOperation();
                return;
            }
            var newUserSelection = document.elementFromPoint(this.currentHotspotCoordinates.x, this.currentHotspotCoordinates.y);
            console.log("dnd-poly: new immediate user selection is: " + newUserSelection);
            var previousTargetElement = this.currentDropTarget;
            if (newUserSelection !== this.immediateUserSelection && newUserSelection !== this.currentDropTarget) {
                if (this.config.debug) {
                    if (this.immediateUserSelection) {
                        this.immediateUserSelection.classList.remove(debug_class_user_selection);
                    }
                    if (newUserSelection) {
                        newUserSelection.classList.add(debug_class);
                        newUserSelection.classList.add(debug_class_user_selection);
                    }
                }
                this.immediateUserSelection = newUserSelection;
                if (this.currentDropTarget !== null) {
                    this.dragDataStore.mode = 3;
                    this.dataTransfer.dropEffect = "none";
                    dispatchDragEvent("dragexit", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
                }
                if (this.immediateUserSelection === null) {
                    this.currentDropTarget = this.immediateUserSelection;
                    console.log("dnd-poly: current drop target changed to null");
                }
                else {
                    this.dragDataStore.mode = 3;
                    this.dataTransfer.dropEffect = determineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
                    if (dispatchDragEvent("dragenter", this.immediateUserSelection, this.lastTouchEvent, this.dragDataStore, this.dataTransfer)) {
                        console.log("dnd-poly: dragenter default prevented");
                        this.currentDropTarget = this.immediateUserSelection;
                        this.currentDragOperation = determineDragOperation(this.dataTransfer.effectAllowed, this.dataTransfer.dropEffect);
                    }
                    else {
                        if (this.immediateUserSelection === document.body) {
                        }
                        else {
                            this.currentDropTarget = document.body;
                        }
                    }
                }
            }
            if (previousTargetElement !== this.currentDropTarget && (isDOMElement(previousTargetElement))) {
                if (this.config.debug) {
                    previousTargetElement.classList.remove(debug_class_drop_target);
                }
                console.log("dnd-poly: current drop target changed.");
                this.dragDataStore.mode = 3;
                this.dataTransfer.dropEffect = "none";
                dispatchDragEvent("dragleave", previousTargetElement, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false, this.currentDropTarget);
            }
            if (isDOMElement(this.currentDropTarget)) {
                if (this.config.debug) {
                    this.currentDropTarget.classList.add(debug_class);
                    this.currentDropTarget.classList.add(debug_class_drop_target);
                }
                this.dragDataStore.mode = 3;
                this.dataTransfer.dropEffect = determineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
                if (dispatchDragEvent("dragover", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer) === false) {
                    console.log("dnd-poly: dragover not prevented on possible drop-target.");
                    this.currentDragOperation = "none";
                }
                else {
                    console.log("dnd-poly: dragover prevented.");
                    this.currentDragOperation = determineDragOperation(this.dataTransfer.effectAllowed, this.dataTransfer.dropEffect);
                }
            }
            console.log("dnd-poly: d'n'd iteration ended. current drag operation: " + this.currentDragOperation);
            for (var i = 0; i < DROP_EFFECTS.length; i++) {
                this.dragImage.classList.remove(class_prefix + DROP_EFFECTS[i]);
            }
            this.dragImage.classList.add(class_prefix + this.currentDragOperation);
        };
        DragOperationController.prototype.dragOperationEnded = function (state) {
            console.log("dnd-poly: drag operation end detected with " + this.currentDragOperation);
            if (this.config.debug) {
                if (this.currentDropTarget) {
                    this.currentDropTarget.classList.remove(debug_class_drop_target);
                }
                if (this.immediateUserSelection) {
                    this.immediateUserSelection.classList.remove(debug_class_user_selection);
                }
            }
            var dragFailed = (this.currentDragOperation === "none"
                || this.currentDropTarget === null
                || state === 3);
            if (dragFailed) {
                if (isDOMElement(this.currentDropTarget)) {
                    this.dragDataStore.mode = 3;
                    this.dataTransfer.dropEffect = "none";
                    dispatchDragEvent("dragleave", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
                }
            }
            else {
                if (isDOMElement(this.currentDropTarget)) {
                    this.dragDataStore.mode = 1;
                    this.dataTransfer.dropEffect = this.currentDragOperation;
                    if (dispatchDragEvent("drop", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer) ===
                        true) {
                        this.currentDragOperation = this.dataTransfer.dropEffect;
                    }
                    else {
                        this.currentDragOperation = "none";
                    }
                }
            }
            return dragFailed;
        };
        DragOperationController.prototype.finishDragOperation = function () {
            console.log("dnd-poly: dragimage snap back transition ended");
            this.dragDataStore.mode = 3;
            this.dataTransfer.dropEffect = this.currentDragOperation;
            dispatchDragEvent("dragend", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
            this.dragOperationState = 2;
            this.cleanup();
        };
        return DragOperationController;
    })();
    var DataTransfer = (function () {
        function DataTransfer(dataStore) {
            this.dataStore = dataStore;
            this._dropEffect = "none";
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
                if (this.dataStore.mode === 0) {
                    return null;
                }
                return Object.freeze(this.dataStore.types);
            },
            enumerable: true,
            configurable: true
        });
        DataTransfer.prototype.setData = function (type, data) {
            if (this.dataStore.mode !== 2) {
                return;
            }
            if (type.indexOf(" ") > -1) {
                throw new Error("Space character not allowed in drag data item type string");
            }
            this.dataStore.data[type] = data;
            if (this.dataStore.types.indexOf(type) === -1) {
                this.dataStore.types.push(type);
            }
        };
        DataTransfer.prototype.getData = function (type) {
            if (this.dataStore.mode === 0
                || this.dataStore.mode === 3) {
                return null;
            }
            return this.dataStore.data[type] || "";
        };
        DataTransfer.prototype.clearData = function (format) {
            if (this.dataStore.mode !== 2) {
                return;
            }
            if (format && this.dataStore.data[format]) {
                delete this.dataStore.data[format];
                var index = this.dataStore.types.indexOf(format);
                if (index > -1) {
                    this.dataStore.types.splice(index, 1);
                }
                return;
            }
            this.dataStore.data = {};
            this.dataStore.types = [];
        };
        DataTransfer.prototype.setDragImage = function (image, x, y) {
            if (this.dataStore.mode === 0) {
                return;
            }
        };
        Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
            get: function () {
                return this.dataStore.effectAllowed;
            },
            set: function (value) {
                if (this.dataStore.mode === 0
                    || ALLOWED_EFFECTS.indexOf(value) === -1) {
                    return;
                }
                this.dataStore.effectAllowed = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "dropEffect", {
            get: function () {
                return this._dropEffect;
            },
            set: function (value) {
                if (this.dataStore.mode === 0
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
            this.mode = 3;
            this.data = {};
            this.types = [];
            this.effectAllowed = "uninitialized";
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
            dstNode.removeAttribute("id");
            dstNode.removeAttribute("class");
            dstNode.removeAttribute("style");
            dstNode.removeAttribute("draggable");
            var cs = window.getComputedStyle(srcNode);
            for (var i = 0; i < cs.length; i++) {
                var csName = cs[i];
                dstNode.style.setProperty(csName, cs.getPropertyValue(csName), cs.getPropertyPriority(csName));
            }
            dstNode.style["pointer-events"] = "none";
        }
        if (srcNode.hasChildNodes()) {
            for (var i = 0; i < srcNode.childNodes.length; i++) {
                prepareNodeCopyAsDragImage(srcNode.childNodes[i], dstNode.childNodes[i]);
            }
        }
    }
    function createDragImage(sourceNode, customClass) {
        var dragImage = sourceNode.cloneNode(true);
        prepareNodeCopyAsDragImage(sourceNode, dragImage);
        dragImage.style["position"] = "absolute";
        dragImage.style["left"] = "0px";
        dragImage.style["top"] = "0px";
        dragImage.style["z-index"] = "999999";
        dragImage.classList.add(class_drag_image);
        dragImage.classList.add(class_drag_operation_icon);
        if (customClass) {
            dragImage.classList.add(customClass);
        }
        return dragImage;
    }
    function translateDragImage(dragImage, x, y, centerOnCoordinates) {
        if (centerOnCoordinates === void 0) { centerOnCoordinates = true; }
        if (centerOnCoordinates) {
            x -= (parseInt(dragImage.offsetWidth, 10) / 2);
            y -= (parseInt(dragImage.offsetHeight, 10) / 2);
        }
        var translate = "translate3d(" + x + "px," + y + "px, 0)";
        for (var i = 0; i < transform_css_vendor_prefixes.length; i++) {
            var transformProp = transform_css_vendor_prefixes[i] + "transform";
            dragImage.style[transformProp] = translate;
        }
    }
    function triggerDragImageSnapback(transitionEndEvent, sourceEl, dragImage, transitionEndCb) {
        console.log("dnd-poly: starting dragimage snap back");
        once(dragImage, transitionEndEvent, transitionEndCb);
        dragImage.classList.add(class_drag_image_snapback);
        var rect = sourceEl.getBoundingClientRect();
        var elementLeft, elementTop;
        var scrollTop = document.documentElement.scrollTop ?
            document.documentElement.scrollTop : document.body.scrollTop;
        var scrollLeft = document.documentElement.scrollLeft ?
            document.documentElement.scrollLeft : document.body.scrollLeft;
        elementTop = rect.top + scrollTop;
        elementLeft = rect.left + scrollLeft;
        var cs = window.getComputedStyle(sourceEl, null);
        var leftPadding = parseInt(cs.getPropertyValue("padding-left"), 10);
        var topPadding = parseInt(cs.getPropertyValue("padding-top"), 10);
        elementLeft -= leftPadding;
        elementTop -= topPadding;
        translateDragImage(dragImage, elementLeft, elementTop, false);
    }
    function determineScrollIntention(currentCoordinate, clientSize, threshold) {
        if (currentCoordinate < threshold) {
            return -1;
        }
        else if (clientSize - currentCoordinate < threshold) {
            return 1;
        }
        else {
            return 0;
        }
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
        var scrollSizeProp, clientSizeProp, scroll;
        if (axis === 0) {
            scrollSizeProp = "scrollWidth";
            clientSizeProp = "clientWidth";
        }
        else {
            scrollSizeProp = "scrollHeight";
            clientSizeProp = "clientHeight";
        }
        scroll = getSetScroll(axis);
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
        if (effectAllowed === "none") {
            return "none";
        }
        if (effectAllowed.indexOf("copy") === 0 || effectAllowed === "all") {
            return "copy";
        }
        if (effectAllowed.indexOf("link") === 0) {
            return "link";
        }
        if (effectAllowed === "move") {
            return "move";
        }
        if (effectAllowed === "uninitialized") {
            if (sourceNode.nodeType === 3 && sourceNode.tagName === "A") {
                return "link";
            }
        }
        return "copy";
    }
    function dispatchDragEvent(dragEvent, targetElement, touchEvent, dataStore, dataTransfer, cancelable, relatedTarget) {
        if (cancelable === void 0) { cancelable = true; }
        if (relatedTarget === void 0) { relatedTarget = null; }
        console.log("dnd-poly: dispatching " + dragEvent);
        if (config.debug) {
            targetElement.classList.add(debug_class);
            targetElement.classList.add(debug_class_event_target);
            if (relatedTarget) {
                relatedTarget.classList.add(debug_class);
                relatedTarget.classList.add(debug_class_event_related_target);
            }
        }
        var leaveEvt = createDragEventFromTouch(targetElement, touchEvent, dragEvent, cancelable, document.defaultView, dataTransfer, relatedTarget);
        var cancelled = !targetElement.dispatchEvent(leaveEvt);
        dataStore.mode = 0;
        if (config.debug) {
            targetElement.classList.remove(debug_class_event_target);
            if (relatedTarget) {
                relatedTarget.classList.remove(debug_class_event_related_target);
            }
        }
        return cancelled;
    }
    function determineDragOperation(effectAllowed, dropEffect) {
        if (effectAllowed === "uninitialized" || effectAllowed === "all") {
            return dropEffect;
        }
        if (dropEffect === "copy") {
            if (effectAllowed.indexOf("copy") === 0) {
                return "copy";
            }
        }
        else if (dropEffect === "link") {
            if (effectAllowed.indexOf("link") === 0 || effectAllowed.indexOf("Link") > -1) {
                return "link";
            }
        }
        else if (dropEffect === "move") {
            if (effectAllowed.indexOf("move") === 0 || effectAllowed.indexOf("Move") > -1) {
                return "move";
            }
        }
        return "none";
    }
})(MobileDragAndDropPolyfill || (MobileDragAndDropPolyfill = {}));
//# sourceMappingURL=mobile-drag-and-drop-polyfill.js.map