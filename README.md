# Broken Picture Phone Archive

[![Build and Deploy](https://github.com/azaky/brokenpicturephone/actions/workflows/build_and_deploy.yml/badge.svg)](https://github.com/azaky/brokenpicturephone/actions/workflows/build_and_deploy.yml)

This is a web app for viewing downloaded games/books of [Broken Picture Phone](https://www.brokenpicturephone.com/).

## Adding New Books

To add new books, simply add the downloaded HTML to the `books` folder.

### Adding Custom Book

You may add your custom book, but we expect (mostly) exact same format as downloaded books from BPP games in order for this site to generate things correctly.

This is the format of the HTML file that we expect:

```html
<html>
  <head>
    Head is ignored, so its content is not important
  </head>
  <body>
    <h1>title - mm/dd/yyyy, HH:MM:SS AM</h1>
    <article>
      <h2>player's Book</h2>
      <section>
        <h3>Page 1, player:</h3>
        <h4>Text here</h4>
        <img src="data:image/png;base64,..." />
      </section>
      <section>... another page goes here</section>
    </article>
    <article>... another book goes here</article>
  </body>
</html>
```

- We expect to find the timestamp in this following order:
  - filename, i.e. `bpp-<timestamp>.html`
  - `<h1>`, see the next point.
- `<body>` must have `<h1>` tag as its first child, with text `{title}, {timestamp}`. Timestamp must have format `mm/dd/yyyy, HH:MM:SS AM`.
- Each book is enclosed within an `<article>` tag.
- Each book must have `<h2>` tag as its first child, with text `{author}'s Book`.
- Each page of a book is enclosed within a `<section>` tag.
- Each page must have `<h3>` tag as its first child, with text `Page {page}, {author}:`.
- `<h4>` in a page represents the text of the page.
- `<img>` in a page represents the image of the page.
  - At the moment, only `base64` image format is supported. [This script](https://github.com/azaky/brokenpicturephone/blob/master/scripts/base64.js) can be used to generate `base64` from image urls.
- Each page may have either text, image, or both. But each page must have at least one of them.

See [existing books](https://github.com/azaky/brokenpicturephone/tree/master/books) for reference. [This](https://github.com/azaky/brokenpicturephone/blob/master/books/gp-1622470716184.html) is an example of a custom book from Gartic Phone.

## Developing

This app is built with [Create-React-App](https://create-react-app.dev/). Node JS 14+ is required for developing, as we use [optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining).

1. Install Dependency

   ```bash
   npm install
   ```

2. Generate Manifest and Images

   Before starting the developing the web app, we need to process the files in `books` to another format more digestible by the app.

   ```bash
   npm run gen-manifest
   ```

   What it does:
   - Generate file `src/manifest.json` consisting the details of all games.
   - Export the images to `public/images` directory. Images will be compressed into 600px-wide JPEG (with [sharp](https://github.com/lovell/sharp)), and the first image of the book will be separately resized to 200px-wide JPEG as thumbnail.
   - Check for duplicates via the hashes of the images and texts. Note that files with the same set of books, but reordered, will have different hashes, and therefore will be regarded as different.
   - Sort the games based on the timestamp, latest games first.

   You only need to run it once. If you add another book, you can re-run it again. The script will be able to update the existing manifest incrementally.

3. Start the Development Server

   ```bash
   npm start
   ```

   You can access the web app at `http://localhost:3000`.

   If you need to add another book in the middle of development, you can run `npm run gen-manifest` again (in a separate terminal). The web app will automatically reload.

## Deploying

```bash
export PUBLIC_URL=https://app.azaky.io/bpp
npm ci
npm run build # it runs gen-manifest automatically
```
