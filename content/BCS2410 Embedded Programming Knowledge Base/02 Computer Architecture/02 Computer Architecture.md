# Topic 2 — Computer Architecture

**Lecture slides:** `Materials/Lecture 2 - Computer architecture.pdf`, `Materials/Lecture 3 - Computer architecture.pdf`
**Past exam coverage:** Mock Paper 1 (Q2 code storage, Q3 PC, Q4 datapath+control, Q6 ALU job); Mock Paper 2 (Q1 datapath vs control, Q2 decode, Q3 registers vs memory, Q4 Von Neumann vs Harvard, Q5 half/full adder, Q10 cache); Mock Paper 4 Exercise 2 (program code vs runtime data placement)

This chapter is the hardware foundation for everything that follows in the course: ARM assembly, registers, flags, and embedded design trade-offs. It works from the bottom up. Transistors switch, switches become logic gates, gates become adders and ALUs, and those blocks combine with memory and I/O into a programmable machine driven by the fetch-decode-execute cycle. Quiz 1 draws directly from this material: the role of the transistor, the primary components of computer organization, the ALU and program counter, cache and the power wall, the decode stage, and the Von Neumann versus Harvard distinction. Once this structural picture is clear, assembly stops being symbolic and becomes concrete.

> [!tip] Resit priority (from the March 2026 sitting)
> The memory-hierarchy section was a weak spot: the exam wanted the **cell-level hardware mechanism** of SRAM, DRAM, and Flash, not just the speed order. The section *SRAM, DRAM, and Flash — the Hardware Mechanism* below is the highest-value block in this chapter; study it until you can sketch all three cells from memory.

---

## Transistors, Logic, and Digital Hardware

Digital hardware works because the **transistor** can act as a controlled switch. At exam level the required depth is *functional*, not semiconductor-physics: you must know what the transistor does, not derive MOSFET current equations.

> [!info] Core definitions
> - **Transistor** — an electronic component used primarily to **switch and amplify** signals; the basis of all digital logic circuits.
> - **Logic gate** — a circuit implementing a Boolean operation such as AND, OR, or NOT.
> - **Digital signal** — a discrete-valued electronic signal, typically interpreted as binary 0 or 1.

Arranged into circuits, transistors enforce relationships between input and output voltages that match Boolean logic. AND, OR, and NOT are therefore not merely symbolic rules on paper; they are behaviors realized by electronic switching networks.

This transistor-to-gate perspective explains why **binary is natural** in digital systems. Rather than representing many analog levels precisely, the hardware is engineered around a small number of reliably distinguishable regions (low and high). That makes logic noise-tolerant and easy to compose. Computation, storage, and control all reduce to arrangements of switching elements that preserve and transform binary state.

Gates do not remain isolated. They are composed into larger **combinational circuits** such as multiplexers and adders, and combined with **state-holding elements** to form **sequential circuits**. Those larger blocks become ALUs, control logic, register files, memory arrays, and peripheral controllers. So when later sections discuss adders or ALUs, they still describe structures built on this transistor-and-logic foundation.

A minimal truth-table reminder for the two most common gates:

| `A` | `B` | `A AND B` | `A OR B` |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 1 |

<figure class="diag-figure">
  <figcaption>Abstraction stack — transistors switch, gates compute Boolean logic, larger blocks emerge</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="From transistors to gates to functional blocks">
    <defs>
      <marker id="arr-tg" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="20" y="82" width="180" height="56" class="d-node"/>
    <text x="110" y="106" text-anchor="middle" class="d-h-sm">Transistors</text>
    <text x="110" y="126" text-anchor="middle" class="d-sub">controlled switches</text>

    <rect x="290" y="82" width="180" height="56" class="d-node"/>
    <text x="380" y="106" text-anchor="middle" class="d-h-sm">Logic gates</text>
    <text x="380" y="126" text-anchor="middle" class="d-sub">AND · OR · NOT</text>

    <rect x="560" y="82" width="180" height="56" class="d-node-acc"/>
    <text x="650" y="100" text-anchor="middle" class="d-h-sm">Functional blocks</text>
    <text x="650" y="118" text-anchor="middle" class="d-sub">adders · ALU · registers</text>
    <text x="650" y="133" text-anchor="middle" class="d-sub">memory · control</text>

    <line x1="200" y1="110" x2="288" y2="110" class="d-edge" marker-end="url(#arr-tg)"/>
    <line x1="470" y1="110" x2="558" y2="110" class="d-edge" marker-end="url(#arr-tg)"/>
  </svg>
</figure>

> [!warning] Common pitfalls
> - Calling the transistor a *persistent storage device* like Flash or disk. Its role is switching and amplification.
> - Skipping the link between transistor switching and binary computation, or treating gates and storage elements as magic abstractions.

> [!tip] Exam tip
> If asked what the transistor does in a computer, answer in terms of **switching and amplification**, never "directly interpreting programming languages." See also [[Languages, Abstraction, and Why Computers Speak Binary]].

---

## The Stored-Program Concept

Lecture 2 frames the whole machine around two principles that everything else rests on:

> [!info] Two key principles of today's computers
> 1. **Instructions are represented as numbers.** An instruction is a binary value, no different in form from a data value.
> 2. **Programs are stored in memory** to be read or written, **just like data**.
>
> Together these are the **stored-program concept**.

Two consequences the slides stress:

- Because instructions are numbers, **programs ship as files of binary numbers** (machine code).
- The commercial implication: a computer can **inherit ready-made software** as long as that software is compatible with the machine's existing **instruction set**. This is why instruction-set compatibility is economically powerful.

The lecture's memory picture makes this concrete. A single memory holds an accounting program (machine code), an editor program (machine code), a C compiler (machine code), payroll data, book text, and C source code, *all just numbers in the same address space*. The processor cannot tell from a value alone whether it is "an instruction" or "data"; interpretation depends entirely on how the value is used.

> [!info] Von Neumann history (from the slides)
> The **Von Neumann architecture** (a.k.a. von Neumann model / Princeton architecture) was first published by John von Neumann in **1945**. His design consists of a **Control Unit, ALU, Memory Unit, Registers, and Inputs/Outputs**. The stored-program design is still used in most computers produced today.

This is the bridge to the [[#Von Neumann vs Harvard Architecture]] section: the modern meaning of "von Neumann" is *any* stored-program machine in which an instruction fetch and a data operation **cannot occur at the same time because they share a common bus**.

---

## ALU Construction: Half Adders, Full Adders, and Subtraction

The ALU is the **central building block of computers**, the part that actually performs arithmetic and logical operations on data. The slides make a strong claim worth quoting: *all of the other elements of the computer system are there mainly to bring data into the ALU for it to process and then to take the results back out.* It is built entirely from **simple digital logic devices that store binary digits and perform Boolean operations**, so arithmetic operations are built from **combinational logic blocks** that process one bit position at a time and pass carry information between positions. Understanding how sum and carry are formed in hardware is what makes ARM flag behavior stop feeling arbitrary later in the course.

> [!info] Core definitions
> - **Half adder** — a combinational circuit that adds two input bits and produces a **sum** bit and a **carry-out** bit.
> - **Full adder** — a combinational circuit that adds two input bits **plus a carry-in** bit, producing a sum and carry-out.
> - **Carry-in / carry-out** — the incoming and outgoing carry bits that let adders be chained into larger multi-bit units.
> - **Ripple-carry adder** — a multi-bit adder formed by chaining full adders so each bit's carry-out feeds the next bit's carry-in.

### The ALU as a black box

The slides give a symbolic ALU: two **integer operands** `A` and `B` come in the top, an **opcode** selects the operation, an incoming **status** and an outgoing **status** carry condition information, and an **integer result** `Y` comes out the bottom. The live-code example maps this directly to assembly: `var3 = var3 + 1` compiles to `MOVS r4, #0` then `ADDS r4, #1`, i.e. operand A = 0, operand B = 1, opcode = add, result Y = 1 stored in `r4`. A real ALU IC such as the **74181** is 4-bit combinational logic that performs add / subtract / decrement (with or without carry), AND / NAND, OR / NOR, XOR, and shift.

### The half adder

For one-bit inputs $A$ and $B$, the half adder produces:

$$\text{Sum} = A \oplus B \qquad \text{Carry}_{\text{out}} = A \cdot B$$

That is, the **sum behaves like XOR** and the **carry behaves like AND**. The slides explain *why*: rows 1–3 of the truth table are exactly an XOR; row 4 ($1+1$) is *partially* correct for XOR ($1 \oplus 1 = 0$), but the real answer is 2, which needs an **extra carry bit**, supplied by the AND gate.

| `A` | `B` | $C_{\text{out}}$ | Sum |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 0 |

<figure class="diag-figure">
  <figcaption>Half adder — sum from XOR, carry from AND; no carry-in input</figcaption>
  <svg viewBox="0 0 520 200" class="diag-svg" role="img" aria-label="Half adder logic">
    <defs>
      <marker id="arr-ha" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="20" y="40" width="60" height="34" class="d-node"/>
    <text x="50" y="62" text-anchor="middle" class="d-h-sm">A</text>
    <rect x="20" y="120" width="60" height="34" class="d-node"/>
    <text x="50" y="142" text-anchor="middle" class="d-h-sm">B</text>

    <rect x="200" y="40" width="120" height="40" class="d-node-acc"/>
    <text x="260" y="65" text-anchor="middle" class="d-h-sm">XOR</text>
    <rect x="200" y="118" width="120" height="40" class="d-node-acc"/>
    <text x="260" y="143" text-anchor="middle" class="d-h-sm">AND</text>

    <rect x="420" y="40" width="80" height="40" class="d-node"/>
    <text x="460" y="65" text-anchor="middle" class="d-h-sm">Sum</text>
    <rect x="420" y="118" width="80" height="40" class="d-node"/>
    <text x="460" y="143" text-anchor="middle" class="d-h-sm">Carry</text>

    <path d="M 80 57 L 130 57 L 130 55 L 198 55" class="d-edge" marker-end="url(#arr-ha)"/>
    <path d="M 80 137 L 130 137 L 130 65 L 198 65" class="d-edge" marker-end="url(#arr-ha)"/>
    <path d="M 80 57 L 100 57 L 100 130 L 198 130" class="d-edge" marker-end="url(#arr-ha)"/>
    <path d="M 80 137 L 160 137 L 160 142 L 198 142" class="d-edge" marker-end="url(#arr-ha)"/>
    <line x1="320" y1="60" x2="418" y2="60" class="d-edge" marker-end="url(#arr-ha)"/>
    <line x1="320" y1="138" x2="418" y2="138" class="d-edge" marker-end="url(#arr-ha)"/>
  </svg>
</figure>

### The full adder and ripple-carry chains

A half adder is enough only when a bit position adds exactly two bits with no incoming carry. As soon as a position must also incorporate the carry from a less-significant position, **full-adder behavior** is required. The half adder *lacks a $C_{\text{in}}$ input* to accept the $C_{\text{out}}$ of the previous column, which is exactly what the full adder solves.

The full adder has three inputs ($C_{\text{in}}$, $A$, $B$) and the slide gives its equations:

$$\text{Sum} = A \oplus B \oplus C_{\text{in}}$$
$$C_{\text{out}} = AB + AC_{\text{in}} + BC_{\text{in}}$$

The full 8-row truth table from the slides:

| $C_{\text{in}}$ | `A` | `B` | $C_{\text{out}}$ | Sum |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 |
| 0 | 0 | 1 | 0 | 1 |
| 0 | 1 | 0 | 0 | 1 |
| 0 | 1 | 1 | 1 | 0 |
| 1 | 0 | 0 | 0 | 1 |
| 1 | 0 | 1 | 1 | 0 |
| 1 | 1 | 0 | 1 | 0 |
| 1 | 1 | 1 | 1 | 1 |

Consider adding two 2-bit numbers bit by bit:

- The **least-significant bit** can use half-adder-style logic, since there is no incoming carry (equivalently, a full adder with $C_{\text{in}} = 0$).
- The **next bit** must also incorporate any carry generated by the first bit.
- That is why chained multi-bit adders require full adders.

A multi-bit ALU is therefore built as a **ripple-carry adder**: full adders chained so each carry-out feeds the next stage's carry-in. Carry propagates from less-significant to more-significant bits. The slides' "4-bit ALU" experiment is literally four 1-bit-with-adder blocks wired this way, with a shared 2-bit opcode (00 = AND, 01 = OR, 10 = ADD).

<figure class="diag-figure">
  <figcaption>4-bit ripple-carry adder — carry ripples left through chained full adders</figcaption>
  <svg viewBox="0 0 760 170" class="diag-svg" role="img" aria-label="Ripple-carry adder">
    <defs>
      <marker id="arr-rc" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="600" y="60" width="120" height="50" class="d-node"/>
    <text x="660" y="80" text-anchor="middle" class="d-h-sm">FA bit 0</text>
    <text x="660" y="98" text-anchor="middle" class="d-sub">Cin = 0</text>

    <rect x="420" y="60" width="120" height="50" class="d-node"/>
    <text x="480" y="80" text-anchor="middle" class="d-h-sm">FA bit 1</text>
    <text x="480" y="98" text-anchor="middle" class="d-sub">full adder</text>

    <rect x="240" y="60" width="120" height="50" class="d-node"/>
    <text x="300" y="80" text-anchor="middle" class="d-h-sm">FA bit 2</text>
    <text x="300" y="98" text-anchor="middle" class="d-sub">full adder</text>

    <rect x="60" y="60" width="120" height="50" class="d-node"/>
    <text x="120" y="80" text-anchor="middle" class="d-h-sm">FA bit 3</text>
    <text x="120" y="98" text-anchor="middle" class="d-sub">full adder</text>

    <line x1="600" y1="85" x2="542" y2="85" class="d-edge" marker-end="url(#arr-rc)"/>
    <line x1="420" y1="85" x2="362" y2="85" class="d-edge" marker-end="url(#arr-rc)"/>
    <line x1="240" y1="85" x2="182" y2="85" class="d-edge" marker-end="url(#arr-rc)"/>
    <text x="570" y="50" text-anchor="middle" class="d-sub">carry</text>
    <text x="390" y="50" text-anchor="middle" class="d-sub">carry</text>
    <text x="210" y="50" text-anchor="middle" class="d-sub">carry</text>
  </svg>
</figure>

### Subtraction via two's complement

The slides put it plainly: **adders can add positive and negative numbers using two's complement**, and *subtraction is almost as easy: flip the sign of the second number, then add.* Flipping the sign of a two's-complement number means **inverting the bits and adding 1**. To compute $Y = A - B$:

$$Y = A - B = A + (\bar{B} + 1)$$

where $\bar{B}$ is the bitwise NOT of $B$, so $\bar{B} + 1$ is the **two's complement** (negation) of $B$. In hardware this is a row of inverters on the `B` input plus a `1` forced into the adder's carry-in; a **select switch (SW)** chooses add vs subtract, and an **overflow bit (OF)** flags out-of-range results. Subtraction therefore *reuses the addition circuitry* rather than being a separate arithmetic universe. This is why `subs r4, #1` is one ALU instruction, and why the ALU's arithmetic, carry, and overflow stories are so tightly connected.

> [!warning] Common pitfalls
> - Assuming a half adder and full adder are interchangeable. Only the full adder accepts carry-in and is usable in multi-bit chains.
> - Thinking the carry bit is only a software concept. It is a real hardware arithmetic signal.

> [!tip] Exam tip
> Be ready to answer (Mock Paper 2 Q5): *what is a half adder, and what extra input makes a full adder different?* A half adder adds two bits; the full adder **also accepts a carry-in**. Also: *why can a half adder not implement multi-bit addition?* (no carry propagation), and *how is subtraction related to addition?* (two's-complement addition). This material connects forward to [[Fixed-Width Data, Signedness, and Overflow]] and [[APSR Flags and Arithmetic Meaning]].

---

## CPU Registers, ALU, and Control

This section sits at the boundary between architecture and the instruction set. It decomposes the CPU into the three pieces you need to reason about assembly: where values live, what transforms them, and what coordinates the sequence.

> [!info] Core definitions
> - **ALU (Arithmetic Logic Unit)** — the part of the processor that performs arithmetic and logical operations.
> - **Register** — a small, fast storage location inside the processor used to hold values during execution.
> - **Control unit** — the part of the CPU that interprets instructions and issues the signals to carry them out.

Registers are where values live while instructions are actively using them. The ALU performs the transformations: arithmetic, logical operations, comparisons, shifts, and related value transformations. The control unit ensures the right operation happens at the right time by translating the instruction encoding into control signals.

A good execution model: **fetch data into registers, choose an ALU operation, perform the operation, then either keep the result in registers or write it back to memory.** The control logic coordinates that sequence and selects which registers, buses, and functional units participate.

### The three datapath state elements (Lecture 2)

The slides decompose the datapath into reusable hardware building blocks:

| Element | Inputs / outputs | Role |
| --- | --- | --- |
| **Instruction memory** | address in → instruction out | Stores program instructions; supplies an instruction given an address |
| **Memory unit (data memory)** | address, write data, `MemWrite`/`MemRead` controls → read data out | A **state element**; only one of read/write asserted per clock |
| **Register file** | 2 read-register ports, 1 write-register port, write data, `RegWrite` → 2 read-data outputs | Holds all the CPU registers; **two read ports and one write port** |
| **Adder** | two operands → sum | Combinational; e.g. used to compute `PC + 4` for the next instruction address |

The register-number ports are 5 bits wide in the textbook figure (enough to select 1 of 32 registers).

### CPU registers — the ARM Cortex-M view

> [!info] Cortex-M register facts (Lecture 3)
> - Registers are the **fastest way to read and write**; they sit **within the processor chip**.
> - Each register stores a **32-bit value**.
> - ARM Cortex-M has **R0–R12: 13 general-purpose registers**, plus **R13 = Stack Pointer (SP, a shadow of MSP or PSP)**, **R14 = Link Register (LR)**, **R15 = Program Counter (PC)**: 16 in total.
> - **Special registers:** `xPSR`, `BASEPRI`, `PRIMASK`, `FAULTMASK`, `CONTROL`.

> [!info] External source — design principle: "smaller is faster"
> The slides ask *why only 16 general-purpose registers?* and answer with the textbook design principle **"smaller is faster"**: a very large register file can **lengthen the clock cycle**, because electronic signals take longer when they must travel farther. The guideline is not absolute (15 registers is not necessarily faster than 16), but designers must **balance programs' craving for more registers against keeping the clock cycle fast**. Source: lecture slides, citing the Patterson & Hennessy historical register-count table (EDSAC 1949 had 1 register; ARMv8 in 2013 has 16).

A tiny sequence captures the whole architecture story: registers hold active values, the ALU changes them, and memory stores longer-lived state.

```asm
LDR  r0, [r1]     ; bring value into register
ADDS r0, r0, #1   ; ALU transforms it
STR  r0, [r1]     ; store updated value back
```

`LDR {Rd}, [{Rn}]` loads into register `Rd` the value at the memory address held in `Rn`. `ADDS {Rd}, {Rn}, {operand}` adds and updates flags. `STR {Rd}, [{Rn}]` stores the value of `Rd` to the address in `Rn`.

<figure class="diag-figure">
  <figcaption>CPU datapath — control orchestrates registers and the ALU; memory holds longer-lived state</figcaption>
  <svg viewBox="0 0 760 280" class="diag-svg" role="img" aria-label="CPU registers, ALU, and control">
    <defs>
      <marker id="arr-cpu" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-cpu-a" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>
    <rect x="280" y="12" width="200" height="44" class="d-node-ink"/>
    <text x="380" y="39" text-anchor="middle" class="d-h-inv">Control unit</text>

    <rect x="60" y="120" width="200" height="56" class="d-node"/>
    <text x="160" y="144" text-anchor="middle" class="d-h-sm">Register file</text>
    <text x="160" y="163" text-anchor="middle" class="d-sub">fast, CPU-visible storage</text>

    <rect x="500" y="120" width="200" height="56" class="d-node-acc"/>
    <text x="600" y="144" text-anchor="middle" class="d-h-sm">ALU</text>
    <text x="600" y="163" text-anchor="middle" class="d-sub">arithmetic · logic · shifts</text>

    <rect x="280" y="220" width="200" height="48" class="d-node"/>
    <text x="380" y="249" text-anchor="middle" class="d-h-sm">Memory</text>

    <!-- control signals -->
    <path d="M 320 56 L 200 118" class="d-edge-acc dashed" marker-end="url(#arr-cpu-a)"/>
    <path d="M 440 56 L 560 118" class="d-edge-acc dashed" marker-end="url(#arr-cpu-a)"/>
    <text x="200" y="92" text-anchor="middle" class="d-label-accent">signals</text>

    <!-- datapath -->
    <path d="M 260 140 L 498 140" class="d-edge" marker-end="url(#arr-cpu)"/>
    <text x="380" y="132" text-anchor="middle" class="d-sub">operands</text>
    <path d="M 540 176 C 480 220, 360 200, 300 176" class="d-edge" marker-end="url(#arr-cpu)"/>
    <text x="430" y="212" text-anchor="middle" class="d-sub">write-back to registers</text>
    <path d="M 280 244 L 160 178" class="d-edge" marker-end="url(#arr-cpu)"/>
    <text x="195" y="218" text-anchor="middle" class="d-sub">load / store</text>
  </svg>
</figure>

> [!warning] Common pitfalls
> - Treating the ALU as a place to **store** values for long periods. Data storage for future use is not the ALU's job.
> - Ignoring the difference between the **control unit** (coordinates execution) and the **datapath** (moves and transforms values).

> [!tip] Exam tip
> Mock Paper 1 Q6 / Paper 2 Q1 & Q3 test this directly. *Main job of the ALU* → **arithmetic, logic, comparisons, shifts, and related value transformations**; eliminate persistent or structural **storage** roles first. *Datapath vs control* → datapath moves/transforms values, control issues signals that steer execution. *Why are registers faster than ordinary memory?* → they are **inside the CPU and much closer to the ALU**, and they are the smallest CPU-visible storage. See [[ARM Cortex-M33 Register File and Special Registers]].

---

## Computer Organization: CPU, Memory, and I/O

Computer organization is the **block-level** explanation of how a programmable machine does work: how instructions, data, arithmetic units, control logic, and peripherals fit into one executable system. Assembly only makes sense once this structural picture is clear.

> [!info] Core definitions
> - **Computer organization** — the practical arrangement of CPU/datapath, control, memory, input, and output components.
> - **Datapath** — the hardware that moves and transforms data values, including registers and the ALU.
> - **Control unit** — the hardware that generates signals to orchestrate datapath, memory, and I/O behavior.
> - **I/O** — input and output hardware used to communicate with the environment.

The classic model has **five components**: input, output, memory, datapath, and control. It splits the machine into *roles* rather than brands or products:

| Component | Role |
| --- | --- |
| **Input** | Brings data in from sensors, users, or other systems |
| **Output** | Sends data out to actuators, displays, or other systems |
| **Memory** | Stores both instructions and data |
| **Datapath** | Moves and transforms values (registers + ALU) |
| **Control** | Decides which transformation happens next |

The **processor** is commonly described as **datapath plus control**. This is also why the **operating system is the wrong answer** to a hardware-organization question: the OS is software running *on top of* this organization, not one of the physical functional blocks that make instruction execution possible.

### Memory is byte-addressable (Lecture 3)

The slides make memory concrete: **memory is a series of "locations"**, each with a unique **address**, and each location holds **one byte**, so memory is **byte-addressable**. The lecture's example: on a 32-bit machine, addresses are 32 bits wide and data at each address is 8 bits; the byte at address `0x080001B0` might hold `0x70` (decimal 112). The number of locations is **limited**, and the value stored at a location **can represent either data or an instruction**: `0x70` could equally be an opcode telling the processor to add two values. This is the stored-program concept made physical.

<figure class="diag-figure">
  <figcaption>Five-component model — memory feeds the processor; I/O connects to the outside world</figcaption>
  <svg viewBox="0 0 760 280" class="diag-svg" role="img" aria-label="Computer organization five components">
    <defs>
      <marker id="arr-org" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <!-- processor box -->
    <rect x="250" y="40" width="260" height="150" class="d-sub-box"/>
    <text x="380" y="62" text-anchor="middle" class="d-sub">Processor (CPU)</text>

    <rect x="270" y="78" width="100" height="44" class="d-node-acc"/>
    <text x="320" y="105" text-anchor="middle" class="d-h-sm">Datapath</text>
    <rect x="390" y="78" width="100" height="44" class="d-node-ink"/>
    <text x="440" y="105" text-anchor="middle" class="d-h-inv">Control</text>

    <!-- memory -->
    <rect x="290" y="220" width="180" height="44" class="d-node"/>
    <text x="380" y="247" text-anchor="middle" class="d-h-sm">Memory</text>
    <text x="380" y="262" text-anchor="middle" class="d-sub">instructions + data</text>

    <!-- input / output -->
    <rect x="30" y="98" width="150" height="48" class="d-node"/>
    <text x="105" y="127" text-anchor="middle" class="d-h-sm">Input</text>
    <rect x="580" y="98" width="150" height="48" class="d-node"/>
    <text x="655" y="127" text-anchor="middle" class="d-h-sm">Output</text>

    <line x1="180" y1="122" x2="248" y2="122" class="d-edge" marker-end="url(#arr-org)"/>
    <line x1="512" y1="122" x2="578" y2="122" class="d-edge" marker-end="url(#arr-org)"/>
    <line x1="380" y1="218" x2="380" y2="192" class="d-edge" marker-end="url(#arr-org)"/>
    <line x1="380" y1="192" x2="380" y2="218" class="d-edge" marker-end="url(#arr-org)"/>
  </svg>
</figure>

> [!warning] Common pitfalls
> - Naming the **operating system** as a hardware organization block.
> - Using "CPU" as the answer to everything without distinguishing the **ALU, registers, and control**.

> [!tip] Exam tip
> *Which of the following is NOT a primary component of computer organization?* The answer is whatever software layer is listed (operating system, application). Answer organization questions with **hardware categories**, not software layers. See [[Von Neumann vs Harvard Architecture]].

---

## Von Neumann vs Harvard Architecture

This distinction is directly tested in Quiz 1 and Mock Paper 2 Q4, and explains why Cortex-M devices emphasize separate instruction and data paths.

> [!info] Core definitions
> - **Von Neumann architecture** — instructions and data are stored in the **same memory** and typically share the same bus path.
> - **Harvard architecture** — instructions and data are stored in **separate memories** (and use separate buses).
> - **Bus** — a communication pathway carrying addresses, data, or control information between components.

The distinction matters because **instruction fetch and data access compete differently** depending on whether they share a path. The slides' precise framing: in a Von Neumann model an **instruction fetch and a data operation cannot occur at the same time, since they share a common bus**. In a Harvard-style model the instruction-fetch path and data-access path are separated, so the two activities proceed with less structural conflict, which is one reason embedded cores often present that model.

| Aspect | Von Neumann | Harvard |
| --- | --- | --- |
| Instruction & data memory | Shared (same memory) | Separate memories |
| Bus path | One shared bus | Separate instruction bus + data bus |
| Fetch vs data access | Cannot occur simultaneously (bus contention) | Proceed with less structural conflict |

### ARM Cortex-M family: which cores are which (Lecture 3)

The lecture splits the Cortex-M series explicitly by architecture:

| Architecture | Cortex-M cores | ARM architecture version |
| --- | --- | --- |
| **Von Neumann** | Cortex-M0, M0+, M1, M23 | ARMv6-M (M0/M0+/M1), ARMv8-M (M23) |
| **Harvard** | Cortex-M3, M4, M7, M33 | ARMv7-M (M3), ARMv7E-M (M4/M7), ARMv8-M (M33) |

The course's board uses a **Cortex-M33** (STM32U585): the `stm32u585ai` datasheet shows it has **separate buses and cache for data and instructions**, a `C-BUS` and `S-BUS`, with separate `DCACHE` and `ICACHE`. So the course board is a concrete **Harvard** example.

<figure class="diag-figure">
  <figcaption>Shared bus (Von Neumann) versus separate instruction and data paths (Harvard)</figcaption>
  <svg viewBox="0 0 760 240" class="diag-svg" role="img" aria-label="Von Neumann versus Harvard architecture">
    <defs>
      <marker id="arr-vn" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <!-- Von Neumann -->
    <text x="170" y="24" text-anchor="middle" class="d-sub">Von Neumann (M0/M0+/M1/M23)</text>
    <rect x="100" y="40" width="140" height="44" class="d-node"/>
    <text x="170" y="67" text-anchor="middle" class="d-h-sm">CPU</text>
    <rect x="100" y="150" width="140" height="50" class="d-node"/>
    <text x="170" y="172" text-anchor="middle" class="d-h-sm">Memory</text>
    <text x="170" y="190" text-anchor="middle" class="d-sub">instr + data</text>
    <line x1="170" y1="84" x2="170" y2="148" class="d-edge" marker-end="url(#arr-vn)"/>
    <line x1="170" y1="148" x2="170" y2="84" class="d-edge" marker-end="url(#arr-vn)"/>
    <text x="240" y="120" class="d-sub">one shared bus</text>

    <!-- Harvard -->
    <text x="560" y="24" text-anchor="middle" class="d-sub">Harvard (M3/M4/M7/M33)</text>
    <rect x="490" y="40" width="140" height="44" class="d-node"/>
    <text x="560" y="67" text-anchor="middle" class="d-h-sm">CPU</text>
    <rect x="400" y="150" width="140" height="50" class="d-node"/>
    <text x="470" y="178" text-anchor="middle" class="d-h-sm">Instr. memory</text>
    <rect x="580" y="150" width="140" height="50" class="d-node-acc"/>
    <text x="650" y="178" text-anchor="middle" class="d-h-sm">Data memory</text>
    <line x1="510" y1="84" x2="470" y2="148" class="d-edge" marker-end="url(#arr-vn)"/>
    <line x1="610" y1="84" x2="650" y2="148" class="d-edge" marker-end="url(#arr-vn)"/>
    <text x="430" y="120" class="d-sub">instr. bus</text>
    <text x="660" y="120" class="d-sub">data bus</text>
  </svg>
</figure>

> [!warning] Common pitfalls
> - **Reversing the definitions.** Von Neumann is the *shared* model, Harvard is the *separated* one.
> - Confusing the architecture distinction with the ability to **execute multiple instructions at once** (a separate concept, pipelining).

> [!tip] Exam tip
> Mock Paper 2 Q4: *state one difference between Von Neumann and Harvard.* Answer with **shared versus separated instruction/data memory or buses**, nothing more. Do not invent claims such as "Harvard is only for embedded." Connects to [[Memory Hierarchy, Cache, and the Power Wall]].

---

## Memory Hierarchy, Cache, and the Power Wall

Real systems use **multiple layers of memory** because no single storage technology gives maximum capacity, minimum latency, and minimum power at once. The slides put the tension sharply: *from the earliest days of computing, programmers wanted unlimited amounts of fast and cost-effective memory; these needs are often contradictory.*

> [!info] Core definitions
> - **Cache** — a small, fast memory close to the CPU that stores frequently used instructions or data.
> - **Memory hierarchy** — a layered organization of storage with different speed, size, and cost characteristics.
> - **Power wall** — the limit on performance growth imposed by heat dissipation and energy consumption constraints.

### The hierarchy

| Layer | Speed | Capacity | Notes |
| --- | --- | --- | --- |
| **Registers** | Fastest | Tiny | Closest to the ALU |
| **Cache** | Fast | Limited | Holds frequently used data/instructions; closer levels use SRAM |
| **Main memory** | Slower | Larger | Holds the running program's state; implemented from DRAM |
| **Persistent storage** | Slowest | Largest | Retains data across power loss; Flash |

The slides give the **three primary memory technologies** and concrete 2020 figures. Note the enormous spread in both speed and cost:

| Memory technology | Typical access time | $ per GiB (2020) |
| --- | --- | --- |
| **SRAM** semiconductor memory | 0.5–2.5 ns | $500–$1000 |
| **DRAM** semiconductor memory | 50–70 ns | $3–$6 |
| **Flash** semiconductor memory | 5,000–50,000 ns | $0.06–$0.12 |

So SRAM is roughly **100× faster** than DRAM but **~100× more expensive per bit**; Flash is roughly **100–1000× slower** than DRAM but **~50× cheaper**. The hierarchy exists so the system gets *most* of SRAM's speed at *most* of Flash's capacity-per-dollar. The slides confirm the standard mapping: **main memory is implemented from DRAM, while levels closer to the processor (caches) use SRAM.**

<figure class="diag-figure">
  <figcaption>Memory hierarchy — speed falls and capacity rises as you move away from the CPU</figcaption>
  <svg viewBox="0 0 620 260" class="diag-svg" role="img" aria-label="Memory hierarchy pyramid">
    <rect x="230" y="20" width="160" height="40" class="d-node-acc"/>
    <text x="310" y="38" text-anchor="middle" class="d-h-sm">Registers</text>
    <text x="310" y="53" text-anchor="middle" class="d-sub">fastest · tiny</text>

    <rect x="190" y="70" width="240" height="44" class="d-node"/>
    <text x="310" y="90" text-anchor="middle" class="d-h-sm">Cache (SRAM)</text>
    <text x="310" y="105" text-anchor="middle" class="d-sub">~0.5–2.5 ns · limited</text>

    <rect x="140" y="124" width="340" height="48" class="d-node"/>
    <text x="310" y="146" text-anchor="middle" class="d-h-sm">Main memory (DRAM)</text>
    <text x="310" y="161" text-anchor="middle" class="d-sub">~50–70 ns · larger</text>

    <rect x="80" y="182" width="460" height="52" class="d-node"/>
    <text x="310" y="206" text-anchor="middle" class="d-h-sm">Persistent storage (Flash)</text>
    <text x="310" y="221" text-anchor="middle" class="d-sub">~5,000–50,000 ns · largest · survives power loss</text>

    <text x="560" y="44" text-anchor="middle" class="d-sub">speed</text>
    <line x1="560" y1="60" x2="560" y2="200" class="d-edge"/>
    <text x="560" y="218" text-anchor="middle" class="d-sub">capacity</text>
  </svg>
</figure>

### Memory access methods (Lecture 3)

The slides classify how a location is reached:

| Access method | How a location is reached | Access time |
| --- | --- | --- |
| **Sequential** | Memory is units called *records*; access follows a fixed linear sequence | Variable |
| **Direct** | Shared read-write mechanism; blocks/records have an address based on physical location | Variable |
| **Random** | Each location has a unique, physically wired-in addressing mechanism; any location selectable directly | **Constant**, independent of prior accesses |
| **Associative** | A word is retrieved by a portion of its **contents**, not its address; each location has its own matching logic | **Constant** — caches may use associative access |

Main memory and many caches are **random access**; caches in particular may also use **associative access** to match by tag.

### Memory types — RAM, ROM, and the read-mostly family (Lecture 3)

| Memory type | Category | Erasure | Write mechanism | Volatility |
| --- | --- | --- | --- | --- |
| **RAM** | Read-write | Electrically, byte-level | Electrically | **Volatile** |
| **ROM** | Read-only | Not possible | Masks (at manufacture) | Nonvolatile |
| **PROM** | Read-only | Not possible | Electrically (once) | Nonvolatile |
| **EPROM** | Read-mostly | UV light, chip-level | Electrically | Nonvolatile |
| **EEPROM** | Read-mostly | Electrically, byte-level | Electrically | Nonvolatile |
| **Flash** | Read-mostly | Electrically, **block-level** | Electrically | Nonvolatile |

The key contrast: **RAM is volatile** (loses contents at power-off) but the whole ROM/Flash family is **nonvolatile**. Flash sits in the "read-mostly" category, erasable electrically but only a **block at a time**, which is why it is used for program storage rather than as fast read-write working memory.

### SRAM, DRAM, and Flash — the Hardware Mechanism

> [!tip] Highest-priority resit topic
> The March 2026 exam asked for the **cell-level technical mechanism** of each memory technology, not just the speed order. You must be able to describe and ideally sketch all three cells.

The three technologies differ in *how a single bit is physically held*:

| Technology | Cell hardware | How a bit is stored | Volatility & quirks |
| --- | --- | --- | --- |
| **SRAM** (Static RAM) | A bistable latch: **cross-coupled inverters** (a flip-flop), typically **6 transistors per bit** | The latch *holds* one of two stable states as long as power is applied; no refresh needed | **Volatile**; fast (0.5–2.5 ns); large cell, so low density and expensive. Used for **cache**. |
| **DRAM** (Dynamic RAM) | **One transistor + one capacitor per bit** | The bit is the **presence or absence of charge on the capacitor** | **Volatile**; charge **leaks away**, so the cell must be **refreshed every few ms**, hence *dynamic*. Reading is **destructive**, so data must be rewritten after each read. Tiny cell, so high density and cheap. Used for **main memory**. |
| **Flash** | A **floating-gate transistor** | A bit is held as **trapped charge on an electrically isolated floating gate**, which shifts the transistor's threshold voltage | **Nonvolatile**: charge stays with power off. Erased **block-at-a-time**, limited write/erase endurance. Used for **program / persistent storage**. |

**DRAM in detail (from the lecture slide).** A DRAM cell has a **bitline** and a **wordline**. The single transistor behaves as a **switch that connects or disconnects the capacitor from the bitline**. When the **wordline is asserted**, the transistor turns **ON** and the stored bit value transfers to or from the bitline. Because DRAM uses **only one transistor per bit of storage**, it is much **denser and cheaper per bit than SRAM**. Two consequences the slide underlines:

1. **Reading destroys the stored charge** on the capacitor, so the word must be **rewritten after each read**.
2. Even when *not* read, contents must be **refreshed every few milliseconds** because the capacitor charge **gradually leaks away**. This is precisely the contrast with the *static* storage of SRAM, whose cross-coupled-inverter latch holds its value indefinitely while powered.

> [!info] Why the mechanism explains the trade-offs
> - **SRAM is fast but big/expensive** because a 6-transistor latch is a large cell and never needs refresh; it just sits in one of two stable states.
> - **DRAM is cheap and dense but slower and volatile** because a 1T1C cell is tiny, but the leaky capacitor forces refresh logic and destructive-read rewrite.
> - **Flash is nonvolatile** because the floating gate is electrically isolated: charge cannot leak off, so data survives power loss. The price is slow, block-granular, endurance-limited writes.

<figure class="diag-figure">
  <figcaption>Bit-cell mechanisms — SRAM cross-coupled-inverter latch, DRAM 1T1C cell, Flash floating-gate transistor</figcaption>
  <svg viewBox="0 0 760 260" class="diag-svg" role="img" aria-label="SRAM DRAM and Flash cell structures">
    <defs>
      <marker id="arr-mem" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <!-- SRAM -->
    <text x="125" y="28" text-anchor="middle" class="d-h-sm">SRAM cell</text>
    <rect x="40" y="44" width="80" height="40" class="d-node-acc"/>
    <text x="80" y="69" text-anchor="middle" class="d-sub">inverter</text>
    <rect x="130" y="120" width="80" height="40" class="d-node-acc"/>
    <text x="170" y="145" text-anchor="middle" class="d-sub">inverter</text>
    <path d="M 120 64 L 170 64 L 170 118" class="d-edge" marker-end="url(#arr-mem)"/>
    <path d="M 130 140 L 80 140 L 80 86" class="d-edge" marker-end="url(#arr-mem)"/>
    <text x="125" y="190" text-anchor="middle" class="d-sub">cross-coupled latch</text>
    <text x="125" y="208" text-anchor="middle" class="d-sub">~6 transistors · holds state</text>
    <text x="125" y="226" text-anchor="middle" class="d-sub">volatile · no refresh</text>

    <!-- DRAM -->
    <text x="380" y="28" text-anchor="middle" class="d-h-sm">DRAM cell</text>
    <line x1="300" y1="60" x2="460" y2="60" class="d-edge"/>
    <text x="475" y="64" class="d-sub">bitline</text>
    <rect x="356" y="78" width="48" height="34" class="d-node"/>
    <text x="380" y="100" text-anchor="middle" class="d-sub">T</text>
    <line x1="300" y1="95" x2="356" y2="95" class="d-edge"/>
    <text x="270" y="99" class="d-sub">wordline</text>
    <line x1="380" y1="60" x2="380" y2="78" class="d-edge"/>
    <line x1="380" y1="112" x2="380" y2="135" class="d-edge"/>
    <line x1="362" y1="135" x2="398" y2="135" class="d-edge"/>
    <line x1="368" y1="145" x2="392" y2="145" class="d-edge"/>
    <text x="430" y="140" class="d-sub">capacitor</text>
    <text x="380" y="180" text-anchor="middle" class="d-sub">1 transistor + 1 capacitor</text>
    <text x="380" y="198" text-anchor="middle" class="d-sub">charge = stored bit</text>
    <text x="380" y="216" text-anchor="middle" class="d-sub">volatile · leaks · needs refresh</text>
    <text x="380" y="234" text-anchor="middle" class="d-sub">destructive read</text>

    <!-- Flash -->
    <text x="635" y="28" text-anchor="middle" class="d-h-sm">Flash cell</text>
    <rect x="580" y="80" width="110" height="26" class="d-node-ink"/>
    <text x="635" y="98" text-anchor="middle" class="d-h-inv">control gate</text>
    <rect x="592" y="112" width="86" height="22" class="d-node-acc"/>
    <text x="635" y="128" text-anchor="middle" class="d-sub">floating gate</text>
    <rect x="580" y="140" width="110" height="26" class="d-node"/>
    <text x="635" y="158" text-anchor="middle" class="d-sub">channel</text>
    <text x="635" y="190" text-anchor="middle" class="d-sub">trapped charge on</text>
    <text x="635" y="206" text-anchor="middle" class="d-sub">isolated floating gate</text>
    <text x="635" y="224" text-anchor="middle" class="d-sub">nonvolatile · block erase</text>
  </svg>
</figure>

### Why cache works — locality

Cache is useful because **program behavior is not random**. Instructions in loops are reused, nearby data are often touched together, and the same variables are read repeatedly over short periods. This **locality** means a small fast memory delivers a large *average-speed* benefit even though it cannot hold everything.


```c
for (int i = 0; i < 1000; i++) {
    sum += a[i];
}
```

Sequential access reuses nearby memory locations and benefits from locality far more than random scattered access. The correct explanation of cache is therefore about **closeness and reuse**, not permanence or backup. Real CPUs layer it: the slides' **Pentium 4** has an L1 instruction cache (12K µops), L1 data cache (16 KB), L2 (512 KB), L3 (1 MB); the **Core i7** has per-core L1 d-cache and L1 i-cache, a per-core L2 unified cache, and one **L3 unified cache shared by all cores**, sitting above main memory.

### The power wall

The **power wall** explains why performance scaling cannot rely forever on simply pushing clock frequency or transistor activity upward. More switching means more power consumption and more heat:

$$\text{performance} \uparrow \;\Rightarrow\; \text{switching} \uparrow \;\Rightarrow\; \text{power} \uparrow \;\Rightarrow\; \text{heat} \uparrow$$

In embedded systems this matters especially because **thermal headroom, battery life, and supply limits** are often far stricter than on desktops. Performance must be understood *together with* energy cost. A design can be functionally correct and even fast yet still be a poor embedded solution if it exceeds power or thermal limits; this is how the course connects architecture to resource-aware design.

> [!warning] Common pitfalls
> - Treating cache as **permanent storage**. It does not retain large amounts of data the way disks or Flash do.
> - Describing the power wall as merely the maximum electricity a computer can draw. It is about **thermal and energy limits on performance scaling**.
> - Saying DRAM is non-volatile or never needs refresh. It is **volatile** and **must be refreshed**. Saying SRAM uses a capacitor: that is DRAM; SRAM uses a **latch**.

> [!tip] Exam tip
> Mock Paper 2 Q10, *what is cache for?* Answer with **reduced average access time by holding frequently used data/instructions close to the CPU** (speed and locality), not backup or permanence. If asked the *power wall*, connect it to **energy and heat constraints on performance scaling**. For the SRAM/DRAM/Flash question, lead with the **cell**: SRAM = cross-coupled-inverter latch; DRAM = transistor + capacitor (needs refresh, destructive read); Flash = floating-gate transistor (nonvolatile).

---

## Program Counter and the Instruction Cycle

The **program counter** is the register that tracks where execution is headed next. It is central to the **fetch-decode-execute cycle**, the smallest repeating story of computation in this course.

> [!info] Core definitions
> - **Program counter (PC)** — a register holding the **address** of the next instruction to execute. The slides quote the textbook glossary verbatim: *"the register containing the address of the instruction in the program being executed."* A more descriptive name would be **instruction address register**.
> - **Control flow** — the sequence of instructions a CPU reads and executes. From startup to shutdown, *a CPU simply reads and executes (interprets) a sequence of instructions, one at a time*; that sequence is the **physical control flow**.
> - **Fetch** — the step where the CPU retrieves the next instruction from memory.
> - **Decode** — the step where the CPU interprets the instruction and determines the required control actions.
> - **Execute** — the step where the CPU performs the operation specified by the instruction.

### The instruction cycle

The lecture names the three stages precisely:

- **Instruction Fetch (IF):** retrieve the next instruction from memory, typically from the address in the **PC**, which keeps track of the instruction sequence.
- **Instruction Decode (ID):** interpret the fetched instruction, determining what needs to be done. The instruction is broken into an **opcode** (operation code) and **operands** (data or memory locations).
- **Execution (EX):** the **ALU** performs the mathematical or logic operation indicated by the decoded instruction; if the instruction involves memory access, the processor determines the address.

In simple sequential code the next address is just the following instruction; in branches, calls, returns, or exceptions it is a different target.

<figure class="diag-figure">
  <figcaption>Fetch-decode-execute cycle — the PC selects the next instruction, then the cycle repeats</figcaption>
  <svg viewBox="0 0 760 200" class="diag-svg" role="img" aria-label="Fetch decode execute cycle">
    <defs>
      <marker id="arr-fde" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="40" y="76" width="150" height="48" class="d-node-acc"/>
    <text x="115" y="98" text-anchor="middle" class="d-h-sm">PC</text>
    <text x="115" y="114" text-anchor="middle" class="d-sub">address of next instr.</text>

    <rect x="250" y="76" width="130" height="48" class="d-node"/>
    <text x="315" y="104" text-anchor="middle" class="d-h-sm">Fetch</text>

    <rect x="420" y="76" width="130" height="48" class="d-node"/>
    <text x="485" y="104" text-anchor="middle" class="d-h-sm">Decode</text>

    <rect x="590" y="76" width="130" height="48" class="d-node"/>
    <text x="655" y="104" text-anchor="middle" class="d-h-sm">Execute</text>

    <line x1="190" y1="100" x2="248" y2="100" class="d-edge" marker-end="url(#arr-fde)"/>
    <line x1="380" y1="100" x2="418" y2="100" class="d-edge" marker-end="url(#arr-fde)"/>
    <line x1="550" y1="100" x2="588" y2="100" class="d-edge" marker-end="url(#arr-fde)"/>
    <path d="M 655 124 C 655 175, 115 175, 115 126" class="d-edge dashed" marker-end="url(#arr-fde)"/>
    <text x="385" y="168" text-anchor="middle" class="d-sub">update PC, repeat</text>
  </svg>
</figure>

### Worked walk-through: tracing a program (Lecture 3)

The lecture traces a tiny machine-code program in memory, showing how the PC drives each step. Memory holds five 16-bit Thumb half-words; the PC starts at `0x080001AC`:

| Address | Machine code | Instruction |
| --- | --- | --- |
| `0x080001AC` | `2100` | `MOVS r1, #0x00` |
| `0x080001AE` | `2201` | `MOVS r2, #0x01` |
| `0x080001B0` | `188B` | `ADDS r3, r1, r2` |
| `0x080001B2` | `2000` | `MOVS r0, #0x00` |
| `0x080001B4` | `4770` | `BX lr` |

The trace, step by step:

1. **Fetch** `pc = 0x080001AC`; **decode** `2100` → `MOVS r1, #0x00`; **execute** → `r1 = 0x00000000`.
2. **`pc = pc + 2`** → `0x080001AE`; decode & execute `2201` → `MOVS r2, #0x01` → `r2 = 0x00000001`.
3. **`pc = pc + 2`** → `0x080001B0`; decode & execute `188B` → `ADDS r3, r1, r2` → ALU adds `r1 + r2`, `r3 = 0x00000001`.
4. **`pc = pc + 2`** → `0x080001B2`; decode & execute `2000` → `MOVS r0, #0x00` → `r0 = 0x00000000`.
5. **`pc = pc + 2`** → `0x080001B4`; decode `4770` → `BX lr` (return).

> [!info] Why `pc = pc + 2` here (Thumb-2 detail)
> Thumb-2 mixes **16- and 32-bit instructions**. In reality the CPU **always fetches 4 bytes** from instruction memory (either one 32-bit instruction or two 16-bit ones). The lecture simplifies its demo to "fetch 2 bytes" because every instruction in the example is a 16-bit Thumb instruction, so the PC advances by 2. The classic MIPS-style example in the slides instead increments **`PC` by 4** for 32-bit instructions. The principle is the same: after a fetch the PC advances by the instruction width.

The lecture also shows where code and data live on the board: in the array-sum example, **instruction memory (Flash) starts at `0x08000000`** and **data memory (RAM) starts at `0x20000000`**, a concrete Harvard split. Global variables and arrays are placed in SRAM; `main()` and its loop body are placed in Flash.

### Why the decode stage matters

The **decode stage** is easy to undersell, but it is where instruction syntax becomes internal control behavior. The binary pattern in memory is not useful by itself; decode splits it into an **opcode and operands**, then turns it into control signals: "read these registers," "perform this ALU operation," "write back this result," "update the PC to that target." Decode is **neither fetching nor execution**; it is the interpretation step in between.

### The PC and control flow

Branching, calling functions, returning, and taking interrupts all work by **changing the normal rule for how the PC advances**:

- A **loop** is just repeated PC redirection.
- A **function call** is PC redirection plus return-address bookkeeping.
- An **interrupt** is PC redirection caused by hardware rather than an ordinary branch instruction.

The PC is also the bridge to debugging: in a disassembly window, the current PC tells you where the machine is in the control-flow graph.

```asm
    MOVS r0, #0
loop:
    ADDS r0, r0, #1
    CMP  r0, #3
    BLT  loop
```

`BLT {label}` branches to `label` when the "less than" condition holds. In straight-line execution the PC advances to the next instruction; at `BLT loop` the PC is **redirected** back to the label when the branch condition is true.

> [!warning] Common pitfalls
> - Confusing the PC with a **general-purpose data register**. It holds an instruction *address*, not arbitrary data.
> - Saying decode *fetches* the next instruction instead of *interpreting* the current one.

> [!tip] Exam tip
> Mock Paper 1 Q3, *what does the PC hold?* **The address of the next instruction to execute**. Mock Paper 2 Q2, *role of the decode stage*: **interprets the fetched instruction and generates the internal control actions**; focus on interpretation and control, not fetching or storing results. This material is the foundation for [[Comparison, Condition Codes, and Branching]] and [[Functions, BL-BX, LR, Stack, and Calling Convention]].

---

## Pipelining

Once fetch-decode-execute is clear, the lecture introduces **pipelining**, an implementation technique that overlaps multiple instructions in execution. It is *nearly universal* in modern processors.

> [!info] The laundry analogy
> The non-pipelined approach to laundry: wash one load, *wait*, dry it, *wait*, fold it, *wait*, put it away, and only then start the next load. The **pipelined** approach starts washing load B as soon as load A moves to the dryer. The pipelined version finishes all loads in **much less time** because the four stages run concurrently on different loads.

ARM instructions classically take **five steps**:

1. **Fetch** the instruction from memory.
2. **Read registers and decode** the instruction.
3. **Execute** the operation or calculate an address.
4. **Access** an operand in data memory (if necessary).
5. **Write** the result into a register (if necessary).

A pipeline lets stage 1 of instruction *n+1* run while stage 2 of instruction *n* runs, and so on. In the slides' timing example, a non-pipelined design takes **800 ps per instruction**; the pipelined design issues a new instruction every **200 ps** once the pipeline is full. The per-instruction *latency* is unchanged, but *throughput* rises sharply.

> [!warning] Common pitfall
> Pipelining is **not** the Von Neumann vs Harvard distinction, and it does not mean each instruction finishes faster. It improves **throughput** (instructions completed per unit time), not single-instruction latency.

---

## Past exam coverage

The mock pack has four papers; architecture material is concentrated in Papers 1 and 2, with system-integration framing in Paper 4.

- **Mock Paper 1 Q2 — "Program code on the Discovery board is typically stored in?" (MC).** Expected: **Flash / ROM-like non-volatile memory** — not RAM, not cache, not the ALU. Tests the memory-types and Harvard code/data split.
- **Mock Paper 1 Q3 — "What does the Program Counter (PC) hold?"** Expected: **the address of the next instruction to execute.**
- **Mock Paper 1 Q4 — "Name the two main parts of the processor in the datapath-plus-control view."** Expected: **datapath and control.**
- **Mock Paper 1 Q6 — "What is the main job of the ALU?"** Expected: **arithmetic, logic, comparisons, shifts, and related value transformations** — not storage.
- **Mock Paper 2 Q1 — "Difference between datapath and control?"** Expected: **datapath moves/transforms values; control issues the signals that steer execution.**
- **Mock Paper 2 Q2 — "Role of the decode stage in fetch-decode-execute?"** Expected: **decode interprets the fetched instruction and generates the internal control actions.**
- **Mock Paper 2 Q3 — "Why are registers faster than ordinary memory access?"** Expected: **registers are inside the CPU and much closer to the ALU.**
- **Mock Paper 2 Q4 — "State one difference between Von Neumann and Harvard architecture."** Expected: **Von Neumann shares instruction and data memory; Harvard separates them.**
- **Mock Paper 2 Q5 — "What is a half adder, and what extra input makes a full adder different?"** Expected: **a half adder adds two bits; a full adder also accepts a carry-in.**
- **Mock Paper 2 Q10 — "What is cache for?"** Expected: **it reduces average access time by holding frequently used data/instructions close to the CPU.**
- **Mock Paper 4 Exercise 2(a) — smart-sensor-node design.** Expected: **program code lives in Flash; runtime variables / stack / buffers live in RAM** — the practical pay-off of the Harvard code/data split and the memory hierarchy.
- **General framing.** Any question asking *why* one memory layer is used where it is, or to identify which listed item is *not* a hardware component, is testing the organization model and the SRAM/DRAM/Flash trade-offs covered above.
