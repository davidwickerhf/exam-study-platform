---
tags:
  - university
  - bcs2410
  - embedded-programming
  - worked-drills
---

# FPGA and Quantization Worked Drills

## Drill 1: Explain an FPGA in one exam paragraph

A strong short answer is:

> An FPGA is a reconfigurable integrated circuit containing configurable logic blocks, programmable interconnect, and I/O resources. Unlike an ASIC, it can be reprogrammed after manufacturing to implement different digital circuits, which makes it useful for hardware acceleration and embedded systems experimentation.

## Drill 2: Why not use only LUTs?

Modern FPGAs include specialized blocks because:

- LUTs are flexible for logic
- BRAM is much better for on-chip memory than trying to build large memories out of small logic resources
- DSP blocks are much better for arithmetic-heavy workloads than LUT-only designs

## Drill 3: Why a DPU helps

A DPU is useful because edge devices have:

- limited compute
- limited memory/storage
- limited power budget

So a specialized accelerator can improve throughput and efficiency for neural-network inference compared with using only a general-purpose CPU.

## Drill 4: Quantization tradeoff

From the provided solution material:

- FP32 model size: `4.57 MiB`
- INT8 model size: `1.55 MiB`
- reduction: about `66%`

The exam answer should say that quantization shrinks model size and compute cost substantially, while accuracy may drop slightly or remain close for simpler workloads.

## Drill 5: Lightweight model tradeoff

A lightweight CNN reduced parameters from `32,842` to `8,618` with only a modest accuracy drop.

The concept is:

- fewer parameters -> less memory and compute
- usually some accuracy tradeoff
- often worthwhile for constrained edge deployment

## Related Concepts

- [[FPGA Fundamentals and Reconfigurable Logic|FPGA Fundamentals and Reconfigurable Logic]]
- [[LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks|LUTs, CLBs, Flip-Flops, BRAM, and DSP Blocks]]
- [[DPU Architecture and Vitis AI Workflow|DPU Architecture and Vitis AI Workflow]]
- [[Quantization and Deployment Tradeoffs|Quantization and Deployment Tradeoffs]]

## Sources

- [[03 Quiz Scope and Extra Materials|Quiz Scope and Extra Materials]]
- [[02 Embedded Course Corpus|Embedded Course Corpus]]
