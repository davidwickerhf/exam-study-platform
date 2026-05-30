---
tags:
  - university
  - bcs2410
  - embedded-programming
  - corpus
---

# Embedded Course Corpus

Text extracted from the provided slides, tutorials, and solution files. This is the raw searchable source base used to structure the concept notes.

## BCS 2410 Syllabus - 2025 - 2026.pdf

- Role: syllabus and assessment
- Path: `/Users/davidwickerhf/Downloads/BCS 2410 Syllabus - 2025 - 2026.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `89`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/BCS 2410 Syllabus - 2025 - 2026.pdf]
```

## Lecture 1 - Introduction 1.pdf

- Role: course introduction and embedded-systems basics
- Path: `/Users/davidwickerhf/Downloads/Lecture 1 - Introduction 1.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `84`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 1 - Introduction 1.pdf]
```

## Lecture 2 - Computer architecture.pdf

- Role: computer organization and architecture
- Path: `/Users/davidwickerhf/Downloads/Lecture 2 - Computer architecture.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `91`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 2 - Computer architecture.pdf]
```

## Lecture 3 - Computer architecture.pdf

- Role: memory, Harvard architecture, and registers
- Path: `/Users/davidwickerhf/Downloads/Lecture 3 - Computer architecture.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `91`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 3 - Computer architecture.pdf]
```

## Lecture 4 - Data representation and bitwise operations.pdf

- Role: number systems, data representation, and bitwise operations
- Path: `/Users/davidwickerhf/Downloads/Lecture 4 - Data representation and bitwise operations.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `112`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 4 - Data representation and bitwise operations.pdf]
```

## Lecture 5 - Pointers.pdf

- Role: pointers, endianness, and memory
- Path: `/Users/davidwickerhf/Downloads/Lecture 5 - Pointers.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `78`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 5 - Pointers.pdf]
```

## Lecture 6 - ARM ISA - Operations.pdf

- Role: ARM ISA operations and flags
- Path: `/Users/davidwickerhf/Downloads/Lecture 6 - ARM ISA - Operations.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `90`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 6 - ARM ISA - Operations.pdf]
```

## Lecture 7 - ARM ISA - Execution flow.pdf

- Role: procedures, stack, and calling convention
- Path: `/Users/davidwickerhf/Downloads/Lecture 7 - ARM ISA - Execution flow.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `94`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 7 - ARM ISA - Execution flow.pdf]
```

## Lecture 8 - ARM ISA - Execution flow 2.pdf

- Role: flow control and condition codes
- Path: `/Users/davidwickerhf/Downloads/Lecture 8 - ARM ISA - Execution flow 2.pdf`
- Pages: `44`
- Extracted characters: `16388`

### Extracted Text

```text
Embedded Programming
Dr. Charis Kouzinopoulos
Department of Advanced Computing Sciences
Maastricht University
charis.kouzinopoulos@maastrichtuniversity.nl
ARM assembly
Flow control
Three Control Structures
• Sequence Structure
- Computer executes statements 
(instructions), one after 
another, in the order listed in 
the program
Sequence Structure
60
Three Control Structures
• Selection Structure
- If-then-else
• Loop Structure
- while loop
- for loop
Sequence Structure
 Selection Structure
 Loop Structure
61
Unconditional branching
b label
label? What is that? Branch instructions use immediate values, but these values would
need to be manually calculated by hand. To get around this, we use labels. The assembler
will read the labels and automatically know what immediate value to apply to the branch
instruction. Example:
b jump_here
add R1, R2, R3
jump_here:
mov R1, #1
62
Unconditional branching
• A label marks the location of an instruction
• Labels helps humans to read the code
• In machine program, labels are converted to numeric offsets 
by the assembler 
MOVS r1, #1
B    target  ; Branch to target
MOVS r2, #2  ; Not executed
MOVS r3, #3  ; Not executed
MOVS r4, #4  ; Not executed
target MOVS r5, #5
Example:
63
Unconditional Branch Instructions
• B label
- cause a branch to label
• BL label
- copy the address of the next instruction into r14 (lr, the link register), and cause a branch to label
• BX Rm
- branch to the address held in Rm
• BLX Rm: 
- copy the address of the next instruction into r14 (lr, the link register) and branch to the address held in Rm
Instruction Operands Brief description
B label Branch
BL label Branch with Link
BLX Rm Branch indirect with Link
BX Rm Branch indirect
64
Conditional branching
beq label
The processor will branch to the label if the conditional branch is true. For this we need
to make a comparison
CMP Rn, Operand2
CMN Rn, Operand2
• Update N, Z, C and V according to the result
• CMP subtracts Operand2 from Rn
- Same as SUBS, except result is discarded
• CMN adds Operand2 to Rn
- Same as ADDS, except result is discarded
65
Conditional branching
beq label
The processor will branch to the label if the conditional branch is true. For this we need
to make a comparison
CMP Rn, Operand2
CMN Rn, Operand2
• Update N, Z, C and V according to the result
• CMP subtracts Operand2 from Rn
- Same as SUBS, except result is discarded
• CMN adds Operand2 to Rn
- Same as ADDS, except result is discarded
66
If you cannot do i.e. CMP R0, #-100000. 
Comparing A to -B is mathematically identical to 
checking A + B. 
Therefore, you can use CMN R0, #100000

Conditional branching
Example:
cmp R0, #0
beq jump_there
add R1, R2, R3
jump_there:
mov R1, #1
67
Conditional branching - examples
68
MOV r0, #2
MOV r1, #2
sub r0, r1
beq ASM_Function
MOV r0, #2
MOV r1, #3
subs r0, r1
beq ASM_Function
MOV r0, #2
MOV r1, #2
CMP r0, r1
beq ASM_Function
Will the instruction branch?
Will the instruction branch?
Will the instruction branch?

Updating Condition Flags: TST and TEQ
TST Rn, Operand2  ; Bitwise AND
TEQ Rn, Operand2  ; Bitwise Exclusive OR
• Update N and Z according to the result
• Can update C during the calculation of Operand2 
• Do not affect V
• TST performs  bitwise AND on Rn and Operand2. 
- Same as ANDS, except result is discarded.
• TEQ performs bitwise Exclusive OR on Rn and Operand2.
- Same as EORS, except result is discarded.
69
Updating Condition Flags: TST and TEQ
TST Rn, Operand2  ; Bitwise AND
TEQ Rn, Operand2  ; Bitwise Exclusive OR
• Update N and Z according to the result
• Can update C during the calculation of Operand2 
• Do not affect V
• TST performs  bitwise AND on Rn and Operand2. 
- Same as ANDS, except result is discarded.
• TEQ performs bitwise Exclusive OR on Rn and Operand2.
- Same as EORS, except result is discarded.
70
Example: To check if specific bits are set (Bit 
masking): If you are reading a register and 
want to check bit 3, CMP cannot be used. 
Instead, use TST R0, #0x08 (0b1000).
If bit 3 is 0, the AND operation results in 0, and 
the Zero (Z) flag is set. (Use BEQ).

Condition Codes 
Not Equal
Unsigned Higher or Same
Unsigned LOwer
MInus (Negative)
EQual
oVerflow Set
oVerflow Clear
Unsigned HIgher
Unsigned Lower or Same
PLus (Positive or Zero)
Signed Less Than
Signed Greater Than
Signed Less than or Equal
ALways
Signed Greater or Equal
EQ
NE
CS/HS
CC/LO
PL
VS
HI
LS
GE
LT
GT
LE
AL
MI
VC
Suffix Description
Note AL is the default and does not need to be specified 
76
Branch Instructions
Instruction Description Flags tested
Unconditional
Branch
B label Branch to label
Conditional
Branch
BEQ label Branch if EQual Z = 1
BNE label Branch if Not Equal Z = 0
BCS/BHS label Branch if unsigned Higher or Same C = 1
BCC/BLO label Branch if unsigned LOwer C = 0
BMI label Branch if MInus (Negative) N = 1
BPL label Branch if PLus (Positive or Zero) N = 0
BVS label Branch if oVerflow Set V = 1
BVC label Branch if oVerflow Clear V = 0
BHI label Branch if unsigned HIgher C = 1 & Z = 0
BLS label Branch if unsigned Lower or Same C = 0 or Z = 1
BGE label Branch if signed Greater or Equal N = V
BLT label Branch if signed Less Than N != V
BGT label Branch if signed Greater Than Z = 0 & N = V
BLE label Branch if signed Less than or Equal Z = 1 or N = !V
77
Conditional branching - examples
78
MOV r0, #2
MOV r1, #3
cmp r0, r1
bmi ASM_Function // N = 1 
MOV r0, #3
MOV r1, #2
cmp r0, r1
bpl ASM_Function // N = 0
MOV r0, #3
MOV r1, #2
cmp r0, r1
bhi ASM_Function // C = 1 & Z = 0 | unsigned higher
Conditional branching - examples
79
MOV r0, #-1 // Or better MVN R0, #0
MOV r1, #2
cmp r0, r1
bhi ASM_Function //why ??
MOV r0, #-1
MOV r1, #2
cmp r0, r1
bgt ASM_Function // Z = 0 & N = V
LDR  R0, =0x70000000 
LDR  R1, =0x20000000 
ADDS R2, R0, R1      // Positive + positive = negative 
BVS  math_error
B    end
Signed vs. Unsigned Comparison
Conditional codes applied to 
branch instructions
Compare Signed Unsigned
> BGT BHI
>= BGE BHS
< BLT BLO
<= BLE BLS
== BEQ
!= BNE
Compare Signed Unsigned
> GT HI
≥ GE HS
< LT LO
≤ LE LS
== EQ
≠ NE
80
Signed Greater or Equal (N == V)
N = 0 N = 1
V = 0
• No overflow, implying the result is 
correct. 
• The result is non-negative, 
• Thus r0 – r1 ≥ 0, i.e., r0 ≥ 
r1
• No overflow, implying the result is 
correct.
• The result is negative.
• Thus r0 – r1 < 0, i.e., r0 < r1
V = 1
• Overflow occurs, implying the 
result is incorrect. 
• The result is mistakenly reported 
as non-negative and in fact it 
should be negative. 
• Thus r0 – r1 < 0 in reality, 
i.e., r0 < r1
• Overflow occurs, implying the 
result is incorrect. 
• The result is mistakenly reported as 
negative and in fact it should be 
non-negative. 
• Thus r0 – r1 ≥ 0 in reality., i.e.  
r0 ≥ r1
CMP r0, r1
perform subtraction r0 – r1, without saving the result
Conclusions:
• If N == V, then it is signed greater or equal (GE).
• Otherwise, it is signed less than (LT)
83
Signed Greater or Equal (N == V)
N = 0 N = 1
V = 0 r0 ≥ r1 r0 < r1
V = 1 r0 < r1 r0 ≥ r1
CMP r0, r1
perform subtraction r0 – r1, without saving the result
Conclusions:
• If N == V, then it is signed greater or equal (GE).
• Otherwise, it is signed less than (LT)
84
Signed Greater or Equal (N == V)
N = 0 N = 1
V = 0 1 0
V = 1 0 1
CMP r0, r1
perform subtraction r0 – r1, without saving the result
Conclusions:
• If N == V, then it is signed greater or equal (GE).
• Otherwise, it is signed less than (LT)
85
Number Interpretation
• If they represent signed numbers, the latter is greater. 
(1 > -1).
• If they represent unsigned numbers, the former is greater.
(4294967295 > 1).
Which is greater?
0xFFFFFFFF or 0x00000001
86
Which is Greater: 0xFFFFFFFF or 
0x00000001?
signed int x, y ; 
x = -1;
y = 1;
if (x > y)
...
unsigned int x, y ;
x = 4294967295;
y = 1;
if (x > y)
...
BLE: Branch if less than or equal, signed ≤
BLS: Branch if lower or same, unsigned ≤
It’s software’s responsibility to tell computer how to interpret data:
• If written in C,  declare the signed vs unsigned variable 
• If written in Assembly, use signed vs unsigned branch instructions
MOVS r5, #0xFFFFFFFF
MOVS r6, #0x00000001
CMP  r5, r6
BLE Then_Clause
...
MOVS r5, #0xFFFFFFFF
MOVS r6, #0x00000001
CMP  r5, r6
BLS Then_Clause
...
87
If-then Statement
C Program
// a is signed integer
if (a < 0 ) {
a = 0 – a;
}
x = x + 1;
// r1 = a (signed integer), r2 = x
CMP r1, #0         // Compare a with 0
BGE endif          // Go to endif if a ≥ 0
then    RSB r1, r1, #0     // a = - a
endif   ADD r2, r2, #1     // x = x + 1
Implementation 1:
88
Reverse Subtract
r1 = 0 – r1
Compound Boolean Expression
C Program Assembly Program
// x is a signed integer
if(x > 20 && x <= 25) {
a = 1
}
CMP r0, #20 // compare x and 20
BLE endif // go to then if x ≤ 20
CMP r0, #25 // compare x and 25
BGT endif // go to endif if x > 25
MOV r1, #1 // a = 1
endif:
90
Compound Boolean Expression
C Program Assembly Program
// x is a signed integer
if(x <= 20 || x >= 25){
a = 1;
}
// r0 = x
CMP r0, #20 // compare x and 20
BLE then // go to then if x ≤ 20
CMP r0, #25 // compare x and 25
BLT endif // go to endif if x < 25
then MOV r1, #1 // a = 1
endif
91
If-then-else
C Program
if (a == 1)
b = 3;
else
b = 4;
// r1 = a, r2 = b
CMP r1, #1   // compare a and 1
BNE else     // go to else if a ≠ 1  
then   MOV r2, #3   // b = 3 
B   endif    // go to endif
else   MOV r2, #4   // b = 4 
endif
92
For Loop
C Program
int i;
int sum = 0;
for(i = 0; i < 10; i++){
sum += i;
}
MOV r0, #0  // i
MOV r1, #0  // sum
B   check
loop ADD r1, r1, r0  // sum += i
ADD r0, r0, #1  // i++
check CMP r0, #10     // check whether i < 10
BLT loop // loop if signed less than
endloop
Implementation 1:
93
For Loop
C Program
int i;
int sum = 0;
for(i = 0; i < 10; i++){
sum += i;
}
MOV r0, #0  // i
MOV r1, #0  // sum
loop CMP r0, #10 // check whether i < 10
BGE endloop // skip if ≥
ADD r1, r1, r0  // sum += i
ADD r0, r0, #1  // i++
B   loop
endloop
Implementation 2:
94
Branching problems
98
Conditional branching can introduce several issues that affect performance and
efficiency:
• Pipeline Stalls & Branch Penalties. Conditional branches introduce uncertainty
in pipeline instruction flow. If the processor mispredicts the branch outcome, it
has to flush the pipeline and fetch new instructions, leading to delays.
• Increased Execution Time. Since branches can disrupt instruction prefetching
and decoding, they can increase execution cycles. This is especially problematic
in real-time embedded systems where deterministic execution is crucial.
Branching problems
99
• Branch stall. A pipeline stall occurs when the processor cannot proceed to the
next instruction due to dependencies or delays in instruction execution. This
results in wasted cycles, reducing overall performance.
• Data Hazards (Data Dependencies). If an instruction depends on the result of a
previous instruction that has not yet completed, the processor must stall until
the result is available. Example:
LDR R1, [R0]   ; Load value from memory into R1
ADD R2, R1, #1 ; Use R1 before it is fully loaded
The processor must wait for the LDR instruction to complete before executing ADD, leading to a stall.
Conditional Execution
if (a <= 0)  
y = -1;
else
y = 1;
CMP r0, #0
MOVLE r1, #-1 ; executed if LE
MOVGT r1, #1  ; executed if GT
LE: Signed Less than or Equal
GT: Signed Greater Than
100
Conditional execution allows instructions to be executed instead of branching, based on
flag conditions, reducing branch instructions and improving efficiency
Conditional Execution
101
Conditional execution allows instructions to be executed instead of branching, based on
flag conditions, reducing branch instructions and improving efficiency
• In ARM (A32), most instructions support condition codes (MOVLE, MOVGT,etc.)
• In Thumb-2 (T32), conditional execution must be inside an IT (If-Then) block
• The IT instruction sets conditions for up to 4 following instructions
• Reduces the need for branches, improving pipeline efficiency.
CMP r0, #0 // Compare r0 with 0
IT LE // If Less than or Equal...
MOVLE r1, #-1 // Move -1 to r1
IT GT // If Greater than...
MOVGT r1, #1 // Move 1 to r1
Conditional Execution – IT (IF – THEN)
102
With IT, you can specify a condition code for up to 4 instructions. For each
instruction, you specify if it's part of the If (T) or Else (E).
The assembler will 
complain if the 
conditions do not 
follow the IT codes
ITTET EQ
ADDEQ r0,r0,r0
ADDEQ r1,r0,r0
ADDNE r2,r0,r0
ADDEQ r3,r0,r0
Conditional Execution
if (a <= 0)  
y = -1;
else
y = 1;
CMP   r0, #0
ITE LE
MOVLE r1, #-1 // executed if LE
MOVGT r1, #1  // executed if GT
LE: Signed Less than or Equal
GT: Signed Greater Than
a ⟶ r0
y ⟶ r1
103
Conditional Execution
if (a==1 || a==7 || a==11)
y = 1;
else
y = -1;
CMP   r0, #1
ITTET NE
CMPNE r0, #7  // executed if r0 != 1
CMPNE r0, #11 // executed if r0 != 7
MOVEQ r1, #1  
MOVNE r1, #-1
NE: Not Equal
EQ: Equal
a ⟶ r0
y ⟶ r1
104
Compound Boolean Expression
C Program Assembly Program
// x is a signed integer
if(x <= 20 || x >= 25){
a = 1;
}
// r0 = x, r1 = a
CMP   r0, #20  // compare x and 20
IT LE
MOVLE r1, #1   // a=1 if less or equal
CMP   r0, #25  // CMP if greater than
IT GE
MOVGE r1, #1   // a=1 if greater or equal
Endif
105
Exercise - odd numbers counter
106
Write a program in ARMv8-M assembly that counts how many odd numbers exist in the 
range between the value stored in r0 and the value stored in r1 (assume r0 < r1). Store 
the count in register r2.
Exercise - odd numbers counter
107
Write a program in ARMv8-M assembly that counts how many odd numbers exist in the 
range between the value stored in r0 and the value stored in r1 (assume r0 < r1). Store 
the count in register r2. MOVS r2, #0         // Initialize counter
MOV r0, #0
MOV r1, #6
count_loop:
// Check if the current number in r0 is odd
TST r0, #1          // Perform bitwise AND on r0 with 1, updates Z flag
BEQ is_even // If Z flag is set (result is 0), the number is even; skip increment
// Increment counter if odd
ADDS r2, r2, #1     // Add 1 to r2 
is_even:
// Move to the next number
ADDS r0, r0, #1     // Increment r0 by 1
// Check if we have reached the end of the range
CMP r0, r1          // Compare current value (r0) with the upper limit (r1)
BLE count_loop // If r0 is Less than or Equal to r1, branch back to count_loop
end:  // Program finishes here. 
TST performs  bitwise AND on Rn and Operand2
(same as ANDS).
BEQ label | Branch if EQual | Z = 1
Exercise - clear bit
108
Write a function clear_bit in ARMv8-M assembly that clears (sets to 0) a specific bit in a 
memory location. The function takes the memory address in R0, and the bit position in 
R1. The function clears the bit at the given position in the memory location. 
Exercise - clear bit
109
Write a function clear_bit in ARMv8-M assembly that clears (sets to 0) a specific bit in a 
memory location. The function takes the memory address in R0, and the bit position in 
R1. The function clears the bit at the given position in the memory location. 
clear_bit:
// r0 contains the memory address
// r1 contains the bit position (0-31)
LDR r2, [r0]        // Load the 32-bit value from the memory address in r0 into r2
MOV r3, #1        // Load the literal value 1 into r3
LSL r3, r3, r1      // Logical Shift Left: Shift the 1 by the bit position in r1
// (r3 is now our mask, e.g., if r1=3, r3 = 0000...1000)
BIC r2, r2, r3      // Bit Clear: Clears the bit in r2 where r3 has a 1
STR r2, [r0]        // Store the updated 32-bit value back to the memory address in r0
BX lr
Greatest Common Divider (GCD)
110
What is GCD: The largest positive integer that divides two numbers a and b
without leaving a remainder.
Example:
GCD(48, 18) = 6
Greatest Common Divider (GCD)
111
Euclid’s Algorithm: Instead of factoring numbers, use division and remainder to find GCD
efficiently.
Steps:
• If b == 0, return a (GCD is found).
• Otherwise, replace (a, b) with (b, a
mod b) and repeat.
𝐺𝐶𝐷(𝑎, 𝑏) = 𝐺𝐶𝐷(𝑏, 𝑎 mod 𝑏)
Example 1: Greatest Common Divider (GCD)
mov r0, #78
mov r1, #66
GCDloop:
UDIV    r3, r0, r1 // r3 = a / b (quotient)
MUL     r3, r3, r1 // r3 = (a / b) * b
SUB     r2, r0, r3 // r2 = a - (quotient * b) → a % b
MOV     r0, r1     // a = b
MOV r1, r2 // b = a % b
CMP     r1, #0     // Check if remainder is zero
BNE     GCDloop       // If not, repeat loop
Euclid’s Algorithm
112
integer divide instruction computes 
(numerator ÷ denominator) and delivers 
the quotient
```

## Lecture 9 - FPGAs.pdf

- Role: FPGA fundamentals
- Path: `/Users/davidwickerhf/Downloads/Lecture 9 - FPGAs.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `75`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 9 - FPGAs.pdf]
```

## Lecture 10 - Vitis AI and quantization.pdf

- Role: DPU, Vitis AI, and quantization
- Path: `/Users/davidwickerhf/Downloads/Lecture 10 - Vitis AI and quantization.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `96`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Lecture 10 - Vitis AI and quantization.pdf]
```

## Tutorial 0 - STM32CubeMXIDE setup.pdf

- Role: STM32 setup and programming workflow
- Path: `/Users/davidwickerhf/Downloads/Tutorial 0 - STM32CubeMXIDE setup.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `91`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 0 - STM32CubeMXIDE setup.pdf]
```

## Tutorial 1 - Introduction to embedded programming.pdf

- Role: debugging, disassembly, and first assembly steps
- Path: `/Users/davidwickerhf/Downloads/Tutorial 1 - Introduction to embedded programming.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `107`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 1 - Introduction to embedded programming.pdf]
```

## Tutorial 2 - Arithmetic logic and loops.pdf

- Role: overflow, APSR flags, and loop disassembly
- Path: `/Users/davidwickerhf/Downloads/Tutorial 2 - Arithmetic logic and loops.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `97`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 2 - Arithmetic logic and loops.pdf]
```

## Tutorial 3 - Pointers and awesome assembly.pdf

- Role: pointer exercises and simple assembly practice
- Path: `/Users/davidwickerhf/Downloads/Tutorial 3 - Pointers and awesome assembly.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `100`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 3 - Pointers and awesome assembly.pdf]
```

## Tutorial 3 solutions.docx

- Role: tutorial 3 worked answers
- Path: `/Users/davidwickerhf/Downloads/Tutorial 3 solutions.docx`
- Pages: `n/a (docx)`
- Extracted characters: `79`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 3 solutions.docx]
```

## Tutorial 4 - Awesome assembly pt2.pdf

- Role: assembly control-flow exercises
- Path: `/Users/davidwickerhf/Downloads/Tutorial 4 - Awesome assembly pt2.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `91`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 4 - Awesome assembly pt2.pdf]
```

## Tutorial 4 solutions.docx

- Role: tutorial 4 worked answers
- Path: `/Users/davidwickerhf/Downloads/Tutorial 4 solutions.docx`
- Pages: `n/a (docx)`
- Extracted characters: `79`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 4 solutions.docx]
```

## Tutorial 0 - Vitis AI Setup.pdf

- Role: Vitis AI environment setup
- Path: `/Users/davidwickerhf/Downloads/Tutorial 0 - Vitis AI Setup.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `85`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Tutorial 0 - Vitis AI Setup.pdf]
```

## Solutions.pdf

- Role: edge-AI model and quantization solutions
- Path: `/Users/davidwickerhf/Downloads/Solutions.pdf`
- Pages: `n/a (docx)`
- Extracted characters: `67`

### Extracted Text

```text
[Missing source file: /Users/davidwickerhf/Downloads/Solutions.pdf]
```
