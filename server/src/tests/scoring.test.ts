import { describe, expect, it } from "vitest";
import { getPointsForPosition } from "../lib/scoring.js";

describe("pontuação por colocação", () => {
  it("1º lugar = 10 pontos", () => {
    expect(getPointsForPosition(1)).toBe(10);
  });

  it("2º lugar = 6 pontos", () => {
    expect(getPointsForPosition(2)).toBe(6);
  });

  it("3º lugar = 4 pontos", () => {
    expect(getPointsForPosition(3)).toBe(4);
  });

  it("4º em diante = 1 ponto", () => {
    expect(getPointsForPosition(4)).toBe(1);
    expect(getPointsForPosition(9)).toBe(1);
  });

  it("empates usam a mesma posição e mesmos pontos", () => {
    const positions = [1, 2, 2, 4];
    const points = positions.map((position) => getPointsForPosition(position));
    expect(points).toEqual([10, 6, 6, 1]);
  });
});
