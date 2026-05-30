# 06 FPGA and Edge AI

**Lecture coverage:** Lecture 9 (FPGAs), Lecture 10 (Vitis AI and quantization), Tutorial 0 (Vitis AI setup), `Solutions.pdf`
**Syllabus:** FPGAs, DPU, and Vitis AI are explicitly named learning goals.

This chapter bridges classic embedded systems and hardware-accelerated AI deployment. It runs from the FPGA as a configurable hardware fabric (LUTs, CLBs, switch boxes, bitstreams), through the FPGA/CPU/ASIC trade-off space, into the applied edge-AI story: why constrained devices struggle with neural-network inference, how quantization shrinks models, and how the DPU, Vitis AI, and Zynq runtime stack deploy a model onto programmable logic. Per the exam feedback, **FPGA fundamentals and quantization appeared in theory questions and were not reviewed last time**, so treat the boxed facts in those sections as priority memorisation.

---

## What an FPGA Actually Is

> [!info] Definition: FPGA
> An **FPGA** (Field-Programmable Gate Array) is a reconfigurable integrated circuit whose logic can be programmed *after* manufacturing. **Reconfigurable logic** is hardware whose internal connections and behaviour are defined by configuration data rather than fixed permanently in silicon. The configurable logic and routing resources inside it are the **programmable fabric**.

An FPGA is best understood as a *configurable hardware fabric*, not a strange kind of processor. Instead of fetching and executing one instruction stream like a CPU, an FPGA is *configured into a digital circuit* whose structure becomes the hardware behaviour. Once configured, it behaves like a purpose-built circuit for that task.

You configure **structure**, not an instruction stream. A CPU reuses the same hardware and changes behaviour by executing different instructions over time. An FPGA changes behaviour by changing the logic and routing that *physically* implement the computation.

| Viewpoint | How behaviour is set |
| --- | --- |
| **CPU** | fetch instruction → decode → execute → repeat |
| **FPGA** | configure circuit → apply signals → circuit responds in hardware |

The cleanest contrast for exam answers: a CPU changes behaviour through instructions over time, while an FPGA changes behaviour through configured structure.

This matters because some workloads benefit from custom parallel data paths rather than general instruction execution. If an operation is highly regular and can be expressed as repeated hardware structure, the FPGA can evaluate many pieces of the computation at once rather than stepping through them serially in software. That is the architecture-level reason hardware acceleration appears in the course at all.

Reconfigurability is the **middle ground** between software flexibility and ASIC specialisation: an FPGA allows post-manufacturing hardware specialisation without the fixed-design cost of an ASIC.

> [!tip] Exam answers
> - **Why are FPGAs useful?** → custom hardware acceleration plus post-manufacturing configurability.
> - **What makes them different from ASICs?** → reprogrammability.
> - **Why attractive in embedded computing?** → custom parallel data paths for regular, arithmetic-heavy workloads, configurable after manufacturing.

> [!warning] Common pitfalls
> - Calling an FPGA "just a fast CPU." It is a configurable circuit fabric, not a processor running an instruction stream.
> - Ignoring the difference between *configuration* and ordinary software *execution*.

The course does not require hardware-description-language design depth. It requires the correct conceptual model: what kind of thing an FPGA is, why it differs from a CPU, and why it matters for embedded acceleration and later DPU deployment.

---

## FPGA Building Blocks: LUTs, CLBs, Flip-Flops, BRAM, DSP

> [!info] Definitions: the FPGA resource vocabulary
> - **LUT** (Look-Up Table): a configurable logic element used to implement combinational functions.
> - **CLB** (Configurable Logic Block): a basic FPGA functional unit combining LUT-based logic and storage elements.
> - **Flip-flop**: a storage element used for sequential logic.
> - **BRAM** (Block RAM): dedicated on-chip memory blocks in an FPGA.
> - **DSP block**: a dedicated arithmetic block optimised for operations such as multiply-add and signal processing.

These specialised resources exist because **one kind of hardware block is not ideal for every job**. LUTs implement general combinational logic, flip-flops hold state, BRAM stores larger amounts of on-chip data efficiently, and DSP blocks accelerate arithmetic that would otherwise consume too much generic fabric. Specialised blocks improve performance and area efficiency over building everything from generic logic alone.

| Design need | FPGA resource to reach for |
| --- | --- |
| General / arbitrary Boolean logic | LUTs and CLBs |
| Stored state (sequential behaviour) | Flip-flops |
| Larger on-chip memory | BRAM |
| Multiply/add-heavy arithmetic | DSP blocks |

This is not a full synthesis rule, but it is exactly the conceptual mapping the course expects you to recognise.

<figure class="diag-figure">
  <figcaption>Inside a Configurable Logic Block — LUTs feed flip-flops; CLBs sit in a sea of routing with BRAM and DSP blocks alongside</figcaption>
  <svg viewBox="0 0 780 280" class="diag-svg" role="img" aria-label="FPGA reconfigurable fabric: CLB internals plus specialised blocks">
    <defs>
      <marker id="arr-fab" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <!-- CLB outer box -->
    <rect x="20" y="40" width="320" height="170" class="d-node"/>
    <text x="180" y="62" text-anchor="middle" class="d-h-sm">Configurable Logic Block (CLB)</text>

    <!-- LUTs inside CLB -->
    <rect x="45"  y="84" width="110" height="46" class="d-node-acc"/>
    <text x="100" y="104" text-anchor="middle" class="d-h-sm">LUT</text>
    <text x="100" y="120" text-anchor="middle" class="d-sub">combinational fn</text>

    <rect x="45"  y="146" width="110" height="46" class="d-node-acc"/>
    <text x="100" y="166" text-anchor="middle" class="d-h-sm">LUT</text>
    <text x="100" y="182" text-anchor="middle" class="d-sub">combinational fn</text>

    <!-- Flip-flops inside CLB -->
    <rect x="205" y="84" width="110" height="46" class="d-node"/>
    <text x="260" y="104" text-anchor="middle" class="d-h-sm">Flip-flop</text>
    <text x="260" y="120" text-anchor="middle" class="d-sub">stored state</text>

    <rect x="205" y="146" width="110" height="46" class="d-node"/>
    <text x="260" y="166" text-anchor="middle" class="d-h-sm">Flip-flop</text>
    <text x="260" y="182" text-anchor="middle" class="d-sub">stored state</text>

    <line x1="155" y1="107" x2="203" y2="107" class="d-edge" marker-end="url(#arr-fab)"/>
    <line x1="155" y1="169" x2="203" y2="169" class="d-edge" marker-end="url(#arr-fab)"/>

    <!-- routing fabric label -->
    <line x1="340" y1="125" x2="408" y2="125" class="d-edge" marker-end="url(#arr-fab)"/>
    <text x="374" y="115" text-anchor="middle" class="d-sub">routing</text>

    <!-- specialised blocks column -->
    <rect x="415" y="60" width="160" height="56" class="d-node"/>
    <text x="495" y="84" text-anchor="middle" class="d-h-sm">BRAM</text>
    <text x="495" y="103" text-anchor="middle" class="d-sub">on-chip memory</text>

    <rect x="415" y="140" width="160" height="56" class="d-node"/>
    <text x="495" y="164" text-anchor="middle" class="d-h-sm">DSP block</text>
    <text x="495" y="183" text-anchor="middle" class="d-sub">multiply-add</text>

    <!-- I/O note -->
    <rect x="610" y="100" width="150" height="56" class="d-node-ink"/>
    <text x="685" y="124" text-anchor="middle" class="d-h-inv">Programmable</text>
    <text x="685" y="142" text-anchor="middle" class="d-h-inv">I/O + interconnect</text>
  </svg>
</figure>

> [!warning] Common pitfalls
> - Treating BRAM or DSP blocks as just names for caches or CPU ALUs. They are dedicated FPGA hardware blocks.
> - Forgetting that LUTs implement *logic functions*, not long-term general-purpose program storage.

---

## Reconfigurable Structure: PLAs, Switch Boxes, and Bitstreams

FPGA programmability depends on more than local logic cells. Earlier programmable logic devices showed that configurable logic is useful; modern FPGAs scale that idea by combining configurable logic with **rich, programmable interconnect**.

> [!info] Definitions: the structural side of programmability
> - **PLA** (Programmable Logic Array): an earlier programmable logic structure built from configurable AND/OR arrays. Historically, FPGAs are a more advanced, flexible evolution of the PLA.
> - **Switch box**: a programmable interconnect element that routes signals between configurable blocks in an FPGA.
> - **Bitstream**: the configuration data that programs the FPGA fabric into a desired hardware design (both logic behaviour *and* routing structure).
> - **Place-and-route**: a hardware-design tool step that maps logic onto physical resources and configures interconnect paths.

Programmability requires **both configurable computation and configurable connectivity**. LUTs without interconnect are not enough; switch boxes provide that interconnect.

The bitstream is not handwritten the way assembly is. Designers describe logic behaviour at a higher level, synthesis maps it into hardware resources, place-and-route fits it onto the device fabric, and the resulting configuration is emitted as a bitstream. The bitstream is the *final configuration artifact*, not the original design source: it makes the FPGA behave like the intended circuit on the target hardware.

<figure class="diag-figure">
  <figcaption>FPGA design tool-flow — a high-level design becomes a bitstream that configures the fabric</figcaption>
  <svg viewBox="0 0 840 120" class="diag-svg" role="img" aria-label="FPGA configuration flow from logic design to programmed FPGA">
    <defs>
      <marker id="arr-flow" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <rect x="12"  y="38" width="130" height="46" class="d-node"/>
    <text x="77"  y="58" text-anchor="middle" class="d-h-sm">Logic design</text>
    <text x="77"  y="74" text-anchor="middle" class="d-sub">HDL / high level</text>

    <rect x="172" y="38" width="130" height="46" class="d-node"/>
    <text x="237" y="58" text-anchor="middle" class="d-h-sm">Synthesis</text>
    <text x="237" y="74" text-anchor="middle" class="d-sub">map to resources</text>

    <rect x="332" y="38" width="130" height="46" class="d-node"/>
    <text x="397" y="58" text-anchor="middle" class="d-h-sm">Place &amp; route</text>
    <text x="397" y="74" text-anchor="middle" class="d-sub">fit onto fabric</text>

    <rect x="492" y="38" width="150" height="46" class="d-node-acc"/>
    <text x="567" y="58" text-anchor="middle" class="d-h-sm">Bitstream gen</text>
    <text x="567" y="74" text-anchor="middle" class="d-sub">config artifact</text>

    <rect x="672" y="38" width="150" height="46" class="d-node-ink"/>
    <text x="747" y="58" text-anchor="middle" class="d-h-inv">Program FPGA</text>
    <text x="747" y="74" text-anchor="middle" class="d-sub" fill="#fff">configured circuit</text>

    <line x1="142" y1="61" x2="170" y2="61" class="d-edge" marker-end="url(#arr-flow)"/>
    <line x1="302" y1="61" x2="330" y2="61" class="d-edge" marker-end="url(#arr-flow)"/>
    <line x1="462" y1="61" x2="490" y2="61" class="d-edge" marker-end="url(#arr-flow)"/>
    <line x1="642" y1="61" x2="670" y2="61" class="d-edge" marker-end="url(#arr-flow)"/>
  </svg>
</figure>

> [!tip] Exam answers
> - **What is a switch box?** → a programmable interconnect element routing signals between configurable blocks.
> - **What is a bitstream?** → the configuration data that programs both logic and routing into the fabric.
> - **How are FPGAs related to PLAs?** → an evolution: configurable logic plus rich programmable interconnect.
> - **Broad tool-flow?** → design → synthesis → place-and-route → bitstream generation → program FPGA.

> [!warning] Common pitfalls
> - Thinking an FPGA is "programmed" only by compiling software the way a CPU application is.
> - Focusing only on LUT counts and ignoring the routing fabric.

---

## FPGA vs CPU vs ASIC: Hardware Acceleration

> [!info] Definitions
> - **CPU**: a general-purpose processor optimised for flexible sequential instruction execution.
> - **ASIC** (Application-Specific Integrated Circuit): a hardware design fixed for a particular purpose at fabrication time.
> - **Hardware acceleration**: speeding up specific workloads using specialised hardware rather than relying only on a general-purpose CPU.

A CPU emphasises **flexibility**, an ASIC emphasises **fixed-function efficiency**, and an FPGA occupies the **middle ground** by letting you build task-specific hardware after manufacturing. The comparison is about trade-offs, not winners.

| Device | Programmability / flexibility | Efficiency for a chosen workload | Changeable after fabrication |
| --- | --- | --- | --- |
| **CPU** | High: easy to program, fully general | Lower: pays general instruction-execution overhead | N/A (software) |
| **FPGA** | Medium: reconfigurable custom hardware | Good: custom parallel data paths | Yes, reprogrammable |
| **ASIC** | Low: fixed at fabrication | Highest: purpose-built | No, fixed silicon |

```text
CPU  -> flexible instruction execution
FPGA -> reconfigurable custom hardware
ASIC -> fixed-purpose optimized hardware
```

Acceleration is **specialisation**, not a universal speedup. The hardware gets faster and more efficient for a chosen workload precisely because it gives up some of the CPU's generality. FPGA-based acceleration is especially relevant when the workload has **high regularity or arithmetic intensity**.

> [!tip] Exam answers
> - **Why is acceleration useful?** → performance-per-watt and workload specialisation, not only raw speed.
> - **Why not use an ASIC for everything?** → design cost and lack of post-fabrication flexibility.
> - Compare programmability, flexibility, and efficiency; never name a universal winner.

> [!warning] Common pitfalls
> - Claiming an FPGA is always better than an ASIC in every dimension.
> - Treating hardware acceleration as if it removed all software responsibilities.

---

## Edge AI Constraints on Embedded Devices

> [!info] Definitions
> - **Edge device**: a resource-constrained device that performs computation near the source of data rather than in a remote cloud.
> - **Edge AI**: running AI or machine-learning inference on edge devices.
> - **Deployment constraint**: a practical limit such as compute, memory, storage, latency, or power budget.

Edge AI is hard because the **model, the data movement, and the power budget all matter at once**. A device may be functionally capable of running a workload but still fail the real deployment test if memory use, latency, or energy consumption are too high. Edge deployment is not only a correctness problem; it is also a resource-budget problem.

The three headline edge-AI constraints from Lecture 10:

- **Limited compute**: small embedded processors cannot match cloud-scale throughput.
- **Limited memory / storage**: large models do not fit comfortably.
- **Power limitations**: energy budgets are tight, often battery-bound.

```text
bigger model -> more parameters -> more memory traffic and storage -> more compute and power cost
```

This constraint chain is why embedded deployment pressure leads to quantization, lightweight models, and accelerators. The slides name **two broad responses**:

1. **Model optimisation**: reducing numeric precision, shrinking parameter count.
2. **Specialised hardware accelerators**: moving inference onto dedicated hardware (the DPU).

Quantization, lightweight models, and the DPU are best understood as **coordinated responses** to a constrained environment, not as unrelated tricks. If a model is too big or too power-hungry, you either reduce the model's demands, improve the hardware execution path, or both.

> [!warning] Common pitfalls
> - Framing the issue only as "speed" and ignoring memory or power.
> - Assuming any cloud-scale model can be moved directly to edge hardware unchanged.

---

## Quantization and Deployment Tradeoffs

Quantization is one of the course's main deployment optimisations because it reduces inference cost **without redesigning the model architecture**. Lowering numeric precision often reduces model size, bandwidth needs, and arithmetic cost at once.

> [!info] Definitions
> - **Quantization**: reducing numeric precision, commonly from floating point to lower-bit-width integer formats such as INT8.
> - **FP32**: 32-bit floating-point representation.
> - **INT8**: 8-bit integer representation commonly used for efficient inference.
> - **Deployment tradeoff**: a balance among accuracy, model size, compute cost, memory use, and power consumption.

Quantization works because many inference workloads tolerate reduced numeric precision **better than expected**. Lower-precision arithmetic and storage can preserve enough model behaviour to remain useful while significantly shrinking deployment cost.

The bit-width drop is the source of the savings. Moving each value from $32$-bit float to $8$-bit integer gives a per-value storage ratio of

$$\frac{\text{FP32 width}}{\text{INT8 width}} = \frac{32\ \text{bits}}{8\ \text{bits}} = 4\times$$

so the storage and memory-traffic ceiling for the weights drops by roughly a factor of $4$. The trade-off is **representable range and precision**: INT8 covers only the $2^{8} = 256$ integer values

$$[-128,\ 127] \quad\text{(signed)} \qquad\text{or}\qquad [0,\ 255] \quad\text{(unsigned)}$$

versus the wide dynamic range of FP32, so a scale factor maps real values onto that small integer grid. The engineering question is not *"does quantization change the model?"* but *"does it change the model by an acceptable amount for this hardware target and accuracy requirement?"*

### Concrete numbers from the provided solutions

> [!tip] Exam-relevant figures (quantization appeared in theory questions)
> **MLP model, FP32 vs INT8 file size:**
>
> | Format | File size | |
> | --- | --- | --- |
> | FP32 | $4.57\ \text{MiB}$ | baseline |
> | INT8 | $1.55\ \text{MiB}$ | quantized |
>
> Size reduction $\approx 66\%$, since $\dfrac{4.57 - 1.55}{4.57} \approx 0.66$.
>
> **Lightweight CNN trade-off:**
>
> | Model | Parameters | Accuracy |
> | --- | --- | --- |
> | Larger CNN | $32{,}842$ | $\approx 96\%$ |
> | Lightweight CNN | $8{,}618$ | $\approx 94\%$ |
>
> Parameter count drops $\approx 4\times$ while accuracy falls only $\approx 2$ percentage points.

The exam lesson is **not memorising exact numbers** but being able to explain *why* lower precision shrinks size so much while keeping accuracy reasonably close on simple tasks, and why a smaller, cheaper model can remain useful on constrained edge hardware.

<figure class="diag-figure">
  <figcaption>Quantization flow — a trained FP32 model is reduced to INT8 for efficient execution on the DPU</figcaption>
  <svg viewBox="0 0 820 130" class="diag-svg" role="img" aria-label="Quantization flow from FP32 model to INT8 deployed on DPU">
    <defs>
      <marker id="arr-q" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <rect x="14"  y="42" width="160" height="50" class="d-node"/>
    <text x="94"  y="64" text-anchor="middle" class="d-h-sm">Trained model</text>
    <text x="94"  y="81" text-anchor="middle" class="d-sub">FP32 — 4.57 MiB</text>

    <rect x="224" y="42" width="160" height="50" class="d-node-acc"/>
    <text x="304" y="64" text-anchor="middle" class="d-h-sm">Quantize</text>
    <text x="304" y="81" text-anchor="middle" class="d-sub">FP32 → INT8</text>

    <rect x="434" y="42" width="160" height="50" class="d-node"/>
    <text x="514" y="64" text-anchor="middle" class="d-h-sm">INT8 model</text>
    <text x="514" y="81" text-anchor="middle" class="d-sub">1.55 MiB — ~66% smaller</text>

    <rect x="644" y="42" width="160" height="50" class="d-node-ink"/>
    <text x="724" y="64" text-anchor="middle" class="d-h-inv">Deploy on DPU</text>
    <text x="724" y="81" text-anchor="middle" class="d-sub" fill="#fff">efficient inference</text>

    <line x1="174" y1="67" x2="222" y2="67" class="d-edge" marker-end="url(#arr-q)"/>
    <line x1="384" y1="67" x2="432" y2="67" class="d-edge" marker-end="url(#arr-q)"/>
    <line x1="594" y1="67" x2="642" y2="67" class="d-edge" marker-end="url(#arr-q)"/>
  </svg>
</figure>

> [!warning] Common pitfalls
> - Treating quantization as always lossless. It trades representation accuracy for efficiency.
> - Discussing accuracy only and forgetting the memory, power, and latency gains.

> [!tip] Exam framing
> Deployment is a trade-off problem, so always discuss **both** the benefits and the possible accuracy cost. Quantization is especially useful when edge constraints are dominated by memory, bandwidth, and arithmetic cost. Describe quantization as a *deployment optimisation* for constrained hardware, not as a training algorithm in itself.

---

## DPU Architecture and the Vitis AI Workflow

The DPU and Vitis AI material is the **applied core** of the FPGA/AI module, the bridge from embedded systems into hardware-accelerated AI deployment.

> [!info] Definitions
> - **DPU** (Deep Learning Processing Unit): a specialised hardware accelerator for neural-network inference, implemented in FPGA logic.
> - **Vitis AI**: AMD/Xilinx's toolchain and software stack for optimising, compiling, and deploying ML models to supported accelerator targets.
> - **VART**: the runtime layer used on the target device to execute compiled models on the hardware accelerator.

The DPU is valuable because **inference workloads are structured and repetitive**. Many of their operations run more efficiently in specialised hardware than on a general-purpose scalar CPU. The DPU is that specialised hardware, instantiated in programmable logic. It solves a targeted compute problem: fast, efficient neural-network inference on constrained platforms.

Vitis AI provides the **deployment path** that turns a trained model into something hardware can execute. It solves the deployment-toolchain problem: getting models transformed into something the target accelerator can run.

<figure class="diag-figure">
  <figcaption>Vitis AI deployment pipeline — train through to runtime execution on the DPU</figcaption>
  <svg viewBox="0 0 920 130" class="diag-svg" role="img" aria-label="Vitis AI deployment pipeline">
    <defs>
      <marker id="arr-v" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <rect x="10"  y="44" width="120" height="46" class="d-node"/>
    <text x="70"  y="64" text-anchor="middle" class="d-h-sm">Train model</text>
    <text x="70"  y="80" text-anchor="middle" class="d-sub">ML framework</text>

    <rect x="160" y="44" width="120" height="46" class="d-node"/>
    <text x="220" y="64" text-anchor="middle" class="d-h-sm">Export model</text>

    <rect x="310" y="44" width="120" height="46" class="d-node-acc"/>
    <text x="370" y="64" text-anchor="middle" class="d-h-sm">Quantize</text>
    <text x="370" y="80" text-anchor="middle" class="d-sub">→ INT8</text>

    <rect x="460" y="44" width="130" height="46" class="d-node"/>
    <text x="525" y="64" text-anchor="middle" class="d-h-sm">Compile</text>
    <text x="525" y="80" text-anchor="middle" class="d-sub">for DPU target</text>

    <rect x="620" y="44" width="130" height="46" class="d-node"/>
    <text x="685" y="64" text-anchor="middle" class="d-h-sm">Deploy</text>
    <text x="685" y="80" text-anchor="middle" class="d-sub">runtime artifacts</text>

    <rect x="780" y="44" width="130" height="46" class="d-node-ink"/>
    <text x="845" y="64" text-anchor="middle" class="d-h-inv">Execute</text>
    <text x="845" y="80" text-anchor="middle" class="d-sub" fill="#fff">with VART on DPU</text>

    <line x1="130" y1="67" x2="158" y2="67" class="d-edge" marker-end="url(#arr-v)"/>
    <line x1="280" y1="67" x2="308" y2="67" class="d-edge" marker-end="url(#arr-v)"/>
    <line x1="430" y1="67" x2="458" y2="67" class="d-edge" marker-end="url(#arr-v)"/>
    <line x1="590" y1="67" x2="618" y2="67" class="d-edge" marker-end="url(#arr-v)"/>
    <line x1="750" y1="67" x2="778" y2="67" class="d-edge" marker-end="url(#arr-v)"/>
  </svg>
</figure>

This is the conceptual pipeline the course wants you to understand even if individual tools or filenames vary. The DPU interacts with the broader system rather than **replacing** the CPU entirely; the tooling exists to bridge from high-level ML frameworks to FPGA-based embedded execution.

> [!tip] Exam answers
> - **Role of the DPU?** → a dedicated accelerator in the FPGA fabric for neural-network inference.
> - **Main components of Vitis AI?** → model preparation, quantization, compilation, and runtime execution, not just one compiler step.
> - **DPU vs PS/PL?** → the DPU lives in the programmable logic and cooperates with the processing system.

> [!warning] Common pitfalls
> - Treating the DPU as just a software library. It is hardware in the fabric.
> - Reducing Vitis AI to "one compiler step" and ignoring the preparation and runtime context.

---

## Zynq Platforms, Bitstreams, and the VART Runtime

The DPU does not exist in isolation. It lives on a concrete platform where CPU cores, programmable logic, configuration artifacts, and runtime software must all cooperate.

> [!info] Definitions
> - **Zynq MPSoC**: a system-on-chip platform combining processing-system CPUs with programmable logic on one device.
> - **PYNQ**: a Python-centric environment often used for working with Zynq-based programmable platforms in educational or prototyping contexts.
> - **VART**: the runtime software layer that launches and coordinates execution of compiled models on the target accelerator.
> - **Processing System (PS) vs Programmable Logic (PL)**: the CPU-centric subsystem versus the FPGA fabric subsystem in Zynq-style architectures.

Zynq-style systems combine conventional processing cores with FPGA fabric, so deployment is always **hybrid**. The processing system handles ordinary software duties, while the programmable logic hosts the accelerator hardware configured by the bitstream. Runtime software such as VART sits above the configured hardware and gives the software side a controlled way to launch inference, move data, and coordinate accelerator execution.

This is why the **bitstream and runtime are complementary, not interchangeable**:

| Artifact | Question it answers |
| --- | --- |
| **Bitstream** | What hardware is configured into the FPGA fabric? |
| **Runtime (VART)** | How does software on the target invoke and manage that configured accelerator during execution? |

You need **both** pieces for a deployed accelerator system. Deployment is a layered stack:

- **Host side**: prepare and quantize the model, then compile it for the accelerator target.
- **Target side**: configure the programmable logic with the bitstream, use runtime software such as VART to invoke inference on the DPU, and use the processing-system CPU to orchestrate surrounding software tasks.

<figure class="diag-figure">
  <figcaption>Zynq deployment stack — host-side preparation feeds target-side configuration and runtime execution</figcaption>
  <svg viewBox="0 0 760 290" class="diag-svg" role="img" aria-label="Zynq host-side and target-side deployment stack">
    <defs>
      <marker id="arr-z" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <!-- host side -->
    <rect x="20" y="20" width="320" height="100" class="d-node"/>
    <text x="180" y="42" text-anchor="middle" class="d-h-sm">Host side — preparation</text>
    <rect x="40"  y="58" width="130" height="44" class="d-node-acc"/>
    <text x="105" y="78" text-anchor="middle" class="d-h-sm">Prepare +</text>
    <text x="105" y="94" text-anchor="middle" class="d-h-sm">quantize</text>
    <rect x="190" y="58" width="130" height="44" class="d-node-acc"/>
    <text x="255" y="84" text-anchor="middle" class="d-h-sm">Compile</text>
    <line x1="170" y1="80" x2="188" y2="80" class="d-edge" marker-end="url(#arr-z)"/>

    <!-- arrow host -> target -->
    <line x1="180" y1="120" x2="180" y2="150" class="d-edge" marker-end="url(#arr-z)"/>
    <text x="192" y="140" class="d-sub">deploy artifacts</text>

    <!-- target side container -->
    <rect x="20" y="154" width="720" height="118" class="d-node"/>
    <text x="380" y="176" text-anchor="middle" class="d-h-sm">Target side — Zynq MPSoC</text>

    <!-- PL -->
    <rect x="40"  y="190" width="200" height="64" class="d-node-ink"/>
    <text x="140" y="214" text-anchor="middle" class="d-h-inv">Programmable Logic (PL)</text>
    <text x="140" y="234" text-anchor="middle" class="d-sub" fill="#fff">DPU — configured by bitstream</text>

    <!-- VART -->
    <rect x="280" y="190" width="190" height="64" class="d-node-acc"/>
    <text x="375" y="214" text-anchor="middle" class="d-h-sm">VART runtime</text>
    <text x="375" y="234" text-anchor="middle" class="d-sub">invoke + coordinate</text>

    <!-- PS -->
    <rect x="510" y="190" width="200" height="64" class="d-node"/>
    <text x="610" y="214" text-anchor="middle" class="d-h-sm">Processing System (PS)</text>
    <text x="610" y="234" text-anchor="middle" class="d-sub">CPU — orchestration, data</text>

    <line x1="470" y1="222" x2="508" y2="222" class="d-edge" marker-end="url(#arr-z)"/>
    <line x1="278" y1="222" x2="242" y2="222" class="d-edge" marker-end="url(#arr-z)"/>
  </svg>
</figure>

The **CPU side does not disappear** when a DPU exists; it still handles coordination, data movement, and software control. A source-complete mental model separates *hardware configuration artifacts* (the bitstream) from *runtime software artifacts* (VART), rather than collapsing them into "the AI toolchain." Target deployment is broader than quantization alone: the hardware must be configured *and* the runtime stack must coordinate execution.

> [!tip] Exam answers
> - **Zynq MPSoC?** → a SoC combining processing-system CPUs with programmable logic on one device.
> - **PS vs PL?** → CPU-centric subsystem vs FPGA fabric subsystem.
> - **Role of VART?** → runtime software that launches and coordinates compiled-model execution on the accelerator.
> - **PYNQ** → the Python-centric educational/prototyping environment for Zynq-based platforms.

> [!warning] Common pitfalls
> - Treating the runtime software and the hardware bitstream as the same thing.
> - Thinking the accelerator replaces the CPU entirely rather than working alongside it.

---

## Vitis AI Setup: WSL, Docker, and Jupyter

> [!info] Definitions
> - **WSL** (Windows Subsystem for Linux): runs Linux environments on a Windows host.
> - **Docker**: a container platform that packages software and dependencies into isolated environments.
> - **Container**: an isolated runtime environment containing a pre-configured software stack.
> - **Jupyter Notebook**: an interactive notebook environment often used for ML experimentation and tutorials.

The setup workflow exists to **tame a complicated dependency stack**. WSL provides a Linux environment on a Windows host, Docker packages the toolchain into a repeatable container, and Jupyter gives an interactive environment for running the provided ML workflows without rebuilding the stack each time.

```text
Windows host -> WSL Linux environment -> Docker container -> Vitis AI tools -> Jupyter workflow
```

Each layer makes the toolchain easier to run **consistently**, not to change the deployment target itself. The larger lesson is **reproducibility**: a containerised setup reduces "works on one machine but not another" problems and lets you focus on the model and deployment pipeline instead of re-solving dependency issues each time.

Separate this **host-side setup** from **target-side deployment**. WSL and Docker help you prepare and experiment with models; they are *not* the FPGA runtime environment.

> [!tip] Exam answers
> - **Why Docker?** → reproducible environment, fewer host dependency conflicts.
> - **Role of WSL?** → provides the Linux environment the toolchain needs on a Windows host.
> - **Why a pre-configured container?** → packages a complex, dependency-heavy ML toolchain reliably.

> [!warning] Common pitfalls
> - Treating the container as the accelerator itself.
> - Confusing the setup environment with the runtime deployment target.

---

## Exam Focus Summary

> [!tip] Priority tiers
> **Tier 1 (high weight, appeared in theory questions, must review):**
> - FPGA fundamentals and reconfigurable logic: configure structure, not instructions.
> - LUTs / CLBs / flip-flops / BRAM / DSP: what each block is and why specialised blocks exist.
> - Quantization and deployment trade-offs: FP32 → INT8, $4\times$ width ratio, $\approx 66\%$ size reduction, small accuracy loss.
> - Edge AI constraints: compute, memory, power; two responses: model optimisation and accelerators.
> - DPU and Vitis AI workflow, the applied pipeline: train → export → quantize → compile → deploy → execute.
>
> **Tier 2 (supporting):**
> - PLAs, switch boxes, bitstreams, place-and-route: the structural side of programmability.
> - FPGA vs CPU vs ASIC: the trade-off triangle; acceleration as specialisation.
> - Zynq platforms, PS vs PL, VART, PYNQ: the target-side runtime layer.
> - Vitis AI setup with WSL / Docker / Jupyter: reproducible host-side environment.

Connect every concept back to the **edge-AI problem**: constrained memory, power, and compute make specialised acceleration valuable, quantization makes models fit, and the DPU, Vitis AI, and Zynq runtime stack carry a trained model all the way onto programmable logic.
