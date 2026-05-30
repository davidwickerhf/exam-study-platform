---
tags:
  - university
  - bcs2410
  - embedded-programming
  - quiz-scope
---

# Quiz Scope and Extra Materials

Quiz questions and additional course instructions provided outside the slide PDFs.

## Quiz 1: Introduction and Computer Architecture

1. Which of the following best describes an embedded system?
   - A standalone general-purpose computer
   - A system designed for multitasking across various applications
   - A specialized computer system designed to perform specific tasks
   - A system with no hardware components
2. Which type of memory is typically used for program storage in an embedded system?
   - RAM
   - ROM/Flash
   - Cache
   - Hard disk
3. Which of the following is an example of a peripheral on the B-U585I-IOT02A discovery board?
   - LED
   - GPIO pins
   - Sensors
   - All of the above
4. What is the primary language that computers understand?
   - Binary
   - C
   - English
   - Assembly
5. What is the primary role of a transistor in a computer system?
   - To store data persistently
   - To switch and amplify electronic signals
   - To provide physical connections between components
   - To interpret programming languages directly
6. Which of the following is NOT a primary component of computer organization?
   - Central Processing Unit (CPU)
   - Input/Output devices
   - Operating System
   - Memory
7. What does the term "power wall" in computing refer to?
   - The increasing cost of processors
   - The inability to improve CPU performance due to heat and energy limitations
   - The maximum amount of power a computer can consume
   - The need for computers to be always plugged in
8. What is a key difference between the Von Neumann and Harvard architectures?
   - Von Neumann uses separate buses for data and instructions, while Harvard combines them
   - Von Neumann uses a single memory for data and instructions, while Harvard separates them
   - Harvard is only used in personal computers, while Von Neumann is used in embedded systems
   - Von Neumann can only execute one instruction at a time, while Harvard can execute multiple
9. Why is cache memory important in a computer system?
   - It stores large amounts of data permanently
   - It increases the processing speed by storing frequently used data closer to the CPU
   - It acts as a backup in case the main memory fails
   - It stores instructions for booting up the computer
10. In the "decode" stage of the instruction cycle, what does the CPU do?
    - Executes the instruction
    - Retrieves the next instruction from memory
    - Translates the instruction into signals understandable by the CPU
    - Stores the output in a register
11. Which of the following operations is NOT performed by the ALU?
    - Addition and subtraction
    - Logical comparisons (e.g. AND, OR)
    - Data storage for future use
    - Multiplication and division
12. What is the role of the program counter (PC) register?
    - To store data being processed by the ALU
    - To hold the address of the next instruction to execute
    - To act as a cache for frequently accessed data
    - To decode instructions before they are executed

## Quiz 2: Data Representation, Pointers, and APSR

1. Convert the decimal number 25 into binary.
   - 10101
   - 11001
   - 10010
   - 11100
2. What is the typical size of an `int` datatype on a 32-bit system?
   - 1 byte
   - 2 bytes
   - 4 bytes
   - 8 bytes
3. What is the primary role of the Application Program Status Register (APSR) in a CPU?
   - To store program data permanently
   - To hold flags that indicate the results of arithmetic and logic operations
   - To manage memory addresses for instructions
   - To handle I/O operations
4. What is the result of `1011 & 1101` in binary?
   - 1001
   - 1111
   - 1011
   - 1101
5. In a little-endian system, how is the hexadecimal value `0x12345678` stored in memory?
   - `12 34 56 78`
   - `78 56 34 12`
   - `34 12 78 56`
   - `56 78 12 34`
6. If `int x = 10; int *ptr = &x;`, what does `*ptr` represent?
   - The address of `x`
   - The value stored at the address of `x`
   - The size of `x`
   - An undefined value
7. If `int arr[] = {10, 20, 30}; int *ptr = arr;`, what does `*(ptr + 2)` return?
   - 10
   - 20
   - 30
   - 40
8. What is the advantage of passing a variable to a function by reference instead of by value?
   - The function can modify the original variable
   - It uses more memory
   - The variable is copied, ensuring safety
   - It prevents any modification of the original variable

## Extra Material: Adding an Assembly File to the Template

1. Create a new header file called `assembler.h` inside `Core/Inc/`.
2. Define a new external function:

```c
#ifndef INC_ASSEMBLER_H_
#define INC_ASSEMBLER_H_

extern void ASM_Function(void);

#endif
```

3. Create a new assembly source file called `assembler.s` inside `Core/Src/`.
4. Implement the function skeleton:

```asm
.syntax unified
.text
.global ASM_Function
.thumb_func
.equ COUNTER, 10000

ASM_Function:
```

5. Call `ASM_Function()` from `main`:

```c
int main(void)
{
    while (1) {
        ASM_Function();
    }
}
```
