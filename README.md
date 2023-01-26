# Spectrogram
Given audio, visualizes as a spectrogram. Provides basic playback controls.

## Development instructions
Clone this repository and run `npm install`.

To start a server:
```
npm run start
```

To build a minified version for production:
```
npm run build
```

The output will be located in `dist/index.bundle.js`.


## Basic Usage
Rename `dist/index.bundle.js` to something like `spectrogram.js`  and it to your project at the end of the body:
```html
<script type="text/javascript" src="spectrogram.js"></script>
```

Then add the custom spectrogram element wherever you would like a spectrogram with `src` set to the audio you want to visualize. 
```html
<spectrogram src="my-audio.mp3"></spectrogram>
```

## Customization
You can customize each `<spectrogram>` element with a number of other attritbutes. For example:

```html
<spectrogram
        src="my-audio.mp3"
      width="600"
     height="300"
   showAxes="false">
</spectrogram>
```

Attribute         |  Default                                    |  Description
---------:        | :------------------------------------------ | :--------------------------------------------
 src              | (required)                                  | path to an audio file
 width            | frequency data length * sizeScale           | width of the spectrogram in pixels
 height           | frequency bin count * sizeScale             | height of the spectrogram in pixels
 widthSizeScale   | (optional)                                  | optional scaling factor for width. Ignored if width is specified. 
 heightSizeScale  | 2                                           | optional scaling factor for height. Ignored if height is specified
 showAxes         | true                                        | false if the time and frequency axis around the spectrogram should be hidden

