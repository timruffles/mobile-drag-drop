(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  (function() {
    var DEBUG, DragDrop, ERROR, INFO, LOG_LEVEL, VERBOSE, average, div, doc, dragDiv, dragstart, evts, getEls, log, needsPatch, noop, onEvt, once, original;
    VERBOSE = 3;
    DEBUG = 2;
    INFO = 1;
    ERROR = 0;
    LOG_LEVEL = 1;
    doc = document;
    noop = function() {};
    log = noop || function(msg, level) {
      if (level == null) {
        level = ERROR;
      }
      if (level <= LOG_LEVEL) {
        return console.log(msg);
      }
    };
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
      if (arr.length === 0) {
        return 0;
      }
      return arr.reduce((function(s, v) {
        return v + s;
      }), 0) / arr.length;
    };
    DragDrop = (function() {
      function DragDrop(event) {
        this.drop = __bind(this.drop, this);
        this.move = __bind(this.move, this);        var cancel, cleanup, el, end, evt, match, move, transform, x, y, _ref;
        el = event.target;
        event.preventDefault();
        log("dragstart");
        this.dragData = {};
        evt = doc.createEvent("Event");
        evt.initEvent("dragstart", true, true);
        evt.dataTransfer = {
          setData: __bind(function(type, val) {
            return this.dragData[type] = val;
          }, this),
          dropEffect: "move"
        };
        el.dispatchEvent(evt);
        cleanup = __bind(function() {
          log("cleanup");
          this.touchPositions = {};
          return [move, end, cancel].forEach(function(handler) {
            return handler.off();
          });
        }, this);
        this.el = el;
        this.touchPositions = {};
        transform = this.el.style["-webkit-transform"];
        _ref = (match = /translate\(\s*(\d+)[^,]*,\D*(\d+)/.exec(transform)) ? [parseInt(match[1]), parseInt(match[2])] : [0, 0], x = _ref[0], y = _ref[1];
        this.elTranslation = {
          x: x,
          y: y
        };
        move = onEvt(doc, "touchmove", this.move);
        end = onEvt(doc, "touchend", __bind(function(evt) {
          this.drop(evt);
          return cleanup();
        }, this));
        cancel = onEvt(doc, "touchcancel", cleanup);
      }
      DragDrop.prototype.move = function(event) {
        var deltas;
        log("dragmove", VERBOSE);
        deltas = [].slice.call(event.changedTouches).reduce(__bind(function(deltas, touch, index) {
          var position;
          position = this.touchPositions[index];
          if (position) {
            deltas.x.push(touch.pageX - position.x);
            deltas.y.push(touch.pageY - position.y);
          } else {
            this.touchPositions[index] = position = {};
          }
          position.x = touch.pageX;
          position.y = touch.pageY;
          return deltas;
        }, this), {
          x: [],
          y: []
        });
        this.elTranslation.x += average(deltas.x);
        this.elTranslation.y += average(deltas.y);
        return this.el.style["-webkit-transform"] = "translate(" + this.elTranslation.x + "px," + this.elTranslation.y + "px)";
      };
      DragDrop.prototype.drop = function(event) {
        var evt, next, parent, replacementFn, snapBack, target;
        evt = doc.createEvent("Event");
        evt.initEvent("drop", true, true);
        evt.dataTransfer = {
          getData: __bind(function(type) {
            return this.dragData[type];
          }, this)
        };
        snapBack = true;
        evt.preventDefault = __bind(function() {
          snapBack = false;
          return this.el.style["-webkit-transform"] = "translate(0,0)";
        }, this);
        once(doc, "drop", __bind(function() {
          if (snapBack) {
            once(this.el, "webkitTransitionEnd", __bind(function() {
              return this.el.style["-webkit-transition"] = "none";
            }, this));
            return setTimeout(__bind(function() {
              this.el.style["-webkit-transition"] = "all 0.2s";
              return this.el.style["-webkit-transform"] = "translate(0,0)";
            }, this));
          }
        }, this));
        parent = this.el.parentNode;
        replacementFn = (next = this.el.nextSibling) ? __bind(function() {
          return parent.insertBefore(this.el, next);
        }, this) : __bind(function() {
          return parent.appendChild(this.el);
        }, this);
        parent.removeChild(this.el);
        target = document.elementFromPoint(event.changedTouches[0].pageX, event.changedTouches[0].pageY);
        replacementFn();
        if (target) {
          return target.dispatchEvent(evt);
        }
      };
      return DragDrop;
    })();
    getEls = function(el, selector) {
      var _ref;
      if (!selector) {
        _ref = [doc, el], el = _ref[0], selector = _ref[1];
      }
      return [].slice.call(el.querySelectorAll(selector));
    };
    div = document.createElement('div');
    dragDiv = 'draggable' in div;
    evts = 'ondragstart' in div && 'ondrop' in div;
    needsPatch = !(dragDiv || evts) || /iPad|iPhone|iPod/.test(navigator.userAgent);
    log("" + (needsPatch ? "" : "not ") + "patching html5 drag drop");
    if (!needsPatch) {
      return;
    }
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
      return doc.addEventListener("touchstart", function(evt) {
        if (evt.target.draggable) {
          return dragstart(evt);
        }
      });
    });
  })();
}).call(this);
