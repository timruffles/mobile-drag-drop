var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

(function() {
  var DragDrop, average, div, doc, dragDiv, dragstart, evts, getEls, log, needsPatch, onEvt, once, original;
  doc = document;
  log = function() {};
  onEvt = function(el, event, handler) {
    el.addEventListener(event, handler);
    return {
      off: function() {
        return el.removeEventListener(event, handler);
      }
    };
  };
  once = function(el, event, handler) {
    var listener;
    return el.addEventListener(event, listener = function(evt) {
      handler(evt);
      return el.removeEventListener(event, listener);
    });
  };
  average = function(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((function(s, v) {
      return v + s;
    }), 0) / arr.length;
  };
  DragDrop = (function() {

    function DragDrop(event) {
      this.drop = __bind(this.drop, this);
      this.move = __bind(this.move, this);
      var cancel, cleanup, el, end, evt, match, move, transform, x, y, _ref,
        _this = this;
      el = event.currentTarget;
      event.preventDefault();
      log("dragstart");
      this.dragData = {};
      evt = doc.createEvent("Event");
      evt.initEvent("dragstart", true, true);
      evt.dataTransfer = {
        setData: function(type, val) {
          return _this.dragData[type] = val;
        },
        dropEffect: "move"
      };
      el.dispatchEvent(evt);
      cleanup = function() {
        log("cleanup");
        _this.touchPositions = {};
        return [move, end, cancel].forEach(function(handler) {
          return handler.off();
        });
      };
      this.el = el;
      move = onEvt(doc, "touchmove", this.move);
      end = onEvt(doc, "touchend", function(evt) {
        _this.drop(evt);
        return cleanup();
      });
      cancel = onEvt(doc, "touchcancel", cleanup);
      this.touchPositions = {};
      transform = this.el.style["-webkit-transform"];
      _ref = (match = /translate\(\s*(\d+)[^,]*,\D*(\d+)/.exec(transform)) ? [parseInt(match[1]), parseInt(match[2])] : [0, 0], x = _ref[0], y = _ref[1];
      this.elTranslation = {
        x: x,
        y: y
      };
    }

    DragDrop.prototype.move = function(event) {
      var deltas,
        _this = this;
      log("dragmove");
      deltas = [].slice.call(event.changedTouches).reduce(function(deltas, touch, index) {
        var position;
        position = _this.touchPositions[index];
        if (position) {
          deltas.x.push(touch.pageX - position.x);
          deltas.y.push(touch.pageY - position.y);
        } else {
          _this.touchPositions[index] = position = {};
        }
        position.x = touch.pageX;
        position.y = touch.pageY;
        return deltas;
      }, {
        x: [],
        y: []
      });
      this.elTranslation.x += average(deltas.x);
      this.elTranslation.y += average(deltas.y);
      return this.el.style["-webkit-transform"] = "translate(" + this.elTranslation.x + "px," + this.elTranslation.y + "px)";
    };

    DragDrop.prototype.drop = function(event) {
      var evt, next, parent, replacementFn, snapBack, target,
        _this = this;
      evt = doc.createEvent("Event");
      evt.initEvent("drop", true, true);
      evt.dataTransfer = {
        getData: function(type) {
          return _this.dragData[type];
        }
      };
      snapBack = true;
      evt.preventDefault = function() {
        snapBack = false;
        return _this.el.style["-webkit-transform"] = "translate(0,0)";
      };
      once(doc, "drop", function() {
        if (snapBack) {
          once(_this.el, "webkitTransitionEnd", function() {
            return _this.el.style["-webkit-transition"] = "none";
          });
          return setTimeout(function() {
            _this.el.style["-webkit-transition"] = "all 0.2s";
            return _this.el.style["-webkit-transform"] = "translate(0,0)";
          });
        }
      });
      parent = this.el.parentNode;
      replacementFn = (next = this.el.nextSibling) ? function() {
        return parent.insertBefore(_this.el, next);
      } : function() {
        return parent.appendChild(_this.el);
      };
      parent.removeChild(this.el);
      target = document.elementFromPoint(event.changedTouches[0].pageX, event.changedTouches[0].pageY);
      replacementFn();
      if (target) return target.dispatchEvent(evt);
    };

    return DragDrop;

  })();
  getEls = function(el, selector) {
    var _ref;
    if (!selector) _ref = [doc, el], el = _ref[0], selector = _ref[1];
    return [].slice.call(el.querySelectorAll(selector));
  };
  div = document.createElement('div');
  dragDiv = 'draggable' in div;
  evts = 'ondragstart' in div && 'ondrop' in div;
  needsPatch = !(dragDiv || evts) || /iPad|iPhone|iPod/.test(navigator.userAgent);
  log("" + (needsPatch ? "" : "not ") + "patching html5 drag drop");
  if (!needsPatch) return;
  dragstart = function(evt) {
    evt.preventDefault();
    return new DragDrop(evt);
  };
  original = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(attr, val) {
    if (attr === "draggable") {
      log("touchstart handler " + val);
      return this[val ? "addEventListener" : "removeEventListener"]("touchstart", dragstart, true);
    } else {
      return original.call(this, attr, val);
    }
  };
  return doc.addEventListener("DOMContentLoaded", function() {
    return getEls("[draggable]").forEach(function(el) {
      return el.addEventListener("touchstart", dragstart, true);
    });
  });
})();
