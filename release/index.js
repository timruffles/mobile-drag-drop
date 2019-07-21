(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.MobileDragDrop = global.MobileDragDrop || {})));
}(this, (function (exports) { 'use strict';

var CLASS_PREFIX = "dnd-poly-";
var CLASS_DRAG_IMAGE = CLASS_PREFIX + "drag-image";
var CLASS_DRAG_IMAGE_SNAPBACK = CLASS_PREFIX + "snapback";
var CLASS_DRAG_OPERATION_ICON = CLASS_PREFIX + "icon";
var EVENT_PREFIX = "dnd-poly-";
var EVENT_DRAG_DRAGSTART_PENDING = EVENT_PREFIX + "dragstart-pending";
var EVENT_DRAG_DRAGSTART_CANCEL = EVENT_PREFIX + "dragstart-cancel";
var ALLOWED_EFFECTS = ["none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all"];
var DROP_EFFECTS = ["none", "copy", "move", "link"];

function detectFeatures() {
    var features = {
        dragEvents: ("ondragstart" in document.documentElement),
        draggable: ("draggable" in document.documentElement),
        userAgentSupportingNativeDnD: undefined
    };
    var isBlinkEngine = !!(window.chrome) || /chrome/i.test(navigator.userAgent);
    features.userAgentSupportingNativeDnD = !((/iPad|iPhone|iPod|Android/.test(navigator.userAgent))
        ||
            (isBlinkEngine && ("ontouchstart" in document.documentElement)));
    return features;
}
function supportsPassiveEventListener() {
    var supportsPassiveEventListeners = false;
    try {
        var opts = Object.defineProperty({}, "passive", {
            get: function () {
                supportsPassiveEventListeners = true;
            }
        });
        window.addEventListener("test", null, opts);
    }
    catch (e) {
    }
    return supportsPassiveEventListeners;
}

var supportsPassive = supportsPassiveEventListener();
function isDOMElement(object) {
    return object && object.tagName;
}
function addDocumentListener(ev, handler, passive) {
    if (passive === void 0) { passive = true; }
    document.addEventListener(ev, handler, supportsPassive ? { passive: passive } : false);
}
function removeDocumentListener(ev, handler) {
    document.removeEventListener(ev, handler);
}
function onEvt(el, event, handler, capture) {
    if (capture === void 0) { capture = false; }
    var options = supportsPassive ? { passive: true, capture: capture } : capture;
    el.addEventListener(event, handler, options);
    return {
        off: function () {
            el.removeEventListener(event, handler, options);
        }
    };
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
        if (dstNode.nodeName === "CANVAS") {
            var canvasSrc = srcNode;
            var canvasDst = dstNode;
            var canvasSrcImgData = canvasSrc.getContext("2d").getImageData(0, 0, canvasSrc.width, canvasSrc.height);
            canvasDst.getContext("2d").putImageData(canvasSrcImgData, 0, 0);
        }
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
    return dragImage;
}
function average(array) {
    if (array.length === 0) {
        return 0;
    }
    return array.reduce((function (s, v) {
        return v + s;
    }), 0) / array.length;
}
function isTouchIdentifierContainedInTouchEvent(touchEvent, touchIdentifier) {
    for (var i = 0; i < touchEvent.changedTouches.length; i++) {
        var touch = touchEvent.changedTouches[i];
        if (touch.identifier === touchIdentifier) {
            return true;
        }
    }
    return false;
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
var TRANSFORM_CSS_VENDOR_PREFIXES = ["", "-webkit-"];
function extractTransformStyles(sourceNode) {
    return TRANSFORM_CSS_VENDOR_PREFIXES.map(function (prefix) {
        var transform = sourceNode.style[prefix + "transform"];
        if (!transform || transform === "none") {
            return "";
        }
        return transform.replace(/translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g, "");
    });
}
function translateElementToPoint(element, pnt, originalTransforms, offset, centerOnCoordinates) {
    if (centerOnCoordinates === void 0) { centerOnCoordinates = true; }
    var x = pnt.x, y = pnt.y;
    if (offset) {
        x += offset.x;
        y += offset.y;
    }
    if (centerOnCoordinates) {
        x -= (parseInt(element.offsetWidth, 10) / 2);
        y -= (parseInt(element.offsetHeight, 10) / 2);
    }
    var translate = "translate3d(" + x + "px," + y + "px, 0)";
    for (var i = 0; i < TRANSFORM_CSS_VENDOR_PREFIXES.length; i++) {
        var transformProp = TRANSFORM_CSS_VENDOR_PREFIXES[i] + "transform";
        element.style[transformProp] = translate + " " + originalTransforms[i];
    }
}
function applyDragImageSnapback(sourceEl, dragImage, dragImageTransforms, transitionEndCb) {
    var cs = getComputedStyle(sourceEl);
    if (cs.visibility === "hidden" || cs.display === "none") {
        console.log("dnd-poly: source node is not visible. skipping snapback transition.");
        transitionEndCb();
        return;
    }
    dragImage.classList.add(CLASS_DRAG_IMAGE_SNAPBACK);
    var csDragImage = getComputedStyle(dragImage);
    var durationInS = parseFloat(csDragImage.transitionDuration);
    if (isNaN(durationInS) || durationInS === 0) {
        console.log("dnd-poly: no transition used - skipping snapback");
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
    var delayInS = parseFloat(csDragImage.transitionDelay);
    var durationInMs = Math.round((durationInS + delayInS) * 1000);
    translateElementToPoint(dragImage, pnt, dragImageTransforms, undefined, false);
    setTimeout(transitionEndCb, durationInMs);
}

var DataTransfer = (function () {
    function DataTransfer(_dataStore, _setDragImageHandler) {
        this._dataStore = _dataStore;
        this._setDragImageHandler = _setDragImageHandler;
        this._dropEffect = DROP_EFFECTS[0];
    }
    Object.defineProperty(DataTransfer.prototype, "dropEffect", {
        get: function () {
            return this._dropEffect;
        },
        set: function (value) {
            if (this._dataStore.mode !== 0
                && ALLOWED_EFFECTS.indexOf(value) > -1) {
                this._dropEffect = value;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DataTransfer.prototype, "types", {
        get: function () {
            if (this._dataStore.mode !== 0) {
                return Object.freeze(this._dataStore.types);
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
        get: function () {
            return this._dataStore.effectAllowed;
        },
        set: function (value) {
            if (this._dataStore.mode === 2
                && ALLOWED_EFFECTS.indexOf(value) > -1) {
                this._dataStore.effectAllowed = value;
            }
        },
        enumerable: true,
        configurable: true
    });
    DataTransfer.prototype.setData = function (type, data) {
        if (this._dataStore.mode === 2) {
            if (type.indexOf(" ") > -1) {
                throw new Error("illegal arg: type contains space");
            }
            this._dataStore.data[type] = data;
            if (this._dataStore.types.indexOf(type) === -1) {
                this._dataStore.types.push(type);
            }
        }
    };
    DataTransfer.prototype.getData = function (type) {
        if (this._dataStore.mode === 1
            || this._dataStore.mode === 2) {
            return this._dataStore.data[type] || "";
        }
    };
    DataTransfer.prototype.clearData = function (format) {
        if (this._dataStore.mode === 2) {
            if (format && this._dataStore.data[format]) {
                delete this._dataStore.data[format];
                var index = this._dataStore.types.indexOf(format);
                if (index > -1) {
                    this._dataStore.types.splice(index, 1);
                }
                return;
            }
            this._dataStore.data = {};
            this._dataStore.types = [];
        }
    };
    DataTransfer.prototype.setDragImage = function (image, x, y) {
        if (this._dataStore.mode === 2) {
            this._setDragImageHandler(image, x, y);
        }
    };
    return DataTransfer;
}());

function tryFindDraggableTarget(event) {
    var el = event.target;
    do {
        if (el.draggable === false) {
            continue;
        }
        if (el.draggable === true) {
            return el;
        }
        if (el.getAttribute
            && el.getAttribute("draggable") === "true") {
            return el;
        }
    } while ((el = el.parentNode) && el !== document.body);
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
function dispatchDragEvent(dragEvent, targetElement, touchEvent, dataStore, dataTransfer, cancelable, relatedTarget) {
    if (cancelable === void 0) { cancelable = true; }
    if (relatedTarget === void 0) { relatedTarget = null; }
    console.log("dnd-poly: dispatching " + dragEvent);
    var leaveEvt = createDragEventFromTouch(targetElement, touchEvent, dragEvent, cancelable, document.defaultView, dataTransfer, relatedTarget);
    var cancelled = !targetElement.dispatchEvent(leaveEvt);
    dataStore.mode = 0;
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
        addDocumentListener("touchmove", this._touchMoveHandler, false);
        addDocumentListener("touchend", this._touchEndOrCancelHandler, false);
        addDocumentListener("touchcancel", this._touchEndOrCancelHandler, false);
    }
    DragOperationController.prototype._setup = function () {
        var _this = this;
        console.log("dnd-poly: starting drag and drop operation");
        this._dragOperationState = 1;
        this._currentDragOperation = DROP_EFFECTS[0];
        this._dragDataStore = {
            data: {},
            effectAllowed: undefined,
            mode: 3,
            types: [],
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
        this._dragDataStore.mode = 2;
        this._dataTransfer.dropEffect = DROP_EFFECTS[0];
        if (dispatchDragEvent("dragstart", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer)) {
            console.log("dnd-poly: dragstart cancelled");
            this._dragOperationState = 3;
            this._cleanup();
            return false;
        }
        updateCentroidCoordinatesOfTouchesIn("page", this._lastTouchEvent, this._dragImagePageCoordinates);
        var dragImage = this._config.dragImageSetup(dragImageSrc);
        this._dragImageTransforms = extractTransformStyles(dragImage);
        dragImage.style.position = "absolute";
        dragImage.style.left = "0px";
        dragImage.style.top = "0px";
        dragImage.style.zIndex = "999999";
        dragImage.classList.add(CLASS_DRAG_IMAGE);
        dragImage.classList.add(CLASS_DRAG_OPERATION_ICON);
        this._dragImage = dragImage;
        if (!this._dragImageOffset) {
            if (this._config.dragImageOffset) {
                this._dragImageOffset = {
                    x: this._config.dragImageOffset.x,
                    y: this._config.dragImageOffset.y
                };
            }
            else if (this._config.dragImageCenterOnTouch) {
                var cs = getComputedStyle(dragImageSrc);
                this._dragImageOffset = {
                    x: 0 - parseInt(cs.marginLeft, 10),
                    y: 0 - parseInt(cs.marginTop, 10)
                };
            }
            else {
                var targetRect = dragImageSrc.getBoundingClientRect();
                var cs = getComputedStyle(dragImageSrc);
                this._dragImageOffset = {
                    x: targetRect.left - this._initialTouch.clientX - parseInt(cs.marginLeft, 10) + targetRect.width / 2,
                    y: targetRect.top - this._initialTouch.clientY - parseInt(cs.marginTop, 10) + targetRect.height / 2
                };
            }
        }
        translateElementToPoint(this._dragImage, this._dragImagePageCoordinates, this._dragImageTransforms, this._dragImageOffset, this._config.dragImageCenterOnTouch);
        document.body.appendChild(this._dragImage);
        this._iterationIntervalId = window.setInterval(function () {
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
        removeDocumentListener("touchmove", this._touchMoveHandler);
        removeDocumentListener("touchend", this._touchEndOrCancelHandler);
        removeDocumentListener("touchcancel", this._touchEndOrCancelHandler);
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
                    translateElementToPoint(_this._dragImage, _this._dragImagePageCoordinates, _this._dragImageTransforms, _this._dragImageOffset, _this._config.dragImageCenterOnTouch);
                });
                if (handledDragImageTranslate_1) {
                    return;
                }
            }
            catch (e) {
                console.log("dnd-poly: error in dragImageTranslateOverride hook: " + e);
            }
        }
        translateElementToPoint(this._dragImage, this._dragImagePageCoordinates, this._dragImageTransforms, this._dragImageOffset, this._config.dragImageCenterOnTouch);
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
        var previousDragOperation = this._currentDragOperation;
        this._dragDataStore.mode = 3;
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
        var newUserSelection = this._config.elementFromPoint(this._currentHotspotCoordinates.x, this._currentHotspotCoordinates.y);
        console.log("dnd-poly: new immediate user selection is: " + newUserSelection);
        var previousTargetElement = this._currentDropTarget;
        if (newUserSelection !== this._immediateUserSelection && newUserSelection !== this._currentDropTarget) {
            this._immediateUserSelection = newUserSelection;
            if (this._currentDropTarget !== null) {
                this._dragDataStore.mode = 3;
                this._dataTransfer.dropEffect = DROP_EFFECTS[0];
                dispatchDragEvent("dragexit", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
            }
            if (this._immediateUserSelection === null) {
                this._currentDropTarget = this._immediateUserSelection;
                console.log("dnd-poly: current drop target changed to null");
            }
            else {
                this._dragDataStore.mode = 3;
                this._dataTransfer.dropEffect = determineDropEffect(this._dragDataStore.effectAllowed, this._sourceNode);
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
            console.log("dnd-poly: current drop target changed.");
            this._dragDataStore.mode = 3;
            this._dataTransfer.dropEffect = DROP_EFFECTS[0];
            dispatchDragEvent("dragleave", previousTargetElement, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false, this._currentDropTarget);
        }
        if (isDOMElement(this._currentDropTarget)) {
            this._dragDataStore.mode = 3;
            this._dataTransfer.dropEffect = determineDropEffect(this._dragDataStore.effectAllowed, this._sourceNode);
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
        this._dragImage.classList.add(currentDragOperationClass);
    };
    DragOperationController.prototype._dragOperationEnded = function (state) {
        console.log("dnd-poly: drag operation end detected with " + this._currentDragOperation);
        var dragFailed = (this._currentDragOperation === DROP_EFFECTS[0]
            || this._currentDropTarget === null
            || state === 3);
        if (dragFailed) {
            if (isDOMElement(this._currentDropTarget)) {
                this._dragDataStore.mode = 3;
                this._dataTransfer.dropEffect = DROP_EFFECTS[0];
                dispatchDragEvent("dragleave", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
            }
        }
        else {
            if (isDOMElement(this._currentDropTarget)) {
                this._dragDataStore.mode = 1;
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
        this._dragDataStore.mode = 3;
        this._dataTransfer.dropEffect = this._currentDragOperation;
        dispatchDragEvent("dragend", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
        this._dragOperationState = 2;
        this._cleanup();
    };
    return DragOperationController;
}());

var config = {
    iterationInterval: 150,
    tryFindDraggableTarget: tryFindDraggableTarget,
    dragImageSetup: createDragImage,
    elementFromPoint: function (x, y) { return document.elementFromPoint(x, y); }
};
var activeDragOperation;
function onTouchstart(e) {
    console.log("dnd-poly: global touchstart");
    if (activeDragOperation) {
        console.log("dnd-poly: drag operation already active");
        return;
    }
    var dragTarget = config.tryFindDraggableTarget(e);
    if (!dragTarget) {
        console.log("dnd-poly: no draggable at touchstart coordinates");
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
function onDelayTouchstart(evt) {
    console.log("dnd-poly: setup delayed dragstart..");
    var el = evt.target;
    var heldItem = function () {
        console.log("dnd-poly: starting delayed drag..");
        end.off();
        cancel.off();
        move.off();
        scroll.off();
        onTouchstart(evt);
    };
    var onReleasedItem = function (event) {
        console.log("dnd-poly: aborting delayed drag because of " + event.type);
        end.off();
        cancel.off();
        move.off();
        scroll.off();
        if (el) {
            el.dispatchEvent(new CustomEvent(EVENT_DRAG_DRAGSTART_CANCEL, { bubbles: true, cancelable: true }));
        }
        clearTimeout(timer);
    };
    if (el) {
        el.dispatchEvent(new CustomEvent(EVENT_DRAG_DRAGSTART_PENDING, { bubbles: true, cancelable: true }));
    }
    var timer = window.setTimeout(heldItem, config.holdToDrag);
    var end = onEvt(el, "touchend", onReleasedItem);
    var cancel = onEvt(el, "touchcancel", onReleasedItem);
    var move = onEvt(el, "touchmove", onReleasedItem);
    var scroll = onEvt(window, "scroll", onReleasedItem, true);
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
function polyfill(override) {
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
            return false;
        }
    }
    console.log("dnd-poly: Applying mobile drag and drop polyfill.");
    if (config.holdToDrag) {
        console.log("dnd-poly: holdToDrag set to " + config.holdToDrag);
        addDocumentListener("touchstart", onDelayTouchstart, false);
    }
    else {
        addDocumentListener("touchstart", onTouchstart, false);
    }
    return true;
}

exports.polyfill = polyfill;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.js.map
