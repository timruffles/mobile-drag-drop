
<a name"2.0.0-beta.2"></a>
## 2.0.0-beta.2 (2016-09-13)

* package.json no longer uses `directories.lib` since it had no effect, `main` now points to `release/drag-drop-polyfill.min.js`.

<a name"2.0.0-beta.1"></a>
## 2.0.0-beta.1 (2016-08-20)

### Bugfixes

* bower main-field no longer references minified file. (fixes #70)

* DEBUG variable is declared in the src itself. (fixes #71)

### Breaking changes

* `dragStartConditionOverride` previously was called multiple times for the same touch to decide if a drag-operation should start. This behaviour is deprecated in favor of having a one-time evaluation if a drag operation should start. Deciding after a multiple touch events of the same touch has the risk to break the drag-operation because if the browser started scrolling meanwhile there is no way to stop scrolling so drag operation is broken. If there is a way to reliably stop browser scrolling to let the drag operation overtake it can be discussed to bring the async-way of starting a drag-operation back. If you need to be able to scroll and have drag and drop on the scrollable content think about implementing a dedicated drag handle element.

* `dragImageTranslateOverride` no longer returns a boolean that indicates that `translateDragImageFn` was used to reposition the drag image. This is intended to simplify the API because using `translateDragImageFn` already indicates a translation override implicitly.

### Other changes

* DEBUG conditionals are not removed upon minification since its only 6 bytes more (3 bytes gzipped).
This is also motivated by an upcoming change where the sources will be refactored to ES6 modules and introducing UMD support where the global DEBUG variable will be removed.
Having a magic global DEBUG variable in the ES6 module context feels like a code-smell.

<a name"2.0.0-beta.0"></a>
## 2.0.0-beta.0 (2016-06-25)

First beta-release of a major rewrite aiming to be as close as possible to
the HTML5 drag and drop spec.

More details to the rewrite can be read here https://github.com/timruffles/ios-html5-drag-drop-shim/pull/61

Demos, more documentation and migration notices will be subject of further beta releases.
