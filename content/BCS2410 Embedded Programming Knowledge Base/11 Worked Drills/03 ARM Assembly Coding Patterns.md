---
tags:
  - university
  - bcs2410
  - embedded-programming
  - worked-drills
---

# ARM Assembly Coding Patterns

## Pattern 1: Arithmetic and shifts

Given `R1 = 0x30` and `R2 = 0x1A`, a valid solution for the Tutorial 3 style exercise is:

```asm
ADD  R3, R1, R2
LSL  R3, R3, #2
EOR  R4, R1, R2
LSR  R5, R2, #3
LSL  R6, R1, #3
```

This computes:

- `R3 = (R1 + R2) * 4`
- `R4 = R1 xor R2`
- `R5 = R2 >> 3`
- `R6 = R1 * 8`

## Pattern 2: Compare two signed integers and return 1 or 0

```asm
; r0 = a, r1 = b
CMP  r0, r1
BGT  greater
MOVS r0, #0
BX   LR
greater:
MOVS r0, #1
BX   LR
```

Use `BGT` because the exercise states **signed** integers.

## Pattern 3: Sum integers from 1 to n

```asm
; r0 = n
MOVS r1, #1      ; i
MOVS r2, #0      ; sum
loop:
    CMP  r1, r0
    BGT  done
    ADD  r2, r2, r1
    ADDS r1, r1, #1
    B    loop
done:
    MOV  r0, r2
    BX   LR
```

## Pattern 4: Maximum of three unsigned integers

```asm
; r0, r1, r2 contain inputs
CMP  r0, r1
BHS  keep_r0
MOV  r0, r1
keep_r0:
CMP  r0, r2
BHS  done
MOV  r0, r2
done:
BX   LR
```

Use `BHS`/unsigned-higher-or-same because the problem statement says **unsigned** integers.

## Pattern 5: Positive / zero / negative classification

```asm
; r0 = input
CMP  r0, #0
BEQ  zero_case
BGT  positive_case
MOVS r0, #-1
BX   LR
zero_case:
MOVS r0, #0
BX   LR
positive_case:
MOVS r0, #1
BX   LR
```

## Pattern 6: Calling two functions in sequence

```asm
; r0 holds the argument
BL   function1
BL   function2
BX   LR
```

If `function1` and `function2` both follow the calling convention properly, control returns to the caller after each `BL`.

A tutorial-style implementation skeleton is:

```asm
function1:
    ADDS r0, r0, #5
    BX   LR

function2:
    SUBS r0, r0, #2
    BX   LR

ASM_Function:
    BL   function1
    BL   function2
    BX   LR
```

## Pattern 7: Fibonacci

```asm
; r0 = n
CMP  r0, #1
BLE  done
MOVS r1, #0      ; fib(0)
MOVS r2, #1      ; fib(1)
SUBS r0, r0, #1
fib_loop:
    SUBS r0, r0, #1
    BEQ  done
    ADDS r3, r1, r2
    MOV  r1, r2
    MOV  r2, r3
    B    fib_loop
done:
    MOV  r0, r2
    BX   LR
```

The pattern is iterative state update: keep the previous two Fibonacci values in registers and advance until the target index is reached.

## Related Concepts

- [[Arithmetic, Logical, and Shift Instructions|Arithmetic, Logical, and Shift Instructions]]
- [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]]
- [[Loops, Selection, and Structured Assembly|Loops, Selection, and Structured Assembly]]
- [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
- [[Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX|Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX]]

## Sources

- [[03 Quiz Scope and Extra Materials|Quiz Scope and Extra Materials]]
- [[02 Embedded Course Corpus|Embedded Course Corpus]]
