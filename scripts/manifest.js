const fs = require("fs");
const path = require("path");

const { JSDOM } = require("jsdom");

const booksDirectory = path.join(__dirname, "../books");
const imagesDirectory = path.join(__dirname, "../public/images");

if (!fs.existsSync(imagesDirectory)) {
  fs.mkdirSync(imagesDirectory, { recursive: true });
}

const promises = fs.readdirSync(booksDirectory).map(async (file) => {
  try {
    if (!file.endsWith(".html")) return;

    const dom = await JSDOM.fromFile(path.join(booksDirectory, file));
    console.log(`Parsing file ${file} ...`);

    const titleEl = dom.window.document.body.firstElementChild;
    if (titleEl.tagName !== "H1") {
      console.log(
        `File ${file}: Skipping, expected H1 first element, got ${titleEl.tagName}`
      );
      return;
    }
    const title = titleEl.textContent;

    // Attempt to parse timestamp, first from filename, then attempt parse from page title.
    let timestamp = parseFloat(/\d{13}/.exec(file)?.[0]);
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
        `File ${file}: Skipping, invalid timestamp, filename and page title are invalid (filename = ${file}, title = ${title})`
      );
      return;
    }

    const articles = dom.window.document.getElementsByTagName("article");
    const books = [...articles]
      .map((article, i) => {
        const bookTitleEl = article.firstElementChild;
        if (bookTitleEl.tagName !== "H2") {
          console.log(
            `File ${file}: Skipping book ${
              i + 1
            }, expected h2 first element, got ${bookTitleEl.tagName}`
          );
          return;
        }
        const bookTitle = bookTitleEl.textContent;
        const bookAuthor = /(.+)'s Book/.exec(bookTitle)[1] || null;

        const sections = article.getElementsByTagName("section");
        const pages = [...sections].map((section, j) => {
          let index = j + 1,
            author = null,
            image = null,
            text = null;
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
                `File ${file}: Book [${bookTitle}]: Skipping page ${index} image, expected base64 format, got url ${src}`
              );
            } else {
              try {
                const format = /^data:image\/(\w+);/.exec(data)[1];
                const imageFilename = `${timestamp}-${bookAuthor}-${index}${
                  author ? `-${author}` : ""
                }.${format}`;
                const imagePath = path.join(imagesDirectory, imageFilename);
                
                // Do not rewrite to disk if image already exists.
                if (fs.existsSync(imagePath)) {
                  image = imageFilename;
                } else {
                  const buffer = Buffer.from(
                    data.replace(/^data:image\/\w+;base64,/, ""),
                    "base64"
                  );
                  fs.writeFileSync(
                    imagePath,
                    buffer
                  );
                  image = imageFilename;
                }
              } catch (err) {
                console.error(
                  `File ${file}: Book [${bookTitle}]: Skipping page ${index} image, encountered error: ${err}`
                );
              }
            }
          }
          return { index, author, image, text };
        });

        return {
          id: `${timestamp}-${bookAuthor}`,
          author: bookAuthor,
          timestamp,
          pages,
        };
      })
      .filter((book) => !!book);

    const players = books.map((book) => book.author).filter((p) => !!p);

    return {
      title,
      timestamp,
      players,
      books,
    };
  } catch (err) {
    console.error(`File ${file}: Error parsing file: ${err}`);
  }
});

Promise.all(promises)
  .then((pages) =>
    pages.filter((page) => !!page).sort((a, b) => b.timestamp - a.timestamp)
  )
  .then((pages) => {
    // Check for duplicate timestamps.
    let uniquePages = [],
      timestamps = new Set();
    pages.forEach((page) => {
      if (timestamps.has(page.timestamp)) {
        console.warn(
          `Dropping page ${page.title} due to duplicated timestamp.`
        );
        return;
      }
      uniquePages.push(page);
      timestamps.add(page.timestamp);
    });

    return uniquePages;
  })
  .then((pages) => {
    fs.writeFileSync(path.join(__dirname, "../src/manifest.json"), JSON.stringify(pages, null, 2), "utf8");
  });
