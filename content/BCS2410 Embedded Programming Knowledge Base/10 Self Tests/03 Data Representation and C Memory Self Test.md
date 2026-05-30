---
tags:
  - university
  - bcs2410
  - embedded-programming
  - self-test
---

# 03 Data Representation and C Memory Self Test

Answer these without notes. This bank intentionally omits answers.

## APSR Flags and Arithmetic Meaning

- [ ] What is the primary role of the APSR?
- [ ] What do the N, Z, C, and V flags mean?
- [ ] Why do assembly comparisons often use `CMP` before a branch?

## Arrays, Pointer Arithmetic, and Call by Reference

- [ ] If `int arr[] = {10, 20, 30}; int *ptr = arr;`, what does `*(ptr + 2)` return?
- [ ] What is the advantage of passing a variable by reference rather than by value?
- [ ] How would you swap two integers using pointers?
- [ ] ⚠️ **Exam pattern (March 2026):** An `int*` points to address `0b00000000000000000010000000000000`. If the pointer is incremented by 3, what is the resulting address in binary? *(Remember: int = 4 bytes, so +3 = +12 bytes)*

## Bitwise Operations, Masks, and Shifts

- [ ] What is the result of `1011 & 1101`?
- [ ] How can shifts implement multiplication by 4 or 8?
- [ ] Why are masks important in embedded programming?

## C Data Types, Pointers, and Addresses

- [ ] If `int x = 10; int *ptr = &x;`, what does `*ptr` represent?
- [ ] What does the address-of operator do?
- [ ] Why are pointers important in embedded programming?

## Endianness and Memory Layout

- [ ] In a little-endian system, how is `0x12345678` stored in memory?
- [ ] What is the difference between little-endian and big-endian?
- [ ] Why does endianness matter when using memory inspection tools?

## Fixed-Width Data, Signedness, and Overflow

- [ ] What is the typical size of an `int` on a 32-bit system?
- [ ] What happens when a 32-bit signed integer at `0x7FFFFFFF` is incremented?
- [ ] How does unsigned behavior differ from signed overflow?

## Number Systems: Binary, Decimal, and Hex

- [ ] Convert decimal 25 into binary.
- [ ] Convert between binary and hex.
- [ ] Why do we use hexadecimal so often in low-level programming?
