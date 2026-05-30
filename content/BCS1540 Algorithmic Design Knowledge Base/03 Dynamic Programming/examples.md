# Worked Examples — Dynamic Programming

Each example uses the strict 4-step format: **(1)** Table, **(2)** Recurrence, **(3)** Bottom-up algorithm + runtime, **(4)** Reconstruction.

---

## 1. Longest Common Subsequence (LCS)

**Input.** Two strings $s_1$ (length $n$), $s_2$ (length $m$).

**Table.** $L[i][j]$ = length of the LCS of prefixes $s_1[1..i]$ and $s_2[1..j]$.

**Recurrence.**
$$L[i][j] = \begin{cases} 0 & i=0 \text{ or } j=0 \\ L[i-1][j-1] + 1 & s_1[i] = s_2[j] \\ \max(L[i-1][j], L[i][j-1]) & s_1[i] \neq s_2[j] \end{cases}$$

**Bottom-up.**

```
LCS(s1, s2):
    n = |s1|, m = |s2|
    L = array (n+1) x (m+1) initialized to 0
    for i in 1..n:
        for j in 1..m:
            if s1[i] == s2[j]:
                L[i][j] = L[i-1][j-1] + 1
            else:
                L[i][j] = max(L[i-1][j], L[i][j-1])
    return L[n][m]
```

**Runtime.** $\Theta(nm)$ time, $\Theta(nm)$ space (rolling-window gives $\Theta(m)$ space if reconstruction is not needed).

**Reconstruction.**

```
RECONSTRUCT-LCS(L, s1, s2):
    i = n, j = m
    out = []
    while i > 0 and j > 0:
        if s1[i] == s2[j]:
            out.prepend(s1[i]); i -= 1; j -= 1
        elif L[i-1][j] >= L[i][j-1]:
            i -= 1
        else:
            j -= 1
    return out
```

---

## 2. Weighted Interval Scheduling

**Input.** $n$ intervals each with start $s_i$, finish $f_i$, weight $w_i$.

**Preprocess.** Sort by finish time. Compute $p(i)$ = largest index $j < i$ such that $f_j \leq s_i$ (use binary search).

**Table.** $M[i]$ = maximum weight schedulable using intervals $1..i$.

**Recurrence.** $M[i] = \max(M[i-1], \; w_i + M[p(i)])$ with $M[0] = 0$.

```
WIS(intervals):
    sort intervals by finish time
    compute p[i] for each i (binary search)
    M[0] = 0
    for i in 1..n:
        M[i] = max(M[i-1], w[i] + M[p[i]])
    return M[n]
```

**Runtime.** $\Theta(n \log n)$ overall (sort + binary search per element).

**Reconstruction.**

```
RECONSTRUCT-WIS(M, p, w):
    i = n
    out = []
    while i > 0:
        if w[i] + M[p[i]] > M[i-1]:
            out.append(i)
            i = p[i]
        else:
            i -= 1
    return reverse(out)
```

---

## 3. 0/1 Knapsack

**Input.** Items $1..n$ with values $v_i$ and weights $w_i$. Capacity $W$.

**Table.** $K[i][c]$ = max value using items $1..i$ with capacity $c$.

**Recurrence.**
$$K[i][c] = \begin{cases} K[i-1][c] & w_i > c \\ \max(K[i-1][c], \; v_i + K[i-1][c - w_i]) & w_i \leq c \end{cases}$$

```
KNAPSACK(v, w, W):
    K = (n+1) x (W+1) initialized to 0
    for i in 1..n:
        for c in 0..W:
            if w[i] > c:
                K[i][c] = K[i-1][c]
            else:
                K[i][c] = max(K[i-1][c], v[i] + K[i-1][c - w[i]])
    return K[n][W]
```

**Runtime.** $\Theta(nW)$ time. **Pseudo-polynomial**: $W$ is a *value*, not the input length in bits.

**Reconstruction.**

```
RECONSTRUCT-KNAPSACK(K, w, v):
    i = n; c = W
    chosen = []
    while i > 0:
        if K[i][c] != K[i-1][c]:
            chosen.append(i)
            c = c - w[i]
        i -= 1
    return chosen
```

---

## 4. Maximum Sum Contiguous Subarray (Kadane in 4-Step Form)

**Table.** $E[i]$ = maximum sum of a contiguous subarray ending exactly at position $i$.

**Recurrence.** $E[i] = \max(A[i], \; E[i-1] + A[i])$ with $E[1] = A[1]$.

**Result.** $\max_i E[i]$.

```
MAX-SUM(A):
    E[1] = A[1]
    best = A[1]; best_end = 1
    for i in 2..n:
        E[i] = max(A[i], E[i-1] + A[i])
        if E[i] > best: best = E[i]; best_end = i
    return best, best_end
```

**Runtime.** $\Theta(n)$.

**Reconstruction.** Walk back from `best_end`: include $A[i]$ while $E[i] \neq A[i]$; stop at the index where the subarray restarted.

---

## 5. Floyd-Warshall — All-Pairs Shortest Paths

**Table.** $D^k[i][j]$ = shortest path from $i$ to $j$ using only intermediate vertices in $\{1, \ldots, k\}$.

**Recurrence.** $D^k[i][j] = \min(D^{k-1}[i][j], \; D^{k-1}[i][k] + D^{k-1}[k][j])$.

```
FLOYD-WARSHALL(W):  # W[i][j] = direct edge weight, +inf if absent
    D = copy of W
    for k in 1..n:
        for i in 1..n:
            for j in 1..n:
                if D[i][k] + D[k][j] < D[i][j]:
                    D[i][j] = D[i][k] + D[k][j]
    return D
```

**Runtime.** $\Theta(n^3)$.

**Negative cycles.** Diagonal $D[i][i] < 0$ after the loop iff $i$ is on a negative cycle.

---

## 6. Edit Distance (Levenshtein)

**Table.** $E[i][j]$ = minimum edits to transform $s_1[1..i]$ into $s_2[1..j]$.

**Recurrence.**
$$E[i][j] = \begin{cases} \max(i,j) & i=0 \text{ or } j=0 \\ E[i-1][j-1] & s_1[i] = s_2[j] \\ 1 + \min(E[i-1][j], E[i][j-1], E[i-1][j-1]) & \text{otherwise} \end{cases}$$

```
EDIT-DIST(s1, s2):
    n = |s1|, m = |s2|
    E = (n+1) x (m+1)
    for i in 0..n: E[i][0] = i
    for j in 0..m: E[0][j] = j
    for i in 1..n:
        for j in 1..m:
            if s1[i] == s2[j]:
                E[i][j] = E[i-1][j-1]
            else:
                E[i][j] = 1 + min(E[i-1][j], E[i][j-1], E[i-1][j-1])
    return E[n][m]
```

**Runtime.** $\Theta(nm)$.
