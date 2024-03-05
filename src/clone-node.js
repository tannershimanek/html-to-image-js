const { clonePseudoElements } = require("./clone-pseudos");
const { createImage, toArray, isInstanceOfElement } = require("./util");
const { getMimeType } = require("./mimes");
const { resourceToDataURL } = require("./dataurl");

/**
 * Asynchronously clones a canvas element and returns either a cloned canvas element or an Image element.
 *
 * This function checks if the provided canvas element has any drawable content by converting it to a data URL.
 * If the canvas is empty (indicated by a data URL of "data:,"), it returns a shallow clone of the canvas element,
 * meaning the clone will not have any drawable content or event listeners copied over.
 * If the canvas has drawable content, it utilizes an external function `createImage` to create and return an Image element
 * based on the drawable content of the canvas. The `createImage` function is expected to take a data URL as input and return
 * a promise that resolves to an Image element containing the drawable content of the original canvas.
 *
 * Note: The function `createImage` should be defined elsewhere and must return a Promise that resolves to an HTMLImageElement.
 *
 * @async
 * @param {HTMLCanvasElement} canvas - The canvas element to be cloned.
 * @returns {Promise<HTMLCanvasElement|HTMLImageElement>} A promise that resolves to a cloned canvas element without drawable content
 *                                                        if the original canvas is empty, or to an Image element with the drawable
 *                                                        content of the original canvas if it is not empty.
 */
async function cloneCanvasElement(canvas) {
  const dataURL = canvas.toDataURL();
  if (dataURL === "data:,") {
    return canvas.cloneNode(false);
  }
  return createImage(dataURL);
}

/**
 * Asynchronously clones a video element by capturing its current frame or poster image and returns an Image element.
 *
 * This function attempts to clone the visible content of a provided video element into an Image element. It does so by first
 * checking if the video has a current source (`currentSrc`). If so, it draws the current video frame onto a canvas and then
 * converts this canvas to a data URL, which is used to create an Image element via an external `createImage` function.
 *
 * If the video does not have a current source or is not playing, the function attempts to use the video's poster image.
 * It converts this poster image to a data URL, considering the poster's MIME type which is determined by an external
 * `getMimeType` function. It also optionally allows for additional processing through `options` passed to another external
 * `resourceToDataURL` function, which converts the poster resource to a data URL.
 *
 * The `createImage`, `getMimeType`, and `resourceToDataURL` functions are assumed to be defined elsewhere. `createImage` should
 * create an Image element from a data URL, `getMimeType` should return the MIME type of a given resource URL, and `resourceToDataURL`
 * should convert a resource to a data URL, potentially processing it according to the given options.
 *
 * Note: This function relies on asynchronous operations when dealing with the video's poster image.
 *
 * @async
 * @param {HTMLVideoElement} video - The video element to clone.
 * @param {Object} [options] - Optional parameters for processing the video's poster image.
 * @returns {Promise<HTMLImageElement>} A promise that resolves to an Image element containing the cloned content of the video.
 */
async function cloneVideoElement(video, options) {
  if (video.currentSrc) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL();
    return createImage(dataURL);
  }

  const poster = video.poster;
  const contentType = getMimeType(poster);
  const dataURL = await resourceToDataURL(poster, contentType, options);
  return createImage(dataURL);
}

/**
 * Asynchronously clones an iframe element by attempting to clone its internal document's body.
 *
 * This function tries to clone the content of the provided iframe's document body. It does this by accessing the iframe's `contentDocument.body`
 * and using an external function `cloneNode` that should be designed to clone a DOM node. The `cloneNode` function is assumed to take three parameters:
 * the node to clone, an options object (left empty in this call), and a boolean indicating whether the clone should be deep or shallow. In this case,
 * a deep clone is attempted to ensure all child nodes and content within the iframe's body are cloned.
 *
 * If accessing the iframe's content or cloning is not successful (which can happen due to same-origin policy restrictions or other errors),
 * the catch block logs an error message, and the function falls back to returning a shallow clone of the iframe element itself. A shallow clone means
 * that the returned iframe will not include any of the original iframe's child nodes or content.
 *
 * Note: This function may not successfully clone the iframe's content if the iframe is from a different origin, due to browser security policies.
 * In such cases, or when an error occurs during the cloning process, a shallow clone of the iframe element is returned.
 *
 * @async
 * @param {HTMLIFrameElement} iframe - The iframe element to clone.
 * @returns {Promise<Node>} A promise that resolves to a cloned node, which can be the deep clone of the iframe's document body if accessible and
 *                          successful, or a shallow clone of the iframe element itself in case of failure or cross-origin restrictions.
 */
async function cloneIFrameElement(iframe) {
  try {
    if (iframe?.contentDocument?.body) {
      return await cloneNode(iframe.contentDocument.body, {}, true);
    }
  } catch {
    // Failed to clone iframe
    console.error("Failed to clone iframe.");
  }

  return iframe.cloneNode(false);
}

/**
 * Asynchronously clones a single DOM node, with special handling for canvas, video, and iframe elements.
 *
 * This function determines the type of the provided DOM node and applies a specific cloning strategy based on its type.
 * - For `HTMLCanvasElement` elements, it uses `cloneCanvasElement` to clone the canvas, preserving its drawable content.
 * - For `HTMLVideoElement` elements, it uses `cloneVideoElement` along with any provided options to clone the video,
 *   capturing its current state or poster image.
 * - For `HTMLIFrameElement` elements, it uses `cloneIFrameElement` to attempt a clone of the iframe's document body.
 *
 * If the node does not match any of the special cases, it performs a shallow clone of the node (i.e., the clone will not include
 * any child nodes).
 *
 * The function assumes the existence of `cloneCanvasElement`, `cloneVideoElement`, and `cloneIFrameElement` for handling the cloning
 * of specific element types. These functions should be defined elsewhere and are designed to handle the complexities associated with
 * cloning their respective element types.
 *
 * Note: The function can accept additional options that are passed to the `cloneVideoElement` function for video elements. These options
 * are not used for other element types.
 *
 * @async
 * @param {Node} node - The DOM node to be cloned.
 * @param {Object} [options] - Optional parameters that are passed to the cloning function for video elements.
 * @returns {Promise<Node>} A promise that resolves to the cloned node. The exact type of the returned node depends on the input node type
 *                          and the cloning strategy applied.
 */
async function cloneSingleNode(node, options) {
  if (isInstanceOfElement(node, HTMLCanvasElement)) {
    return cloneCanvasElement(node);
  }

  if (isInstanceOfElement(node, HTMLVideoElement)) {
    return cloneVideoElement(node, options);
  }

  if (isInstanceOfElement(node, HTMLIFrameElement)) {
    return cloneIFrameElement(node);
  }

  return node.cloneNode(false);
}

/**
 * Checks if a given DOM node is a <slot> element.
 *
 * This function evaluates whether the provided DOM node is a <slot> element by checking the node's `tagName`.
 * It ensures the `tagName` property exists (to avoid errors on nodes without a `tagName`, like text nodes) and
 * then compares the `tagName` in uppercase form to the string "SLOT" to account for case sensitivity in HTML.
 *
 * Note: This function is designed to work with standard DOM elements and may not correctly identify <slot> elements
 * within namespaces or with customized tag names that extend the standard <slot> behavior.
 *
 * @param {Node} node - The DOM node to check.
 * @returns {boolean} `true` if the node is a <slot> element, `false` otherwise.
 */
const isSlotElement = (node) =>
  node.tagName != null && node.tagName.toUpperCase() === "SLOT";

/**
 * Asynchronously clones the children of a native DOM node into a cloned DOM node.
 *
 * This function is designed to handle the cloning of child nodes for a variety of element types, including handling special cases like
 * slot elements and iframes. For slot elements, it clones the assigned nodes (i.e., the nodes distributed to the slot). For iframes, it
 * clones the child nodes of the iframe's document body. For elements with a shadow root, it clones the child nodes of the shadow root;
 * otherwise, it clones the direct child nodes of the element.
 *
 * If the native node is a video element or has no children, the function immediately returns the cloned node without attempting to clone
 * any children. This is because video elements are handled separately due to their dynamic content and interaction models.
 *
 * The cloning process is performed asynchronously, and child nodes are cloned sequentially to preserve the order and ensure that each child
 * is fully cloned before appending it to the cloned node. This is achieved using a reduction pattern on the array of children, where each
 * step awaits the cloning of a child node before proceeding to the next.
 *
 * Note: This function relies on an external `cloneNode` function to clone individual nodes. This external function should accept a DOM node
 * and an options object, and return a promise that resolves to the cloned node. The `options` parameter is passed through to this `cloneNode`
 * function to allow for customization of the cloning process.
 *
 * @async
 * @param {Node} nativeNode - The original DOM node whose children are to be cloned.
 * @param {Node} clonedNode - The cloned DOM node to which the cloned children will be appended.
 * @param {Object} [options] - Optional parameters that may influence how child nodes are cloned.
 * @returns {Promise<Node>} A promise that resolves to the cloned node with its child nodes (if any) cloned and appended.
 */
async function cloneChildren(nativeNode, clonedNode, options) {
  let children = [];

  if (isSlotElement(nativeNode) && nativeNode.assignedNodes) {
    children = toArray(nativeNode.assignedNodes());
  } else if (
    isInstanceOfElement(nativeNode, HTMLIFrameElement) &&
    nativeNode.contentDocument?.body
  ) {
    children = toArray(nativeNode.contentDocument.body.childNodes);
  } else {
    children = toArray(
      nativeNode.shadowRoot
        ? nativeNode.shadowRoot.childNodes
        : nativeNode.childNodes
    );
  }

  if (
    children.length === 0 ||
    isInstanceOfElement(nativeNode, HTMLVideoElement)
  ) {
    return clonedNode;
  }

  await children.reduce(
    (deferred, child) =>
      deferred
        .then(() => cloneNode(child, options))
        .then((clonedChild) => {
          if (clonedChild) {
            clonedNode.appendChild(clonedChild);
          }
        }),
    Promise.resolve()
  );

  return clonedNode;
}

/**
 * Copies the computed CSS styles from a native DOM node to a cloned DOM node, with special adjustments.
 *
 * This function first retrieves the computed style of the `nativeNode` using `window.getComputedStyle` and then
 * attempts to directly copy these styles to the `clonedNode`. If the computed style's `cssText` property is usable,
 * it assigns this directly to the `clonedNode`'s style `cssText` property. Additionally, it ensures the `transformOrigin`
 * property is also copied. If the `cssText` property is not usable, it iterates over each computed style property
 * individually.
 *
 * Special adjustments are made for certain properties:
 * - For `font-size`, it slightly reduces the font size by 0.1 pixels before applying it to the cloned node.
 * - For iframes (`HTMLIFrameElement`), if the `display` property is computed as `inline`, it changes this to `block`
 *   when applying to the cloned node.
 * - For SVG `path` elements, if the property name is `d`, it sets the value to a `path()` function containing the `d`
 *   attribute of the cloned node.
 *
 * This approach ensures that the cloned node visually matches the original as closely as possible, with specific
 * adjustments to account for edge cases and improve the cloning fidelity.
 *
 * Note: This function assumes the existence of a utility function `toArray` which converts iterable objects into arrays.
 * This may be necessary for iterating over the computed style properties in environments where `sourceStyle` is not
 * directly iterable using `forEach`.
 *
 * @param {Element} nativeNode - The original DOM node from which styles are to be copied.
 * @param {Element} clonedNode - The cloned DOM node to which styles are to be applied.
 */
function cloneCSSStyle(nativeNode, clonedNode) {
  const targetStyle = clonedNode.style;
  if (!targetStyle) {
    return;
  }

  const sourceStyle = window.getComputedStyle(nativeNode);
  if (sourceStyle.cssText) {
    targetStyle.cssText = sourceStyle.cssText;
    targetStyle.transformOrigin = sourceStyle.transformOrigin;
  } else {
    toArray(sourceStyle).forEach((name) => {
      let value = sourceStyle.getPropertyValue(name);
      if (name === "font-size" && value.endsWith("px")) {
        const reducedFont =
          Math.floor(parseFloat(value.substring(0, value.length - 2))) - 0.1;
        value = `${reducedFont}px`;
      }

      if (
        isInstanceOfElement(nativeNode, HTMLIFrameElement) &&
        name === "display" &&
        value === "inline"
      ) {
        value = "block";
      }

      if (name === "d" && clonedNode.getAttribute("d")) {
        value = `path(${clonedNode.getAttribute("d")})`;
      }

      targetStyle.setProperty(
        name,
        value,
        sourceStyle.getPropertyPriority(name)
      );
    });
  }
}

/**
 * Clones the value of an input or textarea element from a native node to a cloned node.
 *
 * This function is specifically designed to handle the cloning of values for textarea and input elements. For a textarea element,
 * it directly sets the `innerHTML` of the cloned node to the value of the native node. For an input element, it sets the `value`
 * attribute of the cloned node to reflect the value of the native node. This ensures that the cloned node visually represents the
 * current state of the native node in terms of the text or data it contains.
 *
 * It's important to note that this function checks the type of the native node to apply the correct cloning strategy based on whether
 * the node is a textarea or an input element. This distinction is crucial because the way values are stored and thus need to be cloned
 * differs between these two types of form elements.
 *
 * Usage of this function should be limited to scenarios where replicating the visual and functional state of form elements is required,
 * such as when creating visual copies or snapshots of a form's current state.
 *
 * @param {Node} nativeNode - The original DOM node whose value is to be cloned.
 * @param {Node} clonedNode - The cloned DOM node where the value will be set.
 */
function cloneInputValue(nativeNode, clonedNode) {
  if (isInstanceOfElement(nativeNode, HTMLTextAreaElement)) {
    clonedNode.innerHTML = nativeNode.value;
  }

  if (isInstanceOfElement(nativeNode, HTMLInputElement)) {
    clonedNode.setAttribute("value", nativeNode.value);
  }
}

/**
 * Clones the selected value of a select element from a native node to a cloned node.
 *
 * This function specifically addresses the cloning of the selected state from a native `<select>` element to its cloned counterpart. It
 * ensures that the option which was selected in the original `<select>` element is also marked as selected in the cloned `<select>` element.
 * This is achieved by iterating over the children of the cloned `<select>` element (which are expected to be `<option>` elements), comparing
 * each option's value attribute to the value of the native `<select>` element, and setting the `selected` attribute on the matching cloned option.
 *
 * This process is essential for accurately replicating the state of a `<select>` element, including user selections, in scenarios where a visual
 * or functional duplicate of a form or interactive element is needed, such as generating a static snapshot of a form's current state for printing
 * or for creating a visual copy for a preview feature.
 *
 * Note: This function assumes that the cloned `<select>` element already contains option elements that are exact copies of those in the native
 * `<select>` element, including matching value attributes.
 *
 * @param {Node} nativeNode - The original DOM node of the `<select>` element whose selected value is to be cloned.
 * @param {Node} clonedNode - The cloned DOM node of the `<select>` element where the selected value will be replicated.
 */
function cloneSelectValue(nativeNode, clonedNode) {
  if (isInstanceOfElement(nativeNode, HTMLSelectElement)) {
    const clonedSelect = clonedNode;
    const selectedOption = Array.from(clonedSelect.children).find(
      (child) => nativeNode.value === child.getAttribute("value")
    );

    if (selectedOption) {
      selectedOption.setAttribute("selected", "");
    }
  }
}

/**
 * Applies various cloning operations to replicate the state and style of a native DOM node onto a cloned DOM node.
 *
 * This function acts as a comprehensive decorator for a cloned DOM node, where it applies multiple specific cloning operations to ensure
 * the cloned node accurately represents the visual and functional state of the original (native) node. These operations include cloning CSS
 * styles, pseudo-elements, input values (for input and textarea elements), and the selected value of select elements.
 *
 * The process starts by checking if the cloned node is an instance of an `Element`, to ensure that style and property manipulations are only
 * applied to node types that support them. If the check passes, the function sequentially calls:
 *
 * - `cloneCSSStyle`: to clone the computed CSS styles from the native node to the cloned node.
 * - `clonePseudoElements`: to clone the styles of pseudo-elements (:before, :after) from the native node to the cloned node.
 * - `cloneInputValue`: to clone the current value of input or textarea elements from the native node to the cloned node.
 * - `cloneSelectValue`: to clone the selected state of options within a select element from the native node to the cloned node.
 *
 * After performing these operations, the cloned node, now enhanced to more closely mirror the original node's appearance and state, is returned.
 *
 * Note: This function assumes the existence and proper implementation of `cloneCSSStyle`, `clonePseudoElements`, `cloneInputValue`, and
 * `cloneSelectValue` functions. These functions should be designed to handle the intricacies of cloning their respective aspects of a DOM node.
 *
 * @param {Node} nativeNode - The original DOM node to be cloned.
 * @param {Node} clonedNode - The cloned DOM node to decorate.
 * @returns {Node} The decorated cloned node, enhanced to replicate the native node's state and style.
 */
function decorate(nativeNode, clonedNode) {
  if (isInstanceOfElement(clonedNode, Element)) {
    cloneCSSStyle(nativeNode, clonedNode);
    clonePseudoElements(nativeNode, clonedNode);
    cloneInputValue(nativeNode, clonedNode);
    cloneSelectValue(nativeNode, clonedNode);
  }

  return clonedNode;
}

/**
 * Asynchronously ensures that SVG symbols used within a cloned element are also available in the clone.
 *
 * This function addresses the issue where SVG `<use>` elements within a cloned DOM tree reference symbols that might not exist within
 * the cloned context. It does this by querying all `<use>` elements within the cloned element and checking if their referenced symbols
 * exist. If a symbol is referenced but not present in the clone, this function attempts to find and clone the original symbol definition
 * from the document and then inject it into a hidden SVG element within the clone.
 *
 * The function handles the cloning of symbol definitions only once per unique symbol to avoid duplication. It also ensures that the
 * newly created SVG container for the symbols is hidden and does not affect the layout or display of the document.
 *
 * This process is vital for maintaining the integrity and functionality of SVG graphics that rely on symbol definitions for reuse across
 * different parts of the document, especially when those parts are being cloned for use in isolated contexts (e.g., popups, mirrors of
 * the document).
 *
 * Note: This function assumes the existence of an `cloneNode` async function that is capable of deeply cloning a given node with options.
 *
 * @async
 * @param {Node} clone - The cloned node (or subtree) that may contain `<use>` elements referencing SVG symbols.
 * @param {Object} [options] - Optional parameters that may influence how nodes are cloned.
 * @returns {Promise<Node>} A promise that resolves to the cloned node, potentially modified to include definitions of SVG symbols
 *                          that are referenced within it.
 */
async function ensureSVGSymbols(clone, options) {
  const uses = clone.querySelectorAll ? clone.querySelectorAll("use") : [];
  if (uses.length === 0) {
    return clone;
  }

  const processedDefs = {};
  for (let i = 0; i < uses.length; i++) {
    const use = uses[i];
    const id = use.getAttribute("xlink:href");
    if (id) {
      const exist = clone.querySelector(id);
      const definition = document.querySelector(id);
      if (!exist && definition && !processedDefs[id]) {
        processedDefs[id] = await cloneNode(definition, options, true);
      }
    }
  }

  const nodes = Object.values(processedDefs);
  if (nodes.length) {
    const ns = "http://www.w3.org/1999/xhtml";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("xmlns", ns);
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "hidden";
    svg.style.display = "none";

    const defs = document.createElementNS(ns, "defs");
    svg.appendChild(defs);

    for (let i = 0; i < nodes.length; i++) {
      defs.appendChild(nodes[i]);
    }

    clone.appendChild(svg);
  }

  return clone;
}

/**
 * Asynchronously clones a DOM node with optional filtering, custom handling for specific node types, and enhancements.
 *
 * This function serves as a comprehensive cloning utility that can clone a given DOM node along with its children, apply custom
 * styling and attributes, handle specific elements like SVG symbols, and respect a filtering criterion. The cloning process involves
 * several steps:
 * 1. Filtering: If a `filter` function is provided in the options and the current node does not pass the filter (and the node is not
 *    the root node being cloned), the cloning process is halted, and `null` is returned.
 * 2. Cloning: The node is cloned. This step includes special handling based on the node's type (e.g., canvas, video, iframe).
 * 3. Child Cloning: The children of the node are recursively cloned, applying the same filtering and special handling to each.
 * 4. Decoration: The cloned node is enhanced by copying styles and other attributes from the original node.
 * 5. SVG Symbol Handling: If the cloned node uses SVG symbols, this function ensures those symbols are available in the cloned context.
 *
 * The cloning process is customizable through an options object, which can include a `filter` function to exclude certain nodes from
 * being cloned, among other possible options.
 *
 * Note: This function is designed to be flexible and extensible, accommodating a variety of cloning scenarios, including deep cloning
 * of complex DOM structures with special considerations for elements that require additional processing to maintain their functionality
 * and appearance in the cloned output.
 *
 * @async
 * @param {Node} node - The DOM node to clone.
 * @param {Object} options - An options object for configuring the cloning process. May include a `filter` function to exclude certain nodes.
 * @param {boolean} isRoot - Indicates whether the node being cloned is the root of the cloning operation. Used to ensure the root node is always cloned regardless of the filter.
 * @returns {Promise<Node>} A promise that resolves to the cloned node, or `null` if the node was excluded by the filter and is not the root.
 */
async function cloneNode(node, options, isRoot) {
  if (!isRoot && options.filter && !options.filter(node)) {
    return null;
  }

  return Promise.resolve(node)
    .then((clonedNode) => cloneSingleNode(clonedNode, options))
    .then((clonedNode) => cloneChildren(node, clonedNode, options))
    .then((clonedNode) => decorate(node, clonedNode))
    .then((clonedNode) => ensureSVGSymbols(clonedNode, options));
}

module.exports = {
  cloneNode,
};
