// Website only: brings the inside of every screen to the approved design on a laptop/PC window.
// Applies from 1024px wide. Expo never loads a .web.ts file in the Android or iOS apps.
import { ui } from "./webUi";

const CSS = `
@media (min-width: 1024px) {
  div, span, input, textarea, select, button { font-family: ${ui.font} !important; }

  /* Text weight: no heavy 900 text */
  .font-black, .font-extrabold { font-weight: 600 !important; }
  .font-bold { font-weight: 500 !important; }

  /* Sentence case, normal letter spacing */
  .uppercase { text-transform: none !important; }
  .tracking-tight, .tracking-tighter, .tracking-wide, .tracking-wider, .tracking-widest { letter-spacing: normal !important; }

  /* Readable small text */
  .text-\\[8px\\], .text-\\[9px\\], .text-\\[9\\.5px\\], .text-\\[10px\\], .text-\\[11px\\] { font-size: 12px !important; line-height: 16px !important; }

  /* One corner size for cards, one for controls */
  .rounded-3xl, .rounded-2xl, .rounded-\\[18px\\], .rounded-\\[24px\\], .rounded-\\[28px\\], .rounded-\\[32px\\], .rounded-\\[36px\\] { border-radius: ${ui.radius.card}px !important; }
  .rounded-xl, .rounded-lg { border-radius: ${ui.radius.control}px !important; }

  /* Light, even shadows */
  .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl { box-shadow: 0 1px 3px rgba(31, 27, 61, 0.08) !important; }

  /* Focus ring on text boxes instead of the browser default */
  input:focus, textarea:focus { outline: none !important; }

  /* Slim scrollbars */
  * { scrollbar-width: thin; scrollbar-color: ${ui.color.borderStrong} transparent; }
}
`;

if (typeof document !== "undefined" && !document.getElementById("paycore-web-desktop")) {
  const tag = document.createElement("style");
  tag.id = "paycore-web-desktop";
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

export {};
