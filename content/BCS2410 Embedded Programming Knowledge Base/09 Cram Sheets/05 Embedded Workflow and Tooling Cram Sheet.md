---
tags:
  - university
  - bcs2410
  - embedded-programming
  - cram-sheet
---

# 05 Embedded Workflow and Tooling Cram Sheet

STM32CubeIDE workflow, debugging, flashing, board setup, datasheets, and the practical toolchain.

## Quick Links

- [[Debugging with Breakpoints, Registers, Memory, and Disassembly|Debugging with Breakpoints, Registers, Memory, and Disassembly]]
- [[STM32CubeIDE Setup, Project Structure, and Build Toolchain|STM32CubeIDE Setup, Project Structure, and Build Toolchain]]
- [[Build-Flash-Debug Workflow on the Discovery Board|Build-Flash-Debug Workflow on the Discovery Board]]
- [[Clock Trees, Peripheral Clocks, and Timing Configuration|Clock Trees, Peripheral Clocks, and Timing Configuration]]
- [[Datasheets, Programming Manuals, and How to Use Them|Datasheets, Programming Manuals, and How to Use Them]]
- [[Interrupts, Exceptions, Timers, and Clocks|Interrupts, Exceptions, Timers, and Clocks]]
- [[Polling, Superloops, and Event-Driven Design|Polling, Superloops, and Event-Driven Design]]

## Core Distinctions

| Concept | Remember |
| --- | --- |
| Build vs flash vs debug | Build creates the binary, flash programs the MCU, debug runs with breakpoints/inspection. |
| Disassembly view | Shows the compiler-generated machine instructions and instruction addresses. |
| Datasheet vs programming manual | Datasheet gives device-level characteristics; programming manual explains architecture and programming model. |
| Memory-mapped peripheral access | Peripheral registers look like ordinary memory locations to the CPU. |

## Fast Recall

- Know the three core STM tools mentioned in the setup material: STM32CubeMX, STM32CubeIDE, and STM32CubeProgrammer.
- Know the basic STM32 project structure, especially where source and header files live.
- Know that interrupts and exceptions break the normal straight-line execution flow so that important events can be serviced promptly.
- Know that timers are hardware resources used to measure or trigger time-based behavior.
- Know that embedded timing depends on configured clock sources and dividers, not only on source code.
- Know that peripherals often require their clocks to be enabled before they can be used reliably.
- Know that a superloop is a common simple embedded program structure.
- Know that polling is easy to understand but can waste CPU time and add latency between checks.
- Know how breakpoints and step execution expose program state changes instruction by instruction.
- Know why the registers, memory, and disassembly views are useful together.
- Know the normal lifecycle: edit code -> build -> flash/load -> run or debug.
- Know that ST-LINK provides the host-to-board bridge for programming and debugging.

## Oral Answer Drills

### STM32CubeIDE Setup, Project Structure, and Build Toolchain

- STM32CubeIDE provides the build, flash, debug, and project-management environment for working with the B-U585I-IOT02A discovery board.
- The normal workflow is create or open a project, build it, flash it through ST-LINK, then debug with breakpoints, registers, memory, and disassembly views.
- You should know where source files and headers live in a project and how to add an assembly source file alongside C code.

### Clock Trees, Peripheral Clocks, and Timing Configuration

- An embedded board does not run on an abstract speed setting; it runs on configured clock sources and dividers that determine how fast the CPU and peripherals tick.
- Peripheral behavior depends on clock availability, which is why clock configuration and clock enable choices show up in setup tools and board manuals.
- For the exam, connect timing questions to the configured clock source rather than treating every peripheral as if it runs automatically at CPU speed.

### Interrupts, Exceptions, Timers, and Clocks

- Interrupts and exceptions let hardware or software events redirect normal execution so urgent conditions can be handled without busy-waiting in straight-line code.
- Timers and clocks provide the time base that drives embedded execution, scheduling, peripheral timing, and board configuration choices.
- For the exam, distinguish event handling, timing hardware, and clock configuration from ordinary CPU arithmetic or memory questions.

### Polling, Superloops, and Event-Driven Design

- A superloop repeatedly checks state in ordinary control flow, while event-driven design reacts when interrupts or external events occur.
- The tradeoff is simple: polling is conceptually easy but can waste CPU time, while interrupt-driven designs react more efficiently to asynchronous events.
- For the exam, compare these execution styles in terms of responsiveness, CPU usage, and control-flow structure.
