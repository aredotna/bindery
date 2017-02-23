let binder = new Bindery({
  source: ".content",
  rules: {
    "h2": Bindery.BreakBefore,
    "a": Bindery.Footnote((elmt) => `Link to <a href='#'>${elmt.href}</a>`),
    "p": Bindery.Footnote((elmt) => elmt.textContent.substr(0,28)),
    ".med-figure": Bindery.FullPage,
    ".big-figure": Bindery.Spread,
    ".content h2": Bindery.RunningHeader,
    ".content": Bindery.PageNumber,
  },
  pageSize: {
    height: 500,
    width: 300,
  }
});
