import path from "path";
import React, { useEffect } from "react";
import {
  // BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useParams,
  useHistory,
  useLocation,
  HashRouter,
} from "react-router-dom";
import dateformat from "dateformat";

import Button from "@material-ui/core/Button";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import ArrowForwardIcon from "@material-ui/icons/ArrowForward";
import { CardMedia } from "@material-ui/core";

import "./App.scss";

import manifest from "./manifest.json";

// Prepare data from manifest.
const books = Array.prototype.concat.apply(
  [],
  manifest.map((page) => page.books)
);

const getBookById = (bookId) => {
  return books.find((book) => book.id === bookId);
};

const getNextBookId = (bookId) => {
  const index = books.findIndex((book) => book.id === bookId);
  if (index === -1 || index === 0) {
    return null;
  }
  return books[index - 1].id;
};

const getPreviousBookId = (bookId) => {
  const index = books.findIndex((book) => book.id === bookId);
  if (index === -1 || index === books.length - 1) {
    return null;
  }
  return books[index + 1].id;
};

export default function App() {
  return (
    // <Router basename={new URL(homepage).pathname}>
    <HashRouter>
      <div className="container">
        <Switch>
          <Route path="/:bookId">
            <Book />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </div>
    </HashRouter>
  );
}

function Nav() {
  return (
    <div className="top-navigation">
      <Link to="/">brokenpicturephone archive</Link>
    </div>
  );
}

function Home() {
  return (
    <div>
      <Nav />
      {manifest.map((item) => (
        <PageItem {...item} />
      ))}
    </div>
  );
}

function PageItem(props) {
  const { books, timestamp } = props;
  const history = useHistory();

  return (
    <div className="page-item">
      <div>
        <span className="title">
          {dateformat(new Date(timestamp), "d mmm yyyy")}
        </span>{" "}
        <span className="meta right">{books.length} books</span>
      </div>
      <div>
        {books.map((book) => {
          const title = book.pages.find((page) => !!page.text)?.text;
          const thumbnail = book.pages.find((page) => !!page.image && !page.text)?.image;

          return (
            <div
              className="page-item-book"
              onClick={() => history.push(`/${book.id}`)}
            >
              <div className="page-item-book-title">
                <h5>{book.author}'s book</h5>
                {title ? <div className="meta">{title}</div> : null}
              </div>
              {thumbnail ? (
                <CardMedia
                  className="page-item-book-thumbnail"
                  image={path.join(process.env.PUBLIC_URL, "images", thumbnail)}
                  title={`${book.author}'s book`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function Book() {
  const { bookId } = useParams();
  const history = useHistory();

  const book = getBookById(bookId);
  const { author, pages, timestamp } = book;
  const prevBookId = getPreviousBookId(bookId);
  const nextBookId = getNextBookId(bookId);

  return (
    <div className="book">
      <ScrollToTop />

      <Nav />

      <div className="header">
        <h1>{author}'s book</h1>
        <div className="meta">
          Created on {dateformat(new Date(timestamp), "d mmm yyyy HH:MM")}
        </div>
        <div className="meta">
          Players: {pages.map((page) => page.author).join(", ")}
        </div>
      </div>
      <div className="pages">
        {pages.map((page) => (
          <Page {...page} />
        ))}
      </div>
      <div className="bottom-navigation">
        <div className="left">
          {prevBookId ? (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={() => history.push(`/${prevBookId}`)}
            >
              Previous
            </Button>
          ) : (
            <div />
          )}
        </div>
        <div className="right">
          {nextBookId ? (
            <Button
              variant="contained"
              color="secondary"
              endIcon={<ArrowForwardIcon />}
              onClick={() => history.push(`/${nextBookId}`)}
            >
              Next
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

function Page(props) {
  const { index, author, text, image } = props;
  return (
    <div className="page">
      <div className="meta">
        Page {index} by {author}
      </div>
      {text ? <div className="text">{text}</div> : null}
      {image ? (
        <img
          src={path.join(process.env.PUBLIC_URL, "images", image)}
          alt={`Page ${index} by ${author}`}
        />
      ) : null}
    </div>
  );
}
