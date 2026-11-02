import { describe, expect, it } from "vitest";

import { parseStreamyardEmbed, streamyardId } from "./stream";

describe("parseStreamyardEmbed", () => {
  it("extrait le lien du code d'intégration StreamYard", () => {
    const code =
      '<div style="width:100%;height:0px;position:relative;padding-bottom:56.25%;"><iframe src="https://streamyard.com/watch/tBKnTkEQNbcM?embed=true" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen"></iframe></div>';
    expect(parseStreamyardEmbed(code)).toBe("https://streamyard.com/watch/tBKnTkEQNbcM?embed=true");
  });

  it("accepte un simple lien et ajoute embed=true", () => {
    expect(parseStreamyardEmbed("https://streamyard.com/watch/4XgFVqbD93jc")).toBe(
      "https://streamyard.com/watch/4XgFVqbD93jc?embed=true",
    );
  });

  it("refuse le reste", () => {
    expect(parseStreamyardEmbed("https://youtube.com/watch?v=abc")).toBeNull();
    expect(parseStreamyardEmbed("")).toBeNull();
    expect(parseStreamyardEmbed(null)).toBeNull();
  });

  it("donne l'identifiant de la diffusion", () => {
    expect(streamyardId("https://streamyard.com/watch/tBKnTkEQNbcM?embed=true")).toBe("tBKnTkEQNbcM");
    expect(streamyardId(null)).toBeNull();
  });
});
