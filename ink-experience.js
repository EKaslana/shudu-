(function () {
  if (document.documentElement.dataset.inkExperience === "ready") return;
  document.documentElement.dataset.inkExperience = "ready";

  const backdrop = document.createElement("div");
  backdrop.className = "ink-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.innerHTML =
    '<span class="ink-backdrop__landscape"></span>' +
    '<span class="ink-backdrop__wash"></span>' +
    '<span class="ink-backdrop__mist"></span>';
  document.body.prepend(backdrop);

  const pawLayer = document.createElement("div");
  pawLayer.className = "cat-paw-layer";
  pawLayer.setAttribute("aria-hidden", "true");
  document.body.append(pawLayer);

  const markLifetime = 820;
  const maxMarks = 10;
  const maxClickDistance = 10;
  const navigationDelay = 150;
  const pawAspectRatio = 528 / 555;
  let mouseDown = null;

  function getInternalNavigation(event) {
    if (!(event.target instanceof Element) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return "";
    }

    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return "";

    const targetUrl = new URL(anchor.href, window.location.href);
    return targetUrl.origin === window.location.origin ? targetUrl.href : "";
  }

  document.addEventListener("mousedown", function (event) {
    if (event.button !== 0) {
      mouseDown = null;
      return;
    }

    mouseDown = { x: event.clientX, y: event.clientY };
  }, true);

  document.addEventListener("click", function (event) {
    if (event.button !== 0 || event.detail === 0 || !mouseDown) return;

    const distance = Math.hypot(event.clientX - mouseDown.x, event.clientY - mouseDown.y);
    mouseDown = null;

    if (distance > maxClickDistance) return;

    while (pawLayer.children.length >= maxMarks) {
      pawLayer.firstElementChild?.remove();
    }

    const mark = document.createElement("span");
    const image = document.createElement("img");
    const size = 35 + Math.random() * 9;

    mark.className = "cat-paw-mark";
    mark.style.left = event.clientX + "px";
    mark.style.top = event.clientY + "px";
    mark.style.width = size + "px";
    mark.style.height = size * pawAspectRatio + "px";
    mark.style.setProperty("--paw-rotation", -16 + Math.random() * 32 + "deg");
    mark.style.setProperty("--paw-scale", String(0.92 + Math.random() * 0.18));

    image.src = "/assets/cat-paw-print.png";
    image.alt = "";
    image.draggable = false;
    mark.append(image);
    pawLayer.append(mark);

    window.setTimeout(function () {
      mark.remove();
    }, markLifetime);

    const navigationUrl = getInternalNavigation(event);
    if (navigationUrl) {
      event.preventDefault();
      window.setTimeout(function () {
        window.location.assign(navigationUrl);
      }, navigationDelay);
    }
  }, true);
})();
