# 05 Embedded Workflow and Tooling

**Lecture slides:** `Materials/Lecture 9 - STM32U5 architecture and GPIOs.pdf`, `Materials/Tutorial 0 - STM32CubeMXIDE setup.pdf`
**Past exam coverage:** Paper 3 §A Q1-Q10 + Exercise 1 (workflow / debugging), Paper 4 Exercise 2 (memory-mapped I/O polling), Paper 1 Exercise 3 (GPIO load-modify-store), Paper 2 Q10 (cache)

This chapter is the practical glue of the course: the STM32CubeIDE toolchain, the build → flash → debug loop, the documentation you must read, the STM32U5 chip architecture, register-level GPIO control, and the timing infrastructure (clocks, timers, interrupts) that decides *when* embedded code runs. None of it is pure architecture theory; it is the workflow you repeat every tutorial. Memorise the tool split (CubeMX / CubeIDE / CubeProgrammer / ST-LINK), the four-stage failure-isolation model, the STM32U5 block diagram (Cortex-M33 → AHB bus matrix → Flash/SRAM/APB), the GPIO register set and its memory-mapped addresses, the polling-vs-interrupt trade-off, and the fact that timing depends on the configured clock tree, not on source code alone.

---

## The STM32 Toolchain and Project Structure

> [!info] Definition
> **STM32CubeIDE** is the main integrated development environment used in the course for coding, building, flashing, and debugging STM32 projects. It folds most of the workflow into one environment, but conceptually the stages remain distinct.

Embedded development splits across four conceptual stages (**configuration**, **build**, **flash**, **debug**), and the course uses a small family of ST tools to cover them.

| Tool | Role | Stage it serves |
| --- | --- | --- |
| **STM32CubeMX** | Project setup; peripheral and clock configuration; code generation | Configuration |
| **STM32CubeIDE** | Coding, building, flashing, debugging in one IDE | Build + Debug |
| **STM32CubeProgrammer** | Standalone utility for programming STM32 devices | Flash |
| **ST-LINK** | On-board probe bridging host to MCU for programming and debugging | Flash + Debug |

The board used in the course is the **B-U585I-IOT02A discovery board**, with the **STLINK-V3E** probe built directly onto it, so no external programmer is needed. It carries an STM32U585AI MCU plus a rich set of on-board peripherals (Tutorial 0): user LEDs (LD6 red, LD7 green), a user push-button (B3), microphones, a camera connector, a VL53L5 time-of-flight sensor, a VEML6030 light sensor, and a separate STM32WB55 Bluetooth Low Energy module.

> [!warning] Common pitfall
> Treating **CubeMX** and **CubeIDE** as the same tool. CubeMX *generates and configures* the hardware/software skeleton (including peripheral and clock choices); CubeIDE *builds, flashes, and debugs* it. They are distinct steps in the mental model even though CubeMX functionality is embedded inside CubeIDE.

### Why stage thinking matters

Splitting the workflow into stages is not bureaucracy; it is **failure isolation**. Different failures occur in different stages and look different:

- A driver or installation issue → setup stage.
- A compile error → build stage.
- A board not detected → flash / connection stage.
- A program that runs but misbehaves → runtime stage on the board.

If something fails at setup time, identify whether the problem is installation, driver, board connection, or project configuration before changing any code.

> [!info] Setup-stage detail (Tutorial 0)
> Before connecting the board, the **STLINK-V3E driver** (`STSW-LINK009`) must be installed; otherwise board interfaces show as "Unknown" in Device Manager. The ST-LINK USB cable connects to **CN8**. Two back-of-board switches must be set so ST-LINK reaches the target MCU: **SW5 OFF, SW4 ON**. In CubeMX the project is started from `File → New Project → Board Selector → B-U585I-IOT02A`, initialising all peripherals to default mode and **without TrustZone activated**.

### The Tutorial 0 project-creation flow

The full first-tutorial sequence shows the configuration → build → flash chain end-to-end:

1. In CubeMX: install the **STM32U5** embedded software package, select the board, generate the pinout.
2. In the **Clock Configuration** tab inspect `HCLK` (the core/AHB clock).
3. In the **Project Manager** tab set the project name, location, and **Toolchain/IDE = STM32CubeIDE**.
4. In the **Code Generator** tab: *Copy only the necessary library files* and *Keep user code when regenerating*.
5. `Generate Code` → `Open Project` hands the project to CubeIDE.
6. In CubeIDE: edit `Core/Src/main.c` inside the `/* USER CODE BEGIN 3 */` section, then *Run As → STM32 C/C++ Application* to compile, flash, and run.

A first program toggles the two adjacent LEDs using the HAL layer:

```c
/* inside the while(1) loop, under USER CODE BEGIN 3 */
HAL_GPIO_TogglePin(GPIOH, GPIO_PIN_6);   /* red LED  = PH6 */
HAL_Delay(500);
HAL_GPIO_TogglePin(GPIOH, GPIO_PIN_7);   /* green LED = PH7 */
HAL_Delay(500);
```

### Project structure

Know the basic STM32 project tree: where **source** (`.c`, `.s`) and **header** (`.h`) files live (`Core/Src`, `Core/Inc`), and specifically **where to place custom assembly source and header files** so they are compiled and linked alongside the generated C code (see [[Integrating Assembly with C in STM32 Projects]]).

---

## The Build–Flash–Debug Workflow

> [!info] Core vocabulary
> - **Build** — compile and link source code into an executable image.
> - **Flash** — program the executable image into the MCU's non-volatile memory.
> - **Debug session** — a controlled execution session with breakpoints and state inspection.

Compiling a program is only *one* stage of making an embedded system work. The image must be transferred to the device, the device must start it correctly, and you often need a debug session to verify that the board state matches your expectations.

The workflow therefore separates into **host-side** and **target-side** steps. On the host you edit and build; on the target you flash, run, inspect, and iterate.

<figure class="diag-figure">
  <figcaption>The build–flash–debug loop — host-side editing and building, target-side flashing and inspection, iterating until behaviour is correct</figcaption>
  <svg viewBox="0 0 860 250" class="diag-svg" role="img" aria-label="Build flash debug workflow loop">
    <defs>
      <marker id="arr-w" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-w-acc" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <!-- host side label -->
    <text x="155" y="22" text-anchor="middle" class="d-sub">host side</text>
    <text x="610" y="22" text-anchor="middle" class="d-sub">target side (board)</text>

    <!-- pipeline nodes -->
    <rect x="20"  y="88" width="120" height="46" class="d-node"/>
    <text x="80"  y="108" text-anchor="middle" class="d-h-sm">Edit</text>
    <text x="80"  y="124" text-anchor="middle" class="d-sub">source</text>

    <rect x="170" y="88" width="120" height="46" class="d-node"/>
    <text x="230" y="108" text-anchor="middle" class="d-h-sm">Build</text>
    <text x="230" y="124" text-anchor="middle" class="d-sub">compile + link</text>

    <rect x="380" y="88" width="120" height="46" class="d-node-acc"/>
    <text x="440" y="108" text-anchor="middle" class="d-h-sm">Flash</text>
    <text x="440" y="124" text-anchor="middle" class="d-sub">via ST-LINK</text>

    <rect x="530" y="88" width="120" height="46" class="d-node-acc"/>
    <text x="590" y="108" text-anchor="middle" class="d-h-sm">Run / debug</text>
    <text x="590" y="124" text-anchor="middle" class="d-sub">breakpoints</text>

    <rect x="680" y="88" width="120" height="46" class="d-node-acc"/>
    <text x="740" y="108" text-anchor="middle" class="d-h-sm">Inspect</text>
    <text x="740" y="124" text-anchor="middle" class="d-sub">state</text>

    <!-- in-line arrows -->
    <line x1="140" y1="111" x2="168" y2="111" class="d-edge" marker-end="url(#arr-w)"/>
    <line x1="290" y1="111" x2="378" y2="111" class="d-edge" marker-end="url(#arr-w)"/>
    <line x1="500" y1="111" x2="528" y2="111" class="d-edge-acc" marker-end="url(#arr-w-acc)"/>
    <line x1="650" y1="111" x2="678" y2="111" class="d-edge-acc" marker-end="url(#arr-w-acc)"/>

    <!-- host/target divider -->
    <line x1="335" y1="40" x2="335" y2="200" class="d-edge dashed"/>

    <!-- iterate loop back -->
    <path d="M 740 134 C 740 190, 740 200, 600 200 L 80 200 L 80 136" class="d-edge dashed" marker-end="url(#arr-w)"/>
    <text x="410" y="218" text-anchor="middle" class="d-sub">modify code → rebuild</text>
  </svg>
</figure>

The repeated lifecycle in compact form:

```text
edit source -> build image -> flash target -> run/debug -> inspect state -> modify code -> rebuild
```

> [!warning] Common pitfall
> **"Build success" does not imply "correct board behaviour."** Flashing and runtime execution are separate stages: a program can compile cleanly and still fail because flashing failed, reset/startup misbehaved, or the runtime logic is wrong. Do not treat build and flash as the same step.

> [!tip] Exam tip
> If a program does not run on the board, the expected reasoning is to **classify the failure**: is it in compilation, flashing, reset/startup, or runtime logic? Each class has a different fix. Also note that debugging is not only for crashes — it is equally a tool for *understanding expected behaviour*. Paper 3 Exercise 1 asks exactly this: confirm the build and image, flash to non-volatile memory, use ST-LINK for the programming/debug connection, then use breakpoints + register/memory/disassembly views to isolate the divergence.

---

## Debugging: Breakpoints, Registers, Memory, and Disassembly

> [!info] Core vocabulary
> - **Breakpoint** — a marker that pauses execution when the PC reaches a selected instruction or source line.
> - **Disassembly view** — shows instruction addresses and decoded assembly instructions.
> - **Registers view** — shows current CPU register contents.
> - **Memory view** — shows raw contents of selected memory addresses.

Debugging at this level is a form of **observation**, not just bug fixing. The debugger lets you align two views of the program that often diverge: the simplified story you tell from the C source, and what the machine actually executes. Optimisation, calling conventions, and peripheral effects all cause that divergence, so the debugger is how abstract architecture concepts become visible.

| Debugger view | Reveals | Use it to... |
| --- | --- | --- |
| Breakpoints / stepping | Program state, instruction by instruction | Freeze execution at a chosen point |
| Registers | Live CPU datapath state | Find which register holds a variable now |
| Memory | Actual stored bytes at an address | Inspect endianness, pointers, data layout |
| Disassembly | Real instructions + their addresses | See what the machine truly runs |

A minimal observation pattern: set a breakpoint after an increment and inspect all three.

```c
int counter = 0;
counter = counter + 1;   /* breakpoint here */
```

At the breakpoint you can check the new value in the **register** view, the stored value in **memory**, and the instructions that implemented the increment in **disassembly**.

> [!warning] Common pitfalls
> - Assuming the same source variable always stays in the **same register** — the compiler reassigns registers freely.
> - Reading the memory pane **without accounting for endianness** and data-type size — bytes appear in a layout you must decode.

> [!tip] Exam tip
> Tutorials 1 and 2 are effectively debugger-literacy exercises and this is a **Tier 1** topic. Be ready to explain what a breakpoint does, why disassembly is useful, and how to connect a C variable to its machine-level location using the registers and memory views together. Disassembly addresses reveal *where* instructions are stored.

---

## Datasheets and Programming Manuals

> [!info] Core vocabulary
> - **Datasheet** — describes electrical, packaging, memory-map, and feature characteristics of a device.
> - **Programming manual** — explains the processor programming model, registers, instructions, and behaviour.
> - **Technical reference manual** — a detailed architecture reference for a processor core or subsystem.
> - **Reference manual (RM)** — the detailed peripheral/register reference for a specific MCU family (the STM32U5 family's is **RM0456**).

Embedded programming requires **documentation literacy** because lecture slides cannot contain every address, bitfield, timing condition, or peripheral rule. Datasheets and manuals are where the hardware contract is actually written down. The syllabus explicitly calls them out as crucial resources, and using them is a real study skill, not filler.

The four documents Tutorial 0 names as essential for this board:

| Document | Type | What it answers |
| --- | --- | --- |
| **STM32U585AI datasheet** | Datasheet | Pin functions, memory sizes, electrical limits, peripheral counts |
| **PM0264** — STM32 Cortex-M33 MCUs programming manual | Programming manual | Core programming model, instruction set, core registers |
| **Arm Cortex-M33 Technical Reference Manual** | Technical reference manual | Detailed core-architecture behaviour |
| **UM2839** — Discovery kit user manual | User manual | Board-level jumpers, switches, connectors, schematics |
| **RM0456** — STM32U5 reference manual | Reference manual | Peripheral register layouts, bitfields, offsets (e.g. GPIO `MODER`, `ODR`) |

The practical rule: **identify the type of fact you need before opening a document.**

```text
Need a pin function or memory size?            -> datasheet
Need a register layout, bit field, offset?     -> reference manual (RM0456)
Need a core instruction rule / programming model? -> programming manual (PM0264)
Need a board jumper or schematic?              -> user manual (UM2839)
```

This matters most when you leave abstract architecture and touch real hardware: peripheral setup, clocking, GPIO behaviour, and low-level control all depend on facts documented by the vendor, not derivable from slides (see [[Memory-Mapped I-O and GPIO in Assembly]] and [[Discovery Board, Peripherals, and Memory Types]]).

> [!warning] Common pitfall
> Treating **vendor libraries as a replacement for documentation**, or using the wrong document class for the wrong question. Choosing the correct document class first saves time and avoids reading the wrong source for the wrong kind of fact.

---

## The STM32U5 Architecture

> [!info] Definition
> The **STM32U5** is the ultra-low-power STM32 family used in this course. The B-U585I-IOT02A board carries the **STM32U585AI** variant: an **Arm Cortex-M33** core at **160 MHz** with TrustZone, an FPU, an MPU, and ETM trace, surrounded by an AHB bus matrix, on-chip Flash and SRAM, and a large set of peripherals reached over the APB.

The lecture introduces the chip top-down: a **core**, **caches**, an **AHB bus matrix**, an **APB**, **Flash and SRAM**, **timers**, **GPIO**, and **UART/I2C/SPI** communication peripherals.

<figure class="diag-figure">
  <figcaption>Simplified STM32U5 block diagram — the Cortex-M33 core reaches Flash and SRAM through the AHB bus matrix; the APB bus matrix fans out to GPIO ports and communication/timer peripherals</figcaption>
  <svg viewBox="0 0 860 380" class="diag-svg" role="img" aria-label="STM32U5 block diagram with core, AHB matrix, memories and peripherals">
    <defs>
      <marker id="arr-u" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-u-acc" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <!-- core -->
    <rect x="20" y="120" width="170" height="80" class="d-node-ink"/>
    <text x="105" y="150" text-anchor="middle" class="d-h-inv">Cortex-M33</text>
    <text x="105" y="170" text-anchor="middle" class="d-sub" fill="#fff">160 MHz · FPU</text>
    <text x="105" y="186" text-anchor="middle" class="d-sub" fill="#fff">TrustZone · MPU</text>

    <!-- caches -->
    <rect x="220" y="120" width="110" height="36" class="d-node"/>
    <text x="275" y="143" text-anchor="middle" class="d-sub">ICACHE 8 KB</text>
    <rect x="220" y="164" width="110" height="36" class="d-node"/>
    <text x="275" y="187" text-anchor="middle" class="d-sub">DCACHE 4 KB</text>

    <!-- AHB bus matrix -->
    <rect x="360" y="110" width="110" height="100" class="d-node-acc"/>
    <text x="415" y="150" text-anchor="middle" class="d-h-sm">AHB bus</text>
    <text x="415" y="166" text-anchor="middle" class="d-h-sm">matrix</text>
    <text x="415" y="186" text-anchor="middle" class="d-sub">160 MHz</text>

    <!-- Flash + SRAM -->
    <rect x="510" y="60" width="160" height="44" class="d-node"/>
    <text x="590" y="80" text-anchor="middle" class="d-h-sm">Flash (≤2 MB)</text>
    <text x="590" y="96" text-anchor="middle" class="d-sub">code + data, non-volatile</text>

    <rect x="510" y="116" width="160" height="44" class="d-node"/>
    <text x="590" y="136" text-anchor="middle" class="d-h-sm">SRAM (≈786 KB)</text>
    <text x="590" y="152" text-anchor="middle" class="d-sub">heap + stack + data</text>

    <!-- APB matrix -->
    <rect x="510" y="180" width="160" height="44" class="d-node-acc"/>
    <text x="590" y="200" text-anchor="middle" class="d-h-sm">APB bus matrix</text>
    <text x="590" y="216" text-anchor="middle" class="d-sub">low-bandwidth peripherals</text>

    <!-- peripherals -->
    <rect x="710" y="60" width="130" height="34" class="d-node"/>
    <text x="775" y="82" text-anchor="middle" class="d-sub">GPIO A…I</text>
    <rect x="710" y="104" width="130" height="34" class="d-node"/>
    <text x="775" y="126" text-anchor="middle" class="d-sub">Timers (19)</text>
    <rect x="710" y="148" width="130" height="34" class="d-node"/>
    <text x="775" y="170" text-anchor="middle" class="d-sub">USART · SPI · I2C</text>
    <rect x="710" y="192" width="130" height="34" class="d-node"/>
    <text x="775" y="214" text-anchor="middle" class="d-sub">ADC · DAC · AES</text>

    <!-- edges -->
    <line x1="190" y1="160" x2="218" y2="160" class="d-edge" marker-end="url(#arr-u)"/>
    <line x1="330" y1="160" x2="358" y2="160" class="d-edge" marker-end="url(#arr-u)"/>
    <line x1="470" y1="135" x2="508" y2="100" class="d-edge" marker-end="url(#arr-u)"/>
    <line x1="470" y1="150" x2="508" y2="138" class="d-edge" marker-end="url(#arr-u)"/>
    <line x1="470" y1="185" x2="508" y2="200" class="d-edge-acc" marker-end="url(#arr-u-acc)"/>
    <line x1="670" y1="195" x2="708" y2="120" class="d-edge-acc" marker-end="url(#arr-u-acc)"/>
    <line x1="670" y1="200" x2="708" y2="165" class="d-edge-acc" marker-end="url(#arr-u-acc)"/>
    <line x1="670" y1="205" x2="708" y2="209" class="d-edge-acc" marker-end="url(#arr-u-acc)"/>
    <line x1="670" y1="202" x2="708" y2="77"  class="d-edge-acc" marker-end="url(#arr-u-acc)"/>
  </svg>
</figure>

### The core

The **datapath-plus-control** view applies directly: a Control Unit feeds opcodes to an **Arithmetic & Logic Unit (ALU)**, which exchanges operands with the **register file** and addresses **instruction memory**, **data memory**, and **I/O peripherals**. The Cortex-M33 has separate code/data/system bus ports: a **C-Bus** (code), an **S-Bus** (system), and a peripheral path, all feeding the AHB bus matrix.

### ICACHE and DCACHE

| Cache | Bus | Purpose | Key behaviour |
| --- | --- | --- | --- |
| **ICACHE** | C-AHB (code bus) | Speeds up instruction (and data) fetches from internal and external memory | **0 wait-state on a cache hit**; *hit-under-miss* serves new requests during a line refill; 2-way set-associative with **pLRU-t** (pseudo-LRU, binary-tree) replacement |
| **DCACHE** | S-AHB (system bus) | Speeds up data traffic to/from external memories | Improves data-access performance |

> [!info] Why caches exist (Paper 2 Q10)
> A cache reduces *average* access time by keeping frequently used data or instructions physically close to the CPU. A hit is served with no wait state; a miss costs a line refill from slower memory.

### System buses — AMBA5

> [!info] Definition
> A **bus** is a communication system that transfers data between system components. The STM32U5 follows the **Advanced Microcontroller Bus Architecture (AMBA5)**.

| Bus | Full name | Designed for |
| --- | --- | --- |
| **AHB** | Advanced High-performance Bus | High-performance, high-clock-frequency transfers (core ↔ memory, DMA) |
| **APB** | Advanced Peripheral Bus | Low-bandwidth control accesses — register interfaces on system peripherals; reduced, low-complexity signal list for a low-frequency, narrow system |

The **AHB bus matrix** connects multiple **masters** (CPU, DMA controllers) to multiple **workers** (memory controllers, peripheral interfaces). A matrix, rather than a single shared bus, allows **concurrent access**: several high-speed peripherals can operate simultaneously without serialising every transfer. A dot in the RM0456 bus-matrix grid indicates a permitted master↔worker connection (e.g. ICACHE↔SRAM, DCACHE↔Flash).

### On-chip memories

- **Flash:** up to **2 MB** embedded Flash for programs and data; rated for ~**10,000** erase/write cycles; a **128-bit instruction prefetch** can optionally be enabled.
- **SRAM:** five SRAMs, with **SRAM1 (192 KB)**, **SRAM2 (64 KB)**, and **SRAM3 (512 KB)** as the main ones.

This connects to the memory-type hierarchy: Flash is non-volatile, surviving power-off and holding the program image; SRAM is volatile working memory for heap, stack, and data (see [[Discovery Board, Peripherals, and Memory Types]]).

> [!tip] Exam tip
> Architecture-block questions (Paper 4 Exercise 2) reward naming the split cleanly: program code lives in **Flash**; live runtime variables, stack, and buffers live in **SRAM/RAM**. GPIO, timers, and sensor registers are **peripherals** — hardware blocks controlled *by* the CPU, not the CPU core itself.

---

## Memory-Mapped I/O and the Cortex-M33 Memory Map

> [!info] Core vocabulary
> - **Port-mapped I/O** — peripherals live in a separate I/O address space, reached with special CPU instructions: `Special_instruction Reg, Port`.
> - **Memory-mapped I/O** — every peripheral register is assigned an address in the *same* address space as memory, reached with ordinary load/store instructions: `LDR/STR Reg, [Reg, #imm]`.

**ARM Cortex-M microprocessors use memory-mapped I/O.** Each device register is assigned a normal memory address, so writing to a peripheral is just a store. Writing to the GPIO Data Output Register at its mapped address physically changes a pin's output.

### The Cortex-M33 4 GB memory map

The 32-bit address space ($2^{32}$ = 4 GB) is divided into fixed regions:

| Region | Address range start | Size | Contents |
| --- | --- | --- | --- |
| **Flash** | `0x00000000` | 0.5 GB | On-chip non-volatile Flash — code & data, on C-AHB |
| **SRAM** | `0x20000000` | 0.5 GB | On-chip volatile SRAM — heap, stack & code, on S-AHB |
| **Peripheral** | `0x40000000` | 0.5 GB | AHB & APB peripherals — timers, GPIO |
| **External RAM** | `0x60000000` | 1 GB | Off-chip memory for data |
| **External Device** | `0xA0000000` | 1 GB | Off-chip devices, e.g. an SD card |
| **System** | `0xE0000000` | 0.5 GB | NVIC, System Timer, SCB, vendor-specific memory |

Within the SRAM region, the **stack grows down** from the SRAM end address (the stack pointer SP starts high), and the **heap grows up** from the data section; they grow toward each other.

### GPIO addresses inside the peripheral region

The peripheral region is subdivided. The GPIO ports are at the AHB2 peripheral base. From `stm32u585xx.h`:

```c
#define PERIPH_BASE_NS        (0x40000000UL)              /* peripheral non-secure base */
#define AHB2PERIPH_BASE_NS    (PERIPH_BASE_NS + 0x02020000UL)   /* = 0x42020000 */
#define GPIOA_BASE_NS         (AHB2PERIPH_BASE_NS + 0x0000UL)   /* = 0x42020000 */
#define GPIOB_BASE_NS         (AHB2PERIPH_BASE_NS + 0x0400UL)   /* = 0x42020400 */
/* each GPIO port occupies 1 KB (0x400 = 1024 bytes) */
```

So GPIO ports sit on a 1 KB stride: `GPIOA = 0x42020000`, `GPIOB = 0x42020400`, `GPIOC = 0x42020800`, `GPIOD = 0x42020C00`, and so on.

> [!warning] Common pitfall
> The slides show two base addresses for the GPIO region (`0x42020000` for the AHB2 non-secure view and `0x48000000` as an alternate view). For exam arithmetic use the `0x42020000` base from `stm32u585xx.h` unless told otherwise — and remember the **1 KB = 0x400** per-port stride.

> [!tip] Exam tip
> Paper 3 Q5 / Paper 4 Exercise 2(d): "why is this memory-mapped I/O?" — because peripheral registers occupy **normal addresses in the processor's address space** and are accessed with **ordinary `LDR`/`STR`** instructions, exactly like memory. That is also why Paper 1 Exercise 3(e) credits "peripheral registers occupy normal addresses, so `LDR`/`STR` work."

---

## GPIO: Ports, Pins, and the Register Set

> [!info] Definition
> A **GPIO** (General-Purpose Input/Output) is a digital signal pin, controllable by software, that may be used as an input, an output, or both.

On the STM32U5: **9 GPIO ports** (A–I; up to 10 on some U59x/5Ax/5Fx/5Gx parts), **up to 16 pins per port**, totalling up to 137 GPIOs depending on package. Each pin can be configured as:

- **Output** — push-pull or open-drain
- **Input** — with or without pull-up / pull-down
- **Alternate function** — connected to a peripheral (USART, SPI, timer, …)
- **Analog**

> [!warning] Common pitfall
> **After reset, all GPIOs are in analog mode** to reduce power consumption — *not* input mode. A pin does nothing digital until software configures its `MODER`.

### The basic I/O port-bit structure

Each pin is a small hardware cell (RM0456): an **input buffer** (a Schmitt trigger feeding the input data register and the alternate-function input), an **output buffer** (a PMOS/NMOS pair driven by the output control logic from either the output data register or an alternate-function output), software-switchable **pull-up (R_PU)** and **pull-down (R_PD)** resistors, an **analog path**, and **ESD protection diodes**.

### The GPIO register block

Each port is a contiguous block of 32-bit registers. From `stm32u585xx.h`, `GPIO_TypeDef`:

| Register | Offset | Width | Role |
| --- | --- | --- | --- |
| `MODER` | `0x00` | 32-bit (2 bits/pin) | Mode: input / output / alternate function / analog |
| `OTYPER` | `0x04` | 16 data bits | Output type: push-pull / open-drain |
| `OSPEEDR` | `0x08` | 32-bit (2 bits/pin) | Output speed: low / medium / fast / high |
| `PUPDR` | `0x0C` | 32-bit (2 bits/pin) | Pull-up / pull-down configuration |
| `IDR` | `0x10` | 16 data bits (read-only) | Input data register — reads pin states |
| `ODR` | `0x14` | 16 data bits | Output data register — drives pin states |
| `BSRR` | `0x18` | 32-bit (write-only) | Bit set/reset register — atomic set/clear |
| `LCKR` | `0x1C` | 32-bit | Configuration lock register |
| `AFR[0]`, `AFR[1]` | `0x20`–`0x24` | 32-bit each | Alternate-function selection (low/high pins) |
| `BRR` | `0x28` | 16 data bits | Bit reset register |
| `HSLVR` | `0x2C` | 32-bit | High-speed low-voltage register |
| `SECCFGR` | `0x30` | 32-bit | Secure configuration register |

The block spans **52 bytes**; **each register is 4 bytes (one word) wide**, even those that only use the low 16 bits.

<figure class="diag-figure">
  <figcaption>GPIO port register layout — a 1 KB port block; each 32-bit register is one word, addressed by adding its offset to the port base</figcaption>
  <svg viewBox="0 0 720 420" class="diag-svg" role="img" aria-label="GPIO register block with offsets">
    <defs>
      <marker id="arr-g" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="360" y="24" text-anchor="middle" class="d-h-sm">GPIOA block — base 0x42020000</text>

    <!-- register rows: y from bottom (MODER) to top (SECCFGR) -->
    <rect x="220" y="350" width="280" height="34" class="d-node-acc"/>
    <text x="360" y="372" text-anchor="middle" class="d-h-sm">MODER</text>
    <text x="180" y="372" text-anchor="end" class="d-sub">+0x00</text>

    <rect x="220" y="316" width="280" height="34" class="d-node"/>
    <text x="360" y="338" text-anchor="middle" class="d-sub">OTYPER  +0x04</text>
    <rect x="220" y="282" width="280" height="34" class="d-node"/>
    <text x="360" y="304" text-anchor="middle" class="d-sub">OSPEEDR  +0x08</text>
    <rect x="220" y="248" width="280" height="34" class="d-node"/>
    <text x="360" y="270" text-anchor="middle" class="d-sub">PUPDR  +0x0C</text>
    <rect x="220" y="214" width="280" height="34" class="d-node"/>
    <text x="360" y="236" text-anchor="middle" class="d-sub">IDR (read-only)  +0x10</text>

    <rect x="220" y="180" width="280" height="34" class="d-node-acc"/>
    <text x="360" y="202" text-anchor="middle" class="d-h-sm">ODR  +0x14</text>

    <rect x="220" y="146" width="280" height="34" class="d-node-acc"/>
    <text x="360" y="168" text-anchor="middle" class="d-h-sm">BSRR (write-only)  +0x18</text>

    <rect x="220" y="112" width="280" height="34" class="d-node"/>
    <text x="360" y="134" text-anchor="middle" class="d-sub">LCKR  +0x1C</text>
    <rect x="220" y="78" width="280" height="34" class="d-node"/>
    <text x="360" y="100" text-anchor="middle" class="d-sub">AFR[0] / AFR[1]  +0x20…0x24</text>
    <rect x="220" y="44" width="280" height="34" class="d-node"/>
    <text x="360" y="66" text-anchor="middle" class="d-sub">BRR · HSLVR · SECCFGR  +0x28…0x30</text>

    <!-- address callouts -->
    <text x="520" y="372" class="d-sub">0x42020000</text>
    <text x="520" y="202" class="d-sub">0x42020014</text>
    <text x="520" y="168" class="d-sub">0x42020018</text>
    <text x="180" y="60"  text-anchor="end" class="d-sub">52 bytes total</text>
    <text x="180" y="76"  text-anchor="end" class="d-sub">4 bytes / register</text>
  </svg>
</figure>

### MODER — the mode register

> Signature: `MODEy[1:0]` for pin `y` (y = 0…15). 32 bits, **2 bits per pin**.

| `MODER` bits | Mode |
| --- | --- |
| `00` | Input mode |
| `01` | General-purpose output mode |
| `10` | Alternate function mode |
| `11` | Analog mode (**reset state**) |

Pin `y` is configured by bits `[2y+1 : 2y]`. So pin 6 uses bits `[13:12]`, pin 7 uses bits `[15:14]`, pin 13 uses bits `[27:26]`.

A correct register edit is a **read-modify-write** with mask-and-set: first clear the field, then OR in the new value shifted to the pin's position.

```c
/* set PH6 (red LED) to general-purpose output */
GPIOH->MODER &= ~(GPIO_MODER_MODE6_Msk);                         /* clear the 2-bit field */
GPIOH->MODER |=  (MY_GPIO_MODE_OUTPUT << GPIO_MODER_MODE6_Pos);  /* write 01 into it      */
```

### OTYPER — output type

> Signature: `OTy` for pin `y`. 16 data bits (bits 31:16 reserved), **1 bit per pin**.

| `OTYPER` bit | Output type |
| --- | --- |
| `0` | Output push-pull (**reset state**) |
| `1` | Output open-drain |

```c
GPIOH->OTYPE &= ~(GPIO_OTYPER_OT_6);   /* clear bit 6 → push-pull */
```

### PUPDR — pull-up / pull-down

> 32 bits, **2 bits per pin**.

| `PUPDR` bits | Configuration |
| --- | --- |
| `00` | No pull-up, no pull-down |
| `01` | Pull-up |
| `10` | Pull-down |
| `11` | Reserved |

### IDR — input data register, and ODR — output data register

- **`IDR`** (offset `0x10`, **read-only**, bits 15:0 = `ID0`…`ID15`): each bit reflects the live logic level of the corresponding pin.
- **`ODR`** (offset `0x14`, read/write, bits 15:0 = `OD0`…`OD15`): each bit drives the corresponding output pin. Bits 31:16 are reserved.

Reading an input pin and acting on it:

```c
/* if PC13 (user button) reads high, set the green LED */
if ((GPIOC->IDR & GPIO_IDR_ID13) == GPIO_IDR_ID13) {
    GPIOH->BSRR = LED_GREEN_SET;
}
```

### BSRR — atomic bit set/reset

> Signature: `BSRR` — 32 bits, **write-only**. Bits 15:0 = `BS0`…`BS15` (**set**); bits 31:16 = `BR0`…`BR15` (**reset**).

Writing a `1` to bit `y` (0–15) **sets** output pin `y`; writing a `1` to bit `y+16` **resets** it. Writing `0` to any bit has no effect.

`BSRR` is the safe way to change one pin: it avoids the read-modify-write race that a direct `ODR |= ...` would suffer if an interrupt modified `ODR` between the read and the write.

```c
#define LED_RED_SET     (1U << 6)         /* PH6 set   */
#define LED_RED_RESET   (LED_RED_SET << 16)   /* PH6 reset (bit 22) */
#define LED_GREEN_SET   (1U << 7)         /* PH7 set   */
#define LED_GREEN_RESET (LED_GREEN_SET << 16) /* PH7 reset (bit 23) */

GPIOH->BSRR = LED_RED_SET;     /* turn red LED on  */
GPIOH->BSRR = LED_RED_RESET;   /* turn red LED off */
```

### Setting bit 8 of ODR — the worked register example

The lecture's running example: set output pin 8 of Port A high → set bit 8 of `GPIOA->ODR` (address `0x42020014`). `ODR` is **one word = 32 bits = 4 bytes** stored **little-endian**, so bit 8 lies in the second byte (`0x42020015`).

In C, the address is treated as a pointer to a 32-bit value and the bit is OR-ed in.

```c
*((uint32_t *) 0x42020014) |= 1UL << 8;   /* dereference the address, OR in bit 8 */
```

Cleaner: the whole port is described by a struct, and the base address is cast to a pointer to it.

```c
typedef struct {
    volatile uint32_t MODER;   /* +0x00  mode register            */
    volatile uint32_t OTYPER;  /* +0x04  output type register     */
    volatile uint32_t OSPEEDR; /* +0x08  output speed register    */
    volatile uint32_t PUPDR;   /* +0x0C  pull-up/pull-down        */
    volatile uint32_t IDR;     /* +0x10  input data register      */
    volatile uint32_t ODR;     /* +0x14  output data register     */
    volatile uint32_t BSRR;    /* +0x18  bit set/reset register   */
    volatile uint32_t LCKR;    /* +0x1C  configuration lock       */
    volatile uint32_t AFR[2];  /* +0x20  alternate function       */
    volatile uint32_t BRR;     /* +0x28  bit reset register       */
    volatile uint32_t HSLVR;   /* +0x2C  high-speed low voltage   */
    volatile uint32_t SECCFGR; /* +0x30  secure configuration     */
} GPIO_TypeDef;

#define GPIOA ((GPIO_TypeDef *) 0x42020000)

GPIOA->ODR |= 1UL << 8;        /* or, equivalently:  (*GPIOA).ODR |= 1UL << 8; */
```

> [!warning] Common pitfall
> Register pointers and struct fields **must be `volatile`**. Without it, the compiler may cache the value in a CPU register and skip the actual memory access — so a write never reaches the pin, or a poll loop reads a stale value forever.

### The same operation in assembly

> Signatures:
> `LDR {Rt}, [{Rn}]` — load the word at the address in `Rn` into `Rt`.
> `LDR {Rt}, =label` — pseudo-instruction loading a 32-bit constant/address into `Rt`.
> `ORR {Rd}, {Rn}, {operand}` — bitwise OR.
> `STR {Rt}, [{Rn}]` — store the word in `Rt` to the address in `Rn`.
> `.equ name, value` — assembler directive giving a symbolic name to a numeric constant.

```asm
.equ GPIOA_ODR, 0x42020000   @ symbolic name for GPIOA->ODR base address
        LDR  r0, =GPIOA_ODR  @ load the ODR address into r0
        LDR  r1, [r0]        @ read the current 32-bit value of ODR
        ORR  r1, r1, #0x100  @ set bit 8  (0x100 = 1 << 8)
        STR  r1, [r0]        @ write the modified value back
```

This is the canonical **read-modify-write** for a peripheral register: `LDR` → modify (`ORR` to set a bit, `BIC` to clear a bit) → `STR`. To **clear** a bit instead, use `BIC r1, r1, #mask`.

> [!tip] Exam tip
> Paper 1 Exercise 3 is exactly this pattern: a GPIO output register address is in `r0`; read it (`LDR r1,[r0]`), set bit 7 (`ORR r1,r1,#0x80`), clear bit 3 (`BIC r1,r1,#0x08`), write back (`STR r1,[r0]`). Lead each line with the instruction signature and label the bit-mask arithmetic — `1<<7 = 0x80`, `1<<3 = 0x08`.

---

## GPIO Output Modes, Speed, and Slew Rate

### Push-pull vs open-drain

| Aspect | Push-pull (`OTYPER`=0) | Open-drain (`OTYPER`=1) |
| --- | --- | --- |
| Transistors | Two — one to Vcc, one to GND | One — NMOS to GND only |
| Drive HIGH (output=1) | Upper transistor connects pin to Vcc — **sources current** | Transistor off — needs an **external pull-up resistor** to reach Vcc; otherwise floating/HiZ |
| Drive LOW (output=0) | Lower transistor connects pin to GND — **sinks/drains current** | Transistor connects pin to GND |
| Strength / speed | Strong drive both states; faster switching | High side weak, slower transitions (resistor-limited) |
| Shared lines | Cannot share a line — short-circuit risk if two drivers disagree | Multiple devices can share a line (**wired-AND**); safe for bidirectional buses |
| Typical use | Direct device control — **LEDs, SPI** | Shared communication lines — **I2C**, multi-drop low-side signalling |

### Output speed and slew rate

`OSPEEDR` selects one of **four output speeds**: Low, Medium, Fast, High. Speed controls how quickly the pin's voltage rises and falls.

> [!info] Definition
> **Slew rate** is the maximum rate of change of the output voltage:
> $$\text{Slew Rate} = \max\!\left(\frac{\Delta V}{\Delta t}\right)$$
> A high slew rate lets the output be toggled at a fast pin-switching speed; a low slew rate produces visibly rounded edges.

**Trade-off:** a higher GPIO speed increases **EMI noise** and **power consumption**. Configure speed to the peripheral's needs — **Low speed for toggling LEDs**, **High speed for SPI**.

### GPIO input: the three states

A digital input pin can be in one of three states: **High**, **Low**, or **High-Impedance** (also called *floating*, *tri-stated*, or *HiZ*). A floating input reads unpredictably, picking up noise. Pull resistors give it a defined default:

- **Pull-up** resistor → if the external input is HiZ, the pin reads a valid **HIGH**.
- **Pull-down** resistor → if the external input is HiZ, the pin reads a valid **LOW**.

> [!tip] Exam tip
> "Three states of a digital input" is a clean theory-MCQ candidate: High, Low, High-Impedance/floating. And: push-pull *sources and sinks*; open-drain only *sinks* and needs an external pull-up to go high. Pair these with their uses (LED/SPI vs I2C).

---

## Clock Trees, Peripheral Clocks, and Timing Configuration

> [!info] Core vocabulary
> - **System clock** — the main configured clock driving core MCU execution.
> - **Peripheral clock** — a clock delivered to a specific hardware block (GPIO, timers, comms).
> - **Clock tree** — the arrangement of clock sources, dividers, selectors, and distribution paths that determines how different parts of the MCU are timed.
> - **Clock gating** — enabling or disabling clocks to particular subsystems to control functionality and power use.
> - **HCLK** — the AHB clock; on this board it drives the core and AHB-side peripherals.
> - **RCC** — the Reset and Clock Control block, which owns the clock-enable registers.

A microcontroller does not simply "run at some speed." Different parts of the device can be fed by different clock sources, dividers, and gates. The STM32U5 clock sources include several internal oscillators (`HSI16`, `HSI48`, `MSI`, `LSI`) and **PLL1/2/3**. **Timing configuration is therefore an architectural concern, not just a performance setting.**

<figure class="diag-figure">
  <figcaption>A simplified clock tree — an oscillator source is multiplied by a PLL, then divided down to feed the core and individual peripherals; clock gating switches branches on or off</figcaption>
  <svg viewBox="0 0 840 290" class="diag-svg" role="img" aria-label="Clock tree from oscillator through PLL to bus and peripheral dividers">
    <defs>
      <marker id="arr-c" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-c-acc" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <!-- oscillator -->
    <rect x="20" y="118" width="130" height="50" class="d-node"/>
    <text x="85" y="139" text-anchor="middle" class="d-h-sm">Oscillator</text>
    <text x="85" y="155" text-anchor="middle" class="d-sub">clock source</text>

    <!-- PLL -->
    <rect x="200" y="118" width="120" height="50" class="d-node-acc"/>
    <text x="260" y="139" text-anchor="middle" class="d-h-sm">PLL</text>
    <text x="260" y="155" text-anchor="middle" class="d-sub">multiply</text>

    <!-- system clock -->
    <rect x="370" y="118" width="130" height="50" class="d-node-ink"/>
    <text x="435" y="139" text-anchor="middle" class="d-h-inv">System clock</text>
    <text x="435" y="155" text-anchor="middle" class="d-sub" fill="#fff">core execution</text>

    <!-- dividers fan-out -->
    <rect x="600" y="30"  width="210" height="48" class="d-node"/>
    <text x="705" y="50" text-anchor="middle" class="d-h-sm">Core / bus</text>
    <text x="705" y="66" text-anchor="middle" class="d-sub">divider ÷N</text>

    <rect x="600" y="118" width="210" height="48" class="d-node"/>
    <text x="705" y="138" text-anchor="middle" class="d-h-sm">Timer clock</text>
    <text x="705" y="154" text-anchor="middle" class="d-sub">divider ÷M (gated)</text>

    <rect x="600" y="206" width="210" height="48" class="d-node"/>
    <text x="705" y="226" text-anchor="middle" class="d-h-sm">GPIO / peripheral</text>
    <text x="705" y="242" text-anchor="middle" class="d-sub">divider ÷K (gated)</text>

    <!-- edges -->
    <line x1="150" y1="143" x2="198" y2="143" class="d-edge" marker-end="url(#arr-c)"/>
    <line x1="320" y1="143" x2="368" y2="143" class="d-edge" marker-end="url(#arr-c)"/>
    <path d="M 500 143 L 550 143 L 550 54 L 598 54" class="d-edge" marker-end="url(#arr-c)"/>
    <line x1="500" y1="143" x2="598" y2="143" class="d-edge-acc" marker-end="url(#arr-c-acc)"/>
    <path d="M 500 143 L 550 143 L 550 230 L 598 230" class="d-edge-acc" marker-end="url(#arr-c-acc)"/>
  </svg>
</figure>

A clock tree describes how clock sources are **selected, divided, gated, and distributed** to the core and peripherals. In practice, different subsystems can run at different effective rates and can even be disabled when not needed.

### Clock divider math

A peripheral or timer clock is the source clock scaled by a divider:

$$f_{\text{peripheral}} = \frac{f_{\text{source}}}{N}$$

A timer counts ticks from its input clock, so the real-world interval represented by a counter value of $\text{ARR}$ (auto-reload / period) is:

$$T_{\text{period}} = \frac{(\text{ARR} + 1)}{f_{\text{timer}}}$$

If $f_{\text{timer}}$ changes, the *same* counter value $\text{ARR}$ now represents a **different real-world time interval**, which is why timer reasoning is inseparable from clock reasoning.

### Clocks must be enabled before use — the GPIO clock gate

A peripheral must be **clocked before its register interface behaves as expected**. On the STM32U5 the GPIO ports sit on **AHB2**, and their clocks are gated by the **RCC AHB2 peripheral clock enable register 1 (`RCC_AHB2ENR1`)**.

> Each bit is an AND gate: `clock_for_port = SYSCLK AND GPIOxEN`. With the enable bit `0`, no clock reaches the port and its registers are inert.

| `RCC_AHB2ENR1` bit | Field | Enables |
| --- | --- | --- |
| 0 | `GPIOAEN` | Port A clock |
| 1 | `GPIOBEN` | Port B clock |
| 2 | `GPIOCEN` | Port C clock |
| … | … | … |
| 7 | `GPIOHEN` | Port H clock |

Setting the bit (`0` = disabled, `1` = enabled) is a single OR:

```c
RCC->AHB2ENR1 |= RCC_AHB2ENR1_GPIOHEN;   /* enable the clock for Port H */
RCC->AHB2ENR1 |= RCC_AHB2ENR1_GPIOCEN;   /* enable the clock for Port C */
```

This is the **first line** of every GPIO setup, before `MODER` and before `ODR`. The idea is architectural, not vendor-specific. It is also why **timing bugs and initialization bugs overlap**: a peripheral can appear "broken" when it was simply never given a running clock.

### Full GPIO output bring-up sequence

Putting the register set together to light the two on-board LEDs (PH6 red, PH7 green) at register level:

```c
#define LED_RED_SET     (1U << 6)
#define LED_RED_RESET   (LED_RED_SET   << 16)
#define LED_GREEN_SET   (1U << 7)
#define LED_GREEN_RESET (LED_GREEN_SET << 16)
enum { MY_GPIO_MODE_INPUT, MY_GPIO_MODE_OUTPUT, MY_GPIO_MODE_AF, MY_GPIO_MODE_ANALOG };

RCC->AHB2ENR1 |= RCC_AHB2ENR1_GPIOHEN;                          /* 1. enable Port H clock      */
GPIOH->MODER  &= ~(GPIO_MODER_MODE6_Msk);                       /* 2. clear PH6 mode field     */
GPIOH->MODER  &= ~(GPIO_MODER_MODE7_Msk);                       /*    clear PH7 mode field     */
GPIOH->MODER  |=  (MY_GPIO_MODE_OUTPUT << GPIO_MODER_MODE6_Pos); /* 3. PH6 → output             */
GPIOH->MODER  |=  (MY_GPIO_MODE_OUTPUT << GPIO_MODER_MODE7_Pos); /*    PH7 → output             */
while (1) {
    GPIOH->BSRR = LED_RED_SET;                                  /* 4. drive pins via BSRR      */
    GPIOH->BSRR = LED_GREEN_SET;
    GPIOH->BSRR = LED_RED_RESET;
    GPIOH->BSRR = LED_GREEN_RESET;
}
```

> [!warning] Common pitfalls
> - Treating the MCU as if **every hardware block runs at the same speed** automatically.
> - Ignoring **peripheral clock enable/state** when reasoning about GPIO or timers — forgetting the `RCC_AHB2ENR1` line is the classic "my LED won't light" bug.

> [!tip] Exam tip
> Clock gating is *both* a functional configuration concern *and* a power-management technique — disabling unused clocks saves power (see [[Power Management and Resource Constraints]]). When a question asks why a peripheral is inactive or why a timer period is wrong, the first conceptual check is the clock source and whether the clock is enabled — not the algorithm. Board-configuration tools (CubeMX) expose these clock decisions explicitly in the Clock Configuration tab.

---

## Interrupts, Exceptions, Timers, and Clocks

> [!info] Core vocabulary
> - **Interrupt** — a hardware or software event that temporarily redirects normal execution to handle an urgent condition.
> - **Exception** — a broader control-transfer event class that includes interrupts and other special execution conditions.
> - **Timer** — a hardware block that counts time-related events or cycles and can trigger actions or interrupts.
> - **Clock** — the timing signal or configured frequency source that drives synchronous digital operation.
> - **Interrupt service routine (ISR)** — the code executed in response to an interrupt or exception.

Straight-line execution is only *one* way a microcontroller behaves. Real embedded systems must also react to external events, periodic timing sources, and exceptional conditions that occur **asynchronously** with respect to the main program.

An interrupt is fundamentally a **control-flow event requested by hardware or software** rather than by the current line of code. The processor:

1. Saves enough context to resume later.
2. Jumps to a handler (the ISR).
3. Executes the urgent response.
4. Returns to the interrupted computation.

<figure class="diag-figure">
  <figcaption>Interrupt control flow — an asynchronous event suspends the main program, runs the ISR, and resumes where it left off</figcaption>
  <svg viewBox="0 0 820 220" class="diag-svg" role="img" aria-label="Interrupt suspends main program runs ISR and resumes">
    <defs>
      <marker id="arr-i" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-i-acc" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <!-- main flow segments -->
    <rect x="20"  y="100" width="180" height="44" class="d-node"/>
    <text x="110" y="127" text-anchor="middle" class="d-h-sm">Main program</text>

    <rect x="620" y="100" width="180" height="44" class="d-node"/>
    <text x="710" y="127" text-anchor="middle" class="d-h-sm">Main program</text>
    <text x="710" y="160" text-anchor="middle" class="d-sub">resumes</text>

    <!-- event -->
    <rect x="250" y="20" width="160" height="44" class="d-node-acc"/>
    <text x="330" y="41" text-anchor="middle" class="d-h-sm">Async event</text>
    <text x="330" y="57" text-anchor="middle" class="d-sub">timer / hardware</text>

    <!-- ISR -->
    <rect x="330" y="100" width="180" height="44" class="d-node-acc"/>
    <text x="420" y="121" text-anchor="middle" class="d-h-sm">ISR</text>
    <text x="420" y="137" text-anchor="middle" class="d-sub">save ctx · handle · return</text>

    <!-- edges -->
    <path d="M 330 64 L 330 98" class="d-edge-acc dashed" marker-end="url(#arr-i-acc)"/>
    <text x="345" y="84" class="d-sub">interrupt</text>
    <path d="M 200 122 L 280 122 L 280 122 L 328 122" class="d-edge" marker-end="url(#arr-i)"/>
    <line x1="510" y1="122" x2="618" y2="122" class="d-edge" marker-end="url(#arr-i)"/>
    <text x="565" y="112" text-anchor="middle" class="d-sub">return</text>
  </svg>
</figure>

**Timers** are a common source of those events because embedded systems need periodic behaviour: blinking, sampling, polling at intervals, scheduling work, or timing communication. The STM32U5 has **19 timers** (2× 16-bit advanced motor-control, 4× ultra-low-power, several 16-bit, 4× 32-bit). **Clocks** are the deeper layer beneath all of it: both the CPU and the timers derive their notion of time from configured clock sources. On Cortex-M, the **NVIC** (Nested Vectored Interrupt Controller, in the System region of the memory map) routes and prioritises interrupts.

A C-style ISR skeleton:

```c
volatile int tick_count = 0;

void TIM_IRQHandler(void) {
    tick_count++;
    /* clear timer interrupt flag here */
}

int main(void) {
    /* configure clock, timer, and interrupt routing */
    while (1) {
        /* main loop can react to tick_count or other state */
    }
}
```

The exact register names depend on the MCU, but the control structure is always the same: **hardware event → handler → state update → return.** A typical pattern is a timer configured to expire periodically and trigger an interrupt whose ISR toggles a GPIO output (e.g. an LED), without the main loop busy-waiting for delays.

> [!warning] Common pitfalls
> - Thinking interrupts are just ordinary function calls with **no execution-context implications**. They require automatic or software-managed context preservation before returning to normal execution — which is exactly why stack and register discipline matter (see [[Functions, BL-BX, LR, Stack, and Calling Convention]]).
> - Treating clocks as a vague "speed" concept rather than as a **configured timing basis** for the whole MCU.

> [!tip] Exam tip
> The syllabus explicitly places **timers and hardware/software interrupts** inside the architecture scope. If a system must react to an event without constant polling, interrupt-driven handling is the expected answer; if a delay or timing relationship matters, name the timer or clock source driving it. Distinguish three things cleanly: event handling, timing hardware, and clock configuration. Paper 3 Exercise 3 wants exactly this: a timer (or timer interrupt) gives the 500 ms time base for periodic LED toggling; a button needs interrupt or event-based detection for promptness; a superloop can still handle background work.

---

## Polling, Superloops, and Event-Driven Design

> [!info] Core vocabulary
> - **Polling** — repeatedly checking a condition or hardware state in ordinary program flow to see whether an event has occurred.
> - **Superloop** — a simple embedded execution model built around an infinite main loop that repeatedly performs checks and work.
> - **Event-driven design** — a design style where control flow is triggered by external or asynchronous events, often through interrupts.

The interrupt material only becomes meaningful when contrasted with ordinary polling and superloop execution. The **superloop** is the simplest embedded control structure: initialise once, then run an infinite loop that checks inputs, updates state, and drives outputs. It is easy to understand because control flow stays explicit in one place.

**Event-driven** designs trade simplicity for responsiveness and CPU efficiency: instead of checking continuously, the system reacts when an event occurs and lets the main loop handle less urgent work.

```c
/* Superloop style — polling */
while (1) {
    if (button_pressed()) {
        toggle_led();
    }
}
```

```text
Interrupt style:
  hardware detects the event
  -> control jumps to an ISR
  -> the ISR toggles the LED or sets a flag for main-loop code
```

A register-level **polling** loop (wait until a status-register bit is set, then read a data register) is a standard exam pattern:

```asm
        LDR  r0, =0x40001000   @ status register address
poll:   LDR  r1, [r0]          @ read the status register
        TST  r1, #1            @ test bit 0
        BEQ  poll              @ not ready yet → keep polling
        LDR  r1, =0x40001004   @ data register address
        LDR  r2, [r1]          @ read the data value
```

| Aspect | Polling / superloop | Event-driven / interrupts |
| --- | --- | --- |
| Control flow | Explicit, in one place | Triggered asynchronously |
| CPU usage | Can waste cycles checking when nothing changed | Reacts only when the event occurs |
| Latency | Bounded by the loop period between checks | Low — responds immediately |
| Debugging | Easier — flow is predictable | Harder — control jumps asynchronously |
| Best for | Simple, predictable tasks | Rare or timing-sensitive events |

> [!warning] Common pitfalls
> - Assuming event-driven design means **ordinary main-loop logic disappears completely** — real systems usually combine a superloop *with* interrupts.
> - Assuming polling is always wrong, rather than understanding it as **simple but inefficient** when events are rare.

> [!tip] Exam tip
> Compare these execution styles along three axes: **responsiveness, CPU usage, and control-flow structure.** The design choice is about workload shape, latency needs, and resource usage — not about one style being universally "correct." Expect the question "can a system use both a main loop and interrupts?" — the answer is yes, and that is the normal case. Paper 3 Q10 wants one advantage (simple to understand) and one disadvantage (wastes CPU time, can increase latency) of polling.

---

## Exam Focus Summary

| Topic | Priority | Must be able to... |
| --- | --- | --- |
| GPIO register-level config | **Tier 1** | Name `MODER`/`OTYPER`/`PUPDR`/`IDR`/`ODR`/`BSRR` with offsets; do read-modify-write in C and ASM; compute bit positions (pin y → bits 2y..2y+1) |
| Memory-mapped I/O | **Tier 1** | Explain why `LDR`/`STR` reach peripherals; locate GPIO at `0x42020000` with 1 KB stride; little-endian byte layout |
| Debugging views | **Tier 1** | Explain breakpoints, disassembly, register/memory views; connect a C variable to machine state |
| STM32 toolchain | **Tier 1** | Name the three ST tools + ST-LINK; know project structure and where assembly files go |
| STM32U5 architecture | Tier 2 | Sketch core → AHB matrix → Flash/SRAM/APB; explain AHB vs APB; ICACHE/DCACHE; where code vs data live |
| Clock enable & gating | Tier 2 | Explain `RCC_AHB2ENR1` GPIO clock gate; relate timer frequency and dividers; link gating to power |
| Build–flash–debug | Tier 2 | Distinguish build / flash / debug; explain why a clean compile can still fail on the board |
| Interrupts & timers | Tier 2 | Define interrupt / ISR / timer; explain context saving; contrast with polling |
| Polling vs event-driven | Tier 2 | Compare superloop vs interrupt design on responsiveness, CPU, control flow |
| GPIO output modes | Tier 2 | Push-pull vs open-drain; output speed / slew rate trade-off; three input states |
| Datasheets & manuals | Tier 2 | Distinguish datasheet / RM0456 / PM0264 / UM2839; know which to consult for which fact |

---

## Past exam coverage

- **Paper 3 §A Q1 — "Difference between build, flash, and debug?"** Build creates the binary; flash programs it into the MCU; debug runs with inspection and breakpoints.
- **Paper 3 §A Q2 — "What is ST-LINK used for?"** The host-to-board programming and debugging interface (the STLINK-V3E is integrated on the board, reached via CN8).
- **Paper 3 §A Q3 — "Why is the disassembly view useful?"** It shows generated instructions and their addresses, linking source behaviour to machine execution.
- **Paper 3 §A Q4 — "What is a breakpoint?"** A marker that stops execution at a chosen location.
- **Paper 3 §A Q5 — "What is memory-mapped I/O?"** Peripherals occupy addresses in the normal processor address space, reached with ordinary `LDR`/`STR`.
- **Paper 3 §A Q6 — "Datasheet vs programming manual?"** Datasheet = device capabilities/characteristics; programming manual = architecture, programming model, register semantics.
- **Paper 3 §A Q7-Q9 — interrupts, ISRs, peripheral clocks.** An interrupt redirects normal execution to handle an event promptly; an ISR is the routine that runs in response; peripherals depend on clock sources to operate correctly.
- **Paper 3 §A Q10 — polling advantage/disadvantage.** Advantage: simple to understand. Disadvantage: wastes CPU time, can increase latency.
- **Paper 3 Exercise 1 — debugging workflow on the Discovery board.** Confirm the build/image; flash to non-volatile memory; use ST-LINK for the connection; use breakpoints + single-step + register/memory/disassembly views to find where behaviour diverges from expectation.
- **Paper 3 Exercise 3 — polling, interrupts, timers, control-flow design.** Best answer is usually a mixture: timer (interrupt) for the 500 ms LED time base; interrupt/event detection for prompt button response; superloop for background work.
- **Paper 1 Exercise 3 — memory-mapped I/O load-modify-store.** GPIO output register address in `r0`: `LDR r1,[r0]` → `ORR r1,r1,#0x80` (set bit 7) → `BIC r1,r1,#0x08` (clear bit 3) → `STR r1,[r0]`. Peripheral registers occupy normal addresses so `LDR`/`STR` work.
- **Paper 4 Exercise 2 — mixed embedded-system design.** Program code lives in Flash; runtime variables/stack/buffers in RAM; GPIO, timers, and sensor registers are peripherals (hardware blocks controlled by the CPU, not the core). Polling loop: `LDR` status → `TST #1` → `BEQ` loop → `LDR` data. It is memory-mapped I/O because the peripheral registers use normal addresses and normal load instructions.
- **Paper 2 §A Q10 — "What is cache for?"** Reduces average access time by holding frequently used data/instructions close to the CPU — the ICACHE/DCACHE rationale on the STM32U5.
