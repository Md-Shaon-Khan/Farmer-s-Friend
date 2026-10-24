// Frontend/src/cursor-glow.js
// A soft red circle that follows the mouse on every page,
// except over the navbar (the navbar just turns red on hover via layout.css).
// Import once in your entry file:  import "./cursor-glow.js";

const glow = document.createElement("div");
glow.className = "cursor-glow";
glow.setAttribute("aria-hidden", "true");
document.body.appendChild(glow);

let tx = 0, ty = 0, x = 0, y = 0, running = false;

function tick() {
  // ease toward the mouse so the glow trails smoothly
  x += (tx - x) * 0.2;
  y += (ty - y) * 0.2;
  glow.style.transform = `translate(${x}px, ${y}px)`;
  if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) {
    requestAnimationFrame(tick);
  } else {
    running = false;
  }
}

document.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;

  // hide the glow over the navbar
  if (e.target.closest && e.target.closest(".nav-wrap")) {
    glow.classList.remove("on");
    return;
  }

  tx = e.clientX;
  ty = e.clientY;
  if (!glow.classList.contains("on")) {
    x = tx;
    y = ty;
    glow.classList.add("on");
  }
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
});

document.documentElement.addEventListener("mouseleave", () => glow.classList.remove("on"));