# 04 ARM ISA and Assembly

**Lecture slides:** `Materials/Lecture 6 - ARM ISA - Operations.pdf`, `Materials/Lecture 7 - ARM ISA - Execution flow.pdf`, `Materials/Lecture 8 - ARM ISA - Execution flow 2 (1).pdf`
**Tutorial coverage:** `Materials/Tutorial 2 - Arithmetic logic and loops.pdf`, `Materials/Tutorial 4 - Awesome assembly pt2.pdf`
**Past exam coverage:** Mock Paper 1 Ex 1 (`sum_to_n` loop), Mock Paper 1 Ex 3 (GPIO set/clear bit), Mock Paper 2 Ex 1 (BL/LR tracing), Mock Paper 2 Ex 2 (flags / signedness / odd test), Mock Paper 3 Ex 2 (`max3u` unsigned), Mock Paper 4 Ex 2 (polling status register)

ARM Cortex-M33 registers, instruction formats, flags, branches, stack, procedures, and assembly integration with C. This is the largest chapter of the course and the one most directly tested by the practical exam, where you hand-write ARM assembly on paper. The chapter builds bottom-up: the register file (the processor's live working set), the syntax layer (Thumb instruction format), the instruction families (data movement, arithmetic/logic/shift, compare/branch, advanced flag-setting), program structure (loops and selection), procedures (calling convention and stack), and finally the embedded-specific layers: memory-mapped I/O and integrating assembly with C in STM32 projects.

> [!tip] How to study this chapter
> The practical exam is entirely hand-written ARM assembly: **60% of the grade**, three exercises of increasing difficulty (bit-check ~10 pts, max-of-3 ~20 pts, Fibonacci ~30 pts). Memorise the register roles (`r0-r3` for arguments/return), the signed-vs-unsigned branch split, the `BL`/`BX LR` call-return pattern, and the counted-loop skeleton. Each instruction below leads with its signature; learn the signature first, then what it does and which flags it touches. The single highest-value section is **[[#Exam practical patterns]]**: three fully worked, hand-writable solutions to the exercise archetypes.

---

## The ARM Cortex-M33 Register File

Treat the register file as the processor's **live working set**. Values must usually be in a register before the ALU can operate on them, which is why low-level code constantly moves data between memory and registers. As the slides put it, registers are *"the fastest place to hold data in a computer, so we want to use them as much as possible"*: they sit inside the processor chip, right next to the ALU.

The register file splits into two functional groups: **general-purpose registers** hold whatever values are currently being worked on, and **special registers** (`SP`, `LR`, `PC`) shape control flow and stack behaviour. The special registers organise stack state, return flow, and next-instruction flow respectively, which is why they dominate debugger views and calling-convention explanations.

The Cortex-M33 has a **register bank** of $r0$–$r15$, all **32 bits wide**. Of these, $r0$–$r12$ are 13 general-purpose registers; $r13$–$r15$ are the three special registers. Separately, a small block of **special-purpose registers** (`xPSR`, `BASEPRI`, `PRIMASK`, `FAULTMASK`, `CONTROL`) is not addressed by number; these control status, interrupt masking, and execution mode.

### Register File Layout

| Register | Alias | Role |
| --- | --- | --- |
| $r0$–$r7$ | **Low registers** | General-purpose; can be accessed by **any** instruction (including all 16-bit Thumb forms) |
| $r8$–$r12$ | **High registers** | General-purpose; can only be accessed by **some** instructions |
| $r0$–$r3$ | — | General-purpose, but **conventionally carry the first 4 function arguments and the return value** |
| $r12$ | `IP` | Intra-procedure-call scratch register; holds intermediate values between a procedure and a sub-procedure |
| $r13$ | `SP` | **Stack Pointer**, points to the current top of stack. Cortex-M33 shadows two stacks: `MSP` (Main SP, privileged/exception) and `PSP` (Process SP, application) |
| $r14$ | `LR` | **Link Register**, holds the return address after a `BL`; the processor copies `LR` to `PC` to return |
| $r15$ | `PC` | **Program Counter**, holds the memory address of the current/next instruction |
| — | `xPSR` | Combined status register: `APSR` (flags), `IPSR` (ISR number), `EPSR` (Thumb/IT state) views |

> [!info] Must know
> `SP` = $r13$, `LR` = $r14$, `PC` = $r15$. `r0`–`r3` carry the first four arguments and the return value under the usual calling convention. `PC` and `LR` are "special" because they *control* or *remember* execution flow: `PC` points at the next instruction, `LR` remembers where to return. Low registers ($r0$–$r7$) are accessible by any instruction; high registers ($r8$–$r12$) only by some.

<figure class="diag-figure">
  <figcaption>Cortex-M33 register file — low/high general-purpose block, calling-convention sub-block, and the three special registers</figcaption>
  <svg viewBox="0 0 760 320" class="diag-svg" role="img" aria-label="ARM Cortex-M33 register file layout">
    <!-- calling-convention block -->
    <rect x="20" y="20" width="380" height="44" class="d-node-acc"/>
    <text x="210" y="40" text-anchor="middle" class="d-h-sm">r0 – r3</text>
    <text x="210" y="56" text-anchor="middle" class="d-sub">arguments 1–4 + return value · caller-saved</text>

    <rect x="20" y="74" width="380" height="44" class="d-node"/>
    <text x="210" y="94" text-anchor="middle" class="d-h-sm">r4 – r7 (low) · r8 – r11 (high)</text>
    <text x="210" y="110" text-anchor="middle" class="d-sub">locals · counters · addresses · callee-saved</text>

    <rect x="20" y="124" width="380" height="44" class="d-node"/>
    <text x="210" y="144" text-anchor="middle" class="d-h-sm">r12  IP</text>
    <text x="210" y="160" text-anchor="middle" class="d-sub">intra-procedure-call scratch · caller-saved</text>

    <!-- special registers -->
    <rect x="430" y="20" width="310" height="44" class="d-node-ink"/>
    <text x="455" y="47" class="d-h-inv">r13  SP</text>
    <text x="640" y="47" text-anchor="middle" class="d-sub" fill="#fff">top of stack</text>

    <rect x="430" y="74" width="310" height="44" class="d-node-ink"/>
    <text x="455" y="101" class="d-h-inv">r14  LR</text>
    <text x="640" y="101" text-anchor="middle" class="d-sub" fill="#fff">return address</text>

    <rect x="430" y="128" width="310" height="44" class="d-node-ink"/>
    <text x="455" y="155" class="d-h-inv">r15  PC</text>
    <text x="640" y="155" text-anchor="middle" class="d-sub" fill="#fff">next instruction</text>

    <!-- xPSR / APSR -->
    <rect x="20" y="200" width="720" height="60" class="d-node"/>
    <text x="380" y="224" text-anchor="middle" class="d-h-sm">xPSR / APSR — condition flags</text>
    <text x="380" y="246" text-anchor="middle" class="d-sub">N (negative) · Z (zero) · C (carry) · V (overflow) — set by the last flag-setting instruction</text>
  </svg>
</figure>

> [!warning] Pitfall
> Treating `LR` as just another general temporary register in simple procedure examples. It carries the return address: clobber it and the function cannot return. Also remember `PC` is about *instruction addresses*, not data.

**Reasoning habit.** When reading assembly, first classify each register use: argument, temporary, stack, link, or next-instruction control. A trace becomes much easier once you identify which registers serve calling-convention roles. In debugger register state, the special registers usually explain control flow better than the general-purpose values do.

```arm
; assume r0 = a, r1 = b
ADDS r0, r0, r1   ; return a + b in r0
BX   LR
```

This captures two calling-convention ideas at once: `r0`/`r1` carry early arguments, and `r0` is also the usual return-value register.

> [!info] Why registers are fast (Mock Paper 2 Q3)
> *"Why are registers faster than ordinary memory access?"* Registers are physically **inside the CPU**, much closer to the ALU than ordinary memory; access needs no bus transaction. This is the RISC motivation for keeping operands in registers.

### RISC vs CISC and the Load-Store Model

ARM is a **RISC** architecture (Reduced Instruction Set Computer), in contrast with **CISC** (Complex Instruction Set Computer). They are *"different architectures for doing the same operations"*: the same result, but the complexity of operations and the number of steps differ. The defining RISC property is the **load-store model**: the ALU operates **only on registers**; memory is touched **only** by `LDR`/`STR`.

To multiply two numbers in memory locations `mem0` and `mem1`, storing the result back in `mem0`:

| CISC approach | RISC (ARM) approach |
| --- | --- |
| `mul mem0, mem1` | `ldr r0, mem0` → `ldr r1, mem1` → `mul r0, r0, r1` → `str mem0, r0` |

> [!info] Must know
> RISC = load-store: arithmetic/logic instructions operate on registers only. Memory is reached exclusively via `LDR` (read) and `STR` (write). One CISC memory-operand instruction expands into a load → operate → store sequence in RISC.

---

## ARM/Thumb Instruction Format and Immediates

Assembly syntax is the human-readable surface of encoded machine instructions. The **mnemonic** names the operation, the **operands** identify the participating registers/constants/memory/labels, and the assembler turns that source form into the binary encoding the Cortex-M core executes. Learn instruction format before individual instructions: it teaches you how to read the language the assembler consumes.

### Core Vocabulary

- **mnemonic**: a symbolic instruction name such as `ADD`, `MOV`, or `CMP`. The operation the processor core performs.
- **operand**: a register, immediate value, memory reference, or label used by an instruction.
- **immediate**: a constant encoded directly inside the instruction, written with a `#` prefix (`#10`).
- **label**: a symbolic place marker for the memory address of the current instruction; used by branch instructions to implement `if-then` or `goto`. **Must be unique.**
- **Thumb**: the compact ARM instruction encoding used heavily in Cortex-M processors.

### General Instruction Shape

```
[label]   MNEMONIC{S}   {operand1}, {operand2}, {operand3}   ; comment
```

Parse each line in order: optional label, mnemonic, operands, comment. Normally **operand1 is the destination register**, and operand2/operand3 are source operands. operand2 is usually a register (the first source); operand3 may be a register, an immediate, a register shifted by a constant, or a register-plus-offset (used for memory access).

<figure class="diag-figure">
  <figcaption>Anatomy of an assembly line — assembler resolves labels and immediates into the binary Thumb encoding</figcaption>
  <svg viewBox="0 0 760 200" class="diag-svg" role="img" aria-label="Assembly instruction format">
    <rect x="20"  y="30" width="120" height="44" class="d-node"/>
    <text x="80"  y="50" text-anchor="middle" class="d-h-sm">label</text>
    <text x="80"  y="66" text-anchor="middle" class="d-sub">optional</text>

    <rect x="160" y="30" width="130" height="44" class="d-node-acc"/>
    <text x="225" y="50" text-anchor="middle" class="d-h-sm">mnemonic</text>
    <text x="225" y="66" text-anchor="middle" class="d-sub">ADD / MOV</text>

    <rect x="310" y="30" width="250" height="44" class="d-node"/>
    <text x="435" y="50" text-anchor="middle" class="d-h-sm">operands</text>
    <text x="435" y="66" text-anchor="middle" class="d-sub">dest, src1, src2</text>

    <rect x="580" y="30" width="160" height="44" class="d-node"/>
    <text x="660" y="50" text-anchor="middle" class="d-h-sm">; comment</text>
    <text x="660" y="66" text-anchor="middle" class="d-sub">ignored</text>

    <line x1="380" y1="74" x2="380" y2="110" class="d-edge" marker-end="url(#arr-fmt)"/>
    <defs>
      <marker id="arr-fmt" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <rect x="180" y="114" width="400" height="50" class="d-node-ink"/>
    <text x="380" y="135" text-anchor="middle" class="d-h-inv">assembler</text>
    <text x="380" y="154" text-anchor="middle" class="d-sub" fill="#fff">resolves labels + immediates → binary Thumb encoding</text>
  </svg>
</figure>

The number of operands varies by instruction:

| Operands | Example | Meaning |
| --- | --- | --- |
| None | `DSB` | Data Synchronization Barrier |
| One | `BX LR` | branch-and-exchange to the address in `LR` |
| Two | `CMP R1, R2` | compare `R1` with `R2` |
| Three | `ADD R1, R2, R3` | `R1 = R2 + R3` |
| Four | `MLA R1, R2, R3, R4` | `R1 = R2*R3 + R4` (least-significant 32 bits) |

A *good* comment explains intent, not mechanics: `; r0 = r2 + r3` is a **bad comment** (it just restates the instruction); `; increment angle r2 by step size r3` is a better one.

### Why Thumb Matters Here

ARM processors have **two instruction sets**: the traditional **ARM** set, where every instruction is **32 bits**, and the more condensed **Thumb (T32)** set, where the most common instructions are **16 bits** (and some are 32 bits). Only one set can be active at a time: once the processor is switched to Thumb mode, all instructions are decoded as Thumb.

| Era | Set | Notes |
| --- | --- | --- |
| 1995 (ARM7TDMI) | **Thumb (Thumb-1)** | 16-bit instructions, high code density, low power |
| Later | **Thumb-2 (T32)** | a mix of 16-bit (high code density) and 32-bit (high performance) instructions |
| Cortex-M | subset of Thumb-2 | Cortex-M0/M1 use a small Thumb subset; M3/M4/M33 use larger Thumb-2 subsets |

The two sets *"share similar functionality and can be represented using the same assembly language"*. The same source line `ADDS R0, R1, R2` compiles to a 32-bit ARM encoding (`E0910002`) or a 16-bit Thumb encoding (`1888`): same function, different encoding. Cortex-M33 is an **Armv8-M** core; it uses Thumb/Thumb-2 only.

**Immediates** let small constants be used directly inside instructions without first loading them from memory. **Labels** let humans describe code structure symbolically while leaving address and offset calculation to the assembler; without them, even simple branches and loops would become fragile hand-maintained offset arithmetic.

```arm
MOVS r0, #10     ; constant comes from the instruction itself (immediate)
LDR  r1, [r2]    ; value comes from memory at address in r2
```

> [!warning] Pitfall
> A label is **not** a runtime variable; it is a name the assembler resolves to an address/offset at assembly time. Comments are not part of instruction semantics; do not read them as operands. Branch immediates encode a *word-counted, PC-relative signed offset*: never hand-count them, let the assembler resolve labels.

---

## Data Movement: MOV, LDR, STR

Most embedded instructions do not operate directly on memory operands the way high-level languages appear to. Values are brought into registers, transformed there, and written back when needed, which is why **load → register operation → store** is such a common three-step rhythm in low-level code.

### MOV / MOVS — register/immediate transfer

```
MOV{S} {Rd}, {operand}
```

Moves a value into register `Rd`. The operand is an immediate constant or another register. `MOV` does **not** access memory. The `MOVS` variant also updates the APSR flags (`N`, `Z`). `MOV` is *not* an arithmetic operation, so it never touches `V`.

### MVN — move NOT

```
MVN {Rd}, {operand2}
```

Moves the **bitwise complement** of the operand into `Rd`: `Rd ← 0xFFFFFFFF EOR operand2`. Every bit is logically negated. Useful for building all-ones masks or negating bit patterns.

### LDR — load from memory

```
LDR {Rt}, [{Rn}, #{offset}]
```

`LDR` = **L**oa**D** to **R**egister. Loads a 32-bit word from the memory address in `Rn` (optionally `+ offset`) into register `Rt`: `Rn` specifies the address, `Rt` receives the fetched value. `LDR Rt, =symbol` is the pseudo-form that loads a symbol's *address* into `Rt`. `LDR Rt, [PC, #offset]` is **PC-relative addressing**, used by the assembler to reach constant pools, as seen in the tutorial disassembly.

### STR — store to memory

```
STR {Rt}, [{Rn}, #{offset}]
```

`STR` = **ST**ore from **R**egister. Stores the value of register `Rt` into the memory address in `Rn` (optionally `+ offset`). `STR` writes to memory.

### LDRD — load register doubleword

```
LDRD {Rt}, {Rt2}, [{Rn}, #{offset}]
```

Loads **two** adjacent 32-bit words in one instruction: `Rt ← mem[Rn+offset]`, `Rt2 ← mem[Rn+offset+4]`. The slides use it to read pairs of stack-passed arguments efficiently.

```arm
MOV  r0, #7       ; put immediate 7 in r0  (no memory access)
LDR  r1, [r2]     ; load memory at address in r2 into r1
STR  r1, [r3]     ; store r1 to memory at address in r3
```

### The Load-Modify-Store Pattern

The standard embedded pattern for updating a RAM variable or a memory-mapped register: load it into a register, change it, store it back. The slides illustrate this with the C statement `x = x + 1`:

```arm
; C:  int x = -2;  x = x + 1;   address of x in r1
LDR  r0, [r1]    ; load value from memory pointed to by r1   (Load)
ADDS r0, r0, #1  ; increment it                              (Modify)
STR  r0, [r1]    ; store updated value back                  (Store)
```

When variables are *already in registers* (`x` in `r0`, `y` in `r1`, `z` in `r2`), `z = x + y` is simply `ADD r2, r1, r0`, no load/store needed. When only the *addresses* are in registers, the same statement becomes the four-step load-modify-store: `LDR r3,[r0]` · `LDR r4,[r1]` · `ADD r5,r3,r4` · `STR r5,[r2]`.

> [!info] Must know
> Arithmetic happens in registers, so values typically flow memory → register → register ALU → memory. `LDR` reads from memory, `STR` writes to memory, `MOV` is register/immediate transfer, not a memory load. `LDR Rt, =symbol` loads an *address*; `LDR Rt, [Rn]` loads a *value*.

> [!warning] Pitfall
> Do not confuse "moving a value into a register" with "reading from memory", and do not treat memory as if the ALU operates on it directly without registers in between.

---

## Arithmetic, Logical, and Shift Instructions

Arithmetic and logic instructions are the **vocabulary of the datapath**. Simple individually, they become powerful when chained: one instruction sets up a value, another transforms it, a third updates flags or prepares a branch. Tutorial exercises use this composition heavily.

### Arithmetic — ADD / ADC / SUB / SBC / RSB / MUL / DIV

```
ADD{S}  {Rd}, {Rn}, {operand2}      ; Rd = Rn + operand2
ADC{S}  {Rd}, {Rn}, {operand2}      ; Add with Carry: Rd = Rn + operand2 + C
SUB{S}  {Rd}, {Rn}, {operand2}      ; Rd = Rn - operand2
SBC{S}  {Rd}, {Rn}, {operand2}      ; Subtract with borrow: Rd = Rn - operand2 - (1 - C)
RSB{S}  {Rd}, {Rn}, {operand2}      ; Reverse Subtract: Rd = operand2 - Rn
MUL{S}  {Rd}, {Rn}, {Rm}            ; Rd = Rn * Rm, product truncated to 32 bits
UDIV    {Rd}, {Rn}, {Rm}            ; unsigned divide: Rd = Rn / Rm
SDIV    {Rd}, {Rn}, {Rm}            ; signed divide:   Rd = Rn / Rm
SMULL   {RdLo}, {RdHi}, {Rn}, {Rm}  ; signed 64-bit product RdHi:RdLo = Rn * Rm
UMULL   {RdLo}, {RdHi}, {Rn}, {Rm}  ; unsigned 64-bit product RdHi:RdLo = Rn * Rm
```

`ADD`/`SUB` are integer addition/subtraction; `MUL` truncates the product to 32 bits; `SMULL`/`UMULL` produce a full 64-bit product across a register pair. **`RSB`** computes `operand2 - Rn`: the slide if-then example uses `RSB r1, r1, #0` to compute `a = 0 - a` (negation). The `S` suffix makes the instruction update the APSR flags.

`ADC` and `SBC` exist for **multi-word arithmetic**. A register holds only 32 bits, so a 64-bit integer needs two registers; a 64-bit addition splits into a low-half `ADDS` (which sets `C`) followed by a high-half `ADC` (which consumes `C`):

```arm
; 64-bit C = A + B :  A in (r1,r0), B in (r3,r2), result in (r5,r4)
ADDS r4, r2, r0   ; low 32 bits, updates Carry
ADC  r5, r3, r1   ; high 32 bits, adds the carry-in
```

### Logic — AND / ORR / EOR / ORN / BIC

```
AND{S}  {Rd}, {Rn}, {operand2}      ; Rd = Rn & operand2
ORR{S}  {Rd}, {Rn}, {operand2}      ; Rd = Rn | operand2
EOR{S}  {Rd}, {Rn}, {operand2}      ; Rd = Rn ^ operand2  (exclusive-OR)
ORN{S}  {Rd}, {Rn}, {operand2}      ; Rd = Rn | (NOT operand2)
BIC{S}  {Rd}, {Rn}, {operand2}      ; Bit Clear: Rd = Rn & (NOT operand2)
```

Bitwise AND, OR, exclusive-OR, OR-NOT, and bit-clear. `EOR` is XOR: it sets a result bit to $1$ exactly where the two input bits differ. **`BIC`** (bit clear) is `Rn AND NOT operand2`, the canonical way to clear selected bits with a mask. None of these are arithmetic, so none touch `V`.

The slides also list two bit-field instructions: **`BFC Rd, #lsb, #width`** (bit field clear, zeroes a `width`-bit field starting at `lsb`) and **`BFI Rd, Rn, #lsb, #width`** (bit field insert, copies the low `width` bits of `Rn` into a field of `Rd`).

### Shifts and Rotates — LSL / LSR / ASR / ROR

```
LSL{S}  {Rd}, {Rn}, {shift}     ; Logical Shift Left:  Rd = Rn << shift, zeros fill in from the right
LSR{S}  {Rd}, {Rn}, {shift}     ; Logical Shift Right: Rd = Rn >> shift, zeros fill in from the left
ASR{S}  {Rd}, {Rn}, {shift}     ; Arithmetic Shift Right: Rd = Rn >> shift, the sign bit is replicated
ROR{S}  {Rd}, {Rn}, {shift}     ; Rotate Right: bits shifted off the right re-enter on the left
```

`shift` can be an immediate (`#3`) or a register holding the shift count. A left shift by $n$ multiplies by $2^n$ when overflow is ignored; a *logical* right shift divides an *unsigned* value by $2^n$; an *arithmetic* right shift preserves sign, so it divides a *signed* value. `ROR` does not lose bits; they wrap around. For shift/rotate instructions, `C` is set to the **last bit shifted out**.

$$\text{LSL by } n: \quad x \times 2^{n} \qquad\qquad \text{LSR by } n: \quad \left\lfloor x / 2^{n} \right\rfloor \;(\text{unsigned})$$

```arm
MOV  r0, #3
LSL  r1, r0, #3   ; r1 = 3 * 8 = 24
```

### Worked Tutorial Sequence

Given $R1 = \texttt{0x30}$ and $R2 = \texttt{0x1A}$, compute the register value after each instruction in sequence:

```arm
ADD  R3, R1, R2    ; R3 = 0x4A
LSL  R3, R3, #2    ; R3 = 0x128 = (R1 + R2) * 4
EOR  R4, R1, R2    ; R4 = R1 xor R2
LSR  R5, R2, #3    ; R5 = R2 >> 3
LSL  R6, R1, #3    ; R6 = R1 * 8
```

The slide's `AND` worked example: $r1 = \texttt{0xD5555555}$, $r2 = \texttt{0xAAABAAAB}$ gives $r0 = \texttt{0x80010001}$, since only the bit positions where *both* inputs are 1 survive. An `ORR` of similar bit patterns fills the result with 1s; an `MVN` of a value flips every bit.

> [!tip] Exam tip
> "Compute $(R1 + R2) \times 4$" is a classic question: answer with `ADD` then `LSL #2`. Multiplying by a power of two is almost always a shift, not a `MUL`. Work arithmetic problems by computing each register's value line by line.

> [!info] Must know
> Many ARM instructions have an `S` variant (`ADDS`, `MOVS`, `SUBS`, ...) that updates the APSR flags. Without the `S`, the instruction computes its result but leaves the flags untouched. **Non-arithmetic operations (`MOV`, `AND`, `LSL`, `MUL`) never touch the `V` flag** even in their `S` form.

> [!warning] Pitfall
> Do not confuse register *contents* with symbolic *variable names*, and do not apply signed-arithmetic interpretation when the sequence is plain bit manipulation.

---

## The Program Status Register and the NZCV Flags

The processor records the *outcome* of the last flag-setting operation in the **Program Status Register**. The combined register `xPSR` has three views: **APSR** (Application PSR, holds the `N`, `Z`, `C`, `V`, `Q`, `GE` flags), **IPSR** (Interrupt PSR, holds the current ISR/exception number), and **EPSR** (Execution PSR, holds the Thumb-state bit `T` and the `IT`/`ICI` execution state). For arithmetic and branching, the four **NZCV** condition flags in the APSR are what matter.

| Flag | Name | Set when... |
| --- | --- | --- |
| $N$ | Negative | bit 31 (the MSB) of the result is 1 |
| $Z$ | Zero | all bits of the result are 0 |
| $C$ | Carry | unsigned add: a carry out of the MSB occurred · unsigned subtract: `C=0` (carry = *not* borrow) if a borrow occurred · shift/rotate: the last bit shifted out |
| $V$ | oVerflow | a signed operation produced the wrong sign: adding two same-signed numbers gives the opposite sign |

> [!info] Must know — flag semantics
> After `ADDS`: `N` = bit 31 of result · `Z` = result is zero · `C` = carry assuming **unsigned** operands · `V` = overflow assuming **signed** operands. **`C` and `V` are computed simultaneously on every flag-setting arithmetic instruction**; the *branch* you choose later decides which interpretation you actually use.

### ADD vs ADDS — the S suffix

```arm
ADD  r0, r1, r2  ; r0 = r1 + r2, NZCV flags UNCHANGED
ADDS r0, r1, r2  ; r0 = r1 + r2, NZCV flags UPDATED
```

The slide's canonical trace: `r0 = 0xFFFFFFFF`, `r1 = 0x00000001`, then `ADDS r0, r0, r1`. The sum is `0x00000000`. So `N = 0` (not negative), `Z = 1` (result is zero), `C = 1` (carry out of bit 31, since adding 1 to `0xFFFFFFFF` wraps), `V = 0` (no *signed* overflow: $-1 + 1 = 0$ is a correct signed result).

There are **two ways** to update the flags:
1. **Append `S`** to an arithmetic/logic instruction: `ADD → ADDS`, `SUB → SUBS`, `MOV → MOVS`.
2. **Use a compare-style instruction**: `CMP`, `CMN`, `TST`, `TEQ` always update flags and need no `S` and no destination register.

---

## Comparison, Condition Codes, and Branching

ARM conditional control flow **separates** the arithmetic that *produces* flags from the branch that *consumes* them. A compare instruction updates the APSR flags; a later branch interprets that state under signed or unsigned rules. This makes branching compact, but means you must reason carefully about *what operation last set the flags* and *what interpretation the branch expects*.

### Sequence, Selection, Loop

Assembly has no `if`/`while`/`for` keywords, but every program is built from the **three control structures**: **sequence** (statements run one after another in listed order), **selection** (if-then-else, a conditional choice), and **loop** (repeated execution governed by a branch). In assembly these become branch patterns. A branch is the assembly equivalent of a C `goto`; it breaks the single-entry single-exit rule, which is why undisciplined branching produces unreadable **spaghetti code**. Drawing a **flowchart** first is the recommended strategy.

### CMP and CMN — compare

```
CMP {Rn}, {operand2}      ; flags as if Rn - operand2  (like SUBS, result discarded)
CMN {Rn}, {operand2}      ; flags as if Rn + operand2  (like ADDS, result discarded)
```

`CMP` updates `N`, `Z`, `C`, `V` from the subtraction `Rn - operand2` **without storing** the result. `CMN` (Compare Negative) does the same from the *addition* `Rn + operand2`. Comparing $A$ with $-B$ is the same flag question as $A + B$, so `CMN r0, #100000` expresses *"compare r0 with −100000"* without encoding an awkward large negative immediate. A `CMP` is almost always followed by a conditional branch.

### Condition Codes and the NZCV Mapping

A **condition code** is a 2- to 3-letter suffix (`EQ`, `NE`, `GT`, `HI`, ...) derived from the NZCV flags. The crucial exam distinction is **signed vs unsigned**: the *same* raw 32-bit values can give different ordering answers depending on interpretation, because one view treats the top bit as magnitude and the other as sign.

| Suffix | Meaning | Signedness | Flags tested |
| --- | --- | --- | --- |
| `EQ` / `NE` | equal / not equal | either | $Z=1$ / $Z=0$ |
| `CS`/`HS` · `CC`/`LO` | carry set, unsigned $\geq$ / carry clear, unsigned $<$ | **unsigned** | $C=1$ / $C=0$ |
| `HI` / `LS` | unsigned higher / unsigned lower-or-same | **unsigned** | $C=1 \land Z=0$ / $C=0 \lor Z=1$ |
| `GE` / `LT` | signed $\geq$ / signed $<$ | **signed** | $N=V$ / $N \neq V$ |
| `GT` / `LE` | signed $>$ / signed $\leq$ | **signed** | $Z=0 \land N=V$ / $Z=1 \lor N \neq V$ |
| `MI` / `PL` | minus (negative) / plus (positive or zero) | sign test | $N=1$ / $N=0$ |
| `VS` / `VC` | overflow set / overflow clear | overflow test | $V=1$ / $V=0$ |
| `AL` | always (the default, never written explicitly) | — | — |

The branch instructions just prefix `B` to these suffixes: `BEQ`, `BNE`, `BGT`, `BLT`, `BGE`, `BLE`, `BHI`, `BLO`, `BHS`, `BLS`, `BMI`, `BPL`, `BVS`, `BVC`.

| Compare | Signed branch | Unsigned branch |
| --- | --- | --- |
| `>` | `BGT` | `BHI` |
| `>=` | `BGE` | `BHS` |
| `<` | `BLT` | `BLO` |
| `<=` | `BLE` | `BLS` |
| `==` / `!=` | `BEQ` / `BNE` | `BEQ` / `BNE` |

> [!info] Must know
> Equality (`BEQ`/`BNE`) depends on $Z$ alone. **Signed** ordering depends on $N$ and $V$; **unsigned** ordering depends on $C$ and $Z$. Signed greater-or-equal is $N == V$; checking $N$ alone is insufficient because overflow can flip the apparent sign bit.

### Why GE is N == V — the proof

The slides derive `GE` carefully. After `CMP r0, r1` the processor computes `r0 - r1`:

| | $N=0$ (result looks non-negative) | $N=1$ (result looks negative) |
| --- | --- | --- |
| **$V=0$** (no overflow, result correct) | result truly $\geq 0$ → $r0 \geq r1$ | result truly $< 0$ → $r0 < r1$ |
| **$V=1$** (overflow, sign is wrong) | sign mistakenly $\geq 0$, truly $< 0$ → $r0 < r1$ | sign mistakenly $< 0$, truly $\geq 0$ → $r0 \geq r1$ |

In every cell, $r0 \geq r1$ exactly when $N = V$. That is why **signed greater-or-equal is $N == V$**, not "$N=0$".


### Why BGT and BHI Are Not Interchangeable

```arm
MOV  r0, #-1
MOV  r1, #2
CMP  r0, r1
```

- As a **signed** value, $-1 < 2$, so a signed-greater branch (`BGT`) is **not** taken; `BLT` **is**.
- As an **unsigned** bit pattern, $\texttt{0xFFFFFFFF} > \texttt{0x00000002}$, so an unsigned-higher branch (`BHI`) **is** taken; `BLO` is **not**.

It is *software's responsibility* to tell the machine how to interpret the data: in C you declare the variable `signed` or `unsigned`; in assembly you pick the signed or unsigned branch mnemonic. The bit pattern alone does not decide: `0xFFFFFFFF` is $-1$ signed but $4{,}294{,}967{,}295$ unsigned.

```arm
; signed comparison
CMP  r0, r1
BGT  signed_greater

; unsigned comparison on the same raw values
CMP  r0, r1
BHI  unsigned_higher
```

The reliable workflow: **(1)** identify the last flag-setting instruction, **(2)** decide whether the operands are signed or unsigned, **(3)** choose the branch mnemonic whose semantics match.

<figure class="diag-figure">
  <figcaption>Branch selection — flags are produced once, then interpreted by the chosen condition code</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="Flag production and consumption">
    <defs>
      <marker id="arr-br" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-br-a" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>
    <rect x="20" y="80" width="170" height="56" class="d-node-acc"/>
    <text x="105" y="104" text-anchor="middle" class="d-h-sm">CMP / ADDS</text>
    <text x="105" y="122" text-anchor="middle" class="d-sub">produces N Z C V</text>

    <rect x="280" y="80" width="200" height="56" class="d-node-ink"/>
    <text x="380" y="104" text-anchor="middle" class="d-h-inv">APSR flags</text>
    <text x="380" y="122" text-anchor="middle" class="d-sub" fill="#fff">N Z C V — both views held</text>

    <line x1="190" y1="108" x2="278" y2="108" class="d-edge" marker-end="url(#arr-br)"/>

    <rect x="560" y="30" width="180" height="50" class="d-node"/>
    <text x="650" y="51" text-anchor="middle" class="d-h-sm">signed branch</text>
    <text x="650" y="68" text-anchor="middle" class="d-sub">BGT BLT — uses N,V</text>

    <rect x="560" y="138" width="180" height="50" class="d-node"/>
    <text x="650" y="159" text-anchor="middle" class="d-h-sm">unsigned branch</text>
    <text x="650" y="176" text-anchor="middle" class="d-sub">BHI BLO — uses C,Z</text>

    <path d="M 480 96 L 520 96 L 520 55 L 558 55" class="d-edge-acc" marker-end="url(#arr-br-a)"/>
    <path d="M 480 120 L 520 120 L 520 163 L 558 163" class="d-edge-acc" marker-end="url(#arr-br-a)"/>
  </svg>
</figure>

### Thumb-2 Conditional Execution — IT Blocks

For very short conditional sequences, Thumb-2 offers conditional execution as a branch-free alternative. In full **ARM (A32)** most instructions can carry a condition code directly (`MOVLE`, `MOVGT`). In **Thumb-2 (T32)**, conditionally executed instructions must sit inside an **`IT` (If-Then) block**: the `IT` instruction sets a condition for **up to 4 following instructions**, and for each you specify whether it belongs to the *If* (T) or *Else* (E) branch. The block-defining mnemonic spells the pattern (`ITE`, `ITT`, `ITTET`, etc.), and the per-instruction suffixes must match the IT pattern or the assembler complains.

```arm
CMP   r0, #0
ITE   LE          ; If-Then-Else on the LE condition
MOVLE r1, #-1     ; T — executes if r0 <= 0
MOVGT r1, #1      ; E — executes if r0 > 0
```

A 3-instruction `IT` for `if (a==1 || a==7 || a==11)`:

```arm
CMP   r0, #1
ITTET NE
CMPNE r0, #7      ; executed if r0 != 1
CMPNE r0, #11     ; executed if r0 != 7
MOVEQ r1, #1      ; a was one of the three values
MOVNE r1, #-1     ; a was none of them
```

> [!tip] Exam tip
> Branches can introduce **pipeline stalls / branch penalties**: if the processor mispredicts the outcome it must flush the pipeline and re-fetch, wasting cycles, which is bad for *deterministic* real-time systems. Branches also disrupt instruction **prefetching** and **decoding**. If the conditional consequence is only one or two instructions long, conditional execution (`IT`/`ITE`) avoids the branch entirely. A related hazard is a **data hazard**: `LDR r1,[r0]` followed immediately by `ADD r2,r1,#1` stalls because `ADD` needs `r1` before the load completes.

> [!warning] Pitfall
> Choosing a signed branch for an unsigned comparison (or vice versa) is the single most common branching mistake. Also remember the flags must have been set by a *recent relevant* instruction; a `CMP` far above unrelated code is not a valid basis.

**30-second oral answer.** ARM branching depends on the APSR flags $N$, $Z$, $C$, $V$, usually produced by `CMP`, `CMN`, or a flag-setting arithmetic instruction. The key distinction is signed vs unsigned: `BGT`/`BLT` are signed, `BHI`/`BLO` are unsigned. Always decide the numeric interpretation first, then pick the condition code.

---

## Advanced Flag-Setting Instructions: TST, TEQ, and the Indirect Call

Beyond `CMP` and `CMN`, the ARM ISA includes instructions that **set flags without storing a result**, plus an indirect call form. They are useful precisely because they avoid extra work.

### TST — Test (bitwise AND)

```
TST {Rn}, {operand2}      ; flags as if Rn AND operand2  (like ANDS, result discarded)
```

Performs a bitwise **AND** for flag-setting purposes only; the AND result is **not** kept in any register. It updates `N` and `Z` (and may update `C` during operand2 evaluation); it does not affect `V`. Ideal for "is this bit set?" checks: mask the bit of interest, and `Z` tells you whether it was zero.

```arm
TST  r0, #0x08        ; mask bit 3
BEQ  bit_was_clear    ; Z set => the tested bit was 0
```

### TEQ — Test Equivalence (bitwise XOR)

```
TEQ {Rn}, {operand2}      ; flags as if Rn EOR operand2  (like EORS, result discarded)
```

Performs a bitwise **XOR** for flag-setting purposes without storing the result. Because XOR is zero exactly when the bit patterns match, `Z` after `TEQ` is a quick test for *identical bit patterns*. Updates `N`, `Z`; not `V`.

```arm
TEQ  r2, r3
BEQ  same_bit_pattern
```

### The four flag-setting compares at a glance

| Instruction | Operation (result discarded) | Flags updated |
| --- | --- | --- |
| `CMP Rn, Op2` | `Rn - Op2` (like `SUBS`) | N Z C V |
| `CMN Rn, Op2` | `Rn + Op2` (like `ADDS`) | N Z C V |
| `TST Rn, Op2` | `Rn & Op2` (like `ANDS`) | N Z C |
| `TEQ Rn, Op2` | `Rn ^ Op2` (like `EORS`) | N Z C |

### BLX — Branch with Link and Exchange

```
BLX {Rm}
```

An **indirect call**: stores the return address in `LR` and branches to the address held in register `Rm`. Unlike `BL label` (direct, label target), `BLX` is used when the callee address is already in a register. It is still a *call*: it updates `LR`, so the callee returns the usual way.

```arm
LDR  r4, =target_function
BLX  r4               ; indirect call; return address saved in LR
```

### Worked Example — Clearing a Selected Bit

This lecture example ties together shifting, masking with `BIC` (bit clear = AND-NOT), and a clean `BX lr` return.

```arm
clear_bit:
    LDR  r2, [r0]     ; load 32-bit value from *r0
    MOV  r3, #1
    LSL  r3, r3, r1   ; mask = 1 << bit_position
    BIC  r2, r2, r3   ; clear that bit
    STR  r2, [r0]     ; store result back
    BX   lr
```

> [!info] Must know
> `CMN` sets flags from addition; `TST`/`TEQ` set flags from bitwise AND/XOR and **do not preserve the result**; `BLX` is an indirect call that updates `LR`. After `TST`, `BEQ` means "the tested bits were all zero".

> [!warning] Pitfall
> Do not treat `TST`/`TEQ` as if they store the computed bitwise result; they only set flags (this is the difference vs `ANDS`). And `BLX` is not an ordinary unconditional branch: it has call semantics and updates `LR`.

---

## Loops, Selection, and Structured Assembly

Assembly has no built-in `if`, `while`, or `for` keywords, but those structures still exist as **control-flow patterns**. Once you can spot the entry test, body, and back edge of a loop, or the compare-and-skip shape of a selection, higher-level logic becomes visible in raw assembly. The same high-level construct can be written with different branch layouts: a `for` loop can test before the body or jump to a check label first. Both are valid as long as initialisation, condition, update, and body stay logically consistent.

### Unconditional vs Conditional Branch

```
B   {label}        ; unconditional jump
B{cond} {label}    ; conditional jump — BEQ, BNE, BGT, BLT, BHI, BLO, ...
```

`B target` always jumps. `B{cond} target` jumps only if the NZCV flags satisfy the condition; otherwise execution falls through. A label marks an instruction's location; the assembler converts it to a numeric, word-counted, PC-relative offset.

### If-Then Statement

The slide `if (a < 0) { a = 0 - a; } x = x + 1;`. Invert the C condition so the branch *skips* the then-block:

```arm
        ; r1 = a (signed), r2 = x
        CMP  r1, #0       ; compare a with 0
        BGE  endif        ; skip the then-block if a >= 0
then    RSB  r1, r1, #0   ; a = 0 - a   (reverse subtract = negation)
endif   ADD  r2, r2, #1   ; x = x + 1
```

### If-Then-Else

`if (a == 1) b = 3; else b = 4;` needs an explicit `B` to jump over the else-block:

```arm
        ; r1 = a, r2 = b
        CMP  r1, #1       ; compare a and 1
        BNE  else         ; go to else if a != 1
then    MOV  r2, #3       ; b = 3
        B    endif        ; skip the else-block
else    MOV  r2, #4       ; b = 4
endif
```

### Compound Boolean Expressions

For `if (x > 20 && x <= 25)`, **AND**: any failing sub-condition must skip the body, so each failure branches to `endif`:

```arm
        CMP  r0, #20
        BLE  endif        ; x <= 20 → condition false, skip
        CMP  r0, #25
        BGT  endif        ; x > 25  → condition false, skip
        MOV  r1, #1       ; both held: a = 1
endif
```

For `if (x <= 20 || x >= 25)`, **OR**: any *passing* sub-condition jumps straight into the body, only the last failing one skips it:

```arm
        CMP  r0, #20
        BLE  then         ; x <= 20 → true, enter body
        CMP  r0, #25
        BLT  endif        ; x < 25 (and x > 20) → false, skip
then    MOV  r1, #1       ; a = 1
endif
```

### Counted Loop Skeleton

The clean slide-style shape with explicit initialisation, test, body, update, and exit label:

```arm
MOV  r0, #0      ; i   (initialisation)
MOV  r1, #0      ; sum
loop:
    CMP  r0, #10     ; test
    BGE  endloop
    ADD  r1, r1, r0  ; body
    ADD  r0, r0, #1  ; update
    B    loop        ; back edge
endloop:
```

### For Loop — Two Valid Layouts

The slides give `for(i=0; i<10; i++) sum += i;` two ways. **Implementation 1** jumps to a check label first (test-at-bottom):

```arm
        MOV  r0, #0      ; i
        MOV  r1, #0      ; sum
        B    check
loop    ADD  r1, r1, r0  ; sum += i
        ADD  r0, r0, #1  ; i++
check   CMP  r0, #10
        BLT  loop        ; loop while i < 10
endloop
```

**Implementation 2** tests at the top (test-first):

```arm
        MOV  r0, #0      ; i
        MOV  r1, #0      ; sum
loop    CMP  r0, #10
        BGE  endloop     ; exit when i >= 10
        ADD  r1, r1, r0  ; sum += i
        ADD  r0, r0, #1  ; i++
        B    loop
endloop
```

Both compute the same result. The compiler-generated code in Tutorial 2 (`b.n` to a check label, `adds`, `cmp r5,#9`, `ble.n` back) matches Implementation 1, showing the compiler need not match a hand-written layout.

### Euclid GCD Loop

The lesson is not memorising Euclid's algorithm but recognising how a repeated mathematical update, $GCD(a,b) = GCD(b, a \bmod b)$, becomes a loop with an explicit exit condition. ARM has no modulo instruction, so `a mod b` is computed as `a - (a/b)*b`:

```arm
        MOV  r0, #78
        MOV  r1, #66
GCDloop:
    UDIV r3, r0, r1   ; r3 = a / b   (quotient)
    MUL  r3, r3, r1   ; r3 = (a/b) * b
    SUB  r2, r0, r3   ; r2 = a - (a/b)*b  = a mod b
    MOV  r0, r1       ; a = b
    MOV  r1, r2       ; b = a mod b
    CMP  r1, #0
    BNE  GCDloop      ; exit when remainder is 0  → GCD in r0
```

### Loop with an Embedded Selection — Odd Counter

Combines loop structure with a masking-based odd/even test, exactly in the style of the lecture exercise:

```arm
MOVS r2, #0
count_loop:
    TST  r0, #1       ; selection: is r0 odd?
    BEQ  is_even
    ADDS r2, r2, #1   ; count the odd value
is_even:
    ADDS r0, r0, #1
    CMP  r0, r1
    BLE  count_loop
```

> [!info] Must know
> The three control structures are sequence, selection, loop. A `while` loop maps to a compare plus a conditional branch. To recognise a loop, find the **back edge**, a branch targeting earlier code. To recognise selection, find the compare and the conditional branch that skips or enters one block.

> [!tip] Exam tip
> When translating C to assembly, identify four pieces separately: **initialisation, test, body, update**. Use labels so the assembler computes branch offsets; never hand-count instruction distances. Excessive branching hurts performance through stalls; short conditions can sometimes use conditional execution instead.

> [!warning] Pitfall
> Compiler-generated assembly need not match the branch pattern you would hand-write; the high-level logic is the same even when the layout differs. And structured-programming concepts do not disappear in assembly; they just become branch patterns.

---

## Functions, BL/BX, LR, Stack, and Calling Convention

A function call is not magic at the machine level. It is a **controlled change in the program counter** together with an **agreement** about where arguments live, where the return address is kept, and which registers must be preserved across the call. That agreement is the **calling convention** (the **ARM Procedure Call Standard, APCS**). Once you understand it, C-and-assembly integration stops being opaque compiler behaviour.

The slides describe a procedure as a *spy*: it leaves with a plan, acquires resources, performs the task, **covers its tracks**, and returns. The "covers its tracks" part is register preservation: nothing else should be perturbed once the mission is complete. The six execution steps are: (1) put parameters where the procedure can reach them, (2) transfer control to the procedure, (3) acquire storage, (4) do the work, (5) put the result where the caller can read it, (6) return control to the point of origin.

### The Four Branch Shapes

| Instruction | Form | Effect | Updates `LR`? |
| --- | --- | --- | --- |
| `B` | `B {label}` | Plain unconditional jump (branch) | No |
| `BL` | `BL {label}` | **Call**: jump to label, save return address in `LR` | **Yes** |
| `BX` | `BX {Rm}` | Branch indirect, to address in register (`BX LR` to return) | No |
| `BLX` | `BLX {Rm}` | **Indirect call**: jump to address in register, save return in `LR` | **Yes** |

Only the call-style jumps (`BL`, `BLX`) update `LR`. Distinguishing simple jumps from call-style jumps is the key to reading flow-control-heavy assembly.

### BL — Branch with Link

```
BL {label}
```

Branches to `label` and stores the address of the *next* instruction into `LR`. The slide is precise: `BL` saves **`PC + 4`** in `LR` (the byte address of the instruction following the `BL`). This saved value is the **return address**, needed because the same procedure may be called from many call sites.

### BX LR — the return sequence

```
BX LR
```

Branches to the address held in the link register. A function return is just another branch whose target is the saved return address. The slide trace: at the `BL foo` site `PC = 0x08000210`, so `LR = 0x08000214`; `PC` jumps to `foo`. At `foo`'s `BX LR`, `PC` is loaded from `LR` (`0x08000214`) and the caller resumes.

```arm
        BL   foo      ; branch to foo, LR = address of next instruction
        ...           ; execution resumes here after foo returns
foo:
        ; body
        BX LR         ; return to saved address
```

The slide's simplest complete leaf function, `add_two_numbers(3, 7)`:

```arm
; caller
        MOVS r0, #3        ; argument 1
        MOVS r1, #7        ; argument 2
        BL   add_two_numbers
; callee
add_two_numbers:
        ADDS r0, r0, r1    ; result in r0
        BX   LR            ; return
```

### The Calling Convention (APCS)

The APCS defines the use of registers, the use of the stack, the stack-frame format, and the argument-passing mechanism, so that object code from different compilers can be linked, and so C and assembly can call each other.

- **Arguments 1–4** go in `r0`–`r3` (each 8-, 16-, or 32-bit value gets a register). A 64-bit argument occupies a register pair (`r0:r1`); a 128-bit argument occupies `r0:r1:r2:r3`.
- **Extra arguments** (the 5th onward) are **pushed onto the stack by the caller**, in reverse order; the caller pops them after the call returns.
- **Return value** comes back in `r0` (a 64-bit return uses `r0:r1`, a 128-bit return `r0:r1:r2:r3`).
- **`r0`–`r3` and `r12`/`IP` are caller-saved (volatile)**: the callee may freely clobber them; if the caller needs their values after the call, it must save them itself.
- **`r4`–`r11`, `LR`, `SP` are callee-saved (non-volatile)**: if the callee modifies them it **must** restore them before returning. `SP` must hold the same value after the call as before; `LR` need not.

| Register | APCS role | Subroutine-preserved? |
| --- | --- | --- |
| `r0` | Argument 1 + return value | No (caller-saved) |
| `r1`–`r3` | Arguments 2–4 | No (caller-saved) |
| `r4`–`r11` | General-purpose local variables (`V1`–`V8`) | **Yes (callee-saved)** |
| `r12` (`IP`) | Intra-procedure scratch | No (caller-saved) |
| `r13` (`SP`) | Stack pointer | **Yes**, must be unchanged across the call |
| `r14` (`LR`) | Link register / return address | No, may differ after the call |
| `r15` (`PC`) | Program counter | N/A, never write `PC` directly |

> [!info] Caller-saved vs callee-saved (Mock Paper 2 Q7, Q8, Q9)
> Mock answers: *first four 32-bit arguments are passed in `r0`–`r3`* · *`LR` holds the return address after a call-style branch* · *signed and unsigned branches interpret the same flag state differently*. The callee may freely modify `r0`–`r3`; it must preserve `r4`–`r11`/`LR`/`SP` if it touches them.

### Procedure Roles: Root, Non-leaf, Leaf

- **Root procedure**: the program entry function; **always a caller**.
- **Leaf procedure**: calls nothing; **always a callee**. A leaf with ≤4 parameters has minimal overhead, and ~50% of calls are to leaf functions.
- **Non-leaf procedure**: **both a caller and a callee**.

This distinction decides whether you need the stack at all. A leaf function that uses only `r0`–`r3` need push nothing. A **non-leaf** function must manage `LR` carefully because the inner call overwrites it.

### Why Nested Calls Need the Stack

The **stack** is a **Last-In-First-Out** memory region (its top tracked by `SP`) used for saved registers, local data, and extra arguments. If a function needs more than four registers, the surplus must be **spilled** to the stack. The two operations are **push** (place data on the stack) and **pop** (remove from the top).

```
PUSH {Rd}   ; SP = SP - 4 ; (*SP) = Rd      → descending + full stack
POP  {Rd}   ; Rd = (*SP)  ; SP = SP + 4     → stack shrinks
```

Cortex-M uses a **full descending stack**: it grows toward **lower** addresses, and `SP` points at the **last item pushed**. `PUSH` is equivalent to `STMDB SP!` (Store Multiple, **D**ecrement **B**efore); `POP` is `LDMIA SP!` (Load Multiple, **I**ncrement **A**fter). Pushing $n$ registers does `SP = SP − 4n`; popping does `SP = SP + 4n`. On the STM32-Discovery, `SP` starts at `0x20000200` by default (changeable in `startup.s`).

When you push **multiple** registers, the register list order in the source is irrelevant: `PUSH {r6,r7,r8}` ≡ `PUSH {r8,r7,r6}`. The hardware always stores the **lowest-numbered register at the lowest memory address** (so the highest-numbered register is pushed first and popped last). Eligible for `PUSH`: `r0`–`r12`, `LR`. Eligible for `POP`: `r0`–`r12`, `LR`, **`PC`**; popping into `PC` returns from the function in one instruction.

As soon as a function makes *another* call, the inner `BL` overwrites `LR`, so a non-leaf function must preserve `LR` first:

```arm
caller:
    PUSH {lr}      ; save own return address before nested call
    BL   child     ; this BL overwrites LR
    POP  {lr}      ; restore own return address
    BX   lr        ; return correctly
```

A common idiom combines the two: `PUSH {r4-r6, lr}` at entry, then `POP {r4-r6, pc}` at exit, restoring the saved registers *and* returning in a single instruction.

<figure class="diag-figure">
  <figcaption>Function call mechanics and the stack frame — args in r0–r3, BL saves return into LR, a non-leaf pushes LR + callee-saved registers, BX LR (or POP {pc}) returns</figcaption>
  <svg viewBox="0 0 760 340" class="diag-svg" role="img" aria-label="ARM function call and stack frame">
    <defs>
      <marker id="arr-fn" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-fn-a" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <!-- caller -->
    <rect x="20" y="30" width="220" height="100" class="d-node"/>
    <text x="130" y="54" text-anchor="middle" class="d-h-sm">caller</text>
    <text x="130" y="74" text-anchor="middle" class="d-sub">args → r0–r3</text>
    <text x="130" y="92" text-anchor="middle" class="d-sub">PUSH {lr} if non-leaf</text>
    <text x="130" y="110" text-anchor="middle" class="d-sub">BL callee</text>

    <!-- callee -->
    <rect x="510" y="30" width="220" height="100" class="d-node-acc"/>
    <text x="620" y="54" text-anchor="middle" class="d-h-sm">callee</text>
    <text x="620" y="74" text-anchor="middle" class="d-sub">reads r0–r3</text>
    <text x="620" y="92" text-anchor="middle" class="d-sub">result → r0</text>
    <text x="620" y="110" text-anchor="middle" class="d-sub">BX LR / POP {pc}</text>

    <!-- BL arrow -->
    <line x1="240" y1="65" x2="508" y2="65" class="d-edge" marker-end="url(#arr-fn)"/>
    <text x="374" y="55" text-anchor="middle" class="d-sub">BL — return addr (PC+4) → LR</text>

    <!-- BX LR arrow -->
    <path d="M 510 110 L 374 110 L 374 142 L 130 142 L 130 132" class="d-edge-acc" marker-end="url(#arr-fn-a)"/>
    <text x="374" y="136" text-anchor="middle" class="d-label-accent">BX LR — return to saved address</text>

    <!-- stack -->
    <rect x="280" y="180" width="200" height="150" class="d-node-ink"/>
    <text x="380" y="202" text-anchor="middle" class="d-h-inv">stack — full descending</text>
    <line x1="280" y1="212" x2="480" y2="212" class="d-edge"/>
    <text x="380" y="232" text-anchor="middle" class="d-sub" fill="#fff">args 5, 6, … (high addr)</text>
    <line x1="280" y1="244" x2="480" y2="244" class="d-edge"/>
    <text x="380" y="264" text-anchor="middle" class="d-sub" fill="#fff">saved LR</text>
    <line x1="280" y1="276" x2="480" y2="276" class="d-edge"/>
    <text x="380" y="296" text-anchor="middle" class="d-sub" fill="#fff">saved r4–r11 ← SP (low addr)</text>
    <text x="380" y="320" text-anchor="middle" class="d-sub" fill="#fff">grows ↓ toward low memory</text>
  </svg>
</figure>

### Passing More Than Four Arguments

For `sum(a,b,c,d,h,i,j,k)` the first four go in `r0`–`r3`; the caller **pushes** `h,i,j,k` and the callee reads them off the stack with `LDRD` (load doubleword), accounting for the offset shift from its own `PUSH {r5,r6,lr}` at entry:

```arm
; caller
        MOVS r0,#5 ; MOVS r1,#6 ; MOVS r2,#7 ; MOVS r3,#8
        PUSH {r0,r1,r2,r3}   ; extra args 5–8 onto stack
        MOVS r0,#1 ; MOVS r1,#2 ; MOVS r2,#3 ; MOVS r3,#4
        BL   sum
        POP  {r0,r1,r2,r3}   ; caller cleans up the extra args
; callee
sum     PUSH {r5,r6,lr}      ; callee-saved + LR  (shifts stack args by 12)
        ADD  r0,r0,r1 ; ADD r0,r0,r2 ; ADD r0,r0,r3   ; a+b+c+d
        LDRD r5,r6,[sp,#12]  ; fetch h,i
        ADD  r0,r0,r5 ; ADD r0,r0,r6
        LDRD r5,r6,[sp,#20]  ; fetch j,k
        ADD  r0,r0,r5 ; ADD r0,r0,r6
        POP  {r5,r6,pc}      ; restore and return
```

### Why the Stack Is Needed — summary

The slides list four uses: (1) saving the original contents of registers at the start of a subroutine and restoring them at the end, (2) storing local variables, (3) passing extra arguments, (4) saving registers automatically on an interrupt.

> [!info] Must know
> `BL` calls and saves `PC+4` in `LR`; `BX LR` (or `POP {pc}`) returns; the stack preserves arguments and registers that must survive a call. `r0`–`r3` hold the first arguments and the return value. A **non-leaf** call overwrites `LR`, so a non-leaf function must `PUSH {lr}` first. `r0`–`r3`/`r12` are caller-saved (volatile); `r4`–`r11`/`LR`/`SP` are callee-saved (must be restored if modified). Cortex-M uses a **full descending** stack.

> [!tip] Exam tip
> The practical exam's hardest exercise is typically a **recursive or iterative function** (e.g. Fibonacci). Lead every function with: take args from `r0`–`r3`; `PUSH {r4-rN, lr}` if you make a nested call or need extra registers; do the work; put the result in `r0`; `POP {r4-rN, pc}` (or `POP {lr}` + `BX lr`). Handle edge cases (e.g. equality → return $0$) explicitly with `CMP` + a branch.

> [!warning] Pitfall
> Forgetting that `BL` modifies `LR`; ignoring register-preservation rules across calls; thinking the stack is only for local variables and never for arguments; pushing without a matching pop (or vice versa). `SP` must end where it started.

---

## Exam practical patterns

This is the highest-value section in the knowledge base. The practical exam (60% of the grade) is three hand-written ARM assembly exercises of increasing difficulty. Below are **fully worked, hand-writable solutions** to each archetype, drawn from the lecture/tutorial style and validated against the mock-pack model solutions. Write assembly clearly: labels in the left margin, branch conditions visible, one comment per line stating intent.

> [!tip] The ~10 core patterns to be fluent in
> (1) immediate/register `MOV`; (2) `LDR`/`STR` load-modify-store; (3) `ADD`/`SUB` arithmetic; (4) shift-and-AND to **test a bit**; (5) `ORR`/`BIC` to **set/clear a bit**; (6) `CMP` + conditional branch for selection; (7) counted loop (init/test/body/update/back-edge); (8) `BL`/`BX LR` call-return with args in `r0`–`r3`, result in `r0`; (9) `PUSH {lr}` / `POP {pc}` for non-leaf functions; (10) explicit edge-case handling (`CMP` + branch, e.g. equality → return 0).

### Pattern A — bit-check (~10 pts)

> **Task.** Given a value in `r0` and a bit index in `r1`, return in `r0` whether the bit at that index is 0 or 1.

The technique is **shift the value right by the index, then AND with 1**, isolating the target bit into bit 0. Equivalently: build the mask `1 << index` and `TST`.

```arm
; bit_check(value=r0, index=r1) -> r0 = bit value (0 or 1)
.global bit_check
.thumb_func
bit_check:
        LSR  r0, r0, r1     ; shift target bit down to bit 0
        AND  r0, r0, #1     ; isolate bit 0 — r0 is now 0 or 1
        BX   LR             ; return result in r0
```

Mask-and-`TST` alternative, useful when the question wants a 0/1 produced by a branch:

```arm
; bit_check via mask + TST
.global bit_check
.thumb_func
bit_check:
        MOV  r2, #1
        LSL  r2, r2, r1     ; mask = 1 << index
        TST  r0, r2         ; sets Z=1 if the bit is 0
        BEQ  bit_is_zero
        MOV  r0, #1         ; bit was 1
        BX   LR
bit_is_zero:
        MOV  r0, #0         ; bit was 0
        BX   LR
```

> [!info] Related — GPIO set/clear (Mock Paper 1 Ex 3)
> The same bit-manipulation skill, applied to a memory-mapped register whose address is in `r0`: read, set bit 7, clear bit 3, write back.
> ```arm
> LDR  r1, [r0]          ; read register
> ORR  r1, r1, #0x80     ; set bit 7   (1 << 7)
> BIC  r1, r1, #0x08     ; clear bit 3 (BIC = AND NOT)
> STR  r1, [r0]          ; write back
> ```
> `ORR` with a one-hot mask sets a bit; `BIC` with a one-hot mask clears one; `EOR` would toggle one. `LDR`/`STR` work because the peripheral register occupies a normal address.

### Pattern B — max-of-3 (~20 pts)

> **Task.** Given three values in `r0`, `r1`, `r2`, return the greatest in `r0`. **If any two of the three are equal, return 0.**

Two phases: (1) the equality edge case, check all three pairs and return 0 if any pair matches; (2) the maximum, keep the running max in `r0`, comparing against `r1` then `r2`. Mock Paper 3 Ex 2 (`max3u`) is the **unsigned** variant, using `BHS` (unsigned higher-or-same); the resit exercise as described uses the equality-to-zero rule. Both are shown.

```arm
; max3(r0, r1, r2) -> r0 = max, or 0 if any two are equal
.global max3
.thumb_func
max3:
        ; --- edge case: any two equal -> return 0 ---
        CMP  r0, r1
        BEQ  ret_zero
        CMP  r0, r2
        BEQ  ret_zero
        CMP  r1, r2
        BEQ  ret_zero
        ; --- all distinct: find the maximum in r0 ---
        CMP  r0, r1
        BGE  skip1         ; r0 >= r1 -> keep r0   (signed; use BHS if unsigned)
        MOV  r0, r1        ; else r1 is bigger
skip1:
        CMP  r0, r2
        BGE  skip2         ; r0 >= r2 -> keep r0
        MOV  r0, r2        ; else r2 is bigger
skip2:
        BX   LR            ; r0 holds the maximum
ret_zero:
        MOV  r0, #0
        BX   LR
```

Unsigned variant (`max3u`, Mock Paper 3 Ex 2 model solution), with `BHS` instead of `BGE`:

```arm
; max3u(unsigned a=r0, b=r1, c=r2) -> r0 = unsigned max
.global max3u
.thumb_func
max3u:
        CMP  r0, r1
        BHS  keep_r0       ; r0 >= r1 (unsigned higher-or-same)
        MOV  r0, r1
keep_r0:
        CMP  r0, r2
        BHS  done
        MOV  r0, r2
done:
        BX   LR
```

> [!warning] Pitfall — signedness on max-of-3
> If the inputs are declared `unsigned`, a signed branch (`BGE`/`BLT`) is **wrong**: `0xFFFFFFFF` would be treated as $-1$ and judged the *smallest* when it is actually the *largest* unsigned value. Read the prototype, then pick `BHS`/`BLO` for unsigned and `BGE`/`BLT` for signed.

### Pattern C — Fibonacci (~30 pts)

> **Task.** Given `n` in `r0`, return the n-th Fibonacci number in `r0`. Sequence: $F_0=0,\ F_1=1,\ F_n = F_{n-1}+F_{n-2}$.

**Iterative solution (recommended; leaf function, no stack needed).** Keep the two previous values in `r1` and `r2`, loop `n` times. Handle the edge cases `n=0` and `n=1` first:

```arm
; fib(n=r0) -> r0 = n-th Fibonacci number   (iterative)
.global fib
.thumb_func
fib:
        CMP  r0, #1
        BLE  fib_base      ; n <= 1 -> answer is n itself (F0=0, F1=1)
        MOV  r1, #0        ; r1 = F(i-2), starts at F0
        MOV  r2, #1        ; r2 = F(i-1), starts at F1
        MOV  r3, #2        ; loop counter i, starts at 2
fib_loop:
        ADD  r12, r1, r2   ; F(i) = F(i-2) + F(i-1)
        MOV  r1, r2        ; shift window: F(i-2) <- F(i-1)
        MOV  r2, r12       ;               F(i-1) <- F(i)
        ADD  r3, r3, #1    ; i++
        CMP  r3, r0
        BLE  fib_loop      ; loop while i <= n
        MOV  r0, r2        ; result is the latest F(i-1)
        BX   LR
fib_base:
        BX   LR            ; n was 0 or 1 -> r0 already holds the answer
```

**Recursive solution (non-leaf; demonstrates the stack and `PUSH {lr}`).** Each call recurses twice, so `LR` and the intermediate result must be preserved on the stack:

```arm
; fib(n=r0) -> r0 = n-th Fibonacci number   (recursive)
.global fib
.thumb_func
fib:
        CMP  r0, #1
        BLE  fib_ret       ; base case: fib(0)=0, fib(1)=1 -> return n
        PUSH {r4, lr}      ; non-leaf: save callee-saved r4 and the return address
        MOV  r4, r0        ; r4 = n  (preserved across the recursive calls)
        SUB  r0, r4, #1
        BL   fib           ; r0 = fib(n-1)
        MOV  r5, r0        ; stash fib(n-1)  -- (or PUSH {r0} if r5 is in use)
        PUSH {r5}
        SUB  r0, r4, #2
        BL   fib           ; r0 = fib(n-2)
        POP  {r5}          ; recover fib(n-1)
        ADD  r0, r0, r5    ; r0 = fib(n-1) + fib(n-2)
        POP  {r4, lr}      ; restore callee-saved state
        BX   LR
fib_ret:
        BX   LR            ; r0 already holds 0 or 1
```

> [!tip] Exam tip — pick iterative under pressure
> The iterative version is a **leaf function**: no `PUSH`/`POP`, no recursion depth to reason about, fewer lines to get wrong by hand. Choose it unless the question explicitly demands recursion. Whichever you write: handle `n=0` and `n=1` explicitly *before* the loop/recursion, take `n` from `r0`, and return the result in `r0`.

### Pattern D — counted-loop summation (Mock Paper 1 Ex 1)

> **Task.** `sum_to_n`: input `r0 = n`, return `1 + 2 + ... + n` in `r0`; if `n <= 0` return 0.

The model-solution shape: edge case first, then a counted loop with a signed branch:

```arm
; sum_to_n(n=r0) -> r0 = 1+2+...+n, or 0 if n <= 0
.global sum_to_n
.thumb_func
sum_to_n:
        CMP  r0, #0
        BLE  done_zero     ; n <= 0 -> return 0
        MOV  r1, #1        ; loop counter i, starts at 1
        MOV  r2, #0        ; accumulator
loop:
        CMP  r1, r0
        BGT  done_sum      ; i > n -> finished
        ADD  r2, r2, r1    ; sum += i
        ADD  r1, r1, #1    ; i++
        B    loop
done_sum:
        MOV  r0, r2        ; result in r0
        BX   LR
done_zero:
        MOV  r0, #0
        BX   LR
```

### Pattern E — sign test / if-else (Tutorial 4 Ex 5, Mock Paper 2 Ex 2d)

> **Task.** Return 1 if `r0` is positive, −1 if negative, 0 if zero. And: set `r1 = 1` if `r0` is odd, else 0.

Sign test with branches:

```arm
; sign(r0) -> r0 = 1 / -1 / 0
.global sign
.thumb_func
sign:
        CMP  r0, #0
        BGT  positive
        BLT  negative
        MOV  r0, #0        ; r0 was zero
        BX   LR
positive:
        MOV  r0, #1
        BX   LR
negative:
        MOV  r0, #-1
        BX   LR
```

Odd test with `TST` (bit 0 is the parity bit):

```arm
; r1 = 1 if r0 is odd, else 0
        TST  r0, #1        ; Z=1 if bit 0 is clear (even)
        BEQ  even_case
        MOV  r1, #1        ; odd
        B    odd_done
even_case:
        MOV  r1, #0        ; even
odd_done:
```

> [!info] Function-call exercise (Tutorial 4 Ex 1)
> *Define `function1` (+5) and `function2` (−2), call both from `ASM_Function`, each returning to the caller.* The pattern: caller places the argument in `r0`, `BL`s each function; each callee modifies `r0` and `BX LR`s back. `ASM_Function` itself is non-leaf, so it must `PUSH {lr}` at entry and `POP {lr}` (or `POP {pc}`) at exit, because each inner `BL` overwrites `LR`.

---

## Memory-Mapped I/O and GPIO in Assembly

**Memory-mapped I/O** is a hardware design where peripheral control/status registers occupy real addresses in the processor's normal address space. The Cortex-M core can *directly* access its own **processor registers** (`ADD r3, r1, r0`), but it reaches **peripheral registers** (those belonging to GPIO, UART, SPI, ADC, timers) through memory-mapped I/O. From the instruction-set point of view you simply use ordinary `LDR`/`STR`; the only difference is that the address refers to *hardware behaviour* rather than to RAM cells.

The contrast is with **port-mapped I/O**, which uses dedicated special instructions (`Special_instruction Reg, Port`). Memory-mapped I/O is *simpler and more convenient*: each peripheral register is assigned a fixed address at the **chip design stage**, the processor treats it exactly like data memory, and the same native `LDR`/`STR` instructions apply. The Cortex-M33 has a fixed 4 GB memory map with regions for Code, SRAM, Peripheral, External RAM/Device, and the Private Peripheral Bus.

- **peripheral register**: a control/status register belonging to a peripheral block (GPIO, UART, SPI, ...); it has a **fixed address defined by the hardware design and documentation**.
- **GPIO data register**: a register used to read or set GPIO pin state. Writing a bit can directly drive a physical pin output.

### Load-Modify-Store on a GPIO Register

The standard pattern for changing one hardware-controlled bit without disturbing the others in the same register:

```arm
LDR  r0, =GPIO_ODR_ADDR
LDR  r1, [r0]          ; read current register value
ORR  r1, r1, #0x01     ; set output bit 0
STR  r1, [r0]          ; write updated value back
```

### Polling a Status Register (Mock Paper 4 Ex 2)

The classic poll loop: spin on a status register until a ready bit is set, then read the data register:

```arm
        LDR  r0, =0x40001000   ; status register address
poll:
        LDR  r1, [r0]          ; read status
        TST  r1, #1            ; test bit 0 (data-ready flag)
        BEQ  poll              ; not ready yet -> keep polling
        LDR  r1, =0x40001004   ; data register address
        LDR  r2, [r1]          ; read the sensor data
```

This is memory-mapped I/O: the peripheral registers are reached through normal addresses with normal load instructions, and the busy-wait `TST`/`BEQ` is plain conditional branching.

> [!info] Must know
> Memory-mapped peripherals are accessed with normal `LDR`/`STR`, with no separate instruction family (that would be *port-mapped* I/O). A peripheral register has a fixed address defined by the hardware design. GPIO output uses load-modify-store (`LDR` → `ORR`/`BIC` → `STR`).

> [!warning] Pitfall
> Thinking peripherals require fundamentally different instructions than memory, or that GPIO control bypasses the CPU address space. It does not: to the ISA, a peripheral address looks just like memory; the distinction is purely semantic.

---

## Integrating Assembly with C in STM32 Projects

Calling assembly from C works because the **compiler, assembler, and linker all agree on symbol names and calling rules**. This is the toolchain boundary the practical project material tests.

- **assembly source file**: a `.s` file containing assembler code.
- **header declaration**: a C declaration such as `extern void ASM_Function(void);` that lets C code call a symbol defined elsewhere.
- **global symbol**: a function/label exported (`.global`) so other translation units can reference it.

The header declaration tells the C compiler the function exists; the global label tells the linker where it is defined; the shared calling convention ensures arguments and return values line up.

### Minimal C-to-Assembly Linkage

Header file, declaring the symbol so the C compiler accepts the call:

```c
/* assembler.h */
extern void ASM_Function(void);
```

Assembly file, defining and exporting the symbol, marked Thumb-compatible:

```arm
/* assembler.s */
.syntax unified
.text
.global ASM_Function
.thumb_func
ASM_Function:
    BX LR
```

C call site:

```c
/* main.c */
while (1) {
    ASM_Function();
}
```

> [!info] Must know
> An assembly function used from C must be (1) declared `extern` in a C header, (2) exported with `.global`, and (3) marked `.thumb_func` so it is treated as Thumb code. The `extern` declaration informs the C compiler; the `.global` symbol informs the linker and assembler. Arguments arrive in `r0`–`r3`, the return value goes back in `r0`: exactly the APCS rules.

> [!warning] Pitfall
> Forgetting to export the symbol globally, or declaring the function in C but never defining the matching assembly symbol; the linker fails to resolve the call in both cases.

---

## Past exam coverage

The ARM-assembly material is the spine of the practical section of every mock paper. Section B of each paper is **60 marks of practical exercises**; the instructions demand assembly *"written clearly with labels, branch conditions, and register use visible"*.

- **Mock Paper 1, Exercise 1 — `sum_to_n` loop and branch construction [20 marks].** Write a Thumb function: `r0 = n` in, `1+2+...+n` out, return 0 if `n <= 0`. Marking: correct structure 10, correct signed branches 5, signed-vs-unsigned explanation 5. See [[#Pattern D — counted-loop summation Mock Paper 1 Ex 1|Pattern D]] — edge case first, counted loop, `BGT`/`BLE` signed branches.
- **Mock Paper 1, Exercise 3 — memory-mapped I/O / load-modify-store [20 marks].** GPIO register address already in `r0`: read it, set bit 7, clear bit 3, write back, and explain why `LDR`/`STR` work for peripherals. Model solution: `LDR` → `ORR #0x80` → `BIC #0x08` → `STR`. Peripheral registers occupy normal addresses. See [[#Memory-Mapped I/O and GPIO in Assembly]].
- **Mock Paper 2, Section A — short theory.** Q3 *registers faster than memory* (closer to the ALU); Q6 *`BL`* (branches and stores return address in `LR`); Q7 *first four arguments* (`r0`–`r3`); Q8 *purpose of `LR`* (holds the return address); Q9 *why `BGT` and `BHI` differ* (signed vs unsigned interpretation of the same flags).
- **Mock Paper 2, Exercise 1 — function calls, BL, LR, tracing [30 marks].** Trace `r0` through `MOVS r0,#3` → `BL add5` → `BL twice`: `3 → 8 → 16`, final return `16`. Explain that each `BL` redirects control and writes the return address to `LR`; `BX LR` returns to the saved address; a nested call inside `add5` would overwrite `LR`, so it would need `PUSH {lr}`/`POP {lr}`. See [[#Functions, BL/BX, LR, Stack, and Calling Convention]].
- **Mock Paper 2, Exercise 2 — flags, signedness, overflow, bitwise [30 marks].** With `r0=-1, r1=2, CMP r0,r1`: `BGT` no, `BLT` yes, `BHI` yes, `BLO` no. Bitwise: `10110100 AND 00001111 = 00000100`; `OR = 10111111`; `XOR = 10111011`. `0x7FFFFFFF + 1 = 0x80000000` — signed overflow, the result is negative. Odd test with `TST r0,#1` + `BEQ`. See [[#Comparison, Condition Codes, and Branching]] and [[#Pattern E — sign test  if-else Tutorial 4 Ex 5, Mock Paper 2 Ex 2d|Pattern E]].
- **Mock Paper 3, Exercise 2 — integrating ARM assembly with C: `max3u` [20 marks].** Implement `extern unsigned max3u(unsigned a, unsigned b, unsigned c)` returning the unsigned maximum. Model solution uses `BHS` (unsigned higher-or-same); signed branches would be wrong because the inputs are explicitly unsigned. See [[#Pattern B — max-of-3 ~20 pts|Pattern B]].
- **Mock Paper 4, Exercise 2 — mixed embedded design, polling [30 marks].** Part (c): write Thumb assembly that polls a status register at `0x40001000` until bit 0 is set, then loads the data register `0x40001004` into `r2`. Model solution: `LDR =addr` → `poll: LDR / TST #1 / BEQ poll` → `LDR / LDR`. Part (d): this is memory-mapped I/O — peripheral registers reached through normal addresses with normal loads. See [[#Polling a Status Register Mock Paper 4 Ex 2]].
- **General framing.** The three practical archetypes — **bit-check, max-of-3, Fibonacci** — recur in increasing-difficulty form across the practical section. The reliable recipe: take args from `r0`–`r3`, handle edge cases explicitly with `CMP` + branch, pick the *signed or unsigned* branch deliberately, return the result in `r0`, and (for non-leaf functions) `PUSH {lr}` at entry and `POP {pc}` at exit. The [[#Exam practical patterns]] section has a worked, hand-writable solution for each.

---

## Related Topics

- [[Program Counter and the Instruction Cycle|Program Counter and the Instruction Cycle]]
- [[Debugging with Breakpoints, Registers, Memory, and Disassembly|Debugging with Breakpoints, Registers, Memory, and Disassembly]]
- [[Bitwise Operations, Masks, and Shifts|Bitwise Operations, Masks, and Shifts]]
- [[APSR Flags and Arithmetic Meaning|APSR Flags and Arithmetic Meaning]]
- [[STM32CubeIDE Setup, Project Structure, and Build Toolchain|STM32CubeIDE Setup, Project Structure, and Build Toolchain]]
- [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]]
- [[Datasheets, Programming Manuals, and How to Use Them|Datasheets, Programming Manuals, and How to Use Them]]
