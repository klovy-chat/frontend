/**
 * Liczy współrzędne (top/left/height) danego znaku w <textarea> względem
 * lewego-górnego rogu textarei. Wykorzystuje technikę mirror-div: tworzymy
 * ukryty element kopiujący style textarei, wstawiamy tekst do wskazanej pozycji
 * i mierzymy położenie markera. textarea nie udostępnia tego natywnie.
 */

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

// Właściwości, które wpływają na rozkład tekstu i muszą zostać skopiowane.
const MIRRORED_PROPERTIES = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number,
): CaretCoordinates {
  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(element);

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflowWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";

  for (const prop of MIRRORED_PROPERTIES) {
    mirror.style[prop as any] = computed[prop as any];
  }

  mirror.textContent = element.value.substring(0, position);

  const marker = document.createElement("span");
  // Zawartość markera musi być niepusta, aby uzyskać poprawne wymiary.
  marker.textContent = element.value.substring(position) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const coordinates: CaretCoordinates = {
    top: marker.offsetTop - element.scrollTop,
    left: marker.offsetLeft - element.scrollLeft,
    height: parseInt(computed.lineHeight, 10) || marker.offsetHeight,
  };

  document.body.removeChild(mirror);

  return coordinates;
}
