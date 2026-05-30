---
tags:
  - university
  - bcs2410
  - embedded-programming
  - cram-sheet
---

# 02 Computer Architecture Cram Sheet

How CPUs, memory, caches, buses, and instruction execution work in embedded and general computing systems.

## Quick Links

- [[CPU Registers, ALU, and Control|CPU Registers, ALU, and Control]]
- [[Computer Organization: CPU, Memory, and I-O|Computer Organization: CPU, Memory, and I/O]]
- [[Memory Hierarchy, Cache, and the Power Wall|Memory Hierarchy, Cache, and the Power Wall]]
- [[Program Counter and the Instruction Cycle|Program Counter and the Instruction Cycle]]
- [[Von Neumann vs Harvard Architecture|Von Neumann vs Harvard Architecture]]
- [[ALU Construction: Half Adders, Full Adders, and Subtraction|ALU Construction: Half Adders, Full Adders, and Subtraction]]
- [[Transistors, Logic, and Digital Hardware|Transistors, Logic, and Digital Hardware]]

## Core Distinctions

| Concept | Remember |
| --- | --- |
| Von Neumann vs Harvard | Von Neumann shares instruction/data memory; Harvard separates them. |
| Datapath vs control | Datapath manipulates values; control issues signals that steer the datapath and memory. |
| Register vs memory | Registers are fastest and inside the CPU; memory is larger but slower. |
| Cache | A small fast memory holding frequently used instructions/data near the CPU. |
| Power wall | Performance scaling is limited by heat and energy constraints, not only transistor count. |

## Fast Recall

- Know that transistors are the essential switching elements underlying digital hardware.
- Know that digital logic and memory structures are built from huge numbers of transistors.
- Know the classic building blocks: input, output, memory, datapath, and control.
- Know that operating systems are software, not a primary hardware component of computer organization.
- Know that Von Neumann uses a shared memory model for instructions and data.
- Know that Harvard separates instruction and data paths, which can improve throughput.
- Know that the ALU performs arithmetic, logical operations, comparisons, shifts, and related value transformations.
- Know that registers are the fastest CPU-visible storage locations and are heavily used by assembly code.
- Know that the PC holds the address of the next instruction.
- Know that the decode stage translates the instruction into internal control signals and actions.
- Know why cache helps: it reduces average access time by keeping frequently used data/instructions close to the CPU.
- Know that cache does not permanently store large amounts of data the way disks or Flash do.

## Oral Answer Drills

### Computer Organization: CPU, Memory, and I/O

- Computer organization is the practical arrangement of CPU, memory, input, output, datapath, and control that makes program execution possible.
- The CPU operates on values in registers, memory holds instructions and data, and I/O/peripherals let the system interact with the outside world.
- If a question asks for major building blocks, answer at the hardware-organization level rather than naming operating systems or applications.

### ALU Construction: Half Adders, Full Adders, and Subtraction

- At the logic level, arithmetic is built from combinational circuits: half adders combine two bits, full adders also accept carry-in, and chained adders build multi-bit addition.
- Subtraction is closely related to addition, which is why carry and borrow behavior appear in the flag logic discussed later in ARM arithmetic.
- This note matters because the course source material goes below 'the ALU adds numbers' and shows how that operation is actually constructed.
