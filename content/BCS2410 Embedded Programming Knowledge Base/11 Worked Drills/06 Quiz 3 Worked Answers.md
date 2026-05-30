---
tags:
  - university
  - bcs2410
  - embedded-programming
  - worked-drills
---

# Quiz 3 Worked Answers

These worked answers correspond to the additional ARM-style multiple-choice quiz bank now labeled as Quiz 3 in the self-test material.

## 1. RISC characteristic

**Correct answer:** It has a limited set of simple instructions that execute in a single clock cycle.

**Why:** That is the classic high-level distinction of Reduced Instruction Set Computing.

**[Beyond current course notes]** The existing BCS2410 vault does not currently foreground `RISC` terminology as a standalone note topic, so this item is an extension rather than a direct restatement of the current note set.

## 2. Add two registers and store in a third

**Correct answer:** `ADD R1, R2, R3`

**Why:** `ADD` is the arithmetic instruction used to add register values and place the result in a destination register, consistent with the arithmetic-instruction notes.

## 3. Bitwise AND result

**Correct answer:** `1000`

**Why:**

```text
  1010
& 1100
------
  1000
```

Bitwise AND produces `1` only where both corresponding bits are `1`.

## 4. Meaning of `CMP R1, R2`

**Correct answer:** Subtracts the value of `R2` from `R1` and sets the condition flags.

**Why:** `CMP` behaves like subtraction for flag purposes, but does not preserve the subtraction result in a normal destination register.

## 5. Purpose of `BL`

**Correct answer:** It stores the return address in the link register and jumps to a procedure.

**Why:** `BL` means Branch with Link. It changes control flow and updates the Link Register `LR` so the callee can return later.

## 6. Result of `LSL R1, R2, #2`

**Correct answer:** `00001100`

**Why:** Logical Shift Left by 2 moves all bits two places toward the more significant side.

```text
00000011 << 2 = 00001100
```

## 7. Result of `ORR R0, R1, R2`

**Correct answer:** `0111`

**Why:**

```text
  0101
OR 0011
------
  0111
```

`ORR` is the bitwise OR instruction, which produces `1` wherever at least one corresponding bit is `1`.

## 8. Meaning of `BNE label`

**Correct answer:** Branches to `label` if the Zero flag is not set.

**Why:** `BNE` means Branch if Not Equal, which corresponds to `Z = 0`.

## Related Concepts

- [[Arithmetic, Logical, and Shift Instructions|Arithmetic, Logical, and Shift Instructions]]
- [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]]
- [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
- [[Bitwise Operations, Masks, and Shifts|Bitwise Operations, Masks, and Shifts]]

## Sources

- Additional quiz questions provided by the user
- [[Arithmetic, Logical, and Shift Instructions|Arithmetic, Logical, and Shift Instructions]]
- [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]]
- [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
