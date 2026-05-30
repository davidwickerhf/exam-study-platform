---
tags:
  - university
  - bcs2410
  - embedded-programming
  - worked-drills
---

# Pointer and Memory Worked Drills

## Drill 1: Pointer dereference

```c
int x = 10;
int *ptr = &x;
```

- `ptr` is the address of `x`
- `*ptr` is the value stored at that address
- so `*ptr` equals `10`

## Drill 2: Modify through a pointer

```c
int x = 10;
int *ptr = &x;
*ptr = 20;
```

After this:

- `x == 20`
- `*ptr == 20`

because both names refer to the same memory location through different access paths.

## Drill 3: Array pointer arithmetic

```c
int arr[] = {10, 20, 30};
int *ptr = arr;
```

Then:

- `ptr` points to `arr[0]`
- `ptr + 1` points to `arr[1]`
- `ptr + 2` points to `arr[2]`
- `*(ptr + 2) == 30`

## Drill 4: Little-endian memory

For `0x12345678`, little-endian memory stores the bytes:

```text
78 56 34 12
```

in increasing-address order.

## Drill 5: Swap by reference

```c
void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}
```

This works because the function receives addresses and writes through them, so the caller's original variables are changed.

## Related Concepts

- [[C Data Types, Pointers, and Addresses|C Data Types, Pointers, and Addresses]]
- [[Arrays, Pointer Arithmetic, and Call by Reference|Arrays, Pointer Arithmetic, and Call by Reference]]
- [[Endianness and Memory Layout|Endianness and Memory Layout]]

## Sources

- [[03 Quiz Scope and Extra Materials|Quiz Scope and Extra Materials]]
- [[02 Embedded Course Corpus|Embedded Course Corpus]]
