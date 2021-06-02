import path from "path";
import React, { useCallback, useEffect } from "react";
import {
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

// Prepare data from generated manifest.
import manifest from "./manifest.json";

const books = Array.prototype.concat.apply(
  [],
  manifest.map((page) => page.books)
);
const stat = {
  ngames: manifest.length,
  nbooks: books.length,
  npages: books.map((book) => book.pages.length).reduce((sum, v) => v + sum, 0),
};

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
      <div class="meta">
        {stat.ngames} games, {stat.nbooks} books, {stat.npages} pages, and
        counting...
      </div>
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
          {dateformat(new Date(timestamp), "d mmmm yyyy")}
        </span>{" "}
        <span className="meta right">{books.length} books</span>
      </div>
      <div>
        {books.map((book) => {
          const title = book.pages.find((page) => !!page.text)?.text;
          const thumbnail = book.pages.find(
            (page) => !!page.image && !page.text
          )?.image;

          return (
            <div
              className="page-item-book"
              onClick={() => history.push(`/${book.id}`)}
            >
              <div className="page-item-book-info">
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

function Book() {
  const { bookId } = useParams();
  const history = useHistory();

  const prevBookId = getPreviousBookId(bookId);
  const nextBookId = getNextBookId(bookId);

  const gotoPrevBook = useCallback(() => {
    history.push(`/${prevBookId}`);
  }, [prevBookId, history]);

  const gotoNextBook = useCallback(() => {
    history.push(`/${nextBookId}`);
  }, [nextBookId, history]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "ArrowLeft" && prevBookId) gotoPrevBook();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevBookId, gotoPrevBook]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "ArrowRight" && nextBookId) gotoNextBook();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextBookId, gotoNextBook]);

  const book = getBookById(bookId);

  if (!book) {
    return (
      <div className="book">
        <ScrollToTop />
        <Nav />
        <div className="header">
          <h1>Book Not Found</h1>
          <div>
            The book with id <strong>{bookId}</strong> cannot be found. Recheck
            the URL or <Link to="/">go to homepage</Link>.
          </div>
        </div>
      </div>
    );
  }

  const { author, pages, timestamp } = book;

  return (
    <div className="book">
      <ScrollToTop />
      <Nav />
      <div className="header">
        <h1>{author}'s book</h1>
        <div className="meta">
          Created on {dateformat(new Date(timestamp), "d mmmm yyyy HH:MM")}
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
              onClick={gotoPrevBook}
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
              onClick={gotoNextBook}
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
