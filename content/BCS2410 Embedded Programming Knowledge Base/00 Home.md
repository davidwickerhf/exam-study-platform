---
tags:
  - university
  - bcs2410
  - embedded-programming
  - index
---

# BCS2410 Embedded Programming Knowledge Base

A separate, concept-first exam-prep vault for Embedded Programming. This folder is intentionally distinct from the existing computer-networks knowledge base.

## What This Folder Is

- An atomic knowledge base built from the provided slides, tutorials, solution files, quiz scope, and named reading material.
- Structured around exam needs: definitions, architecture reasoning, low-level code understanding, and practical workflow.
- Meant to be a standalone study source for this course.

## Reference Sources

- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/90 Reference Sources/00 Index|Reference Sources Index]]
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/90 Reference Sources/01 Source Inventory|Source Inventory]]
- [[02 Embedded Course Corpus|Embedded Course Corpus]]
- [[03 Quiz Scope and Extra Materials|Quiz Scope and Extra Materials]]

## Recommended Study Order

1. Master Foundations, Computer Architecture, Data Representation, and the core ARM ISA notes first.
2. Use the workflow/tooling notes to connect theory back to the practical board and IDE context.
3. Finish with FPGA/Vitis AI and then use the cram sheets and self tests for compression and recall.

## Exam Master Checklist

- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/01 Foundations and Course/00 Index|Course framing and embedded-systems fundamentals]]**
    - [ ] Explain what an embedded system is and how it differs from a general-purpose computer. [[Embedded Systems and Microcontrollers|Embedded Systems and Microcontrollers]]
    - [ ] Explain the role of the B-U585I-IOT02A discovery board in the course context. [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]]
    - [ ] Identify board peripherals and explain what counts as a peripheral. [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]]
    - [ ] Distinguish RAM, ROM/Flash, cache, and persistent storage at the level used in the course. [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]], [[Memory Hierarchy, Cache, and the Power Wall|Memory Hierarchy, Cache, and the Power Wall]]
    - [ ] Explain why embedded systems care about power, memory, timing, and hardware constraints. [[Power Management and Resource Constraints|Power Management and Resource Constraints]]
- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/02 Computer Architecture/00 Index|Computer architecture]]**
    - [ ] Explain CPU, memory, I/O, and the role of the ALU and control unit. [[Computer Organization: CPU, Memory, and I-O|Computer Organization: CPU, Memory, and I/O]], [[CPU Registers, ALU, and Control|CPU Registers, ALU, and Control]]
    - [ ] Explain the fetch-decode-execute cycle. [[Program Counter and the Instruction Cycle|Program Counter and the Instruction Cycle]]
    - [ ] Explain the role of the program counter. [[Program Counter and the Instruction Cycle|Program Counter and the Instruction Cycle]]
    - [ ] Compare Von Neumann and Harvard architectures. [[Von Neumann vs Harvard Architecture|Von Neumann vs Harvard Architecture]]
    - [ ] Explain why cache matters. [[Memory Hierarchy, Cache, and the Power Wall|Memory Hierarchy, Cache, and the Power Wall]]
    - [ ] Explain the power wall at exam depth. [[Memory Hierarchy, Cache, and the Power Wall|Memory Hierarchy, Cache, and the Power Wall]]
    - [ ] Explain what registers are and why they matter. [[CPU Registers, ALU, and Control|CPU Registers, ALU, and Control]]
    - [ ] Explain half adders, full adders, and the idea behind subtraction in digital logic. [[ALU Construction: Half Adders, Full Adders, and Subtraction|ALU Construction: Half Adders, Full Adders, and Subtraction]]
- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/03 Data Representation and C Memory/00 Index|Data representation and C memory]]**
    - [ ] Convert among decimal, binary, and hexadecimal quickly. [[Number Systems: Binary, Decimal, and Hex|Number Systems: Binary, Decimal, and Hex]]
    - [ ] Explain signed versus unsigned interpretation. [[Fixed-Width Data, Signedness, and Overflow|Fixed-Width Data, Signedness, and Overflow]]
    - [ ] Explain fixed-width integer types and typical `int` size on a 32-bit system. [[C Data Types, Pointers, and Addresses|C Data Types, Pointers, and Addresses]]
    - [ ] Explain overflow and why it matters. [[Fixed-Width Data, Signedness, and Overflow|Fixed-Width Data, Signedness, and Overflow]]
    - [ ] Explain little-endian memory layout and decode stored byte order. [[Endianness and Memory Layout|Endianness and Memory Layout]]
    - [ ] Explain pointers, addresses, dereferencing, arrays, and pointer arithmetic. [[C Data Types, Pointers, and Addresses|C Data Types, Pointers, and Addresses]], [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]
    - [ ] Explain pass-by-value versus passing an address/reference-like pointer in C terms. [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]
    - [ ] Evaluate simple pointer expressions like `*(ptr + 2)` correctly. [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]
    - [ ] Compute and explain bitwise operations such as AND, OR, XOR, NOT, shifts, and masks. [[Bitwise Operations, Masks, and Shifts|Bitwise Operations, Masks, and Shifts]]
    - [ ] Explain what APSR flags represent and how arithmetic/logical operations update them. [[APSR Flags and Arithmetic Meaning|APSR Flags and Arithmetic Meaning]]
- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/04 ARM ISA and Assembly/00 Index|ARM ISA and assembly]]**
    - [ ] Know the ARM Cortex-M33 register file at the level used in the course. [[ARM Cortex-M33 Register File and Special Registers|ARM Cortex-M33 Register File and Special Registers]]
    - [ ] Explain the purpose of general-purpose registers, `PC`, `LR`, `SP`, and APSR. [[ARM Cortex-M33 Register File and Special Registers|ARM Cortex-M33 Register File and Special Registers]]
    - [ ] Read and write simple ARM assembly using `MOV`, `LDR`, `STR`, arithmetic, logic, and shift instructions. [[Data Movement with MOV, LDR, and STR|Data Movement with MOV, LDR, and STR]], [[Arithmetic, Logical, and Shift Instructions|Arithmetic, Logical, and Shift Instructions]]
    - [ ] Explain comparison and condition-code behavior. [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]]
    - [ ] Read and write conditional branches and structured control flow. [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]], [[Loops, Selection, and Structured Assembly|Loops, Selection, and Structured Assembly]]
    - [ ] Explain signed vs unsigned branch choices, conditional execution with `IT` / `ITE`, and why branches can introduce stalls. [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]], [[Loops, Selection, and Structured Assembly|Loops, Selection, and Structured Assembly]]
    - [ ] Read and write loops in assembly. [[Loops, Selection, and Structured Assembly|Loops, Selection, and Structured Assembly]]
    - [ ] Explain `BL`, `BX`, function calls, returns, stack use, and calling-convention basics. [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
    - [ ] Explain how local variables, parameters, and return addresses interact with the stack. [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
    - [ ] Read disassembly and map it back to C-level intent. [[Debugging with Breakpoints, Registers, Memory, and Disassembly|Debugging with Breakpoints, Registers, Memory, and Disassembly]]
    - [ ] Understand the advanced flag-setting instructions in scope such as `CMN`, `TST`, `TEQ`, and the role of `BLX`. [[Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX|Advanced Flag-Setting Instructions: CMN, TST, TEQ, and BLX]]
- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/05 Embedded Workflow and Tooling/00 Index|C and assembly integration / workflow]]**
    - [ ] Explain how to add an assembly file and header to an STM32CubeIDE/CubeMX project. [[Integrating Assembly with C in STM32 Projects|Integrating Assembly with C in STM32 Projects]]
    - [ ] Declare external assembly functions correctly in C headers. [[Integrating Assembly with C in STM32 Projects|Integrating Assembly with C in STM32 Projects]]
    - [ ] Call assembly functions from `main` correctly. [[Integrating Assembly with C in STM32 Projects|Integrating Assembly with C in STM32 Projects]]
    - [ ] Explain the build-flash-debug cycle on the board. [[Build-Flash-Debug Workflow on the Discovery Board|Build-Flash-Debug Workflow on the Discovery Board]]
    - [ ] Use breakpoints, register views, memory views, and disassembly conceptually. [[Debugging with Breakpoints, Registers, Memory, and Disassembly|Debugging with Breakpoints, Registers, Memory, and Disassembly]]
    - [ ] Explain how to use datasheets, reference manuals, and programming manuals to locate needed facts. [[Datasheets, Programming Manuals, and How to Use Them|Datasheets, Programming Manuals, and How to Use Them]]
    - [ ] Explain interrupts, exceptions, timers, and clocks at the scope level represented in the course materials. [[Interrupts, Exceptions, Timers, and Clocks|Interrupts, Exceptions, Timers, and Clocks]], [[Clock Trees, Peripheral Clocks, and Timing Configuration|Clock Trees, Peripheral Clocks, and Timing Configuration]]
    - [ ] Explain polling, superloops, and event-driven reasoning where it appears in scope. [[Polling, Superloops, and Event-Driven Design|Polling, Superloops, and Event-Driven Design]]
- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/06 FPGA and Edge AI/00 Index|FPGA and edge AI]]**
    - [ ] Explain what an FPGA is and how it differs from CPU and ASIC approaches. [[FPGA Fundamentals and Reconfigurable Logic|FPGA Fundamentals and Reconfigurable Logic]], [[FPGA vs CPU vs ASIC and Hardware Acceleration|FPGA vs CPU vs ASIC and Hardware Acceleration]]
    - [ ] Explain LUTs, CLBs, flip-flops, BRAM, DSP blocks, switch boxes, and bitstreams at exam depth. [[LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks|LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks]], [[PLA Evolution, Switch Boxes, and FPGA Bitstreams|PLA Evolution, Switch Boxes, and FPGA Bitstreams]]
    - [ ] Explain reconfigurable logic and why FPGA acceleration can help embedded AI workloads. [[FPGA Fundamentals and Reconfigurable Logic|FPGA Fundamentals and Reconfigurable Logic]], [[Edge AI Constraints on Embedded Devices|Edge AI Constraints on Embedded Devices]]
    - [ ] Explain quantization and why lower-precision representations matter. [[Quantization and Deployment Tradeoffs|Quantization and Deployment Tradeoffs]]
    - [ ] Explain DPU, Vitis AI workflow, and deployment tradeoffs at the course level. [[DPU Architecture and Vitis AI Workflow|DPU Architecture and Vitis AI Workflow]], [[Zynq Platforms, Bitstreams, and VART Runtime|Zynq Platforms, Bitstreams, and VART Runtime]]
    - [ ] Explain practical setup topics involving WSL, Docker, Jupyter, and the Vitis AI environment only at the level used by the course. [[Vitis AI Setup with WSL, Docker, and Jupyter|Vitis AI Setup with WSL, Docker, and Jupyter]]
    - [ ] Explain Zynq/PYNQ/platform-runtime context if it appears in notes or questions. [[Zynq Platforms, Bitstreams, and VART Runtime|Zynq Platforms, Bitstreams, and VART Runtime]]
- [ ] **[[University/June Exams/BCS2410 Embedded Programming Knowledge Base/07 Exam Skills/00 Index|Problems and operations to be fluent in]]**
    - [ ] Convert numbers between bases quickly and accurately. [[Number Systems: Binary, Decimal, and Hex|Number Systems: Binary, Decimal, and Hex]]
    - [ ] Decode endianness and memory layout examples. [[Endianness and Memory Layout|Endianness and Memory Layout]]
    - [ ] Trace pointer and array expressions. [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]], [[04 Pointer and Memory Worked Drills|Pointer and Memory Worked Drills]]
    - [ ] Reason from APSR flags after arithmetic or compare operations. [[APSR Flags and Arithmetic Meaning|APSR Flags and Arithmetic Meaning]]
    - [ ] Read small C snippets and explain the generated/expected assembly behavior. [[Debugging with Breakpoints, Registers, Memory, and Disassembly|Debugging with Breakpoints, Registers, Memory, and Disassembly]]
    - [ ] Read small assembly snippets and explain the C-level meaning. [[03 ARM Assembly Coding Patterns|ARM Assembly Coding Patterns]]
    - [ ] Write short assembly routines for arithmetic, loops, selection, and function calls. [[03 ARM Assembly Coding Patterns|ARM Assembly Coding Patterns]]
    - [ ] Explain why a given assembly/C implementation is correct or incorrect. [[Embedded Exam Problem Patterns|Embedded Exam Problem Patterns]]
    - [ ] Compare architectural alternatives or hardware platforms in concise exam prose. [[Fast Facts and Core Tables|Fast Facts and Core Tables]]

## Highest-Yield Notes

- [[Course Structure, Assessment, and Resources|Course Structure, Assessment, and Resources]]
- [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]]
- [[Embedded Systems and Microcontrollers|Embedded Systems and Microcontrollers]]
- [[Languages, Abstraction, and Why Computers Speak Binary|Languages, Abstraction, and Why Computers Speak Binary]]
- [[CPU Registers, ALU, and Control|CPU Registers, ALU, and Control]]
- [[Computer Organization: CPU, Memory, and I-O|Computer Organization: CPU, Memory, and I/O]]
- [[Memory Hierarchy, Cache, and the Power Wall|Memory Hierarchy, Cache, and the Power Wall]]
- [[Program Counter and the Instruction Cycle|Program Counter and the Instruction Cycle]]
- [[Von Neumann vs Harvard Architecture|Von Neumann vs Harvard Architecture]]
- [[APSR Flags and Arithmetic Meaning|APSR Flags and Arithmetic Meaning]]
- [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]
- [[Bitwise Operations, Masks, and Shifts|Bitwise Operations, Masks, and Shifts]]
- [[C Data Types, Pointers, and Addresses|C Data Types, Pointers, and Addresses]]
- [[Endianness and Memory Layout|Endianness and Memory Layout]]
- [[Fixed-Width Data, Signedness, and Overflow|Fixed-Width Data, Signedness, and Overflow]]
- [[Number Systems: Binary, Decimal, and Hex|Number Systems: Binary, Decimal, and Hex]]
- [[ARM Cortex-M33 Register File and Special Registers|ARM Cortex-M33 Register File and Special Registers]]
- [[Arithmetic, Logical, and Shift Instructions|Arithmetic, Logical, and Shift Instructions]]
- [[Comparison, Condition Codes, and Branching|Comparison, Condition Codes, and Branching]]
- [[Data Movement with MOV, LDR, and STR|Data Movement with MOV, LDR, and STR]]
- [[Functions, BL-BX, LR, Stack, and Calling Convention|Functions, BL/BX, LR, Stack, and Calling Convention]]
- [[Loops, Selection, and Structured Assembly|Loops, Selection, and Structured Assembly]]
- [[Debugging with Breakpoints, Registers, Memory, and Disassembly|Debugging with Breakpoints, Registers, Memory, and Disassembly]]
- [[STM32CubeIDE Setup, Project Structure, and Build Toolchain|STM32CubeIDE Setup, Project Structure, and Build Toolchain]]
- [[DPU Architecture and Vitis AI Workflow|DPU Architecture and Vitis AI Workflow]]
- [[Edge AI Constraints on Embedded Devices|Edge AI Constraints on Embedded Devices]]
- [[FPGA Fundamentals and Reconfigurable Logic|FPGA Fundamentals and Reconfigurable Logic]]
- [[LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks|LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks]]
- [[Quantization and Deployment Tradeoffs|Quantization and Deployment Tradeoffs]]
- [[Embedded Exam Problem Patterns|Embedded Exam Problem Patterns]]
- [[Fast Facts and Core Tables|Fast Facts and Core Tables]]

## Section Indexes

- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/01 Foundations and Course/00 Index|Foundations and Course Index]] - Course structure, embedded-system motivation, board context, and the core ideas that frame the rest of the course.
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/02 Computer Architecture/00 Index|Computer Architecture Index]] - How CPUs, memory, caches, buses, and instruction execution work in embedded and general computing systems.
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/03 Data Representation and C Memory/00 Index|Data Representation and C Memory Index]] - Binary/hex reasoning, signedness, overflow, bitwise operations, memory layout, pointers, arrays, and C-level memory thinking.
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/04 ARM ISA and Assembly/00 Index|ARM ISA and Assembly Index]] - ARM Cortex-M33 registers, instruction formats, flags, branches, stack, procedures, and assembly integration with C.
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/05 Embedded Workflow and Tooling/00 Index|Embedded Workflow and Tooling Index]] - STM32CubeIDE workflow, debugging, flashing, board setup, datasheets, and the practical toolchain.
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/06 FPGA and Edge AI/00 Index|FPGA and Edge AI Index]] - FPGA building blocks, reconfigurable logic, DPU hardware acceleration, Vitis AI, quantization, and deployment tradeoffs.
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/07 Exam Skills/00 Index|Exam Skills Index]] - High-yield solution workflows, recall tables, and traps that show up in quizzes and likely exam questions.

## Cram Sheets

- [[01 Foundations and Course Cram Sheet|Foundations and Course Cram Sheet]]
- [[02 Computer Architecture Cram Sheet|Computer Architecture Cram Sheet]]
- [[03 Data Representation and C Memory Cram Sheet|Data Representation and C Memory Cram Sheet]]
- [[04 ARM ISA and Assembly Cram Sheet|ARM ISA and Assembly Cram Sheet]]
- [[05 Embedded Workflow and Tooling Cram Sheet|Embedded Workflow and Tooling Cram Sheet]]
- [[06 FPGA and Edge AI Cram Sheet|FPGA and Edge AI Cram Sheet]]
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/09 Cram Sheets/07 Exam Skills Cram Sheet|Exam Skills Cram Sheet]]

## Self Tests

- [[01 Foundations and Course Self Test|Foundations and Course Self Test]]
- [[02 Computer Architecture Self Test|Computer Architecture Self Test]]
- [[03 Data Representation and C Memory Self Test|Data Representation and C Memory Self Test]]
- [[04 ARM ISA and Assembly Self Test|ARM ISA and Assembly Self Test]]
- [[05 Embedded Workflow and Tooling Self Test|Embedded Workflow and Tooling Self Test]]
- [[06 FPGA and Edge AI Self Test|FPGA and Edge AI Self Test]]
- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/10 Self Tests/07 Exam Skills Self Test|Exam Skills Self Test]]

## Worked Drills

- [[University/June Exams/BCS2410 Embedded Programming Knowledge Base/11 Worked Drills/00 Index|Worked Drills Index]]
- [[01 Quiz 1 Worked Answers|Quiz 1 Worked Answers]]
- [[02 Quiz 2 Worked Answers|Quiz 2 Worked Answers]]
- [[03 ARM Assembly Coding Patterns|ARM Assembly Coding Patterns]]
- [[04 Pointer and Memory Worked Drills|Pointer and Memory Worked Drills]]
- [[05 FPGA and Quantization Worked Drills|FPGA and Quantization Worked Drills]]
