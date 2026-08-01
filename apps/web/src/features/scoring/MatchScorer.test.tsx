// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchState } from "@badminton-scorer/shared";
import { App } from "../../App.js";
import { createMatch, recordPoint, undoPoint } from "../../services/matches.js";

vi.mock("../../services/matches.js", () => ({
  createMatch: vi.fn(),
  recordPoint: vi.fn(),
  undoPoint: vi.fn(),
}));

const startingMatch: MatchState = {
  id: "match-1",
  homePlayer: "Aino",
  awayPlayer: "Kai",
  initialServer: "home",
  servingSide: "home",
  games: [{ home: 0, away: 0 }],
  pointHistory: [],
  status: "in_progress",
  winner: null,
};

describe("match scoring workflow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts a match using the player names entered by the user", async () => {
    // Arrange
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    render(<App />);

    // Act
    fireEvent.change(screen.getByLabelText("Home player"), {
      target: { value: "Aino" },
    });
    fireEvent.change(screen.getByLabelText("Away player"), {
      target: { value: "Kai" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // Assert
    await screen.findByRole("heading", { name: "Live match" });
    expect(createMatch).toHaveBeenCalledWith("Aino", "Kai");
    expect(screen.getByRole("heading", { name: "Aino" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Kai" })).toBeTruthy();
    expect(screen.getAllByText("Games won: 0")).toHaveLength(2);
  });

  it("updates the visible score after a player receives a point", async () => {
    // Arrange
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    vi.mocked(recordPoint).mockResolvedValue({
      ...startingMatch,
      games: [{ home: 1, away: 0 }],
    });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("heading", { name: "Live match" });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Add point for Aino" }));

    // Assert
    await waitFor(() =>
      expect(recordPoint).toHaveBeenCalledWith("match-1", "home"),
    );
    expect(screen.getByText("1", { selector: "strong" })).toBeTruthy();
  });

  it("prevents duplicate point submissions while a request is pending", async () => {
    // Arrange
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    vi.mocked(recordPoint).mockImplementation(
      () => new Promise<MatchState>(() => undefined),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("heading", { name: "Live match" });
    const addPointButton = screen.getByRole("button", {
      name: "Add point for Aino",
    });

    // Act
    fireEvent.click(addPointButton);
    fireEvent.click(addPointButton);

    // Assert
    expect(recordPoint).toHaveBeenCalledTimes(1);
    expect((addPointButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows scores from completed games before the current game", async () => {
    // Arrange
    const matchWithPreviousGame: MatchState = {
      ...startingMatch,
      games: [
        { home: 21, away: 18 },
        { home: 4, away: 3 },
      ],
    };
    vi.mocked(createMatch).mockResolvedValue(matchWithPreviousGame);
    render(<App />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // Assert
    await screen.findByRole("heading", { name: "Previous games" });
    expect(screen.getByText("Game 1: 21–18")).toBeTruthy();
  });

  it("undoes the latest point from the visible scoring controls", async () => {
    // Arrange
    const matchAfterPoint: MatchState = {
      ...startingMatch,
      games: [{ home: 1, away: 0 }],
      pointHistory: ["home"],
    };
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    vi.mocked(recordPoint).mockResolvedValue(matchAfterPoint);
    vi.mocked(undoPoint).mockResolvedValue(startingMatch);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("heading", { name: "Live match" });
    fireEvent.click(screen.getByRole("button", { name: "Add point for Aino" }));
    await screen.findByText("1", { selector: "strong" });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Undo last point" }));

    // Assert
    await waitFor(() => expect(undoPoint).toHaveBeenCalledWith("match-1"));
    expect(screen.getAllByText("0", { selector: "strong" })).toHaveLength(2);
  });
});
