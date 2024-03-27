const cloneNode = require("./clone-node").cloneNode;
const embedImages = require("./embed-images").embedImages;
const applyStyle = require("./apply-style").applyStyle;
const embedWebFonts = require("./embed-webfonts").embedWebFonts;
const getWebFontCSS = require("./embed-webfonts").getWebFontCSS;
const utils = require("./util.js");

const getImageSize = utils.getImageSize;
const getPixelRatio = utils.getPixelRatio;
const createImage = utils.createImage;
const canvasToBlob = utils.canvasToBlob;
const nodeToDataURL = utils.nodeToDataURL;
const checkCanvasDimensions = utils.checkCanvasDimensions;

/**
 * Converts a DOM node into a SVG image represented as a Data URL.
 *
 * This asynchronous function performs a series of steps to convert a given DOM node into a SVG image.
 * First, it calculates the image size based on the provided node and options. Then, it clones the node
 * to avoid modifying the original element. The function proceeds to embed any web fonts and images referenced
 * by the cloned node into the clone itself, ensuring that all visual aspects of the node are preserved.
 * After applying custom styles from the options, the function converts the fully prepared cloned node into
 * a Data URL representing a SVG image. This process is particularly useful for creating a static, portable
 * representation of dynamic or interactive content that can be used in contexts where the original DOM structure
 * is not available.
 *
 * Logging statements are included at each major step for debugging purposes, indicating the function's progress.
 *
 * @async
 * @param {Node} node - The DOM node to convert into a SVG image.
 * @param {Object} [options={}] - Optional settings to control aspects of the conversion process, such as image size, styles, and whether to embed fonts or images.
 * @returns {Promise<string>} A promise that resolves to a Data URL representing the node as a SVG image.
 */
async function toSvg(node, options = {}) {
  console.log('toSvg 1')
  const { width, height } = getImageSize(node, options);
  console.log('toSvg 2')
  const clonedNode = await cloneNode(node, options, true);
  console.log('toSvg 3')
  await embedWebFonts(clonedNode, options);
  console.log('toSvg 4')
  await embedImages(clonedNode, options);
  console.log('toSvg 5')
  applyStyle(clonedNode, options);
  console.log('toSvg 6')
  const datauri = await nodeToDataURL(clonedNode, width, height);
  console.log('toSvg 7')
  return datauri;
}

/**
 * Converts a DOM node into a canvas element.
 *
 * This asynchronous function first converts the provided DOM node into a SVG image represented as a Data URL,
 * using the `toSvg` function. It then creates an image element from this SVG, draws the image onto a canvas,
 * and returns the canvas. This process allows for dynamic content represented by the DOM node to be captured
 * in a static, rasterized form suitable for operations that require canvas-based manipulations, such as image processing
 * or generating downloadable images.
 *
 * The function supports several options to customize the output, including setting the canvas size, the pixel ratio for
 * high DPI devices, and a background color. Additionally, it can automatically adjust the canvas dimensions based on the content
 * or respect specified dimensions. If the `backgroundColor` option is provided, the canvas will be filled with this color before
 * the image is drawn, allowing for a custom background for transparent images.
 *
 * @async
 * @param {Node} node - The DOM node to convert into a canvas.
 * @param {Object} [options={}] - Optional settings to control aspects of the canvas generation process, such as dimensions, pixel ratio, and background color.
 * @returns {Promise<HTMLCanvasElement>} A promise that resolves to a canvas element containing a rasterized version of the DOM node.
 */
async function toCanvas(node, options = {}) {
  console.log('toCanvas 1')

  const { width, height } = getImageSize(node, options);
  console.log('toCanvas 3')

  const svg = await toSvg(node, options);
  console.log('toCanvas 4')
  const img = await createImage(svg);
  const canvas = document.createElement("canvas");

  const context = canvas.getContext("2d");
  const ratio = options.pixelRatio || getPixelRatio();
  const canvasWidth = options.canvasWidth || width;
  const canvasHeight = options.canvasHeight || height;

  canvas.width = canvasWidth * ratio;
  canvas.height = canvasHeight * ratio;

  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas);
  }
  canvas.style.width = `${canvasWidth}`;
  canvas.style.height = `${canvasHeight}`;

  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(img, 0, 0, canvas.width, canvas.height);

  console.log('toCanvas 2')

  return canvas;
}
// FIXME: left off here
async function toPixelData(node, options = {}) {
  const { width, height } = getImageSize(node, options);
  const canvas = await toCanvas(node, options);
  const ctx = canvas.getContext("2d");
  return ctx.getImageData(0, 0, width, height).data;
}

async function toPng(node, options = {}) {
  // console.log('toPng')
  const canvas = await toCanvas(node, options);
  return canvas.toDataURL();
}

async function toJpeg(node, options = {}) {
  const canvas = await toCanvas(node, options);
  return canvas.toDataURL("image/jpeg", options.quality || 1);
}

async function toBlob(node, options = {}) {
  const canvas = await toCanvas(node, options);
  const blob = await canvasToBlob(canvas);
  return blob;
}

async function getFontEmbedCSS(node, options = {}) {
  return getWebFontCSS(node, options);
}

module.exports = {
  toSvg,
  toCanvas,
  toPixelData,
  toPng,
  toJpeg,
  toBlob,
  getFontEmbedCSS,
};
