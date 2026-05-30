---
tags:
  - university
  - bcs2410
  - embedded-programming
  - self-test
---

# 04 ARM ISA and Assembly Self Test

Answer these without notes. This bank intentionally omits answers.

## ARM Cortex-M33 Register File and Special Registers

- [ ] What are the special roles of `SP`, `LR`, and `PC`?
- [ ] Which registers are typically used for the first few function arguments?
- [ ] What does the register file represent in an ARM Cortex-M core?

## Arithmetic, Logical, and Shift Instructions

- [ ] How could you compute `(R1 + R2) * 4` in assembly?
- [ ] What does XOR do?
- [ ] How can a left shift implement multiplication by 8?

## Comparison, Condition Codes, and Branching

- [ ] What is `CMP` used for?
- [ ] What is the difference between signed and unsigned branch conditions?
- [ ] Why might `BHI` and `BGT` behave differently on the same raw bit patterns?

## Data Movement with MOV, LDR, and STR

- [ ] What is the difference between `MOV`, `LDR`, and `STR`?
- [ ] What does load-modify-store mean?
- [ ] Why do peripheral accesses often involve `LDR` and `STR`?

## Functions, BL/BX, LR, Stack, and Calling Convention

- [ ] What does `BL` do?
- [ ] What is the purpose of the link register?
- [ ] Why is the stack used during procedure calls?
- [ ] How are extra arguments passed when there are more than four 32-bit arguments?

## Loops, Selection, and Structured Assembly

- [ ] What are the three control structures?
- [ ] Why can assembly easily become spaghetti code?
- [ ] How does a `while` loop map to compare and branch instructions?

## ARM/Thumb Instruction Format and Immediates

- [ ] What is a label in assembly?
- [ ] What is an immediate operand?
- [ ] Why do assemblers use labels instead of forcing humans to compute every branch offset manually?

## Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX

- [ ] What does `CMN` do and how does it differ from `CMP`?
- [ ] What are `TST` and `TEQ` used for?
- [ ] What is the role of `BLX`?
- [ ] Why might a programmer use `TST` instead of an `ANDS` instruction?
- [ ] How is `TEQ` different from `CMP`?

## Integrating Assembly with C in STM32 Projects

- [ ] How do you add an assembly file to the STM32 project template?
- [ ] Why is an `extern` declaration needed in the header?
- [ ] How does C call an assembly function?

## Memory-Mapped I/O and GPIO in Assembly

- [ ] What is memory-mapped I/O?
- [ ] How are peripheral registers accessed from ARM assembly?
- [ ] Why can `LDR` and `STR` be used with GPIO registers?

## Quiz 3

- [ ] What is a key characteristic of Reduced Instruction Set Computing (RISC) architecture?
- [ ] Which instruction adds two registers and stores the result in a third register?
- [ ] What is the result of `AND R1, R2, R3` if `R2 = 1010` and `R3 = 1100` in binary?
- [ ] What does `CMP R1, R2` do?
- [ ] What is the purpose of the `BL` instruction?
- [ ] What is the result of `LSL R1, R2, #2` if `R2 = 00000011` in binary?
- [ ] What is the result of `ORR R0, R1, R2` if `R1 = 0101` and `R2 = 0011` in binary?
- [ ] What does `BNE label` do?
