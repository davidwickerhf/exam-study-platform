---
tags:
  - university
  - bcs2410
  - embedded-programming
  - worked-drills
---

# Quiz 2 Worked Answers

## 1. Decimal 25 to binary

**Correct answer:** `11001`.

**Why:** `25 = 16 + 8 + 1`, so the 16, 8, and 1 bit positions are set.

## 2. Typical `int` size on a 32-bit system

**Correct answer:** 4 bytes.

**Why:** The course assumes a 32-bit embedded platform, so `int` is typically 32 bits here.

## 3. APSR role

**Correct answer:** To hold flags that indicate the results of arithmetic and logic operations.

**Why:** APSR contains flags such as N, Z, C, and V.

## 4. `1011 & 1101`

**Correct answer:** `1001`.

**Why:**

```text
  1011
& 1101
------
  1001
```

## 5. Little-endian storage of `0x12345678`

**Correct answer:** `78 56 34 12`.

**Why:** Little-endian stores the least-significant byte at the lowest memory address.

## 6. Meaning of `*ptr`

**Correct answer:** The value stored at the address of `x`.

**Why:** `ptr` holds the address of `x`, and `*ptr` dereferences that address.

## 7. Meaning of `*(ptr + 2)`

**Correct answer:** `30`.

**Why:** `ptr` starts at `arr[0]`, and moving 2 integer elements forward reaches `arr[2]`.

## 8. Why pass by reference style?

**Correct answer:** The function can modify the original variable.

**Why:** Passing an address lets the callee write back through that address.

## Related Concepts

- [[Number Systems: Binary, Decimal, and Hex|Number Systems: Binary, Decimal, and Hex]]
- [[APSR Flags and Arithmetic Meaning|APSR Flags and Arithmetic Meaning]]
- [[Bitwise Operations, Masks, and Shifts|Bitwise Operations, Masks, and Shifts]]
- [[Endianness and Memory Layout|Endianness and Memory Layout]]
- [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]

## Sources

- [[03 Quiz Scope and Extra Materials|Quiz Scope and Extra Materials]]
- [[02 Embedded Course Corpus|Embedded Course Corpus]]
