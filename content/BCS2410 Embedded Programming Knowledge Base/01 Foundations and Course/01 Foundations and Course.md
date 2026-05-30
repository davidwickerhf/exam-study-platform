---
tags:
  - university
  - bcs2410
  - embedded-programming
---

# Topic 1 — Foundations and Course

**Lecture slides:** `Materials/Lecture 1 - Introduction.pdf` (Introduction to course, History of computers, The power wall)
**Tutorial coverage:** `Materials/Tutorial 1 - Introduction to embedded programming.pdf` (STM32CubeIDE, memory, registers, first ARM assembly)
**Past exam coverage:** Mock Paper 1 Q1–Q4, Paper 2 Q1/Q3/Q10, Paper 3 Q1–Q5, Paper 4 Q1; Paper 4 Exercise 2

This chapter is the conceptual scaffold for the whole embedded-programming course. It covers course structure, the embedded-system motivation, the board context, the language layers from C down to binary, and why hardware works the way it does. Memorise what an embedded system is (specialised and hardware-coupled, not just "small"), the role of the microcontroller, the C → assembly → machine-code → electrical layering, the Flash/RAM distinction, the ISA as the hardware/software interface, and why power is a first-class design constraint. These blocks are theory-MCQ territory and cover the bulk of expected exposure.

> [!tip] Exam-recall — what actually appeared (March 2026)
> The theory section drew heavily on Chapters 01–04. Foundations questions are short closed-choice: definitions of *embedded system*, *microcontroller*, *what memory stores the program*, *what language the machine understands*. Keep every definition below crisp and one-sentence-ready.

---

## Course Structure, Assessment, and Resources

This section is the administrative and scope anchor for the whole course. It explains what the course teaches, how the final grade is decided, which hardware and software platforms are in scope, and which readings support the material. It lets you separate what is examinable from helpful background: the syllabus, lecture slides, tutorials, and named tooling are not side material, they define the exam boundary.

### Workload and assessment

> [!info] Definitions worth memorising
> - **$4$ ECTS** — a course workload of roughly $112$ study hours ($4 \times 28\text{ h}$).
> - **Final exam** — the *only* graded component (taken via Testvision) that determines the final course grade.
> - **Bonus test** — taken during the 4th week's tutorial, worth **up to $1$ additional grade point**.
> - **Live-coding lecture** — a lecture format where concepts are introduced through coding demonstrations.
> - **Tutorial** — a hands-on practical session, typically on the Discovery board.

The slides give the explicit grading formula:

$$\text{final grade (out of 10)} = \text{exam grade} + \text{bonus grade}$$

For the **resit**, the same formula applies with the resit exam in place of the normal exam:

$$\text{resit final grade} = \text{resit exam} + \text{bonus grade}$$

Quizzes and course assignments support learning but **do not count toward the final grade**. Of the $112$ hours, only $6 \times 6 + 4 = 40$ h are "contact" hours; the remaining $\approx 72$ h are self-study (the lecturer estimates $8$–$10$ h per week, max).

The exam splits into two parts:

| Part | Approx. weight | Style |
| --- | --- | --- |
| Theoretical / small coding | $\approx 40\%$ | Short conceptual explanations (*what is an embedded system*, *why does cache exist*), value conversions, register and pointer reasoning |
| Practical exercises | $\approx 60\%$ | Usually $2$–$3$ exercises: reading or writing assembly, explaining a deployment/tooling sequence |

> [!warning] Common pitfall
> Assuming quizzes are graded: the syllabus says they are not. Also: treating the course as only microcontroller programming and forgetting the FPGA / Vitis AI module is in scope, and forgetting the bonus test contributes up to $1$ grade point.

### What counts as "in scope"

The syllabus, lectures, tutorials, solution sheets, quizzes, and named textbook chapters together define the exam boundary.

<figure class="diag-figure">
  <figcaption>Scope map — the named course materials together define what the exam expects</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="Course scope map">
    <defs>
      <marker id="arr-scope" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="20"  y="20" width="150" height="40" class="d-node"/>
    <text x="95"  y="44" text-anchor="middle" class="d-h-sm">Syllabus</text>
    <rect x="20"  y="70" width="150" height="40" class="d-node"/>
    <text x="95"  y="94" text-anchor="middle" class="d-h-sm">Lectures</text>
    <rect x="20"  y="120" width="150" height="40" class="d-node"/>
    <text x="95"  y="144" text-anchor="middle" class="d-h-sm">Tutorials</text>
    <rect x="20"  y="170" width="150" height="40" class="d-node"/>
    <text x="95"  y="194" text-anchor="middle" class="d-h-sm">Quizzes &amp; solutions</text>
    <rect x="510" y="90" width="230" height="56" class="d-node-acc"/>
    <text x="625" y="113" text-anchor="middle" class="d-h-sm">Exam scope</text>
    <text x="625" y="133" text-anchor="middle" class="d-sub">conceptual + procedural</text>
    <path d="M 170 40  L 340 110 L 508 113" class="d-edge" marker-end="url(#arr-scope)"/>
    <path d="M 170 90  L 340 112 L 508 116" class="d-edge" marker-end="url(#arr-scope)"/>
    <path d="M 170 140 L 340 118 L 508 120" class="d-edge" marker-end="url(#arr-scope)"/>
    <path d="M 170 190 L 340 124 L 508 124" class="d-edge" marker-end="url(#arr-scope)"/>
  </svg>
</figure>

If the same concept appears in lectures, a quiz, and a practical worksheet, that strongly signals the exam expects both **conceptual understanding** and **procedural fluency**. The hardware and software list is content, not just logistics: the B-U585I-IOT02A board, the STM32CubeIDE flow, assembly integration steps, and the later FPGA / Vitis AI toolchain are all legitimate working knowledge.

### Course outline and learning objectives

The slides spell out the six-block course outline, a useful map of what is in scope:

1. **Primer on computer architecture** (Topic 1).
2. **The STM32U5 and ARM Cortex-M33 architectures**.
3. **Data representation and bitwise operations**.
4. **Pointers and pointer arithmetic using C**.
5. **ARM ISA and simple assembly language**: arithmetic/logic, data movement, procedures, branching/looping/testing instructions.
6. **"Fun with GPIOs and clocks"**: peripherals and timing.

The stated learning objectives: demonstrate understanding of **computer architecture** (emphasis on ARM Cortex-M); of **signals, buses, memory hierarchies and datapaths**; learn a subset of the **ARM 32-bit ISA (Thumb/ARMv8-M)**; gain in-depth understanding of **datatypes and number systems**; understand **pointers and pointer arithmetic**; and combine all of it to interact with the **B-U585I-IOT02A discovery board**.

> [!tip] Exam tips
> - If a topic appears in slides, tutorials, *and* quizzes, treat it as high-confidence exam scope.
> - If asked how the course is assessed, answer with the **final exam (out of 10) plus up to $1$ bonus grade point**. Do not invent project or assignment weighting.
> - The course scope explicitly includes C, assembly, microcontrollers, peripherals, FPGA basics, and Vitis AI.

### Official resources

The main official resources are the **B-U585I-IOT02A Discovery kit**, the **STM32Cube tools** (the slides also call the IDE "CubeMXIDE"), **Vitis AI 3.5**, the **ARM / ST manuals**, and the stated textbook chapters. The three named textbooks are:

| Author(s) | Book | Use |
| --- | --- | --- |
| Patterson & Hennessy | *Computer Organization and Design — ARM Edition* | Architecture, organization, the power wall |
| Y. Zhu | *Embedded Systems with ARM Cortex-M Microcontrollers in Assembly Language and C* (4th ed.) | Assembly, the practical exercises |
| Harris & Harris | *Digital Design and Computer Architecture* | Transistors, logic, datapaths |

Named datasheets/manuals for reference: **STM32U585AI datasheet**, **PM0264** (STM32 Cortex-M33 programming manual), **Arm Cortex-M33 Processor Technical Reference Manual**, **Armv8-M Architecture Reference Manual**, and **UM2839** (Discovery kit user manual).

> [!info] Datasheet vs programming manual
> A **datasheet** describes the device's *capabilities and electrical characteristics*. A **programming manual** describes the *architecture, programming model, and register semantics*: how to actually program it. This distinction is asked directly in Mock Paper 3 Q6.

---

## Embedded Systems and Microcontrollers

This is the top-level definition layer for the whole course and is tested directly. If you answer this vaguely, later architecture and tooling answers also become vague.

### What an embedded system is

> [!info] Headline definition (verbatim from the slides)
> An embedded system is *"a combination of a computer processor, computer memory, and input/output peripheral devices — that has a **dedicated function** within a larger mechanical or electronic system."*

> [!info] Definitions worth memorising
> - **Embedded system** — a specialised computer system with a *dedicated function*, hidden ("embedded") inside a larger product or environment.
> - **Microcontroller (MCU)** — a compact computing device that integrates CPU, memory, and peripherals on one chip.
> - **Peripheral** — a hardware block used for external interaction or support functions: GPIO, timers, UART/SPI/I²C, ADC/DAC, LEDs, sensors.
> - **Firmware** — low-level software running on embedded hardware, often close to the device and its peripheral registers.
> - **Cyber-physical system (CPS)** — an embedded system that interacts with the physical environment.

The slides stress three framing points: an embedded system is a **computer system hidden inside other systems**; it is **special-purpose** rather than general-purpose computing; and **end users see "smart" devices rather than computers**. It is not defined by being small, but by being built for a *specific purpose* inside a larger technical context.

> [!warning] Common pitfall
> Defining embedded systems only by being small rather than by being **task-specific / dedicated-function**, and forgetting the system includes hardware *and* software together. Mock Paper 1 Q1 wants exactly the special-purpose-vs-general-purpose contrast.

Embedded programming is programming under physical constraints: the code runs on a known device with known limits, interacts with fixed hardware, and is often expected to meet timing, power, and correctness requirements simultaneously. A microcontroller-centred embedded system differs from a desktop program in *where the software sits relative to the hardware*. The code is often directly responsible for configuring registers, reacting to events, and shaping electrical I/O behaviour rather than merely calling operating-system services. The slides' design mantra for embedded systems: **"Performance, performance, performance! Cost, cost, cost!"**

### Why microcontrollers

A microcontroller is the most common platform for embedded programming because it places the **processor core**, **program memory**, **data memory**, and **peripheral interfaces** on a single chip. That integration makes it cheap, power-efficient, and tightly coupled to real hardware.

> [!tip] Exam-grade 30-second answer
> An embedded system is a specialised computer built to perform a specific (dedicated) task under resource constraints such as power, memory, timing, or hardware integration. A microcontroller combines CPU, memory, and peripherals on one chip, which is why it is a common platform for embedded programming. Distinguish embedded systems from general-purpose computers by **specialisation**, **integration**, and **tight hardware–software interaction**.

The slides drive the point home with real teardowns: embedded ARM microcontrollers are *everywhere*.

| Device | Embedded controller |
| --- | --- |
| Apple AirPods 3 charge case | STM32L496, ARM Cortex-M4 |
| Fitbit Flex | STM32L151C6, ultra-low-power ARM Cortex-M3 |
| Samsung Galaxy Gear watch | STM32F401B, ARM Cortex-M4, 128 KB Flash |
| Pebble smartwatch | STM32F205RE, ARM Cortex-M3, 120 MHz |
| Nest Learning Thermostat | STM32L151VB, ultra-low-power 32 MHz Cortex-M3 |
| Oculus VR / HTC Vive | STM32F072, ARM Cortex-M0 |
| Amazon Echo | TI DM3725, ARM Cortex-A8 |

Representative application domains: **automotive, healthcare, consumer electronics, robotics, agriculture, and IoT**. The slides also note the *post-PC era*: smartphones overtook PCs in $2011$, and IoT-connected devices grew from $\approx 1$ million ($1992$) to $> 50$ billion ($2020$).

---

## ARM, RISC-V, and the ISA

This block was implicit in the previous notes but is explicit in the slides. It explains why the course uses ARM and what an ISA actually is.

### What an ISA is

> [!info] Definitions worth memorising
> - **Instruction** — a single command the processor understands; a "word" in the machine's vocabulary.
> - **Instruction Set Architecture (ISA)** — the full vocabulary of instructions; the **interface between hardware and software**. It specifies both *what* the processor can do and *how* it gets done.
> - **RISC** — Reduced Instruction Set Computing; a small, regular instruction set optimised for fast, simple execution.

The ISA is the contract: software is written against it, hardware implements it. Anything that decodes the same instructions in the same way is "the same architecture" even with very different silicon underneath.

<figure class="diag-figure">
  <figcaption>The ISA as the interface layer between software and hardware</figcaption>
  <svg viewBox="0 0 760 200" class="diag-svg" role="img" aria-label="ISA between software and hardware">
    <rect x="230" y="20"  width="300" height="46" class="d-node-acc"/>
    <text x="380" y="40"  text-anchor="middle" class="d-h-sm">Software</text>
    <text x="380" y="58"  text-anchor="middle" class="d-sub">programs, compilers</text>
    <rect x="230" y="80"  width="300" height="46" class="d-node-acc"/>
    <text x="380" y="100" text-anchor="middle" class="d-h-sm">Instruction Set Architecture (ISA)</text>
    <text x="380" y="118" text-anchor="middle" class="d-sub">the hardware/software interface</text>
    <rect x="230" y="140" width="300" height="46" class="d-node"/>
    <text x="380" y="160" text-anchor="middle" class="d-h-sm">Hardware</text>
    <text x="380" y="178" text-anchor="middle" class="d-sub">transistors, datapath, control</text>
  </svg>
</figure>

### Why ARM

> [!info] ARM facts from the slides
> ARM = **A**corn **R**ISC **M**achine, founded in $1990$. Public company, headquartered in Cambridge, UK. ARM cores are the main CPU in most mobile phones and handhelds; Apple began moving Macs from Intel to ARM-based "Apple silicon" in late $2020$; the Fugaku supercomputer ($2022$, then world's fastest) is ARM AArch64-based.

Stated advantages of ARM processors:

| Advantage | Why |
| --- | --- |
| **Energy efficiency** | Designed for low power consumption |
| **Cost-effectiveness** | Simple architecture → smaller die → cheaper to manufacture |
| **Scalability** | Modular architecture spans Cortex-M0 up to AArch64 |
| **High performance for specific tasks** | Optimised for RISC; good at parallel-processing workloads |

> [!info] External source — ARM vs RISC-V (Lecture 1 slide)
> **RISC-V** is the rising alternative: an **open-source** ISA started by researchers at Berkeley to promote innovation. It has a fixed base integer instruction set plus *optional extensions* (floating-point, atomic operations, vector processing). ARM, by contrast, has multiple instruction sets (ARMv7, ARMv8) and extensions such as NEON for SIMD. Both are RISC ISAs widely used for processor design.

### Why learn assembly

> [!info] Definition worth memorising
> **Assembly language** — a low-level programming language intended to communicate (almost) directly with a computer's hardware; a human-readable symbolic form of machine instructions.

The slides give explicit reasons to learn assembly even when C exists:

- **Understand how the processor works.** Assembly is not "just another language".
- **Speed.** Assembly can run faster than high-level code; performance-critical or latency-sensitive sections (e.g. an aircraft controller) may be hand-written in assembly after profiling finds the bottleneck. Standard C compilers also do not use *every* ARM operation (e.g. `ROR` rotate-right, `RRX` rotate-right-extended).
- **Hardware/processor-specific code.** Booting code, device drivers, the compiler/assembler/linker themselves, and atomic *test-and-set* instructions used to build locks and semaphores.
- **Cost-sensitive applications.** Embedded devices where code size is limited (washing-machine controllers, automotive controllers).
- **Better understanding of high-level languages**.

---

## Discovery Board, Peripherals, and Memory Types

The board and its peripherals are part of the practical identity of the course. This section also anchors the difference between Flash/ROM-style storage and RAM working memory.

### The board as an embedded laboratory

> [!info] Definitions worth memorising
> - **B-U585I-IOT02A Discovery kit** — the course board: an **ARM Cortex-M33 core (STM32U585AI)** in a UFBGA169 package, **ARMv8-M architecture with the Main Extension**.
> - **Flash / ROM-style program memory** — non-volatile storage that keeps program code when power is removed.
> - **RAM** — volatile working memory for variables, the stack, buffers, and other runtime data.
> - **GPIO** — General-Purpose Input/Output pins used for simple digital interaction with external hardware.

The slides give the board's concrete specification:

| Resource | Value |
| --- | --- |
| Core | ARM Cortex-M33 (STM32U585AI), ARMv8-M Main Extension |
| Flash memory | $2$ MB |
| SRAM | $786$ KB |
| External Flash | $512$-Mbit Quad-SPI Flash |
| Sensors | $2$ digital microphones; humidity + temperature; 3-axis magnetometer; 3D accelerometer + 3D gyroscope; pressure/barometer; time-of-flight + gesture; ambient-light |
| Wireless | $802.11$ b/g/n WiFi; BLE $5.4$ |
| Debug | on-board ST-LINK-V3E |

A good mental model divides the board into **computation, storage, and interaction**: the CPU computes, Flash and RAM store, and peripherals interact with the outside world.

<figure class="diag-figure">
  <figcaption>Discovery board organised into computation, storage, and interaction</figcaption>
  <svg viewBox="0 0 760 250" class="diag-svg" role="img" aria-label="Board organised into computation, storage, interaction">
    <rect x="20" y="20" width="720" height="210" class="d-node"/>
    <text x="380" y="42" text-anchor="middle" class="d-h-sm">B-U585I-IOT02A Discovery board</text>

    <rect x="50" y="70" width="180" height="56" class="d-node-acc"/>
    <text x="140" y="93" text-anchor="middle" class="d-h-sm">CPU core (Cortex-M33)</text>
    <text x="140" y="113" text-anchor="middle" class="d-sub">computation</text>

    <rect x="290" y="70" width="180" height="56" class="d-node"/>
    <text x="380" y="93" text-anchor="middle" class="d-h-sm">Flash 2 MB (non-volatile)</text>
    <text x="380" y="113" text-anchor="middle" class="d-sub">program image — kept on power loss</text>

    <rect x="290" y="140" width="180" height="56" class="d-node"/>
    <text x="380" y="163" text-anchor="middle" class="d-h-sm">SRAM 786 KB (volatile)</text>
    <text x="380" y="183" text-anchor="middle" class="d-sub">stack, globals, buffers — lost on power loss</text>

    <rect x="530" y="70" width="180" height="56" class="d-node"/>
    <text x="620" y="93" text-anchor="middle" class="d-h-sm">Peripherals</text>
    <text x="620" y="113" text-anchor="middle" class="d-sub">GPIO, LEDs, sensors, timers</text>

    <rect x="50" y="140" width="180" height="56" class="d-node-acc"/>
    <text x="140" y="163" text-anchor="middle" class="d-h-sm">ST-LINK-V3E debug</text>
    <text x="140" y="183" text-anchor="middle" class="d-sub">+ clock infrastructure</text>
  </svg>
</figure>

### The Cortex-M33 memory map

Tutorial 1 introduces the **Cortex-M33 memory map** directly. Memory is just a table of numbers ("a table of numbers, positions numbered sequentially from $0$"). Addresses are simply numbers assigned to bytes. The address ranges to know:

| Region | Address range (approx.) | Holds |
| --- | --- | --- |
| Flash memory (instruction memory) | starts at `0x08000000` | the program image |
| SRAM (data memory) | starts at `0x20000000` | stack, globals, heap, buffers |
| Peripheral region | `0x40000000` onward (~153 KB) | memory-mapped peripheral registers |
| External RAM / external device | `0x60000000` / `0xA0000000` onward | off-chip memory and devices |
| Internal peripherals (private) | `0xE0000000` onward | core/debug control |

<figure class="diag-figure">
  <figcaption>Cortex-M33 memory map (low addresses at bottom) — distinct regions for code, data, and peripherals</figcaption>
  <svg viewBox="0 0 760 320" class="diag-svg" role="img" aria-label="Cortex-M33 memory map">
    <rect x="220" y="20"  width="320" height="44" class="d-node"/>
    <text x="380" y="40"  text-anchor="middle" class="d-h-sm">Internal peripherals (private)</text>
    <text x="555" y="46"  class="d-sub">0xE0000000</text>
    <rect x="220" y="68"  width="320" height="44" class="d-node"/>
    <text x="380" y="88"  text-anchor="middle" class="d-h-sm">External device / external RAM</text>
    <text x="555" y="94"  class="d-sub">0x60000000+</text>
    <rect x="220" y="116" width="320" height="44" class="d-node-acc"/>
    <text x="380" y="136" text-anchor="middle" class="d-h-sm">Peripheral region</text>
    <text x="380" y="153" text-anchor="middle" class="d-sub">memory-mapped registers</text>
    <text x="555" y="142" class="d-sub">0x40000000</text>
    <rect x="220" y="164" width="320" height="44" class="d-node-acc"/>
    <text x="380" y="184" text-anchor="middle" class="d-h-sm">SRAM (data memory)</text>
    <text x="380" y="201" text-anchor="middle" class="d-sub">stack grows down, heap grows up</text>
    <text x="555" y="190" class="d-sub">0x20000000</text>
    <rect x="220" y="212" width="320" height="44" class="d-node"/>
    <text x="380" y="232" text-anchor="middle" class="d-h-sm">Flash (instruction memory)</text>
    <text x="380" y="249" text-anchor="middle" class="d-sub">the program image</text>
    <text x="555" y="238" class="d-sub">0x08000000</text>
    <text x="380" y="285" text-anchor="middle" class="d-sub">address 0x00000000 at the bottom — memory is just a numbered table of bytes</text>
  </svg>
</figure>

### Flash versus RAM

**Flash** stores code and persistent data across power cycles, which is why flashing a program makes it survive a reset. **RAM** holds execution-time state: stack frames, globals copied/initialised at startup, buffers, and temporary variables. Remove power and that live state disappears.

| Aspect | Flash / ROM-style | RAM |
| --- | --- | --- |
| Volatility | Non-volatile (kept on power loss) | Volatile (lost on power loss) |
| Typical contents | Program instructions, persistent data | Stack frames, globals, buffers, temporaries |
| On the board | $2$ MB on-chip Flash, code starts at `0x08000000` | $786$ KB SRAM, data region at `0x20000000` |
| Role in the course | Where the program *lives* | Where execution *state* lives |

Concretely, in a running C program:

```c
int global_counter = 3;     /* initialized data — part of the program image */

int main(void) {
    int local_value = 7;    /* lives in runtime stack memory */
    while (1) {
        local_value++;
    }
}
```

An embedded binary is compiled on the host, then flashed onto the MCU. Instructions are stored in Flash; global variables, stack frames, and temporaries live in RAM.

> [!warning] Common pitfalls
> - Calling RAM persistent program storage. It is **not**: RAM contents are lost on power loss. Mock Paper 1 Q2 has "Flash / ROM-like non-volatile memory" as the correct answer for where program code lives.
> - Treating GPIO pins as the *only* peripheral type on the board.

### Peripherals and memory-mapped registers

> [!info] Definition worth memorising
> **Memory-mapped I/O** — peripheral registers occupy addresses in the **normal processor address space**, so ordinary `LDR`/`STR` instructions read and write them. No special I/O instructions are needed.

Peripherals are hardware subsystems with **register interfaces**. A GPIO block lets software control or sample pins, a timer counts or generates periodic events, a sensor interface gives access to measurements. The CPU does not "become" these peripherals: it **configures them through memory-mapped registers** and reacts to their state. GPIO, timers, and sensor blocks are *hardware blocks controlled by* the CPU. This is a core architectural difference between embedded and general-purpose programming.

> [!tip] Exam tips
> - If a question asks where the program lives, think persistent non-volatile memory (Flash/ROM) first.
> - If a question asks what counts as a board peripheral, think beyond GPIO pins: include LEDs, sensors, timers, communication blocks (UART/SPI/I²C), ADC/DAC.
> - Mock Paper 4 Exercise 2 asks you to poll a status register at `0x40001000`. That address sits squarely in the peripheral region, and the polling loop is a textbook memory-mapped-I/O example.

---

## Languages, Abstraction, and Why Computers Speak Binary

This block bridges the course from high-level C to machine-level assembly and binary execution, and explains why hardware is binary in the first place.

### The language layers

> [!info] Definitions worth memorising
> - **Binary** — a base-2 representation using $0$ and $1$, aligning naturally with on/off digital hardware states.
> - **Binary digit / bit** — a single "letter" of the computer's two-letter alphabet.
> - **Assembler** — a tool that translates a symbolic instruction (assembly) into its binary machine encoding.
> - **Compiler** — a tool that translates a high-level language (C) into instructions.
> - **High-level language** — a more abstract language such as C that must be compiled to lower-level instructions.
> - **Abstraction** — a representation that hides lower-level detail while preserving useful meaning.

The slides put it plainly: to speak to electronic hardware you send electrical signals, and the easiest signals are on/off, so the computer alphabet is just $0$ and $1$. Instructions are *collections of bits the computer understands*; e.g. the bit pattern `1001010100101110` might tell one computer to add two numbers. **Using numbers for *both* instructions and data is a foundation of computing.** Early programmers wrote binary directly; it was so tedious they invented symbolic notations and the **assembler** to translate them, so that `add r3, r2` becomes `1001010100101110`.

High-level code, assembly, machine code, and electrical behaviour are different layers of the *same* system. C gives productivity, assembly gives explicit control over instructions and registers, and binary is the encoded form the hardware consumes.

<figure class="diag-figure">
  <figcaption>Abstraction layers — one program, four representations from human-readable to electrical</figcaption>
  <svg viewBox="0 0 760 270" class="diag-svg" role="img" aria-label="Abstraction layers from C down to hardware">
    <defs>
      <marker id="arr-lang" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="230" y="20" width="300" height="46" class="d-node-acc"/>
    <text x="380" y="40" text-anchor="middle" class="d-h-sm">High-level language (C)</text>
    <text x="380" y="58" text-anchor="middle" class="d-sub">productivity, abstraction</text>

    <rect x="230" y="90" width="300" height="46" class="d-node"/>
    <text x="380" y="110" text-anchor="middle" class="d-h-sm">Assembly</text>
    <text x="380" y="128" text-anchor="middle" class="d-sub">symbolic machine instructions</text>

    <rect x="230" y="160" width="300" height="46" class="d-node"/>
    <text x="380" y="180" text-anchor="middle" class="d-h-sm">Machine code (binary)</text>
    <text x="380" y="198" text-anchor="middle" class="d-sub">what the machine understands</text>

    <rect x="230" y="220" width="300" height="40" class="d-node-acc"/>
    <text x="380" y="244" text-anchor="middle" class="d-h-sm">Digital hardware (electrical states)</text>

    <line x1="380" y1="66"  x2="380" y2="88"  class="d-edge" marker-end="url(#arr-lang)"/>
    <line x1="380" y1="136" x2="380" y2="158" class="d-edge" marker-end="url(#arr-lang)"/>
    <line x1="380" y1="206" x2="380" y2="218" class="d-edge" marker-end="url(#arr-lang)"/>
    <text x="545" y="82"  class="d-sub">compiled</text>
    <text x="545" y="152" class="d-sub">assembled / encoded</text>
    <text x="545" y="216" class="d-sub">executed</text>
  </svg>
</figure>

### One idea, multiple layers (worked example)

A single high-level statement:

```c
x = x + 1;
```

can become assembly such as:

`LDR {Rt}, [{Rn}]`: load into register `Rt` the word at the address held in `Rn`.
`ADDS {Rd}, {Rn}, #{imm}`: add immediate `imm` to `Rn`, store in `Rd`, update flags.
`STR {Rt}, [{Rn}]`: store the word in `Rt` to the address held in `Rn`.

```asm
LDR  r0, [r1]
ADDS r0, r0, #1
STR  r0, [r1]
```

Those instructions are themselves binary encodings in memory. The program stays conceptually the same while the *representation* changes with the abstraction level.

> [!info] Worked example — how an instruction is encoded (Lecture 1 + Tutorial 1)
> Tutorial 1 traces `int counter = 0; counter++;` down to the bits. The compiler emits Thumb instructions; the slides decode the **T32 "one low register and immediate"** format (Armv8-M Reference Manual §C2.2.1.3):
>
> $$\texttt{[15..13]} = \texttt{001} \quad \texttt{[12..11]} = op \quad \texttt{[10..8]} = reg \quad \texttt{[7..0]} = imm8$$
>
> The `op` field selects the instruction: `00` = MOV, `01` = CMP, `10` = ADD, `11` = SUB.
>
> - **`MOVS r3, #0`** → $op = 00$, $reg = 011$, $imm8 = 0$ → `0b0010 0011 0000 0000` = **`0x2300`**.
> - **`ADDS r3, #1`** → `0b0011 0011 0000 0001` = **`0x3301`**.
> - **`ADDS r3, #5`** → `0b0011 0011 0000 0101` = **`0x3305`** ($51$ dec).
>
> In the IDE's Memory view the bytes appear **little-endian** (low byte first), e.g. `ADDS r3,#1` shows as `01 33`. This proves that *instructions are just numbers in memory*: the same address can be viewed as an instruction (Disassembly view) or as raw bytes (Memory view).

> [!info] Tutorial 1 — ARM is a load-store architecture
> A variable's *value* lives in memory (RAM). To work on it the CPU must **load** it into a register, operate, then **store** it back, hence the `LDR ... / ADDS ... / STR ...` triple per `counter++`. This is the **load-store architecture**: arithmetic happens only on registers, never directly on memory. Declaring `register int counter` can keep the value in a register (e.g. `r4`) and skip the load/store, but the compiler may optimise an unused variable away entirely unless its result is actually used. The Program Counter **`PC` (R15)** advances by the size of each instruction ($2$ bytes per Thumb instruction).

### Why hardware speaks binary: the transistor

> [!info] Definition worth memorising
> **Transistor** — a semiconductor device used to amplify or switch electrical signals and power. It is *simply an on/off switch controlled by electricity*, one of the basic building blocks of modern electronics.

The slides answer "why do computers speak binary?" with the transistor: because the fundamental component is a two-state switch, the natural alphabet is two-valued ($0$/$1$). Transistors come in PNP and NPN types, and **logic gates (AND, OR, NOT) can be built directly out of transistors**. Scale shows how far this goes: ENIAC ($1945$) used $18{,}000$ vacuum tubes; the highest consumer-microprocessor transistor count as of June $2023$ was $134$ **billion** transistors in Apple's M2 Ultra SoC (TSMC $5$ nm process).

> [!warning] Common pitfalls
> - Saying assembly is the ultimate physical language of the hardware. It is closer to machine code than C, but still **not** the raw electrical form.
> - Confusing source code with the binary encoding stored in memory.

> [!tip] Exam tips
> - If asked what language the machine understands, answer **binary / machine code**, not the source language you happen to write.
> - Treat C and assembly as layers in the toolchain rather than as things the transistor-level hardware "understands directly".
> - Abstractions exist because humans need more manageable languages and models than raw bit patterns.

---

## Computer Organization

The slides include a "Primer on computer architecture": the five-component model and the fetch–decode–execute cycle. This was missing from the previous notes and is theory-MCQ material (Mock Paper 2 Q1–Q2).

### The five classic components

> [!info] Definition worth memorising
> Every computer, past or present, is built from **five classic components**: **input, output, memory, datapath, and control**. The **datapath + control** together are usually called the **processor**. This organisation is *independent of hardware technology*.

| Component | Role |
| --- | --- |
| **Input** | Writes data *to memory* |
| **Output** | Reads data *from memory* |
| **Memory** | Holds instructions and data; the processor fetches both *from memory* |
| **Datapath** | Performs the actual value transformations (the "moving/working" part) |
| **Control** | Sends the signals that steer the datapath, memory, input, and output |

<figure class="diag-figure">
  <figcaption>The five classic components — datapath + control form the processor</figcaption>
  <svg viewBox="0 0 760 230" class="diag-svg" role="img" aria-label="Five components of a computer">
    <defs>
      <marker id="arr-org" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="40"  y="80" width="150" height="64" class="d-node-acc"/>
    <text x="115" y="104" text-anchor="middle" class="d-h-sm">Processor</text>
    <text x="115" y="124" text-anchor="middle" class="d-sub">datapath + control</text>

    <rect x="300" y="80" width="160" height="64" class="d-node"/>
    <text x="380" y="108" text-anchor="middle" class="d-h-sm">Memory</text>
    <text x="380" y="128" text-anchor="middle" class="d-sub">instructions + data</text>

    <rect x="570" y="20" width="150" height="56" class="d-node"/>
    <text x="645" y="52" text-anchor="middle" class="d-h-sm">Input</text>

    <rect x="570" y="150" width="150" height="56" class="d-node"/>
    <text x="645" y="182" text-anchor="middle" class="d-h-sm">Output</text>

    <path d="M 300 112 L 192 112" class="d-edge" marker-end="url(#arr-org)"/>
    <text x="210" y="104" class="d-sub">fetch</text>
    <path d="M 570 48  L 462 90"  class="d-edge" marker-end="url(#arr-org)"/>
    <text x="490" y="58" class="d-sub">writes to memory</text>
    <path d="M 462 134 L 570 178" class="d-edge" marker-end="url(#arr-org)"/>
    <text x="490" y="170" class="d-sub">reads from memory</text>
  </svg>
</figure>

### Datapath versus control, and the fetch–decode–execute cycle

The **datapath** moves and *transforms* values; **control** issues the signals that *steer* execution. Within control, the **decode stage** of the fetch–decode–execute cycle interprets the fetched instruction and generates the internal control actions that the datapath then carries out.

> [!info] External source — Von Neumann vs Harvard (Mock Paper 2 Q4)
> A **Von Neumann** architecture uses one shared memory for both instructions and data; a **Harvard** architecture uses *separate* instruction and data memories. The course's Cortex-M memory map keeps Flash (code) and SRAM (data) in distinct regions, a practical reflection of the same separation idea.

> [!tip] Exam tips
> - "Name the two parts of the processor" → **datapath and control**.
> - Registers are faster than ordinary memory because they sit *inside the CPU*, much closer to the ALU.
> - The ALU does arithmetic, logic, comparisons, shifts, and related value transformations.

---

## Power Management and Resource Constraints

The syllabus explicitly names power management, and the course repeatedly returns to embedded resource constraints. The slides give this a concrete historical anchor: **the power wall**.

### Power as a design constraint

> [!info] Definitions worth memorising
> - **Power management** — design and programming choices aimed at controlling energy use in an embedded system.
> - **Resource constraint** — a limit on power, memory, compute throughput, latency, storage, or hardware capability.
> - **Low-power embedded system** — a system designed to meet functionality goals while minimising energy consumption.
> - **Power wall** — the point (mid-2000s) where rising CPU clock rates drove power and heat to levels that could no longer be cooled affordably, ending the era of clock-speed scaling.

Power is not an afterthought layered on a finished design. It is a constraint that shapes which algorithms, clock settings, peripherals, memory structures, and accelerators are practical at all. Embedded systems are designed around *budgets*, not unconstrained peak capability.

### The power wall

The slides show clock rate and power across nine Intel CPU generations: clock rate climbed from $\approx 12.5$ MHz ($80286$, $1982$) to $\approx 3600$ MHz ($\sim 2004$), but **power rose from $\approx 3.3$ W to $\approx 103$ W** over the same span. After Pentium 4 Prescott ($2004$) clock rate flatlined: cooling cost capped further scaling. This is the **power wall**, and it is why the industry pivoted to multi-core and to energy-efficient designs, exactly the niche ARM occupies. Single-program performance growth fell from $\approx 52\%$/year ($1986$–$2003$) to $\approx 12\%$/year and then $\approx 3.5\%$/year.

<figure class="diag-figure">
  <figcaption>The power wall — clock rate stalled once power per chip became uncoolable</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="The power wall">
    <defs>
      <marker id="arr-pw" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="30"  y="90" width="170" height="56" class="d-node"/>
    <text x="115" y="114" text-anchor="middle" class="d-h-sm">Raise clock rate</text>
    <text x="115" y="133" text-anchor="middle" class="d-sub">1982–2004</text>

    <rect x="280" y="90" width="170" height="56" class="d-node-acc"/>
    <text x="365" y="114" text-anchor="middle" class="d-h-sm">Power + heat rise</text>
    <text x="365" y="133" text-anchor="middle" class="d-sub">3 W → 100+ W</text>

    <rect x="530" y="20" width="200" height="56" class="d-node"/>
    <text x="630" y="44" text-anchor="middle" class="d-h-sm">Power wall</text>
    <text x="630" y="63" text-anchor="middle" class="d-sub">cooling too costly</text>

    <rect x="530" y="150" width="200" height="56" class="d-node-acc"/>
    <text x="630" y="174" text-anchor="middle" class="d-h-sm">Multi-core + low-power</text>
    <text x="630" y="193" text-anchor="middle" class="d-sub">ARM-style efficiency</text>

    <line x1="200" y1="118" x2="278" y2="118" class="d-edge" marker-end="url(#arr-pw)"/>
    <path d="M 450 105 L 528 60"  class="d-edge" marker-end="url(#arr-pw)"/>
    <path d="M 450 130 L 528 175" class="d-edge" marker-end="url(#arr-pw)"/>
  </svg>
</figure>

### Why optimisation is a power question

Optimisation questions are often *also* power questions. Smaller models, lower precision, clock gating, and efficient hardware use all matter because every extra operation or active subsystem has an energy cost:

$$\text{more activity} \;\longrightarrow\; \text{more energy use} \;\longrightarrow\; \text{tighter thermal/power budget}$$

In embedded systems, optimisation is often about staying inside a power budget rather than only minimising runtime. Compute, memory, and power constraints are linked: reducing operations or model size cuts both energy and runtime. The course's FPGA / Edge-AI module revisits this constraint theme from an accelerator angle.

> [!warning] Common pitfalls
> - Thinking power only matters for battery-powered devices in an extreme sense.
> - Treating embedded constraints as afterthoughts rather than as **central design drivers**.

> [!tip] Exam tips
> - When asked why a design choice matters in embedded work, include **resource cost** as well as correctness.
> - Power management is not separate from algorithmic efficiency: they influence each other directly.
> - Peripheral clock gating and hardware configuration choices are part of practical power-management thinking.

---

## Typical Exam Questions

- How is the course assessed? What proportion of the exam is theoretical versus practical, and how does the bonus test factor in?
- Which tools, hardware platforms, datasheets, and textbooks are explicitly part of the course setup?
- What best describes an embedded system? State one key difference between an embedded system and a general-purpose computer.
- What is a microcontroller, and why is it useful for embedded systems?
- Which type of memory stores program code in an embedded system? What is the difference between Flash and RAM in embedded execution?
- Which examples on the B-U585I-IOT02A count as peripherals?
- What is the primary language that computers understand? How are C, assembly, and binary related, and what do the compiler and assembler each do?
- What is an ISA, and why is it described as the hardware–software interface? How do ARM and RISC-V differ?
- What is a transistor, and why is it the most essential computer component / why do computers speak binary?
- Name the five classic components of a computer. What is the difference between datapath and control?
- Why is power management important in embedded systems? What is the power wall, and how do memory and compute constraints interact with power constraints?

---

## Past exam coverage

- **Paper 1 Q1 — "State one key difference between an embedded system and a general-purpose computer." (4 marks).** Expected answer: embedded systems are specialised, hardware-coupled, and resource-constrained; general-purpose systems are meant for broad use.
- **Paper 1 Q2 — "Program code on the Discovery board is typically stored in…" (MC).** Correct: **Flash / ROM-like non-volatile memory** — not RAM, not cache, not the ALU.
- **Paper 1 Q3 — "What does the Program Counter (PC) hold?" (4 marks).** Expected: the address of the next instruction to execute.
- **Paper 1 Q4 — "Name the two main parts of the processor in the datapath-plus-control view." (4 marks).** Expected: **datapath and control**.
- **Paper 2 Q1 — "Difference between datapath and control?" (4 marks).** Datapath moves/transforms values; control issues the signals that steer execution.
- **Paper 2 Q3 — "Why are registers faster than ordinary memory?" (4 marks).** Registers are inside the CPU, much closer to the ALU.
- **Paper 2 Q10 — "What is cache for?" (4 marks).** Reduces average access time by holding frequently used data/instructions close to the CPU.
- **Paper 3 Q1–Q3, Q5, Q6 — workflow and tooling.** Build/flash/debug distinction; ST-LINK as the host-to-board interface; disassembly view; memory-mapped I/O (peripherals occupy normal addresses); datasheet vs programming manual.
- **Paper 4 Q1 / Exercise 2 — foundations carried into FPGA and integrated reasoning.** Exercise 2 (smart sensor node) asks where program code vs runtime variables live (Flash vs RAM), why GPIO/timers/sensor registers are peripherals rather than the CPU, and why polling a register at `0x40001000` is memory-mapped I/O — all directly Topic 1 material.
- **General framing across the pack.** Any question that asks "why does an embedded design choice matter" expects both correctness *and* resource cost (power, memory, timing) — the central theme of this chapter.
