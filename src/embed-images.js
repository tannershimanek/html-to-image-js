const embedResources = require("./embed-resources");
const util = require("./util");
const dataurl = require("./dataurl");
const mimes = require("./mimes");

/**
 * Asynchronously embeds external resources referenced in a specific CSS property of a DOM node into the node itself.
 *
 * This function takes a CSS property name and a DOM node, attempts to retrieve the property value from the node's style,
 * and then processes the value to embed any external resources it references (e.g., images, fonts) directly into the style
 * declaration. This embedding process is facilitated by the `embedResources` function (which must be defined elsewhere),
 * converting URLs within the property value to data URLs or similar inline formats. The processed CSS string, with resources
 * embedded, is then reapplied to the original property of the node, preserving any original CSS property priority (e.g., `!important`).
 *
 * Logging statements are included to track the function's progress, which can be helpful for debugging purposes.
 *
 * @async
 * @param {string} propName - The name of the CSS property to process (e.g., 'background-image').
 * @param {Element} node - The DOM node whose style property will be modified.
 * @param {Object} options - Options to pass to the `embedResources` function, possibly including details on how resources are fetched and embedded.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the property was successfully processed and embedded; otherwise, `false`.
 */
async function embedProp(propName, node, options) {
  console.log("embedProp 1");
  const propValue = node.style?.getPropertyValue(propName);
  console.log("embedProp 2");
  if (propValue) {
    console.log("embedProp 3");
    const cssString = await embedResources.embedResources(
      propValue,
      null,
      options
    );
    console.log("embedProp 4");
    node.style.setProperty(
      propName,
      cssString,
      node.style.getPropertyPriority(propName)
    );
    console.log("embedProp 5");
    return true;
  }
  return false;
}

/**
 * Asynchronously processes a cloned DOM node to embed external resources referenced in its background and mask properties.
 *
 * This function attempts to embed external resources (e.g., images, fonts) for both the 'background' and 'mask' CSS properties of a cloned
 * DOM node. It handles both shorthand properties ('background', 'mask') and their specific image properties ('background-image', 'mask-image').
 * The embedding is performed by calling `embedProp` for each property, which processes the property value to embed any referenced resources.
 * If a shorthand property is successfully processed, its specific image property is not processed to avoid redundancy.
 *
 * Logging statements are included to mark the beginning and end of the embedding process for each property, which can assist in troubleshooting.
 *
 * @async
 * @param {Element} clonedNode - The cloned DOM node whose background and mask properties will be processed.
 * @param {Object} options - Options to pass to the `embedProp` function, influencing how resources are fetched and embedded.
 */
async function embedBackground(clonedNode, options) {
  console.log("embedBackground 1");
  if (!(await embedProp("background", clonedNode, options))) {
    console.log("embedBackground 2");
    await embedProp("background-image", clonedNode, options);
    console.log("embedBackground 3");
  }
  if (!(await embedProp("mask", clonedNode, options))) {
    console.log("embedBackground 4");
    await embedProp("mask-image", clonedNode, options);
    console.log("embedBackground 5");
  }
}

/**
 * Asynchronously embeds an image node's external resource as a data URL directly within the node's attributes.
 *
 * This function targets `HTMLImageElement` and `SVGImageElement` nodes to replace their external resource references (specified via `src` or `href`)
 * with data URLs. The function first checks if the node is an image or SVG image element and if its resource is not already a data URL. If both
 * conditions are met, it fetches the resource, converts it to a data URL, and updates the node's attribute to use this data URL.
 *
 * For `HTMLImageElement` nodes, this involves setting the `src` attribute to the new data URL and clearing any `srcset` attribute to ensure the
 * data URL is used. For `SVGImageElement` nodes, the `href` attribute (accessed via `href.baseVal`) is updated. Additionally, if the image
 * supports lazy loading (i.e., has a `loading` attribute set to `"lazy"`), this attribute is set to `"eager"` to ensure the image loads immediately
 * with the newly set data URL.
 *
 * The function utilizes utility functions from a `util` object to check the instance of the element and `dataurl` object functions to verify URLs
 * and convert resources to data URLs. The MIME type for the resource URL is determined using a `mimes` object before conversion.
 *
 * After setting the data URL, the function waits for the image to load successfully, handling both the `onload` and `onerror` events, to ensure
 * that the embedding process completes or fails gracefully.
 *
 * @async
 * @param {Element} clonedNode - The image node (`HTMLImageElement` or `SVGImageElement`) whose external resource will be embedded.
 * @param {Object} options - Options to control the resource fetching and conversion process.
 */
async function embedImageNode(clonedNode, options) {
  const isImageElement = util.isInstanceOfElement(clonedNode, HTMLImageElement);

  if (
    !(isImageElement && !dataurl.isDataUrl(clonedNode.src)) &&
    !(
      util.isInstanceOfElement(clonedNode, SVGImageElement) &&
      !dataurl.isDataUrl(clonedNode.href.baseVal)
    )
  ) {
    return;
  }

  const url = isImageElement ? clonedNode.src : clonedNode.href.baseVal;

  const dataURL = await dataurl.resourceToDataURL(
    url,
    mimes.getMimeType(url),
    options
  );
  await new Promise((resolve, reject) => {
    clonedNode.onload = resolve;
    clonedNode.onerror = reject;

    const image = clonedNode;
    if (image.decode) {
      image.decode = resolve;
    }

    if (image.loading === "lazy") {
      image.loading = "eager";
    }

    if (isImageElement) {
      clonedNode.srcset = "";
      clonedNode.src = dataURL;
    } else {
      clonedNode.href.baseVal = dataURL;
    }
  });
}

/**
 * Asynchronously embeds images within all children of a cloned DOM node.
 *
 * This function iterates over all child nodes of a given cloned node and attempts to embed images for each child node recursively.
 * It converts child nodes into an array for iteration and then maps each child node to a promise that is resolved by `embedImages`,
 * effectively applying image embedding to the entire subtree rooted at the cloned node. The function waits for all these operations
 * to complete using `Promise.all` before concluding the embedding process for the set of child nodes.
 *
 * The primary purpose of this function is to ensure that all images within a cloned node and its descendants are properly embedded,
 * making the cloned subtree self-contained with respect to its image resources.
 *
 * @async
 * @param {Node} clonedNode - The cloned DOM node whose child nodes will be processed for image embedding.
 * @param {Object} options - Configuration options passed to image embedding functions, potentially influencing how images are fetched and embedded.
 */
async function embedChildren(clonedNode, options) {
  const children = util.toArray(clonedNode.childNodes);
  const deferreds = children.map((child) => embedImages(child, options));
  await Promise.all(deferreds).then(() => clonedNode);
}

/**
 * Recursively embeds images and background resources within a cloned DOM node and its descendants.
 *
 * This function applies a comprehensive approach to embedding images within a cloned node. It checks if the cloned node is an instance
 * of `Element` and, if so, sequentially:
 * 1. Embeds background images referenced in CSS properties of the cloned node.
 * 2. Directly embeds the image if the cloned node is an `<img>` or an `<image>` element within an SVG.
 * 3. Recursively embeds images within all child nodes of the cloned node.
 *
 * This ensures that all types of image references, whether in CSS backgrounds or `<img>` tags, including those nested within child nodes,
 * are converted to data URLs or otherwise embedded directly within the cloned node or its descendants. The process aims to make the cloned
 * node's representation of images independent of external resources, enhancing portability and display consistency.
 *
 * @async
 * @param {Node} clonedNode - The cloned DOM node to process for image embedding.
 * @param {Object} options - Configuration options for fetching and embedding images, including cache management and resource fetching options.
 */
async function embedImages(clonedNode, options) {
  console.log("embedImages 1");
  if (util.isInstanceOfElement(clonedNode, Element)) {
    console.log("embedImages 2");
    await embedBackground(clonedNode, options);
    console.log("embedImages 3");
    await embedImageNode(clonedNode, options);
    console.log("embedImages 4");
    await embedChildren(clonedNode, options);
    console.log("embedImages 5");
  }
}

module.exports = {
  embedImages,
};
