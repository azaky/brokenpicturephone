import React, { useCallback, useEffect } from "react";
import {
  Switch,
  Route,
  Link,
  useParams,
  useHistory,
  useLocation,
  HashRouter,
  Redirect,
} from "react-router-dom";

import Button from "@material-ui/core/Button";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import ArrowForwardIcon from "@material-ui/icons/ArrowForward";
import { CardMedia, Chip } from "@material-ui/core";

import path from "path";
import dateformat from "dateformat";

import "./App.scss";

// Prepare data from generated manifest.
import games from "./manifest.json";

const books = Array.prototype.concat.apply(
  [],
  games.map((page) => page.books)
);
const stat = {
  ngames: games.length,
  nbooks: books.length,
  npages: books.map((book) => book.pages.length).reduce((sum, v) => v + sum, 0),
};

const getGameById = (gameId) => {
  return games.find((game) => game.id === gameId);
};

const getRandomBookId = () => {
  return books[Math.floor(Math.random() * books.length)].id;
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

const Nav = () => {
  return (
    <div className="top-navigation">
      <Link to="/">brokenpicturephone archive</Link>
    </div>
  );
};

const Game = (props) => {
  const { gameId } = useParams();

  let game = null;
  if (gameId) {
    if (gameId === "random") {
      return <Redirect to={`/${getRandomBookId()}`} />;
    }
    game = getGameById(gameId);
  } else {
    game = props;
  }

  if (!game) {
    return (
      <div className="book">
        <Nav />
        <div className="header">
          <h1>Game Not Found</h1>
          <div>
            The game with id <strong>{gameId}</strong> cannot be found. Recheck
            the URL or <Link to="/">go to homepage</Link>.
          </div>
        </div>
      </div>
    );
  }

  const { books, timestamp, type } = game;

  const content = (
    <div className="game">
      <div className="game-title">
        <span className="title">
          {dateformat(new Date(timestamp), "d mmmm yyyy")}
        </span>{" "}
        {type ? (
          <span>
            <Chip size="small" label={type} />
          </span>
        ) : null}
        <span className="subtitle">{books.length} books</span>
      </div>
      <div>
        {books.map((book) => {
          const title = book.pages.find((page) => !!page.text)?.text;
          const thumbnail = book.pages.find(
            (page) => !!page.image && !page.text
          )?.image;

          return (
            <Link to={`/${book.id}`} className="game-book">
              <div className="game-book-info">
                <h5>{book.author}'s book</h5>
                {title ? <div className="meta">{title}</div> : null}
              </div>
              {thumbnail ? (
                <CardMedia
                  className="game-book-thumbnail"
                  image={path.join(process.env.PUBLIC_URL, "images", thumbnail)}
                  title={`${book.author}'s book`}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );

  if (gameId) {
    return (
      <div>
        <Nav />
        {content}
      </div>
    );
  } else {
    return content;
  }
};

const Page = (props) => {
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
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const Book = () => {
  const { gameId, author } = useParams();
  const history = useHistory();

  const bookId = `${gameId}/${author}`;
  const prevBookId = getPreviousBookId(bookId);
  const nextBookId = getNextBookId(bookId);

  const gotoPrevBook = useCallback(() => {
    history.push(`/${prevBookId}`);
  }, [prevBookId, history]);

  const gotoNextBook = useCallback(() => {
    history.push(`/${nextBookId}`);
  }, [nextBookId, history]);

  const gotoRandomBook = () => {
    history.push(`/random`);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft" && prevBookId) gotoPrevBook();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevBookId, gotoPrevBook]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "ArrowRight" && nextBookId) gotoNextBook();
    };
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

  const { pages, timestamp, type } = book;

  return (
    <div className="book">
      <ScrollToTop />
      <Nav />
      <div className="header">
        <div>
          <span className="title">{author}'s book</span>{" "}
          <Chip className="label" size="small" label={type} />
        </div>
        <div className="meta">
          Created on{" "}
          <Link to={`/${gameId}`}>
            {dateformat(new Date(timestamp), "d mmmm yyyy HH:MM")}
          </Link>
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
        <div>
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
        <div>
          <Button variant="contained" color="secondary" onClick={gotoRandomBook}>
            Random
          </Button>
        </div>
        <div>
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
};

const Home = () => {
  return (
    <div>
      <Nav />
      <div class="meta">
        {stat.ngames} games, {stat.nbooks} books, {stat.npages} pages, and
        counting...
      </div>
      <div>
        {games.map((game) => (
          <Game {...game} />
        ))}
      </div>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <div className="container">
        <Switch>
          <Route path="/:gameId/:author">
            <Book />
          </Route>
          <Route path="/:gameId">
            <Game />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </div>
    </HashRouter>
  );
};

export default App;
