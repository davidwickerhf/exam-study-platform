# Topic 3 — Data Representation and C Memory

**Lecture slides:** `Lecture 4 - Data representation and bitwise operations.pdf`, `Lecture 5 - Pointers.pdf`, `Pointers and structs.pdf`, `Lecture 6 - ARM ISA - Operations.pdf`
**Tutorial coverage:** Tutorial 2 (arithmetic, logic, loops), Tutorial 3 (pointers and assembly)
**Past exam coverage:** Paper 1 Q5 (little-endian storage), Q10 (`*(ptr + 2)`), Exercise 2 (pointers/arrays/byte layout), Exercise 3 (set/clear bits in a register); Paper 2 Exercise 2 (AND/OR/XOR by hand, overflow at `0x7FFFFFFF`, odd-bit test). The **bit-check practical** is built on this chapter — shift-and-AND.

This chapter is the bit-level foundation for the assembly half of the course: binary/hex reasoning, signedness and overflow, bitwise operations and masks, byte ordering in memory, and the pointer model that ties C variables to addresses. Every higher topic (arithmetic instructions, comparisons and branching, memory-mapped I/O, the calling convention) assumes you can move fluently between a number's *value*, its *fixed-width bit pattern*, and its *layout in memory*. Get this layer reliable and the rest stops being guesswork.

> [!warning] Resit priority — the bit-check practical lives here
> The ~10-point practical asks: *given a value and a bit index, return whether that bit is 0 or 1*. That is exactly the **shift-and-AND** pattern from this chapter, `(value >> index) & 1`. The [[#Bitwise Operations, Masks, and Shifts]] section works it out concretely; the set / clear / toggle / test patterns must be automatic.

---

## Number Systems: Binary, Decimal, and Hex

> [!info] Core vocabulary
> - **Decimal:** base-$10$ representation using digits $0$–$9$.
> - **Binary:** base-$2$ representation using digits $0$ and $1$.
> - **Hexadecimal:** base-$16$ representation using digits $0$–$9$ and $A$–$F$.
> - **Bit:** a binary digit.
> - **Byte:** eight bits.

Embedded reasoning constantly crosses representation boundaries. A single value may be stated in decimal in a problem, manipulated bitwise in binary, and written in hexadecimal in code, register maps, or debugger output. The data-representation exercises *start* with conversions, so weak habits cost easy points everywhere.

### Positional notation: the one formula behind every base

The lecture frames every base with a single expression. A number with digits $a_k a_{k-1} \dots a_1 a_0$ in base $b$ has value:

$$n = a_k b^k + a_{k-1} b^{k-1} + \dots + a_1 b^1 + a_0 b^0 \qquad \text{with } 0 \le a_j < b$$

Each digit is weighted by a power of the base; the rightmost digit is the $b^0$ (ones) column. This *one rule* generates decimal, binary, hex, and any other base. The slides deliberately ask for $(6134)_8$, $(6134)_7$, $(6134)_6$ to drive home that the digits stay the same and only the weights change.

> [!info] Slide worked examples
> - **Binary → decimal:** $10110_2 = 1{\cdot}2^4 + 0{\cdot}2^3 + 1{\cdot}2^2 + 1{\cdot}2^1 + 0{\cdot}2^0 = 16 + 4 + 2 = 22_{10}$.
> - **Hex → decimal:** $\texttt{2ED}_{16} = 2{\cdot}16^2 + E{\cdot}16^1 + D{\cdot}16^0 = 512 + 224 + 13 = 749_{10}$.
> - **Decimal → hex:** $123_{10} = \texttt{7B}_{16}$, written `0x7B`.

### Why hexadecimal is everywhere

Writing long binary numbers is tedious and error-prone. A group of four bits represents one of $2^4 = 16$ possibilities, so a binary pattern can be rewritten compactly in base $16$ without losing bit-level meaning. That is why addresses, masks, and register values are shown in hex: it preserves bit structure while staying readable.

$$1 \text{ hex digit} = 4 \text{ bits (a } \textit{nibble}\text{)} \qquad 1 \text{ byte} = 8 \text{ bits} = 2 \text{ hex digits}$$

### Decimal → binary by repeated division

The slides give a mechanical method: **divide by $2$ repeatedly, recording remainders**, then read the remainders *bottom-up*.

```text
14 ÷ 2 = 7  remainder 0   <- LSB (read last)
 7 ÷ 2 = 3  remainder 1
 3 ÷ 2 = 1  remainder 1
 1 ÷ 2 = 0  remainder 1   <- MSB (read first)
```

Reading the remainders from bottom to top: $14_{10} = 1110_2$.

### Converting structurally, not by memory

- **Decimal → binary** asks *which powers of two are present*. Either divide repeatedly (above), or decompose directly: $25 = 16 + 8 + 1 = 2^4 + 2^3 + 2^0 = 11001_2$.
- **Binary → decimal** asks *what weighted sum the set bits represent*: apply the positional formula.
- **Binary ↔ hex** is grouping into four-bit chunks from the right, or expanding each hex digit into a nibble.

**Nibble grouping example:**

```text
binary:  1101 0110
hex:       D    6
result: 0xD6
```

So decimal $25$ in all three forms:

$$25_{10} = 11001_2 = \texttt{0x19}$$

The *same* bit pattern can have multiple interpretations depending on width and whether you treat it as signed, unsigned, raw data, or an address. Clean number-system habits let you make those distinctions deliberately.

> [!tip] What you must know
> - Convert small decimal values to binary and back, by division *and* by powers of two.
> - The positional formula $n = \sum a_j b^j$ works for any base.
> - Each hexadecimal digit corresponds to exactly $4$ bits.
> - Read common prefixes: `0b` for binary, `0x` for hex.

> [!warning] Common pitfalls
> - Guessing conversions from pattern recognition without checking powers of two.
> - Forgetting leading zeros when grouping bits into hexadecimal nibbles: `110` is `0110`, not `0011`.
> - Reading repeated-division remainders top-down instead of bottom-up.

> [!tip] 30-second oral answer
> Binary is the machine-native representation, decimal is the human counting system, and hexadecimal is a compact notation for binary where each hex digit stands for $4$ bits. Decimal $25$ equals binary $11001$, and hex `0x19` is another way to write the same value.

---

## Fixed-Width Data, Sizes, and Signedness

> [!info] Core vocabulary
> - **Fixed-width integer:** an integer represented using a fixed number of bits.
> - **Bit / Byte / Half-word / Word / Double-word:** $1$ / $8$ / $16$ / $32$ / $64$ bits respectively.
> - **MSB / LSB:** Most / Least Significant Bit; the top bit (bit $31$ of a word) and bit $0$.
> - **Signed integer:** an interpretation reserving part of the bit-pattern range for negatives.
> - **Unsigned integer:** an interpretation where every bit pattern is non-negative.

A machine does not store mathematical integers in an unlimited way. It stores **fixed-width bit patterns**, and those patterns can be interpreted as signed or unsigned depending on the instruction or data type in use.

### Storage units and C data types

The lecture fixes the size vocabulary used throughout the assembly material:

| Unit | Width | C type (course, 32-bit) | Alignment |
| --- | --- | --- | --- |
| Bit | $1$ bit | — | — |
| Byte | $8$ bits | `bool`, `char` | byte |
| Half-word | $16$ bits | `short int` | halfword |
| Word | $32$ bits | `int`, `long int`, `float` | word |
| Double-word | $64$ bits | `long long`, `double` | word |

> [!info] Slide detail — `bool` and `char`
> A C `bool` occupies a whole byte; only bit $0$ carries the truth value and bits $1$–$7$ are ignored. A `char` is $8$ bits, signed ($-128$ to $127$) or unsigned ($0$ to $255$). A typical `int` on the course's $32$-bit systems is $4$ bytes.

### Unsigned and signed ranges

For an $n$-bit field, the **unsigned** range is $0$ to $2^n - 1$; the **two's-complement signed** range is $-2^{n-1}$ to $2^{n-1}-1$.

| Storage size | Unsigned range | Signed (two's complement) range |
| --- | --- | --- |
| Byte ($8$) | $0$ to $2^8-1 = 255$ | $-2^7$ to $2^7-1$  ($-128$ to $127$) |
| Half-word ($16$) | $0$ to $2^{16}-1 = 65535$ | $-2^{15}$ to $2^{15}-1$ |
| Word ($32$) | $0$ to $2^{32}-1 = 4\,294\,967\,295$ | $-2^{31}$ to $2^{31}-1$ |
| Double-word ($64$) | $0$ to $2^{64}-1$ | $-2^{63}$ to $2^{63}-1$ |

> [!info] Slide worked example — unsigned wraparound
> `unsigned int x = 4294967295;` is the all-ones word `0xFFFFFFFF`. Doing `x = x + 1;` wraps to `0`: the value $2^{32}$ does not fit in $32$ bits, so the carry out is discarded. The IDE shows the *same bits* as decimal $-1$ if read signed. Raw pattern and interpretation are different layers.

---

## Signed Integer Representation and Two's Complement

> [!info] Core vocabulary
> - **Signed magnitude:** top bit is the sign, remaining bits are the magnitude.
> - **One's complement:** negate by inverting (flipping) every bit.
> - **Two's complement (TC):** negate by inverting every bit, then adding $1$. Used by all modern computers.
> - **Overflow:** a *signed* result too large or too small for the bit width.
> - **Carry:** an extra bit produced when an *unsigned* result exceeds the width.

The lecture builds up to two's complement by showing why the simpler schemes fail. Take $5 = 0101_2$ and ask how to write $-5$ in $4$ bits:

| Scheme | $-5$ | Problem |
| --- | --- | --- |
| **Signed magnitude** | $1101$ | $5 + (-5)$ does not give $0$ with ordinary addition; there are two zeros ($0000$ and $1000$). |
| **One's complement** | $1010$ (invert all bits) | Still two zeros ($0000$ and $1111$); addition needs an end-around carry fix. |
| **Two's complement** | $1011$ (invert, then $+1$) | $5 + (-5) = 0$ with one ordinary adder; **one** unique zero. |

### Why two's complement wins

Two's complement lets the *same adder circuitry* handle both positive and negative arithmetic, and it gives exactly one representation of zero. It is defined by:

$$\alpha + \overline{\alpha} = 2^n$$

so the negative of a value is obtained by **inverting every bit and adding $1$**: the bitwise NOT of the positive counterpart, plus one.

> [!info] Slide worked example — TC(3) in 5 bits
> | Step | Binary | Decimal |
> | --- | --- | --- |
> | Original number | `0b00011` | $3$ |
> | Step 1, invert every bit | `0b11100` | — |
> | Step 2, add $1$ | `0b11100 + 0b00001` | — |
> | Two's complement | `0b11101` | $-3$ |

So $\texttt{0b11101}$ read as a signed $5$-bit number is $-3$; read unsigned it is $29$. Same bits, two meanings.

### Overflow at `0x7FFFFFFF` (Paper 2 Exercise 2c)

Start with a $32$-bit signed integer holding the largest positive value:

$$\texttt{0x7FFFFFFF} = 2147483647 = 2^{31} - 1$$

Add $1$:

$$\texttt{0x7FFFFFFF} + 1 = \texttt{0x80000000}$$

The bit pattern is perfectly valid, but under $32$-bit *signed* interpretation `0x80000000` is now the most negative value:

$$\texttt{0x80000000}_{\text{signed}} = -2^{31} = -2147483648$$

The value "wrapped" from the largest positive to the smallest negative: that is **signed overflow**.

### When does signed overflow happen?

The slides give the complete rule. Adding two two's-complement numbers, overflow occurs in **only two cases**:

$$+A + (+B) = -C \qquad\qquad -A + (-B) = +C$$

For subtraction:

$$+A - (-B) = -C \qquad\qquad -A - (+B) = +C$$

> [!tip] Overflow shortcut
> Overflow **cannot occur** when adding operands of *different* signs, nor when subtracting operands of the *same* sign. It only happens when the result's sign is impossible given the input signs.

> [!info] Slide circle examples (5-bit)
> - $12 + 5$: $01100 + 00101 = 10001$. Two positives gave a negative ($-15$): **signed overflow**.
> - $-13 + (-7)$: $10011 + 11001 = 1\,01100$, extra bit discarded, $5$-bit result $01100 = +12$. Two negatives gave a positive: **signed overflow**.

> [!warning] Common pitfalls
> - Treating signed overflow and unsigned carry as the same thing (see [[#APSR Flags and Arithmetic Meaning]]).
> - Forgetting that raw bits and interpreted numeric meaning are different layers.
> - Computing two's complement as "just invert". You must also **add $1$** (that is one's complement).

---

## Carry, Borrow, and Unsigned Arithmetic

> [!info] Core vocabulary
> - **Carry:** when a column sum exceeds the digit "capacity" ($1$ in binary), the extra value is carried to the next column.
> - **Borrow:** when the top digit of a subtraction column is smaller than the bottom digit, value is borrowed from the next higher bit.

Carry and borrow are the *unsigned* counterparts of overflow. The slides illustrate column arithmetic directly:

```text
   1 0 1 1            1 1 0 0
 + 1 1 0 1          -  0 0 0 1
 ---------          ---------
 1 1 0 0 0            1 0 1 1
```

### The carry flag for unsigned numbers

Given unsigned integers $a$ and $b$ in $n$ bits:

- For $c = a + b$: a **carry** happens if $c$ is too big to fit, i.e. $c > 2^n - 1$.
- For $c = a - b$: a **borrow** happens if $c < 0$.

> [!info] Slide example — carry on addition (5-bit)
> $28 + 6$: $11100 + 00110 = 1\,00010$. The result crosses the boundary between $2^n-1$ and $0$ (the "$31 \to 0$" wrap on the circle); the extra bit is discarded and the **carry flag is set to $1$**.

> [!info] Slide example — borrow on subtraction (5-bit)
> $3 - 5$: $00011 - 00101 = 11110$ ($= 30$ unsigned). The result needed a borrow; the **carry flag is cleared to $0$**.

### Carry = NOT borrow on ARM Cortex-M

ARM Cortex-M processors **do not have a dedicated borrow flag**; they reuse the carry flag ($C$):

- $C = 1$ means **no borrow** was needed (e.g. $R1 \ge R2$).
- $C = 0$ means a **borrow** was needed ($R1 < R2$).

So for an unsigned subtraction, $\text{Carry} = \text{NOT Borrow}$. This convention is why unsigned branches such as `BHS` / `BLO` consult the carry flag (see [[#APSR Flags and Arithmetic Meaning]]).

> [!tip] Signed or unsigned? The CPU does not know
> Given `a = 0b10000000; b = 0b10000000; c = a + b;`, the value `0b10000000` could be $128$ (unsigned) or $-128$ (signed). The **CPU cannot tell**, so the hardware sets up *both* the carry flag and the overflow flag on every add/subtract. It is the **software's** (programmer's or compiler's) responsibility to interpret the right one: check carry if the variables are `unsigned int`, check overflow if they are `int`.

---

## Bitwise Operations, Masks, and Shifts

> [!info] Core vocabulary
> - **Bitwise AND** (`&`): produces $1$ only where *both* corresponding bits are $1$.
> - **Bitwise OR** (`|`): produces $1$ where *at least one* corresponding bit is $1$.
> - **Bitwise XOR** (`^`): produces $1$ where the corresponding bits *differ*.
> - **Bitwise NOT** (`~`): inverts every bit.
> - **Left shift** (`<<`) / **Right shift** (`>>`): move bits toward more / less significant positions.
> - **Mask:** a bit pattern used to select, clear, set, or toggle specific bits.

Bitwise operations are everywhere in low-level programming: register configuration, efficient arithmetic, packed flag fields. The roles map cleanly:

| Operation | Symbol | Truth rule | Typical embedded use |
| --- | --- | --- | --- |
| AND | `&` | $1$ only if both inputs $1$ | **Keep / test / clear** selected bits (masking) |
| OR | `\|` | $1$ if either input $1$ | **Set** bits |
| XOR | `^` | $1$ if inputs differ | **Toggle** bits; compare patterns |
| NOT | `~` | invert every bit | build a clear-mask |
| Left shift | `<<` | bits move up | **Position** a bit; multiply by $2^n$ |
| Right shift | `>>` | bits move down | **Position** a bit; divide by $2^n$ |

The single-bit truth table from the slide:

| A | B | A&B | A\|B | A^B |
| --- | --- | --- | --- | --- |
| $0$ | $0$ | $0$ | $0$ | $0$ |
| $1$ | $0$ | $0$ | $1$ | $1$ |
| $0$ | $1$ | $0$ | $1$ | $1$ |
| $1$ | $1$ | $1$ | $1$ | $0$ |

### Slide worked examples — AND / OR / XOR on a full byte

With `A = 0x3B = 0b00111011` and `B = 0x96 = 0b10010110`:

```text
  00111011  3B          00111011  3B          00111011  3B
& 10010110  96        | 10010110  96        ^ 10010110  96
----------            ----------            ----------
  00010010  12          10111111  BF          10101101  AD
```

$$\texttt{0x3B} \;\&\; \texttt{0x96} = \texttt{0x12} \qquad \texttt{0x3B} \;|\; \texttt{0x96} = \texttt{0xBF} \qquad \texttt{0x3B} \;\oplus\; \texttt{0x96} = \texttt{0xAD}$$

Line up the bits positionally and apply the operation **one column at a time**. (Paper 2 Exercise 2b is the same drill with `10110100` against `00001111`: AND $= 00000100$, OR $= 10111111$, XOR $= 10111011$.)


### Shifts as power-of-two arithmetic

A left shift by $n$ multiplies an unsigned value by $2^n$; a right shift divides by $2^n$ (no overflow). From the slide, with `A = 0x3B = 0b00111011`:

```text
C = A << 2;   ->  0b11101100  = 0xEC      (× 4)
C = A >> 4;   ->  0b00000011  = 3         (÷ 16)
```

$$x \ll 1 = x \times 2 \qquad x \ll 3 = x \times 8 \qquad x \gg 3 = x \div 8$$

A shift changes *bit position*; the numeric effect follows from that positioning.

<figure class="diag-figure">
  <figcaption>Bit positions in an 8-bit byte — bit 7 is most significant (MSB), bit 0 least significant (LSB)</figcaption>
  <svg viewBox="0 0 620 130" class="diag-svg" role="img" aria-label="Bit positions in a byte">
    <rect x="20"  y="40" width="70" height="46" class="d-node-acc"/>
    <text x="55"  y="69" text-anchor="middle" class="d-h">1</text>
    <rect x="90"  y="40" width="70" height="46" class="d-node"/>
    <text x="125" y="69" text-anchor="middle" class="d-h">0</text>
    <rect x="160" y="40" width="70" height="46" class="d-node"/>
    <text x="195" y="69" text-anchor="middle" class="d-h">1</text>
    <rect x="230" y="40" width="70" height="46" class="d-node"/>
    <text x="265" y="69" text-anchor="middle" class="d-h">1</text>
    <rect x="300" y="40" width="70" height="46" class="d-node"/>
    <text x="335" y="69" text-anchor="middle" class="d-h">0</text>
    <rect x="370" y="40" width="70" height="46" class="d-node"/>
    <text x="405" y="69" text-anchor="middle" class="d-h">1</text>
    <rect x="440" y="40" width="70" height="46" class="d-node"/>
    <text x="475" y="69" text-anchor="middle" class="d-h">1</text>
    <rect x="510" y="40" width="70" height="46" class="d-node-acc"/>
    <text x="545" y="69" text-anchor="middle" class="d-h">0</text>

    <text x="55"  y="28" text-anchor="middle" class="d-sub">bit 7</text>
    <text x="125" y="28" text-anchor="middle" class="d-sub">bit 6</text>
    <text x="195" y="28" text-anchor="middle" class="d-sub">bit 5</text>
    <text x="265" y="28" text-anchor="middle" class="d-sub">bit 4</text>
    <text x="335" y="28" text-anchor="middle" class="d-sub">bit 3</text>
    <text x="405" y="28" text-anchor="middle" class="d-sub">bit 2</text>
    <text x="475" y="28" text-anchor="middle" class="d-sub">bit 1</text>
    <text x="545" y="28" text-anchor="middle" class="d-sub">bit 0</text>

    <text x="55"  y="106" text-anchor="middle" class="d-label-accent">MSB</text>
    <text x="545" y="106" text-anchor="middle" class="d-label-accent">LSB</text>
    <text x="300" y="118" text-anchor="middle" class="d-sub">value shown: 0b10110110 = 0xB6 = 182</text>
  </svg>
</figure>

### The four bit-manipulation patterns: set, clear, toggle, test

This is the heart of the chapter for the practical. Every pattern builds a **single-bit mask** with `(1 << n)` and combines it with the variable. The lecture gives all four for bit $7$:

| Goal | C expression | Why it works |
| --- | --- | --- |
| **Set** bit $n$ | `var \|= (1 << n);` | OR with a $1$ forces that bit to $1$, leaves others unchanged |
| **Clear** bit $n$ | `var &= ~(1 << n);` | AND with a $0$ forces that bit to $0$ (`~` makes all-ones-except-bit-n) |
| **Toggle** bit $n$ | `var ^= (1 << n);` | XOR with a $1$ flips that bit, leaves others unchanged |
| **Test** bit $n$ | `if ((var & (1 << n)) != 0)` | AND keeps *only* bit $n$; non-zero means the bit was set |
| **Extract** bit $n$ | `(var >> n) & 1;` | shift the bit down to position $0$, mask off the rest |

> [!info] Slide worked exercises — `A = 0x3B = 0b00111011`
> - **Set bit 7:** `A \| (1<<7)` → `0b10111011 = 0xBB`.
> - **Toggle bit 5** of that result: `^= (1<<5)` → `0b10011011 = 0x9B`.
> - **Test bit 4:** `if (A & (1 << 4))`, true when bit $4$ is set.
> - **Clear bit 3:** `A &= ~(1 << 3);`.
> - **Retrieve the value of bit 5:** `(A >> 5) & 1;`.

> [!tip] The bit-check practical, worked concretely
> *"Given value `v` and index `i`, return whether bit `i` is 0 or 1."* Two equivalent one-liners:
> - **Mask method:** `(v & (1 << i)) != 0`, non-zero ⇒ bit is $1$.
> - **Shift method:** `(v >> i) & 1`, gives exactly $0$ or $1$.
>
> Concrete trace, `v = 0b1011`, `i = 2`:
> $$1 \ll 2 = \texttt{0b0100} \qquad \texttt{0b1011} \;\&\; \texttt{0b0100} = \texttt{0b0000} = 0 \;\Rightarrow\; \text{bit 2 is } 0$$
> And `i = 3`:
> $$1 \ll 3 = \texttt{0b1000} \qquad \texttt{0b1011} \;\&\; \texttt{0b1000} = \texttt{0b1000} \ne 0 \;\Rightarrow\; \text{bit 3 is } 1$$
> Or by shifting: `0b1011 >> 3 = 0b0001`, then `& 1 = 1`.

In ARM Thumb assembly the same idea is a shift plus an AND, or the `TST` instruction (`TST r0, #(1<<i)` sets the $Z$ flag if the masked bits are zero). Paper 2 Exercise 2d, *"set `r1=1` if `r0` is odd"*, is the `i=0` case: `TST r0, #1` then branch on `Z`.

> [!warning] Common pitfalls
> - Confusing **bitwise** AND (`&`, per-bit) with **logical** AND (`&&`, whole truth values).
> - Forgetting the `~` when clearing. `var &= (1<<n)` clears *everything except* bit $n$, the opposite of intended.
> - Forgetting that a shift changes *position*, not only numeric value.
> - "Bit $n$" is $0$-indexed: bit $0$ is the LSB. An index $i$ selects the value $2^i$.

These operations are the C-level mirror of the ARM arithmetic, logical, and shift instructions, and masks are the standard tool for [[Memory-Mapped I-O and GPIO in Assembly|memory-mapped I/O]]: Paper 1 Exercise 3 sets and clears bits in a GPIO register with `ORR` / `BIC`.

---

## Endianness and Memory Layout

> [!info] Core vocabulary
> - **Byte-addressable memory:** memory is an array of bytes; each byte has its own address. The smallest addressable unit is a byte.
> - **Endianness:** the ordering of the bytes of a multi-byte value in memory.
> - **Little-endian:** stores the *least*-significant byte at the *lowest* address (Intel; ARM default).
> - **Big-endian:** stores the *most*-significant byte at the *lowest* address (SPARC, Motorola).
> - **Bi-endian:** ARM, PowerPC, Alpha can be *configured* either way.

Endianness does **not** change the numeric meaning of a value; it changes the *order in which that value's bytes appear in memory*. On ARM Cortex-M, each address holds one byte ($8$ bits) and each address is itself $32$ bits wide. An object that occupies multiple bytes (a $4$-byte word) spans several consecutive addresses.

### The address of a multi-byte object

> [!info] Slide rule
> If a variable occupies multiple bytes, its **address is the lowest address of all the bytes it occupies**, regardless of endianness. A word starting at `0x20000004` has address `0x20000004` whether the machine is little- or big-endian.

### Worked example — storing `0x12345678`

The four bytes of the word `0x12345678`, most-significant to least-significant: `12 34 56 78`.

- **Little-endian** stores the LSB (`78`) at the lowest address, so memory reads `78 56 34 12` from low to high.
- **Big-endian** stores the MSB (`12`) at the lowest address, so memory reads `12 34 56 78`.

<figure class="diag-figure">
  <figcaption>Little-endian vs big-endian layout of the word 0x12345678 — addresses increase left to right</figcaption>
  <svg viewBox="0 0 560 220" class="diag-svg" role="img" aria-label="Endianness byte layout">
    <text x="280" y="24" text-anchor="middle" class="d-h-sm">word value: 0x12345678</text>

    <text x="60" y="62" text-anchor="middle" class="d-sub">addr</text>
    <text x="160" y="62" text-anchor="middle" class="d-sub">+0</text>
    <text x="240" y="62" text-anchor="middle" class="d-sub">+1</text>
    <text x="320" y="62" text-anchor="middle" class="d-sub">+2</text>
    <text x="400" y="62" text-anchor="middle" class="d-sub">+3</text>

    <text x="60" y="98" text-anchor="middle" class="d-h-sm">little</text>
    <rect x="120" y="74" width="80" height="40" class="d-node-acc"/>
    <text x="160" y="99" text-anchor="middle" class="d-h">78</text>
    <rect x="200" y="74" width="80" height="40" class="d-node"/>
    <text x="240" y="99" text-anchor="middle" class="d-h">56</text>
    <rect x="280" y="74" width="80" height="40" class="d-node"/>
    <text x="320" y="99" text-anchor="middle" class="d-h">34</text>
    <rect x="360" y="74" width="80" height="40" class="d-node"/>
    <text x="400" y="99" text-anchor="middle" class="d-h">12</text>
    <text x="490" y="99" text-anchor="middle" class="d-sub">LSB first</text>

    <text x="60" y="166" text-anchor="middle" class="d-h-sm">big</text>
    <rect x="120" y="142" width="80" height="40" class="d-node"/>
    <text x="160" y="167" text-anchor="middle" class="d-h">12</text>
    <rect x="200" y="142" width="80" height="40" class="d-node"/>
    <text x="240" y="167" text-anchor="middle" class="d-h">34</text>
    <rect x="280" y="142" width="80" height="40" class="d-node"/>
    <text x="320" y="167" text-anchor="middle" class="d-h">56</text>
    <rect x="360" y="142" width="80" height="40" class="d-node-acc"/>
    <text x="400" y="167" text-anchor="middle" class="d-h">78</text>
    <text x="490" y="167" text-anchor="middle" class="d-sub">MSB first</text>

    <text x="280" y="206" text-anchor="middle" class="d-sub">same value, different byte order in RAM</text>
  </svg>
</figure>

> [!tip] What you must know
> - In little-endian, `0x12345678` is stored low-to-high as `78 56 34 12` (Paper 1 Q5 answer).
> - The course's Cortex-M33 is **little-endian by default**.
> - Memory is byte-addressable; a variable's address is the *lowest* byte it occupies.

> [!warning] Common pitfalls
> - Reversing **nibble** order instead of **byte** order: `0x12` stays `12`, never `21`. Only whole bytes reorder.
> - Thinking little-endian changes the abstract value rather than just its storage layout.

When reading a debugger memory pane, always ask whether the view is byte-level and how the architecture stores words. This connects to [[Debugging with Breakpoints, Registers, Memory, and Disassembly|debugger memory inspection]].

---

## C Data Types, Pointers, and Addresses

> [!info] Core vocabulary
> - **Address:** a numeric identifier for a memory location.
> - **Pointer:** a variable whose *value is a memory address* of another variable.
> - **Reference / address-of operator (`&`):** `&x` returns the address of `x`.
> - **Dereference / indirection operator (`*`):** `*p` returns the value at the address `p` holds.

Pointers are central in embedded programming because hardware registers, buffers, arrays, and call-by-reference APIs all reduce to **addresses and memory access**. The key habit: a pointer variable stores a *location*, not the value at that location.

> [!info] Slide summary
> `&var:` address of `var`  ·  `*ptr:` value at the address pointed by `ptr`.

> [!warning] The key distinction
> Always separate the **pointer value** (an address) from the **pointee value** (the data stored there). If a pointer points to `x`, then `*p` is simply another access path to `x`. Confusing `ptr` with `*ptr` is the most common pointer mistake on the exam.

<figure class="diag-figure">
  <figcaption>Pointer-to-variable relationship — p holds the address of x; *p reaches the value</figcaption>
  <svg viewBox="0 0 600 160" class="diag-svg" role="img" aria-label="Pointer dereference">
    <defs>
      <marker id="arr-p" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <rect x="40" y="52" width="180" height="56" class="d-node-acc"/>
    <text x="130" y="76" text-anchor="middle" class="d-h-sm">int *p</text>
    <text x="130" y="96" text-anchor="middle" class="d-sub">value = 0x20000004</text>

    <rect x="380" y="52" width="180" height="56" class="d-node"/>
    <text x="470" y="76" text-anchor="middle" class="d-h-sm">int x  @ 0x20000004</text>
    <text x="470" y="96" text-anchor="middle" class="d-sub">value = 1</text>

    <line x1="220" y1="80" x2="378" y2="80" class="d-edge" marker-end="url(#arr-p)"/>
    <text x="300" y="68" text-anchor="middle" class="d-label-accent">*p  /  &amp;x</text>
    <text x="300" y="98" text-anchor="middle" class="d-sub">p = &amp;x</text>

    <text x="300" y="140" text-anchor="middle" class="d-sub">p stores the address · *p reads/writes the data at that address</text>
  </svg>
</figure>

### Declaration and basic use

The declaration `int *p;` means *`p` can hold the address of an integer*. The slide steps through it explicitly:

```c
int x = 1;
int *ptr;     /* ptr can point to an integer; value is garbage  */
ptr = &x;     /* ptr now holds the address of x                 */
*ptr = 5;     /* dereference: writes 5 into x — x is now 5       */
```

After `*ptr = 5;`, the pointer `ptr` is unchanged (still the address of `x`), but `x` itself became `5` because the write went *through* the address.


### Pointer size and why the type matters

> [!info] Slide detail
> A pointer is **always $4$ bytes ($32$ bits)** on a $32$-bit system: `sizeof(int*) == sizeof(double*) == 4`. The *type* in the declaration is not about storage size; it tells the compiler **how many bytes to read/write when dereferencing** and **how far to step in pointer arithmetic**. `int *` reads $4$ bytes, `char *` reads $1$.

> [!info] Slide example — raw memory access
> `char *address = (char *) 0x20000000;` makes a `char` pointer to a fixed address. `char data = *address;` reads **1 byte** (because the pointee type is `char`) from `0x20000000`. `*address = 0x89;` *writes* one byte to that location. Casting the literal address `(int *)0x20000002` is how embedded code reaches hardware registers (see [[Memory-Mapped I-O and GPIO in Assembly]]).

> [!tip] What you must know
> - `int *p;` means `p` can hold the address of an integer.
> - `p = &x;` stores the address of `x` in `p`; `*p` is the value at that address.
> - A pointer is $4$ bytes regardless of pointee type; the type sets the dereference width.
> - Dereferencing lets code modify the original object indirectly.

> [!warning] Common pitfalls
> - Confusing `ptr` (the address) with `*ptr` (the data).
> - Using an uninitialised pointer; its value is garbage until you assign an address.

> [!tip] 30-second oral answer
> A pointer is a variable whose value is a memory address, and dereferencing it accesses the value stored there. Hardware registers, arrays, buffers, and call-by-reference APIs all depend on address reasoning. The exam tests whether you can separate the address from the value, and whether you know pointer arithmetic scales by element size.

---

## Arrays, Pointer Arithmetic, and Call by Reference

> [!info] Core vocabulary
> - **Pointer arithmetic:** arithmetic on pointers that advances by *element size*, not by raw bytes.
> - **Array decay:** an array name behaves like a pointer to its first element.
> - **Call-by-reference style:** passing addresses so a function can modify the caller's original variables.

### The scaling rule

> [!warning] Pointer arithmetic scales by `sizeof`
> `ptr + 1` means *the next element*, not *the next byte*, unless the element type is itself one byte. The compiler computes:
> $$\text{addr}(\texttt{ptr} + n) = \text{addr}(\texttt{ptr}) + n \times \texttt{sizeof}(T)$$

The lecture demonstrates this directly. `char *ptr; ptr++;` advances by `sizeof(char) = 1`. `int *ptr; ptr++;` advances by `sizeof(int) = 4`. So an `int *` at `0x20000004`, after `ptr++`, points to `0x20000008`, *not* `0x20000005`.

### Arrays and pointers are deeply linked

> [!info] Slide rule
> *The array name is a pointer to the first element of the array.* The slides list five facts:
> ```c
> int array[5];          /* declares 5 contiguous integers              */
> int *ptr = array;      /* arrays can be used as pointers (decay)       */
> ptr[0] = 1;            /* pointers can be indexed with array syntax    */
> *(array + 1) = 2;      /* arrays can be dereferenced with pointer syntax */
> *(1 + array) = 3;      /* pointer addition is commutative              */
> ```
> And the identity: `array[i]` is *defined as* `*(array + i)`.

### Worked example — pointer arithmetic over an array (Paper 1 Q10 / Exercise 2)

```c
int arr[] = {10, 20, 30, 40};
int *ptr = arr;            /* array decays to &arr[0]           */
int a = *(ptr + 2);        /* a = 30  -- arr[2]                 */
*(ptr + 1) = 99;           /* arr[1] becomes 99                 */
```

- `ptr` stores the address of `arr[0]`.
- `*(ptr + 2)` is `arr[2]`, so `a = 30`; `ptr + 2` advances $2 \times 4 = 8$ bytes.
- Final array: `{10, 99, 30, 40}`.

<figure class="diag-figure">
  <figcaption>Pointer-to-array relationship — *(ptr + 2) advances 2 elements, not 2 bytes</figcaption>
  <svg viewBox="0 0 560 170" class="diag-svg" role="img" aria-label="Pointer arithmetic over an array">
    <defs>
      <marker id="arr-a3" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <rect x="60"  y="70" width="120" height="48" class="d-node-acc"/>
    <text x="120" y="91" text-anchor="middle" class="d-h">10</text>
    <text x="120" y="109" text-anchor="middle" class="d-sub">arr[0] @ +0</text>

    <rect x="200" y="70" width="120" height="48" class="d-node"/>
    <text x="260" y="91" text-anchor="middle" class="d-h">20</text>
    <text x="260" y="109" text-anchor="middle" class="d-sub">arr[1] @ +4</text>

    <rect x="340" y="70" width="120" height="48" class="d-node-acc"/>
    <text x="400" y="91" text-anchor="middle" class="d-h">30</text>
    <text x="400" y="109" text-anchor="middle" class="d-sub">arr[2] @ +8</text>

    <text x="120" y="56" text-anchor="middle" class="d-sub">ptr</text>
    <text x="400" y="56" text-anchor="middle" class="d-label-accent">ptr + 2</text>

    <path d="M 120 132 L 120 120" class="d-edge" marker-end="url(#arr-a3)"/>
    <path d="M 400 132 L 400 120" class="d-edge" marker-end="url(#arr-a3)"/>
    <text x="260" y="156" text-anchor="middle" class="d-sub">*(ptr + 2) = 30 · each step = sizeof(int) = 4 bytes</text>
  </svg>
</figure>

### Operator precedence — `*ptr++` vs `(*ptr)++`

> [!warning] `++` binds tighter than `*`
> - `*ptr++` is `*(ptr++)`: **read/write the value, then move the pointer**. `x = *ptr++;` ≡ `x = *ptr; ptr++;`.
> - `(*ptr)++`: **increment the pointed-to value**. `x = (*ptr)++;` ≡ `x = *ptr; *ptr = *ptr + 1;`.
>
> The parentheses change which thing is incremented, a classic exam trap.

### Worked example — swap by reference (Tutorial 3 / Paper-style)

```c
void swap(int *num1, int *num2) {
    int temp = *num1;   /* save num1's value          */
    *num1 = *num2;      /* num1 gets num2's value      */
    *num2 = temp;       /* num2 gets the saved value   */
}

int num1 = 10, num2 = 20;
swap(&num1, &num2);     /* pass addresses             */
```

The function changes the caller's *original* integers because it writes through the passed addresses. A function that receives an address can write through it and affect the caller's storage: that is the entire mechanism behind call-by-reference in C. The lecture's `add(int *x, int *y)` example uses the same idea read-only: `int z = *x + *y;`.

> [!tip] What you must know
> - For an `int *`, `ptr + 1` advances $4$ bytes, *the next `int`*, not one byte.
> - `array[i]` is exactly `*(array + i)`; the array name decays to a pointer.
> - `*ptr++` moves the pointer; `(*ptr)++` changes the value.
> - Passing a pointer lets a function modify the caller's original variable: the `swap(int *a, int *b)` pattern.

> [!warning] Common pitfalls
> - Treating `ptr + 2` as "two bytes later" regardless of type (Paper 1 Exercise 2d explicitly asks why this is wrong).
> - Forgetting that pass-by-reference in C is *implemented using pointers*; there is no separate reference mechanism.

This connects forward to the ARM calling convention: [[Functions, BL-BX, LR, Stack, and Calling Convention|functions]] receive pointer arguments in registers `r0`–`r3` and dereference them with load/store instructions.

---

## Structs and the Arrow Operator

> [!info] Core vocabulary
> - **Struct:** a user-defined type that groups related variables under one name (like a class without methods).
> - **`.` (dot):** accesses a member of a struct *value*.
> - **`->` (arrow):** accesses a member of a struct *via a pointer*; `ptr->m` is shorthand for `(*ptr).m`.
> - **`malloc` / `free`:** allocate / release memory at run time on the heap.

A struct groups related fields for better organisation and abstraction:

```c
typedef struct {
    int x;
    int y;
} Point;

Point p1;
p1.x = 3;        /* dot operator on a struct value          */
p1.y = 2;
```

### Pointers to structs

A pointer can refer to a struct. Members are then reached either by dereferencing-then-dot, or more cleanly with the **arrow operator**:

```c
Point *p2 = &p1;
(*p2).x = 10;    /* dereference, then access member          */
p2->y = 20;      /* arrow: identical, the idiomatic form     */
```

`p2->y` and `(*p2).y` are **exactly equivalent**; the arrow exists purely to make struct-pointer code readable.

### Dynamic allocation

Structs are often created at run time on the heap:

```c
#include <stdlib.h>
Point *p3 = malloc(sizeof(Point));   /* allocate one Point   */
p3->x = 1;
p3->y = 2;
free(p3);                            /* release it           */
```

`malloc(sizeof(Point))` reserves enough bytes for one `Point` and returns its address; `free` hands the memory back. `sizeof` is how you ask for the right number of bytes without hard-coding it.

> [!tip] What you must know
> - A struct groups related variables; access members with `.` on a value.
> - `ptr->member` is shorthand for `(*ptr).member`.
> - `malloc(sizeof(T))` allocates heap memory; `free` releases it.

> [!warning] Common pitfalls
> - Writing `*p2.x` expecting `(*p2).x`. `.` binds tighter than `*`, so `*p2.x` means `*(p2.x)`. Use `p2->x` or parenthesise.
> - Forgetting to `free` heap memory, or using a pointer after `free`.

---

## APSR Flags and Arithmetic Meaning

> [!info] Core vocabulary
> - **APSR:** Application Program Status Register; holds arithmetic/logic-result flags.
> - **N flag:** Negative; result's sign bit is $1$ (signed reasoning).
> - **Z flag:** Zero; result equals $0$ (signed and unsigned).
> - **C flag:** Carry; unsigned carry out / no-borrow (unsigned reasoning).
> - **V flag:** oVerflow; signed overflow (signed reasoning).

The APSR is the **bridge between arithmetic instructions and control flow**. A flag-setting operation records its outcome in compact form so that later instructions, especially conditional branches, can inspect it without recomputing the arithmetic.

### The four flags: meaning after add or sub

| Flag | Name | Set when… | Interpretation context |
| --- | --- | --- | --- |
| $N$ | Negative | the result's sign bit is $1$ | **signed** reasoning |
| $Z$ | Zero | the result equals $0$ | signed *and* unsigned |
| $C$ | Carry | unsigned carry out (add) / no-borrow (sub) | **unsigned** reasoning |
| $V$ | oVerflow | signed overflow occurred | **signed** reasoning |

The slides summarise the *cause* rules precisely:

- **$C$ is set** on an *unsigned addition* whose answer is wrong (too big to fit).
- **$C$ is cleared** on an *unsigned subtraction* whose answer is wrong (a borrow was needed).
- **$V$ is set** on a *signed* add or subtract whose answer is wrong, the four sign cases from [[#Signed Integer Representation and Two's Complement]] (`+A++B=-C`, `-A+-B=+C`, `+A--B=-C`, `-A-+B=+C`).

> [!info] Slide flag traces
> - `unsigned x = 4294967295; x += 2;` → result wraps; flags `N=0 Z=0 C=1 V=0` (carry set, `xpsr` shows `0x21000000`).
> - `unsigned a=0, b=1; c = a - b;` → `c = 4294967295` (`0xFFFFFFFF`); flags `N=1 Z=0 C=0 V=0` (carry cleared = borrow needed).

<figure class="diag-figure">
  <figcaption>APSR flag layout — N, Z, C, V occupy the top four bits of the status register</figcaption>
  <svg viewBox="0 0 560 130" class="diag-svg" role="img" aria-label="APSR flag bit layout">
    <rect x="60"  y="44" width="80" height="46" class="d-node-acc"/>
    <text x="100" y="66" text-anchor="middle" class="d-h">N</text>
    <text x="100" y="84" text-anchor="middle" class="d-sub">bit 31</text>

    <rect x="140" y="44" width="80" height="46" class="d-node-acc"/>
    <text x="180" y="66" text-anchor="middle" class="d-h">Z</text>
    <text x="180" y="84" text-anchor="middle" class="d-sub">bit 30</text>

    <rect x="220" y="44" width="80" height="46" class="d-node-acc"/>
    <text x="260" y="66" text-anchor="middle" class="d-h">C</text>
    <text x="260" y="84" text-anchor="middle" class="d-sub">bit 29</text>

    <rect x="300" y="44" width="80" height="46" class="d-node-acc"/>
    <text x="340" y="66" text-anchor="middle" class="d-h">V</text>
    <text x="340" y="84" text-anchor="middle" class="d-sub">bit 28</text>

    <rect x="380" y="44" width="120" height="46" class="d-node"/>
    <text x="440" y="69" text-anchor="middle" class="d-sub">bits 27..0 — other</text>

    <text x="100" y="32" text-anchor="middle" class="d-sub">Negative</text>
    <text x="180" y="32" text-anchor="middle" class="d-sub">Zero</text>
    <text x="260" y="32" text-anchor="middle" class="d-sub">Carry</text>
    <text x="340" y="32" text-anchor="middle" class="d-sub">oVerflow</text>
    <text x="280" y="116" text-anchor="middle" class="d-sub">one flag-setting instruction sets all four at once</text>
  </svg>
</figure>

### Why one compare serves both signed and unsigned branches

A single `CMP` produces *one* set of flags. Different branch mnemonics then *interpret* those flags differently: signed branches (`BGT`, `BLT`) consult $N$ and $V$; unsigned branches (`BHI`, `BLO`, `BHS`) consult $C$ (and $Z$). That is why the same comparison supports both signed and unsigned conditional branches without re-running the arithmetic, and why the *same raw bit patterns* can give different answers under `BGT` vs `BHI` (Paper 2 Q9). The CPU does not know the intended signedness; the programmer picks the branch.

### When flags get updated

- Many data-processing instructions update flags **only with the `S` suffix**: `ADDS` updates flags, plain `ADD` does not.
- `CMP {Rn}, {operand}` is *inherently* flag-focused: it performs a subtraction, discards the numeric result, and keeps only the flags.

> [!tip] What you must know
> - The core meanings of $N$, $Z$, $C$, $V$, and which are signed vs unsigned.
> - $C$ set ⇒ unsigned add overflowed; $C$ cleared ⇒ unsigned subtract borrowed.
> - $V$ set ⇒ signed overflow (one of the four sign-mismatch cases).
> - `ADDS` sets flags, `ADD` does not; `CMP` exists purely to set flags.

> [!warning] Common pitfalls
> - Treating the APSR as a general data or address register; it holds *status bits*.
> - Confusing **carry** ($C$, unsigned) with **signed overflow** ($V$). Distinct events, distinct flags.

When you meet a branch condition, identify which flag combination it tests and how those flags were produced. This is the foundation for the comparison-and-branching material in later chapters.

---

## Past exam coverage

- **Paper 1 Q5 — little-endian storage.** Given `0x12345678`, write the byte sequence low-to-high: `78 56 34 12`. Reorder *bytes*, never nibbles.
- **Paper 1 Q7 — match N/Z/C/V.** Model answer: `N` negative, `Z` zero, `C` carry / no-borrow unsigned condition, `V` signed overflow.
- **Paper 1 Q10 — `*(ptr + 2)`.** For `int *ptr` at the first element of an array, this is the *third* element — pointer arithmetic scales by `sizeof(int)`.
- **Paper 1 Exercise 2 — pointers, arrays, byte layout (20 marks).** For `int arr[]={10,20,30,40}; int *ptr=arr; int a=*(ptr+2); *(ptr+1)=99;` — `ptr` holds `&arr[0]`; `a = 30`; final array `{10,99,30,40}`; `ptr+2` is "two elements" because arithmetic scales by element size; `0x12345678` little-endian is `78 56 34 12`.
- **Paper 1 Exercise 3 — set/clear bits in a GPIO register.** Reference solution: `LDR r1,[r0]` / `ORR r1,r1,#0x80` (set bit 7) / `BIC r1,r1,#0x08` (clear bit 3) / `STR r1,[r0]`. The C mirror is `var |= (1<<7); var &= ~(1<<3);`.
- **Paper 2 Exercise 2 — flags, signedness, overflow, bitwise (30 marks).** Hand-compute `10110100 AND/OR/XOR 00001111` = `00000100` / `10111111` / `10111011`. `0x7FFFFFFF + 1 = 0x80000000`, which is the most negative signed value — signed overflow. Odd-test: `TST r0,#1` then branch on `Z` — the bit-check practical at index $0$.
- **Paper 2 Q9 — `BGT` vs `BHI` on the same bits.** Signed and unsigned branches interpret the same flag state differently; the CPU does not know the intended signedness.
- **General framing.** Any question mixing a value's *numeric meaning*, its *fixed-width bit pattern*, and its *memory layout* tests the same skill — keep those three layers explicitly separate.
