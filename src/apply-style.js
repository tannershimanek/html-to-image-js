/**
 * Applies styling options to a specified DOM node.
 *
 * This function directly modifies the style of the given DOM node based on the
 * options provided. The options can include predefined properties such as
 * `backgroundColor`, `width`, and `height`. Additionally, custom styles can be
 * applied by passing an object containing any valid CSS properties and values
 * under the `style` key in the options object.
 *
 * Note: For `width` and `height` properties, the values are expected to be
 * numbers, which will be converted to pixel values. Other style properties
 * provided in the `style` object should have values formatted as per CSS
 * standards (e.g., '100px', '1em', 'red').
 *
 * @param {HTMLElement} node - The DOM node to which styles will be applied.
 * @param {Object} options - An object containing style options. Can include
 *                           `backgroundColor`, `width`, `height`, and `style`.
 * @param {string} [options.backgroundColor] - The background color to apply.
 * @param {number} [options.width] - The width to apply, in pixels.
 * @param {number} [options.height] - The height to apply, in pixels.
 * @param {Object} [options.style] - An object containing any custom styles to apply.
 *                                   Each key should be a CSS property name, and
 *                                   each value should be the corresponding CSS value.
 * @returns {HTMLElement} The DOM node with styles applied.
 */
function applyStyle(node, options) {
  const { style } = node;

  if (options.backgroundColor) {
    style.backgroundColor = options.backgroundColor;
  }

  if (options.width) {
    style.width = `${options.width}px`;
  }

  if (options.height) {
    style.height = `${options.height}px`;
  }

  const manual = options.style;
  if (manual != null) {
    Object.keys(manual).forEach((key) => {
      style[key] = manual[key];
    });
  }

  return node;
}

module.exports = {
  applyStyle,
};
