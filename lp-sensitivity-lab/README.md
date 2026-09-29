# LP Sensitivity Lab

A static browser prototype for exploring one-at-a-time sensitivity analysis in a two-variable linear program.

Open `index.html` in a browser. The app recomputes the feasible vertices, optimal solution, objective value, and Solver-style sensitivity report whenever a parameter changes.

Parameter changes are not cumulative. Each slider starts from the base model and applies only the currently active RHS or objective coefficient change.

The current model is the OktoValve / OktoPrint production LP:

```text
maximize 4Xv + 3Xp
subject to
2Xv <= 1000
2.5Xv + Xp <= 1600
2.7Xv + 3Xp <= 2688        Fabric
Xp - Xv <= 200             Difference
Xv + Xp >= 100             Commitment
Xv, Xp >= 0
```
