const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

const sharp = require("sharp");
const { JSDOM } = require("jsdom");

const getHash = (text) => createHash("sha256").update(text).digest("hex");

const booksDirectory = path.join(__dirname, "../books");
const imagesDirectory = path.join(__dirname, "../public/images");
const targetFilename = path.join(__dirname, "../src/manifest.json");

if (!fs.existsSync(imagesDirectory)) {
  fs.mkdirSync(imagesDirectory, { recursive: true });
}

let previousManifest = [];
if (fs.existsSync(targetFilename)) {
  previousManifest = JSON.parse(fs.readFileSync(targetFilename, "utf8"));
}

const parseFile = async (filename) => {
  console.log(`Parsing file ${filename} ...`);

  const id = path.parse(filename).name;

  const previousData = previousManifest.find((data) => data.id === id);
  if (previousData) {
    let imagesExist = true,
      missingImage = "";
    for (const book of previousData.books) {
      for (const page of book.pages) {
        if (
          page.image &&
          !fs.existsSync(path.join(imagesDirectory, page.image))
        ) {
          imagesExist = false;
          missingImage = page.image;
          break;
        }
      }
      if (!imagesExist) break;
    }
    if (imagesExist) {
      console.log(
        `Skipping file ${filename}: importing from the previous manifest`
      );
      return previousData;
    } else {
      console.warn(
        `File ${filename}: previous manifest exists but image ${missingImage} missing. Will re-parse the whole file`
      );
    }
  }

  const dom = await JSDOM.fromFile(path.join(booksDirectory, filename));

  const titleEl = dom.window.document.body.firstElementChild;
  if (titleEl.tagName !== "H1") {
    console.warn(
      `File ${filename}: Skipping, expected H1 first element, got ${titleEl.tagName}`
    );
    return null;
  }
  const title = titleEl.textContent;

  // Attempt to parse timestamp, first from filename, then attempt parse from page title.
  let timestamp = parseFloat(/\d{13}/.exec(filename)?.[0]);
  if (!timestamp) {
    const titleTimestamp = /\d+\/\d+\/\d+,\s+\d+\:\d+\:\d+\s+[A|P]M/.exec(
      title
    )?.[0];
    if (titleTimestamp) {
      timestamp = Date.parse(titleTimestamp);
    }
  }
  if (!timestamp) {
    console.warn(
      `File ${filename}: Skipping, invalid timestamp, filename and page title are invalid (filename = ${filename}, title = ${title})`
    );
    return null;
  }

  const articles = dom.window.document.getElementsByTagName("article");
  const booksPromises = [...articles].map(async (article, i) => {
    const bookTitleEl = article.firstElementChild;
    if (bookTitleEl.tagName !== "H2") {
      console.log(
        `File ${filename}: Skipping book ${
          i + 1
        }, expected h2 first element, got ${bookTitleEl.tagName}`
      );
      return null;
    }
    const bookTitle = bookTitleEl.textContent;
    const bookAuthor = /(.+)'s Book/.exec(bookTitle)[1] || null;

    const sections = article.getElementsByTagName("section");
    const pagesPromises = [...sections].map(async (section, j) => {
      let index = j + 1,
        author = null,
        text = null,
        image = null,
        imageHash = null;
      const h3 = section.getElementsByTagName("h3")[0];
      const h4 = section.getElementsByTagName("h4")[0];
      const img = section.getElementsByTagName("img")[0];
      if (h3) {
        const matches = /Page (\d+), (.*)\:/.exec(h3.textContent);
        if (matches) {
          index = parseInt(matches[1], 10);
          author = matches[2];
        }
      }
      if (h4) {
        text = h4.textContent;
      }
      if (img) {
        const data = img.src;
        if (!data.startsWith("data:image/")) {
          console.log(
            `File ${filename}: Book [${bookTitle}]: Skipping page ${index} image, expected base64 format, got url ${data}`
          );
        } else {
          try {
            const imageFilename = `${id}-${bookAuthor}-${index}${
              author ? `-${author}` : ""
            }.jpg`;
            const imagePath = path.join(imagesDirectory, imageFilename);
            const hash = getHash(data);

            // Do not rewrite to disk if image already exists.
            if (fs.existsSync(imagePath)) {
              image = imageFilename;
              imageHash = hash;
            } else {
              // Resize the images to be 600px wide.
              const buffer = Buffer.from(
                data.replace(/^data:image\/\w+;base64,/, ""),
                "base64"
              );
              await sharp(buffer)
                .resize(600)
                .jpeg({ mozjpeg: true })
                .toFile(imagePath);
              image = imageFilename;
              imageHash = hash;
            }
          } catch (err) {
            console.error(
              `File ${filename}: Book [${bookTitle}]: Skipping page ${index} image, encountered error: ${err}`
            );
          }
        }
      }
      return { index, author, text, image, imageHash };
    });

    const pages = (await Promise.all(pagesPromises)).filter((page) => !!page);

    const hash = getHash(
      pages
        .map((page) => `${page.text || ""}:${page.imageHash || ""}`)
        .join("|")
    );

    // Game Type:
    // - Text: No images.
    // - Alternating: Text-Image-Text-Image-etc.
    // - Standard: Text first, then all images.
    // By default, fallback to Standard.
    let type = "standard";
    const nImages = pages.filter((page) => !!page.image).length;
    const nTexts = pages.filter((page) => !!page.text).length;
    if (!nImages) {
      type = "text";
    } else if (
      Math.abs(nImages - nTexts) < 2 &&
      nImages + nTexts === pages.length
    ) {
      type = "alternating";
    }

    let thumbnail = null;
    const thumbnailImage = pages.find((page) => !!page.image && !page.text)?.image;
    if (thumbnailImage) {
      thumbnail = `${id}-${bookAuthor}-thumbnail.jpg`;
      await sharp(path.join(imagesDirectory, thumbnailImage))
        .resize(200)
        .jpeg({ mozjpeg: true })
        .toFile(path.join(imagesDirectory, thumbnail));
    }

    return {
      id: `${id}/${bookAuthor}`,
      type,
      author: bookAuthor,
      timestamp,
      hash,
      thumbnail,
      pages,
    };
  });

  const books = (await Promise.all(booksPromises)).filter((book) => !!book);

  const players = books.map((book) => book.author).filter((p) => !!p);
  const hash = getHash(books.map((book) => book.hash).join("|"));

  const type = books[0].type;
  if (books.find((book) => book.type !== type)) {
    console.warn(
      `File ${filename}: found multiple book types within a single game. Picking the first book type (${type}) as game type.`
    );
  }

  console.log(`Parsing file ${filename} done!`);

  return {
    id,
    type,
    timestamp,
    players,
    hash,
    books,
  };
};

Promise.resolve()
  .then(async () => {
    const filenames = fs.readdirSync(booksDirectory);

    console.log(`Found ${filenames.length} files in books directory.`);

    // Parse each file sequentially, is apparently faster than
    // dropping everything at once to Promise.all.
    // Perhaps tweaking the concurrency (e.g. tiny-async-pool)
    // will result in better performance, but I'm too lazy 🤷‍♂️.
    // Also, we're dropping duplicated games in the process.
    let games = [];
    let gamesHashes = new Set();
    for (const filename of filenames) {
      if (!filename.endsWith(".html")) {
        console.warn(
          `Found non-html file in books directory: ${filename}, skipping.`
        );
        continue;
      }

      const game = await parseFile(filename);
      if (game) {
        if (gamesHashes.has(game.hash)) {
          console.warn(`Dropping ${game.id} due to duplicated hashes.`);
        } else {
          games.push(game);
          gamesHashes.add(game.hash);
        }
      } else {
        console.warn(
          `File ${filename} was not parsed correctly, possibly due to some formatting issues.`
        );

        // We run "strict mode" on CI, so we exit on any empty result.
        if (process.env.CI) {
          process.exit(1);
        }
      }
    }

    // Sort games by timestamp descendingly.
    games.sort((a, b) => b.timestamp - a.timestamp);

    fs.writeFileSync(targetFilename, JSON.stringify(games, null, 2), "utf8");

    console.log(
      `Finished processing ${games.length} games from ${filenames.length} files.`
    );
    console.log(`Manifest written to ${targetFilename}.`);
  })
  .catch((err) => {
    console.error(`Unhandled error: ${err}`);
    process.exit(1);
  });
