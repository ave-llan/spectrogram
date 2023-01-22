const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Spectrogram tool',
      template: 'src/index.html',
    }),
  ],
});