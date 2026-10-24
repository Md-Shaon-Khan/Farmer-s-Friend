// Frontend/src/hero-words.js
// Makes the home headline ("Not sure what is wrong with your rice leaf?")
// appear one word at a time, then stay. It plays again on every refresh.
// The animation itself lives in home.css (.hero h1 .w).
// Import once in your entry file:  import "./hero-words.js";

function splitHeadline(h1) {
  if (h1.dataset.split) return;
  h1.dataset.split = "1";
  h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim());

  let i = 0;
  const frag = document.createDocumentFragment();

  const walk = (node, gradient) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(" "));
          } else {
            const w = document.createElement("span");
            w.className = "w" + (gradient ? " grad" : "");
            w.style.setProperty("--i", i++);
            w.setAttribute("aria-hidden", "true");
            w.textContent = part;
            frag.appendChild(w);
          }
        });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // keep the green gradient: every word of a .grad part gets .grad itself
        walk(child, gradient || child.classList.contains("grad"));
      }
    });
  };

  walk(h1, false);
  h1.textContent = "";
  h1.appendChild(frag);
}

function scan() {
  document.querySelectorAll(".hero h1").forEach(splitHeadline);
}

new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();