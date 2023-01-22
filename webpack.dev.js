const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    hot: true,
    open: true,
    watchFiles: ['src/*'],
    allowedHosts: [
      // Add your computer hostname for testing on other devices.
      'aveland.local',
    ],
  },
});