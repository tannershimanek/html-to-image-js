const util = require("./util");
const uuid = util.uuid;
const toArray = util.toArray;

const Pseudo = {
  BEFORE: ":before",
  AFTER: ":after",
};

/**
 * Formats the CSS text of a given style declaration object to include a sanitized `content` property.
 *
 * This function creates a string representation of the CSS styles from a CSSStyleDeclaration object, specifically designed to handle the
 * `content` property with care. It extracts the `content` property value, removes any single or double quotes from it to prevent syntax
 * errors or conflicts, and then appends this sanitized `content` value back to the complete CSS text. This approach ensures that when
 * the `content` property is used (commonly with pseudo-elements like ::before and ::after), it is correctly formatted and safe to use in
 * dynamically generated styles or when injecting styles into the DOM.
 *
 * The primary benefit of using this function is to ensure that the `content` property, which often contains quotes or special characters
 * that need to be escaped, is handled correctly. This is particularly useful in scenarios where CSS text is programmatically manipulated
 * or applied, ensuring that the resulting style declarations are valid and render as intended in the browser.
 *
 * @param {CSSStyleDeclaration} style - The style declaration from which to format the CSS text, typically obtained from an element's computed style.
 * @returns {string} The formatted CSS text, including the sanitized `content` property, ready for use in style attributes or CSS sheets.
 */
function formatCSSText(style) {
  const content = style.getPropertyValue("content");
  return `${style.cssText} content: '${content.replace(/'|"/g, "")}';`;
}

/**
 * Converts a CSSStyleDeclaration object into a string of CSS properties, including priority flags.
 *
 * This function iterates over all properties in a given CSSStyleDeclaration object (usually obtained through `window.getComputedStyle(element)`)
 * and formats them into a single string. Each property's name and value are retrieved, along with its priority (to determine if the `!important`
 * flag is used). The resulting string contains all CSS properties from the object, formatted as they would appear in a CSS stylesheet or `style`
 * attribute, with properties separated by spaces and including `!important` flags where applicable.
 *
 * This utility is particularly useful for serializing an element's computed style properties for debugging, storage, or transferring styles
 * from one element to another programmatically. It ensures that the specificity and priority of styles (marked by `!important`) are preserved
 * in the formatted string.
 *
 * @param {CSSStyleDeclaration} style - The CSSStyleDeclaration object containing the styles to format.
 * @returns {string} A string representation of the CSS properties, formatted as "name: value[ !important];", and separated by spaces.
 */
function formatCSSProperties(style) {
  return toArray(style)
    .map((name) => {
      const value = style.getPropertyValue(name);
      const priority = style.getPropertyPriority(name);

      return `${name}: ${value}${priority ? " !important" : ""};`;
    })
    .join(" ");
}

/**
 * Generates a text node containing the CSS style rule for a specified pseudo-element.
 *
 * This function creates a CSS rule for a pseudo-element (e.g., ::before, ::after) of a class, formatting the CSS properties
 * either from the `cssText` of the provided `style` object or by individually formatting each property if `cssText` is not
 * available. It supports both inline styles (`cssText` present) and computed styles (individual properties). The CSS rule
 * is constructed with the class name and pseudo-element specified, and the resulting CSS text is wrapped in a text node.
 * This is useful for dynamically inserting style rules into the document, especially for pseudo-elements which cannot be
 * styled through inline `style` attributes.
 *
 * The function relies on `formatCSSText` or `formatCSSProperties` for generating the CSS text, ensuring proper handling
 * of special cases like the `content` property, and inclusion of `!important` flags where necessary.
 *
 * @param {string} className - The class name of the element(s) to target.
 * @param {string} pseudo - The pseudo-element to style (e.g., "before", "after").
 * @param {CSSStyleDeclaration} style - The CSS style declaration object from which to generate the style rule.
 * @returns {Text} A text node containing the CSS rule for the specified pseudo-element of the class.
 */
function getPseudoElementStyle(className, pseudo, style) {
  const selector = `.${className}:${pseudo}`;
  const cssText = style.cssText
    ? formatCSSText(style)
    : formatCSSProperties(style);

  return document.createTextNode(`${selector}{${cssText}}`);
}

/**
 * Clones the style of a pseudo-element from a native node to a cloned node, applying it via a dynamically created <style> element.
 *
 * This function is designed to clone the styles of pseudo-elements (e.g., ::before, ::after) from a given native DOM node to a cloned
 * node. It first retrieves the computed style of the specified pseudo-element using `window.getComputedStyle`. If the pseudo-element has
 * no content or its content is set to 'none', the function does not proceed further, as the pseudo-element is not visually represented.
 *
 * A unique class name is generated (via a `uuid` function not defined here) and added to the cloned node's class list. This ensures that
 * the style rules applied are specific to this instance of the cloned node. A new <style> element is then created and appended to the cloned
 * node, containing the CSS rules for the pseudo-element, targeting the newly added class name. This method allows for the dynamic application
 * of styles to cloned nodes, including those for pseudo-elements, which cannot be directly modified via the DOM.
 *
 * Note: The actual cloning of the pseudo-element's style is facilitated by the `getPseudoElementStyle` function, which generates a text node
 * containing the necessary CSS rules based on the computed styles.
 *
 * @param {Element} nativeNode - The original DOM element from which the pseudo-element's styles are to be cloned.
 * @param {Element} clonedNode - The cloned DOM element to which the pseudo-element's styles will be applied.
 * @param {string} pseudo - The pseudo-element selector (e.g., "::before" or "::after") indicating which pseudo-element's styles are to be cloned.
 */
function clonePseudoElement(nativeNode, clonedNode, pseudo) {
  const style = window.getComputedStyle(nativeNode, pseudo);
  const content = style.getPropertyValue("content");
  if (content === "" || content === "none") {
    return;
  }

  const className = uuid();
  try {
    clonedNode.className = `${clonedNode.className} ${className}`;
  } catch (err) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.appendChild(getPseudoElementStyle(className, pseudo, style));
  clonedNode.appendChild(styleElement);
}

/**
 * Clones the ::before and ::after pseudo-elements from a native DOM element to a cloned DOM element.
 *
 * This function facilitates the cloning of styles associated with the ::before and ::after pseudo-elements
 * from a source element (`nativeNode`) to a target element (`clonedNode`). It leverages the `clonePseudoElement`
 * function to individually clone each pseudo-element's styles. The `Pseudo` object, which should contain
 * constants for the pseudo-element selectors (e.g., `Pseudo.BEFORE` for "::before", `Pseudo.AFTER` for "::after"),
 * is used to specify which pseudo-elements to clone.
 *
 * This operation is crucial for ensuring that the visual appearance of the cloned element matches that of the
 * original, including content generated by CSS. It is particularly useful in scenarios where a visual duplicate
 * of a DOM element is required, such as in printing, creating a snapshot for a web application, or dynamically
 * replicating elements with complex styling.
 *
 * Note: This function assumes the `clonePseudoElement` function is defined and capable of cloning the specified
 * pseudo-element's styles from the `nativeNode` to the `clonedNode`, and that the `Pseudo` object is predefined
 * with appropriate values.
 *
 * @param {Element} nativeNode - The original DOM element from which to clone the pseudo-elements.
 * @param {Element} clonedNode - The cloned DOM element to which the pseudo-elements' styles will be applied.
 */
function clonePseudoElements(nativeNode, clonedNode) {
  clonePseudoElement(nativeNode, clonedNode, Pseudo.BEFORE);
  clonePseudoElement(nativeNode, clonedNode, Pseudo.AFTER);
}

module.exports = {
  clonePseudoElements,
};
