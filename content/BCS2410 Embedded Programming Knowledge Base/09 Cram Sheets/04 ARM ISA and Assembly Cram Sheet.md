---
tags:
  - university
  - bcs2410
  - embedded-programming
  - cram-sheet
---

# 04 ARM ISA and Assembly Cram Sheet

ARM Cortex-M33 registers, instruction formats, flags, branches, stack, procedures, and assembly integration with C.

## Quick Links

- [[ARM Cortex-M33 Register File and Special Registers|ARM Cortex-M33 Register File and Special Registers]]
- [[Arithmetic, Logical, and Shift Instructions|Arithmetic, Logical, and Shift Instructions]]
- [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]]
- [[Data Movement with MOV, LDR, and STR|Data Movement with MOV, LDR, and STR]]
- [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
- [[Loops, Selection, and Structured Assembly|Loops, Selection, and Structured Assembly]]
- [[ARM-Thumb Instruction Format and Immediates|ARM/Thumb Instruction Format and Immediates]]
- [[Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX|Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX]]
- [[Integrating Assembly with C in STM32 Projects|Integrating Assembly with C in STM32 Projects]]
- [[Memory-Mapped I-O and GPIO in Assembly|Memory-Mapped I/O and GPIO in Assembly]]

## Core Distinctions

| Concept | Remember |
| --- | --- |
| MOV vs LDR/STR | MOV moves values between registers/immediates; LDR/STR move between registers and memory. |
| ADD vs ADDS | Plain ADD leaves flags unchanged; ADDS updates APSR condition flags. |
| CMP | CMP behaves like subtraction for flags, but does not keep the subtraction result. |
| B / BL / BX | B branches, BL branches and stores a return address in LR, BX branches to an address held in a register. |
| Caller-saved vs callee-saved | Caller saves volatile registers if needed; callee restores preserved registers if it modifies them. |

## Fast Recall

- Know the roles of `r0-r12`, `SP`, `LR`, and `PC`.
- Know that `r0-r3` are especially important for argument passing and return values under the usual calling convention.
- Know the general instruction shape: optional label, mnemonic, operands, comment.
- Know that labels are resolved by the assembler into addresses or branch offsets.
- Know that arithmetic usually happens in registers, so values often move memory -> register -> register ALU -> memory.
- Know that `LDR` reads from memory and `STR` writes to memory.
- Know the basic effect of add, subtract, and common bitwise instructions.
- Know how shifts can implement multiplication or division by powers of two when appropriate.
- Know that `CMP` updates flags and is often followed by a conditional branch.
- Know the basic meanings of common branch conditions such as `BEQ`, `BNE`, `BGT`, `BLT`, `BHI`, and `BLO`.
- Know that `CMN` is useful when the comparison is naturally expressed as addition rather than subtraction.
- Know that `TST` and `TEQ` are flag-setting bitwise checks that do not preserve the bitwise result in a destination register.

## Oral Answer Drills

### Comparison, Condition Codes, and Branching

- ARM branching depends on flags in the APSR, especially N, Z, C, and V, which are often produced by `CMP`, `CMN`, or flag-setting arithmetic instructions.
- The key exam distinction is signed versus unsigned comparison: `BGT` and `BLT` are signed-style conditions, while `BHI` and `BLO` are unsigned-style conditions.
- Always decide the numeric interpretation first, then choose the condition code; otherwise branch questions become guesswork.

### Functions, BL/BX, LR, Stack, and Calling Convention

- A function call in ARM usually uses `BL`, which branches to the callee and stores the return address in the link register `LR`.
- Returning commonly uses `BX LR`, while the stack preserves arguments or registers that must survive a call.
- For the exam, know the idea of caller-saved and callee-saved registers and the role of `SP`, `LR`, and the first argument registers `r0-r3`.

### Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX

- These instructions extend the basic compare-and-branch toolbox: `CMN` sets flags from addition, `TST` and `TEQ` set flags from bitwise operations, and `BLX` performs an indirect call with link.
- They matter because not every flag-setting decision comes from `CMP`, and not every call target is a direct label.
- For the exam, you should recognize their role even if the simpler `CMP` and `BL` patterns are more common.
