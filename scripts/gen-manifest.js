const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

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
  try {
    if (!filename.endsWith(".html")) return;

    console.log(`Parsing file ${filename} ...`);

    const previousData = previousManifest.find(
      (data) => data.filename === filename
    );
    if (previousData) {
      let imagesExist = true;
      for (const book of previousData.books) {
        for (const page of book.pages) {
          if (page.image) {
            if (!fs.existsSync(path.join(imagesDirectory, page.image))) {
              imagesExist = false;
              break;
            }
          }
        }
        if (!imagesExist) break;
      }
      if (imagesExist) {
        console.log(
          `Skipping file ${filename}: importing from the previous manifest`
        );
        return previousData;
      }
    }

    const dom = await JSDOM.fromFile(path.join(booksDirectory, filename));

    const titleEl = dom.window.document.body.firstElementChild;
    if (titleEl.tagName !== "H1") {
      console.log(
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
      console.log(
        `File ${filename}: Skipping, invalid timestamp, filename and page title are invalid (filename = ${filename}, title = ${title})`
      );
      return null;
    }

    const id = path.parse(filename).name;

    const articles = dom.window.document.getElementsByTagName("article");
    const books = [...articles]
      .map((article, i) => {
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
        const pages = [...sections]
          .map((section, j) => {
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
                  const format = /^data:image\/(\w+);/.exec(data)[1];
                  const imageFilename = `${id}-${bookAuthor}-${index}${
                    author ? `-${author}` : ""
                  }.${format}`;
                  const imagePath = path.join(imagesDirectory, imageFilename);
                  const hash = getHash(data);

                  // Do not rewrite to disk if image already exists.
                  if (fs.existsSync(imagePath)) {
                    image = imageFilename;
                    imageHash = hash;
                  } else {
                    const buffer = Buffer.from(
                      data.replace(/^data:image\/\w+;base64,/, ""),
                      "base64"
                    );
                    fs.writeFileSync(imagePath, buffer);
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
          })
          .filter((page) => !!page);

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

        return {
          id: `${id}/${bookAuthor}`,
          type,
          author: bookAuthor,
          timestamp,
          hash,
          pages,
        };
      })
      .filter((book) => !!book);

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
  } catch (err) {
    console.error(`File ${filename}: Error parsing file: ${err}`);
  }
};

Promise.resolve()
  .then(async () => {
    // Parse each file sequentially, is apparently faster than
    // dropping everything at once to Promise.all.
    // Perhaps tweaking the concurrency (e.g. tiny-async-pool)
    // will result in better performance, but I'm too lazy 🤷‍♂️.
    let games = [];
    const filenames = fs.readdirSync(booksDirectory);
    for (const filename of filenames) {
      const game = await parseFile(filename);
      if (game) {
        games.push(game);
      }
    }

    // Check for duplicate games.
    let uniqueGames = [],
      uniqueGamesHashes = new Set();
    games.forEach((game) => {
      if (uniqueGamesHashes.has(game.hash)) {
        console.warn(`Dropping game ${game.id} due to duplicated hashes.`);
        return;
      }
      uniqueGames.push(game);
      uniqueGamesHashes.add(game.hash);
    });

    // Sort by timestamp;
    uniqueGames.sort((a, b) => b.timestamp - a.timestamp);

    fs.writeFileSync(
      targetFilename,
      JSON.stringify(uniqueGames, null, 2),
      "utf8"
    );

    console.log(
      `Processing ${uniqueGames.length} games from ${filenames.length} done!`
    );
    console.log(`Manifest written to ${targetFilename}`);
  })
  .catch((err) => {
    console.error(`Error: ${err}`);
    process.exit(1);
  });
