const path = require('path');

module.exports = {
  entry: {
    index: './src/index.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '',
  },
  module: {
    rules: [
      {
        test: /\.html$/i,
        use: 'html-loader',
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(svg)$/i,
        type: 'asset/inline',
      },
      {
        test: /\.(wav|mp3|ogg)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(wav|mp3|ogg)$/i,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: '/audio/'
          }
        }]
      },
    ],
  },
};
