# Topic 7 — Exam Skills

**Mock pack:** `12 Mock Exams/BCS2410_Mock_Exam_Pack.pdf` (four 100-mark papers plus condensed model solutions)
**Syllabus:** `Materials/BCS 2410 Syllabus - 2025 - 2026.pdf`
**First-sitting recall:** March 2026 exam, ground truth for what actually appeared

This chapter is a **control strategy for the exam**, not new material: the structure of the paper, the three practical archetypes, the recurring theory topics, and the traps that lose marks. Most embedded exam questions differ in surface wording more than in structure, so procedural fluency turns recurring patterns into reliable points. The student sat this exam once (March 2026) and is now revising for the **resit**, which is the *same format* as the normal-period paper (syllabus §7), so everything below transfers directly.

---

## Exam structure

> [!info] The 40 / 60 split
> The syllabus (§7) and the mock pack agree: the paper is **~40% theory / short closed questions** and **~60% practical exercises** (usually 2–3 larger exercises). The exam is taken on ANS, graded out of $10$.

| Section | Weight | Form | What it tests |
|---|---|---|---|
| **Section A — Theory** | $40\%$ | Closed multiple-choice plus short-answer | Recall and recognition: architecture, data representation, flags, FPGA/Edge AI |
| **Section B — Practical** | $60\%$ | **Hand-written ARM assembly on paper**, 3 exercises of increasing difficulty | Writing correct, labelled assembly under time pressure |

### Section A — theory

Closed-choice multiple-choice plus short technical-prose answers. **First-sitting recall: this section was relatively easy.** Chapters 01–04 covered most of it. The two surprises were FPGA/Quantization and the memory-hierarchy hardware mechanism (see [Theory question coverage](#theory-question-coverage)).

> [!warning] Negative marking on MCQ
> The syllabus applies a **correction for guessing**:
> $$\text{Adjusted score} = P \times \left(C - \frac{W}{k-1}\right)$$
> where $P$ = points per question, $C$ = correct answers, $W$ = wrong answers, $k$ = options per question. **Unanswered questions count as $0$ correct and $0$ wrong**, so they are simply ignored. Consequence: if you can eliminate even one option, guessing has positive expected value; with no idea at all, *leaving it blank is mathematically safer than a pure guess*.

### Section B — the three practical exercises

Three hand-written ARM assembly exercises, increasing in difficulty and marks. **First-sitting recall gives the archetypes and weights:**

| # | Archetype | Approx. marks | Core skill |
|---|---|---|---|
| 1 | **Bit-check:** return whether a chosen bit is $0$ or $1$ | ~$10$ | Shift + `AND` mask, condition codes |
| 2 | **Max-of-3:** return the greatest of three values; $0$ if any two are equal | ~$20$ | `CMP` + branching, equality edge cases |
| 3 | **Fibonacci:** return the $n$-th Fibonacci number | ~$30$ | Loops or recursion, `BL`/`BX`/`LR`, stack |

The mock pack's Section B is heavier (two/three 20–30 mark exercises) but drills the same machinery: loops, branches, function calls, pointers, memory-mapped I/O. Treat the mock papers as the *superset* and the three recalled archetypes as the *most likely actual questions*.

> [!tip] Hand-written assembly: presentation earns marks
> The candidate instructions in the mock pack are explicit: *"Write assembly clearly with labels, branch conditions, and register use visible."* On paper, write one instruction per line, align operands, name every label meaningfully (`loop:`, `done:`), and comment tricky lines. A correct algorithm written illegibly loses marks; clear structure also helps *you* trace your own code for bugs.

---

## The three practical exercises

For each archetype: the exact problem, the assembly approach, and the edge cases that lose marks. Every function follows the ARM Cortex-M calling convention: arguments arrive in `r0–r3`, the result returns in `r0`, and you exit with `BX LR`. See [[Functions, BL-BX, LR, Stack, and Calling Convention]].

### Exercise 1 — bit-check (~10 marks)

> [!info] Problem
> Given a value and a bit index, return whether the bit at that index is $0$ or $1$. Input: `r0 = value`, `r1 = index`. Output: `r0 = 0` or `r0 = 1`.

The bit at index $i$ is isolated by shifting the value right by $i$ and masking the lowest bit:
$$\text{bit}_i = (\text{value} \gg i) \mathbin{\&} 1$$

**Signature lead-ins:**
- `LSR {Rd}, {Rm}, {Rs}`: logical shift right of `Rm` by the amount in `Rs`, result in `Rd`.
- `AND {Rd}, {Rn}, {operand}`: bitwise AND.

```arm
@ r0 = value, r1 = bit index -> r0 = 0 or 1
bit_check:
    LSR  r0, r0, r1      @ shift the target bit down to position 0
    AND  r0, r0, #1      @ mask everything except bit 0
    BX   LR              @ return r0 (already 0 or 1)
```

> [!warning] Marks lost here
> - Using a **fixed mask** (`AND r0, r0, #0x80`) instead of shifting by the *variable* index `r1`. The index is an argument, not a constant.
> - Returning the *masked value at its original position* (e.g. `0x80`) instead of normalising to $0$/$1$. Shift-then-mask gives $0$/$1$ directly; mask-then-test needs an extra normalising step.
> - Forgetting `BX LR`, so the function never returns.

A branch-based alternative also scores full marks: `LSR`, then `TST r0, #1`, then `BEQ`/`MOVS` to set $0$ or $1$. The shift-and-mask version is shorter and harder to get wrong.

### Exercise 2 — max-of-3 (~20 marks)

> [!info] Problem
> Given three values in `r0`, `r1`, `r2`, return the greatest in `r0`. **If any two of the three are equal, return $0$ instead.** The equality rule is the whole difficulty of this exercise.

Approach: **first** test all three pairs for equality (return $0$ on any match), **then** find the maximum by two cascaded comparisons.

**Signature lead-ins:**
- `CMP {Rn}, {operand}`: compute `Rn - operand`, set the APSR flags, discard the result.
- `BEQ {label}`: branch if `Z = 1` (equal). `BGT {label}`: branch if signed greater-than. `BHI {label}`: branch if unsigned higher.

```arm
@ r0, r1, r2 = three values -> r0 = max, or 0 if any two equal
max3:
    CMP  r0, r1
    BEQ  ret_zero        @ r0 == r1
    CMP  r0, r2
    BEQ  ret_zero        @ r0 == r2
    CMP  r1, r2
    BEQ  ret_zero        @ r1 == r2

    CMP  r0, r1          @ r0 := max(r0, r1)
    BGE  skip1
    MOV  r0, r1
skip1:
    CMP  r0, r2          @ r0 := max(r0, r2)
    BGE  skip2
    MOV  r0, r2
skip2:
    BX   LR

ret_zero:
    MOVS r0, #0
    BX   LR
```

> [!warning] Marks lost here
> - **Skipping a pair.** All *three* pairs must be checked: $(r0,r1)$, $(r0,r2)$, $(r1,r2)$. Checking only two misses the case where the *un-checked* pair is equal.
> - **Doing equality checks after the max logic.** Once you have overwritten `r0` with the max you can no longer compare the original three values. Equality tests must come *first*, while all three inputs are intact.
> - **Wrong branch sense.** `BGT`/`BGE` for signed inputs, `BHI`/`BHS` for unsigned. The mock pack's `max3u` (Paper 3 Ex 2) is explicitly *unsigned* and demands `BHS`, so read the prototype.
> - Returning $0$ via `MOV r0, #0` is fine, but if a flag-setting form is needed use `MOVS`.

### Exercise 3 — Fibonacci (~30 marks)

> [!info] Problem
> Given $n$ in `r0`, return the $n$-th Fibonacci number in `r0`, where $F_0 = 0$, $F_1 = 1$, $F_n = F_{n-1} + F_{n-2}$. May be solved iteratively or recursively.

**Iterative is strongly recommended:** it needs no stack management and has fewer failure modes. Keep two running values and loop $n$ times.

```arm
@ r0 = n -> r0 = nth Fibonacci number (iterative)
fib:
    CMP  r0, #1
    BLE  fib_done        @ F0 = 0, F1 = 1 -> n itself is the answer
    MOVS r1, #0          @ r1 = F(k-2)
    MOVS r2, #1          @ r2 = F(k-1)
    MOVS r3, #1          @ loop counter k, start at 1
fib_loop:
    CMP  r3, r0
    BGE  fib_end         @ counted up to n
    ADD  r12, r1, r2     @ next = F(k-2) + F(k-1)
    MOV  r1, r2          @ shift window
    MOV  r2, r12
    ADDS r3, r3, #1
    B    fib_loop
fib_end:
    MOV  r0, r2          @ result
    BX   LR
fib_done:
    BX   LR              @ n was 0 or 1; r0 already holds the answer
```

The recursive form must `PUSH {lr}` (and any registers it needs preserved across the inner `BL`) on entry and `POP` before `BX LR`, because each `BL` overwrites `LR`:

```arm
@ recursive skeleton: note the LR preservation
fib_rec:
    CMP  r0, #1
    BLE  base_case
    PUSH {r4, lr}        @ save LR + a callee-saved register
    MOV  r4, r0          @ keep n
    SUB  r0, r0, #1
    BL   fib_rec         @ fib(n-1)
    ...                  @ stash result, recurse for fib(n-2), add
    POP  {r4, lr}
    BX   LR
base_case:
    BX   LR
```

> [!warning] Marks lost here
> - **Recursion without saving `LR`.** The first inner `BL` overwrites `LR`; without `PUSH {lr}` the function cannot return, so it loops or crashes. This is the single most common Fibonacci error.
> - **Off-by-one on $n$.** Decide the indexing ($F_0=0$, $F_1=1$) and make the base case and loop bound consistent. Trace $n = 0, 1, 2$ by hand before moving on.
> - **Clobbering a callee-saved register** (`r4–r11`) without pushing it; the calling convention requires you preserve them.
> - Not handling $n \le 1$ as a base case.

> [!tip] Always trace small inputs
> Before declaring any practical exercise finished, dry-run it on the smallest cases: bit-check on index $0$ and the top bit; max-of-3 on "all different", "two equal", "all equal"; Fibonacci on $n = 0, 1, 2$. Paper exams give no compiler, so your hand-trace *is* the test suite.

---

## Theory question coverage

The mock pack's Section A pools the exact recall items the real exam draws from. Group them by topic so you can recognise the question type instantly.

| Topic area (syllabus module) | Mock Section A questions | How to recognise it |
|---|---|---|
| **Foundations** (Mod 1) | Embedded vs general-purpose; where code is stored (Flash); transistor role | "State one difference…", "is typically stored in…" |
| **Architecture** (Mod 1–2) | Datapath vs control; decode stage; registers vs memory speed; Von Neumann vs Harvard; ALU job; half/full adder; cache purpose | Asks for a *role* or a *one-line difference* |
| **Data representation** (Mod 2) | Little-endian byte order; `N/Z/C/V` flags; AND/OR/XOR; two's-complement overflow at `0x7FFFFFFF` | Bit patterns, hex values, flag tables |
| **C and pointers** (Mod 3) | `*(ptr+2)` meaning; pointer arithmetic scales by element size | Code snippet with a pointer |
| **ARM assembly** (Mod 3–4) | `MOV` vs `LDR` vs `STR`; `BL` vs `B`; `LR` purpose; `r0–r3` argument passing; `BGT` vs `BHI` | Instruction names in the stem |
| **Workflow & peripherals** (Mod 5) | Build/flash/debug; ST-LINK; breakpoints; disassembly; memory-mapped I/O; datasheet vs programming manual; interrupts/ISR; clocks; polling trade-offs | Tooling and Discovery-board vocabulary |
| **FPGA & Edge AI** (Mod 6) | FPGA definition; FPGA vs ASIC; LUT; BRAM; DSP blocks; DPU; **quantization**; bitstream; Zynq PS vs PL; Vitis AI flow | "What is a…" for FPGA-fabric terms |

### Historically under-prepared — fix these for the resit

> [!warning] FPGA + Quantization (Chapter 06): appeared in March 2026, was NOT reviewed
> An entire mock paper (Paper 4) is FPGA/Edge AI, and the first sitting confirms theory questions on it. Lock down these one-liners:
> - **FPGA:** a reconfigurable integrated circuit whose logic is programmed *after* manufacture.
> - **FPGA vs ASIC:** FPGA is reconfigurable; ASIC is fixed once fabricated (and more efficient, but expensive to design).
> - **LUT:** Lookup Table; implements arbitrary combinational logic in the fabric.
> - **BRAM:** Block RAM; on-chip memory for data and activations.
> - **DSP block:** dedicated arithmetic unit accelerating multiply-heavy operations.
> - **DPU:** Deep [Learning] Processing Unit; a dedicated FPGA-fabric accelerator for neural-network inference.
> - **Bitstream:** the configuration data that programs the FPGA fabric.
> - **Zynq PS vs PL:** Processing System (the hard processor) vs Programmable Logic (the configurable fabric).
> - **Quantization:** reducing numeric precision (typically to **INT8**), shrinking model size and compute cost so a model fits constrained edge hardware while keeping acceptable accuracy.
> - **Vitis AI flow:** model preparation → quantization → compilation for the target → run on hardware (e.g. VART runtime).

> [!warning] Memory hierarchy: SRAM vs DRAM vs Flash *mechanism* (Chapter 02)
> First sitting: the exam asked for the **hardware mechanism at the cell/transistor level**, not just the hierarchy ordering. Have the mechanism ready, not only the speed ranking:
>
> | Memory | Cell mechanism | Volatile? | Where it sits |
> |---|---|---|---|
> | **SRAM** | Flip-flop, typically $6$ transistors per bit; holds state while powered, no refresh | Volatile | Cache, fast on-chip RAM |
> | **DRAM** | One capacitor + one transistor per bit; charge leaks, so needs periodic **refresh** | Volatile | Main memory |
> | **Flash** | Floating-gate transistor; charge trapped on an insulated gate persists with no power | Non-volatile | Program storage / ROM-like |
>
> The mock pack tests the *behavioural* layer (Flash = non-volatile program store, RAM = volatile working memory); the real exam went one level deeper to the *physical cell*. Be ready for both.

---

## Study priority order

Revised after the first sitting, ordered by exam weight and by where marks were actually lost or surprises occurred.

| # | Topic | Chapter | Why this rank |
|---|---|---|---|
| 1 | **ARM assembly coding patterns** | Ch 04 | The entire $60\%$ practical is hand-written ASM: highest weight by far |
| 2 | **FPGA + Quantization** | Ch 06 | Appeared in March 2026 theory; was **not reviewed** (biggest gap) |
| 3 | **Memory hierarchy: SRAM/DRAM/Flash hardware** | Ch 02 | Asked at cell/transistor level, deeper than expected |
| 4 | **Functions, stack, calling convention** | Ch 04 | Underpins the Fibonacci exercise (the $30$-mark item) |
| 5 | **Embedded workflow** (build/flash/debug, peripherals) | Ch 05 | Straightforward theory; lower priority but easy marks |

> [!tip] How to spend revision time
> Roughly mirror the exam: spend most revision *writing assembly by hand* (bit-check, max-of-3, Fibonacci, plus the mock-pack exercises below) and a focused block memorising the FPGA/Edge AI and SRAM/DRAM/Flash one-liners. Theory beyond that is recognition, not derivation; the Fast Facts tables cover it.

---

## Coding and maths skills checklist

The practical and mathematical skills the exam directly tests. Drill each area before sitting.

### ARM assembly

- [ ] Read and write ARM Thumb instructions
  - [x] Data movement: `MOV`, `LDR`, `STR` → [[Data Movement with MOV, LDR, and STR]]
  - [x] Arithmetic and logic: `ADD`, `SUB`, `AND`, `ORR`, `LSL`, `LSR` → [[Arithmetic, Logical, and Shift Instructions]]
  - [ ] Comparison and branching: `CMP`, `B`, `BEQ`, `BNE`, `BGT`, `BHI`, etc. → [[Comparison, Condition Codes, and Branching]]
  - [ ] Function calls: `BL`, `BX`, `LR`, `PUSH`/`POP` → [[Functions, BL-BX, LR, Stack, and Calling Convention]]
- [ ] Write loops and conditionals in assembly → [[Loops, Selection, and Structured Assembly]]
- [ ] Trace function calls: track `r0–r3`, `LR`, stack pushes/pops
- [ ] Use memory-mapped I/O in assembly (GPIO) → [[Memory-Mapped I-O and GPIO in Assembly]]
- [ ] Integrate `.s` assembly files with C → [[Integrating Assembly with C in STM32 Projects]]

### C and pointers

- [x] Pointer arithmetic: `*(ptr + n)`, array indexing, call by reference → [[Arrays, Pointer Arithmetic, and Call by Reference]]
- [ ] Pointer types and scaling: `int *`, `char *` step by different sizes → [[C Data Types, Pointers, and Addresses]]
- [x] Bitwise operations: AND, OR, XOR, shifts, masks → [[Bitwise Operations, Masks, and Shifts]]

### Maths and bit-level skills

- [x] Binary ↔ decimal ↔ hex conversion (powers of two, nibble grouping) → [[Number Systems: Binary, Decimal, and Hex]]
- [x] Two's complement: signed vs unsigned interpretation, overflow → [[Fixed-Width Data, Signedness, and Overflow]]
- [x] Little-endian memory layout: how `0x12345678` sits in memory → [[Endianness and Memory Layout]]
- [x] APSR flags: $N$, $Z$, $C$, $V$, what sets them and what they mean for branches → [[APSR Flags and Arithmetic Meaning]]

> [!tip] Exam strategy
> The practical section is hand-written ARM assembly, so the assembly sub-list above carries the most marks. Drill comparison/branching and function-call tracing first: those are still unchecked and they appear in every practical exercise and the Fibonacci item.

---

## Embedded exam problem patterns

> [!info] Core definition
> A **workflow** is a repeatable solution procedure for a recurring problem type. The questions are formulaic enough that procedural fluency saves real exam time.

### Why workflows matter

Many embedded exam questions differ in surface wording more than in actual structure:

- A **pointer question** almost always reduces to type, base, scaling, and dereference order.
- A **branch question** almost always reduces to which instruction set the flags, what those flags mean, and whether the comparison is signed or unsigned.
- A **conversion question** almost always reduces to powers of two or nibble grouping.

A workflow does not replace understanding; it protects it under time pressure. Students often know the concept and still lose marks because they skip a step, assume the wrong signedness, or guess a bit pattern from memory. A workflow externalises the reasoning sequence and removes those avoidable mistakes.

### Pattern: number conversion

Move through powers of two or nibble groupings; never guess.

| Step | Action |
|---|---|
| 1 | Group bits into nibbles ($4$ bits) for hex, or use powers of $2$ for decimal |
| 2 | Convert each nibble / power independently |
| 3 | Reassemble; sanity-check magnitude |

### Pattern: pointer / memory-layout question

Identify type → base → step size → dereference level.

#### Pointer arithmetic on a binary address (seen in March 2026 exam)

Question format: *"Given a pointer to address $X$ (written in full binary), if we increment the pointer by $N$, what is the resulting address?"*

```text
1. Convert the binary address to hex or decimal (easier arithmetic)
2. Identify the pointer type (int*, char*, etc.)
3. Calculate step size: sizeof(type) in bytes
       char*  -> 1 byte per step
       short* -> 2 bytes per step
       int*   -> 4 bytes per step
4. Compute: new_address = base + (N x step_size)
5. Convert result back to binary if required
```

$$\text{new\_address} = \text{base} + (N \times \text{step\_size})$$

Worked example, `int *ptr`:

```text
int *ptr -> address = 0b...0010000000000000 = 0x2000 = 8192
ptr + 3  -> 8192 + (3 x 4) = 8192 + 12 = 8204 = 0x200C
```

> [!warning] The trap
> Do **not** add $N$ bytes directly. Pointer arithmetic depends on the pointee size, so always multiply $N$ by the element size.

### Pattern: branch-condition question

Decide what set the flags before picking a mnemonic.

```text
1. Find the instruction that set flags (usually CMP)
2. Determine what arithmetic/logical result it described
3. Decide signed vs unsigned interpretation
4. Match the correct branch mnemonic
```

Signed family: `BGT`, `BGE`, `BLT`, `BLE`. Unsigned family: `BHI`, `BHS`, `BLO`, `BLS`. The mock pack tests this directly: with `r0 = -1`, `r1 = 2` after `CMP r0, r1`, the *signed* `BLT` is taken but the *unsigned* `BHI` is also taken, because `-1` is `0xFFFFFFFF`, the largest unsigned value.

### Pattern: function-call / stack trace

Track `r0–r3` (arguments), `LR` (return address), stack pushes/pops, and preserved-register responsibilities. Always identify which registers a function must preserve before tracing it.

> [!warning] Common pitfalls
> - Jumping to a memorised answer without checking interpretation or type.
> - Forgetting that pointer arithmetic depends on pointee size.
> - Choosing branch conditions before deciding signed versus unsigned semantics.
> - Forgetting to `PUSH {lr}` when a function makes its own `BL` call.

---

## Mock pack walkthrough

The pack has four 100-mark papers (each $40$ theory / $60$ practical) plus condensed model solutions. Below is each question and what a full-marks answer needs.

### Paper 1 — Core Embedded Systems, Data Representation, ARM Basics

**Section A.** (1) Embedded vs general-purpose: embedded is *specialised, hardware-coupled, resource-constrained*. (2) Code is stored in **Flash / ROM-like non-volatile memory** (tick that box). (3) PC holds **the address of the next instruction**. (4) The datapath-plus-control view's two parts: **datapath and control**. (5) `0x12345678` little-endian = **`78 56 34 12`**. (6) ALU job: **arithmetic, logic, comparisons, shifts**. (7) Flags: `N` negative, `Z` zero, `C` carry/unsigned condition, `V` signed overflow. (8) `MOV` register/immediate, `LDR` memory→register, `STR` register→memory. (9) **`BGT`** is signed comparison; `BHI` is unsigned higher. (10) `*(ptr+2)` = the value **two `int` elements after `ptr`** (the third element).

**Section B.** *Ex 1 (`sum_to_n`, 20 marks):* loop summing $1..n$, return $0$ if $n \le 0$; needs labels, correct *signed* branches (`BLE`, `BGT`), and an explanation that `BGT` is right because the count is signed. *Ex 2 (pointers, 20 marks):* `ptr` stores `&arr[0]`; `a = 30`; final array `{10, 99, 30, 40}`; `ptr+2` scales by element size; `0x12345678` → `78 56 34 12`. *Ex 3 (memory-mapped I/O, 20 marks):* load-modify-store: `LDR` the register, `ORR …, #0x80` to set bit 7, `BIC …, #0x08` to clear bit 3, `STR` back; explain that peripheral registers sit at normal addresses so ordinary `LDR`/`STR` work.

### Paper 2 — Architecture, Flags, Functions, Assembly Tracing

**Section A.** (1) Datapath moves/transforms values; control issues steering signals. (2) Decode interprets the fetched instruction and generates control actions. (3) Registers are inside the CPU, close to the ALU. (4) Von Neumann shares instruction+data memory; Harvard separates them. (5) Half adder adds two bits; full adder also takes a **carry-in**. (6) `BL` branches *and* saves the return address in `LR`. (7) First four 32-bit args go in **`r0–r3`**. (8) `LR` holds the return address after a call. (9) `BGT` vs `BHI` differ because signed and unsigned branches interpret the *same flags* differently. (10) Cache reduces average access time by keeping hot data/instructions near the CPU.

**Section B.** *Ex 1 (tracing, 30 marks):* trace `r0`: `MOVS r0,#3`→3, `BL add5`→8, `BL twice`→16; final return **16**. Each `BL` redirects control flow *and* writes the return address to `LR`. `BX LR` returns to the address `BL` saved. If `add5` made its own call, the new `BL` would overwrite `LR`, so it must `PUSH {lr}` / `POP {lr}`. *Ex 2 (flags/bitwise, 30 marks):* with `r0=-1, r1=2`: `BGT` no, `BLT` yes, `BHI` yes, `BLO` no. `10110100 AND 00001111 = 00000100`; `OR = 10111111`; `XOR = 10111011`. `0x7FFFFFFF + 1 = 0x80000000`: signed overflow, now the most negative value. Odd test: `TST r0, #1` then branch to set `r1 = 1`/`0`.

### Paper 3 — Workflow, Debugging, Peripherals, Clocks, Integration

**Section A.** (1) Build = produce the binary, flash = program it into the MCU, debug = run with inspection/breakpoints. (2) ST-LINK = host-to-board programming/debug interface. (3) Disassembly links source behaviour to machine instructions/addresses. (4) Breakpoint stops execution at a chosen location. (5) Memory-mapped I/O = peripherals occupy normal address space. (6) Datasheet = device capabilities; programming manual = architecture, programming model, register semantics. (7) Interrupt redirects execution to handle an event promptly. (8) ISR = the routine that runs in response to an interrupt. (9) Peripherals need clocks to operate. (10) Polling: advantage is simple; disadvantage is wasted CPU time and added latency.

**Section B.** *Ex 1 (debug workflow, 20 marks):* confirm build/image, flash via ST-LINK, start a debug session, set breakpoints, single-step, inspect variables/registers/memory, compare with disassembly to find where behaviour diverges. *Ex 2 (`max3u`, 20 marks):* **unsigned** max-of-3: use `r0–r2`, **`BHS`** (unsigned higher-or-same) for the comparisons, return in `r0`; explain signed branches would be wrong because the inputs are explicitly unsigned. *Ex 3 (polling/interrupts/timers, 20 marks):* prefer a **mixture**: timer interrupt for the 500 ms LED toggle, interrupt for prompt button response, superloop for background work; the timer provides the time base; sketch: init GPIO+timer, enable button interrupt, ISR sets a flag/toggles, main loop handles background.

### Paper 4 — FPGA, Edge AI, Integrated Reasoning

**Section A.** (1) FPGA = reconfigurable IC, logic programmed after manufacture. (2) FPGA vs ASIC: FPGA reconfigurable, ASIC fixed once fabricated. (3) LUT implements combinational logic. (4) BRAM = on-chip storage. (5) DSP blocks accelerate arithmetic-heavy operations. (6) DPU = dedicated fabric accelerator for neural-network inference. (7) Quantization reduces numeric precision (often INT8), shrinking size/compute for constrained hardware. (8) Bitstream = the configuration data that programs the fabric. (9) Zynq: processing system = the processor side, programmable logic = the configurable fabric. (10) Vitis AI = model preparation, quantization, compilation, runtime execution.

**Section B.** *Ex 1 (Edge AI deployment, 30 marks):* compare **CPU only** (flexible, easy, less efficient), **FPGA+DPU** (configurable middle ground, efficient for targeted acceleration), **ASIC** (most efficient but inflexible and costly); Vitis AI workflow: prepare → quantize → compile for target → bitstream + runtime → execute (VART); quantization lowers precision (INT8) to cut cost while keeping accuracy; LUTs implement logic, BRAM stores activations, DSP blocks accelerate arithmetic. *Ex 2 (smart sensor node, 30 marks):* program code in **Flash**, runtime variables/stack/buffers in **RAM**; GPIO/timers/sensor registers are peripherals because they are hardware blocks *controlled by* the CPU, not the core itself; poll the status register at `0x40001000`: `LDR` it, `TST r1, #1`, `BEQ` back to the poll label, then `LDR r2, [data register]`; it is memory-mapped I/O because peripheral registers are accessed via normal addresses with ordinary loads.

```arm
@ Paper 4 Ex 2c — poll status reg, then read data reg
    LDR  r0, =0x40001000   @ status register address
poll:
    LDR  r1, [r0]
    TST  r1, #1            @ bit 0 set when data ready?
    BEQ  poll              @ not ready -> keep polling
    LDR  r1, =0x40001004   @ data register address
    LDR  r2, [r1]          @ read sensor data into r2
```

> [!tip] Use the pack as a timed mock
> Each paper is designed for ~2 h 10 min under timed conditions; attempt one fully *before* reading its solution. Paper 4 is the FPGA/Edge AI paper: do it first if Chapter 06 is the weak spot.

---

## Fast facts and core tables

> [!info] Core definition
> A **core fact** is a low-ambiguity item worth memorising exactly for fast recall. Memorise these only after the concept notes already make sense.

### Data representation

| Fact | Value |
|---|---|
| Size of `int` on this 32-bit platform | $4$ bytes |
| Decimal $25$ in binary | $11001_2$ |
| `1011 & 1101` | $1001_2$ |
| `0x12345678` in little-endian (increasing address) | `78 56 34 12` |
| `0x7FFFFFFF + 1` (signed 32-bit) | `0x80000000`: overflow, most negative value |

### Architecture and registers

| Item | Role |
|---|---|
| PC (Program Counter) | Address of the next instruction |
| LR (Link Register) | Return address saved by `BL` |
| APSR | Result flags $N$, $Z$, $C$, $V$ |
| `r0–r3` | First four function arguments; `r0` also returns the result |
| Flash / ROM | Persistent program storage (non-volatile); floating-gate cell |
| SRAM | Fast volatile memory; flip-flop cell (~6 transistors), no refresh |
| DRAM | Volatile main memory; capacitor + transistor cell, needs refresh |
| Cache | Keeps hot data/instructions near the CPU to cut access time |
| Harvard architecture | Separate instruction and data paths |

### Branch mnemonics

| Comparison | Signed | Unsigned |
|---|---|---|
| Greater than | `BGT` | `BHI` |
| Greater or equal | `BGE` | `BHS` |
| Less than | `BLT` | `BLO` |
| Less or equal | `BLE` | `BLS` |
| Equal / not equal | `BEQ` / `BNE` | `BEQ` / `BNE` |

> [!warning] Common pitfalls
> - Relying on memorised patterns without understanding why they hold.
> - Applying a memorised branch condition without checking signedness.

---

## Key exam workflows summary

A condensed lookup; scan this in the final minutes before the exam.

| Problem type | Workflow |
|---|---|
| Number conversion | Powers of $2$ / nibble grouping; never guess |
| Pointer question | type → base → step size → dereference level |
| Branch condition | what set flags → signed or unsigned? → pick mnemonic |
| Function call trace | `r0–r3` args → `LR` → stack push/pop → return value in `r0` |
| Bit-check practical | `LSR` by index → `AND #1` → `BX LR` |
| Max-of-3 practical | check all 3 pairs for equality FIRST → cascade `CMP`/branch → `BX LR` |
| Fibonacci practical | iterative two-value loop; recursive needs `PUSH {lr}` |

---

## Past exam coverage

- **March 2026, paper structure.** $40\%$ theory (closed multiple-choice, relatively easy; Chapters 01–04 sufficed) and $60\%$ practical: three hand-written ARM assembly exercises of increasing difficulty, bit-check (~$10$ pts), max-of-3 with equality→$0$ (~$20$ pts), Fibonacci (~$30$ pts).
- **March 2026, under-prepared topics.** **FPGA + Quantization (Ch 06)** appeared in theory and had not been reviewed. **Memory hierarchy** was asked at the **cell/transistor level** (SRAM flip-flop, DRAM capacitor+transistor, Flash floating gate), not just hierarchy order.
- **March 2026, pointer arithmetic on a binary address.** A pointer given as a full binary address, incremented by $N$; the answer needs converting to hex/decimal, identifying the pointer type, scaling $N$ by element size, converting back. Trap: adding $N$ bytes directly instead of $N \times \text{step\_size}$.
- **Recall-style quiz items.** Pure recall on `int` size, little-endian byte order, the role of the PC, and the contents of the APSR, answered directly from the Fast Facts tables.
- **Resit note.** The resit is the *same format* as the normal-period exam (syllabus §7). Everything above transfers; prioritise the [study priority order](#study-priority-order).
