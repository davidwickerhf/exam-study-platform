---
tags:
  - university
  - bcs2410
  - embedded-programming
  - cram-sheet
---

# 06 FPGA and Edge AI Cram Sheet

FPGA building blocks, reconfigurable logic, DPU hardware acceleration, Vitis AI, quantization, and deployment tradeoffs.

## Quick Links

- [[DPU Architecture and Vitis AI Workflow|DPU Architecture and Vitis AI Workflow]]
- [[Edge AI Constraints on Embedded Devices|Edge AI Constraints on Embedded Devices]]
- [[FPGA Fundamentals and Reconfigurable Logic|FPGA Fundamentals and Reconfigurable Logic]]
- [[LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks|LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks]]
- [[Quantization and Deployment Tradeoffs|Quantization and Deployment Tradeoffs]]
- [[FPGA vs CPU vs ASIC and Hardware Acceleration|FPGA vs CPU vs ASIC and Hardware Acceleration]]
- [[PLA Evolution, Switch Boxes, and FPGA Bitstreams|PLA Evolution, Switch Boxes, and FPGA Bitstreams]]
- [[Vitis AI Setup with WSL, Docker, and Jupyter|Vitis AI Setup with WSL, Docker, and Jupyter]]
- [[Zynq Platforms, Bitstreams, and VART Runtime|Zynq Platforms, Bitstreams, and VART Runtime]]

## Core Distinctions

| Concept | Remember |
| --- | --- |
| FPGA vs ASIC | FPGAs are reconfigurable after manufacturing; ASICs are fixed once fabricated. |
| LUT vs BRAM vs DSP | LUTs implement logic, BRAM stores data on-chip, DSP blocks accelerate arithmetic. |
| CPU vs DPU | CPUs are general-purpose; DPUs are specialized hardware accelerators for neural-network inference. |
| FP32 vs INT8 | Quantization reduces precision and usually shrinks size and compute cost dramatically. |

## Fast Recall

- Know that an FPGA can be configured by the user after manufacturing to realize different digital circuits.
- Know that an FPGA is neither a plain CPU nor a fixed-function ASIC.
- Know that FPGAs can be understood historically as a more advanced and flexible evolution of earlier programmable logic devices such as PLAs.
- Know that FPGA programmability depends not only on logic blocks but also on programmable interconnect such as switch boxes.
- Know that LUTs implement combinational logic.
- Know that flip-flops provide storage for sequential behavior.
- Know that CPUs are flexible, ASICs are fixed and efficient for one purpose, and FPGAs sit in between with configurable hardware.
- Know why specialized hardware can improve performance and efficiency for targeted workloads.
- Know the main edge-AI constraints highlighted in the lecture: limited compute, limited memory/storage, and power limitations.
- Know that these constraints make large neural-network models harder to deploy directly on small embedded devices.
- Know the role of the DPU as a dedicated accelerator in the FPGA fabric.
- Know the broad Vitis AI flow: model preparation, quantization, compilation, and runtime execution.

## Oral Answer Drills

### DPU Architecture and Vitis AI Workflow

- A DPU is a dedicated accelerator implemented in FPGA logic to run neural-network inference more efficiently than a general-purpose CPU alone.
- Vitis AI provides the end-to-end flow: prepare the model, quantize it, compile it for the target accelerator, and run it with the runtime stack on the device.
- For the exam, connect the DPU to the broader edge-AI problem: constrained memory, power, and compute make specialized acceleration valuable.

### FPGA Fundamentals and Reconfigurable Logic

- An FPGA is a reconfigurable integrated circuit whose logic can be programmed after manufacturing, unlike a fixed-function ASIC.
- Its fabric is built from configurable logic blocks, interconnect, and I/O, often extended with specialized blocks like BRAM and DSP units.
- The big exam idea is that FPGAs trade raw fixed-function efficiency for reconfigurability and custom hardware acceleration.

### Quantization and Deployment Tradeoffs

- Quantization reduces numeric precision, typically from floating point to lower-bit-width integers such as INT8, to cut model size and compute cost.
- The tradeoff is possible accuracy loss, but for simple models the size reduction can be large while accuracy remains close to the original.
- You should be able to explain quantization as a deployment optimization for constrained hardware rather than as a training algorithm by itself.

### Zynq Platforms, Bitstreams, and VART Runtime

- The FPGA/Edge-AI stack is not just a DPU in the abstract; it runs on concrete target platforms such as Zynq-class systems where programmable logic and processing cores cooperate.
- A bitstream configures the FPGA fabric, while runtime software such as VART helps launch and coordinate inference on the accelerator.
- This is the deployment layer that connects toolchain output to real execution on target hardware.
