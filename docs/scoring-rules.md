# Scoring Rules

## Supported format

This application currently implements the standard **BWF best-of-three (3×21)** badminton scoring system.

- The first side to win **two games** wins the match.
- Other match formats are not currently supported.

## Match start

- Before the match, a toss determines which side serves first.
- The scorer records the resulting initial serving side.

## Rally scoring

- Every rally awards **one point**.
- The side that wins a rally scores a point and serves the next rally.

## Winning a game

- A game is won by reaching **21 points** with at least a **two-point lead**.
- At **20–20**, play continues until one side leads by two points.
- At **29–29**, the side reaching **30 points** wins the game.

## Game transitions

- Recording the game-winning rally immediately completes the current game.
- If the match is not complete, the next game starts immediately at **0–0**.
- The side that won the previous game serves first in the next game.

## Winning the match

- The first side to win **two games** wins the match.
- Once the match is complete, additional scoring is rejected.

## Undo

- Undo removes only the most recently recorded point-awarding rally.
- Undo restores the score, serving side, and game state immediately preceding that rally.
- Undo is rejected if no recorded rallies exist.

## Scorer behavior

- The scorer records only the side officially awarded each rally.
- Lets, faults, and line decisions are determined outside the application.
- Only point-awarding rallies are stored in rally history.