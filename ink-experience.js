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
  const pawAssetUrl = new URL("assets/cat-paw-print.png", document.baseURI).href;
  let mouseDown = null;
  let pawParity = 1;

  function buildPawPart(className) {
    const part = document.createElement("span");
    const image = document.createElement("img");
    part.className = className;
    image.src = pawAssetUrl;
    image.alt = "";
    image.draggable = false;
    part.append(image);
    return part;
  }

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
    const pressure = 0.94 + Math.random() * 0.22;
    const size = 36 + Math.random() * 10;
    const driftX = pawParity * (4 + Math.random() * 5);
    const driftY = -18 - Math.random() * 10;
    const stampDrop = 7 + Math.random() * 5;
    const groundOffsetY = 6 + Math.random() * 5;
    const stretchX = 0.96 + Math.random() * 0.08;
    const stretchY = 0.89 + Math.random() * 0.08;
    const rotation = -12 + Math.random() * 24;
    const blur = 2.2 + Math.random() * 1.6;
    const opacity = 0.7 + Math.random() * 0.18;
    const bleedOpacity = 0.16 + Math.random() * 0.12;
    const shadowOpacity = 0.09 + Math.random() * 0.07;
    const pawSide = pawParity > 0 ? "is-right" : "is-left";
    const left = event.clientX + pawParity * (2 + Math.random() * 4);
    const top = event.clientY + 2 + Math.random() * 6;

    pawParity *= -1;

    mark.className = "cat-paw-mark " + pawSide;
    mark.style.left = left + "px";
    mark.style.top = top + "px";
    mark.style.width = size + "px";
    mark.style.height = size * pawAspectRatio + "px";
    mark.style.setProperty("--paw-rotation", rotation + "deg");
    mark.style.setProperty("--paw-scale", String(pressure));
    mark.style.setProperty("--paw-drift-x", driftX + "px");
    mark.style.setProperty("--paw-drift-y", driftY + "px");
    mark.style.setProperty("--paw-drop", stampDrop + "px");
    mark.style.setProperty("--paw-ground-offset", groundOffsetY + "px");
    mark.style.setProperty("--paw-stretch-x", String(stretchX));
    mark.style.setProperty("--paw-stretch-y", String(stretchY));
    mark.style.setProperty("--paw-bleed-blur", blur + "px");
    mark.style.setProperty("--paw-opacity", String(opacity));
    mark.style.setProperty("--paw-bleed-opacity", String(bleedOpacity));
    mark.style.setProperty("--paw-shadow-opacity", String(shadowOpacity));
    mark.style.setProperty("--paw-flip", pawSide === "is-left" ? "-1" : "1");

    mark.append(
      buildPawPart("cat-paw-shadow"),
      buildPawPart("cat-paw-bleed"),
      buildPawPart("cat-paw-core")
    );
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
