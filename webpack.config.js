const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    index: './src/index.js',
  },
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    hot: true,
    open: true,
    watchFiles: ['src/*'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      }
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Solitaire sound exploration',
      template: 'src/index.html',
    }),
  ],
};
