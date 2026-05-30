# Worked Examples — Greedy Algorithms

Supplementary examples with full pseudocode for exam-shape problems.

---

## 1. Interval Scheduling — Maximum Independent Set of Intervals

**Problem.** Given $n$ intervals $\{(s_i, f_i)\}$, select the largest subset of pairwise non-overlapping intervals.

**Greedy rule.** Earliest-finish-time first.

```
INTERVAL-SCHEDULING(intervals):
    sort intervals by finish time f_i ascending
    chosen = []
    last_finish = -infinity
    for I in intervals:
        if I.start >= last_finish:
            chosen.append(I)
            last_finish = I.finish
    return chosen
```

**Runtime.** $O(n \log n)$ for the sort, then $O(n)$ for the scan, so $O(n \log n)$ total.

**Exchange argument (5-sentence template).**
1. Let $G$ be the greedy solution and $OPT$ be an optimal solution with the maximum number of intervals shared with $G$.
2. Suppose $G \neq OPT$, and let $j$ be the first index at which they differ (sorted by finish time).
3. Greedy picks an interval finishing no later than $OPT$'s choice at position $j$ (by the EFT rule).
4. Swap $OPT$'s $j$-th choice for greedy's — the resulting solution is still feasible (no new conflicts) and has the same size.
5. The swapped solution shares more intervals with $G$ than $OPT$ did — contradicting maximality. Hence $G = OPT$.

---

## 2. Interval Partitioning — Minimum Number of Resources (Lecture Scheduling)

**Problem.** Schedule $n$ intervals on the minimum number of rooms such that no two overlapping intervals share a room.

**Greedy rule.** Earliest start time; assign to any available room, open a new room only if necessary.

```
INTERVAL-PARTITIONING(intervals):
    sort intervals by start time s_i ascending
    rooms = []  # each room remembers its last finish time
    for I in intervals:
        room = first r in rooms with rooms[r].last_finish <= I.start
        if room exists:
            rooms[room].last_finish = I.finish
        else:
            rooms.append(new room with last_finish = I.finish)
    return |rooms|
```

**Optimality argument.** Let $d$ = maximum depth (number of intervals overlapping at any point). The algorithm uses exactly $d$ rooms (lower bound trivial; upper bound from invariant: when we open a new room for $I$, all existing rooms are blocked by intervals overlapping $I$, so depth $\geq |rooms|$).

**Runtime.** $O(n \log n)$ using a priority queue keyed by last finish time.

---

## 3. Refueling Stops (Tank Range $L$)

**Problem.** Start at position $0$, must reach position $D$. Stations at positions $x_1 < x_2 < \ldots < x_n$. Tank holds enough fuel for $L$ km. Minimize the number of refuels.

**Greedy rule.** Drive past as many stations as you can; refuel at the last reachable one.

```
REFUEL(stations, L, D):
    pos = 0
    stops = 0
    i = 0
    while pos + L < D:
        # find furthest reachable station
        furthest = None
        while i < |stations| and stations[i] <= pos + L:
            furthest = stations[i]
            i += 1
        if furthest is None:
            return "impossible"
        pos = furthest
        stops += 1
    return stops
```

**Runtime.** $O(n)$.

---

## 4. Dijkstra's Algorithm — Shortest Paths from Source $s$

**Setting.** Directed graph $G = (V, E)$, non-negative edge weights $w(u,v) \geq 0$.

```
DIJKSTRA(G, s):
    for v in V: dist[v] = +infinity
    dist[s] = 0
    PQ = priority queue of (dist[v], v) for all v
    while PQ not empty:
        (d, u) = extract-min(PQ)
        if d > dist[u]: continue           # stale entry
        for (u -> v) in E:
            if dist[u] + w(u,v) < dist[v]:
                dist[v] = dist[u] + w(u,v)
                PQ.insert((dist[v], v))
    return dist
```

**Why positive weights matter.** With a negative edge, a vertex $v$ extracted from PQ with `dist[v]` may later be improved via a longer path with a negative summand — invalidating the greedy commitment.

**Runtime.** $O((|V| + |E|) \log |V|)$ with a binary heap.

---

## 5. Prim's Algorithm — Minimum Spanning Tree

**Greedy rule.** From the growing tree $T$, repeatedly add the minimum-cost edge crossing from $T$ to $V \setminus T$.

```
PRIM(G, root):
    T = {root}
    PQ = priority queue of edges (cost, root -> v) for v in neighbours(root)
    mst = []
    while T != V:
        (c, u -> v) = extract-min(PQ)
        if v in T: continue
        T = T union {v}
        mst.append((u, v, c))
        for (v -> w) in E with w not in T:
            PQ.insert((w(v,w), v -> w))
    return mst
```

**Cut property.** For any non-trivial cut $(S, V\setminus S)$, the minimum-cost crossing edge is in some MST. Prim adds exactly such an edge at every step.

**Runtime.** $O(|E| \log |V|)$ with a binary heap.

---

## 6. Counterexamples to Naive Greedy Choices

- **Interval Selection, earliest start time:** counterexample — one long interval $[0, 100]$ plus many short ones $[1,2], [3,4], \ldots$ — earliest-start picks the long one and skips all.
- **Interval Selection, shortest duration:** $[0, 10], [5, 6], [5, 6]$ — shortest first picks $[5,6]$ blocking both $[0,10]$ and the other $[5,6]$.
- **Coin change, denominations $\{1, 3, 4\}$, target $6$:** greedy picks $4 + 1 + 1$ (3 coins); optimal is $3 + 3$ (2 coins). Standard coin systems (e.g., euro) are designed so greedy works.
