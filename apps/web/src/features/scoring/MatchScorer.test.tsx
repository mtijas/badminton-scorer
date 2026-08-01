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
    expect(createMatch).toHaveBeenCalledWith("Aino", "Kai", "home");
    expect(screen.getByRole("heading", { name: "Aino" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Kai" })).toBeTruthy();
    expect(screen.getByLabelText("Aino is serving")).toBeTruthy();
    expect(screen.queryByLabelText("Kai is serving")).toBeNull();
    expect(screen.getAllByText("Games won: 0")).toHaveLength(2);
  });

  it("records the selected away player as the first server", async () => {
    // Arrange
    vi.mocked(createMatch).mockResolvedValue({
      ...startingMatch,
      initialServer: "away",
      servingSide: "away",
    });
    render(<App />);

    // Act
    fireEvent.click(screen.getByRole("radio", { name: "Away serves" }));
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // Assert
    await screen.findByRole("heading", { name: "Live match" });
    expect(createMatch).toHaveBeenCalledWith(
      "Player one",
      "Player two",
      "away",
    );
    expect(screen.getByLabelText("Kai is serving")).toBeTruthy();
  });

  it("rejects empty or whitespace-only player names before creating a match", () => {
    // Arrange
    render(<App />);
    fireEvent.change(screen.getByLabelText("Home player"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("Away player"), {
      target: { value: "Kai" },
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));

    // Assert
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a name for both players.",
    );
    expect(createMatch).not.toHaveBeenCalled();
  });

  it("updates the visible score after a player receives a point", async () => {
    // Arrange
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    vi.mocked(recordPoint).mockResolvedValue({
      ...startingMatch,
      games: [{ home: 1, away: 0 }],
      servingSide: "away",
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
    expect(screen.getByLabelText("Kai is serving")).toBeTruthy();
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

  it("shows a clear network failure after a point request fails", async () => {
    // Arrange
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    vi.mocked(recordPoint).mockRejectedValue(
      new Error(
        "Cannot reach the scoring API. Check your connection and try again.",
      ),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("heading", { name: "Live match" });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Add point for Aino" }));

    // Assert
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Cannot reach the scoring API. Check your connection and try again.",
    );
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

  it("immediately shows games won and the next game after a game-winning rally", async () => {
    // Arrange
    const gamePoint: MatchState = {
      ...startingMatch,
      games: [{ home: 20, away: 15 }],
      pointHistory: Array<"home" | "away">(35).fill("home"),
    };
    const nextGame: MatchState = {
      ...gamePoint,
      games: [
        { home: 21, away: 15 },
        { home: 0, away: 0 },
      ],
      pointHistory: [...gamePoint.pointHistory, "home"],
    };
    vi.mocked(createMatch).mockResolvedValue(gamePoint);
    vi.mocked(recordPoint).mockResolvedValue(nextGame);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("heading", { name: "Live match" });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Add point for Aino" }));

    // Assert
    await screen.findByText("Game 2 · Best of 3");
    expect(screen.getAllByText("Games won: 1")).toHaveLength(1);
    expect(screen.getAllByText("0", { selector: "strong" })).toHaveLength(2);
    expect(screen.getByText("Game 1: 21–15")).toBeTruthy();
    expect(screen.getByLabelText("Aino is serving")).toBeTruthy();
  });

  it("returns to match setup when starting a new match after completion", async () => {
    // Arrange
    const completedMatch: MatchState = {
      ...startingMatch,
      games: [
        { home: 21, away: 18 },
        { home: 21, away: 16 },
      ],
      pointHistory: ["home"],
      status: "complete",
      winner: "home",
    };
    vi.mocked(createMatch).mockResolvedValue(completedMatch);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("button", { name: "New match" });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New match" }));

    // Assert
    expect(
      screen.getByRole("heading", { name: "Badminton Scorer" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start match" })).toBeTruthy();
  });

  it("undoes the latest point from the visible scoring controls", async () => {
    // Arrange
    const matchAfterPoint: MatchState = {
      ...startingMatch,
      games: [{ home: 0, away: 1 }],
      pointHistory: ["away"],
      servingSide: "away",
    };
    vi.mocked(createMatch).mockResolvedValue(startingMatch);
    vi.mocked(recordPoint).mockResolvedValue(matchAfterPoint);
    vi.mocked(undoPoint).mockResolvedValue(startingMatch);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start match" }));
    await screen.findByRole("heading", { name: "Live match" });
    fireEvent.click(screen.getByRole("button", { name: "Add point for Kai" }));
    await screen.findByText("1", { selector: "strong" });
    await screen.findByLabelText("Kai is serving");

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Undo last point" }));

    // Assert
    await waitFor(() => expect(undoPoint).toHaveBeenCalledWith("match-1"));
    expect(screen.getAllByText("0", { selector: "strong" })).toHaveLength(2);
    expect(screen.getByLabelText("Aino is serving")).toBeTruthy();
  });
});
