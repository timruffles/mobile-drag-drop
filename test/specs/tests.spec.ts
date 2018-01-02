import {expect} from 'chai';
import {DemoPage} from "../pages/demo.page";

describe('demo', () => {

    const demoPage = new DemoPage();

    it('should work', () => {

        demoPage.open();

        expect(demoPage.header.getText()).to.contain('mobile-drag-drop');
    });
});
