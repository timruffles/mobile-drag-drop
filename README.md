# iOS shim for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop
with the same code on [most desktop browsers](http://caniuse.com/#search=drag). Unfortunately, you'll notice iOS doesn't support it, so no iPad (or Android) action for you!

Luckily, WebKit gives us enough tools to shim seamlessly. If you drop
this script in your page your existing HTML 5 drag'n'drop code should
just work.

## Demos

- [drag drop](http://timruffles.github.io/ios-html5-drag-drop-shim/demo/)
- [drag drop with enter leave support](http://timruffles.github.io/ios-html5-drag-drop-shim/enter-leave/)

Check out the demo to see it in action. It also [works on Android](https://twitter.com/TheFabulousMac/status/765913850151567360).

## Install/config

If you want enter/over/leave events, add a config object to the page before you include the shim.

```html
<script>
var iosDragDropShim = { enableEnterLeave: true }
</script>
<script src="vendor/ios-drag-drop.js"></script>
```
If you want to the user to hold to drag, add a config object to the page before you include the shim.

```html
<script>
var iosDragDropShim = { holdToDrag: 300 } //Adds 300ms delay before draging
</script>
<script src="vendor/ios-drag-drop.js"></script>
```

By default the shim will simulate a mouseclick when a user touches an anchor.  See [here](https://www.html5rocks.com/en/mobile/touchandmouse/#toc-1) for more details.  Sometimes we want to disable that functionality since it can lead to unintended clicks during a scroll, and you may have other libraries in place to ensure the appropriate response. You can do that by setting the 'simulateAnchorClick' option to 'false'.

```html
<script>
var iosDragDropShim = { simulateAnchorClick: false }
</script>
<script src="vendor/ios-drag-drop.js"></script>
```

To match the HTML5 and and drop spec, links and images are implicitly treated as draggable. You can turn off this behavior by setting 'requireExplicitDraggable' to 'true'.  This way, only elements with the `draggable` attribute set to `true` will be draggable.

```html
<script>
var iosDragDropShim = { requireExplicitDraggable: true }
</script>
<script src="vendor/ios-drag-drop.js"></script>
```

With npm:
```shell
npm install --save drag-drop-webkit-mobile
```

```javascript
var iosDragDropShim = require('drag-drop-webkit-mobile');
// options are optional ;)
iosDragDropShim(options);
```

#### Known issues

iOS10 introduced a regression on `touchmove` handling where `event.preventDefault()` is not respected.

If you run into a situation where dragging and scrolling occur simultaneously apply the fix mentioned in [#77](https://github.com/timruffles/ios-html5-drag-drop-shim/issues/77).

## Shim behaviour

- all drag events, with `dragenter`, `dragover` and `dragleave` enabled via config flag
- creates a partially transparent drag image based on the dragged element

## Thanks

To the [amazing contributors](https://github.com/timruffles/ios-html5-drag-drop-shim/graphs/contributors) who've provided massive extensions and fixes to the original.

<a href="http://twitter.com/rem">@rem</a> - who created the original demo used to demo this shim's
drop-in nature.

## License

[MIT License](LICENSE)
