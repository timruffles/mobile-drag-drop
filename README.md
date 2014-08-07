# iOS shim for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop
with the same code on [most desktop browsers](http://caniuse.com/#search=drag). Unfortunately, you'll notice iOS doesn't support it, so no iPad (or Android) action for you!

Luckily, WebKit gives us enough tools to shim seamlessly. If you drop
this script in your page your existing HTML 5 drag'n'drop code should
just work.

## Demos

- [drag drop](./demo)
- [drag drop with enter leave support](./enter-leave)

Check out the demo to see it in action. It should work on Android, but I
don't have an Android phone to test. Let me know <a
href="http://twitter.com/timruffles">@timruffles</a>.

## Install/config

If you want enter/leave events, add a config object to the page before you include the shim.

```html
<script>
var iosDragDropShim = { enableEnterLeave: true }
</script>
<script src="vendor/ios-drag-drop.js"></script>
```

## Thanks

<a href="http://twitter.com/rem">@rem</a> - who created the original demo used to demo this shim's
drop-in nature.

## License

[MIT License](LICENSE)
