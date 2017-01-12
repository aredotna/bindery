class Printer {
  constructor(opts) {
    this.book = opts.book;
    this.target = this.book.target;
    this.printWrapper = document.createElement("div");
    this.printWrapper.setAttribute("bindery-print-wrapper", true);
  }
  printOrdered() {
    if (this.book.pages.length % 2 !== 0) {
      let pg = new Page(binder.template);
      this.book.addPage(pg);
    }
    let spacerPage = new Page(binder.template);
    let spacerPage2 = new Page(binder.template);
    spacerPage.element.style.visibility = "hidden";
    spacerPage2.element.style.visibility = "hidden";
    this.book.pages.unshift(spacerPage);
    this.book.pages.push(spacerPage2);

    for (var i = 0; i < this.book.pages.length; i += 2) {
      let wrap = this.printWrapper.cloneNode(false);
      let l = this.book.pages[i].element;
      let r = this.book.pages[i+1].element;
      l.setAttribute("bindery-left", true);
      r.setAttribute("bindery-right", true);
      wrap.appendChild(l);
      wrap.appendChild(r);
      this.target.appendChild(wrap);
    }
  }
}

class Book {
  constructor(opts) {
    this.target = opts.target;
    this.pageNum = 1;
    this.pages = [];
  }
  addPage(page) {
    page.setNumber(this.pageNum);
    this.pageNum++;
    this.pages.push(page);
  }
}

class Page {
  constructor(template) {
    this.element = template.cloneNode(true);
    this.flowBox = this.element.querySelector("[bindery-flowbox]");
    this.flowContent = this.element.querySelector("[bindery-content]");
    this.footer = this.element.querySelector("[bindery-footer]");
  }
  setNumber(n) {
    let num = this.element.querySelector("[bindery-num]");
    num.textContent = n;
  }
}

class Binder {
  constructor(opts) {
    this.source = opts.source;

    if (typeof opts.template == "string") {
      let temp = document.createElement("div");
      temp.innerHTML = opts.template;
      this.template = temp.children[0];
    }
    else if (opts.template instanceof HTMLElement) {
      this.template = opts.template.cloneNode(true);
      opts.template.remove(opts.template);
    }
    else {
      console.error(`Bindery: Template should be an element or a string`);
    }

    this.book = new Book({
      target: opts.target,
    });

    this.measureArea = el("div", "measureArea");
    document.body.appendChild(this.measureArea);

    this.context = [];
  }
  currentEl() {
    return this.context[this.context.length-1];
  }
  nextFlowBox() {
    let pg = new Page(this.template);
    this.measureArea.appendChild(pg.element);
    this.book.addPage(pg);
    return pg;
  }
  bind(doneBinding) {
    let DELAY = 50; // ms
    let throttle = (func) => {
      if (DELAY > 0) setTimeout(func, DELAY);
      else func();
    }

    let hasOverflowed = () => {
      let elementBottom = currentPage.flowContent.getBoundingClientRect().bottom;
      let pageY = currentPage.flowBox.getBoundingClientRect().top;
      let pageH = currentPage.flowBox.getBoundingClientRect().height;
      elementBottom = elementBottom - pageY;
      return elementBottom > pageH;
    }

    let finishPage = () => {
      this.measureArea.removeChild(currentPage.element);
    }

    // Creates clones for ever level of tag
    // we were in when we overflowed the last page
    let cloneContextToNextFlowBox = () => {
      currentPage = this.nextFlowBox();
      for (var i = this.context.length - 1; i >= 0; i--) {
        let clone = this.context[i].cloneNode(false);
        clone.innerHTML = '';
        clone.setAttribute("bindery-continuation", true);
        if (clone.id) {
          console.warn(`Bindery: Added a break to ${prettyName(clone)}, so "${clone.id}" is no longer a unique ID.`);
        }
        if (i < this.context.length - 1) {
          clone.appendChild(this.context[i+1]);
        }
        this.context[i] = clone;
      }
      currentPage.flowContent.appendChild(this.context[0]);
    };




    // Adds an text node by adding each word one by one
    // until it overflows
    let addTextNode = (origTextNode, doneCallback) => {

      this.currentEl().appendChild(origTextNode);

      let textNode = origTextNode;
      let origText = textNode.nodeValue;

      let posShift = 1;

      let pos = 0;
      let lastPos = pos;
      let addWordSteps = 0;

      let addWord = (rawPos) => {
        addWordSteps++;

        lastPos = pos;
        pos = parseInt(rawPos);
        let dist = Math.abs(lastPos - pos);


        if (pos > origText.length - 1) {
          throttle(doneCallback);
          return;
        }
        textNode.nodeValue = origText.substr(0, pos);

        if (dist < 1) { // Is done

          // Back out to word boundary
          while(origText.charAt(pos) !== " " && pos > -1) pos--;

          textNode.nodeValue = origText.substr(0, pos);
          if (pos > 0) {
            origText = origText.substr(pos);
            pos = 0;
          }
          console.log(addWordSteps + " iterations");
          // Start on new page
          finishPage();
          cloneContextToNextFlowBox();
          textNode = document.createTextNode(origText);
          this.currentEl().appendChild(textNode);

          // If the remainder fits there, we're done
          if (!hasOverflowed(this.currentEl())) {
            throttle(doneCallback);
            return;
          }
        }
        if (hasOverflowed(this.currentEl())) { // Go back
          throttle(() => { addWord(pos - dist/2); });
        }
        else {
          throttle(() => { addWord(pos + dist/2); });
        }
      }

      // we added it all in one go
      if (!hasOverflowed(this.currentEl())) {
        throttle(doneCallback);
      }
      // iterate word-by-word
      else {
        addWord(origText.length/2);
      }
    }


    // Adds an element node by clearing its childNodes, then inserting them
    // one by one recursively until thet overflow the page
    let addElementNode = (node, doneCallback) => {

      // Add this node to the current page or context
      if (this.context.length == 0) currentPage.flowContent.appendChild(this.source);
      else this.currentEl().appendChild(node);
      this.context.push(node);

      currentPage.footer.innerHTML += "And here's something else to add<br>";

      // This can be added instantly without searching for the overflow point
      if (!hasOverflowed(node)) {
        throttle(doneCallback);
        return;
      }
      if (hasOverflowed(node) && node.getAttribute("bindery-break") == "avoid")  {
        let nodeH = node.getBoundingClientRect().height;
        let flowH = currentPage.flowBox.getBoundingClientRect().height;
        if (nodeH < flowH) {
          this.context.pop();
          finishPage();
          cloneContextToNextFlowBox();
          addElementNode(node, doneCallback);
          return;
        }
        else {
          console.warn(`Bindery: Cannot avoid breaking ${prettyName(node)}, it's taller than the flow box.`);
        }
      }

      // Clear this node, before re-adding its children
      let childNodes = [...node.childNodes];
      node.innerHTML = '';

      let index = 0;
      let addNextChild = () => {
        if (!(index < childNodes.length)) {
          doneCallback();
          return;
        }
        let child = childNodes[index];
        index += 1;
        switch (child.nodeType) {
          case Node.TEXT_NODE:
            addTextNode(child, addNextChild);
            break;
          case Node.ELEMENT_NODE: {
            if (child.tagName == "SCRIPT") {
              addNextChild(); // skip
              break;
            }
            if (child.getAttribute("bindery-break") == "before") {
              if (currentPage.flowContent.innerText !== "") {
                finishPage();
                cloneContextToNextFlowBox();
              }
            }
            if (child.hasAttribute("bindery-spread")) {
              let spreadMode = child.getAttribute("bindery-spread");
              let oldBox = currentPage;
              let oldContext = this.context.slice(0);
              cloneContextToNextFlowBox();
              if (spreadMode == "bleed") {
                currentPage.element.classList.add("bleed");
              }
              addElementNode(child, () => {
                finishPage();
                currentPage = oldBox;
                this.context = oldContext;
                addNextChild();
              });
              break;
            }
            throttle(() => {
              addElementNode(child, () => {
                this.context.pop();
                addNextChild();
              })
            });
            break;
          }
          default:
            console.log(`Bindery: Unknown node type: ${child.nodeType}`);
        }
      }
      addNextChild();
    }

    let currentPage = this.nextFlowBox();
    addElementNode(this.source, () => {
      console.log("wow we're done!");
      doneBinding(this.book);
      let printer = new Printer({
        book: this.book,
      });
      printer.printOrdered();
    });
  }
}

let el = (type, className) => {
  element = document.createElement(type);
  element.classList.add(className);
  return element;
}

let last = (arr) => arr[arr.length - 1];

let prettyName = (node) => `"${node.tagName.toLowerCase()}${node.id ? "#"+node.id : ""}.${[...node.classList].join(".")}"`;
