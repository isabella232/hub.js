'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    // see the README for information on 
    // how to configure this for additional Hub.js packages
    autoImport: {
      alias: {
        // use the es2017 build of Hub.js packages
        '@esri/hub-common': '@esri/hub-common/dist/es2017'
      },
      // live reload on changes to these Hub.js packages
      watchDependencies: ['@esri/hub-common']
    }
  });

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.

  return app.toTree();
};
