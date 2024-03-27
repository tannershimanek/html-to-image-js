/**
 * Resolves a URL relative to a base URL.
 *
 * @param {string} url - The URL to resolve.
 * @param {string} [baseUrl=null] - The base URL to resolve against. If not provided, the current document's base URL will be used.
 * @returns {string} The resolved URL.
 *
 * @example
 * // Absolute URL with protocol
 * resolveUrl("https://example.com/path/to/file.html");
 * // Returns: "https://example.com/path/to/file.html"
 *
 * @example
 * // Absolute URL without protocol
 * resolveUrl("//example.com/path/to/file.html");
 * // Returns: "http://example.com/path/to/file.html" (assuming current protocol is http)
 *
 * @example
 * // Relative URL
 * resolveUrl("path/to/file.html", "https://example.com/base/");
 * // Returns: "https://example.com/base/path/to/file.html"
 *
 * @example
 * // Data URI or other special schemes
 * resolveUrl("data:image/png;base64,iVBORw0KGgo...");
 * // Returns: "data:image/png;base64,iVBORw0KGgo..."
 *
 * @example
 * // Relative URL without base URL
 * resolveUrl("path/to/file.html");
 * // Returns: "http://example.com/path/to/file.html" (assuming current document's base URL is "http://example.com/")
 */
function resolveUrl(url, baseUrl = null) {
  // url is absolute already
  if (url.match(/^[a-z]+:\/\//i)) {
    return url;
  }

  // url is absolute already, without protocol
  if (url.match(/^\/\//)) {
    return window.location.protocol + url;
  }

  // dataURI, mailto:, tel:, etc.
  if (url.match(/^[a-z]+:/i)) {
    return url;
  }

  const doc = document.implementation.createHTMLDocument();
  const base = doc.createElement("base");
  const a = doc.createElement("a");

  doc.head.appendChild(base);
  doc.body.appendChild(a);

  if (baseUrl) {
    base.href = baseUrl;
  }

  a.href = url;

  return a.href;
}

/**
 * Generates a unique identifier.
 * @returns {string} The generated unique identifier.
 */
const uuid = (() => {
  // generate uuid for className of pseudo elements.
  // We should not use GUIDs, otherwise pseudo elements sometimes cannot be captured.
  let counter = 0;

  // ref: http://stackoverflow.com/a/6248722/2519373
  const random = () =>
    // eslint-disable-next-line no-bitwise
    `0000${((Math.random() * 36 ** 4) << 0).toString(36)}`.slice(-4);

  return () => {
    counter += 1;
    return `u${random()}${counter}`;
  };
})();

/**
 * Creates a function that delays the execution of the provided function by a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to delay the execution.
 * @returns {function(*): Promise<*>} A function that delays the execution of the provided function.
 */
function delay(ms) {
  return (args) =>
    new Promise((resolve) => {
      setTimeout(() => resolve(args), ms);
    });
}

/**
 * Converts an array-like object to an array.
 * @param {ArrayLike} arrayLike - The array-like object to convert.
 * @returns {Array} The converted array.
 */
function toArray(arrayLike) {
  const arr = [];

  for (let i = 0, l = arrayLike.length; i < l; i++) {
    arr.push(arrayLike[i]);
  }

  return arr;
}

/**
 * Retrieves the computed value of a style property for a given node in pixels.
 * @param {Node} node - The node to retrieve the style property value from.
 * @param {string} styleProperty - The style property to retrieve the value for.
 * @returns {number} The computed value of the style property in pixels.
 */
function px(node, styleProperty) {
  const win = node.ownerDocument.defaultView || window;
  const val = win.getComputedStyle(node).getPropertyValue(styleProperty);
  return val ? parseFloat(val.replace("px", "")) : 0;
}

/**
 * Retrieves the width of a node, including borders.
 * @param {Node} node - The node to retrieve the width from.
 * @returns {number} The width of the node in pixels.
 */
function getNodeWidth(node) {
  const leftBorder = px(node, "border-left-width");
  const rightBorder = px(node, "border-right-width");
  return node.clientWidth + leftBorder + rightBorder;
}

/**
 * Retrieves the height of a node, including borders.
 * @param {Node} node - The node to retrieve the height from.
 * @returns {number} The height of the node in pixels.
 */
function getNodeHeight(node) {
  const topBorder = px(node, "border-top-width");
  const bottomBorder = px(node, "border-bottom-width");
  return node.clientHeight + topBorder + bottomBorder;
}

/**
 * Retrieves the size (width and height) of an image node.
 * @param {Node} targetNode - The image node to retrieve the size from.
 * @param {Object} [options={}] - Additional options for retrieving the size.
 * @param {number} [options.width] - The width of the image. If not provided, the width will be retrieved from the node.
 * @param {number} [options.height] - The height of the image. If not provided, the height will be retrieved from the node.
 * @returns {{width: number, height: number}} An object containing the width and height of the image.
 */
function getImageSize(targetNode, options = {}) {
  const width = options.width || getNodeWidth(targetNode);
  const height = options.height || getNodeHeight(targetNode);

  return { width, height };
}

/**
 * Retrieves the device pixel ratio.
 * @returns {number} The device pixel ratio.
 */
function getPixelRatio() {
  let ratio;

  let FINAL_PROCESS;
  try {
    FINAL_PROCESS = process;
  } catch (e) {
    // pass
  }

  const val =
    FINAL_PROCESS && FINAL_PROCESS.env
      ? FINAL_PROCESS.env.devicePixelRatio
      : null;
  if (val) {
    ratio = parseInt(val, 10);
    if (Number.isNaN(ratio)) {
      ratio = 1;
    }
  }
  return ratio || window.devicePixelRatio || 1;
}

// @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#maximum_canvas_size
const canvasDimensionLimit = 16384;

/**
 * Checks and adjusts the dimensions of a canvas if they exceed the maximum canvas size limit.
 * @param {HTMLCanvasElement} canvas - The canvas to check and adjust.
 */
function checkCanvasDimensions(canvas) {
  if (
    canvas.width > canvasDimensionLimit ||
    canvas.height > canvasDimensionLimit
  ) {
    if (
      canvas.width > canvasDimensionLimit &&
      canvas.height > canvasDimensionLimit
    ) {
      if (canvas.width > canvas.height) {
        canvas.height *= canvasDimensionLimit / canvas.width;
        canvas.width = canvasDimensionLimit;
      } else {
        canvas.width *= canvasDimensionLimit / canvas.height;
        canvas.height = canvasDimensionLimit;
      }
    } else if (canvas.width > canvasDimensionLimit) {
      canvas.height *= canvasDimensionLimit / canvas.width;
      canvas.width = canvasDimensionLimit;
    } else {
      canvas.width *= canvasDimensionLimit / canvas.height;
      canvas.height = canvasDimensionLimit;
    }
  }
}

/**
 * Converts a canvas to a Blob object.
 * @param {HTMLCanvasElement} canvas - The canvas to convert.
 * @param {Object} [options={}] - Additional options for the conversion.
 * @param {string} [options.type] - The MIME type of the resulting Blob. Defaults to "image/png".
 * @param {number} [options.quality] - The quality of the resulting Blob (0 to 1). Defaults to 1.
 * @returns {Promise<Blob>} A promise that resolves to the converted Blob object.
 */
function canvasToBlob(canvas, options = {}) {
  if (canvas.toBlob) {
    return new Promise((resolve) => {
      canvas.toBlob(
        resolve,
        options.type ? options.type : "image/png",
        options.quality ? options.quality : 1
      );
    });
  }

  return new Promise((resolve) => {
    const binaryString = window.atob(
      canvas
        .toDataURL(
          options.type ? options.type : undefined,
          options.quality ? options.quality : undefined
        )
        .split(",")[1]
    );
    const len = binaryString.length;
    const binaryArray = new Uint8Array(len);

    for (let i = 0; i < len; i += 1) {
      binaryArray[i] = binaryString.charCodeAt(i);
    }

    resolve(
      new Blob([binaryArray], {
        type: options.type ? options.type : "image/png",
      })
    );
  });
}

/**
 * Creates an image element from a URL.
 * @param {string} url - The URL of the image.
 * @returns {Promise<HTMLImageElement>} A promise that resolves to the created image element.
 */
function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decode = () => resolve(img);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
  });
}

/**
 * Converts an SVG element to a data URL.
 * @param {SVGElement} svg - The SVG element to convert.
 * @returns {Promise<string>} A promise that resolves to the data URL of the SVG.
 */
async function svgToDataURL(svg) {
  return Promise.resolve()
    .then(() => new XMLSerializer().serializeToString(svg))
    .then(encodeURIComponent)
    .then((html) => `data:image/svg+xml;charset=utf-8,${html}`);
}

/**
 * Converts a DOM node to a data URL by rendering it inside an SVG foreignObject.
 * @param {Node} node - The DOM node to convert.
 * @param {number} width - The width of the SVG.
 * @param {number} height - The height of the SVG.
 * @returns {Promise<string>} A promise that resolves to the data URL of the rendered node.
 */
async function nodeToDataURL(node, width, height) {
  const xmlns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(xmlns, "svg");
  const foreignObject = document.createElementNS(xmlns, "foreignObject");

  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("externalResourcesRequired", "true");

  svg.appendChild(foreignObject);
  foreignObject.appendChild(node);
  return svgToDataURL(svg);
}

/**
 * Checks if a node is an instance of a specific element type.
 * @param {Node} node - The node to check.
 * @param {Function} instance - The element constructor to compare against.
 * @returns {boolean} True if the node is an instance of the specified element type, false otherwise.
 */
function isInstanceOfElement(node, instance) {
  if (node instanceof instance) return true;

  const nodePrototype = Object.getPrototypeOf(node);

  if (nodePrototype === null) return false;

  return (
    nodePrototype.constructor.name === instance.name ||
    isInstanceOfElement(nodePrototype, instance)
  );
}

module.exports = {
  resolveUrl,
  uuid,
  delay,
  toArray,
  getImageSize,
  getPixelRatio,
  checkCanvasDimensions,
  canvasToBlob,
  createImage,
  svgToDataURL,
  nodeToDataURL,
  isInstanceOfElement,
};
