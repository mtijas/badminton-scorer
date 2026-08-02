# Scoring Rules

## Supported formats

This application supports the following BWF scoring systems:

- **BWF best-of-three (3×21)**
- **BWF best-of-three (3×15)**

Other match formats are not currently supported.

## Common rules

### Match

- A match is won by the first side to win **two games**.

### Match start

- Before the match, a toss determines which side serves first.
- The scorer records the resulting initial serving side.

### Rally scoring

- Every rally awards **one point**.
- The side that wins a rally scores a point and serves the next rally.

### Game transitions

- Recording the game-winning rally immediately completes the current game.
- If the match is not complete, the next game starts immediately at **0–0**.
- The side that won the previous game serves first in the next game.

### Match completion

- Once the match is complete, additional scoring is rejected.

## BWF best-of-three (3×21)

### Winning a game

- A game is won by reaching **21 points** with at least a **two-point lead**.
- At **20–20**, play continues until one side leads by two points.
- At **29–29**, the side reaching **30 points** wins the game.

### Change of ends

Players shall change ends:

- at the end of the first game;
- at the end of the second game, if there is to be a third game; and
- in the third game when a side first scores **11 points**.

## BWF best-of-three (3×15)

### Winning a game

- A game is won by reaching **15 points** with at least a **two-point lead**.
- At **14–14**, play continues until one side leads by two points.
- At **20–20**, the side reaching **21 points** wins the game.

### Change of ends

Players shall change ends:

- at the end of the first game;
- at the end of the second game, if there is to be a third game; and
- in the third game when a side first scores **8 points**.

## Scorer behavior

- The scorer records only the side officially awarded each rally.
- Lets, faults, and line decisions are determined outside the application.
- Only point-awarding rallies are stored in rally history.

## Undo

- Undo removes only the most recently recorded point-awarding rally.
- Undo restores the score, serving side, and game state immediately preceding that rally.
- Undo is rejected if no recorded rallies exist.
