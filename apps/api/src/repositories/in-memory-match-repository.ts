import {
  matchWinner,
  recordRally,
  undoRally,
  type MatchState,
  type Side,
} from "@badminton-scorer/shared";
import type { MatchRepository } from "./match-repository.js";

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, MatchState>();
  private readonly commands = new Map<string, Map<string, StoredCommand>>();

  async findById(id: string): Promise<MatchState | undefined> {
    return this.matches.get(id);
  }

  async create(match: MatchState): Promise<void> {
    this.matches.set(match.id, match);
    this.commands.set(match.id, new Map());
  }

  async recordPoint(
    id: string,
    side: Side,
    commandId: string,
  ): Promise<MatchState | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    const previousCommand = this.findCommand(id, commandId, "point", side);
    if (previousCommand) return previousCommand.result;
    if (match.status === "complete") {
      throw new Error("Match is already complete.");
    }

    const scoringState = recordRally(match, side);
    const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
    const updated: MatchState = {
      ...match,
      ...scoringState,
      winner,
      status: winner ? "complete" : "in_progress",
    };
    this.matches.set(id, updated);
    this.storeCommand(id, commandId, "point", side, updated);
    return updated;
  }

  async undoLatestRally(
    id: string,
    commandId: string,
  ): Promise<MatchState | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    const previousCommand = this.findCommand(id, commandId, "undo", null);
    if (previousCommand) return previousCommand.result;

    const scoringState = undoRally(match);
    const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
    const updated: MatchState = {
      ...match,
      ...scoringState,
      winner,
      status: winner ? "complete" : "in_progress",
    };
    this.matches.set(id, updated);
    this.storeCommand(id, commandId, "undo", null, updated);
    return updated;
  }

  private findCommand(
    matchId: string,
    commandId: string,
    type: ScoreCommandType,
    awardedSide: Side | null,
  ): StoredCommand | undefined {
    const command = this.commands.get(matchId)?.get(commandId);
    if (!command) return undefined;
    if (command.type !== type || command.awardedSide !== awardedSide) {
      throw new Error(
        "Idempotency key is already used for a different command.",
      );
    }
    return command;
  }

  private storeCommand(
    matchId: string,
    commandId: string,
    type: ScoreCommandType,
    awardedSide: Side | null,
    result: MatchState,
  ): void {
    this.commands.get(matchId)?.set(commandId, {
      type,
      awardedSide,
      result,
    });
  }
}

type ScoreCommandType = "point" | "undo";

interface StoredCommand {
  readonly type: ScoreCommandType;
  readonly awardedSide: Side | null;
  readonly result: MatchState;
}
