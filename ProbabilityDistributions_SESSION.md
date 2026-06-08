# Probability Distribution Explorer — Session Summary

## Project
**File:** `ProbabilityDistributions.html`
**Repo:** `ljnovoa/Decision-Modeling-Analytics`
**Branch:** `claude/probability-distribution-viz-9BaMb`
**Commit:** `d404540`

---

## What Was Built

A single-file, no-dependency HTML app for students to explore probability distributions interactively.

### Distributions Implemented (12 total)

| Type | Distributions |
|------|--------------|
| Discrete | Bernoulli(p), Binomial(n,p), Geometric(p), Discrete Uniform(a,b), Poisson(λ), Negative Binomial(r,p) |
| Continuous | Normal(μ,σ), Uniform(a,b), Gamma(α,β), Lognormal(μ,σ), Triangular(a,c,b), Exponential(λ) |

### Features
- **Sidebar** — distributions grouped as Discrete (orange) / Continuous (purple)
- **PMF/PDF ↔ CDF toggle** — button in the top bar
- **Live parameter sliders** — chart and stats update instantly on drag
- **Stats panel** — Mean, Variance, Std Dev, Mode recalculate live
- **Info panel** — description, PMF/PDF formula, 4 real-world use cases per distribution
- **Dark theme** — `#0a0a14` background, Chart.js 4.4 via CDN

### Tech Stack
- Pure HTML/CSS/JS — opens directly in any browser, no server needed
- Chart.js 4.4.0 (CDN) for rendering
- Custom math: Lanczos log-gamma, error function (Abramowitz & Stegun), Simpson's rule for CDFs

---

## Design Decisions Made This Session
- Dark theme (user choice)
- PMF/PDF + CDF toggle (not side-by-side, not PDF-only)
- Stats panel shown (mean, variance, std dev, mode)
- No distribution comparison/overlay mode
- Discrete PMF → bar chart; Discrete CDF → step line; Continuous → filled area

---

## Potential Next Steps
- Add percentile markers on the chart (5% / 90% / 5% regions, as shown in original lecture slides)
- Add a "random sample" button that draws from the distribution and animates points
- Export chart as PNG
- Mobile-responsive layout
- Add Chi-squared, Beta, Weibull, Hypergeometric distributions
- Embed in the course website (`my_webpage.html`)

---

## Reference Material
Original slides used for distribution definitions:
- Discrete: Bernoulli, Binomial, Geometric, Discrete Uniform, Poisson, Negative Binomial
- Continuous: Normal, Uniform, Gamma, Lognormal, Triangular, Exponential
- Source: *Fundamentals of Probability with Stochastic Processes* — Ghahramani
