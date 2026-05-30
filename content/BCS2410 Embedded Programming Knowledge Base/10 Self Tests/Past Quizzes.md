# BCS2410 — Past Quizzes (Worked)

Real in-course quizzes from the first sitting. Each question is shown with the **correct answer in bold** and a one-line rationale. These are the best calibration for the **theory section (40% of the exam)** — closed multiple-choice, relatively easy if Chapters 01–04 are solid.

> [!tip] How to use this
> Cover the answers, attempt each question cold, then check. Every topic here is treated in depth in the chapter it points to — if a rationale doesn't click, open that chapter.

---

## Quiz 1 — Introduction and Computer Architecture

Covers **Chapter 01 (Foundations)** and **Chapter 02 (Computer Architecture)**.

### Q1. Which of the following best describes an embedded system?
- A standalone general-purpose computer
- A system designed for multitasking across various applications
- **✓ A specialized computer system designed to perform specific tasks**
- A system with no hardware components

An embedded system is purpose-built for one task (or a fixed set), unlike a general-purpose PC. → Ch 01

### Q2. Which type of memory is typically used for program storage in an embedded system?
- RAM
- **✓ ROM/Flash**
- Cache
- Hard disk

Program code is non-volatile — it must survive power-off — so it lives in Flash/ROM, not RAM. → Ch 02

### Q3. Which of the following is an example of a peripheral on the B-U585I-IOT02A discovery board?
- LED
- GPIO pins
- Sensors
- **✓ All of the above**

LEDs, GPIO pins and on-board sensors are all peripherals around the MCU core. → Ch 01

### Q4. What is the primary language that computers understand?
- **✓ Binary**
- C
- English
- Assembly

The hardware executes binary machine code; C and assembly are abstractions compiled/assembled down to it. → Ch 01

### Q5. What is the primary role of a transistor in a computer system?
- To store data persistently
- **✓ To switch and amplify electronic signals**
- To provide physical connections between components
- To interpret programming languages directly

The transistor is a voltage-controlled switch — the physical basis of binary logic. → Ch 02

### Q6. Which of the following is NOT a primary component of computer organization?
- Central Processing Unit (CPU)
- Input/Output devices
- **✓ Operating System**
- Memory

CPU, memory and I/O are hardware components of computer organization; the OS is software. → Ch 02

### Q7. What does the term "power wall" in computing refer to?
- The increasing cost of processors
- **✓ The inability to improve CPU performance due to heat and energy limitations**
- The maximum amount of power a computer can consume
- The need for computers to be always plugged in

Clock speeds stalled (~2004) because power density and heat dissipation became unmanageable. → Ch 02

### Q8. What is a key difference between the Von Neumann and Harvard architectures?
- Von Neumann uses separate buses for data and instructions, while Harvard combines them
- **✓ Von Neumann uses a single memory for data and instructions, while Harvard separates them**
- Harvard is only used in personal computers, while Von Neumann is used in embedded systems
- Von Neumann can only execute one instruction at a time, while Harvard can execute multiple

Von Neumann = one shared memory/bus for code + data; Harvard = separate memories/buses. (Cortex-M is effectively Harvard.) → Ch 02

### Q9. Why is cache memory important in a computer system?
- It stores large amounts of data permanently
- **✓ It increases the processing speed by storing frequently used data closer to the CPU**
- It acts as a backup in case the main memory fails
- It stores instructions for booting up the computer

Cache exploits locality — keeping hot data in fast memory close to the CPU hides slow main-memory latency. → Ch 02

### Q10. In the "decode" stage of the instruction cycle, what does the CPU do?
- Executes the instruction
- Retrieves the next instruction from memory
- **✓ Translates the instruction into signals understandable by the CPU**
- Stores the output in a register

Decode interprets the fetched instruction's bits into control signals; fetch retrieves, execute runs. → Ch 02

### Q11. Which of the following operations is NOT performed by the ALU?
- Addition and subtraction
- Logical comparisons (e.g., AND, OR)
- **✓ Data storage for future use**
- Multiplication and division

The ALU computes; storage is the job of registers and memory. → Ch 02

### Q12. What is the role of the program counter (PC) register?
- To store data being processed by the ALU
- **✓ To hold the address of the next instruction to execute**
- To act as a cache for frequently accessed data
- To decode instructions before they are executed

The PC holds the address of the next instruction; on Cortex-M it advances by 2 bytes per Thumb instruction. → Ch 02

---

## Quiz 2 — Arithmetic Systems and Bitwise Operations

Covers **Chapter 03 (Data Representation and C Memory)**.

### Q1. Convert the decimal number 25 into binary.
- 10101
- **✓ 11001**
- 10010
- 11100

$25 = 16 + 8 + 1 = 2^4 + 2^3 + 2^0 = 11001_2$. → Ch 03

### Q2. What is the typical size of an `int` datatype on a 32-bit system?
- 1 byte
- 2 bytes
- **✓ 4 bytes**
- 8 bytes

A 32-bit `int` is 4 bytes ($32 / 8$). → Ch 03

### Q3. What is the primary role of the Application Program Status Register (APSR) in a CPU?
- To store program data permanently
- **✓ To hold flags that indicate the results of arithmetic and logic operations**
- To manage memory addresses for instructions
- To handle I/O operations

The APSR holds the condition flags **N, Z, C, V**, set by flag-setting instructions and read by conditional branches. → Ch 03

### Q4. What is the result of `1011 & 1101` in binary?
- **✓ 1001**
- 1111
- 1011
- 1101

Bitwise AND, column by column: $1\&1=1$, $0\&1=0$, $1\&0=0$, $1\&1=1$ → `1001`. → Ch 03

### Q5. In a little-endian system, how is the hexadecimal value `0x12345678` stored in memory?
- 12 34 56 78
- **✓ 78 56 34 12**
- 34 12 78 56
- 56 78 12 34

Little-endian stores the least-significant byte at the lowest address, so `78` comes first. → Ch 03

### Q6. If `int x = 10; int *ptr = &x;`, what does `*ptr` represent?
- The address of x
- **✓ The value stored at the address of x**
- The size of x
- An undefined value

`ptr` holds the address of `x`; dereferencing with `*ptr` yields the value `10`. → Ch 03

### Q7. If `int arr[] = {10, 20, 30}; int *ptr = arr;`, what does `*(ptr + 2)` return?
- 10
- 20
- **✓ 30**
- 40

Pointer arithmetic scales by element size: `ptr + 2` points at `arr[2]`, so `*(ptr + 2) == 30`. → Ch 03

### Q8. What is the advantage of passing a variable to a function by reference instead of by value?
- **✓ The function can modify the original variable**
- It uses more memory
- The variable is copied, ensuring safety
- It prevents any modification of the original variable

By reference, the function receives the address and can write through it to the caller's variable; by value it only gets a copy. → Ch 03

---

## Coverage check

| Quiz topic | Chapter | Status |
| --- | --- | --- |
| Embedded systems, peripherals, binary, abstraction | 01 Foundations and Course | Covered |
| Memory types, transistors, organization, power wall, Von Neumann/Harvard, cache, instruction cycle, ALU, PC | 02 Computer Architecture | Covered |
| Number systems, `int` size, APSR flags, bitwise AND, endianness, pointers, pointer arithmetic, call by reference | 03 Data Representation and C Memory | Covered |

All 20 questions map onto material now in the chapter notes (enriched directly from Lectures 1–5). Use this set as a timed warm-up before the theory section.
