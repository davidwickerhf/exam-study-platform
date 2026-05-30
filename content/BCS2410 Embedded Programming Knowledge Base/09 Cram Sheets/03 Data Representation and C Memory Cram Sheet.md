---
tags:
  - university
  - bcs2410
  - embedded-programming
  - cram-sheet
---

# 03 Data Representation and C Memory Cram Sheet

Binary/hex reasoning, signedness, overflow, bitwise operations, memory layout, pointers, arrays, and C-level memory thinking.

## Quick Links

- [[APSR Flags and Arithmetic Meaning|APSR Flags and Arithmetic Meaning]]
- [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]
- [[Bitwise Operations, Masks, and Shifts|Bitwise Operations, Masks, and Shifts]]
- [[C Data Types, Pointers, and Addresses|C Data Types, Pointers, and Addresses]]
- [[Endianness and Memory Layout|Endianness and Memory Layout]]
- [[Fixed-Width Data, Signedness, and Overflow|Fixed-Width Data, Signedness, and Overflow]]
- [[Number Systems: Binary, Decimal, and Hex|Number Systems: Binary, Decimal, and Hex]]

## Core Distinctions

| Concept | Remember |
| --- | --- |
| Binary / hex | Hex is a compact human-readable view of binary; each hex digit is 4 bits. |
| Signed vs unsigned | Same bits, different interpretation rules. |
| Overflow | Signed overflow is not the same concept as unsigned carry. |
| Little-endian vs big-endian | Little-endian stores the least-significant byte at the lowest address. |
| Pointer vs pointee | A pointer stores an address; dereferencing reads or writes the value at that address. |

## Fast Recall

- Know how to convert small decimal values to binary and binary back to decimal.
- Know that each hexadecimal digit corresponds to exactly 4 bits.
- Know that a typical `int` on the course's 32-bit systems is 4 bytes.
- Know the difference between signed overflow and unsigned wraparound/carry.
- Know that the APSR stores flags reflecting the outcome of arithmetic and logic operations.
- Know the core meanings of N, Z, C, and V.
- Know how to compute basic AND, OR, XOR, and shift results by hand.
- Know that shifts are frequently used for multiply/divide-by-power-of-two style operations.
- Know how a multi-byte value like `0x12345678` is laid out in little-endian memory.
- Know that Cortex-M33 in the course context is little-endian by default.
- Know that `int *p;` means `p` can hold the address of an integer.
- Know that `p = &x;` stores the address of `x` in `p`.

## Oral Answer Drills

### C Data Types, Pointers, and Addresses

- A pointer is a variable whose value is a memory address, and dereferencing that pointer accesses the value stored at that address.
- This matters in embedded programming because hardware registers, arrays, buffers, and call-by-reference APIs all ultimately depend on address reasoning.
- The exam usually tests whether you can separate the address itself from the value stored there and reason about how pointer arithmetic scales by element size.

### Number Systems: Binary, Decimal, and Hex

- Binary is the machine-native representation, decimal is the human counting system, and hexadecimal is a compact notation for binary where each hex digit stands for 4 bits.
- Conversions are high-yield exam material, so you should be able to move cleanly between decimal, binary, and hex without guessing.
- For example, decimal 25 equals binary `11001`, and hex `0x19` is another way to write the same value.
