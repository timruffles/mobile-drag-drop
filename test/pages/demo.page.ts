export class DemoPage {

    public get header() {

        return browser.element('#wrapper header h1')
    }

    public open():void {

        browser.url('/demo')
    }
}