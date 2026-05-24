const REACTION_ICON_BY_VALUE: Record<string, string> = {
  thumb: "icon-reaction-thumb",
  "\u{1f44d}": "icon-reaction-thumb",
  clap: "icon-reaction-clap",
  "\u{1f44f}": "icon-reaction-clap",
  party: "icon-reaction-party",
  "\u{1f389}": "icon-reaction-party",
  heart: "icon-reaction-heart",
  "\u2764\ufe0f": "icon-reaction-heart",
  laugh: "icon-reaction-laugh",
  "\u{1f602}": "icon-reaction-laugh",
};

export function getReactionIconId(reaction: string): string | undefined {
  return REACTION_ICON_BY_VALUE[reaction];
}

export function createReactionIcon(reaction: string): SVGSVGElement | undefined {
  const iconId = getReactionIconId(reaction);
  if (!iconId) return undefined;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("reaction-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${iconId}`);
  svg.appendChild(use);

  return svg;
}
