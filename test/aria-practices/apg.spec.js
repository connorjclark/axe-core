const path = require('path');
const fs = require('fs');
const chromedriver = require('chromedriver');
const AxeBuilder = require('@axe-core/webdriverjs');
const { getWebdriver, connectToChromeDriver } = require('./run-server');
const { assert } = require('chai');
const globby = require('globby');

describe('aria-practices', function () {
  // Use path.resolve rather than require.resolve because APG has no package.json
  const apgPath = path.resolve(__dirname, '../../node_modules/aria-practices/');
  const filePaths = globby.sync(`${apgPath}/examples/**/*.html`)
  const testFiles = filePaths.map(fileName => fileName.split('/aria-practices/examples/')[1])
  const port = 9515;
  const addr = `http://localhost:9876/node_modules/aria-practices/`;
  let driver, axeSource;
  this.timeout(50000);
  this.retries(3);

  before(async () => {
    const axePath = require.resolve('../../axe.js');
    axeSource = fs.readFileSync(axePath, 'utf8');
    chromedriver.start([`--port=${port}`]);
    await new Promise(r => setTimeout(r, 500));
    await connectToChromeDriver(port);
    driver = getWebdriver();
  });

  after(async () => {
    await driver.close();
    chromedriver.stop();
  });

  const disabledRules = {
    '*': [
      'color-contrast',
      'region', // dequelabs/axe-core#3260
      'heading-order', // w3c/aria-practices#2119
      'list', // w3c/aria-practices#2118
      'scrollable-region-focusable', // w3c/aria-practices#2114
    ],
    'feed/feedDisplay.html': ['page-has-heading-one'], // w3c/aria-practices#2120
    // "page within a page" type thing going on
    'menubar/menubar-navigation.html': [
      'aria-allowed-role',
      'landmark-banner-is-top-level',
      'landmark-contentinfo-is-top-level',
    ],
    // "page within a page" type thing going on
    'treeview/treeview-navigation.html': [
      'aria-allowed-role',
      'landmark-banner-is-top-level',
      'landmark-contentinfo-is-top-level'
    ]
  }

  // Not an actual content file
  const skippedPages = [
    'index.html', // Not an example, just an index file
    'js/notice.html', // Embedded into another page
    'toolbar/help.html' // Embedded into another page
  ];

  testFiles.filter(filePath => !skippedPages.includes(filePath)).forEach(filePath => {
    it(`finds no issue in "${filePath}"`, async () => {
      await driver.get(`${addr}/examples/${filePath}`);
      
      const builder = new AxeBuilder(driver, axeSource);
      builder.disableRules([
        ...disabledRules['*'],
        ...(disabledRules[filePath] || []),
      ]);
      
      const { violations } = await builder.analyze();
      const issues = violations.map(({ id, nodes }) => ({ id, issues: nodes.length }))
      assert.lengthOf(issues, 0);
    });
  });
});
