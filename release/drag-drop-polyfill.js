var DEBUG;
var DragDropPolyfill;
(function (DragDropPolyfill) {
    function detectFeatures() {
        var features = {
            dragEvents: ("ondragstart" in document.documentElement),
            draggable: ("draggable" in document.documentElement),
            touchEvents: ("ontouchstart" in document.documentElement),
            userAgentSupportingNativeDnD: undefined
        };
        var isBlinkEngine = !!(window.chrome) || /chrome/i.test(navigator.userAgent);
        features.userAgentSupportingNativeDnD = !((/iPad|iPhone|iPod|Android/.test(navigator.userAgent))
            ||
                (isBlinkEngine && features.touchEvents));
        if (DEBUG) {
            Object.keys(features).forEach(function (key) {
                console.log("dnd-poly: detected feature '" + key + " = " + features[key] + "'");
            });
        }
        return features;
    }
    var config = {
        iterationInterval: 150,
    };
    function Initialize(override) {
        if (override) {
            Object.keys(override).forEach(function (key) {
                config[key] = override[key];
            });
        }
        if (!config.forceApply) {
            var detectedFeatures = detectFeatures();
            if (detectedFeatures.userAgentSupportingNativeDnD
                && detectedFeatures.draggable
                && detectedFeatures.dragEvents) {
                return;
            }
        }
        console.log("dnd-poly: Applying mobile drag and drop polyfill.");
        document.addEventListener("touchstart", onTouchstart);
    }
    DragDropPolyfill.Initialize = Initialize;
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
        try {
            activeDragOperation = new DragOperationController(e, config, dragTarget, dragOperationEnded);
        }
        catch (err) {
            dragOperationEnded(config, e, 3);
            throw err;
        }
    }
    function tryFindDraggableTarget(event) {
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
    function dragOperationEnded(_config, event, state) {
        if (state === 0) {
            console.log("dnd-poly: Drag never started. Last event was " + event.type);
            if (_config.defaultActionOverride) {
                try {
                    _config.defaultActionOverride(event);
                    if (event.defaultPrevented) {
                        console.log("dnd-poly: defaultActionOverride has taken care of triggering the default action. preventing default on original event");
                    }
                }
                catch (e) {
                    console.log("dnd-poly: error in defaultActionOverride: " + e);
                }
            }
        }
        activeDragOperation = null;
    }
    var ALLOWED_EFFECTS = ["none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all"];
    var DROP_EFFECTS = ["none", "copy", "move", "link"];
    var TRANSFORM_CSS_VENDOR_PREFIXES = ["", "-webkit-"];
    var CLASS_PREFIX = "dnd-poly-";
    var CLASS_DRAG_IMAGE = CLASS_PREFIX + "drag-image";
    var CLASS_DRAG_IMAGE_SNAPBACK = CLASS_PREFIX + "snapback";
    var CLASS_DRAG_OPERATION_ICON = CLASS_PREFIX + "icon";
    var DragOperationController = (function () {
        function DragOperationController(_initialEvent, _config, _sourceNode, _dragOperationEndedCb) {
            this._initialEvent = _initialEvent;
            this._config = _config;
            this._sourceNode = _sourceNode;
            this._dragOperationEndedCb = _dragOperationEndedCb;
            this._dragOperationState = 0;
            this._immediateUserSelection = null;
            this._currentDropTarget = null;
            console.log("dnd-poly: setting up potential drag operation..");
            this._lastTouchEvent = _initialEvent;
            this._initialTouch = _initialEvent.changedTouches[0];
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
            this._dragDataStore = {
                _data: {},
                _effectAllowed: undefined,
                _mode: 3,
                _types: [],
            };
            this._currentHotspotCoordinates = {
                x: null,
                y: null
            };
            this._dragImagePageCoordinates = {
                x: null,
                y: null
            };
            var dragImageSrc = this._sourceNode;
            this._dataTransfer = new DataTransfer(this._dragDataStore, function (element, x, y) {
                dragImageSrc = element;
                if (typeof x === "number" || typeof y === "number") {
                    _this._dragImageOffset = {
                        x: x || 0,
                        y: y || 0
                    };
                }
            });
            this._dragDataStore._mode = 2;
            this._dataTransfer.dropEffect = DROP_EFFECTS[0];
            if (dispatchDragEvent("dragstart", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer)) {
                console.log("dnd-poly: dragstart cancelled");
                this._dragOperationState = 3;
                this._cleanup();
                return false;
            }
            updateCentroidCoordinatesOfTouchesIn("page", this._lastTouchEvent, this._dragImagePageCoordinates);
            this._dragImage = createDragImage(dragImageSrc);
            this._dragImageTransforms = extractTransformStyles(this._dragImage);
            if (!this._dragImageOffset) {
                if (this._config.dragImageOffset) {
                    this._dragImageOffset = {
                        x: this._config.dragImageOffset.x,
                        y: this._config.dragImageOffset.y
                    };
                }
                else if (this._config.dragImageCenterOnTouch) {
                    this._dragImageOffset = {
                        x: 0,
                        y: 0
                    };
                }
                else {
                    var targetRect = dragImageSrc.getBoundingClientRect();
                    var cs = getComputedStyle(dragImageSrc);
                    this._dragImageOffset = {
                        x: targetRect.left - this._initialTouch.clientX - parseInt(cs.marginLeft, 10),
                        y: targetRect.top - this._initialTouch.clientY - parseInt(cs.marginTop, 10)
                    };
                }
            }
            translateDragImage(this._dragImage, this._dragImagePageCoordinates, this._dragImageTransforms, this._dragImageOffset, this._config.dragImageCenterOnTouch);
            document.body.appendChild(this._dragImage);
            this._iterationIntervalId = setInterval(function () {
                if (_this._iterationLock) {
                    console.log("dnd-poly: iteration skipped because previous iteration hast not yet finished.");
                    return;
                }
                _this._iterationLock = true;
                _this._dragAndDropProcessModelIteration();
                _this._iterationLock = false;
            }, this._config.iterationInterval);
            return true;
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
            this._dragOperationEndedCb(this._config, this._lastTouchEvent, this._dragOperationState);
        };
        DragOperationController.prototype._onTouchMove = function (event) {
            var _this = this;
            if (isTouchIdentifierContainedInTouchEvent(event, this._initialTouch.identifier) === false) {
                return;
            }
            this._lastTouchEvent = event;
            if (this._dragOperationState === 0) {
                var startDrag = void 0;
                if (this._config.dragStartConditionOverride) {
                    try {
                        startDrag = this._config.dragStartConditionOverride(event);
                    }
                    catch (e) {
                        console.error("dnd-poly: error in dragStartConditionOverride hook: " + e);
                        startDrag = false;
                    }
                }
                else {
                    startDrag = (event.touches.length === 1);
                }
                if (!startDrag) {
                    this._cleanup();
                    return;
                }
                if (this._setup() === true) {
                    this._initialEvent.preventDefault();
                    event.preventDefault();
                }
                return;
            }
            console.log("dnd-poly: moving draggable..");
            event.preventDefault();
            updateCentroidCoordinatesOfTouchesIn("client", event, this._currentHotspotCoordinates);
            updateCentroidCoordinatesOfTouchesIn("page", event, this._dragImagePageCoordinates);
            if (this._config.dragImageTranslateOverride) {
                try {
                    var handledDragImageTranslate_1 = false;
                    this._config.dragImageTranslateOverride(event, {
                        x: this._currentHotspotCoordinates.x,
                        y: this._currentHotspotCoordinates.y
                    }, this._immediateUserSelection, function (offsetX, offsetY) {
                        if (!_this._dragImage) {
                            return;
                        }
                        handledDragImageTranslate_1 = true;
                        _this._currentHotspotCoordinates.x += offsetX;
                        _this._currentHotspotCoordinates.y += offsetY;
                        _this._dragImagePageCoordinates.x += offsetX;
                        _this._dragImagePageCoordinates.y += offsetY;
                        translateDragImage(_this._dragImage, _this._dragImagePageCoordinates, _this._dragImageTransforms, _this._dragImageOffset, _this._config.dragImageCenterOnTouch);
                    });
                    if (handledDragImageTranslate_1) {
                        return;
                    }
                }
                catch (e) {
                    console.log("dnd-poly: error in dragImageTranslateOverride hook: " + e);
                }
            }
            translateDragImage(this._dragImage, this._dragImagePageCoordinates, this._dragImageTransforms, this._dragImageOffset, this._config.dragImageCenterOnTouch);
        };
        DragOperationController.prototype._onTouchEndOrCancel = function (event) {
            if (isTouchIdentifierContainedInTouchEvent(event, this._initialTouch.identifier) === false) {
                return;
            }
            if (this._config.dragImageTranslateOverride) {
                try {
                    this._config.dragImageTranslateOverride(undefined, undefined, undefined, function () {
                    });
                }
                catch (e) {
                    console.log("dnd-poly: error in dragImageTranslateOverride hook: " + e);
                }
            }
            if (this._dragOperationState === 0) {
                this._cleanup();
                return;
            }
            event.preventDefault();
            this._dragOperationState = (event.type === "touchcancel") ? 3 : 2;
        };
        DragOperationController.prototype._dragAndDropProcessModelIteration = function () {
            var _this = this;
            if (DEBUG) {
                var debug_class = CLASS_PREFIX + "debug", debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection", debug_class_drop_target = CLASS_PREFIX + "current-drop-target";
            }
            var previousDragOperation = this._currentDragOperation;
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
                    applyDragImageSnapback(this._sourceNode, this._dragImage, this._dragImageTransforms, function () {
                        _this._finishDragOperation();
                    });
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
            if (previousDragOperation !== this._currentDragOperation) {
                this._dragImage.classList.remove(CLASS_PREFIX + previousDragOperation);
            }
            var currentDragOperationClass = CLASS_PREFIX + this._currentDragOperation;
            if (this._dragImage.classList.contains(currentDragOperationClass) === false) {
                this._dragImage.classList.add(currentDragOperationClass);
            }
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
    }());
    var DataTransfer = (function () {
        function DataTransfer(_dataStore, _setDragImageHandler) {
            this._dataStore = _dataStore;
            this._setDragImageHandler = _setDragImageHandler;
            this._dropEffect = DROP_EFFECTS[0];
        }
        Object.defineProperty(DataTransfer.prototype, "types", {
            get: function () {
                if (this._dataStore._mode !== 0) {
                    return Object.freeze(this._dataStore._types);
                }
            },
            enumerable: true,
            configurable: true
        });
        DataTransfer.prototype.setData = function (type, data) {
            if (this._dataStore._mode === 2) {
                if (type.indexOf(" ") > -1) {
                    throw new Error("illegal arg: type contains space");
                }
                this._dataStore._data[type] = data;
                if (this._dataStore._types.indexOf(type) === -1) {
                    this._dataStore._types.push(type);
                }
            }
        };
        DataTransfer.prototype.getData = function (type) {
            if (this._dataStore._mode === 1
                || this._dataStore._mode === 2) {
                return this._dataStore._data[type] || "";
            }
        };
        DataTransfer.prototype.clearData = function (format) {
            if (this._dataStore._mode === 2) {
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
            }
        };
        DataTransfer.prototype.setDragImage = function (image, x, y) {
            if (this._dataStore._mode === 2) {
                this._setDragImageHandler(image, x, y);
            }
        };
        Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
            get: function () {
                return this._dataStore._effectAllowed;
            },
            set: function (value) {
                if (this._dataStore._mode === 2
                    && ALLOWED_EFFECTS.indexOf(value) > -1) {
                    this._dataStore._effectAllowed = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "dropEffect", {
            get: function () {
                return this._dropEffect;
            },
            set: function (value) {
                if (this._dataStore._mode !== 0
                    && ALLOWED_EFFECTS.indexOf(value) > -1) {
                    this._dropEffect = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        return DataTransfer;
    }());
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
    function isTouchIdentifierContainedInTouchEvent(newTouch, touchIdentifier) {
        for (var i = 0; i < newTouch.changedTouches.length; i++) {
            var touch = newTouch.changedTouches[i];
            if (touch.identifier === touchIdentifier) {
                return true;
            }
        }
        return false;
    }
    function createDragEventFromTouch(targetElement, e, type, cancelable, window, dataTransfer, relatedTarget) {
        if (relatedTarget === void 0) { relatedTarget = null; }
        var touch = e.changedTouches[0];
        var dndEvent = new Event(type, {
            bubbles: true,
            cancelable: cancelable
        });
        dndEvent.dataTransfer = dataTransfer;
        dndEvent.relatedTarget = relatedTarget;
        dndEvent.screenX = touch.screenX;
        dndEvent.screenY = touch.screenY;
        dndEvent.clientX = touch.clientX;
        dndEvent.clientY = touch.clientY;
        dndEvent.pageX = touch.pageX;
        dndEvent.pageY = touch.pageY;
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
            var cs = getComputedStyle(srcNode);
            for (var i = 0; i < cs.length; i++) {
                var csName = cs[i];
                dstNode.style.setProperty(csName, cs.getPropertyValue(csName), cs.getPropertyPriority(csName));
            }
            dstNode.style.pointerEvents = "none";
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
        dragImage.style.position = "absolute";
        dragImage.style.left = "0px";
        dragImage.style.top = "0px";
        dragImage.style.zIndex = "999999";
        dragImage.classList.add(CLASS_DRAG_IMAGE);
        dragImage.classList.add(CLASS_DRAG_OPERATION_ICON);
        return dragImage;
    }
    function extractTransformStyles(sourceNode) {
        return TRANSFORM_CSS_VENDOR_PREFIXES.map(function (prefix) {
            var transform = sourceNode.style[prefix + "transform"];
            if (!transform || transform === "none") {
                return "";
            }
            return transform.replace(/translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g, "");
        });
    }
    function translateDragImage(dragImage, pnt, originalTransforms, offset, centerOnCoordinates) {
        if (centerOnCoordinates === void 0) { centerOnCoordinates = true; }
        var x = pnt.x, y = pnt.y;
        if (offset) {
            x += offset.x;
            y += offset.y;
        }
        if (centerOnCoordinates) {
            x -= (parseInt(dragImage.offsetWidth, 10) / 2);
            y -= (parseInt(dragImage.offsetHeight, 10) / 2);
        }
        var translate = "translate3d(" + x + "px," + y + "px, 0)";
        for (var i = 0; i < TRANSFORM_CSS_VENDOR_PREFIXES.length; i++) {
            var transformProp = TRANSFORM_CSS_VENDOR_PREFIXES[i] + "transform";
            dragImage.style[transformProp] = translate + " " + originalTransforms[i];
        }
    }
    function applyDragImageSnapback(sourceEl, dragImage, dragImageTransforms, transitionEndCb) {
        var cs = getComputedStyle(sourceEl);
        if (cs.visibility === "hidden" || cs.display === "none") {
            console.log("dnd-poly: source node is not visible. skipping snapback transition.");
            transitionEndCb();
            return;
        }
        console.log("dnd-poly: starting dragimage snap back");
        var rect = sourceEl.getBoundingClientRect();
        var pnt = {
            x: rect.left,
            y: rect.top
        };
        pnt.x += (document.body.scrollLeft || document.documentElement.scrollLeft);
        pnt.y += (document.body.scrollTop || document.documentElement.scrollTop);
        pnt.x -= parseInt(cs.marginLeft, 10);
        pnt.y -= parseInt(cs.marginTop, 10);
        dragImage.classList.add(CLASS_DRAG_IMAGE_SNAPBACK);
        var csDragImage = getComputedStyle(dragImage);
        var durationInS = parseFloat(csDragImage.transitionDuration);
        var delayInS = parseFloat(csDragImage.transitionDelay);
        var durationInMs = Math.round((durationInS + delayInS) * 1000);
        translateDragImage(dragImage, pnt, dragImageTransforms, undefined, false);
        setTimeout(transitionEndCb, durationInMs);
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
})(DragDropPolyfill || (DragDropPolyfill = {}));
//# sourceMappingURL=drag-drop-polyfill.js.map